import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coerceBool,
  decodeRegisters,
  decodeRpcBits,
  encodeValue,
  PointCodec,
} from '../src/modbus/codec.js';

function makeCodec(dataType: PointCodec['dataType'], wordOrder: PointCodec['wordOrder'] = 'abcd'): PointCodec {
  const registerCount =
    dataType === 'int32' || dataType === 'uint32' || dataType === 'float32'
      ? 2
      : dataType === 'int64' || dataType === 'uint64' || dataType === 'float64'
        ? 4
        : 1;
  return { dataType, wordOrder, registerCount };
}

test('float32 decodes and encodes in all 4 word/byte orders (10.0 == 0x41200000)', () => {
  assert.equal(decodeRegisters([0x4120, 0x0000], makeCodec('float32', 'abcd')), 10.0);
  assert.equal(decodeRegisters([0x0000, 0x4120], makeCodec('float32', 'cdab')), 10.0);
  assert.equal(decodeRegisters([0x2041, 0x0000], makeCodec('float32', 'badc')), 10.0);
  assert.equal(decodeRegisters([0x0000, 0x2041], makeCodec('float32', 'dcba')), 10.0);

  for (const order of ['abcd', 'badc', 'cdab', 'dcba'] as const) {
    const codec = makeCodec('float32', order);
    const encoded = encodeValue(230.5, codec);
    assert.equal(decodeRegisters(encoded, codec), 230.5);
  }
});

test('float16 IEEE754 half precision round-trip', () => {
  const codec = makeCodec('float16', 'abcd');
  for (const val of [0, 1, -2.5, 65504, 3.140625]) {
    const encoded = encodeValue(val, codec);
    const back = decodeRegisters(encoded, codec) as number;
    assert.ok(Math.abs(back - val) <= Math.abs(val) / 1000 + 1e-9);
  }
  assert.throws(() => encodeValue(70000, codec));
});

test('modifier applies on read and is undone on write', () => {
  const codec: PointCodec = {
    ...makeCodec('uint16'),
    modifierType: 'divider',
    modifierValue: 10,
  };
  assert.equal(decodeRegisters([2315], codec), 231.5);
  assert.deepEqual(encodeValue(231.5, codec), [2315]);
});

test('bit_index, strings, and RPC bits decode accurately', () => {
  const bitCodec: PointCodec = { ...makeCodec('bool'), bitIndex: 3 };
  assert.equal(decodeRegisters([0b1000], bitCodec), true);
  assert.equal(decodeRegisters([0b0111], bitCodec), false);
  assert.throws(() => encodeValue(true, bitCodec));

  const strCodec: PointCodec = { dataType: 'string', wordOrder: 'abcd', registerCount: 3 };
  const regs = encodeValue('PM5110', strCodec);
  assert.equal(decodeRegisters(regs, strCodec), 'PM5110');

  assert.deepEqual(decodeRpcBits([0x0500, 0], 3), [true, false, true]);
  assert.equal(coerceBool('ON'), true);
  assert.equal(coerceBool('off'), false);
});
