"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, AlertTriangle, Clock, Target, TrendingDown } from 'lucide-react';
import { computeMomentum } from '@/lib/momentum';
import { openSalesforceSearch } from '@/lib/utils';

export function AIDealWhisperer({ deals }: { deals: any[] }) {
  // Identify deals that need attention based on momentum rules
  const whispers = useMemo(() => {
    if (!deals || deals.length === 0) return [];

    const insights = [];

    for (const deal of deals) {
      if (deal.isBareAccount) continue; // Only process actual opportunities

      const m = computeMomentum({
        daysInStage: deal.daysInStage || 0,
        rolloverCount: deal.rolloverCount || 0,
        barrierText: deal.barriers || '',
        lastBarrierText: deal.lastBarrierText || ''
      });

      const valueFormatted = `$${((Number(deal.value) || 0) / 1000000).toFixed(2)}M`;

      // Generate context-aware suggestions
      if (m.score === 'DEAD') {
        insights.push({
          deal,
          type: 'CRITICAL',
          icon: <TrendingDown className="w-5 h-5 text-destructive" />,
          title: `Deal Flatlined: ${deal.pipeline}`,
          context: `Stuck in ${deal.stage || 'current stage'} for ${deal.daysInStage || 0} days with value ${valueFormatted}.`,
          suggestion: 'Recommend archiving to Closed-Lost to clean pipeline, or escalate immediately for GM intervention.'
        });
      } else if (m.score === 'STALLING') {
        insights.push({
          deal,
          type: 'WARNING',
          icon: <Clock className="w-5 h-5 text-warning" />,
          title: `Momentum Loss: ${deal.pipeline}`,
          context: `Rolled over ${deal.rolloverCount || 0} times. Value: ${valueFormatted}.`,
          suggestion: 'Schedule a technical validation or executive alignment call to unblock current barriers.'
        });
      } else if (deal.probability && Number(deal.probability) > 70 && (deal.daysInStage || 0) > 14) {
        // High probability but sitting too long
        insights.push({
          deal,
          type: 'OPPORTUNITY',
          icon: <Target className="w-5 h-5 text-info" />,
          title: `Close Imminent: ${deal.pipeline}`,
          context: `Probability is ${deal.probability}% but no movement in 14+ days.`,
          suggestion: 'Send a mutual close plan document to the prospect to finalize the timeline.'
        });
      }
    }

    return insights.sort((a, b) => {
      // Sort Critical first, then Warning, then Opportunity
      const order = { 'CRITICAL': 1, 'WARNING': 2, 'OPPORTUNITY': 3 };
      return order[a.type as keyof typeof order] - order[b.type as keyof typeof order];
    }).slice(0, 5); // Show top 5 insights

  }, [deals]);

  if (whispers.length === 0) return null;

  return (
    <Card className="border-none shadow-xl bg-gradient-to-br from-accent/10 to-chart-5/10 overflow-hidden">
      <CardHeader className="border-b bg-card/50 pb-4">
        <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2 text-primary">
          <Sparkles className="w-5 h-5 text-accent animate-pulse" />
          AI Deal Whisperer
        </CardTitle>
        <p className="text-xs font-bold text-accent/70 uppercase tracking-wide">
          Actionable intelligence based on pipeline momentum
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-accent/15">
          {whispers.map((whisper, idx) => (
            <div key={idx} className="p-5 hover:bg-card/60 transition-colors group">
              <div className="flex gap-4">
                <div className="shrink-0 mt-1">{whisper.icon}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">{whisper.title}</h4>
                    <Badge variant="outline" className={`text-xs font-semibold ${
                      whisper.type === 'CRITICAL' ? 'border-destructive/25 text-destructive bg-danger-soft' : 
                      whisper.type === 'WARNING' ? 'border-warning/25 text-warning-ink bg-warning-soft' : 
                      'border-info/25 text-info bg-info-soft'
                    }`}>
                      {whisper.type}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">{whisper.context}</p>
                  
                  <div className="mt-3 p-3 bg-card rounded-lg border border-accent/15 shadow-sm flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-primary leading-relaxed">
                        <span className="text-xs uppercase tracking-wide text-accent block mb-1">Suggested Action</span>
                        {whisper.suggestion}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => openSalesforceSearch(whisper.deal.pipeline, whisper.deal.salesforceId)}
                      className="bg-accent hover:bg-accent/90 text-xs h-8 shrink-0 shadow-md shadow-accent/20"
                    >
                      Act in CRM <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
