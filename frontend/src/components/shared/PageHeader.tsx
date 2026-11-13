import type { ReactNode } from 'react';
import { cn } from '@/lib';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, leading, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {leading}
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
            {title}
          </h1>
          {description ? <p className="text-xs text-muted-foreground truncate">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
