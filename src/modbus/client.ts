import net from 'node:net';
import { createRequire } from 'node:module';
import type { ModbusRTU as ModbusRtuType } from 'modbus-serial/ModbusRTU.js';

const require = createRequire(import.meta.url);
const ModbusRTU = require('modbus-serial') as new () => ModbusRtuType;
import { SlaveConnectionConfig } from '../config/schema.js';
import {
  buildPdu,
  crc16Modbus,
  encodeRtuFrame,
  encodeTcpFrame,
  MAX_PDU,
  ModbusRequest,
  ModbusResponse,
  parseResponsePdu,
  rtuRemainingBytes,
} from './frame.js';

export type EndpointKey = string;

export function endpointKeyOf(conn: SlaveConnectionConfig): EndpointKey {
  if (conn.transport === 'serial') {
    return `serial:${conn.serial_port || '/dev/ttyUSB0'}:${conn.baud_rate || 9600}`;
  }
  return `${conn.transport}:${conn.host || '127.0.0.1'}:${conn.port || 502}`;
}

class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

class SocketReader {
  private buffer = Buffer.alloc(0);
  private waiters: Array<{
    needed: number;
    resolve: (chunk: Buffer) => void;
    reject: (err: Error) => void;
  }> = [];
  private closedError: Error | null = null;

  constructor(private readonly socket: net.Socket) {
    socket.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.flush();
    });
    socket.on('error', (err) => {
      this.failAll(err);
    });
    socket.on('close', () => {
      this.failAll(new Error('connection closed by the Modbus device'));
    });
  }

  drain(): void {
    this.buffer = Buffer.alloc(0);
  }

  readExact(bytes: number): Promise<Buffer> {
    if (this.buffer.length >= bytes) {
      const out = this.buffer.subarray(0, bytes);
      this.buffer = this.buffer.subarray(bytes);
      return Promise.resolve(out);
    }
    if (this.closedError) {
      return Promise.reject(this.closedError);
    }
    return new Promise<Buffer>((resolve, reject) => {
      this.waiters.push({ needed: bytes, resolve, reject });
    });
  }

  private flush(): void {
    while (this.waiters.length > 0 && this.buffer.length >= this.waiters[0].needed) {
      const w = this.waiters.shift()!;
      const chunk = this.buffer.subarray(0, w.needed);
      this.buffer = this.buffer.subarray(w.needed);
      w.resolve(chunk);
    }
  }

  private failAll(err: Error): void {
    this.closedError = err;
    while (this.waiters.length > 0) {
      this.waiters.shift()!.reject(err);
    }
  }
}

class TcpOrRtuLink {
  private readonly mutex = new AsyncMutex();
  private socket: net.Socket | null = null;
  private reader: SocketReader | null = null;
  private transaction = 0;

  constructor(
    private readonly transport: 'tcp' | 'rtu_tcp',
    private readonly host: string,
    private readonly port: number,
  ) {}

  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.reader = null;
    }
  }

  async request(unitId: number, req: ModbusRequest, timeoutMs: number): Promise<ModbusResponse> {
    const pdu = buildPdu(req);
    return this.mutex.run(async () => {
      let timer: NodeJS.Timeout | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.close();
            reject(new Error(`Modbus request timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        const answerPdu = await Promise.race([
          this.exchange(unitId, pdu, Math.min(timeoutMs, 3000)),
          timeoutPromise,
        ]);
        return parseResponsePdu(req, answerPdu);
      } catch (err) {
        if (!(err instanceof Error && err.message.startsWith('Modbus exception'))) {
          this.close();
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
  }

  private async ensureConnected(connectTimeoutMs: number): Promise<{
    socket: net.Socket;
    reader: SocketReader;
  }> {
    if (this.socket && !this.socket.destroyed && this.reader) {
      return { socket: this.socket, reader: this.reader };
    }
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      sock.setNoDelay(true);
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`Timed out connecting to ${this.host}:${this.port}`));
      }, connectTimeoutMs);
      sock.once('connect', () => {
        clearTimeout(timer);
        resolve(sock);
      });
      sock.once('error', (err) => {
        clearTimeout(timer);
        sock.destroy();
        reject(err);
      });
    });
    const reader = new SocketReader(socket);
    this.socket = socket;
    this.reader = reader;
    return { socket, reader };
  }

  private async exchange(unitId: number, pdu: Buffer, connectTimeoutMs: number): Promise<Buffer> {
    const { socket, reader } = await this.ensureConnected(connectTimeoutMs);
    if (this.transport === 'rtu_tcp') {
      reader.drain();
      const frame = encodeRtuFrame(unitId, pdu);
      await writeSocket(socket, frame);

      const head = await reader.readExact(3);
      const answeredUnit = head[0];
      const fn = head[1];
      const rem = rtuRemainingBytes(fn, head[2]);
      if (rem === undefined || rem > MAX_PDU + 2) {
        throw new Error(`Unsupported Modbus RTU function code ${fn}`);
      }
      const tail = await reader.readExact(rem);
      const full = Buffer.concat([head, tail]);
      const payloadEnd = full.length - 2;
      const expectedCrc = crc16Modbus(full.subarray(0, payloadEnd));
      const actualCrc = full.readUInt16LE(payloadEnd);
      if (expectedCrc !== actualCrc) {
        throw new Error('Modbus RTU CRC mismatch');
      }
      if (answeredUnit !== unitId) {
        throw new Error(`Answer from unexpected unit id ${answeredUnit} (expected ${unitId})`);
      }
      return full.subarray(1, payloadEnd);
    }

    this.transaction = (this.transaction + 1) & 0xffff || 1;
    const tx = this.transaction;
    await writeSocket(socket, encodeTcpFrame(tx, unitId, pdu));

    while (true) {
      const mbap = await reader.readExact(7);
      const answeredTx = mbap.readUInt16BE(0);
      const proto = mbap.readUInt16BE(2);
      const len = mbap.readUInt16BE(4);
      const answeredUnit = mbap[6];
      if (proto !== 0 || len < 2 || len > MAX_PDU + 1) {
        throw new Error('Invalid Modbus TCP MBAP header');
      }
      const body = await reader.readExact(len - 1);
      if (answeredTx !== tx) {
        continue;
      }
      if (answeredUnit !== unitId && unitId !== 0 && unitId !== 255) {
        throw new Error(`Answer from unexpected unit id ${answeredUnit} (expected ${unitId})`);
      }
      return body;
    }
  }
}

class SerialLink {
  private readonly mutex = new AsyncMutex();
  private client: ModbusRtuType | null = null;

  constructor(
    private readonly portPath: string,
    private readonly baudRate: number,
    private readonly dataBits: 7 | 8,
    private readonly stopBits: 1 | 2,
    private readonly parity: 'none' | 'even' | 'odd',
  ) {}

  close(): void {
    if (this.client?.isOpen) {
      this.client.close(() => {});
    }
    this.client = null;
  }

  async request(unitId: number, req: ModbusRequest, timeoutMs: number): Promise<ModbusResponse> {
    return this.mutex.run(async () => {
      const client = await this.ensureOpen();
      client.setID(unitId);
      client.setTimeout(timeoutMs);
      try {
        switch (req.kind) {
          case 'readBits': {
            const res =
              req.functionCode === 1
                ? await client.readCoils(req.address, req.count)
                : await client.readDiscreteInputs(req.address, req.count);
            return { kind: 'bits', bits: res.data.slice(0, req.count) };
          }
          case 'readRegisters': {
            const res =
              req.functionCode === 3
                ? await client.readHoldingRegisters(req.address, req.count)
                : await client.readInputRegisters(req.address, req.count);
            return { kind: 'registers', registers: res.data.slice(0, req.count) };
          }
          case 'writeCoil':
            await client.writeCoil(req.address, req.value);
            return { kind: 'written' };
          case 'writeRegister':
            await client.writeRegister(req.address, req.value);
            return { kind: 'written' };
          case 'writeCoils':
            await client.writeCoils(req.address, req.values);
            return { kind: 'written' };
          case 'writeRegisters':
            await client.writeRegisters(req.address, req.values);
            return { kind: 'written' };
        }
      } catch (err) {
        this.close();
        throw err;
      }
    });
  }

  private async ensureOpen(): Promise<ModbusRtuType> {
    if (this.client?.isOpen) return this.client;
    const client = new ModbusRTU();
    await client.connectRTUBuffered(this.portPath, {
      baudRate: this.baudRate,
      dataBits: this.dataBits,
      stopBits: this.stopBits,
      parity: this.parity,
    });
    this.client = client;
    return client;
  }
}

export class ModbusLinkRegistry {
  private readonly links = new Map<EndpointKey, TcpOrRtuLink | SerialLink>();

  async request(
    conn: SlaveConnectionConfig,
    req: ModbusRequest,
    timeoutMs = conn.timeout_ms || 1500,
  ): Promise<ModbusResponse> {
    const key = endpointKeyOf(conn);
    let link = this.links.get(key);
    if (!link) {
      if (conn.transport === 'serial') {
        link = new SerialLink(
          conn.serial_port || '/dev/ttyUSB0',
          conn.baud_rate || 9600,
          conn.data_bits || 8,
          conn.stop_bits || 1,
          conn.parity || 'none',
        );
      } else {
        link = new TcpOrRtuLink(conn.transport, conn.host || '127.0.0.1', conn.port || 502);
      }
      this.links.set(key, link);
    }
    return link.request(conn.unit_id, req, timeoutMs);
  }

  closeAll(): void {
    for (const link of this.links.values()) {
      link.close();
    }
    this.links.clear();
  }
}

function writeSocket(socket: net.Socket, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(buf, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
