import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { ModbusDeviceConfig, ModbusPointConfig, ModbusRpcConfig, SlaveConnectionConfig } from '../config/schema.js';
import { ConfigStore } from '../config/store.js';
import { BridgeLogger } from '../logger.js';
import { ModbusPoller } from '../modbus/poller.js';
import { buildBridgeDevicesPayload } from '../bridge/exposes.js';
import { MqttBridge } from '../bridge/mqtt-bridge.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface BridgeServer {
  httpServer: http.Server;
  wss: WebSocketServer;
  close: () => Promise<void>;
}

export function startBridgeServer(
  configStore: ConfigStore,
  mqttBridge: MqttBridge,
  poller: ModbusPoller,
  logger: BridgeLogger,
  frontendDistDir = path.resolve(process.cwd(), 'frontend', 'dist'),
): BridgeServer {
  const cfg = configStore.get();

  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res, configStore, mqttBridge, poller, frontendDistDir);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname !== '/api') {
      socket.destroy();
      return;
    }

    const expectedToken = configStore.get().frontend.auth_token?.trim();
    if (expectedToken) {
      const provided = reqUrl.searchParams.get('token')?.trim();
      if (provided !== expectedToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws);
    });
  });

  wss.on('connection', (ws) => {
    // Replay current retained Z2M-equivalent topics on connect
    const send = (topic: string, payload: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ topic, payload }));
      }
    };

    const currentCfg = configStore.get();
    send('bridge/state', { state: 'online' });
    send('bridge/info', mqttBridge.buildBridgeInfoPayload(currentCfg));
    send('bridge/devices', buildBridgeDevicesPayload(currentCfg.devices));
    send('bridge/extensions', []);
    send('bridge/groups', []);

    for (const dev of Object.values(currentCfg.devices)) {
      const state = poller.getState(dev.ieee_address);
      if (state) {
        send(`${dev.friendly_name}/availability`, { state: state.availability });
        if (Object.keys(state.values).length > 0) {
          send(dev.friendly_name, state.values);
        }
      }
    }

    ws.on('message', (data) => {
      void handleWsMessage(ws, data.toString('utf8'), mqttBridge, poller, configStore);
    });
  });

  mqttBridge.on('ws:broadcast', (msg: { topic: string; payload: unknown }) => {
    const frame = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frame);
      }
    }
  });

  server.listen(cfg.frontend.port, cfg.frontend.host, () => {
    logger.info(
      'm2m:server',
      `Modbus2MQTT Web UI & WebSocket /api listening on http://${cfg.frontend.host}:${cfg.frontend.port}`,
    );
  });

  return {
    httpServer: server,
    wss,
    close: () =>
      new Promise((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      }),
  };
}

async function handleWsMessage(
  ws: WebSocket,
  rawText: string,
  mqttBridge: MqttBridge,
  poller: ModbusPoller,
  configStore: ConfigStore,
): Promise<void> {
  let msg: { topic?: string; payload?: Record<string, unknown> };
  try {
    msg = JSON.parse(rawText) as { topic?: string; payload?: Record<string, unknown> };
  } catch {
    return;
  }
  const topic = msg.topic?.trim();
  if (!topic) return;
  const payload = isRecord(msg.payload) ? msg.payload : {};

  if (topic.startsWith('bridge/request/')) {
    const endpoint = topic.slice('bridge/request/'.length);
    const response = await mqttBridge.handleBridgeRequest(endpoint, payload);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ topic: `bridge/response/${endpoint}`, payload: response }));
    }
    return;
  }

  const setMatch = /^([^/]+)\/set$/.exec(topic);
  if (setMatch) {
    const dev = Object.values(configStore.get().devices).find(
      (d) => d.friendly_name === setMatch[1] || d.ieee_address === setMatch[1],
    );
    if (dev) {
      await poller.applySetCommand(dev.ieee_address, payload);
    }
    return;
  }

  const getMatch = /^([^/]+)\/get$/.exec(topic);
  if (getMatch) {
    const dev = Object.values(configStore.get().devices).find(
      (d) => d.friendly_name === getMatch[1] || d.ieee_address === getMatch[1],
    );
    if (dev) {
      await poller.pollDeviceNow(dev.ieee_address);
    }
  }
}

async function handleHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  configStore: ConfigStore,
  mqttBridge: MqttBridge,
  poller: ModbusPoller,
  frontendDistDir: string,
): Promise<void> {
  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';

  if (reqUrl.pathname === '/api/health' && method === 'GET') {
    return json(res, 200, {
      status: 'ok',
      mqtt_connected: mqttBridge.isConnected(),
      mqtt_error: mqttBridge.getLastError(),
      device_count: Object.keys(configStore.get().devices).length,
    });
  }

  if (reqUrl.pathname.startsWith('/api/')) {
    const expectedToken = configStore.get().frontend.auth_token?.trim();
    if (expectedToken) {
      const header = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
      const query = reqUrl.searchParams.get('token')?.trim();
      if (header !== expectedToken && query !== expectedToken) {
        return json(res, 401, { error: 'Unauthorized: invalid or missing API token' });
      }
    }

    try {
      if (reqUrl.pathname === '/api/state' && method === 'GET') {
        return json(res, 200, {
          config: configStore.publicConfig(),
          mqtt_connected: mqttBridge.isConnected(),
          mqtt_error: mqttBridge.getLastError(),
          devices: Object.values(configStore.get().devices),
          states: poller.getAllStates(),
        });
      }

      if (reqUrl.pathname === '/api/devices' && method === 'GET') {
        return json(res, 200, {
          devices: Object.values(configStore.get().devices),
          states: poller.getAllStates(),
        });
      }

      if (reqUrl.pathname === '/api/devices' && method === 'POST') {
        const body = await readJsonBody<ModbusDeviceConfig>(req);
        if (!body.ieee_address) {
          const slug = (body.friendly_name || 'slave')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          body.ieee_address = `m2m_${slug || 'slave'}_${Math.random().toString(36).slice(2, 6)}`;
        }
        const saved = configStore.upsertDevice(body);
        poller.reload();
        mqttBridge.publishBridgeDevices();
        return json(res, 201, saved);
      }

      const devMatch = /^\/api\/devices\/([^/]+)$/.exec(reqUrl.pathname);
      if (devMatch) {
        const id = decodeURIComponent(devMatch[1]);
        if (method === 'PUT') {
          const body = await readJsonBody<ModbusDeviceConfig>(req);
          body.ieee_address = id;
          const saved = configStore.upsertDevice(body);
          poller.reload();
          mqttBridge.publishBridgeDevices();
          return json(res, 200, saved);
        }
        if (method === 'DELETE') {
          const removed = configStore.deleteDevice(id);
          if (!removed) return json(res, 404, { error: 'Device not found' });
          poller.reload();
          mqttBridge.publishBridgeDevices();
          return json(res, 200, { deleted: id });
        }
      }

      const devSetMatch = /^\/api\/devices\/([^/]+)\/set$/.exec(reqUrl.pathname);
      if (devSetMatch && method === 'POST') {
        const id = decodeURIComponent(devSetMatch[1]);
        const body = await readJsonBody<Record<string, unknown>>(req);
        const result = await poller.applySetCommand(id, body);
        return json(res, 200, { ok: true, values: result });
      }

      const devPollMatch = /^\/api\/devices\/([^/]+)\/poll$/.exec(reqUrl.pathname);
      if (devPollMatch && method === 'POST') {
        const id = decodeURIComponent(devPollMatch[1]);
        const values = await poller.pollDeviceNow(id);
        return json(res, 200, { ok: true, values });
      }

      if (reqUrl.pathname === '/api/config/settings' && method === 'PUT') {
        const body = await readJsonBody<Record<string, unknown>>(req);
        const result = await mqttBridge.handleBridgeRequest('options', body);
        return json(res, result.status === 'ok' ? 200 : 400, result);
      }

      if (reqUrl.pathname === '/api/modbus/test-connection' && method === 'POST') {
        const conn = await readJsonBody<SlaveConnectionConfig>(req);
        const outcome = await poller.testConnection(conn);
        return json(res, outcome.ok ? 200 : 502, outcome);
      }

      if (reqUrl.pathname === '/api/modbus/test-point' && method === 'POST') {
        const body = await readJsonBody<{ connection: SlaveConnectionConfig; point: ModbusPointConfig }>(req);
        const outcome = await poller.testPoint(body.connection, body.point);
        return json(res, 200, { ok: true, ...outcome });
      }

      if (reqUrl.pathname === '/api/modbus/test-rpc' && method === 'POST') {
        const body = await readJsonBody<{
          connection: SlaveConnectionConfig;
          rpc: ModbusRpcConfig;
          value?: unknown;
        }>(req);
        const outcome = await poller.testRpc(body.connection, body.rpc, body.value);
        return json(res, 200, { ok: true, ...outcome });
      }

      return json(res, 404, { error: 'Not found' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return json(res, 400, { error: msg });
    }
  }

  // Static SPA serving
  serveStatic(reqUrl.pathname, frontendDistDir, res);
}

function serveStatic(reqPath: string, distDir: string, res: http.ServerResponse): void {
  if (!fs.existsSync(distDir)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Modbus2MQTT backend is running. Run "pnpm run build:frontend" to build the Web UI.');
    return;
  }

  const normalized = reqPath === '/' ? '/index.html' : reqPath;
  const candidate = path.normalize(path.join(distDir, normalized));
  const resolved = candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ? candidate
    : path.join(distDir, 'index.html');

  const ext = path.extname(resolved);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(resolved).pipe(res);
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}
