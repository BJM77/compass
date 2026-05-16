"use client";

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Star, Info, Lightbulb, Trash2, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek } from 'date-fns';

interface SMARTGoal {
  id: string;
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timebound: string;
  kpi: string;
  targetValue: number;
  currentValue: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'AT_RISK';
}

export function SmartGoalsView({ userId }: { userId: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-ww');
  
  const [smartGoals, setSmartGoals] = useState<SMARTGoal[]>([]);
  const [showSmartHelp, setShowSmartHelp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadGoals() {
      if (!db || !userId) return;
      try {
        const planRef = doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`);
        const snap = await getDoc(planRef);
        if (snap.exists()) {
          setSmartGoals(snap.data().smartGoals || []);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadGoals();
  }, [db, userId, currentWeek]);

  const addSMARTGoal = () => {
    setSmartGoals([...smartGoals, {
      id: crypto.randomUUID(),
      specific: '', measurable: '', achievable: '', relevant: '', timebound: '',
      kpi: 'CALLS', targetValue: 0, currentValue: 0, status: 'NOT_STARTED'
    }]);
  };

  const handleSave = async () => {
    if (!db || !userId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'weeklyCommitments', `${userId}_${currentWeek}`), {
        smartGoals,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast({ title: "SMART Goals Saved", description: "Strategic commitments updated for the week." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <Card className="border-2 border-primary/20 shadow-lg bg-white overflow-hidden animate-in fade-in duration-500">
      <CardHeader className="bg-slate-900 text-white flex flex-row items-center justify-between py-6">
        <CardTitle className="text-xl font-black flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          SMART Goals
        </CardTitle>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowSmartHelp(!showSmartHelp)} className="text-accent hover:text-white font-black text-[10px] uppercase">
            <Info className="w-4 h-4 mr-1" /> What's a SMART Goal?
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-accent hover:bg-accent/90 text-white font-black h-9 px-4 text-[10px] uppercase rounded-xl">
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Save Goals
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-8 space-y-6">
        {showSmartHelp && (
          <Alert className="bg-blue-50 border-blue-200 rounded-2xl animate-in slide-in-from-top-4 duration-300">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-black uppercase text-xs">The S.M.A.R.T. Framework</AlertTitle>
            <AlertDescription className="text-blue-700 text-[10px] font-bold uppercase leading-relaxed mt-2">
              <span className="font-black text-blue-900">Specific</span>: Clear and precise outcomes. • 
              <span className="font-black text-blue-900">Measurable</span>: Quantifiable success metrics. • 
              <span className="font-black text-blue-900">Achievable</span>: Realistic based on resource. • 
              <span className="font-black text-blue-900">Relevant</span>: Aligns with territory growth. • 
              <span className="font-black text-blue-900">Timebound</span>: Clear Friday deadlines.
            </AlertDescription>
          </Alert>
        )}

        {smartGoals.map((goal, idx) => (
          <div key={goal.id} className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 relative group">
            <div className="flex justify-between items-center mb-4">
              <Badge className="bg-primary text-white font-black text-[9px] px-3">GOAL NODE #{idx + 1}</Badge>
              <Button variant="ghost" size="icon" onClick={() => setSmartGoals(smartGoals.filter(g => g.id !== goal.id))} className="text-red-300 hover:text-red-600 h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Specific Outcome</label><Input placeholder="What exactly?" value={goal.specific} onChange={e => { const n = [...smartGoals]; n[idx].specific = e.target.value; setSmartGoals(n); }} className="h-10 text-xs font-bold rounded-xl" /></div>
              <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Success Metric</label><Input placeholder="How to measure?" value={goal.measurable} onChange={e => { const n = [...smartGoals]; n[idx].measurable = e.target.value; setSmartGoals(n); }} className="h-10 text-xs font-bold rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Linked KPI</label>
                <select className="w-full h-10 rounded-xl border border-slate-200 text-xs font-bold px-3 bg-white" value={goal.kpi} onChange={e => { const n = [...smartGoals]; n[idx].kpi = e.target.value; setSmartGoals(n); }}>
                  <option value="CALLS">CALLS</option>
                  <option value="APPOINTMENTS">APPOINTMENTS</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="PROPOSALS">PROPOSALS</option>
                </select>
              </div>
              <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Target Value</label><Input type="number" value={goal.targetValue} onChange={e => { const n = [...smartGoals]; n[idx].targetValue = parseFloat(e.target.value); setSmartGoals(n); }} className="h-10 text-xs font-bold rounded-xl" /></div>
              <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Deadline</label><Input placeholder="Friday 5pm" value={goal.timebound} onChange={e => { const n = [...smartGoals]; n[idx].timebound = e.target.value; setSmartGoals(n); }} className="h-10 text-xs font-bold rounded-xl" /></div>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={addSMARTGoal} className="w-full h-14 border-dashed border-2 rounded-2xl font-black uppercase text-xs text-muted-foreground hover:bg-slate-50 transition-all">
          + Define New SMART Commitment
        </Button>
      </CardContent>
    </Card>
  );
}
