"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import {
  AlertTriangle, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, FileClock, History, Lock, Plus, Save, Send, Trash2, Users,
} from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useTeamUsers } from '@/hooks/use-team-users';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn, formatEAV, getNextWeekKey, getPreviousWeekKey } from '@/lib/utils';
import { formatPerth } from '@/lib/time-mgmt';
import {
  NWA_ACCOUNTS_OPTIONAL, NWA_MEETING_MINUTES, PIPELINE_GROUPS, STALL_DAYS,
  type KpiTargetSource, type NwaBusinessUpdates, type NwaCommitment, type NwaKpiTargets, type NwaLeaderNotes, type NwaPlan,
  type NwaSectionId,
  accountOptions, accountSignals, applyAutoSections, buildNwaPayload, businessUpdatesDocId, carryForwardAccounts, closedWonLines,
  computeActuals, crmAppointmentsForWeek, emptyLeaderNotes, emptyNwaPlan, followThroughScore, followThroughTrend, hasBusinessUpdates, isAmRole,
  isLegacyFridayDoc, isSubmittedStatus, kpiDefsFor, latestCrmUploadMs, latestDeals, leaderNotesDocId, legacyFridaySnapshot, mapLeaderNotes,
  mapStoredNwa, mergeCommitmentReview, nwaDueAt, nwaDueState, nwaId, nwaMeetingAt, nwaSectionsFor, pipelineSuggestions, previousCommitmentsFrom,
  requiredProgress, resolveBusinessUpdates, resolveKpiTargets, sectionComplete, signalToAtRiskRow, averageScore, teamLeaderNotes,
} from '@/lib/nwa';
import {
  AgendaBar, NWA_SCROLL_MT, DueChip, EmptyHint, FieldLabel, FollowThroughBars, OutcomeToggle, ScoreChip, SectionCard, StatTile, SubHeading, TimeChip,
} from './nwa-ui';
import { LegacyFridaySummary } from './nwa-legacy';
import { AppointmentsView, BusinessUpdatesView, DealRowsView, LeaderNotesView, WinsView } from './nwa-readonly';
import { NwaLeaderPanel } from './nwa-leader-panel';
import { AccountMgmtEditor, HandoverEditor } from './nwa-accounts';
import { NwaTeamOverview } from './nwa-team-overview';

const TARGET_SOURCE_LABEL: Record<KpiTargetSource, string> = {
  person: 'set for this person',
  team: 'team target',
  annualTarget: 'annual target ÷ 52',
  default: 'default',
};

export interface NwaFormProps {
  userId: string;
  userName: string;
  userRole: string;
  userState?: string;
  /** The week being reviewed (the week that just finished). The form plans the week after it. */
  selectedWeek: string;
}

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;
const weekNo = (w: string) => w.split('-')[1] || w;

export function NwaForm({ userId, userName, userRole, selectedWeek }: NwaFormProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { profile, isLeader, user } = useAuth();
  const { teamUsers } = useTeamUsers();
  const { pipelineReviews, weeklyProgresses } = usePipelineData();

  // ─── Who and which week ────────────────────────────────────────────────────
  const [selectedRepId, setSelectedRepId] = useState<string>(userId);
  useEffect(() => { setSelectedRepId(userId); }, [userId]);
  // Leaders who pick themselves see the whole team (read-only) by default; "My NWA" switches to their own form.
  const [teamMode, setTeamMode] = useState(true);
  const selectRep = useCallback((id: string) => { setSelectedRepId(id); if (id === userId) setTeamMode(true); }, [userId]);
  const rep = useMemo(() => teamUsers.find(u => u.id === selectedRepId), [teamUsers, selectedRepId]);
  const activeUserId = selectedRepId || userId;
  const activeUserName = activeUserId === userId ? userName : (rep?.name || userName);
  const activeRole = activeUserId === userId ? userRole : (rep?.role || 'BDM');
  const isOwn = activeUserId === userId;

  const currentPlanWeek = useMemo(() => getNextWeekKey(selectedWeek), [selectedWeek]);
  const [planWeek, setPlanWeek] = useState(currentPlanWeek);
  useEffect(() => { setPlanWeek(currentPlanWeek); }, [currentPlanWeek]);
  const reviewWeek = useMemo(() => getPreviousWeekKey(planWeek), [planWeek]);
  const isPastWeek = planWeek < currentPlanWeek;

  // ─── Form state ─────────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<NwaPlan>(() => emptyNwaPlan(userRole));
  const [stored, setStored] = useState<any>(null);
  const [prevDoc, setPrevDoc] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'draft' | 'submit' | 'note' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [managerNote, setManagerNote] = useState('');
  const prefilled = useRef({ atRisk: false });
  // Auto-filled sources: the rep's TWTW for reviewWeek, Salesforce APP activities for planWeek, leader notes.
  const [twtwDoc, setTwtwDoc] = useState<any>(null);
  const [crmActs, setCrmActs] = useState<any[]>([]);
  const [lastCrmSync, setLastCrmSync] = useState<any>(null);
  const [personNotes, setPersonNotes] = useState<NwaLeaderNotes>(emptyLeaderNotes());
  const [targetSource, setTargetSource] = useState<Record<keyof NwaKpiTargets, KpiTargetSource> | null>(null);
  // Legacy Friday FW doc being converted to an NWA (snapshot of the original fields, kept on save).
  const [legacyConversion, setLegacyConversion] = useState<Record<string, any> | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showAmOptional, setShowAmOptional] = useState(false);

  const isAm = isAmRole(activeRole);
  const sections = useMemo(() => nwaSectionsFor(activeRole), [activeRole]);
  const sec = (id: NwaSectionId) => sections.find(s => s.id === id) || NWA_ACCOUNTS_OPTIONAL;
  const kpiDefs = useMemo(() => kpiDefsFor(activeRole), [activeRole]);

  const status: string = stored?.status || 'NOT_STARTED';
  const submitted = isSubmittedStatus(status);
  const legacyDoc = !!stored && isLegacyFridayDoc(stored);
  const legacy = legacyDoc && !legacyConversion;
  const canEdit = isLeader || (isOwn && !isPastWeek);
  const readOnly = legacy || !canEdit;

  const update = useCallback((fn: (p: NwaPlan) => NwaPlan) => {
    setPlan(prev => fn(prev));
    setDirty(true);
  }, []);

  // Load the plan, the previous plan (commitments to review), history and last week's progress.
  useEffect(() => {
    if (!db || !activeUserId) return;
    let cancelled = false;
    setLoading(true);
    prefilled.current = { atRisk: false };
    setLegacyConversion(null);
    setShowOriginal(false);
    (async () => {
      // Target sources are optional: a missing doc or a permissions error falls back to defaults.
      const safeGet = (path: [string, string]) => getDoc(doc(db, path[0], path[1])).then(d => (d.exists() ? d.data() : null)).catch(() => null);
      try {
        const [userDoc, statsDoc, teamTargets, globalSettings, leaderNotes, crm] = await Promise.all([
          safeGet(['users', activeUserId]), safeGet(['bdmStats', activeUserId]), safeGet(['appSettings', 'nwaKpiTargets']),
          safeGet(['appSettings', 'global']), safeGet(['nwaLeaderNotes', leaderNotesDocId(activeUserId, planWeek)]),
          // Salesforce upload: this person's activities tagged with the plan week (rules need the userId filter).
          getDocs(query(collection(db, 'crmActivities'), where('userId', '==', activeUserId), where('week', '==', planWeek)))
            .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
            .catch(() => [] as any[]),
        ]);
        const [planSnap, prevSnap, histSnap, twtwSnap, progSnap] = await Promise.all([
          getDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${planWeek}`)),
          getDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${reviewWeek}`)),
          getDocs(query(collection(db, 'weeklyCommitments'), where('userId', '==', activeUserId))),
          getDocs(query(collection(db, 'twiwSubmissions'), where('userId', '==', activeUserId), where('week', '==', reviewWeek))),
          getDocs(query(collection(db, 'weeklyProgress'), where('userId', '==', activeUserId), where('week', '==', reviewWeek))),
        ]);
        if (cancelled) return;
        const data = planSnap.exists() ? planSnap.data() : null;
        const prev = prevSnap.exists() ? prevSnap.data() : null;
        const twtw = twtwSnap.docs[0]?.data();
        const twtwActions = (Array.isArray(twtw?.priorities) ? twtw!.priorities : [])
          .map((p: any) => (typeof p === 'string' ? p : p?.text || ''))
          .filter(Boolean);
        const resolved = resolveKpiTargets(activeRole, { userDoc, teamTargets, stats: statsDoc });
        const mapped = data ? mapStoredNwa(data, activeRole, twtwActions) : (() => {
          const fresh = emptyNwaPlan(activeRole);
          fresh.kpiTargets = resolved.targets;
          if (prev) fresh.accounts = carryForwardAccounts(mapStoredNwa(prev, activeRole).accounts);
          twtwActions.slice(0, 3).forEach((t: string, i: number) => { fresh.topPriorities[i] = t; });
          return fresh;
        })();
        // Targets are leader-maintained: a plan that is still open follows the current person / team targets.
        const targetsLive = !data || (!isSubmittedStatus(data.status) && planWeek >= currentPlanWeek);
        if (targetsLive) mapped.kpiTargets = resolved.targets;
        setTargetSource(targetsLive ? resolved.source : null);
        setTwtwDoc(twtw || null);
        setCrmActs(crm);
        setLastCrmSync(globalSettings?.lastCrmSync ?? null);
        setPersonNotes(mapLeaderNotes(leaderNotes));
        mapped.commitmentReview = mergeCommitmentReview(mapped.commitmentReview, previousCommitmentsFrom(prev));
        setStored(data);
        setPrevDoc(prev);
        setHistory(histSnap.docs.map(d => d.data()));
        setProgress(progSnap.docs[0]?.data() || null);
        setPlan(mapped);
        setManagerNote(data?.managerNote || data?.adminCoachingNotes || '');
        setDirty(false);
      } catch (err: any) {
        if (!cancelled) toast({ variant: 'destructive', title: 'Couldn’t load the TWA', description: err?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [db, activeUserId, activeRole, planWeek, reviewWeek, currentPlanWeek, toast]);

  // ─── CRM and call plan data ────────────────────────────────────────────────
  const deals = useMemo(() => latestDeals((pipelineReviews || []).filter((d: any) => d.userId === activeUserId)), [pipelineReviews, activeUserId]);
  const suggestions = useMemo(() => pipelineSuggestions(deals, reviewWeek), [deals, reviewWeek]);
  const activity = useMemo(() => (weeklyProgresses || []).filter((p: any) => p.userId === activeUserId && p.week === reviewWeek), [weeklyProgresses, activeUserId, reviewWeek]);

  const reviewCallPlansQ = useMemoFirebase(() => (db && activeUserId ? query(collection(db, 'callPlans'), where('userId', '==', activeUserId), where('week', '==', reviewWeek)) : null), [db, activeUserId, reviewWeek]);
  const { data: reviewCallPlans } = useCollection<any>(reviewCallPlansQ);

  const actuals = useMemo(() => computeActuals({
    progress, activity, callPlanCount: reviewCallPlans?.length || 0, deals: suggestions.closedWon, accounts: plan.accounts,
  }), [progress, activity, reviewCallPlans, suggestions.closedWon, plan.accounts]);
  const signals = useMemo(() => accountSignals(deals), [deals]);
  const acctOptions = useMemo(() => accountOptions(deals), [deals]);
  const people = useMemo(() => {
    const list = teamUsers.map(u => ({ id: u.id, name: u.name })).filter(u => u.name);
    if (!list.some(u => u.id === activeUserId)) list.unshift({ id: activeUserId, name: activeUserName });
    return list;
  }, [teamUsers, activeUserId, activeUserName]);
  const lastTargets = useMemo(() => (prevDoc ? mapStoredNwa(prevDoc, activeRole).kpiTargets : null), [prevDoc, activeRole]);

  // Pre-fill a new plan (wins, appointments and pipeline are auto-filled below, never typed).
  useEffect(() => {
    if (loading || stored || readOnly) return;
    // Account managers: CRM-flagged at-risk accounts (top 5) on a new plan.
    if (isAm && !prefilled.current.atRisk && signals.length) {
      prefilled.current.atRisk = true;
      setPlan(p => {
        const have = new Set(p.accounts.atRisk.map(r => r.accountId).filter(Boolean));
        const add = signals.filter(sg => !have.has(sg.id)).slice(0, 5).map(signalToAtRiskRow);
        return add.length ? { ...p, accounts: { ...p.accounts, atRisk: [...p.accounts.atRisk, ...add] } } : p;
      });
    }
  }, [loading, stored, readOnly, isAm, signals]);

  // ─── Business updates (leader-owned, team-wide) ────────────────────────────
  // One doc per week (appSettings/nwaBusinessUpdates_{week}); the old shared doc's byWeek map is the fallback.
  const updatesRef = useMemoFirebase(() => (db ? doc(db, 'appSettings', businessUpdatesDocId(planWeek)) : null), [db, planWeek]);
  const legacyUpdatesRef = useMemoFirebase(() => (db ? doc(db, 'appSettings', 'nwaBusinessUpdates') : null), [db]);
  const { data: updatesDoc } = useDoc<any>(updatesRef);
  const { data: legacyUpdatesDoc } = useDoc<any>(legacyUpdatesRef);
  const savedUpdates = useMemo(() => resolveBusinessUpdates(updatesDoc, legacyUpdatesDoc, planWeek), [updatesDoc, legacyUpdatesDoc, planWeek]);
  // Team-wide leader sections live on the same per-week doc (teamPipeline / teamKpis).
  const teamNotes = useMemo(() => teamLeaderNotes(updatesDoc), [updatesDoc]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const dueState = nwaDueState(planWeek, status);
  const dueAt = nwaDueAt(planWeek);
  const meetingAt = nwaMeetingAt(planWeek);
  const lastWeekScore = followThroughScore(plan.commitmentReview);
  const trend = useMemo(() => {
    const docs = history.filter(h => h.week !== planWeek);
    if (plan.commitmentReview.length) docs.push({ week: planWeek, commitmentReview: plan.commitmentReview });
    return followThroughTrend(docs);
  }, [history, planWeek, plan.commitmentReview]);
  const avgScore = averageScore(trend);
  // The plan as shown, saved and counted: wins from the TWTW, appointments from Salesforce, pipeline from CRM.
  const liveWeek = !submitted && !isPastWeek;
  const crmAppointments = useMemo(() => crmAppointmentsForWeek(crmActs, planWeek, [activeUserId]), [crmActs, planWeek, activeUserId]);
  const closedWonText = useMemo(() => closedWonLines(suggestions.closedWon), [suggestions.closedWon]);
  const auto = useMemo(() => applyAutoSections(plan, {
    twtw: twtwDoc, closedWonText, crmAppointments, suggestions, live: liveWeek && !readOnly,
  }), [plan, twtwDoc, closedWonText, crmAppointments, suggestions, liveWeek, readOnly]);
  const view = auto.plan;
  const latestUpload = useMemo(() => latestCrmUploadMs(lastCrmSync, crmActs), [lastCrmSync, crmActs]);
  const completeIds = sections.filter(s => sectionComplete(view, s.id, activeRole)).map(s => s.id);
  // Progress and submit count only what reps fill in: shout-out, top 3 priorities and commitments.
  const required = requiredProgress(view, activeRole);
  const completePct = required.pct;
  const hasAccountData = plan.accounts.atRisk.length + plan.accounts.renewals.length + plan.accounts.growth.length > 0;
  const lastTargetFor = (k: keyof NwaKpiTargets) => (lastTargets ? lastTargets[k] : 0);

  // ─── Legacy Friday FW → NWA ───────────────────────────────────────────────
  // The plan state already holds the legacy doc mapped onto NWA fields; saving keeps the original fields
  // and stores a snapshot in legacyFriday so the original stays viewable.
  const startNwaFromLegacy = () => {
    if (!stored || !canEdit) return;
    setLegacyConversion(stored.legacyFriday || legacyFridaySnapshot(stored));
    setDirty(true);
    toast({ title: 'Started a TWA from the Friday FW', description: 'The original is kept and stays viewable. Save a draft to keep the conversion.' });
  };

  // ─── Save / submit ─────────────────────────────────────────────────────────
  const persist = async (mode: 'draft' | 'submit') => {
    if (!db || !activeUserId) return;
    if (mode === 'submit') {
      if (required.missing.length) {
        toast({ variant: 'destructive', title: 'Almost there', description: `Complete ${required.missing.map(m => m.title).join(', ')} before submitting.` });
        return;
      }
    }
    setSaving(mode);
    try {
      const nextStatus = mode === 'submit' ? 'SUBMITTED' : (submitted ? status : 'DRAFT');
      const now = Date.now();
      await setDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${planWeek}`), {
        userId: activeUserId,
        userName: activeUserName,
        week: planWeek,
        reviewWeek,
        ...buildNwaPayload(view, { kpiActuals: actuals, role: activeRole }),
        ...(legacyConversion && !stored?.legacyFriday ? { legacyFriday: legacyConversion, convertedFromLegacyAt: serverTimestamp(), convertedFromLegacyBy: profile?.name || user?.email || activeUserName } : {}),
        status: nextStatus,
        dueAt: dueAt ?? null,
        updatedAt: serverTimestamp(),
        ...(mode === 'submit' ? { submittedAt: serverTimestamp(), submittedLate: dueAt !== null && now > dueAt } : {}),
        ...(!stored ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true });
      if (mode === 'submit') {
        const c = view.challenges;
        await setDoc(doc(db, 'weeklyReports', `${activeUserId}_${reviewWeek}`), {
          userId: activeUserId,
          userName: activeUserName,
          week: reviewWeek,
          nwaSubmitted: true,
          nwaFormVersion: 'NWA_V2',
          weeklyNotes: [view.wins.customerWins, view.wins.positiveFeedback].filter(Boolean).join('\n'),
          roadblocks: [c.slowingProgress, c.customerIssues, c.internalIssues].filter(Boolean).join('\n'),
          supportNeeded: c.resourcesRequired,
          summary: {
            totalEAV: suggestions.progressing.reduce((s, d) => s + (Number(d.value) || 0), 0) + actuals.revenue,
            newOpportunitiesCount: view.pipeline.created.filter(r => r.account.trim()).length,
            signedPaperworkCount: actuals.deals,
            newBusinessCount: actuals.deals,
            callsMade: actuals.calls,
            meetingsHeld: actuals.appointments,
            crmCalls: actuals.calls,
            crmApps: actuals.appointments,
          },
          status: 'REVIEWED',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setStored((s: any) => ({
        ...(s || {}), ...buildNwaPayload(view, { kpiActuals: actuals, role: activeRole }), status: nextStatus, formVersion: 'NWA_V2',
        ...(legacyConversion && !s?.legacyFriday ? { legacyFriday: legacyConversion } : {}),
      }));
      setLegacyConversion(null);
      setDirty(false);
      toast({
        title: mode === 'submit' ? 'TWA submitted' : 'Draft saved',
        description: mode === 'submit' ? `Ready for Monday’s meeting, week ${weekNo(planWeek)}.` : 'You can come back and finish it before Sunday 8pm.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Couldn’t save', description: err?.message });
    } finally {
      setSaving(null);
    }
  };

  const saveManagerNote = async () => {
    if (!db || !isLeader) return;
    setSaving('note');
    try {
      await setDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${planWeek}`), {
        userId: activeUserId, userName: activeUserName, week: planWeek,
        managerNote, adminCoachingNotes: managerNote,
        managerNoteBy: profile?.name || user?.email || 'Leader',
        managerNoteAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setStored((s: any) => ({ ...(s || {}), managerNote, managerNoteBy: profile?.name || 'Leader' }));
      toast({ title: 'Manager note saved', description: `${activeUserName} can see it on their TWA.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Couldn’t save note', description: err?.message });
    } finally {
      setSaving(null);
    }
  };

  const teammateNames = useMemo(() => teamUsers.map(u => u.name).filter(n => n && n !== activeUserName), [teamUsers, activeUserName]);

  const teamView = isLeader && selectedRepId === userId && teamMode;
  const agendaItems = [
    { anchorId: 'nwa-review', title: 'Last week’s commitments' },
    ...sections.map(s => ({ anchorId: `nwa-${s.id}`, step: s.step, title: s.title, minutes: s.minutes, complete: completeIds.includes(s.id) })),
  ];
  const leaderEditHint = isLeader ? 'Leaders edit this once for the week under Whole team → Leader inputs.' : 'Your leader hasn’t posted updates for this week yet.';
  const businessUpdatesBody = hasBusinessUpdates(savedUpdates) ? (
    <BusinessUpdatesView value={savedUpdates} />
  ) : (
    <EmptyHint>{isLeader ? 'No updates yet. Add them under Whole team → Leader inputs; everyone sees them read-only.' : leaderEditHint}</EmptyHint>
  );

  if (!activeUserId) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-28">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Monday team meeting · {NWA_MEETING_MINUTES} min</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">This Week’s Activities</h1>
            <p className="text-sm text-muted-foreground">
              Week {weekNo(planWeek)}
              {meetingAt && <> · meeting {formatPerth(meetingAt, { weekday: 'long', day: 'numeric', month: 'short' })}</>}
              {dueAt && <> · due {formatPerth(dueAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (Perth)</>}
            </p>
          </div>
          {!teamView && (
            <div className="flex flex-wrap items-center gap-2">
              <DueChip state={dueState} />
              {status === 'DRAFT' && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground">Draft</span>}
              <ScoreChip score={avgScore} label="Follow-through avg" />
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-border bg-surface-2/50 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous week" onClick={() => setPlanWeek(w => getPreviousWeekKey(w))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[7rem] px-2 text-center text-sm font-semibold tabular-nums">Week {weekNo(planWeek)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next week" disabled={planWeek >= currentPlanWeek} onClick={() => setPlanWeek(w => getNextWeekKey(w))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {isPastWeek && <Button variant="outline" size="sm" onClick={() => setPlanWeek(currentPlanWeek)}>Back to this week</Button>}
          {isLeader && teamUsers.length > 0 && (
            <Select value={selectedRepId} onValueChange={selectRep}>
              <SelectTrigger className="h-10 w-[220px]" aria-label="Team member"><Users className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Team member" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={userId}>{userName} (me) · whole team</SelectItem>
                {teamUsers.filter(u => u.id !== userId).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {isLeader && selectedRepId === userId && (
            <div className="inline-flex items-center rounded-xl border border-border bg-surface-2/50 p-1" role="group" aria-label="View">
              <Button variant={teamMode ? 'secondary' : 'ghost'} size="sm" className="h-8" aria-pressed={teamMode} onClick={() => setTeamMode(true)}><Users className="mr-1.5 h-4 w-4" />Whole team</Button>
              <Button variant={!teamMode ? 'secondary' : 'ghost'} size="sm" className="h-8" aria-pressed={!teamMode} onClick={() => setTeamMode(false)}>My TWA</Button>
            </div>
          )}
          {!teamView && (
            <div className="ml-auto flex min-w-[180px] items-center gap-3">
              <Progress value={completePct} className="h-2 w-32" aria-label="Required sections complete" />
              <span className="text-xs font-medium text-muted-foreground">{required.done.length} of {required.total} required sections</span>
            </div>
          )}
        </div>

        {!teamView && readOnly && !legacy && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2/60 px-4 py-2.5 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> {isPastWeek ? 'Past weeks are read-only.' : 'Read-only.'}
          </p>
        )}
      </div>

      {teamView ? (
        <div className="space-y-6">
        <NwaLeaderPanel planWeek={planWeek} updatesDoc={updatesDoc} savedUpdates={savedUpdates} />
        <NwaTeamOverview
          planWeek={planWeek}
          reviewWeek={reviewWeek}
          excludeUserId={userId}
          businessUpdates={businessUpdatesBody}
          businessUpdatesComplete={hasBusinessUpdates(savedUpdates)}
          teamNotes={teamNotes}
          live={!isPastWeek}
        />
        </div>
      ) : loading ? (
        <div className="space-y-4">{[0, 1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2/60" />)}</div>
      ) : legacy ? (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">This week was filed on the old Friday FW form. Start a TWA from it; the original stays viewable.</p>
              <Button onClick={startNwaFromLegacy} className="bg-cta text-white hover:bg-cta/90"><ArrowRight className="mr-1.5 h-4 w-4" />Start TWA</Button>
            </div>
          )}
          <LegacyFridaySummary data={stored} />
        </div>
      ) : (
        <>
        {(legacyConversion || stored?.legacyFriday) && (
          <div className="rounded-2xl border border-border bg-card">
            <button type="button" onClick={() => setShowOriginal(v => !v)} aria-expanded={showOriginal}
              className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-semibold text-foreground">
              <span className="flex items-center gap-2"><FileClock className="h-4 w-4 text-muted-foreground" />Original Friday FW{legacyConversion && !stored?.legacyFriday ? ' (save to keep the conversion)' : ''}</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showOriginal && 'rotate-180')} />
            </button>
            {showOriginal && <div className="border-t border-border p-4"><LegacyFridaySummary data={legacyConversion || stored.legacyFriday} /></div>}
          </div>
        )}
        <AgendaBar items={agendaItems} totalMinutes={NWA_MEETING_MINUTES} />

          <div className="space-y-6">
            {/* Last week's commitments */}
            <section id="nwa-review" className={cn(NWA_SCROLL_MT, 'rounded-2xl border border-border bg-card shadow-sm')}>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"><History className="h-4 w-4" /></span>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Last week’s commitments</h2>
                    <p className="text-sm text-muted-foreground">Mark each one before planning the week ahead.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FollowThroughBars points={trend} />
                  <ScoreChip score={lastWeekScore.score} label="This review" />
                </div>
              </header>
              <div className="space-y-2 px-5 py-4">
                {plan.commitmentReview.length === 0 ? (
                  <EmptyHint>No commitments were recorded for week {weekNo(reviewWeek)}.</EmptyHint>
                ) : plan.commitmentReview.map((c, i) => (
                  <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{c.text}</p>
                      {(c.owner || c.dueDate) && <p className="text-xs text-muted-foreground">{[c.owner, c.dueDate && `due ${c.dueDate}`].filter(Boolean).join(' · ')}</p>}
                    </div>
                    <Input
                      value={c.note}
                      disabled={readOnly}
                      placeholder="Note (optional)"
                      className="h-9 md:w-56"
                      onChange={e => update(p => ({ ...p, commitmentReview: p.commitmentReview.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) }))}
                    />
                    <OutcomeToggle
                      value={c.outcome}
                      disabled={readOnly}
                      onChange={v => update(p => ({ ...p, commitmentReview: p.commitmentReview.map((x, j) => (j === i ? { ...x, outcome: v } : x)) }))}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Wins (auto, from the TWTW) */}
            <SectionCard section={sec('wins')} complete={completeIds.includes('wins')}>
              <WinsView wins={view.wins} source={auto.winsSource} reviewWeek={reviewWeek} showTwtwLink={isOwn} />
            </SectionCard>

            {/* Shout out (required) */}
            <SectionCard section={sec('shoutout')} complete={completeIds.includes('shoutout')}>
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <FieldLabel htmlFor="nwa-shout-who">Teammate</FieldLabel>
                  <Input id="nwa-shout-who" list="nwa-teammates" placeholder="Who?" disabled={readOnly} value={plan.wins.shoutOut.teammate} onChange={e => update(p => ({ ...p, wins: { ...p.wins, shoutOut: { ...p.wins.shoutOut, teammate: e.target.value } } }))} />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="nwa-shout-why">What for?</FieldLabel>
                  <Input id="nwa-shout-why" placeholder="One line is enough" disabled={readOnly} value={plan.wins.shoutOut.reason} onChange={e => update(p => ({ ...p, wins: { ...p.wins, shoutOut: { ...p.wins.shoutOut, reason: e.target.value } } }))} />
                </div>
                <datalist id="nwa-teammates">{teammateNames.map(n => <option key={n} value={n} />)}</datalist>
              </div>
            </SectionCard>

            {/* Appointments (auto, from the Salesforce upload) */}
            <SectionCard section={sec('appointments')} complete={completeIds.includes('appointments')}>
              <AppointmentsView appointments={view.appointments} planWeek={planWeek} latestUploadMs={latestUpload} />
            </SectionCard>

            {/* Pipeline (auto, from CRM; leader notes) */}
            <SectionCard section={sec('pipeline')} complete={completeIds.includes('pipeline')}>
              <LeaderNotesView field="pipeline" team={teamNotes} person={personNotes} personName={isOwn ? undefined : activeUserName} />
              {PIPELINE_GROUPS.filter(g => g.key !== 'handedOver').map(g => (
                <div key={g.key} className="space-y-3">
                  <SubHeading
                    hint={g.hint}
                    right={g.key === 'stalled' && suggestions.stalled.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-ink">
                        <AlertTriangle className="h-3.5 w-3.5" />{suggestions.stalled.length} flagged in CRM
                      </span>
                    ) : undefined}
                  >{g.title}</SubHeading>
                  <DealRowsView rows={view.pipeline[g.key]} empty="Nothing in the latest CRM upload." />
                </div>
              ))}
              {(view.accounts.handovers.length > 0 || view.pipeline.handedOver.some(r => r.account.trim())) && (
                <div className="space-y-3">
                  <SubHeading hint="Recorded on an earlier version of this form.">Accounts handed over</SubHeading>
                  <DealRowsView rows={view.pipeline.handedOver} />
                  {view.accounts.handovers.length > 0 && (
                    <HandoverEditor value={view.accounts.handovers} readOnly options={acctOptions} people={people}
                      defaultFrom={{ id: activeUserId, name: activeUserName }} onChange={() => undefined} />
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">From the latest CRM pipeline upload. Leaders add pipeline and handover notes once a week under Whole team → Leader inputs.</p>
            </SectionCard>

            {/* Account management: an agenda item for account managers, optional for BDMs */}
            <SectionCard
              section={isAm ? sec('accounts') : NWA_ACCOUNTS_OPTIONAL}
              complete={isAm ? completeIds.includes('accounts') : undefined}
              collapsed={!isAm && !showAmOptional && !hasAccountData}
              actions={!isAm && !hasAccountData ? (
                <Button variant="outline" size="sm" aria-expanded={showAmOptional} onClick={() => setShowAmOptional(v => !v)}>
                  <ChevronDown className={cn('mr-1.5 h-4 w-4 transition-transform', showAmOptional && 'rotate-180')} />{showAmOptional ? 'Hide' : 'Show'}
                </Button>
              ) : undefined}
            >
              <AccountMgmtEditor value={plan.accounts} readOnly={readOnly} options={acctOptions} signals={signals}
                onChange={fn => update(p => ({ ...p, accounts: fn(p.accounts) }))} />
            </SectionCard>

            {/* KPIs */}
            <SectionCard section={sec('kpis')} complete={completeIds.includes('kpis')}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Metric</th>
                      <th className="py-2 pr-3 font-medium">Week {weekNo(reviewWeek)} actual</th>
                      <th className="py-2 pr-3 font-medium">Target</th>
                      <th className="py-2 pr-3 font-medium">Result</th>
                      <th className="py-2 font-medium">Week {weekNo(planWeek)} target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiDefs.map(k => {
                      const actual = actuals[k.key];
                      const target = lastTargetFor(k.target) || 0;
                      const pct = target > 0 ? Math.round((actual / target) * 100) : null;
                      return (
                        <tr key={k.key} className="border-b border-border last:border-0">
                          <td className="py-3 pr-3 font-medium text-foreground">{k.label}</td>
                          <td className="py-3 pr-3 tabular-nums">{k.currency ? money(actual) : actual}</td>
                          <td className="py-3 pr-3 tabular-nums text-muted-foreground">{target ? (k.currency ? money(target) : target) : '–'}</td>
                          <td className="py-3 pr-3">
                            {pct === null ? <span className="text-xs text-muted-foreground">No target</span> : (
                              <div className="flex items-center gap-2">
                                <Progress value={Math.min(100, pct)} className="h-2 w-20" />
                                <span className={cn('text-xs font-semibold tabular-nums', pct >= 100 ? 'text-success-ink' : pct >= 70 ? 'text-warning-ink' : 'text-destructive')}>{pct}%</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 tabular-nums font-semibold text-foreground">
                            {plan.kpiTargets[k.target] ? (k.currency ? money(plan.kpiTargets[k.target] || 0) : plan.kpiTargets[k.target]) : '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {isAm
                    ? <>Actuals come from CRM activity and meetings for week {weekNo(reviewWeek)}; renewals and revenue retained count rows marked agreed or saved above.</>
                    : <>Actuals come from CRM activity, call plans and closed won deals for week {weekNo(reviewWeek)}.</>}
                  {targetSource && <> Targets: {Array.from(new Set(kpiDefs.map(k => TARGET_SOURCE_LABEL[targetSource[k.target]]))).join(', ')}.</>}
                  {' '}Targets are set by your leader.
                </p>
              </div>
              <LeaderNotesView field="kpis" team={teamNotes} person={personNotes} personName={isOwn ? undefined : activeUserName} />
              {(plan.keyFocusMetrics.trim() || plan.individualCommitment.trim()) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {plan.keyFocusMetrics.trim() && <div className="rounded-xl bg-surface-2/50 p-3"><p className="text-sm font-semibold text-foreground">Key focus metrics</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{plan.keyFocusMetrics}</p></div>}
                  {plan.individualCommitment.trim() && <div className="rounded-xl bg-surface-2/50 p-3"><p className="text-sm font-semibold text-foreground">Individual commitment</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{plan.individualCommitment}</p></div>}
                </div>
              )}
            </SectionCard>

            {/* 5. Priorities */}
            <SectionCard section={sec('priorities')} complete={completeIds.includes('priorities')}>
              <ol className="space-y-3">
                {plan.topPriorities.map((t, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold', i === 0 ? 'bg-cta text-white' : 'bg-surface-2 text-foreground')}>{i + 1}</span>
                    <Input disabled={readOnly} aria-label={`Priority ${i + 1}`} placeholder={['Most important outcome this week', 'Second priority', 'Third priority'][i]} value={t}
                      onChange={e => update(p => {
                        const next = [...p.topPriorities] as NwaPlan['topPriorities'];
                        next[i] = e.target.value;
                        return { ...p, topPriorities: next };
                      })} />
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* 6. Challenges */}
            <SectionCard section={sec('challenges')} complete={completeIds.includes('challenges')}>
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ['slowingProgress', 'What’s slowing progress?'],
                  ['customerIssues', 'Customer issues'],
                  ['internalIssues', 'Internal issues'],
                  ['resourcesRequired', 'Resources required'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <FieldLabel htmlFor={`ch-${key}`}>{label}</FieldLabel>
                    <Textarea id={`ch-${key}`} rows={3} disabled={readOnly} value={plan.challenges[key]} onChange={e => update(p => ({ ...p, challenges: { ...p.challenges, [key]: e.target.value } }))} />
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* 7. Business updates */}
            <SectionCard section={sec('updates')} complete={completeIds.includes('updates')}>
              {businessUpdatesBody}
              <LeaderNotesView field="updates" team={teamNotes} person={personNotes} personName={isOwn ? undefined : activeUserName} />
            </SectionCard>

            {/* 8. Commitments */}
            <SectionCard section={sec('commitments')} complete={completeIds.includes('commitments')}>
              <p className="text-sm text-muted-foreground">These come back next Monday to mark done, partly done or not done.</p>
              <div className="space-y-2">
                {plan.commitments.map((c, i) => (
                  <CommitmentRow key={c.id} c={c} readOnly={readOnly} defaultOwner={activeUserName}
                    onChange={next => update(p => ({ ...p, commitments: p.commitments.map((x, j) => (j === i ? next : x)) }))}
                    onRemove={() => update(p => ({ ...p, commitments: p.commitments.filter((_, j) => j !== i) }))} />
                ))}
              </div>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => update(p => ({ ...p, commitments: [...p.commitments, { id: nwaId('c'), text: '', owner: activeUserName, dueDate: '' }] }))}>
                  <Plus className="mr-1.5 h-4 w-4" />Add commitment
                </Button>
              )}
            </SectionCard>

            {/* Post-meeting manager note */}
            {(isLeader || stored?.managerNote) && (
              <section className="rounded-2xl border border-border bg-surface-2/40 p-5">
                <SubHeading hint={isLeader ? 'Optional. Add after the meeting; the rep sees it on their TWA.' : undefined}>Manager note</SubHeading>
                {isLeader ? (
                  <div className="mt-3 space-y-3">
                    <Textarea rows={3} value={managerNote} onChange={e => setManagerNote(e.target.value)} placeholder="Coaching points, agreed follow-ups…" />
                    <div className="flex items-center gap-3">
                      <Button variant="outline" onClick={saveManagerNote} disabled={saving === 'note'}>{saving === 'note' ? 'Saving…' : 'Save note'}</Button>
                      {stored?.managerNoteBy && <span className="text-xs text-muted-foreground">Last saved by {stored.managerNoteBy}</span>}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{stored.managerNote}<span className="mt-1 block text-xs text-muted-foreground">{stored.managerNoteBy}</span></p>
                )}
              </section>
            )}

            {/* KPI snapshot tiles for quick reference */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Stalled deals" value={suggestions.stalled.length} sub={`${STALL_DAYS}+ days, no movement`} tone={suggestions.stalled.length ? 'warn' : 'good'} />
              <StatTile label="Closed won" value={suggestions.closedWon.length} sub={money(actuals.revenue)} tone={suggestions.closedWon.length ? 'good' : 'default'} />
              <StatTile label="Appointments booked" value={view.appointments.filter(a => a.customer).length} sub={`Week ${weekNo(planWeek)}`} />
              <StatTile label="Follow-through" value={avgScore === null ? '–' : `${avgScore}%`} sub={`Last ${trend.length} weeks`} tone={avgScore === null ? 'default' : avgScore >= 80 ? 'good' : avgScore >= 50 ? 'warn' : 'bad'} />
            </div>
          </div>
        </>
      )}

      {/* Sticky action bar */}
      {!teamView && !loading && !readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
            <p className="text-sm text-muted-foreground">
              {dirty ? 'Unsaved changes' : submitted ? 'Submitted. You can still update it before the meeting.' : 'Save a draft any time.'}
              {!isOwn && <span className="ml-2 font-medium text-foreground">Editing {activeUserName}’s TWA</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => persist('draft')} disabled={!!saving}><Save className="mr-1.5 h-4 w-4" />{saving === 'draft' ? 'Saving…' : 'Save draft'}</Button>
              <Button onClick={() => persist('submit')} disabled={!!saving} className="bg-cta text-white hover:bg-cta/90">
                <Send className="mr-1.5 h-4 w-4" />{saving === 'submit' ? 'Submitting…' : submitted ? 'Update submission' : 'Submit TWA'}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function CommitmentRow({ c, readOnly, defaultOwner, onChange, onRemove }: { c: NwaCommitment; readOnly: boolean; defaultOwner: string; onChange: (c: NwaCommitment) => void; onRemove: () => void }) {
  return (
    <div className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[minmax(0,1fr)_180px_160px_auto]">
      <Input aria-label="Commitment" placeholder="I will…" disabled={readOnly} value={c.text} onChange={e => onChange({ ...c, text: e.target.value })} />
      <Input aria-label="Owner" placeholder={defaultOwner || 'Owner'} list="nwa-teammates" disabled={readOnly} value={c.owner} onChange={e => onChange({ ...c, owner: e.target.value })} />
      <Input aria-label="Due date" type="date" disabled={readOnly} value={c.dueDate} onChange={e => onChange({ ...c, dueDate: e.target.value })} />
      {!readOnly ? <Button variant="ghost" size="icon" aria-label="Remove commitment" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button> : <span />}
    </div>
  );
}

export { BusinessUpdatesView } from './nwa-readonly';
