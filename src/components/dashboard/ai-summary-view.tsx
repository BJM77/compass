"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, AlertTriangle, Lightbulb, MessageSquare, Target } from 'lucide-react';
import { generatePersonalScorecardSummary, GeneratePersonalScorecardSummaryInput, GeneratePersonalScorecardSummaryOutput } from '@/ai/flows/generate-personal-scorecard-summary';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AISummaryViewProps {
  input: GeneratePersonalScorecardSummaryInput;
  userId: string;
}

export function AISummaryView({ input, userId }: AISummaryViewProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<GeneratePersonalScorecardSummaryOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const currentWeek = getCurrentWeek();

  useEffect(() => {
    async function loadSummary() {
      if (!db || !userId) return;
      
      try {
        const q = query(
          collection(db, 'aiBriefs'),
          where('userId', '==', userId),
          where('week', '==', currentWeek),
          limit(1)
        );
        const existing = await getDocs(q);
        
        if (!existing.empty) {
          const docData = existing.docs[0].data();
          setAnalysis({
            summary: docData.summary,
            topPriorities: docData.topPriorities || [],
            riskAlerts: docData.riskAlerts || [],
            behavioralInsights: docData.behavioralInsights || [],
            oneOnOneTalkingPoints: docData.oneOnOneTalkingPoints || [],
          });
          setLoading(false);
          return;
        }

        const result = await generatePersonalScorecardSummary(input);
        setAnalysis(result);
        
        const briefRef = collection(db, 'aiBriefs');
        await addDoc(briefRef, {
          userId,
          week: currentWeek,
          summary: result.summary,
          topPriorities: result.topPriorities,
          behavioralInsights: result.behavioralInsights,
          oneOnOneTalkingPoints: result.oneOnOneTalkingPoints,
          riskAlerts: result.riskAlerts,
          createdAt: serverTimestamp()
        });
        
        toast({
          title: "Weekly Snapshot Generated",
          description: "Intelligence brief archived for the remainder of the week."
        });
      } catch (error) {
        console.error("AI Coach failed", error);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, [input, userId, db, currentWeek, toast]);

  if (loading) return (
    <Card className="bg-primary/5 border-dashed border-primary/20">
      <CardContent className="py-12 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold uppercase tracking-widest text-primary/60">Retrieving Weekly Strategy Snapshot...</p>
      </CardContent>
    </Card>
  );

  if (!analysis) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="bg-primary text-primary-foreground border-none shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="w-24 h-24" />
        </div>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              AI Intelligence Brief
            </CardTitle>
            <Badge variant="outline" className="text-white/60 border-white/20 uppercase tracking-widest text-[9px] font-black">
              Week {currentWeek.split('-')[1]} • ARCHIVED SNAPSHOT
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-invert max-w-none text-sm leading-relaxed opacity-90 font-medium">
            {analysis.summary}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent mb-3 flex items-center gap-2">
                <Lightbulb className="w-3 h-3" /> Behavioral Insights
              </h4>
              <ul className="space-y-2">
                {analysis.behavioralInsights.map((insight, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Manager 1:1 Prep
              </h4>
              <ul className="space-y-2">
                {analysis.oneOnOneTalkingPoints.map((point, idx) => (
                  <li key={idx} className="text-xs italic opacity-80">"{point}"</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {analysis.riskAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2 uppercase tracking-tight">
              <AlertTriangle className="w-4 h-4" /> Deal Risk Vectors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.riskAlerts.map((risk, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-red-100 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-primary uppercase">{risk.dealName}</span>
                  <Badge variant={risk.riskLevel === 'HIGH' ? 'destructive' : 'secondary'} className="text-[9px] font-bold">
                    {risk.riskLevel} RISK
                  </Badge>
                </div>
                <p className="text-[11px] text-red-700 font-medium">{risk.reason}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground bg-slate-50 p-1.5 rounded">
                  <Target className="w-3 h-3" /> <span className="font-bold">MITIGATION:</span> {risk.mitigation}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
