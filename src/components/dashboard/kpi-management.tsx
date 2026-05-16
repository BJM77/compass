"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, BarChart3, TrendingUp, Target, Heart, Activity, CheckCircle2 } from 'lucide-react';

export function KPIManagement() {
  const db = useFirestore();
  const { toast } = useToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editedStats, setEditedStats] = useState<Record<string, any>>({});

  const statsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'bdmStats');
  }, [db]);
  const { data: teamStats, isLoading } = useCollection(statsQuery);

  const getEditValue = (memberId: string, field: string, original: any) => editedStats[memberId]?.[field] ?? original;
  const setEditValue = (memberId: string, field: string, value: any) => setEditedStats(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));

  const handleSave = async (memberId: string) => {
    if (!db || !editedStats[memberId]) return;
    setSavingId(memberId);
    try {
      await setDoc(doc(db, 'bdmStats', memberId), { ...editedStats[memberId], updatedAt: serverTimestamp() }, { merge: true });
      setEditedStats(prev => { const copy = { ...prev }; delete copy[memberId]; return copy; });
      toast({ title: "KPIs Updated" });
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) return <div className="text-center py-20">Loading KPI Data...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-accent" /> KPI Performance Console</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {teamStats?.map(member => (
          <Card key={member.id} className={`border shadow-sm ${editedStats[member.id] ? 'border-accent' : 'bg-white'}`}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold">{member.name || member.id}</CardTitle>
              <Button size="sm" className="h-8" disabled={!editedStats[member.id] || savingId === member.id} onClick={() => handleSave(member.id)}>{savingId === member.id ? <Loader2 className="animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Save</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Revenue YTD</Label><Input type="number" value={getEditValue(member.id, 'revenueYTD', member.revenueYTD || 0)} onChange={(e) => setEditValue(member.id, 'revenueYTD', parseFloat(e.target.value))}/></div>
                <div className="space-y-1"><Label className="text-[10px] uppercase font-bold">Target</Label><Input type="number" value={getEditValue(member.id, 'target', member.target || 2000000)} onChange={(e) => setEditValue(member.id, 'target', parseFloat(e.target.value))}/></div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold">Status</Label>
                <Select value={getEditValue(member.id, 'recoveryStatus', member.recoveryStatus || 'ON_TRACK')} onValueChange={(val) => setEditValue(member.id, 'recoveryStatus', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ON_TRACK">On Track</SelectItem><SelectItem value="RECOVERING">Recovering</SelectItem><SelectItem value="AT_RISK">At Risk</SelectItem></SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
function Label({ children, className }: any) { return <label className={`text-xs font-medium text-muted-foreground ${className}`}>{children}</label>; }