import { useState } from 'react';
import { ChevronRight, Plus, RefreshCw, Search, Trash2, Wifi } from 'lucide-react';
import { createDevice, deleteDevice, testSlaveConnection } from '../api/client';
import { DeviceRuntimeState, ModbusDeviceConfig, OrderFlag, SlaveConnectionConfig, TransportKind } from '../types';

interface DevicesPageProps {
  devices: ModbusDeviceConfig[];
  states: Record<string, DeviceRuntimeState>;
  onSelectDevice: (ieeeAddress: string) => void;
  onDevicesChanged: () => void;
}

const DEFAULT_CONNECTION: SlaveConnectionConfig = {
  transport: 'tcp',
  host: '192.168.1.50',
  port: 502,
  serial_port: '/dev/ttyUSB0',
  baud_rate: 9600,
  data_bits: 8,
  stop_bits: 1,
  parity: 'none',
  unit_id: 1,
  poll_interval_ms: 2000,
  timeout_ms: 1500,
  byte_order: 'BIG',
  word_order: 'BIG',
};

export function DevicesPage({
  devices,
  states,
  onSelectDevice,
  onDevicesChanged,
}: DevicesPageProps) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');
  const [model, setModel] = useState('');
  const [vendor, setVendor] = useState('Modbus');
  const [description, setDescription] = useState('');
  const [conn, setConn] = useState<SlaveConnectionConfig>(DEFAULT_CONNECTION);
  const [testOutcome, setTestOutcome] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = devices.filter((dev) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      dev.friendly_name.toLowerCase().includes(q) ||
      dev.ieee_address.toLowerCase().includes(q) ||
      (dev.connection.host || '').toLowerCase().includes(q) ||
      (dev.model || '').toLowerCase().includes(q)
    );
  });

  const handleTest = async () => {
    setTesting(true);
    setTestOutcome(null);
    try {
      const res = await testSlaveConnection(conn);
      setTestOutcome({ ok: res.ok, msg: `${res.detail} (${res.latency_ms} ms)` });
    } catch (err) {
      setTestOutcome({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendlyName.trim()) {
      setError('Friendly name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createDevice({
        friendly_name: friendlyName.trim(),
        vendor: vendor.trim() || 'Modbus',
        model: model.trim() || undefined,
        description: description.trim() || undefined,
        connection: conn,
        points: [],
        rpc_methods: [],
      });
      setShowAdd(false);
      setFriendlyName('');
      setModel('');
      setDescription('');
      setTestOutcome(null);
      onDevicesChanged();
      onSelectDevice(created.ieee_address);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, dev: ModbusDeviceConfig) => {
    e.stopPropagation();
    if (!window.confirm(`Remove Modbus slave "${dev.friendly_name}"?`)) return;
    await deleteDevice(dev.ieee_address);
    onDevicesChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
        <div>
          <h1 className="text-lg font-bold">Modbus Slaves & Devices</h1>
          <p className="text-xs text-base-content/70">
            Configure Modbus TCP, RTU-over-TCP, or Serial RTU slaves cleanly in ThingsBoard style. Every point & RPC is auto-exposed to Zigbee2MQTT-compatible discovery topics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="input input-sm input-bordered flex items-center gap-2 w-full sm:w-56">
            <Search className="w-3.5 h-3.5 opacity-60" />
            <input
              type="text"
              placeholder="Filter devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm gap-1.5 shrink-0"
            onClick={() => {
              setTestOutcome(null);
              setError(null);
              setShowAdd(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Add Slave
          </button>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs overflow-x-auto">
        <table className="table table-sm sm:table-md">
          <thead>
            <tr className="text-xs uppercase text-base-content/60">
              <th>Friendly Name</th>
              <th>Slave ID / Key</th>
              <th>Transport</th>
              <th>Endpoint</th>
              <th className="text-right">Points</th>
              <th className="text-right">RPCs</th>
              <th className="text-right">Poll</th>
              <th>Availability</th>
              <th>Last Seen</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-10 text-base-content/60">
                  No Modbus slaves configured yet. Click <strong>Add Slave</strong> to connect your first meter, PLC, or RTU gateway.
                </td>
              </tr>
            ) : (
              filtered.map((dev) => {
                const st = states[dev.ieee_address];
                const avail = st?.availability ?? (dev.disabled ? 'offline' : 'online');
                const endpoint =
                  dev.connection.transport === 'serial'
                    ? `${dev.connection.serial_port || '/dev/ttyUSB0'}`
                    : `${dev.connection.host || '127.0.0.1'}:${dev.connection.port || 502}`;
                return (
                  <tr
                    key={dev.ieee_address}
                    onClick={() => onSelectDevice(dev.ieee_address)}
                    className="hover:bg-base-200/70 cursor-pointer transition-colors"
                  >
                    <td>
                      <div className="font-semibold">{dev.friendly_name}</div>
                      {dev.model && <div className="text-xs text-base-content/60">{dev.model}</div>}
                    </td>
                    <td className="font-mono text-xs">
                      <div>Unit {dev.connection.unit_id}</div>
                      <div className="text-base-content/50">{dev.ieee_address}</div>
                    </td>
                    <td>
                      <span className="badge badge-outline badge-sm uppercase font-mono">
                        {dev.connection.transport}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{endpoint}</td>
                    <td className="text-right tabular-nums">{dev.points.length}</td>
                    <td className="text-right tabular-nums">{dev.rpc_methods.length}</td>
                    <td className="text-right tabular-nums text-xs">
                      {dev.connection.poll_interval_ms} ms
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm ${
                          avail === 'online' ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {avail}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/70 tabular-nums">
                      {st?.last_seen ? new Date(st.last_seen).toLocaleTimeString() : '—'}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, dev)}
                          className="btn btn-ghost btn-xs text-error"
                          title="Delete slave"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-base-content/40" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-1">Add Modbus Slave (ThingsBoard Style)</h3>
            <p className="text-xs text-base-content/70 mb-4">
              Define slave transport, network endpoint or serial bus, unit ID, and default endianness. After creating the slave you can add Attributes, Timeseries registers, and RPC commands.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Friendly Name *</span>
                  <input
                    className="input input-sm input-bordered"
                    placeholder="e.g. Main Panel Meter"
                    value={friendlyName}
                    onChange={(e) => setFriendlyName(e.target.value)}
                    required
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Vendor / Model</span>
                  <div className="flex gap-2">
                    <input
                      className="input input-sm input-bordered w-1/2"
                      placeholder="Schneider"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                    />
                    <input
                      className="input input-sm input-bordered w-1/2"
                      placeholder="PM5110"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Transport</span>
                  <select
                    className="select select-sm select-bordered"
                    value={conn.transport}
                    onChange={(e) =>
                      setConn((prev) => ({
                        ...prev,
                        transport: e.target.value as TransportKind,
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
                    value={conn.unit_id}
                    onChange={(e) =>
                      setConn((p) => ({ ...p, unit_id: Number(e.target.value) || 1 }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Poll Period (ms)</span>
                  <input
                    type="number"
                    min={200}
                    step={100}
                    className="input input-sm input-bordered tabular-nums"
                    value={conn.poll_interval_ms}
                    onChange={(e) =>
                      setConn((p) => ({ ...p, poll_interval_ms: Number(e.target.value) || 2000 }))
                    }
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Timeout (ms)</span>
                  <input
                    type="number"
                    min={200}
                    step={100}
                    className="input input-sm input-bordered tabular-nums"
                    value={conn.timeout_ms}
                    onChange={(e) =>
                      setConn((p) => ({ ...p, timeout_ms: Number(e.target.value) || 1500 }))
                    }
                  />
                </label>
              </div>

              {conn.transport === 'serial' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="form-control col-span-2">
                    <span className="label-text text-xs font-medium mb-1">Serial Port</span>
                    <input
                      className="input input-sm input-bordered font-mono"
                      value={conn.serial_port || '/dev/ttyUSB0'}
                      onChange={(e) => setConn((p) => ({ ...p, serial_port: e.target.value }))}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs font-medium mb-1">Baud Rate</span>
                    <input
                      type="number"
                      className="input input-sm input-bordered tabular-nums"
                      value={conn.baud_rate || 9600}
                      onChange={(e) =>
                        setConn((p) => ({ ...p, baud_rate: Number(e.target.value) || 9600 }))
                      }
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs font-medium mb-1">Parity</span>
                    <select
                      className="select select-sm select-bordered"
                      value={conn.parity || 'none'}
                      onChange={(e) =>
                        setConn((p) => ({
                          ...p,
                          parity: e.target.value as 'none' | 'even' | 'odd',
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
                <div className="grid grid-cols-3 gap-3">
                  <label className="form-control col-span-2">
                    <span className="label-text text-xs font-medium mb-1">Host / IP Address *</span>
                    <input
                      className="input input-sm input-bordered font-mono"
                      value={conn.host || ''}
                      onChange={(e) => setConn((p) => ({ ...p, host: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs font-medium mb-1">Port</span>
                    <input
                      type="number"
                      className="input input-sm input-bordered tabular-nums"
                      value={conn.port || 502}
                      onChange={(e) =>
                        setConn((p) => ({ ...p, port: Number(e.target.value) || 502 }))
                      }
                    />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Default Byte Order</span>
                  <select
                    className="select select-sm select-bordered"
                    value={conn.byte_order}
                    onChange={(e) =>
                      setConn((p) => ({ ...p, byte_order: e.target.value as OrderFlag }))
                    }
                  >
                    <option value="BIG">BIG (AB)</option>
                    <option value="LITTLE">LITTLE (BA)</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text text-xs font-medium mb-1">Default Word Order</span>
                  <select
                    className="select select-sm select-bordered"
                    value={conn.word_order}
                    onChange={(e) =>
                      setConn((p) => ({ ...p, word_order: e.target.value as OrderFlag }))
                    }
                  >
                    <option value="BIG">BIG (ABCD)</option>
                    <option value="LITTLE">LITTLE (CDAB)</option>
                  </select>
                </label>
              </div>

              {testOutcome && (
                <div className={`alert text-xs ${testOutcome.ok ? 'alert-success' : 'alert-error'}`}>
                  <span>{testOutcome.msg}</span>
                </div>
              )}
              {error && (
                <div className="alert alert-error text-xs">
                  <span>{error}</span>
                </div>
              )}

              <div className="modal-action justify-between items-center pt-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-1.5"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  Test Connection
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? 'Saving...' : 'Create & Configure Registers'}
                  </button>
                </div>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setShowAdd(false)}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
