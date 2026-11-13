import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBridgeDevicesPayload } from '../src/bridge/exposes.js';
import { ModbusDeviceConfig } from '../src/config/schema.js';

test('buildBridgeDevicesPayload maps points & RPCs into Z2M-compatible exposes', () => {
  const dev: ModbusDeviceConfig = {
    ieee_address: 'm2m_panel_1',
    friendly_name: 'Main Panel',
    vendor: 'Schneider',
    model: 'PM5110',
    connection: {
      transport: 'tcp',
      host: '192.168.1.50',
      port: 502,
      unit_id: 1,
      poll_interval_ms: 2000,
      timeout_ms: 1500,
      byte_order: 'BIG',
      word_order: 'BIG',
    },
    points: [
      {
        id: 'p1',
        tag: 'voltage',
        kind: 'timeseries',
        function_code: 3,
        address: 3027,
        objects_count: 2,
        data_type: 'float32',
        unit: 'V',
        writable: false,
      },
      {
        id: 'p2',
        tag: 'breaker_coil',
        kind: 'attributes',
        function_code: 1,
        address: 0,
        objects_count: 1,
        data_type: 'bool',
        writable: true,
        write_function: 5,
      },
    ],
    rpc_methods: [
      {
        id: 'r1',
        method: 'reset_energy',
        function_code: 5,
        address: 10,
        objects_count: 1,
        data_type: 'bool',
      },
    ],
  };

  const payload = buildBridgeDevicesPayload({ [dev.ieee_address]: dev });
  assert.equal(payload.length, 1);
  assert.equal(payload[0].ieee_address, 'm2m_panel_1');
  assert.equal(payload[0].friendly_name, 'Main Panel');
  assert.equal(payload[0].supported, true);

  const exposes = payload[0].definition.exposes;
  assert.equal(exposes.length, 3);
  assert.deepEqual(
    exposes.map((e) => [e.property, e.type, e.access]),
    [
      ['voltage', 'numeric', 5],
      ['breaker_coil', 'binary', 7],
      ['reset_energy', 'binary', 2],
    ],
  );
});
