import { useState } from 'react';
import { Play } from 'lucide-react';
import { testRpcMethod } from '../api/client';
import {
  ModbusDataType,
  ModbusRpcConfig,
  OrderFlag,
  SlaveConnectionConfig,
} from '../types';

interface RpcEditorModalProps {
  connection: SlaveConnectionConfig;
  initial?: ModbusRpcConfig;
  onSave: (rpc: ModbusRpcConfig) => void;
  onClose: () => void;
}

export function RpcEditorModal({
  connection,
  initial,
  onSave,
  onClose,
}: RpcEditorModalProps) {
  const [rpc, setRpc] = useState<ModbusRpcConfig>(
    initial ?? {
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
    },
  );
  const [testValue, setTestValue] = useState(initial?.value_hint ?? 'true');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const isWriteFc = [5, 6, 15, 16].includes(rpc.function_code);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      let parsed: unknown = testValue;
      if (isWriteFc) {
        if (testValue.trim() === 'true') parsed = true;
        else if (testValue.trim() === 'false') parsed = false;
        else if (!Number.isNaN(Number(testValue)) && testValue.trim() !== '') {
          parsed = Number(testValue);
        }
      }
      const res = await testRpcMethod(connection, rpc, parsed);
      setTestResult(`Result: ${JSON.stringify(res.result)} (${res.latency_ms} ms)`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rpc.method.trim()) return;
    onSave({
      ...rpc,
      method: rpc.method.trim(),
      label: rpc.label?.trim() || undefined,
      value_hint: testValue,
    });
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-1">
          {initial ? 'Edit Modbus RPC Command' : 'Add Modbus RPC Command (ThingsBoard Style)'}
        </h3>
        <p className="text-xs text-base-content/70 mb-4">
          Define an RPC write/read command. It is exposed directly as a Zigbee2MQTT <code>/set</code> property so Sensio can invoke it like any native device control.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">RPC Method / Key *</span>
              <input
                className="input input-sm input-bordered font-mono"
                placeholder="e.g. setRelay1 or reset_energy"
                value={rpc.method}
                onChange={(e) => setRpc((r) => ({ ...r, method: e.target.value }))}
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Display Label</span>
              <input
                className="input input-sm input-bordered"
                placeholder="e.g. Relay 1 Switch"
                value={rpc.label || ''}
                onChange={(e) => setRpc((r) => ({ ...r, label: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Function Code</span>
              <select
                className="select select-sm select-bordered"
                value={rpc.function_code}
                onChange={(e) =>
                  setRpc((r) => ({
                    ...r,
                    function_code: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16,
                  }))
                }
              >
                <option value={5}>05 - Write Single Coil</option>
                <option value={6}>06 - Write Single Reg</option>
                <option value={15}>15 - Write Multi Coils</option>
                <option value={16}>16 - Write Multi Regs</option>
                <option value={1}>01 - Read Coils</option>
                <option value={2}>02 - Discrete Inputs</option>
                <option value={3}>03 - Holding Regs</option>
                <option value={4}>04 - Input Regs</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Address</span>
              <input
                type="number"
                min={0}
                max={65535}
                className="input input-sm input-bordered font-mono tabular-nums"
                value={rpc.address}
                onChange={(e) => setRpc((r) => ({ ...r, address: Number(e.target.value) || 0 }))}
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Data Type</span>
              <select
                className="select select-sm select-bordered"
                value={rpc.data_type}
                onChange={(e) =>
                  setRpc((r) => ({ ...r, data_type: e.target.value as ModbusDataType }))
                }
              >
                <option value="bool">bool</option>
                <option value="int8">int8</option>
                <option value="uint8">uint8</option>
                <option value="int16">int16</option>
                <option value="uint16">uint16</option>
                <option value="float16">float16</option>
                <option value="int32">int32</option>
                <option value="uint32">uint32</option>
                <option value="float32">float32</option>
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
                value={rpc.objects_count}
                onChange={(e) =>
                  setRpc((r) => ({ ...r, objects_count: Number(e.target.value) || 1 }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Byte Order</span>
              <select
                className="select select-sm select-bordered"
                value={rpc.byte_order || connection.byte_order}
                onChange={(e) =>
                  setRpc((r) => ({ ...r, byte_order: e.target.value as OrderFlag }))
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
                value={rpc.word_order || connection.word_order}
                onChange={(e) =>
                  setRpc((r) => ({ ...r, word_order: e.target.value as OrderFlag }))
                }
              >
                <option value="BIG">BIG</option>
                <option value="LITTLE">LITTLE</option>
              </select>
            </label>
            {isWriteFc && (
              <label className="form-control">
                <span className="label-text text-xs font-medium mb-1">Test Write Value</span>
                <input
                  className="input input-sm input-bordered font-mono"
                  value={testValue}
                  onChange={(e) => setTestValue(e.target.value)}
                />
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
              onClick={handleTest}
              disabled={testing}
            >
              <Play className="w-3.5 h-3.5" />
              {testing ? 'Executing...' : 'Test Execute'}
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Save RPC
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
