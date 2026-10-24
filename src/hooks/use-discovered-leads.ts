'use client';

import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import type { DiscoveredLead } from '@/lib/intel';

const ms = (t: any): number => (t?.toMillis ? t.toMillis() : typeof t?.seconds === 'number' ? t.seconds * 1000 : 0);

/**
 * Team-wide leads found by "Find new leads" (discoveredLeads collection, newest first).
 * Written only by the server route; all staff can read.
 */
export function useDiscoveredLeads() {
  const db = useFirestore();
  const { user } = useAuth();
  const ref = useMemoFirebase(() => (db && user ? collection(db, 'discoveredLeads') : null), [db, user]);
  const { data } = useCollection<DiscoveredLead>(ref);
  return useMemo(() => [...(data || [])].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)), [data]);
}

export function discoveredAtMs(d: Pick<DiscoveredLead, 'createdAt'>): number { return ms(d.createdAt); }
