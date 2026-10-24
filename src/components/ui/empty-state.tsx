import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Compact variant for use inside cards and table bodies. */
  compact?: boolean;
  className?: string;
}

/** Friendly placeholder for lists, tables and charts with no data yet. */
export function EmptyState({ title, description, icon, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-card text-muted-foreground shadow-card',
          compact ? 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5' : 'h-12 w-12 [&_svg]:h-6 [&_svg]:w-6',
        )}
      >
        {icon ?? <Inbox />}
      </span>
      <div className="space-y-1">
        <p className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
