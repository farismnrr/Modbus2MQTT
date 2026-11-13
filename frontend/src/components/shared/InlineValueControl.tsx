import { useState } from 'react';
import { Check, Play } from 'lucide-react';
import { Button, Input, Switch } from '@/components/ui';
import { parseModbusInputValue } from '@/lib';
import type { ModbusDataType } from '@/types';

interface InlineValueControlProps {
  value: unknown;
  unit?: string;
  writable?: boolean;
  isRpc?: boolean;
  dataType: ModbusDataType;
  defaultInput?: string;
  onCommit: (nextValue: unknown) => void;
}

export function InlineValueControl({
  value,
  unit,
  writable = false,
  isRpc = false,
  dataType,
  defaultInput = 'true',
  onCommit,
}: InlineValueControlProps) {
  const initialDraft = isRpc ? defaultInput : value !== undefined ? String(value) : '';
  const [draft, setDraft] = useState<string | null>(null);
  const effectiveDraft = draft ?? initialDraft;

  if (!writable && !isRpc) {
    return (
      <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
        {value !== undefined ? String(value) : '—'}
        {unit ? <span className="ml-1 font-normal text-muted-foreground">{unit}</span> : null}
      </div>
    );
  }

  if (!isRpc && dataType === 'bool') {
    return <Switch checked={Boolean(value)} onCheckedChange={(checked) => onCommit(checked)} />;
  }

  const submit = () => {
    const parsed = parseModbusInputValue(effectiveDraft, isRpc ? undefined : dataType);
    onCommit(parsed);
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Input
        className="h-7 w-22 font-mono text-xs tabular-nums"
        value={effectiveDraft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button size={isRpc ? 'sm' : 'icon-sm'} variant="outline" onClick={submit} title={isRpc ? 'Run RPC' : 'Set value'}>
        {isRpc ? (
          <>
            <Play className="w-3 h-3 text-primary" />
            Run
          </>
        ) : (
          <Check className="w-3.5 h-3.5 text-primary" />
        )}
      </Button>
    </div>
  );
}
