import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { testRegisterPoint } from '../api/client';
import {
  ModbusDataType,
  ModbusPointConfig,
  ModifierType,
  OrderFlag,
  PointKind,
  SlaveConnectionConfig,
} from '../types';

interface PointEditorModalProps {
  connection: SlaveConnectionConfig;
  initial?: ModbusPointConfig;
  onSave: (point: ModbusPointConfig) => void;
  onClose: () => void;
}

const DATA_TYPE_COUNTS: Partial<Record<ModbusDataType, number>> = {
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

export function PointEditorModal({
  connection,
  initial,
  onSave,
  onClose,
}: PointEditorModalProps) {
  const [point, setPoint] = useState<ModbusPointConfig>(
    initial ?? {
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
    },
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleDataTypeChange = (dataType: ModbusDataType) => {
    const fixed = DATA_TYPE_COUNTS[dataType];
    setPoint((prev) => ({
      ...prev,
      data_type: dataType,
      objects_count: fixed ?? prev.objects_count,
    }));
  };

  const handleTestRead = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await testRegisterPoint(connection, point);
      const raw = res.raw_registers
        ? ` | raw: [${res.raw_registers.map((r) => `0x${r.toString(16).padStart(4, '0')}`).join(', ')}]`
        : res.raw_bits
          ? ` | bits: [${res.raw_bits.join(', ')}]`
          : '';
      setTestResult(`Decoded value: ${JSON.stringify(res.value)}${raw} (${res.latency_ms} ms)`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!point.tag.trim()) return;
    onSave({
      ...point,
      tag: point.tag.trim(),
      label: point.label?.trim() || undefined,
      unit: point.unit?.trim() || undefined,
    });
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-1">
          {initial ? 'Edit Register Mapping' : 'Add Register Mapping (Attributes / Timeseries)'}
        </h3>
        <p className="text-xs text-base-content/70 mb-4">
          Configure ThingsBoard-style Modbus register address, function code, data type, endianness, and scaling.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Tag / Property *</span>
              <input
                className="input input-sm input-bordered font-mono"
                placeholder="e.g. voltage_l1"
                value={point.tag}
                onChange={(e) => setPoint((p) => ({ ...p, tag: e.target.value }))}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Display Label</span>
              <input
                className="input input-sm input-bordered"
                placeholder="e.g. Line 1 Voltage"
                value={point.label || ''}
                onChange={(e) => setPoint((p) => ({ ...p, label: e.target.value }))}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Kind</span>
              <select
                className="select select-sm select-bordered"
                value={point.kind}
                onChange={(e) => setPoint((p) => ({ ...p, kind: e.target.value as PointKind }))}
              >
                <option value="timeseries">Timeseries</option>
                <option value="attributes">Attributes</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Function Code</span>
              <select
                className="select select-sm select-bordered"
                value={point.function_code}
                onChange={(e) =>
                  setPoint((p) => ({
                    ...p,
                    function_code: Number(e.target.value) as 1 | 2 | 3 | 4,
                  }))
                }
              >
                <option value={3}>03 - Holding Register</option>
                <option value={4}>04 - Input Register</option>
                <option value={1}>01 - Read Coils</option>
                <option value={2}>02 - Discrete Inputs</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Address (0-based)</span>
              <input
                type="number"
                min={0}
                max={65535}
                className="input input-sm input-bordered tabular-nums font-mono"
                value={point.address}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, address: Number(e.target.value) || 0 }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Data Type</span>
              <select
                className="select select-sm select-bordered"
                value={point.data_type}
                onChange={(e) => handleDataTypeChange(e.target.value as ModbusDataType)}
              >
                <option value="bool">bool (coil/bit)</option>
                <option value="int8">int8</option>
                <option value="uint8">uint8</option>
                <option value="int16">int16</option>
                <option value="uint16">uint16</option>
                <option value="float16">float16 (IEEE754)</option>
                <option value="int32">int32</option>
                <option value="uint32">uint32</option>
                <option value="float32">float32</option>
                <option value="int64">int64</option>
                <option value="uint64">uint64</option>
                <option value="float64">float64</option>
                <option value="string">string</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Objects / Regs</span>
              <input
                type="number"
                min={1}
                max={64}
                className="input input-sm input-bordered tabular-nums"
                value={point.objects_count}
                disabled={Boolean(DATA_TYPE_COUNTS[point.data_type])}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, objects_count: Number(e.target.value) || 1 }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Byte Order</span>
              <select
                className="select select-sm select-bordered"
                value={point.byte_order || connection.byte_order}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, byte_order: e.target.value as OrderFlag }))
                }
              >
                <option value="BIG">BIG</option>
                <option value="LITTLE">LITTLE</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Word Order</span>
              <select
                className="select select-sm select-bordered"
                value={point.word_order || connection.word_order}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, word_order: e.target.value as OrderFlag }))
                }
              >
                <option value="BIG">BIG</option>
                <option value="LITTLE">LITTLE</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Modifier</span>
              <select
                className="select select-sm select-bordered"
                value={point.modifier_type || ''}
                onChange={(e) =>
                  setPoint((p) => ({
                    ...p,
                    modifier_type: (e.target.value || undefined) as ModifierType | undefined,
                  }))
                }
              >
                <option value="">None</option>
                <option value="divider">Divider (/)</option>
                <option value="multiplier">Multiplier (*)</option>
                <option value="offset">Offset (+)</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Modifier Value</span>
              <input
                type="number"
                step="any"
                className="input input-sm input-bordered tabular-nums"
                disabled={!point.modifier_type}
                value={point.modifier_value ?? ''}
                onChange={(e) =>
                  setPoint((p) => ({
                    ...p,
                    modifier_value: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Unit</span>
              <input
                className="input input-sm input-bordered"
                placeholder="V, A, W, °C..."
                value={point.unit || ''}
                onChange={(e) => setPoint((p) => ({ ...p, unit: e.target.value }))}
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Bit Index (optional)</span>
              <input
                type="number"
                min={0}
                max={15}
                className="input input-sm input-bordered tabular-nums"
                disabled={point.data_type !== 'bool' || point.function_code <= 2}
                value={point.bit_index ?? ''}
                onChange={(e) =>
                  setPoint((p) => ({
                    ...p,
                    bit_index: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              />
            </label>

            <label className="label cursor-pointer justify-start gap-2 pt-4">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={point.writable}
                disabled={point.function_code === 2 || point.function_code === 4}
                onChange={(e) => setPoint((p) => ({ ...p, writable: e.target.checked }))}
              />
              <span className="label-text text-xs font-medium">Writable (Expose /set)</span>
            </label>

            {point.writable && (
              <label className="form-control">
                <span className="label-text text-xs font-medium mb-1">Write FC</span>
                <select
                  className="select select-sm select-bordered"
                  value={point.write_function ?? (point.function_code === 1 ? 5 : 6)}
                  onChange={(e) =>
                    setPoint((p) => ({
                      ...p,
                      write_function: Number(e.target.value) as 5 | 6 | 15 | 16,
                    }))
                  }
                >
                  {point.function_code === 1 ? (
                    <>
                      <option value={5}>FC05 - Single Coil</option>
                      <option value={15}>FC15 - Multi Coils</option>
                    </>
                  ) : (
                    <>
                      <option value={6}>FC06 - Single Reg</option>
                      <option value={16}>FC16 - Multi Regs</option>
                    </>
                  )}
                </select>
              </label>
            )}
          </div>

          {testResult && (
            <div className="alert alert-success text-xs font-mono">
              <span>{testResult}</span>
            </div>
          )}
          {testError && (
            <div className="alert alert-error text-xs">
              <span>{testError}</span>
            </div>
          )}

          <div className="modal-action justify-between items-center pt-2">
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1.5"
              onClick={handleTestRead}
              disabled={testing}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {testing ? 'Reading...' : 'Test Read'}
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Save Register
              </button>
            </div>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
