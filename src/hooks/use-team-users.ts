import { useMemo } from 'react';
import { collection } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuth } from '@/contexts/auth-context';
import { normalizeBdmName } from '@/lib/utils';

export interface UnifiedTeamUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  state?: string;
  territory?: string;
  target?: number;
  linkedIds: string[];
}

/**
 * Custom hook to fetch and deduplicate team users (BDMs and AMs) across the entire application.
 * Ensures each physical representative appears exactly once and aggregates all their linked IDs.
 */
export function useTeamUsers(): { teamUsers: UnifiedTeamUser[]; isLoading: boolean } {
  const db = useFirestore();
  const { isLeader } = useAuth();

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);

  const { data: rawUsers, isLoading } = useCollection<any>(usersQuery);

  const teamUsers = useMemo(() => {
    if (!rawUsers) return [];
    const filtered = rawUsers.filter((u: any) => {
      const role = (u.role || '').toUpperCase();
      return (role === 'BDM' || role === 'ACCOUNT_MANAGER' || role === 'AM') && role !== 'GUEST';
    });

    const userMap = new Map<string, UnifiedTeamUser>();

    filtered.forEach((u: any) => {
      const normName = normalizeBdmName(u.name || u.email, u.id);
      if (normName === 'Unassigned') return;

      if (!userMap.has(normName)) {
        userMap.set(normName, {
          id: u.id,
          name: normName,
          email: u.email,
          role: u.role === 'ACCOUNT_MANAGER' || u.role === 'AM' ? 'AM' : u.role,
          state: u.state,
          territory: u.territory,
          target: u.target || u.revenueTarget || 1000000,
          linkedIds: [u.id],
        });
      } else {
        const existing = userMap.get(normName)!;
        if (!existing.linkedIds.includes(u.id)) {
          existing.linkedIds.push(u.id);
        }
        // If user has both BDM and AM roles across duplicate records, mark role as BDM / AM
        if (u.role && existing.role !== u.role) {
          existing.role = 'BDM / AM';
        }
      }
    });

    return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawUsers]);

  return { teamUsers, isLoading };
}
