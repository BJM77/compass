"use client";

import React, { useState } from 'react';
import { UserProfile } from '@/types/crm';
import { 
  Trophy, 
  TrendingUp, 
  Target, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Maximize2 
} from 'lucide-react';
import { formatCurrency, formatEAV } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCurrentFinancialProgress, calculateYtdExpectedTarget } from '@/lib/quarterly-utils';

export interface AttainmentData {
  user: UserProfile;
  ytdRevenue: number;
  target: number;
}

interface DetailedRepStats {
  row: AttainmentData & {
    expectedYtdTarget: number;
    paceAttainment: number;
    annualAttainment: number;
    varianceVsPace: number;
  };
  rank: number;
}

export function TargetAttainment({ data, referenceDate }: { data: AttainmentData[], referenceDate?: Date }) {
  const [pacingMode, setPacingMode] = useState<'EXACT_DAY' | 'EOM' | 'WEEKLY'>('EXACT_DAY');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [modalUser, setModalUser] = useState<DetailedRepStats | null>(null);
  const finProgress = getCurrentFinancialProgress(referenceDate);

  const isExact = pacingMode === 'EXACT_DAY';
  const isEom = pacingMode === 'EOM';
  const isWeekly = pacingMode === 'WEEKLY';
  
  const currentElapsedMonths = isExact ? finProgress.exactElapsedMonths : isEom ? finProgress.financialMonthIndex : finProgress.completedWeeks / (52/12);
  const currentElapsedPct = isExact ? finProgress.yearProgressPct : isEom ? finProgress.eomYearProgressPct : finProgress.weeklyYearProgressPct;

  const sortedData = [...data].map(row => {
    const userTarget = row.target > 0 ? row.target : 1000000;
    const expectedYtdTarget = calculateYtdExpectedTarget(userTarget, referenceDate, pacingMode, row.user.manualYtdTarget);
    
    // Safety check - avoid division by zero
    const paceAttainment = expectedYtdTarget > 0 ? (row.ytdRevenue / expectedYtdTarget) * 100 : 0;
    const annualAttainment = userTarget > 0 ? (row.ytdRevenue / userTarget) * 100 : 0;
    const varianceVsPace = row.ytdRevenue - expectedYtdTarget;

    return {
      ...row,
      target: userTarget,
      expectedYtdTarget,
      paceAttainment,
      annualAttainment,
      varianceVsPace
    };
  }).sort((a, b) => b.paceAttainment - a.paceAttainment);

  const toggleExpand = (id: string) => {
    setExpandedUser(prev => prev === id ? null : id);
  };

  return (
    <div className="bg-card rounded-2xl shadow-xs border border-border p-4 sm:p-6 print:shadow-none print:border-none print:p-0">
      
      {/* Header & Calendar Position Strip */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-warning-soft text-warning-ink rounded-xl">
              <Trophy className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-foreground tracking-tight text-base sm:text-lg uppercase">
                Target Attainment & Real-Time Pacing
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {isExact 
                  ? `Day-Exact run rate benchmark prorated to ${finProgress.monthName} ${finProgress.dayOfMonth} (${finProgress.dayOfMonth} of ${finProgress.daysInCurrentMonth} days).` 
                  : isEom ? `Full Month-End (EOM) target benchmark for Month ${finProgress.financialMonthIndex} of 12 (${finProgress.monthName}).`
                  : `Weekly target benchmark for Week ${finProgress.completedWeeks} of 52.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Current Quarter & Month Indicators */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-secondary/60 p-1.5 px-2.5 sm:px-3 rounded-xl border border-border/80 text-[11px] sm:text-xs font-bold">
            <div className="flex items-center gap-1 text-primary">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Quarter: <strong className="text-foreground">{finProgress.currentQuarter}</strong></span>
            </div>
            <span className="text-muted-foreground/70">•</span>
            <div className="flex items-center gap-1 text-foreground/75">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {finProgress.monthName} {finProgress.dayOfMonth}
              </span>
            </div>
            <span className="text-muted-foreground/70">•</span>
            <span className="bg-accent/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-black">
              {currentElapsedPct.toFixed(1)}% FY Elapsed
            </span>
          </div>

          {/* Benchmark Mode Switcher */}
          <div className="flex items-center bg-secondary p-1 rounded-xl text-xs font-bold border border-border print:hidden">
            <button
              onClick={() => setPacingMode('EXACT_DAY')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                pacingMode === 'EXACT_DAY' ? 'bg-card text-accent shadow-xs font-black' : 'text-foreground/75 hover:text-foreground'
              }`}
            >
              Actual Date
            </button>
            <button
              onClick={() => setPacingMode('EOM')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                pacingMode === 'EOM' ? 'bg-card text-accent shadow-xs font-black' : 'text-foreground/75 hover:text-foreground'
              }`}
            >
              Month End (EOM)
            </button>
            <button
              onClick={() => setPacingMode('WEEKLY')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                pacingMode === 'WEEKLY' ? 'bg-card text-accent shadow-xs font-black' : 'text-foreground/75 hover:text-foreground'
              }`}
              title="Use this if revenue data is uploaded weekly (up to end of previous week)"
            >
              Previous Week
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Rep Pacing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedData.map((row, idx) => {
          const isAhead = row.paceAttainment >= 100;
          const isAtRisk = row.paceAttainment >= 85 && row.paceAttainment < 100;

          const paceColor = isAhead 
            ? 'text-success-ink bg-success-soft border-success/25' 
            : isAtRisk 
            ? 'text-warning-ink bg-warning-soft border-warning/25' 
            : 'text-destructive bg-danger-soft border-destructive/25';

          const barFillColor = isAhead ? 'bg-success-fill' : isAtRisk ? 'bg-warning' : 'bg-destructive';
          const fillWidth = Math.min(100, Math.max(0, row.annualAttainment));
          const paceBenchmarkWidth = Math.min(100, Math.max(0, currentElapsedPct));
          const userId = row.user.uid || (row.user as any).id || row.user.name;
          const isExpanded = expandedUser === userId;

          const monthlyTarget = row.target / 12;
          const quarterlyTarget = row.target / 4;
          const remainingAnnual = Math.max(0, row.target - row.ytdRevenue);

          return (
            <div 
              key={userId} 
              className={`p-4 rounded-2xl bg-secondary/35 border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                isExpanded ? 'border-accent/40 ring-2 ring-accent/10 bg-accent/5 shadow-sm' : 'border-border/80 hover:border-border'
              }`}
            >
              {/* Card Header: Rank, Name, Role, Pacing Status Pill */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    idx === 0 ? 'bg-warning/80 text-foreground shadow-xs' :
                    idx === 1 ? 'bg-border text-foreground' :
                    idx === 2 ? 'bg-warning/55 text-warning-foreground' :
                    'bg-border text-foreground/75'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-foreground text-sm sm:text-base truncate block">{row.user.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 bg-card text-muted-foreground border-border">
                        {row.user.role?.replace('_', ' ')}
                      </Badge>
                      {row.user.territory && (
                        <span className="text-[10px] text-muted-foreground font-semibold truncate">
                          • {row.user.territory}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0">
                  <div className={`text-xs font-black px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${paceColor}`}>
                    {isAhead ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                    )}
                    {row.paceAttainment.toFixed(1)}% Pace
                  </div>
                  <span className={`text-[10px] font-bold mt-1 ${row.varianceVsPace >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {row.varianceVsPace >= 0 ? `+${formatEAV(row.varianceVsPace)} ahead` : `-${formatEAV(Math.abs(row.varianceVsPace))} behind`}
                  </span>
                </div>
              </div>

              {/* Dual-Tier Visual Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="relative h-3 bg-border/80 rounded-full overflow-hidden">
                  {/* Actual Fill */}
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${barFillColor}`}
                    style={{ width: `${fillWidth}%` }}
                  />
                  {/* Paced Target Benchmark Line */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-panel/80 shadow-xs z-10"
                    style={{ left: `${paceBenchmarkWidth}%` }}
                    title={`Expected Benchmark: ${paceBenchmarkWidth.toFixed(1)}%`}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground pt-0.5">
                  <div>
                    <span>Actual YTD: </span>
                    <strong className="text-foreground">{formatCurrency(row.ytdRevenue)}</strong>
                  </div>
                  <div>
                    <span>{row.user.manualYtdTarget ? 'YTD Override' : isExact ? 'Day Pace' : isEom ? 'EOM Target' : 'Weekly Target'}: </span>
                    <strong className="text-foreground/85">{formatCurrency(row.expectedYtdTarget)}</strong>
                  </div>
                </div>
              </div>

              {/* Expand / Collapse Action Button Bar */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExpand(userId)}
                  className="flex items-center gap-1 text-xs font-bold text-accent hover:text-primary transition-colors py-1 px-2 -ml-2 rounded-lg hover:bg-accent/10"
                >
                  {isExpanded ? (
                    <>
                      <span>Collapse Breakdown</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Expand Rep Details</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setModalUser({ row, rank: idx + 1 })}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-secondary"
                  title="Open full screen focus view"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Focus View</span>
                </button>
              </div>

              {/* Collapsible Detailed Metrics Drawer */}
              {isExpanded && (
                <div className="pt-3 border-t border-accent/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-card rounded-xl border border-border/80">
                      <span className="text-[10px] font-semibold text-muted-foreground block">Annual Target</span>
                      <span className="font-black text-foreground text-xs sm:text-sm">{formatCurrency(row.target)}</span>
                    </div>
                    <div className="p-2 bg-card rounded-xl border border-border/80">
                      <span className="text-[10px] font-semibold text-muted-foreground block">Quarter Target</span>
                      <span className="font-black text-foreground text-xs sm:text-sm">{formatCurrency(quarterlyTarget)}</span>
                    </div>
                    <div className="p-2 bg-card rounded-xl border border-border/80">
                      <span className="text-[10px] font-semibold text-muted-foreground block">Monthly Target</span>
                      <span className="font-black text-foreground text-xs sm:text-sm">{formatCurrency(monthlyTarget)}</span>
                    </div>
                    <div className="p-2 bg-card rounded-xl border border-border/80">
                      <span className="text-[10px] font-semibold text-muted-foreground block">Remaining Quota</span>
                      <span className="font-black text-foreground text-xs sm:text-sm">{formatCurrency(remainingAnnual)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/80 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">Full Annual Attainment:</span>
                      <span className="font-black text-foreground text-sm">{row.annualAttainment.toFixed(1)}% of {formatCurrency(row.target)}</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-muted-foreground font-semibold block">Variance vs Run-Rate:</span>
                      <span className={`font-black text-sm ${row.varianceVsPace >= 0 ? 'text-success-ink' : 'text-destructive'}`}>
                        {row.varianceVsPace >= 0 ? `+${formatCurrency(row.varianceVsPace)}` : `-${formatCurrency(Math.abs(row.varianceVsPace))}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sortedData.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground font-medium">
            No sales staff target or performance data available.
          </div>
        )}
      </div>

      {/* Focus Modal View for deep reading */}
      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-panel/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-border/60 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-accent text-accent-foreground font-black flex items-center justify-center text-lg shadow-sm">
                  {modalUser.row.user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">Rank #{modalUser.rank}</span>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-2 bg-accent/10 text-primary border-accent/25">
                      {modalUser.row.user.role?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <h3 className="font-black text-foreground text-xl">{modalUser.row.user.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => setModalUser(null)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground/85 hover:bg-secondary transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-secondary/60 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block">Current Pacing Attainment</span>
                  <span className="text-2xl font-black text-foreground">{modalUser.row.paceAttainment.toFixed(1)}%</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-muted-foreground block">Pacing Variance</span>
                  <span className={`text-base font-black ${modalUser.row.varianceVsPace >= 0 ? 'text-success-ink' : 'text-destructive'}`}>
                    {modalUser.row.varianceVsPace >= 0 ? `+${formatCurrency(modalUser.row.varianceVsPace)}` : `-${formatCurrency(Math.abs(modalUser.row.varianceVsPace))}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-secondary/60 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-muted-foreground block">Actual YTD Spend</span>
                  <span className="text-base font-black text-primary">{formatCurrency(modalUser.row.ytdRevenue)}</span>
                </div>
                <div className="p-3.5 bg-secondary/60 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-muted-foreground block">Benchmark Target</span>
                  <span className="text-base font-black text-foreground">{formatCurrency(modalUser.row.expectedYtdTarget)}</span>
                </div>
                <div className="p-3.5 bg-secondary/60 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-muted-foreground block">Quarter Quota (Target ÷ 4)</span>
                  <span className="text-base font-black text-foreground">{formatCurrency(modalUser.row.target / 4)}</span>
                </div>
                <div className="p-3.5 bg-secondary/60 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-muted-foreground block">Full Annual Quota</span>
                  <span className="text-base font-black text-foreground">{formatCurrency(modalUser.row.target)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={() => setModalUser(null)} 
                className="w-full bg-panel text-panel-foreground font-bold h-11 rounded-xl"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




