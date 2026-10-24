"use client";

import React, { useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { Eye, EyeOff, History } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useTeamUsers } from '@/hooks/use-team-users';
import { cn } from '@/lib/utils';
import { type NwaColor } from '@/lib/nwa-colors';
import { buildTeamMembers, memberHasContent, type TeamMemberNwa } from '@/lib/nwa-team';
import {
  HANDOVER_STATUS_LABEL, NWA_MEETING_MINUTES, NWA_SECTIONS_AM, PIPELINE_GROUPS, RENEWAL_STATUS_LABEL, RENEWAL_TYPE_LABEL, RISK_STATUS_LABEL,
  type NwaSectionDef, type NwaSectionId,
  isAmRole, isSubmittedStatus, kpiDefsFor, nwaDueState, sectionComplete,
} from '@/lib/nwa';
import { AgendaBar, EmptyHint, NWA_SCROLL_MT, OutcomeBadge, SectionCard, type AgendaItem } from './nwa-ui';

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;
const weekNo = (w: string) => w.split('-')[1] || w;
const has = (s: string | undefined | null) => !!(s && s.trim());

/** Every section, for both BDMs and account managers (the AM list is the BDM list plus account health). */
const TEAM_SECTIONS: NwaSectionDef[] = NWA_SECTIONS_AM;
const anchor = (id: string) => `nwa-team-${id}`;

/** Status label for the legend. */
function statusInfo(m: TeamMemberNwa, planWeek: string): { label: string; cls: string } {
  if (m.legacy) return { label: 'Old Friday FW', cls: 'bg-surface-2 text-muted-foreground' };
  if (isSubmittedStatus(m.status)) return { label: 'Submitted', cls: 'bg-success-soft text-success-ink' };
  const due = nwaDueState(planWeek, m.status);
  if (due === 'overdue') return { label: m.status === 'DRAFT' ? 'Draft · overdue' : 'Overdue', cls: 'bg-danger-soft text-destructive' };
  if (m.status === 'DRAFT') return { label: 'Draft', cls: 'bg-warning-soft text-warning-ink' };
  return { label: 'Not started', cls: 'bg-surface-2 text-muted-foreground' };
}

export function PersonChip({ name, color, className }: { name: string; color: NwaColor; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ backgroundColor: color.tint, color: color.ink }}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color.strip }} aria-hidden />
      {name}
    </span>
  );
}

/** One person's block inside a section: coloured left strip plus a name chip. */
function PersonRow({ m, children }: { m: TeamMemberNwa; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border border-l-4 bg-card px-4 py-3" style={{ borderLeftColor: m.color.strip }} data-person={m.user.id}>
      <div className="mb-2"><PersonChip name={m.user.name} color={m.color} /></div>
      <div className="space-y-2 text-sm text-foreground">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!has(value)) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <li className="rounded-lg bg-surface-2/40 px-3 py-2">{children}</li>;
}

function Meta({ parts }: { parts: (string | false | null | undefined)[] }) {
  const p = parts.filter(Boolean) as string[];
  return p.length ? <span className="text-xs text-muted-foreground"> · {p.join(' · ')}</span> : null;
}

function SectionBody({ m, id, reviewWeek, planWeek }: { m: TeamMemberNwa; id: NwaSectionId | 'review'; reviewWeek: string; planWeek: string }) {
  const p = m.plan;
  switch (id) {
    case 'review':
      return (
        <ul className="space-y-1.5">
          {p.commitmentReview.map(c => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2/40 px-3 py-2">
              <span className="min-w-0">{c.text}<Meta parts={[c.owner, c.dueDate && `due ${c.dueDate}`, c.note]} /></span>
              <OutcomeBadge value={c.outcome} />
            </li>
          ))}
        </ul>
      );
    case 'wins':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Customer wins" value={p.wins.customerWins} />
          <Field label="Closed opportunities" value={p.wins.closedOpportunities} />
          <Field label="Positive feedback" value={p.wins.positiveFeedback} />
          <Field label="Team recognition" value={p.wins.teamRecognition} />
          {has(p.wins.shoutOut.teammate) && <Field label="Shout-out" value={`${p.wins.shoutOut.teammate}${has(p.wins.shoutOut.reason) ? `: ${p.wins.shoutOut.reason}` : ''}`} />}
        </div>
      );
    case 'appointments':
      return (
        <ul className="space-y-1.5">
          {p.appointments.filter(a => has(a.customer)).map(a => (
            <Line key={a.id}>
              <span className="font-medium">{a.customer}</span><Meta parts={[a.date, a.meetingType]} />
              {[['Why', a.purpose], ['Outcome', a.desiredOutcome], ['Support', a.supportRequired]].filter(([, v]) => has(v)).map(([k, v]) => (
                <p key={k} className="text-xs text-muted-foreground"><span className="font-semibold">{k}:</span> {v}</p>
              ))}
            </Line>
          ))}
        </ul>
      );
    case 'pipeline':
      return (
        <div className="space-y-3">
          {PIPELINE_GROUPS.filter(g => g.key !== 'handedOver').map(g => {
            const rows = p.pipeline[g.key].filter(r => has(r.account));
            if (!rows.length) return null;
            return (
              <div key={g.key}>
                <p className="text-xs font-semibold text-muted-foreground">{g.title}</p>
                <ul className="mt-1 space-y-1.5">
                  {rows.map(r => (
                    <Line key={r.id}>
                      <span className="font-medium">{r.account}</span>
                      <Meta parts={[r.value > 0 && money(r.value), r.nextStep && `next: ${r.nextStep}`, r.nextStepDate, typeof r.daysWithoutMovement === 'number' && `${r.daysWithoutMovement} days without movement`]} />
                      {has(r.note) && <p className="text-xs text-muted-foreground">{r.note}</p>}
                    </Line>
                  ))}
                </ul>
              </div>
            );
          })}
          {p.accounts.handovers.some(h => has(h.account)) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Accounts handed over</p>
              <ul className="mt-1 space-y-1.5">
                {p.accounts.handovers.filter(h => has(h.account)).map(h => (
                  <Line key={h.id}>
                    <span className="font-medium">{h.account}</span>
                    <Meta parts={[[h.fromName, h.toName].filter(Boolean).join(' → '), HANDOVER_STATUS_LABEL[h.status], h.date, h.reason]} />
                  </Line>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case 'accounts':
      return (
        <div className="space-y-3">
          {p.accounts.atRisk.some(r => has(r.account)) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">At risk</p>
              <ul className="mt-1 space-y-1.5">
                {p.accounts.atRisk.filter(r => has(r.account)).map(r => (
                  <Line key={r.id}>
                    <span className="font-medium">{r.account}</span>
                    <Meta parts={[r.revenueAtRisk > 0 && `${money(r.revenueAtRisk)} at risk`, RISK_STATUS_LABEL[r.status], r.reason, r.action && `action: ${r.action}`]} />
                  </Line>
                ))}
              </ul>
            </div>
          )}
          {p.accounts.renewals.some(r => has(r.account)) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Renewals and rate reviews</p>
              <ul className="mt-1 space-y-1.5">
                {p.accounts.renewals.filter(r => has(r.account)).map(r => (
                  <Line key={r.id}>
                    <span className="font-medium">{r.account}</span>
                    <Meta parts={[RENEWAL_TYPE_LABEL[r.type], r.dueDate && `due ${r.dueDate}`, r.value > 0 && money(r.value), RENEWAL_STATUS_LABEL[r.status], r.note]} />
                  </Line>
                ))}
              </ul>
            </div>
          )}
          {p.accounts.growth.some(r => has(r.account)) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Growth</p>
              <ul className="mt-1 space-y-1.5">
                {p.accounts.growth.filter(r => has(r.account)).map(r => (
                  <Line key={r.id}>
                    <span className="font-medium">{r.account}</span>
                    <Meta parts={[r.opportunity, r.value > 0 && money(r.value), r.nextStep && `next: ${r.nextStep}`, r.nextStepDate]} />
                  </Line>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case 'kpis': {
      const defs = kpiDefsFor(m.user.role);
      const actuals: Record<string, number> | null = m.doc?.kpiActuals && typeof m.doc.kpiActuals === 'object' ? m.doc.kpiActuals : null;
      return (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Metric</th>
                  <th className="py-1.5 pr-3 font-medium">Week {weekNo(reviewWeek)} actual / target</th>
                  <th className="py-1.5 font-medium">Week {weekNo(planWeek)} target</th>
                </tr>
              </thead>
              <tbody>
                {defs.map(k => {
                  const a = actuals ? Number(actuals[k.key]) || 0 : null;
                  const t = m.prevPlan ? m.prevPlan.kpiTargets[k.target] || 0 : 0;
                  const next = p.kpiTargets[k.target] || 0;
                  const fmt = (n: number) => (k.currency ? money(n) : String(n));
                  return (
                    <tr key={k.key} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{k.label}</td>
                      <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{a === null ? '–' : fmt(a)} / {t ? fmt(t) : '–'}</td>
                      <td className="py-1.5 tabular-nums">{next ? fmt(next) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Field label="Key focus metrics" value={p.keyFocusMetrics} />
          <Field label="Individual commitment" value={p.individualCommitment} />
        </div>
      );
    }
    case 'priorities':
      return (
        <ol className="space-y-1.5">
          {p.topPriorities.map((t, i) => has(t) && (
            <li key={i} className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      );
    case 'challenges':
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="What’s slowing progress?" value={p.challenges.slowingProgress} />
          <Field label="Customer issues" value={p.challenges.customerIssues} />
          <Field label="Internal issues" value={p.challenges.internalIssues} />
          <Field label="Resources required" value={p.challenges.resourcesRequired} />
        </div>
      );
    case 'commitments':
      return (
        <ul className="space-y-1.5">
          {p.commitments.filter(c => has(c.text)).map(c => (
            <Line key={c.id}>{c.text}<Meta parts={[c.owner, c.dueDate && `due ${c.dueDate}`]} /></Line>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

/**
 * Leader-only, read-only view of the whole team's NWA for one plan week. Each person's items
 * carry their colour (left strip + name chip); the legend toggles people on and off.
 * Business updates are team-wide, so they are shown once (passed in by the NWA form).
 */
export function NwaTeamOverview({
  planWeek, reviewWeek, excludeUserId, businessUpdates, businessUpdatesComplete,
}: {
  planWeek: string;
  reviewWeek: string;
  excludeUserId?: string;
  businessUpdates: React.ReactNode;
  businessUpdatesComplete?: boolean;
}) {
  const db = useFirestore();
  const { isLeader } = useAuth();
  const { teamUsers, isLoading: usersLoading } = useTeamUsers();
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Rules: leaders (isAdmin) may read every weeklyCommitments doc. The view is only rendered for leaders.
  const q = useMemoFirebase(
    () => (db && isLeader ? query(collection(db, 'weeklyCommitments'), where('week', 'in', [planWeek, reviewWeek])) : null),
    [db, isLeader, planWeek, reviewWeek],
  );
  const { data: docs, isLoading: docsLoading } = useCollection<any>(q);

  const users = useMemo(() => teamUsers.filter(u => u.id !== excludeUserId), [teamUsers, excludeUserId]);
  const members = useMemo(() => buildTeamMembers(users, docs || [], planWeek, reviewWeek), [users, docs, planWeek, reviewWeek]);
  const visible = members.filter(m => !hidden.has(m.user.id));
  const submittedCount = members.filter(m => isSubmittedStatus(m.status)).length;

  const toggle = (id: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const sectionDone = (id: NwaSectionId): boolean => {
    if (id === 'updates') return !!businessUpdatesComplete;
    const relevant = visible.filter(m => id !== 'accounts' || isAmRole(m.user.role));
    return relevant.length > 0 && relevant.every(m => !m.legacy && sectionComplete(m.plan, id, m.user.role));
  };

  const agenda: AgendaItem[] = [
    { anchorId: anchor('review'), title: 'Last week’s commitments' },
    ...TEAM_SECTIONS.map(s => ({ anchorId: anchor(s.id), step: s.step, title: s.title, minutes: s.minutes, complete: sectionDone(s.id) })),
  ];

  if (!isLeader) return <EmptyHint>The whole-team view is available to leaders.</EmptyHint>;
  if (usersLoading || docsLoading) {
    return <div className="space-y-4">{[0, 1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2/60" />)}</div>;
  }
  if (!members.length) return <EmptyHint>No BDMs or account managers found for the team.</EmptyHint>;

  const renderPeople = (id: NwaSectionId | 'review', emptyText: string) => {
    const withContent = visible.filter(m => memberHasContent(m, id) && (id !== 'accounts' || isAmRole(m.user.role) || memberHasContent(m, 'accounts')));
    if (!withContent.length) return <EmptyHint>{emptyText}</EmptyHint>;
    return (
      <div className="space-y-3">
        {withContent.map(m => (
          <PersonRow key={m.user.id} m={m}><SectionBody m={m} id={id} reviewWeek={reviewWeek} planWeek={planWeek} /></PersonRow>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Legend: tap a person to show or hide their items */}
      <section aria-label="Team legend" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Whole team · week {weekNo(planWeek)}</h2>
            <p className="text-sm text-muted-foreground">{submittedCount} of {members.length} submitted. Tap a person to show or hide their items. Choose someone in the team list to edit their NWA or add a manager note.</p>
          </div>
          <div className="flex gap-2 text-xs">
            <button type="button" className="rounded-full border border-border px-3 py-1 font-medium hover:bg-surface-2" onClick={() => setHidden(new Set())}>Show all</button>
            <button type="button" className="rounded-full border border-border px-3 py-1 font-medium hover:bg-surface-2" onClick={() => setHidden(new Set(members.map(m => m.user.id)))}>Hide all</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map(m => {
            const off = hidden.has(m.user.id);
            const st = statusInfo(m, planWeek);
            return (
              <button
                key={m.user.id}
                type="button"
                onClick={() => toggle(m.user.id)}
                aria-pressed={!off}
                title={off ? `Show ${m.user.name}` : `Hide ${m.user.name}`}
                className={cn('flex items-center gap-2 rounded-xl border border-l-4 px-3 py-1.5 text-left text-sm transition-opacity', off ? 'opacity-45' : 'opacity-100')}
                style={{ borderLeftColor: m.color.strip, backgroundColor: off ? undefined : m.color.tint, color: off ? undefined : m.color.ink }}
              >
                {off ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                <span className="font-semibold">{m.user.name}</span>
                <span className="text-xs opacity-80">{isAmRole(m.user.role) ? 'AM' : 'BDM'}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', st.cls)}>{st.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <AgendaBar items={agenda} totalMinutes={NWA_MEETING_MINUTES} />

      <section id={anchor('review')} className={cn(NWA_SCROLL_MT, 'rounded-2xl border border-border bg-card shadow-sm')}>
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"><History className="h-4 w-4" /></span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Last week’s commitments</h2>
            <p className="text-sm text-muted-foreground">What each person committed to for week {weekNo(reviewWeek)} and how they marked it.</p>
          </div>
        </header>
        <div className="px-5 py-4">{renderPeople('review', `No commitments were recorded for week ${weekNo(reviewWeek)}.`)}</div>
      </section>

      {TEAM_SECTIONS.map(s => (
        <SectionCard key={s.id} id={anchor(s.id)} section={s} complete={sectionDone(s.id)}>
          {s.id === 'updates'
            ? businessUpdates
            : renderPeople(s.id, s.id === 'accounts' ? 'No account health items this week.' : 'Nothing entered yet for the people shown.')}
        </SectionCard>
      ))}
    </div>
  );
}
