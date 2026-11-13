import { SlidersHorizontal } from 'lucide-react';
import { EmptyState, InlineValueControl } from '@/components/shared';
import { Badge, Card } from '@/components/ui';
import { formatFunctionCode } from '@/lib';
import type { DeviceRuntimeState, ModbusDeviceConfig } from '@/types';

interface DeviceExposesSectionProps {
  device: ModbusDeviceConfig;
  state?: DeviceRuntimeState;
  onSetProperty: (key: string, value: unknown) => void;
}

export function DeviceExposesSection({ device, state, onSetProperty }: DeviceExposesSectionProps) {
  if (device.points.length === 0 && device.rpc_methods.length === 0) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title="No exposed registers or RPCs"
        description="Open the Registers or RPCs tab to map addresses and expose controls to Sensio."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {device.points.map((pt) => (
        <Card key={pt.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground truncate">
                {pt.label || pt.tag}
              </span>
              <Badge variant="outline">{pt.kind}</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {pt.tag} · {formatFunctionCode(pt.function_code)} @{pt.address} ({pt.data_type})
            </div>
          </div>
          <InlineValueControl
            value={state?.values?.[pt.tag]}
            unit={pt.unit}
            writable={pt.writable}
            dataType={pt.data_type}
            onCommit={(val) => onSetProperty(pt.tag, val)}
          />
        </Card>
      ))}

      {device.rpc_methods.map((rpc) => (
        <Card key={rpc.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground truncate">
                {rpc.label || rpc.method}
              </span>
              <Badge variant="default">RPC</Badge>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {rpc.method} · {formatFunctionCode(rpc.function_code)} @{rpc.address}
            </div>
          </div>
          <InlineValueControl
            value={undefined}
            isRpc
            dataType={rpc.data_type}
            defaultInput={rpc.value_hint ?? 'true'}
            onCommit={(val) => onSetProperty(rpc.method, val)}
          />
        </Card>
      ))}
    </div>
  );
}
