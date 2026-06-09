"use client";

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Phone, Calendar, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';

interface WeeklyActivitySummaryProps {
  userId: string;
  readOnly?: boolean;
}

export function WeeklyActivitySummary({ userId, readOnly }: WeeklyActivitySummaryProps) {
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const docId = `${userId}_${currentWeek}`;

  const activityDocRef = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return doc(db, 'weeklyProgress', docId);
  }, [db, userId, docId]);

  const { data: activity } = useDoc(activityDocRef);

  const updateActivity = async (field: string, value: number) => {
    if (!db || !userId || readOnly) return;
    const docRef = doc(db, 'weeklyProgress', docId);
    await setDoc(docRef, {
      userId,
      week: currentWeek,
      [field]: value,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  return (
    <Card className="border-none shadow-xl bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          Weekly Performance Metrics (Aggregates)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3 text-blue-500" /> Appointments</Label>
            <Input type="number" className="text-xl font-bold h-12" value={activity?.apps || 0} onChange={(e) => updateActivity('apps', parseInt(e.target.value) || 0)} readOnly={readOnly}/>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3 text-green-500" /> Calls</Label>
            <Input type="number" className="text-xl font-bold h-12" value={activity?.calls || 0} onChange={(e) => updateActivity('calls', parseInt(e.target.value) || 0)} readOnly={readOnly}/>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5"><Lightbulb className="w-3 h-3 text-yellow-500" /> New Opps</Label>
            <Input type="number" className="text-xl font-bold h-12" value={activity?.proposals || 0} onChange={(e) => updateActivity('proposals', parseInt(e.target.value) || 0)} readOnly={readOnly}/>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}