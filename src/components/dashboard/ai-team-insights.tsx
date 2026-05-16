"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle, TrendingUp, Trophy, Map } from 'lucide-react';
import { generateExecutiveTeamSummary, ExecutiveTeamSummaryInput, ExecutiveTeamSummaryOutput } from '@/ai/flows/generate-executive-team-summary';
import { Badge } from '@/components/ui/badge';

interface AITeamInsightsProps {
  input: ExecutiveTeamSummaryInput;
}

export function AITeamInsights({ input }: AITeamInsightsProps) {
  const [analysis, setAnalysis] = useState<ExecutiveTeamSummaryOutput | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const result = await generateExecutiveTeamSummary(input);
      setAnalysis(result);
    } catch (error) {
      console.error("AI Analysis failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-primary text-primary-foreground overflow-hidden">
      <CardHeader className="border-b border-white/10 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            AI Executive Intelligence
          </CardTitle>
          <p className="text-xs text-primary-foreground/70 font-medium">Strategic Territory Performance Analysis</p>
        </div>
        {!analysis && (
          <Button 
            onClick={runAnalysis} 
            disabled={loading}
            className="bg-accent text-white hover:bg-accent/90"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Insights
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-accent" />
            <p className="text-sm font-medium animate-pulse">Deep-diving into territory revenue trends & risk vectors...</p>
          </div>
        ) : analysis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Executive Summary
                </h4>
                <p className="text-sm leading-relaxed opacity-90">{analysis.executiveSummary}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Top Performers
                </h4>
                <div className="space-y-3">
                  {analysis.topPerformers.map((tp, idx) => (
                    <div key={idx} className="bg-white/5 p-3 rounded-lg border border-white/10">
                      <p className="text-sm font-bold">{tp.name}</p>
                      <p className="text-xs opacity-70 mt-1">{tp.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                  <Map className="w-4 h-4" /> Team-Wide Trends
                </h4>
                <p className="text-sm leading-relaxed opacity-90">{analysis.strategicAnalysis}</p>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Risk & Mitigation
                </h4>
                <p className="text-sm leading-relaxed opacity-90">{analysis.potentialRisks}</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setAnalysis(null)}
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Refresh Analysis
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
            <Sparkles className="w-12 h-12 text-accent mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium opacity-60">Ready to synthesize team performance data into strategic insights?</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
