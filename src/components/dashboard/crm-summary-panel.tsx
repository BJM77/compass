"use client";

import { useState, useMemo } from 'react';
import { CRMUserSummary, CRMTeamSummary } from '@/hooks/use-crm-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  BarChart3, Loader2, ChevronRight, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown
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
type SortField = 'account' | 'owner' | 'stage' | 'pipeline' | 'revFY' | 'revLY';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('revFY');
  const [sortAsc, setSortAsc] = useState(false);

  // Reset filter & sort when modal opens with new data
  useMemo(() => {
    setSearchQuery('');
    setSortField(type === 'OPP' ? 'pipeline' : 'revFY');
    setSortAsc(false);
  }, [isOpen, type]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const q = searchQuery.toLowerCase();
      const acct = (r.pipeline || r.accountName || r.accountMasterCode || '').toLowerCase();
      const owner = (r.userName || r.userId || '').toLowerCase();
      const oppName = (r.opportunityName || '').toLowerCase();
      const stage = (r.stage || '').toLowerCase();
      return acct.includes(q) || owner.includes(q) || oppName.includes(q) || stage.includes(q);
    }).sort((a, b) => {
      let cmp = 0;
      if (sortField === 'account') {
        const nameA = (a.pipeline || a.accountName || a.accountMasterCode || '').toLowerCase();
        const nameB = (b.pipeline || b.accountName || b.accountMasterCode || '').toLowerCase();
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === 'owner') {
        const ownerA = (a.userName || a.userId || '').toLowerCase();
        const ownerB = (b.userName || b.userId || '').toLowerCase();
        cmp = ownerA.localeCompare(ownerB);
      } else if (sortField === 'stage') {
        cmp = (a.stage || '').localeCompare(b.stage || '');
      } else if (sortField === 'pipeline') {
        cmp = (Number(a.value) || 0) - (Number(b.value) || 0);
      } else if (sortField === 'revFY') {
        cmp = (Number(a.currentRevenue) || 0) - (Number(b.currentRevenue) || 0);
      } else if (sortField === 'revLY') {
        cmp = (Number(a.lastYearRevenue) || 0) - (Number(b.lastYearRevenue) || 0);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [records, searchQuery, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending for numbers
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-30 group-hover:opacity-100 transition-opacity" />;
    return sortAsc ? <ArrowUp className="w-3 h-3 ml-1 inline text-accent font-black" /> : <ArrowDown className="w-3 h-3 ml-1 inline text-accent font-black" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white border-slate-200 shadow-2xl rounded-3xl h-[80vh] max-h-[80vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4 shrink-0 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <DialogTitle className="text-xl font-black text-primary tracking-tight flex items-center gap-2 uppercase">
                {type === 'OPP' ? <Briefcase className="w-5 h-5 text-accent" /> : <Users className="w-5 h-5 text-blue-500" />}
                {title} ({filteredRecords.length}{filteredRecords.length !== records.length ? ` of ${records.length}` : ''})
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                {subtitle}
              </DialogDescription>
            </div>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by account, owner, stage..."
                className="pl-8 h-8 text-xs font-medium rounded-full bg-slate-50 border-slate-200 focus-visible:ring-primary"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden my-2">
          <ScrollArea className="h-full w-full pr-4">
            <div className="overflow-x-auto">
              <UiTable className="text-xs">
                <TableHeader>
                  <TableRow className="uppercase text-[9px] font-black tracking-widest bg-slate-50 sticky top-0 z-10 select-none">
                    <TableHead onClick={() => handleSort('account')} className="cursor-pointer group hover:bg-slate-100/80 transition-colors">
                      Account / Customer {renderSortIcon('account')}
                    </TableHead>
                    <TableHead onClick={() => handleSort('owner')} className="cursor-pointer group hover:bg-slate-100/80 transition-colors">
                      Owner {renderSortIcon('owner')}
                    </TableHead>
                    {type !== 'CUST' && (
                      <TableHead onClick={() => handleSort('stage')} className="cursor-pointer group hover:bg-slate-100/80 transition-colors">
                        Opportunity / Stage {renderSortIcon('stage')}
                      </TableHead>
                    )}
                    {type !== 'CUST' && (
                      <TableHead onClick={() => handleSort('pipeline')} className="text-right cursor-pointer group hover:bg-slate-100/80 transition-colors">
                        Pipeline $ {renderSortIcon('pipeline')}
                      </TableHead>
                    )}
                    <TableHead onClick={() => handleSort('revFY')} className="text-right cursor-pointer group hover:bg-slate-100/80 transition-colors">
                      YTD Rev FY {renderSortIcon('revFY')}
                    </TableHead>
                    <TableHead onClick={() => handleSort('revLY')} className="text-right cursor-pointer group hover:bg-slate-100/80 transition-colors">
                      YTD Rev LY {renderSortIcon('revLY')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r, idx) => (
                    <TableRow key={r.id || idx} className="hover:bg-slate-50/80 transition-colors font-medium">
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
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={type === 'CUST' ? 4 : 6} className="text-center py-16 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                        {records.length > 0 ? 'No matching records found for filter criteria.' : 'No matching records available for inspection.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </UiTable>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Summary Column (My / Team) ───────────────────────────────────────────────
function SummaryColumn({
  label, data, accent = false, onInspect, large = false
}: {
  label: string;
  data: CRMUserSummary;
  accent?: boolean;
  onInspect: (type: 'OPP' | 'CUST', title: string, subtitle: string, records: any[]) => void;
  large?: boolean;
}) {
  return (
    <div className={`flex-1 rounded-2xl ${large ? 'p-6' : 'p-4'} space-y-4 ${accent ? 'bg-primary/5 border border-primary/10' : 'bg-slate-50 border border-slate-100'}`}>
      <p className={`font-black uppercase tracking-widest ${large ? 'text-xs mb-4' : 'text-[9px]'} ${accent ? 'text-primary' : 'text-slate-500'}`}>{label}</p>

      <div className={large ? "grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8" : ""}>
      {/* Opportunities */}
      <div className="space-y-3">
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
          <span className={`${large ? 'text-xs' : 'text-[10px]'} text-slate-500 font-bold`}>YTD Rev LY</span>
          <span className={`${large ? 'text-sm' : 'text-xs'} font-bold text-slate-400`}>{fmt(data.oppYTDRevenueLastFY)}</span>
        </div>
      </div>

      {/* Accounts */}
      <div className={`${!large ? 'border-t border-slate-200 pt-3' : ''} space-y-3`}>
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
          <span className={`${large ? 'text-xs' : 'text-[10px]'} text-slate-500 font-bold`}>YTD Rev LY</span>
          <span className={`${large ? 'text-sm' : 'text-xs'} font-bold text-slate-400`}>{fmt(data.custYTDRevenueLastFY)}</span>
        </div>
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
          <div className="flex flex-col sm:flex-row gap-4">
            {!showAllUsers && summary.myStats && (
              <SummaryColumn label="My Performance" data={summary.myStats} accent onInspect={handleInspectCol} />
            )}
            <SummaryColumn label="Team Combined" data={summary.team} onInspect={handleInspectCol} large={showAllUsers} />
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
              <div className="rounded-2xl border border-slate-100 overflow-x-auto overflow-y-auto max-h-72 shadow-inner">
                  <table className="w-full text-sm min-w-[700px]">
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
                        <td className="px-4 py-3 sticky left-0 bg-slate-900">TEAM TOTAL</td>
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
