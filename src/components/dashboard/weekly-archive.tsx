"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive, ChevronDown, ChevronRight, Target, Send, Phone,
  CalendarCheck, FileText, Award, TrendingUp, MessageSquare,
  Loader2, AlertTriangle, LifeBuoy, Briefcase, Users, Clock
} from 'lucide-react';
import { format, startOfWeek, subWeeks, addDays } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';

// ─── Generate last N weeks as selectable options ──────────────────────────────
function generateWeekOptions(count: number) {
  const options: { value: string; label: string; range: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 4); // Friday
    const weekKey = format(weekStart, 'yyyy-ww');
    options.push({
      value: weekKey,
      label: `Week ${weekKey.split('-')[1]}`,
      range: `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`,
    });
  }
  return options;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface ArchivedWeek {
  userId: string;
  userName: string;
  // Monday Planning
  mondayStatus: string;
  focusAccounts: any[];
  kpiTargets: any;
  actionPlan: string[];
  roadblocks: string;
  supportNeeded: string;
  // Friday Synthesis
  fridayStatus: string;
  weeklyNotes: string;
  summary: any;
  stillWorkingAccounts: any[];
  gmFeedback: string;
  // Activity
  calls: number;
  apps: number;
  proposals: number;
  deals: number;
  // Opportunities / Wins / New Business
  opportunities: any[];
  signedPaperwork: any[];
  newBusiness: any[];
}

const EMPTY_ARCHIVE: ArchivedWeek = {
  userId: '', userName: '',
  mondayStatus: '', focusAccounts: [], kpiTargets: null,
  actionPlan: [], roadblocks: '', supportNeeded: '',
  fridayStatus: '', weeklyNotes: '', summary: null,
  stillWorkingAccounts: [], gmFeedback: '',
  calls: 0, apps: 0, proposals: 0, deals: 0,
  opportunities: [], signedPaperwork: [], newBusiness: [],
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color}`}>
      <Icon className="w-3.5 h-3.5 opacity-60" />
      <div>
        <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  );
}

// ─── BDM Card ─────────────────────────────────────────────────────────────────
function BDMArchiveCard({ data, isExpanded, onToggle }: { data: ArchivedWeek; isExpanded: boolean; onToggle: () => void }) {
  const hasMondayData = data.mondayStatus !== '';
  const hasFridayData = data.fridayStatus !== '';

  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-black text-sm shadow-lg">
            {data.userName?.charAt(0) || '?'}
          </div>
          <div>
            <p className="text-sm font-black uppercase text-primary tracking-tight">{data.userName}</p>
            <div className="flex gap-2 mt-1">
              <Badge className={`text-[7px] font-black border-none px-2 py-0.5 ${hasMondayData ? (data.mondayStatus === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700') : 'bg-slate-100 text-slate-400'}`}>
                MON {hasMondayData ? data.mondayStatus : 'NONE'}
              </Badge>
              <Badge className={`text-[7px] font-black border-none px-2 py-0.5 ${hasFridayData ? (data.fridayStatus === 'SUBMITTED' ? 'bg-green-100 text-green-700' : data.fridayStatus === 'REVIEWED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700') : 'bg-slate-100 text-slate-400'}`}>
                FRI {hasFridayData ? data.fridayStatus : 'NONE'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-3 text-[9px] font-black text-slate-400 uppercase">
            <span><Phone className="w-3 h-3 inline mr-0.5" /> {data.calls}</span>
            <span><CalendarCheck className="w-3 h-3 inline mr-0.5" /> {data.apps}</span>
            <span><FileText className="w-3 h-3 inline mr-0.5" /> {data.proposals}</span>
            <span><Award className="w-3 h-3 inline mr-0.5" /> {data.deals}</span>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="px-5 pb-6 pt-0 space-y-6 border-t border-slate-100">
          {/* Activity Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
            <StatPill icon={Phone} label="Calls" value={data.calls} color="bg-blue-50 text-blue-600 border-blue-100" />
            <StatPill icon={CalendarCheck} label="Apps" value={data.apps} color="bg-green-50 text-green-600 border-green-100" />
            <StatPill icon={FileText} label="Opps" value={data.proposals} color="bg-purple-50 text-purple-600 border-purple-100" />
            <StatPill icon={Award} label="Wins" value={data.deals} color="bg-orange-50 text-orange-600 border-orange-100" />
          </div>

          {/* Two-column: Monday vs Friday */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Monday Planning */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Monday Planning</p>
              </div>

              {data.focusAccounts.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Focus Accounts</p>
                  {data.focusAccounts.map((acc: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-slate-800">{acc.accountName || 'Unnamed'}</p>
                        <Badge className="text-[7px] font-black bg-primary/10 text-primary border-none">{acc.actionType}</Badge>
                      </div>
                      {acc.eav > 0 && <p className="text-[9px] font-bold text-accent">EAV: ${acc.eav.toLocaleString()}</p>}
                      {acc.aboutAccount && <p className="text-[9px] text-slate-500 leading-relaxed">{acc.aboutAccount}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">No Monday data submitted</p>
              )}

              {data.actionPlan.filter(a => a.trim()).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Commitments</p>
                  {data.actionPlan.filter(a => a.trim()).map((action, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Badge variant="outline" className="text-[7px] font-black w-5 h-5 p-0 flex items-center justify-center shrink-0">{i + 1}</Badge>
                      <p className="text-[9px] font-medium text-slate-600 leading-relaxed">{action}</p>
                    </div>
                  ))}
                </div>
              )}

              {data.roadblocks && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <p className="text-[8px] font-black uppercase text-red-600 tracking-widest">Roadblocks</p>
                  </div>
                  <p className="text-[9px] text-red-700 leading-relaxed">{data.roadblocks}</p>
                </div>
              )}

              {data.supportNeeded && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-1 mb-1">
                    <LifeBuoy className="w-3 h-3 text-blue-500" />
                    <p className="text-[8px] font-black uppercase text-blue-600 tracking-widest">Support Needed</p>
                  </div>
                  <p className="text-[9px] text-blue-700 leading-relaxed">{data.supportNeeded}</p>
                </div>
              )}
            </div>

            {/* Friday Synthesis */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-accent" />
                <p className="text-[10px] font-black uppercase tracking-widest text-accent">Friday Synthesis</p>
              </div>

              {data.weeklyNotes ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Week Summary</p>
                  <p className="text-[10px] text-slate-700 leading-relaxed whitespace-pre-line">{data.weeklyNotes}</p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">No Friday data submitted</p>
              )}

              {data.summary && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-green-50 rounded-lg border border-green-100 text-center">
                    <p className="text-lg font-black text-green-700">{data.summary.signedPaperworkCount || 0}</p>
                    <p className="text-[7px] font-black uppercase text-green-600 tracking-widest">Signed Wins</p>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-center">
                    <p className="text-lg font-black text-blue-700">{data.summary.newOpportunitiesCount || 0}</p>
                    <p className="text-[7px] font-black uppercase text-blue-600 tracking-widest">New Opps</p>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-lg border border-purple-100 text-center">
                    <p className="text-lg font-black text-purple-700">{data.summary.newBusinessCount || 0}</p>
                    <p className="text-[7px] font-black uppercase text-purple-600 tracking-widest">Live Trading</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-center">
                    <p className="text-lg font-black text-amber-700">{data.summary.stillWorkingCount || 0}</p>
                    <p className="text-[7px] font-black uppercase text-amber-600 tracking-widest">Still Working</p>
                  </div>
                </div>
              )}

              {/* Still Working Accounts from Friday */}
              {data.stillWorkingAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Still Working</p>
                  {data.stillWorkingAccounts.map((acc: any, i: number) => (
                    <div key={i} className="p-2 bg-amber-50/50 rounded-lg border border-amber-100 flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase text-slate-700">{acc.accountName}</p>
                      {acc.eav > 0 && <p className="text-[8px] font-black text-amber-600">${acc.eav.toLocaleString()}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* GM Feedback */}
              {data.gmFeedback && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="flex items-center gap-1 mb-1">
                    <MessageSquare className="w-3 h-3 text-primary" />
                    <p className="text-[8px] font-black uppercase text-primary tracking-widest">GM Feedback</p>
                  </div>
                  <p className="text-[9px] text-primary/80 leading-relaxed whitespace-pre-line">{data.gmFeedback}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function WeeklyArchive() {
  const { profile, isLeader, isGM, user } = useAuth();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();

  const weekOptions = useMemo(() => generateWeekOptions(26), []); // Last 6 months
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [isLoading, setIsLoading] = useState(false);
  const [archiveData, setArchiveData] = useState<ArchivedWeek[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const canViewAll = isLeader || isGM;

  // Fetch all Firestore data for the selected users
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection(usersQuery);

  useEffect(() => {
    async function fetchWeekData() {
      if (!db || !allUsers) return;
      setIsLoading(true);
      try {
        const targetUsers = canViewAll
          ? allUsers.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER')
          : allUsers.filter(u => u.id === user?.uid);

        // Parallel fetch all collections for the selected week
        const [commitmentsSnap, reportsSnap, progressSnap, oppsSnap, paperworkSnap, businessSnap] = await Promise.all([
          getDocs(query(collection(db, 'weeklyCommitments'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'weeklyReports'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'weeklyProgress'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'opportunities'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'signedPaperwork'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'newBusiness'), where('week', '==', selectedWeek))),
        ]);

        const results: ArchivedWeek[] = targetUsers.map(u => {
          const commitment = commitmentsSnap.docs.find(d => d.data().userId === u.id)?.data();
          const report = reportsSnap.docs.find(d => d.data().userId === u.id)?.data();
          const progress = progressSnap.docs.find(d => d.data().userId === u.id)?.data();

          const userOpps = oppsSnap.docs.filter(d => d.data().userId === u.id).map(d => d.data());
          const userPaperwork = paperworkSnap.docs.filter(d => d.data().userId === u.id).map(d => d.data());
          const userBusiness = businessSnap.docs.filter(d => d.data().userId === u.id).map(d => d.data());

          return {
            userId: u.id,
            userName: u.name || u.id,
            // Monday
            mondayStatus: commitment?.status || '',
            focusAccounts: commitment?.focusAccounts || [],
            kpiTargets: commitment?.kpiTargets || null,
            actionPlan: commitment?.actionPlan || [],
            roadblocks: commitment?.roadblocks || '',
            supportNeeded: commitment?.supportNeeded || '',
            // Friday
            fridayStatus: report?.status || '',
            weeklyNotes: report?.weeklyNotes || '',
            summary: report?.summary || null,
            stillWorkingAccounts: report?.stillWorkingAccounts || [],
            gmFeedback: report?.gmFeedback || '',
            // Activity
            calls: Number(progress?.calls) || 0,
            apps: Number(progress?.apps) || 0,
            proposals: Number(progress?.proposals) || 0,
            deals: Number(progress?.deals) || 0,
            // Collections
            opportunities: userOpps,
            signedPaperwork: userPaperwork,
            newBusiness: userBusiness,
          };
        });

        setArchiveData(results.sort((a, b) => a.userName.localeCompare(b.userName)));
      } catch (err) {
        console.error('Archive fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchWeekData();
  }, [db, allUsers, selectedWeek, canViewAll, user?.uid]);

  const toggleExpand = (userId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(archiveData.map(d => d.userId)));
  const collapseAll = () => setExpandedIds(new Set());

  // Team aggregate stats
  const teamTotals = useMemo(() => {
    return archiveData.reduce(
      (acc, d) => ({
        calls: acc.calls + d.calls,
        apps: acc.apps + d.apps,
        proposals: acc.proposals + d.proposals,
        deals: acc.deals + d.deals,
        mondaySubmitted: acc.mondaySubmitted + (d.mondayStatus === 'SUBMITTED' ? 1 : 0),
        fridaySubmitted: acc.fridaySubmitted + (d.fridayStatus === 'SUBMITTED' || d.fridayStatus === 'REVIEWED' ? 1 : 0),
      }),
      { calls: 0, apps: 0, proposals: 0, deals: 0, mondaySubmitted: 0, fridaySubmitted: 0 }
    );
  }, [archiveData]);

  const selectedOption = weekOptions.find(w => w.value === selectedWeek);
  const isCurrentWeek = selectedWeek === currentWeek;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Historical Intelligence</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-primary flex items-center gap-3">
            <Archive className="w-8 h-8" /> Weekly Archive
          </h1>
          <p className="text-xs text-muted-foreground font-bold">
            {canViewAll ? 'Full team' : 'Your'} Monday commitments, Friday outcomes, and activity metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-64 h-12 font-bold text-sm bg-white shadow-lg border-none rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {weekOptions.map(w => (
                <SelectItem key={w.value} value={w.value} className="font-bold py-3">
                  <div className="flex flex-col">
                    <span className="font-black text-xs">{w.label} {w.value === currentWeek && <Badge className="ml-1 text-[7px] bg-accent/20 text-accent border-none">CURRENT</Badge>}</span>
                    <span className="text-[9px] text-muted-foreground">{w.range}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team summary banner */}
      {canViewAll && archiveData.length > 0 && !isLoading && (
        <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-xl">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-accent">
                    {selectedOption?.label} Team Snapshot
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                    {selectedOption?.range}
                    {isCurrentWeek && <span className="ml-2 text-accent">• Live</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-black">
                <div className="text-center px-4">
                  <p className="text-xl font-black text-white">{teamTotals.calls}</p>
                  <p className="text-[7px] uppercase tracking-widest text-slate-400">Calls</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black text-white">{teamTotals.apps}</p>
                  <p className="text-[7px] uppercase tracking-widest text-slate-400">Apps</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black text-white">{teamTotals.proposals}</p>
                  <p className="text-[7px] uppercase tracking-widest text-slate-400">Opps</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black text-white">{teamTotals.deals}</p>
                  <p className="text-[7px] uppercase tracking-widest text-slate-400">Wins</p>
                </div>
                <div className="border-l border-slate-700 pl-4 text-center">
                  <p className="text-xl font-black text-green-400">{teamTotals.mondaySubmitted}/{archiveData.length}</p>
                  <p className="text-[7px] uppercase tracking-widest text-slate-400">Mon Plans</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black text-blue-400">{teamTotals.fridaySubmitted}/{archiveData.length}</p>
                  <p className="text-[7px] uppercase tracking-widest text-slate-400">Fri Reports</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      {archiveData.length > 1 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="text-[9px] font-black uppercase h-8 rounded-lg">
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="text-[9px] font-black uppercase h-8 rounded-lg">
            Collapse All
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* No data */}
      {!isLoading && archiveData.length === 0 && (
        <Card className="border-none shadow-xl bg-white">
          <CardContent className="py-16 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="font-black text-lg text-slate-400 uppercase">No Data for {selectedOption?.label}</p>
            <p className="text-xs text-slate-400 mt-1">{selectedOption?.range}</p>
          </CardContent>
        </Card>
      )}

      {/* Per-BDM cards */}
      {!isLoading && archiveData.map(data => (
        <BDMArchiveCard
          key={data.userId}
          data={data}
          isExpanded={expandedIds.has(data.userId)}
          onToggle={() => toggleExpand(data.userId)}
        />
      ))}
    </div>
  );
}
