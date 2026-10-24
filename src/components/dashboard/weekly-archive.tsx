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
  Loader2, AlertTriangle, LifeBuoy, Briefcase, Users, Clock, Mail
} from 'lucide-react';
import { format, startOfWeek, subWeeks, addDays } from 'date-fns';
import { getCurrentWeek, getWeekForDate, cn, getNextWeekKey, isUserSubmissionMatch, normalizeBdmName } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Generate last N weeks as selectable options ──────────────────────────────
function generateWeekOptions(count: number) {
  const options: { value: string; label: string; range: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }); // Monday
    const weekEnd = addDays(weekStart, 6); // Sunday
    const weekKey = getWeekForDate(weekStart);
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
  // TWTW
  twtwStatus: string;
  twtwSubmittedAt: any;
  twtwWins: any[];
  twtwRisks: any[];
  twtwMajorUpdates: string;
  twtwProjectedWins: any[];
  twtwPriorities: string[];
  // Friday FW
  fridayStatus: string;
  fridaySubmittedAt: any;
  focusAccounts: any[];
  kpiTargets: any;
  actionPlan: string[];
  roadblocks: string;
  supportNeeded: string;
  strategicFocus: string;
  gmFeedback: string;
  // Activity
  calls: number;
  apps: number;
  crmCalls?: number;
  crmApps?: number;
  proposals: number;
  deals: number;
}

const EMPTY_ARCHIVE: ArchivedWeek = {
  userId: '', userName: '',
  twtwStatus: '', twtwSubmittedAt: null, twtwWins: [], twtwRisks: [], twtwMajorUpdates: '', twtwProjectedWins: [], twtwPriorities: [],
  fridayStatus: '', fridaySubmittedAt: null, focusAccounts: [], kpiTargets: null, actionPlan: [], roadblocks: '', supportNeeded: '', strategicFocus: '', gmFeedback: '',
  calls: 0, apps: 0, crmCalls: 0, crmApps: 0, proposals: 0, deals: 0,
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, subValue, color }: { icon: any; label: string; value: string | number; subValue?: string | null; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${color}`}>
      <Icon className="w-3.5 h-3.5 opacity-60" />
      <div>
        <p className="text-xs font-semibold opacity-60">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-sm font-semibold">{value}</p>
          {subValue && (
            <p className="text-xs font-semibold opacity-60">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BDM Card ─────────────────────────────────────────────────────────────────
function BDMArchiveCard({ data, isExpanded, onToggle }: { data: ArchivedWeek; isExpanded: boolean; onToggle: () => void }) {
  const hasTwtwData = data.twtwStatus !== 'NOT_STARTED';
  const hasFridayData = data.fridayStatus !== 'NOT_STARTED';

  const targets = data.kpiTargets || {};
  const callsGoal = Number(targets.callsToMake) || 0;
  const appsGoal = Number(targets.appointmentsToSet) || 0;
  const proposalsGoal = Number(targets.proposalsToSend) || 0;
  const dealsGoal = Number(targets.dealsToClose) || 0;
  const revenueGoal = Number(targets.revenueTarget) || 0;

  const actualCalls = data.crmCalls !== undefined && data.crmCalls > 0 ? data.crmCalls : data.calls;
  const actualApps = data.crmApps !== undefined && data.crmApps > 0 ? data.crmApps : data.apps;
  const actualProposals = data.proposals || 0;
  const actualDeals = data.deals || 0;
  const safeTwtwWins = Array.isArray(data.twtwWins) ? data.twtwWins : [];
  const safeTwtwRisks = Array.isArray(data.twtwRisks) ? data.twtwRisks : [];
  const safeTwtwPriorities = Array.isArray(data.twtwPriorities) ? data.twtwPriorities : [];
  const safeFocusAccounts = Array.isArray(data.focusAccounts) ? data.focusAccounts : [];
  const safeActionPlan = Array.isArray(data.actionPlan) ? data.actionPlan : [];

  const actualRevenue = safeTwtwWins.reduce((acc: number, win: any) => acc + (Number(win?.value) || 0), 0);

  return (
    <Card className="border-none shadow-xl bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-secondary/60 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shadow-lg">
            {data.userName?.charAt(0) || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-primary tracking-tight">{data.userName}</p>
            <div className="flex gap-2 mt-1">
              <Badge className={`text-xs font-semibold border-none px-2 py-0.5 ${data.twtwStatus === 'SUBMITTED' ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-destructive'}`}>
                TWTW: {data.twtwStatus === 'SUBMITTED' ? 'SUBMITTED' : 'LATE/DUE'}
              </Badge>
              <Badge className={`text-xs font-semibold border-none px-2 py-0.5 ${data.fridayStatus === 'SUBMITTED' ? 'bg-success-soft text-success-ink' : data.fridayStatus === 'DRAFT' ? 'bg-warning-soft text-warning-ink' : 'bg-danger-soft text-destructive'}`}>
                FRI FW: {data.fridayStatus}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick stats with comparison targets */}
          <div className="hidden md:flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span><Phone className="w-3 h-3 inline mr-0.5" /> Calls: {actualCalls}/{callsGoal}</span>
            <span><CalendarCheck className="w-3 h-3 inline mr-0.5" /> Apps: {actualApps}/{appsGoal}</span>
            <span><FileText className="w-3 h-3 inline mr-0.5" /> Opps: {actualProposals}/{proposalsGoal}</span>
            <span><Award className="w-3 h-3 inline mr-0.5" /> Wins: {actualDeals}/{dealsGoal}</span>
            <span><TrendingUp className="w-3 h-3 inline mr-0.5" /> Rev: ${actualRevenue.toLocaleString()}/${revenueGoal.toLocaleString()}</span>
          </div>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="px-5 pb-6 pt-0 space-y-6 border-t border-border/60">
          {/* Activity Scorecard Grid comparing CRM Actuals with Goals */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4">
            <StatPill 
              icon={Phone} 
              label="Calls Actual/Goal" 
              value={`${actualCalls} / ${callsGoal}`} 
              subValue={actualCalls >= callsGoal ? "Goal Met! 🎉" : `${callsGoal - actualCalls} behind`}
              color={actualCalls >= callsGoal ? "bg-success-soft text-success-ink border-success/15" : "bg-danger-soft text-destructive border-destructive/15"} 
            />
            <StatPill 
              icon={CalendarCheck} 
              label="Apps Actual/Goal" 
              value={`${actualApps} / ${appsGoal}`} 
              subValue={actualApps >= appsGoal ? "Goal Met! 🎉" : `${appsGoal - actualApps} behind`}
              color={actualApps >= appsGoal ? "bg-success-soft text-success-ink border-success/15" : "bg-danger-soft text-destructive border-destructive/15"} 
            />
            <StatPill 
              icon={FileText} 
              label="Opps Actual/Goal" 
              value={`${actualProposals} / ${proposalsGoal}`} 
              subValue={actualProposals >= proposalsGoal ? "Goal Met! 🎉" : `${proposalsGoal - actualProposals} behind`}
              color={actualProposals >= proposalsGoal ? "bg-success-soft text-success-ink border-success/15" : "bg-danger-soft text-destructive border-destructive/15"} 
            />
            <StatPill 
              icon={Award} 
              label="Wins Actual/Goal" 
              value={`${actualDeals} / ${dealsGoal}`} 
              subValue={actualDeals >= dealsGoal ? "Goal Met! 🎉" : `${dealsGoal - actualDeals} behind`}
              color={actualDeals >= dealsGoal ? "bg-success-soft text-success-ink border-success/15" : "bg-danger-soft text-destructive border-destructive/15"} 
            />
            <StatPill 
              icon={TrendingUp} 
              label="Revenue Actual/Goal" 
              value={`$${actualRevenue.toLocaleString()} / $${revenueGoal.toLocaleString()}`} 
              subValue={actualRevenue >= revenueGoal ? "Goal Met! 🎉" : `$${(revenueGoal - actualRevenue).toLocaleString()} behind`}
              color={actualRevenue >= revenueGoal ? "bg-success-soft text-success-ink border-success/15" : "bg-danger-soft text-destructive border-destructive/15"} 
            />
          </div>

          {/* Two-column: TWTW vs Friday FW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* TWTW (Thursday 2pm) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-destructive" />
                <p className="text-xs font-semibold text-destructive">TWTW - The Week That Was (Thu 2pm)</p>
              </div>

              {hasTwtwData ? (
                <div className="space-y-4">
                  {/* Wins */}
                  {safeTwtwWins.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Wins This Week</p>
                      {safeTwtwWins.map((win: any, idx: number) => (
                        <div key={idx} className="p-3 bg-success-soft/50 rounded-xl border border-success/15 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-semibold text-foreground">{win.customer || 'Unnamed'}</p>
                            <span className="text-xs font-semibold text-success-ink">${(Number(win.value) || 0).toLocaleString()}</span>
                          </div>
                          {win.updateText && <p className="text-xs text-foreground/75 font-medium leading-relaxed">{win.updateText}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Risks */}
                  {safeTwtwRisks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground text-destructive">Risks & Barriers</p>
                      {safeTwtwRisks.map((risk: any, idx: number) => (
                        <div key={idx} className="p-3 bg-danger-soft/50 rounded-xl border border-destructive/15 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-semibold text-destructive">{risk.account || 'Unnamed'}</p>
                            {risk.impact && <span className="text-xs font-semibold text-destructive">${(Number(risk.impact) || 0).toLocaleString()}</span>}
                          </div>
                          {risk.mitigation && <p className="text-xs text-foreground/75 font-medium leading-relaxed">{risk.mitigation}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Major Updates */}
                  {data.twtwMajorUpdates && (
                    <div className="p-3 bg-secondary/60 rounded-xl border border-border/60 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Major Updates</p>
                      {typeof data.twtwMajorUpdates === 'string' ? (
                        <p className="text-xs text-foreground/85 leading-relaxed">{data.twtwMajorUpdates}</p>
                      ) : Array.isArray(data.twtwMajorUpdates) ? (
                        <div className="space-y-2">
                          {(data.twtwMajorUpdates as any[]).map((mu: any, idx: number) => (
                            <div key={idx} className="text-xs text-foreground/85 leading-relaxed border-b border-border/60 pb-1 last:border-0 last:pb-0">
                              {mu.customer && <span className="font-bold uppercase text-foreground">{mu.customer}: </span>}
                              <span>{mu.updateText || ''}</span>
                              {Number(mu.value) > 0 && <span className="text-success-ink font-semibold ml-1">(${(Number(mu.value) || 0).toLocaleString()})</span>}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Priorities */}
                  {safeTwtwPriorities.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Next Week's Priorities</p>
                      <div className="space-y-1">
                        {safeTwtwPriorities.map((item: string, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center text-xs font-medium text-foreground/75">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                            <span>{typeof item === 'string' ? item : (item as any).text || (item as any).updateText || JSON.stringify(item)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No TWTW data submitted</p>
              )}
            </div>

            {/* Friday FW (Friday 12pm) */}
            <div className="space-y-4 border-l pl-5 border-border/60">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-xs font-semibold text-primary">Friday FW - Performance Review (Fri 12pm)</p>
              </div>

              {hasFridayData ? (
                <div className="space-y-4">
                  {/* Focus Accounts */}
                  {safeFocusAccounts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Focus Accounts & Commitments</p>
                      {safeFocusAccounts.map((acc: any, i: number) => (
                        <div key={i} className="p-3 bg-secondary/60 rounded-xl border border-border/60 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">{acc.accountName || 'Unnamed'}</p>
                            <Badge className="text-xs font-semibold bg-primary/10 text-primary border-none">{acc.actionType || 'Close'}</Badge>
                          </div>
                          {acc.eav > 0 && <p className="text-xs font-bold text-accent">EAV: ${acc.eav.toLocaleString()}</p>}
                          {acc.aboutAccount && <p className="text-xs text-muted-foreground leading-relaxed">{acc.aboutAccount}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Monday Action Plan */}
                  {safeActionPlan.filter(a => typeof a === 'string' && a.trim()).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Monday Action Plan</p>
                      {safeActionPlan.filter(a => typeof a === 'string' && a.trim()).map((action, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Badge variant="outline" className="text-xs font-semibold w-5 h-5 p-0 flex items-center justify-center shrink-0">{i + 1}</Badge>
                          <p className="text-xs font-medium text-foreground/75 leading-relaxed">{action}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Roadblocks & Support */}
                  {data.roadblocks && (
                    <div className="p-3 bg-danger-soft rounded-xl border border-destructive/15">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                        <p className="text-xs font-semibold text-destructive">Roadblocks</p>
                      </div>
                      <p className="text-xs text-destructive leading-relaxed">{data.roadblocks}</p>
                    </div>
                  )}

                  {data.supportNeeded && (
                    <div className="p-3 bg-info-soft rounded-xl border border-info/15">
                      <div className="flex items-center gap-1 mb-1">
                        <LifeBuoy className="w-3 h-3 text-info" />
                        <p className="text-xs font-semibold text-info">Support Needed</p>
                      </div>
                      <p className="text-xs text-info leading-relaxed">{data.supportNeeded}</p>
                    </div>
                  )}

                  {/* GM Feedback */}
                  {data.gmFeedback && (
                    <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                      <div className="flex items-center gap-1 mb-1">
                        <MessageSquare className="w-3 h-3 text-primary" />
                        <p className="text-xs font-semibold text-primary">GM Feedback</p>
                      </div>
                      <p className="text-xs text-primary/80 leading-relaxed whitespace-pre-line">{data.gmFeedback}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No Friday FW data submitted</p>
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



  const { toast } = useToast();
  const canViewAll = isLeader || isGM;

  const handleRemindLate = () => {
    const lateUsers = archiveData.filter(d => d.twtwStatus !== 'SUBMITTED' || d.fridayStatus !== 'SUBMITTED');
    if (lateUsers.length === 0) {
      toast({ title: "No Action Needed", description: "All active team nodes have submitted TWTW and Friday FW." });
      return;
    }

    const emails = lateUsers
      .map(lu => allUsers?.find(u => u.id === lu.userId)?.email)
      .filter((email): email is string => !!email);

    const names = lateUsers.map(u => u.userName).join(', ');

    if (emails.length > 0) {
      const subject = encodeURIComponent("Reminder: Outstanding Weekly Submissions (TWTW / Friday FW)");
      const body = encodeURIComponent(
        `Hi,\n\nThis is a friendly reminder that you have outstanding weekly submissions (Thursday TWTW and/or Friday FW) for this week.\n\nPlease log in to the Compass dashboard and complete your submissions as soon as possible.\n\nThanks!`
      );
      
      const mailtoUrl = `mailto:?bcc=${emails.join(',')}&subject=${subject}&body=${body}`;
      
      // Try to open the mail client
      window.location.href = mailtoUrl;

      toast({
        title: "Mail Client Opened",
        description: `Drafted reminder email to: ${names}.`
      });
    } else {
      toast({
        title: "No Emails Found",
        description: `Could not find email addresses for: ${names}.`,
        variant: "destructive"
      });
    }
  };

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

        const userMap = new Map<string, any>();
        targetUsers.forEach(u => {
          const norm = normalizeBdmName(u.name, u.id);
          if (!userMap.has(norm)) {
            userMap.set(norm, { ...u });
          } else {
            const existing = userMap.get(norm);
            if (!existing.aliasIds) existing.aliasIds = [];
            existing.aliasIds.push(u.id);
          }
        });
        const uniqueTargetUsers = Array.from(userMap.values());

        const nextWeek = getNextWeekKey(selectedWeek);

        // Parallel fetch TWTW, Friday FW (commitments), and activity metrics
        const [commitmentsSnap, twtwSnap, progressSnap] = await Promise.all([
          getDocs(canViewAll 
            ? query(collection(db, 'weeklyCommitments'), where('week', '==', nextWeek)) 
            : query(collection(db, 'weeklyCommitments'), where('week', '==', nextWeek), where('userId', '==', user?.uid))),
          getDocs(canViewAll 
            ? query(collection(db, 'twiwSubmissions'), where('week', '==', selectedWeek)) 
            : query(collection(db, 'twiwSubmissions'), where('week', '==', selectedWeek), where('userId', '==', user?.uid))),
          getDocs(canViewAll 
            ? query(collection(db, 'weeklyProgress'), where('week', '==', selectedWeek)) 
            : query(collection(db, 'weeklyProgress'), where('week', '==', selectedWeek), where('userId', '==', user?.uid))),
        ]);

        const results: ArchivedWeek[] = uniqueTargetUsers.map(u => {
          const commitment = commitmentsSnap.docs.find(d => isUserSubmissionMatch(u, { id: d.id, ...d.data() }))?.data();
          const twtw = twtwSnap.docs.find(d => isUserSubmissionMatch(u, { id: d.id, ...d.data() }))?.data();
          const progress = progressSnap.docs.find(d => isUserSubmissionMatch(u, { id: d.id, ...d.data() }))?.data();

          const crmCalls = progress?.crmCalls !== undefined ? progress.crmCalls : 0;
          const crmApps = progress?.crmApps !== undefined ? progress.crmApps : 0;

          return {
            userId: u.id,
            userName: u.name || u.id,
            
            // TWTW
            twtwStatus: twtw?.status || 'NOT_STARTED',
            twtwSubmittedAt: twtw?.submittedAt || null,
            twtwWins: twtw?.wins || [],
            twtwRisks: twtw?.risks || [],
            twtwMajorUpdates: twtw?.majorUpdates || '',
            twtwProjectedWins: twtw?.projectedWins || [],
            twtwPriorities: twtw?.priorities || [],

            // Friday FW
            fridayStatus: commitment?.status || 'NOT_STARTED',
            fridaySubmittedAt: commitment?.submittedAt || null,
            focusAccounts: commitment?.focusAccounts || [],
            kpiTargets: commitment?.kpiTargets || null,
            actionPlan: commitment?.actionPlan || [],
            roadblocks: commitment?.roadblocks || '',
            supportNeeded: commitment?.supportNeeded || '',
            strategicFocus: commitment?.strategicFocus || '',
            gmFeedback: commitment?.gmFeedback || '',

            // Activity
            calls: Number(progress?.calls) || 0,
            apps: Number(progress?.apps) || 0,
            crmCalls,
            crmApps,
            proposals: Number(progress?.proposals) || 0,
            deals: Number(progress?.deals) || 0,
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
        crmCalls: acc.crmCalls + (d.crmCalls || 0),
        crmApps: acc.crmApps + (d.crmApps || 0),
        proposals: acc.proposals + d.proposals,
        deals: acc.deals + d.deals,
        twtwSubmitted: acc.twtwSubmitted + (d.twtwStatus === 'SUBMITTED' ? 1 : 0),
        fridaySubmitted: acc.fridaySubmitted + (d.fridayStatus === 'SUBMITTED' ? 1 : 0),
      }),
      { calls: 0, apps: 0, crmCalls: 0, crmApps: 0, proposals: 0, deals: 0, twtwSubmitted: 0, fridaySubmitted: 0 }
    );
  }, [archiveData]);

  const selectedOption = weekOptions.find(w => w.value === selectedWeek);
  const isCurrentWeek = selectedWeek === currentWeek;

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Historical Intelligence</p>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <Archive className="w-8 h-8" /> Weekly Archive
          </h1>
          <p className="text-xs text-muted-foreground font-bold">
            {canViewAll ? 'Full team' : 'Your'} TWTW submissions, Friday FW reviews, and activity metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canViewAll && archiveData.length > 0 && (
            <Button
              onClick={handleRemindLate}
              className="h-12 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs rounded-xl shadow-lg gap-2"
            >
              <Mail className="w-4 h-4" />
              Remind Late Submissions
            </Button>
          )}
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="w-64 h-12 font-bold text-sm bg-card shadow-lg border-none rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {weekOptions.map(w => (
                <SelectItem key={w.value} value={w.value} className="font-bold py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs">{w.label} {w.value === currentWeek && <Badge className="ml-1 text-xs bg-accent/20 text-accent border-none">CURRENT</Badge>}</span>
                    <span className="text-xs text-muted-foreground">{w.range}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team summary banner */}
      {canViewAll && archiveData.length > 0 && !isLoading && (
        <Card className="border-none shadow-xl bg-panel text-panel-foreground overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/20 rounded-xl">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-accent">
                    {selectedOption?.label} Team Snapshot
                  </p>
                  <p className="text-xs text-panel-foreground/60 font-bold mt-0.5">
                    {selectedOption?.range}
                    {isCurrentWeek && <span className="ml-2 text-accent">• Live</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold">
                <div className="text-center px-4">
                  <p className="text-xl font-black tabular-nums text-white">{teamTotals.crmCalls > 0 ? teamTotals.crmCalls : teamTotals.calls}</p>
                  <p className="text-xs uppercase tracking-wide text-panel-foreground/60">Calls {teamTotals.crmCalls > 0 ? `(Man: ${teamTotals.calls})` : ''}</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black tabular-nums text-white">{teamTotals.crmApps > 0 ? teamTotals.crmApps : teamTotals.apps}</p>
                  <p className="text-xs uppercase tracking-wide text-panel-foreground/60">Apps {teamTotals.crmApps > 0 ? `(Man: ${teamTotals.apps})` : ''}</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black tabular-nums text-white">{teamTotals.proposals}</p>
                  <p className="text-xs uppercase tracking-wide text-panel-foreground/60">Opps</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black tabular-nums text-white">{teamTotals.deals}</p>
                  <p className="text-xs uppercase tracking-wide text-panel-foreground/60">Wins</p>
                </div>
                <div className="border-l border-foreground/30 pl-4 text-center">
                  <p className="text-xl font-black tabular-nums text-success-fill">{teamTotals.twtwSubmitted}/{archiveData.length}</p>
                  <p className="text-xs uppercase tracking-wide text-panel-foreground/60">TWTW Submissions</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-black tabular-nums text-info">{teamTotals.fridaySubmitted}/{archiveData.length}</p>
                  <p className="text-xs uppercase tracking-wide text-panel-foreground/60">Friday FW</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      {archiveData.length > 1 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} className="text-xs font-semibold h-8 rounded-lg">
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs font-semibold h-8 rounded-lg">
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
        <Card className="border-none shadow-xl bg-card">
          <CardContent className="py-16 text-center">
            <Clock className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
            <p className="font-bold text-lg text-muted-foreground">No Data for {selectedOption?.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{selectedOption?.range}</p>
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
