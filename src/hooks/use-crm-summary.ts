"use client";

import { useMemo } from 'react';
import { normalizeBdmName, isUserSubmissionMatch, getCurrentWeek, getNWeeksAgoKey } from '@/lib/utils';

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
    const code = r.accountMasterCode || r.pipeline?.trim().toLowerCase() || r.id;
    if (!oppRevFY.has(code)) oppRevFY.set(code, Number(r.currentRevenue)  || 0);
    if (!oppRevLY.has(code)) oppRevLY.set(code, Number(r.lastYearRevenue) || 0);
  });

  const custRevFY = new Map<string, number>();
  const custRevLY = new Map<string, number>();
  const uniqueCustMap = new Map<string, any>();
  records.forEach(r => {
    const code = r.accountMasterCode || r.pipeline?.trim().toLowerCase() || r.id;
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
 * Computes individual and team summaries from the provided CRM dataset.
 *
 * @param myUserId  The UID of the currently authenticated / simulated user.
 * @param isLeader  Whether the caller has leader-level access.
 * @param allDeals  The pre-fetched pipeline reviews dataset.
 */
export function useCRMSummary(myUserId: string | null, isLeader: boolean, allDeals: any[] = []): CRMTeamSummary {
  return useMemo<CRMTeamSummary>(() => {
    const rawRecords = allDeals;
    const isLoading = false; // Managed by parent context
    
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
    const byUserName = new Map<string, { id: string, name: string; rows: any[], allIds: Set<string> }>();
    records.forEach(r => {
      if (!r.userId && !r.userName) return;
      const normName = normalizeBdmName(r.userName, r.userId);
      if (normName === 'Unassigned') return;
      
      if (!byUserName.has(normName)) {
        // Keep the original userId for reference but group by normalized name
        byUserName.set(normName, { id: r.userId || 'unknown', name: normName, rows: [], allIds: new Set<string>() });
      }
      const group = byUserName.get(normName)!;
      if (r.userId) group.allIds.add(r.userId);
      group.rows.push(r);
    });

    // Duplicate-name handling
    byUserName.forEach((group, normName) => {
      if (group.allIds.size > 1) {
        // Suppressed identity-fragmentation warning as it was cluttering the console in production
      }
    });

    // Build per-user summaries sorted by name
    const byUser = Array.from(byUserName.values())
      .map(({ id, name, rows, allIds }) => ({
        ...aggregateRecords(rows, id, name),
        allIds: Array.from(allIds) // Attach all known IDs to the summary for robust matching
      }))
      .sort((a, b) => a.userName.localeCompare(b.userName));

    // Team total = aggregate across all unique records globally to prevent double-counting shared accounts
    const team = aggregateRecords(records, 'TEAM', 'Team Total');

    // Caller's own row
    let myStats = null;
    if (myUserId) {
      // Find using flexible match to support aliases and legacy IDs
      // byUser now has allIds attached from the aggregation step
      const matchedUser = byUser.find(u => {
        // Create a dummy user object with the target myUserId to check if it's in the summary's allIds
        return u.allIds.includes(myUserId) || normalizeBdmName(u.userName) === normalizeBdmName('', myUserId);
      });
      myStats = matchedUser ?? { ...EMPTY_SUMMARY, userId: myUserId, userName: '' };
    }

    return {
      // Only expose individual breakdown to leaders/GMs; BDMs get empty array
      byUser: isLeader ? byUser : [],
      team,
      myStats,
      isLoading,
    };
  }, [allDeals, myUserId, isLeader]);
}
