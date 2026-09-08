"use client";

import React, { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { PipelineReview, WeeklyProgress, ActualSpendRecord } from '@/types/crm';
import { usePipelineData } from '@/contexts/pipeline-context';
import { getQuarterFromActivity, FinancialQuarter, getCurrentFinancialProgress } from '@/lib/quarterly-utils';
import { normalizeBdmName, isUserSubmissionMatch, formatCurrency, formatEAV } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Download, 
  Loader2, 
  Users, 
  Target, 
  TrendingUp, 
  PhoneCall, 
  CalendarCheck, 
  Briefcase, 
  ShieldCheck, 
  UserCheck,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { HARDCODED_ACCOUNT_MAP } from "@/lib/account-mappings";

import { TopCustomersCompany, TopCustomer } from './overview/top-customers-company';
import { TopCustomersByManager, ManagerCustomerData } from './overview/top-customers-by-manager';
import { TopOpportunitiesByManager, ManagerOpportunityData } from './overview/top-opportunities-by-manager';
import { QuarterlyPerformanceTable } from './overview/quarterly-performance-table';
import { TargetAttainment, AttainmentData } from './overview/target-attainment';
import { AtRiskCustomers, AtRiskCustomer } from './overview/at-risk-customers';


export interface UnifiedOverviewUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  state?: string;
  territory?: string;
  target: number;
  manualYtdTarget?: number;
  linkedIds: string[];
}

export function OverviewHub() {
  const db = useFirestore();
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ACCOUNT_MANAGER' | 'BDM'>('ALL');

  // Queries
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const actualQuery = useMemoFirebase(() => db ? query(collection(db, 'actualRevenues'), orderBy('category', 'desc')) : null, [db]);
  const mappingsQuery = useMemoFirebase(() => db ? query(collection(db, 'accountMappings')) : null, [db]);

  const { data: rawUsers, isLoading: usersLoading } = useCollection<any>(usersQuery);
  const { data: actualSpend, isLoading: spendLoading } = useCollection<ActualSpendRecord>(actualQuery);
  const { data: dbMappings, isLoading: mappingsLoading } = useCollection<any>(mappingsQuery);
  
  const { allPipelineReviews: pipelines, allWeeklyProgresses: progress, isLoading: pipLoading } = usePipelineData();

  const isLoading = usersLoading || pipLoading || spendLoading || mappingsLoading;

  const { 
    topCompanyCustomers, 
    managerCustomers, 
    managerOpportunities, 
    quarterlyData, 
    attainmentData, 
    atRiskCustomers,
    currentYear,
    summaryKpis,
    latestActualSpendUploadDate
  } = useMemo(() => {
    if (!rawUsers || !pipelines || !progress || !actualSpend) {
      return {
        topCompanyCustomers: [], 
        managerCustomers: [], 
        managerOpportunities: [], 
        quarterlyData: [], 
        attainmentData: [], 
        atRiskCustomers: [], 
        currentYear: new Date().getFullYear(),
        summaryKpis: { totalReps: 0, totalRevenue: 0, totalTarget: 0, totalCalls: 0, totalApps: 0, totalPipeline: 0 },
        latestActualSpendUploadDate: new Date()
      };
    }

    let latestActualSpendUploadDate = new Date();
    let maxUploadTime = 0;
    const currentYear = new Date().getFullYear();

    // 1. Build non-staff exclusion set (Guests, GMs, Leaders, Admins, Mock accounts)
    const nonStaffNames = new Set<string>(['unassigned', 'guest', 'guest user', 'admin', 'administrator', 'gm', 'leader']);
    const nonStaffIds = new Set<string>();

    rawUsers.forEach((u: any) => {
      const roleStr = (u.role || '').toUpperCase().trim();
      const emailStr = (u.email || '').toLowerCase().trim();
      const nameStr = (u.name || '').toLowerCase().trim();
      const normName = normalizeBdmName(u.name || u.email, u.id).toLowerCase();

      const isExcludedRole = 
        roleStr === 'GUEST' || 
        roleStr === 'GM' || 
        roleStr === 'LEADER' || 
        roleStr === 'ADMIN' || 
        roleStr === 'SUPER_ADMIN' ||
        u.isMock ||
        emailStr === '1@1.com' ||
        emailStr.includes('guest') ||
        nameStr.includes('guest') ||
        nameStr.includes('admin') ||
        nameStr.includes('leader') ||
        nameStr.includes('gm');

      if (isExcludedRole) {
        if (u.id) nonStaffIds.add(u.id);
        if (u.uid) nonStaffIds.add(u.uid);
        if (u.salesforceUserId) nonStaffIds.add(u.salesforceUserId);
        if (normName && normName !== 'unassigned') nonStaffNames.add(normName);
        if (nameStr) nonStaffNames.add(nameStr);
      }
    });

    // 2. Extract and Deduplicate Staff Members (Only AMs and BDMs)
    const teamUserMap = new Map<string, UnifiedOverviewUser>();

    rawUsers.forEach((u: any) => {
      const roleStr = (u.role || '').toUpperCase().trim();
      const normName = normalizeBdmName(u.name || u.email, u.id);
      const normLower = normName.toLowerCase();

      if (
        normName === 'Unassigned' ||
        nonStaffNames.has(normLower) || 
        (u.id && nonStaffIds.has(u.id)) || 
        (u.uid && nonStaffIds.has(u.uid))
      ) {
        return;
      }

      const isStaff = roleStr === 'BDM' || roleStr === 'ACCOUNT_MANAGER' || roleStr === 'AM' ||
        normLower.includes('rienzie') || normLower.includes('ballantyne') || normLower.includes('namra') ||
        normLower.includes('jacqui') || normLower.includes('joshua') || normLower.includes('isaac');

      if (!isStaff) return;

      const formattedRole = (roleStr === 'ACCOUNT_MANAGER' || roleStr === 'AM' || normLower.includes('rienzie') || normLower.includes('ballantyne'))
        ? 'ACCOUNT_MANAGER'
        : 'BDM';

      const targetVal = Number(u.target || u.revenueTarget) || 1000000;

      if (!teamUserMap.has(normName)) {
        teamUserMap.set(normName, {
          id: u.id || u.uid || normName,
          name: normName,
          email: u.email,
          role: formattedRole,
          state: u.state || u.territory,
          territory: u.territory || u.state,
          target: targetVal,
          manualYtdTarget: Number(u.manualYtdTarget) || undefined,
          linkedIds: [u.id, u.uid, u.salesforceUserId].filter(Boolean) as string[],
        });
      } else {
        const existing = teamUserMap.get(normName)!;
        [u.id, u.uid, u.salesforceUserId].filter(Boolean).forEach(id => {
          if (!existing.linkedIds.includes(id)) existing.linkedIds.push(id);
        });
        if (targetVal > existing.target) {
          existing.target = targetVal;
        }
        if (Number(u.manualYtdTarget) > 0) {
          existing.manualYtdTarget = Number(u.manualYtdTarget);
        }
      }
    });

    // Also check pipeline reviews for any active staff reps
    pipelines.forEach(p => {
      const normName = normalizeBdmName(p.userName, p.userId);
      const normLower = normName.toLowerCase();
      if (
        normName === 'Unassigned' ||
        nonStaffNames.has(normLower) || 
        (p.userId && nonStaffIds.has(p.userId))
      ) {
        return;
      }

      if (!teamUserMap.has(normName)) {
        const role = normLower.includes('rienzie') || normLower.includes('ballantyne') ? 'ACCOUNT_MANAGER' : 'BDM';
        teamUserMap.set(normName, {
          id: p.userId || normName,
          name: normName,
          role: role,
          target: 1000000,
          linkedIds: [p.userId].filter(Boolean) as string[]
        });
      } else if (p.userId) {
        const existing = teamUserMap.get(normName)!;
        if (!existing.linkedIds.includes(p.userId)) existing.linkedIds.push(p.userId);
      }
    });

    const allTeamUsers = Array.from(teamUserMap.values())
      .filter(u => !nonStaffNames.has(u.name.toLowerCase()) && !nonStaffIds.has(u.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Helper: Find team user for any doc
    const findTeamUser = (doc: { userId?: string; userName?: string; id?: string }) => {
      return allTeamUsers.find(u => 
        isUserSubmissionMatch(u, doc) ||
        (doc.userId && u.linkedIds.includes(doc.userId)) ||
        (doc.id && u.linkedIds.some(lid => doc.id?.startsWith(lid))) ||
        (doc.userName && normalizeBdmName(doc.userName).toLowerCase() === u.name.toLowerCase())
      );
    };

    // 2. Map account identifiers to users from PipelineReview records
    const accountToUserMap = new Map<string, string>(); 
    
    // 1. Seed with known image mappings
    Object.entries(HARDCODED_ACCOUNT_MAP).forEach(([acc, repName]) => {
      accountToUserMap.set(acc.toLowerCase().trim(), repName);
    });

    // 2. Override/add with live Pipeline mappings
    const userOpportunitiesMap = new Map<string, Map<string, PipelineReview>>();

    allTeamUsers.forEach(u => userOpportunitiesMap.set(u.name, new Map()));

    pipelines.forEach(p => {
      const matchedUser = findTeamUser(p);
      if (matchedUser) {
        if (p.accountMasterCode) accountToUserMap.set(p.accountMasterCode.toLowerCase().trim(), matchedUser.name);
        if (p.pipeline) accountToUserMap.set(p.pipeline.toLowerCase().trim(), matchedUser.name);

        // Group opportunities
        if (p.stage !== 'Closed Lost') {
          const oppKey = p.salesforceId || p.opportunityName || p.pipeline;
          const userOpps = userOpportunitiesMap.get(matchedUser.name)!;
          const existing = userOpps.get(oppKey);
          if (!existing || (Number(p.value) > Number(existing.value))) {
            userOpps.set(oppKey, p);
          }
        }
      }
    });

    // 3. Absolute override with DB Account Mappings
    if (dbMappings) {
      dbMappings.forEach((m: any) => {
        accountToUserMap.set(m.id.toLowerCase().trim(), m.assignedToName);
      });
    }

    // 3. Process Actual Spend for Top Traders & Attribution
    const spendMap = new Map<string, { companyName: string, value: number, userName?: string }>();
    const userCustomersMap = new Map<string, Map<string, number>>();
    allTeamUsers.forEach(u => userCustomersMap.set(u.name, new Map()));

    actualSpend.forEach(s => {
      // Track latest upload date
      const dateField = s.uploadedAt || (s as any).createdAt;
      if (dateField) {
        const d = dateField.toDate ? dateField.toDate() : new Date(dateField);
        if (!isNaN(d.getTime()) && d.getTime() > maxUploadTime) {
          maxUploadTime = d.getTime();
          latestActualSpendUploadDate = d;
        }
      }

      const name = (s.companyName || s.account || 'Unnamed').trim();
      const key = name.toLowerCase();
      const val = Number(s.value) || 0;

      let matchedUserName = accountToUserMap.get(key);
      if (!matchedUserName && s.account) {
        matchedUserName = accountToUserMap.get(s.account.toLowerCase().trim());
      }

      if (!spendMap.has(key)) {
        spendMap.set(key, { companyName: name, value: 0, userName: matchedUserName });
      }
      spendMap.get(key)!.value += val;

      if (matchedUserName && userCustomersMap.has(matchedUserName)) {
        const custMap = userCustomersMap.get(matchedUserName)!;
        custMap.set(name, (custMap.get(name) || 0) + val);
      }
    });

    const topCompanyCustomers: TopCustomer[] = Array.from(spendMap.values())
      .map(s => ({
        companyName: s.companyName,
        revenue: s.value
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 4. Build Manager Customers list
    const managerCustomers: ManagerCustomerData[] = allTeamUsers.map(u => {
      const custMap = userCustomersMap.get(u.name)!;
      const customers = Array.from(custMap.entries()).map(([companyName, revenue]) => ({
        companyName,
        revenue
      })).sort((a, b) => b.revenue - a.revenue);

      return {
        user: {
          uid: u.id,
          name: u.name,
          role: u.role as any,
          territory: u.territory as any,
          target: u.target,
          manualYtdTarget: u.manualYtdTarget
        },
        customers
      };
    });

    // 5. Build Manager Opportunities list
    const managerOpportunities: ManagerOpportunityData[] = allTeamUsers.map(u => {
      const opps = Array.from(userOpportunitiesMap.get(u.name)!.values()).map(p => ({
        opportunityName: p.opportunityName || p.pipeline,
        companyName: p.pipeline,
        value: Number(p.value) || 0,
        probability: Number(p.probability) || 0
      })).sort((a, b) => b.value - a.value);

      return {
        user: {
          uid: u.id,
          name: u.name,
          role: u.role as any,
          territory: u.territory as any,
          target: u.target,
          manualYtdTarget: u.manualYtdTarget
        },
        opportunities: opps
      };
    });

    // 6. Quarterly Performance & Attainment Data
    const qDataMap = new Map<string, any>();
    allTeamUsers.forEach(u => {
      const qt = u.target / 4;
      qDataMap.set(u.name, {
        user: {
          uid: u.id,
          name: u.name,
          role: u.role as any,
          territory: u.territory as any,
          target: u.target,
          manualYtdTarget: u.manualYtdTarget
        },
        q1: { appointments: 0, calls: 0, successfulDeals: 0, revenue: 0, targetRevenue: qt },
        q2: { appointments: 0, calls: 0, successfulDeals: 0, revenue: 0, targetRevenue: qt },
        q3: { appointments: 0, calls: 0, successfulDeals: 0, revenue: 0, targetRevenue: qt },
        q4: { appointments: 0, calls: 0, successfulDeals: 0, revenue: 0, targetRevenue: qt },
        ytdRevenue: 0,
        target: u.target
      });
    });

    // Aggregate Weekly Activity into Quarters
    progress.forEach(prog => {
      const matchedUser = findTeamUser(prog);
      if (!matchedUser) return;

      const q = getQuarterFromActivity(prog);
      if (q.label === 'UNKNOWN') return;

      const uData = qDataMap.get(matchedUser.name);
      if (!uData) return;

      const qKey = q.label.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4';
      const calls = Number(prog.calls) || Number(prog.crmCalls) || 0;
      const appts = Number(prog.appointments) || Number(prog.apps) || Number(prog.crmApps) || 0;
      const deals = Number(prog.deals) || 0;

      uData[qKey].calls += calls;
      uData[qKey].appointments += appts;
      uData[qKey].successfulDeals += deals;
    });

    // Aggregate Spend into User Quarters & YTD
    actualSpend.forEach(s => {
      const rawName = (s.companyName || s.account || 'Unnamed').trim().toLowerCase();
      const cleanName = rawName.replace(/\s*\(parcels\)\s*/, '').replace(/\s*\(freight\)\s*/, '').trim();

      let matchedUserName = accountToUserMap.get(rawName) || accountToUserMap.get(cleanName);
      
      if (!matchedUserName && s.account) {
        const rawAcc = s.account.toLowerCase().trim();
        const cleanAcc = rawAcc.replace(/\s*\(parcels\)\s*/, '').replace(/\s*\(freight\)\s*/, '').trim();
        matchedUserName = accountToUserMap.get(rawAcc) || accountToUserMap.get(cleanAcc);
      }

      if (matchedUserName && qDataMap.has(matchedUserName)) {
        const uData = qDataMap.get(matchedUserName);
        const val = Number(s.value) || 0;
        uData.ytdRevenue += val;

        const q = getQuarterFromActivity(s);
        if (q.label !== 'UNKNOWN') {
          const qKey = q.label.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4';
          uData[qKey].revenue += val;
        } else {
          // If no quarter date on spend doc, allocate to current active quarter / Q1
          uData.q1.revenue += val;
        }
      }
    });

    const quarterlyData = Array.from(qDataMap.values());

    const attainmentData: AttainmentData[] = quarterlyData.map(d => ({
      user: d.user,
      ytdRevenue: d.ytdRevenue,
      target: d.target
    }));

    // 7. At-Risk Customers
    const atRiskMap = new Map<string, AtRiskCustomer>();
    pipelines.forEach(p => {
      if (!p.pipeline) return;
      const key = (p.accountMasterCode || p.pipeline).trim();
      const matchedUser = findTeamUser(p);

      if (!atRiskMap.has(key)) {
        atRiskMap.set(key, {
          companyName: p.pipeline,
          currentRevenue: Number(p.currentRevenue) || 0,
          lastYearRevenue: Number(p.lastYearRevenue) || 0,
          variance: 0,
          managerName: matchedUser?.name
        });
      } else {
        const existing = atRiskMap.get(key)!;
        existing.currentRevenue = Math.max(existing.currentRevenue, Number(p.currentRevenue) || 0);
        existing.lastYearRevenue = Math.max(existing.lastYearRevenue, Number(p.lastYearRevenue) || 0);
        if (!existing.managerName && matchedUser?.name) existing.managerName = matchedUser.name;
      }
    });

    Array.from(atRiskMap.values()).forEach(c => {
      c.variance = c.currentRevenue - c.lastYearRevenue;
    });

    const atRiskCustomers = Array.from(atRiskMap.values());

    // 8. Calculate Overall Executive Summary KPIs
    const totalReps = allTeamUsers.length;
    const totalRevenue = quarterlyData.reduce((acc, d) => acc + d.ytdRevenue, 0);
    const totalTarget = quarterlyData.reduce((acc, d) => acc + d.target, 0);
    const totalCalls = quarterlyData.reduce((acc, d) => acc + d.q1.calls + d.q2.calls + d.q3.calls + d.q4.calls, 0);
    const totalApps = quarterlyData.reduce((acc, d) => acc + d.q1.appointments + d.q2.appointments + d.q3.appointments + d.q4.appointments, 0);
    const totalPipeline = managerOpportunities.reduce((acc, m) => acc + m.opportunities.reduce((s, o) => s + o.value, 0), 0);

    return { 
      topCompanyCustomers, 
      managerCustomers, 
      managerOpportunities, 
      quarterlyData, 
      attainmentData, 
      atRiskCustomers, 
      currentYear,
      summaryKpis: {
        totalReps,
        totalRevenue,
        totalTarget,
        totalCalls,
        totalApps,
        totalPipeline
      },
      latestActualSpendUploadDate
    };
  }, [rawUsers, pipelines, progress, actualSpend]);

  const handleExportPDF = () => {
    window.print();
  };

  // Filtered views based on Role selection
  const filteredQuarterlyData = useMemo(() => {
    if (roleFilter === 'ALL') return quarterlyData;
    return quarterlyData.filter(d => (d.user.role as string) === roleFilter || (roleFilter === 'ACCOUNT_MANAGER' && (d.user.role as string) === 'AM'));
  }, [quarterlyData, roleFilter]);

  const filteredAttainmentData = useMemo(() => {
    if (roleFilter === 'ALL') return attainmentData;
    return attainmentData.filter(d => (d.user.role as string) === roleFilter || (roleFilter === 'ACCOUNT_MANAGER' && (d.user.role as string) === 'AM'));
  }, [attainmentData, roleFilter]);

  const filteredManagerCustomers = useMemo(() => {
    if (roleFilter === 'ALL') return managerCustomers;
    return managerCustomers.filter(m => (m.user.role as string) === roleFilter || (roleFilter === 'ACCOUNT_MANAGER' && (m.user.role as string) === 'AM'));
  }, [managerCustomers, roleFilter]);

  const filteredManagerOpportunities = useMemo(() => {
    if (roleFilter === 'ALL') return managerOpportunities;
    return managerOpportunities.filter(m => (m.user.role as string) === roleFilter || (roleFilter === 'ACCOUNT_MANAGER' && (m.user.role as string) === 'AM'));
  }, [managerOpportunities, roleFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-sm font-semibold text-slate-500">Loading Executive Team Overview...</p>
      </div>
    );
  }

  // Use the latest actual spend upload date for all financial progress metrics 
  // so that pacing doesn't exceed the data we actually have.
  const finProgress = getCurrentFinancialProgress(latestActualSpendUploadDate);
  const totalPacedTarget = (summaryKpis.totalTarget / 12) * finProgress.financialMonthIndex;
  const teamPacingPct = totalPacedTarget > 0 ? ((summaryKpis.totalRevenue / totalPacedTarget) * 100).toFixed(1) : '0.0';
  const overallAttainmentPct = summaryKpis.totalTarget > 0 
    ? ((summaryKpis.totalRevenue / summaryKpis.totalTarget) * 100).toFixed(1) 
    : '0.0';

  const isTeamAhead = Number(teamPacingPct) >= 100;
  const isTeamAtRisk = Number(teamPacingPct) >= 85 && Number(teamPacingPct) < 100;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* Header & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <LayoutDashboard className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Executive Overview
                </h2>
                <Badge className="bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wider">
                  {finProgress.currentQuarter} • {finProgress.monthName}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Team Scorecard, Target Attainment & Activity Analysis for Account Managers and BDMs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Role Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'ALL' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Team ({quarterlyData.length})
            </button>
            <button
              onClick={() => setRoleFilter('ACCOUNT_MANAGER')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'ACCOUNT_MANAGER' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Account Managers
            </button>
            <button
              onClick={() => setRoleFilter('BDM')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'BDM' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BDMs
            </button>
          </div>

          <Button 
            onClick={handleExportPDF} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-wide shadow-sm text-xs sm:text-sm h-9"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export PDF Report
          </Button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Team Performance Report</h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Financial Position: {finProgress.currentQuarter} ({finProgress.monthName}) • Generated {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Executive KPI Metric Cards Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4">
        {/* Card 1: Team Roster */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Staff</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{summaryKpis.totalReps}</div>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">AMs & BDMs Active</p>
          </div>
        </div>

        {/* Card 2: Team Revenue & Pacing */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">YTD Revenue</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{formatEAV(summaryKpis.totalRevenue)}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold text-slate-500">
                Paced: {formatEAV(totalPacedTarget)}
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                isTeamAhead 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : isTeamAtRisk 
                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {teamPacingPct}% Pace
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Team Outreach Activity */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outreach</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{summaryKpis.totalCalls}</div>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              {summaryKpis.totalApps} Appointments Logged
            </p>
          </div>
        </div>

        {/* Card 4: Active Pipeline */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Pipeline</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{formatEAV(summaryKpis.totalPipeline)}</div>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Total Qualified Deals</p>
          </div>
        </div>
      </div>

      {/* Target Attainment Leaderboard Card Section */}
      <TargetAttainment data={filteredAttainmentData} referenceDate={latestActualSpendUploadDate} />

      {/* Quarterly Performance Card Section (Responsive Dynamic Cards & Table View) */}
      <QuarterlyPerformanceTable data={filteredQuarterlyData} year={currentYear} referenceDate={latestActualSpendUploadDate} />

      {/* Top Traders Card */}
      <div className="page-break-inside-avoid">
        <TopCustomersCompany data={topCompanyCustomers} />
      </div>

      {/* Break page for printing if needed */}
      <div className="print:break-before-page"></div>

      {/* Top Customers per Manager Card Section */}
      <TopCustomersByManager data={filteredManagerCustomers} />

      {/* Break page for printing if needed */}
      <div className="print:break-before-page"></div>
      
      {/* Top Opportunities per Manager Card Section */}
      <TopOpportunitiesByManager data={filteredManagerOpportunities} />

    </div>
  );
}
