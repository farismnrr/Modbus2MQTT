import type { ReactNode } from 'react';
import { Label } from '@/components/ui';
import { cn } from '@/lib';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
