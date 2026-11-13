export type TransportKind = 'tcp' | 'rtu_tcp' | 'serial';

export type ModbusDataType =
  | 'bool'
  | 'int8'
  | 'uint8'
  | 'int16'
  | 'uint16'
  | 'float16'
  | 'int32'
  | 'uint32'
  | 'float32'
  | 'int64'
  | 'uint64'
  | 'float64'
  | 'string';

export type WordOrder = 'abcd' | 'badc' | 'cdab' | 'dcba';
export type OrderFlag = 'BIG' | 'LITTLE';
export type ModifierType = 'divider' | 'multiplier' | 'offset';
export type PointKind = 'timeseries' | 'attributes';
export type ReadFunctionCode = 1 | 2 | 3 | 4;
export type WriteFunctionCode = 5 | 6 | 15 | 16;
export type AnyFunctionCode = ReadFunctionCode | WriteFunctionCode;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LastSeenMode = 'disable' | 'ISO_8601' | 'epoch';

export interface SlaveConnectionConfig {
  transport: TransportKind;
  host?: string;
  port?: number;
  serial_port?: string;
  baud_rate?: number;
  data_bits?: 7 | 8;
  stop_bits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  unit_id: number;
  poll_interval_ms: number;
  timeout_ms: number;
  byte_order: OrderFlag;
  word_order: OrderFlag;
}

export interface ModbusPointConfig {
  id: string;
  tag: string;
  label?: string;
  kind: PointKind;
  function_code: ReadFunctionCode;
  address: number;
  objects_count: number;
  data_type: ModbusDataType;
  byte_order?: OrderFlag;
  word_order?: OrderFlag;
  bit_index?: number;
  modifier_type?: ModifierType;
  modifier_value?: number;
  unit?: string;
  writable: boolean;
  write_function?: WriteFunctionCode;
  poll_interval_ms?: number;
}

export interface ModbusRpcConfig {
  id: string;
  method: string;
  label?: string;
  datapoint_key?: string;
  function_code: AnyFunctionCode;
  address: number;
  objects_count: number;
  data_type: ModbusDataType;
  byte_order?: OrderFlag;
  word_order?: OrderFlag;
  unit?: string;
  value_hint?: string;
}

export interface ModbusDeviceConfig {
  ieee_address: string;
  friendly_name: string;
  description?: string;
  vendor?: string;
  model?: string;
  disabled?: boolean;
  connection: SlaveConnectionConfig;
  points: ModbusPointConfig[];
  rpc_methods: ModbusRpcConfig[];
}

export interface MqttConfig {
  base_topic: string;
  server: string;
  user?: string;
  password?: string;
  client_id?: string;
  keepalive?: number;
}

export interface FrontendConfig {
  enabled: boolean;
  port: number;
  host: string;
  auth_token?: string;
}

export interface AvailabilityConfig {
  enabled: boolean;
  offline_after_failures: number;
}

export interface AdvancedConfig {
  log_level: LogLevel;
  last_seen: LastSeenMode;
}

export interface BridgeConfiguration {
  mqtt: MqttConfig;
  frontend: FrontendConfig;
  availability: AvailabilityConfig;
  advanced: AdvancedConfig;
  devices: Record<string, ModbusDeviceConfig>;
}

export function toWordOrder(byteOrder: OrderFlag = 'BIG', wordOrder: OrderFlag = 'BIG'): WordOrder {
  if (byteOrder === 'BIG' && wordOrder === 'BIG') return 'abcd';
  if (byteOrder === 'LITTLE' && wordOrder === 'BIG') return 'badc';
  if (byteOrder === 'BIG' && wordOrder === 'LITTLE') return 'cdab';
  return 'dcba';
}

export function fromWordOrder(order: WordOrder): { byte_order: OrderFlag; word_order: OrderFlag } {
  switch (order) {
    case 'abcd':
      return { byte_order: 'BIG', word_order: 'BIG' };
    case 'badc':
      return { byte_order: 'LITTLE', word_order: 'BIG' };
    case 'cdab':
      return { byte_order: 'BIG', word_order: 'LITTLE' };
    case 'dcba':
      return { byte_order: 'LITTLE', word_order: 'LITTLE' };
  }
}

export function defaultConfiguration(): BridgeConfiguration {
  return {
    mqtt: {
      base_topic: process.env.MQTT_BASE_TOPIC?.trim() || 'modbus2mqtt',
      server: process.env.MQTT_SERVER?.trim() || 'mqtt://localhost:1883',
      user: process.env.MQTT_USER?.trim() || undefined,
      password: process.env.MQTT_PASSWORD?.trim() || undefined,
      keepalive: 60,
    },
    frontend: {
      enabled: true,
      port: Number.parseInt(process.env.PORT || process.env.FRONTEND_PORT || '8099', 10) || 8099,
      host: process.env.FRONTEND_HOST?.trim() || '0.0.0.0',
      auth_token: process.env.FRONTEND_AUTH_TOKEN?.trim() || undefined,
    },
    availability: {
      enabled: true,
      offline_after_failures: 2,
    },
    advanced: {
      log_level: 'info',
      last_seen: 'ISO_8601',
    },
    devices: {},
  };
}
