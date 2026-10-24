"use client";

import React from 'react';
import {
  HANDOVER_STATUS_LABEL, RENEWAL_STATUS_LABEL, RENEWAL_TYPE_LABEL, RISK_STATUS_LABEL,
  isLegacyFridayDoc, kpiDefsFor, mapStoredNwa, followThroughScore, totalRevenueAtRisk,
} from '@/lib/nwa';
import { cn } from '@/lib/utils';
import { LegacyFridaySummary } from './nwa-legacy';
import { OutcomeBadge, ScoreChip } from './nwa-ui';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </div>
  );
}

const money = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;
const sumValue = (rows: { value: number }[]) => rows.reduce((t, r) => t + (Number(r.value) || 0), 0);

/**
 * Compact read-only NWA summary for the weekly archive. V1/V2 NWA docs use the NWA layout;
 * pre-NWA Friday FW docs keep their original fields via LegacyFridaySummary.
 */
export function NwaArchiveSummary({ data, role = 'BDM' }: { data: any; role?: string }) {
  if (!data) return null;
  if (isLegacyFridayDoc(data)) return <LegacyFridaySummary data={{ ...data, managerNote: data.managerNote || data.gmFeedback }} compact />;

  const kpiRole = data.kpiRole || role;
  const p = mapStoredNwa(data, kpiRole);
  const review = (p.commitmentReview || []).filter(r => r.text.trim());
  const ft = data.followThrough?.score !== undefined ? data.followThrough : followThroughScore(review);
  const wins = [p.wins.customerWins, p.wins.closedOpportunities, p.wins.positiveFeedback, p.wins.teamRecognition].filter(w => w.trim());
  const priorities = p.topPriorities.filter(t => t.trim());
  const challenges = [
    ['Slowing progress', p.challenges.slowingProgress], ['Customer', p.challenges.customerIssues],
    ['Internal', p.challenges.internalIssues], ['Resources', p.challenges.resourcesRequired],
  ].filter(([, v]) => v.trim());
  const commitments = p.commitments.filter(c => c.text.trim());
  const stalled = p.pipeline.stalled.filter(r => r.account.trim());
  const progressing = p.pipeline.progressing.filter(r => r.account.trim());
  const created = p.pipeline.created.filter(r => r.account.trim());
  const acc = p.accounts;
  const atRiskOpen = acc.atRisk.filter(r => r.account.trim());
  const revenueAtRisk = typeof data.revenueAtRisk === 'number' ? data.revenueAtRisk : totalRevenueAtRisk(acc);
  const renewals = acc.renewals.filter(r => r.account.trim());
  const growth = acc.growth.filter(r => r.account.trim());
  const handovers = acc.handovers.filter(h => h.account.trim());
  const kpiActuals: Record<string, number> | null = data.kpiActuals && typeof data.kpiActuals === 'object' ? data.kpiActuals : null;
  const kpis = kpiDefsFor(kpiRole).filter(k => (p.kpiTargets[k.target] || 0) > 0 || (kpiActuals && Number(kpiActuals[k.key]) > 0));

  return (
    <div className="space-y-4 text-sm">
      {wins.length > 0 && <Block title="Wins"><p className="whitespace-pre-wrap text-muted-foreground">{wins.join('\n')}</p></Block>}
      {p.wins.shoutOut.teammate && <p className="rounded-lg bg-gold/10 px-3 py-2 text-foreground">Shout-out: <span className="font-semibold">{p.wins.shoutOut.teammate}</span>{p.wins.shoutOut.reason && ` · ${p.wins.shoutOut.reason}`}</p>}
      {priorities.length > 0 && (
        <Block title="Top 3 priorities">
          <ol className="list-decimal space-y-0.5 pl-5 text-foreground">{priorities.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </Block>
      )}
      {(progressing.length + created.length + stalled.length) > 0 && (
        <Block title="Pipeline">
          <ul className="space-y-0.5 text-muted-foreground">
            {progressing.length > 0 && <li><span className="font-medium text-foreground">Progressing:</span> {progressing.length} · {money(sumValue(progressing))}</li>}
            {created.length > 0 && <li><span className="font-medium text-foreground">New opportunities:</span> {created.length} · {money(sumValue(created))}</li>}
            {stalled.length > 0 && <li><span className="font-medium text-foreground">Stalled:</span> {stalled.length} · {money(sumValue(stalled))}</li>}
          </ul>
        </Block>
      )}
      {kpis.length > 0 && (
        <Block title={kpiActuals ? 'KPIs: last week actual vs this week’s target' : 'KPI targets'}>
          <table className="w-full text-sm">
            <tbody>
              {kpis.map(k => {
                const t = p.kpiTargets[k.target] || 0;
                const a = kpiActuals ? Number(kpiActuals[k.key]) || 0 : null;
                const pct = a !== null && t > 0 ? Math.round((a / t) * 100) : null;
                return (
                  <tr key={k.key} className="border-b border-border last:border-0">
                    <td className="py-1 pr-2 text-foreground">{k.label}</td>
                    {a !== null && <td className="py-1 pr-2 text-right tabular-nums">{k.currency ? money(a) : a}</td>}
                    <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{t ? (k.currency ? money(t) : t) : '–'}</td>
                    {a !== null && <td className={cn('py-1 text-right text-xs font-semibold tabular-nums', pct === null ? 'text-muted-foreground' : pct >= 100 ? 'text-success-ink' : pct >= 70 ? 'text-warning-ink' : 'text-destructive')}>{pct === null ? '–' : `${pct}%`}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Block>
      )}
      {(atRiskOpen.length > 0 || revenueAtRisk > 0) && (
        <Block title={`At-risk accounts · ${money(revenueAtRisk)} at risk`}>
          <ul className="space-y-0.5 text-muted-foreground">{atRiskOpen.map(r => (
            <li key={r.id}><span className="text-foreground">{r.account}</span> · {money(r.revenueAtRisk)} · {RISK_STATUS_LABEL[r.status]}{(r.reason || r.action) && ` · ${[r.reason, r.action].filter(Boolean).join(' → ')}`}</li>
          ))}</ul>
        </Block>
      )}
      {renewals.length > 0 && (
        <Block title="Renewals and rate reviews">
          <ul className="space-y-0.5 text-muted-foreground">{renewals.map(r => (
            <li key={r.id}><span className="text-foreground">{r.account}</span> · {RENEWAL_TYPE_LABEL[r.type]} · {RENEWAL_STATUS_LABEL[r.status]}{r.value > 0 && ` · ${money(r.value)}`}{r.dueDate && ` · due ${r.dueDate}`}</li>
          ))}</ul>
        </Block>
      )}
      {growth.length > 0 && (
        <Block title="Growth in existing accounts">
          <ul className="space-y-0.5 text-muted-foreground">{growth.map(r => (
            <li key={r.id}><span className="text-foreground">{r.account}</span>{r.opportunity && ` · ${r.opportunity}`}{r.value > 0 && ` · ${money(r.value)}`}</li>
          ))}</ul>
        </Block>
      )}
      {handovers.length > 0 && (
        <Block title="Handovers">
          <ul className="space-y-0.5 text-muted-foreground">{handovers.map(h => (
            <li key={h.id}><span className="text-foreground">{h.account}</span> · {h.fromName || '?'} → {h.toName || '?'} · {HANDOVER_STATUS_LABEL[h.status]}</li>
          ))}</ul>
        </Block>
      )}
      {stalled.length > 0 && (
        <Block title="Stalled deals">
          <ul className="space-y-0.5 text-muted-foreground">{stalled.map(r => <li key={r.id}><span className="text-foreground">{r.account}</span>{r.note && ` · ${r.note}`}</li>)}</ul>
        </Block>
      )}
      {challenges.length > 0 && (
        <Block title="Challenges">
          <ul className="space-y-0.5 text-muted-foreground">{challenges.map(([l, v]) => <li key={l}><span className="font-medium text-foreground">{l}:</span> {v}</li>)}</ul>
        </Block>
      )}
      {commitments.length > 0 && (
        <Block title="Commitments">
          <ul className="space-y-0.5 text-foreground">{commitments.map(c => <li key={c.id}>{c.text}{(c.owner || c.dueDate) && <span className="text-muted-foreground"> · {[c.owner, c.dueDate].filter(Boolean).join(' · ')}</span>}</li>)}</ul>
        </Block>
      )}
      {review.length > 0 && (
        <Block title="Last week’s commitments">
          <div className="mb-1"><ScoreChip score={ft.score ?? null} /></div>
          <ul className="space-y-1">{review.map(r => <li key={r.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{r.text}</span><OutcomeBadge value={r.outcome} /></li>)}</ul>
        </Block>
      )}
      {(data.managerNote || data.adminCoachingNotes || data.gmFeedback) && (
        <div className="rounded-lg bg-surface-2/60 px-3 py-2">
          <h4 className="text-sm font-semibold text-foreground">Manager note</h4>
          <p className="whitespace-pre-wrap text-muted-foreground">{data.managerNote || data.adminCoachingNotes || data.gmFeedback}</p>
        </div>
      )}
    </div>
  );
}
