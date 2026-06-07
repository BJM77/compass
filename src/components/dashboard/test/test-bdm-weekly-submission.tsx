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

const SALES_STAGES = [
  "Develop",
  "Propose",
  "Negotiating",
  "Finalise",
  "Pending Trade",
  "Closed Won",
  "Closed Lost"
];

export function TestBDMWeeklySubmission({ userId, userName }: { userId: string; userName: string }) {
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

  // Salesforce pipeline query
  const pipelineQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'pipelineReviews'), where('userId', '==', userId), where('week', '==', currentWeek));
  }, [db, userId, currentWeek]);
  const { data: pipelineData } = useCollection(pipelineQuery);

  const totalEAV = useMemo(() => {
    const opps = opportunities.reduce((s, i) => s + (parseFloat(i.eav) || 0), 0);
    const signed = signedDeals.reduce((s, i) => s + (parseFloat(i.eav) || 0), 0);
    const business = newBusiness.reduce((s, i) => s + (parseFloat(i.eav) || 0), 0);
    const working = stillWorking.reduce((s, i) => s + (parseFloat(i.eav) || 0), 0);
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

        if (data.focusAccounts) setFocusAccounts(data.focusAccounts);
        else if (mondayData?.focusAccounts) {
          setFocusAccounts(mondayData.focusAccounts.map((f: any) => ({ ...f, status: 'NOT_COMPLETED', update: '' })));
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
            setFocusAccounts(mondayData.focusAccounts.map((f: any) => ({ ...f, status: 'NOT_COMPLETED', update: '' })));
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
    setStillWorking(stillWorking.filter(w => w.id !== item.id));
    setOpportunities([...opportunities, { id: item.id, accountName: item.accountName, eav: item.eav, stage: 'PROPOSAL', probability: 20 }]);
    toast({ title: "Moved to New Opps" });
  };

  const moveToWin = (item: any) => {
    setStillWorking(stillWorking.filter(w => w.id !== item.id));
    setSignedDeals([...signedDeals, { id: item.id, accountName: item.accountName, eav: item.eav, termMonths: 12 }]);
    toast({ title: "Moved to Signed Win" });
  };

  const moveToLive = (item: any) => {
    setStillWorking(stillWorking.filter(w => w.id !== item.id));
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

      // Roll over uncompleted focus accounts
      const uncompletedFocusAccounts = focusAccounts.filter((f: any) => f.status !== 'COMPLETED');
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
    setNotes(prev => prev + divider + text);
    toast({ title: "Added to Narrative Notes", description: "Summary logged." });
  };

  // Segregate Salesforce accounts (bare accounts) vs active opportunities
  const crmAccounts = useMemo(() => {
    return pipelineData?.filter(r => r.isBareAccount) || [];
  }, [pipelineData]);

  const crmOpportunities = useMemo(() => {
    return pipelineData?.filter(r => !r.isBareAccount) || [];
  }, [pipelineData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col lg:flex-row justify-between lg:items-center bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5"><TrendingUp className="w-64 h-64" /></div>
        <div className="relative z-10 space-y-2">
           <Badge className="bg-accent text-white font-black text-[9px] uppercase tracking-widest px-3 mb-2">Friday Synthesis Mode</Badge>
           <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">The Week That Was</h2>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Performance Validation • Week {currentWeek.split('-')[1]}</p>
        </div>
        <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full lg:w-auto justify-end">
           <div className="text-right hidden sm:block mr-2">
              <p className="text-[10px] font-black text-accent uppercase tracking-widest">Total Combined EAV</p>
              <p className="text-3xl font-black">{formatEAV(totalEAV)}</p>
           </div>
           <Button variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || isSubmitting} className="font-black h-16 px-6 rounded-2xl shadow-sm gap-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs w-full sm:w-auto">
             {isSavingDraft ? <Loader2 className="animate-spin w-5 h-5" /> : 'SAVE DRAFT'}
           </Button>
           <Button onClick={handleSubmit} disabled={isSubmitting || isSavingDraft} className="bg-accent hover:bg-accent/90 text-white font-black h-16 px-8 rounded-2xl shadow-xl gap-3 text-xs w-full sm:w-auto">
             {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />} FINALISE FRIDAY PACK
           </Button>
        </div>
      </header>

      {/* Activity Tallies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Calls Completed (CRM Imported)</p>
              <p className="text-2xl font-black text-primary">{progress?.crmCalls || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Appointments Held (CRM Imported)</p>
              <p className="text-2xl font-black text-primary">{progress?.crmApps || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monday Commitments carries */}
      <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Monday Planning Review</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Roadblocks & Account Barriers
            </Label>
            <Textarea 
              placeholder="Any roadblocks to highlight?" 
              value={roadblocks} 
              onChange={e => setRoadblocks(e.target.value)} 
              className="min-h-[100px] rounded-2xl border-slate-200 bg-white p-4 shadow-sm text-xs" 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
              <LifeBuoy className="w-3.5 h-3.5 text-blue-500" /> Additional Management Support
            </Label>
            <Textarea 
              placeholder="What support is needed?" 
              value={supportNeeded} 
              onChange={e => setSupportNeeded(e.target.value)} 
              className="min-h-[100px] rounded-2xl border-slate-200 bg-white p-4 shadow-sm text-xs" 
            />
          </div>
        </div>

        {commitments.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Commitments for the Week Ahead</Label>
            <div className="space-y-3">
              {commitments.map((c, idx) => {
                const isCompleted = c.status === 'COMPLETED';
                return (
                  <div key={c.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-3">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => {
                          const n = [...commitments];
                          n[idx].status = e.target.checked ? 'COMPLETED' : 'NOT_COMPLETED';
                          setCommitments(n);
                        }}
                        className="w-5 h-5 mt-0.5 accent-emerald-600 rounded cursor-pointer border-slate-300"
                        id={`commit-check-${c.id}`}
                      />
                      <div className="flex-1 space-y-2">
                        <label htmlFor={`commit-check-${c.id}`} className="text-sm font-bold text-slate-700 cursor-pointer block select-none">
                          {c.text}
                        </label>
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-muted-foreground">Commentary / Reason for Rollover</span>
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
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Focus Accounts Review</Label>
            <div className="space-y-3">
              {focusAccounts.map((f, idx) => {
                const isCompleted = f.status === 'COMPLETED';
                return (
                  <div key={f.accountId || idx} className="p-4 bg-white rounded-2xl border shadow-sm space-y-3">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => {
                          const n = [...focusAccounts];
                          n[idx].status = e.target.checked ? 'COMPLETED' : 'NOT_COMPLETED';
                          setFocusAccounts(n);
                        }}
                        className="w-5 h-5 mt-0.5 accent-emerald-600 rounded cursor-pointer border-slate-300"
                        id={`focus-check-${f.accountId || idx}`}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label htmlFor={`focus-check-${f.accountId || idx}`} className="text-sm font-bold text-slate-700 cursor-pointer block select-none font-sans">
                            {f.accountName}
                          </label>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-black uppercase">{f.actionType}</Badge>
                            <span className="text-[10px] font-black text-emerald-600">${(f.eav || 0).toLocaleString()} EAV</span>
                          </div>
                        </div>
                        {f.aboutAccount && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed italic">{f.aboutAccount}</p>
                        )}
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase text-muted-foreground">Progress Update / Commentary</span>
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Salesforce pipeline visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Pipeline of Accounts */}
        <Card className="border border-slate-200 shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white py-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Pipeline of Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {crmAccounts.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">No Salesforce Accounts imported for this week.</p>
            ) : (
              crmAccounts.map((acc: any) => (
                <div key={acc.id} className="p-4 bg-slate-50 border rounded-2xl hover:border-accent/40 transition-all flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); openSalesforceSearch(acc.pipeline); }}
                      className="text-xs font-black text-slate-800 uppercase hover:text-accent hover:underline truncate block"
                      title="Open Account in Salesforce"
                    >
                      {acc.pipeline}
                    </a>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Business Unit: {acc.businessUnit || 'FLEX'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openSalesforceSearch(acc.pipeline)}
                      className="p-2 bg-white border text-slate-400 hover:text-accent rounded-xl shadow-sm transition-all"
                      title="Open Salesforce Account"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <Button size="sm" variant="outline" onClick={() => appendToReportNotes(`[Account Profile: ${acc.pipeline} - YTD: $${acc.currentRevenue?.toLocaleString() || 0}]`)} className="h-8 px-2 text-[10px] font-black hover:bg-accent/10 text-slate-700 hover:text-accent rounded-xl shadow-sm transition-all">
                      <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Note
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pipeline of Opportunities */}
        <Card className="border border-slate-200 shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white py-5">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Pipeline of Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {crmOpportunities.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">No Salesforce Opportunities imported for this week.</p>
            ) : (
              crmOpportunities.map((opp: any) => (
                <div key={opp.id} className="p-4 bg-slate-50 border rounded-2xl hover:border-accent/40 transition-all space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5">
                      <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); openSalesforceSearch(opp.pipeline); }}
                        className="text-xs font-black text-slate-800 uppercase hover:text-accent hover:underline truncate block"
                        title="Open Account in Salesforce"
                      >
                        {opp.pipeline}
                      </a>
                      <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); openSalesforceSearch(opp.opportunityName || opp.pipeline, opp.salesforceId); }}
                        className="text-[9px] text-slate-400 font-bold uppercase hover:text-accent hover:underline truncate block"
                        title="Open Opportunity in Salesforce"
                      >
                        {opp.opportunityName || "Unnamed Opportunity"}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openSalesforceSearch(opp.opportunityName || opp.pipeline, opp.salesforceId)}
                        className="p-2 bg-white border text-slate-400 hover:text-accent rounded-xl shadow-sm transition-all"
                        title="Open Salesforce Opportunity"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <Button size="sm" variant="outline" onClick={() => appendToReportNotes(`[Opp Progressed: ${opp.pipeline} - Stage: ${opp.stage} - Value: $${opp.value?.toLocaleString() || 0}]`)} className="h-8 px-2 text-[10px] font-black hover:bg-accent/10 text-slate-700 hover:text-accent rounded-xl shadow-sm transition-all">
                        <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Note
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 pt-1 border-t border-slate-200/50">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[9px] font-black">{opp.stage?.toUpperCase()}</span>
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
           <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
             <Award className="w-3.5 h-3.5" /> Performance Narrative (The Week That Was)
           </Label>
           <span className={cn("text-[9px] font-bold", notes.length > 4000 ? "text-red-500" : "text-muted-foreground")}>
             {notes.length} / 5000 characters
           </span>
         </div>
         <Textarea 
           placeholder="Document high-level wins and strategic shifts achieved this week..." 
           value={notes} 
           onChange={e => setNotes(e.target.value.substring(0, 5000))} 
           className="min-h-[200px] rounded-[2rem] border-slate-200 bg-white p-8 shadow-inner text-sm font-medium leading-relaxed" 
         />
      </div>
    </div>
  );
}