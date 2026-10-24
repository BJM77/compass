'use client';

import { useMemo, useState } from 'react';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useTeamUsers, UnifiedTeamUser } from '@/hooks/use-team-users';
import {
  DataShare, ShareArea, SHARE_AREAS, LINKED_TO_FACT_FINDING, shareDocId,
} from '@/hooks/use-data-shares';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, ArrowRight, Lock } from 'lucide-react';

/**
 * Access (admin only): tick boxes to share ONE user's data with other BDMs / Account Managers.
 * - One-way: ticking Owner -> Viewer gives the viewer the owner's data, never the reverse.
 * - Full access (read, edit, delete) to the owner's records in the ticked areas.
 * - Fact Finding also grants (and locks) the linked White Space and Call Plans.
 * - Canvassing is ticked separately.
 * Admin access itself is never granted here; it comes only from users/{uid}.role.
 */
export function AccessHub() {
  const db = useFirestore();
  const { user, isLeader } = useAuth();
  const { toast } = useToast();
  const { teamUsers, isLoading: usersLoading } = useTeamUsers();
  const [ownerKey, setOwnerKey] = useState<string>('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const sharesQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'dataShares');
  }, [db, isLeader]);
  const { data: shares, isLoading: sharesLoading } = useCollection<DataShare>(sharesQuery);

  const owner = teamUsers.find((u) => u.id === ownerKey) || null;
  const viewers = useMemo(() => teamUsers.filter((u) => u.id !== ownerKey), [teamUsers, ownerKey]);

  // A person can have more than one user doc (linkedIds); a tick applies to every owner/viewer id pair.
  const pairsFor = (o: UnifiedTeamUser, v: UnifiedTeamUser) => {
    const pairs: { ownerId: string; viewerId: string }[] = [];
    o.linkedIds.forEach((oid) => v.linkedIds.forEach((vid) => { if (oid !== vid) pairs.push({ ownerId: oid, viewerId: vid }); }));
    return pairs;
  };

  const sharesByPair = useMemo(() => {
    const m = new Map<string, DataShare>();
    (shares || []).forEach((s) => m.set(s.id, s));
    return m;
  }, [shares]);

  const areasFor = (o: UnifiedTeamUser, v: UnifiedTeamUser): Partial<Record<ShareArea, boolean>> => {
    const merged: Partial<Record<ShareArea, boolean>> = {};
    pairsFor(o, v).forEach((p) => {
      const s = sharesByPair.get(shareDocId(p.ownerId, p.viewerId));
      SHARE_AREAS.forEach((a) => { if (s?.areas?.[a.key]) merged[a.key] = true; });
    });
    return merged;
  };

  const setArea = async (o: UnifiedTeamUser, v: UnifiedTeamUser, area: ShareArea, on: boolean) => {
    if (!db || !user) return;
    const next = { ...areasFor(o, v) };
    const changed: ShareArea[] = area === 'factFinding' ? ['factFinding', ...LINKED_TO_FACT_FINDING] : [area];
    changed.forEach((a) => { if (on) next[a] = true; else delete next[a]; });
    const anyOn = SHARE_AREAS.some((a) => next[a.key]);
    const key = `${o.id}_${v.id}`;
    setBusyKey(key);
    try {
      const batch = writeBatch(db);
      pairsFor(o, v).forEach((p) => {
        const ref = doc(db, 'dataShares', shareDocId(p.ownerId, p.viewerId));
        if (!anyOn) {
          batch.delete(ref);
        } else {
          batch.set(ref, {
            ownerId: p.ownerId,
            ownerName: o.name,
            viewerId: p.viewerId,
            viewerName: v.name,
            areas: Object.fromEntries(SHARE_AREAS.map((a) => [a.key, !!next[a.key]])),
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
          });
        }
      });
      await batch.commit();
    } catch (e: any) {
      console.error('Access update failed', e);
      toast({ variant: 'destructive', title: 'Could not update access', description: e?.message || 'Permission denied.' });
    } finally {
      setBusyKey(null);
    }
  };

  // Summary of everything currently shared, grouped by owner (people, not raw ids)
  const summary = useMemo(() => {
    const rows: { owner: UnifiedTeamUser; viewer: UnifiedTeamUser; areas: string[] }[] = [];
    teamUsers.forEach((o) => teamUsers.forEach((v) => {
      if (o.id === v.id) return;
      const a = areasFor(o, v);
      const labels = SHARE_AREAS.filter((x) => a[x.key]).map((x) => x.label);
      if (labels.length) rows.push({ owner: o, viewer: v, areas: labels });
    }));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamUsers, sharesByPair]);

  if (!isLeader) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Access</h1>
          <p className="text-xs text-muted-foreground font-medium">
            Share one person&apos;s data with other BDMs / Account Managers. One-way, full access (view, edit, delete).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Whose data is being shared?</CardTitle>
          <CardDescription className="text-xs">
            Pick the owner, then tick the areas each person below can access. Ticking A → B does <strong>not</strong> give A access to B&apos;s data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usersLoading || sharesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading team…</div>
          ) : (
            <Select value={ownerKey} onValueChange={setOwnerKey}>
              <SelectTrigger className="w-full sm:w-80 h-10 font-bold">
                <SelectValue placeholder="Select an owner…" />
              </SelectTrigger>
              <SelectContent>
                {teamUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {owner && (
            <div className="rounded-xl border overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] bg-secondary/60 border-b text-xs font-semibold text-foreground/75">
                <div className="p-2 sm:p-3">Can access {owner.name}&apos;s…</div>
                {SHARE_AREAS.map((a) => (
                  <div key={a.key} className="p-2 sm:p-3 text-center leading-tight">{a.label}</div>
                ))}
              </div>
              {viewers.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">No other BDM / Account Manager users found.</div>
              )}
              {viewers.map((v) => {
                const a = areasFor(owner, v);
                const busy = busyKey === `${owner.id}_${v.id}`;
                return (
                  <div key={v.id} className="grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] items-center border-b last:border-b-0 hover:bg-secondary/35">
                    <div className="p-2 sm:p-3 min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
                        {v.name}
                        {busy && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">{v.role}</div>
                    </div>
                    {SHARE_AREAS.map((area) => {
                      const linked = LINKED_TO_FACT_FINDING.includes(area.key) && !!a.factFinding;
                      return (
                        <div key={area.key} className="p-2 sm:p-3 flex justify-center items-center gap-1">
                          <Checkbox
                            checked={!!a[area.key] || linked}
                            disabled={busy || linked}
                            onCheckedChange={(c) => setArea(owner, v, area.key, c === true)}
                            aria-label={`${v.name} can access ${owner.name}'s ${area.label}`}
                          />
                          {linked && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Included with Fact Finding" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          {owner && (
            <p className="text-xs text-muted-foreground">
              Fact Finding automatically includes the linked White Space and Call Plans (locked). Canvassing is ticked separately.
              Shared records appear in the person&apos;s normal lists with a &ldquo;Shared by {owner.name}&rdquo; badge.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Current sharing</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing is shared yet.</p>
          ) : (
            <ul className="space-y-2">
              {summary.map((r) => (
                <li key={`${r.owner.id}_${r.viewer.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="font-bold">{r.owner.name}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="font-bold">{r.viewer.name}</span>
                  <span className="flex flex-wrap gap-1">
                    {r.areas.map((l) => (
                      <Badge key={l} variant="secondary" className="text-xs font-semibold">{l}</Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
