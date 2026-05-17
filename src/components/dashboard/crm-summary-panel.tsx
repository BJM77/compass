"use client";

import { CRMUserSummary, CRMTeamSummary } from '@/hooks/use-crm-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Briefcase, Users, DollarSign, TrendingUp, TrendingDown,
  BarChart3, Loader2, ChevronRight
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(val: number, decimals = 1): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(decimals)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

function yoyBadge(thisFY: number, lastFY: number) {
  if (!lastFY) return null;
  const pct = ((thisFY - lastFY) / lastFY) * 100;
  const positive = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full ${positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ─── Summary Column (My / Team) ───────────────────────────────────────────────
function SummaryColumn({
  label, data, accent = false
}: {
  label: string;
  data: CRMUserSummary;
  accent?: boolean;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-4 space-y-4 ${accent ? 'bg-primary/5 border border-primary/10' : 'bg-slate-50 border border-slate-100'}`}>
      <p className={`text-[9px] font-black uppercase tracking-widest ${accent ? 'text-primary' : 'text-slate-500'}`}>{label}</p>

      {/* Opportunities */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Briefcase className="w-3 h-3 text-accent" />
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Opportunities</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">Count</span>
          <span className="text-sm font-black text-primary">{data.opportunityCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">Pipeline Value</span>
          <span className="text-sm font-black text-primary">{fmt(data.opportunityValue)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev FY</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-black">{fmt(data.oppYTDRevenueThisFY)}</span>
            {yoyBadge(data.oppYTDRevenueThisFY, data.oppYTDRevenueLastFY)}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev LY</span>
          <span className="text-xs font-bold text-slate-400">{fmt(data.oppYTDRevenueLastFY)}</span>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Users className="w-3 h-3 text-blue-500" />
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Accounts</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">Total Accounts</span>
          <span className="text-sm font-black text-primary">{data.customerCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev FY</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-black">{fmt(data.custYTDRevenueThisFY)}</span>
            {yoyBadge(data.custYTDRevenueThisFY, data.custYTDRevenueLastFY)}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev LY</span>
          <span className="text-xs font-bold text-slate-400">{fmt(data.custYTDRevenueLastFY)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Per-user breakdown row (leaders only) ────────────────────────────────────
function UserRow({ u }: { u: CRMUserSummary }) {
  const yoy = u.custYTDRevenueLastFY
    ? ((u.custYTDRevenueThisFY - u.custYTDRevenueLastFY) / u.custYTDRevenueLastFY) * 100
    : null;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 font-black text-[10px] uppercase text-primary whitespace-nowrap">
        {u.userName}
      </td>
      <td className="px-4 py-3 text-center text-xs font-bold">{u.opportunityCount}</td>
      <td className="px-4 py-3 text-right text-xs font-bold">{fmt(u.opportunityValue)}</td>
      <td className="px-4 py-3 text-center text-xs font-bold">{u.customerCount}</td>
      <td className="px-4 py-3 text-right text-xs font-bold">{fmt(u.custYTDRevenueThisFY)}</td>
      <td className="px-4 py-3 text-right text-xs font-bold text-slate-400">{fmt(u.custYTDRevenueLastFY)}</td>
      <td className="px-4 py-3 text-right">
        {yoy !== null ? (
          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${yoy >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}%
          </span>
        ) : (
          <span className="text-slate-300 text-[9px]">–</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
interface CRMSummaryPanelProps {
  summary: CRMTeamSummary;
  showAllUsers?: boolean;   // true for leaders/GMs
  currentWeek: string;
}

export function CRMSummaryPanel({ summary, showAllUsers = false, currentWeek }: CRMSummaryPanelProps) {
  if (summary.isLoading) {
    return (
      <Card className="border-none shadow-xl bg-white">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasData = summary.team.opportunityCount > 0 || summary.team.customerCount > 0;

  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden">
      <CardHeader className="bg-slate-900 text-white pb-4 pt-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/20 rounded-xl">
              <BarChart3 className="w-4 h-4 text-accent" />
            </div>
            <div>
              <CardTitle className="text-base font-black tracking-tight">CRM Performance Summary</CardTitle>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Opportunities &amp; Account Management · Week {currentWeek.split('-')[1]}
              </p>
            </div>
          </div>
          {!hasData && (
            <Badge className="bg-amber-500/20 text-amber-400 border-none text-[9px] font-black">
              No CRM data imported yet
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* My + Team side-by-side columns */}
        <div className="flex flex-col sm:flex-row gap-4">
          {summary.myStats && (
            <SummaryColumn label="My Performance" data={summary.myStats} accent />
          )}
          <SummaryColumn label="Team Combined" data={summary.team} />
        </div>

        {/* Per-user breakdown — leaders/GMs only */}
        {showAllUsers && summary.byUser.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-accent" />
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Individual Breakdown</p>
            </div>
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
              <ScrollArea className="max-h-72">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[8px] font-black uppercase tracking-widest border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5 text-left">BDM / AM</th>
                      <th className="px-4 py-2.5 text-center">Opps</th>
                      <th className="px-4 py-2.5 text-right">Pipeline $</th>
                      <th className="px-4 py-2.5 text-center">Accts</th>
                      <th className="px-4 py-2.5 text-right">YTD FY</th>
                      <th className="px-4 py-2.5 text-right">YTD LY</th>
                      <th className="px-4 py-2.5 text-right">YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byUser.map(u => <UserRow key={u.userId} u={u} />)}
                  </tbody>
                  {/* Team total footer */}
                  <tfoot className="bg-primary text-white text-[9px] font-black uppercase">
                    <tr>
                      <td className="px-4 py-3">TEAM TOTAL</td>
                      <td className="px-4 py-3 text-center">{summary.team.opportunityCount}</td>
                      <td className="px-4 py-3 text-right">{fmt(summary.team.opportunityValue)}</td>
                      <td className="px-4 py-3 text-center">{summary.team.customerCount}</td>
                      <td className="px-4 py-3 text-right">{fmt(summary.team.custYTDRevenueThisFY)}</td>
                      <td className="px-4 py-3 text-right">{fmt(summary.team.custYTDRevenueLastFY)}</td>
                      <td className="px-4 py-3 text-right">
                        {summary.team.custYTDRevenueLastFY > 0 ? (
                          <span>
                            {((summary.team.custYTDRevenueThisFY - summary.team.custYTDRevenueLastFY) / summary.team.custYTDRevenueLastFY * 100).toFixed(1)}%
                          </span>
                        ) : '–'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </ScrollArea>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
