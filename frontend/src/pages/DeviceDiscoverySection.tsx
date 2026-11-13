import { Card, CardContent } from '@/components/ui';
import { buildDiscoveryPreview } from '@/lib';
import type { ModbusDeviceConfig } from '@/types';

interface DeviceDiscoverySectionProps {
  baseTopic: string;
  device: ModbusDeviceConfig;
}

export function DeviceDiscoverySection({ baseTopic, device }: DeviceDiscoverySectionProps) {
  const topics = [
    { label: 'Telemetry Topic', value: `${baseTopic}/${device.friendly_name}` },
    { label: 'Command Topic', value: `${baseTopic}/${device.friendly_name}/set` },
    { label: 'Availability Topic', value: `${baseTopic}/${device.friendly_name}/availability` },
  ];

  return (
    <Card>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
          {topics.map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-muted/40 p-2.5">
              <div className="text-[11px] font-sans text-muted-foreground mb-0.5">{item.label}</div>
              <div className="font-medium text-foreground break-all">{item.value}</div>
            </div>
          ))}
        </div>

        <pre className="rounded-md border border-border bg-muted/40 p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-foreground">
          {JSON.stringify(buildDiscoveryPreview(device), null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
