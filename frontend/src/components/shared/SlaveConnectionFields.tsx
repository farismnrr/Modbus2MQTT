import { RefreshCw, Wifi } from 'lucide-react';
import { testSlaveConnection } from '@/api/client';
import { Button, Input, Select } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { ORDER_OPTIONS } from '@/lib';
import type { OrderFlag, SlaveConnectionConfig, TransportKind } from '@/types';
import { FormField } from './FormField';
import { NoticeBanner } from './NoticeBanner';

interface SlaveConnectionFieldsProps {
  connection: SlaveConnectionConfig;
  onChange: (next: SlaveConnectionConfig) => void;
  showTestButton?: boolean;
}

export function SlaveConnectionFields({
  connection,
  onChange,
  showTestButton = false,
}: SlaveConnectionFieldsProps) {
  const { pending, notice, run, clearNotice } = useAsyncAction();

  const patch = (fields: Partial<SlaveConnectionConfig>) => onChange({ ...connection, ...fields });

  const handleTest = () =>
    void run(async () => {
      const res = await testSlaveConnection(connection);
      if (!res.ok) throw new Error(`${res.detail} (${res.latency_ms} ms)`);
      return res;
    }, (res) => `${res.detail} (${res.latency_ms} ms)`);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FormField label="Transport">
          <Select
            value={connection.transport}
            onChange={(e) => patch({ transport: e.target.value as TransportKind })}
          >
            <option value="tcp">Modbus TCP</option>
            <option value="rtu_tcp">RTU over TCP</option>
            <option value="serial">Serial RTU</option>
          </Select>
        </FormField>

        <FormField label="Unit ID">
          <Input
            type="number"
            min={0}
            max={247}
            className="tabular-nums font-mono"
            value={connection.unit_id}
            onChange={(e) => patch({ unit_id: Number(e.target.value) || 1 })}
          />
        </FormField>

        <FormField label="Poll Period (ms)">
          <Input
            type="number"
            min={200}
            step={100}
            className="tabular-nums font-mono"
            value={connection.poll_interval_ms}
            onChange={(e) => patch({ poll_interval_ms: Number(e.target.value) || 2000 })}
          />
        </FormField>

        <FormField label="Timeout (ms)">
          <Input
            type="number"
            min={200}
            step={100}
            className="tabular-nums font-mono"
            value={connection.timeout_ms}
            onChange={(e) => patch({ timeout_ms: Number(e.target.value) || 1500 })}
          />
        </FormField>
      </div>

      {connection.transport === 'serial' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FormField label="Serial Port" className="col-span-2">
            <Input
              className="font-mono"
              value={connection.serial_port || '/dev/ttyUSB0'}
              onChange={(e) => patch({ serial_port: e.target.value })}
            />
          </FormField>
          <FormField label="Baud Rate">
            <Input
              type="number"
              className="tabular-nums font-mono"
              value={connection.baud_rate || 9600}
              onChange={(e) => patch({ baud_rate: Number(e.target.value) || 9600 })}
            />
          </FormField>
          <FormField label="Parity">
            <Select
              value={connection.parity || 'none'}
              onChange={(e) => patch({ parity: e.target.value as 'none' | 'even' | 'odd' })}
            >
              <option value="none">None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </Select>
          </FormField>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Host / IP Address *" className="sm:col-span-2">
            <Input
              className="font-mono"
              placeholder="192.168.1.50"
              value={connection.host || ''}
              onChange={(e) => patch({ host: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Port">
            <Input
              type="number"
              className="tabular-nums font-mono"
              value={connection.port || 502}
              onChange={(e) => patch({ port: Number(e.target.value) || 502 })}
            />
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
        <FormField label="Default Byte Order">
          <Select
            value={connection.byte_order}
            onChange={(e) => patch({ byte_order: e.target.value as OrderFlag })}
          >
            {ORDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === 'BIG' ? 'BIG (AB)' : 'LITTLE (BA)'}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Default Word Order">
          <Select
            value={connection.word_order}
            onChange={(e) => patch({ word_order: e.target.value as OrderFlag })}
          >
            {ORDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === 'BIG' ? 'BIG (ABCD)' : 'LITTLE (CDAB)'}
              </option>
            ))}
          </Select>
        </FormField>

        {showTestButton ? (
          <Button variant="outline" onClick={handleTest} disabled={pending} className="w-full sm:w-auto">
            {pending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            {pending ? 'Testing...' : 'Test Connection'}
          </Button>
        ) : null}
      </div>

      {showTestButton ? <NoticeBanner notice={notice} onDismiss={clearNotice} /> : null}
    </div>
  );
}
