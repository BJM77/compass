"use client";

import {
  useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { TwiwEditDialog } from './twiw-edit-dialog';
import { FridayPerformanceReview } from './friday-performance-review';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { getCurrentWeek, formatEAV } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Sparkles, Beaker, Check, Plus, Trash2, Calendar, ClipboardCheck, 
  ArrowRight, Shield, Star, Users, Phone, Map, AlertTriangle, 
  LifeBuoy, TrendingUp, Info, HelpCircle, Save, Send, RefreshCw,
  Target, Database, Calendar as CalendarIcon, Eye, EyeOff, Edit3, Award, ClipboardList, PieChart, DollarSign, FileText, Loader2
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';

interface KPIReview {
  callsTarget: number;
  appointmentsTarget: number;
  proposalsTarget: number;
  dealsTarget: number;
  revenueTarget: number;
  callsActual: number;
  appointmentsActual: number;
  proposalsActual: number;
  dealsActual: number;
  revenueActual: number;
  kpiNotes: string;
}

// Type definitions
interface WinItem {
  id: string;
  customer: string;
  value: number;
  businessUnits: string[];
  updateText: string;
  salespersonName: string;
  isHidden?: boolean;
  isStarred?: boolean;
}

const BUSINESS_UNITS = ['Road Express', 'Ecommerce', 'Priority B2B', 'Courier', 'Premium', 'Freight'];

interface RiskItem {
  id: string;
  account: string;
  value: number;
  mitigation: string;
  businessUnits?: string[];
  salespersonName: string;
  isHidden?: boolean;
  isStarred?: boolean;
}

interface MajorUpdateItem {
  id: string;
  customer: string;
  value: number;
  businessUnits: string[];
  updateText: string;
  salespersonName: string;
  isHidden?: boolean;
  isStarred?: boolean;
}

interface ProjectedWin {
  id: string;
  account: string;
  value: number;
  expectedDate: string;
  businessUnits?: string[];
  updateText: string;
  salespersonName: string;
  isHidden?: boolean;
  isStarred?: boolean;
}

interface PriorityItem {
  id: string;
  text: string;
  salespersonName: string;
  isHidden?: boolean;
  isStarred?: boolean;
}

interface FocusAccount {
  id: string;
  accountName: string;
  actionType: string;
  eav: number;
  aboutAccount: string;
  status?: 'WORKING' | 'WON' | 'LOST';
  update?: string;
}

interface KPITargets {
  callsToMake: number;
  appointmentsToSet: number;
  proposalsToSend: number;
  dealsToClose: number;
  revenueTarget: number;
}

interface KPITargetsActuals extends KPITargets {
  callsMade: number;
  appointmentsSet: number;
  proposalsSent: number;
  dealsClosed: number;
  revenueWon: number;
}

const ACTION_TYPES = [
  "Prospect",
  "Develop",
  "Propose",
  "Negotiate",
  "Finalise",
  "Pending Trade",
  "Closed - Won"
];

export function DemoDashView({ embeddedCollationOnly = false }: { embeddedCollationOnly?: boolean }) {
  const { isLeader, user, profile, isGuest } = useAuth();
  const { toast } = useToast();
  const db = useFirestore();

  const isRegisteredUser = !isGuest && (profile?.role === 'BDM' || profile?.role === 'ACCOUNT_MANAGER');
  const currentWeek = getCurrentWeek();

  // Helper to get previous week key
  function getPreviousWeekKey(weekKey: string): string {
    const [yearStr, weekStr] = weekKey.split('-');
    const year = parseInt(yearStr, 10);
    const weekNum = parseInt(weekStr, 10);
    if (weekNum > 1) {
      return `${year}-${String(weekNum - 1).padStart(2, '0')}`;
    } else {
      return `${year - 1}-52`;
    }
  }
  const previousWeek = getPreviousWeekKey(currentWeek);

  // 🛡️ Guard: If db is not yet available, show a loading state
  if (!db) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeUserId = user?.uid;

  // KPI Review State - only for registered users
  const [kpiReview, setKpiReview] = useState<KPIReview>({
    callsTarget: 0, appointmentsTarget: 0, proposalsTarget: 0, dealsTarget: 0, revenueTarget: 0,
    callsActual: 0, appointmentsActual: 0, proposalsActual: 0, dealsActual: 0, revenueActual: 0, kpiNotes: ''
  });
  const [showHiddenItems, setShowHiddenItems] = useState(false);


  useEffect(() => {
    async function loadPreviousFridayData() {
      if (!db || !activeUserId || !isRegisteredUser) return;
      try {
        const { getDoc, getDocs, query, collection, where, doc } = await import('firebase/firestore');
        const prevCommitRef = doc(db, 'weeklyCommitments', `${activeUserId}_${previousWeek}`);
        const prevCommitSnap = await getDoc(prevCommitRef);
        if (prevCommitSnap.exists()) {
          const prevData = prevCommitSnap.data();
          const kpiTargets = prevData.kpiTargets || {};
          setKpiReview((prev: KPIReview) => ({
            ...prev,
            callsTarget: kpiTargets.callsToMake || 0,
            appointmentsTarget: kpiTargets.appointmentsToSet || 0,
            proposalsTarget: kpiTargets.proposalsToSend || 0,
            dealsTarget: kpiTargets.dealsToClose || 0,
            revenueTarget: kpiTargets.revenueTarget || 0
          }));
          if (prevData.actionPlan) {
            setCurrentWeekActions(prevData.actionPlan.map((act: string) => ({ text: act, completed: false, update: '' })));
          }
          if (prevData.focusAccounts) {
            setCurrentWeekFocusAccounts(prevData.focusAccounts.map((fa: any) => ({ ...fa, status: 'WORKING', update: '' })));
          }
        }
        
        const prevProgressRef = doc(db, 'weeklyProgress', `${activeUserId}_${previousWeek}`);
        const prevProgressSnap = await getDoc(prevProgressRef);
        if (prevProgressSnap.exists()) {
          const progressData = prevProgressSnap.data();
          setKpiReview((prev: KPIReview) => ({
            ...prev,
            callsActual: progressData.calls || 0,
            appointmentsActual: progressData.apps || 0,
            proposalsActual: progressData.proposals || 0,
            dealsActual: progressData.deals || 0
          }));
        }
        
        const prevPipelineSnap = await getDocs(query(collection(db, 'pipelineReviews'), where('userId', '==', activeUserId), where('week', '==', previousWeek)));
        const wonRevenue = prevPipelineSnap.docs.map(d => d.data()).filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (Number(d.value) || 0), 0);
        setKpiReview((prev: KPIReview) => ({ ...prev, revenueActual: wonRevenue || 0 }));
      } catch (error) { console.error(error); }
    }
    loadPreviousFridayData();
  }, [db, activeUserId, previousWeek, isRegisteredUser]);

  const updateKPI = (field: keyof Omit<KPIReview, 'kpiNotes'>, value: number) => {
    if (!isRegisteredUser) return;
    setKpiReview((prev: KPIReview) => ({ ...prev, [field]: value }));
  };

  const renderKPIReview = () => {
    if (!isRegisteredUser) return null;
    return (
      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white mb-6">
        <CardHeader className="bg-slate-50/50 border-b py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" /> Weekly KPI Review (vs Previous Friday's Plan)
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Review your performance against the KPI targets set last Friday
              </CardDescription>
            </div>
            <Badge className="bg-slate-100 text-slate-600 font-black text-[9px] uppercase">Week {previousWeek.split('-')[1]} Targets</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2"><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" /><div className="text-[9px] font-black uppercase text-slate-500">Calls</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.callsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.callsActual || ''} onChange={(e) => updateKPI('callsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /><div className="text-[9px] font-black uppercase text-slate-500">Appts</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.appointmentsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.appointmentsActual || ''} onChange={(e) => updateKPI('appointmentsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /><div className="text-[9px] font-black uppercase text-slate-500">Proposals</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.proposalsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.proposalsActual || ''} onChange={(e) => updateKPI('proposalsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /><div className="text-[9px] font-black uppercase text-slate-500">Wins</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.dealsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.dealsActual || ''} onChange={(e) => updateKPI('dealsActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /><div className="text-[9px] font-black uppercase text-slate-500">Revenue</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-lg font-black text-slate-800">${(kpiReview.revenueTarget / 1000).toFixed(0)}K</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.revenueActual || ''} onChange={(e) => updateKPI('revenueActual', parseInt(e.target.value) || 0)} className="h-9 text-lg font-black w-full" placeholder="0" /></div></div></div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-500">Weekly KPI Notes & Commentary</div>
            <Textarea placeholder="Provide notes on your KPI performance this week..." value={kpiReview.kpiNotes} onChange={(e) => setKpiReview(prev => ({ ...prev, kpiNotes: e.target.value }))} className="min-h-[80px] text-xs font-medium rounded-xl" />
          </div>

        </CardContent>
      </Card>
    );
  };
  const activeUserName = profile?.name || user?.email || 'Unknown';
  const activeUserRole = profile?.role || 'BDM';
  const activeUserState = profile?.state || 'WA';
  const selectedWeek = getCurrentWeek();

  // Load existing submission for current user
  const submissionDocId = activeUserId ? `${activeUserId}_${selectedWeek}` : null;
  
  const mySubmissionRef = useMemoFirebase(() => {
    if (!db || !submissionDocId) return null;
    return doc(db, 'twiwSubmissions', submissionDocId);
  }, [db, submissionDocId]);
  
  const { data: mySubmission } = useDoc(mySubmissionRef);

  // Load all team submissions for collation (leaders only)
  const twiwQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'twiwSubmissions'), where('week', '==', selectedWeek));
  }, [db, isLeader, selectedWeek]);
  
  const { data: allSubmissions } = useCollection(twiwQuery);

  const submissionsByState = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const submissionsList = allSubmissions || [];
    submissionsList.forEach(sub => {
      const state = sub.state || 'Unassigned';
      if (!groups[state]) groups[state] = [];
      groups[state].push(sub);
    });

    // Sort within each state by highest Key Win Value, descending
    Object.keys(groups).forEach(state => {
      groups[state].sort((a, b) => {
        const maxWinA = Math.max(...(a.wins || []).map((w: any) => Number(w.value) || 0), 0);
        const maxWinB = Math.max(...(b.wins || []).map((w: any) => Number(w.value) || 0), 0);
        if (maxWinB !== maxWinA) {
          return maxWinB - maxWinA;
        }
        const nameA = a.userName || a.email || '';
        const nameB = b.userName || b.email || '';
        return nameA.localeCompare(nameB);
      });
    });

    return groups;
  }, [allSubmissions]);

  const [editingSubmission, setEditingSubmission] = useState<any>(null);

  // Load data into state when available
  useEffect(() => {
    if (mySubmission) {
      setWins(mySubmission.wins || []);
      setRisks(mySubmission.risks || []);
      setUpdates(mySubmission.updates || '');
      setMajorUpdates(mySubmission.majorUpdates || []);
      setProjectedWins(mySubmission.projectedWins || []);
      setPriorities(mySubmission.priorities || []);
      setTwtwStatus(mySubmission.status || 'NONE');
      setNextWeekActions(mySubmission.nextWeekActions || ['']);
      setNextWeekRoadblocks(mySubmission.nextWeekRoadblocks || '');
      setNextWeekSupport(mySubmission.nextWeekSupport || '');
    } else {
      setTwtwStatus('NONE');
    }
  }, [mySubmission]);
  // Previous Friday's Plan
  const defaultPrevFridayPlan = {
    focusAccounts: [] as FocusAccount[],
    kpiTargets: {
      callsToMake: 0,
      appointmentsToSet: 0,
      proposalsToSend: 0,
      dealsToClose: 0,
      revenueTarget: 0
    } as KPITargets,
    actionPlan: [] as string[],
    roadblocks: '',
    supportNeeded: ''
  };

  const [dbPrevFridayPlan, setDbPrevFridayPlan] = useState(defaultPrevFridayPlan);

  // Thursday TWTW Submission Data
  const [wins, setWins] = useState<WinItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [updates, setUpdates] = useState('');
  const [majorUpdates, setMajorUpdates] = useState<MajorUpdateItem[]>([]);
  const [projectedWins, setProjectedWins] = useState<ProjectedWin[]>([]);
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [twtwStatus, setTwtwStatus] = useState<'NONE' | 'DRAFT' | 'SUBMITTED'>('NONE');

  // Thursday TWTW Registered-only Extra Data
  const [twtwKpiActuals, setTwtwKpiActuals] = useState<KPITargetsActuals>({
    callsToMake: 50, appointmentsToSet: 15, proposalsToSend: 8, dealsToClose: 3, revenueTarget: 250000,
    callsMade: 0, appointmentsSet: 0, proposalsSent: 0, dealsClosed: 0, revenueWon: 0
  });
  const [twtwRoadblocks, setTwtwRoadblocks] = useState('');
  const [twtwSupport, setTwtwSupport] = useState('');

  const isTwtwFormComplete = useMemo(() => {
    const winsValid = wins.every(w => 
      w.customer?.trim() && 
      (w.value || 0) > 0 && 
      w.businessUnits?.length > 0 && 
      w.updateText?.trim() && 
      w.salespersonName?.trim()
    );
    if (!winsValid) return false;

    const risksValid = risks.every(r => 
      r.account?.trim() && 
      (r.value || 0) > 0 && 
      r.mitigation?.trim() && 
      r.salespersonName?.trim()
    );
    if (!risksValid) return false;

    const updatesValid = majorUpdates.every(m => 
      m.customer?.trim() && 
      m.businessUnits?.length > 0 && 
      m.updateText?.trim() && 
      m.salespersonName?.trim()
    );
    if (!updatesValid) return false;

    const projectedValid = projectedWins.every(p => 
      p.account?.trim() && 
      (p.value || 0) > 0 && 
      p.updateText?.trim() && 
      p.salespersonName?.trim()
    );
    if (!projectedValid) return false;

    const prioritiesValid = priorities.every(p => 
      p.text?.trim() && 
      p.salespersonName?.trim()
    );
    if (!prioritiesValid) return false;

    if (isRegisteredUser) {
      if (twtwKpiActuals.callsMade === undefined || isNaN(twtwKpiActuals.callsMade) || twtwKpiActuals.callsMade < 0) return false;
      if (twtwKpiActuals.appointmentsSet === undefined || isNaN(twtwKpiActuals.appointmentsSet) || twtwKpiActuals.appointmentsSet < 0) return false;
      if (twtwKpiActuals.proposalsSent === undefined || isNaN(twtwKpiActuals.proposalsSent) || twtwKpiActuals.proposalsSent < 0) return false;
      if (twtwKpiActuals.dealsClosed === undefined || isNaN(twtwKpiActuals.dealsClosed) || twtwKpiActuals.dealsClosed < 0) return false;
      if (twtwKpiActuals.revenueWon === undefined || isNaN(twtwKpiActuals.revenueWon) || twtwKpiActuals.revenueWon < 0) return false;
      if (!twtwRoadblocks?.trim()) return false;
      if (!twtwSupport?.trim()) return false;
    }

    return true;
  }, [wins, risks, majorUpdates, projectedWins, priorities, twtwKpiActuals, twtwRoadblocks, twtwSupport, isRegisteredUser]);

  // Friday Combined Pack Data
  // Section A: Current Week Review
  const [currentWeekActions, setCurrentWeekActions] = useState<{ text: string; completed: boolean; update: string; }[]>([]);
  const [currentWeekFocusAccounts, setCurrentWeekFocusAccounts] = useState<FocusAccount[]>([]);
  const [fridayOpportunities, setFridayOpportunities] = useState<any[]>([]);
  const [fridaySignedDeals, setFridaySignedDeals] = useState<any[]>([]);
  const [fridayNewBusiness, setFridayNewBusiness] = useState<any[]>([]);
  const [fridayNarrative, setFridayNarrative] = useState('');
  const [fridayRoadblocks, setFridayRoadblocks] = useState('');
  const [fridaySupport, setFridaySupport] = useState('');
  
  // Section B: Next Week Monday Plan
  const [nextWeekFocusAccounts, setNextWeekFocusAccounts] = useState<FocusAccount[]>([]);
  const [nextWeekKpiTargets, setNextWeekKpiTargets] = useState<KPITargets>({
    callsToMake: 50, appointmentsToSet: 15, proposalsToSend: 8, dealsToClose: 3, revenueTarget: 250000
  });
  const [nextWeekActions, setNextWeekActions] = useState<string[]>(['', '', '', '', '']);
  const [nextWeekRoadblocks, setNextWeekRoadblocks] = useState('');
  const [nextWeekSupport, setNextWeekSupport] = useState('');
  const [fridayStatus, setFridayStatus] = useState<'NONE' | 'DRAFT' | 'SUBMITTED'>('NONE');

  // Popup success modals
  const [twtwSuccessOpen, setTwtwSuccessOpen] = useState(false);
  const [fridaySuccessOpen, setFridaySuccessOpen] = useState(false);

  // Initialize simulated data logs
  useEffect(() => {
    resetAllData();
  }, []);

  const resetAllData = () => {
    setDbPrevFridayPlan(defaultPrevFridayPlan);

    // Reset TWTW
    setWins([]);
    setRisks([]);
    setUpdates('');
    setMajorUpdates([]);
    setProjectedWins([]);
    setPriorities([]);
    setTwtwStatus('NONE');
    setTwtwKpiActuals({
      callsToMake: 50, appointmentsToSet: 15, proposalsToSend: 8, dealsToClose: 3, revenueTarget: 250000,
      callsMade: 0, appointmentsSet: 0, proposalsSent: 0, dealsClosed: 0, revenueWon: 0
    });
    setTwtwRoadblocks('');
    setTwtwSupport('');

    // Reset Friday
    setCurrentWeekActions(defaultPrevFridayPlan.actionPlan.map(act => ({ text: act, completed: false, update: '' })));
    setCurrentWeekFocusAccounts(defaultPrevFridayPlan.focusAccounts.map(fa => ({ ...fa, status: 'WORKING', update: '' })));
    setFridayOpportunities([]);
    setFridaySignedDeals([]);
    setFridayNewBusiness([]);
    setFridayNarrative('');
    setFridayRoadblocks('');
    setFridaySupport('');

    setNextWeekFocusAccounts([]);
    setNextWeekKpiTargets({
      callsToMake: 50, appointmentsToSet: 15, proposalsToSend: 8, dealsToClose: 3, revenueTarget: 250000
    });
    setNextWeekActions(['', '', '', '', '']);
    setNextWeekRoadblocks('');
    setNextWeekSupport('');
    setFridayStatus('NONE');
  };

  // --- Thursday Pre-population triggers ---
  const handleLoadPreviousFridayData = () => {
    // 1. Priorities are populated from previous actions
    setPriorities(dbPrevFridayPlan.actionPlan.map(act => ({ id: crypto.randomUUID(), text: act, salespersonName: activeUserName })));
    // 2. Focus accounts loaded for review
    setCurrentWeekFocusAccounts(dbPrevFridayPlan.focusAccounts.map(acc => ({ ...acc, status: 'WORKING', update: '' })));
    // 3. Actions checklist loaded (since Phase A is on Thursday now)
    setCurrentWeekActions(dbPrevFridayPlan.actionPlan.map(act => ({ text: act, completed: false, update: '' })));
    // 4. KPI targets mapped & actuals simulated
    setTwtwKpiActuals({
      ...dbPrevFridayPlan.kpiTargets,
      callsMade: 43,
      appointmentsSet: 11,
      proposalsSent: 6,
      dealsClosed: 1,
      revenueWon: 150000
    });
    // 5. Roadblocks & support mapped
    setTwtwRoadblocks(dbPrevFridayPlan.roadblocks);
    setTwtwSupport(dbPrevFridayPlan.supportNeeded);

    // Auto-fill Wins, Risks, Projected using CRM Logic
    setWins([
      { id: 'w1', customer: 'ACME LOGISTICS', value: 150000, businessUnits: ['Road Express'], updateText: 'Signed develop agreement, trial scheduled!', salespersonName: activeUserName }
    ]);
    setRisks([
      { id: 'r1', account: 'GLOBAL CARRIERS', value: 80000, mitigation: 'Reviewing rates & negotiating spot discounts.', salespersonName: activeUserName }
    ]);
    setMajorUpdates([
      { id: 'm1', customer: 'BHP Billiton', value: 340000, businessUnits: ['Freight'], updateText: 'Contract negotiations advanced.', salespersonName: activeUserName }
    ]);
    setProjectedWins([
      { id: 'p1', account: 'ZENITH MANUFACTURING', value: 280000, expectedDate: format(new Date(), 'dd-MM-yyyy'), updateText: 'Proposals finalized', salespersonName: activeUserName }
    ]);

    // Pre-populate performance narrative with bullet points of the previous Friday's action plan
    const actionBullets = dbPrevFridayPlan.actionPlan
      .filter(act => act.trim())
      .map(act => `• ${act}: `)
      .join('\n');
    setUpdates(actionBullets ? `${actionBullets}\n\nZenith and ACME progressed strongly. Global Carriers remains a minor rate risk.` : 'Zenith and ACME progressed strongly. Global Carriers remains a minor rate risk.');

    toast({
      title: "Friday Data Loaded",
      description: "TWTW pre-populated from previous Friday plan & CRM. Review or delete entries below."
    });
  };

  // --- Auto rollover logic when focus account status changes on Friday ---
  const handleFridayFocusAccountStatusChange = (idx: number, status: 'WORKING' | 'WON' | 'LOST') => {
    const updated = [...currentWeekFocusAccounts];
    updated[idx].status = status;
    setCurrentWeekFocusAccounts(updated);

    // If marked WORKING, auto-populate into next week's focus accounts
    if (status === 'WORKING') {
      const item = updated[idx];
      const exists = nextWeekFocusAccounts.some(acc => acc.accountName.toUpperCase().trim() === item.accountName.toUpperCase().trim());
      if (!exists) {
        setNextWeekFocusAccounts(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            accountName: item.accountName,
            actionType: item.actionType,
            eav: item.eav,
            aboutAccount: item.aboutAccount ? `[Rollover] ${item.aboutAccount}` : 'Rolled over from previous week.'
          }
        ]);
        toast({
          title: "Auto-Rollover Triggered",
          description: `${item.accountName} appended to next week's focus accounts.`,
          duration: 3000
        });
      }
    } else {
      // Remove from next week if won/lost
      setNextWeekFocusAccounts(prev => prev.filter(acc => acc.accountName.toUpperCase().trim() !== updated[idx].accountName.toUpperCase().trim()));
    }
  };

  // When marking an action checklist completed/not completed
  const handleFridayActionCheckbox = (idx: number, completed: boolean) => {
    const updated = [...currentWeekActions];
    updated[idx].completed = completed;
    setCurrentWeekActions(updated);

    const actionText = updated[idx].text;
    if (!completed) {
      // Auto rollover uncompleted action to next week
      if (!nextWeekActions.some(act => act.trim() === actionText.trim())) {
        // Find empty slot or append
        const emptyIdx = nextWeekActions.findIndex(act => !act.trim());
        if (emptyIdx !== -1) {
          const acts = [...nextWeekActions];
          acts[emptyIdx] = actionText;
          setNextWeekActions(acts);
        } else {
          setNextWeekActions(prev => [...prev, actionText]);
        }
        toast({
          title: "Commitment Rolled Over",
          description: `"${actionText}" added to next week's Monday actions.`,
          duration: 2500
        });
      }
    } else {
      // Remove from next week if completed
      setNextWeekActions(prev => prev.filter(act => act.trim() !== actionText.trim()));
    }
  };

  // Pre-fill Friday Narrative from Thursday TWTW
  const handlePreFillFridayFromThursday = () => {
    setFridayNarrative(updates || 'Narrative pre-filled from Thursday.');
    setFridayRoadblocks(twtwRoadblocks || dbPrevFridayPlan.roadblocks || '');
    setFridaySupport(twtwSupport || dbPrevFridayPlan.supportNeeded || '');
    
    // Opportunities, signed deals, and new business pulled from CRM/Thursday wins
    setFridaySignedDeals(wins.map(w => ({ id: w.id, accountName: w.customer, eav: w.value, notes: w.updateText })));
    setFridayOpportunities(projectedWins.map(p => ({ id: p.id, accountName: p.account, eav: p.value, stage: 'Propose', probability: 50 })));
    
    // Automatically import Priorities from Thursday TWTW into Next Week Actions
    if (priorities.length > 0) {
      const newActions = priorities.map(p => p.text);
      while (newActions.length < 5) {
        newActions.push('');
      }
      setNextWeekActions(newActions);
    }

    // Rollover focus accounts from Thursday (status WORKING)
    const rolledOver = currentWeekFocusAccounts
      .filter(fa => fa.status === 'WORKING')
      .map(fa => ({
        id: fa.id,
        accountName: fa.accountName,
        actionType: fa.actionType,
        eav: fa.eav,
        aboutAccount: fa.update ? `[Rollover] ${fa.update}` : 'Rolled over from previous week.'
      }));
    setNextWeekFocusAccounts(rolledOver);

    toast({
      title: "Thursday Data Pulled",
      description: "Friday pack details initialized: Priorities imported & Focus Accounts rolled over."
    });
  };

  // Form submits
  const handleTwtwSubmit = (state: 'DRAFT' | 'SUBMITTED') => {
    setTwtwStatus(state);
    if (state === 'SUBMITTED') {
      setTwtwSuccessOpen(true);
    } else {
      toast({ title: "Draft Saved", description: "Thursday TWTW draft saved successfully." });
    }
  };

  const handleFridaySubmit = (state: 'DRAFT' | 'SUBMITTED') => {
    setFridayStatus(state);
    if (state === 'SUBMITTED') {
      // Commit next week planning to dbPrevFridayPlan (representing rolling week forward)
      setDbPrevFridayPlan({
        focusAccounts: nextWeekFocusAccounts,
        kpiTargets: nextWeekKpiTargets,
        actionPlan: nextWeekActions.filter(act => act.trim()),
        roadblocks: nextWeekRoadblocks,
        supportNeeded: nextWeekSupport
      });
      setFridaySuccessOpen(true);
    } else {
      toast({ title: "Draft Saved", description: "Friday pack and planning draft saved successfully." });
    }
  };

  // --- Add/Delete handlers for lists ---
  const addWinRow = () => setWins([...wins, { id: crypto.randomUUID(), customer: '', value: 0, updateText: '', businessUnits: [], salespersonName: activeUserName }]);
  const removeWinRow = (id: string) => setWins(wins.filter(w => w.id !== id));
  const toggleBusinessUnit = (id: string, bu: string) => {
    setWins(wins.map(w => {
      if (w.id !== id) return w;
      const bus = w.businessUnits || [];
      const newBus = bus.includes(bu) ? bus.filter(b => b !== bu) : [...bus, bu];
      return { ...w, businessUnits: newBus };
    }));
  };
  const updateWinField = (id: string, field: keyof WinItem, val: any) => {
    setWins(wins.map(w => w.id === id ? { ...w, [field]: val } : w));
  };

  const addRiskRow = () => setRisks([...risks, { id: crypto.randomUUID(), account: '', value: 0, mitigation: '', businessUnits: [], salespersonName: activeUserName }]);
  const removeRiskRow = (id: string) => setRisks(risks.filter(r => r.id !== id));
  const updateRiskField = (id: string, field: keyof RiskItem, val: any) => {
    setRisks(risks.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const addMajorUpdateRow = () => setMajorUpdates([...majorUpdates, { id: crypto.randomUUID(), customer: '', value: 0, businessUnits: [], updateText: '', salespersonName: activeUserName }]);
  const removeMajorUpdateRow = (id: string) => setMajorUpdates(majorUpdates.filter(m => m.id !== id));
  const toggleMajorUpdateBU = (id: string, bu: string) => {
    setMajorUpdates(majorUpdates.map(m => {
      if (m.id !== id) return m;
      const bus = m.businessUnits || [];
      const newBus = bus.includes(bu) ? bus.filter(b => b !== bu) : [...bus, bu];
      return { ...m, businessUnits: newBus };
    }));
  };
  const updateMajorUpdateField = (id: string, field: keyof MajorUpdateItem, val: any) => {
    setMajorUpdates(majorUpdates.map(m => m.id === id ? { ...m, [field]: val } : m));
  };

  const toggleProjectedWinBU = (id: string, bu: string) => {
    setProjectedWins(wins => wins.map(w => {
      if (w.id === id) {
        const currentBUs = w.businessUnits || [];
        const newBUs = currentBUs.includes(bu) 
          ? currentBUs.filter(b => b !== bu)
          : [...currentBUs, bu];
        return { ...w, businessUnits: newBUs };
      }
      return w;
    }));
  };

  const addProjectedRow = () => setProjectedWins([...projectedWins, { id: crypto.randomUUID(), account: '', value: 0, expectedDate: format(new Date(), 'dd-MM-yyyy'), updateText: '', salespersonName: activeUserName }]);
  const removeProjectedRow = (id: string) => setProjectedWins(projectedWins.filter(p => p.id !== id));
  const updateProjectedField = (id: string, field: keyof ProjectedWin, val: any) => {
    setProjectedWins(projectedWins.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const addPriorityRow = () => setPriorities([...priorities, { id: crypto.randomUUID(), text: '', salespersonName: activeUserName }]);
  const removePriority = (id: string) => setPriorities(priorities.filter(p => p.id !== id));
  const updatePriorityField = (id: string, field: string, val: any) => {
    setPriorities(priorities.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  // --- PDF Export helper ---
  const handleExportPdf = () => {
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      toast({ 
        variant: "destructive", 
        title: "Popup Blocked", 
        description: "Please allow popups to export to PDF." 
      });
      return;
    }

    // Get the current week for the title
    const weekLabel = selectedWeek.split('-')[1];

    // Retrieve starred items for Key Standouts page
    const getStarredItems = (arrayField: string) => {
      const items: any[] = [];
      Object.entries(submissionsByState).forEach(([state, subs]) => {
        subs.forEach(sub => {
          const arr = sub[arrayField as keyof typeof sub] as any[];
          if (arr) {
            arr.filter((i: any) => i.isStarred && !i.isHidden).forEach((i: any) => 
              items.push({ ...i, subId: sub.id, state, salespersonName: sub.userName || 'N/A' })
            );
          }
        });
      });
      return items;
    };

    const starredWins = getStarredItems('wins');
    const starredRisks = getStarredItems('risks');
    const starredUpdates = getStarredItems('majorUpdates');
    const starredProjected = getStarredItems('projectedWins');
    const starredPriorities = getStarredItems('priorities');

    const hasStandouts = starredWins.length > 0 || starredRisks.length > 0 || starredUpdates.length > 0 || starredProjected.length > 0 || starredPriorities.length > 0;

    printWindow.document.write(`
      <html>
        <head>
          <title>TGE North Parcels - TWTW - Week ${weekLabel}</title>
          <style>
            @page { 
              size: landscape; 
              margin: 10mm; 
            }
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              color: #1e293b;
              margin: 0;
              padding: 20px;
              font-size: 9px;
              background: white;
            }
            .report-header {
              text-align: center;
              background-color: #0f172a;
              color: white;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 8px;
            }
            .report-header h1 {
              margin: 0;
              font-size: 18px;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 900;
            }
            .report-header p {
              margin: 4px 0 0 0;
              font-size: 9px;
              color: #94a3b8;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            
            /* Standouts Grid */
            .standouts-header {
              border-bottom: 3px solid #f59e0b;
              padding-bottom: 6px;
              margin-bottom: 15px;
            }
            .standouts-title {
              font-size: 16px;
              font-weight: 900;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .standouts-subtitle {
              font-size: 9px;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            .page-container {
              page-break-after: always;
              clear: both;
            }
            .page-container:last-child {
              page-break-after: avoid;
            }

            .region-title {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 4px;
              margin-top: 20px;
              margin-bottom: 8px;
              color: #0f172a;
              page-break-after: avoid;
              break-after: avoid;
            }
            .region-title .badge {
              font-size: 8px;
              font-weight: 900;
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              color: #475569;
              padding: 1px 6px;
              border-radius: 4px;
              margin-left: 6px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 16px; 
              table-layout: fixed;
            }
            th, td { 
              border: 1px solid #cbd5e1; 
              padding: 5px 6px; 
              font-size: 8px; 
              vertical-align: top; 
              text-align: left; 
              word-wrap: break-word; 
              overflow-wrap: break-word;
            }
            th { 
              background-color: #f1f5f9; 
              font-weight: 800; 
              text-transform: uppercase; 
              font-size: 7px; 
              letter-spacing: 0.5px; 
              color: #475569;
            }
            tbody tr {
              border-bottom: 12px solid white;
            }

            .item-block {
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              margin-bottom: 4px;
            }
            .item-block:last-child {
              border-bottom: none;
              padding-bottom: 0;
              margin-bottom: 0;
            }
            .item-customer {
              font-weight: bold;
              color: #0f172a;
            }
            .item-value {
              font-weight: 800;
              margin-top: 1px;
            }
            .win-text { color: #166534; }
            .risk-text { color: #9f1239; }
            .update-text { color: #1e40af; }
            .projected-text { color: #6b21a8; }
            .item-salesperson {
              font-size: 7px;
              color: #64748b;
              font-weight: bold;
              margin-top: 1.5px;
            }
            .item-bu {
              font-size: 7px;
              color: #94a3b8;
              margin-top: 1.5px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .item-desc {
              margin-top: 2px;
              color: #334155;
            }
            .empty-text {
              color: #94a3b8;
              font-style: italic;
              text-align: center;
              font-size: 8px;
              padding: 2px 0;
            }
            .legacy-update {
              background-color: #fffbeb;
              border: 1px solid #fef3c7;
              padding: 4px;
              border-radius: 4px;
              font-size: 8px;
              color: #92400e;
              margin-bottom: 4px;
              white-space: pre-wrap;
            }
            .avoid-break { page-break-inside: avoid; }
            .page-container {
              page-break-before: always;
              clear: both;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>TGE North Parcels - TWTW</h1>
            <p>Week ${weekLabel} • Consolidated Team Performance Report</p>
          </div>
          
          <!-- PAGE 1: KEY STANDOUTS -->
          ${hasStandouts ? `
          <div class="page-container" style="page-break-before: avoid;">
            <div class="standouts-header">
              <div class="standouts-title">Key Standouts &amp; Highlights</div>
              <div class="standouts-subtitle">Curated items from the week's submissions</div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th style="width: 20%">Key Wins (${starredWins.length})</th>
                  <th style="width: 10%">Churn Risk (${starredRisks.length})</th>
                  <th style="width: 30%">Major Updates (${starredUpdates.length})</th>
                  <th style="width: 20%">30 Day Projected (${starredProjected.length})</th>
                  <th style="width: 20%">Priorities (${starredPriorities.length})</th>
                </tr>
              </thead>
              <tbody>
                <tr class="avoid-break">
                  <td>
                    ${starredWins.map(w => `
                      <div class="item-block">
                        <span class="card-badge">${w.state}</span>
                        <div class="item-customer">${w.customer}&nbsp;&nbsp;<span class="win-text" style="font-weight: 800;">${formatEAV(w.value)}</span></div>
                        <div class="item-salesperson">${w.salespersonName || 'N/A'}</div>
                        ${w.businessUnits && w.businessUnits.length > 0 ? `<div class="item-bu">BU: ${w.businessUnits.join(', ')}</div>` : ''}
                        ${w.updateText ? `<div class="item-desc">${w.updateText}</div>` : ''}
                      </div>
                    `).join('') || '<div class="empty-text">-</div>'}
                  </td>
                  <td>
                    ${starredRisks.map(r => `
                      <div class="item-block">
                        <span class="card-badge">${r.state}</span>
                        <div class="item-customer">${r.account}&nbsp;&nbsp;<span class="risk-text" style="font-weight: 800;">${formatEAV(r.value)}</span></div>
                        <div class="item-salesperson">${r.salespersonName || 'N/A'}</div>
                        ${r.businessUnits && r.businessUnits.length > 0 ? `<div class="item-bu">BU: ${r.businessUnits.join(', ')}</div>` : ''}
                        <div class="item-desc">Mitigation: ${r.mitigation}</div>
                      </div>
                    `).join('') || '<div class="empty-text">-</div>'}
                  </td>
                  <td>
                    ${starredUpdates.map(m => `
                      <div class="item-block">
                        <span class="card-badge">${m.state}</span>
                        <div class="item-customer">${m.customer}${m.value > 0 ? `&nbsp;&nbsp;<span class="update-text" style="font-weight: 800;">${formatEAV(m.value)}</span>` : ''}</div>
                        <div class="item-salesperson">${m.salespersonName || 'N/A'}</div>
                        ${m.businessUnits && m.businessUnits.length > 0 ? `<div class="item-bu">BU: ${m.businessUnits.join(', ')}</div>` : ''}
                        ${m.updateText ? `<div class="item-desc">${m.updateText}</div>` : ''}
                      </div>
                    `).join('') || '<div class="empty-text">-</div>'}
                  </td>
                  <td>
                    ${starredProjected.map(p => `
                      <div class="item-block">
                        <span class="card-badge">${p.state}</span>
                        <div class="item-customer">${p.account}&nbsp;&nbsp;<span class="projected-text" style="font-weight: 800;">${formatEAV(p.value)}</span></div>
                        <div class="item-salesperson">${p.salespersonName || 'N/A'}</div>
                        ${p.businessUnits && p.businessUnits.length > 0 ? `<div class="item-bu">BU: ${p.businessUnits.join(', ')}</div>` : ''}
                        ${p.updateText ? `<div class="item-desc">${p.updateText}</div>` : ''}
                      </div>
                    `).join('') || '<div class="empty-text">-</div>'}
                  </td>
                  <td>
                    ${starredPriorities.map(pr => `
                      <div class="item-block">
                        <span class="card-badge">${pr.state}</span>
                        <div class="item-desc">${pr.text}</div>
                        <div class="item-salesperson">${pr.salespersonName || 'N/A'}</div>
                      </div>
                    `).join('') || '<div class="empty-text">-</div>'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ''}
          
          <!-- SUBSEQUENT PAGES: COLLATION BY REGION -->
          ${Object.entries(submissionsByState).length === 0 ? `
            <div class="empty-text" style="font-size: 14px; margin-top: 50px;">No submissions available to collate yet.</div>
          ` : (() => {
            const stateOrder = ['QLD', 'SA', 'WA', 'SME'];
            const sortedEntries = Object.entries(submissionsByState).sort((a, b) => {
              const idxA = stateOrder.indexOf(a[0]);
              const idxB = stateOrder.indexOf(b[0]);
              return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
            });
            return sortedEntries.map(([state, subs], idx) => {
              const allStateWins = subs.flatMap(sub => (sub.wins || []).filter((w: any) => !w.isHidden).map((w: any) => ({ ...w, rep: sub.userName || 'N/A' })));
              const allStateRisks = subs.flatMap(sub => (sub.risks || []).filter((r: any) => !r.isHidden).map((r: any) => ({ ...r, rep: sub.userName || 'N/A' })));
              const allStateUpdates = subs.flatMap(sub => {
                const legacy = sub.updates ? [{ isLegacy: true, text: sub.updates, rep: sub.userName || 'N/A' }] : [];
                const updates = (sub.majorUpdates || []).filter((m: any) => !m.isHidden).map((m: any) => ({ ...m, rep: sub.userName || 'N/A' }));
                return [...legacy, ...updates];
              });
              const allStateProjected = subs.flatMap(sub => (sub.projectedWins || []).filter((p: any) => !p.isHidden).map((p: any) => ({ ...p, rep: sub.userName || 'N/A' })));
              const allStatePriorities = subs.flatMap(sub => (sub.priorities || []).filter((pr: any) => !pr.isHidden).map((pr: any) => ({ ...pr, rep: sub.userName || 'N/A' })));

              return `
              <div class="page-container" style="${idx === 0 && !hasStandouts ? 'page-break-before: avoid;' : ''}">
                <div class="region-title">
                  ${state} Region <span class="badge">${subs.length} Reps</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 20%">Key Wins</th>
                      <th style="width: 10%">Churn Risk</th>
                      <th style="width: 30%">Major Updates</th>
                      <th style="width: 20%">30 Day Projected</th>
                      <th style="width: 20%">Priorities</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="avoid-break">
                      <td>
                        ${allStateWins.map(w => `
                          <div class="item-block">
                            <div class="item-customer">${w.customer}&nbsp;&nbsp;<span class="win-text" style="font-weight: 800;">${formatEAV(w.value)}</span></div>
                            <div class="item-salesperson">${w.rep}</div>
                            ${w.businessUnits && w.businessUnits.length > 0 ? `<div class="item-bu">BU: ${w.businessUnits.join(', ')}</div>` : ''}
                            ${w.updateText ? `<div class="item-desc">${w.updateText}</div>` : ''}
                          </div>
                        `).join('') || '<div class="empty-text">-</div>'}
                      </td>
                      <td>
                        ${allStateRisks.map(r => `
                          <div class="item-block">
                            <div class="item-customer">${r.account}&nbsp;&nbsp;<span class="risk-text" style="font-weight: 800;">${formatEAV(r.value)}</span></div>
                            <div class="item-salesperson">${r.rep}</div>
                            ${r.businessUnits && r.businessUnits.length > 0 ? `<div class="item-bu">BU: ${r.businessUnits.join(', ')}</div>` : ''}
                            <div class="item-desc">Mitigation: ${r.mitigation}</div>
                          </div>
                        `).join('') || '<div class="empty-text">-</div>'}
                      </td>
                      <td>
                        ${allStateUpdates.map(m => m.isLegacy ? `
                          <div class="legacy-update">${m.text}</div>
                        ` : `
                          <div class="item-block">
                            <div class="item-customer">${m.customer}${m.value > 0 ? `&nbsp;&nbsp;<span class="update-text" style="font-weight: 800;">${formatEAV(m.value)}</span>` : ''}</div>
                            <div class="item-salesperson">${m.rep}</div>
                            ${m.businessUnits && m.businessUnits.length > 0 ? `<div class="item-bu">BU: ${m.businessUnits.join(', ')}</div>` : ''}
                            ${m.updateText ? `<div class="item-desc">${m.updateText}</div>` : ''}
                          </div>
                        `).join('') || '<div class="empty-text">-</div>'}
                      </td>
                      <td>
                        ${allStateProjected.map(p => `
                          <div class="item-block">
                            <div class="item-customer">${p.account}&nbsp;&nbsp;<span class="projected-text" style="font-weight: 800;">${formatEAV(p.value)}</span></div>
                            <div class="item-salesperson">${p.rep}</div>
                            ${p.businessUnits && p.businessUnits.length > 0 ? `<div class="item-bu">BU: ${p.businessUnits.join(', ')}</div>` : ''}
                            ${p.updateText ? `<div class="item-desc">${p.updateText}</div>` : ''}
                          </div>
                        `).join('') || '<div class="empty-text">-</div>'}
                      </td>
                      <td>
                        ${allStatePriorities.map(pr => `
                          <div class="item-block">
                            <div class="item-desc">${pr.text}</div>
                            <div class="item-salesperson">${pr.rep}</div>
                          </div>
                        `).join('') || '<div class="empty-text">-</div>'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              `;
            }).join('');
          })()}

          <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 7px; color: #94a3b8;">
            Generated on ${new Date().toLocaleString()} • Confidential Management Report
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
  };

  const handleExportOversizedPdf = async () => {
    toast({ title: "Generating PDF...", description: "Building high-resolution single-sheet PDF. Please wait." });

    // Retrieve starred items for Key Standouts page
    const getStarredItems = (arrayField: string) => {
      const items: any[] = [];
      Object.entries(submissionsByState).forEach(([state, subs]) => {
        subs.forEach(sub => {
          const arr = sub[arrayField as keyof typeof sub] as any[];
          if (arr) {
            arr.filter((i: any) => i.isStarred && !i.isHidden).forEach((i: any) => 
              items.push({ ...i, subId: sub.id, state, salespersonName: sub.userName || 'N/A' })
            );
          }
        });
      });
      return items;
    };

    const starredWins = getStarredItems('wins');
    const starredRisks = getStarredItems('risks');
    const starredUpdates = getStarredItems('majorUpdates');
    const starredProjected = getStarredItems('projectedWins');
    const starredPriorities = getStarredItems('priorities');

    const hasStandouts = starredWins.length > 0 || starredRisks.length > 0 || starredUpdates.length > 0 || starredProjected.length > 0 || starredPriorities.length > 0;

    // Create offscreen container
    const tempDiv = document.createElement('div');
    tempDiv.id = 'temp-oversized-print';
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-99999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '1323px'; // 35cm at 96 dpi
    tempDiv.style.backgroundColor = '#ffffff';

    const stateOrder = ['QLD', 'SA', 'WA', 'SME'];
    const sortedEntries = Object.entries(submissionsByState).sort((a, b) => {
      const idxA = stateOrder.indexOf(a[0]);
      const idxB = stateOrder.indexOf(b[0]);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });

    const regionsHtml = sortedEntries.map(([state, subs]) => {
      const allStateWins = subs.flatMap(sub => (sub.wins || []).filter((w: any) => !w.isHidden).map((w: any) => ({ ...w, rep: sub.salespersonName || sub.userName || 'N/A' })));
      const allStateRisks = subs.flatMap(sub => (sub.risks || []).filter((r: any) => !r.isHidden).map((r: any) => ({ ...r, rep: sub.salespersonName || sub.userName || 'N/A' })));
      const allStateUpdates = subs.flatMap(sub => {
        const legacy = sub.updates ? [{ isLegacy: true, text: sub.updates, rep: sub.salespersonName || sub.userName || 'N/A' }] : [];
        const updates = (sub.majorUpdates || []).filter((m: any) => !m.isHidden).map((m: any) => ({ ...m, rep: sub.salespersonName || sub.userName || 'N/A' }));
        return [...legacy, ...updates];
      });
      const allStateProjected = subs.flatMap(sub => (sub.projectedWins || []).filter((p: any) => !p.isHidden).map((p: any) => ({ ...p, rep: sub.salespersonName || sub.userName || 'N/A' })));
      const allStatePriorities = subs.flatMap(sub => (sub.priorities || []).filter((pr: any) => !pr.isHidden).map((pr: any) => ({ ...pr, rep: sub.salespersonName || sub.userName || 'N/A' })));

      return `
        <div class="page-container">
          <div class="region-header">
            <h2>${state} Region <span class="badge">${subs.length} Reps</span></h2>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%">Key Wins</th>
                <th style="width: 10%">Churn Risk</th>
                <th style="width: 30%">Major Updates</th>
                <th style="width: 20%">30 Day Projected</th>
                <th style="width: 20%">Priorities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  ${allStateWins.map(w => `
                    <div class="item-block">
                      <div class="item-customer">${w.customer}&nbsp;&nbsp;<span class="win-text" style="font-weight: 800;">${formatEAV(w.value)}</span></div>
                      <div class="item-salesperson">${w.rep}</div>
                      ${w.businessUnits && w.businessUnits.length > 0 ? `<div class="item-bu">BU: ${w.businessUnits.join(', ')}</div>` : ''}
                      ${w.updateText ? `<div class="item-desc">${w.updateText}</div>` : ''}
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${allStateRisks.map(r => `
                    <div class="item-block">
                      <div class="item-customer">${r.account}&nbsp;&nbsp;<span class="risk-text" style="font-weight: 800;">${formatEAV(r.value)}</span></div>
                      <div class="item-salesperson">${r.rep}</div>
                            ${r.businessUnits && r.businessUnits.length > 0 ? `<div class="item-bu">BU: ${r.businessUnits.join(', ')}</div>` : ''}
                      <div class="item-desc">Mitigation: ${r.mitigation}</div>
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${allStateUpdates.map(m => m.isLegacy ? `
                    <div class="legacy-update">${m.text}</div>
                  ` : `
                    <div class="item-block">
                      <div class="item-customer">${m.customer}${m.value > 0 ? `&nbsp;&nbsp;<span class="update-text" style="font-weight: 800;">${formatEAV(m.value)}</span>` : ''}</div>
                      <div class="item-salesperson">${m.rep}</div>
                      ${m.businessUnits && m.businessUnits.length > 0 ? `<div class="item-bu">BU: ${m.businessUnits.join(', ')}</div>` : ''}
                      ${m.updateText ? `<div class="item-desc">${m.updateText}</div>` : ''}
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${allStateProjected.map(p => `
                    <div class="item-block">
                      <div class="item-customer">${p.account}&nbsp;&nbsp;<span class="projected-text" style="font-weight: 800;">${formatEAV(p.value)}</span></div>
                      <div class="item-salesperson">${p.rep}</div>
                      ${p.businessUnits && p.businessUnits.length > 0 ? `<div class="item-bu">BU: ${p.businessUnits.join(', ')}</div>` : ''}
                      ${p.updateText ? `<div class="item-desc">${p.updateText}</div>` : ''}
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${allStatePriorities.map(pr => `
                    <div class="item-block">
                      <div class="item-desc">${pr.text}</div>
                      <div class="item-salesperson">${pr.rep}</div>
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    tempDiv.innerHTML = `
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
          color: #1e293b;
          margin: 0;
          padding: 20px;
          font-size: 10px;
          background-color: #ffffff;
        }
        .report-header {
          text-align: center;
          background-color: #0f172a;
          color: white;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 12px;
        }
        .report-header h1 {
          margin: 0;
          font-size: 18px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 900;
        }
        .report-header p {
          margin: 4px 0 0 0;
          font-size: 9px;
          color: #94a3b8;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .standouts-header {
          border-bottom: 3px solid #f59e0b;
          padding-bottom: 6px;
          margin-bottom: 15px;
        }
        .standouts-title {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: -0.5px;
        }
        .standouts-subtitle {
          font-size: 9px;
          font-weight: bold;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .card-badge {
          display: inline-block;
          font-size: 6px;
          font-weight: 900;
          padding: 1px 3px;
          border-radius: 2px;
          background-color: #f1f5f9;
          border: 1px solid #e2e8f0;
          text-transform: uppercase;
          margin-bottom: 3px;
          color: #475569;
        }
        .region-header h2 {
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: -0.5px;
          color: #0f172a;
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 4px;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .region-header h2 .badge {
          font-size: 8px;
          font-weight: 900;
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
          padding: 1px 4px;
          border-radius: 4px;
          margin-left: 6px;
          vertical-align: middle;
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
        th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; }
        th { background-color: #1e293b; font-weight: 900; text-transform: uppercase; color: white; font-size: 8px; letter-spacing: 0.5px; }
        td { line-height: 1.35; word-break: break-word; }
        .item-block {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 6px;
          font-size: 8.5px;
        }
        .item-block:last-child {
          border-bottom: none;
          padding-bottom: 0;
          margin-bottom: 0;
        }
        .item-customer {
          font-weight: bold;
          color: #0f172a;
        }
        .win-text { color: #166534; }
        .risk-text { color: #9f1239; }
        .update-text { color: #1e40af; }
        .projected-text { color: #6b21a8; }
        .item-salesperson {
          font-size: 7.5px;
          color: #64748b;
          font-weight: bold;
          margin-top: 1.5px;
        }
        .item-bu {
          font-size: 7.5px;
          color: #94a3b8;
          margin-top: 1.5px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .item-desc {
          margin-top: 3px;
          color: #334155;
        }
        .legacy-update {
          background-color: #fffbeb;
          border: 1px solid #fef3c7;
          padding: 5px;
          border-radius: 5px;
          font-size: 8.5px;
          color: #92400e;
          margin-bottom: 6px;
          white-space: pre-wrap;
        }
        .empty-text {
          color: #94a3b8;
          font-style: italic;
          text-align: center;
          font-size: 10px;
          padding: 4px 0;
        }
      </style>
      <div style="padding: 15px; box-sizing: border-box; background-color: #ffffff;">
        <div class="report-header">
          <h1>The Week That Was (TWTW) - Week ${selectedWeek.split('-')[1]}</h1>
          <p>Consolidated Executive Weekly Briefing (Oversized Single Sheet)</p>
        </div>

        <!-- STANDOUTS -->
        ${hasStandouts ? `
        <div class="page-container">
          <div class="standouts-header">
            <div class="standouts-title">Key Standouts &amp; Highlights</div>
            <div class="standouts-subtitle">Curated items from the week's submissions</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%">Key Wins (${starredWins.length})</th>
                <th style="width: 10%">Churn Risk (${starredRisks.length})</th>
                <th style="width: 30%">Major Updates (${starredUpdates.length})</th>
                <th style="width: 20%">30 Day Projected (${starredProjected.length})</th>
                <th style="width: 20%">Priorities (${starredPriorities.length})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  ${starredWins.map(w => `
                    <div class="item-block">
                      <span class="card-badge">${w.state}</span>
                      <div class="item-customer">${w.customer}&nbsp;&nbsp;<span class="win-text" style="font-weight: 800;">${formatEAV(w.value)}</span></div>
                      <div class="item-salesperson">${w.salespersonName || 'N/A'}</div>
                      ${w.businessUnits && w.businessUnits.length > 0 ? `<div class="item-bu">BU: ${w.businessUnits.join(', ')}</div>` : ''}
                      ${w.updateText ? `<div class="item-desc">${w.updateText}</div>` : ''}
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${starredRisks.map(r => `
                    <div class="item-block">
                      <span class="card-badge">${r.state}</span>
                      <div class="item-customer">${r.account}&nbsp;&nbsp;<span class="risk-text" style="font-weight: 800;">${formatEAV(r.value)}</span></div>
                      <div class="item-salesperson">${r.salespersonName || 'N/A'}</div>
                        ${r.businessUnits && r.businessUnits.length > 0 ? `<div class="item-bu">BU: ${r.businessUnits.join(', ')}</div>` : ''}
                      ${r.updateText ? `<div class="item-desc">${r.updateText}</div>` : ''}
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${starredUpdates.map(m => `
                    <div class="item-block">
                      <span class="card-badge">${m.state}</span>
                      <div class="item-customer">${m.customer}${m.value > 0 ? `&nbsp;&nbsp;<span class="update-text" style="font-weight: 800;">${formatEAV(m.value)}</span>` : ''}</div>
                      <div class="item-salesperson">${m.salespersonName || 'N/A'}</div>
                        ${m.businessUnits && m.businessUnits.length > 0 ? `<div class="item-bu">BU: ${m.businessUnits.join(', ')}</div>` : ''}
                        ${m.updateText ? `<div class="item-desc">${m.updateText}</div>` : ''}
                      </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${starredProjected.map(p => `
                    <div class="item-block">
                      <span class="card-badge">${p.state}</span>
                      <div class="item-customer">${p.account}&nbsp;&nbsp;<span class="projected-text" style="font-weight: 800;">${formatEAV(p.value)}</span></div>
                      <div class="item-salesperson">${p.salespersonName || 'N/A'}</div>
                      ${p.businessUnits && p.businessUnits.length > 0 ? `<div class="item-bu">BU: ${p.businessUnits.join(', ')}</div>` : ''}
                      ${p.updateText ? `<div class="item-desc">${p.updateText}</div>` : ''}
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
                <td>
                  ${starredPriorities.map(pr => `
                    <div class="item-block">
                      <span class="card-badge">${pr.state}</span>
                      <div class="item-desc">${pr.text}</div>
                      <div class="item-salesperson">${pr.salespersonName || 'N/A'}</div>
                    </div>
                  `).join('') || '<div class="empty-text">-</div>'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- REGIONS -->
        ${regionsHtml}
      </div>
    `;

    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1323,
        windowWidth: 1323
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.90);
      const imgWidthPt = 992.12;
      const imgHeightPt = (canvas.height * imgWidthPt) / canvas.width;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [imgWidthPt, imgHeightPt]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthPt, imgHeightPt);
      pdf.save(`TWTW_Oversized_Week_${selectedWeek.split('-')[1]}.pdf`);
      toast({ title: "PDF Export Complete", description: "The oversized single-sheet PDF has been downloaded." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "PDF Export Failed", description: "Could not generate oversized PDF." });
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const handleExportCondensedPdf = () => {
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      toast({ 
        variant: "destructive", 
        title: "Popup Blocked", 
        description: "Please allow popups to export to PDF." 
      });
      return;
    }

    // Get the current week for the title
    const weekLabel = selectedWeek.split('-')[1];

    // Combine data across all states/regions
    const allWins: any[] = [];
    const allRisks: any[] = [];
    const allUpdates: any[] = [];
    const allProjected: any[] = [];
    const allPriorities: any[] = [];

    Object.entries(submissionsByState).forEach(([state, subs]) => {
      subs.forEach((sub: any) => {
        const rep = sub.userName || sub.userId || 'N/A';
        
        (sub.wins || []).filter((w: any) => !w.isHidden).forEach((w: any) => {
          allWins.push({ ...w, state, rep });
        });
        (sub.risks || []).filter((r: any) => !r.isHidden).forEach((r: any) => {
          allRisks.push({ ...r, state, rep });
        });
        if (sub.updates) {
          allUpdates.push({ customer: 'General Update', value: 0, updateText: sub.updates, state, rep, businessUnits: [] });
        }
        (sub.majorUpdates || []).filter((m: any) => !m.isHidden).forEach((m: any) => {
          allUpdates.push({ ...m, state, rep });
        });
        (sub.projectedWins || []).filter((p: any) => !p.isHidden).forEach((p: any) => {
          allProjected.push({ ...p, state, rep });
        });
        (sub.priorities || []).filter((pr: any) => !pr.isHidden).forEach((pr: any) => {
          allPriorities.push({ ...pr, state, rep });
        });
      });
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Condensed TWTW Collation - Week ${weekLabel}</title>
          <style>
            @page { 
              size: landscape; 
              margin: 6mm; 
            }
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              color: #1e293b;
              margin: 0;
              padding: 10px;
              font-size: 7.5px;
              background: white;
            }
            .report-header {
              text-align: center;
              background-color: #0f172a;
              color: white;
              padding: 10px;
              margin-bottom: 12px;
              border-radius: 6px;
            }
            .report-header h1 {
              margin: 0;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 900;
            }
            .report-header p {
              margin: 2px 0 0 0;
              font-size: 7.5px;
              color: #94a3b8;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1.5px;
            }
            .section-container {
              page-break-inside: avoid;
              margin-bottom: 15px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -0.5px;
              color: #0f172a;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 3px;
              margin-top: 0;
              margin-bottom: 6px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 8px; 
              table-layout: fixed;
            }
            th, td { 
              border: 1px solid #cbd5e1; 
              padding: 3px 4px; 
              font-size: 7px; 
              vertical-align: top; 
              text-align: left; 
              word-wrap: break-word; 
              overflow-wrap: break-word;
            }
            th { 
              background-color: #f1f5f9; 
              font-weight: 800; 
              text-transform: uppercase; 
              font-size: 6.5px; 
              letter-spacing: 0.5px; 
              color: #475569;
            }
            .badge {
              display: inline-block;
              font-size: 6.5px;
              font-weight: 900;
              padding: 1px 4px;
              border-radius: 3px;
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              color: #475569;
              text-transform: uppercase;
            }
            .win-text { color: #166534; font-weight: 850; }
            .risk-text { color: #9f1239; font-weight: 850; }
            .update-text { color: #1e40af; font-weight: 850; }
            .projected-text { color: #6b21a8; font-weight: 850; }
            .empty-text {
              color: #94a3b8;
              font-style: italic;
              text-align: center;
              font-size: 7px;
              padding: 6px 0;
              border: 1px solid #cbd5e1;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>TGE Parcel North - The Week That Was</h1>
            <p>Week ${weekLabel} • Consolidated Team Performance Report</p>
          </div>

          <!-- SECTION 1: KEY WINS -->
          <div class="section-container">
            <div class="section-title">Key Wins</div>
            ${allWins.length === 0 ? '<div class="empty-text">No Key Wins recorded.</div>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 8%">State</th>
                  <th style="width: 15%">Representative</th>
                  <th style="width: 20%">Customer</th>
                  <th style="width: 12%">Value</th>
                  <th style="width: 15%">BU</th>
                  <th style="width: 30%">Detail</th>
                </tr>
              </thead>
              <tbody>
                ${allWins.map(w => `
                  <tr>
                    <td><span class="badge">${w.state}</span></td>
                    <td><strong>${w.rep}</strong></td>
                    <td><strong>${w.customer}</strong></td>
                    <td class="win-text">${formatEAV(w.value)}</td>
                    <td>${w.businessUnits && w.businessUnits.length > 0 ? w.businessUnits.join(', ') : '-'}</td>
                    <td>${w.updateText || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- SECTION 2: CHURN RISKS -->
          <div class="section-container">
            <div class="section-title">Churn Risks</div>
            ${allRisks.length === 0 ? '<div class="empty-text">No Churn Risks recorded.</div>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 8%">State</th>
                  <th style="width: 15%">Representative</th>
                  <th style="width: 22%">Account</th>
                  <th style="width: 15%">Value</th>
                  <th style="width: 40%">Mitigation Plan</th>
                </tr>
              </thead>
              <tbody>
                ${allRisks.map(r => `
                  <tr>
                    <td><span class="badge">${r.state}</span></td>
                    <td><strong>${r.rep}</strong></td>
                    <td><strong>${r.account}</strong></td>
                    <td class="risk-text">${formatEAV(r.value)}</td>
                    <td>${r.mitigation || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- SECTION 3: MAJOR UPDATES -->
          <div class="section-container">
            <div class="section-title">Major Updates</div>
            ${allUpdates.length === 0 ? '<div class="empty-text">No Major Updates recorded.</div>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 8%">State</th>
                  <th style="width: 15%">Representative</th>
                  <th style="width: 20%">Customer</th>
                  <th style="width: 12%">Value</th>
                  <th style="width: 15%">BU</th>
                  <th style="width: 30%">Detail</th>
                </tr>
              </thead>
              <tbody>
                ${allUpdates.map(u => `
                  <tr>
                    <td><span class="badge">${u.state}</span></td>
                    <td><strong>${u.rep}</strong></td>
                    <td><strong>${u.customer}</strong></td>
                    <td class="update-text">${u.value > 0 ? formatEAV(u.value) : '-'}</td>
                    <td>${u.businessUnits && u.businessUnits.length > 0 ? u.businessUnits.join(', ') : '-'}</td>
                    <td>${u.updateText || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- SECTION 4: 30 DAY PROJECTED -->
          <div class="section-container">
            <div class="section-title">30 Day Projected Wins</div>
            ${allProjected.length === 0 ? '<div class="empty-text">No Projected Wins recorded.</div>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 8%">State</th>
                  <th style="width: 15%">Representative</th>
                  <th style="width: 20%">Account</th>
                  <th style="width: 12%">Value</th>
                  <th style="width: 15%">BU</th>
                  <th style="width: 30%">Detail</th>
                </tr>
              </thead>
              <tbody>
                ${allProjected.map(p => `
                  <tr>
                    <td><span class="badge">${p.state}</span></td>
                    <td><strong>${p.rep}</strong></td>
                    <td><strong>${p.account}</strong></td>
                    <td class="projected-text">${formatEAV(p.value)}</td>
                    <td>${p.businessUnits && p.businessUnits.length > 0 ? p.businessUnits.join(', ') : '-'}</td>
                    <td>${p.updateText || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- SECTION 5: PRIORITIES -->
          <div class="section-container">
            <div class="section-title">Priorities</div>
            ${allPriorities.length === 0 ? '<div class="empty-text">No Priorities recorded.</div>' : `
            <table>
              <thead>
                <tr>
                  <th style="width: 8%">State</th>
                  <th style="width: 17%">Representative</th>
                  <th style="width: 75%">Priority / Objective</th>
                </tr>
              </thead>
              <tbody>
                ${allPriorities.map(pr => `
                  <tr>
                    <td><span class="badge">${pr.state}</span></td>
                    <td><strong>${pr.rep}</strong></td>
                    <td>${pr.text || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <div style="margin-top: 15px; padding-top: 6px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 6px; color: #94a3b8;">
            Generated on ${new Date().toLocaleString()} • Confidential Management Report
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // Mock collation dataset (combining user inputs with 2 other mock BDMs)
  const collatedMockSubmissions = useMemo(() => {
    // 1. Map user submission
    const userWinsFormatted = wins.map(w => `• ${w.customer || 'TBC'} ($${w.value.toLocaleString()}) - ${w.updateText}`).join('\n') || '-';
    const userRisksFormatted = risks.map(r => `• ${r.account || 'TBC'} ($${r.value.toLocaleString()})\n  Mitigation: ${r.mitigation}`).join('\n\n') || '-';
    const userProjectedFormatted = projectedWins.map(p => `• ${p.account || 'TBC'} ($${p.value.toLocaleString()}) (${p.expectedDate}) - ${p.updateText}`).join('\n') || '-';
    
    let userPrioritiesFormatted = priorities.map(p => `• ${p.text}`).join('\n') || '-';
    
    let userUpdatesFormatted = '';
    if (updates) {
      userUpdatesFormatted += `${updates}\n\n`;
    }
    if (majorUpdates.length > 0) {
      userUpdatesFormatted += majorUpdates.map(m => `• ${m.customer || 'TBC'} ($${m.value.toLocaleString()}) - ${m.updateText}`).join('\n');
    }
    if (!userUpdatesFormatted) {
      userUpdatesFormatted = '-';
    }

    // If registered user, append extra monday/friday metrics to details for collation
    if (true) {
      const kpis = `[KPI Actuals: ${twtwKpiActuals.callsMade}/${twtwKpiActuals.callsToMake} Calls, ${twtwKpiActuals.appointmentsSet}/${twtwKpiActuals.appointmentsToSet} Appts]`;
      const faCount = currentWeekFocusAccounts.length > 0 ? `\n[Focus Accounts Active: ${currentWeekFocusAccounts.length}]` : '';
      const rb = twtwRoadblocks ? `\n[Roadblocks: ${twtwRoadblocks}]` : '';
      userUpdatesFormatted = `${userUpdatesFormatted}\n\n${kpis}${faCount}${rb}`;
    }

    return {
      'WA': [
        {
          name: 'Me (Simulated User)',
          wins: userWinsFormatted,
          risks: userRisksFormatted,
          updates: userUpdatesFormatted,
          projected: userProjectedFormatted,
          priorities: userPrioritiesFormatted
        },
        {
          name: 'Sarah Jenkins (Senior BDM)',
          wins: '• BHP WA Operations ($340,000) - Logistics upgrade contract signed.\n• Rio Tinto Fuel Run ($120,000) - Incremental trade volume won.',
          risks: '• Fortescue Metals ($210,000) - Tender delayed by procurement.\n  Mitigation: Meeting GM on Tuesday to align proposal schedule.',
          updates: 'Strong mining sector wins this week. Closed BHP logistics account. Fortescue is delayed but key sponsors remain aligned.',
          projected: '• Woodside Energy ($450,000) (Late July)\n• MinRes Pilbara ($180,000) (Next Week)',
          priorities: '• Deliver Woodside technical response\n• Finalise Rio Tinto post-implementation review\n• Schedule Fortescue follow-up'
        }
      ],
      'QLD': [
        {
          name: 'Alex Mercer (Account Manager)',
          wins: '• Aurizon Fleet ($95,000) - Signed 12m extension.\n• Qube Ports trial ($60,000) - First trade route live.',
          risks: '-',
          updates: 'Qld logistics pipeline remains steady. Bulk transport volumes holding target.',
          projected: '• Gladstone Coal ($310,000) (Within 30 Days)',
          priorities: '• Conduct Qube post-implementation site review\n• Finalise Gladstone commercial terms'
        }
      ]
    };
  }, [wins, risks, updates, projectedWins, priorities, twtwKpiActuals, currentWeekFocusAccounts, twtwRoadblocks]);
  const renderItem = (item: any, type: string, subId: string, content: React.ReactNode) => {
    if (item.isHidden && !showHiddenItems) return null;
    return (
      <div key={`${subId}-${type}-${item.id}`} className={cn(
        "relative group p-2 mb-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-all",
        item.isHidden && "opacity-50 border-dashed bg-slate-100/50"
      )}>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10 print-actions" data-print-hidden="true">
          {isLeader && (
            <>
              <Button 
                size="icon" 
                variant="secondary" 
                className={cn(
                  "w-6 h-6 shadow-sm border bg-white", 
                  item.isStarred ? "border-amber-400 text-amber-500" : "border-slate-200 text-slate-400 hover:text-amber-500"
                )} 
                onClick={() => toggleItemState(subId, type as any, item.id, 'isStarred')}
              >
                <Star className={cn("w-3 h-3", item.isStarred && "fill-current")} />
              </Button>
              <Button 
                size="icon" 
                variant="secondary" 
                className={cn("w-6 h-6 shadow-sm border bg-white hover:text-slate-600", item.isHidden ? "border-red-400 text-red-500" : "border-slate-200 text-slate-400")} 
                onClick={() => toggleItemState(subId, type as any, item.id, 'isHidden')}
              >
                {item.isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </Button>
              <Button 
                size="icon" 
                variant="secondary" 
                className="w-6 h-6 shadow-sm border border-red-200 bg-white hover:bg-red-50 text-red-400 hover:text-red-600" 
                onClick={() => deleteItem(subId, type as any, item.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
        <div className={cn("pr-8", item.isHidden && "line-through text-slate-400")}>
          {content}
        </div>
      </div>
    );
  };

  const toggleItemState = async (subId: string, arrayField: string, itemId: string, stateField: 'isHidden' | 'isStarred') => {
    if (!db) return;
    try {
      const sub = allSubmissions?.find(s => s.id === subId);
      if (!sub) return;
      
      const items = [...(sub[arrayField as keyof typeof sub] || [])];
      let idx = items.findIndex((i: any) => i.id === itemId);
      
      if (idx === -1 && itemId && itemId.includes('-')) {
        const parts = itemId.split('-');
        const parsedIdx = parseInt(parts[parts.length - 1]);
        if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < items.length) {
          idx = parsedIdx;
        }
      }
      
      if (idx === -1) return;
      
      items[idx] = { ...items[idx], [stateField]: !items[idx][stateField] };
      await updateDoc(doc(db, 'twiwSubmissions', subId), { [arrayField]: items });
      toast({ title: "Updated successfully", description: "Item visibility/starred state updated." });
    } catch(e) {
      toast({ variant: "destructive", title: "Failed to update item state." });
    }
  };

  const deleteItem = async (subId: string, arrayField: string, itemId: string) => {
    if (!db || !isLeader) {
      toast({ variant: "destructive", title: "Permission Denied", description: "Only leaders can delete items." });
      return;
    }
    
    if (!confirm("Are you sure you want to delete this item? This action cannot be undone.")) return;
    
    try {
      const sub = allSubmissions?.find(s => s.id === subId);
      if (!sub) return;
      
      const items = [...(sub[arrayField as keyof typeof sub] || [])];
      const filteredItems = items.filter((i: any) => i.id !== itemId);
      
      await updateDoc(doc(db, 'twiwSubmissions', subId), { [arrayField]: filteredItems });
      toast({ title: "Item Deleted", description: "The item has been removed from the submission." });
    } catch(e) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to delete item." });
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!db || !isLeader) return;
    if (confirm("Are you sure you want to delete this submission?")) {
      try {
        await deleteDoc(doc(db, 'twiwSubmissions', id));
        toast({ title: "Submission Deleted" });
      } catch (err) {
        toast({ variant: "destructive", title: "Failed to delete submission" });
      }
    }
  };

  const handleEditSubmission = (sub: any) => {
    setEditingSubmission(sub);
  };

  if (embeddedCollationOnly) {
    return (
      <div className="space-y-6">
        {isLeader && (
          <Card className="border shadow-md bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between py-5 gap-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> Master Executive TWTW Collation
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  How executive reports look with combined registered data vs guest data
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2 mr-4 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                  <input
                    type="checkbox"
                    id="show-hidden-toggle"
                    checked={showHiddenItems}
                    onChange={(e) => setShowHiddenItems(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                  />
                  <label htmlFor="show-hidden-toggle" className="text-[9px] font-black text-slate-500 uppercase tracking-wider cursor-pointer select-none">
                    Show Hidden
                  </label>
                </div>
                <Button 
                  onClick={handleExportPdf}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
                >
                  <ClipboardCheck className="w-4 h-4" /> Export to Landscape PDF
                </Button>
                <Button 
                  onClick={handleExportOversizedPdf}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4" /> Export PDF
                </Button>
                <Button 
                  onClick={handleExportCondensedPdf}
                  className="bg-primary hover:bg-primary/90 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4" /> Export to Condensed PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 space-y-12 max-h-[800px] overflow-y-auto">
                {Object.entries(submissionsByState).length === 0 ? (
                  <div className="text-center py-24 text-slate-400 text-xs font-bold uppercase tracking-widest">
                    No submissions available to collate yet.
                  </div>
                ) : (
                  Object.entries(submissionsByState).map(([state, subs]) => (
                    <div key={state} className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center gap-2">
                          {state} Region <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-500 font-black">{subs.length} Reps</Badge>
                        </h3>
                        {isLeader && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-[9px] uppercase font-black text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`⚠️ Delete ALL submissions for ${state} region? This cannot be undone.`)) {
                                subs.forEach(sub => handleDeleteSubmission(sub.id));
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete All
                          </Button>
                        )}
                      </div>
                      
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="uppercase text-[9px] font-black tracking-widest text-slate-500">
                              <th className="p-3 w-[18%]">Key Wins</th>
                              <th className="p-3 w-[18%]">Churn Risk</th>
                              <th className="p-3 w-[18%]">Major Updates</th>
                              <th className="p-3 w-[18%]">30 Day Projected</th>
                              <th className="p-3 w-[18%]">Priorities</th>
                              {isLeader && <th className="p-3 w-[10%] text-center print-actions" data-print-hidden="true">Actions</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subs.map((sub, idx) => (
                              <tr key={idx} className="align-top relative group">
                                <td className="p-3 text-slate-600">
                                  {(sub.wins || []).map((w: any) => renderItem(w, 'wins', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{w.customer}</div>
                                      <div className="text-emerald-600 font-semibold">{formatEAV(w.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{w.salespersonName || 'N/A'}</div>
                                      {w.businessUnits && w.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {w.businessUnits.join(', ')}</div>}
                                      {w.updateText && <div className="mt-1">{w.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.risks || []).map((r: any) => renderItem(r, 'risks', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{r.account}</div>
                                      <div className="text-rose-600 font-semibold">{formatEAV(r.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{r.salespersonName || 'N/A'}</div>
                                      <div className="mt-1 text-slate-500">Mitigation: {r.mitigation}</div>
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {sub.updates && (
                                    <div className="p-2 mb-2 bg-amber-50 border border-amber-100 rounded-lg whitespace-pre-wrap">{sub.updates}</div>
                                  )}
                                  {(sub.majorUpdates || []).map((m: any) => renderItem(m, 'majorUpdates', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{m.customer}</div>
                                      {m.value > 0 && <div className="text-blue-600 font-semibold">{formatEAV(m.value)}</div>}
                                      <div className="text-[10px] text-slate-500 mt-1">{m.salespersonName || 'N/A'}</div>
                                      {m.businessUnits && m.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {m.businessUnits.join(', ')}</div>}
                                      {m.updateText && <div className="mt-1">{m.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.projectedWins || []).map((p: any) => renderItem(p, 'projectedWins', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{p.account}</div>
                                      <div className="text-blue-600 font-semibold">{formatEAV(p.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{p.salespersonName || 'N/A'}</div>
                                      {p.businessUnits && p.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {p.businessUnits.join(', ')}</div>}
                                      {p.updateText && <div className="mt-1 text-[10px]">{p.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.priorities || []).map((p: any) => renderItem(p, 'priorities', sub.id, (
                                    <>
                                      <div>{p.text}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{p.salespersonName || 'N/A'}</div>
                                    </>
                                  )))}
                                  {(sub.priorities || []).length === 0 && <div className="text-[10px] text-slate-400 font-medium italic">-</div>}
                                </td>
                                {isLeader && (
                                  <td className="p-3 print-actions" data-print-hidden="true">
                                    <div className="flex flex-col gap-1.5">
                                      <Button size="sm" variant="outline" className="w-full text-[9px] uppercase font-black h-7 border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => handleEditSubmission(sub)}>
                                        <Edit3 className="w-3 h-3 mr-1" /> Edit
                                      </Button>
                                      <Button size="sm" variant="destructive" className="w-full text-[9px] uppercase font-black h-7 bg-red-600 hover:bg-red-700" onClick={() => handleDeleteSubmission(sub.id)}>
                                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                                      </Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Main Tabs */}
      <Tabs defaultValue="thursday" className="w-full">
        <TabsList className="bg-white border p-1.5 rounded-2xl shadow-sm mb-6 w-full md:w-auto flex flex-col md:flex-row gap-1">
          <TabsTrigger value="thursday" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <Calendar className="w-3.5 h-3.5" /> Thursday TWTW
          </TabsTrigger>
          <TabsTrigger value="friday" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <ClipboardList className="w-3.5 h-3.5" /> Friday FW (Combined Pack)
          </TabsTrigger>
          {isLeader && (
            <TabsTrigger value="collation" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
              <PieChart className="w-3.5 h-3.5" /> Executive Collation
            </TabsTrigger>
          )}
          {isLeader && (
            <TabsTrigger value="standouts" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
              <Star className="w-3.5 h-3.5" /> Key Standouts
            </TabsTrigger>
          )}
        </TabsList>

        {/* --- TAB 1: HOW IT WORKS GUIDE --- */}
        <TabsContent value="guide" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border shadow-md">
              <CardHeader className="bg-slate-50 border-b py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-800 text-[10px]">1</span>
                  Friday Combined pack
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs font-medium text-slate-600 leading-relaxed">
                <p>Monday Planning and Friday Synthesis are completed in a **single Friday session**.</p>
                <p className="bg-slate-50 p-2.5 rounded-xl border font-bold text-slate-700">
                  BDMs tick off this week's checklist and mark focus accounts as Won/Lost/Working. Uncompleted items roll over automatically. They then draft next week's goals.
                </p>
                <p>This creates a single clean database log for the week, which pre-fills the next Thursday's TWTW report.</p>
              </CardContent>
            </Card>

            <Card className="border shadow-md">
              <CardHeader className="bg-indigo-50 border-b border-indigo-100 py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-indigo-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center font-black text-white text-[10px]">2</span>
                  Thursday TWTW Pre-fill
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs font-medium text-indigo-950/80 leading-relaxed">
                <p>On Thursday afternoon, the TWTW report is sent to executives.</p>
                <p className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 font-bold text-indigo-900">
                  Instead of double-typing, the system pre-populates Thursday's TWTW priorities and focus accounts directly from what they planned on the previous Friday.
                </p>
                <p>Closed Won CRM deals are suggested as wins, and stalled deals are suggested as risks. The BDM simply keeps, modifies, or deletes the suggested items.</p>
              </CardContent>
            </Card>

            <Card className="border shadow-md">
              <CardHeader className="bg-emerald-50 border-b border-emerald-100 py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-950 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center font-black text-white text-[10px]">3</span>
                  Role-Aware Context
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-xs font-medium text-emerald-950/80 leading-relaxed">
                <p>Different interfaces for guest and registered users:</p>
                <ul className="space-y-1.5 list-disc pl-4 font-bold text-emerald-900">
                  <li>**Guest Users** see only standard TWTW questions (Wins, Risks, Updates, Projected, Priorities) with email and SF links hidden.</li>
                  <li>**Registered Staff** see standard TWTW questions *plus* internal KPI actuals, focus account updates, and management support lists.</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-md bg-white">
            <CardHeader><CardTitle className="text-sm font-black uppercase tracking-wider">Benefits Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-xs uppercase tracking-tight text-slate-800">Zero Duplication</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">BDMs never type the same account name, action, or roadblock twice. Data rolls forward logically.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-xs uppercase tracking-tight text-slate-800">Time-Aware Automation</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Forms are context-aware based on the day. Friday focus edits directly affect next week's pre-fills.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-xs uppercase tracking-tight text-slate-800">Consolidated Executive View</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">All details roll up into a single 6-column landscape report that prints cleanly onto landscape PDF.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friday" className="mt-0">
          {!user || profile?.role === 'GUEST' ? (
            <Card className="border shadow-md bg-white p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <Shield className="w-16 h-16 text-slate-300" />
                <h3 className="text-xl font-black text-slate-600 uppercase tracking-tight">Access Restricted</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  The Friday Performance Review is only available to registered team members. 
                  Please log in with your corporate credentials to access this feature.
                </p>
              </div>
            </Card>
          ) : (
            <FridayPerformanceReview 
              userId={user?.uid || ''}
              userName={profile?.name || user?.email || 'User'}
              userRole={profile?.role || 'BDM'}
              userState={profile?.state || 'WA'}
              selectedWeek={selectedWeek}
            />
          )}
        </TabsContent>

        {/* --- TAB 2: INTERACTIVE SIMULATOR --- */}
        <TabsContent value="thursday" className="mt-0">
                <div className="space-y-6">
                  <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden gap-4">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32" /></div>
                    <div className="relative z-10 space-y-1">
                      <Badge className="bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest px-2.5 mb-1">
                        Thursday Afternoon Deadline
                      </Badge>
                      <h3 className="text-xl font-black uppercase tracking-tight">The Week That Was (TWTW)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Role View: Registered Staff (Extended Context)
                      </p>
                    </div>
                    <div className="flex gap-2 relative z-10 w-full sm:w-auto">
                      <Button 
                        onClick={handleLoadPreviousFridayData}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest h-12 px-5 rounded-2xl shadow-lg w-full sm:w-auto gap-2"
                      >
                        <RefreshCw className="w-4 h-4" /> Load Previous Friday Data
                      </Button>
                    </div>
                  </header>


                  {/* KPI Review Section (Registered Only) */}
                  {isRegisteredUser && renderKPIReview()}
                  
                  {isGuest && (
                    <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white mb-6">
                      <CardHeader className="bg-slate-50/50 border-b py-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-slate-400" />
                          <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-600">Guest Access</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 text-center">
                        <div className="flex flex-col items-center gap-4 py-8">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center"><Shield className="w-8 h-8 text-slate-400" /></div>
                          <div className="space-y-2 max-w-md">
                            <h3 className="text-lg font-black text-slate-700">TWTW Report</h3>
                            <p className="text-sm text-slate-500">As a guest user, you can submit your weekly TWTW report. KPI tracking and advanced features are available for registered BDM and AM users.</p>
                            <Badge className="bg-emerald-500/10 text-emerald-600 font-black text-[9px] uppercase mt-2">Submit your weekly update below</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Key Wins */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-500" /> Key Wins
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[25%]">Customer</th>
                              <th className="text-right pb-2 w-[15%]">EAV ($)</th>
                              <th className="text-left pb-2 w-[20%]">Business Unit</th>
                              <th className="text-left pb-2 w-[20%]">Update</th>
                              <th className="text-left pb-2 w-[15%]">Salesperson</th>
                              <th className="text-center pb-2 w-[5%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {wins.map((w) => (
                              <tr key={w.id}>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={w.customer} 
                                    onChange={(e) => updateWinField(w.id, 'customer', e.target.value)} 
                                    placeholder="e.g. Acme Corp" 
                                    className={cn("h-8 text-xs font-semibold", !w.customer?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    type="number"
                                    value={w.value || ''} 
                                    onChange={(e) => updateWinField(w.id, 'value', parseFloat(e.target.value) || 0)} 
                                    placeholder="Value" 
                                    className={cn("h-8 text-xs font-black text-right text-emerald-600", (!w.value || w.value <= 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <div className={cn("flex flex-wrap gap-1 p-1 rounded-xl transition-all", (w.businessUnits || []).length === 0 && "border border-red-500 bg-red-50/10")}>
                                    {BUSINESS_UNITS.map(bu => (
                                      <Badge 
                                        key={bu} 
                                        variant={(w.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                                        className="cursor-pointer text-[9px] px-1 py-0"
                                        onClick={() => toggleBusinessUnit(w.id, bu)}
                                      >
                                        {bu}
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="relative">
                                    <Input 
                                      value={w.updateText || ''} 
                                      onChange={(e) => updateWinField(w.id, 'updateText', e.target.value)} 
                                      placeholder="e.g. Signed contract win" 
                                      className={cn("h-8 text-xs", !w.updateText?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                      maxLength={200}
                                    />
                                    <div className="absolute -bottom-3 right-0 text-[8px] text-slate-400 font-bold">{(w.updateText || '').length}/200</div>
                                  </div>
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={w.salespersonName} 
                                    onChange={(e) => updateWinField(w.id, 'salespersonName', e.target.value)} 
                                    placeholder="Name" 
                                    className={cn("h-8 text-xs", !w.salespersonName?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removeWinRow(w.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {wins.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No Wins reported yet. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <Button onClick={addWinRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Win
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Churn Risks */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" /> Churn Risk Flags
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[35%]">Account / Cust</th>
                              <th className="text-right pb-2 w-[20%]">Value at Risk ($)</th>
                              <th className="text-left pb-2 w-[20%]">Mitigation</th>
                              <th className="text-left pb-2 w-[20%]">Salesperson</th>
                              <th className="text-center pb-2 w-[5%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {risks.map((r) => (
                              <tr key={r.id}>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={r.account} 
                                    onChange={(e) => updateRiskField(r.id, 'account', e.target.value)} 
                                    placeholder="e.g. Acme Corp" 
                                    className={cn("h-8 text-xs font-semibold", !r.account?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    type="number"
                                    value={r.value || ''} 
                                    onChange={(e) => updateRiskField(r.id, 'value', parseFloat(e.target.value) || 0)} 
                                    placeholder="Value" 
                                    className={cn("h-8 text-xs font-black text-right text-rose-600", (!r.value || r.value <= 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={r.mitigation} 
                                    onChange={(e) => updateRiskField(r.id, 'mitigation', e.target.value)} 
                                    placeholder="e.g. Setup review meeting" 
                                    className={cn("h-8 text-xs", !r.mitigation?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={r.salespersonName} 
                                    onChange={(e) => updateRiskField(r.id, 'salespersonName', e.target.value)} 
                                    placeholder="Name" 
                                    className={cn("h-8 text-xs", !r.salespersonName?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removeRiskRow(r.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {risks.length === 0 && (
                              <tr>
                                <td colSpan={5} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No Risks flagged yet. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <Button onClick={addRiskRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Risk
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Major Pipeline & Customer Updates */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700">
                        Major Pipeline &amp; Customer Updates
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      {updates && majorUpdates.length === 0 && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <p className="text-xs text-amber-800 font-medium mb-1">Legacy Update Format (Read-Only):</p>
                          <p className="text-xs text-amber-700 whitespace-pre-wrap">{typeof updates === 'string' ? updates : JSON.stringify(updates)}</p>
                        </div>
                      )}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[25%]">Customer</th>
                              <th className="text-right pb-2 w-[15%]">EAV ($)</th>
                              <th className="text-left pb-2 w-[20%]">Business Unit</th>
                              <th className="text-left pb-2 w-[20%]">Update</th>
                              <th className="text-left pb-2 w-[15%]">Salesperson</th>
                              <th className="text-center pb-2 w-[5%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {majorUpdates.map((m) => (
                              <tr key={m.id}>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={m.customer} 
                                    onChange={(e) => updateMajorUpdateField(m.id, 'customer', e.target.value)} 
                                    placeholder="e.g. Acme Corp" 
                                    className={cn("h-8 text-xs font-semibold", !m.customer?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    type="number"
                                    value={m.value || ''} 
                                    onChange={(e) => updateMajorUpdateField(m.id, 'value', parseFloat(e.target.value) || 0)} 
                                    placeholder="Value" 
                                    className="h-8 text-xs font-black text-right text-emerald-600"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <div className={cn("flex flex-wrap gap-1 p-1 rounded-xl transition-all", (m.businessUnits || []).length === 0 && "border border-red-500 bg-red-50/10")}>
                                    {BUSINESS_UNITS.map(bu => (
                                      <Badge 
                                        key={bu} 
                                        variant={(m.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                                        className="cursor-pointer text-[9px] px-1 py-0"
                                        onClick={() => toggleMajorUpdateBU(m.id, bu)}
                                      >
                                        {bu}
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="relative">
                                    <Input 
                                      value={m.updateText || ''} 
                                      onChange={(e) => updateMajorUpdateField(m.id, 'updateText', e.target.value)} 
                                      placeholder="e.g. Signed contract win" 
                                      className={cn("h-8 text-xs", !m.updateText?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                      maxLength={200}
                                    />
                                    <div className="absolute -bottom-3 right-0 text-[8px] text-slate-400 font-bold">{(m.updateText || '').length}/200</div>
                                  </div>
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={m.salespersonName} 
                                    onChange={(e) => updateMajorUpdateField(m.id, 'salespersonName', e.target.value)} 
                                    placeholder="Name" 
                                    className={cn("h-8 text-xs", !m.salespersonName?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removeMajorUpdateRow(m.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {majorUpdates.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No updates reported yet. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <Button onClick={addMajorUpdateRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Update
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 30 Day Projected Wins */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" /> 30 Day Projected Wins
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[30%]">Account / Cust</th>
                              <th className="text-right pb-2 w-[15%]">EAV ($)</th>
                              <th className="text-left pb-2 pl-2 w-[15%]">BU</th>
                              <th className="text-left pb-2 pl-2 w-[20%]">Update</th>
                              <th className="text-left pb-2 w-[15%]">Salesperson</th>
                              <th className="text-center pb-2 w-[5%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {projectedWins.map((p) => {
                              return (
                              <tr key={p.id}>
                                   <td className="py-2 pr-2">
                                     <Input 
                                       value={p.account} 
                                       onChange={(e) => updateProjectedField(p.id, 'account', e.target.value)} 
                                       placeholder="e.g. Acme Corp" 
                                       className={cn("h-8 text-xs font-semibold", !p.account?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                     />
                                   </td>
                                   <td className="py-2 pr-2">
                                     <Input 
                                       type="number"
                                       value={p.value || ''} 
                                       onChange={(e) => updateProjectedField(p.id, 'value', parseFloat(e.target.value) || 0)} 
                                       placeholder="Value" 
                                       className={cn("h-8 text-xs font-black text-right text-blue-600", (!p.value || p.value <= 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                     />
                                   </td>
                                   <td className="py-2 pl-2 pr-2">
                                     <div className={cn("flex flex-wrap gap-1 p-1 rounded-xl transition-all", (p.businessUnits || []).length === 0 && "border border-red-500 bg-red-50/10")}>
                                       {BUSINESS_UNITS.map(bu => (
                                         <Badge 
                                           key={bu} 
                                           variant={(p.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                                           className="cursor-pointer text-[9px] px-1 py-0"
                                           onClick={() => toggleProjectedWinBU(p.id, bu)}
                                         >
                                           {bu}
                                         </Badge>
                                       ))}
                                     </div>
                                   </td>
                                   <td className="py-2 pr-2">
                                     <div className="relative">
                                       <Input 
                                         value={p.updateText || ''} 
                                         onChange={(e) => updateProjectedField(p.id, 'updateText', e.target.value)} 
                                         placeholder="Update" 
                                         className={cn("h-8 text-xs", !p.updateText?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                         maxLength={200}
                                       />
                                       <div className="absolute -bottom-3 right-0 text-[8px] text-slate-400 font-bold">{(p.updateText || '').length}/200</div>
                                     </div>
                                   </td>
                                   <td className="py-2 pr-2">
                                     <Input 
                                       value={p.salespersonName} 
                                       onChange={(e) => updateProjectedField(p.id, 'salespersonName', e.target.value)} 
                                       placeholder="Name" 
                                       className={cn("h-8 text-xs", !p.salespersonName?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                     />
                                   </td>
                                  <td className="py-2 text-center">
                                    <Button variant="ghost" size="icon" onClick={() => removeProjectedRow(p.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                            {projectedWins.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No projected wins found. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <Button onClick={addProjectedRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Projected Win
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Priorities */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <Target className="w-4 h-4 text-accent" /> Priorities for Week Ahead
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[60%]">Priority</th>
                              <th className="text-left pb-2 w-[30%]">Salesperson</th>
                              <th className="text-center pb-2 w-[10%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {priorities.map((p) => (
                              <tr key={p.id}>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={p.text} 
                                    onChange={(e) => updatePriorityField(p.id, 'text', e.target.value)} 
                                    placeholder="e.g. Focus on Neerabup zone wins" 
                                    className={cn("h-8 text-xs font-semibold", !p.text?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={p.salespersonName} 
                                    onChange={(e) => updatePriorityField(p.id, 'salespersonName', e.target.value)} 
                                    placeholder="Salesperson" 
                                    className={cn("h-8 text-xs", !p.salespersonName?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removePriority(p.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {priorities.length === 0 && (
                              <tr>
                                <td colSpan={3} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No priorities added yet. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked View */}
                      <div className="block sm:hidden space-y-4">
                        {priorities.map((p, idx) => (
                          <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-slate-400">Priority #{idx + 1}</span>
                              <Button variant="ghost" size="icon" onClick={() => removePriority(p.id)} className="h-6 w-6 text-red-500 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400">Priority</label>
                              <Input 
                                value={p.text} 
                                onChange={(e) => updatePriorityField(p.id, 'text', e.target.value)} 
                                placeholder="e.g. Focus on Neerabup zone wins" 
                                className="h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                              <Input 
                                value={p.salespersonName} 
                                onChange={(e) => updatePriorityField(p.id, 'salespersonName', e.target.value)} 
                                placeholder="Name" 
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button onClick={addPriorityRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                        <Plus className="w-4 h-4 mr-2" /> Add Custom Priority
                      </Button>
                    </CardContent>
                  </Card>

                  {/* ADDITIONAL REGISTERED USER ONLY FIELDS */}
                  {true && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                      
                      {/* KPI Performance Section */}
                      <Card className="border border-indigo-100 shadow-md">
                        <CardHeader className="bg-indigo-900 text-indigo-100 py-4 rounded-t-3xl">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> BDM Metrics Log (Monday/Friday KPI Actuals)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="space-y-1 bg-slate-50 border p-3 rounded-xl">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Calls Made</span>
                              <div className="flex items-center gap-1.5">
                                <Input type="number" value={twtwKpiActuals.callsMade} onChange={e => setTwtwKpiActuals({ ...twtwKpiActuals, callsMade: parseInt(e.target.value) || 0 })} className="h-8 text-xs font-black w-14" />
                                <span className="text-[10px] font-bold text-slate-400">/ {twtwKpiActuals.callsToMake} Target</span>
                              </div>
                            </div>
                            <div className="space-y-1 bg-slate-50 border p-3 rounded-xl">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Appts Held</span>
                              <div className="flex items-center gap-1.5">
                                <Input type="number" value={twtwKpiActuals.appointmentsSet} onChange={e => setTwtwKpiActuals({ ...twtwKpiActuals, appointmentsSet: parseInt(e.target.value) || 0 })} className="h-8 text-xs font-black w-14" />
                                <span className="text-[10px] font-bold text-slate-400">/ {twtwKpiActuals.appointmentsToSet} Target</span>
                              </div>
                            </div>
                            <div className="space-y-1 bg-slate-50 border p-3 rounded-xl">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Proposals Sent</span>
                              <div className="flex items-center gap-1.5">
                                <Input type="number" value={twtwKpiActuals.proposalsSent} onChange={e => setTwtwKpiActuals({ ...twtwKpiActuals, proposalsSent: parseInt(e.target.value) || 0 })} className="h-8 text-xs font-black w-14" />
                                <span className="text-[10px] font-bold text-slate-400">/ {twtwKpiActuals.proposalsToSend} Target</span>
                              </div>
                            </div>
                            <div className="space-y-1 bg-slate-50 border p-3 rounded-xl">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Deals Closed</span>
                              <div className="flex items-center gap-1.5">
                                <Input type="number" value={twtwKpiActuals.dealsClosed} onChange={e => setTwtwKpiActuals({ ...twtwKpiActuals, dealsClosed: parseInt(e.target.value) || 0 })} className="h-8 text-xs font-black w-14" />
                                <span className="text-[10px] font-bold text-slate-400">/ {twtwKpiActuals.dealsToClose} Target</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Phase A Integration: Review Monday Commitments */}
                      <Card className="border border-indigo-100 shadow-md">
                        <CardHeader className="bg-indigo-900 text-indigo-100 py-4 rounded-t-3xl">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4" /> This Weeks Actions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Ticking off items removes them from rollover. Uncompleted actions roll to next week.</p>
                          <div className="space-y-3">
                            {currentWeekActions.map((c, idx) => (
                              <div key={idx} className={cn("p-4 bg-white rounded-2xl border transition-all duration-300 shadow-sm space-y-3", c.completed ? "border-emerald-100 bg-emerald-50/20" : "border-slate-200")}>
                                <div className="flex items-start gap-4">
                                  <input
                                    type="checkbox"
                                    checked={c.completed}
                                    onChange={(e) => handleFridayActionCheckbox(idx, e.target.checked)}
                                    className="w-5 h-5 mt-0.5 accent-indigo-600 rounded cursor-pointer"
                                  />
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className={cn("text-xs font-bold", c.completed ? "text-slate-500 line-through" : "text-slate-700")}>
                                        {c.text}
                                      </span>
                                      <Badge variant="outline" className={cn("text-[9px] font-black uppercase", c.completed ? "bg-emerald-100 text-emerald-800 border-none" : "bg-slate-100 text-slate-600 border-none")}>
                                        {c.completed ? 'Completed' : 'In Progress (Rolls Over)'}
                                      </Badge>
                                    </div>
                                    <Input
                                      placeholder="Commentary or rollover reason..."
                                      value={c.update}
                                      onChange={e => {
                                        const updated = [...currentWeekActions];
                                        updated[idx].update = e.target.value;
                                        setCurrentWeekActions(updated);
                                      }}
                                      className="h-8 text-xs bg-slate-50/50"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            {currentWeekActions.length === 0 && (
                              <p className="text-[10px] text-muted-foreground italic text-center py-4">
                                No active commitments. Click "Load Previous Friday Data" to pull actions.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Phase A Integration: Focus Accounts Performance */}
                      <Card className="border border-indigo-100 shadow-md">
                        <CardHeader className="bg-indigo-900 text-indigo-100 py-4 rounded-t-3xl">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                            <Target className="w-4 h-4 font-black" /> Focus Account Progress Review
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          {currentWeekFocusAccounts.map((acc, index) => (
                            <div key={acc.id} className={cn("p-4 bg-slate-50 border rounded-2xl space-y-3 transition-all",
                              acc.status === 'WON' && "border-emerald-100 bg-emerald-50/10",
                              acc.status === 'LOST' && "border-red-100 bg-red-50/10",
                              acc.status === 'WORKING' && "border-slate-200"
                            )}>
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="text-xs font-black text-slate-800 uppercase">{acc.accountName}</h4>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{acc.actionType} • ${acc.eav?.toLocaleString() || 0} EAV</p>
                                </div>
                                <select 
                                  value={acc.status || 'WORKING'} 
                                  onChange={e => handleFridayFocusAccountStatusChange(index, e.target.value as any)}
                                  className="text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border bg-white cursor-pointer"
                                >
                                  <option value="WORKING">Working (Rollover)</option>
                                  <option value="WON">Won (Archive)</option>
                                  <option value="LOST">Lost (Archive)</option>
                                </select>
                              </div>
                              <Input 
                                placeholder="Status update notes..." 
                                value={acc.update || ''} 
                                onChange={e => {
                                  const list = [...currentWeekFocusAccounts];
                                  list[index].update = e.target.value;
                                  setCurrentWeekFocusAccounts(list);
                                }}
                                className="h-8 text-xs bg-white" 
                              />
                            </div>
                          ))}
                          {currentWeekFocusAccounts.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic text-center py-6">
                              No active Focus Accounts. Load previous Friday data to review goals.
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Roadblocks and support */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-red-600 tracking-wider flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Roadblocks (Registered)
                          </label>
                          <Textarea 
                            placeholder="What roadblocks are you hitting? (Loaded from previous Friday plan)" 
                            value={twtwRoadblocks} 
                            onChange={e => setTwtwRoadblocks(e.target.value)} 
                            className="min-h-[90px] text-xs" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-blue-600 tracking-wider flex items-center gap-1">
                            <LifeBuoy className="w-3.5 h-3.5" /> Management Support Needed
                          </label>
                          <Textarea 
                            placeholder="What can Ben or GM help escalate?" 
                            value={twtwSupport} 
                            onChange={e => setTwtwSupport(e.target.value)} 
                            className="min-h-[90px] text-xs" 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submission actions */}
                  <div className="flex flex-col items-end gap-3 pt-6 border-t">
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => handleTwtwSubmit('DRAFT')} className="font-black h-12 px-6 uppercase tracking-wider text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                        Save Draft
                      </Button>
                      <Button 
                        onClick={() => handleTwtwSubmit('SUBMITTED')} 
                        disabled={!isTwtwFormComplete}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 px-8 uppercase tracking-wider text-xs shadow-lg shadow-indigo-100 disabled:opacity-40"
                      >
                        {twtwStatus === 'SUBMITTED' ? 'Update Submission' : 'Submit TWTW Report'}
                      </Button>
                    </div>

                    {!isTwtwFormComplete && (
                      <div className="w-full max-w-md p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-1.5 mt-2">
                        <p className="text-[10px] font-black uppercase text-rose-600 tracking-wider text-left">Required to Submit:</p>
                        <ul className="text-[10px] text-slate-600 space-y-0.5 list-disc pl-4 text-left font-medium">
                          {!wins.every(w => w.customer?.trim() && (w.value || 0) > 0 && w.businessUnits?.length > 0 && w.updateText?.trim() && w.salespersonName?.trim()) && <li>Complete all fields in added Key Wins rows</li>}
                          {!risks.every(r => r.account?.trim() && (r.value || 0) > 0 && r.mitigation?.trim() && r.salespersonName?.trim()) && <li>Complete all fields in added Churn Risks rows</li>}
                          {!majorUpdates.every(m => m.customer?.trim() && m.businessUnits?.length > 0 && m.updateText?.trim() && m.salespersonName?.trim()) && <li>Complete all fields in added Major Updates rows</li>}
                          {!projectedWins.every(p => p.account?.trim() && (p.value || 0) > 0 && p.updateText?.trim() && p.salespersonName?.trim()) && <li>Complete all fields in added Projected Wins rows</li>}
                          {!priorities.every(p => p.text?.trim() && p.salespersonName?.trim()) && <li>Complete all fields in added Priorities rows</li>}
                          {isRegisteredUser && (
                            <>
                              {(twtwKpiActuals.callsMade === undefined || isNaN(twtwKpiActuals.callsMade) || twtwKpiActuals.callsMade < 0 ||
                                twtwKpiActuals.appointmentsSet === undefined || isNaN(twtwKpiActuals.appointmentsSet) || twtwKpiActuals.appointmentsSet < 0 ||
                                twtwKpiActuals.proposalsSent === undefined || isNaN(twtwKpiActuals.proposalsSent) || twtwKpiActuals.proposalsSent < 0 ||
                                twtwKpiActuals.dealsClosed === undefined || isNaN(twtwKpiActuals.dealsClosed) || twtwKpiActuals.dealsClosed < 0 ||
                                twtwKpiActuals.revenueWon === undefined || isNaN(twtwKpiActuals.revenueWon) || twtwKpiActuals.revenueWon < 0) && <li>Complete all KPI Actual values</li>}
                              {!twtwRoadblocks?.trim() && <li>Enter active Roadblocks (or 'None')</li>}
                              {!twtwSupport?.trim() && <li>Enter active Management Support requests (or 'None')</li>}
                            </>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
        </TabsContent>

        {isLeader && (
        <TabsContent value="collation" className="mt-0">
          <Card className="border shadow-md bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between py-5 gap-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> Master Executive TWTW Collation
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  How executive reports look with combined registered data vs guest data
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2 mr-4 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 shadow-sm">
                  <input
                    type="checkbox"
                    id="show-hidden-toggle"
                    checked={showHiddenItems}
                    onChange={(e) => setShowHiddenItems(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                  />
                  <label htmlFor="show-hidden-toggle" className="text-[9px] font-black text-slate-500 uppercase tracking-wider tracking-widest cursor-pointer select-none">
                    Show Hidden
                  </label>
                </div>
                <Button 
                  onClick={handleExportPdf}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
                >
                  <ClipboardCheck className="w-4 h-4" /> Export to Landscape PDF
                </Button>
                <Button 
                  onClick={handleExportOversizedPdf}
                  className="bg-indigo-600 hover:bg-indigo-750 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4" /> Export PDF
                </Button>
                <Button 
                  onClick={handleExportCondensedPdf}
                  className="bg-primary hover:bg-primary/90 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
                >
                  <FileText className="w-4 h-4" /> Export to Condensed PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col md:flex-row h-[800px]">
              {/* Sidebar for Submitted Users */}
              <div className="w-full md:w-64 border-r border-slate-200 bg-slate-50/50 p-4 overflow-y-auto shrink-0 print:hidden">
                 <h4 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> Submitted Reports</h4>
                 <div className="space-y-2">
                   {(allSubmissions || []).length === 0 && <p className="text-[10px] text-slate-400 italic">No submissions yet.</p>}
                   {(allSubmissions || []).map(sub => (
                     <div key={sub.id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                       <div className="min-w-0">
                         <p className="text-xs font-bold text-slate-800 truncate">{sub.userName}</p>
                         <div className="flex gap-1.5 mt-1">
                           <Badge variant="outline" className="text-[8px] font-black uppercase px-1 py-0 border-slate-200 text-slate-500">{sub.state || 'WA'}</Badge>
                           {sub.isGuest || sub.userRole === 'GUEST' ? (
                             <Badge variant="secondary" className="text-[8px] font-black uppercase px-1 py-0 bg-amber-100 text-amber-700">Guest</Badge>
                           ) : (
                             <Badge variant="secondary" className="text-[8px] font-black uppercase px-1 py-0 bg-indigo-100 text-indigo-700">Reg</Badge>
                           )}
                         </div>
                       </div>
                       {sub.status === 'DRAFT' ? (
                         <Badge variant="secondary" className="text-[7px] font-black uppercase px-1 py-0 bg-slate-100 text-slate-500">Draft</Badge>
                       ) : (
                         <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                       )}
                     </div>
                   ))}
                 </div>
              </div>

              {/* Main Collation Area */}
              <div className="flex-1 collation-print-area p-6 space-y-12 overflow-y-auto bg-white">
                {Object.entries(submissionsByState).length === 0 ? (
                   <div className="text-center py-24 text-slate-400 text-xs font-bold uppercase tracking-widest">
                     No submissions available to collate yet.
                   </div>
                ) : (
                  Object.entries(submissionsByState).map(([state, subs]) => (
                    <div key={state} className="space-y-4 region-section">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <h3 className="text-lg font-black uppercase text-slate-800 flex items-center gap-2">
                          {state} Region <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-500 font-black">{subs.length} Reps</Badge>
                        </h3>
                        {isLeader && (
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="text-[9px] font-black uppercase h-7 print-actions"
                            data-print-hidden="true"
                            onClick={() => {
                              if (confirm(`⚠️ Delete ALL submissions for ${state} region? This cannot be undone.`)) {
                                subs.forEach(sub => handleDeleteSubmission(sub.id));
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete All
                          </Button>
                        )}
                      </div>
                      
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="uppercase text-[9px] font-black tracking-widest text-slate-500">
                            <th className="p-3 w-[18%]">Key Wins</th>
                            <th className="p-3 w-[18%]">Churn Risk</th>
                            <th className="p-3 w-[18%]">Major Updates</th>
                            <th className="p-3 w-[18%]">30 Day Projected</th>
                            <th className="p-3 w-[18%]">Priorities</th>
                            {isLeader && <th className="p-3 w-[10%] text-center print-actions" data-print-hidden="true">Actions</th>}
                          </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subs.map((sub, idx) => (
                              <tr key={idx} className="align-top relative group">
                                <td className="p-3 text-slate-600">
                                  {(sub.wins || []).map((w: any) => renderItem(w, 'wins', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{w.customer}</div>
                                      <div className="text-emerald-600 font-semibold">{formatEAV(w.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{w.salespersonName || 'N/A'}</div>
                                      {w.businessUnits && w.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {w.businessUnits.join(', ')}</div>}
                                      {w.updateText && <div className="mt-1">{w.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.risks || []).map((r: any) => renderItem(r, 'risks', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{r.account}</div>
                                      <div className="text-rose-600 font-semibold">{formatEAV(r.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{r.salespersonName || 'N/A'}</div>
                                      <div className="mt-1 text-slate-500">Mitigation: {r.mitigation}</div>
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {sub.updates && (
                                    <div className="p-2 mb-2 bg-amber-50 border border-amber-100 rounded-lg whitespace-pre-wrap">{sub.updates}</div>
                                  )}
                                  {(sub.majorUpdates || []).map((m: any) => renderItem(m, 'majorUpdates', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{m.customer}</div>
                                      {m.value > 0 && <div className="text-blue-600 font-semibold">{formatEAV(m.value)}</div>}
                                      <div className="text-[10px] text-slate-500 mt-1">{m.salespersonName || 'N/A'}</div>
                                      {m.businessUnits && m.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {m.businessUnits.join(', ')}</div>}
                                      {m.updateText && <div className="mt-1">{m.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.projectedWins || []).map((p: any) => renderItem(p, 'projectedWins', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{p.account}</div>
                                      <div className="text-blue-600 font-semibold">{formatEAV(p.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{p.salespersonName || 'N/A'}</div>
                                      {p.businessUnits && p.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {p.businessUnits.join(', ')}</div>}
                                      {p.updateText && <div className="mt-1 text-[10px]">{p.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.priorities || []).map((p: any) => renderItem(p, 'priorities', sub.id, (
                                    <>
                                      <div>{p.text}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{p.salespersonName || 'N/A'}</div>
                                    </>
                                  )))}
                                  {(sub.priorities || []).length === 0 && <div className="text-[10px] text-slate-400 font-medium italic">-</div>}
                                </td>
                                {isLeader && (
                                  <td className="p-3 print-actions" data-print-hidden="true">
                                    <div className="flex flex-col gap-1.5">
                                      <Button size="sm" variant="outline" className="w-full text-[9px] uppercase font-black h-7 border-indigo-200 text-indigo-600 hover:bg-indigo-50" onClick={() => handleEditSubmission(sub)}>
                                        <Edit3 className="w-3 h-3 mr-1" /> Edit
                                      </Button>
                                      <Button size="sm" variant="destructive" className="w-full text-[9px] uppercase font-black h-7 bg-red-600 hover:bg-red-700" onClick={() => handleDeleteSubmission(sub.id)}>
                                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                                      </Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* ==========================================
         * KEY STANDOUTS VIEW
         * ========================================== */}
        {/* ==========================================
         * KEY STANDOUTS VIEW
         * ========================================== */}
        {isLeader && (() => {
          const getStarred = (arrayField: string) => {
            const items: any[] = [];
            Object.entries(submissionsByState).forEach(([state, subs]) => {
              subs.forEach(sub => {
                const arr = sub[arrayField as keyof typeof sub] as any[];
                if (arr) {
                  arr.filter(i => i.isStarred).forEach(i => 
                    items.push({ ...i, subId: sub.id, state, salespersonName: sub.userName || 'N/A' })
                  );
                }
              });
            });
            return items;
          };

          const starredWins = getStarred('wins');
          const starredRisks = getStarred('risks');
          const starredUpdates = getStarred('majorUpdates');
          const starredProjected = getStarred('projectedWins');
          const starredPriorities = getStarred('priorities');

          return (
            <TabsContent value="standouts" className="mt-0">
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex items-center justify-between">
                  <div className="relative z-10 space-y-2">
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                      <Star className="w-8 h-8 fill-current text-amber-200" /> Key Standouts
                    </h2>
                    <p className="text-amber-100 font-medium max-w-xl text-sm leading-relaxed">
                      A curated selection of the most significant wins, risks, and updates highlighted across all submissions.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Wins Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">
                      Key Wins <Badge className="bg-emerald-100 text-emerald-700 font-black">{starredWins.length}</Badge>
                    </h3>
                    {starredWins.map(w => (
                      <Card key={w.id} className="border-amber-200 bg-amber-50 shadow-sm relative group">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => toggleItemState(w.subId, 'wins', w.id, 'isStarred')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <CardContent className="p-4 space-y-2">
                          <Badge variant="outline" className="text-[8px] bg-white font-black">{w.state}</Badge>
                          <div className="font-bold text-slate-800 leading-snug">{w.customer}</div>
                          <div className="text-emerald-600 font-semibold">{formatEAV(w.value)}</div>
                          <div className="text-[10px] text-slate-500">{w.salespersonName || 'N/A'}</div>
                          {w.businessUnits && w.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-2 font-bold">BU: {w.businessUnits.join(', ')}</div>}
                          {w.updateText && <div className="text-xs text-slate-600 mt-2">{w.updateText}</div>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Risks Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">
                      Churn Risks <Badge className="bg-rose-100 text-rose-700 font-black">{starredRisks.length}</Badge>
                    </h3>
                    {starredRisks.map(r => (
                      <Card key={r.id} className="border-rose-200 bg-rose-50 shadow-sm relative group">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => toggleItemState(r.subId, 'risks', r.id, 'isStarred')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <CardContent className="p-4 space-y-2">
                          <Badge variant="outline" className="text-[8px] bg-white font-black">{r.state}</Badge>
                          <div className="font-bold text-slate-800 leading-snug">{r.account}</div>
                          <div className="text-rose-600 font-semibold">{formatEAV(r.value)}</div>
                          <div className="text-[10px] text-slate-500">{r.salespersonName || 'N/A'}</div>
                          {r.businessUnits && r.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-2 font-bold">BU: {r.businessUnits.join(', ')}</div>}
                  <div className="text-xs text-slate-600 mt-2">Mitigation: {r.mitigation}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Updates Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">
                      Major Updates <Badge className="bg-blue-100 text-blue-700 font-black">{starredUpdates.length}</Badge>
                    </h3>
                    {starredUpdates.map(m => (
                      <Card key={m.id} className="border-blue-200 bg-blue-50 shadow-sm relative group">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => toggleItemState(m.subId, 'majorUpdates', m.id, 'isStarred')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <CardContent className="p-4 space-y-2">
                          <Badge variant="outline" className="text-[8px] bg-white font-black">{m.state}</Badge>
                          <div className="font-bold text-slate-800 leading-snug">{m.customer}</div>
                          {m.value > 0 && <div className="text-blue-600 font-semibold">{formatEAV(m.value)}</div>}
                          <div className="text-[10px] text-slate-500">{m.salespersonName || 'N/A'}</div>
                          {m.businessUnits && m.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-2 font-bold">BU: {m.businessUnits.join(', ')}</div>}
                  {m.updateText && <div className="text-xs text-slate-600 mt-2">{m.updateText}</div>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Projected Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">
                      30 Day Projected <Badge className="bg-purple-100 text-purple-700 font-black">{starredProjected.length}</Badge>
                    </h3>
                    {starredProjected.map(p => (
                      <Card key={p.id} className="border-purple-200 bg-purple-50 shadow-sm relative group">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => toggleItemState(p.subId, 'projectedWins', p.id, 'isStarred')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <CardContent className="p-4 space-y-2">
                          <Badge variant="outline" className="text-[8px] bg-white font-black">{p.state}</Badge>
                          <div className="font-bold text-slate-800 leading-snug">{p.account}</div>
                          <div className="text-purple-600 font-semibold">{formatEAV(p.value)}</div>
                          <div className="text-[10px] text-slate-500">{p.salespersonName || 'N/A'}</div>
                          {p.businessUnits && p.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-2 font-bold">BU: {p.businessUnits.join(', ')}</div>}
                          {p.updateText && <div className="text-xs text-slate-600 mt-1">{p.updateText}</div>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Priorities Column */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">
                      Priorities <Badge className="bg-amber-100 text-amber-700 font-black">{starredPriorities.length}</Badge>
                    </h3>
                    {starredPriorities.map(p => (
                      <Card key={p.id} className="border-amber-200 bg-amber-50 shadow-sm relative group">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => toggleItemState(p.subId, 'priorities', p.id, 'isStarred')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <CardContent className="p-4 space-y-2">
                          <Badge variant="outline" className="text-[8px] bg-white font-black">{p.state}</Badge>
                          <div className="text-slate-800 font-medium text-xs leading-normal">{p.text}</div>
                          <div className="text-[10px] text-slate-500">{p.salespersonName || 'N/A'}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          );
        })()}
      </Tabs>

      {/* --- SUCCESS DIALOGS --- */}
      <Dialog open={twtwSuccessOpen} onOpenChange={setTwtwSuccessOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-8 bg-white">
          <DialogHeader className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Thank You!
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-500">
              Your "The Week That Was" report has been successfully submitted.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center text-xs font-semibold text-slate-400 mt-2 mb-6">
            You can still edit and update your information at any time. Simply make your changes on the form and click "Update Submission".
          </div>
          <DialogFooter className="sm:justify-center">
            <Button 
              onClick={() => setTwtwSuccessOpen(false)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 px-8 uppercase tracking-widest rounded-xl"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fridaySuccessOpen} onOpenChange={setFridaySuccessOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-8 bg-white">
          <DialogHeader className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Report Submitted!
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-500">
              Friday Pack & Monday Planning locked in.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center text-xs font-semibold text-slate-400 mt-2 mb-6">
            Uncompleted actions and working focus accounts have been rolled over. Next week's Monday Plan is pre-populated in the database.
          </div>
          <DialogFooter className="sm:justify-center">
            <Button 
              onClick={() => setFridaySuccessOpen(false)} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 px-8 uppercase tracking-widest rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    
    <TwiwEditDialog
      submission={editingSubmission}
      open={editingSubmission !== null}
      onOpenChange={(open) => {
        if (!open) setEditingSubmission(null);
      }}
    />
    </>
  );
}
