import { useState } from 'react';
import { ScrollText, Search, Trash2 } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/shared';
import { Badge, Button, Card, Input, Select } from '@/components/ui';
import type { LogMessage } from '@/types';

interface LogsPageProps {
  logs: LogMessage[];
  onClearLogs: () => void;
}

const LEVEL_VARIANT: Record<LogMessage['level'], 'destructive' | 'warning' | 'outline' | 'secondary'> = {
  error: 'destructive',
  warning: 'warning',
  debug: 'outline',
  info: 'secondary',
};

export function LogsPage({ logs, onClearLogs }: LogsPageProps) {
  const [levelFilter, setLevelFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = logs.filter((entry) => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
    if (search.trim() && !entry.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bridge Logs"
        description={
          <>
            Live runtime stream from <code className="font-mono">bridge/logging</code>.
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-28">
              <Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                <option value="all">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </Select>
            </div>
            <div className="relative w-44">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Filter text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={onClearLogs}>
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No log entries"
          description="Runtime bridge events and Modbus diagnostics will appear here automatically."
        />
      ) : (
        <Card className="p-3 font-mono text-xs max-h-[68vh] overflow-y-auto space-y-1.5">
          {filtered.map((entry, idx) => (
            <div key={`${entry.timestamp}-${idx}`} className="flex items-start gap-2 leading-relaxed">
              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums pt-0.5">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <Badge variant={LEVEL_VARIANT[entry.level]} className="uppercase text-[10px] shrink-0">
                {entry.level}
              </Badge>
              <span className="break-all text-foreground">{entry.message}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
