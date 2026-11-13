import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { LogMessage } from '../types';

interface LogsPageProps {
  logs: LogMessage[];
  onClearLogs: () => void;
}

export function LogsPage({ logs, onClearLogs }: LogsPageProps) {
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = logs.filter((entry) => {
    if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
    if (search.trim() && !entry.message.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const badgeClass = (level: LogMessage['level']) => {
    switch (level) {
      case 'error':
        return 'badge-error';
      case 'warning':
        return 'badge-warning';
      case 'debug':
        return 'badge-ghost';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-base-100 p-4 rounded-xl border border-base-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Bridge Logs</h1>
          <p className="text-xs text-base-content/70">
            Real-time stream mirrored from <code className="font-mono">bridge/logging</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select select-sm select-bordered"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <input
            className="input input-sm input-bordered w-44"
            placeholder="Filter text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="btn btn-sm btn-ghost gap-1" onClick={onClearLogs}>
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl border border-base-300 shadow-xs p-3 font-mono text-xs max-h-[68vh] overflow-y-auto space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-base-content/60">No log entries matching filter.</div>
        ) : (
          filtered.map((entry, idx) => (
            <div key={`${entry.timestamp}-${idx}`} className="flex items-start gap-2 leading-relaxed">
              <span className="text-base-content/50 shrink-0 tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className={`badge badge-xs uppercase shrink-0 mt-0.5 ${badgeClass(entry.level)}`}>
                {entry.level}
              </span>
              <span className="break-all">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
