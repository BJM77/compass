'use client';

import { useMemo } from 'react';
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { dismissalKey, VerticalDismissal } from '@/lib/verticals';

/**
 * Shared "Trading with TGE" markers for the Verticals page (verticalDismissals collection).
 * A marked company is hidden from Suggested WA prospects and flagged in the Lookalike finder
 * for every BDM / AM. Keyed by normalised company name, so the same company is matched
 * wherever it appears (suggested list, lookalike results).
 */
export function useVerticalDismissals() {
  const db = useFirestore();
  const { user, profile } = useAuth();
  const ref = useMemoFirebase(() => (db && user ? collection(db, 'verticalDismissals') : null), [db, user]);
  const { data } = useCollection<VerticalDismissal>(ref);

  const byKey = useMemo(() => {
    const m = new Map<string, VerticalDismissal>();
    (data || []).forEach(d => m.set(d.id, d));
    return m;
  }, [data]);

  const isDismissed = (company: string) => byKey.has(dismissalKey(company));

  const markTrading = async (company: string, suggestedId?: string) => {
    if (!db || !user) throw new Error('Not signed in');
    const key = dismissalKey(company);
    if (!key) throw new Error('Invalid company');
    await setDoc(doc(db, 'verticalDismissals', key), {
      company: company.slice(0, 200),
      reason: 'TRADING_WITH_TGE',
      ...(suggestedId ? { suggestedId: suggestedId.slice(0, 200) } : {}),
      dismissedBy: user.uid,
      dismissedByName: (profile?.name || user.email || 'Unknown').slice(0, 200),
      dismissedAt: serverTimestamp(),
    });
  };

  const restore = async (company: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'verticalDismissals', dismissalKey(company)));
  };

  return { dismissals: data || [], byKey, isDismissed, markTrading, restore };
}

export type VerticalDismissals = ReturnType<typeof useVerticalDismissals>;
