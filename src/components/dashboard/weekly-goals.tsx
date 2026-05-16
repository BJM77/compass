"use client";

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Target, Rocket, Shield, Trash2, Plus, AlertTriangle, LifeBuoy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  priceReviewsToComplete?: number;
  problemsToResolve?: number;
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

export function WeeklyGoals({ userId, userRole = 'BDM' }: { userId: string; userRole?: 'BDM' | 'AM' }) {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-ww');
  
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

  useEffect(() => {
    async function loadPlan() {
      if (!db || !userId) return;
      const planRef = doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`);
      const snap = await getDoc(planRef);
      if (snap.exists()) {
        const data = snap.data();
        const loadedFocus = (data.focusAccounts || []).map((acc: any) => ({
          ...acc,
          eav: acc.eav || 0,
          aboutAccount: acc.aboutAccount || acc.expectedOutcome || ''
        }));
        setFocusAccounts(loadedFocus);
        setKpiTargets(data.kpiTargets || {
          callsToMake: userRole === 'BDM' ? 50 : 30,
          appsToSet: userRole === 'BDM' ? 10 : 5,
          proposalsToSubmit: userRole === 'BDM' ? 5 : 2,
          dealsToClose: userRole === 'BDM' ? 2 : 1
        });
        if (Array.isArray(data.actionPlan)) setActionPlan(data.actionPlan);
        setRoadblocks(data.roadblocks || '');
        setSupportNeeded(data.supportNeeded || '');
      }
    }
    loadPlan();
  }, [db, userId, currentWeek]);

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
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Target className="w-8 h-8 text-primary" />
            Monday Planning Node
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase font-bold tracking-widest">Week {currentWeek.split('-')[1]} • Strategic Alignment Mode</p>
        </div>
        <Button onClick={savePlan} disabled={isSaving} className="bg-primary font-black h-12 px-8 uppercase shadow-xl gap-2 w-full md:w-auto">
          {isSaving ? 'Synchronising...' : 'Commit Weekly Plan'}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border shadow-md">
          <CardHeader><CardTitle className="text-lg font-black flex items-center gap-2">{userRole === 'BDM' ? <Rocket className="w-5 h-5 text-accent" /> : <Shield className="w-5 h-5 text-accent" />} Focus Accounts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {focusAccounts.map((acc, idx) => (
              <div key={acc.accountId} className="p-4 bg-slate-50 rounded-2xl border space-y-3 relative group">
                <div className="flex justify-between items-center gap-2">
                   <Input placeholder="Account Name..." value={acc.accountName} onChange={e => { const n = [...focusAccounts]; n[idx].accountName = e.target.value; setFocusAccounts(n); }} className="h-10 text-xs font-bold flex-1" />
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
                  <label className="text-[8px] font-black uppercase text-muted-foreground ml-1">About Account</label>
                  <Textarea placeholder="Context, history, and strategic intent..." value={acc.aboutAccount} onChange={e => { const n = [...focusAccounts]; n[idx].aboutAccount = e.target.value; setFocusAccounts(n); }} className="min-h-[80px] text-[10px] font-medium leading-relaxed" />
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addFocusAccount} className="w-full h-12 border-dashed border-2 rounded-xl font-black uppercase text-[10px] text-muted-foreground hover:bg-slate-50">+ Add Target Node</Button>
          </CardContent>
        </Card>

        <Card className="border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center justify-between">
              Commitments for Week Ahead
            </CardTitle>
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