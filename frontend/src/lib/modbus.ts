import {
  ModbusDataType,
  ModbusDeviceConfig,
  ModbusPointConfig,
  ModbusRpcConfig,
  SlaveConnectionConfig,
} from '@/types';

export const DATA_TYPE_REGISTER_COUNTS: Partial<Record<ModbusDataType, number>> = {
  bool: 1,
  int8: 1,
  uint8: 1,
  int16: 1,
  uint16: 1,
  float16: 1,
  int32: 2,
  uint32: 2,
  float32: 2,
  int64: 4,
  uint64: 4,
  float64: 4,
};

export const DATA_TYPE_OPTIONS: Array<{ value: ModbusDataType; label: string }> = [
  { value: 'bool', label: 'bool (coil/bit)' },
  { value: 'int8', label: 'int8' },
  { value: 'uint8', label: 'uint8' },
  { value: 'int16', label: 'int16' },
  { value: 'uint16', label: 'uint16' },
  { value: 'float16', label: 'float16 (IEEE754)' },
  { value: 'int32', label: 'int32' },
  { value: 'uint32', label: 'uint32' },
  { value: 'float32', label: 'float32' },
  { value: 'int64', label: 'int64' },
  { value: 'uint64', label: 'uint64' },
  { value: 'float64', label: 'float64' },
  { value: 'string', label: 'string' },
];

export const READ_FC_OPTIONS = [
  { value: 3, label: '03 - Holding Register' },
  { value: 4, label: '04 - Input Register' },
  { value: 1, label: '01 - Read Coils' },
  { value: 2, label: '02 - Discrete Inputs' },
] as const;

export const RPC_FC_OPTIONS = [
  { value: 5, label: '05 - Write Single Coil' },
  { value: 6, label: '06 - Write Single Reg' },
  { value: 15, label: '15 - Write Multi Coils' },
  { value: 16, label: '16 - Write Multi Regs' },
  { value: 1, label: '01 - Read Coils' },
  { value: 2, label: '02 - Discrete Inputs' },
  { value: 3, label: '03 - Holding Regs' },
  { value: 4, label: '04 - Input Regs' },
] as const;

export const ORDER_OPTIONS = [
  { value: 'BIG', label: 'BIG' },
  { value: 'LITTLE', label: 'LITTLE' },
] as const;

export const MODIFIER_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'divider', label: 'Divider (/)' },
  { value: 'multiplier', label: 'Multiplier (*)' },
  { value: 'offset', label: 'Offset (+)' },
] as const;

export const DEFAULT_SLAVE_CONNECTION: SlaveConnectionConfig = {
  transport: 'tcp',
  host: '192.168.1.50',
  port: 502,
  serial_port: '/dev/ttyUSB0',
  baud_rate: 9600,
  data_bits: 8,
  stop_bits: 1,
  parity: 'none',
  unit_id: 1,
  poll_interval_ms: 2000,
  timeout_ms: 1500,
  byte_order: 'BIG',
  word_order: 'BIG',
};

export function createDefaultPoint(connection: SlaveConnectionConfig): ModbusPointConfig {
  return {
    id: `pt_${Math.random().toString(36).slice(2, 8)}`,
    tag: '',
    label: '',
    kind: 'timeseries',
    function_code: 3,
    address: 0,
    objects_count: 1,
    data_type: 'uint16',
    byte_order: connection.byte_order,
    word_order: connection.word_order,
    unit: '',
    writable: false,
    write_function: 6,
  };
}

export function createDefaultRpc(connection: SlaveConnectionConfig): ModbusRpcConfig {
  return {
    id: `rpc_${Math.random().toString(36).slice(2, 8)}`,
    method: '',
    label: '',
    function_code: 5,
    address: 0,
    objects_count: 1,
    data_type: 'bool',
    byte_order: connection.byte_order,
    word_order: connection.word_order,
    value_hint: 'true',
  };
}

export function formatSlaveEndpoint(conn: SlaveConnectionConfig): string {
  return conn.transport === 'serial'
    ? conn.serial_port || '/dev/ttyUSB0'
    : `${conn.host || '127.0.0.1'}:${conn.port || 502}`;
}

export function formatFunctionCode(fc: number): string {
  return `FC${String(fc).padStart(2, '0')}`;
}

export function formatModifier(point: ModbusPointConfig): string {
  if (!point.modifier_type) return '—';
  const symbol = point.modifier_type === 'divider' ? '/' : point.modifier_type === 'multiplier' ? '*' : '+';
  return `${symbol} ${point.modifier_value ?? ''}`;
}

export function parseModbusInputValue(raw: string, dataType?: ModbusDataType): unknown {
  const trimmed = raw.trim();
  if (dataType === 'string') return raw;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return raw;
}

export function buildDiscoveryPreview(device: ModbusDeviceConfig) {
  return {
    ieee_address: device.ieee_address,
    friendly_name: device.friendly_name,
    supported: true,
    definition: {
      vendor: device.vendor || 'Modbus',
      model: device.model || `${device.connection.transport.toUpperCase()} Unit ${device.connection.unit_id}`,
      exposes: [
        ...device.points.map((p) => ({
          type: p.data_type === 'bool' ? 'binary' : p.data_type === 'string' ? 'text' : 'numeric',
          property: p.tag,
          unit: p.unit,
          access: p.writable ? 7 : 5,
        })),
        ...device.rpc_methods.map((r) => ({
          type: r.data_type === 'bool' ? 'binary' : r.data_type === 'string' ? 'text' : 'numeric',
          property: r.method,
          access: [5, 6, 15, 16].includes(r.function_code) ? 2 : 5,
        })),
      ],
    },
  };
}
