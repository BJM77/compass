"use client";

import { useState } from 'react';
import { CRMUserSummary, CRMTeamSummary } from '@/hooks/use-crm-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table as UiTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Briefcase, Users, DollarSign, TrendingUp, TrendingDown,
  BarChart3, Loader2, ChevronRight, Eye
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

// ─── Records Inspection Modal ────────────────────────────────────────────────
function RecordsModal({
  isOpen,
  onClose,
  title,
  subtitle,
  records,
  type,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  records: any[];
  type: 'OPP' | 'CUST' | 'USER';
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white border-slate-200 shadow-2xl rounded-3xl h-[75vh] max-h-[75vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="text-xl font-black text-primary tracking-tight flex items-center gap-2 uppercase">
            {type === 'OPP' ? <Briefcase className="w-5 h-5 text-accent" /> : <Users className="w-5 h-5 text-blue-500" />}
            {title} ({records.length})
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            {subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden my-2">
          <ScrollArea className="h-full w-full pr-4">
            <UiTable className="text-xs">
            <TableHeader>
              <TableRow className="uppercase text-[9px] font-black tracking-widest bg-slate-50 sticky top-0 z-10">
                <TableHead>Account / Customer</TableHead>
                <TableHead>Owner</TableHead>
                {type !== 'CUST' && <TableHead>Opportunity / Stage</TableHead>}
                {type !== 'CUST' && <TableHead className="text-right">Pipeline $</TableHead>}
                <TableHead className="text-right">YTD Rev FY</TableHead>
                <TableHead className="text-right">YTD Rev LY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r, idx) => (
                <TableRow key={r.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-black text-primary">
                    <div>{r.pipeline || r.accountName || r.accountMasterCode}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">{r.businessUnit || r.accountMasterCode}</div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-600">{r.userName || r.userId}</TableCell>
                  {type !== 'CUST' && (
                    <TableCell>
                      <div className="font-bold text-slate-800 truncate max-w-[200px]">{r.opportunityName || '—'}</div>
                      <Badge variant="outline" className="text-[8px] uppercase font-black bg-slate-100 text-slate-700 mt-0.5">
                        {r.stage || '—'}
                      </Badge>
                    </TableCell>
                  )}
                  {type !== 'CUST' && (
                    <TableCell className="text-right font-black text-accent">
                      {fmt(Number(r.value) || 0)}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-black text-emerald-600">
                    {fmt(Number(r.currentRevenue) || 0)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-400">
                    {fmt(Number(r.lastYearRevenue) || 0)}
                  </TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={type === 'CUST' ? 4 : 6} className="text-center py-12 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                    No matching records available for inspection.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </UiTable>
        </ScrollArea>
      </div>
    </DialogContent>
  </Dialog>
);
}

// ─── Summary Column (My / Team) ───────────────────────────────────────────────
function SummaryColumn({
  label, data, accent = false, onInspect
}: {
  label: string;
  data: CRMUserSummary;
  accent?: boolean;
  onInspect: (type: 'OPP' | 'CUST', title: string, subtitle: string, records: any[]) => void;
}) {
  return (
    <div className={`flex-1 rounded-2xl p-4 space-y-4 ${accent ? 'bg-primary/5 border border-primary/10' : 'bg-slate-50 border border-slate-100'}`}>
      <p className={`text-[9px] font-black uppercase tracking-widest ${accent ? 'text-primary' : 'text-slate-500'}`}>{label}</p>

      {/* Opportunities */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3 h-3 text-accent" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Opportunities</span>
          </div>
          <button
            onClick={() => onInspect('OPP', `${label} Opportunities`, 'Active Sales Stages', data.oppRecords)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-accent hover:underline bg-accent/10 px-2 py-0.5 rounded-md transition-all"
          >
            <Eye className="w-2.5 h-2.5" /> Inspect
          </button>
        </div>
        <div
          onClick={() => onInspect('OPP', `${label} Opportunities`, 'Active Sales Stages', data.oppRecords)}
          className="flex justify-between items-center group cursor-pointer p-1 rounded-lg hover:bg-white transition-all shadow-sm bg-white/50"
        >
          <span className="text-[10px] text-slate-500 font-bold group-hover:text-accent transition-colors">Count</span>
          <span className="text-sm font-black text-primary group-hover:text-accent transition-colors flex items-center gap-1">
            {data.opportunityCount} <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-slate-500 font-bold">Pipeline Value</span>
          <span className="text-sm font-black text-primary">{fmt(data.opportunityValue)}</span>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev FY</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-black">{fmt(data.oppYTDRevenueThisFY)}</span>
            {yoyBadge(data.oppYTDRevenueThisFY, data.oppYTDRevenueLastFY)}
          </div>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev LY</span>
          <span className="text-xs font-bold text-slate-400">{fmt(data.oppYTDRevenueLastFY)}</span>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-blue-500" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Accounts</span>
          </div>
          <button
            onClick={() => onInspect('CUST', `${label} Accounts`, 'Unique Customer Accounts', data.custRecords)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded-md transition-all"
          >
            <Eye className="w-2.5 h-2.5" /> Inspect
          </button>
        </div>
        <div
          onClick={() => onInspect('CUST', `${label} Accounts`, 'Unique Customer Accounts', data.custRecords)}
          className="flex justify-between items-center group cursor-pointer p-1 rounded-lg hover:bg-white transition-all shadow-sm bg-white/50"
        >
          <span className="text-[10px] text-slate-500 font-bold group-hover:text-blue-600 transition-colors">Total Accounts</span>
          <span className="text-sm font-black text-primary group-hover:text-blue-600 transition-colors flex items-center gap-1">
            {data.customerCount} <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev FY</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-black">{fmt(data.custYTDRevenueThisFY)}</span>
            {yoyBadge(data.custYTDRevenueThisFY, data.custYTDRevenueLastFY)}
          </div>
        </div>
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] text-slate-500 font-bold">YTD Rev LY</span>
          <span className="text-xs font-bold text-slate-400">{fmt(data.custYTDRevenueLastFY)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Per-user breakdown row (leaders only) ────────────────────────────────────
function UserRow({ u, onInspectUser }: { u: CRMUserSummary; onInspectUser: (u: CRMUserSummary) => void }) {
  const yoy = u.custYTDRevenueLastFY
    ? ((u.custYTDRevenueThisFY - u.custYTDRevenueLastFY) / u.custYTDRevenueLastFY) * 100
    : null;

  return (
    <tr
      onClick={() => onInspectUser(u)}
      className="border-b border-slate-100 hover:bg-accent/5 transition-all cursor-pointer group"
    >
      <td className="px-4 py-3 font-black text-[10px] uppercase text-primary whitespace-nowrap group-hover:text-accent flex items-center gap-1.5 transition-colors">
        <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-accent shrink-0" />
        {u.userName}
      </td>
      <td className="px-4 py-3 text-center text-xs font-bold group-hover:text-accent transition-colors">{u.opportunityCount}</td>
      <td className="px-4 py-3 text-right text-xs font-black group-hover:text-accent transition-colors">{fmt(u.opportunityValue)}</td>
      <td className="px-4 py-3 text-center text-xs font-bold group-hover:text-accent transition-colors">{u.customerCount}</td>
      <td className="px-4 py-3 text-right text-xs font-black text-emerald-600">{fmt(u.custYTDRevenueThisFY)}</td>
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
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    records: any[];
    type: 'OPP' | 'CUST' | 'USER';
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    records: [],
    type: 'OPP',
  });

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

  const handleInspectCol = (type: 'OPP' | 'CUST', title: string, subtitle: string, records: any[]) => {
    setModalState({
      isOpen: true,
      title,
      subtitle,
      records,
      type,
    });
  };

  const handleInspectUser = (u: CRMUserSummary) => {
    // Merge oppRecords and unique custRecords for the user inspection view
    const allRecordsMap = new Map<string, any>();
    u.oppRecords.forEach(r => allRecordsMap.set(r.id || r.salesforceId, r));
    u.custRecords.forEach(r => {
      if (!allRecordsMap.has(r.id || r.salesforceId || r.accountMasterCode)) {
        allRecordsMap.set(r.id || r.salesforceId || r.accountMasterCode, r);
      }
    });

    setModalState({
      isOpen: true,
      title: `${u.userName}'s Portfolio`,
      subtitle: `${u.opportunityCount} Opportunities & ${u.customerCount} Managed Accounts`,
      records: Array.from(allRecordsMap.values()),
      type: 'USER',
    });
  };

  return (
    <>
      <RecordsModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        subtitle={modalState.subtitle}
        records={modalState.records}
        type={modalState.type}
      />

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
              <SummaryColumn label="My Performance" data={summary.myStats} accent onInspect={handleInspectCol} />
            )}
            <SummaryColumn label="Team Combined" data={summary.team} onInspect={handleInspectCol} />
          </div>

          {/* Per-user breakdown — leaders/GMs only */}
          {showAllUsers && summary.byUser.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-accent" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Individual Breakdown (Click row to inspect accounts)</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-inner">
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
                      {summary.byUser.map(u => <UserRow key={u.userId} u={u} onInspectUser={handleInspectUser} />)}
                    </tbody>
                    {/* Team total footer */}
                    <tfoot className="bg-slate-900 text-white text-[9px] font-black uppercase">
                      <tr>
                        <td className="px-4 py-3">TEAM TOTAL</td>
                        <td className="px-4 py-3 text-center">{summary.team.opportunityCount}</td>
                        <td className="px-4 py-3 text-right">{fmt(summary.team.opportunityValue)}</td>
                        <td className="px-4 py-3 text-center">{summary.team.customerCount}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{fmt(summary.team.custYTDRevenueThisFY)}</td>
                        <td className="px-4 py-3 text-right opacity-70">{fmt(summary.team.custYTDRevenueLastFY)}</td>
                        <td className="px-4 py-3 text-right">
                          {summary.team.custYTDRevenueLastFY > 0 ? (
                            <span className="text-accent font-black text-xs">
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
    </>
  );
}
