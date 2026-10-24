"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import {
  AlertTriangle, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileClock, History, Lock, Megaphone, Plus, Save, Send, Sparkles, Target, Trash2, Users,
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
  KPI_TARGET_KEYS, NWA_ACCOUNTS_OPTIONAL, NWA_MEETING_MINUTES, PIPELINE_GROUPS, STALL_DAYS,
  type KpiTargetSource, type NwaAppointment, type NwaBusinessUpdates, type NwaCommitment, type NwaDealRow, type NwaKpiTargets, type NwaPlan,
  type NwaSectionId, type PipelineKey,
  accountOptions, accountSignals, buildNwaPayload, businessUpdatesDocId, callPlanToAppointment, carryForwardAccounts, closedWonLines,
  computeActuals, dealToRow, emptyDealRow, emptyNwaPlan, followThroughScore, followThroughTrend, hasBusinessUpdates, isAmRole,
  isLegacyFridayDoc, isSubmittedStatus, kpiDefsFor, kpiRoleGroup, latestDeals, legacyFridaySnapshot, mapStoredNwa, mergeCommitmentReview,
  nwaDueAt, nwaDueState, nwaId, nwaMeetingAt, nwaSectionsFor, pipelineSuggestions, previousCommitmentsFrom, resolveBusinessUpdates,
  resolveKpiTargets, sectionComplete, signalToAtRiskRow, averageScore,
} from '@/lib/nwa';
import {
  DueChip, EmptyHint, FieldLabel, FollowThroughBars, OutcomeToggle, ScoreChip, SectionCard, StatTile, SubHeading, TimeChip,
} from './nwa-ui';
import { LegacyFridaySummary } from './nwa-legacy';
import { AccountMgmtEditor, HandoverEditor } from './nwa-accounts';

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
  const [saving, setSaving] = useState<'draft' | 'submit' | 'note' | 'updates' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [managerNote, setManagerNote] = useState('');
  const prefilled = useRef({ wins: false, appts: false, atRisk: false });
  const [targetSource, setTargetSource] = useState<Record<keyof NwaKpiTargets, KpiTargetSource> | null>(null);
  const [teamTargetsDoc, setTeamTargetsDoc] = useState<any>(null);
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
    prefilled.current = { wins: false, appts: false, atRisk: false };
    setLegacyConversion(null);
    setShowOriginal(false);
    (async () => {
      // Target sources are optional: a missing doc or a permissions error falls back to defaults.
      const safeGet = (path: [string, string]) => getDoc(doc(db, path[0], path[1])).then(d => (d.exists() ? d.data() : null)).catch(() => null);
      try {
        const [userDoc, statsDoc, teamTargets] = await Promise.all([
          safeGet(['users', activeUserId]), safeGet(['bdmStats', activeUserId]), safeGet(['appSettings', 'nwaKpiTargets']),
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
        setTargetSource(data ? null : resolved.source);
        setTeamTargetsDoc(teamTargets);
        mapped.commitmentReview = mergeCommitmentReview(mapped.commitmentReview, previousCommitmentsFrom(prev));
        setStored(data);
        setPrevDoc(prev);
        setHistory(histSnap.docs.map(d => d.data()));
        setProgress(progSnap.docs[0]?.data() || null);
        setPlan(mapped);
        setManagerNote(data?.managerNote || data?.adminCoachingNotes || '');
        setDirty(false);
      } catch (err: any) {
        if (!cancelled) toast({ variant: 'destructive', title: 'Couldn’t load the NWA', description: err?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [db, activeUserId, activeRole, planWeek, reviewWeek, toast]);

  // ─── CRM and call plan data ────────────────────────────────────────────────
  const deals = useMemo(() => latestDeals((pipelineReviews || []).filter((d: any) => d.userId === activeUserId)), [pipelineReviews, activeUserId]);
  const suggestions = useMemo(() => pipelineSuggestions(deals, reviewWeek), [deals, reviewWeek]);
  const activity = useMemo(() => (weeklyProgresses || []).filter((p: any) => p.userId === activeUserId && p.week === reviewWeek), [weeklyProgresses, activeUserId, reviewWeek]);

  const planCallPlansQ = useMemoFirebase(() => (db && activeUserId ? query(collection(db, 'callPlans'), where('userId', '==', activeUserId), where('week', '==', planWeek)) : null), [db, activeUserId, planWeek]);
  const reviewCallPlansQ = useMemoFirebase(() => (db && activeUserId ? query(collection(db, 'callPlans'), where('userId', '==', activeUserId), where('week', '==', reviewWeek)) : null), [db, activeUserId, reviewWeek]);
  const { data: planCallPlans } = useCollection<any>(planCallPlansQ);
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

  // Pre-fill a new plan: closed won deals into wins, call plans into appointments.
  useEffect(() => {
    if (loading || stored || readOnly) return;
    if (!prefilled.current.wins && suggestions.closedWon.length) {
      prefilled.current.wins = true;
      setPlan(p => (p.wins.closedOpportunities ? p : { ...p, wins: { ...p.wins, closedOpportunities: closedWonLines(suggestions.closedWon) } }));
    }
    if (!prefilled.current.appts && planCallPlans?.length) {
      prefilled.current.appts = true;
      setPlan(p => (p.appointments.length ? p : { ...p, appointments: planCallPlans.map(callPlanToAppointment) }));
    }
    // Account managers: CRM-flagged at-risk accounts (top 5) on a new plan.
    if (isAm && !prefilled.current.atRisk && signals.length) {
      prefilled.current.atRisk = true;
      setPlan(p => {
        const have = new Set(p.accounts.atRisk.map(r => r.accountId).filter(Boolean));
        const add = signals.filter(sg => !have.has(sg.id)).slice(0, 5).map(signalToAtRiskRow);
        return add.length ? { ...p, accounts: { ...p.accounts, atRisk: [...p.accounts.atRisk, ...add] } } : p;
      });
    }
  }, [loading, stored, readOnly, suggestions.closedWon, planCallPlans, isAm, signals]);

  // ─── Business updates (leader-owned, team-wide) ────────────────────────────
  // One doc per week (appSettings/nwaBusinessUpdates_{week}); the old shared doc's byWeek map is the fallback.
  const updatesRef = useMemoFirebase(() => (db ? doc(db, 'appSettings', businessUpdatesDocId(planWeek)) : null), [db, planWeek]);
  const legacyUpdatesRef = useMemoFirebase(() => (db ? doc(db, 'appSettings', 'nwaBusinessUpdates') : null), [db]);
  const { data: updatesDoc } = useDoc<any>(updatesRef);
  const { data: legacyUpdatesDoc } = useDoc<any>(legacyUpdatesRef);
  const savedUpdates = useMemo(() => resolveBusinessUpdates(updatesDoc, legacyUpdatesDoc, planWeek), [updatesDoc, legacyUpdatesDoc, planWeek]);
  const [updatesDraft, setUpdatesDraft] = useState<NwaBusinessUpdates>(savedUpdates);
  const [editingUpdates, setEditingUpdates] = useState(false);
  useEffect(() => { if (!editingUpdates) setUpdatesDraft(savedUpdates); }, [savedUpdates, editingUpdates]);

  const saveUpdates = async () => {
    if (!db || !isLeader) return;
    setSaving('updates');
    try {
      const { updatedBy: _b, updatedAt: _a, ...fields } = updatesDraft;
      await setDoc(doc(db, 'appSettings', businessUpdatesDocId(planWeek)), {
        ...fields, week: planWeek, updatedBy: profile?.name || user?.email || 'Leader', updatedAt: serverTimestamp(),
      }, { merge: true });
      setEditingUpdates(false);
      toast({ title: 'Business updates saved', description: `Everyone will see them on the week ${weekNo(planWeek)} NWA.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Couldn’t save updates', description: err?.message || 'Only leaders can edit business updates.' });
    } finally {
      setSaving(null);
    }
  };

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
  const completeIds = sections.filter(s => sectionComplete(plan, s.id, activeRole)).map(s => s.id);
  const completePct = Math.round((completeIds.length / sections.length) * 100);
  const hasAccountData = plan.accounts.atRisk.length + plan.accounts.renewals.length + plan.accounts.growth.length > 0;
  const lastTargetFor = (k: keyof NwaKpiTargets) => (lastTargets ? lastTargets[k] : 0);

  // ─── Legacy Friday FW → NWA ───────────────────────────────────────────────
  // The plan state already holds the legacy doc mapped onto NWA fields; saving keeps the original fields
  // and stores a snapshot in legacyFriday so the original stays viewable.
  const startNwaFromLegacy = () => {
    if (!stored || !canEdit) return;
    setLegacyConversion(stored.legacyFriday || legacyFridaySnapshot(stored));
    setDirty(true);
    toast({ title: 'Started an NWA from the Friday FW', description: 'The original is kept and stays viewable. Save a draft to keep the conversion.' });
  };

  const saveTeamTargets = async () => {
    if (!db || !isLeader) return;
    const group = kpiRoleGroup(activeRole);
    const keys = kpiDefs.map(k => k.target);
    const values = Object.fromEntries(KPI_TARGET_KEYS.filter(k => keys.includes(k)).map(k => [k, Number(plan.kpiTargets[k]) || 0]));
    try {
      await setDoc(doc(db, 'appSettings', 'nwaKpiTargets'), {
        byRole: { [group]: { ...values, updatedBy: profile?.name || user?.email || 'Leader', updatedAt: serverTimestamp() } },
      }, { merge: true });
      setTeamTargetsDoc((d: any) => ({ ...(d || {}), byRole: { ...(d?.byRole || {}), [group]: values } }));
      toast({ title: `${group} team targets saved`, description: 'New NWAs for this role start with these targets unless a person has their own.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Couldn’t save team targets', description: err?.message || 'Only leaders can set team targets.' });
    }
  };

  // ─── Save / submit ─────────────────────────────────────────────────────────
  const persist = async (mode: 'draft' | 'submit') => {
    if (!db || !activeUserId) return;
    if (mode === 'submit') {
      const missing = sections.filter(s => s.id !== 'updates' && !sectionComplete(plan, s.id, activeRole));
      if (missing.some(s => s.id === 'priorities' || s.id === 'commitments')) {
        toast({ variant: 'destructive', title: 'Almost there', description: 'Add your top 3 priorities and at least one commitment before submitting.' });
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
        ...buildNwaPayload(plan, { kpiActuals: actuals, role: activeRole }),
        ...(legacyConversion && !stored?.legacyFriday ? { legacyFriday: legacyConversion, convertedFromLegacyAt: serverTimestamp(), convertedFromLegacyBy: profile?.name || user?.email || activeUserName } : {}),
        status: nextStatus,
        dueAt: dueAt ?? null,
        updatedAt: serverTimestamp(),
        ...(mode === 'submit' ? { submittedAt: serverTimestamp(), submittedLate: dueAt !== null && now > dueAt } : {}),
        ...(!stored ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true });
      if (mode === 'submit') {
        const c = plan.challenges;
        await setDoc(doc(db, 'weeklyReports', `${activeUserId}_${reviewWeek}`), {
          userId: activeUserId,
          userName: activeUserName,
          week: reviewWeek,
          nwaSubmitted: true,
          nwaFormVersion: 'NWA_V2',
          weeklyNotes: [plan.wins.customerWins, plan.wins.positiveFeedback].filter(Boolean).join('\n'),
          roadblocks: [c.slowingProgress, c.customerIssues, c.internalIssues].filter(Boolean).join('\n'),
          supportNeeded: c.resourcesRequired,
          summary: {
            totalEAV: suggestions.progressing.reduce((s, d) => s + (Number(d.value) || 0), 0) + actuals.revenue,
            newOpportunitiesCount: plan.pipeline.created.filter(r => r.account.trim()).length,
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
        ...(s || {}), ...buildNwaPayload(plan, { kpiActuals: actuals, role: activeRole }), status: nextStatus, formVersion: 'NWA_V2',
        ...(legacyConversion && !s?.legacyFriday ? { legacyFriday: legacyConversion } : {}),
      }));
      setLegacyConversion(null);
      setDirty(false);
      toast({
        title: mode === 'submit' ? 'NWA submitted' : 'Draft saved',
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
      toast({ title: 'Manager note saved', description: `${activeUserName} can see it on their NWA.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Couldn’t save note', description: err?.message });
    } finally {
      setSaving(null);
    }
  };

  // ─── Row helpers ────────────────────────────────────────────────────────────
  const setDealRows = (key: PipelineKey, rows: NwaDealRow[]) => update(p => ({ ...p, pipeline: { ...p.pipeline, [key]: rows } }));
  const addDeals = (key: PipelineKey, ds: any[]) => update(p => {
    const have = new Set(Object.values(p.pipeline).flat().map(r => r.crmId).filter(Boolean));
    const rows = ds.filter(d => !have.has(d.id)).map(d => dealToRow(d));
    return rows.length ? { ...p, pipeline: { ...p.pipeline, [key]: [...p.pipeline[key], ...rows] } } : p;
  });
  const usedCrmIds = new Set(Object.values(plan.pipeline).flat().map(r => r.crmId).filter(Boolean) as string[]);
  const suggestionFor: Record<PipelineKey, any[]> = {
    progressing: suggestions.progressing,
    stalled: suggestions.stalled,
    created: suggestions.created,
    handedOver: [],
  };
  const teammateNames = useMemo(() => teamUsers.map(u => u.name).filter(n => n && n !== activeUserName), [teamUsers, activeUserName]);

  if (!activeUserId) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-28">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Monday team meeting · {NWA_MEETING_MINUTES} min</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Next week’s activity</h1>
            <p className="text-sm text-muted-foreground">
              Week {weekNo(planWeek)}
              {meetingAt && <> · meeting {formatPerth(meetingAt, { weekday: 'long', day: 'numeric', month: 'short' })}</>}
              {dueAt && <> · due {formatPerth(dueAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (Perth)</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DueChip state={dueState} />
            {status === 'DRAFT' && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground">Draft</span>}
            <ScoreChip score={avgScore} label="Follow-through avg" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-border bg-surface-2/50 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous week" onClick={() => setPlanWeek(w => getPreviousWeekKey(w))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[7rem] px-2 text-center text-sm font-semibold tabular-nums">Week {weekNo(planWeek)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next week" disabled={planWeek >= currentPlanWeek} onClick={() => setPlanWeek(w => getNextWeekKey(w))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          {isPastWeek && <Button variant="outline" size="sm" onClick={() => setPlanWeek(currentPlanWeek)}>Back to this week</Button>}
          {isLeader && teamUsers.length > 0 && (
            <Select value={selectedRepId} onValueChange={setSelectedRepId}>
              <SelectTrigger className="h-10 w-[220px]" aria-label="Team member"><Users className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Team member" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={userId}>{userName} (me)</SelectItem>
                {teamUsers.filter(u => u.id !== userId).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex min-w-[180px] items-center gap-3">
            <Progress value={completePct} className="h-2 w-32" aria-label="Sections complete" />
            <span className="text-xs font-medium text-muted-foreground">{completeIds.length} of {sections.length} sections</span>
          </div>
        </div>

        {readOnly && !legacy && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2/60 px-4 py-2.5 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> {isPastWeek ? 'Past weeks are read-only.' : 'Read-only.'}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">{[0, 1, 2].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2/60" />)}</div>
      ) : legacy ? (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">This week was filed on the old Friday FW form. Start an NWA from it; the original stays viewable.</p>
              <Button onClick={startNwaFromLegacy} className="bg-cta text-white hover:bg-cta/90"><ArrowRight className="mr-1.5 h-4 w-4" />Start NWA</Button>
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
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Agenda rail */}
          <nav aria-label="Meeting agenda" className="hidden lg:block">
            <div className="sticky top-24 space-y-1 rounded-2xl border border-border bg-card p-3">
              <p className="px-2 pb-2 text-sm font-semibold text-foreground">Agenda</p>
              {sections.map(s => (
                <a key={s.id} href={`#nwa-${s.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-surface-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold', completeIds.includes(s.id) ? 'bg-success-soft text-success-ink' : 'bg-surface-2 text-muted-foreground')}>{s.step}</span>
                    <span className="truncate">{s.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.minutes}m</span>
                </a>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-border px-2 pt-2 text-xs text-muted-foreground">
                <span>Total</span><span className="font-semibold">{NWA_MEETING_MINUTES} min</span>
              </div>
            </div>
          </nav>

          <div className="space-y-6">
            {/* Last week's commitments */}
            <section id="nwa-review" className="scroll-mt-24 rounded-2xl border border-border bg-card shadow-sm">
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

            {/* 1. Wins */}
            <SectionCard section={sec('wins')} complete={completeIds.includes('wins')}>
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ['customerWins', 'Customer wins', 'What went well with customers?'],
                  ['closedOpportunities', 'Closed opportunities', 'Pre-filled from CRM closed won deals'],
                  ['positiveFeedback', 'Positive feedback', 'Quotes or feedback worth sharing'],
                  ['teamRecognition', 'Team recognition', 'Who helped you get there?'],
                ] as const).map(([key, label, hint]) => (
                  <div key={key} className="space-y-2">
                    <FieldLabel htmlFor={`win-${key}`} hint={hint}>{label}</FieldLabel>
                    <Textarea id={`win-${key}`} rows={3} disabled={readOnly} value={plan.wins[key]} onChange={e => update(p => ({ ...p, wins: { ...p.wins, [key]: e.target.value } }))} />
                  </div>
                ))}
              </div>
              {suggestions.closedWon.length > 0 && !readOnly && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-accent" /> {suggestions.closedWon.length} closed won in CRM for week {weekNo(reviewWeek)}
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => update(p => ({ ...p, wins: { ...p.wins, closedOpportunities: closedWonLines(suggestions.closedWon) } }))}>Refresh from CRM</Button>
                </div>
              )}
              <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
                <SubHeading hint="Call out a teammate in the meeting.">Shout-out</SubHeading>
                <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                  <Input list="nwa-teammates" placeholder="Teammate" disabled={readOnly} value={plan.wins.shoutOut.teammate} onChange={e => update(p => ({ ...p, wins: { ...p.wins, shoutOut: { ...p.wins.shoutOut, teammate: e.target.value } } }))} />
                  <Input placeholder="What for?" disabled={readOnly} value={plan.wins.shoutOut.reason} onChange={e => update(p => ({ ...p, wins: { ...p.wins, shoutOut: { ...p.wins.shoutOut, reason: e.target.value } } }))} />
                  <datalist id="nwa-teammates">{teammateNames.map(n => <option key={n} value={n} />)}</datalist>
                </div>
              </div>
            </SectionCard>

            {/* 2. Appointments */}
            <SectionCard
              section={sec('appointments')}
              complete={completeIds.includes('appointments')}
              actions={!readOnly && (planCallPlans?.length || 0) > 0 ? (
                <Button variant="outline" size="sm" onClick={() => update(p => {
                  const have = new Set(p.appointments.map(a => a.customer.toLowerCase()));
                  const add = (planCallPlans || []).map(callPlanToAppointment).filter(a => a.customer && !have.has(a.customer.toLowerCase()));
                  return { ...p, appointments: [...p.appointments, ...add] };
                })}><CalendarDays className="mr-1.5 h-4 w-4" />Add from call plans</Button>
              ) : undefined}
            >
              {plan.appointments.length === 0 && <EmptyHint>No appointments yet. Call plans for week {weekNo(planWeek)} appear here automatically.</EmptyHint>}
              <div className="space-y-3">
                {plan.appointments.map((a, i) => (
                  <AppointmentRow key={a.id} a={a} readOnly={readOnly}
                    onChange={next => update(p => ({ ...p, appointments: p.appointments.map((x, j) => (j === i ? next : x)) }))}
                    onRemove={() => update(p => ({ ...p, appointments: p.appointments.filter((_, j) => j !== i) }))} />
                ))}
              </div>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => update(p => ({ ...p, appointments: [...p.appointments, { id: nwaId('appt'), customer: '', date: '', meetingType: 'Face to face', purpose: '', desiredOutcome: '', supportRequired: '', source: 'manual' }] }))}>
                  <Plus className="mr-1.5 h-4 w-4" />Add appointment
                </Button>
              )}
            </SectionCard>

            {/* 3. Pipeline */}
            <SectionCard section={sec('pipeline')} complete={completeIds.includes('pipeline')}>
              {PIPELINE_GROUPS.filter(g => g.key !== 'handedOver').map(g => {
                const rows = plan.pipeline[g.key];
                const avail = suggestionFor[g.key].filter(d => !usedCrmIds.has(d.id));
                return (
                  <div key={g.key} className="space-y-3">
                    <SubHeading
                      hint={g.hint}
                      right={g.key === 'stalled' && suggestions.stalled.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-ink">
                          <AlertTriangle className="h-3.5 w-3.5" />{suggestions.stalled.length} flagged in CRM
                        </span>
                      ) : undefined}
                    >{g.title}</SubHeading>
                    {rows.map((r, i) => (
                      <DealRowEditor key={r.id} row={r} notePlaceholder={g.notePlaceholder} readOnly={readOnly} stalled={g.key === 'stalled'}
                        onChange={next => setDealRows(g.key, rows.map((x, j) => (j === i ? next : x)))}
                        onRemove={() => setDealRows(g.key, rows.filter((_, j) => j !== i))} />
                    ))}
                    {!readOnly && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDealRows(g.key, [...rows, emptyDealRow()])}><Plus className="mr-1.5 h-4 w-4" />Add</Button>
                        {avail.length > 0 && (
                          <>
                            {g.key === 'stalled' && avail.length > 1 && (
                              <Button variant="secondary" size="sm" onClick={() => addDeals('stalled', avail)}>Add all {avail.length} flagged</Button>
                            )}
                            {avail.slice(0, 6).map(d => (
                              <button key={d.id} type="button" onClick={() => addDeals(g.key, [d])}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/50 px-3 py-1 text-xs font-medium text-foreground hover:bg-surface-2">
                                <Plus className="h-3 w-3" />{d.opportunityName || d.pipeline}
                                {Number(d.value) > 0 && <span className="text-muted-foreground">{formatEAV(Number(d.value))}</span>}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="space-y-3">
                <SubHeading hint={PIPELINE_GROUPS.find(g => g.key === 'handedOver')?.hint || 'Accounts moving to or from a teammate.'}>Accounts handed over</SubHeading>
                <HandoverEditor value={plan.accounts.handovers} readOnly={readOnly} options={acctOptions} people={people}
                  defaultFrom={{ id: activeUserId, name: activeUserName }}
                  onChange={rows => update(p => ({ ...p, accounts: { ...p.accounts, handovers: rows } }))} />
              </div>
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
                      const target = lastTargetFor(k.target);
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
                          <td className="py-2">
                            <Input type="number" min={0} inputMode="numeric" className="h-9 w-32" disabled={readOnly} aria-label={`${k.label} target`}
                              value={plan.kpiTargets[k.target] || ''}
                              onChange={e => update(p => ({ ...p, kpiTargets: { ...p.kpiTargets, [k.target]: Number(e.target.value) || 0 } }))} />
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
                </p>
                {isLeader && !readOnly && (
                  <Button variant="outline" size="sm" onClick={saveTeamTargets} title={teamTargetsDoc?.byRole?.[kpiRoleGroup(activeRole)] ? 'Replaces the current team targets' : undefined}>
                    <Target className="mr-1.5 h-4 w-4" />Save as {kpiRoleGroup(activeRole)} team targets
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel htmlFor="nwa-focus" hint="The one or two numbers that matter most this week.">Key focus metrics</FieldLabel>
                  <Textarea id="nwa-focus" rows={2} disabled={readOnly} value={plan.keyFocusMetrics} onChange={e => update(p => ({ ...p, keyFocusMetrics: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="nwa-indiv" hint="What you personally commit to hitting.">Individual commitment</FieldLabel>
                  <Textarea id="nwa-indiv" rows={2} disabled={readOnly} value={plan.individualCommitment} onChange={e => update(p => ({ ...p, individualCommitment: e.target.value }))} />
                </div>
              </div>
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
            <SectionCard
              section={sec('updates')}
              actions={isLeader && !editingUpdates ? <Button variant="outline" size="sm" onClick={() => setEditingUpdates(true)}><Megaphone className="mr-1.5 h-4 w-4" />Edit</Button> : undefined}
            >
              {editingUpdates ? (
                <div className="space-y-4">
                  <BusinessUpdateFields value={updatesDraft} onChange={setUpdatesDraft} />
                  <div className="flex gap-2">
                    <Button onClick={saveUpdates} disabled={saving === 'updates'}>{saving === 'updates' ? 'Saving…' : 'Save for everyone'}</Button>
                    <Button variant="ghost" onClick={() => { setEditingUpdates(false); setUpdatesDraft(savedUpdates); }}>Cancel</Button>
                  </div>
                </div>
              ) : hasBusinessUpdates(savedUpdates) ? (
                <BusinessUpdatesView value={savedUpdates} />
              ) : (
                <EmptyHint>{isLeader ? 'No updates yet. Add them once and everyone sees them read-only.' : 'Your leader hasn’t posted updates for this week yet.'}</EmptyHint>
              )}
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
                <SubHeading hint={isLeader ? 'Optional. Add after the meeting; the rep sees it on their NWA.' : undefined}>Manager note</SubHeading>
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
              <StatTile label="Appointments booked" value={plan.appointments.filter(a => a.customer).length} sub={`Week ${weekNo(planWeek)}`} />
              <StatTile label="Follow-through" value={avgScore === null ? '–' : `${avgScore}%`} sub={`Last ${trend.length} weeks`} tone={avgScore === null ? 'default' : avgScore >= 80 ? 'good' : avgScore >= 50 ? 'warn' : 'bad'} />
            </div>
          </div>
        </div>
        </>
      )}

      {/* Sticky action bar */}
      {!loading && !readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
            <p className="text-sm text-muted-foreground">
              {dirty ? 'Unsaved changes' : submitted ? 'Submitted. You can still update it before the meeting.' : 'Save a draft any time.'}
              {!isOwn && <span className="ml-2 font-medium text-foreground">Editing {activeUserName}’s NWA</span>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => persist('draft')} disabled={!!saving}><Save className="mr-1.5 h-4 w-4" />{saving === 'draft' ? 'Saving…' : 'Save draft'}</Button>
              <Button onClick={() => persist('submit')} disabled={!!saving} className="bg-cta text-white hover:bg-cta/90">
                <Send className="mr-1.5 h-4 w-4" />{saving === 'submit' ? 'Submitting…' : submitted ? 'Update submission' : 'Submit NWA'}
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

function AppointmentRow({ a, readOnly, onChange, onRemove }: { a: NwaAppointment; readOnly: boolean; onChange: (a: NwaAppointment) => void; onRemove: () => void }) {
  const set = (patch: Partial<NwaAppointment>) => onChange({ ...a, ...patch });
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
        <Input aria-label="Customer" placeholder="Customer" disabled={readOnly} value={a.customer} onChange={e => set({ customer: e.target.value })} />
        <Input aria-label="Date" type="date" disabled={readOnly} value={a.date} onChange={e => set({ date: e.target.value })} />
        <Input aria-label="Meeting type" placeholder="Meeting type" disabled={readOnly} value={a.meetingType} onChange={e => set({ meetingType: e.target.value })} />
        <div className="flex items-center justify-end gap-2">
          {a.source === 'callPlan' && <span className="rounded-full bg-info-soft px-2 py-0.5 text-xs font-medium text-info">Call plan</span>}
          {!readOnly && <Button variant="ghost" size="icon" aria-label="Remove appointment" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Textarea rows={2} aria-label="Why we’re meeting" placeholder="Why we’re meeting" disabled={readOnly} value={a.purpose} onChange={e => set({ purpose: e.target.value })} />
        <Textarea rows={2} aria-label="Desired outcome" placeholder="Desired outcome" disabled={readOnly} value={a.desiredOutcome} onChange={e => set({ desiredOutcome: e.target.value })} />
        <Textarea rows={2} aria-label="Support required" placeholder="Support required" disabled={readOnly} value={a.supportRequired} onChange={e => set({ supportRequired: e.target.value })} />
      </div>
    </div>
  );
}

function DealRowEditor({ row, notePlaceholder, readOnly, stalled, onChange, onRemove }: {
  row: NwaDealRow; notePlaceholder: string; readOnly: boolean; stalled: boolean; onChange: (r: NwaDealRow) => void; onRemove: () => void;
}) {
  const set = (patch: Partial<NwaDealRow>) => onChange({ ...row, ...patch });
  return (
    <div className={cn('rounded-xl border p-3', row.autoFlagged ? 'border-warning/50 bg-warning-soft/30' : 'border-border')}>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1.2fr)_150px_auto]">
        <Input aria-label="Account" placeholder="Account / opportunity" disabled={readOnly} value={row.account} onChange={e => set({ account: e.target.value })} />
        <Input aria-label="Value" type="number" min={0} placeholder="Value $" disabled={readOnly} value={row.value || ''} onChange={e => set({ value: Number(e.target.value) || 0 })} />
        <Input aria-label="Next step" placeholder="Next step" disabled={readOnly} value={row.nextStep} onChange={e => set({ nextStep: e.target.value })} />
        <Input aria-label="Next step date" type="date" disabled={readOnly} value={row.nextStepDate} onChange={e => set({ nextStepDate: e.target.value })} />
        {!readOnly ? <Button variant="ghost" size="icon" aria-label="Remove" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button> : <span />}
      </div>
      <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
        <Input aria-label={notePlaceholder} placeholder={notePlaceholder} disabled={readOnly} value={row.note} onChange={e => set({ note: e.target.value })} className={cn(stalled && !row.note && 'border-warning/60')} />
        {typeof row.daysWithoutMovement === 'number' && (
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', row.autoFlagged ? 'bg-warning-soft text-warning-ink' : 'bg-surface-2 text-muted-foreground')}>
            {row.daysWithoutMovement} days without movement
          </span>
        )}
      </div>
    </div>
  );
}

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

const UPDATE_FIELDS: { key: 'pricingChanges' | 'productUpdates' | 'competitorActivity' | 'other'; label: string }[] = [
  { key: 'pricingChanges', label: 'Pricing changes' },
  { key: 'productUpdates', label: 'Product updates' },
  { key: 'competitorActivity', label: 'Competitor activity' },
  { key: 'other', label: 'Other' },
];

function BusinessUpdateFields({ value, onChange }: { value: NwaBusinessUpdates; onChange: (v: NwaBusinessUpdates) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {UPDATE_FIELDS.map(f => (
        <div key={f.key} className="space-y-2">
          <FieldLabel htmlFor={`bu-${f.key}`}>{f.label}</FieldLabel>
          <Textarea id={`bu-${f.key}`} rows={3} value={value[f.key]} onChange={e => onChange({ ...value, [f.key]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

export function BusinessUpdatesView({ value, large }: { value: NwaBusinessUpdates; large?: boolean }) {
  return (
    <div className={cn('grid gap-4', large ? 'md:grid-cols-2' : 'md:grid-cols-2')}>
      {UPDATE_FIELDS.filter(f => value[f.key]?.trim()).map(f => (
        <div key={f.key} className="rounded-xl bg-surface-2/50 p-4">
          <p className={cn('font-semibold text-foreground', large ? 'text-base' : 'text-sm')}>{f.label}</p>
          <p className={cn('mt-1 whitespace-pre-wrap text-muted-foreground', large ? 'text-lg' : 'text-sm')}>{value[f.key]}</p>
        </div>
      ))}
      {value.updatedBy && <p className="text-xs text-muted-foreground md:col-span-2">Posted by {value.updatedBy}</p>}
    </div>
  );
}

