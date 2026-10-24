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
  Trophy, AlertTriangle, Rocket, DollarSign, Filter,
  Building, Search, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO, isWithinInterval, subDays } from 'date-fns';
import { formatEAV, getCurrentWeek, normalizeBdmName, isUserSubmissionMatch, getWeekForDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DatePreset = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
type SortField = 'pipeline' | 'userName' | 'stage' | 'value' | 'probability' | 'expectedDate';
type SortOrder = 'asc' | 'desc';

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

  // Ledger Search, Filter & Sort State
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStageFilter, setLedgerStageFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Load team users for drop-down (STRICTLY BDM & ACCOUNT_MANAGER only)
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: rawUsers } = useCollection(usersQuery);

  const teamUsers = useMemo(() => {
    if (!rawUsers) return [];
    return rawUsers
      .filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

  // Generate list of financial week keys falling in dateRange
  const validWeeksInRange = useMemo(() => {
    const weeks = new Set<string>();
    const curr = new Date(dateRange.start);
    while (curr <= dateRange.end) {
      weeks.add(getWeekForDate(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return weeks;
  }, [dateRange]);

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

  // Helper for TWIW submission date matching
  const isSubInRange = (sub: any) => {
    if (sub.createdAt) {
      return isDateInRange(sub.createdAt);
    }
    if (sub.updatedAt) {
      return isDateInRange(sub.updatedAt);
    }
    if (sub.week) {
      return validWeeksInRange.has(sub.week);
    }
    return false;
  };

  // -------------------------------------------------------------
  // 4. Filter & Aggregate TWTW Data (Wins, Risks, Updates)
  // -------------------------------------------------------------
  const aggregatedTwiwData = useMemo(() => {
    if (!allTwiwSubmissions) return { wins: [], risks: [], majorUpdates: [], projectedWins: [], totalCalls: 0, totalApps: 0 };

    let filtered = allTwiwSubmissions.filter(sub => {
      // User filter check
      if (selectedUserId !== 'ALL') {
        if (!isUserSubmissionMatch({ id: selectedUserId, name: selectedUserObj?.name }, sub)) return false;
      }
      // Strict Date Range check
      return isSubInRange(sub);
    });

    const wins: any[] = [];
    const risks: any[] = [];
    const majorUpdates: any[] = [];
    const projectedWins: any[] = [];
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

      if (sub.kpiReview) {
        totalCalls += Number(sub.kpiReview.callsActual) || 0;
        totalApps += Number(sub.kpiReview.appointmentsActual) || 0;
      }
    });

    return { wins, risks, majorUpdates, projectedWins, totalCalls, totalApps };
  }, [allTwiwSubmissions, selectedUserId, selectedUserObj, dateRange, validWeeksInRange]);

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

    // Filter call plans & weekly progress by date range
    const inRangePlans = filteredPlans.filter(cp => isDateInRange(cp.createdAt || cp.updatedAt));
    const totalCallsFromPlans = inRangePlans.length;

    let progressCalls = 0;
    let progressApps = 0;
    filteredProgress.forEach(wp => {
      if (wp.week && validWeeksInRange.has(wp.week)) {
        progressCalls += Number(wp.calls || wp.crmCalls || 0);
        progressApps += Number(wp.appointments || wp.crmApps || wp.meetingsHeld || 0);
      }
    });

    const callsCount = Math.max(aggregatedTwiwData.totalCalls, totalCallsFromPlans, progressCalls);
    const appsCount = Math.max(aggregatedTwiwData.totalApps, progressApps);

    return {
      calls: callsCount,
      appointments: appsCount,
      callPlansCreated: totalCallsFromPlans,
    };
  }, [allCallPlans, allWeeklyProgress, selectedUserId, dateRange, validWeeksInRange, aggregatedTwiwData]);

  // -------------------------------------------------------------
  // 6. Aggregate Active Opportunities & Sorting/Filtering
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

  // Stage options derived dynamically from live active opportunities
  const availableStages = useMemo(() => {
    const stages = new Set<string>();
    activeOpportunities.forEach(d => {
      if (d.stage) stages.add(d.stage);
    });
    return Array.from(stages).sort();
  }, [activeOpportunities]);

  // Process Search, Filter & Sort on Opportunities
  const processedOpportunities = useMemo(() => {
    let result = [...activeOpportunities];

    // Search filter
    if (ledgerSearch.trim()) {
      const query = ledgerSearch.toLowerCase().trim();
      result = result.filter(d => 
        (d.pipeline || '').toLowerCase().includes(query) ||
        (d.userName || '').toLowerCase().includes(query) ||
        (d.accountMasterCode || '').toLowerCase().includes(query) ||
        (d.businessUnit || '').toLowerCase().includes(query)
      );
    }

    // Stage filter
    if (ledgerStageFilter !== 'ALL') {
      result = result.filter(d => d.stage === ledgerStageFilter);
    }

    // Sorting logic
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'value' || sortField === 'probability') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [activeOpportunities, ledgerSearch, ledgerStageFilter, sortField, sortOrder]);

  const totalActivePipelineValue = useMemo(() => {
    return processedOpportunities.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [processedOpportunities]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'value' || field === 'probability' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* ------------------------------------------------------------- */}
      {/* Header & Controls Section */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 border border-accent/15 rounded-2xl text-accent">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-foreground tracking-tight">BD/AM Review</h1>
                <p className="text-xs font-semibold text-muted-foreground">
                  Comprehensive performance summary & strategic operational breakdown for reps and teams.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Team Member Filter (BDMs & AMs only) */}
            <div className="w-full sm:w-64">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1 block">Account Manager / BDM</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-10 bg-secondary/60 border-border rounded-xl font-bold text-foreground/85 text-xs">
                  <SelectValue placeholder="Select Team Member" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="font-bold text-xs">All BDMs & AMs</SelectItem>
                  {teamUsers.map(u => (
                    <SelectItem key={u.id} value={u.id} className="font-bold text-xs">
                      {normalizeBdmName(u.name, u.id)} ({u.role === 'ACCOUNT_MANAGER' ? 'AM' : 'BDM'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Preset Selector */}
            <div className="w-full sm:w-48">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1 block">Time Period</label>
              <Select value={datePreset} onValueChange={(val: DatePreset) => setDatePreset(val)}>
                <SelectTrigger className="h-10 bg-secondary/60 border-border rounded-xl font-bold text-foreground/85 text-xs">
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
          <div className="flex flex-wrap items-center gap-4 p-4 bg-secondary/60 border border-border/60 rounded-2xl animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground/75">From:</label>
              <Input 
                type="date" 
                value={customStartDate} 
                onChange={e => setCustomStartDate(e.target.value)}
                className="h-9 w-40 text-xs font-bold bg-card rounded-xl border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-foreground/75">To:</label>
              <Input 
                type="date" 
                value={customEndDate} 
                onChange={e => setCustomEndDate(e.target.value)}
                className="h-9 w-40 text-xs font-bold bg-card rounded-xl border-border"
              />
            </div>
          </div>
        )}

        {/* Selected Context Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/60 text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <span>Range: <strong className="text-foreground font-bold">{format(dateRange.start, 'dd MMM yyyy')} — {format(dateRange.end, 'dd MMM yyyy')}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-success" />
            <span>Target context: <strong className="text-foreground font-bold">{selectedUserObj ? selectedUserObj.name : 'All BDMs & AMs'}</strong></span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Top High-Level Performance Metrics Cards */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Calls Card */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Logged Calls</p>
              <h3 className="text-2xl font-black text-foreground">{activityMetrics.calls}</h3>
              <p className="text-[10px] font-bold text-muted-foreground">{activityMetrics.callPlansCreated} Call Plans Prepared</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-info-soft border border-info/15 flex items-center justify-center text-info">
              <PhoneCall className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Appointments Card */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Appointments / Meetings</p>
              <h3 className="text-2xl font-black text-foreground">{activityMetrics.appointments}</h3>
              <p className="text-[10px] font-bold text-muted-foreground">Held or Scheduled</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-chart-5/10 border border-chart-5/15 flex items-center justify-center text-chart-5">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Active Deals Count Card */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Active Opportunities</p>
              <h3 className="text-2xl font-black text-foreground">{processedOpportunities.length}</h3>
              <p className="text-[10px] font-bold text-success font-semibold">{formatEAV(totalActivePipelineValue)} Total EAV</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-success-soft border border-success/15 flex items-center justify-center text-success">
              <Target className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Key Wins Recorded */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">TWTW Wins Reported</p>
              <h3 className="text-2xl font-black text-foreground">{aggregatedTwiwData.wins.length}</h3>
              <p className="text-[10px] font-bold text-muted-foreground">{aggregatedTwiwData.projectedWins.length} 30-Day Projected</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-warning-soft border border-warning/15 flex items-center justify-center text-warning-ink">
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
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-success-soft/50 border-b border-success/15 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-success-ink flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-success" /> TWTW Wins
              </span>
              <Badge variant="secondary" className="bg-success-soft text-success-ink font-bold">{aggregatedTwiwData.wins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.wins.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-muted-foreground">
                No TWTW Wins recorded for this period.
              </div>
            ) : (
              aggregatedTwiwData.wins.map((w, idx) => (
                <div key={idx} className="p-3 bg-secondary/60 border border-border/60 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{w.customer}</span>
                    <span className="font-black text-xs text-success">{formatEAV(w.value)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold">Rep: {w.repName} {w.week ? `(${w.week})` : ''}</div>
                  {w.businessUnits && w.businessUnits.length > 0 && (
                    <div className="text-[9px] font-bold text-muted-foreground">BU: {w.businessUnits.join(', ')}</div>
                  )}
                  {w.updateText && <p className="text-xs text-foreground/75 mt-1">{w.updateText}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Risks & Barriers */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-danger-soft/50 border-b border-destructive/15 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-destructive flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Risks & Barriers
              </span>
              <Badge variant="secondary" className="bg-danger-soft text-destructive font-bold">{aggregatedTwiwData.risks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.risks.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-muted-foreground">
                No Churn Risks or Barriers flagged for this period.
              </div>
            ) : (
              aggregatedTwiwData.risks.map((r, idx) => (
                <div key={idx} className="p-3 bg-secondary/60 border border-border/60 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{r.account}</span>
                    <span className="font-black text-xs text-destructive">{formatEAV(r.value)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold">Rep: {r.repName} {r.week ? `(${r.week})` : ''}</div>
                  {r.mitigation && <p className="text-xs text-foreground/75 mt-1"><strong className="text-foreground/85">Mitigation:</strong> {r.mitigation}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 30 Day Projected Wins */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-chart-5/5 border-b border-chart-5/15 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-chart-5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-chart-5" /> 30 Day Projected Wins
              </span>
              <Badge variant="secondary" className="bg-chart-5/15 text-chart-5 font-bold">{aggregatedTwiwData.projectedWins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.projectedWins.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-muted-foreground">
                No projected wins recorded for this period.
              </div>
            ) : (
              aggregatedTwiwData.projectedWins.map((p, idx) => (
                <div key={idx} className="p-3 bg-secondary/60 border border-border/60 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{p.account}</span>
                    <span className="font-black text-xs text-chart-5">{formatEAV(p.value)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold">Rep: {p.repName} {p.expectedDate ? `| Close: ${p.expectedDate}` : ''}</div>
                  {p.updateText && <p className="text-xs text-foreground/75 mt-1">{p.updateText}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Major Pipeline & Customer Updates */}
        <Card className="border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-info-soft/50 border-b border-info/15 py-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-info flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building className="w-4 h-4 text-info" /> Major Pipeline & Customer Updates
              </span>
              <Badge variant="secondary" className="bg-info-soft text-info font-bold">{aggregatedTwiwData.majorUpdates.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
            {aggregatedTwiwData.majorUpdates.length === 0 ? (
              <div className="text-center py-10 text-xs font-bold text-muted-foreground">
                No major updates recorded for this period.
              </div>
            ) : (
              aggregatedTwiwData.majorUpdates.map((m, idx) => (
                <div key={idx} className="p-3 bg-secondary/60 border border-border/60 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">{m.customer}</span>
                    {m.value > 0 && <span className="font-black text-xs text-info">{formatEAV(m.value)}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-bold">Rep: {m.repName} {m.week ? `(${m.week})` : ''}</div>
                  {m.businessUnits && m.businessUnits.length > 0 && (
                    <div className="text-[9px] font-bold text-muted-foreground">BU: {m.businessUnits.join(', ')}</div>
                  )}
                  {m.updateText && <p className="text-xs text-foreground/75 mt-1">{m.updateText}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* Active Opportunities Table with Search, Filter & Column Sorting */}
      {/* ------------------------------------------------------------- */}
      <Card className="border-border/80 shadow-sm rounded-3xl bg-card overflow-hidden">
        <CardHeader className="bg-secondary/35 border-b border-border/60 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Active Opportunities Ledger
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Live deals currently active in the sales pipeline
              </CardDescription>
            </div>
            <Badge className="bg-primary text-primary-foreground font-black text-xs px-3 py-1 self-start sm:self-auto">
              {processedOpportunities.length} Deals ({formatEAV(totalActivePipelineValue)})
            </Badge>
          </div>

          {/* Search Bar & Stage Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                placeholder="Search account, rep, BU..."
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                className="pl-9 h-9 text-xs font-semibold bg-card border-border rounded-xl"
              />
            </div>

            {/* Stage Dropdown Filter */}
            <div className="w-full sm:w-56">
              <Select value={ledgerStageFilter} onValueChange={setLedgerStageFilter}>
                <SelectTrigger className="h-9 bg-card border-border rounded-xl text-xs font-semibold text-foreground/85">
                  <SelectValue placeholder="Filter by Stage" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="text-xs font-semibold">All Pipeline Stages</SelectItem>
                  {availableStages.map(stg => (
                    <SelectItem key={stg} value={stg} className="text-xs font-semibold">{stg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/60 border-b border-border">
              <TableRow className="uppercase text-[9px] font-black tracking-widest text-muted-foreground select-none">
                <TableHead className="p-3 cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSortToggle('pipeline')}>
                  <div className="flex items-center gap-1.5">
                    <span>Opportunity / Account</span>
                    {sortField === 'pipeline' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </TableHead>
                <TableHead className="p-3 cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSortToggle('userName')}>
                  <div className="flex items-center gap-1.5">
                    <span>Rep</span>
                    {sortField === 'userName' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </TableHead>
                <TableHead className="p-3 cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSortToggle('stage')}>
                  <div className="flex items-center gap-1.5">
                    <span>Stage</span>
                    {sortField === 'stage' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </TableHead>
                <TableHead className="p-3 cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSortToggle('value')}>
                  <div className="flex items-center gap-1.5">
                    <span>EAV Value</span>
                    {sortField === 'value' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </TableHead>
                <TableHead className="p-3 cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSortToggle('probability')}>
                  <div className="flex items-center gap-1.5">
                    <span>Prob.</span>
                    {sortField === 'probability' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </TableHead>
                <TableHead className="p-3 cursor-pointer hover:bg-secondary transition-colors" onClick={() => handleSortToggle('expectedDate')}>
                  <div className="flex items-center gap-1.5">
                    <span>Expected Close</span>
                    {sortField === 'expectedDate' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/70" />}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60 bg-card">
              {processedOpportunities.map((deal: any, idx: number) => (
                <TableRow key={deal.id || `deal-${idx}`}>
                  <TableCell className="p-3">
                    <p className="font-bold text-xs text-foreground">{deal.pipeline || 'Unnamed Deal'}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{deal.accountMasterCode ? `Master: ${deal.accountMasterCode}` : deal.businessUnit || 'General'}</p>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-bold text-foreground/85">{deal.userName || normalizeBdmName(deal.userId, deal.userId)}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <Badge variant="outline" className="text-[10px] font-bold bg-secondary/60 border-border">
                      {deal.stage || 'Discovery'}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-black text-success">{formatEAV(deal.value || 0)}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-bold text-foreground/75">{deal.probability ? `${deal.probability}%` : 'N/A'}</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="text-xs font-bold text-muted-foreground">{deal.expectedDate || 'Unset'}</span>
                  </TableCell>
                </TableRow>
              ))}
              {processedOpportunities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs font-bold uppercase tracking-widest">
                    No active opportunities match the selected criteria.
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
