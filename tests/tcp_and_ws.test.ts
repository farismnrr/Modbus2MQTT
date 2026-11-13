import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import { ModbusLinkRegistry } from '../src/modbus/client.js';
import { crc16Modbus } from '../src/modbus/frame.js';
import { SlaveConnectionConfig } from '../src/config/schema.js';

function startMockModbusTcpServer(registerValue: number[]): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on('data', (req) => {
        // Request MBAP [txHi, txLo, 0, 0, lenHi, lenLo, unit, fn, addrHi, addrLo, cntHi, cntLo]
        const txHi = req[0];
        const txLo = req[1];
        const unit = req[6];
        const fn = req[7];
        const byteCount = registerValue.length * 2;
        const pduLen = 2 + byteCount;
        const resp = Buffer.alloc(7 + pduLen);
        resp[0] = txHi;
        resp[1] = txLo;
        resp.writeUInt16BE(0, 2);
        resp.writeUInt16BE(pduLen + 1, 4);
        resp[6] = unit;
        resp[7] = fn;
        resp[8] = byteCount;
        registerValue.forEach((v, i) => resp.writeUInt16BE(v, 9 + i * 2));
        socket.write(resp);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function startMockModbusRtuTcpServer(registerValue: number[]): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.on('data', (req) => {
        const unit = req[0];
        const fn = req[1];
        const byteCount = registerValue.length * 2;
        const body = Buffer.alloc(3 + byteCount + 2);
        body[0] = unit;
        body[1] = fn;
        body[2] = byteCount;
        registerValue.forEach((v, i) => body.writeUInt16BE(v, 3 + i * 2));
        const crc = crc16Modbus(body.subarray(0, 3 + byteCount));
        body.writeUInt16LE(crc, 3 + byteCount);
        socket.write(body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

test('ModbusLinkRegistry performs live TCP & RTU-over-TCP register reads', async () => {
  const tcpServer = await startMockModbusTcpServer([0x4120, 0x0000]);
  const rtuServer = await startMockModbusRtuTcpServer([0x0906]);
  const registry = new ModbusLinkRegistry();

  try {
    const tcpConn: SlaveConnectionConfig = {
      transport: 'tcp',
      host: '127.0.0.1',
      port: tcpServer.port,
      unit_id: 1,
      poll_interval_ms: 1000,
      timeout_ms: 1000,
      byte_order: 'BIG',
      word_order: 'BIG',
    };
    const tcpRes = await registry.request(tcpConn, {
      kind: 'readRegisters',
      functionCode: 3,
      address: 0,
      count: 2,
    });
    assert.deepEqual(tcpRes, { kind: 'registers', registers: [0x4120, 0x0000] });

    const rtuConn: SlaveConnectionConfig = {
      ...tcpConn,
      transport: 'rtu_tcp',
      port: rtuServer.port,
    };
    const rtuRes = await registry.request(rtuConn, {
      kind: 'readRegisters',
      functionCode: 4,
      address: 10,
      count: 1,
    });
    assert.deepEqual(rtuRes, { kind: 'registers', registers: [0x0906] });
  } finally {
    registry.closeAll();
    await tcpServer.close();
    await rtuServer.close();
  }
});
