'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot, QueryConstraint, DocumentData,
} from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';

/**
 * Data sharing ("Access" page). An admin shares ONE owner's data with ONE viewer,
 * one-way (owner -> viewer). The share doc lives at dataShares/{ownerId}_{viewerId}.
 * Sharing grants FULL access (read, edit, delete) to the owner's records in the ticked areas.
 * Fact Finding automatically includes the linked Call Plans and White Space.
 */
export type ShareArea = 'factFinding' | 'whiteSpace' | 'callPlans' | 'canvassing';

export const SHARE_AREAS: { key: ShareArea; label: string; collection: string }[] = [
  { key: 'factFinding', label: 'Fact Finding', collection: 'factFindingDocs' },
  { key: 'whiteSpace', label: 'White Space', collection: 'whitespacePlans' },
  { key: 'callPlans', label: 'Call Plans', collection: 'callPlans' },
  { key: 'canvassing', label: 'Canvassing', collection: 'canvass_leads' },
];

/** Areas that are automatically included when Fact Finding is shared. */
export const LINKED_TO_FACT_FINDING: ShareArea[] = ['whiteSpace', 'callPlans'];

export interface DataShare {
  id: string;
  ownerId: string;
  ownerName?: string;
  viewerId: string;
  viewerName?: string;
  areas: Partial<Record<ShareArea, boolean>>;
}

export const shareDocId = (ownerId: string, viewerId: string) => `${ownerId}_${viewerId}`;

/** True if the share grants this area (Fact Finding implies White Space + Call Plans). */
export function shareGrants(share: Pick<DataShare, 'areas'> | undefined, area: ShareArea): boolean {
  if (!share?.areas) return false;
  if (share.areas[area] === true) return true;
  return LINKED_TO_FACT_FINDING.includes(area) && share.areas.factFinding === true;
}

export interface SharedOwner { ownerId: string; ownerName: string }

/** Owners who have shared this area with the signed-in user (empty for admins, who already see everything). */
export function useSharedOwners(area: ShareArea): { owners: SharedOwner[]; ownersKey: string } {
  const db = useFirestore();
  const { user, isLeader } = useAuth();

  const sharesQuery = useMemoFirebase(() => {
    if (!db || !user?.uid || isLeader) return null;
    return query(collection(db, 'dataShares'), where('viewerId', '==', user.uid));
  }, [db, user?.uid, isLeader]);
  const { data: shares } = useCollection<DataShare>(sharesQuery);

  const owners = useMemo(() => {
    const list: SharedOwner[] = [];
    (shares || []).forEach((s) => {
      if (s.ownerId && s.ownerId !== user?.uid && shareGrants(s, area)) {
        list.push({ ownerId: s.ownerId, ownerName: s.ownerName || 'a teammate' });
      }
    });
    return list.sort((a, b) => a.ownerId.localeCompare(b.ownerId));
  }, [shares, area, user?.uid]);

  const ownersKey = owners.map((o) => o.ownerId).join('|');
  return { owners, ownersKey };
}

/**
 * Live docs shared with the signed-in user for one area: one `where userId == ownerId`
 * query per sharing owner (Firestore rules require the owner constraint), merged.
 * Each row gets `sharedByName` / `sharedById` so the UI can badge it.
 * Options mirror what each page already does for its own query so existing composite
 * indexes apply: `orderByCreatedDesc` (userId + createdAt desc) and `max` (limit).
 */
export function useSharedOwnerDocs<T = any>(
  area: ShareArea,
  collectionName: string,
  options: { orderByCreatedDesc?: boolean; max?: number } = {},
): { data: (T & { id: string; sharedByName: string; sharedById: string })[]; isLoading: boolean } {
  const db = useFirestore();
  const { owners, ownersKey } = useSharedOwners(area);
  const [byOwner, setByOwner] = useState<Record<string, any[]>>({});
  const [loaded, setLoaded] = useState(false);
  const { orderByCreatedDesc, max } = options;

  useEffect(() => {
    if (!db || owners.length === 0) {
      setByOwner({});
      setLoaded(true);
      return;
    }
    setLoaded(false);
    const extras: QueryConstraint[] = [];
    if (orderByCreatedDesc) extras.push(orderBy('createdAt', 'desc'));
    if (max) extras.push(limit(max));
    let pending = owners.length;
    const unsubs = owners.map((o) =>
      onSnapshot(
        query(collection(db, collectionName), where('userId', '==', o.ownerId), ...extras),
        (snap) => {
          const rows = snap.docs.map((d) => ({
            ...(d.data() as DocumentData), id: d.id, sharedByName: o.ownerName, sharedById: o.ownerId,
          }));
          setByOwner((prev) => ({ ...prev, [o.ownerId]: rows }));
          if (pending > 0) { pending -= 1; if (pending === 0) setLoaded(true); }
        },
        (err) => {
          console.error(`Shared ${collectionName} for ${o.ownerId}:`, err.code, err.message);
          setByOwner((prev) => ({ ...prev, [o.ownerId]: [] }));
          if (pending > 0) { pending -= 1; if (pending === 0) setLoaded(true); }
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ownersKey, collectionName, orderByCreatedDesc, max]);

  const data = useMemo(() => {
    const ids = new Set(owners.map((o) => o.ownerId));
    return Object.entries(byOwner).filter(([k]) => ids.has(k)).flatMap(([, rows]) => rows) as any[];
  }, [byOwner, owners]);

  return { data, isLoading: !loaded };
}
