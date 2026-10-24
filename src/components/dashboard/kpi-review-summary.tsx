'use client';

import { readKpiReview } from '@/lib/kpi-review';
import { cn } from '@/lib/utils';

const fmt = (n: number, money: boolean) =>
  money ? `$${Math.round(n).toLocaleString('en-AU')}` : String(Math.round(n * 10) / 10);

/** TWTW KPI review: actual vs target per metric, plus the rep's KPI notes. Renders nothing when empty. */
export function KpiReviewSummary({ kpiReview, className, title = 'KPI review' }: { kpiReview: any; className?: string; title?: string }) {
  const view = readKpiReview(kpiReview);
  if (!view.hasData) return null;
  return (
    <div className={cn('rounded-xl border border-border bg-card p-3 space-y-2', className)}>
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {view.rows.map(r => {
          const hit = r.target > 0 && r.actual >= r.target;
          const miss = r.target > 0 && r.actual < r.target;
          return (
            <div key={r.key} className="rounded-lg bg-secondary/50 px-2 py-1.5">
              <div className="text-[11px] text-muted-foreground">{r.label}</div>
              <div className="text-sm font-semibold">
                <span className={cn(hit && 'text-success-ink', miss && 'text-destructive')}>{fmt(r.actual, r.money)}</span>
                <span className="text-muted-foreground font-normal"> / {r.target > 0 ? fmt(r.target, r.money) : '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
      {view.notes && <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{view.notes}</p>}
    </div>
  );
}
