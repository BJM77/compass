
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
      icon: <Gauge className="w-4 h-4 text-orange-500" />,
      color: 'border-orange-200 bg-orange-50/50'
    },
    { 
      type: 'URGENT', 
      title: 'Pipeline Risk', 
      desc: 'Significant stalling detected in Discovery stage. Fail fast or escalate.', 
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      color: 'border-red-200 bg-red-50/50'
    },
    { 
      type: 'POSITIVE', 
      title: 'High Velocity Detected', 
      desc: 'Response time on discovery follow-ups is top 5% this week.', 
      icon: <Zap className="w-4 h-4 text-green-500" />,
      color: 'border-green-200 bg-green-50/50'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Behavioral Pulse
        </h3>
        <Badge variant="outline" className="text-[9px] font-black border-primary/20 text-primary">LIVE</Badge>
      </div>
      
      <div className="grid gap-3">
        {alerts.map((alert, i) => (
          <div key={i} className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] ${alert.color}`}>
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                {alert.icon}
                <span className="text-xs font-black text-primary uppercase tracking-tight">{alert.title}</span>
              </div>
              <Badge className="text-[8px] font-black border-none uppercase tracking-tighter" variant="secondary">{alert.type}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-bold leading-tight pl-6">{alert.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden mt-4 shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Target className="w-16 h-16" />
        </div>
        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Weekly Momentum Goal</p>
        <p className="text-lg font-black leading-tight">Secure 2 more Pilot commitments before Friday review.</p>
        <div className="mt-4 flex items-center justify-between">
           <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-white/60">
              <ArrowUpRight className="w-3 h-3" /> Trajectory: +12% vs LY
           </div>
           <Button size="sm" className="h-7 text-[10px] bg-accent font-black">LOG CALLS</Button>
        </div>
      </div>
    </div>
  );
}
