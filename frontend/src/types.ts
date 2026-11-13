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

export type OrderFlag = 'BIG' | 'LITTLE';
export type ModifierType = 'divider' | 'multiplier' | 'offset';
export type PointKind = 'timeseries' | 'attributes';

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
  function_code: 1 | 2 | 3 | 4;
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
  write_function?: 5 | 6 | 15 | 16;
  poll_interval_ms?: number;
}

export interface ModbusRpcConfig {
  id: string;
  method: string;
  label?: string;
  datapoint_key?: string;
  function_code: 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16;
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

export interface Z2mExpose {
  type: 'numeric' | 'binary' | 'text';
  name: string;
  label: string;
  property: string;
  access: number;
  description?: string;
  unit?: string;
  value_on?: boolean | string;
  value_off?: boolean | string;
}

export interface Z2mBridgeDevice {
  ieee_address: string;
  friendly_name: string;
  type: string;
  supported: boolean;
  disabled: boolean;
  network_address?: number;
  definition: {
    vendor: string;
    model: string;
    description: string;
    exposes: Z2mExpose[];
  };
}

export interface DeviceRuntimeState {
  ieee_address: string;
  availability: 'online' | 'offline';
  last_seen?: string;
  last_error?: string;
  values: Record<string, unknown>;
}

export interface BridgeConfig {
  mqtt: {
    base_topic: string;
    server: string;
    user?: string;
    password?: string;
    keepalive?: number;
  };
  frontend: {
    enabled: boolean;
    port: number;
    host: string;
    auth_token?: string;
  };
  availability: {
    enabled: boolean;
    offline_after_failures: number;
  };
  advanced: {
    log_level: 'debug' | 'info' | 'warn' | 'error';
    last_seen: 'disable' | 'ISO_8601' | 'epoch';
  };
  devices: Record<string, ModbusDeviceConfig>;
}

export interface LogMessage {
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface AppSnapshot {
  config: BridgeConfig;
  mqtt_connected: boolean;
  mqtt_error?: string;
  devices: ModbusDeviceConfig[];
  states: Record<string, DeviceRuntimeState>;
}
