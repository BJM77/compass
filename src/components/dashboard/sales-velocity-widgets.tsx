"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Target, Radar, AlertTriangle, ArrowUpRight, Flame } from 'lucide-react';
import { computeMomentum } from '@/lib/momentum';
import { Badge } from "@/components/ui/badge";

interface SalesVelocityWidgetsProps {
  teamStats: any[];
  allDeals: any[];
  totalRevenue: number;
}

export function SalesVelocityWidgets({ teamStats, allDeals, totalRevenue }: SalesVelocityWidgetsProps) {
  // 1. Revenue Tracker
  const { totalTarget, bdms } = useMemo(() => {
    let target = 0;
    const bdmList = teamStats?.filter(s => s.role === 'BDM' || s.role === 'ACCOUNT_MANAGER').map(bdm => {
      const bdmTarget = Number(bdm.target) || 0;
      target += bdmTarget;
      return { ...bdm, target: bdmTarget };
    }) || [];
    return { totalTarget: target, bdms: bdmList };
  }, [teamStats]);

  const revPercentage = totalTarget > 0 ? Math.min(100, (totalRevenue / totalTarget) * 100) : 0;

  // 2. Closing Radar (Top 3 Late Stage Deals)
  const closingRadar = useMemo(() => {
    const lateStages = ['Proposal', 'Negotiation', 'Verbal Commitment', 'Contracting'];
    return (allDeals || [])
      .filter(d => !d.isBareAccount && lateStages.includes(d.stage) && (Number(d.value) || 0) > 0)
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, 3);
  }, [allDeals]);

  // 3. Stalled Deals Alert
  const stalledDeals = useMemo(() => {
    return (allDeals || [])
      .filter(d => !d.isBareAccount && d.stage !== 'Closed Won' && d.stage !== 'Closed Lost')
      .map(deal => ({
        ...deal,
        momentum: computeMomentum({
          daysInStage: deal.daysInStage || 14,
          rolloverCount: deal.rolloverCount || 0,
          barrierText: deal.barriers || '',
          lastBarrierText: deal.lastBarrierText || ''
        })
      }))
      .filter(d => d.momentum.score === 'STALLING' || d.momentum.score === 'DEAD')
      .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
      .slice(0, 5); // Show top 5 stalled high-value deals
  }, [allDeals]);

  const formatM = (val: number) => `$${(val / 1000000).toFixed(2)}M`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Revenue Tracker */}
      <Card className="border-none shadow-xl bg-white overflow-hidden lg:col-span-12 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-green-500" />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-primary">
              <DollarSign className="w-5 h-5 text-green-500" /> Revenue vs. Target
            </CardTitle>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-800">{formatM(totalRevenue)}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team Target: {formatM(totalTarget)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
              <span>0%</span>
              <span className="text-green-600">{revPercentage.toFixed(1)}% Achieved</span>
              <span>100%</span>
            </div>
            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner relative">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000" 
                style={{ width: `${revPercentage}%` }} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Closing Radar */}
      <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden lg:col-span-6 relative">
        <div className="absolute top-0 right-0 p-6 opacity-5"><Radar className="w-32 h-32 text-accent" /></div>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-accent">
            <Radar className="w-4 h-4" /> Closing Radar
          </CardTitle>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Top 3 Late-Stage Deals</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {closingRadar.length === 0 ? (
            <p className="text-xs text-slate-500 font-bold uppercase py-4">No late-stage deals found.</p>
          ) : (
            closingRadar.map((deal, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-white uppercase truncate">{deal.pipeline}</p>
                  <p className="text-[10px] text-accent font-bold mt-0.5">{deal.userName} • {deal.stage}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-black text-green-400">${((Number(deal.value) || 0) / 1000).toFixed(0)}K</p>
                  <Badge variant="outline" className="text-[8px] bg-green-500/10 text-green-400 border-green-500/20 mt-1 uppercase">HOT</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Stalled Deals Alert */}
      <Card className="border-none shadow-xl bg-white overflow-hidden lg:col-span-6 relative border-2 border-red-500/10">
        <div className="absolute top-0 right-0 p-6 opacity-5"><AlertTriangle className="w-32 h-32 text-red-500" /></div>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-red-600">
            <Flame className="w-4 h-4" /> Stalled Deals
          </CardTitle>
          <p className="text-[10px] text-slate-400 font-bold uppercase">High-Value Opportunities Needing Action</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {stalledDeals.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold uppercase py-4">No stalled deals detected.</p>
          ) : (
            stalledDeals.map((deal, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100 hover:bg-red-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800 uppercase truncate">{deal.pipeline}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{deal.userName} • {deal.stage}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-black text-red-600">${((Number(deal.value) || 0) / 1000).toFixed(0)}K</p>
                  <Badge variant="outline" className={`text-[8px] mt-1 uppercase ${deal.momentum.bg} ${deal.momentum.color}`}>{deal.momentum.score}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
