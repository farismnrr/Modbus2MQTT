import { Input, Select } from '@/components/ui';
import { DATA_TYPE_OPTIONS, DATA_TYPE_REGISTER_COUNTS, ORDER_OPTIONS } from '@/lib';
import type { ModbusDataType, OrderFlag } from '@/types';
import { FormField } from './FormField';

export interface ModbusTargetValue {
  function_code: number;
  address: number;
  data_type: ModbusDataType;
  objects_count: number;
  byte_order?: OrderFlag;
  word_order?: OrderFlag;
}

interface ModbusTargetFieldsProps {
  value: ModbusTargetValue;
  defaultByteOrder: OrderFlag;
  defaultWordOrder: OrderFlag;
  functionCodes: ReadonlyArray<{ value: number; label: string }>;
  lockCountForFixedTypes?: boolean;
  onChange: (patch: Partial<ModbusTargetValue>) => void;
}

export function ModbusTargetFields({
  value,
  defaultByteOrder,
  defaultWordOrder,
  functionCodes,
  lockCountForFixedTypes = false,
  onChange,
}: ModbusTargetFieldsProps) {
  const fixedCount = lockCountForFixedTypes ? DATA_TYPE_REGISTER_COUNTS[value.data_type] : undefined;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FormField label="Function Code">
          <Select
            value={value.function_code}
            onChange={(e) => onChange({ function_code: Number(e.target.value) })}
          >
            {functionCodes.map((fc) => (
              <option key={fc.value} value={fc.value}>
                {fc.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Address (0-based)">
          <Input
            type="number"
            min={0}
            max={65535}
            className="tabular-nums font-mono"
            value={value.address}
            onChange={(e) => onChange({ address: Number(e.target.value) || 0 })}
          />
        </FormField>

        <FormField label="Data Type">
          <Select
            value={value.data_type}
            onChange={(e) => {
              const dt = e.target.value as ModbusDataType;
              const fixed = lockCountForFixedTypes ? DATA_TYPE_REGISTER_COUNTS[dt] : undefined;
              onChange({ data_type: dt, objects_count: fixed ?? value.objects_count });
            }}
          >
            {DATA_TYPE_OPTIONS.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Objects / Regs">
          <Input
            type="number"
            min={1}
            max={64}
            className="tabular-nums font-mono"
            value={value.objects_count}
            disabled={Boolean(fixedCount)}
            onChange={(e) => onChange({ objects_count: Number(e.target.value) || 1 })}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Byte Order">
          <Select
            value={value.byte_order || defaultByteOrder}
            onChange={(e) => onChange({ byte_order: e.target.value as OrderFlag })}
          >
            {ORDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Word Order">
          <Select
            value={value.word_order || defaultWordOrder}
            onChange={(e) => onChange({ word_order: e.target.value as OrderFlag })}
          >
            {ORDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </>
  );
}
