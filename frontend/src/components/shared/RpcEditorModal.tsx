import { useState } from 'react';
import { Play } from 'lucide-react';
import { testRpcMethod } from '@/api/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { createDefaultRpc, parseModbusInputValue, RPC_FC_OPTIONS } from '@/lib';
import type { ModbusRpcConfig, SlaveConnectionConfig } from '@/types';
import { FormField } from './FormField';
import { ModbusTargetFields } from './ModbusTargetFields';
import { NoticeBanner } from './NoticeBanner';

interface RpcEditorModalProps {
  connection: SlaveConnectionConfig;
  initial?: ModbusRpcConfig;
  onSave: (rpc: ModbusRpcConfig) => void;
  onClose: () => void;
}

export function RpcEditorModal({ connection, initial, onSave, onClose }: RpcEditorModalProps) {
  const [rpc, setRpc] = useState<ModbusRpcConfig>(() => initial ?? createDefaultRpc(connection));
  const [testValue, setTestValue] = useState(initial?.value_hint ?? 'true');
  const { pending: testing, notice: testNotice, run, clearNotice } = useAsyncAction();

  const isWriteFc = [5, 6, 15, 16].includes(rpc.function_code);

  const handleTest = () =>
    void run(
      async () => {
        const parsed = isWriteFc ? parseModbusInputValue(testValue) : undefined;
        return testRpcMethod(connection, rpc, parsed);
      },
      (res) => `Result: ${JSON.stringify(res.result)} (${res.latency_ms} ms)`,
    );

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
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Modbus RPC Command' : 'Add Modbus RPC Command'}</DialogTitle>
          <DialogDescription>
            Exposed as a Zigbee2MQTT <code className="font-mono">/set</code> property so Sensio can invoke it cleanly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="RPC Method / Key *">
              <Input
                className="font-mono"
                placeholder="e.g. setRelay1 or reset_energy"
                value={rpc.method}
                onChange={(e) => setRpc((r) => ({ ...r, method: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Display Label">
              <Input
                placeholder="e.g. Relay 1 Switch"
                value={rpc.label || ''}
                onChange={(e) => setRpc((r) => ({ ...r, label: e.target.value }))}
              />
            </FormField>
          </div>

          <ModbusTargetFields
            value={rpc}
            defaultByteOrder={connection.byte_order}
            defaultWordOrder={connection.word_order}
            functionCodes={RPC_FC_OPTIONS}
            onChange={(patch) =>
              setRpc((r) => ({
                ...r,
                ...patch,
                function_code: (patch.function_code ?? r.function_code) as 1 | 2 | 3 | 4 | 5 | 6 | 15 | 16,
              }))
            }
          />

          {isWriteFc ? (
            <FormField label="Test Write Value">
              <Input
                className="font-mono"
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
              />
            </FormField>
          ) : null}

          <NoticeBanner notice={testNotice} onDismiss={clearNotice} />

          <DialogFooter>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              <Play className="w-3.5 h-3.5" />
              {testing ? 'Executing...' : 'Test Execute'}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save RPC</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
