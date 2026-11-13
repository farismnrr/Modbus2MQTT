import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Edit3,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Wifi,
} from 'lucide-react';
import {
  pollDeviceNow,
  setDeviceValue,
  testSlaveConnection,
  updateDevice,
} from '../api/client';
import { PointEditorModal } from '../components/PointEditorModal';
import { RpcEditorModal } from '../components/RpcEditorModal';
import {
  DeviceRuntimeState,
  ModbusDeviceConfig,
  ModbusPointConfig,
  ModbusRpcConfig,
  OrderFlag,
  TransportKind,
} from '../types';

interface DeviceDetailPageProps {
  device: ModbusDeviceConfig;
  state?: DeviceRuntimeState;
  baseTopic: string;
  onBack: () => void;
  onUpdated: () => void;
}

type DetailTab = 'exposes' | 'connection' | 'registers' | 'rpcs' | 'discovery';

export function DeviceDetailPage({
  device,
  state,
  baseTopic,
  onBack,
  onUpdated,
}: DeviceDetailPageProps) {
  const [tab, setTab] = useState<DetailTab>('exposes');
  const [draft, setDraft] = useState<ModbusDeviceConfig>(() => structuredClone(device));
  const [saving, setSaving] = useState(false);
  const [polling, setPolling] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingPoint, setEditingPoint] = useState<ModbusPointConfig | 'new' | null>(null);
  const [editingRpc, setEditingRpc] = useState<ModbusRpcConfig | 'new' | null>(null);
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({});

  const persistDevice = async (next: ModbusDeviceConfig) => {
    setSaving(true);
    setNotice(null);
    try {
      const saved = await updateDevice(device.ieee_address, next);
      setDraft(saved);
      onUpdated();
      setNotice({ ok: true, text: 'Device configuration saved and published to bridge/devices.' });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConn = async () => {
    setNotice(null);
    try {
      const res = await testSlaveConnection(draft.connection);
      setNotice({ ok: res.ok, text: `${res.detail} (${res.latency_ms} ms)` });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const handlePollNow = async () => {
    setPolling(true);
    setNotice(null);
    try {
      await pollDeviceNow(device.ieee_address);
      setNotice({ ok: true, text: 'Poll completed and published to MQTT.' });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setPolling(false);
    }
  };

  const handleSetProperty = async (key: string, val: unknown) => {
    try {
      await setDeviceValue(device.ieee_address, { [key]: val });
      setNotice({ ok: true, text: `Executed /set {"${key}": ${JSON.stringify(val)}}` });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const avail = state?.availability ?? 'online';

  return (
    <div className="space-y-4">
      <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" className="btn btn-sm btn-ghost btn-square" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold truncate">{draft.friendly_name}</h1>
              <span
                className={`badge badge-sm ${avail === 'online' ? 'badge-success' : 'badge-error'}`}
              >
                {avail}
              </span>
              <span className="badge badge-sm badge-outline font-mono">{draft.ieee_address}</span>
            </div>
            <p className="text-xs text-base-content/70 font-mono truncate">
              {draft.connection.transport.toUpperCase()} • Unit {draft.connection.unit_id} •{' '}
              {draft.connection.transport === 'serial'
                ? draft.connection.serial_port
                : `${draft.connection.host}:${draft.connection.port}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline gap-1.5"
            onClick={handlePollNow}
            disabled={polling}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${polling ? 'animate-spin' : ''}`} />
            Poll Now
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1.5"
            onClick={() => void persistDevice(draft)}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`alert text-xs ${notice.ok ? 'alert-success' : 'alert-error'}`}>
          <span>{notice.text}</span>
        </div>
      )}

      <div role="tablist" className="tabs tabs-boxed bg-base-100 border border-base-300 p-1 overflow-x-auto flex-nowrap">
        {(
          [
            ['exposes', `Exposes & State (${draft.points.length + draft.rpc_methods.length})`],
            ['connection', 'Slave Connection'],
            ['registers', `Attributes & Timeseries (${draft.points.length})`],
            ['rpcs', `RPC Commands (${draft.rpc_methods.length})`],
            ['discovery', 'MQTT & Discovery Preview'],
          ] as Array<[DetailTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            onClick={() => setTab(id)}
            className={`tab tab-sm whitespace-nowrap ${tab === id ? 'tab-active font-semibold' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'exposes' && (
        <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs p-4 space-y-3">
          {draft.points.length === 0 && draft.rpc_methods.length === 0 ? (
            <div className="text-center py-8 text-sm text-base-content/60">
              No registers or RPCs configured yet. Switch to <strong>Attributes & Timeseries</strong> or{' '}
              <strong>RPC Commands</strong> to map Modbus registers.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {draft.points.map((pt) => {
                const currentVal = state?.values?.[pt.tag];
                const rawDraft = inputDrafts[pt.tag] ?? (currentVal !== undefined ? String(currentVal) : '');
                return (
                  <div
                    key={pt.id}
                    className="border border-base-300 rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{pt.label || pt.tag}</span>
                        <span className="badge badge-xs badge-ghost font-mono">{pt.kind}</span>
                      </div>
                      <div className="text-xs text-base-content/60 font-mono">
                        {pt.tag} • FC0{pt.function_code} @{pt.address} ({pt.data_type})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {pt.writable ? (
                        pt.data_type === 'bool' ? (
                          <input
                            type="checkbox"
                            className="toggle toggle-primary toggle-sm"
                            checked={Boolean(currentVal)}
                            onChange={(e) => void handleSetProperty(pt.tag, e.target.checked)}
                          />
                        ) : (
                          <div className="join">
                            <input
                              className="input input-xs input-bordered join-item w-24 font-mono tabular-nums"
                              value={rawDraft}
                              onChange={(e) =>
                                setInputDrafts((prev) => ({ ...prev, [pt.tag]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-xs btn-primary join-item"
                              onClick={() => {
                                const parsed =
                                  pt.data_type === 'string' ? rawDraft : Number(rawDraft);
                                void handleSetProperty(pt.tag, parsed);
                              }}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="font-mono font-bold text-sm tabular-nums">
                          {currentVal !== undefined ? String(currentVal) : '—'}
                          {pt.unit ? <span className="text-xs font-normal ml-1 opacity-70">{pt.unit}</span> : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {draft.rpc_methods.map((rpc) => {
                const draftVal = inputDrafts[rpc.method] ?? rpc.value_hint ?? 'true';
                return (
                  <div
                    key={rpc.id}
                    className="border border-base-300 rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rpc.label || rpc.method}</span>
                        <span className="badge badge-xs badge-accent">RPC</span>
                      </div>
                      <div className="text-xs text-base-content/60 font-mono">
                        {rpc.method} • FC{String(rpc.function_code).padStart(2, '0')} @{rpc.address}
                      </div>
                    </div>

                    <div className="join shrink-0">
                      <input
                        className="input input-xs input-bordered join-item w-20 font-mono"
                        value={draftVal}
                        onChange={(e) =>
                          setInputDrafts((prev) => ({ ...prev, [rpc.method]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-xs btn-accent join-item"
                        onClick={() => {
                          let v: unknown = draftVal;
                          if (draftVal === 'true') v = true;
                          else if (draftVal === 'false') v = false;
                          else if (draftVal.trim() !== '' && !Number.isNaN(Number(draftVal))) {
                            v = Number(draftVal);
                          }
                          void handleSetProperty(rpc.method, v);
                        }}
                      >
                        Run
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'connection' && (
        <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Friendly Name</span>
              <input
                className="input input-sm input-bordered"
                value={draft.friendly_name}
                onChange={(e) => setDraft((d) => ({ ...d, friendly_name: e.target.value }))}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Vendor</span>
              <input
                className="input input-sm input-bordered"
                value={draft.vendor || ''}
                onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Model</span>
              <input
                className="input input-sm input-bordered"
                value={draft.model || ''}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Transport</span>
              <select
                className="select select-sm select-bordered"
                value={draft.connection.transport}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    connection: { ...d.connection, transport: e.target.value as TransportKind },
                  }))
                }
              >
                <option value="tcp">Modbus TCP</option>
                <option value="rtu_tcp">RTU over TCP</option>
                <option value="serial">Serial RTU</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Unit ID</span>
              <input
                type="number"
                min={0}
                max={247}
                className="input input-sm input-bordered tabular-nums"
                value={draft.connection.unit_id}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    connection: { ...d.connection, unit_id: Number(e.target.value) || 1 },
                  }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Poll Period (ms)</span>
              <input
                type="number"
                min={200}
                className="input input-sm input-bordered tabular-nums"
                value={draft.connection.poll_interval_ms}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    connection: {
                      ...d.connection,
                      poll_interval_ms: Number(e.target.value) || 2000,
                    },
                  }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Timeout (ms)</span>
              <input
                type="number"
                min={200}
                className="input input-sm input-bordered tabular-nums"
                value={draft.connection.timeout_ms}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    connection: { ...d.connection, timeout_ms: Number(e.target.value) || 1500 },
                  }))
                }
              />
            </label>
          </div>

          {draft.connection.transport === 'serial' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="form-control col-span-2">
                <span className="label-text text-xs font-medium mb-1">Serial Port</span>
                <input
                  className="input input-sm input-bordered font-mono"
                  value={draft.connection.serial_port || '/dev/ttyUSB0'}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      connection: { ...d.connection, serial_port: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs font-medium mb-1">Baud Rate</span>
                <input
                  type="number"
                  className="input input-sm input-bordered tabular-nums"
                  value={draft.connection.baud_rate || 9600}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      connection: { ...d.connection, baud_rate: Number(e.target.value) || 9600 },
                    }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs font-medium mb-1">Parity</span>
                <select
                  className="select select-sm select-bordered"
                  value={draft.connection.parity || 'none'}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      connection: {
                        ...d.connection,
                        parity: e.target.value as 'none' | 'even' | 'odd',
                      },
                    }))
                  }
                >
                  <option value="none">None</option>
                  <option value="even">Even</option>
                  <option value="odd">Odd</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="form-control sm:col-span-2">
                <span className="label-text text-xs font-medium mb-1">Host / IP</span>
                <input
                  className="input input-sm input-bordered font-mono"
                  value={draft.connection.host || ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      connection: { ...d.connection, host: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs font-medium mb-1">Port</span>
                <input
                  type="number"
                  className="input input-sm input-bordered tabular-nums"
                  value={draft.connection.port || 502}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      connection: { ...d.connection, port: Number(e.target.value) || 502 },
                    }))
                  }
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Default Byte Order</span>
              <select
                className="select select-sm select-bordered"
                value={draft.connection.byte_order}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    connection: { ...d.connection, byte_order: e.target.value as OrderFlag },
                  }))
                }
              >
                <option value="BIG">BIG</option>
                <option value="LITTLE">LITTLE</option>
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs font-medium mb-1">Default Word Order</span>
              <select
                className="select select-sm select-bordered"
                value={draft.connection.word_order}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    connection: { ...d.connection, word_order: e.target.value as OrderFlag },
                  }))
                }
              >
                <option value="BIG">BIG</option>
                <option value="LITTLE">LITTLE</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-1.5"
              onClick={handleTestConn}
            >
              <Wifi className="w-3.5 h-3.5" />
              Test Connection
            </button>
          </div>
        </div>
      )}

      {tab === 'registers' && (
        <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm">Attributes & Timeseries Registers</h2>
            <button
              type="button"
              className="btn btn-primary btn-xs gap-1"
              onClick={() => setEditingPoint('new')}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Register
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-xs sm:table-sm">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Kind</th>
                  <th>FC</th>
                  <th>Address</th>
                  <th>Type</th>
                  <th>Scale</th>
                  <th>Unit</th>
                  <th>Writable</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.points.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-base-content/60">
                      No registers added yet.
                    </td>
                  </tr>
                ) : (
                  draft.points.map((pt) => (
                    <tr key={pt.id}>
                      <td className="font-mono font-semibold">{pt.tag}</td>
                      <td>
                        <span className="badge badge-xs badge-outline">{pt.kind}</span>
                      </td>
                      <td className="font-mono">FC0{pt.function_code}</td>
                      <td className="font-mono tabular-nums">{pt.address}</td>
                      <td className="font-mono">{pt.data_type}</td>
                      <td className="text-xs">
                        {pt.modifier_type ? `${pt.modifier_type} ${pt.modifier_value}` : '—'}
                      </td>
                      <td>{pt.unit || '—'}</td>
                      <td>{pt.writable ? `Yes (FC${pt.write_function ?? 6})` : 'No'}</td>
                      <td className="text-right space-x-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setEditingPoint(pt)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => {
                            const updated = {
                              ...draft,
                              points: draft.points.filter((x) => x.id !== pt.id),
                            };
                            setDraft(updated);
                            void persistDevice(updated);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rpcs' && (
        <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-sm">ThingsBoard-style RPC Commands</h2>
            <button
              type="button"
              className="btn btn-primary btn-xs gap-1"
              onClick={() => setEditingRpc('new')}
            >
              <Plus className="w-3.5 h-3.5" />
              Add RPC
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-xs sm:table-sm">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>FC</th>
                  <th>Address</th>
                  <th>Objects</th>
                  <th>Data Type</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.rpc_methods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-base-content/60">
                      No RPC methods defined yet.
                    </td>
                  </tr>
                ) : (
                  draft.rpc_methods.map((rpc) => (
                    <tr key={rpc.id}>
                      <td className="font-mono font-semibold">{rpc.method}</td>
                      <td className="font-mono">FC{String(rpc.function_code).padStart(2, '0')}</td>
                      <td className="font-mono tabular-nums">{rpc.address}</td>
                      <td className="tabular-nums">{rpc.objects_count}</td>
                      <td className="font-mono">{rpc.data_type}</td>
                      <td className="text-right space-x-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setEditingRpc(rpc)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => {
                            const updated = {
                              ...draft,
                              rpc_methods: draft.rpc_methods.filter((x) => x.id !== rpc.id),
                            };
                            setDraft(updated);
                            void persistDevice(updated);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'discovery' && (
        <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
            <div className="p-2.5 rounded-lg bg-base-200">
              <div className="text-base-content/60 mb-0.5">Telemetry Topic</div>
              <div className="font-semibold break-all">{baseTopic}/{draft.friendly_name}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-base-200">
              <div className="text-base-content/60 mb-0.5">Command Topic</div>
              <div className="font-semibold break-all">{baseTopic}/{draft.friendly_name}/set</div>
            </div>
            <div className="p-2.5 rounded-lg bg-base-200">
              <div className="text-base-content/60 mb-0.5">Availability Topic</div>
              <div className="font-semibold break-all">{baseTopic}/{draft.friendly_name}/availability</div>
            </div>
          </div>

          <pre className="p-3 rounded-lg bg-base-200 overflow-x-auto font-mono text-[11px]">
            {JSON.stringify(
              {
                ieee_address: draft.ieee_address,
                friendly_name: draft.friendly_name,
                supported: true,
                definition: {
                  vendor: draft.vendor || 'Modbus',
                  model: draft.model || `${draft.connection.transport.toUpperCase()} Unit ${draft.connection.unit_id}`,
                  exposes: [
                    ...draft.points.map((p) => ({
                      type: p.data_type === 'bool' ? 'binary' : p.data_type === 'string' ? 'text' : 'numeric',
                      property: p.tag,
                      unit: p.unit,
                      access: p.writable ? 7 : 5,
                    })),
                    ...draft.rpc_methods.map((r) => ({
                      type: r.data_type === 'bool' ? 'binary' : r.data_type === 'string' ? 'text' : 'numeric',
                      property: r.method,
                      access: [5, 6, 15, 16].includes(r.function_code) ? 2 : 5,
                    })),
                  ],
                },
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}

      {editingPoint && (
        <PointEditorModal
          connection={draft.connection}
          initial={editingPoint === 'new' ? undefined : editingPoint}
          onClose={() => setEditingPoint(null)}
          onSave={(savedPoint) => {
            const exists = draft.points.some((p) => p.id === savedPoint.id);
            const nextPoints = exists
              ? draft.points.map((p) => (p.id === savedPoint.id ? savedPoint : p))
              : [...draft.points, savedPoint];
            const updated = { ...draft, points: nextPoints };
            setDraft(updated);
            setEditingPoint(null);
            void persistDevice(updated);
          }}
        />
      )}

      {editingRpc && (
        <RpcEditorModal
          connection={draft.connection}
          initial={editingRpc === 'new' ? undefined : editingRpc}
          onClose={() => setEditingRpc(null)}
          onSave={(savedRpc) => {
            const exists = draft.rpc_methods.some((r) => r.id === savedRpc.id);
            const nextRpcs = exists
              ? draft.rpc_methods.map((r) => (r.id === savedRpc.id ? savedRpc : r))
              : [...draft.rpc_methods, savedRpc];
            const updated = { ...draft, rpc_methods: nextRpcs };
            setDraft(updated);
            setEditingRpc(null);
            void persistDevice(updated);
          }}
        />
      )}
    </div>
  );
}
