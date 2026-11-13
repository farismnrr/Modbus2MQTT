import { Badge } from '@/components/ui';
import { cn } from '@/lib';

interface StatusBadgeProps {
  status: 'online' | 'offline';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const online = status === 'online';
  return (
    <Badge variant={online ? 'success' : 'destructive'} className={className}>
      <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-red-500')} />
      {status}
    </Badge>
  );
}
