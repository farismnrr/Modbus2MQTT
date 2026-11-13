import { RefreshCw } from 'lucide-react';
import { DeviceRuntimeState, ModbusDeviceConfig } from '../types';
import { pollDeviceNow } from '../api/client';

interface DashboardPageProps {
  devices: ModbusDeviceConfig[];
  states: Record<string, DeviceRuntimeState>;
  onSelectDevice: (ieeeAddress: string) => void;
}

export function DashboardPage({ devices, states, onSelectDevice }: DashboardPageProps) {
  return (
    <div className="space-y-4">
      <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs">
        <h1 className="text-lg font-bold">Live Dashboard</h1>
        <p className="text-xs text-base-content/70">
          Real-time register telemetry across all active Modbus slaves.
        </p>
      </div>

      {devices.length === 0 ? (
        <div className="bg-base-100 p-8 rounded-xl border border-base-300 text-center text-sm text-base-content/60">
          No Modbus devices configured. Go to <strong>Devices</strong> to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map((dev) => {
            const st = states[dev.ieee_address];
            const avail = st?.availability ?? 'online';
            const values = st?.values ?? {};
            return (
              <div
                key={dev.ieee_address}
                className="card bg-base-100 border border-base-300 shadow-xs hover:border-primary/40 transition-colors"
              >
                <div className="card-body p-4 gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectDevice(dev.ieee_address)}
                      className="text-left cursor-pointer hover:text-primary"
                    >
                      <h2 className="font-bold text-base">{dev.friendly_name}</h2>
                      <div className="text-xs font-mono text-base-content/60">
                        Unit {dev.connection.unit_id} • {dev.connection.host || dev.connection.serial_port}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`badge badge-xs ${
                          avail === 'online' ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {avail}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        title="Poll Now"
                        onClick={() => void pollDeviceNow(dev.ieee_address)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-base-200 text-xs">
                    {dev.points.length === 0 ? (
                      <div className="py-2 text-base-content/50">No registers mapped</div>
                    ) : (
                      dev.points.map((pt) => (
                        <div key={pt.id} className="py-1.5 flex items-center justify-between gap-2">
                          <span className="text-base-content/80 truncate">{pt.label || pt.tag}</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {values[pt.tag] !== undefined ? String(values[pt.tag]) : '—'}
                            {pt.unit ? <span className="ml-1 opacity-70">{pt.unit}</span> : null}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
