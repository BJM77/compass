"use client";

import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommitmentOutcome, NwaDueState, NwaSectionDef } from '@/lib/nwa';
import { NWA_DUE_LABEL } from '@/lib/nwa';

/** Suggested time for an agenda item. */
export function TimeChip({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-info-soft px-2.5 py-1 text-xs font-semibold text-info', className)}>
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {minutes} min
    </span>
  );
}

export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">{children}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Numbered agenda card with title, description and time chip. */
export function SectionCard({
  section, complete, children, actions, id,
}: { section: NwaSectionDef; complete?: boolean; children: React.ReactNode; actions?: React.ReactNode; id?: string }) {
  return (
    <section id={id ?? `nwa-${section.id}`} className="scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            complete ? 'bg-success-soft text-success-ink' : 'bg-primary text-primary-foreground',
          )}>
            {complete ? <CheckCircle2 className="h-4 w-4" aria-label="Complete" /> : section.step}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <TimeChip minutes={section.minutes} />
        </div>
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

export function SubHeading({ children, hint, right }: { children: React.ReactNode; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{children}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-3 text-sm text-muted-foreground">{children}</p>;
}

const DUE_STYLES: Record<NwaDueState, { label: string; cls: string }> = {
  submitted: { label: 'Submitted', cls: 'bg-success-soft text-success-ink' },
  open: { label: NWA_DUE_LABEL, cls: 'bg-surface-2 text-foreground' },
  due_soon: { label: NWA_DUE_LABEL, cls: 'bg-warning-soft text-warning-ink' },
  overdue: { label: 'Overdue', cls: 'bg-danger-soft text-destructive' },
};

export function DueChip({ state, className }: { state: NwaDueState; className?: string }) {
  const s = DUE_STYLES[state];
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', s.cls, className)}>{s.label}</span>;
}

export function scoreTone(score: number | null): string {
  if (score === null) return 'bg-surface-2 text-muted-foreground';
  if (score >= 80) return 'bg-success-soft text-success-ink';
  if (score >= 50) return 'bg-warning-soft text-warning-ink';
  return 'bg-danger-soft text-destructive';
}

export function ScoreChip({ score, label = 'Follow-through', className }: { score: number | null; label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', scoreTone(score), className)}>
      {label} {score === null ? '–' : `${score}%`}
    </span>
  );
}

/** Small bar chart of follow-through scores over recent weeks. */
export function FollowThroughBars({ points, large }: { points: { week: string; score: number }[]; large?: boolean }) {
  if (!points.length) return <p className="text-xs text-muted-foreground">No history yet</p>;
  return (
    <div className={cn('flex items-end gap-1.5', large ? 'h-20' : 'h-10')} role="img" aria-label={`Follow-through over ${points.length} weeks`}>
      {points.map(p => (
        <div key={p.week} className="flex flex-col items-center gap-1" title={`Week ${p.week.split('-')[1]}: ${p.score}%`}>
          <div
            className={cn('w-4 rounded-t', p.score >= 80 ? 'bg-success-fill' : p.score >= 50 ? 'bg-warning' : 'bg-destructive', large && 'w-6')}
            style={{ height: `${Math.max(6, p.score) * (large ? 0.6 : 0.3)}px` }}
          />
          {large && <span className="text-xs text-muted-foreground">W{p.week.split('-')[1]}</span>}
        </div>
      ))}
    </div>
  );
}

const OUTCOME_OPTIONS: { value: CommitmentOutcome; label: string; on: string }[] = [
  { value: 'done', label: 'Done', on: 'bg-success-fill text-success-foreground border-success-fill' },
  { value: 'partly', label: 'Partly', on: 'bg-warning text-warning-foreground border-warning' },
  { value: 'not_done', label: 'Not done', on: 'bg-destructive text-destructive-foreground border-destructive' },
];

export function OutcomeToggle({ value, onChange, disabled }: { value: CommitmentOutcome | null; onChange: (v: CommitmentOutcome | null) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border">
      {OUTCOME_OPTIONS.map(o => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? null : o.value)}
            className={cn(
              'border-l border-border px-3 py-1.5 text-xs font-semibold transition-colors first:border-l-0 disabled:cursor-not-allowed disabled:opacity-60',
              active ? o.on : 'bg-card text-muted-foreground hover:bg-surface-2',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OutcomeBadge({ value }: { value: CommitmentOutcome | null }) {
  const o = OUTCOME_OPTIONS.find(x => x.value === value);
  if (!o) return <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Circle className="h-3 w-3" />Not reviewed</span>;
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', o.on)}>{o.label}</span>;
}

export function StatTile({ label, value, sub, tone = 'default' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneCls = tone === 'good' ? 'text-success-ink' : tone === 'warn' ? 'text-warning-ink' : tone === 'bad' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', toneCls)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
