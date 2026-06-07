"use client";

import { useState, useMemo } from 'react';
import { useAuth, UserProfile } from '@/contexts/auth-context';
import { KPICard } from './kpi-card';
import { TerritoryPlaybook } from './territory-playbook';
import { OnboardingPlan } from './onboarding-plan';
import { ActivityLogger } from './activity-logger';
import { WeeklyGoals } from './weekly-goals';
import { SmartGoalsView } from './smart-goals-view';
import { PipelineReviewTable } from './pipeline-review-table';
import { CallPlanning } from './call-planning';
import { BehaviorAlerts } from './behavior-alerts';
import { BDMWeeklySubmission } from './bdm-weekly-submission';
import { VoiceActionLogger } from './voice-action-logger';
import { HistoricalActivity } from './historical-activity';
import { AIDealWhisperer } from './ai-deal-whisperer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileDown, DollarSign, Zap, PhoneCall, Gauge, 
  ShieldCheck, Compass, ListChecks, ExternalLink, 
  Loader2, Target, ArrowRight, Sparkles, TrendingUp, 
  CalendarClock, Activity, Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { jsPDF } from "jspdf";
import { computeMomentum } from '@/lib/momentum';
import { getCurrentWeek, formatEAV } from '@/lib/utils';
import { useCRMSummary } from '@/hooks/use-crm-summary';
import { CRMSummaryPanel } from './crm-summary-panel';
import { usePipelineData } from '@/contexts/pipeline-context';

interface BDMDashboardProps {
  simulatedUser?: {
    uid: string;
    profile: UserProfile;
  };
}

export function BDMDashboard({ simulatedUser }: BDMDashboardProps) {
  const { profile: authProfile, user: authUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const currentWeek = getCurrentWeek();

  const userId = simulatedUser?.uid || authUser?.uid || null;
  const profile = simulatedUser?.profile || authProfile;
  const isAM = profile?.role === 'ACCOUNT_MANAGER';

  const statsDocRef = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return doc(db, 'bdmStats', userId);
  }, [db, userId]);
  const { data: stats, isLoading: isStatsLoading } = useDoc(statsDocRef);

  const { pipelineReviews: allDeals } = usePipelineData();

  const pipelineTotal = useMemo(() => {
    if (!allDeals) return 0;
    return allDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }, [allDeals]);

  const momentumCounts = useMemo(() => {
    if (!allDeals) return { HOT: 0, MOVING: 0, STALLING: 0, DEAD: 0 };
    const counts = { HOT: 0, MOVING: 0, STALLING: 0, DEAD: 0 };
    allDeals.forEach(d => {
      const m = computeMomentum({
        daysInStage: d.daysInStage || 0,
        rolloverCount: d.rolloverCount || 0,
        barrierText: d.barriers || '',
        lastBarrierText: d.lastBarrierText || ''
      });
      counts[m.score]++;
    });
    return counts;
  }, [allDeals]);

  const weightedForecast = useMemo(() => {
    const stageWeights: Record<string, number> = {
      'Discovery': 0.1,
      'Proposal': 0.3,
      'Negotiation': 0.6,
      'Verbal': 0.85,
      'Portfolio': 0.5,
    };
    return allDeals?.reduce((sum, deal) => {
      const weight = (deal.stage ? stageWeights[deal.stage] : undefined) ?? 0.2;
      return sum + ((Number(deal.value) || 0) * weight);
    }, 0) ?? 0;
  }, [allDeals]);

  const crmSummary = useCRMSummary(userId, false);

  const handleExportPdf = () => {
    if (!profile) return;
    setIsExporting(true);
    try {
      const pdfDoc = new jsPDF();

      // --- Header ---
      pdfDoc.setFontSize(20);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("WEEKLY PERFORMANCE PACK", 20, 20);
      pdfDoc.setFontSize(10);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text(`${profile.name}  |  ${profile.territory?.replace(/_/g, ' ')}  |  Week ${currentWeek.split('-')[1]}`, 20, 28);
      pdfDoc.setDrawColor(30, 58, 138);
      pdfDoc.setLineWidth(0.5);
      pdfDoc.line(20, 32, 190, 32);

      // --- KPIs ---
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(9);
      pdfDoc.text("KEY PERFORMANCE INDICATORS", 20, 40);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text(`Revenue YTD:`, 20, 48); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text(`${formatEAV(crmSummary.myStats?.custYTDRevenueThisFY || 0)}`, 60, 48);
      pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(`Target:`, 100, 48); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text(`${formatEAV(stats?.target || 0)}`, 120, 48);
      pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(`Weighted Forecast:`, 20, 55); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text(`${formatEAV(weightedForecast)}`, 70, 55);
      pdfDoc.setFont("helvetica", "normal"); pdfDoc.text(`Pipeline Total:`, 100, 55); pdfDoc.setFont("helvetica", "bold"); pdfDoc.text(`${formatEAV(pipelineTotal)}`, 140, 55);

      // --- Momentum ---
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("MOMENTUM BREAKDOWN", 20, 65);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text(`HOT: ${momentumCounts.HOT}   MOVING: ${momentumCounts.MOVING}   STALLING: ${momentumCounts.STALLING}   DEAD: ${momentumCounts.DEAD}`, 20, 72);
      pdfDoc.line(20, 76, 190, 76);

      // --- Pipeline Table ---
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("PIPELINE LEDGER", 20, 83);

      let y = 91;
      pdfDoc.setFontSize(8);
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.text("ACCOUNT / OPPORTUNITY", 20, y);
      pdfDoc.text("VALUE", 115, y);
      pdfDoc.text("STAGE", 138, y);
      pdfDoc.text("MOMENTUM", 168, y);
      y += 3;
      pdfDoc.line(20, y, 190, y);
      y += 5;

      pdfDoc.setFont("helvetica", "normal");
      const sortedDeals = [...(allDeals || [])].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
      sortedDeals.forEach(deal => {
        if (y > 275) { pdfDoc.addPage(); y = 20; }
        const m = computeMomentum({
          daysInStage: deal.daysInStage || 0,
          rolloverCount: deal.rolloverCount || 0,
          barrierText: deal.barriers || '',
          lastBarrierText: deal.lastBarrierText || ''
        });
        pdfDoc.text((deal.pipeline || 'Unknown').substring(0, 38), 20, y);
        pdfDoc.text(`$${((Number(deal.value) || 0) / 1000).toFixed(0)}K`, 115, y);
        pdfDoc.text((deal.stage || '').substring(0, 12), 138, y);
        pdfDoc.text(m.score, 168, y);
        y += 7;
      });

      pdfDoc.save(`${profile.name.replace(/\s+/g, '_')}_Wk${currentWeek.split('-')[1]}_Performance_Pack.pdf`);
      toast({ title: "Weekly Pack Exported" });
    } catch (e) {
      toast({ variant: "destructive", title: "Export Failed" });
    } finally {
      setIsExporting(false);
    }
  };

  if (isStatsLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Compass className="animate-spin" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-black font-headline text-primary tracking-tighter uppercase">{isAM ? 'Portfolio Intelligence' : 'Professional Brief'}</h1>
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-white border-none font-black text-[9px] uppercase tracking-widest">{profile?.territory?.replace('_', ' ')}</Badge>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-tight">{profile?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPdf} disabled={isExporting} className="bg-slate-900 font-black h-11 px-6 shadow-lg text-sm">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />} 
            {isExporting ? 'EXPORTING...' : 'WEEKLY PACK (PDF)'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Rev YTD" value={`${formatEAV(crmSummary.myStats?.custYTDRevenueThisFY || 0)}`} subtitle={`Tgt: ${formatEAV(stats?.target || 0)}`} icon={<DollarSign className="w-4 h-4" />} info="Annual strategic revenue achievement." />
        <KPICard title="Forecast" value={`${formatEAV(weightedForecast)}`} subtitle="Weighted" icon={<TrendingUp className="w-4 h-4 text-green-500" />} info="Calculated based on stage probability × value." />
        <KPICard title="Strategic Yield" value={`${formatEAV((isAM ? (crmSummary.myStats?.custYTDRevenueThisFY || 0) : pipelineTotal) / (stats?.activityScore || 1))}`} subtitle="Val/Activity" icon={<Gauge className="w-4 h-4" />} info="The 'Professional Multiplier': Revenue generated per unit of activity." />
        <KPICard 
          title="Velocity Pulse" 
          value={`${momentumCounts.HOT}`} 
          subtitle="Hot Deals"
          status={momentumCounts.STALLING > 3 ? 'AT_RISK' : 'ON_TRACK'} 
          icon={<Activity className="w-4 h-4 text-accent" />} 
          info="Live momentum tracking. Flagging deals based on stage duration." 
        />
      </div>

      <CRMSummaryPanel summary={crmSummary} showAllUsers={false} currentWeek={currentWeek} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
         <div className="xl:col-span-8 space-y-8">
            <SmartGoalsView userId={userId || ''} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative h-full">
                  <div className="absolute top-0 right-0 p-6 opacity-10"><Target className="w-24 h-24 text-accent" /></div>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-accent"><Target className="w-3.5 h-3.5" /> Execution Priorities</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                     <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group hover:bg-white/10 transition-all cursor-pointer">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center font-black text-[10px] shrink-0">1</div>
                        <p className="text-[11px] font-bold leading-tight flex-1">Complete all Monday Planning commitments by 10am.</p>
                     </div>
                     <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group hover:bg-white/10 transition-all cursor-pointer">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center font-black text-[10px] shrink-0">2</div>
                        <p className="text-[11px] font-bold leading-tight flex-1">Log all client outcomes in the Rapid Habit Tracker daily.</p>
                     </div>
                     <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group hover:bg-white/10 transition-all cursor-pointer">
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center font-black text-[10px] shrink-0">3</div>
                        <p className="text-[11px] font-bold leading-tight flex-1">Finalise your Friday Synthesis pack for leadership review.</p>
                     </div>
                  </CardContent>
               </Card>

               <Card className="border-none shadow-xl bg-white overflow-hidden relative h-full border-2 border-accent/20">
                  <div className="absolute top-0 right-0 p-6 opacity-5"><CalendarClock className="w-24 h-24 text-accent" /></div>
                  <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary"><CalendarClock className="w-3.5 h-3.5 text-accent" /> Strategic Nudge</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                     <div>
                        <p className="text-sm font-black text-primary uppercase">30-60-90 Success Plan</p>
                        <p className="text-[10px] text-muted-foreground font-bold mt-1 leading-tight">Your individual strategic roadmap requires completion for quarterly governance.</p>
                     </div>
                     <Button 
                       onClick={() => setActiveTab('reset')}
                       className="w-full bg-accent hover:bg-accent/90 text-white font-black h-9 text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-accent/20 gap-2"
                     >
                        Update Success Plan <ArrowRight className="w-3 h-3" />
                     </Button>
                  </CardContent>
               </Card>
            </div>
         </div>
         <div className="xl:col-span-4"><BehaviorAlerts stats={stats} /></div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-auto flex w-full overflow-x-auto scrollbar-hide">
          <TabsTrigger value="overview" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest">Dashboard</TabsTrigger>
          <TabsTrigger value="monday" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest bg-primary/5 text-primary">Monday Planning</TabsTrigger>
          <TabsTrigger value="accounts" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest bg-emerald-50/50 text-emerald-600">Customers</TabsTrigger>
          <TabsTrigger value="pipeline" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest">Opportunities</TabsTrigger>
          <TabsTrigger value="submission" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest bg-accent/5 text-accent"><Send className="w-3 h-3 mr-1" /> Friday Synthesis</TabsTrigger>
          <TabsTrigger value="prep" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest">Call Prep</TabsTrigger>
          <TabsTrigger value="reset" className="flex-1 text-center rounded-lg px-6 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest">Success Plan</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-6 flex flex-col">
              <VoiceActionLogger userId={userId || ''} userName={profile?.name || 'BDM'} />
              <ActivityLogger userId={userId || ''} />
              <HistoricalActivity userId={userId || ''} />
            </div>
            <div className="md:col-span-1 xl:col-span-2">
              <TerritoryPlaybook territory={profile?.territory || 'FLEX'} zones={profile?.zones || []} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="monday"><WeeklyGoals userId={userId || ''} /></TabsContent>
        <TabsContent value="accounts"><PipelineReviewTable userId={userId || ''} filterType="accounts" /></TabsContent>
        <TabsContent value="pipeline" className="space-y-6">
          <AIDealWhisperer deals={allDeals || []} />
          <PipelineReviewTable userId={userId || ''} filterType="opportunities" />
        </TabsContent>
        <TabsContent value="submission"><BDMWeeklySubmission userId={userId || ''} userName={profile?.name || 'BDM'} /></TabsContent>
        <TabsContent value="prep"><CallPlanning userId={userId || ''} /></TabsContent>
        <TabsContent value="reset"><OnboardingPlan userId={userId || 'BDM'} userName={profile?.name || 'BDM'} planType={profile?.planType || 'BDM_NORTH_90'} /></TabsContent>
      </Tabs>
    </div>
  );
}
