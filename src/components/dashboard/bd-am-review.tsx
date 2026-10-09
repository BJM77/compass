"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { usePipelineData } from '@/contexts/pipeline-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Users, Calendar, TrendingUp, PhoneCall, CalendarCheck, Target, 
  Trophy, AlertTriangle, Lightbulb, Rocket, DollarSign, Filter,
  Building, RefreshCw, ChevronRight, FileText, CheckCircle2
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO, isWithinInterval, subDays } from 'date-fns';
import { formatEAV, getCurrentWeek, normalizeBdmName, isUserSubmissionMatch } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DatePreset = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

export function BdAmReview() {
  const db = useFirestore();
  const { profile, isLeader, user } = useAuth();
  const { pipelineReviews: allDeals } = usePipelineData();

  // -------------------------------------------------------------
  // 1. Controls State (Date Presets & Team Member Filter)
  // -------------------------------------------------------------
  const [datePreset, setDatePreset] = useState<DatePreset>('WEEKLY');
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');

  // Load team users for drop-down
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: rawUsers } = useCollection(usersQuery);

  const teamUsers = useMemo(() => {
    if (!rawUsers) return [];
    return rawUsers.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER' || u.role === 'LEADER' || u.role === 'GM');
  }, [rawUsers]);

  // Determine current active user filter metadata
  const selectedUserObj = useMemo(() => {
    if (selectedUserId === 'ALL') return null;
    return teamUsers.find(u => u.id === selectedUserId || u.uid === selectedUserId) || null;
  }, [selectedUserId, teamUsers]);

  // -------------------------------------------------------------
  // 2. Date Range Computation
  // -------------------------------------------------------------
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (datePreset) {
      case 'WEEKLY':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'MONTHLY':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'QUARTERLY':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
      case 'YEARLY':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'CUSTOM':
        start = customStartDate ? parseISO(customStartDate) : startOfMonth(now);
        end = customEndDate ? parseISO(customEndDate) : endOfMonth(now);
        break;
    }
    return { start, end };
  }, [datePreset, customStartDate, customEndDate]);

  // -------------------------------------------------------------
  // 3. Load TWIW Submissions & Call Plans
  // -------------------------------------------------------------
  const twiwQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'twiwSubmissions');
  }, [db]);
  const { data: allTwiwSubmissions } = useCollection(twiwQuery);

  const callPlansQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'callPlans');
  }, [db]);
  const { data: allCallPlans } = useCollection(callPlansQuery);

  const weeklyProgressQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'weeklyProgress');
  }, [db]);
  const { data: allWeeklyProgress } = useCollection(weeklyProgressQuery);

  // Helper date checker
  const isDateInRange = (dateVal: any) => {
    if (!dateVal) return false;
    let d: Date | null = null;
    if (typeof dateVal?.toDate === 'function') d = dateVal.toDate();
    else if (dateVal instanceof Date) d = dateVal;
    else if (typeof dateVal === 'string') d = parseISO(dateVal);
    else if (typeof dateVal === 'number') d = new Date(dateVal);

    if (!d || isNaN(d.getTime())) return false;
    return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
  };

  // -------------------------------------------------------------
  // 4. Filter & Aggregate TWTW Data (Wins, Risks, Updates, Priorities)
  // -------------------------------------------------------------
  const aggregatedTwiwData = useMemo(() => {
    if (!allTwiwSubmissions) return { wins: [], risks: [], majorUpdates: [], projectedWins: [], priorities: [], totalCalls: 0, totalApps: 0 };

    let filtered = allTwiwSubmissions.filter(sub => {
      // User filter check
      if (selectedUserId !== 'ALL') {
        if (!isUserSubmissionMatch({ id: selectedUserId, name: selectedUserObj?.name }, sub)) return false;
      }
      // Date range check via submission createdAt or fallback week matching
      if (sub.createdAt) {
        return isDateInRange(sub.createdAt);
      }
      return true; // Fallback include if date field is pending
    });

    const wins: any[] = [];
    const risks: any[] = [];
    const majorUpdates: any[] = [];
    const projectedWins: any[] = [];
    const priorities: any[] = [];
    let totalCalls = 0;
    let totalApps = 0;

    filtered.forEach(sub => {
      const repName = sub.userName || normalizeBdmName(sub.userId, sub.userId);

      (sub.wins || []).forEach((w: any) => {
        if (!w.isHidden) wins.push({ ...w, repName, week: sub.week });
      });

      (sub.risks || []).forEach((r: any) => {
        if (!r.isHidden) risks.push({ ...r, repName, week: sub.week });
      });

      (sub.majorUpdates || []).forEach((m: any) => {
        if (!m.isHidden) majorUpdates.push({ ...m, repName, week: sub.week });
      });

      (sub.projectedWins || []).forEach((p: any) => {
        if (!p.isHidden) projectedWins.push({ ...p, repName, week: sub.week });
      });

      (sub.priorities || []).forEach((pr: any) => {
        if (!pr.isHidden) priorities.push({ ...pr, repName, week: sub.week });
      });

      if (sub.kpiReview) {
        totalCalls += Number(sub.kpiReview.callsActual) || 0;
        totalApps += Number(sub.kpiReview.appointmentsActual) || 0;
      }
    });

    return { wins, risks, majorUpdates, projectedWins, priorities, totalCalls, totalApps };
  }, [allTwiwSubmissions, selectedUserId, selectedUserObj, dateRange]);

  // -------------------------------------------------------------
  // 5. Aggregate Call Plans & Activity Metrics
  // -------------------------------------------------------------
  const activityMetrics = useMemo(() => {
    let filteredPlans = allCallPlans || [];
    let filteredProgress = allWeeklyProgress || [];

    if (selectedUserId !== 'ALL') {
      filteredPlans = filteredPlans.filter(cp => cp.userId === selectedUserId || cp.salespersonUserId === selectedUserId);
      filteredProgress = filteredProgress.filter(wp => wp.userId === selectedUserId);
    }

    // Filter call plans by date range
    const inRangePlans = filteredPlans.filter(cp => isDateInRange(cp.createdAt || cp.updatedAt));
    const totalCallsFromPlans = inRangePlans.length;

    // Secondary source from weeklyProgress if TWIW KPIs not entered
    let progressCalls = 0;
    let progressApps = 0;
    filteredProgress.forEach(wp => {
      progressCalls += Number(wp.calls || wp.crmCalls || 0);
      progressApps += Number(wp.appointments || wp.crmApps || wp.meetingsHeld || 0);
    });

    const callsCount = Math.max(aggregatedTwiwData.totalCalls, totalCallsFromPlans, progressCalls);
    const appsCount = Math.max(aggregatedTwiwData.totalApps, progressApps);

    return {
      calls: callsCount,
      appointments: appsCount,
      callPlansCreated: totalCallsFromPlans,
    };
  }, [allCallPlans, allWeeklyProgress, selectedUserId, dateRange, aggregatedTwiwData]);

  // -------------------------------------------------------------
  // 6. Aggregate Active Opportunities
  // -------------------------------------------------------------
  const activeOpportunities = useMemo(() => {
    if (!allDeals) return [];
    return allDeals.filter(deal => {
      // Filter out closed deals
      if (deal.stage === 'Closed Won' || deal.stage === 'Closed Lost') return false;

      // User filter
      if (selectedUserId !== 'ALL') {
        const uName = (selectedUserObj?.name || '').toLowerCase();
        const dOwner = (deal.userName || '').toLowerCase();
        if (deal.userId !== selectedUserId && !dOwner.includes(uName)) return false;
      }
      return true;
    });
  }, [allDeals, selectedUserId, selectedUserObj]);

  const totalActivePipelineValue = useMemo(() => {
    return activeOpportunities.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [activeOpportunities]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ------------------------------------------------------------- */}
      {/* Header & Controls Section */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">BD/AM Review</h1>
                <p className="text-xs font-semibold text-slate-500">
                  Comprehensive performance summary & strategic operational breakdown for reps and teams.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Team Member Filter */}
            <div className="w-full sm:w-64">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Team Member</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-10 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 text-xs">
                  <SelectValue placeholder="Select Team Member" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="font-bold text-xs">All Team Members</SelectItem>
                  {teamUsers.map(u => (
                    <SelectItem key={u.id} value={u.id} className="font-bold text-xs">
                      {normalizeBdmName(u.name, u.id)} ({u.role?.replace('_', ' ') || 'BDM'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Preset Selector */}
            <div className="w-full sm:w-48">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Time Period</label>
              <Select value={datePreset} onValueChange={(val: DatePreset) => setDatePreset(val)}>
                <SelectTrigger className="h-10 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 text-xs">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="WEEKLY" className="font-bold text-xs">Weekly (This Week)</SelectItem>
                  <SelectItem value="MONTHLY" className="font-bold text-xs">Monthly (This Month)</SelectItem>
                  <SelectItem value="QUARTERLY" className="font-bold text-xs">Quarterly (This Quarter)</SelectItem>
                  <SelectItem value="YEARLY" className="font-bold text-xs">Yearly (This Year)</SelectItem>
                  <SelectItem value="CUSTOM" className="font-bold text-xs">Custom Range...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Custom Date Inputs if CUSTOM selected */}
        {datePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">From:</label>
              <Input 
                type="date" 
                value={customStartDate} 
                onChange={e => setCustomStartDate(e.target.value)}
                className="h-9 w-40 text-xs font-bold bg-white rounded-xl border-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">To:</label>
              <Input 
                type="date" 
                value={customEndDate} 
                onChange={e => setCustomEndDate(e.target.value)}
                className="h-9 w-40 text-xs font-bold bg-white rounded-xl border-slate-200"
              />
            </div>
          </div>
        )}

        {/* Selected Context Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <span>Range: <strong className="text-slate-900 font-bold">{format(dateRange.start, 'dd MMM yyyy')} — {format(dateRange.end, 'dd MMM yyyy')}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-500" />
            <span>Target context: <strong className="text-slate-900 font-bold">{selectedUserObj ? selectedUserObj.name : 'Entire Team'}</strong></span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Top High-Level Performance Metrics Cards */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calls Card */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Logged Calls</p>
              <h3 className="text-2xl font-black text-slate-900">{activityMetrics.calls}</h3>
              <p className="text-[10px] font-bold text-slate-500">{activityMetrics.callPlansCreated} Call Plans Prepared</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <PhoneCall className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Appointments Card */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Appointments / Meetings</p>
              <h3 className="text-2xl font-black text-slate-900">{activityMetrics.appointments}</h3>
              <p className="text-[10px] font-bold text-slate-500">Held or Scheduled</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Active Deals Count Card */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Opportunities</p>
              <h3 className="text-2xl font-black text-slate-900">{activeOpportunities.length}</h3>
              <p className="text-[10px] font-bold text-emerald-600 font-semibold">{formatEAV(totalActivePipelineValue)} Total EAV</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Target className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Key Wins Recorded */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">TWTW Wins Reported</p>
              <h3 className="text-2xl font-black text-slate-900">{aggregatedTwiwData.wins.length}</h3>
              <p className="text-[10px] font-bold text-slate-500">{aggregatedTwiwData.projectedWins.length} 30-Day Projected</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Trophy className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TWTW Four Quad Section (Wins, Risks, Projected, Major Updates) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Thursday TWTW Wins */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-600" /> TWTW Wins
              </span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-bold">{aggregatedTwiwData.wins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.wins.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400">
                No TWTW Wins recorded for this period.
              </div>
            ) : (
              aggregatedTwiwData.wins.map((w, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{w.customer}</span>
                    <span className="font-black text-xs text-emerald-600">{formatEAV(w.value)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Rep: {w.repName} {w.week ? `(${w.week})` : ''}</div>
                  {w.businessUnits && w.businessUnits.length > 0 && (
                    <div className="text-[9px] font-bold text-slate-500">BU: {w.businessUnits.join(', ')}</div>
                  )}
                  {w.updateText && <p className="text-xs text-slate-600 mt-1">{w.updateText}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Risks & Barriers */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-rose-50/50 border-b border-rose-100 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-rose-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Risks & Barriers
              </span>
              <Badge variant="secondary" className="bg-rose-100 text-rose-800 font-bold">{aggregatedTwiwData.risks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.risks.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400">
                No Churn Risks or Barriers flagged for this period.
              </div>
            ) : (
              aggregatedTwiwData.risks.map((r, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{r.account}</span>
                    <span className="font-black text-xs text-rose-600">{formatEAV(r.value)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Rep: {r.repName} {r.week ? `(${r.week})` : ''}</div>
                  {r.mitigation && <p className="text-xs text-slate-600 mt-1"><strong className="text-slate-700">Mitigation:</strong> {r.mitigation}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 30 Day Projected Wins */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-purple-50/50 border-b border-purple-100 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-purple-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-purple-600" /> 30 Day Projected Wins
              </span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 font-bold">{aggregatedTwiwData.projectedWins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.projectedWins.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400">
                No projected wins recorded for this period.
              </div>
            ) : (
              aggregatedTwiwData.projectedWins.map((p, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{p.account}</span>
                    <span className="font-black text-xs text-purple-600">{formatEAV(p.value)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Rep: {p.repName} {p.expectedDate ? `| Close: ${p.expectedDate}` : ''}</div>
                  {p.updateText && <p className="text-xs text-slate-600 mt-1">{p.updateText}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Major Pipeline & Customer Updates */}
        <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-blue-50/50 border-b border-blue-100 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" /> Major Pipeline & Customer Updates
              </span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-bold">{aggregatedTwiwData.majorUpdates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.majorUpdates.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-slate-400">
                No major updates recorded for this period.
              </div>
            ) : (
              aggregatedTwiwData.majorUpdates.map((m, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{m.customer}</span>
                    {m.value > 0 && <span className="font-black text-xs text-blue-600">{formatEAV(m.value)}</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Rep: {m.repName} {m.week ? `(${m.week})` : ''}</div>
                  {m.businessUnits && m.businessUnits.length > 0 && (
                    <div className="text-[9px] font-bold text-slate-500">BU: {m.businessUnits.join(', ')}</div>
                  )}
                  {m.updateText && <p className="text-xs text-slate-600 mt-1">{m.updateText}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* Strategic Focus For Next Week & Priorities */}
      {/* ------------------------------------------------------------- */}
      <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-indigo-50/50 border-b border-indigo-100 py-4">
          <CardTitle className="text-sm font-black uppercase tracking-wider text-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-indigo-600" /> Strategic Focus & Commitments
            </span>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 font-bold">{aggregatedTwiwData.priorities.length}</Badge>
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Priorities and focus commitments logged for upcoming execution
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-3">
          {aggregatedTwiwData.priorities.length === 0 ? (
            <div className="text-center py-8 text-xs font-bold text-slate-400">
              No priorities or commitments recorded for this period.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aggregatedTwiwData.priorities.map((pr, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{pr.text}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Salesperson: {pr.repName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* Active Opportunities Table */}
      {/* ------------------------------------------------------------- */}
      <Card className="border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/60 border-b border-slate-100 py-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" /> Active Opportunities Ledger
            </CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Live deals currently active in the sales pipeline
            </CardDescription>
          </div>
          <Badge className="bg-primary text-white font-black text-xs px-3 py-1">
            {activeOpportunities.length} Deals ({formatEAV(totalActivePipelineValue)})
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow className="uppercase text-[9px] font-black tracking-widest text-slate-500">
                <TableHead className="p-3">Opportunity / Account</TableHead>
                <TableHead className="p-3">Rep</TableHead>
                <TableHead className="p-3">Stage</TableHead>
                <TableHead className="p-3">EAV Value</TableHead>
                <TableHead className="p-3">Prob.</TableHead>
                <TableHead className="p-3">Expected Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 bg-white">
              {activeOpportunities.map((deal: any, idx: number) => (
                <TableRow key={deal.id || `deal-${idx}`}>
                  <TableCell className="p-3">
                    <p className="font-bold text-xs text-slate-900">{deal.pipeline || 'Unnamed Deal'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{deal.accountMasterCode ? `Master: ${deal.accountMasterCode}` : deal.businessUnit || 'General'}</p>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-bold text-slate-700">{deal.userName || normalizeBdmName(deal.userId, deal.userId)}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-200">
                      {deal.stage || 'Discovery'}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-black text-emerald-600">{formatEAV(deal.value || 0)}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-bold text-slate-600">{deal.probability ? `${deal.probability}%` : 'N/A'}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-bold text-slate-500">{deal.expectedDate || 'Unset'}</span>
                  </TableCell>
                </TableRow>
              ))}
              {activeOpportunities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    No active opportunities found for the selected team member & timeframe.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
