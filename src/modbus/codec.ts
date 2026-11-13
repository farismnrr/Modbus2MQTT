import { ModifierType, ModbusDataType, WordOrder } from '../config/schema.js';

export interface PointCodec {
  dataType: ModbusDataType;
  wordOrder: WordOrder;
  registerCount: number;
  bitIndex?: number;
  modifierType?: ModifierType;
  modifierValue?: number;
}

export function defaultRegisterCount(dataType: ModbusDataType): number | undefined {
  switch (dataType) {
    case 'bool':
    case 'int8':
    case 'uint8':
    case 'int16':
    case 'uint16':
    case 'float16':
      return 1;
    case 'int32':
    case 'uint32':
    case 'float32':
      return 2;
    case 'int64':
    case 'uint64':
    case 'float64':
      return 4;
    case 'string':
      return undefined;
  }
}

export function orderedBytes(registers: number[], order: WordOrder): Buffer {
  const swapBytes = order === 'badc' || order === 'dcba';
  const swapWords = order === 'cdab' || order === 'dcba';
  const words = [...registers];
  if (swapWords) words.reverse();

  const out = Buffer.alloc(words.length * 2);
  words.forEach((word, index) => {
    const hi = (word >> 8) & 0xff;
    const lo = word & 0xff;
    if (swapBytes) {
      out[index * 2] = lo;
      out[index * 2 + 1] = hi;
    } else {
      out[index * 2] = hi;
      out[index * 2 + 1] = lo;
    }
  });
  return out;
}

export function registersFromOrderedBytes(bytes: Buffer, order: WordOrder): number[] {
  const swapBytes = order === 'badc' || order === 'dcba';
  const swapWords = order === 'cdab' || order === 'dcba';
  const words: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    words.push(swapBytes ? (b1 << 8) | b0 : (b0 << 8) | b1);
  }
  if (swapWords) words.reverse();
  return words;
}

function applyModifier(
  value: number,
  modifierType?: ModifierType,
  modifierValue?: number,
): number {
  if (!modifierType || modifierValue === undefined || !Number.isFinite(modifierValue)) {
    return value;
  }
  switch (modifierType) {
    case 'divider':
      if (modifierValue === 0) throw new Error('divider cannot be zero');
      return value / modifierValue;
    case 'multiplier':
      if (modifierValue === 0) throw new Error('multiplier cannot be zero');
      return value * modifierValue;
    case 'offset':
      return value + modifierValue;
  }
}

function undoModifier(
  value: number,
  modifierType?: ModifierType,
  modifierValue?: number,
): number {
  if (!modifierType || modifierValue === undefined || !Number.isFinite(modifierValue)) {
    return value;
  }
  switch (modifierType) {
    case 'divider':
      if (modifierValue === 0) throw new Error('divider cannot be zero');
      return value * modifierValue;
    case 'multiplier':
      if (modifierValue === 0) throw new Error('multiplier cannot be zero');
      return value / modifierValue;
    case 'offset':
      return value - modifierValue;
  }
}

export function halfToFloat64(bits: number): number {
  const sign = (bits & 0x8000) !== 0 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const fraction = bits & 0x03ff;
  if (exponent === 0) {
    return sign * fraction * Math.pow(2, -24);
  }
  if (exponent === 31) {
    return fraction === 0 ? sign * Infinity : NaN;
  }
  return sign * (1 + fraction / 1024) * Math.pow(2, exponent - 15);
}

export function float64ToHalf(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('value does not fit a 16 bit float');
  }
  const sign = Object.is(value, -0) || value < 0 ? 0x8000 : 0;
  const magnitude = Math.abs(value);
  if (magnitude === 0) return sign;
  if (magnitude > 65504) {
    throw new Error('value does not fit a 16 bit float');
  }
  const exponent = Math.floor(Math.log2(magnitude));
  if (exponent < -14) {
    const fraction = Math.round(magnitude * Math.pow(2, 24));
    return sign | fraction;
  }
  let fraction = Math.round((magnitude / Math.pow(2, exponent) - 1) * 1024);
  let biased = exponent + 15;
  if (fraction === 1024) {
    fraction = 0;
    biased += 1;
  }
  if (biased >= 31) {
    throw new Error('value does not fit a 16 bit float');
  }
  return sign | (biased << 10) | fraction;
}

export function coerceBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase();
    if (norm === 'true' || norm === 'on' || norm === '1' || norm === 'yes') return true;
    if (norm === 'false' || norm === 'off' || norm === '0' || norm === 'no') return false;
  }
  throw new Error('value is not boolean (true/false/on/off/1/0)');
}

function assertFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('the device reported a non-finite float');
  }
  return value;
}

export function decodeRegisters(
  registers: number[],
  codec: PointCodec,
): boolean | number | string {
  const needed = codec.registerCount;
  if (needed <= 0 || registers.length < needed) {
    throw new Error(`fewer registers than requested (got ${registers.length}, need ${needed})`);
  }
  const bytes = orderedBytes(registers.slice(0, needed), codec.wordOrder);

  const scale = (raw: number): number =>
    assertFiniteNumber(applyModifier(raw, codec.modifierType, codec.modifierValue));

  switch (codec.dataType) {
    case 'bool': {
      const word = bytes.readUInt16BE(0);
      if (codec.bitIndex !== undefined) {
        return (word & (1 << codec.bitIndex)) !== 0;
      }
      return word !== 0;
    }
    case 'int8':
      return scale(bytes.readInt8(0));
    case 'uint8':
      return scale(bytes.readUInt8(0));
    case 'int16':
      return scale(bytes.readInt16BE(0));
    case 'uint16':
      return scale(bytes.readUInt16BE(0));
    case 'float16':
      return scale(halfToFloat64(bytes.readUInt16BE(0)));
    case 'int32':
      return scale(bytes.readInt32BE(0));
    case 'uint32':
      return scale(bytes.readUInt32BE(0));
    case 'float32':
      return scale(bytes.readFloatBE(0));
    case 'int64':
      return scale(Number(bytes.readBigInt64BE(0)));
    case 'uint64':
      return scale(Number(bytes.readBigUInt64BE(0)));
    case 'float64':
      return scale(bytes.readDoubleBE(0));
    case 'string':
      return bytes.toString('utf8').replace(/\0+$/g, '').replace(/\0/g, '');
  }
}

export function decodeRpcBits(registers: number[], count: number): boolean | boolean[] {
  const capped = Math.min(Math.max(1, count), 16);
  const bytes = Buffer.alloc(registers.length * 2);
  registers.forEach((reg, idx) => bytes.writeUInt16BE(reg & 0xffff, idx * 2));
  const values: boolean[] = [];
  for (let i = 0; i < capped; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = i % 8;
    if (byteIdx >= bytes.length) {
      throw new Error('fewer bits than requested');
    }
    values.push((bytes[byteIdx] & (1 << bitIdx)) !== 0);
  }
  return capped === 1 ? values[0] : values;
}

export function encodeValue(value: unknown, codec: PointCodec): number[] {
  const toNumber = (): number => {
    let parsed: number;
    if (typeof value === 'number') parsed = value;
    else if (typeof value === 'string') parsed = Number(value.trim());
    else if (typeof value === 'boolean') parsed = value ? 1 : 0;
    else parsed = NaN;
    if (!Number.isFinite(parsed)) throw new Error('value is not a finite number');
    return undoModifier(parsed, codec.modifierType, codec.modifierValue);
  };

  const intRange = (n: number, min: number, max: number): number => {
    const rounded = Math.round(n);
    if (rounded < min || rounded > max) {
      throw new Error(`value ${rounded} is outside range [${min}, ${max}]`);
    }
    return rounded;
  };

  if (codec.dataType === 'int8') {
    const v = intRange(Math.trunc(toNumber()), -128, 127) & 0xff;
    return [v << 8];
  }
  if (codec.dataType === 'uint8') {
    const v = intRange(Math.trunc(toNumber()), 0, 255) & 0xff;
    return [v << 8];
  }

  let buf: Buffer;
  switch (codec.dataType) {
    case 'bool': {
      if (codec.bitIndex !== undefined) {
        throw new Error('a single bit inside a register cannot be written on its own');
      }
      buf = Buffer.alloc(2);
      buf.writeUInt16BE(coerceBool(value) ? 1 : 0, 0);
      break;
    }
    case 'int16':
      buf = Buffer.alloc(2);
      buf.writeInt16BE(intRange(toNumber(), -32768, 32767), 0);
      break;
    case 'uint16':
      buf = Buffer.alloc(2);
      buf.writeUInt16BE(intRange(toNumber(), 0, 65535), 0);
      break;
    case 'float16':
      buf = Buffer.alloc(2);
      buf.writeUInt16BE(float64ToHalf(toNumber()), 0);
      break;
    case 'int32':
      buf = Buffer.alloc(4);
      buf.writeInt32BE(intRange(toNumber(), -2147483648, 2147483647), 0);
      break;
    case 'uint32':
      buf = Buffer.alloc(4);
      buf.writeUInt32BE(intRange(toNumber(), 0, 4294967295), 0);
      break;
    case 'float32':
      buf = Buffer.alloc(4);
      buf.writeFloatBE(toNumber(), 0);
      break;
    case 'int64':
      buf = Buffer.alloc(8);
      buf.writeBigInt64BE(BigInt(Math.round(toNumber())), 0);
      break;
    case 'uint64': {
      const n = Math.round(toNumber());
      if (n < 0) throw new Error('uint64 cannot be negative');
      buf = Buffer.alloc(8);
      buf.writeBigUInt64BE(BigInt(n), 0);
      break;
    }
    case 'float64':
      buf = Buffer.alloc(8);
      buf.writeDoubleBE(toNumber(), 0);
      break;
    case 'string': {
      if (typeof value !== 'string') throw new Error('value is not text');
      const capacity = codec.registerCount * 2;
      const strBuf = Buffer.from(value, 'utf8');
      if (strBuf.length > capacity) {
        throw new Error(`text exceeds ${capacity} bytes register capacity`);
      }
      buf = Buffer.alloc(capacity, 0);
      strBuf.copy(buf);
      break;
    }
  }

  return registersFromOrderedBytes(buf, codec.wordOrder);
}
