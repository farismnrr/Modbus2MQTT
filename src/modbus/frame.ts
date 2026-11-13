export const MAX_PDU = 253;

export type ModbusRequest =
  | { kind: 'readBits'; functionCode: 1 | 2; address: number; count: number }
  | { kind: 'readRegisters'; functionCode: 3 | 4; address: number; count: number }
  | { kind: 'writeCoil'; address: number; value: boolean }
  | { kind: 'writeRegister'; address: number; value: number }
  | { kind: 'writeCoils'; address: number; values: boolean[] }
  | { kind: 'writeRegisters'; address: number; values: number[] };

export type ModbusResponse =
  | { kind: 'bits'; bits: boolean[] }
  | { kind: 'registers'; registers: number[] }
  | { kind: 'written' };

export const EXCEPTION_TEXT: Record<number, string> = {
  1: 'illegal function',
  2: 'illegal data address',
  3: 'illegal data value',
  4: 'slave device failure',
  5: 'acknowledge',
  6: 'slave device busy',
  8: 'memory parity error',
  10: 'gateway path unavailable',
  11: 'gateway target device failed to respond',
};

export function crc16Modbus(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 1) !== 0) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc & 0xffff;
}

export function buildPdu(req: ModbusRequest): Buffer {
  switch (req.kind) {
    case 'readBits': {
      if (req.functionCode !== 1 && req.functionCode !== 2) {
        throw new Error('bit reads require function code 1 or 2');
      }
      if (req.count < 1 || req.count > 2000) {
        throw new Error('bit count must be 1..2000');
      }
      const pdu = Buffer.alloc(5);
      pdu[0] = req.functionCode;
      pdu.writeUInt16BE(req.address, 1);
      pdu.writeUInt16BE(req.count, 3);
      return pdu;
    }
    case 'readRegisters': {
      if (req.functionCode !== 3 && req.functionCode !== 4) {
        throw new Error('register reads require function code 3 or 4');
      }
      if (req.count < 1 || req.count > 125) {
        throw new Error('register count must be 1..125');
      }
      const pdu = Buffer.alloc(5);
      pdu[0] = req.functionCode;
      pdu.writeUInt16BE(req.address, 1);
      pdu.writeUInt16BE(req.count, 3);
      return pdu;
    }
    case 'writeCoil': {
      const pdu = Buffer.alloc(5);
      pdu[0] = 5;
      pdu.writeUInt16BE(req.address, 1);
      pdu.writeUInt16BE(req.value ? 0xff00 : 0x0000, 3);
      return pdu;
    }
    case 'writeRegister': {
      const pdu = Buffer.alloc(5);
      pdu[0] = 6;
      pdu.writeUInt16BE(req.address, 1);
      pdu.writeUInt16BE(req.value & 0xffff, 3);
      return pdu;
    }
    case 'writeCoils': {
      if (req.values.length < 1 || req.values.length > 1968) {
        throw new Error('coil count must be 1..1968');
      }
      const byteCount = Math.ceil(req.values.length / 8);
      const pdu = Buffer.alloc(6 + byteCount);
      pdu[0] = 15;
      pdu.writeUInt16BE(req.address, 1);
      pdu.writeUInt16BE(req.values.length, 3);
      pdu[5] = byteCount;
      req.values.forEach((on, idx) => {
        if (on) {
          pdu[6 + Math.floor(idx / 8)] |= 1 << (idx % 8);
        }
      });
      return pdu;
    }
    case 'writeRegisters': {
      if (req.values.length < 1 || req.values.length > 123) {
        throw new Error('register count must be 1..123');
      }
      const pdu = Buffer.alloc(6 + req.values.length * 2);
      pdu[0] = 16;
      pdu.writeUInt16BE(req.address, 1);
      pdu.writeUInt16BE(req.values.length, 3);
      pdu[5] = req.values.length * 2;
      req.values.forEach((val, idx) => {
        pdu.writeUInt16BE(val & 0xffff, 6 + idx * 2);
      });
      return pdu;
    }
  }
}

export function encodeTcpFrame(transaction: number, unitId: number, pdu: Buffer): Buffer {
  const frame = Buffer.alloc(7 + pdu.length);
  frame.writeUInt16BE(transaction & 0xffff, 0);
  frame.writeUInt16BE(0, 2);
  frame.writeUInt16BE(pdu.length + 1, 4);
  frame[6] = unitId & 0xff;
  pdu.copy(frame, 7);
  return frame;
}

export function encodeRtuFrame(unitId: number, pdu: Buffer): Buffer {
  const frame = Buffer.alloc(1 + pdu.length + 2);
  frame[0] = unitId & 0xff;
  pdu.copy(frame, 1);
  const crc = crc16Modbus(frame.subarray(0, 1 + pdu.length));
  frame.writeUInt16LE(crc, 1 + pdu.length);
  return frame;
}

export function rtuRemainingBytes(functionCode: number, byte2: number): number | undefined {
  if ((functionCode & 0x80) !== 0) {
    // [unit, func|0x80, exc_code, crc_lo, crc_hi] -> already read 3 bytes, need 2 CRC bytes
    return 2;
  }
  switch (functionCode) {
    case 1:
    case 2:
    case 3:
    case 4:
      // byte2 is byte count, followed by byteCount bytes + 2 CRC bytes
      return byte2 + 2;
    case 5:
    case 6:
    case 15:
    case 16:
      // fixed 8-byte RTU response -> already read 3 bytes, need 5 more bytes
      return 5;
    default:
      return undefined;
  }
}

export function parseResponsePdu(req: ModbusRequest, pdu: Buffer): ModbusResponse {
  if (pdu.length < 1) {
    throw new Error('empty Modbus PDU');
  }
  const fn = pdu[0];
  if ((fn & 0x80) !== 0) {
    const code = pdu[1] ?? 0;
    const text = EXCEPTION_TEXT[code] ?? 'unknown exception';
    throw new Error(`Modbus exception ${code}: ${text}`);
  }

  const expectedFn =
    req.kind === 'readBits' || req.kind === 'readRegisters'
      ? req.functionCode
      : req.kind === 'writeCoil'
        ? 5
        : req.kind === 'writeRegister'
          ? 6
          : req.kind === 'writeCoils'
            ? 15
            : 16;

  if (fn !== expectedFn) {
    throw new Error(`unexpected Modbus function code ${fn} (expected ${expectedFn})`);
  }

  if (req.kind === 'readBits') {
    const byteCount = pdu[1] ?? 0;
    const data = pdu.subarray(2);
    if (byteCount !== data.length || data.length < Math.ceil(req.count / 8)) {
      throw new Error('bit response byte count does not match request');
    }
    const bits: boolean[] = [];
    for (let i = 0; i < req.count; i++) {
      bits.push((data[Math.floor(i / 8)] & (1 << (i % 8))) !== 0);
    }
    return { kind: 'bits', bits };
  }

  if (req.kind === 'readRegisters') {
    const byteCount = pdu[1] ?? 0;
    const data = pdu.subarray(2);
    if (byteCount !== data.length || byteCount !== req.count * 2) {
      throw new Error('register response byte count does not match request');
    }
    const registers: number[] = [];
    for (let i = 0; i < req.count; i++) {
      registers.push(data.readUInt16BE(i * 2));
    }
    return { kind: 'registers', registers };
  }

  return { kind: 'written' };
}
