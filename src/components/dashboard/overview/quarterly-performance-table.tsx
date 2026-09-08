"use client";

import React, { useState } from 'react';
import { UserProfile } from '@/types/crm';
import { QuarterData } from '@/lib/quarterly-utils';
import { 
  Target, 
  ArrowUpCircle, 
  AlertCircle, 
  CheckCircle2, 
  PhoneCall, 
  CalendarCheck, 
  Trophy, 
  TrendingUp,
  LayoutGrid,
  Table as TableIcon,
  ShieldAlert,
  Award,
  ChevronDown,
  ChevronUp,
  Maximize2
} from 'lucide-react';
import { formatCurrency, formatEAV } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCurrentFinancialProgress, calculateYtdExpectedTarget } from '@/lib/quarterly-utils';

interface QuarterlyStats {
  appointments: number;
  calls: number;
  successfulDeals: number;
  revenue: number;
  targetRevenue: number;
}

interface UserQuarterData {
  user: UserProfile;
  q1: QuarterlyStats;
  q2: QuarterlyStats;
  q3: QuarterlyStats;
  q4: QuarterlyStats;
  ytdRevenue?: number;
  target?: number;
}

interface QuarterlyPerformanceTableProps {
  data: UserQuarterData[];
  year: number;
  referenceDate?: Date;
}

export function QuarterlyPerformanceTable({ data, year, referenceDate }: QuarterlyPerformanceTableProps) {
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');
  const [pacingMode, setPacingMode] = useState<'EXACT_DAY' | 'EOM' | 'WEEKLY'>('EXACT_DAY');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [modalUser, setModalUser] = useState<UserQuarterData | null>(null);
  const finProgress = getCurrentFinancialProgress(referenceDate);

  // Targets per Quarter
  const TARGET_CALLS = 120; // 40 per month
  const TARGET_APPTS = 108; // 36 per month

  const toggleExpand = (id: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatusColor = (actual: number, target: number) => {
    if (target === 0) return 'text-slate-900 font-semibold';
    const pct = actual / target;
    if (pct >= 1.0) return 'text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60';
    if (pct >= 0.85) return 'text-amber-700 font-black bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60';
    return 'text-rose-700 font-black bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60';
  };

  const getQuarterCardStyle = (stats: QuarterlyStats, isCurrent: boolean) => {
    if (isCurrent) return 'bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-400/40 shadow-xs';
    const hasActivity = stats.calls > 0 || stats.appointments > 0 || stats.successfulDeals > 0 || stats.revenue > 0;
    if (!hasActivity) return 'bg-slate-50/70 border-slate-100 text-slate-400';
    return 'bg-white border-slate-200 shadow-xs';
  };

  const renderQuarterCol = (stats: QuarterlyStats, isCurrent: boolean = false) => {
    return (
      <div className={`grid grid-cols-4 gap-2 text-xs text-right pr-4 border-r border-slate-200 last:border-r-0 ${isCurrent ? 'bg-indigo-50/30 font-semibold' : ''}`}>
        <div className={getStatusColor(stats.calls, TARGET_CALLS)}>{stats.calls || 0}</div>
        <div className={getStatusColor(stats.appointments, TARGET_APPTS)}>{stats.appointments || 0}</div>
        <div className="text-slate-800 font-bold">{stats.successfulDeals || 0}</div>
        <div className={getStatusColor(stats.revenue, stats.targetRevenue)}>{formatCurrency(stats.revenue || 0)}</div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden mb-8 print:shadow-none print:border-none">
      
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
              <Target className="w-5 h-5" />
            </span>
            <h3 className="font-black text-slate-900 tracking-tight text-base sm:text-lg uppercase">
              Quarterly Performance Breakdown (FY{year})
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Quarterly targets: Calls (120), Appointments (108), Revenue (Target ÷ 4) • Current: <strong className="text-indigo-600">{finProgress.currentQuarter}</strong> ({finProgress.monthName})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Legend */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-[10px] sm:text-[11px] font-bold tracking-tight">
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> &gt;100%
            </span>
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <AlertCircle className="w-3 h-3 text-amber-600" /> 85-99%
            </span>
            <span className="flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              <ArrowUpCircle className="w-3 h-3 text-rose-600" /> &lt;85%
            </span>
          </div>

          {/* Pacing Mode Toggle */}
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

          {/* View Mode Toggle (Hidden in Print) */}
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold print:hidden">
            <button
              onClick={() => setViewMode('CARDS')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === 'CARDS' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                viewMode === 'TABLE' ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* 1. DYNAMIC CARD VIEW (Optimal for Mobile & Interactive Layout) */}
      <div className={`p-4 sm:p-6 ${viewMode === 'TABLE' ? 'hidden print:hidden' : 'block print:hidden'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {data.map((row) => {
            const ytdRev = row.ytdRevenue ?? (row.q1.revenue + row.q2.revenue + row.q3.revenue + row.q4.revenue);
            const userTarget = row.target ?? ((row.user.target) || 1000000);
            const expectedYtdTarget = calculateYtdExpectedTarget(userTarget, referenceDate, pacingMode, row.user.manualYtdTarget);
            const attainmentPct = expectedYtdTarget > 0 ? (ytdRev / expectedYtdTarget) * 100 : 0;
            const totalCalls = row.q1.calls + row.q2.calls + row.q3.calls + row.q4.calls;
            const totalApps = row.q1.appointments + row.q2.appointments + row.q3.appointments + row.q4.appointments;
            const totalDeals = row.q1.successfulDeals + row.q2.successfulDeals + row.q3.successfulDeals + row.q4.successfulDeals;
            const userId = row.user.uid || (row.user as any).id || row.user.name;
            const isExpanded = expandedUsers.has(userId);

            const quarters: { label: string; range: string; stats: QuarterlyStats; isCurrent: boolean }[] = [
              { label: 'Q1', range: 'Apr - Jun', stats: row.q1, isCurrent: finProgress.currentQuarter === 'Q1' },
              { label: 'Q2', range: 'Jul - Sep', stats: row.q2, isCurrent: finProgress.currentQuarter === 'Q2' },
              { label: 'Q3', range: 'Oct - Dec', stats: row.q3, isCurrent: finProgress.currentQuarter === 'Q3' },
              { label: 'Q4', range: 'Jan - Mar', stats: row.q4, isCurrent: finProgress.currentQuarter === 'Q4' },
            ];

            return (
              <div 
                key={userId}
                className={`bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between ${
                  isExpanded ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-md' : 'border-slate-200 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Rep Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                      {row.user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-900 text-base leading-tight truncate">
                        {row.user.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider py-0 px-2 bg-slate-50 text-slate-600 border-slate-200">
                          {row.user.role?.replace('_', ' ')}
                        </Badge>
                        {row.user.territory && (
                          <span className="text-[10px] font-semibold text-slate-400 truncate">
                            • {row.user.territory}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* YTD Attainment Pill */}
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-black px-2.5 py-1 rounded-xl inline-block ${
                      attainmentPct >= 100 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : attainmentPct >= 85 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {attainmentPct.toFixed(1)}% Attained
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mt-1">
                      {formatEAV(ytdRev)} / {formatEAV(userTarget)}
                    </div>
                  </div>
                </div>

                {/* 4-Quarter Grid Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
                  {quarters.map((q) => (
                    <div 
                      key={q.label}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${getQuarterCardStyle(q.stats, q.isCurrent)}`}
                    >
                      <div className="flex justify-between items-center border-b border-slate-100/80 pb-1 mb-1.5">
                        <div className="flex items-center gap-1">
                          <span className="font-black text-xs text-slate-800">{q.label}</span>
                          {q.isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" title="Active Quarter" />
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">{q.range}</span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-slate-500">Calls:</span>
                          <span className={getStatusColor(q.stats.calls, TARGET_CALLS)}>
                            {q.stats.calls || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-slate-500">Appts:</span>
                          <span className={getStatusColor(q.stats.appointments, TARGET_APPTS)}>
                            {q.stats.appointments || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-slate-500">Deals:</span>
                          <span className="font-bold text-slate-800">{q.stats.successfulDeals || 0}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100/60">
                          <span className="text-[10px] font-semibold text-slate-500">Rev:</span>
                          <span className={`text-[11px] ${getStatusColor(q.stats.revenue, q.stats.targetRevenue)}`}>
                            {formatEAV(q.stats.revenue || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Card Footer Summary with Expand Button */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 font-semibold bg-slate-50/50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 px-4 sm:px-5 rounded-b-2xl">
                  <div className="flex items-center gap-3 text-slate-800 font-bold text-[11px] sm:text-xs">
                    <span>📞 {totalCalls} Calls</span>
                    <span>📅 {totalApps} Appts</span>
                    <span>🏆 {totalDeals} Deals</span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button
                      type="button"
                      onClick={() => toggleExpand(userId)}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors py-0.5 px-1.5 rounded hover:bg-indigo-50"
                    >
                      {isExpanded ? (
                        <>
                          <span>Less</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Detailed Run-Rates</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalUser(row)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 py-0.5 px-1.5 rounded hover:bg-slate-200/70"
                      title="Focus Modal"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Focus</span>
                    </button>
                  </div>
                </div>

                {/* Expanded Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-indigo-100/90 text-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-semibold text-slate-400 block">Calls Run-Rate</span>
                        <span className="font-black text-slate-900">{(totalCalls / Math.max(1, finProgress.financialMonthIndex)).toFixed(1)}/mo</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-semibold text-slate-400 block">Appts Run-Rate</span>
                        <span className="font-black text-slate-900">{(totalApps / Math.max(1, finProgress.financialMonthIndex)).toFixed(1)}/mo</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-semibold text-slate-400 block">Deals Closed</span>
                        <span className="font-black text-slate-900">{totalDeals} Won</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                        <span className="text-[10px] font-semibold text-slate-400 block">Avg Deal Size</span>
                        <span className="font-black text-slate-900">{totalDeals > 0 ? formatEAV(ytdRev / totalDeals) : '$0'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.length === 0 && (
          <div className="p-10 text-center text-slate-400 font-medium">
            No performance data found for the sales team.
          </div>
        )}
      </div>

      {/* 2. SPREADSHEET TABLE VIEW (Visible when Table selected, or for PDF Printing) */}
      <div className={`overflow-x-auto ${viewMode === 'TABLE' ? 'block' : 'hidden'} print:block`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
              <th className="p-3 whitespace-nowrap sticky left-0 bg-slate-100 border-r border-slate-200 z-10 w-48">
                Team Member
              </th>
              <th className={`p-3 text-center border-r border-slate-200 min-w-[260px] ${finProgress.currentQuarter === 'Q1' ? 'bg-indigo-50/50' : ''}`}>
                Q1 (Apr - Jun) {finProgress.currentQuarter === 'Q1' && <span className="text-indigo-600 font-black">• ACTIVE</span>}
                <div className="grid grid-cols-4 gap-2 text-[9px] mt-1 text-slate-500 font-bold">
                  <span className="text-right">Calls (120)</span>
                  <span className="text-right">Appts (108)</span>
                  <span className="text-right">Deals</span>
                  <span className="text-right">Revenue</span>
                </div>
              </th>
              <th className={`p-3 text-center border-r border-slate-200 min-w-[260px] ${finProgress.currentQuarter === 'Q2' ? 'bg-indigo-50/50' : ''}`}>
                Q2 (Jul - Sep) {finProgress.currentQuarter === 'Q2' && <span className="text-indigo-600 font-black">• ACTIVE</span>}
                <div className="grid grid-cols-4 gap-2 text-[9px] mt-1 text-slate-500 font-bold">
                  <span className="text-right">Calls (120)</span>
                  <span className="text-right">Appts (108)</span>
                  <span className="text-right">Deals</span>
                  <span className="text-right">Revenue</span>
                </div>
              </th>
              <th className={`p-3 text-center border-r border-slate-200 min-w-[260px] ${finProgress.currentQuarter === 'Q3' ? 'bg-indigo-50/50' : ''}`}>
                Q3 (Oct - Dec) {finProgress.currentQuarter === 'Q3' && <span className="text-indigo-600 font-black">• ACTIVE</span>}
                <div className="grid grid-cols-4 gap-2 text-[9px] mt-1 text-slate-500 font-bold">
                  <span className="text-right">Calls (120)</span>
                  <span className="text-right">Appts (108)</span>
                  <span className="text-right">Deals</span>
                  <span className="text-right">Revenue</span>
                </div>
              </th>
              <th className={`p-3 text-center min-w-[260px] ${finProgress.currentQuarter === 'Q4' ? 'bg-indigo-50/50' : ''}`}>
                Q4 (Jan - Mar) {finProgress.currentQuarter === 'Q4' && <span className="text-indigo-600 font-black">• ACTIVE</span>}
                <div className="grid grid-cols-4 gap-2 text-[9px] mt-1 text-slate-500 font-bold">
                  <span className="text-right">Calls (120)</span>
                  <span className="text-right">Appts (108)</span>
                  <span className="text-right">Deals</span>
                  <span className="text-right">Revenue</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={row.user.uid || row.user.name} className="hover:bg-slate-50 transition-colors group">
                <td className="p-3 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200 z-10">
                  <div className="font-black text-slate-900 text-sm whitespace-nowrap">{row.user.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">
                    {row.user.role?.replace('_', ' ')}
                  </div>
                </td>
                <td className="p-3 align-top">{renderQuarterCol(row.q1, finProgress.currentQuarter === 'Q1')}</td>
                <td className="p-3 align-top">{renderQuarterCol(row.q2, finProgress.currentQuarter === 'Q2')}</td>
                <td className="p-3 align-top">{renderQuarterCol(row.q3, finProgress.currentQuarter === 'Q3')}</td>
                <td className="p-3 align-top">{renderQuarterCol(row.q4, finProgress.currentQuarter === 'Q4')}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                  No performance data found for this financial year.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Focus Modal View for deep reading quarterly breakdown */}
      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg shadow-sm">
                    {modalUser.user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 px-2 bg-indigo-50 text-indigo-700 border-indigo-200">
                      {modalUser.user.role?.replace('_', ' ')}
                    </Badge>
                    <h3 className="font-black text-slate-900 text-xl mt-0.5">{modalUser.user.name}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setModalUser(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Q1 (Apr - Jun)', stats: modalUser.q1, isCurrent: finProgress.currentQuarter === 'Q1' },
                  { label: 'Q2 (Jul - Sep)', stats: modalUser.q2, isCurrent: finProgress.currentQuarter === 'Q2' },
                  { label: 'Q3 (Oct - Dec)', stats: modalUser.q3, isCurrent: finProgress.currentQuarter === 'Q3' },
                  { label: 'Q4 (Jan - Mar)', stats: modalUser.q4, isCurrent: finProgress.currentQuarter === 'Q4' }
                ].map((q, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3.5 rounded-2xl border ${
                      q.isCurrent ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2 pb-1 border-b border-slate-200/60">
                      <span className="font-black text-xs text-slate-900">{q.label}</span>
                      {q.isCurrent && <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">Active</span>}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Calls:</span>
                        <span className="font-bold text-slate-800">{q.stats.calls} / {TARGET_CALLS}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Appts:</span>
                        <span className="font-bold text-slate-800">{q.stats.appointments} / {TARGET_APPTS}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Deals:</span>
                        <span className="font-bold text-slate-800">{q.stats.successfulDeals}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500 font-medium">Revenue:</span>
                        <span className="font-black text-indigo-700">{formatCurrency(q.stats.revenue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Button 
                onClick={() => setModalUser(null)} 
                className="w-full bg-slate-900 text-white font-bold h-11 rounded-xl"
              >
                Close Performance View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



