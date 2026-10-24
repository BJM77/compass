"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import {
  AlertTriangle, Briefcase, ChevronLeft, ChevronRight, Expand, Heart, ListChecks, Minimize, Pause, Play, RotateCcw, Target, Trophy, Users,
} from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useTeamUsers, type UnifiedTeamUser } from '@/hooks/use-team-users';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn, getNextWeekKey, getNwaReviewWeek, getPreviousWeekKey } from '@/lib/utils';
import {
  HANDOVER_STATUS_LABEL, NWA_MEETING_MINUTES, NWA_SECTIONS, NWA_SECTIONS_AM, RENEWAL_STATUS_LABEL, RENEWAL_TYPE_LABEL, averageScore,
  businessUpdatesDocId, followThroughScore, followThroughTrend, hasBusinessUpdates, isAmRole, isLegacyFridayDoc, isStalledDeal,
  isSubmittedStatus, latestDeals, mapStoredNwa, nwaDueState, previousCommitmentsFrom, mergeCommitmentReview, resolveBusinessUpdates,
  totalRevenueAtRisk,
} from '@/lib/nwa';
import { DueChip, EmptyHint, FollowThroughBars, OutcomeBadge, ScoreChip, scoreTone } from './nwa-ui';
import { BusinessUpdatesView } from './nwa-form';

const weekNo = (w: string) => w.split('-')[1] || w;

function lastWeeks(planWeek: string, n: number): string[] {
  const out = [planWeek];
  while (out.length < n) out.push(getPreviousWeekKey(out[out.length - 1]));
  return out;
}

interface MemberSlide {
  user: UnifiedTeamUser;
  doc: any | null;
  prevDoc: any | null;
  trend: { week: string; score: number }[];
  stalled: number;
}

/**
 * Leader-only, TV-friendly view of the Monday NWA meeting. Steps through each team member:
 * wins, top priorities, roadblocks and commitments. Arrow keys move between slides, F toggles full screen.
 */
export function NwaTeamMeeting() {
  const db = useFirestore();
  const { toast } = useToast();
  const { isLeader, profile, user } = useAuth();
  const { teamUsers, isLoading: usersLoading } = useTeamUsers();
  const { pipelineReviews } = usePipelineData();

  const currentPlanWeek = useMemo(() => getNextWeekKey(getNwaReviewWeek()), []);
  const [planWeek, setPlanWeek] = useState(currentPlanWeek);
  const reviewWeek = getPreviousWeekKey(planWeek);
  const weeks = useMemo(() => lastWeeks(planWeek, 9), [planWeek]);

  // Rules: leaders (isAdmin) may read every weeklyCommitments doc; the view is never rendered for others.
  const histQ = useMemoFirebase(() => (db && isLeader ? query(collection(db, 'weeklyCommitments'), where('week', 'in', weeks)) : null), [db, isLeader, weeks]);
  const { data: docs, isLoading: docsLoading } = useCollection<any>(histQ);
  const updatesRef = useMemoFirebase(() => (db && isLeader ? doc(db, 'appSettings', businessUpdatesDocId(planWeek)) : null), [db, isLeader, planWeek]);
  const legacyUpdatesRef = useMemoFirebase(() => (db && isLeader ? doc(db, 'appSettings', 'nwaBusinessUpdates') : null), [db, isLeader]);
  const { data: updatesDoc } = useDoc<any>(updatesRef);
  const { data: legacyUpdatesDoc } = useDoc<any>(legacyUpdatesRef);
  const updates = resolveBusinessUpdates(updatesDoc, legacyUpdatesDoc, planWeek);

  const members: MemberSlide[] = useMemo(() => {
    const all = docs || [];
    const deals = latestDeals(pipelineReviews || []);
    return [...teamUsers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(u => {
        const ids = new Set([u.id, ...(u.linkedIds || [])]);
        const mine = all.filter(d => ids.has(d.userId));
        return {
          user: u,
          doc: mine.find(d => d.week === planWeek) || null,
          prevDoc: mine.find(d => d.week === reviewWeek) || null,
          trend: followThroughTrend(mine.filter(d => d.week !== weeks[weeks.length - 1])),
          stalled: deals.filter(d => ids.has(d.userId) && isStalledDeal(d)).length,
        };
      });
  }, [docs, teamUsers, pipelineReviews, planWeek, reviewWeek, weeks]);

  const submittedCount = members.filter(m => isSubmittedStatus(m.doc?.status)).length;
  const teamScore = averageScore(members.flatMap(m => m.trend.slice(-4)));
  const shoutOuts = members
    .map(m => ({ from: m.user.name, ...(mapStoredNwa(m.doc || {}, m.user.role).wins.shoutOut) }))
    .filter(s => s.teammate.trim());

  // ─── Slides & controls ─────────────────────────────────────────────────────
  const slideCount = members.length + 1;
  const [slide, setSlide] = useState(0);
  useEffect(() => { setSlide(s => Math.min(s, Math.max(0, slideCount - 1))); }, [slideCount]);
  const go = useCallback((d: number) => setSlide(s => Math.max(0, Math.min(slideCount - 1, s + d))), [slideCount]);

  const rootRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);
  const toggleFull = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.();
  }, []);
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(i);
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'Home') setSlide(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFull]);

  if (!isLeader) {
    return <EmptyHint>The team meeting view is available to leaders.</EmptyHint>;
  }

  const totalSecs = NWA_MEETING_MINUTES * 60;
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const over = elapsed > totalSecs;
  const loading = usersLoading || docsLoading;
  const current = slide > 0 ? members[slide - 1] : null;

  return (
    <div ref={rootRef} className={cn('flex min-h-[calc(100vh-8rem)] flex-col gap-4 bg-background', isFull && 'h-screen overflow-y-auto p-8')}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Monday NWA meeting</p>
            <h1 className="text-lg font-semibold text-foreground">Team meeting · week {weekNo(planWeek)}</h1>
          </div>
          <div className="inline-flex items-center rounded-xl border border-border bg-surface-2/50 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous week" onClick={() => { setPlanWeek(w => getPreviousWeekKey(w)); setSlide(0); }}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-sm font-semibold tabular-nums">W{weekNo(planWeek)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next week" disabled={planWeek >= currentPlanWeek} onClick={() => { setPlanWeek(w => getNextWeekKey(w)); setSlide(0); }}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums', over ? 'bg-danger-soft text-destructive' : 'bg-info-soft text-info')} aria-live="polite">
            {mm}:{ss} / {NWA_MEETING_MINUTES}:00
          </span>
          <Button variant="outline" size="icon" aria-label={running ? 'Pause timer' : 'Start timer'} onClick={() => setRunning(r => !r)}>{running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" aria-label="Reset timer" onClick={() => { setRunning(false); setElapsed(0); }}><RotateCcw className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" aria-label={isFull ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>{isFull ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</Button>
        </div>
      </div>

      {/* Slide strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Slides">
        <SlideTab active={slide === 0} onClick={() => setSlide(0)} label="Overview" />
        {members.map((m, i) => (
          <SlideTab key={m.user.id} active={slide === i + 1} onClick={() => setSlide(i + 1)} label={m.user.name}
            dot={isSubmittedStatus(m.doc?.status) ? 'bg-success-fill' : nwaDueState(planWeek, m.doc?.status) === 'overdue' ? 'bg-destructive' : 'bg-warning'} />
        ))}
      </div>

      {/* Slide */}
      <div className="flex-1 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-10">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-surface-2/60" />
        ) : current ? (
          <MemberSlideView m={current} planWeek={planWeek} reviewWeek={reviewWeek}
            onSaveNote={async (note) => {
              if (!db) return;
              try {
                await setDoc(doc(db, 'weeklyCommitments', `${current.doc?.userId || current.user.id}_${planWeek}`), {
                  userId: current.doc?.userId || current.user.id, userName: current.user.name, week: planWeek,
                  managerNote: note, adminCoachingNotes: note,
                  managerNoteBy: profile?.name || user?.email || 'Leader', managerNoteAt: serverTimestamp(), updatedAt: serverTimestamp(),
                }, { merge: true });
                toast({ title: 'Manager note saved', description: current.user.name });
              } catch (err: any) {
                toast({ variant: 'destructive', title: 'Couldn’t save note', description: err?.message });
              }
            }} />
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-3">
              <BigStat label="Submitted" value={`${submittedCount} / ${members.length}`} tone={submittedCount === members.length ? 'good' : 'warn'} />
              <BigStat label="Team follow-through (4 wks)" value={teamScore === null ? '–' : `${teamScore}%`} tone={teamScore === null ? 'default' : teamScore >= 80 ? 'good' : teamScore >= 50 ? 'warn' : 'bad'} />
              <BigStat label="Stalled deals (14+ days)" value={String(members.reduce((s, m) => s + m.stalled, 0))} tone="warn" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground"><ListChecks className="h-5 w-5 text-accent" />Agenda</h2>
                <ol className="space-y-1.5">
                  {(members.length > 0 && members.every(m => isAmRole(m.user.role)) ? NWA_SECTIONS_AM : NWA_SECTIONS).map(s => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl bg-surface-2/40 px-4 py-2.5 text-base">
                      <span><span className="mr-3 font-semibold text-muted-foreground">{s.step}</span>{s.title}</span>
                      <span className="text-sm font-semibold text-info">{s.minutes} min</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground"><Heart className="h-5 w-5 text-gold" />Shout-outs</h2>
                  {shoutOuts.length ? (
                    <ul className="space-y-2">
                      {shoutOuts.map((s, i) => (
                        <li key={i} className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-base">
                          <span className="font-semibold">{s.teammate}</span>{s.reason && <> · {s.reason}</>}
                          <span className="block text-sm text-muted-foreground">from {s.from}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyHint>No shout-outs yet this week.</EmptyHint>}
                </div>
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-foreground">Business updates</h2>
                  {hasBusinessUpdates(updates) ? <BusinessUpdatesView value={updates} large /> : <EmptyHint>No business updates posted for this week.</EmptyHint>}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground"><Users className="h-5 w-5 text-primary" />Team</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {members.map((m, i) => {
                  const score = averageScore(m.trend.slice(-4));
                  return (
                    <button key={m.user.id} type="button" onClick={() => setSlide(i + 1)} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-surface-2/50">
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-foreground">{m.user.name}</span>
                        <DueChip state={nwaDueState(planWeek, m.doc?.status)} className="mt-1" />
                      </span>
                      <span className={cn('rounded-full px-2.5 py-1 text-sm font-semibold', scoreTone(score))}>{score === null ? '–' : `${score}%`}</span>
                    </button>
                  );
                })}
                {!members.length && <EmptyHint>No team members found.</EmptyHint>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="lg" onClick={() => go(-1)} disabled={slide === 0}><ChevronLeft className="mr-1 h-5 w-5" />Back</Button>
        <span className="text-sm text-muted-foreground">{slide + 1} of {slideCount} · arrow keys to move, F for full screen</span>
        <Button size="lg" onClick={() => go(1)} disabled={slide >= slideCount - 1}>Next<ChevronRight className="ml-1 h-5 w-5" /></Button>
      </div>
    </div>
  );
}

function SlideTab({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={cn('inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-surface-2')}>
      {dot && <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden />}
      {label}
    </button>
  );
}

function BigStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const cls = tone === 'good' ? 'text-success-ink' : tone === 'warn' ? 'text-warning-ink' : tone === 'bad' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-2xl border border-border bg-surface-2/30 p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-4xl font-semibold tabular-nums', cls)}>{value}</p>
    </div>
  );
}

function Panel({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border p-5', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">{icon}{title}</h3>
      {children}
    </div>
  );
}

function MemberSlideView({ m, planWeek, reviewWeek, onSaveNote }: { m: MemberSlide; planWeek: string; reviewWeek: string; onSaveNote: (note: string) => Promise<void> }) {
  const legacy = m.doc && isLegacyFridayDoc(m.doc);
  const plan = mapStoredNwa(m.doc || {}, m.user.role);
  const review = mergeCommitmentReview(plan.commitmentReview, previousCommitmentsFrom(m.prevDoc));
  const ft = followThroughScore(review);
  const score = averageScore(m.trend.slice(-4));
  const [note, setNote] = useState<string>(m.doc?.managerNote || m.doc?.adminCoachingNotes || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setNote(m.doc?.managerNote || m.doc?.adminCoachingNotes || ''); }, [m.doc, m.user.id]);

  const wins = [
    ['Customer wins', plan.wins.customerWins], ['Closed', plan.wins.closedOpportunities],
    ['Feedback', plan.wins.positiveFeedback], ['Recognition', plan.wins.teamRecognition],
  ].filter(([, v]) => v.trim());
  const roadblocks = [
    ['Slowing progress', plan.challenges.slowingProgress], ['Customer', plan.challenges.customerIssues],
    ['Internal', plan.challenges.internalIssues], ['Resources needed', plan.challenges.resourcesRequired],
  ].filter(([, v]) => v.trim());
  const priorities = plan.topPriorities.filter(p => p.trim());
  const commitments = plan.commitments.filter(c => c.text.trim());
  const acc = plan.accounts;
  const atRisk = acc.atRisk.filter(r => r.account.trim() && r.status === 'open');
  const renewals = acc.renewals.filter(r => r.account.trim());
  const handovers = acc.handovers.filter(h => h.account.trim());
  const growth = acc.growth.filter(r => r.account.trim());
  const revenueAtRisk = totalRevenueAtRisk(acc);
  const showAccounts = isAmRole(m.user.role) || atRisk.length + renewals.length + handovers.length + growth.length > 0;
  const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{m.user.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DueChip state={nwaDueState(planWeek, m.doc?.status)} />
            {m.stalled > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-ink"><AlertTriangle className="h-3.5 w-3.5" />{m.stalled} stalled</span>}
            {legacy && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground">Previous Friday format</span>}
          </div>
        </div>
        <div className="flex items-end gap-4">
          <FollowThroughBars points={m.trend} large />
          <ScoreChip score={score} label="4-wk" className="text-sm" />
        </div>
      </div>

      {!m.doc ? (
        <EmptyHint>{m.user.name} hasn’t started their NWA for week {weekNo(planWeek)}.</EmptyHint>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel icon={<Trophy className="h-5 w-5 text-gold" />} title="Wins">
            {wins.length || plan.wins.shoutOut.teammate ? (
              <div className="space-y-3 text-base">
                {wins.map(([l, v]) => <div key={l}><p className="text-sm font-semibold text-muted-foreground">{l}</p><p className="whitespace-pre-wrap text-foreground">{v}</p></div>)}
                {plan.wins.shoutOut.teammate && <p className="rounded-xl bg-gold/10 px-3 py-2"><Heart className="mr-1.5 inline h-4 w-4 text-gold" /><span className="font-semibold">{plan.wins.shoutOut.teammate}</span>{plan.wins.shoutOut.reason && ` · ${plan.wins.shoutOut.reason}`}</p>}
              </div>
            ) : <p className="text-base text-muted-foreground">No wins recorded.</p>}
          </Panel>

          <Panel icon={<Target className="h-5 w-5 text-cta" />} title="Top 3 priorities">
            {priorities.length ? (
              <ol className="space-y-2">
                {priorities.map((p, i) => <li key={i} className="flex gap-3 text-lg"><span className="font-semibold text-muted-foreground">{i + 1}</span><span className="text-foreground">{p}</span></li>)}
              </ol>
            ) : <p className="text-base text-muted-foreground">No priorities set.</p>}
          </Panel>

          <Panel icon={<AlertTriangle className="h-5 w-5 text-warning" />} title="Roadblocks">
            {roadblocks.length ? (
              <div className="space-y-3 text-base">
                {roadblocks.map(([l, v]) => <div key={l}><p className="text-sm font-semibold text-muted-foreground">{l}</p><p className="whitespace-pre-wrap text-foreground">{v}</p></div>)}
              </div>
            ) : <p className="text-base text-muted-foreground">No roadblocks raised.</p>}
          </Panel>

          {showAccounts && (
            <Panel icon={<Briefcase className="h-5 w-5 text-accent" />} title={`Accounts · ${money(revenueAtRisk)} at risk`}>
              {atRisk.length + renewals.length + handovers.length + growth.length ? (
                <div className="space-y-3 text-base">
                  {atRisk.length > 0 && <div><p className="text-sm font-semibold text-muted-foreground">At risk</p>{atRisk.map(r => <p key={r.id} className="text-foreground">{r.account} <span className="text-muted-foreground">· {money(r.revenueAtRisk)}{r.action && ` · ${r.action}`}</span></p>)}</div>}
                  {renewals.length > 0 && <div><p className="text-sm font-semibold text-muted-foreground">Renewals and rate reviews</p>{renewals.map(r => <p key={r.id} className="text-foreground">{r.account} <span className="text-muted-foreground">· {RENEWAL_TYPE_LABEL[r.type]} · {RENEWAL_STATUS_LABEL[r.status]}{r.dueDate && ` · ${r.dueDate}`}</span></p>)}</div>}
                  {growth.length > 0 && <div><p className="text-sm font-semibold text-muted-foreground">Growth</p>{growth.map(r => <p key={r.id} className="text-foreground">{r.account} <span className="text-muted-foreground">{r.opportunity && `· ${r.opportunity}`}{r.value > 0 && ` · ${money(r.value)}`}</span></p>)}</div>}
                  {handovers.length > 0 && <div><p className="text-sm font-semibold text-muted-foreground">Handovers</p>{handovers.map(h => <p key={h.id} className="text-foreground">{h.account} <span className="text-muted-foreground">· {h.fromName || '?'} → {h.toName || '?'} · {HANDOVER_STATUS_LABEL[h.status]}</span></p>)}</div>}
                </div>
              ) : <p className="text-base text-muted-foreground">No account updates.</p>}
            </Panel>
          )}

          <Panel icon={<ListChecks className="h-5 w-5 text-primary" />} title="Commitments">
            <div className="space-y-4">
              {commitments.length ? (
                <ul className="space-y-2">
                  {commitments.map(c => (
                    <li key={c.id} className="text-base">
                      <span className="text-foreground">{c.text}</span>
                      {(c.owner || c.dueDate) && <span className="block text-sm text-muted-foreground">{[c.owner, c.dueDate && `due ${c.dueDate}`].filter(Boolean).join(' · ')}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-base text-muted-foreground">No commitments yet.</p>}
              {review.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center justify-between text-sm font-semibold text-muted-foreground">
                    Week {weekNo(reviewWeek)} follow-through <ScoreChip score={ft.score} label="" />
                  </p>
                  <ul className="space-y-1.5">
                    {review.map(r => <li key={r.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-foreground">{r.text}</span><OutcomeBadge value={r.outcome} /></li>)}
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface-2/30 p-5">
        <h3 className="text-base font-semibold text-foreground">Manager note</h3>
        <p className="text-xs text-muted-foreground">Optional, after the meeting. {m.user.name} sees it on their NWA.</p>
        <Textarea className="mt-3" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Coaching points, agreed follow-ups…" />
        <Button className="mt-3" variant="outline" disabled={saving} onClick={async () => { setSaving(true); await onSaveNote(note); setSaving(false); }}>{saving ? 'Saving…' : 'Save note'}</Button>
      </div>
    </div>
  );
}
