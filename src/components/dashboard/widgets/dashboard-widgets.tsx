"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import { Activity, DollarSign, Gauge, TrendingUp, FileDown, ListChecks, AlertTriangle, CheckCircle2, Fuel } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useCRMSummary } from '@/hooks/use-crm-summary';
import { useTeamUsers } from '@/hooks/use-team-users';
import { useVerticalDismissals } from '@/hooks/use-vertical-dismissals';
import { Badge } from '@/components/ui/badge';
import { cn, formatEAV, getCurrentWeek, getNextWeekKey } from '@/lib/utils';
import { computeMomentum } from '@/lib/momentum';
import { mergeContinuousPlans, formatPerth, type Task } from '@/lib/time-mgmt';
import { VERTICALS, tsMs, type VerticalProspect } from '@/lib/verticals';
import { WA_SUGGESTED_PROSPECTS } from '@/data/wa-suggested-prospects';
import {
  canvassSnapshot, factFindingSnapshot, fuelSnapshot, planGaps, teamSnapshot, todaySnapshot, topSuggested, verticalsSnapshot,
} from '@/lib/dashboard-snapshots';
import { KPICard } from '../kpi-card';
import { AMBDNotesWidget } from '../ambd-notes-widget';
import { PipelineReviewTable } from '../pipeline-review-table';
import { AIDealWhisperer } from '../ai-deal-whisperer';
import { CRMSummaryPanel } from '../crm-summary-panel';
import { EmptyLine, Stat, WidgetLink, useWidgetContext } from './widget-context';


/** Own fact finds (shared by the Fact Finding and Call Plans widgets; same query = one Firestore listener). */
function useMyFactFindings(userId: string) {
  const db = useFirestore();
  const q = useMemoFirebase(() => (db && userId ? query(collection(db, 'factFindingDocs'), where('userId', '==', userId), limit(200)) : null), [db, userId]);
  return useCollection<any>(q);
}

// 1 ─ Today ─────────────────────────────────────────────────────────────────
export function TodayWidget() {
  const { userId } = useWidgetContext();
  const db = useFirestore();
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(i); }, []);
  const q = useMemoFirebase(() => (db && userId ? query(collection(db, 'timeManagementPlans'), where('userId', '==', userId)) : null), [db, userId]);
  const { data: plans, isLoading } = useCollection<{ tasks?: Task[] }>(q);
  const snap = useMemo(() => todaySnapshot(mergeContinuousPlans((plans || []) as any).tasks, now), [plans, now]);
  const rows = [...snap.overdue.map(t => ({ t, overdue: true })), ...snap.today.map(t => ({ t, overdue: false }))].slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 max-w-xs">
        <Stat label="Overdue" value={snap.overdue.length} tone={snap.overdue.length ? 'bad' : 'good'} />
        <Stat label="Due today" value={snap.today.length} tone={snap.today.length ? 'warn' : 'default'} />
      </div>
      {rows.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {rows.map(({ t, overdue }) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">{t.text}</span>
              <span className={cn('shrink-0 text-[10px] font-black uppercase tracking-wide', overdue ? 'text-rose-600' : 'text-amber-600')}>
                {overdue ? 'Overdue · ' : ''}{formatPerth(t.dueAt as number, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>{isLoading ? 'Loading tasks…' : 'Nothing overdue or due today.'}</EmptyLine>
      )}
      {snap.total > rows.length && <EmptyLine>+{snap.total - rows.length} more</EmptyLine>}
      <WidgetLink view="MANAGE_TIME">Open Manage Time</WidgetLink>
    </div>
  );
}

// 2 ─ Revenue & pipeline ─────────────────────────────────────────────────────
export function KpiPipelineWidget() {
  const { userId, role, overrides } = useWidgetContext();
  const db = useFirestore();
  const { pipelineReviews: allDeals } = usePipelineData();
  const statsRef = useMemoFirebase(() => (db && userId ? doc(db, 'bdmStats', userId) : null), [db, userId]);
  const { data: stats } = useDoc<any>(statsRef);
  const crmSummary = useCRMSummary(userId || null, false, allDeals || []);
  const isAM = role === 'ACCOUNT_MANAGER';

  const pipelineTotal = useMemo(() => (allDeals || []).reduce((s, d) => s + (Number(d.value) || 0), 0), [allDeals]);
  const momentumCounts = useMemo(() => {
    const counts = { HOT: 0, MOVING: 0, STALLING: 0, DEAD: 0 };
    (allDeals || []).forEach(d => {
      counts[computeMomentum({ daysInStage: d.daysInStage || 0, rolloverCount: d.rolloverCount || 0, barrierText: d.barriers || '', lastBarrierText: d.lastBarrierText || '' }).score]++;
    });
    return counts;
  }, [allDeals]);
  const weightedForecast = useMemo(() => {
    const w: Record<string, number> = { Discovery: 0.1, Proposal: 0.3, Negotiation: 0.6, Verbal: 0.85, Portfolio: 0.5 };
    return (allDeals || []).reduce((s, d) => s + (Number(d.value) || 0) * ((d.stage ? w[d.stage] : undefined) ?? 0.2), 0);
  }, [allDeals]);

  if (overrides?.['kpi-pipeline']) return <>{overrides['kpi-pipeline']}</>;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
      <KPICard title="Rev YTD" value={`${formatEAV(crmSummary.myStats?.custYTDRevenueThisFY || 0)}`} subtitle={`Tgt: ${formatEAV(stats?.target || 0)}`} icon={<DollarSign className="w-4 h-4" />} info="Annual strategic revenue achievement." />
      <KPICard title="Forecast" value={`${formatEAV(weightedForecast)}`} subtitle="Weighted" icon={<TrendingUp className="w-4 h-4 text-green-500" />} info="Calculated based on stage probability × value." />
      <KPICard title="Strategic Yield" value={`${formatEAV((isAM ? (crmSummary.myStats?.custYTDRevenueThisFY || 0) : pipelineTotal) / (stats?.activityScore || 1))}`} subtitle="Val/Activity" icon={<Gauge className="w-4 h-4" />} info="The 'Professional Multiplier': Revenue generated per unit of activity." />
      <KPICard title="Velocity Pulse" value={`${momentumCounts.HOT}`} subtitle="Hot Deals" status={momentumCounts.STALLING > 3 ? 'AT_RISK' : 'ON_TRACK'} icon={<Activity className="w-4 h-4 text-accent" />} info="Live momentum tracking. Flagging deals based on stage duration." />
    </div>
  );
}

// 3 ─ Weekly rhythm ──────────────────────────────────────────────────────────
export function WeeklyRhythmWidget() {
  const { userId } = useWidgetContext();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const nextWeek = getNextWeekKey(currentWeek);
  const twtwRef = useMemoFirebase(() => (db && userId ? doc(db, 'twiwSubmissions', `${userId}_${currentWeek}`) : null), [db, userId, currentWeek]);
  const fwRef = useMemoFirebase(() => (db && userId ? doc(db, 'weeklyCommitments', `${userId}_${nextWeek}`) : null), [db, userId, nextWeek]);
  const { data: twtw } = useDoc<any>(twtwRef);
  const { data: fw } = useDoc<any>(fwRef);
  const twtwStatus = twtw?.status || 'NOT_STARTED';
  const fwStatus = fw?.status || 'NOT_STARTED';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <FileDown className="w-4 h-4 text-rose-400" />
            <p className="mt-2 text-[11px] font-black uppercase tracking-wider">Thursday TWTW</p>
            <p className="text-[10px] text-slate-400 font-bold">Week {currentWeek.split('-')[1]}</p>
          </div>
          <Badge className={cn('border-none font-bold text-[8px] uppercase shrink-0', twtwStatus === 'SUBMITTED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>
            {twtwStatus === 'SUBMITTED' ? 'Done' : 'Due: Thursday Morning'}
          </Badge>
        </div>
        <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ListChecks className="w-4 h-4 text-amber-400" />
            <p className="mt-2 text-[11px] font-black uppercase tracking-wider">Friday FW</p>
            <p className="text-[10px] text-slate-400 font-bold">Next-week activity · Week {nextWeek.split('-')[1]}</p>
          </div>
          <Badge className={cn('border-none font-bold text-[8px] uppercase shrink-0', fwStatus === 'SUBMITTED' ? 'bg-emerald-500/20 text-emerald-300' : fwStatus === 'DRAFT' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300')}>
            {fwStatus === 'SUBMITTED' ? 'Done' : fwStatus === 'DRAFT' ? 'Draft' : 'Due: Friday Morning'}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <WidgetLink view="TWIW">Open TWTW</WidgetLink>
        <WidgetLink view="FRIDAY_FW">Open Friday FW</WidgetLink>
      </div>
    </div>
  );
}

// 4 ─ Verticals prospecting ──────────────────────────────────────────────────
export function VerticalsWidget() {
  const { userId } = useWidgetContext();
  const db = useFirestore();
  const dismissals = useVerticalDismissals();
  const q = useMemoFirebase(() => (db ? query(collection(db, 'verticalProspects'), orderBy('createdAt', 'desc'), limit(300)) : null), [db]);
  const { data } = useCollection<VerticalProspect>(q);
  const prospects = data || [];
  const snap = useMemo(() => verticalsSnapshot(prospects, userId), [prospects, userId]);
  const top = useMemo(
    () => topSuggested(WA_SUGGESTED_PROSPECTS, prospects.map(p => p.company), dismissals.isDismissed, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, dismissals.dismissals],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="New this week" value={snap.newThisWeek} />
        <Stat label="Claimed by me" value={snap.claimedByMe} tone={snap.claimedByMe ? 'good' : 'default'} />
        <Stat label="Pain-flagged" value={snap.painFlagged} tone={snap.painFlagged ? 'warn' : 'default'} />
        <Stat label="Unclaimed" value={snap.unclaimed} />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Top suggested WA prospects</p>
        {top.length ? (
          <ul className="divide-y divide-slate-100">
            {top.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-1.5 min-w-0">
                <span className="text-xs font-bold text-slate-800 truncate">{s.company}</span>
                <span className="shrink-0 text-[10px] font-bold text-slate-500 truncate max-w-[45%]">{VERTICALS.find(v => v.id === s.vertical)?.short || s.vertical} · {s.region}</span>
              </li>
            ))}
          </ul>
        ) : <EmptyLine>No new suggestions right now.</EmptyLine>}
      </div>
      <WidgetLink view="VERTICALS">Open Verticals</WidgetLink>
    </div>
  );
}

// 5 ─ Fuel surcharges ────────────────────────────────────────────────────────
export function FuelWidget() {
  const db = useFirestore();
  const docsRef = useMemoFirebase(() => (db ? collection(db, 'fuelSurcharges') : null), [db]);
  const ovRef = useMemoFirebase(() => (db ? collection(db, 'fuelSurchargeOverrides') : null), [db]);
  const { data: docs } = useCollection<any>(docsRef);
  const { data: ovs } = useCollection<any>(ovRef);
  const snap = useMemo(() => fuelSnapshot(docs, ovs), [docs, ovs]);
  const fmt = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, '')}%`;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <Fuel className="w-4 h-4 text-indigo-600 self-center" />
        <span className="text-2xl font-black text-indigo-800 tabular-nums">{snap.tgePct != null ? fmt(snap.tgePct) : '—'}</span>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">TGE Express Parcels Road</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {snap.competitors.map(c => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-1 text-xs min-w-0">
            <span className="font-bold text-slate-700 truncate">{c.name}{c.manual ? ' (manual)' : ''}</span>
            <span className="shrink-0 font-black tabular-nums">
              {fmt(c.pct)}
              {c.diff != null && <span className={cn('ml-1.5 text-[10px]', c.diff > 0 ? 'text-emerald-700' : c.diff < 0 ? 'text-rose-600' : 'text-slate-500')}>{c.diff > 0 ? '+' : ''}{c.diff.toFixed(2)}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] font-bold text-slate-500">
        {snap.stale && <AlertTriangle className="inline w-3 h-3 text-amber-600 mr-1" />}
        {snap.lastChecked ? `Last checked ${formatPerth(snap.lastChecked, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} AWST` : 'Not checked yet'}
      </p>
      <WidgetLink view="FUEL_SURCHARGES">Open Fuel Surcharges</WidgetLink>
    </div>
  );
}

// 6 ─ Fact finding ───────────────────────────────────────────────────────────
export function FactFindingWidget() {
  const { userId } = useWidgetContext();
  const { data } = useMyFactFindings(userId);
  const snap = useMemo(() => factFindingSnapshot(data || []), [data]);
  return (
    <div className="space-y-3">
      <Stat label="Open fact finds" value={snap.open} tone={snap.open ? 'default' : 'warn'} />
      <div className="flex flex-wrap gap-1.5">
        {snap.byStage.filter(s => s.count > 0).map(s => (
          <Badge key={s.stage} variant="outline" className="text-[9px] font-black uppercase">{s.stage} · {s.count}</Badge>
        ))}
      </div>
      {snap.latest.length ? (
        <ul className="divide-y divide-slate-100">
          {snap.latest.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-1 min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">{d.companyName}</span>
              <span className="shrink-0 text-[10px] font-bold text-slate-500">{d.stage || 'New'}</span>
            </li>
          ))}
        </ul>
      ) : <EmptyLine>No fact finds in progress.</EmptyLine>}
      <WidgetLink view="FACT_FINDING">Open Fact Finding</WidgetLink>
    </div>
  );
}

// 7 ─ Canvassing ─────────────────────────────────────────────────────────────
export function CanvassingWidget() {
  const { userId } = useWidgetContext();
  const db = useFirestore();
  const q = useMemoFirebase(() => (db && userId ? query(collection(db, 'canvass_leads'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(100)) : null), [db, userId]);
  const { data } = useCollection<any>(q);
  const snap = useMemo(() => canvassSnapshot(data || []), [data]);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Leads this week" value={snap.thisWeek} tone={snap.thisWeek ? 'good' : 'default'} />
        <Stat label="Not in Salesforce" value={snap.toSync} tone={snap.toSync ? 'warn' : 'good'} />
      </div>
      {snap.latestToSync.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {snap.latestToSync.map((l: any) => (
            <li key={l.id} className="py-1 text-xs font-bold text-slate-800 truncate">{l.companyName}</li>
          ))}
        </ul>
      ) : <EmptyLine>{snap.total ? 'All leads are in Salesforce.' : 'No canvassing leads yet.'}</EmptyLine>}
      <WidgetLink view="CANVASSING">Open Canvassing</WidgetLink>
    </div>
  );
}

// 8 ─ Call plans / white space ───────────────────────────────────────────────
export function CallPlansWidget() {
  const { userId } = useWidgetContext();
  const db = useFirestore();
  const { pipelineReviews: allDeals } = usePipelineData();
  const { data: ffs } = useMyFactFindings(userId);
  const cpQ = useMemoFirebase(() => (db && userId ? query(collection(db, 'callPlans'), where('userId', '==', userId), limit(200)) : null), [db, userId]);
  const wpQ = useMemoFirebase(() => (db && userId ? query(collection(db, 'whitespacePlans'), where('userId', '==', userId), limit(200)) : null), [db, userId]);
  const { data: callPlans } = useCollection<any>(cpQ);
  const { data: wps } = useCollection<any>(wpQ);
  const gaps = useMemo(() => planGaps(allDeals || [], userId, ffs || [], callPlans || [], wps || []), [allDeals, userId, ffs, callPlans, wps]);
  const lastPlan = useMemo(() => Math.max(0, ...(callPlans || []).map((p: any) => tsMs(p.createdAt))), [callPlans]);

  const List = ({ items }: { items: string[] }) => (
    <ul className="mt-1 space-y-0.5">{items.slice(0, 3).map((n, i) => <li key={i} className="text-xs font-bold text-slate-800 truncate">{n}</li>)}{items.length > 3 && <li className="text-[10px] text-slate-500">+{items.length - 3} more</li>}</ul>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Call plans due" value={gaps.callPlansDue.length} tone={gaps.callPlansDue.length ? 'warn' : 'good'} />
        <Stat label="White space due" value={gaps.whiteSpaceDue.length} tone={gaps.whiteSpaceDue.length ? 'warn' : 'good'} />
      </div>
      {gaps.callPlansDue.length > 0 && <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Needs a call plan</p><List items={gaps.callPlansDue} /></div>}
      {gaps.whiteSpaceDue.length > 0 && <div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Needs white space</p><List items={gaps.whiteSpaceDue} /></div>}
      {gaps.callPlansDue.length === 0 && gaps.whiteSpaceDue.length === 0 && (
        <EmptyLine><CheckCircle2 className="inline w-3.5 h-3.5 text-emerald-600 mr-1" />Top-8 accounts are covered.{lastPlan ? ` Last call plan ${formatPerth(lastPlan, { day: 'numeric', month: 'short' })}.` : ''}</EmptyLine>
      )}
      <div className="flex flex-wrap gap-4">
        <WidgetLink view="CALL_PLANNING">Call Plans</WidgetLink>
        <WidgetLink view="WHITE_SPACE">White Space</WidgetLink>
      </div>
    </div>
  );
}

// 9 ─ AM/BD notes (existing component) ───────────────────────────────────────
export function AmbdNotesDashboardWidget() {
  const { userId } = useWidgetContext();
  return <AMBDNotesWidget userId={userId} />;
}

// 10 ─ Team snapshot (leaders) ───────────────────────────────────────────────
export function TeamSnapshotWidget() {
  const { isLeader } = useAuth();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const { teamUsers } = useTeamUsers();
  const twtwQ = useMemoFirebase(() => (db && isLeader ? query(collection(db, 'twiwSubmissions'), where('week', '==', currentWeek)) : null), [db, isLeader, currentWeek]);
  const sharesQ = useMemoFirebase(() => (db && isLeader ? collection(db, 'dataShares') : null), [db, isLeader]);
  const settingsRef = useMemoFirebase(() => (db ? doc(db, 'appSettings', 'global') : null), [db]);
  const { data: twtw } = useCollection<any>(twtwQ);
  const { data: shares } = useCollection<any>(sharesQ);
  const { data: settings } = useDoc<any>(settingsRef);
  const snap = useMemo(() => teamSnapshot({
    teamIds: teamUsers.flatMap(u => [u.id, ...(u.linkedIds || [])]),
    twtwSubmissions: twtw || [],
    shares: shares || [],
    lastCrmSyncMs: tsMs(settings?.lastCrmSync) || null,
  }), [teamUsers, twtw, shares, settings]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="TWTW submitted" value={`${snap.twtwSubmitted}/${snap.teamSize}`} tone={snap.teamSize && snap.twtwSubmitted === snap.teamSize ? 'good' : 'warn'} />
        <Stat label="Shared access" value={snap.shareCount} />
        <Stat label="People sharing" value={snap.sharingOwners} />
        <Stat label="CRM import" value={snap.syncAgeDays === null ? 'Never' : snap.syncAgeDays === 0 ? 'Today' : `${snap.syncAgeDays}d ago`} tone={snap.crmStale ? 'bad' : 'good'} />
      </div>
      <div className="flex flex-wrap gap-4">
        <WidgetLink view="ACCESS">Access</WidgetLink>
        <WidgetLink view="DATA_HEALTH">Data Health</WidgetLink>
        <WidgetLink view="TEAM">Team</WidgetLink>
      </div>
    </div>
  );
}

// 11 ─ CRM summary (optional) ────────────────────────────────────────────────
export function CrmSummaryDashboardWidget() {
  const { userId } = useWidgetContext();
  const { pipelineReviews: allDeals } = usePipelineData();
  const crmSummary = useCRMSummary(userId || null, false, allDeals || []);
  return <CRMSummaryPanel summary={crmSummary} showAllUsers={false} currentWeek={getCurrentWeek()} />;
}

// 12/13 ─ Optional pipeline tables (existing components) ─────────────────────
export function CustomerReviewDashboardWidget() {
  const { userId } = useWidgetContext();
  return <PipelineReviewTable userId={userId} filterType="accounts" />;
}

export function PipelineReviewDashboardWidget() {
  const { userId } = useWidgetContext();
  const { pipelineReviews: allDeals } = usePipelineData();
  return (
    <div className="space-y-6">
      <AIDealWhisperer deals={allDeals || []} />
      <PipelineReviewTable userId={userId} filterType="opportunities" />
    </div>
  );
}
