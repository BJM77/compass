"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, writeBatch, doc, serverTimestamp, getDoc, getDocs, query, where } from 'firebase/firestore';
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
  Clock, ArrowRight, AlertTriangle, LifeBuoy, CheckCircle2, XCircle
} from 'lucide-react';
import { format, addWeeks } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getWeekForDate, formatEAV, cn } from '@/lib/utils';

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
          setCommitments(mondayData.actionPlan.filter((a: string) => a.trim()).map((a: string) => ({ id: crypto.randomUUID(), text: a, status: '', reason: '' })));
        }

        if (data.focusAccounts) setFocusAccounts(data.focusAccounts);
        else if (mondayData?.focusAccounts) {
          setFocusAccounts(mondayData.focusAccounts.map((f: any) => ({ ...f, status: '' })));
        }

        if (Array.isArray(data.stillWorkingAccounts)) {
          loadedWorking = data.stillWorkingAccounts;
        }
      } else {
        if (mondayData) {
          setRoadblocks(mondayData.roadblocks || '');
          setSupportNeeded(mondayData.supportNeeded || '');
          if (mondayData.actionPlan) {
            setCommitments(mondayData.actionPlan.filter((a: string) => a.trim()).map((a: string) => ({ id: crypto.randomUUID(), text: a, status: '', reason: '' })));
          }
          if (mondayData.focusAccounts) {
            setFocusAccounts(mondayData.focusAccounts.map((f: any) => ({ ...f, status: '' })));
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
    if (!db) return;
    setIsSavingDraft(true);
    try {
      const batch = writeBatch(db);
      const reportRef = doc(db, 'weeklyReports', `${userId}_${currentWeek}`);
      
      const reportSnap = await getDoc(reportRef);
      const existingSummary = (reportSnap.exists() ? reportSnap.data()?.summary : null) || {};
      const crmCalls = progress?.crmCalls !== undefined ? progress.crmCalls : (existingSummary.crmCalls || 0);
      const crmApps = progress?.crmApps !== undefined ? progress.crmApps : (existingSummary.crmApps || 0);

      batch.set(reportRef, {
        userId, 
        userName, 
        week: currentWeek, 
        weeklyNotes: notes, 
        stillWorkingAccounts: stillWorking,
        roadblocks,
        supportNeeded,
        commitments,
        focusAccounts,
        status: 'DRAFT', 
        submittedAt: serverTimestamp(),
        summary: { 
          totalEAV, 
          newOpportunitiesCount: opportunities.length, 
          signedPaperworkCount: signedDeals.length, 
          newBusinessCount: newBusiness.length,
          stillWorkingCount: stillWorking.length,
          callsMade: progress?.calls || 0,
          meetingsHeld: progress?.apps || 0,
          crmCalls,
          crmApps
        }
      }, { merge: true });

      // FIXED: Use item.id as Firestore doc key to prevent duplicates on re-save.
      // merge:true ensures existing data (e.g. from prior loads) is preserved.
      opportunities.forEach(o => batch.set(doc(db, 'opportunities', o.id), { ...o, userId, userName, week: currentWeek, updatedAt: serverTimestamp() }, { merge: true }));
      signedDeals.forEach(s => batch.set(doc(db, 'signedPaperwork', s.id), { ...s, userId, userName, week: currentWeek, updatedAt: serverTimestamp() }, { merge: true }));
      newBusiness.forEach(b => batch.set(doc(db, 'newBusiness', b.id), { ...b, userId, userName, week: currentWeek, updatedAt: serverTimestamp() }, { merge: true }));

      await batch.commit();
      toast({ title: "Draft Saved", description: "Your Friday Synthesis progress is safely saved." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Draft Failed" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const reportRef = doc(db, 'weeklyReports', `${userId}_${currentWeek}`);
      
      const reportSnap = await getDoc(reportRef);
      const existingSummary = (reportSnap.exists() ? reportSnap.data()?.summary : null) || {};
      const crmCalls = progress?.crmCalls !== undefined ? progress.crmCalls : (existingSummary.crmCalls || 0);
      const crmApps = progress?.crmApps !== undefined ? progress.crmApps : (existingSummary.crmApps || 0);

      batch.set(reportRef, {
        userId, 
        userName, 
        week: currentWeek, 
        weeklyNotes: notes, 
        stillWorkingAccounts: stillWorking,
        roadblocks,
        supportNeeded,
        commitments,
        focusAccounts,
        status: 'SUBMITTED', 
        submittedAt: serverTimestamp(),
        summary: { 
          totalEAV, 
          newOpportunitiesCount: opportunities.length, 
          signedPaperworkCount: signedDeals.length, 
          newBusinessCount: newBusiness.length,
          stillWorkingCount: stillWorking.length,
          callsMade: progress?.calls || 0,
          meetingsHeld: progress?.apps || 0,
          crmCalls,
          crmApps
        }
      }, { merge: true });

      // Handle carry-over logic for next week
      const notCompletedCommitments = commitments.filter(c => c.status === 'NOT_COMPLETED').map(c => c.text + (c.reason ? ` (Reason: ${c.reason})` : ''));
      const stillWorkingFocusAccounts = focusAccounts.filter(f => f.status === 'STILL_WORKING').map(f => ({
        accountId: f.accountId || crypto.randomUUID(),
        accountName: f.accountName,
        actionType: f.actionType,
        eav: f.eav,
        aboutAccount: f.aboutAccount
      }));

      if (notCompletedCommitments.length > 0 || stillWorkingFocusAccounts.length > 0) {
        // Calculate next week string format "yyyy-ww"
        const nextWeekStr = getWeekForDate(addWeeks(new Date(), 1));
        
        const nextWeekCommitRef = doc(db, 'weeklyCommitments', `${userId}_${nextWeekStr}`);
        const nextWeekSnap = await getDoc(nextWeekCommitRef);
        
        let newActionPlan = [...notCompletedCommitments];
        let newFocusAccounts = [...stillWorkingFocusAccounts];
        
        if (nextWeekSnap.exists()) {
           const existingData = nextWeekSnap.data();
           if (existingData.actionPlan) newActionPlan = [...existingData.actionPlan, ...newActionPlan];
           if (existingData.focusAccounts) newFocusAccounts = [...existingData.focusAccounts, ...newFocusAccounts];
        }

        batch.set(nextWeekCommitRef, {
           userId,
           week: nextWeekStr,
           status: nextWeekSnap.exists() ? nextWeekSnap.data()?.status : 'DRAFT',
           actionPlan: newActionPlan,
           focusAccounts: newFocusAccounts,
           updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // FIXED: Use item.id as Firestore doc key to prevent duplicates on final submit.
      opportunities.forEach(o => batch.set(doc(db, 'opportunities', o.id), { ...o, userId, userName, week: currentWeek, updatedAt: serverTimestamp() }, { merge: true }));
      signedDeals.forEach(s => batch.set(doc(db, 'signedPaperwork', s.id), { ...s, userId, userName, week: currentWeek, updatedAt: serverTimestamp() }, { merge: true }));
      newBusiness.forEach(b => batch.set(doc(db, 'newBusiness', b.id), { ...b, userId, userName, week: currentWeek, updatedAt: serverTimestamp() }, { merge: true }));

      await batch.commit();
      toast({ title: "Synthesis Dispatched", description: "Your weekly performance data is now live on the GM dashboard." });
      
      // Clear page ready for next week
      setOpportunities([]);
      setSignedDeals([]);
      setNewBusiness([]);
      setStillWorking([]);
      setCommitments([]);
      setFocusAccounts([]);
      setRoadblocks('');
      setSupportNeeded('');
      setNotes('');
    } catch (e) {
      toast({ variant: "destructive", title: "Submission Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
              <Phone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Calls Completed</p>
              <p className="text-2xl font-black text-primary">{progress?.calls || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Appointments Held</p>
              <p className="text-2xl font-black text-primary">{progress?.apps || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MONDAY PLANNING CARRY-OVER SECTION */}
      <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Monday Planning Review</h3>
        </div>

        {/* Roadblocks & Support */}
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

        {/* Commitments Review */}
        {commitments.length > 0 && (
          <div className="space-y-4 pt-4">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Commitments for the Week Ahead</Label>
            <div className="space-y-3">
              {commitments.map((c, idx) => (
                <div key={c.id} className="p-4 bg-white rounded-2xl border shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-bold text-slate-700 flex-1">{c.text}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant={c.status === 'COMPLETED' ? 'default' : 'outline'} className={cn("h-8 rounded-xl text-[10px] font-black", c.status === 'COMPLETED' && 'bg-emerald-600 hover:bg-emerald-700')} onClick={() => { const n = [...commitments]; n[idx].status = 'COMPLETED'; setCommitments(n); }}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                      </Button>
                      <Button size="sm" variant={c.status === 'NOT_COMPLETED' ? 'default' : 'outline'} className={cn("h-8 rounded-xl text-[10px] font-black", c.status === 'NOT_COMPLETED' && 'bg-red-600 hover:bg-red-700')} onClick={() => { const n = [...commitments]; n[idx].status = 'NOT_COMPLETED'; setCommitments(n); }}>
                        <XCircle className="w-3 h-3 mr-1" /> Not Completed
                      </Button>
                    </div>
                  </div>
                  {c.status === 'NOT_COMPLETED' && (
                    <div className="pt-2">
                      <Input placeholder="Reason for not completing (will carry over to next week)..." value={c.reason} onChange={e => { const n = [...commitments]; n[idx].reason = e.target.value; setCommitments(n); }} className="h-9 text-xs font-medium bg-red-50/50 border-red-200" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Focus Accounts Review */}
        {focusAccounts.length > 0 && (
          <div className="space-y-4 pt-4">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">Focus Accounts</Label>
            <div className="space-y-3">
              {focusAccounts.map((f, idx) => (
                <div key={f.accountId || idx} className="p-4 bg-white rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{f.accountName}</p>
                    {f.aboutAccount && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{f.aboutAccount}</p>}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button size="sm" variant={f.status === 'COMPLETED' ? 'default' : 'outline'} className={cn("h-8 flex-1 sm:flex-none rounded-xl text-[10px] font-black", f.status === 'COMPLETED' && 'bg-emerald-600 hover:bg-emerald-700')} onClick={() => { const n = [...focusAccounts]; n[idx].status = 'COMPLETED'; setFocusAccounts(n); }}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                    </Button>
                    <Button size="sm" variant={f.status === 'STILL_WORKING' ? 'default' : 'outline'} className={cn("h-8 flex-1 sm:flex-none rounded-xl text-[10px] font-black", f.status === 'STILL_WORKING' && 'bg-amber-500 hover:bg-amber-600')} onClick={() => { const n = [...focusAccounts]; n[idx].status = 'STILL_WORKING'; setFocusAccounts(n); }}>
                      <Clock className="w-3 h-3 mr-1" /> Still Working
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 px-2">
          <TrendingUp className="w-4 h-4 text-accent" /> Weekly Pipeline Progression
        </h3>
        <div className="grid grid-cols-1 gap-8">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2rem]">
            <CardHeader className="bg-amber-50 border-b py-6"><div className="flex items-center gap-2"><Clock className="w-5 h-5 text-amber-600" /><CardTitle className="text-xs font-black uppercase text-amber-950">Still Working (In Progress)</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-4">
               {stillWorking.map((w, idx) => (
                 <div key={w.id} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group hover:border-amber-200 transition-colors">
                    <Input placeholder="Account..." value={w.accountName} onChange={e => { const n = [...stillWorking]; n[idx].accountName = e.target.value.toUpperCase(); setStillWorking(n); }} className="h-9 text-xs font-bold bg-white" />
                    <div className="flex gap-2">
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={w.eav} onChange={e => { const n = [...stillWorking]; n[idx].eav = Number(e.target.value) || 0; setStillWorking(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
                      <Button variant="ghost" size="icon" onClick={() => setStillWorking(stillWorking.filter(x => x.id !== w.id))} className="text-red-300 hover:text-red-600 h-9 w-9"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <div className="flex items-center gap-1 pt-2 border-t border-slate-200/60 justify-between">
                       <span className="text-[9px] font-black uppercase text-slate-400">Transfer:</span>
                       <div className="flex gap-1">
                         <Button size="sm" variant="outline" onClick={() => moveToOpp(w)} className="h-7 px-2 text-[9px] font-black bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">Opp <ArrowRight className="w-3 h-3 ml-1" /></Button>
                         <Button size="sm" variant="outline" onClick={() => moveToWin(w)} className="h-7 px-2 text-[9px] font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Win <ArrowRight className="w-3 h-3 ml-1" /></Button>
                         <Button size="sm" variant="outline" onClick={() => moveToLive(w)} className="h-7 px-2 text-[9px] font-black bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">Live <ArrowRight className="w-3 h-3 ml-1" /></Button>
                       </div>
                    </div>
                 </div>
               ))}
               <Button variant="outline" onClick={addStillWorking} className="w-full h-12 border-dashed border-2 rounded-2xl font-black text-[10px] uppercase text-slate-400">+ Add In-Progress Biz</Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2rem]">
            <CardHeader className="bg-blue-50 border-b py-6"><div className="flex items-center gap-2"><Target className="w-5 h-5 text-blue-600" /><CardTitle className="text-xs font-black uppercase">New Opps (EAV & %)</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-4">
               {opportunities.map((o, idx) => (
                 <div key={o.id} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group">
                    <Input placeholder="Account..." value={o.accountName} onChange={e => { const n = [...opportunities]; n[idx].accountName = e.target.value.toUpperCase(); setOpportunities(n); }} className="h-9 text-xs font-bold bg-white" />
                    <div className="flex gap-2">
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={o.eav} onChange={e => { const n = [...opportunities]; n[idx].eav = Number(e.target.value) || 0; setOpportunities(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
                      <div className="w-20"><Input type="number" placeholder="%" value={o.probability} onChange={e => { const n = [...opportunities]; n[idx].probability = Number(e.target.value) || 0; setOpportunities(n); }} className="h-9 text-xs font-bold bg-white" /></div>
                      <Button variant="ghost" size="icon" onClick={() => setOpportunities(opportunities.filter(x => x.id !== o.id))} className="text-red-300 h-9 w-9"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 </div>
               ))}
               <Button variant="outline" onClick={addOpportunity} className="w-full h-12 border-dashed border-2 rounded-2xl font-black text-[10px] uppercase text-slate-400">+ Add Opportunity</Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2rem]">
            <CardHeader className="bg-emerald-50 border-b py-6"><div className="flex items-center gap-2"><FileCheck className="w-5 h-5 text-emerald-600" /><CardTitle className="text-xs font-black uppercase">New Business Signed</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-4">
               {signedDeals.map((s, idx) => (
                 <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group">
                    <Input placeholder="Account..." value={s.accountName} onChange={e => { const n = [...signedDeals]; n[idx].accountName = e.target.value.toUpperCase(); setSignedDeals(n); }} className="h-9 text-xs font-bold bg-white" />
                    <div className="flex gap-2">
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={s.eav} onChange={e => { const n = [...signedDeals]; n[idx].eav = Number(e.target.value) || 0; setSignedDeals(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
                      <Button variant="ghost" size="icon" onClick={() => setSignedDeals(signedDeals.filter(x => x.id !== s.id))} className="text-red-300 h-9 w-9"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 </div>
               ))}
               <Button variant="outline" onClick={addSigned} className="w-full h-12 border-dashed border-2 rounded-2xl font-black text-[10px] uppercase text-slate-400">+ Add Win</Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2rem]">
            <CardHeader className="bg-purple-50 border-b py-6"><div className="flex items-center gap-2"><Rocket className="w-5 h-5 text-purple-600" /><CardTitle className="text-xs font-black uppercase">Commenced Trading</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-4">
               {newBusiness.map((b, idx) => (
                 <div key={b.id} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group">
                    <Input placeholder="Account..." value={b.accountName} onChange={e => { const n = [...newBusiness]; n[idx].accountName = e.target.value.toUpperCase(); setNewBusiness(n); }} className="h-9 text-xs font-bold bg-white" />
                    <div className="flex gap-2">
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={b.eav} onChange={e => { const n = [...newBusiness]; n[idx].eav = Number(e.target.value) || 0; setNewBusiness(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
                      <Button variant="ghost" size="icon" onClick={() => setNewBusiness(newBusiness.filter(x => x.id !== b.id))} className="text-red-300 h-9 w-9"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 </div>
               ))}
               <Button variant="outline" onClick={addBusiness} className="w-full h-12 border-dashed border-2 rounded-2xl font-black text-[10px] uppercase text-slate-400">+ Add Live Biz</Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
         <p className="text-[9px] text-muted-foreground px-4 italic font-medium">
           * Note: For best results in the GM Command Hub, keep narratives under 10-15 lines. Data is stored securely regardless of length.
         </p>
      </div>
    </div>
  );
}