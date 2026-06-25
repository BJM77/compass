"use client";

import { useState, useMemo } from 'react';
import { useAuth, UserProfile } from '@/contexts/auth-context';
import { KPICard } from './kpi-card';
import { TerritoryPlaybook } from './territory-playbook';
import { OnboardingPlan } from './onboarding-plan';
import { TWIWView } from './twiw-view';
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
  CalendarClock, Activity, Send, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDoc, useMemoFirebase, useFirestore, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { jsPDF } from "jspdf";
import { computeMomentum } from '@/lib/momentum';
import { getCurrentWeek, formatEAV, getWidgetSpanClass } from '@/lib/utils';
import { useCRMSummary } from '@/hooks/use-crm-summary';
import { CRMSummaryPanel } from './crm-summary-panel';
import { usePipelineData } from '@/contexts/pipeline-context';
import { calculateDealHealth } from '@/lib/deal-health';
import { DEFAULT_DASHBOARD_LAYOUT, DashboardWidgetConfig } from './settings-hub';

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
  const [collapsedWidgets, setCollapsedWidgets] = useState<Record<string, boolean>>({
    'monday-planning': true,
    'friday-synthesis': true,
    'call-prep': true,
    'smart-goals': true,
    'success-plan': true,
    'voice-logger': true,
  });
  const currentWeek = getCurrentWeek();

  const userId = simulatedUser?.uid || authUser?.uid || null;
  const profile = simulatedUser?.profile || authProfile;
  const isAM = profile?.role === 'ACCOUNT_MANAGER';

  const statsDocRef = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return doc(db, 'bdmStats', userId);
  }, [db, userId]);
  const { data: stats, isLoading: isStatsLoading } = useDoc(statsDocRef);

  const settingsDocRef = useMemoFirebase(() => {
    if (!db || !authUser) return null;
    return doc(db, 'appSettings', 'global');
  }, [db, authUser]);
  const { data: globalSettings } = useDoc(settingsDocRef);
  const rawLayout = (globalSettings?.dashboardLayout || DEFAULT_DASHBOARD_LAYOUT) as DashboardWidgetConfig[];
  
  const layout = useMemo(() => {
    let result = [...rawLayout];
    
    const twiwIdx = result.findIndex(w => w.id === 'twiw');
    const fridayIdx = result.findIndex(w => w.id === 'friday-synthesis');
    const callPrepIdx = result.findIndex(w => w.id === 'call-prep');
    
    let twiwWidget: DashboardWidgetConfig = { id: 'twiw', name: 'The Week That Was (TWTW)', width: 3, visible: true };
    let fridayWidget: DashboardWidgetConfig = { id: 'friday-synthesis', name: 'Friday Synthesis (Weekly Submission)', width: 3, visible: false };
    let callPrepWidget: DashboardWidgetConfig = { id: 'call-prep', name: 'Call Prep / Call Planning', width: 3, visible: false };
    
    // Extract widgets in reverse index order to avoid shifting issues
    const indices = [
      { id: 'twiw', idx: twiwIdx },
      { id: 'friday-synthesis', idx: fridayIdx },
      { id: 'call-prep', idx: callPrepIdx }
    ].sort((a, b) => b.idx - a.idx);
    
    indices.forEach(item => {
      if (item.idx !== -1) {
        const extracted = result.splice(item.idx, 1)[0];
        if (item.id === 'twiw') twiwWidget = extracted;
        else if (item.id === 'friday-synthesis') fridayWidget = extracted;
        else if (item.id === 'call-prep') callPrepWidget = extracted;
      }
    });

    twiwWidget.name = 'Thursday TWTW';
    fridayWidget.name = 'Friday FW';

    if (profile?.role === 'BDM' || profile?.role === 'ACCOUNT_MANAGER') {
      twiwWidget.visible = true;
      fridayWidget.visible = true;
      result = result.filter(w => w.id !== 'monday-planning');
    }

    // Find the insertion point (minimum index of the original positions)
    const originalIndices = [twiwIdx, fridayIdx, callPrepIdx].filter(idx => idx !== -1);
    const insertIdx = originalIndices.length > 0 ? Math.min(...originalIndices) : result.length;
    
    // Insert them sequentially: twiw first, then friday-synthesis, then call-prep
    result.splice(insertIdx, 0, twiwWidget, fridayWidget, callPrepWidget);
    
    return result;
  }, [rawLayout, profile]);

  const { pipelineReviews: allDeals } = usePipelineData();

  // Load Fact Findings
  const ffQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'factFindingDocs'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: factFindings } = useCollection(ffQuery);

  // Load Call Plans
  const cpQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: callPlans } = useCollection(cpQuery);

  // Load Whitespace Plans
  const wpQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'whitespacePlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: whitespacePlans } = useCollection(wpQuery);

  const recommendations = useMemo(() => {
    const list: any[] = [];
    const myDeals = allDeals?.filter(d => d.userId === userId && d.isReviewSelected) || [];
    
    myDeals.forEach(deal => {
      const dealNameUpper = (deal.pipeline || '').toUpperCase();
      const oppNameUpper = (deal.opportunityName || '').toUpperCase();
      
      const hasFF = factFindings?.some(ff => {
        const ffName = (ff.companyName || '').toUpperCase();
        return ffName && (ffName === dealNameUpper || ffName === oppNameUpper);
      });
      
      const hasCP = callPlans?.some(cp => {
        const cpName = (cp.accountName || '').toUpperCase();
        return cpName && (cpName === dealNameUpper || cpName === oppNameUpper);
      });

      const hasWP = whitespacePlans?.some(wp => {
        const wpName = (wp.accountName || '').toUpperCase();
        return wpName && (wpName === dealNameUpper || wpName === oppNameUpper);
      });

      // Check 1: Fact Finding exists but no Call Plan
      if (hasFF && !hasCP) {
        list.push({
          id: `ff-no-cp-${deal.id}`,
          type: 'ACTION',
          title: `Prepare Call Plan: ${deal.pipeline}`,
          description: `Discovery data exists in Fact Finding. Prepare a professional SPIN call plan to drive commitment.`,
          actionLabel: 'Plan Call',
          actionView: 'CALL_PLANNING',
          actionParams: { type: 'top8', data: deal }
        });
      }

      // Check 2: Stalled in stage > 30 days
      const daysInStage = Number(deal.daysInStage) || 0;
      if (daysInStage > 30) {
        list.push({
          id: `stalled-${deal.id}`,
          type: 'WARNING',
          title: `Stalled Deal Alert: ${deal.pipeline}`,
          description: `Opportunity has been in '${deal.stage}' stage for ${daysInStage} days. Re-assess barriers or schedule a coaching sync.`,
          actionLabel: 'Log Activity',
          actionView: 'overview'
        });
      }

      // Check 3: No Whitespace diagnostic
      if (!hasWP && deal.isBareAccount) {
        list.push({
          id: `no-wp-${deal.id}`,
          type: 'ACTION',
          title: `Run Whitespace Diagnostic: ${deal.pipeline}`,
          description: `Archived customer node lacks service share mapping. Complete a Whitespace diagnostic to target expansion.`,
          actionLabel: 'Run Whitespace',
          actionView: 'WHITE_SPACE'
        });
      }
    });

    if (list.length === 0) {
      list.push({
        id: 'default-1',
        type: 'STRENGTH',
        title: 'Strategy Pipeline Aligned',
        description: 'All active review accounts have call preparations and whitespace diagnostics current. Great execution!',
      });
    }

    return list.slice(0, 3);
  }, [allDeals, userId, factFindings, callPlans, whitespacePlans]);

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

  const renderWidget = (id: string) => {
    switch (id) {
      case 'kpi-cards':
        return (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
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
        );
      case 'crm-summary':
        return <CRMSummaryPanel summary={crmSummary} showAllUsers={false} currentWeek={currentWeek} />;
      case 'smart-goals':
        return <SmartGoalsView userId={userId || ''} />;
      case 'next-best-actions':
        return (
          <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative h-full">
             <div className="absolute top-0 right-0 p-6 opacity-10"><Sparkles className="w-24 h-24 text-accent" /></div>
             <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-accent">
                   <Sparkles className="w-3.5 h-3.5" /> Next Best Actions
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
                {recommendations.map((rec) => {
                   let typeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                   if (rec.type === 'WARNING') {
                      typeColor = "bg-rose-500/20 text-rose-300 border-rose-500/30";
                   } else if (rec.type === 'ACTION') {
                      typeColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                   }
                   return (
                      <div key={rec.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2 hover:bg-white/10 transition-all">
                         <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border", typeColor)}>
                               {rec.type}
                            </span>
                            {rec.actionLabel && (
                               <button
                                  onClick={() => {
                                     if (rec.actionView === 'CALL_PLANNING') {
                                        window.dispatchEvent(new CustomEvent('switch-view', {
                                           detail: { view: 'CALL_PLANNING', params: rec.actionParams }
                                        }));
                                     } else if (rec.actionView === 'WHITE_SPACE') {
                                        window.dispatchEvent(new CustomEvent('switch-view', {
                                           detail: { view: 'WHITE_SPACE' }
                                        }));
                                     } else if (rec.actionView) {
                                        const widgetMap: Record<string, string> = {
                                           'overview': 'kpi-cards',
                                           'monday': 'monday-planning',
                                           'accounts': 'customer-review',
                                           'pipeline': 'pipeline-review',
                                           'submission': 'friday-synthesis',
                                           'prep': 'call-prep',
                                           'reset': 'success-plan'
                                        };
                                        const targetWidgetId = widgetMap[rec.actionView];
                                        if (targetWidgetId) {
                                           setCollapsedWidgets(prev => ({ ...prev, [targetWidgetId]: false }));
                                           setTimeout(() => {
                                              const element = document.getElementById(`widget-${targetWidgetId}`);
                                              if (element) {
                                                 const yOffset = -160;
                                                 const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                                 window.scrollTo({ top: y, behavior: 'smooth' });
                                              }
                                           }, 100);
                                        }
                                     }
                                  }}
                                  className="text-[9px] font-black uppercase tracking-wider text-accent hover:underline flex items-center gap-1"
                               >
                                  {rec.actionLabel} <ArrowRight className="w-2.5 h-2.5" />
                               </button>
                            )}
                         </div>
                         <p className="text-[11px] font-black uppercase text-white leading-tight">{rec.title}</p>
                         <p className="text-[10px] font-medium text-slate-300 leading-snug">{rec.description}</p>
                      </div>
                   );
                })}
             </CardContent>
          </Card>
        );
      case 'strategic-nudge':
        return (
          <Card className="border-none shadow-xl bg-white overflow-hidden relative h-full border-2 border-accent/20">
             <div className="absolute top-0 right-0 p-6 opacity-5"><CalendarClock className="w-24 h-24 text-accent" /></div>
             <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary"><CalendarClock className="w-3.5 h-3.5 text-accent" /> Strategic Nudge</CardTitle></CardHeader>
             <CardContent className="space-y-4">
                <div>
                   <p className="text-sm font-black text-primary uppercase">30-60-90 Success Plan</p>
                   <p className="text-[10px] text-muted-foreground font-bold mt-1 leading-tight">Your individual strategic roadmap requires completion for quarterly governance.</p>
                </div>
                <Button 
                  onClick={() => {
                    setCollapsedWidgets(prev => ({ ...prev, 'success-plan': false }));
                    setTimeout(() => {
                      const element = document.getElementById('widget-success-plan');
                      if (element) {
                        const yOffset = -160;
                        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }, 100);
                  }}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-black h-9 text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-accent/20 gap-2"
                >
                   Update Success Plan <ArrowRight className="w-3 h-3" />
                </Button>
             </CardContent>
          </Card>
        );
      case 'behavioral-pulse':
        return <BehaviorAlerts stats={stats} />;
      case 'voice-logger':
        return <VoiceActionLogger userId={userId || ''} userName={profile?.name || 'BDM'} />;
      case 'habit-tracker':
        return <ActivityLogger userId={userId || ''} />;
      case 'historical-activity':
        return <HistoricalActivity userId={userId || ''} />;
      case 'territory-playbook':
        return <TerritoryPlaybook territory={profile?.territory || 'FLEX'} zones={profile?.zones || []} />;
      case 'monday-planning':
        return <WeeklyGoals userId={userId || ''} />;
      case 'customer-review':
        return <PipelineReviewTable userId={userId || ''} filterType="accounts" />;
      case 'pipeline-review':
        return (
          <div className="space-y-6">
            <AIDealWhisperer deals={allDeals || []} />
            <PipelineReviewTable userId={userId || ''} filterType="opportunities" />
          </div>
        );
      case 'friday-synthesis':
        return <BDMWeeklySubmission userId={userId || ''} userName={profile?.name || 'BDM'} />;
      case 'twiw':
        return <TWIWView userId={userId || ''} isLeader={false} />;
      case 'call-prep':
        return <CallPlanning userId={userId || ''} />;
      case 'success-plan':
        return <OnboardingPlan userId={userId || 'BDM'} userName={profile?.name || 'BDM'} planType={profile?.planType || 'BDM_NORTH_90'} />;
      default:
        return null;
    }
  };

  if (isStatsLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Compass className="animate-spin" /></div>;

  return (
    <div className="w-full p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-black font-headline text-primary tracking-tighter uppercase">{isAM ? 'Portfolio Intelligence' : 'Professional Brief'}</h1>
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-white border-none font-black text-[9px] uppercase tracking-widest">{profile?.territory?.replace('_', ' ')}</Badge>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-tight">{profile?.name}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* Dynamic Sticky Anchor Navigation Bar */}
        <div className="bg-white border p-1 rounded-xl shadow-sm h-auto flex w-full overflow-x-auto scrollbar-hide sticky top-16 z-20 max-w-full">
          {layout.filter(w => w.visible).map(widget => {
            // Map widget IDs to requested shortened names
            const shortNames: Record<string, string> = {
              'kpi-cards': 'Summary',
              'voice-logger': 'Logger',
              'crm-summary': 'Summary',
              'monday-planning': 'Monday Planning',
              'friday-synthesis': 'Friday FW',
              'twiw': 'Thursday TWTW',
              'call-prep': 'Planning',
              'smart-goals': 'Goals',
              'success-plan': 'Plan Details',
              // Fallbacks for other widgets
              'behavioral-pulse': 'Pulse',
              'next-best-actions': 'Next Actions',
              'strategic-nudge': 'Nudge',
              'territory-playbook': 'Playbook',
              'habit-tracker': 'Habits',
              'historical-activity': 'History',
              'customer-review': 'Customers',
              'pipeline-review': 'Opportunities'
            };

            const displayName = shortNames[widget.id] || widget.name.split(' (')[0].split(' Panel')[0].split(' Tracker')[0].split(' Cards')[0].split(' Table')[0].split(' Recommendation')[0];

            return (
              <button
                key={widget.id}
                onClick={() => {
                  // Automatically expand target widget if collapsed
                  setCollapsedWidgets(prev => ({ ...prev, [widget.id]: false }));
                  setTimeout(() => {
                    const element = document.getElementById(`widget-${widget.id}`);
                    if (element) {
                      const yOffset = -160;
                      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                  }, 100);
                }}
                className="flex-1 text-center rounded-lg px-4 py-2.5 font-black uppercase text-[10px] md:text-xs tracking-widest text-slate-600 hover:bg-slate-50 hover:text-primary transition-all whitespace-nowrap"
              >
                {displayName}
              </button>
            );
          })}
        </div>

        {/* Dynamic Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {layout.filter(w => w.visible).map(widget => {
            const isCollapsed = collapsedWidgets[widget.id] ?? false;
            const spanClass = getWidgetSpanClass(widget.width as 1 | 2 | 3);
            return (
              <div 
                key={widget.id} 
                id={`widget-${widget.id}`}
                className={cn(
                  spanClass,
                  "flex flex-col gap-4 border border-slate-200 bg-white rounded-3xl p-4 md:p-5 shadow-sm scroll-mt-40 transition-all duration-300 h-fit min-w-0 overflow-hidden"
                )}
              >
                {/* Header bar with collapse toggle */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                      {widget.name.split(' (')[0].split(' Panel')[0].split(' Tracker')[0].split(' Cards')[0].split(' Table')[0].split(' Recommendation')[0]}
                    </h3>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCollapsedWidgets(prev => ({
                        ...prev,
                        [widget.id]: !prev[widget.id]
                      }));
                    }}
                    className="h-8 px-3 text-[9px] font-black text-slate-500 hover:text-primary hover:bg-slate-50 flex items-center gap-1.5 rounded-xl uppercase tracking-wider"
                  >
                    {isCollapsed ? (
                      <>
                        <span>Show Details</span>
                        <ChevronDown className="w-3.5 h-3.5 text-accent" />
                      </>
                    ) : (
                      <>
                        <span>Hide Details</span>
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Body block */}
                {!isCollapsed && (
                  <div className="pt-2 animate-in fade-in duration-300">
                    {renderWidget(widget.id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
