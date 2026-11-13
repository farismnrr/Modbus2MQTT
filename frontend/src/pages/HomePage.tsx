import { Activity, ArrowRight, Cpu, Home, RefreshCw, ScrollText, Settings } from 'lucide-react';
import { pollDeviceNow, setDeviceValue } from '@/api/client';
import { EmptyState, InlineValueControl, PageHeader, StatusBadge, type NavTab } from '@/components/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatSlaveEndpoint } from '@/lib';
import type { BridgeConfig, DeviceRuntimeState, LogMessage, ModbusDeviceConfig } from '@/types';

interface HomePageProps {
  devices: ModbusDeviceConfig[];
  states: Record<string, DeviceRuntimeState>;
  config: BridgeConfig;
  mqttConnected: boolean;
  wsConnected: boolean;
  logs: LogMessage[];
  onSelectDevice: (ieeeAddress: string) => void;
  onNavigate: (tab: NavTab) => void;
}

export function HomePage({
  devices,
  states,
  config,
  mqttConnected,
  wsConnected,
  logs,
  onSelectDevice,
  onNavigate,
}: HomePageProps) {
  const onlineCount = devices.filter((d) => (states[d.ieee_address]?.availability ?? 'online') === 'online').length;
  const totalPoints = devices.reduce((sum, d) => sum + d.points.length, 0);
  const totalRpcs = devices.reduce((sum, d) => sum + d.rpc_methods.length, 0);
  const recentLogs = logs.slice(0, 5);

  const summaryItems = [
    {
      label: 'Bridge Status',
      value: mqttConnected ? 'Connected' : 'Disconnected',
      sub: `${wsConnected ? 'WS live' : 'WS offline'} · ${config.mqtt.server}`,
    },
    {
      label: 'Modbus Slaves',
      value: `${onlineCount} / ${devices.length}`,
      sub: 'Online slaves',
      onClick: () => onNavigate('devices'),
    },
    {
      label: 'Mapped Telemetry',
      value: `${totalPoints} pts`,
      sub: `${totalRpcs} RPC controls`,
    },
    {
      label: 'Availability',
      value: config.availability.enabled ? 'Enabled' : 'Disabled',
      sub: `Last seen: ${config.advanced.last_seen}`,
      onClick: () => onNavigate('settings'),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Home"
        description="Modbus2MQTT bridge overview and real-time device exposures."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate('settings')}>
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Button>
            <Button size="sm" onClick={() => onNavigate('devices')}>
              <Cpu className="w-3.5 h-3.5" />
              Manage Devices
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryItems.map((item) => (
          <Card
            key={item.label}
            onClick={item.onClick}
            className={item.onClick ? 'cursor-pointer hover:border-primary/40 transition-colors' : undefined}
          >
            <CardContent className="p-3.5 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">{item.label}</div>
              <div className="text-base font-semibold tracking-tight tabular-nums text-foreground truncate">
                {item.value}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">{item.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Live Exposes
          </h2>
          {devices.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('devices')}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              All devices
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {devices.length === 0 ? (
          <EmptyState
            icon={Home}
            title="No Modbus slaves yet"
            description="Add a Modbus TCP or RTU-over-TCP slave under Devices to view live telemetry here."
            action={
              <Button size="sm" onClick={() => onNavigate('devices')}>
                <Cpu className="w-3.5 h-3.5" />
                Go to Devices
              </Button>
            }
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
      </section>

      {recentLogs.length > 0 && (
        <Card>
          <CardHeader className="py-2.5 px-3.5 items-center">
            <CardTitle className="flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('logs')}>
              View all
              <ArrowRight className="w-3 h-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border font-mono text-xs">
            {recentLogs.map((entry, idx) => (
              <div key={`${entry.timestamp}-${idx}`} className="px-3.5 py-2 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <Badge variant={entry.level === 'error' ? 'destructive' : entry.level === 'warning' ? 'warning' : 'outline'} className="uppercase text-[10px] shrink-0">
                  {entry.level}
                </Badge>
                <span className="truncate text-foreground">{entry.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}