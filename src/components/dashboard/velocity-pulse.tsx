"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from "@/components/ui/badge";

interface VelocityPulseProps {
  teamStats: any[];
  teamActivity: any[];
}

export function VelocityPulse({ teamStats, teamActivity }: VelocityPulseProps) {
  
  const leaderboard = useMemo(() => {
    if (!teamStats) return [];
    
    return teamStats
      .filter(s => s.role === 'BDM' || s.role === 'ACCOUNT_MANAGER')
      .map(bdm => {
        const activity = teamActivity?.find(a => a.userId === bdm.id);
        
        // Calculate a rough velocity score (0-100) based on week targets
        const callsTarget = activity?.kpiTargets?.callsToMake || 50;
        const callsMade = activity?.actuals?.callsMade || 0;
        const callsScore = Math.min(100, (callsMade / callsTarget) * 100) || 0;
        
        const dealsTarget = activity?.kpiTargets?.dealsToClose || 2;
        const dealsClosed = activity?.actuals?.dealsClosed || 0;
        const dealsScore = Math.min(100, (dealsClosed / dealsTarget) * 100) || 0;
        
        const velocityScore = Math.round((callsScore * 0.4) + (dealsScore * 0.6));
        
        return {
          id: bdm.id,
          name: bdm.name || 'Unknown',
          territory: bdm.territory || 'Unassigned',
          velocityScore,
          callsMade,
          callsTarget,
          dealsClosed,
          dealsTarget
        };
      })
      .sort((a, b) => b.velocityScore - a.velocityScore);
  }, [teamStats, teamActivity]);

  return (
    <Card className="border-none shadow-2xl bg-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-blue-500 to-accent" />
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-accent/10 rounded-xl">
               <Zap className="w-5 h-5 text-accent animate-pulse" />
             </div>
             <div>
               <CardTitle className="text-xl font-black uppercase tracking-tight text-primary">Velocity Pulse</CardTitle>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Real-Time Gamification Leaderboard</p>
             </div>
          </div>
          <Badge className="bg-accent/10 text-accent hover:bg-accent/20 border-none font-black text-[10px] uppercase gap-1 px-3 py-1">
             <Activity className="w-3 h-3" /> LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {leaderboard.length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Awaiting Weekly Activity Data...</div>
          ) : leaderboard.map((bdm, idx) => (
            <div key={bdm.id} className="flex items-center gap-4 group">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${idx === 0 ? 'bg-orange-100 text-orange-600 scale-110 shadow-lg shadow-orange-200/50' : idx === 1 ? 'bg-slate-100 text-slate-600' : idx === 2 ? 'bg-slate-50/80 text-slate-500/80' : 'bg-slate-50 text-slate-400'}`}>
                {idx === 0 ? <Trophy className="w-4 h-4" /> : `#${idx + 1}`}
              </div>
              <div className="flex-1 space-y-1.5">
                 <div className="flex justify-between items-end">
                    <p className="text-xs font-black uppercase text-slate-800">{bdm.name} <span className="text-[9px] font-bold text-slate-400 ml-1">{bdm.territory}</span></p>
                    <p className={`text-[10px] font-black uppercase ${idx === 0 ? 'text-orange-600' : 'text-accent'}`}>{bdm.velocityScore} PTS</p>
                 </div>
                 <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`h-full transition-all duration-1000 ${bdm.velocityScore >= 80 ? 'bg-green-500' : bdm.velocityScore >= 50 ? 'bg-blue-500' : 'bg-slate-300'}`} 
                      style={{ width: `${Math.max(2, bdm.velocityScore)}%` }} 
                    />
                 </div>
                 <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Calls: {bdm.callsMade}/{bdm.callsTarget}</span>
                    <span>Deals: {bdm.dealsClosed}/{bdm.dealsTarget}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
