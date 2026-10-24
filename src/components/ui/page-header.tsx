import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small section tag shown above the title, e.g. "Leadership". */
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  /** Buttons, filters or other controls shown on the right. */
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent page heading: optional icon + eyebrow, title, description and right-aligned actions. */
export function PageHeader({ title, description, eyebrow, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-accent [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </span>
        )}
        <div className="min-w-0 space-y-1">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>}
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
