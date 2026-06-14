"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, getWeekForDate, openSalesforceSearch } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Target, Rocket, Shield, Trash2, Plus, AlertTriangle, LifeBuoy, 
  ExternalLink, FileText, Sparkles, Map, CheckCircle2, X, Star, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, addWeeks, startOfMonth, endOfMonth, isSameWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePipelineData } from '@/contexts/pipeline-context';

interface FocusAccount {
  accountId: string;
  accountName: string;
  actionType: string;
  eav: number;
  aboutAccount: string;
}

interface KPITargets {
  callsToMake: number;
  appointmentsToSet: number;
  proposalsToSend: number;
  dealsToClose: number;
  revenueTarget: number;
}

const ACTION_TYPES = [
  "Prospect",
  "Develop",
  "Propose",
  "Negotiate",
  "Finalise",
  "Pending Trade",
  "Closed - Won"
];

const SALES_STAGES = [
  "--None--",
  "Develop",
  "Propose",
  "Negotiating",
  "Finalise",
  "Pending Trade",
  "Closed Won",
  "Closed Lost"
];

export function WeeklyGoals({ userId, userRole = 'BDM' }: { userId: string; userRole?: 'BDM' | 'AM' }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const targetDate = addWeeks(new Date(), weekOffset);
  const currentWeek = getWeekForDate(targetDate);
  
  const now = new Date();
  const canPlanNextWeek = (now.getDay() === 5 && now.getHours() >= 12) || now.getDay() === 6 || now.getDay() === 0;
  
  const [focusAccounts, setFocusAccounts] = useState<FocusAccount[]>([]);
  const [kpiTargets, setKpiTargets] = useState<KPITargets>({
    callsToMake: userRole === 'BDM' ? 50 : 30,
    appointmentsToSet: userRole === 'BDM' ? 15 : 10,
    proposalsToSend: 8,
    dealsToClose: 3,
    revenueTarget: 250000
  });
  const [actionPlan, setActionPlan] = useState<string[]>(['', '', '', '', '']);
  const [roadblocks, setRoadblocks] = useState('');
  const [supportNeeded, setSupportNeeded] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasExistingPlan, setHasExistingPlan] = useState(false);

  // SMART Goals State
  const [smartGoal, setSmartGoal] = useState({ specific: '', measurable: '', achievable: '', relevant: '', timebound: '' });
  const [hasGoalForMonth, setHasGoalForMonth] = useState(false);
  const [submittingGoal, setSubmittingGoal] = useState(false);

  // 1. Running Tallies Queries
  const wsQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'whitespacePlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: wsPlans } = useCollection(wsQuery);

  const cpQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: callPlans } = useCollection(cpQuery);

  // 2. Opportunities Query for SF Pipeline & Swimlanes
  const { pipelineReviews: pipelineData } = usePipelineData();

  // 3. 30-60-90 check
  const onboardingQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return doc(db, 'onboardingProgress', `${userId}_BDM_NORTH_90`); // fallback to default
  }, [db, userId]);
  const { data: onboarding } = useDoc(onboardingQuery);

  // Load existing plan & SMART Goals
  useEffect(() => {
    async function loadPlanAndGoals() {
      if (!db || !userId) return;
      
      // Reset form state while loading
      setFocusAccounts([]);
      setActionPlan(['', '', '', '', '']);
      setRoadblocks('');
      setSupportNeeded('');
      setHasExistingPlan(false);

      const planRef = doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`);
      const snap = await getDoc(planRef);
      let loadedFocus: FocusAccount[] = [];
      if (snap.exists()) {
        setHasExistingPlan(true);
        const data = snap.data();
        loadedFocus = (data.focusAccounts || []).map((acc: any) => ({
          ...acc,
          eav: acc.eav || 0,
          aboutAccount: acc.aboutAccount || acc.expectedOutcome || ''
        }));
        setKpiTargets(data.kpiTargets || {
          callsToMake: userRole === 'BDM' ? 50 : 30,
          appointmentsToSet: userRole === 'BDM' ? 15 : 10,
          proposalsToSend: 8,
          dealsToClose: 3,
          revenueTarget: 250000
        });
        if (Array.isArray(data.actionPlan)) setActionPlan(data.actionPlan);
        setRoadblocks(data.roadblocks || '');
        setSupportNeeded(data.supportNeeded || '');
      }

      // Check monthly SMART goals inside weeklyCommitments
      const start = startOfMonth(new Date());
      const goalSnap = await getDoc(doc(db, 'monthlySmartGoals', `${userId}_${format(start, 'yyyy-MM')}`));
      if (goalSnap.exists()) {
        setSmartGoal(goalSnap.data().goal || { specific: '', measurable: '', achievable: '', relevant: '', timebound: '' });
        setHasGoalForMonth(true);
      } else {
        setHasGoalForMonth(false);
        setSmartGoal({ specific: '', measurable: '', achievable: '', relevant: '', timebound: '' });
      }

      // Query Starred Top 8 accounts from pipelineReviews
      try {
        const reviewsSnap = await getDocs(query(
          collection(db, 'pipelineReviews'),
          where('userId', '==', userId),
          where('week', '==', currentWeek),
          where('isReviewSelected', '==', true)
        ));
        
        const starredAccounts = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        starredAccounts.forEach(starred => {
          const accName = (starred.pipeline || '').toUpperCase().trim();
          if (accName && !loadedFocus.some(f => f.accountName.toUpperCase().trim() === accName)) {
            loadedFocus.push({
              accountId: starred.id || crypto.randomUUID(),
              accountName: accName,
              actionType: starred.stage || 'Prospect',
              eav: parseFloat(starred.value) || 0,
              aboutAccount: starred.barriers || ''
            });
          }
        });
      } catch (err) {
        console.error("Failed to load starred Top 8 accounts", err);
      }

      setFocusAccounts(loadedFocus);
    }
    loadPlanAndGoals();
  }, [db, userId, currentWeek]);

  // Handle mock writes for SMART Goal
  const handleSaveSmartGoal = async () => {
    if (!db || !userId) return;
    setSubmittingGoal(true);
    try {
      const start = startOfMonth(new Date());
      await setDoc(doc(db, 'monthlySmartGoals', `${userId}_${format(start, 'yyyy-MM')}`), {
        userId,
        month: format(start, 'yyyy-MM'),
        goal: smartGoal,
        updatedAt: serverTimestamp()
      });
      toast({ title: "SMART Goal Saved", description: "Monthly goal committed." });
      setHasGoalForMonth(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Save Goal Failed" });
    } finally {
      setSubmittingGoal(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!db || !userId) return;
    setIsSavingDraft(true);
    try {
      await setDoc(doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`), {
        userId,
        week: currentWeek,
        focusAccounts,
        kpiTargets,
        actionPlan,
        roadblocks,
        supportNeeded,
        status: 'DRAFT',
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Draft Saved", description: "Your Monday Planning progress is safely saved." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Draft Failed" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const savePlan = async () => {
    if (!db || !userId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`), {
        userId,
        week: currentWeek,
        focusAccounts,
        kpiTargets,
        actionPlan,
        roadblocks,
        supportNeeded,
        status: 'SUBMITTED',
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "Weekly Strategy Locked", description: "Your tactical commitments are now live on the governance node." });
      setHasExistingPlan(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClonePreviousWeek = async () => {
    if (!db || !userId) return;
    try {
      const prevWeek = getWeekForDate(addWeeks(targetDate, -1));
      const prevPlanRef = doc(db, 'weeklyCommitments', `${userId}_${prevWeek}`);
      const snap = await getDoc(prevPlanRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.focusAccounts) {
          const clonedFocus = (data.focusAccounts || []).map((acc: any) => ({
            ...acc,
            accountId: crypto.randomUUID()
          }));
          setFocusAccounts(clonedFocus);
        }
        if (Array.isArray(data.actionPlan)) setActionPlan(data.actionPlan);
        if (data.roadblocks) setRoadblocks(data.roadblocks);
        if (data.supportNeeded) setSupportNeeded(data.supportNeeded);
        
        toast({ title: "Strategy Cloned", description: `Successfully cloned week ${prevWeek.split('-')[1]} strategic priorities.` });
      } else {
        toast({ variant: "destructive", title: "No Previous Data", description: `No strategic planning log found for week ${prevWeek.split('-')[1]}.` });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Cloning Failed", description: "Failed to read previous week plan." });
    }
  };

  const handleDelete = async () => {
    if (!db || !userId) return;
    if (!confirm("Are you sure you want to delete this weekly plan? This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`));
      toast({ title: "Plan Deleted", description: "Weekly plan has been removed." });
      setHasExistingPlan(false);
      setFocusAccounts([]);
      setActionPlan(['', '', '', '', '']);
      setRoadblocks('');
      setSupportNeeded('');
    } catch (e) {
      toast({ variant: "destructive", title: "Delete Failed" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Add opportunities or focus accounts
  const addFocusAccount = () => {
    setFocusAccounts([...focusAccounts, {
      accountId: crypto.randomUUID(),
      accountName: '',
      actionType: 'Prospect',
      eav: 0,
      aboutAccount: ''
    }]);
  };

  const addAction = () => setActionPlan([...actionPlan, '']);
  const updateAction = (index: number, val: string) => {
    const newPlan = [...actionPlan];
    newPlan[index] = val;
    setActionPlan(newPlan);
  };
  const removeAction = (index: number) => {
    if (actionPlan.length <= 1) return;
    setActionPlan(actionPlan.filter((_, i) => i !== index));
  };

  // Direct Salesforce links builders
  const getSfAccountUrl = (accName: string) => `https://salesforce.com/lightning/r/Account/Search?q=${encodeURIComponent(accName)}`;
  const getSfOpportunityUrl = (id?: string) => id ? `https://salesforce.com/lightning/r/Opportunity/${id}/view` : '#';

  // Group Pipeline Data by Sales Stage
  const groupedPipeline = useMemo(() => {
    const groups: Record<string, any[]> = {};
    SALES_STAGES.forEach(s => { groups[s] = []; });
    
    if (pipelineData) {
      pipelineData.forEach(item => {
        if (item.isBareAccount) return;
        const stage = item.stage || '--None--';
        if (groups[stage]) {
          groups[stage].push(item);
        } else {
          groups['--None--'].push(item);
        }
      });
    }
    return groups;
  }, [pipelineData]);

  // Quickly append to focus account/monday report
  const appendToFocusAccounts = (opp: any) => {
    const exists = focusAccounts.some(f => f.accountName.toUpperCase().trim() === opp.pipeline.toUpperCase().trim());
    if (exists) {
      toast({ title: "Already added", description: `${opp.pipeline} is already in focus accounts.` });
      return;
    }
    setFocusAccounts([...focusAccounts, {
      accountId: opp.id || crypto.randomUUID(),
      accountName: opp.pipeline.toUpperCase(),
      actionType: opp.stage || 'Prospect',
      eav: opp.value || 0,
      aboutAccount: opp.opportunityName || ''
    }]);
    toast({ title: "Added to Focus Accounts", description: `${opp.pipeline} added.` });
  };

  // Extract unique account and opportunity names for autocomplete selection
  const autocompleteOptions = useMemo(() => {
    if (!pipelineData) return [];
    const options = new Set<string>();
    pipelineData.forEach(item => {
      if (item.pipeline) options.add(item.pipeline.toUpperCase());
      if (item.opportunityName) options.add(item.opportunityName);
    });
    return Array.from(options).sort();
  }, [pipelineData]);

  // Handle focus account name change with auto-populate logic
  const handleFocusAccountNameChange = (idx: number, input: string) => {
    const n = [...focusAccounts];
    n[idx].accountName = input;

    // Check if input matches an Opportunity Name first, then an Account Name
    const matchedOpp = pipelineData?.find(p => p.opportunityName?.toLowerCase() === input.toLowerCase());
    const matchedAcc = pipelineData?.find(p => p.pipeline?.toLowerCase() === input.toLowerCase());
    const matched = matchedOpp || matchedAcc;

    if (matched) {
      n[idx].accountName = matched.pipeline?.toUpperCase() || input;
      n[idx].eav = matched.value || 0;
      n[idx].actionType = matched.stage || 'Prospect';
      
      // Populate notes from the Opportunity name and last activity
      let notes = matched.opportunityName || "";
      if (matched.lastActivity) {
        notes += ` (Last Activity: ${matched.lastActivity})`;
      }
      n[idx].aboutAccount = notes;
    }
    setFocusAccounts(n);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Share datalist for uploaded accounts and opportunities */}
      <datalist id="uploaded-accounts">
        {autocompleteOptions.map(option => (
          <option key={option} value={option} />
        ))}
      </datalist>
      


      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Target className="w-8 h-8 text-primary" />
            Monday Planning Node
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">
              Week {currentWeek.split('-')[1]} • Strategic Alignment Mode {weekOffset > 0 ? '(Next Week)' : ''}
            </p>
            {canPlanNextWeek && weekOffset === 0 && (
              <Button size="sm" variant="outline" onClick={() => setWeekOffset(1)} className="h-7 text-[10px] font-black uppercase bg-accent/10 text-accent border-accent/20 hover:bg-accent/20">
                Plan Next Week
              </Button>
            )}
            {weekOffset > 0 && (
              <Button size="sm" variant="outline" onClick={() => setWeekOffset(0)} className="h-7 text-[10px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200">
                Back to This Week
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {!hasExistingPlan && (
            <Button variant="outline" onClick={handleClonePreviousWeek} className="font-black h-12 px-6 uppercase shadow-sm gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              <Sparkles className="w-4 h-4" /> Clone Previous Week
            </Button>
          )}
          {hasExistingPlan && (
            <Button variant="outline" onClick={handleDelete} disabled={isDeleting} className="font-black h-12 px-6 uppercase shadow-sm gap-2 border-red-200 text-red-500 hover:bg-red-50">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || isSaving} className="font-black h-12 px-6 uppercase shadow-sm gap-2 border-primary/20 text-primary">
            {isSavingDraft ? 'Saving Draft...' : 'Save Draft'}
          </Button>
          <Button onClick={savePlan} disabled={isSaving || isSavingDraft} className="bg-primary font-black h-12 px-8 uppercase shadow-xl gap-2 text-white">
            {isSaving ? 'Synchronising...' : hasExistingPlan ? 'Update Plan' : 'Commit Weekly Plan'}
          </Button>
        </div>
      </header>

      {/* Tallies and SMART Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monthly SMART Goal Panel */}
        <Card className="border border-slate-200 shadow-md lg:col-span-2">
          <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-accent">
              <Star className="w-4 h-4" />
              Monthly SMART Goal ({format(new Date(), 'MMMM yyyy')})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {hasGoalForMonth ? (
              <div className="bg-accent/5 border border-accent/20 rounded-2xl p-5 space-y-3">
                <Badge className="bg-accent text-white uppercase font-black text-[9px]">Submitted Goal</Badge>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-800">
                  <p>🎯 <span className="text-muted-foreground uppercase text-[10px] ml-1">Specific:</span> {smartGoal.specific || 'None'}</p>
                  <p>📊 <span className="text-muted-foreground uppercase text-[10px] ml-1">Measurable:</span> {smartGoal.measurable || 'None'}</p>
                  <p>💪 <span className="text-muted-foreground uppercase text-[10px] ml-1">Achievable:</span> {smartGoal.achievable || 'None'}</p>
                  <p>🔄 <span className="text-muted-foreground uppercase text-[10px] ml-1">Relevant:</span> {smartGoal.relevant || 'None'}</p>
                  <p>⏰ <span className="text-muted-foreground uppercase text-[10px] ml-1">Timebound:</span> {smartGoal.timebound || 'None'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setHasGoalForMonth(false)} className="mt-2 text-[10px] font-black uppercase rounded-lg">
                  Edit Goal
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Specific Outcome</Label>
                    <Input placeholder="What exactly is the target?" value={smartGoal.specific} onChange={e => setSmartGoal({...smartGoal, specific: e.target.value})} className="h-9 text-xs font-semibold rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Success Metric</Label>
                    <Input placeholder="How will you measure it?" value={smartGoal.measurable} onChange={e => setSmartGoal({...smartGoal, measurable: e.target.value})} className="h-9 text-xs font-semibold rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Achievable Steps</Label>
                    <Input placeholder="How is this realistic?" value={smartGoal.achievable} onChange={e => setSmartGoal({...smartGoal, achievable: e.target.value})} className="h-9 text-xs font-semibold rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Relevance</Label>
                    <Input placeholder="Why now for the territory?" value={smartGoal.relevant} onChange={e => setSmartGoal({...smartGoal, relevant: e.target.value})} className="h-9 text-xs font-semibold rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Timebound Deadline</Label>
                    <Input placeholder="When is the deadline?" value={smartGoal.timebound} onChange={e => setSmartGoal({...smartGoal, timebound: e.target.value})} className="h-9 text-xs font-semibold rounded-xl" />
                  </div>
                </div>
                <Button onClick={handleSaveSmartGoal} disabled={submittingGoal} className="bg-accent hover:bg-accent/90 text-white font-black text-xs uppercase rounded-xl h-10 px-5">
                  Submit SMART Goal
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tallies Card */}
        <Card className="border border-slate-200 shadow-md">
          <CardHeader className="bg-slate-900 text-white py-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Strategic Tallies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Map className="w-4 h-4" /></div>
                <span className="text-xs font-black uppercase text-slate-700">Whitespace Plans</span>
              </div>
              <span className="text-lg font-black text-slate-900">{wsPlans?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><FileText className="w-4 h-4" /></div>
                <span className="text-xs font-black uppercase text-slate-700">Active Call Plans</span>
              </div>
              <span className="text-lg font-black text-slate-900">{callPlans?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Focus and Stage Pipeline Grid */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Left Side: Targets & Focus Commitments */}
        <div className="space-y-6">
          <Card className="border shadow-md">
            <CardHeader><CardTitle className="text-lg font-black flex items-center gap-2">{userRole === 'BDM' ? <Rocket className="w-5 h-5 text-accent" /> : <Shield className="w-5 h-5 text-accent" />} Focus Accounts</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {focusAccounts.map((acc, idx) => (
                <div key={acc.accountId} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group">
                  <div className="flex justify-between items-center gap-2">
                     <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Input 
                            list="uploaded-accounts"
                            placeholder="Account Name..." 
                            value={acc.accountName} 
                            onChange={e => handleFocusAccountNameChange(idx, e.target.value)} 
                            className="h-10 text-xs font-bold flex-1" 
                          />
                          <button
                            onClick={() => openSalesforceSearch(acc.accountName)}
                            className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-accent hover:border-accent rounded-xl shadow-sm transition-all shrink-0"
                            title="Open Salesforce Account"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                        {acc.accountName && (
                          <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); openSalesforceSearch(acc.accountName); }}
                            className="text-[9px] text-accent font-black hover:underline tracking-wider uppercase ml-1 block w-fit"
                          >
                            SF Account Link
                          </a>
                        )}
                      </div>
                     <Button variant="ghost" size="icon" onClick={() => setFocusAccounts(focusAccounts.filter(f => f.accountId !== acc.accountId))} className="text-red-300 hover:text-red-600 h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">Action Type</label>
                      <Select value={acc.actionType} onValueChange={v => { const n = [...focusAccounts]; n[idx].actionType = v; setFocusAccounts(n); }}>
                        <SelectTrigger className="h-9 text-[10px] font-black uppercase"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map(t => (
                            <SelectItem key={t} value={t} className="text-[10px] font-black">{t.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">EAV ($)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                        <Input type="number" placeholder="Value..." value={acc.eav || ''} onChange={e => { const n = [...focusAccounts]; n[idx].eav = parseFloat(e.target.value) || 0; setFocusAccounts(n); }} className="h-9 pl-6 text-[10px] font-bold" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">About Account / Opportunity Context</label>
                    <Textarea placeholder="Context, history, and strategic intent..." value={acc.aboutAccount} onChange={e => { const n = [...focusAccounts]; n[idx].aboutAccount = e.target.value; setFocusAccounts(n); }} className="min-h-[80px] text-[10px] font-medium leading-relaxed" />
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addFocusAccount} className="w-full h-12 border-dashed border-2 rounded-xl font-black uppercase text-[10px] text-muted-foreground hover:bg-slate-50">+ Add Target Account</Button>
            </CardContent>
          </Card>

          <Card className="border shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-black">Commitments for Week Ahead</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setActionPlan(['', '', '', '', '']);
                  toast({ title: "Commitments Cleared", description: "All actions have been reset to blank." });
                }}
                className="h-8 px-3 text-red-500 hover:text-red-700 hover:bg-red-50 font-bold text-[10px] uppercase tracking-wider"
              >
                Clear All
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3">
              {actionPlan.map((action, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <Badge variant="outline" className="w-20 justify-center py-2 font-black text-[10px] border-slate-200 shrink-0">Action {idx + 1}</Badge>
                  <div className="flex-1 relative">
                    <Textarea 
                      placeholder="Tactical focus..." 
                      value={action} 
                      onChange={e => updateAction(idx, e.target.value)} 
                      className="min-h-[60px] text-[10px] font-bold rounded-xl shadow-inner pr-8" 
                    />
                    {idx >= 5 && (
                      <button 
                        onClick={() => removeAction(idx)}
                        className="absolute top-2 right-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <Button 
                variant="outline" 
                onClick={addAction} 
                className="mt-2 h-10 border-dashed border-2 rounded-xl font-black uppercase text-[10px] text-muted-foreground hover:bg-slate-50 gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add Additional Action
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Salesforce Pipeline swimlanes */}
        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between py-5">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Salesforce Opportunities
                </CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Matched by Account &amp; Owner Name</p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {SALES_STAGES.map(stage => {
                const list = groupedPipeline[stage] || [];
                return (
                  <div key={stage} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 bg-slate-100 px-3 py-1 rounded-full border">
                        {stage === "--None--" ? "UNASSIGNED STAGE" : stage.toUpperCase()}
                      </h4>
                      <Badge className="bg-slate-200 text-slate-800 text-[10px] font-black">{list.length} Opportunities</Badge>
                    </div>

                    {list.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground font-medium italic pl-4">No opportunities in this stage.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                        {list.map(opp => (
                          <div key={opp.id} className="p-3 bg-slate-50 border rounded-2xl space-y-1.5 hover:border-accent/40 transition-all group relative">
                            <div className="flex justify-between items-start gap-1">
                              <div className="space-y-0.5">
                                <a 
                                  href="#" 
                                  onClick={(e) => { e.preventDefault(); openSalesforceSearch(opp.pipeline); }}
                                  className="text-xs font-bold text-slate-900 uppercase hover:text-accent hover:underline truncate max-w-[180px] block"
                                  title="Open Account in Salesforce"
                                >
                                  {opp.pipeline}
                                </a>
                                <a 
                                  href="#" 
                                  onClick={(e) => { e.preventDefault(); openSalesforceSearch(opp.opportunityName || opp.pipeline, opp.salesforceId); }}
                                  className="text-[10px] text-muted-foreground font-medium hover:text-accent hover:underline truncate max-w-[180px] block"
                                  title="Open Opportunity in Salesforce"
                                >
                                  {opp.opportunityName || "Unnamed Opportunity"}
                                </a>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => openSalesforceSearch(opp.opportunityName || opp.pipeline, opp.salesforceId)}
                                  className="p-1 bg-white border text-slate-400 hover:text-accent rounded-lg shadow-sm"
                                  title="View Opportunity in Salesforce"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <Button size="sm" variant="outline" onClick={() => appendToFocusAccounts(opp)} className="h-6 px-1.5 text-[9px] font-black bg-white hover:bg-accent/10 border-slate-200 text-slate-700 hover:text-accent" title="Add to Focus Accounts">
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-semibold text-slate-600">
                              <span>EAV: <strong>${(opp.value || 0).toLocaleString()}</strong></span>
                              <span>Probability: <strong>{opp.probability || 0}%</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Roadblocks & Support */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
           <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-2"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Roadblocks & Account Barriers</Label>
           <Textarea 
             placeholder="What is slowing down your deals? Competitor activity, internal delays, etc..." 
             value={roadblocks} 
             onChange={e => setRoadblocks(e.target.value)} 
             className="min-h-[120px] rounded-3xl border-slate-200 bg-white p-6 shadow-inner text-xs font-bold leading-relaxed" 
           />
        </div>
        <div className="space-y-4">
           <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-2"><LifeBuoy className="w-3.5 h-3.5 text-blue-500" /> Additional Management Support</Label>
           <Textarea 
             placeholder="How can leadership assist this week? Escalations, joint calls, pricing approvals..." 
             value={supportNeeded} 
             onChange={e => setSupportNeeded(e.target.value)} 
             className="min-h-[120px] rounded-3xl border-slate-200 bg-white p-6 shadow-inner text-xs font-bold leading-relaxed" 
           />
        </div>
      </div>
    </div>
  );
}