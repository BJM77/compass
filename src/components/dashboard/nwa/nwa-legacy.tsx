"use client";

import React from 'react';
import { Archive } from 'lucide-react';

/**
 * Read-only view of a pre-NWA Friday FW submission (focus accounts, strategic focus, action plan…).
 * Old data is never rewritten; it is shown as it was captured.
 */
export function LegacyFridaySummary({ data, compact }: { data: any; compact?: boolean }) {
  if (!data) return null;
  const accounts: any[] = Array.isArray(data.focusAccounts) ? data.focusAccounts : [];
  const actions: string[] = (Array.isArray(data.actionPlan) ? data.actionPlan : [])
    .map((a: any) => (typeof a === 'string' ? a : a?.text || ''))
    .filter((a: string) => a.trim());
  const kpi = data.kpiTargets || {};
  const kpiRows = [
    ['Calls', kpi.callsToMake], ['Appointments', kpi.appointmentsToSet], ['Proposals', kpi.proposalsToSend],
    ['Deals', kpi.dealsToClose], ['Revenue', kpi.revenueTarget ? `$${Number(kpi.revenueTarget).toLocaleString('en-AU')}` : undefined],
  ].filter(([, v]) => v !== undefined && v !== '' && v !== 0);

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"><Archive className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Friday FW submission (previous format)</h2>
            <p className="text-sm text-muted-foreground">Submitted before the Monday NWA form. Shown read-only as it was captured.</p>
          </div>
        </div>
      )}
      {data.strategicFocus && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Strategic focus</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{data.strategicFocus}</p>
        </div>
      )}
      {accounts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Focus accounts</h3>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {accounts.map((a, i) => (
              <li key={a.id || i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{a.accountName || 'Account'}</span>
                <span className="text-muted-foreground">{[a.actionType, a.eav ? `$${Number(a.eav).toLocaleString('en-AU')}` : ''].filter(Boolean).join(' · ')}</span>
                {a.aboutAccount && <span className="w-full text-xs text-muted-foreground">{a.aboutAccount}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {kpiRows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">KPI targets</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {kpiRows.map(([l, v]) => <span key={String(l)} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-foreground">{l}: {String(v)}</span>)}
          </div>
        </div>
      )}
      {actions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Action plan</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">{actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </div>
      )}
      {(data.roadblocks || data.supportNeeded) && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.roadblocks && <div><h3 className="text-sm font-semibold text-foreground">Roadblocks</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{data.roadblocks}</p></div>}
          {data.supportNeeded && <div><h3 className="text-sm font-semibold text-foreground">Support needed</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{data.supportNeeded}</p></div>}
        </div>
      )}
      {(data.adminCoachingNotes || data.managerNote) && (
        <div className="rounded-xl bg-surface-2/50 p-4">
          <h3 className="text-sm font-semibold text-foreground">Manager note</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{data.managerNote || data.adminCoachingNotes}</p>
        </div>
      )}
    </section>
  );
}
