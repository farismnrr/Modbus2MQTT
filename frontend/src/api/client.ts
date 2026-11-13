import {
  AppSnapshot,
  ModbusDeviceConfig,
  ModbusPointConfig,
  ModbusRpcConfig,
  SlaveConnectionConfig,
} from '../types';

function authHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const t = token || localStorage.getItem('m2m_token') || '';
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export function fetchInitialSnapshot(): Promise<AppSnapshot> {
  return apiFetch<AppSnapshot>('/api/state');
}

export function createDevice(device: Partial<ModbusDeviceConfig>): Promise<ModbusDeviceConfig> {
  return apiFetch<ModbusDeviceConfig>('/api/devices', {
    method: 'POST',
    body: JSON.stringify(device),
  });
}

export function updateDevice(
  ieeeAddress: string,
  device: ModbusDeviceConfig,
): Promise<ModbusDeviceConfig> {
  return apiFetch<ModbusDeviceConfig>(`/api/devices/${encodeURIComponent(ieeeAddress)}`, {
    method: 'PUT',
    body: JSON.stringify(device),
  });
}

export function deleteDevice(ieeeAddress: string): Promise<{ deleted: string }> {
  return apiFetch<{ deleted: string }>(`/api/devices/${encodeURIComponent(ieeeAddress)}`, {
    method: 'DELETE',
  });
}

export function setDeviceValue(
  ieeeAddress: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; values: Record<string, unknown> }> {
  return apiFetch<{ ok: boolean; values: Record<string, unknown> }>(
    `/api/devices/${encodeURIComponent(ieeeAddress)}/set`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function pollDeviceNow(
  ieeeAddress: string,
): Promise<{ ok: boolean; values: Record<string, unknown> }> {
  return apiFetch<{ ok: boolean; values: Record<string, unknown> }>(
    `/api/devices/${encodeURIComponent(ieeeAddress)}/poll`,
    {
      method: 'POST',
    },
  );
}

export function testSlaveConnection(
  conn: SlaveConnectionConfig,
): Promise<{ ok: boolean; latency_ms: number; detail: string }> {
  return apiFetch<{ ok: boolean; latency_ms: number; detail: string }>(
    '/api/modbus/test-connection',
    {
      method: 'POST',
      body: JSON.stringify(conn),
    },
  );
}

export function testRegisterPoint(
  connection: SlaveConnectionConfig,
  point: ModbusPointConfig,
): Promise<{
  ok: boolean;
  value: unknown;
  raw_registers?: number[];
  raw_bits?: boolean[];
  latency_ms: number;
}> {
  return apiFetch('/api/modbus/test-point', {
    method: 'POST',
    body: JSON.stringify({ connection, point }),
  });
}

export function testRpcMethod(
  connection: SlaveConnectionConfig,
  rpc: ModbusRpcConfig,
  value?: unknown,
): Promise<{
  ok: boolean;
  result: unknown;
  raw_registers?: number[];
  raw_bits?: boolean[];
  latency_ms: number;
}> {
  return apiFetch('/api/modbus/test-rpc', {
    method: 'POST',
    body: JSON.stringify({ connection, rpc, value }),
  });
}

export function saveBridgeSettings(options: Record<string, unknown>): Promise<unknown> {
  return apiFetch('/api/config/settings', {
    method: 'PUT',
    body: JSON.stringify(options),
  });
}

export function openBridgeWebSocket(
  onMessage: (topic: string, payload: unknown) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: number | undefined;

  const connect = () => {
    if (closed) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('m2m_token') || '';
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    ws = new WebSocket(`${proto}//${window.location.host}/api${qs}`);

    ws.onopen = () => onStatus(true);
    ws.onclose = () => {
      onStatus(false);
      if (!closed) {
        reconnectTimer = window.setTimeout(connect, 2500);
      }
    };
    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as { topic?: string; payload?: unknown };
        if (parsed.topic) onMessage(parsed.topic, parsed.payload);
      } catch {
        // ignore invalid frame
      }
    };
  };

  connect();
  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
