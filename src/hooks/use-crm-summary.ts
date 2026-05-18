"use client";

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { getCurrentWeek } from '@/lib/utils';

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

  // Customer maps across ALL rows (opportunities + bare accounts)
  const custRevFY = new Map<string, number>();
  const custRevLY = new Map<string, number>();
  const uniqueCustMap = new Map<string, any>();
  records.forEach(r => {
    const code = r.accountMasterCode || r.id;
    if (!custRevFY.has(code)) custRevFY.set(code, Number(r.currentRevenue)  || 0);
    if (!custRevLY.has(code)) custRevLY.set(code, Number(r.lastYearRevenue) || 0);
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
  const currentWeek = getCurrentWeek();

  // Fetch ALL team records for the week — needed by both BDMs (for team total)
  // and leaders (for per-user breakdown).
  const allQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek));
  }, [db, currentWeek]);

  const { data: allRecords, isLoading } = useCollection(allQuery);

  return useMemo<CRMTeamSummary>(() => {
    const records = allRecords || [];

    // Group records by userId
    const byUserId = new Map<string, { name: string; rows: any[] }>();
    records.forEach(r => {
      if (!r.userId) return;
      if (!byUserId.has(r.userId)) {
        byUserId.set(r.userId, { name: r.userName || r.userId, rows: [] });
      }
      byUserId.get(r.userId)!.rows.push(r);
    });

    // Build per-user summaries sorted by name
    const byUser = Array.from(byUserId.entries())
      .map(([uid, { name, rows }]) => aggregateRecords(rows, uid, name))
      .sort((a, b) => a.userName.localeCompare(b.userName));

    // Team total = sum of all per-user summaries
    const team = byUser.reduce(addSummaries, { ...EMPTY_SUMMARY });

    // Caller's own row
    const myStats = myUserId
      ? (byUser.find(u => u.userId === myUserId) ?? { ...EMPTY_SUMMARY, userId: myUserId, userName: '' })
      : null;

    return {
      // Only expose individual breakdown to leaders/GMs; BDMs get empty array
      byUser: isLeader ? byUser : [],
      team,
      myStats,
      isLoading,
    };
  }, [allRecords, myUserId, isLeader, isLoading]);
}
