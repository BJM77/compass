"use client";

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, CalendarCheck, FileText, Target, Loader2, Zap, Plus } from 'lucide-react';
import { useFirestore, useMemoFirebase, useDoc, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, increment } from 'firebase/firestore';
import { getCurrentWeek } from '@/lib/utils';

export function ActivityLogger({ userId }: { userId: string }) {
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const docId = `${userId}_${currentWeek}`;

  const progressRef = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return doc(db, 'weeklyProgress', docId);
  }, [db, userId, docId]);

  const { data: progress, isLoading } = useDoc(progressRef);

  const [optimisticOffsets, setOptimisticOffsets] = useState<Record<string, number>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const updateCount = (field: string, delta: number) => {
    if (!db || !userId) return;

    // 1. Optimistic UI update
    setOptimisticOffsets(prev => ({
      ...prev,
      [field]: (prev[field] || 0) + delta
    }));

    // 2. Debounce Firestore writes to prevent database hammering
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      setOptimisticOffsets(currentOffsets => {
        const updates: Record<string, any> = {};
        for (const [k, v] of Object.entries(currentOffsets)) {
          if (v !== 0) updates[k] = increment(v);
        }
        
        if (Object.keys(updates).length > 0) {
          const docRef = doc(db, 'weeklyProgress', docId);
          setDocumentNonBlocking(docRef, {
            userId,
            week: currentWeek,
            ...updates,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        return {}; // Reset offsets after flush
      });
    }, 1000); // 1-second debounce
  };

  const setManualValue = (field: string, value: string) => {
    if (!db || !userId) return;
    const num = parseInt(value) || 0;
    
    // Clear any pending optimistic writes for this field to avoid conflicts
    setOptimisticOffsets(prev => ({ ...prev, [field]: 0 }));
    
    const docRef = doc(db, 'weeklyProgress', docId);
    setDocumentNonBlocking(docRef, {
      userId,
      week: currentWeek,
      [field]: num,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Metric Input Area */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EditableStatCard 
          icon={<Phone className="w-3.5 h-3.5" />} 
          val={(progress?.calls || 0) + (optimisticOffsets['calls'] || 0)} 
          label="Calls" 
          color="blue" 
          onChange={(v: string) => setManualValue('calls', v)}
        />
        <EditableStatCard 
          icon={<CalendarCheck className="w-3.5 h-3.5" />} 
          val={(progress?.apps || 0) + (optimisticOffsets['apps'] || 0)} 
          label="Apps" 
          color="green" 
          onChange={(v: string) => setManualValue('apps', v)}
        />
        <EditableStatCard 
          icon={<FileText className="w-3.5 h-3.5" />} 
          val={(progress?.proposals || 0) + (optimisticOffsets['proposals'] || 0)} 
          label="Opps" 
          color="purple" 
          onChange={(v: string) => setManualValue('proposals', v)}
        />
        <EditableStatCard 
          icon={<Target className="w-3.5 h-3.5" />} 
          val={(progress?.deals || 0) + (optimisticOffsets['deals'] || 0)} 
          label="Wins" 
          color="orange" 
          onChange={(v: string) => setManualValue('deals', v)}
        />
      </div>

      {/* Rapid Punch Control Panel */}
      <Card className="border-none shadow-2xl overflow-hidden bg-card">
        <CardHeader className="bg-secondary/60 border-b py-4">
          <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            Rapid Habit Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <PunchButton 
              label="CALL" 
              icon={<Phone className="w-4 h-4" />} 
              color="bg-info shadow-info/20" 
              onClick={() => updateCount('calls', 1)}
            />
            <PunchButton 
              label="APP" 
              icon={<CalendarCheck className="w-4 h-4" />} 
              color="bg-success-fill shadow-success/20" 
              onClick={() => updateCount('apps', 1)}
            />
            <PunchButton 
              label="OPP" 
              icon={<FileText className="w-4 h-4" />} 
              color="bg-chart-5 shadow-chart-5/20" 
              onClick={() => updateCount('proposals', 1)}
            />
            <PunchButton 
              label="WIN" 
              icon={<Target className="w-4 h-4" />} 
              color="bg-warning shadow-warning/20" 
              onClick={() => updateCount('deals', 1)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditableStatCard({ icon, val, label, color, onChange }: any) {
  const colors: any = {
    blue: 'bg-info-soft text-info border-info/15',
    green: 'bg-success-soft text-success border-success/15',
    purple: 'bg-chart-5/10 text-chart-5 border-chart-5/15',
    orange: 'bg-warning-soft text-warning-ink border-warning/15',
  };
  return (
    <div className={`p-4 rounded-2xl border text-center transition-all ${colors[color]}`}>
      <div className="flex justify-center mb-2 opacity-70">{icon}</div>
      <Input 
        type="number" 
        value={val} 
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-none text-center text-2xl font-black tabular-nums h-8 focus-visible:ring-0 p-0 shadow-none"
      />
      <p className="text-xs font-semibold mt-1 opacity-70">{label}</p>
    </div>
  );
}

function PunchButton({ label, icon, color, onClick }: any) {
  return (
    <Button 
      onClick={onClick} 
      className={`${color} hover:opacity-90 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95 transition-all text-white border-none`}
    >
      <Plus className="w-5 h-5" />
      <span className="text-xs font-semibold">{label}</span>
    </Button>
  );
}
