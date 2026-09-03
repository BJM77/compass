"use client";

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { normalizeBdmName, isUserSubmissionMatch } from '@/lib/utils';

// ─── Active stages that qualify as an "Opportunity" row ──────────────────────
const ACTIVE_STAGES = new Set([
  'develop', 'propose', 'negotiating', 'finalise', 'pending trade',
]);

function isActive(stage: string): boolean {
  return ACTIVE_STAGES.has((stage || '').trim().toLowerCase());
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CRMUserSummary {
  userId: string;
  userName: string;
  // Opportunity metrics (active stages only, deduped revenue)
  opportunityCount: number;
  opportunityValue: number;
  oppYTDRevenueThisFY: number;
  oppYTDRevenueLastFY: number;
  oppRecords: any[]; // Raw active opportunity records
  // Account / Customer metrics (all rows, deduped by accountMasterCode)
  customerCount: number;
  custYTDRevenueThisFY: number;
  custYTDRevenueLastFY: number;
  custRecords: any[]; // Raw unique customer records
}

export interface CRMTeamSummary {
  byUser: CRMUserSummary[];       // per-BDM breakdown — only for leaders/GMs
  team: CRMUserSummary;            // aggregate team totals (all roles)
  myStats: CRMUserSummary | null;  // caller's own row
  isLoading: boolean;
}

// ─── Helper: aggregate a list of pipeline records into a CRMUserSummary ──────
function aggregateRecords(
  records: any[],
  userId: string,
  userName: string
): CRMUserSummary {
  // Opportunity rows: active stage, not a bare account entry
  const oppRows = records.filter(r => !r.isBareAccount && isActive(r.stage));

  // Revenue maps keyed by accountMasterCode to prevent triple-counting
  const oppRevFY  = new Map<string, number>();
  const oppRevLY  = new Map<string, number>();
  oppRows.forEach(r => {
    const code = r.accountMasterCode || r.id;
    if (!oppRevFY.has(code)) oppRevFY.set(code, Number(r.currentRevenue)  || 0);
    if (!oppRevLY.has(code)) oppRevLY.set(code, Number(r.lastYearRevenue) || 0);
  });

  const custRevFY = new Map<string, number>();
  const custRevLY = new Map<string, number>();
  const uniqueCustMap = new Map<string, any>();
  records.forEach(r => {
    const code = r.accountMasterCode || r.id;
    // Always take the max revenue across all rows for this account to avoid zeros overriding real data
    const thisFY = Number(r.currentRevenue) || 0;
    const lastFY = Number(r.lastYearRevenue) || 0;
    
    if (!custRevFY.has(code) || thisFY > custRevFY.get(code)!) {
      custRevFY.set(code, thisFY);
    }
    if (!custRevLY.has(code) || lastFY > custRevLY.get(code)!) {
      custRevLY.set(code, lastFY);
    }
    if (!uniqueCustMap.has(code)) uniqueCustMap.set(code, r);
  });

  const sumMap = (m: Map<string, number>) =>
    Array.from(m.values()).reduce((a, b) => a + b, 0);

  return {
    userId,
    userName,
    opportunityCount:     oppRows.length,
    opportunityValue:     oppRows.reduce((s, r) => s + (Number(r.value) || 0), 0),
    oppYTDRevenueThisFY:  sumMap(oppRevFY),
    oppYTDRevenueLastFY:  sumMap(oppRevLY),
    oppRecords:           oppRows,
    customerCount:        custRevFY.size,
    custYTDRevenueThisFY: sumMap(custRevFY),
    custYTDRevenueLastFY: sumMap(custRevLY),
    custRecords:          Array.from(uniqueCustMap.values()),
  };
}

export const EMPTY_SUMMARY: CRMUserSummary = {
  userId: 'TEAM', userName: 'Team Total',
  opportunityCount: 0, opportunityValue: 0,
  oppYTDRevenueThisFY: 0, oppYTDRevenueLastFY: 0,
  oppRecords: [],
  customerCount: 0, custYTDRevenueThisFY: 0, custYTDRevenueLastFY: 0,
  custRecords: [],
};

function addSummaries(a: CRMUserSummary, b: CRMUserSummary): CRMUserSummary {
  return {
    userId: 'TEAM', userName: 'Team Total',
    opportunityCount:     a.opportunityCount     + b.opportunityCount,
    opportunityValue:     a.opportunityValue     + b.opportunityValue,
    oppYTDRevenueThisFY:  a.oppYTDRevenueThisFY  + b.oppYTDRevenueThisFY,
    oppYTDRevenueLastFY:  a.oppYTDRevenueLastFY  + b.oppYTDRevenueLastFY,
    oppRecords:           [...a.oppRecords, ...b.oppRecords],
    customerCount:        a.customerCount        + b.customerCount,
    custYTDRevenueThisFY: a.custYTDRevenueThisFY + b.custYTDRevenueThisFY,
    custYTDRevenueLastFY: a.custYTDRevenueLastFY + b.custYTDRevenueLastFY,
    custRecords:          [...a.custRecords, ...b.custRecords],
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────
/**
 * useCRMSummary
 *
 * Always fetches the full team dataset for the current week so that:
 * - Team totals are available to ALL roles (BDMs see the team total bar)
 * - Leaders/GMs get the per-individual breakdown in byUser
 *
 * @param myUserId  The UID of the currently authenticated / simulated user.
 * @param isLeader  Whether the caller has leader-level access.
 */
export function useCRMSummary(myUserId: string | null, isLeader: boolean): CRMTeamSummary {
  const db = useFirestore();

  // Fetch records based on role to respect Firestore security rules.
  // Leaders fetch all records, BDMs fetch only their own.
  const allQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (isLeader) {
      return query(collection(db, 'pipelineReviews'));
    } else if (myUserId) {
      return query(collection(db, 'pipelineReviews'), where('userId', '==', myUserId));
    }
    return null;
  }, [db, isLeader, myUserId]);

  const { data: rawRecords, isLoading } = useCollection(allQuery);

  return useMemo<CRMTeamSummary>(() => {
    const allRecords = (rawRecords || []).filter(
      (r: any) => !r.userName || r.userName.toUpperCase() !== 'JOHN THORNTON'
    );

    // Deduplicate to only keep the most recent row for each opportunity/customer
    const latestMap = new Map<string, any>();
    allRecords.forEach(r => {
      const key = r.salesforceId || r.accountMasterCode || r.id;
      if (!key) return;
      const existing = latestMap.get(key);
      if (!existing || (r.week || '') > (existing.week || '')) {
        latestMap.set(key, r);
      }
    });
    const records = Array.from(latestMap.values());

    // Group records by Normalized User Name to prevent duplicate users
    const byUserName = new Map<string, { id: string, name: string; rows: any[] }>();
    records.forEach(r => {
      if (!r.userId) return;
      const normName = normalizeBdmName(r.userName, r.userId);
      if (normName === 'Unassigned') return;
      
      if (!byUserName.has(normName)) {
        // Keep the original userId for reference but group by normalized name
        byUserName.set(normName, { id: r.userId, name: normName, rows: [] });
      }
      byUserName.get(normName)!.rows.push(r);
    });

    // Build per-user summaries sorted by name
    const byUser = Array.from(byUserName.entries())
      .map(([name, { id, rows }]) => aggregateRecords(rows, id, name))
      .sort((a, b) => a.userName.localeCompare(b.userName));

    // Team total = sum of all per-user summaries
    const team = byUser.reduce(addSummaries, { ...EMPTY_SUMMARY });

    // Caller's own row
    let myStats = null;
    if (myUserId) {
      // Find using flexible match to support aliases
      const matchedUser = byUser.find(u => 
        isUserSubmissionMatch({ id: myUserId }, { userId: u.userId, userName: u.userName })
      );
      myStats = matchedUser ?? { ...EMPTY_SUMMARY, userId: myUserId, userName: '' };
    }

    return {
      // Only expose individual breakdown to leaders/GMs; BDMs get empty array
      byUser: isLeader ? byUser : [],
      team,
      myStats,
      isLoading,
    };
  }, [rawRecords, myUserId, isLeader, isLoading]);
}
