'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  COMPLETED_PERIODS, completedDayLabel, formatCompletedAt, formatPerth, inCompletedPeriod,
  type CompletedPeriod, type Task,
} from '@/lib/time-mgmt';

const QUADRANT_LABEL: Record<string, string> = { Q1: 'Do Now', Q2: 'Do Soon', Q3: 'Delegate', Q4: 'Delete' };

export function TimeCompletedPanel({ tasks, readOnly, onUncomplete }: { tasks: Task[]; readOnly?: boolean; onUncomplete?: (t: Task) => void }) {
  const [period, setPeriod] = useState<CompletedPeriod>('week');
  const [q, setQ] = useState('');
  const now = Date.now();

  const counts = useMemo(() => Object.fromEntries(COMPLETED_PERIODS.map(p => [p.id, tasks.filter(t => inCompletedPeriod(t, p.id, now)).length])) as Record<CompletedPeriod, number>, [tasks, now]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter(t => inCompletedPeriod(t, period, now) && (!s || (t.text || '').toLowerCase().includes(s)));
  }, [tasks, period, q, now]);
  const groups = useMemo(() => {
    const g: { label: string; items: Task[] }[] = [];
    for (const t of shown) {
      const label = completedDayLabel(t);
      const last = g[g.length - 1];
      if (last && last.label === label) last.items.push(t); else g.push({ label, items: [t] });
    }
    return g;
  }, [shown]);

  return (
    <Card className="print:hidden min-w-0">
      <CardHeader className="pb-3 space-y-2">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" /> Completed
        </CardTitle>
        <p className="text-xs text-slate-500">Today {counts.today} · This week {counts.week} · This month {counts.month}</p>
        <div className="flex flex-wrap gap-1.5">
          {COMPLETED_PERIODS.map(p => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)} aria-pressed={period === p.id}
              className={cn('text-xs font-semibold rounded-full border px-3 py-1', period === p.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 hover:bg-slate-50')}>
              {p.label} ({counts[p.id]})
            </button>
          ))}
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search completed tasks" className="pl-9 pr-10 h-9"
            onKeyDown={e => { if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); } }} />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No completed tasks {period === 'all' ? 'yet' : 'in this period'}.</p>
        ) : groups.map(g => (
          <div key={g.label} className="space-y-2 min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{g.label} ({g.items.length})</h4>
            <div className="grid grid-cols-1 gap-2">
              {g.items.map(t => {
                const quad = t.completedFromQuadrant ?? t.quadrant;
                return (
                  <div key={t.id} className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm text-slate-700 line-through decoration-slate-400 break-words">{t.text}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span>{quad ? QUADRANT_LABEL[quad] || quad : 'Inbox'}</span>
                        {t.dueAt ? <span>Due {formatPerth(t.dueAt)}</span> : null}
                        <span>{t.completedAt ? `Completed ${formatCompletedAt(t.completedAt)}` : 'Completed (date unknown)'}</span>
                      </div>
                    </div>
                    {!readOnly && onUncomplete && (
                      <button type="button" onClick={() => onUncomplete(t)} title="Mark not done (restore)" aria-label={`Restore ${t.text}`}
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
