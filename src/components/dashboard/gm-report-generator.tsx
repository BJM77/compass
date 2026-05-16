
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { FileText, Send, CheckCircle2, AlertCircle, Clock, Loader2, BarChart, Sparkles, Mail, Target, Phone, Calendar, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateExecutiveTeamSummary, ExecutiveTeamSummaryOutput } from '@/ai/flows/generate-executive-team-summary';
import { jsPDF } from "jspdf";

export function GMReportGenerator() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<ExecutiveTeamSummaryOutput | null>(null);
  const currentWeek = getCurrentWeek();

  const goalsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'weeklyGoals'), where('week', '==', currentWeek));
  }, [db, currentWeek]);
  const { data: teamGoals } = useCollection(goalsQuery);

  const statsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'bdmStats');
  }, [db]);
  const { data: teamStats } = useCollection(statsQuery);

  const pipelineQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek));
  }, [db, currentWeek]);
  const { data: teamPipeline } = useCollection(pipelineQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);
  const { data: users } = useCollection(usersQuery);

  const analytics = useMemo(() => {
    if (!teamGoals || !teamStats || !teamPipeline || !users) return null;
    
    const totalAppointments = teamPipeline.reduce((sum, r) => sum + (r.weeklyAppointments || 0), 0);
    const totalCalls = teamPipeline.reduce((sum, r) => sum + (r.weeklyCalls || 0), 0);
    const totalNewOpportunities = teamPipeline.reduce((sum, r) => sum + (r.weeklyNewOpportunities || 0), 0);

    return {
      totalAppointments,
      totalCalls,
      totalNewOpportunities
    };
  }, [teamGoals, teamStats, teamPipeline, users]);

  const runAIGeneration = async () => {
    if (!db || !analytics || !teamStats || !teamGoals || !users) return;
    setIsGenerating(true);

    try {
      const bdmData = teamStats.map(s => {
        const user = users.find(u => u.id === s.id);
        return {
          bdmName: user?.name || s.id,
          revenueYTD: s.revenueYTD || 0,
          target: s.target || 0,
          activityScore: s.activityScore || 0,
          behaviourScore: s.behaviourScore || 0,
          overallScore: s.overallScore || 0,
          recoveryStatus: (s.recoveryStatus as any) || 'ON_TRACK',
        };
      });

      const goalsData = teamGoals.map(g => {
        const user = users.find(u => u.id === g.userId);
        return {
          bdmName: user?.name || g.userId,
          goal: g.goal,
          status: g.status,
        };
      });

      const result = await generateExecutiveTeamSummary({
        week: currentWeek,
        teamActivity: {
          totalAppointments: analytics.totalAppointments,
          totalCalls: analytics.totalCalls,
          totalNewOpportunities: analytics.totalNewOpportunities
        },
        teamPerformanceData: bdmData,
        teamGoals: goalsData
      });

      setAiAnalysis(result);

      await addDocumentNonBlocking(collection(db, 'teamReports'), {
        week: currentWeek,
        generatedAt: serverTimestamp(),
        executiveSummary: result.executiveSummary,
        strategicAnalysis: result.strategicAnalysis,
        metrics: analytics
      });

      toast({
        title: "AI Review Generated",
        description: "The Friday GM Review has been synthesized."
      });
    } catch (error) {
      console.error("AI Generation failed", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Could not synthesize team data."
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPdf = () => {
    if (!aiAnalysis) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("EXECUTIVE PERFORMANCE PACK", margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`WEEK: ${currentWeek} • GENERATED: ${new Date().toLocaleString()}`, margin, y);
      
      y += 15;
      doc.setDrawColor(0);
      doc.line(margin, y, 190, y);
      y += 15;

      // Executive Summary
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("EXECUTIVE SUMMARY", margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const summaryLines = doc.splitTextToSize(aiAnalysis.executiveSummary, 170);
      doc.text(summaryLines, margin, y);
      y += (summaryLines.length * 5) + 15;

      // Strategic Analysis
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("STRATEGIC ANALYSIS", margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const analysisLines = doc.splitTextToSize(aiAnalysis.strategicAnalysis, 170);
      doc.text(analysisLines, margin, y);
      
      doc.save(`TGE_GM_Review_${currentWeek}.pdf`);
      toast({ title: "PDF Exported", description: "Governance document saved to local storage." });
    } catch (e) {
      toast({ variant: "destructive", title: "Export Failed" });
    } finally {
      setIsExporting(false);
    }
  };

  const openEmailToTed = () => {
    if (!aiAnalysis) return;
    const subject = encodeURIComponent(aiAnalysis.emailSubject);
    const body = encodeURIComponent(aiAnalysis.emailBody);
    window.open(`mailto:ted.butler@teamglobalexp.com?subject=${subject}&body=${body}`);
  };

  return (
    <Card className="border-none shadow-2xl bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b pb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2 font-black text-primary uppercase tracking-tight">
              <FileText className="w-5 h-5 text-accent" />
              Friday GM Review Hub
            </CardTitle>
            <CardDescription className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
              Aggregating weekly habits, outcomes, and territory gaps.
            </CardDescription>
          </div>
          <Badge className="bg-slate-900 text-white border-none uppercase tracking-widest text-[10px] font-black">Week {currentWeek.split('-')[1]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Appointments</p>
            <span className="text-3xl font-black text-primary">{analytics?.totalAppointments || 0}</span>
          </div>
          <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100/50">
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Weekly Calls</p>
            <span className="text-3xl font-black text-primary">{analytics?.totalCalls || 0}</span>
          </div>
          <div className="bg-accent/5 p-6 rounded-2xl border border-accent/10">
            <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">New Opps</p>
            <span className="text-3xl font-black text-primary">{analytics?.totalNewOpportunities || 0}</span>
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-8">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-accent" />
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Synthesizing performance data...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-accent uppercase tracking-widest">Executive Summary</p>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed bg-white p-6 rounded-2xl border shadow-sm h-full">
                      {aiAnalysis.executiveSummary}
                    </p>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Ted Butler (Email Draft)</p>
                     <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4 font-body">
                        <div className="border-b pb-2"><p className="text-[10px] font-bold text-muted-foreground">To: ted.butler@teamglobalexp.com</p><p className="text-xs font-bold mt-1">Sub: {aiAnalysis.emailSubject}</p></div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{aiAnalysis.emailBody}</p>
                     </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button className="flex-1 bg-accent font-black h-12 rounded-xl" onClick={openEmailToTed}><Mail className="w-4 h-4 mr-2" /> Dispatch Email</Button>
                  <Button variant="outline" className="flex-1 border-primary/20 font-black h-12 rounded-xl" onClick={exportToPdf} disabled={isExporting}>{isExporting ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4 mr-2" />} Export PDF Pack</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ready to automate the Friday GM review.</p>
                <Button className="mt-6 bg-primary font-black h-12 px-8 rounded-xl" onClick={runAIGeneration}>Automate Review</Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
