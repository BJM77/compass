"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from './kpi-card';
import { UserManagement } from './user-management';
import { TeamComparison } from './team-comparison';
import { GMReportGenerator } from './gm-report-generator';
import { VelocityPulse } from './velocity-pulse';
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
import { openSalesforceSearch, getCurrentWeek } from '@/lib/utils';
import { useCRMSummary } from '@/hooks/use-crm-summary';
import { CRMSummaryPanel } from './crm-summary-panel';

interface LeaderDashboardProps {
  onSimulate?: (userId: string) => void;
}

export function LeaderDashboard({ onSimulate }: LeaderDashboardProps) {
  const { profile } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const currentWeek = getCurrentWeek();
  
  const bdmStatsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'bdmStats');
  }, [db]);
  const { data: teamStats, isLoading: isStatsLoading } = useCollection(bdmStatsQuery);

  const crmSummary = useCRMSummary(profile?.uid ?? null, true);

  // BDMs log activity to weeklyProgress/{userId}_{week} via ActivityLogger
  const activityQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'weeklyProgress'), where('week', '==', currentWeek));
  }, [db, currentWeek]);
  const { data: teamActivity } = useCollection(activityQuery);

  const allDealsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek));
  }, [db, currentWeek]);
  const { data: allDeals } = useCollection(allDealsQuery);

  const aggregates = useMemo(() => {
    if (!teamStats) return { totalRevenue: 0, totalTarget: 0, risks: 0 };
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

    return {
      totalRevenue: filteredStats.reduce((sum, b) => sum + (Number(b.revenueYTD) || 0), 0),
      totalTarget: filteredStats.reduce((sum, b) => sum + (Number(b.target) || 0), 0),
      risks: riskDeals.length
    };
  }, [teamStats, allDeals]);

  const activityTotals = useMemo(() => {
    if (!teamActivity) return { apps: 0, calls: 0 };
    return teamActivity.reduce((acc, act) => ({
      // ActivityLogger writes flat fields: calls, apps, deals
      apps:  acc.apps  + (Number(act.apps)  || 0),
      calls: acc.calls + (Number(act.calls) || 0),
    }), { apps: 0, calls: 0 });
  }, [teamActivity]);

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
    <div className="container mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg rotate-3 shrink-0"><ShieldCheck className="w-5 h-5 text-white" /></div>
          <h1 className="text-xl md:text-4xl font-black font-headline text-primary tracking-tighter uppercase">Governance Command</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTeamSync} disabled={isSyncing} className="h-10 text-[10px] md:text-xs font-black"><Mail className="w-4 h-4 mr-2" /> TEAM NUDGE</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Territory Rev" 
          value={`$${(aggregates.totalRevenue / 1000000).toFixed(1)}M`} 
          subtitle={`Tgt: $${(aggregates.totalTarget / 1000000).toFixed(1)}M`} 
          icon={<TrendingUp className="w-4 h-4" />} 
        />
        <KPICard 
          title="Team Apps" 
          value={activityTotals.apps} 
          subtitle="Live for the week"
          icon={<Calendar className="w-4 h-4 text-blue-500" />} 
        />
        <KPICard 
          title="Team Calls" 
          value={activityTotals.calls} 
          subtitle="Live for the week"
          icon={<Phone className="w-4 h-4 text-green-500" />} 
        />
        <KPICard 
          title="Momentum Risks" 
          value={aggregates.risks} 
          status={aggregates.risks > 5 ? 'AT_RISK' : 'ON_TRACK'} 
          icon={<AlertTriangle className="w-4 h-4" />} 
        />
      </div>

      <Tabs defaultValue="dashboard" className="w-full space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-10 inline-flex overflow-x-auto scrollbar-hide max-w-full">
          <TabsTrigger value="dashboard" className="font-black uppercase text-[10px] tracking-widest"><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="comparison" className="font-black uppercase text-[10px] tracking-widest">Index</TabsTrigger>
          <TabsTrigger value="users" className="font-black uppercase text-[10px] tracking-widest"><Users className="w-3.5 h-3.5 mr-1.5" /> Users</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
           <VelocityPulse teamStats={teamStats || []} teamActivity={teamActivity || []} />
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

        <TabsContent value="comparison">
          <TeamComparison />
        </TabsContent>
        <TabsContent value="users"><UserManagement onSimulate={onSimulate} /></TabsContent>
      </Tabs>
    </div>
  );
}