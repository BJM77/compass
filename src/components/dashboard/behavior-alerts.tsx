
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, Target, Clock, Zap, ArrowUpRight, Loader2, Gauge } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function BehaviorAlerts({ stats, activities }: { stats?: any, activities?: any[] }) {
  const { profile } = useAuth();
  
  const alerts = [
    { 
      type: 'NUDGE', 
      title: 'Strategic Yield Audit', 
      desc: stats?.activityScore > 20 && (stats?.revenueYTD / stats?.activityScore) < 50000 
        ? 'High volume but low yield detected. Shift focus to Tier-1 expansion.' 
        : 'Strategic yield is within professional mastery range.', 
      icon: <Gauge className="w-4 h-4 text-warning" />,
      color: 'border-warning/30 bg-warning-soft/50'
    },
    { 
      type: 'URGENT', 
      title: 'Pipeline Risk', 
      desc: 'Significant stalling detected in Discovery stage. Fail fast or escalate.', 
      icon: <AlertCircle className="w-4 h-4 text-destructive" />,
      color: 'border-destructive/25 bg-danger-soft/50'
    },
    { 
      type: 'POSITIVE', 
      title: 'High Velocity Detected', 
      desc: 'Response time on discovery follow-ups is top 5% this week.', 
      icon: <Zap className="w-4 h-4 text-success" />,
      color: 'border-success/25 bg-success-soft/50'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Behavioral Pulse
        </h3>
        <Badge variant="outline" className="text-xs font-semibold border-primary/20 text-primary">LIVE</Badge>
      </div>
      
      <div className="grid gap-3">
        {alerts.map((alert, i) => (
          <div key={i} className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] ${alert.color}`}>
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                {alert.icon}
                <span className="text-xs font-semibold text-primary tracking-tight">{alert.title}</span>
              </div>
              <Badge className="text-xs font-semibold border-none tracking-tighter" variant="secondary">{alert.type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-bold leading-tight pl-6">{alert.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-primary rounded-2xl p-6 text-primary-foreground relative overflow-hidden mt-4 shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Target className="w-16 h-16" />
        </div>
        <p className="text-xs font-bold text-accent mb-1">Weekly Momentum Goal</p>
        <p className="text-lg font-bold leading-tight">Secure 2 more Pilot commitments before Friday review.</p>
        <div className="mt-4 flex items-center justify-between">
           <div className="flex items-center gap-1 text-xs font-bold text-white/60">
              <ArrowUpRight className="w-3 h-3" /> Trajectory: +12% vs LY
           </div>
           <Button size="sm" className="h-7 text-xs bg-accent font-semibold">LOG CALLS</Button>
        </div>
      </div>
    </div>
  );
}
