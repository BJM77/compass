"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";

interface VelocityPulseProps {
  teamStats: any[];
  teamActivity: any[];
  onSimulate?: (userId: string) => void;
}

export function VelocityPulse({ teamStats, teamActivity, onSimulate }: VelocityPulseProps) {
  
  const leaderboard = useMemo(() => {
    if (!teamStats) return [];
    
    return teamStats
      .filter(s => s.role === 'BDM' || s.role === 'ACCOUNT_MANAGER')
      .map(bdm => {
        // weeklyProgress doc id is {userId}_{week} — match by userId field
        const activity = teamActivity?.find(a => a.userId === bdm.id);
        
        // ActivityLogger writes flat fields: calls, apps, deals
        const callsTarget = 50;
        const callsMade  = Number(activity?.calls)  || 0;
        const callsScore = Math.min(100, (callsMade / callsTarget) * 100);
        
        const dealsTarget  = 2;
        const dealsClosed  = Number(activity?.deals) || 0;
        const dealsScore   = Math.min(100, (dealsClosed / dealsTarget) * 100);
        
        const velocityScore = Math.round((callsScore * 0.4) + (dealsScore * 0.6));
        
        const crmCalls = Number(activity?.crmCalls) || 0;
        const crmApps  = Number(activity?.crmApps)  || 0;
        
        return {
          id: bdm.id,
          name: bdm.name || 'Unknown',
          territory: bdm.territory || 'Unassigned',
          velocityScore,
          callsMade,
          callsTarget,
          dealsClosed,
          dealsTarget,
          apps: Number(activity?.apps) || 0,
          crmCalls,
          crmApps,
        };
      })
      .sort((a, b) => b.velocityScore - a.velocityScore);
  }, [teamStats, teamActivity]);

  return (
    <Card className="border-none shadow-2xl bg-card overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-accent to-accent" />
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-accent/10 rounded-xl">
               <Zap className="w-5 h-5 text-accent animate-pulse" />
             </div>
             <div>
               <CardTitle className="text-xl font-bold tracking-tight text-primary">Velocity Pulse</CardTitle>
               <p className="text-xs font-bold text-muted-foreground mt-1">Real-Time Gamification Leaderboard</p>
             </div>
          </div>
          <Badge className="bg-accent/10 text-accent hover:bg-accent/20 border-none font-semibold text-xs gap-1 px-3 py-1">
             <Activity className="w-3 h-3" /> LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-bold text-xs">Awaiting Weekly Activity Data...</div>
          ) : leaderboard.map((bdm, idx) => (
            <div 
              key={bdm.id} 
              className={`flex items-center gap-4 group rounded-xl p-2 transition-colors ${onSimulate ? 'hover:bg-secondary/60 cursor-pointer' : ''}`}
              onClick={() => onSimulate?.(bdm.id)}
            >
              <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold text-xs transition-all duration-300 ${idx === 0 ? 'bg-warning-soft text-warning-ink scale-110 shadow-lg shadow-primary/15' : idx === 1 ? 'bg-secondary text-foreground/75' : idx === 2 ? 'bg-secondary/60 text-muted-foreground/80' : 'bg-secondary/60 text-muted-foreground'}`}>
                {idx === 0 ? <Trophy className="w-4 h-4" /> : `#${idx + 1}`}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                 <div className="flex justify-between items-end gap-2">
                    <div className={`text-xs font-semibold truncate transition-colors ${onSimulate ? 'group-hover:text-accent' : 'text-foreground'}`}>
                      {bdm.name} <span className="text-xs font-bold text-muted-foreground ml-1">{bdm.territory}</span>
                    </div>
                    <p className={`text-xs font-semibold shrink-0 ${idx === 0 ? 'text-warning-ink' : 'text-accent'}`}>{bdm.velocityScore} PTS</p>
                 </div>
                 <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ${bdm.velocityScore >= 80 ? 'bg-success-fill' : bdm.velocityScore >= 50 ? 'bg-accent' : 'bg-border'}`} 
                      style={{ width: `${Math.max(2, bdm.velocityScore)}%` }} 
                    />
                 </div>
                 <div className="flex justify-between text-xs font-bold text-muted-foreground gap-2">
                    <span className="truncate">Calls: {bdm.crmCalls} <span className="text-xs opacity-75">(Man: {bdm.callsMade})</span></span>
                    <span className="truncate">Apps: {bdm.crmApps} <span className="text-xs opacity-75">(Man: {bdm.apps})</span></span>
                    <span className="truncate">Deals: {bdm.dealsClosed}/{bdm.dealsTarget}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
