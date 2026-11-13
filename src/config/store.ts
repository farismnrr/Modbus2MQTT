import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  BridgeConfiguration,
  defaultConfiguration,
  ModbusDeviceConfig,
  ModbusPointConfig,
  ModbusRpcConfig,
} from './schema.js';

export class ConfigStore {
  private readonly filePath: string;
  private config: BridgeConfiguration;

  constructor(dataDir = process.env.MODBUS2MQTT_DATA || path.resolve(process.cwd(), 'data')) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'configuration.yaml');
    this.config = this.loadFromDisk();
  }

  private loadFromDisk(): BridgeConfiguration {
    const defaults = defaultConfiguration();
    if (!fs.existsSync(this.filePath)) {
      this.writeFile(defaults);
      return defaults;
    }

    const raw = fs.readFileSync(this.filePath, 'utf8');
    const parsed = (yaml.load(raw) as Partial<BridgeConfiguration> | undefined) ?? {};
    const merged: BridgeConfiguration = {
      mqtt: {
        ...defaults.mqtt,
        ...(parsed.mqtt ?? {}),
        base_topic: sanitizeBaseTopic(parsed.mqtt?.base_topic ?? defaults.mqtt.base_topic),
      },
      frontend: {
        ...defaults.frontend,
        ...(parsed.frontend ?? {}),
      },
      availability: {
        ...defaults.availability,
        ...(parsed.availability ?? {}),
      },
      advanced: {
        ...defaults.advanced,
        ...(parsed.advanced ?? {}),
      },
      devices: normalizeDevices(parsed.devices ?? {}),
    };
    return merged;
  }

  private writeFile(config: BridgeConfiguration): void {
    const serialized = yaml.dump(stripUndefined(config), {
      noRefs: true,
      lineWidth: 120,
      sortKeys: false,
    });
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  get(): BridgeConfiguration {
    return structuredClone(this.config);
  }

  publicConfig(): BridgeConfiguration {
    const copy = this.get();
    if (copy.mqtt.password) copy.mqtt.password = '***';
    if (copy.frontend.auth_token) copy.frontend.auth_token = '***';
    return copy;
  }

  save(next: BridgeConfiguration): BridgeConfiguration {
    const normalized: BridgeConfiguration = {
      ...next,
      mqtt: {
        ...next.mqtt,
        base_topic: sanitizeBaseTopic(next.mqtt.base_topic),
      },
      devices: normalizeDevices(next.devices),
    };
    this.config = normalized;
    this.writeFile(normalized);
    return this.get();
  }

  applyBridgeOptions(options: Record<string, unknown>): {
    config: BridgeConfiguration;
    mqttChanged: boolean;
  } {
    const current = this.get();
    const prevMqtt = JSON.stringify(current.mqtt);

    if (isPlainObject(options.mqtt)) {
      const m = options.mqtt;
      if (typeof m.server === 'string' && m.server.trim()) current.mqtt.server = m.server.trim();
      if (typeof m.base_topic === 'string' && m.base_topic.trim()) {
        current.mqtt.base_topic = sanitizeBaseTopic(m.base_topic);
      }
      if (typeof m.user === 'string') {
        current.mqtt.user = m.user.trim() || undefined;
      }
      if (typeof m.password === 'string' && m.password !== '***') {
        current.mqtt.password = m.password || undefined;
      }
    }

    if (typeof options.availability === 'boolean') {
      current.availability.enabled = options.availability;
    } else if (isPlainObject(options.availability)) {
      if (typeof options.availability.enabled === 'boolean') {
        current.availability.enabled = options.availability.enabled;
      }
      if (
        typeof options.availability.offline_after_failures === 'number' &&
        Number.isFinite(options.availability.offline_after_failures) &&
        options.availability.offline_after_failures >= 1
      ) {
        current.availability.offline_after_failures = Math.floor(
          options.availability.offline_after_failures,
        );
      }
    }

    if (isPlainObject(options.advanced)) {
      const adv = options.advanced;
      if (
        adv.log_level === 'debug' ||
        adv.log_level === 'info' ||
        adv.log_level === 'warn' ||
        adv.log_level === 'warning' ||
        adv.log_level === 'error'
      ) {
        current.advanced.log_level = adv.log_level === 'warning' ? 'warn' : adv.log_level;
      }
      if (
        adv.last_seen === 'disable' ||
        adv.last_seen === 'ISO_8601' ||
        adv.last_seen === 'epoch'
      ) {
        current.advanced.last_seen = adv.last_seen;
      }
    }

    if (isPlainObject(options.frontend)) {
      if (typeof options.frontend.auth_token === 'string' && options.frontend.auth_token !== '***') {
        current.frontend.auth_token = options.frontend.auth_token.trim() || undefined;
      }
    }

    const saved = this.save(current);
    const mqttChanged = prevMqtt !== JSON.stringify(saved.mqtt);
    return { config: saved, mqttChanged };
  }

  upsertDevice(device: ModbusDeviceConfig): ModbusDeviceConfig {
    const current = this.get();
    const clean = normalizeDevice(device.ieee_address, device);
    // Ensure unique friendly_name across slaves
    for (const [id, existing] of Object.entries(current.devices)) {
      if (id !== clean.ieee_address && existing.friendly_name === clean.friendly_name) {
        throw new Error(`Device with friendly_name "${clean.friendly_name}" already exists`);
      }
    }
    current.devices[clean.ieee_address] = clean;
    this.save(current);
    return clean;
  }

  renameDevice(ieeeAddress: string, nextName: string): ModbusDeviceConfig {
    const current = this.get();
    const existing = current.devices[ieeeAddress];
    if (!existing) {
      throw new Error(`Device "${ieeeAddress}" not found`);
    }
    const trimmed = nextName.trim();
    if (!trimmed) {
      throw new Error('friendly_name cannot be empty');
    }
    for (const [id, dev] of Object.entries(current.devices)) {
      if (id !== ieeeAddress && dev.friendly_name === trimmed) {
        throw new Error(`Device with friendly_name "${trimmed}" already exists`);
      }
    }
    existing.friendly_name = trimmed;
    this.save(current);
    return existing;
  }

  deleteDevice(ieeeAddress: string): ModbusDeviceConfig | undefined {
    const current = this.get();
    const existing = current.devices[ieeeAddress];
    if (!existing) return undefined;
    delete current.devices[ieeeAddress];
    this.save(current);
    return existing;
  }
}

export function sanitizeBaseTopic(topic: string): string {
  return topic.trim().replace(/^\/+|\/+$/g, '') || 'modbus2mqtt';
}

function normalizeDevices(
  raw: Record<string, ModbusDeviceConfig>,
): Record<string, ModbusDeviceConfig> {
  const out: Record<string, ModbusDeviceConfig> = {};
  for (const [key, device] of Object.entries(raw)) {
    const id = device.ieee_address?.trim() || key;
    out[id] = normalizeDevice(id, device);
  }
  return out;
}

function normalizeDevice(id: string, device: ModbusDeviceConfig): ModbusDeviceConfig {
  const conn = device.connection ?? {
    transport: 'tcp',
    host: '127.0.0.1',
    port: 502,
    unit_id: 1,
    poll_interval_ms: 2000,
    timeout_ms: 1500,
    byte_order: 'BIG',
    word_order: 'BIG',
  };
  return {
    ieee_address: id,
    friendly_name: device.friendly_name.trim() || id,
    description: device.description?.trim() || undefined,
    vendor: device.vendor?.trim() || 'Modbus',
    model: device.model?.trim() || `${conn.transport.toUpperCase()} Unit ${conn.unit_id}`,
    disabled: Boolean(device.disabled),
    connection: {
      transport: conn.transport || 'tcp',
      host: conn.host?.trim() || undefined,
      port: conn.port ?? 502,
      serial_port: conn.serial_port?.trim() || undefined,
      baud_rate: conn.baud_rate ?? 9600,
      data_bits: conn.data_bits ?? 8,
      stop_bits: conn.stop_bits ?? 1,
      parity: conn.parity ?? 'none',
      unit_id: Math.min(247, Math.max(0, Number(conn.unit_id) || 1)),
      poll_interval_ms: Math.max(200, Number(conn.poll_interval_ms) || 2000),
      timeout_ms: Math.max(200, Number(conn.timeout_ms) || 1500),
      byte_order: conn.byte_order === 'LITTLE' ? 'LITTLE' : 'BIG',
      word_order: conn.word_order === 'LITTLE' ? 'LITTLE' : 'BIG',
    },
    points: (device.points ?? []).map(normalizePoint),
    rpc_methods: (device.rpc_methods ?? []).map(normalizeRpc),
  };
}

function normalizePoint(p: ModbusPointConfig): ModbusPointConfig {
  return {
    ...p,
    id: p.id || `pt_${Math.random().toString(36).slice(2, 10)}`,
    tag: p.tag.trim(),
    label: p.label?.trim() || undefined,
    kind: p.kind === 'attributes' ? 'attributes' : 'timeseries',
    address: Math.max(0, Math.min(65535, Number(p.address) || 0)),
    objects_count: Math.max(1, Math.min(64, Number(p.objects_count) || 1)),
    writable: Boolean(p.writable),
  };
}

function normalizeRpc(r: ModbusRpcConfig): ModbusRpcConfig {
  return {
    ...r,
    id: r.id || `rpc_${Math.random().toString(36).slice(2, 10)}`,
    method: r.method.trim(),
    label: r.label?.trim() || undefined,
    address: Math.max(0, Math.min(65535, Number(r.address) || 0)),
    objects_count: Math.max(1, Math.min(64, Number(r.objects_count) || 1)),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripUndefined<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map(stripUndefined) as T;
  }
  if (isPlainObject(val)) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        clean[k] = stripUndefined(v);
      }
    }
    return clean as T;
  }
  return val;
}
