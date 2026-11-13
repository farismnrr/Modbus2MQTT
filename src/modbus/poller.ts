import {
  ModbusDeviceConfig,
  ModbusPointConfig,
  ModbusRpcConfig,
  SlaveConnectionConfig,
  toWordOrder,
} from '../config/schema.js';
import { ConfigStore } from '../config/store.js';
import { BridgeLogger } from '../logger.js';
import { ModbusLinkRegistry } from './client.js';
import { coerceBool, decodeRegisters, decodeRpcBits, defaultRegisterCount, encodeValue, PointCodec } from './codec.js';
import { ModbusRequest } from './frame.js';

export interface DeviceRuntimeState {
  ieee_address: string;
  availability: 'online' | 'offline';
  last_seen?: string;
  last_error?: string;
  values: Record<string, unknown>;
}

export interface PollerCallbacks {
  onTelemetry: (device: ModbusDeviceConfig, payload: Record<string, unknown>) => void;
  onAvailability: (device: ModbusDeviceConfig, state: 'online' | 'offline') => void;
}

interface ScheduledDevice {
  config: ModbusDeviceConfig;
  nextDueAt: number[];
  consecutiveFailures: number;
  availability: 'online' | 'offline';
  timer?: NodeJS.Timeout;
  polling: boolean;
}

export class ModbusPoller {
  private readonly schedules = new Map<string, ScheduledDevice>();
  private readonly states = new Map<string, DeviceRuntimeState>();

  constructor(
    private readonly configStore: ConfigStore,
    private readonly links: ModbusLinkRegistry,
    private readonly logger: BridgeLogger,
    private readonly callbacks: PollerCallbacks,
  ) {}

  startAll(): void {
    this.stopAll();
    const cfg = this.configStore.get();
    for (const device of Object.values(cfg.devices)) {
      if (!device.disabled) {
        this.scheduleDevice(device);
      }
    }
  }

  stopAll(): void {
    for (const sched of this.schedules.values()) {
      if (sched.timer) clearTimeout(sched.timer);
    }
    this.schedules.clear();
  }

  reload(): void {
    this.startAll();
  }

  getState(ieeeAddress: string): DeviceRuntimeState | undefined {
    return this.states.get(ieeeAddress);
  }

  getAllStates(): Record<string, DeviceRuntimeState> {
    const out: Record<string, DeviceRuntimeState> = {};
    for (const [k, v] of this.states.entries()) {
      out[k] = structuredClone(v);
    }
    return out;
  }

  async pollDeviceNow(ieeeAddress: string): Promise<Record<string, unknown>> {
    const device = this.configStore.get().devices[ieeeAddress];
    if (!device) throw new Error(`Device "${ieeeAddress}" not found`);
    const { payload, fatalError } = await this.readPoints(
      device,
      device.points.map((_, idx) => idx),
    );
    if (fatalError) {
      this.logger.warn('m2m:poller', `On-demand poll failed for ${device.friendly_name}: ${fatalError}`);
    }
    if (Object.keys(payload).length > 0) {
      this.recordTelemetry(device, payload);
    }
    return payload;
  }

  async applySetCommand(
    ieeeAddress: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const device = this.configStore.get().devices[ieeeAddress];
    if (!device) throw new Error(`Device "${ieeeAddress}" not found`);

    const applied: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(payload)) {
      const rpc = device.rpc_methods.find((r) => r.method === key || r.datapoint_key === key);
      const point = device.points.find((p) => p.tag === key && p.writable);

      if (rpc) {
        const result = await this.executeRpc(device.connection, rpc, rawValue);
        applied[key] = result !== undefined ? result : rawValue;
      } else if (point) {
        await this.writePoint(device.connection, point, rawValue);
        applied[key] = rawValue;
      } else {
        throw new Error(`No writable datapoint or RPC method matched "${key}" on ${device.friendly_name}`);
      }
    }

    // Immediate post-write re-read so UI & Sensio reflect hardware state without waiting for next poll cycle
    const { payload: refreshed } = await this.readPoints(
      device,
      device.points.map((_, idx) => idx),
    );
    const merged = { ...applied, ...refreshed };
    this.recordTelemetry(device, merged);
    return merged;
  }

  async testConnection(
    conn: SlaveConnectionConfig,
  ): Promise<{ ok: boolean; latency_ms: number; detail: string }> {
    const started = Date.now();
    try {
      await this.links.request(conn, { kind: 'readRegisters', functionCode: 3, address: 0, count: 1 }, conn.timeout_ms);
      return {
        ok: true,
        latency_ms: Date.now() - started,
        detail: `Connected cleanly to unit ${conn.unit_id} (FC03 address 0 readable).`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // An exception code from the slave means the Modbus transport & slave responded validly!
      if (msg.startsWith('Modbus exception')) {
        return {
          ok: true,
          latency_ms: Date.now() - started,
          detail: `Slave responded (${msg}). Transport and unit ${conn.unit_id} are reachable.`,
        };
      }
      return {
        ok: false,
        latency_ms: Date.now() - started,
        detail: msg,
      };
    }
  }

  async testPoint(
    conn: SlaveConnectionConfig,
    point: ModbusPointConfig,
  ): Promise<{ value: unknown; raw_registers?: number[]; raw_bits?: boolean[]; latency_ms: number }> {
    const started = Date.now();
    const req = buildReadRequest(point);
    const res = await this.links.request(conn, req, conn.timeout_ms);
    if (res.kind === 'bits') {
      return {
        value: res.bits[0] ?? false,
        raw_bits: res.bits,
        latency_ms: Date.now() - started,
      };
    }
    if (res.kind === 'registers') {
      const value = decodeRegisters(res.registers, codecForPoint(conn, point));
      return {
        value,
        raw_registers: res.registers,
        latency_ms: Date.now() - started,
      };
    }
    throw new Error('Unexpected write response on point test');
  }

  async testRpc(
    conn: SlaveConnectionConfig,
    rpc: ModbusRpcConfig,
    value?: unknown,
  ): Promise<{ result: unknown; raw_registers?: number[]; raw_bits?: boolean[]; latency_ms: number }> {
    const started = Date.now();
    const res = await this.executeRpcRaw(conn, rpc, value);
    return {
      ...res,
      latency_ms: Date.now() - started,
    };
  }

  private scheduleDevice(device: ModbusDeviceConfig): void {
    const now = Date.now();
    const sched: ScheduledDevice = {
      config: device,
      nextDueAt: device.points.map(() => now),
      consecutiveFailures: 0,
      availability: this.states.get(device.ieee_address)?.availability ?? 'online',
      polling: false,
    };
    this.schedules.set(device.ieee_address, sched);
    if (device.points.length > 0) {
      this.enqueueTick(device.ieee_address, 50);
    }
  }

  private enqueueTick(ieeeAddress: string, delayMs: number): void {
    const sched = this.schedules.get(ieeeAddress);
    if (!sched) return;
    if (sched.timer) clearTimeout(sched.timer);
    sched.timer = setTimeout(() => {
      void this.runTick(ieeeAddress);
    }, Math.max(20, delayMs));
  }

  private async runTick(ieeeAddress: string): Promise<void> {
    const sched = this.schedules.get(ieeeAddress);
    if (!sched || sched.polling) return;
    sched.polling = true;
    try {
      const now = Date.now();
      const dueIndexes: number[] = [];
      const defaultPoll = Math.max(200, sched.config.connection.poll_interval_ms || 2000);
      sched.config.points.forEach((pt, idx) => {
        if (sched.nextDueAt[idx] <= now) {
          dueIndexes.push(idx);
          sched.nextDueAt[idx] = now + Math.max(200, pt.poll_interval_ms || defaultPoll);
        }
      });

      if (dueIndexes.length > 0) {
        const { payload, fatalError } = await this.readPoints(sched.config, dueIndexes);
        const readSomething = Object.keys(payload).length > 0;
        if (readSomething) {
          sched.consecutiveFailures = 0;
          this.setAvailability(sched, 'online');
          this.recordTelemetry(sched.config, payload);
        } else if (fatalError) {
          sched.consecutiveFailures += 1;
          this.logger.debug(
            'm2m:poller',
            `Poll failure #${sched.consecutiveFailures} for ${sched.config.friendly_name}: ${fatalError}`,
          );
          const threshold = Math.max(1, this.configStore.get().availability.offline_after_failures || 2);
          if (sched.consecutiveFailures >= threshold) {
            this.setAvailability(sched, 'offline', fatalError);
          }
        }
      }

      const nextWake = Math.min(...sched.nextDueAt);
      const delay = Math.max(50, nextWake - Date.now());
      this.enqueueTick(ieeeAddress, delay);
    } finally {
      sched.polling = false;
    }
  }

  private setAvailability(
    sched: ScheduledDevice,
    state: 'online' | 'offline',
    error?: string,
  ): void {
    const prev = this.states.get(sched.config.ieee_address);
    const changed = !prev || prev.availability !== state;
    this.states.set(sched.config.ieee_address, {
      ieee_address: sched.config.ieee_address,
      availability: state,
      last_seen: prev?.last_seen,
      last_error: state === 'offline' ? error : undefined,
      values: prev?.values ?? {},
    });
    sched.availability = state;
    if (changed) {
      this.callbacks.onAvailability(sched.config, state);
    }
  }

  private recordTelemetry(device: ModbusDeviceConfig, payload: Record<string, unknown>): void {
    const nowIso = new Date().toISOString();
    const prev = this.states.get(device.ieee_address);
    const mergedValues = { ...(prev?.values ?? {}), ...payload };
    this.states.set(device.ieee_address, {
      ieee_address: device.ieee_address,
      availability: 'online',
      last_seen: nowIso,
      values: mergedValues,
    });
    this.callbacks.onTelemetry(device, mergedValues);
  }

  private async readPoints(
    device: ModbusDeviceConfig,
    indexes: number[],
  ): Promise<{ payload: Record<string, unknown>; fatalError?: string }> {
    const payload: Record<string, unknown> = {};
    for (const idx of indexes) {
      const point = device.points[idx];
      if (!point) continue;
      try {
        const res = await this.links.request(
          device.connection,
          buildReadRequest(point),
          device.connection.timeout_ms,
        );
        if (res.kind === 'bits') {
          payload[point.tag] = res.bits[0] ?? false;
        } else if (res.kind === 'registers') {
          payload[point.tag] = decodeRegisters(res.registers, codecForPoint(device.connection, point));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.startsWith('Modbus exception')) {
          return { payload, fatalError: message };
        }
        this.logger.warn(
          'm2m:poller',
          `Point "${point.tag}" on ${device.friendly_name} exception: ${message}`,
        );
      }
    }
    return { payload };
  }

  private async writePoint(
    conn: SlaveConnectionConfig,
    point: ModbusPointConfig,
    value: unknown,
  ): Promise<void> {
    if (point.function_code === 1 || point.write_function === 5 || point.write_function === 15) {
      const flag = coerceBool(value);
      const req: ModbusRequest =
        point.write_function === 15
          ? { kind: 'writeCoils', address: point.address, values: [flag] }
          : { kind: 'writeCoil', address: point.address, value: flag };
      await this.links.request(conn, req, conn.timeout_ms);
      return;
    }

    const codec = codecForPoint(conn, point);
    const registers = encodeValue(value, codec);
    const req: ModbusRequest =
      point.write_function === 16 || registers.length > 1
        ? { kind: 'writeRegisters', address: point.address, values: registers }
        : { kind: 'writeRegister', address: point.address, value: registers[0] };
    await this.links.request(conn, req, conn.timeout_ms);
  }

  private async executeRpc(
    conn: SlaveConnectionConfig,
    rpc: ModbusRpcConfig,
    value: unknown,
  ): Promise<unknown> {
    const res = await this.executeRpcRaw(conn, rpc, value);
    return res.result;
  }

  private async executeRpcRaw(
    conn: SlaveConnectionConfig,
    rpc: ModbusRpcConfig,
    value?: unknown,
  ): Promise<{ result: unknown; raw_registers?: number[]; raw_bits?: boolean[] }> {
    const count = Math.max(1, rpc.objects_count || defaultRegisterCount(rpc.data_type) || 1);
    const codec: PointCodec = {
      dataType: rpc.data_type,
      wordOrder: toWordOrder(rpc.byte_order ?? conn.byte_order, rpc.word_order ?? conn.word_order),
      registerCount: count,
    };

    switch (rpc.function_code) {
      case 1:
      case 2: {
        const res = await this.links.request(
          conn,
          { kind: 'readBits', functionCode: rpc.function_code, address: rpc.address, count },
          conn.timeout_ms,
        );
        if (res.kind !== 'bits') throw new Error('Expected bit response');
        return {
          result: res.bits.length === 1 ? res.bits[0] : res.bits,
          raw_bits: res.bits,
        };
      }
      case 3:
      case 4: {
        const res = await this.links.request(
          conn,
          { kind: 'readRegisters', functionCode: rpc.function_code, address: rpc.address, count },
          conn.timeout_ms,
        );
        if (res.kind !== 'registers') throw new Error('Expected register response');
        const decoded =
          rpc.data_type === 'bool'
            ? decodeRpcBits(res.registers, count)
            : decodeRegisters(res.registers, codec);
        return { result: decoded, raw_registers: res.registers };
      }
      case 5: {
        const flag = coerceBool(value ?? true);
        await this.links.request(
          conn,
          { kind: 'writeCoil', address: rpc.address, value: flag },
          conn.timeout_ms,
        );
        return { result: flag };
      }
      case 15: {
        const values = Array.isArray(value)
          ? value.map((v) => coerceBool(v))
          : Array.from({ length: count }, () => coerceBool(value ?? true));
        await this.links.request(
          conn,
          { kind: 'writeCoils', address: rpc.address, values },
          conn.timeout_ms,
        );
        return { result: values.length === 1 ? values[0] : values };
      }
      case 6: {
        const regs = encodeValue(value, { ...codec, registerCount: 1 });
        await this.links.request(
          conn,
          { kind: 'writeRegister', address: rpc.address, value: regs[0] },
          conn.timeout_ms,
        );
        return { result: value, raw_registers: [regs[0]] };
      }
      case 16: {
        const regs = encodeValue(value, codec);
        await this.links.request(
          conn,
          { kind: 'writeRegisters', address: rpc.address, values: regs },
          conn.timeout_ms,
        );
        return { result: value, raw_registers: regs };
      }
    }
  }
}

export function codecForPoint(conn: SlaveConnectionConfig, point: ModbusPointConfig): PointCodec {
  return {
    dataType: point.data_type,
    wordOrder: toWordOrder(point.byte_order ?? conn.byte_order, point.word_order ?? conn.word_order),
    registerCount: Math.max(1, point.objects_count || defaultRegisterCount(point.data_type) || 1),
    bitIndex: point.bit_index,
    modifierType: point.modifier_type,
    modifierValue: point.modifier_value,
  };
}

export function buildReadRequest(point: ModbusPointConfig): ModbusRequest {
  if (point.function_code === 1 || point.function_code === 2) {
    return {
      kind: 'readBits',
      functionCode: point.function_code,
      address: point.address,
      count: 1,
    };
  }
  return {
    kind: 'readRegisters',
    functionCode: point.function_code,
    address: point.address,
    count: Math.max(1, point.objects_count || defaultRegisterCount(point.data_type) || 1),
  };
}
