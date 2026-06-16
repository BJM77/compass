"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KPICard } from './kpi-card';
import { UserManagement } from './user-management';
import { TerritoryPlaybook } from './territory-playbook';
import { PlanMetrics } from './plan-metrics';
import { OnboardingPlan } from './onboarding-plan';
import { GMReportGenerator } from './gm-report-generator';
import { AiReportGenerator } from './ai-report-generator';
import { AIDealWhisperer } from './ai-deal-whisperer';
import { SalesVelocityWidgets } from './sales-velocity-widgets';
import { HistoricalActivity } from './historical-activity';
import { 
  Users, TrendingUp, AlertTriangle, BarChart3, 
  ShieldCheck, Mail, Compass, FileText, Loader2, 
  DollarSign, Activity, Phone, Calendar, Target,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { computeMomentum } from '@/lib/momentum';
import { getCurrentWeek, getCurrentMonthWeeks, openSalesforceSearch } from '@/lib/utils';
import { useCRMSummary } from '@/hooks/use-crm-summary';
import { CRMSummaryPanel } from './crm-summary-panel';
import { usePipelineData } from '@/contexts/pipeline-context';

interface LeaderDashboardProps {
  onSimulate?: (userId: string) => void;
}

export function LeaderDashboard({ onSimulate }: LeaderDashboardProps) {
  const { profile } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [openModal, setOpenModal] = useState<'REV' | 'APPS' | 'CALLS' | null>(null);
  
  const [revSearch, setRevSearch] = useState('');
  const [revBdmFilter, setRevBdmFilter] = useState('ALL');
  const [revSort, setRevSort] = useState<'DESC' | 'ASC'>('DESC');
  
  const [activityBdmFilter, setActivityBdmFilter] = useState('ALL');
  const [activitySort, setActivitySort] = useState<'DESC' | 'ASC'>('DESC');

  const currentWeek = getCurrentWeek();
  
  const bdmStatsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'bdmStats');
  }, [db]);
  const { data: teamStats, isLoading: isStatsLoading } = useCollection(bdmStatsQuery);

  const crmSummary = useCRMSummary(profile?.uid ?? null, true);

  const { pipelineReviews: allDeals, weeklyProgresses: teamActivity } = usePipelineData();

  const currentMonthWeeks = useMemo(() => getCurrentMonthWeeks(), []);
  const mtdActivityQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'weeklyProgress'), where('week', 'in', currentMonthWeeks));
  }, [db, currentMonthWeeks]);
  const { data: teamMtdActivity } = useCollection(mtdActivityQuery);

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    allDeals?.forEach(d => { if (d.userName) m.set(d.userId, d.userName); });
    teamStats?.forEach(s => { if (s.name) m.set(s.id, s.name); });
    return m;
  }, [allDeals, teamStats]);

  const filteredRevRecords = useMemo(() => {
    let records = crmSummary.team.custRecords.filter(r => (Number(r.currentRevenue) || 0) > 0);
    if (revBdmFilter !== 'ALL') {
      records = records.filter(r => (userMap.get(r.userId) || r.userName || r.userId) === revBdmFilter);
    }
    if (revSearch.trim()) {
      const q = revSearch.toLowerCase();
      records = records.filter(r => 
        (r.pipeline || '').toLowerCase().includes(q) || 
        (r.accountName || '').toLowerCase().includes(q) ||
        (r.accountMasterCode || '').toLowerCase().includes(q) ||
        (userMap.get(r.userId) || r.userName || '').toLowerCase().includes(q)
      );
    }
    records.sort((a, b) => {
      const revA = Number(a.currentRevenue) || 0;
      const revB = Number(b.currentRevenue) || 0;
      return revSort === 'DESC' ? revB - revA : revA - revB;
    });
    return records;
  }, [crmSummary.team.custRecords, revSearch, revBdmFilter, revSort, userMap]);

  const revBdms = useMemo(() => {
    const s = new Set<string>();
    crmSummary.team.custRecords.forEach(r => {
      const name = userMap.get(r.userId) || r.userName || r.userId;
      if (name) s.add(name);
    });
    return Array.from(s).filter(Boolean).sort();
  }, [crmSummary.team.custRecords, userMap]);

  const filteredActivityRecords = useMemo(() => {
    let records = [...(teamActivity || [])];
    if (activityBdmFilter !== 'ALL') {
      records = records.filter(act => (userMap.get(act.userId) || act.userId) === activityBdmFilter);
    }
    records.sort((a, b) => {
      let valA = 0; let valB = 0;
      if (openModal === 'APPS') {
        valA = Number(a.apps || 0) + Number(a.crmApps || 0);
        valB = Number(b.apps || 0) + Number(b.crmApps || 0);
      } else {
        valA = Number(a.calls || 0) + Number(a.crmCalls || 0);
        valB = Number(b.calls || 0) + Number(b.crmCalls || 0);
      }
      return activitySort === 'DESC' ? valB - valA : valA - valB;
    });
    return records;
  }, [teamActivity, activityBdmFilter, userMap, openModal, activitySort]);

  const activityBdms = useMemo(() => {
    const s = new Set<string>();
    (teamActivity || []).forEach(act => s.add(userMap.get(act.userId) || act.userId));
    return Array.from(s).filter(Boolean).sort();
  }, [teamActivity, userMap]);

  const aggregates = useMemo(() => {
    if (!teamStats) return { totalRevenue: 0, totalTarget: 0, risks: 0, pipelineAmount: 0, pipelineCount: 0 };
    const filteredStats = teamStats.filter(s => s.role === 'BDM' || s.role === 'ACCOUNT_MANAGER');
    
    const riskDeals = allDeals?.filter(d => {
      const m = computeMomentum({
        daysInStage: d.daysInStage || 0,
        rolloverCount: d.rolloverCount || 0,
        barrierText: d.barriers || '',
        lastBarrierText: d.lastBarrierText || ''
      });
      return m.score === 'DEAD' || m.score === 'STALLING';
    }) || [];

    const opportunityDeals = allDeals?.filter(d => !d.isBareAccount) || [];
    const totalPipelineAmount = opportunityDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    return {
      totalRevenue: crmSummary.team.custYTDRevenueThisFY || 0,
      totalTarget: filteredStats.reduce((sum, b) => sum + (Number(b.target) || 0), 0),
      risks: riskDeals.length,
      pipelineAmount: totalPipelineAmount,
      pipelineCount: opportunityDeals.length
    };
  }, [teamStats, allDeals, crmSummary.team.custYTDRevenueThisFY]);

  const activityTotals = useMemo(() => {
    const live = { apps: 0, calls: 0, crmApps: 0, crmCalls: 0 };
    if (teamActivity) {
      teamActivity.forEach(act => {
        live.apps += Number(act.apps) || 0;
        live.calls += Number(act.calls) || 0;
        live.crmApps += Number(act.crmApps) || 0;
        live.crmCalls += Number(act.crmCalls) || 0;
      });
    }

    const mtd = { apps: 0, calls: 0, crmApps: 0, crmCalls: 0 };
    if (teamMtdActivity) {
      teamMtdActivity.forEach(act => {
        mtd.apps += Number(act.apps) || 0;
        mtd.calls += Number(act.calls) || 0;
        mtd.crmApps += Number(act.crmApps) || 0;
        mtd.crmCalls += Number(act.crmCalls) || 0;
      });
    }

    return { live, mtd };
  }, [teamActivity, teamMtdActivity]);

  const handleTeamSync = async () => {
    if (!db) return;
    setIsSyncing(true);
    try {
      await setDoc(doc(db, 'systemAnnouncements', 'current'), {
        message: "Strategic Nudge: Review all Top 8 commitments for Friday review.",
        active: true,
        updatedAt: serverTimestamp(),
        type: 'STRATEGIC_NUDGE'
      });
      toast({ title: "Team Sync Initialised" });
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isStatsLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Compass className="animate-spin" /></div>;

  return (
    <div className="w-full p-4 md:p-8 space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg rotate-3 shrink-0"><ShieldCheck className="w-5 h-5 text-white" /></div>
          <h1 className="text-xl md:text-4xl font-black font-headline text-primary tracking-tighter uppercase">Governance Command</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTeamSync} disabled={isSyncing} className="h-10 text-[10px] md:text-xs font-black"><Mail className="w-4 h-4 mr-2" /> TEAM NUDGE</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Territory Rev" 
          value={`$${(aggregates.totalRevenue / 1000000).toFixed(1)}M`} 
          subtitle={`Tgt: $${(aggregates.totalTarget / 1000000).toFixed(1)}M`} 
          icon={<TrendingUp className="w-4 h-4" />} 
          onClick={() => setOpenModal('REV')}
        />
        <KPICard 
          title="Team Apps" 
          value={activityTotals.live.crmApps} 
          subtitle={
            <div className="flex flex-col gap-0.5 mt-1">
              <span>Manual (Live): {activityTotals.live.apps}</span>
              <span className="opacity-75">MTD CRM: {activityTotals.mtd.crmApps} | Manual: {activityTotals.mtd.apps}</span>
            </div>
          }
          icon={<Calendar className="w-4 h-4 text-blue-500" />} 
          onClick={() => setOpenModal('APPS')}
        />
        <KPICard 
          title="Team Calls" 
          value={activityTotals.live.crmCalls} 
          subtitle={
            <div className="flex flex-col gap-0.5 mt-1">
              <span>Manual (Live): {activityTotals.live.calls}</span>
              <span className="opacity-75">MTD CRM: {activityTotals.mtd.crmCalls} | Manual: {activityTotals.mtd.calls}</span>
            </div>
          }
          icon={<Phone className="w-4 h-4 text-green-500" />} 
          onClick={() => setOpenModal('CALLS')}
        />
        <KPICard 
          title="Opportunity Pipeline" 
          value={`$${(aggregates.pipelineAmount || 0).toLocaleString()}`} 
          subtitle={`Total Opportunities: ${aggregates.pipelineCount || 0}`}
          icon={<Target className="w-4 h-4 text-purple-500" />} 
        />
      </div>

      <div className="w-full flex justify-center py-4">
        <img 
          src="/network-map.png" 
          alt="Team Global Express Parcel Network Western Australia" 
          className="w-[60%] rounded-xl shadow-lg border"
        />
      </div>

      <Tabs defaultValue="dashboard" className="w-full space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-10 flex overflow-x-auto scrollbar-hide max-w-full">
          <TabsTrigger value="dashboard" className="font-black uppercase text-[10px] tracking-widest"><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="activity-metrics" className="font-black uppercase text-[10px] tracking-widest"><Activity className="w-3.5 h-3.5 mr-1.5" /> Plan Metrics</TabsTrigger>
          <TabsTrigger value="group-90" className="font-black uppercase text-[10px] tracking-widest">Group 90</TabsTrigger>
          <TabsTrigger value="bdm-north" className="font-black uppercase text-[10px] tracking-widest">BDM North</TabsTrigger>
          <TabsTrigger value="bdm-south" className="font-black uppercase text-[10px] tracking-widest">BDM South</TabsTrigger>
          <TabsTrigger value="am-90" className="font-black uppercase text-[10px] tracking-widest">AM 90</TabsTrigger>
          <TabsTrigger value="playbooks" className="font-black uppercase text-[10px] tracking-widest">Playbooks</TabsTrigger>
          <TabsTrigger value="ai-report" className="font-black uppercase text-[10px] tracking-widest bg-accent/10 text-accent">AI Report</TabsTrigger>
          <TabsTrigger value="users" className="font-black uppercase text-[10px] tracking-widest"><Users className="w-3.5 h-3.5 mr-1.5" /> Users</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
           <SalesVelocityWidgets teamStats={teamStats || []} allDeals={allDeals || []} totalRevenue={aggregates.totalRevenue} />
           <AIDealWhisperer deals={allDeals || []} />
           <HistoricalActivity />
           <CRMSummaryPanel summary={crmSummary} showAllUsers={true} currentWeek={currentWeek} />
           <Card className="border-none shadow-2xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white pb-6">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                  <Target className="w-5 h-5 text-accent" />
                  Master Strategy Ledger
                </CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Team "Top 8" selection for Week {currentWeek.split('-')[1]}</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                   <table className="w-full text-sm">
                      <thead className="bg-slate-50 uppercase text-[9px] font-black tracking-widest border-b">
                         <tr>
                            <th className="px-6 py-3 text-left">BDM Identity</th>
                            <th className="px-4 py-3 text-left">Opportunity / Account</th>
                            <th className="px-4 py-3 text-left">Momentum</th>
                            <th className="px-4 py-3 text-right">Value (M)</th>
                            <th className="px-4 py-3 text-left">Current Stage</th>
                            <th className="px-4 py-3 text-left">Commitment / Next Action</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y">
                         {allDeals?.filter(d => d.isReviewSelected).map((deal, i) => {
                            const m = computeMomentum({
                               daysInStage: deal.daysInStage || 14,
                               rolloverCount: deal.rolloverCount || 0,
                               barrierText: deal.barriers || '',
                               lastBarrierText: deal.lastBarrierText || ''
                            });
                            return (
                               <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-6 py-4 font-black uppercase text-[10px] text-primary whitespace-nowrap">
                                     {deal.userName || 'Unknown'}
                                  </td>
                                  <td className="px-4 py-4">
                                     <button 
                                       onClick={() => openSalesforceSearch(deal.pipeline, deal.salesforceId)}
                                       className="flex items-center gap-2 hover:text-accent transition-colors group/link text-left"
                                     >
                                       <span className="text-xs font-bold text-slate-800 uppercase leading-tight truncate max-w-[200px]">{deal.pipeline}</span>
                                       <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                                     </button>
                                  </td>
                                  <td className="px-4 py-4">
                                     <Badge variant="outline" className={`text-[8px] font-black uppercase ${m.color} ${m.bg}`}>{m.score}</Badge>
                                  </td>
                                  <td className="px-4 py-4 text-right font-black">${(Number(deal.value || 0) / 1000000).toFixed(2)}M</td>
                                  <td className="px-4 py-4 text-xs font-bold text-muted-foreground">{deal.stage}</td>
                                  <td className="px-4 py-4 text-[10px] font-medium text-slate-600 italic">"{deal.actionsForBen || 'TBC'}"</td>
                               </tr>
                            );
                         })}
                         {(!allDeals || allDeals.filter(d => d.isReviewSelected).length === 0) && (
                            <tr>
                               <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground uppercase font-black text-xs tracking-widest">
                                  No team priorities selected for review.
                                  <p className="text-[10px] font-bold mt-1 text-slate-400">Instruct BDMs to select their "Top 8" from their Strategy Ledger.</p>
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="activity-metrics">
          <PlanMetrics />
        </TabsContent>
        <TabsContent value="group-90">
          <OnboardingPlan userId={profile?.uid || 'LEADER'} userName={profile?.name || 'Leader'} planType="GROUP_90" />
        </TabsContent>
        <TabsContent value="bdm-north">
          <OnboardingPlan userId={profile?.uid || 'LEADER'} userName={profile?.name || 'Leader'} planType="BDM_NORTH_90" />
        </TabsContent>
        <TabsContent value="bdm-south">
          <OnboardingPlan userId={profile?.uid || 'LEADER'} userName={profile?.name || 'Leader'} planType="BDM_SOUTH_90" />
        </TabsContent>
        <TabsContent value="am-90">
          <OnboardingPlan userId={profile?.uid || 'LEADER'} userName={profile?.name || 'Leader'} planType="AM_90" />
        </TabsContent>
        <TabsContent value="playbooks">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TerritoryPlaybook territory="METRO_NORTH" zones={['Osborne Park', 'Malaga', 'Wangara', 'Gnangara', 'Neerabup', 'Bayswater']} />
            <TerritoryPlaybook territory="METRO_SOUTH" zones={['Kewdale', 'Welshpool', 'Forrestfield', 'Canning Vale', 'Maddington', 'Bibra Lake']} />
          </div>
        </TabsContent>
        <TabsContent value="ai-report">
          <AiReportGenerator />
        </TabsContent>
        <TabsContent value="users"><UserManagement onSimulate={onSimulate} /></TabsContent>
      </Tabs>

      <Dialog open={openModal === 'REV'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b">
            <DialogTitle>Territory Revenue Breakdown</DialogTitle>
            <DialogDescription>All active customer accounts across the territory.</DialogDescription>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <input 
                type="text" 
                placeholder="Search accounts..." 
                value={revSearch}
                onChange={e => setRevSearch(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[250px]"
              />
              <select 
                value={revBdmFilter} 
                onChange={e => setRevBdmFilter(e.target.value)}
                className="flex h-9 w-full sm:w-[180px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All BDMs / AMs</option>
                {revBdms.map(bdm => <option key={bdm} value={bdm}>{bdm}</option>)}
              </select>
              <select 
                value={revSort} 
                onChange={e => setRevSort(e.target.value as 'DESC' | 'ASC')}
                className="flex h-9 w-full sm:w-[180px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="DESC">Highest Revenue</option>
                <option value="ASC">Lowest Revenue</option>
              </select>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b">
                  <TableRow>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] px-6">BDM / AM</TableHead>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] px-6">Account Name</TableHead>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] px-6">Code</TableHead>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] text-right px-6">YTD Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRevRecords.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs text-primary px-6">{userMap.get(r.userId) || r.userName || r.userId}</TableCell>
                      <TableCell className="font-bold text-sm px-6">{r.pipeline || r.accountName || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-500 px-6">{r.accountMasterCode || '—'}</TableCell>
                      <TableCell className="text-right font-black px-6">${(Number(r.currentRevenue) || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {filteredRevRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 font-bold text-slate-400">No matching records found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === 'APPS' || openModal === 'CALLS'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 shrink-0 border-b">
            <DialogTitle>{openModal === 'APPS' ? 'Team Apps Breakdown' : 'Team Calls Breakdown'}</DialogTitle>
            <DialogDescription>Activity breakdown by team member for the latest uploaded week.</DialogDescription>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <select 
                value={activityBdmFilter} 
                onChange={e => setActivityBdmFilter(e.target.value)}
                className="flex h-9 w-full sm:w-[180px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All Team Members</option>
                {activityBdms.map(bdm => <option key={bdm} value={bdm}>{bdm}</option>)}
              </select>
              <select 
                value={activitySort} 
                onChange={e => setActivitySort(e.target.value as 'DESC' | 'ASC')}
                className="flex h-9 w-full sm:w-[180px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="DESC">Highest Activity</option>
                <option value="ASC">Lowest Activity</option>
              </select>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b">
                  <TableRow>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] px-6">Team Member</TableHead>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] text-right px-6">CRM (Live)</TableHead>
                    <TableHead className="font-black text-slate-500 uppercase tracking-widest text-[10px] text-right px-6">Manual (Live)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivityRecords.map((act, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-bold text-sm text-primary px-6">{userMap.get(act.userId) || act.userId}</TableCell>
                      <TableCell className="text-right font-black text-blue-600 px-6">{openModal === 'APPS' ? (act.crmApps || 0) : (act.crmCalls || 0)}</TableCell>
                      <TableCell className="text-right font-black text-slate-700 px-6">{openModal === 'APPS' ? (act.apps || 0) : (act.calls || 0)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredActivityRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 font-bold text-slate-400">No matching activity data found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}