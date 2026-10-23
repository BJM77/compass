'use client';

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { normalizeHistory, resolveLayout, type Audience, type DashboardLayoutSettings } from '@/lib/dashboard-layout';

/**
 * Reads the shared dashboard layout from appSettings/global (staff-readable; admin-write only).
 * One document listener, same doc the dashboards already read.
 */
export function useDashboardLayout(audience: Audience) {
  const db = useFirestore();
  const { user } = useAuth();
  const ref = useMemoFirebase(() => (db && user ? doc(db, 'appSettings', 'global') : null), [db, user]);
  const { data, isLoading } = useDoc<DashboardLayoutSettings & { dashboardLayoutHistory?: unknown }>(ref);
  const layout = useMemo(() => resolveLayout(data, audience), [data, audience]);
  const history = useMemo(() => normalizeHistory(data?.dashboardLayoutHistory), [data]);
  return { layout, history, settings: data, isLoading };
}
