"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getNextWeekKey, formatEAV } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Loader2, TrendingUp, DollarSign, Target, Phone, CalendarCheck, 
  Users, Briefcase, AlertTriangle, CheckCircle2, ArrowRight,
  FileText, Calendar, RefreshCw, Save, Send, ChevronRight,
  Award, Clock, Activity, PieChart, BarChart3, Plus, Trash2, LifeBuoy, ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useCRMSummary } from '@/hooks/use-crm-summary';

interface FridayPerformanceReviewProps {
  userId: string;
  userName: string;
  userRole: string;
  userState: string;
  selectedWeek: string;
}

export function FridayPerformanceReview({ 
  userId, 
  userName, 
  userRole, 
  userState,
  selectedWeek 
}: FridayPerformanceReviewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { profile, isLeader } = useAuth();
  
  // Get next week key for planning
  const nextWeek = getNextWeekKey(selectedWeek);
  const currentWeek = selectedWeek;
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'NOT_STARTED'>('NOT_STARTED');
  
  // ─── CRM Data (from existing hooks) ──────────────────────────────────────
  const { pipelineReviews: allDeals, weeklyProgresses: allActivity } = usePipelineData();
  const crmSummary = useCRMSummary(userId, isLeader);
  
  // ─── User's Data for Current Week ─────────────────────────────────────────
  const [currentWeekData, setCurrentWeekData] = useState({
    // From CRM
    opportunities: [] as any[],
    accounts: [] as any[],
    activity: { calls: 0, apps: 0, proposals: 0, deals: 0 },
    revenue: { won: 0, pipeline: 0, ytd: 0 },
    
    // From Thursday TWTW
    wins: [] as any[],
    risks: [] as any[],
    updates: [] as any[],
    projectedWins: [] as any[],
    priorities: [] as any[],
    
    // User-entered
    narrative: '',
    roadblocks: '',
    supportNeeded: '',
    keyLearnings: '',
  });
  
  // ─── Next Week Planning Data ─────────────────────────────────────────────
  const [nextWeekPlan, setNextWeekPlan] = useState({
    focusAccounts: [] as { id: string; accountName: string; actionType: string; eav: number; aboutAccount: string }[],
    kpiTargets: {
      callsToMake: userRole === 'BDM' ? 50 : 30,
      appointmentsToSet: userRole === 'BDM' ? 15 : 10,
      proposalsToSend: 8,
      dealsToClose: 3,
      revenueTarget: 250000
    },
    actionPlan: ['', '', '', '', ''] as string[],
    roadblocks: '',
    supportNeeded: '',
    strategicFocus: '',
  });
  
  // ─── Load All Data ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAllData() {
      if (!db || !userId) return;
      setIsLoading(true);
      
      try {
        // 1. Load Thursday TWTW submission
        const twtwDoc = await getDocs(
          query(collection(db, 'twiwSubmissions'), 
            where('userId', '==', userId),
            where('week', '==', currentWeek)
          )
        );
        
        let twtwData: any = {};
        if (!twtwDoc.empty) {
          twtwData = twtwDoc.docs[0].data();
        }
        
        // 2. Load user's weeklyProgress for activity
        const progressDoc = await getDocs(
          query(collection(db, 'weeklyProgress'),
            where('userId', '==', userId),
            where('week', '==', currentWeek)
          )
        );
        
        let progressData: any = {};
        if (!progressDoc.empty) {
          progressData = progressDoc.docs[0].data();
        }
        
        // 3. Load next week's commitments (if they exist)
        const nextWeekDoc = await getDocs(
          query(collection(db, 'weeklyCommitments'),
            where('userId', '==', userId),
            where('week', '==', nextWeek)
          )
        );
        
        let nextWeekData: any = {};
        if (!nextWeekDoc.empty) {
          nextWeekData = nextWeekDoc.docs[0].data();
        }
        
        // 4. Filter CRM data for current week
        const userDeals = allDeals?.filter(d => d.userId === userId && d.week === currentWeek) || [];
        const userActivity = allActivity?.filter(a => a.userId === userId && a.week === currentWeek) || [];
        
        // 5. Build the data objects
        setCurrentWeekData({
          // CRM Data
          opportunities: userDeals.filter(d => !d.isBareAccount),
          accounts: userDeals.filter(d => d.isBareAccount),
          activity: {
            calls: progressData?.calls || userActivity.reduce((sum, a) => sum + (a.calls || 0), 0),
            apps: progressData?.apps || userActivity.reduce((sum, a) => sum + (a.apps || 0), 0),
            proposals: progressData?.proposals || userActivity.reduce((sum, a) => sum + (a.proposals || 0), 0),
            deals: progressData?.deals || userActivity.reduce((sum, a) => sum + (a.deals || 0), 0),
          },
          revenue: {
            won: userDeals.filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (d.value || 0), 0),
            pipeline: userDeals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').reduce((sum, d) => sum + (d.value || 0), 0),
            ytd: crmSummary.myStats?.custYTDRevenueThisFY || 0,
          },
          
          // Thursday TWTW Data
          wins: twtwData.wins || [],
          risks: twtwData.risks || [],
          updates: twtwData.majorUpdates || [],
          projectedWins: twtwData.projectedWins || [],
          priorities: twtwData.priorities || [],
          
          // User-entered
          narrative: twtwData.updates || '',
          roadblocks: twtwData.roadblocks || '',
          supportNeeded: twtwData.supportNeeded || '',
          keyLearnings: twtwData.keyLearnings || '',
        });
        
        // 6. Load next week planning data (if exists)
        const twtwPriorities = twtwData.priorities || [];
        const twtwActions = twtwPriorities.map((p: any) => typeof p === 'string' ? p : p.text).filter((t: string) => t && t.trim());

        if (nextWeekData && Object.keys(nextWeekData).length > 0) {
          setStatus(nextWeekData.status || 'NOT_STARTED');
          
          let actionPlan = nextWeekData.actionPlan || [];
          if ((actionPlan.length === 0 || actionPlan.every((a: string) => !a.trim())) && twtwActions.length > 0) {
            actionPlan = twtwActions;
          }
          if (actionPlan.length === 0) {
            actionPlan = ['', '', '', '', ''];
          }

          setNextWeekPlan({
            focusAccounts: nextWeekData.focusAccounts || [],
            kpiTargets: nextWeekData.kpiTargets || {
              callsToMake: userRole === 'BDM' ? 50 : 30,
              appointmentsToSet: userRole === 'BDM' ? 15 : 10,
              proposalsToSend: 8,
              dealsToClose: 3,
              revenueTarget: 250000
            },
            actionPlan: actionPlan,
            roadblocks: nextWeekData.roadblocks || '',
            supportNeeded: nextWeekData.supportNeeded || '',
            strategicFocus: nextWeekData.strategicFocus || '',
          });
        } else {
          const initialActions = twtwActions.length > 0 ? twtwActions : ['', '', '', '', ''];
          setNextWeekPlan({
            focusAccounts: [],
            kpiTargets: {
              callsToMake: userRole === 'BDM' ? 50 : 30,
              appointmentsToSet: userRole === 'BDM' ? 15 : 10,
              proposalsToSend: 8,
              dealsToClose: 3,
              revenueTarget: 250000
            },
            actionPlan: initialActions,
            roadblocks: '',
            supportNeeded: '',
            strategicFocus: '',
          });
        }
        
      } catch (error) {
        console.error("Failed to load Friday data:", error);
        toast({ 
          variant: "destructive", 
          title: "Data Load Failed", 
          description: "Could not load your performance data." 
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAllData();
  }, [db, userId, currentWeek, nextWeek, allDeals, allActivity, crmSummary]);
  
  // ─── Save Functions ──────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!db || !userId) return;
    setIsSaving(true);
    
    try {
      // Save next week's commitments
      await setDoc(doc(db, 'weeklyCommitments', `${userId}_${nextWeek}`), {
        userId,
        week: nextWeek,
        focusAccounts: nextWeekPlan.focusAccounts,
        kpiTargets: nextWeekPlan.kpiTargets,
        actionPlan: nextWeekPlan.actionPlan.filter(a => a.trim()),
        roadblocks: nextWeekPlan.roadblocks,
        supportNeeded: nextWeekPlan.supportNeeded,
        strategicFocus: nextWeekPlan.strategicFocus,
        status: 'DRAFT',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({ title: "Draft Saved", description: "Next week's plan has been saved as a draft." });
      setStatus('DRAFT');
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!db || !userId) return;
    setIsSubmitting(true);
    
    try {
      // 1. Save next week's commitments as SUBMITTED
      await setDoc(doc(db, 'weeklyCommitments', `${userId}_${nextWeek}`), {
        userId,
        week: nextWeek,
        focusAccounts: nextWeekPlan.focusAccounts,
        kpiTargets: nextWeekPlan.kpiTargets,
        actionPlan: nextWeekPlan.actionPlan.filter(a => a.trim()),
        roadblocks: nextWeekPlan.roadblocks,
        supportNeeded: nextWeekPlan.supportNeeded,
        strategicFocus: nextWeekPlan.strategicFocus,
        status: 'SUBMITTED',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // 2. Update weeklyReports with the review data
      await setDoc(doc(db, 'weeklyReports', `${userId}_${currentWeek}`), {
        userId,
        userName,
        week: currentWeek,
        weeklyNotes: currentWeekData.narrative,
        keyLearnings: currentWeekData.keyLearnings,
        roadblocks: currentWeekData.roadblocks,
        supportNeeded: currentWeekData.supportNeeded,
        summary: {
          totalEAV: currentWeekData.revenue.pipeline + currentWeekData.revenue.won,
          newOpportunitiesCount: currentWeekData.opportunities.length,
          signedPaperworkCount: currentWeekData.wins.length,
          newBusinessCount: currentWeekData.accounts.filter(a => a.stage === 'Closed Won').length,
          callsMade: currentWeekData.activity.calls,
          meetingsHeld: currentWeekData.activity.apps,
          crmCalls: currentWeekData.activity.calls,
          crmApps: currentWeekData.activity.apps
        },
        status: 'REVIEWED',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({ 
        title: "✅ Friday Pack Submitted", 
        description: "Your weekly review has been submitted and next week's plan is locked in." 
      });
      setStatus('SUBMITTED');
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Submission Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ─── Helper Functions ─────────────────────────────────────────────────────
  const addFocusAccount = () => {
    setNextWeekPlan(prev => ({
      ...prev,
      focusAccounts: [...prev.focusAccounts, {
        id: crypto.randomUUID(),
        accountName: '',
        actionType: 'Prospect',
        eav: 0,
        aboutAccount: ''
      }]
    }));
  };
  
  const removeFocusAccount = (id: string) => {
    setNextWeekPlan(prev => ({
      ...prev,
      focusAccounts: prev.focusAccounts.filter(f => f.id !== id)
    }));
  };
  
  const updateFocusAccount = (id: string, field: string, value: any) => {
    setNextWeekPlan(prev => ({
      ...prev,
      focusAccounts: prev.focusAccounts.map(f => 
        f.id === id ? { ...f, [field]: value } : f
      )
    }));
  };
  
  const addAction = () => {
    setNextWeekPlan(prev => ({
      ...prev,
      actionPlan: [...prev.actionPlan, '']
    }));
  };
  
  const removeAction = (index: number) => {
    if (nextWeekPlan.actionPlan.length <= 1) return;
    setNextWeekPlan(prev => ({
      ...prev,
      actionPlan: prev.actionPlan.filter((_, i) => i !== index)
    }));
  };
  
  const updateAction = (index: number, value: string) => {
    setNextWeekPlan(prev => ({
      ...prev,
      actionPlan: prev.actionPlan.map((a, i) => i === index ? value : a)
    }));
  };
  
  // ─── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Loading your performance data...
        </p>
      </div>
    );
  }
  
  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between lg:items-center bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <TrendingUp className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <Badge className="bg-accent text-white font-black text-[9px] uppercase tracking-widest px-3 mb-2">
            Friday Performance Review
          </Badge>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
            Week {currentWeek.split('-')[1]} Review &amp; Week {nextWeek.split('-')[1]} Planning
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Registered User · {userName} · {userState} Region
          </p>
        </div>
        <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full lg:w-auto justify-end">
          <div className="text-right hidden sm:block mr-2">
            <p className="text-[10px] font-black text-accent uppercase tracking-widest">Revenue YTD</p>
            <p className="text-3xl font-black">{formatEAV(currentWeekData.revenue.ytd)}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSaveDraft} 
            disabled={isSaving || isSubmitting} 
            className="font-black h-16 px-6 rounded-2xl shadow-sm gap-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs w-full sm:w-auto"
          >
            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            Save Draft
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isSaving} 
            className="bg-accent hover:bg-accent/90 text-white font-black h-16 px-8 rounded-2xl shadow-xl gap-3 text-xs w-full sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
            Submit Friday Pack
          </Button>
        </div>
      </header>
      
      {/* ─── Section 1: Previous Week Performance (CRM Data) ───────────────── */}
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                Week {currentWeek.split('-')[1]} Performance Summary
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Combined CRM data and Thursday TWTW submission
              </CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 border-none font-bold text-[9px] uppercase">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {currentWeekData.wins.length} Wins
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-blue-600" />
                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Calls</p>
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekData.activity.calls}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Appointments</p>
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekData.activity.apps}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Opportunities</p>
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekData.opportunities.length}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pipeline Value</p>
              </div>
              <p className="text-2xl font-black text-slate-800">{formatEAV(currentWeekData.revenue.pipeline)}</p>
            </div>
          </div>
          
          {/* CRM Opportunities Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" />
              Active Opportunities ({currentWeekData.opportunities.length})
            </h4>
            {currentWeekData.opportunities.length > 0 ? (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Stage</th>
                      <th className="px-4 py-2 text-right">Value</th>
                      <th className="px-4 py-2 text-right">Probability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentWeekData.opportunities.map((opp: any) => (
                      <tr key={opp.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-700">{opp.pipeline}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[8px] font-black uppercase">
                            {opp.stage || 'Discovery'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-black">{formatEAV(opp.value || 0)}</td>
                        <td className="px-4 py-2 text-right font-bold">{opp.probability || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No active opportunities found in CRM for this week.</p>
            )}
          </div>
          
          {/* Thursday TWTW Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                Thursday TWTW Wins ({currentWeekData.wins.length})
              </h4>
              {currentWeekData.wins.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.wins.map((w: any, i: number) => (
                    <div key={i} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <p className="font-bold text-slate-800">{w.customer}</p>
                      <p className="text-sm font-black text-emerald-600">{formatEAV(w.value)}</p>
                      {w.updateText && <p className="text-xs text-slate-600 mt-1">{w.updateText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No wins logged in Thursday TWTW.</p>
              )}
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Risks & Barriers
              </h4>
              {currentWeekData.risks.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.risks.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                      <p className="font-bold text-slate-800">{r.account}</p>
                      <p className="text-sm font-black text-rose-600">{formatEAV(r.value)}</p>
                      {r.mitigation && <p className="text-xs text-slate-600 mt-1">Mitigation: {r.mitigation}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No risks logged in Thursday TWTW.</p>
              )}
            </div>
          </div>
          
          {/* User Narrative */}
          {currentWeekData.narrative && (
            <div className="p-4 bg-slate-50 border rounded-xl">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">📝 Narrative Summary</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentWeekData.narrative}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ─── Section 2: Next Week Planning ─────────────────────────────────── */}
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                Week {nextWeek.split('-')[1]} Planning
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Set your KPI targets, focus accounts, and actions for the coming week
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {/* KPI Targets */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700">KPI Targets</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Calls Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.callsToMake} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, callsToMake: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-black"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Appts Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.appointmentsToSet} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, appointmentsToSet: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-black"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Proposals Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.proposalsToSend} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, proposalsToSend: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-black"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Deals Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.dealsToClose} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, dealsToClose: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-black"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Revenue ($)</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.revenueTarget} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, revenueTarget: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-black"
                />
              </div>
            </div>
          </div>
          
          {/* Focus Accounts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-700">Focus Accounts</h4>
              <Button size="sm" variant="outline" onClick={addFocusAccount} className="h-7 text-[9px] font-black uppercase">
                <Plus className="w-3 h-3 mr-1" /> Add Account
              </Button>
            </div>
            <div className="space-y-3">
              {nextWeekPlan.focusAccounts.map((acc) => (
                <div key={acc.id} className="p-4 bg-slate-50 border rounded-xl space-y-3 relative group">
                  <div className="flex justify-between items-center gap-2">
                    <Input 
                      placeholder="Account Name..." 
                      value={acc.accountName} 
                      onChange={e => updateFocusAccount(acc.id, 'accountName', e.target.value)}
                      className="h-9 text-xs font-bold flex-1"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeFocusAccount(acc.id)}
                      className="h-8 w-8 text-red-300 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      value={acc.actionType} 
                      onChange={e => updateFocusAccount(acc.id, 'actionType', e.target.value)}
                      className="h-9 text-[10px] font-black uppercase rounded-lg border bg-white px-2"
                    >
                      {['Prospect', 'Develop', 'Propose', 'Negotiate', 'Finalise', 'Pending Trade', 'Closed - Won'].map(t => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                    <Input 
                      type="number" 
                      placeholder="EAV ($)" 
                      value={acc.eav || ''} 
                      onChange={e => updateFocusAccount(acc.id, 'eav', parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs bg-white"
                    />
                  </div>
                  <Textarea 
                    placeholder="About account..." 
                    value={acc.aboutAccount} 
                    onChange={e => updateFocusAccount(acc.id, 'aboutAccount', e.target.value)}
                    className="min-h-[60px] text-xs"
                  />
                </div>
              ))}
              {nextWeekPlan.focusAccounts.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">No focus accounts added yet.</p>
              )}
            </div>
          </div>
          
          {/* This Weeks Actions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-700">This Weeks Actions</h4>
            </div>
            <div className="space-y-2">
              {nextWeekPlan.actionPlan.map((action, index) => (
                <div key={index} className="flex gap-3 items-center group">
                  <Badge className="bg-slate-100 text-slate-700 font-black text-[9px] uppercase border shrink-0">
                    Action {index + 1}
                  </Badge>
                  <Input 
                    placeholder="Enter tactical action..." 
                    value={action} 
                    onChange={e => updateAction(index, e.target.value)}
                    className="h-9 text-xs font-bold"
                  />
                  {nextWeekPlan.actionPlan.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeAction(index)}
                      className="h-8 w-8 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="pt-1">
                <Button 
                  onClick={addAction} 
                  variant="outline" 
                  size="sm" 
                  className="text-[10px] font-black uppercase tracking-wider h-9 border-dashed border-slate-300 hover:border-slate-400 bg-white shadow-sm hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Action Item
                </Button>
              </div>
            </div>
          </div>
          
          {/* Roadblocks & Support */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Anticipated Roadblocks
              </Label>
              <Textarea 
                placeholder="What roadblocks do you anticipate next week?" 
                value={nextWeekPlan.roadblocks} 
                onChange={e => setNextWeekPlan(prev => ({ ...prev, roadblocks: e.target.value }))}
                className="min-h-[90px] text-xs font-medium rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                <LifeBuoy className="w-3.5 h-3.5 text-blue-500" /> Management Support Needed
              </Label>
              <Textarea 
                placeholder="What support do you need from leadership?" 
                value={nextWeekPlan.supportNeeded} 
                onChange={e => setNextWeekPlan(prev => ({ ...prev, supportNeeded: e.target.value }))}
                className="min-h-[90px] text-xs font-medium rounded-xl"
              />
            </div>
          </div>
          
          {/* Strategic Focus */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-indigo-500" /> Strategic Focus for Next Week
            </Label>
            <Textarea 
              placeholder="What is your primary strategic focus next week?" 
              value={nextWeekPlan.strategicFocus} 
              onChange={e => setNextWeekPlan(prev => ({ ...prev, strategicFocus: e.target.value }))}
              className="min-h-[60px] text-xs font-medium rounded-xl"
            />
          </div>

          {/* Publication Status Panel (uniform with TWTW but full-width) */}
          <div className="mt-8 pt-6 border-t w-full">
            <Card className="border-slate-800 shadow-xl rounded-3xl overflow-hidden bg-slate-900 text-white w-full">
              <CardHeader className="border-b border-slate-800 py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" /> Publication Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex justify-between items-center md:justify-start md:gap-6 bg-white/5 border border-white/10 rounded-2xl p-3 md:flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</span>
                  <Badge className={cn(
                    "border-none text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                    status === 'SUBMITTED' ? "bg-green-500/20 text-green-300 border-green-500/30" :
                    status === 'DRAFT' ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-slate-500/20 text-slate-300"
                  )}>
                    {status === 'SUBMITTED' ? 'Submitted' : status === 'DRAFT' ? 'Draft' : 'Not Started'}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 md:flex-1 justify-end">
                  <Button 
                    onClick={handleSaveDraft} 
                    disabled={isSaving || isSubmitting}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-sm border border-slate-700 w-full sm:w-auto px-6"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-slate-300" />}
                    Save Draft
                  </Button>

                  <Button 
                    onClick={handleSubmit} 
                    disabled={isSaving || isSubmitting}
                    className="bg-accent hover:bg-accent/90 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto px-8"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === 'SUBMITTED' ? 'Update Submission' : 'Submit Friday Pack'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
