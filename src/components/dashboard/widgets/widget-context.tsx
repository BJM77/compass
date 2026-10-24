"use client";

import React, { createContext, useContext } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigation } from '@/contexts/navigation-context';
import type { DashboardView } from '@/lib/navigation';
import type { Audience } from '@/lib/dashboard-layout';
import { cn } from '@/lib/utils';

/** Everything a dashboard widget needs to know about who/what it is rendering for. */
export interface WidgetContextValue {
  /** The user whose data is shown (the simulated user when a leader is simulating). */
  userId: string;
  userName: string;
  role: string;
  territory?: string;
  audience: Audience;
  /** Designer preview: links are inert. */
  preview?: boolean;
  /** Host-provided replacements, e.g. the Leader dashboard's team KPI row for 'kpi-pipeline'. */
  overrides?: Partial<Record<string, React.ReactNode>>;
}

const Ctx = createContext<WidgetContextValue | null>(null);
export const WidgetContextProvider = Ctx.Provider;

export function useWidgetContext(): WidgetContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWidgetContext must be used inside a dashboard widget grid');
  return v;
}

/** Small "Open X →" link used at the foot of a widget. Inert in the designer preview. */
export function WidgetLink({ view, children, className }: { view: DashboardView; children: React.ReactNode; className?: string }) {
  const { navigateTo } = useNavigation();
  const { preview } = useWidgetContext();
  return (
    <button
      type="button"
      onClick={() => { if (!preview) navigateTo(view); }}
      className={cn('text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1', className)}
    >
      {children} <ArrowRight className="w-3 h-3" />
    </button>
  );
}

/** Compact stat tile. */
export function Stat({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneCls = tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'bad' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-xl bg-muted border border-border px-3 py-2 min-w-0">
      <div className={cn('text-xl font-black leading-none tabular-nums', toneCls)}>{value}</div>
      <div className="mt-1 text-xs font-semibold text-muted-foreground truncate">{label}</div>
    </div>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}
