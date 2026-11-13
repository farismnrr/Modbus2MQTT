import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { testRegisterPoint } from '@/api/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  Switch,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { createDefaultPoint, MODIFIER_OPTIONS, READ_FC_OPTIONS } from '@/lib';
import type { ModbusPointConfig, ModifierType, PointKind, SlaveConnectionConfig } from '@/types';
import { FormField } from './FormField';
import { ModbusTargetFields } from './ModbusTargetFields';
import { NoticeBanner } from './NoticeBanner';

interface PointEditorModalProps {
  connection: SlaveConnectionConfig;
  initial?: ModbusPointConfig;
  onSave: (point: ModbusPointConfig) => void;
  onClose: () => void;
}

export function PointEditorModal({ connection, initial, onSave, onClose }: PointEditorModalProps) {
  const [point, setPoint] = useState<ModbusPointConfig>(() => initial ?? createDefaultPoint(connection));
  const { pending: testing, notice: testNotice, run, clearNotice } = useAsyncAction();

  const handleTestRead = () =>
    void run(
      async () => testRegisterPoint(connection, point),
      (res) => {
        const raw = res.raw_registers
          ? ` | raw: [${res.raw_registers.map((r) => `0x${r.toString(16).padStart(4, '0')}`).join(', ')}]`
          : res.raw_bits
            ? ` | bits: [${res.raw_bits.join(', ')}]`
            : '';
        return `Decoded: ${JSON.stringify(res.value)}${raw} (${res.latency_ms} ms)`;
      },
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!point.tag.trim()) return;
    onSave({
      ...point,
      tag: point.tag.trim(),
      label: point.label?.trim() || undefined,
      unit: point.unit?.trim() || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Register Mapping' : 'Add Register Mapping'}</DialogTitle>
          <DialogDescription>
            Map Modbus register address, function code, data type, endianness, and scaling modifier.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Tag / Property *">
              <Input
                className="font-mono"
                placeholder="e.g. voltage_l1"
                value={point.tag}
                onChange={(e) => setPoint((p) => ({ ...p, tag: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Display Label">
              <Input
                placeholder="e.g. Line 1 Voltage"
                value={point.label || ''}
                onChange={(e) => setPoint((p) => ({ ...p, label: e.target.value }))}
              />
            </FormField>
            <FormField label="Kind">
              <Select
                value={point.kind}
                onChange={(e) => setPoint((p) => ({ ...p, kind: e.target.value as PointKind }))}
              >
                <option value="timeseries">Timeseries</option>
                <option value="attributes">Attributes</option>
              </Select>
            </FormField>
          </div>

          <ModbusTargetFields
            value={point}
            defaultByteOrder={connection.byte_order}
            defaultWordOrder={connection.word_order}
            functionCodes={READ_FC_OPTIONS}
            lockCountForFixedTypes
            onChange={(patch) =>
              setPoint((p) => ({
                ...p,
                ...patch,
                function_code: (patch.function_code ?? p.function_code) as 1 | 2 | 3 | 4,
              }))
            }
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Modifier">
              <Select
                value={point.modifier_type || ''}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, modifier_type: (e.target.value || undefined) as ModifierType | undefined }))
                }
              >
                {MODIFIER_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Modifier Value">
              <Input
                type="number"
                step="any"
                className="tabular-nums font-mono"
                disabled={!point.modifier_type}
                value={point.modifier_value ?? ''}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, modifier_value: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
              />
            </FormField>

            <FormField label="Unit">
              <Input
                placeholder="V, A, W, °C..."
                value={point.unit || ''}
                onChange={(e) => setPoint((p) => ({ ...p, unit: e.target.value }))}
              />
            </FormField>

            <FormField label="Bit Index">
              <Input
                type="number"
                min={0}
                max={15}
                className="tabular-nums font-mono"
                disabled={point.data_type !== 'bool' || point.function_code <= 2}
                value={point.bit_index ?? ''}
                onChange={(e) =>
                  setPoint((p) => ({ ...p, bit_index: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
              />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/35 px-3 py-2">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <Switch
                checked={point.writable}
                disabled={point.function_code === 2 || point.function_code === 4}
                onCheckedChange={(checked) => setPoint((p) => ({ ...p, writable: checked }))}
              />
              Writable (Expose /set)
            </label>

            {point.writable ? (
              <div className="w-44">
                <Select
                  value={point.write_function ?? (point.function_code === 1 ? 5 : 6)}
                  onChange={(e) =>
                    setPoint((p) => ({ ...p, write_function: Number(e.target.value) as 5 | 6 | 15 | 16 }))
                  }
                >
                  {point.function_code === 1 ? (
                    <>
                      <option value={5}>FC05 - Single Coil</option>
                      <option value={15}>FC15 - Multi Coils</option>
                    </>
                  ) : (
                    <>
                      <option value={6}>FC06 - Single Reg</option>
                      <option value={16}>FC16 - Multi Regs</option>
                    </>
                  )}
                </Select>
              </div>
            ) : null}
          </div>

          <NoticeBanner notice={testNotice} onDismiss={clearNotice} />

          <DialogFooter>
            <Button variant="outline" onClick={handleTestRead} disabled={testing}>
              <FlaskConical className="w-3.5 h-3.5" />
              {testing ? 'Reading...' : 'Test Read'}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Save Register</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
