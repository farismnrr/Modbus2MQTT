import { useState } from 'react';
import { ChevronRight, Cpu, Plus, Search, Trash2 } from 'lucide-react';
import { deleteDevice } from '@/api/client';
import { EmptyState, PageHeader, StatusBadge } from '@/components/shared';
import {
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { formatSlaveEndpoint } from '@/lib';
import type { DeviceRuntimeState, ModbusDeviceConfig } from '@/types';
import { AddSlaveDialog } from './AddSlaveDialog';

interface DevicesPageProps {
  devices: ModbusDeviceConfig[];
  states: Record<string, DeviceRuntimeState>;
  onSelectDevice: (ieeeAddress: string) => void;
  onDevicesChanged: () => void;
}

export function DevicesPage({
  devices,
  states,
  onSelectDevice,
  onDevicesChanged,
}: DevicesPageProps) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = devices.filter((dev) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      dev.friendly_name.toLowerCase().includes(q) ||
      dev.ieee_address.toLowerCase().includes(q) ||
      formatSlaveEndpoint(dev.connection).toLowerCase().includes(q) ||
      (dev.model || '').toLowerCase().includes(q)
    );
  });

  const handleDelete = async (e: React.MouseEvent, dev: ModbusDeviceConfig) => {
    e.stopPropagation();
    if (!window.confirm(`Remove Modbus slave "${dev.friendly_name}"?`)) return;
    await deleteDevice(dev.ieee_address);
    onDevicesChanged();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Modbus Slaves"
        description="Every slave, register, and RPC command publishes cleanly to Zigbee2MQTT-compatible discovery topics."
        actions={
          <>
            <div className="relative w-full sm:w-52">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Filter slaves..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add Slave
            </Button>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title={devices.length === 0 ? 'No Modbus slaves configured' : 'No matching slaves'}
          description={
            devices.length === 0
              ? 'Add a Modbus TCP, RTU-over-TCP, or Serial RTU device to expose its registers and RPC commands to Sensio.'
              : 'Adjust your filter query to locate a configured slave.'
          }
          action={
            devices.length === 0 ? (
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add First Slave
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Unit / ID</TableHead>
              <TableHead>Transport</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">RPCs</TableHead>
              <TableHead className="text-right">Poll</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((dev) => {
              const st = states[dev.ieee_address];
              const avail = st?.availability ?? (dev.disabled ? 'offline' : 'online');
              return (
                <TableRow
                  key={dev.ieee_address}
                  onClick={() => onSelectDevice(dev.ieee_address)}
                  className="cursor-pointer group"
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{dev.friendly_name}</div>
                    {dev.model ? <div className="text-[11px] text-muted-foreground">{dev.model}</div> : null}
                  </TableCell>
                  <TableCell className="font-mono">
                    <div>Unit {dev.connection.unit_id}</div>
                    <div className="text-[11px] text-muted-foreground">{dev.ieee_address}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="mono" className="uppercase">
                      {dev.connection.transport}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {formatSlaveEndpoint(dev.connection)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{dev.points.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{dev.rpc_methods.length}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {dev.connection.poll_interval_ms} ms
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={avail} />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {st?.last_seen ? new Date(st.last_seen).toLocaleTimeString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => void handleDelete(e, dev)}
                        className="opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        title="Delete slave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AddSlaveDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onCreated={(ieee) => {
          onDevicesChanged();
          onSelectDevice(ieee);
        }}
      />
    </div>
  );
}
