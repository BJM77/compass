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
  ClipboardCheck, Phone, CalendarCheck, Target
} from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function BDMWeeklySubmission({ userId, userName }: { userId: string; userName: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-ww');

  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [signedDeals, setSignedDeals] = useState<any[]>([]);
  const [newBusiness, setNewBusiness] = useState<any[]>([]);
  
  // High-Level Narrative (Week That Was)
  const [notes, setNotes] = useState('');

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
    return opps + signed + business;
  }, [opportunities, signedDeals, newBusiness]);

  // Load existing data if available
  useEffect(() => {
    async function loadExisting() {
      if (!db || !userId) return;
      const reportRef = doc(db, 'weeklyReports', `${userId}_${currentWeek}`);
      const snap = await getDoc(reportRef);
      if (snap.exists()) {
        const data = snap.data();
        setNotes(data.weeklyNotes || '');
      }
      
      const oppsSnap = await getDocs(query(collection(db, 'opportunities'), where('userId', '==', userId), where('week', '==', currentWeek)));
      setOpportunities(oppsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any)));
      
      const signedSnap = await getDocs(query(collection(db, 'signedPaperwork'), where('userId', '==', userId), where('week', '==', currentWeek)));
      setSignedDeals(signedSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any)));

      const businessSnap = await getDocs(query(collection(db, 'newBusiness'), where('userId', '==', userId), where('week', '==', currentWeek)));
      setNewBusiness(businessSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as any)));
    }
    loadExisting();
  }, [db, userId, currentWeek]);

  const addOpportunity = () => setOpportunities([...opportunities, { id: crypto.randomUUID(), accountName: '', eav: 0, stage: 'PROPOSAL', probability: 20 }]);
  const addSigned = () => setSignedDeals([...signedDeals, { id: crypto.randomUUID(), accountName: '', eav: 0, termMonths: 12 }]);
  const addBusiness = () => setNewBusiness([...newBusiness, { id: crypto.randomUUID(), accountName: '', eav: 0, assignedAE: '' }]);

  const handleSubmit = async () => {
    if (!db) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const reportRef = doc(db, 'weeklyReports', `${userId}_${currentWeek}`);
      
      batch.set(reportRef, {
        userId, 
        userName, 
        week: currentWeek, 
        weeklyNotes: notes, 
        status: 'SUBMITTED', 
        submittedAt: serverTimestamp(),
        summary: { 
          totalEAV, 
          newOpportunitiesCount: opportunities.length, 
          signedPaperworkCount: signedDeals.length, 
          newBusinessCount: newBusiness.length,
          callsMade: progress?.calls || 0,
          meetingsHeld: progress?.apps || 0
        }
      }, { merge: true });

      opportunities.forEach(o => batch.set(doc(collection(db, 'opportunities')), { ...o, userId, userName, week: currentWeek, createdAt: serverTimestamp() }));
      signedDeals.forEach(s => batch.set(doc(collection(db, 'signedPaperwork')), { ...s, userId, userName, week: currentWeek, createdAt: serverTimestamp() }));
      newBusiness.forEach(b => batch.set(doc(collection(db, 'newBusiness')), { ...b, userId, userName, week: currentWeek, createdAt: serverTimestamp() }));

      await batch.commit();
      toast({ title: "Synthesis Dispatched", description: "Your weekly performance data is now live on the GM dashboard." });
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
        <div className="mt-6 lg:mt-0 flex items-center gap-6 relative z-10">
           <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-accent uppercase tracking-widest">Total Combined EAV</p>
              <p className="text-3xl font-black">${(totalEAV / 1000).toFixed(0)}K</p>
           </div>
           <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-white font-black h-16 px-10 rounded-2xl shadow-xl gap-3 text-sm">
             {isSubmitting ? <Loader2 className="animate-spin w-6 h-6" /> : <ClipboardCheck className="w-6 h-6" />} FINALISE FRIDAY PACK
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

      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2 px-2">
          <TrendingUp className="w-4 h-4 text-accent" /> Weekly Pipeline Progression
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2rem]">
            <CardHeader className="bg-blue-50 border-b py-6"><div className="flex items-center gap-2"><Target className="w-5 h-5 text-blue-600" /><CardTitle className="text-xs font-black uppercase">New Opps (EAV & %)</CardTitle></div></CardHeader>
            <CardContent className="p-6 space-y-4">
               {opportunities.map((o, idx) => (
                 <div key={o.id} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group">
                    <Input placeholder="Account..." value={o.accountName} onChange={e => { const n = [...opportunities]; n[idx].accountName = e.target.value.toUpperCase(); setOpportunities(n); }} className="h-9 text-xs font-bold bg-white" />
                    <div className="flex gap-2">
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={o.eav} onChange={e => { const n = [...opportunities]; n[idx].eav = e.target.value; setOpportunities(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
                      <div className="w-20"><Input type="number" placeholder="%" value={o.probability} onChange={e => { const n = [...opportunities]; n[idx].probability = e.target.value; setOpportunities(n); }} className="h-9 text-xs font-bold bg-white" /></div>
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
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={s.eav} onChange={e => { const n = [...signedDeals]; n[idx].eav = e.target.value; setSignedDeals(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
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
                      <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" placeholder="EAV" value={b.eav} onChange={e => { const n = [...newBusiness]; n[idx].eav = e.target.value; setNewBusiness(n); }} className="h-9 pl-6 text-xs font-bold bg-white" /></div>
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
         <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 px-2"><Award className="w-3.5 h-3.5" /> Performance Narrative (The Week That Was)</Label>
         <Textarea 
           placeholder="Document high-level wins and strategic shifts achieved this week..." 
           value={notes} 
           onChange={e => setNotes(e.target.value)} 
           className="min-h-[160px] rounded-[2rem] border-slate-200 bg-white p-8 shadow-inner text-sm font-medium leading-relaxed" 
         />
      </div>
    </div>
  );
}