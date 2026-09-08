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
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 print:shadow-none print:border-none print:p-0">
      
      {/* Header & Calendar Position Strip */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Trophy className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-slate-900 tracking-tight text-base sm:text-lg uppercase">
                Target Attainment & Real-Time Pacing
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
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
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 bg-slate-50 p-1.5 px-2.5 sm:px-3 rounded-xl border border-slate-200/80 text-[11px] sm:text-xs font-bold">
            <div className="flex items-center gap-1 text-indigo-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Quarter: <strong className="text-slate-900">{finProgress.currentQuarter}</strong></span>
            </div>
            <span className="text-slate-300">•</span>
            <div className="flex items-center gap-1 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {finProgress.monthName} {finProgress.dayOfMonth}
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <span className="bg-indigo-100/70 text-indigo-800 px-1.5 py-0.5 rounded text-[10px] font-black">
              {currentElapsedPct.toFixed(1)}% FY Elapsed
            </span>
          </div>

          {/* Benchmark Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200 print:hidden">
            <button
              onClick={() => setPacingMode('EXACT_DAY')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                pacingMode === 'EXACT_DAY' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Actual Date
            </button>
            <button
              onClick={() => setPacingMode('EOM')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                pacingMode === 'EOM' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Month End (EOM)
            </button>
            <button
              onClick={() => setPacingMode('WEEKLY')}
              className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all ${
                pacingMode === 'WEEKLY' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
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
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
            : isAtRisk 
            ? 'text-amber-700 bg-amber-50 border-amber-200' 
            : 'text-rose-700 bg-rose-50 border-rose-200';

          const barFillColor = isAhead ? 'bg-emerald-500' : isAtRisk ? 'bg-amber-500' : 'bg-rose-500';
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
              className={`p-4 rounded-2xl bg-slate-50/60 border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                isExpanded ? 'border-indigo-300 ring-2 ring-indigo-500/10 bg-indigo-50/20 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              {/* Card Header: Rank, Name, Role, Pacing Status Pill */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    idx === 0 ? 'bg-amber-400 text-slate-950 shadow-xs' :
                    idx === 1 ? 'bg-slate-300 text-slate-800' :
                    idx === 2 ? 'bg-amber-700/60 text-white' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-slate-900 text-sm sm:text-base truncate block">{row.user.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 bg-white text-slate-500 border-slate-200">
                        {row.user.role?.replace('_', ' ')}
                      </Badge>
                      {row.user.territory && (
                        <span className="text-[10px] text-slate-400 font-semibold truncate">
                          • {row.user.territory}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0">
                  <div className={`text-xs font-black px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${paceColor}`}>
                    {isAhead ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    {row.paceAttainment.toFixed(1)}% Pace
                  </div>
                  <span className={`text-[10px] font-bold mt-1 ${row.varianceVsPace >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {row.varianceVsPace >= 0 ? `+${formatEAV(row.varianceVsPace)} ahead` : `-${formatEAV(Math.abs(row.varianceVsPace))} behind`}
                  </span>
                </div>
              </div>

              {/* Dual-Tier Visual Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="relative h-3 bg-slate-200/80 rounded-full overflow-hidden">
                  {/* Actual Fill */}
                  <div 
                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${barFillColor}`}
                    style={{ width: `${fillWidth}%` }}
                  />
                  {/* Paced Target Benchmark Line */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-slate-900/80 shadow-xs z-10"
                    style={{ left: `${paceBenchmarkWidth}%` }}
                    title={`Expected Benchmark: ${paceBenchmarkWidth.toFixed(1)}%`}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 pt-0.5">
                  <div>
                    <span>Actual YTD: </span>
                    <strong className="text-slate-900">{formatCurrency(row.ytdRevenue)}</strong>
                  </div>
                  <div>
                    <span>{row.user.manualYtdTarget ? 'YTD Override' : isExact ? 'Day Pace' : isEom ? 'EOM Target' : 'Weekly Target'}: </span>
                    <strong className="text-slate-700">{formatCurrency(row.expectedYtdTarget)}</strong>
                  </div>
                </div>
              </div>

              {/* Expand / Collapse Action Button Bar */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExpand(userId)}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors py-1 px-2 -ml-2 rounded-lg hover:bg-indigo-50/80"
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
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 rounded-lg hover:bg-slate-100"
                  title="Open full screen focus view"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Focus View</span>
                </button>
              </div>

              {/* Collapsible Detailed Metrics Drawer */}
              {isExpanded && (
                <div className="pt-3 border-t border-indigo-100/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block">Annual Target</span>
                      <span className="font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(row.target)}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block">Quarter Target</span>
                      <span className="font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(quarterlyTarget)}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block">Monthly Target</span>
                      <span className="font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(monthlyTarget)}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                      <span className="text-[10px] font-semibold text-slate-400 block">Remaining Quota</span>
                      <span className="font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(remainingAnnual)}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 font-semibold block">Full Annual Attainment:</span>
                      <span className="font-black text-slate-900 text-sm">{row.annualAttainment.toFixed(1)}% of {formatCurrency(row.target)}</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-slate-500 font-semibold block">Variance vs Run-Rate:</span>
                      <span className={`font-black text-sm ${row.varianceVsPace >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
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
          <div className="col-span-full text-center py-8 text-slate-400 font-medium">
            No sales staff target or performance data available.
          </div>
        )}
      </div>

      {/* Focus Modal View for deep reading */}
      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                  {modalUser.row.user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Rank #{modalUser.rank}</span>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-2 bg-indigo-50 text-indigo-700 border-indigo-200">
                      {modalUser.row.user.role?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <h3 className="font-black text-slate-900 text-xl">{modalUser.row.user.name}</h3>
                </div>
              </div>
              <button 
                onClick={() => setModalUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Current Pacing Attainment</span>
                  <span className="text-2xl font-black text-slate-900">{modalUser.row.paceAttainment.toFixed(1)}%</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">Pacing Variance</span>
                  <span className={`text-base font-black ${modalUser.row.varianceVsPace >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {modalUser.row.varianceVsPace >= 0 ? `+${formatCurrency(modalUser.row.varianceVsPace)}` : `-${formatCurrency(Math.abs(modalUser.row.varianceVsPace))}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 block">Actual YTD Spend</span>
                  <span className="text-base font-black text-indigo-700">{formatCurrency(modalUser.row.ytdRevenue)}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 block">Benchmark Target</span>
                  <span className="text-base font-black text-slate-800">{formatCurrency(modalUser.row.expectedYtdTarget)}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 block">Quarter Quota (Target ÷ 4)</span>
                  <span className="text-base font-black text-slate-800">{formatCurrency(modalUser.row.target / 4)}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 block">Full Annual Quota</span>
                  <span className="text-base font-black text-slate-800">{formatCurrency(modalUser.row.target)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button 
                onClick={() => setModalUser(null)} 
                className="w-full bg-slate-900 text-white font-bold h-11 rounded-xl"
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




