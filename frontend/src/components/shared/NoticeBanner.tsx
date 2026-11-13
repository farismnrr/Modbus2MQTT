import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { NoticeState } from '@/hooks';
import { cn } from '@/lib';

interface NoticeBannerProps {
  notice: NoticeState | null;
  onDismiss?: () => void;
  className?: string;
}

export function NoticeBanner({ notice, onDismiss, className }: NoticeBannerProps) {
  if (!notice) return null;
  const Icon = notice.ok ? CheckCircle2 : AlertCircle;

  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs',
        notice.ok
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono break-all">{notice.text}</span>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}
