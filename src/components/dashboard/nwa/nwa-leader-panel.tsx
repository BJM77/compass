"use client";

/**
 * Leader inputs for one week, in one place: everything on the TWA that isn't typed by reps or
 * auto-filled. Shown read-only on every rep's TWA and in the whole-team view.
 *  - Team-wide: business updates + pipeline/handover notes + KPI focus
 *    → appSettings/nwaBusinessUpdates_{week} (staff read, leaders write).
 *  - Team KPI targets per role → appSettings/nwaKpiTargets.byRole.
 *  - Per person (optional additions): nwaLeaderNotes/{uid}_{week} and users/{uid}.nwaKpiTargets.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteField, doc, getDoc, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { ChevronDown, Megaphone } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useTeamUsers } from '@/hooks/use-team-users';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  NWA_LEADER_NOTE_FIELDS, businessUpdatesDocId, emptyLeaderNotes, hasBusinessUpdates, hasLeaderNotes, kpiDefsFor, kpiRoleGroup,
  leaderNotesDocId, mapLeaderNotes, teamLeaderNotes,
  type NwaBusinessUpdates, type NwaLeaderNotes,
} from '@/lib/nwa';
import { FieldLabel, SubHeading } from './nwa-ui';
import { UPDATE_FIELDS } from './nwa-readonly';

const weekNo = (w: string) => w.split('-')[1] || w;
type Tab = 'team' | 'targets' | 'person';

export function NwaLeaderPanel({ planWeek, updatesDoc, savedUpdates }: { planWeek: string; updatesDoc: any; savedUpdates: NwaBusinessUpdates }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { isLeader, profile, user } = useAuth();
  const { teamUsers } = useTeamUsers();
  const by = profile?.name || user?.email || 'Leader';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('team');
  const [saving, setSaving] = useState(false);

  // Team-wide
  const savedTeam = useMemo(() => teamLeaderNotes(updatesDoc), [updatesDoc]);
  const [updates, setUpdates] = useState<NwaBusinessUpdates>(savedUpdates);
  const [team, setTeam] = useState<NwaLeaderNotes>(savedTeam);
  const [teamDirty, setTeamDirty] = useState(false);
  useEffect(() => { if (!teamDirty) { setUpdates(savedUpdates); setTeam(savedTeam); } }, [savedUpdates, savedTeam, teamDirty]);
  useEffect(() => { setTeamDirty(false); }, [planWeek]);

  // Per-person notes for the week (leaders can read them all)
  const notesQ = useMemoFirebase(() => (db && isLeader ? query(collection(db, 'nwaLeaderNotes'), where('week', '==', planWeek)) : null), [db, isLeader, planWeek]);
  const { data: notesDocs } = useCollection<any>(notesQ);
  const withNotes = (notesDocs || []).filter(d => hasLeaderNotes(mapLeaderNotes(d))).length;

  // Team targets
  const targetsRef = useMemoFirebase(() => (db ? doc(db, 'appSettings', 'nwaKpiTargets') : null), [db]);
  const { data: targetsDoc } = useDoc<any>(targetsRef);
  const [targets, setTargets] = useState<Record<'BDM' | 'AM', Record<string, string>>>({ BDM: {}, AM: {} });
  useEffect(() => {
    const pick = (g: 'BDM' | 'AM') => Object.fromEntries(kpiDefsFor(g).map(k => [k.target, targetsDoc?.byRole?.[g]?.[k.target] != null ? String(targetsDoc.byRole[g][k.target]) : '']));
    setTargets({ BDM: pick('BDM'), AM: pick('AM') });
  }, [targetsDoc]);

  // Per person
  const [personId, setPersonId] = useState('');
  const person = teamUsers.find(u => u.id === personId);
  const [personNotes, setPersonNotes] = useState<NwaLeaderNotes>(emptyLeaderNotes());
  const [personTargets, setPersonTargets] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!db || !personId) return;
    let cancelled = false;
    getDoc(doc(db, 'nwaLeaderNotes', leaderNotesDocId(personId, planWeek)))
      .then(d => { if (!cancelled) setPersonNotes(mapLeaderNotes(d.exists() ? d.data() : null)); })
      .catch(() => { if (!cancelled) setPersonNotes(emptyLeaderNotes()); });
    const t = person?.nwaKpiTargets || {};
    setPersonTargets(Object.fromEntries(kpiDefsFor(person?.role).map(k => [k.target, t[k.target] != null ? String(t[k.target]) : ''])));
    return () => { cancelled = true; };
  }, [db, personId, planWeek, person]);

  if (!isLeader) return null;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setSaving(true);
    try { await fn(); toast({ title: ok }); } catch (err: any) {
      toast({ variant: 'destructive', title: 'Couldn’t save', description: err?.message || 'Only leaders can edit these.' });
    } finally { setSaving(false); }
  };

  const saveTeam = () => run(async () => {
    const { updatedBy: _b, updatedAt: _a, ...fields } = updates;
    await setDoc(doc(db!, 'appSettings', businessUpdatesDocId(planWeek)), {
      ...fields, teamPipeline: team.pipeline, teamKpis: team.kpis, week: planWeek, updatedBy: by, updatedAt: serverTimestamp(),
    }, { merge: true });
    setTeamDirty(false);
  }, `Team inputs saved for week ${weekNo(planWeek)}`);

  const saveTargets = (g: 'BDM' | 'AM') => run(async () => {
    const values = Object.fromEntries(kpiDefsFor(g).map(k => [k.target, Number(targets[g][k.target]) || 0]));
    await setDoc(doc(db!, 'appSettings', 'nwaKpiTargets'), { byRole: { [g]: { ...values, updatedBy: by, updatedAt: serverTimestamp() } } }, { merge: true });
  }, `${g} team targets saved`);

  const savePerson = () => run(async () => {
    if (!personId) return;
    await setDoc(doc(db!, 'nwaLeaderNotes', leaderNotesDocId(personId, planWeek)), {
      userId: personId, week: planWeek, ...personNotes, updatedBy: by, updatedAt: serverTimestamp(),
    }, { merge: true });
    const set = Object.entries(personTargets).filter(([, v]) => v.trim() !== '' && Number.isFinite(Number(v)));
    const before = JSON.stringify(person?.nwaKpiTargets || {});
    const after = Object.fromEntries(set.map(([k, v]) => [k, Number(v)]));
    if (JSON.stringify(after) !== before) {
      await updateDoc(doc(db!, 'users', personId), { nwaKpiTargets: set.length ? after : deleteField() });
    }
  }, `Saved for ${person?.name || 'this person'}`);

  const teamPosted = hasBusinessUpdates(savedUpdates) || hasLeaderNotes(savedTeam);
  const tabBtn = (t: Tab, label: string) => (
    <Button key={t} variant={tab === t ? 'secondary' : 'ghost'} size="sm" className="h-8" aria-pressed={tab === t} onClick={() => setTab(t)}>{label}</Button>
  );

  return (
    <section className="rounded-2xl border border-accent/30 bg-card shadow-sm">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"><Megaphone className="h-4 w-4" /></span>
          <span>
            <span className="block text-base font-semibold text-foreground">Leader inputs · week {weekNo(planWeek)}</span>
            <span className="block text-sm text-muted-foreground">Business updates, pipeline notes, KPI focus and targets. Written once here, read-only on every TWA.</span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs">
          <span className={cn('rounded-full px-2.5 py-1 font-semibold', teamPosted ? 'bg-success-soft text-success-ink' : 'bg-surface-2 text-muted-foreground')}>{teamPosted ? 'Team inputs posted' : 'Nothing posted yet'}</span>
          {withNotes > 0 && <span className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-foreground">{withNotes} personal</span>}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="space-y-5 border-t border-border px-5 py-5">
          <div className="inline-flex flex-wrap items-center rounded-xl border border-border bg-surface-2/50 p-1" role="group" aria-label="Leader inputs">
            {tabBtn('team', 'Whole team')}{tabBtn('targets', 'Team targets')}{tabBtn('person', 'Per person')}
          </div>

          {tab === 'team' && (
            <div className="space-y-4">
              <SubHeading hint="Everyone sees these on their TWA.">Business updates</SubHeading>
              <div className="grid gap-4 md:grid-cols-2">
                {UPDATE_FIELDS.map(f => (
                  <div key={f.key} className="space-y-2">
                    <FieldLabel htmlFor={`lp-bu-${f.key}`}>{f.label}</FieldLabel>
                    <Textarea id={`lp-bu-${f.key}`} rows={3} value={updates[f.key]} onChange={e => { setUpdates(u => ({ ...u, [f.key]: e.target.value })); setTeamDirty(true); }} />
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {NWA_LEADER_NOTE_FIELDS.filter(f => f.key !== 'updates').map(f => (
                  <div key={f.key} className="space-y-2">
                    <FieldLabel htmlFor={`lp-team-${f.key}`} hint={f.hint}>{f.label} (whole team)</FieldLabel>
                    <Textarea id={`lp-team-${f.key}`} rows={3} value={team[f.key]} onChange={e => { setTeam(t => ({ ...t, [f.key]: e.target.value })); setTeamDirty(true); }} />
                  </div>
                ))}
              </div>
              <Button onClick={saveTeam} disabled={saving || !teamDirty}>{saving ? 'Saving…' : 'Save for everyone'}</Button>
            </div>
          )}

          {tab === 'targets' && (
            <div className="grid gap-6 md:grid-cols-2">
              {(['BDM', 'AM'] as const).map(g => (
                <div key={g} className="space-y-3 rounded-xl border border-border p-4">
                  <SubHeading hint="Weekly targets for everyone in this role unless set per person.">{g === 'AM' ? 'Account managers' : 'BDMs'}</SubHeading>
                  {kpiDefsFor(g).map(k => (
                    <div key={k.target} className="flex items-center justify-between gap-3">
                      <label htmlFor={`lp-t-${g}-${k.target}`} className="text-sm text-foreground">{k.label}{k.currency ? ' ($)' : ''}</label>
                      <Input id={`lp-t-${g}-${k.target}`} type="number" min={0} inputMode="numeric" className="h-9 w-32" value={targets[g][k.target] ?? ''}
                        onChange={e => setTargets(t => ({ ...t, [g]: { ...t[g], [k.target]: e.target.value } }))} />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => saveTargets(g)} disabled={saving}>Save {g} targets</Button>
                </div>
              ))}
            </div>
          )}

          {tab === 'person' && (
            <div className="space-y-4">
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger className="h-10 w-[260px]" aria-label="Team member"><SelectValue placeholder="Choose a team member" /></SelectTrigger>
                <SelectContent>{teamUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
              {personId && (
                <>
                  <p className="text-sm text-muted-foreground">Optional. Added under the whole-team text on {person?.name || 'their'} TWA for week {weekNo(planWeek)}; only they and leaders see it.</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {NWA_LEADER_NOTE_FIELDS.map(f => (
                      <div key={f.key} className="space-y-2">
                        <FieldLabel htmlFor={`lp-p-${f.key}`} hint={f.hint}>{f.label}</FieldLabel>
                        <Textarea id={`lp-p-${f.key}`} rows={3} value={personNotes[f.key]} onChange={e => setPersonNotes(n => ({ ...n, [f.key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <SubHeading hint={`Leave blank to use the ${kpiRoleGroup(person?.role)} team target.`}>KPI targets for {person?.name}</SubHeading>
                    <div className="grid gap-3 md:grid-cols-2">
                      {kpiDefsFor(person?.role).map(k => (
                        <div key={k.target} className="flex items-center justify-between gap-3">
                          <label htmlFor={`lp-pt-${k.target}`} className="text-sm text-foreground">{k.label}{k.currency ? ' ($)' : ''}</label>
                          <Input id={`lp-pt-${k.target}`} type="number" min={0} inputMode="numeric" className="h-9 w-32" placeholder="Team" value={personTargets[k.target] ?? ''}
                            onChange={e => setPersonTargets(t => ({ ...t, [k.target]: e.target.value }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={savePerson} disabled={saving}>{saving ? 'Saving…' : `Save for ${person?.name || 'this person'}`}</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
