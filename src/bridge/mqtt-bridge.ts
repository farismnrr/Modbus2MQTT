import { EventEmitter } from 'node:events';
import mqtt, { MqttClient } from 'mqtt';
import { BridgeConfiguration, ModbusDeviceConfig } from '../config/schema.js';
import { ConfigStore } from '../config/store.js';
import { BridgeLogger, LogEntry } from '../logger.js';
import { ModbusPoller } from '../modbus/poller.js';
import { buildBridgeDevicesPayload } from './exposes.js';

export const APP_VERSION = '1.0.0';

export class MqttBridge extends EventEmitter {
  private client: MqttClient | null = null;
  private currentBaseTopic = 'modbus2mqtt';
  private connected = false;
  private lastError: string | undefined;

  constructor(
    private readonly configStore: ConfigStore,
    private readonly logger: BridgeLogger,
    private poller: ModbusPoller | null = null,
  ) {
    super();
    this.logger.on('log', (entry: LogEntry) => {
      this.publishLogEntry(entry);
    });
  }

  attachPoller(poller: ModbusPoller): void {
    this.poller = poller;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  connect(): void {
    this.disconnectSync();
    const cfg = this.configStore.get();
    this.currentBaseTopic = cfg.mqtt.base_topic;
    this.logger.setLevel(cfg.advanced.log_level);

    const willTopic = `${this.currentBaseTopic}/bridge/state`;
    this.logger.info(
      'm2m:mqtt',
      `Connecting to MQTT broker ${cfg.mqtt.server} (base_topic=${this.currentBaseTopic})`,
    );

    const client = mqtt.connect(cfg.mqtt.server, {
      username: cfg.mqtt.user,
      password: cfg.mqtt.password,
      clientId: cfg.mqtt.client_id || `modbus2mqtt_${Math.random().toString(16).slice(2, 8)}`,
      keepalive: cfg.mqtt.keepalive || 60,
      reconnectPeriod: 3000,
      will: {
        topic: willTopic,
        payload: JSON.stringify({ state: 'offline' }),
        qos: 1,
        retain: true,
      },
    });

    client.on('connect', () => {
      this.connected = true;
      this.lastError = undefined;
      this.logger.info('m2m:mqtt', `Connected to MQTT broker (${cfg.mqtt.server})`);
      this.subscribeControlTopics(client);
      this.publishBridgeSnapshots();
      this.emit('mqtt:status', { connected: true });
    });

    client.on('reconnect', () => {
      this.logger.debug('m2m:mqtt', 'Reconnecting to MQTT broker...');
    });

    client.on('close', () => {
      this.connected = false;
      this.emit('mqtt:status', { connected: false });
    });

    client.on('error', (err) => {
      this.lastError = err.message;
      this.logger.error('m2m:mqtt', `MQTT error: ${err.message}`);
      this.emit('mqtt:status', { connected: this.connected, error: err.message });
    });

    client.on('message', (topic, payloadBuf) => {
      void this.handleInboundMessage(topic, payloadBuf);
    });

    this.client = client;
  }

  disconnectSync(): void {
    if (this.client) {
      try {
        if (this.connected) {
          this.client.publish(
            `${this.currentBaseTopic}/bridge/state`,
            JSON.stringify({ state: 'offline' }),
            { qos: 1, retain: true },
          );
        }
        this.client.end(true);
      } catch {
        // ignore close errors
      }
      this.client = null;
      this.connected = false;
    }
  }

  publishBridgeSnapshots(): void {
    const cfg = this.configStore.get();
    this.publishRelative('bridge/state', { state: 'online' }, true);
    this.publishRelative('bridge/info', this.buildBridgeInfoPayload(cfg), true);
    this.publishBridgeDevices();
  }

  publishBridgeDevices(): void {
    const devicesPayload = buildBridgeDevicesPayload(this.configStore.get().devices);
    this.publishRelative('bridge/devices', devicesPayload, true);
    this.emit('ws:broadcast', { topic: 'bridge/devices', payload: devicesPayload });
  }

  publishTelemetry(device: ModbusDeviceConfig, values: Record<string, unknown>): void {
    const cfg = this.configStore.get();
    const out: Record<string, unknown> = { ...values };
    if (cfg.advanced.last_seen === 'ISO_8601') {
      out.last_seen = new Date().toISOString();
    } else if (cfg.advanced.last_seen === 'epoch') {
      out.last_seen = Date.now();
    }
    this.publishRelative(device.friendly_name, out, false);
    this.emit('ws:broadcast', { topic: device.friendly_name, payload: out });
  }

  publishAvailability(device: ModbusDeviceConfig, state: 'online' | 'offline'): void {
    const cfg = this.configStore.get();
    if (!cfg.availability.enabled) return;
    const payload = { state };
    this.publishRelative(`${device.friendly_name}/availability`, payload, true);
    this.emit('ws:broadcast', { topic: `${device.friendly_name}/availability`, payload });
  }

  buildBridgeInfoPayload(cfg = this.configStore.get()): Record<string, unknown> {
    const sanitizedMqtt = {
      ...cfg.mqtt,
      password: cfg.mqtt.password ? '***' : undefined,
    };
    return {
      version: APP_VERSION,
      commit: process.env.GIT_COMMIT || 'dev',
      coordinator: {
        type: 'Modbus2MQTT',
        meta: {
          transports: ['tcp', 'rtu_tcp', 'serial'],
          devices: Object.keys(cfg.devices).length,
        },
      },
      config: {
        mqtt: sanitizedMqtt,
        frontend: {
          enabled: cfg.frontend.enabled,
          port: cfg.frontend.port,
          host: cfg.frontend.host,
        },
        availability: cfg.availability,
        advanced: cfg.advanced,
      },
    };
  }

  async handleBridgeRequest(
    endpoint: string,
    rawPayload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const transaction = rawPayload.transaction;
    const reply = (ok: boolean, data: unknown, error?: string): Record<string, unknown> => {
      const resp: Record<string, unknown> = {
        status: ok ? 'ok' : 'error',
        data: ok ? data : {},
      };
      if (error) resp.error = error;
      if (transaction !== undefined) resp.transaction = transaction;
      return resp;
    };

    try {
      switch (endpoint) {
        case 'health_check': {
          return reply(true, { healthy: true });
        }
        case 'options': {
          const opts = (isRecord(rawPayload.options) ? rawPayload.options : rawPayload) as Record<
            string,
            unknown
          >;
          const { config, mqttChanged } = this.configStore.applyBridgeOptions(opts);
          this.logger.setLevel(config.advanced.log_level);
          const info = this.buildBridgeInfoPayload(config);
          this.emit('ws:broadcast', { topic: 'bridge/info', payload: info });
          if (mqttChanged) {
            this.logger.info('m2m:bridge', 'MQTT options updated via bridge/request/options; reconnecting');
            setTimeout(() => this.connect(), 50);
          } else {
            this.publishRelative('bridge/info', info, true);
          }
          return reply(true, { restart_required: false });
        }
        case 'restart': {
          this.logger.info('m2m:bridge', 'Restarting pollers & MQTT connection on request');
          setTimeout(() => {
            this.poller?.reload();
            this.connect();
          }, 150);
          return reply(true, {});
        }
        case 'device/rename': {
          const from = typeof rawPayload.from === 'string' ? rawPayload.from : '';
          const to = typeof rawPayload.to === 'string' ? rawPayload.to : '';
          const target = this.findDeviceByIdentifier(from);
          if (!target) return reply(false, {}, `Device "${from}" not found`);
          const updated = this.configStore.renameDevice(target.ieee_address, to);
          this.poller?.reload();
          this.publishBridgeDevices();
          return reply(true, { from, to: updated.friendly_name });
        }
        case 'device/remove': {
          const id = typeof rawPayload.id === 'string' ? rawPayload.id : '';
          const target = this.findDeviceByIdentifier(id);
          if (!target) return reply(false, {}, `Device "${id}" not found`);
          this.configStore.deleteDevice(target.ieee_address);
          this.poller?.reload();
          this.publishBridgeDevices();
          return reply(true, { id: target.friendly_name });
        }
        default:
          return reply(false, {}, `Unknown bridge request endpoint: ${endpoint}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply(false, {}, msg);
    }
  }

  private subscribeControlTopics(client: MqttClient): void {
    const base = this.currentBaseTopic;
    client.subscribe([
      `${base}/bridge/request/#`,
      `${base}/+/set`,
      `${base}/+/set/#`,
      `${base}/+/get`,
      `${base}/+/get/#`,
    ]);
  }

  private async handleInboundMessage(topic: string, payloadBuf: Buffer): Promise<void> {
    const prefix = `${this.currentBaseTopic}/`;
    if (!topic.startsWith(prefix)) return;
    const subtopic = topic.slice(prefix.length);

    let parsed: Record<string, unknown> = {};
    const text = payloadBuf.toString('utf8').trim();
    if (text.length > 0) {
      try {
        const jsonVal = JSON.parse(text) as unknown;
        if (isRecord(jsonVal)) {
          parsed = jsonVal;
        }
      } catch {
        // single-property topic fallback handled below
      }
    }

    if (subtopic.startsWith('bridge/request/')) {
      const endpoint = subtopic.slice('bridge/request/'.length);
      const response = await this.handleBridgeRequest(endpoint, parsed);
      this.publishRelative(`bridge/response/${endpoint}`, response, false);
      this.emit('ws:broadcast', { topic: `bridge/response/${endpoint}`, payload: response });
      return;
    }

    // <friendly_name>/set or <friendly_name>/set/<property>
    const setMatch = /^([^/]+)\/set(?:\/(.+))?$/.exec(subtopic);
    if (setMatch) {
      const [, identifier, prop] = setMatch;
      const device = this.findDeviceByIdentifier(identifier);
      if (!device || !this.poller) return;
      const commandPayload = prop ? { [prop]: text } : parsed;
      try {
        await this.poller.applySetCommand(device.ieee_address, commandPayload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error('m2m:set', `Failed /set for ${device.friendly_name}: ${msg}`);
      }
      return;
    }

    // <friendly_name>/get or <friendly_name>/get/<property>
    const getMatch = /^([^/]+)\/get(?:\/(.+))?$/.exec(subtopic);
    if (getMatch) {
      const [, identifier] = getMatch;
      const device = this.findDeviceByIdentifier(identifier);
      if (!device || !this.poller) return;
      try {
        await this.poller.pollDeviceNow(device.ieee_address);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn('m2m:get', `Failed /get for ${device.friendly_name}: ${msg}`);
      }
    }
  }

  private findDeviceByIdentifier(idOrName: string): ModbusDeviceConfig | undefined {
    const devices = this.configStore.get().devices;
    if (devices[idOrName]) return devices[idOrName];
    return Object.values(devices).find((d) => d.friendly_name === idOrName);
  }

  private publishRelative(relativeTopic: string, payload: unknown, retain: boolean): void {
    if (!this.client || !this.connected) return;
    const fullTopic = `${this.currentBaseTopic}/${relativeTopic}`;
    this.client.publish(fullTopic, JSON.stringify(payload), { qos: 0, retain });
  }

  private publishLogEntry(entry: LogEntry): void {
    const payload = {
      level: entry.level,
      message: `${entry.namespace}: ${entry.message}`,
      timestamp: entry.timestamp,
    };
    this.publishRelative('bridge/logging', payload, false);
    this.emit('ws:broadcast', { topic: 'bridge/logging', payload });
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}
