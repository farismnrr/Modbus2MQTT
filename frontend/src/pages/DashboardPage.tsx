import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { pollDeviceNow, setDeviceValue } from '@/api/client';
import { EmptyState, InlineValueControl, PageHeader, StatusBadge } from '@/components/shared';
import { Button, Card, CardContent, CardHeader } from '@/components/ui';
import { formatSlaveEndpoint } from '@/lib';
import type { DeviceRuntimeState, ModbusDeviceConfig } from '@/types';

interface DashboardPageProps {
  devices: ModbusDeviceConfig[];
  states: Record<string, DeviceRuntimeState>;
  onSelectDevice: (ieeeAddress: string) => void;
}

export function DashboardPage({ devices, states, onSelectDevice }: DashboardPageProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Dashboard"
        description="Real-time telemetry across active Modbus slaves."
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No telemetry streams yet"
          description="Add a Modbus slave and map its registers under Devices to monitor live telemetry here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {devices.map((dev) => {
            const st = states[dev.ieee_address];
            const avail = st?.availability ?? 'online';
            const values = st?.values ?? {};

            return (
              <Card key={dev.ieee_address} className="hover:border-primary/40 transition-colors">
                <CardHeader className="py-2.5 px-3.5 items-center">
                  <button
                    type="button"
                    onClick={() => onSelectDevice(dev.ieee_address)}
                    className="text-left min-w-0 cursor-pointer group"
                  >
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary truncate transition-colors">
                      {dev.friendly_name}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate">
                      Unit {dev.connection.unit_id} · {formatSlaveEndpoint(dev.connection)}
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={avail} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Poll Now"
                      onClick={() => void pollDeviceNow(dev.ieee_address)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {dev.points.length === 0 ? (
                    <div className="px-3.5 py-4 text-xs text-muted-foreground">No registers mapped</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {dev.points.map((pt) => (
                        <div key={pt.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground truncate">{pt.label || pt.tag}</span>
                          <InlineValueControl
                            value={values[pt.tag]}
                            unit={pt.unit}
                            writable={pt.writable}
                            dataType={pt.data_type}
                            onCommit={(val) => void setDeviceValue(dev.ieee_address, { [pt.tag]: val })}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
