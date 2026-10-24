"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Trash2, FileCheck, 
  Rocket, Loader2, Award, TrendingUp, 
  ClipboardCheck, Phone, CalendarCheck, Target,
  Clock, ArrowRight, AlertTriangle, LifeBuoy, CheckCircle2, XCircle,
  ExternalLink, Sparkles, PlusCircle, Shield
} from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getWeekForDate, formatEAV, cn, openSalesforceSearch, getNextWeekKey } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';

const SALES_STAGES = [
  "Develop",
  "Propose",
  "Negotiating",
  "Finalise",
  "Pending Trade",
  "Closed Won",
  "Closed Lost"
];

export function BDMWeeklySubmission({ userId, userName }: { userId: string; userName: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const currentWeek = getCurrentWeek();

  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [signedDeals, setSignedDeals] = useState<any[]>([]);
  const [newBusiness, setNewBusiness] = useState<any[]>([]);
  const [stillWorking, setStillWorking] = useState<any[]>([]);
  
  // High-Level Narrative (Week That Was)
  const [notes, setNotes] = useState('');

  // Monday Planning carry-over
  const [roadblocks, setRoadblocks] = useState('');
  const [supportNeeded, setSupportNeeded] = useState('');
  const [commitments, setCommitments] = useState<any[]>([]);
  const [focusAccounts, setFocusAccounts] = useState<any[]>([]);

  // Fetch current week's activity counts
  const progressRef = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return doc(db, 'weeklyProgress', `${userId}_${currentWeek}`);
  }, [db, userId, currentWeek]);
  const { data: progress } = useDoc(progressRef);

  // Salesforce pipeline data (latest deduplicated state)
  const { pipelineReviews: pipelineData } = usePipelineData();

  const totalEAV = useMemo(() => {
    const opps = opportunities.reduce((s: number, i: any) => s + (parseFloat(i.eav) || 0), 0);
    const signed = signedDeals.reduce((s: number, i: any) => s + (parseFloat(i.eav) || 0), 0);
    const business = newBusiness.reduce((s: number, i: any) => s + (parseFloat(i.eav) || 0), 0);
    const working = stillWorking.reduce((s: number, i: any) => s + (parseFloat(i.eav) || 0), 0);
    return opps + signed + business + working;
  }, [opportunities, signedDeals, newBusiness, stillWorking]);

  // Load existing data if available
  useEffect(() => {
    async function loadExisting() {
      if (!db || !userId) return;
      const reportRef = doc(db, 'weeklyReports', `${userId}_${currentWeek}`);
      const snap = await getDoc(reportRef);
      let loadedWorking: any[] = [];
      let mondayData: any = null;

      try {
        const commitRef = doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`);
        const commitSnap = await getDoc(commitRef);
        if (commitSnap.exists()) {
          mondayData = commitSnap.data();
        }
      } catch (err) {
        console.error("Failed to load Monday commitments", err);
      }

      if (snap.exists()) {
        const data = snap.data();
        setNotes(data.weeklyNotes || '');
        setRoadblocks(data.roadblocks !== undefined ? data.roadblocks : (mondayData?.roadblocks || ''));
        setSupportNeeded(data.supportNeeded !== undefined ? data.supportNeeded : (mondayData?.supportNeeded || ''));
        
        if (data.commitments) setCommitments(data.commitments);
        else if (mondayData?.actionPlan) {
          setCommitments(mondayData.actionPlan.filter((a: string) => a.trim()).map((a: string) => ({ id: crypto.randomUUID(), text: a, status: 'NOT_COMPLETED', update: '', reason: '' })));
        }

        if (data.focusAccounts) {
          setFocusAccounts(data.focusAccounts.map((f: any) => ({
            ...f,
            status: f.status === 'COMPLETED' ? 'WON' : (f.status === 'NOT_COMPLETED' ? 'WORKING' : (f.status || 'WORKING')),
            update: f.update || ''
          })));
        } else if (mondayData?.focusAccounts) {
          setFocusAccounts(mondayData.focusAccounts.map((f: any) => ({ ...f, status: 'WORKING', update: '' })));
        }

        if (Array.isArray(data.stillWorkingAccounts)) {
          loadedWorking = data.stillWorkingAccounts;
        }
      } else {
        if (mondayData) {
          setRoadblocks(mondayData.roadblocks || '');
          setSupportNeeded(mondayData.supportNeeded || '');
          if (mondayData.actionPlan) {
            setCommitments(mondayData.actionPlan.filter((a: string) => a.trim()).map((a: string) => ({ id: crypto.randomUUID(), text: a, status: 'NOT_COMPLETED', update: '', reason: '' })));
          }
          if (mondayData.focusAccounts) {
            setFocusAccounts(mondayData.focusAccounts.map((f: any) => ({ ...f, status: 'WORKING', update: '' })));
          }
        }
      }
      
      const oppsSnap = await getDocs(query(collection(db, 'opportunities'), where('userId', '==', userId), where('week', '==', currentWeek)));
      const oppsData = oppsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any));
      setOpportunities(oppsData);
      
      const signedSnap = await getDocs(query(collection(db, 'signedPaperwork'), where('userId', '==', userId), where('week', '==', currentWeek)));
      const signedData = signedSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any));
      setSignedDeals(signedData);

      const businessSnap = await getDocs(query(collection(db, 'newBusiness'), where('userId', '==', userId), where('week', '==', currentWeek)));
      const businessData = businessSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any));
      setNewBusiness(businessData);

      setStillWorking(loadedWorking);
    }
    loadExisting();
  }, [db, userId, currentWeek]);

  const addStillWorking = () => setStillWorking([...stillWorking, { id: crypto.randomUUID(), accountName: '', eav: 0, notes: '' }]);
  const addOpportunity = () => setOpportunities([...opportunities, { id: crypto.randomUUID(), accountName: '', eav: 0, stage: 'PROPOSAL', probability: 20 }]);
  const addSigned = () => setSignedDeals([...signedDeals, { id: crypto.randomUUID(), accountName: '', eav: 0, termMonths: 12 }]);
  const addBusiness = () => setNewBusiness([...newBusiness, { id: crypto.randomUUID(), accountName: '', eav: 0, assignedAE: '' }]);

  const moveToOpp = (item: any) => {
    setStillWorking(stillWorking.filter((w: any) => w.id !== item.id));
    setOpportunities([...opportunities, { id: item.id, accountName: item.accountName, eav: item.eav, stage: 'PROPOSAL', probability: 20 }]);
    toast({ title: "Moved to New Opps" });
  };

  const moveToWin = (item: any) => {
    setStillWorking(stillWorking.filter((w: any) => w.id !== item.id));
    setSignedDeals([...signedDeals, { id: item.id, accountName: item.accountName, eav: item.eav, termMonths: 12 }]);
    toast({ title: "Moved to Signed Win" });
  };

  const moveToLive = (item: any) => {
    setStillWorking(stillWorking.filter((w: any) => w.id !== item.id));
    setNewBusiness([...newBusiness, { id: item.id, accountName: item.accountName, eav: item.eav, assignedAE: '' }]);
    toast({ title: "Moved to Live Trading" });
  };

  const handleSaveDraft = async () => {
    if (!db || !userId) return;
    setIsSavingDraft(true);
    try {
      const summary = {
        totalEAV,
        newOpportunitiesCount: opportunities.length,
        signedPaperworkCount: signedDeals.length,
        newBusinessCount: newBusiness.length,
        callsMade: progress?.calls || 0,
        meetingsHeld: progress?.apps || 0,
        crmCalls: progress?.crmCalls || 0,
        crmApps: progress?.crmApps || 0
      };

      await setDoc(doc(db, 'weeklyReports', `${userId}_${currentWeek}`), {
        userId,
        userName,
        week: currentWeek,
        weeklyNotes: notes,
        roadblocks,
        supportNeeded,
        commitments,
        focusAccounts,
        stillWorkingAccounts: stillWorking,
        status: 'DRAFT',
        summary,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({ title: "Draft Saved", description: "Your Friday report draft is safely saved." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Save Draft Failed" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!db || !userId) return;
    setIsSubmitting(true);
    try {
      const summary = {
        totalEAV,
        newOpportunitiesCount: opportunities.length,
        signedPaperworkCount: signedDeals.length,
        newBusinessCount: newBusiness.length,
        callsMade: progress?.calls || 0,
        meetingsHeld: progress?.apps || 0,
        crmCalls: progress?.crmCalls || 0,
        crmApps: progress?.crmApps || 0
      };

      // 1. Save Friday Report to Firestore
      await setDoc(doc(db, 'weeklyReports', `${userId}_${currentWeek}`), {
        userId,
        userName,
        week: currentWeek,
        weeklyNotes: notes,
        roadblocks,
        supportNeeded,
        commitments,
        focusAccounts,
        stillWorkingAccounts: stillWorking,
        status: 'SUBMITTED',
        summary,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Rollover Uncompleted Commitments/Focus Accounts to Next Week Monday
      const nextWeek = getNextWeekKey(currentWeek);
      const nextWeekRef = doc(db, 'weeklyCommitments', `${userId}_${nextWeek}`);
      
      const nextWeekSnap = await getDoc(nextWeekRef);
      let nextWeekActionPlan: string[] = [];
      let nextWeekFocusAccounts: any[] = [];
      let nextWeekRoadblocks = "";
      let nextWeekSupport = "";
      let nextWeekKpiTargets = {};

      if (nextWeekSnap.exists()) {
        const nextWeekData = nextWeekSnap.data();
        nextWeekActionPlan = nextWeekData.actionPlan || [];
        nextWeekFocusAccounts = nextWeekData.focusAccounts || [];
        nextWeekRoadblocks = nextWeekData.roadblocks || "";
        nextWeekSupport = nextWeekData.supportNeeded || "";
        nextWeekKpiTargets = nextWeekData.kpiTargets || {};
      }

      // Roll over uncompleted weekly commitments
      const uncompletedCommitments = commitments.filter((c: any) => c.status !== 'COMPLETED');
      uncompletedCommitments.forEach((c: any) => {
        const cleanText = c.text.trim();
        if (!nextWeekActionPlan.some((action: string) => action.trim() === cleanText)) {
          const noteText = c.update ? ` (Update: ${c.update})` : "";
          nextWeekActionPlan.push(`${cleanText}${noteText}`);
        }
      });

      // Roll over uncompleted focus accounts (only if status is WORKING)
      const uncompletedFocusAccounts = focusAccounts.filter((f: any) => (f.status || 'WORKING') === 'WORKING');
      uncompletedFocusAccounts.forEach((f: any) => {
        const cleanName = f.accountName.toUpperCase().trim();
        const existsIdx = nextWeekFocusAccounts.findIndex((acc: any) => acc.accountName.toUpperCase().trim() === cleanName);
        
        let aboutText = f.aboutAccount || "";
        if (f.update) {
          aboutText += ` \n[Friday Rollover Note: ${f.update}]`;
        }

        if (existsIdx === -1) {
          nextWeekFocusAccounts.push({
            accountId: f.accountId || crypto.randomUUID(),
            accountName: f.accountName,
            actionType: f.actionType,
            eav: f.eav || 0,
            aboutAccount: aboutText
          });
        } else {
          nextWeekFocusAccounts[existsIdx].aboutAccount = 
            (nextWeekFocusAccounts[existsIdx].aboutAccount || "") + ` \n[Friday Rollover Note: ${f.update || "Continued focus"}]`;
        }
      });

      // Save/Merge rollover data into next week's Monday commitments doc
      await setDoc(nextWeekRef, {
        userId,
        week: nextWeek,
        actionPlan: nextWeekActionPlan,
        focusAccounts: nextWeekFocusAccounts,
        roadblocks: nextWeekRoadblocks,
        supportNeeded: nextWeekSupport,
        kpiTargets: nextWeekKpiTargets,
        status: 'DRAFT',
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({ title: "Friday Pack Submitted", description: "Report submitted and uncompleted items rolled over to next Monday." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Submission Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Salesforce URL helper
  const getSfAccountUrl = (accName: string) => `https://salesforce.com/lightning/r/Account/Search?q=${encodeURIComponent(accName)}`;
  const getSfOpportunityUrl = (id?: string) => id ? `https://salesforce.com/lightning/r/Opportunity/${id}/view` : '#';

  // Quick action: append data to weekly report narrative notes
  const appendToReportNotes = (text: string) => {
    const divider = notes ? "\n" : "";
    setNotes((prev: string) => prev + divider + text);
    toast({ title: "Added to Narrative Notes", description: "Summary logged." });
  };

  // Segregate Salesforce accounts (bare accounts) vs active opportunities
  const crmAccounts = useMemo(() => {
    return pipelineData?.filter((r: any) => r.isBareAccount) || [];
  }, [pipelineData]);

  const crmOpportunities = useMemo(() => {
    return pipelineData?.filter((r: any) => !r.isBareAccount) || [];
  }, [pipelineData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col lg:flex-row justify-between lg:items-center bg-panel p-8 rounded-[2rem] text-panel-foreground shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5"><TrendingUp className="w-64 h-64" /></div>
        <div className="relative z-10 space-y-2">
           <Badge className="bg-accent text-accent-foreground font-semibold text-xs px-3 mb-2">Friday Synthesis Mode</Badge>
           <h2 className="text-3xl font-bold tracking-tighter leading-none">The Week That Was</h2>
           <p className="text-xs font-bold text-panel-foreground/60 uppercase tracking-wide">Performance Validation • Week {currentWeek.split('-')[1]}</p>
        </div>
        <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full lg:w-auto justify-end">
           <div className="text-right hidden sm:block mr-2">
              <p className="text-xs font-semibold text-accent">Total Combined EAV</p>
              <p className="text-3xl font-black tabular-nums">{formatEAV(totalEAV)}</p>
           </div>
           <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting} className="font-semibold h-16 px-6 rounded-2xl shadow-sm gap-2 border-panel-foreground/15 bg-panel/90 text-panel-foreground/90 hover:bg-panel/90 hover:text-panel-foreground text-xs w-full sm:w-auto">
             {isSavingDraft ? <Loader2 className="animate-spin w-5 h-5" /> : 'SAVE DRAFT'}
           </Button>
           <Button onClick={handleSubmit} disabled={isSubmitting || isSavingDraft} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-16 px-8 rounded-2xl shadow-xl gap-3 text-xs w-full sm:w-auto">
             {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />} FINALISE FRIDAY PACK
           </Button>
        </div>
      </header>

      {/* Activity Tallies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-info-soft text-info flex items-center justify-center shadow-sm">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Calls Completed (CRM Imported)</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-black tabular-nums text-primary">{progress?.crmCalls || 0}</p>
                {progress?.calls !== undefined && <p className="text-xs font-bold text-muted-foreground uppercase">Man: {progress.calls}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-success-soft text-success flex items-center justify-center shadow-sm">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Appointments Held (CRM Imported)</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-black tabular-nums text-primary">{progress?.crmApps || 0}</p>
                {progress?.apps !== undefined && <p className="text-xs font-bold text-muted-foreground uppercase">Man: {progress.apps}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monday Commitments carries */}
      <div className="space-y-6 bg-secondary/30 p-6 rounded-3xl border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Monday Planning Review</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Roadblocks & Account Barriers
            </Label>
            <Textarea 
              placeholder="Any roadblocks to highlight?" 
              value={roadblocks} 
              onChange={e => setRoadblocks(e.target.value)} 
              className="min-h-[100px] rounded-2xl border-border bg-card p-4 shadow-sm text-xs" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
              <LifeBuoy className="w-3.5 h-3.5 text-info" /> Additional Management Support
            </Label>
            <Textarea 
              placeholder="What support is needed?" 
              value={supportNeeded} 
              onChange={e => setSupportNeeded(e.target.value)} 
              className="min-h-[100px] rounded-2xl border-border bg-card p-4 shadow-sm text-xs" 
            />
          </div>
        </div>

        {commitments.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-xs font-semibold text-muted-foreground">Commitments for the Week Ahead</Label>
            <div className="space-y-3">
              {commitments.map((c: any, idx: number) => {
                const isCompleted = c.status === 'COMPLETED';
                return (
                  <div key={c.id} className={cn("p-4 bg-card rounded-2xl border transition-all duration-300 shadow-sm space-y-3", isCompleted ? "border-success/15 bg-success-soft/20" : "border-border")}>
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => {
                          const n = [...commitments];
                          n[idx].status = e.target.checked ? 'COMPLETED' : 'NOT_COMPLETED';
                          setCommitments(n);
                        }}
                        className="w-5 h-5 mt-0.5 accent-success-fill rounded cursor-pointer border-border"
                        id={`commit-check-${c.id}`}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`commit-check-${c.id}`} className={cn("text-sm font-bold cursor-pointer block select-none", isCompleted ? "text-muted-foreground line-through" : "text-foreground/85")}>
                            {c.text}
                          </label>
                          <Badge variant="outline" className={cn("text-xs font-semibold shrink-0", isCompleted ? "bg-success-soft text-success-ink border-none" : "bg-secondary text-foreground/75 border-none")}>
                            {isCompleted ? 'Completed' : 'In Progress'}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                          {isCompleted ? "✓ Completed: will NOT roll over to next Monday." : "⏱ In Progress: will roll over to next Monday's plan."}
                        </p>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-muted-foreground">Commentary / Reason for Rollover</span>
                          <Input
                            placeholder="Enter update or reason for rollover..."
                            value={c.update || ''}
                            onChange={(e) => {
                              const n = [...commitments];
                              n[idx].update = e.target.value;
                              setCommitments(n);
                            }}
                            className="h-8 text-xs rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {focusAccounts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <Label className="text-xs font-semibold text-muted-foreground">Focus Accounts Review</Label>
            <div className="space-y-3">
              {focusAccounts.map((f: any, idx: number) => {
                const currentStatus = f.status || 'WORKING';
                return (
                  <div key={f.accountId || idx} className={cn(
                    "p-4 bg-card rounded-2xl border shadow-sm space-y-3 transition-all duration-300", 
                    currentStatus === 'WON' && "border-success/15 bg-success-soft/20",
                    currentStatus === 'LOST' && "border-destructive/15 bg-danger-soft/20",
                    currentStatus === 'WORKING' && "border-border"
                  )}>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className={cn(
                            "text-sm font-bold block select-none", 
                            currentStatus === 'WON' && "text-success-ink",
                            currentStatus === 'LOST' && "text-destructive line-through",
                            currentStatus === 'WORKING' && "text-foreground"
                          )}>
                            {f.accountName}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs font-semibold bg-secondary/60">{f.actionType}</Badge>
                            <span className="text-xs font-semibold text-muted-foreground">${(f.eav || 0).toLocaleString()} EAV</span>
                          </div>
                        </div>

                        {/* Working / Won / Lost Selector */}
                        <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const n = [...focusAccounts];
                              n[idx].status = 'WORKING';
                              setFocusAccounts(n);
                            }}
                            className={cn(
                              "text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all",
                              currentStatus === 'WORKING' 
                                ? "bg-card text-foreground shadow-sm" 
                                : "text-muted-foreground hover:text-foreground/75"
                            )}
                          >
                            Working
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const n = [...focusAccounts];
                              n[idx].status = 'WON';
                              setFocusAccounts(n);
                            }}
                            className={cn(
                              "text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all",
                              currentStatus === 'WON' 
                                ? "bg-success-fill text-success-foreground shadow-sm" 
                                : "text-muted-foreground hover:text-success"
                            )}
                          >
                            Won
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const n = [...focusAccounts];
                              n[idx].status = 'LOST';
                              setFocusAccounts(n);
                            }}
                            className={cn(
                              "text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all",
                              currentStatus === 'LOST' 
                                ? "bg-destructive text-destructive-foreground shadow-sm" 
                                : "text-muted-foreground hover:text-destructive"
                            )}
                          >
                            Lost
                          </button>
                        </div>
                      </div>
                      
                      {f.aboutAccount && (
                        <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-border pl-2">{f.aboutAccount}</p>
                      )}
                      
                      <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        {currentStatus === 'WORKING' && "⏱ Still Working: will roll over to next Monday's plan."}
                        {currentStatus === 'WON' && "🎉 Won! Account is archived and will NOT roll over."}
                        {currentStatus === 'LOST' && "❌ Lost. Account is archived and will NOT roll over."}
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-muted-foreground">Progress Update / Commentary</span>
                        <Input
                          placeholder="Enter update or reason for rollover..."
                          value={f.update || ''}
                          onChange={(e) => {
                            const n = [...focusAccounts];
                            n[idx].update = e.target.value;
                            setFocusAccounts(n);
                          }}
                          className="h-8 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Salesforce pipeline visualizer */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Pipeline of Opportunities */}
        <Card className="border border-border shadow-xl bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-panel text-panel-foreground py-5">
            <CardTitle className="text-xs font-bold text-accent flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Pipeline of Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {crmOpportunities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No Salesforce Opportunities imported for this week.</p>
            ) : (
              crmOpportunities.map((opp: any) => (
                <div key={opp.id} className="p-4 bg-secondary/60 border rounded-2xl hover:border-accent/40 transition-all space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); openSalesforceSearch(opp.pipeline); }}
                        className="text-xs font-semibold text-foreground hover:text-accent hover:underline truncate block"
                        title="Open Account in Salesforce"
                      >
                        {opp.pipeline}
                      </a>
                      <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); openSalesforceSearch(opp.opportunityName || opp.pipeline, opp.salesforceId); }}
                        className="text-xs text-muted-foreground font-bold uppercase hover:text-accent hover:underline truncate block"
                        title="Open Opportunity in Salesforce"
                      >
                        {opp.opportunityName || "Unnamed Opportunity"}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openSalesforceSearch(opp.opportunityName || opp.pipeline, opp.salesforceId)}
                        className="p-2 bg-card border text-muted-foreground hover:text-accent rounded-xl shadow-sm transition-all"
                        title="Open Salesforce Opportunity"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <Button size="sm" variant="outline" onClick={() => appendToReportNotes(`[Opp Progressed: ${opp.pipeline} - Stage: ${opp.stage} - Value: $${opp.value?.toLocaleString() || 0}]`)} className="h-8 px-2 text-xs font-semibold hover:bg-accent/10 text-foreground/85 hover:text-accent rounded-xl shadow-sm transition-all">
                        <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Note
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground pt-1 border-t border-border/50">
                    <span className="bg-warning-soft text-warning-ink px-2 py-0.5 rounded-full text-xs font-semibold">{opp.stage?.toUpperCase()}</span>
                    <span>Value: <strong>${(opp.value || 0).toLocaleString()}</strong></span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Narrative notes */}
      <div className="space-y-4">
         <div className="flex justify-between items-center px-2">
           <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
             <Award className="w-3.5 h-3.5" /> Performance Narrative (The Week That Was)
           </Label>
           <span className={cn("text-xs font-bold", notes.length > 4000 ? "text-destructive" : "text-muted-foreground")}>
             {notes.length} / 5000 characters
           </span>
         </div>
         <Textarea 
           placeholder="Document high-level wins and strategic shifts achieved this week..." 
           value={notes} 
           onChange={e => setNotes(e.target.value.substring(0, 5000))} 
           className="min-h-[200px] rounded-[2rem] border-border bg-card p-8 shadow-inner text-sm font-medium leading-relaxed" 
         />
      </div>
    </div>
  );
}