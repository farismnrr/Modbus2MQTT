import { ModbusDataType, ModbusDeviceConfig, ModbusPointConfig, ModbusRpcConfig } from '../config/schema.js';

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
  type: 'Router';
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

function exposeTypeOf(dataType: ModbusDataType): 'numeric' | 'binary' | 'text' {
  if (dataType === 'bool') return 'binary';
  if (dataType === 'string') return 'text';
  return 'numeric';
}

function isWriteFunction(fc: number): boolean {
  return fc === 5 || fc === 6 || fc === 15 || fc === 16;
}

export function buildExposes(device: ModbusDeviceConfig): Z2mExpose[] {
  const exposes: Z2mExpose[] = [];
  const seenProperties = new Set<string>();

  for (const point of device.points) {
    if (!point.tag || seenProperties.has(point.tag)) continue;
    seenProperties.add(point.tag);
    exposes.push(pointToExpose(point, device.rpc_methods));
  }

  for (const rpc of device.rpc_methods) {
    const prop = rpc.method;
    if (!prop || seenProperties.has(prop)) continue;
    seenProperties.add(prop);
    exposes.push(rpcToExpose(rpc));
  }

  return exposes;
}

function pointToExpose(point: ModbusPointConfig, rpcs: ModbusRpcConfig[]): Z2mExpose {
  const type = exposeTypeOf(point.data_type);
  const linkedWriteRpc = rpcs.some(
    (r) => (r.datapoint_key === point.tag || r.method === point.tag) && isWriteFunction(r.function_code),
  );
  // Z2M bitmask: 1 = state/read, 2 = set/write, 4 = get
  const access = point.writable || linkedWriteRpc ? 7 : 5;
  const expose: Z2mExpose = {
    type,
    name: point.tag,
    label: point.label || point.tag,
    property: point.tag,
    access,
    description: `${point.kind.toUpperCase()} FC0${point.function_code} @ ${point.address}`,
  };
  if (point.unit) expose.unit = point.unit;
  if (type === 'binary') {
    expose.value_on = true;
    expose.value_off = false;
  }
  return expose;
}

function rpcToExpose(rpc: ModbusRpcConfig): Z2mExpose {
  const type = exposeTypeOf(rpc.data_type);
  const writable = isWriteFunction(rpc.function_code);
  const expose: Z2mExpose = {
    type,
    name: rpc.method,
    label: rpc.label || rpc.method,
    property: rpc.method,
    access: writable ? 2 : 5,
    description: `RPC FC${String(rpc.function_code).padStart(2, '0')} @ ${rpc.address}`,
  };
  if (rpc.unit) expose.unit = rpc.unit;
  if (type === 'binary') {
    expose.value_on = true;
    expose.value_off = false;
  }
  return expose;
}

export function buildBridgeDevicesPayload(devices: Record<string, ModbusDeviceConfig>): Z2mBridgeDevice[] {
  return Object.values(devices).map((device) => {
    const conn = device.connection;
    const endpointDesc =
      conn.transport === 'serial'
        ? `${conn.serial_port || '/dev/ttyUSB0'} (${conn.baud_rate || 9600}bps)`
        : `${conn.host || '127.0.0.1'}:${conn.port || 502}`;

    return {
      ieee_address: device.ieee_address,
      friendly_name: device.friendly_name,
      type: 'Router',
      supported: true,
      disabled: Boolean(device.disabled),
      network_address: conn.unit_id,
      definition: {
        vendor: device.vendor || 'Modbus',
        model: device.model || `${conn.transport.toUpperCase()} Unit ${conn.unit_id}`,
        description: device.description || `${conn.transport.toUpperCase()} slave at ${endpointDesc} (Unit ${conn.unit_id})`,
        exposes: buildExposes(device),
      },
    };
  });
}
