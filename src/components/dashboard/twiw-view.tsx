"use client";

import {
  useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { getCurrentWeek, getNextWeekKey, formatEAV, cn } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useAuth } from '@/contexts/auth-context';
import { computeMomentum } from '@/lib/momentum';
import { 
  Sparkles, Save, Send, Copy, Check, ChevronRight, AlertTriangle, 
  Award, TrendingUp, HelpCircle, Loader2, Calendar, ClipboardCheck, Trash2, Plus, Target, Edit3, Eye, EyeOff, Star, CalendarIcon, Phone, Users, DollarSign, FileText, BarChart3, CheckCircle2, XCircle, Clock, RefreshCw, Shield, ShieldCheck
} from 'lucide-react';
import { TwiwEditDialog } from './twiw-edit-dialog';
import { DemoDashView } from './demo-dash-view';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';


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

interface TWIWViewProps {
  userId: string;
  isLeader: boolean;
  defaultTab?: string;
}

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

export function TWIWView({ userId, isLeader, defaultTab = "my-report" }: TWIWViewProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const { profile, user, isGuest } = useAuth();
  const currentWeek = getCurrentWeek();
  const { pipelineReviews: allDeals } = usePipelineData();
  
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
  
  const isRegisteredUser = !isGuest && (profile?.role === 'BDM' || profile?.role === 'ACCOUNT_MANAGER');

  // Active Week State
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  // KPI Review State - only for registered users
  const [kpiReview, setKpiReview] = useState<KPIReview>({
    callsTarget: 0, appointmentsTarget: 0, proposalsTarget: 0, dealsTarget: 0, revenueTarget: 0,
    callsActual: 0, appointmentsActual: 0, proposalsActual: 0, dealsActual: 0, revenueActual: 0, kpiNotes: ''
  });
  const [previousFocusAccounts, setPreviousFocusAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function loadPreviousFridayData() {
      if (!db || !userId || !isRegisteredUser) return;
      try {
        const { getDoc, getDocs, query, collection, where, doc } = await import('firebase/firestore');
        const prevCommitRef = doc(db, 'weeklyCommitments', `${userId}_${previousWeek}`);
        const prevCommitSnap = await getDoc(prevCommitRef);
        if (prevCommitSnap.exists()) {
          const prevData = prevCommitSnap.data();
          const kpiTargets = prevData.kpiTargets || {};
          setKpiReview(prev => ({
            ...prev,
            callsTarget: kpiTargets.callsToMake || 0,
            appointmentsTarget: kpiTargets.appointmentsToSet || 0,
            proposalsTarget: kpiTargets.proposalsToSend || 0,
            dealsTarget: kpiTargets.dealsToClose || 0,
            revenueTarget: kpiTargets.revenueTarget || 0
          }));
          setPreviousFocusAccounts(prevData.focusAccounts || []);
        }
        
        const prevProgressRef = doc(db, 'weeklyProgress', `${userId}_${previousWeek}`);
        const prevProgressSnap = await getDoc(prevProgressRef);
        if (prevProgressSnap.exists()) {
          const progressData = prevProgressSnap.data();
          setKpiReview(prev => ({
            ...prev,
            callsActual: progressData.calls || 0,
            appointmentsActual: progressData.apps || 0,
            proposalsActual: progressData.proposals || 0,
            dealsActual: progressData.deals || 0
          }));
        }
        
        const prevPipelineSnap = await getDocs(query(collection(db, 'pipelineReviews'), where('userId', '==', userId), where('week', '==', previousWeek)));
        const wonRevenue = prevPipelineSnap.docs.map(d => d.data()).filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (Number(d.value) || 0), 0);
        setKpiReview(prev => ({ ...prev, revenueActual: wonRevenue || 0 }));
      } catch (error) { console.error(error); }
    }
    loadPreviousFridayData();
  }, [db, userId, previousWeek, isRegisteredUser]);

  const updateKPI = (field: keyof Omit<KPIReview, 'kpiNotes'>, value: number) => {
    if (!isRegisteredUser) return;
    setKpiReview(prev => ({ ...prev, [field]: value }));
  };


  // Submission Form State
  const [wins, setWins] = useState<WinItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [updates, setUpdates] = useState(''); // Legacy fallback
  const [majorUpdates, setMajorUpdates] = useState<MajorUpdateItem[]>([]);
  const [projectedWins, setProjectedWins] = useState<ProjectedWin[]>([]);
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [newPriority, setNewPriority] = useState('');
  const [newPrioritySalesperson, setNewPrioritySalesperson] = useState('');
  const [activeTab, setActiveTab] = useState<'FORM' | 'COLLATION' | 'STANDOUTS'>(isLeader ? 'COLLATION' : 'FORM');
  const [showHiddenItems, setShowHiddenItems] = useState(false);

  const toggleItemState = async (subId: string, arrayField: 'wins'|'risks'|'majorUpdates'|'projectedWins'|'priorities', itemId: string, stateField: 'isHidden'|'isStarred') => {
    if (!db) return;
    try {
      const sub = allSubmissions?.find(s => s.id === subId);
      if (!sub) return;
      const items = [...(sub[arrayField] || [])];
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
      
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'twiwSubmissions', subId), { [arrayField]: items });
      toast({ title: "Updated successfully", description: "Item visibility/starred state updated." });
    } catch(e) {
      toast({ variant: "destructive", title: "Failed to update item state." });
    }
  };
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'NONE'>('NONE');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<any>(null);

  const isFormComplete = useMemo(() => {
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
      if (kpiReview.callsActual === undefined || isNaN(kpiReview.callsActual) || kpiReview.callsActual < 0) return false;
      if (kpiReview.appointmentsActual === undefined || isNaN(kpiReview.appointmentsActual) || kpiReview.appointmentsActual < 0) return false;
      if (kpiReview.proposalsActual === undefined || isNaN(kpiReview.proposalsActual) || kpiReview.proposalsActual < 0) return false;
      if (kpiReview.dealsActual === undefined || isNaN(kpiReview.dealsActual) || kpiReview.dealsActual < 0) return false;
      if (kpiReview.revenueActual === undefined || isNaN(kpiReview.revenueActual) || kpiReview.revenueActual < 0) return false;
      if (!kpiReview.kpiNotes?.trim()) return false;
    }

    return true;
  }, [wins, risks, majorUpdates, projectedWins, priorities, kpiReview, isRegisteredUser]);

  // --- ISO Week Calculation Helper ---
  const getWeekKey = (date: Date): string => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-${String(weekNo).padStart(2, '0')}`;
  };

  const isCreatedThisWeek = (createdAt: any) => {
    if (!createdAt) return false;
    let d: Date;
    if (typeof createdAt.toDate === 'function') {
      d = createdAt.toDate();
    } else if (createdAt instanceof Date) {
      d = createdAt;
    } else {
      d = new Date(createdAt);
    }
    return getWeekKey(d) === selectedWeek;
  };

  // --- CRM & Compliance Document Queries ---
  // Call Plans Query
  const cpQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', userId), where('week', '==', selectedWeek));
  }, [db, userId, selectedWeek]);
  const { data: cpPlans } = useCollection(cpQuery);

  // Whitespace Plans Query
  const wsQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'whitespacePlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: wsPlans } = useCollection(wsQuery);

  // Ops Reports Query
  const opsReportsQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'opsReports'), where('userId', '==', userId), where('week', '==', selectedWeek));
  }, [db, userId, selectedWeek]);
  const { data: opsReps } = useCollection(opsReportsQuery);

  // Fact Finding Docs Query
  const ffQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'factFindingDocs'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: ffDocs } = useCollection(ffQuery);

  // Leader / GM compliance audit (fetch everyone's docs for this week)
  const allCallPlansQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'callPlans'), where('week', '==', selectedWeek));
  }, [db, isLeader, selectedWeek]);
  const { data: allCallPlans } = useCollection(allCallPlansQuery);

  const allWhitespaceQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'whitespacePlans');
  }, [db, isLeader]);
  const { data: allWhitespacePlans } = useCollection(allWhitespaceQuery);

  const allOpsReportsQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'opsReports'), where('week', '==', selectedWeek));
  }, [db, isLeader, selectedWeek]);
  const { data: allOpsReports } = useCollection(allOpsReportsQuery);

  const allFactFindingsQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'factFindingDocs');
  }, [db, isLeader]);
  const { data: allFactFindings } = useCollection(allFactFindingsQuery);

  // Sourced Team Profiles (for Collation)
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  const { data: allUsers } = useCollection(usersQuery);

  // Sourced All Submissions (for Collation)
  const allSubmissionsQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'twiwSubmissions'), where('week', '==', selectedWeek));
  }, [db, isLeader, selectedWeek]);
  const { data: allSubmissions } = useCollection(allSubmissionsQuery);

  const mappedSubmissions = useMemo(() => {
    if (!allSubmissions) return null;
    return allSubmissions.map(sub => ({
      ...sub,
      wins: (sub.wins || []).map((w: any, idx: number) => ({ ...w, id: w.id || `win-${idx}` })),
      risks: (sub.risks || []).map((r: any, idx: number) => ({ ...r, id: r.id || `risk-${idx}` })),
      majorUpdates: (sub.majorUpdates || []).map((m: any, idx: number) => ({ ...m, id: m.id || `update-${idx}` })),
      projectedWins: (sub.projectedWins || []).map((p: any, idx: number) => ({ ...p, id: p.id || `projected-${idx}` })),
      priorities: (sub.priorities || []).map((pr: any, idx: number) => ({ ...pr, id: pr.id || `priority-${idx}` }))
    }));
  }, [allSubmissions]);

  // Fetch BDM Profile (for displayName)
  const [bdmName, setBdmName] = useState('BDM');
  useEffect(() => {
    async function getProfile() {
      if (!db || !userId) return;
      const uDoc = await getDoc(doc(db, 'users', userId));
      if (uDoc.exists()) {
        setBdmName(uDoc.data().name || 'BDM');
      }
    }
    getProfile();
  }, [db, userId]);

  // Load BDM's own submission
  useEffect(() => {
    async function loadSubmission() {
      if (!db || !userId) return;
      setIsLoading(true);
      try {
        const subDoc = await getDoc(doc(db, 'twiwSubmissions', `${userId}_${selectedWeek}`));
        if (subDoc.exists()) {
          const data = subDoc.data();
          setWins((data.wins || []).map((w: any) => ({ ...w, id: w.id || crypto.randomUUID() })));
          setRisks((data.risks || []).map((r: any) => ({ ...r, id: r.id || crypto.randomUUID() })));
          setUpdates(data.updates || '');
          setMajorUpdates((data.majorUpdates || []).map((m: any) => ({ ...m, id: m.id || crypto.randomUUID() })));
          setProjectedWins((data.projectedWins || []).map((p: any) => ({ ...p, id: p.id || crypto.randomUUID() })));
          setPriorities((data.priorities || []).map((pr: any) => ({ ...pr, id: pr.id || crypto.randomUUID() })));
          setStatus(data.status || 'DRAFT');
        } else {
          // Reset fields
          setWins([]);
          setRisks([]);
          setUpdates('');
          setMajorUpdates([]);
          setProjectedWins([]);
          setPriorities([]);
          setStatus('NONE');
        }
      } catch (err) {
        console.error("Failed to load TWTW submission", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSubmission();
  }, [db, userId, selectedWeek]);

  // Auto-population logic
  const handleAutoSuggestWins = async () => {
    if (!db || !userId) return;
    try {
      // Sourced from signedPaperwork
      const signedSnap = await getDocs(query(collection(db, 'signedPaperwork'), where('userId', '==', userId), where('week', '==', selectedWeek)));
      const signedWins = signedSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          customer: data.accountName || 'Unknown Win',
          value: Number(data.eav) || 0,
          updateText: 'Signed contract win',
          businessUnits: [],
          salespersonName: bdmName || 'Salesperson'
        };
      });

      // Sourced from CRM opportunities marked Closed Won in current week
      const crmWins = allDeals
        .filter(deal => deal.stage === 'Closed Won')
        .map(deal => ({
          id: deal.id,
          customer: deal.pipeline,
          value: Number(deal.value) || 0,
          updateText: 'CRM Closed Won',
          businessUnits: [],
          salespersonName: bdmName || 'Salesperson'
        }));

      // Combine and filter unique
      const combined = [...wins];
      [...signedWins, ...crmWins].forEach(suggest => {
        if (!combined.some(w => w.customer.toLowerCase() === suggest.customer.toLowerCase())) {
          combined.push({
            id: crypto.randomUUID(),
            customer: suggest.customer,
            value: suggest.value,
            updateText: suggest.updateText,
            businessUnits: suggest.businessUnits,
            salespersonName: suggest.salespersonName
          });
        }
      });

      setWins(combined);
      toast({ title: "Key Wins Auto-filled", description: `Added ${combined.length - wins.length} suggested wins.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Auto-fill Failed" });
    }
  };

  const handleAutoSuggestRisks = () => {
    // Sourced from CRM deals flagged as DEAD or STALLING momentum
    const riskDeals = allDeals
      .filter(deal => {
        const m = computeMomentum({
          daysInStage: deal.daysInStage || 0,
          rolloverCount: deal.rolloverCount || 0,
          barrierText: deal.barriers || '',
          lastBarrierText: deal.lastBarrierText || ''
        });
        return m.score === 'DEAD' || m.score === 'STALLING';
      })
      .map(deal => ({
        id: deal.id,
        account: deal.pipeline,
        value: Number(deal.value) || 0,
        mitigation: deal.barriers || 'Flagged for stalling momentum.',
        salespersonName: bdmName || 'Salesperson'
      }));

    const combined = [...risks];
    riskDeals.forEach(suggest => {
      if (!combined.some(r => r.account.toLowerCase() === suggest.account.toLowerCase())) {
        combined.push({
          id: crypto.randomUUID(),
          account: suggest.account,
          value: suggest.value,
          mitigation: suggest.mitigation,
          salespersonName: suggest.salespersonName
        });
      }
    });

    setRisks(combined);
    toast({ title: "Churn Risks Auto-filled", description: `Added ${combined.length - risks.length} suggested risks.` });
  };

  const handleAutoSuggestProjected = () => {
    // Sourced from CRM active deals with value >= 200k closing in next 30 days
    const activeProjected = allDeals
      .filter(deal => {
        if (deal.stage === 'Closed Won' || deal.stage === 'Closed Lost') return false;
        if ((deal.value || 0) < 200000) return false;
        
        // Basic date validation (close date is within next 30 days)
        if (deal.expectedDate) {
          const closeDate = new Date(deal.expectedDate);
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
          return closeDate >= now && closeDate <= thirtyDaysFromNow;
        }
        return false;
      })
      .map(deal => ({
        id: deal.id,
        account: deal.pipeline,
        value: Number(deal.value) || 0,
        expectedDate: deal.expectedDate || format(new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000), 'dd-MM-yyyy'),
        updateText: 'Projected Close',
        salespersonName: bdmName || 'Salesperson'
      }));

    const combined = [...projectedWins];
    activeProjected.forEach(suggest => {
      if (!combined.some(p => p.account.toLowerCase() === suggest.account.toLowerCase())) {
        combined.push({
          id: crypto.randomUUID(),
          account: suggest.account,
          value: suggest.value,
          expectedDate: suggest.expectedDate,
          updateText: suggest.updateText,
          salespersonName: suggest.salespersonName
        });
      }
    });

    setProjectedWins(combined);
    toast({ title: "Projected Wins Auto-filled", description: `Added ${combined.length - projectedWins.length} high-value deals.` });
  };

  const handleAutoSuggestPriorities = async () => {
    if (!db || !userId) return;
    try {
      // Sourced from next week's Monday commitments
      const nextWeek = getNextWeekKey(selectedWeek);
      const commitRef = doc(db, 'weeklyCommitments', `${userId}_${nextWeek}`);
      const snap = await getDoc(commitRef);
      let suggested: string[] = [];
      if (snap.exists()) {
        suggested = (snap.data().actionPlan || []).filter((a: string) => a.trim());
      }
      
      if (suggested.length === 0) {
        // Fallback to current week's commitments
        const curSnap = await getDoc(doc(db, 'weeklyCommitments', `${userId}_${selectedWeek}`));
        if (curSnap.exists()) {
          suggested = (curSnap.data().actionPlan || []).filter((a: string) => a.trim());
        }
      }

      const combined = [...priorities];
      suggested.forEach(p => {
        if (!combined.some(cp => cp.text.toLowerCase() === p.toLowerCase())) {
          combined.push({ id: crypto.randomUUID(), text: p, salespersonName: bdmName || 'Salesperson' });
        }
      });

      setPriorities(combined);
      toast({ title: "Priorities Auto-filled", description: `Added ${combined.length - priorities.length} target focus areas.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Priorities Auto-fill Failed" });
    }
  };

  // List editing functions
  const addWinRow = () => setWins([...wins, { id: crypto.randomUUID(), customer: '', value: 0, updateText: '', businessUnits: [], salespersonName: bdmName || 'Salesperson' }]);
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

  const addRiskRow = () => setRisks([...risks, { id: crypto.randomUUID(), account: '', value: 0, mitigation: '', salespersonName: bdmName || 'Salesperson' }]);
  const removeRiskRow = (id: string) => setRisks(risks.filter(r => r.id !== id));
  const updateRiskField = (id: string, field: keyof RiskItem, val: any) => {
    setRisks(risks.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const addMajorUpdateRow = () => setMajorUpdates([...majorUpdates, { id: crypto.randomUUID(), customer: '', value: 0, businessUnits: [], updateText: '', salespersonName: bdmName || 'Salesperson' }]);
  const removeMajorUpdateRow = (id: string) => setMajorUpdates(majorUpdates.filter(m => m.id !== id));
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

  const addProjectedRow = () => setProjectedWins([...projectedWins, { id: crypto.randomUUID(), account: '', value: 0, expectedDate: format(new Date(), 'dd-MM-yyyy'), updateText: '', salespersonName: bdmName || 'Salesperson' }]);
  const removeProjectedRow = (id: string) => setProjectedWins(projectedWins.filter(p => p.id !== id));
  const updateProjectedField = (id: string, field: keyof ProjectedWin, val: any) => {
    setProjectedWins(projectedWins.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const addPriority = () => {
    setPriorities([...priorities, { id: crypto.randomUUID(), text: '', salespersonName: bdmName || 'Salesperson' }]);
  };
  const updatePriorityField = (id: string, field: 'text' | 'salespersonName', val: string) => {
    setPriorities(priorities.map(p => p.id === id ? { ...p, [field]: val } : p));
  };
  const removePriority = (id: string) => setPriorities(priorities.filter(p => p.id !== id));

  // Save Submission
  const handleSave = async (submitState: 'DRAFT' | 'SUBMITTED') => {
    if (!db || !userId) return;
    if (submitState === 'DRAFT') setIsSaving(true);
    else setIsSubmitting(true);

    try {
      await setDoc(doc(db, 'twiwSubmissions', `${userId}_${selectedWeek}`), {
        userId,
        userName: bdmName,
        email: profile?.email || user?.email || 'Guest',
        state: profile?.state || 'WA',
        week: selectedWeek,
        wins: wins.filter(w => w.customer.trim()),
        risks: risks.filter(r => r.account.trim()),
        updates: updates.trim(),
        majorUpdates: majorUpdates.filter(m => m.customer.trim() || m.updateText.trim()),
        projectedWins: projectedWins.filter(p => p.account.trim()),
        priorities: priorities.filter(p => p.text.trim()),
        kpiReview: {
          targets: { calls: kpiReview.callsTarget, appointments: kpiReview.appointmentsTarget, proposals: kpiReview.proposalsTarget, deals: kpiReview.dealsTarget, revenue: kpiReview.revenueTarget },
          actuals: { calls: kpiReview.callsActual, appointments: kpiReview.appointmentsActual, proposals: kpiReview.proposalsActual, deals: kpiReview.dealsActual, revenue: kpiReview.revenueActual },
          notes: kpiReview.kpiNotes
        },
        status: submitState,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setStatus(submitState);
      if (submitState === 'SUBMITTED') {
        setSuccessDialogOpen(true);
      }
      toast({
        title: submitState === 'SUBMITTED' ? "Report Submitted" : "Draft Saved",
        description: submitState === 'SUBMITTED' 
          ? "Your TWTW report has been published to Leadership." 
          : "Your updates were successfully saved as a draft."
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Operation Failed", description: "Failed to upload TWTW report." });
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  // Collate all submissions (Leaders only)
  const submissionsByState = useMemo(() => {
    if (!mappedSubmissions || mappedSubmissions.length === 0) return {};
    const grouped: Record<string, any[]> = {};
    
    // Filter and group by state
    mappedSubmissions.forEach(sub => {
      // Only include if they actually submitted or saved a draft
      if (sub.status === 'NONE' && !sub.wins?.length && !sub.risks?.length) return; 
      
      const state = sub.state || 'WA';
      if (!grouped[state]) grouped[state] = [];
      grouped[state].push(sub);
    });

    // Sort within each state by highest Key Win Value, descending
    Object.keys(grouped).forEach(state => {
      grouped[state].sort((a, b) => {
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

    return grouped;
  }, [mappedSubmissions, selectedWeek]);

  const [isExporting, setIsExporting] = useState(false);

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

  const handleExportPdf = () => {
    setIsExporting(true);
    
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to export to PDF." });
      setIsExporting(false);
      return;
    }

    // Retrieve starred items for Key Standouts page
    const getStarredItems = (arrayField: string) => {
      const items: any[] = [];
      mappedSubmissions?.forEach(sub => {
        const arr = sub[arrayField as keyof typeof sub] as any[];
        if (arr) {
          arr.filter((i: any) => i.isStarred && !i.isHidden).forEach((i: any) => items.push({ ...i, subId: sub.id, state: sub.state }));
        }
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
          <title>TWTW Export - Week ${selectedWeek.split('-')[1]}</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              -webkit-print-color-adjust: exact; 
              color-adjust: exact; 
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 10px;
            }
            .page-container {
              page-break-before: always;
              clear: both;
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
            
            .standout-card-landscape {
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 5px;
              padding: 6px;
              width: calc(33.333% - 6px);
              min-width: 180px;
              box-sizing: border-box;
              font-size: 7.5px;
              position: relative;
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
            .card-customer {
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 1px;
            }
            .card-value {
              font-weight: 800;
              margin-bottom: 1px;
            }
            .card-salesperson {
              font-size: 7px;
              color: #64748b;
              font-weight: bold;
              margin-bottom: 2px;
            }
            .card-text {
              color: #334155;
              border-top: 1px dashed rgba(0,0,0,0.08);
              padding-top: 2.5px;
              margin-top: 2.5px;
              line-height: 1.2;
            }
            
            /* Card Theme Colors */
            .win-text { color: #166534; }
            .risk-text { color: #9f1239; }
            .update-text { color: #1e40af; }
            .projected-text { color: #6b21a8; }
            
            /* Table Styling */
            .region-header {
              page-break-after: avoid;
              break-after: avoid;
            }
            .region-header h2 {
              font-size: 14px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -0.5px;
              color: #0f172a;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 4px;
              margin-top: 0;
              margin-bottom: 10px;
              page-break-after: avoid;
              break-after: avoid;
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
            
            /* Item Blocks in Table Cells */
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
            .item-value {
              font-weight: 800;
              margin-top: 1px;
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
            .avoid-break { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>The Week That Was (TWTW) - Week ${selectedWeek.split('-')[1]}</h1>
            <p>Consolidated Executive Weekly Briefing</p>
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
              <div class="page-container" style="${idx === 0 && !hasStandouts ? 'page-break-before: avoid;' : ''}">
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
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsExporting(false);
    }, 500);
  };

  const handleExportOversizedPdf = async () => {
    setIsExporting(true);
    toast({ title: "Generating PDF...", description: "Building high-resolution single-sheet PDF. Please wait." });

    // Retrieve starred items for Key Standouts page
    const getStarredItems = (arrayField: string) => {
      const items: any[] = [];
      mappedSubmissions?.forEach(sub => {
        const arr = sub[arrayField as keyof typeof sub] as any[];
        if (arr) {
          arr.filter((i: any) => i.isStarred && !i.isHidden).forEach((i: any) => items.push({ ...i, subId: sub.id, state: sub.state }));
        }
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
      setIsExporting(false);
    }
  };

  const handleExportCondensedPdf = () => {
    setIsExporting(true);
    
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to export to PDF." });
      setIsExporting(false);
      return;
    }

    // Combine data across all states/regions
    const allWins: any[] = [];
    const allRisks: any[] = [];
    const allUpdates: any[] = [];
    const allProjected: any[] = [];
    const allPriorities: any[] = [];

    mappedSubmissions?.forEach((sub: any) => {
      const state = sub.state || 'N/A';
      const rep = sub.salespersonName || sub.userName || 'N/A';
      
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

    printWindow.document.write(`
      <html>
        <head>
          <title>Condensed TWTW Export - Week ${selectedWeek.split('-')[1]}</title>
          <style>
            @page { size: landscape; margin: 6mm; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              -webkit-print-color-adjust: exact; 
              color-adjust: exact; 
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 7.5px;
            }
            .report-header {
              text-align: center;
              background-color: #0f172a;
              color: white;
              padding: 10px;
              margin-bottom: 12px;
              border-radius: 8px;
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
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; table-layout: fixed; }
            th, td { border: 1px solid #cbd5e1; padding: 4px; text-align: left; vertical-align: top; }
            th { background-color: #1e293b; font-weight: 900; text-transform: uppercase; color: white; font-size: 7.5px; letter-spacing: 0.5px; }
            td { line-height: 1.25; word-break: break-word; }
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
              font-size: 7.5px;
              padding: 6px 0;
              border: 1px solid #cbd5e1;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>TGE Parcel North - The Week That Was - Week ${selectedWeek.split('-')[1]}</h1>
            <p>Consolidated Executive Weekly Briefing</p>
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
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsExporting(false);
    }, 500);
  };

  const salesWeeks = useMemo(() => {
    // Generate current week and last 4 weeks options
    const weeks = [currentWeek];
    let next = currentWeek;
    for (let i = 0; i < 4; i++) {
      // Simple backwards sales week generation
      const [year, wk] = next.split('-').map(Number);
      if (wk > 1) {
        next = `${year}-${String(wk - 1).padStart(2, '0')}`;
      } else {
        next = `${year - 1}-52`;
      }
      weeks.push(next);
    }
    return weeks;
  }, [currentWeek]);

  return (
    <div className="space-y-6 w-full max-w-[1400px] mx-auto pb-12">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-black font-headline text-primary tracking-tighter uppercase">TWTW: The Week That Was</h1>
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-tight">Standardized Team Performance Reporting</p>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select 
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="flex h-10 w-full sm:w-[180px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm font-bold shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {salesWeeks.map(wk => (
              <option key={wk} value={wk}>Week {wk.split('-')[1]} ({wk.split('-')[0]})</option>
            ))}
          </select>
        </div>
      </header>

      {isLeader ? (
        <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-slate-100/60 p-1 rounded-2xl grid grid-cols-4 max-w-3xl mb-8 h-12 border">
            <TabsTrigger value="my-report" className="rounded-xl font-black text-xs uppercase tracking-widest h-10">My Report</TabsTrigger>
            <TabsTrigger value="collation" className="rounded-xl font-black text-xs uppercase tracking-widest h-10">Collation Hub</TabsTrigger>
            <TabsTrigger value="new-collation" className="rounded-xl font-black text-xs uppercase tracking-widest h-10">New Collation</TabsTrigger>
            <TabsTrigger value="standouts" className="rounded-xl font-black text-xs uppercase tracking-widest h-10">Key Standouts</TabsTrigger>
          </TabsList>

          <TabsContent value="my-report">
            {isLoading ? (
              <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
            ) : (
              <div className="space-y-6">
                {renderKPIReview()}
                {renderBasicTWTWForm()}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collation">
            <DemoDashView embeddedCollationOnly />
          </TabsContent>

          <TabsContent value="new-collation">
            {renderCollationHub()}
          </TabsContent>

          <TabsContent value="standouts">
            {renderKeyStandouts()}
          </TabsContent>
        </Tabs>
      ) : (
        isLoading ? (
          <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
        ) : isGuest ? (
          renderGuestView()
        ) : (
          renderSubmissionForm()
        )
      )}
      <TwiwEditDialog
        submission={editingSubmission}
        open={editingSubmission !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSubmission(null);
        }}
      />
    </div>
  );

  
  function renderSubmissionForm() {
    return (
      <div className="space-y-6">
        {isRegisteredUser && renderKPIReview()}
        {renderBasicTWTWForm()}
      </div>
    );
  }

  function renderKPIReview() {
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
            <div className="space-y-2"><div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" /><div className="text-[9px] font-black uppercase text-slate-500">Calls</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.callsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.callsActual || ''} onChange={(e) => updateKPI('callsActual', parseInt(e.target.value) || 0)} className={cn("h-9 text-lg font-black w-full", (kpiReview.callsActual === undefined || isNaN(kpiReview.callsActual) || kpiReview.callsActual < 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")} placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" /><div className="text-[9px] font-black uppercase text-slate-500">Appts</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.appointmentsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.appointmentsActual || ''} onChange={(e) => updateKPI('appointmentsActual', parseInt(e.target.value) || 0)} className={cn("h-9 text-lg font-black w-full", (kpiReview.appointmentsActual === undefined || isNaN(kpiReview.appointmentsActual) || kpiReview.appointmentsActual < 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")} placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /><div className="text-[9px] font-black uppercase text-slate-500">Proposals</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.proposalsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.proposalsActual || ''} onChange={(e) => updateKPI('proposalsActual', parseInt(e.target.value) || 0)} className={cn("h-9 text-lg font-black w-full", (kpiReview.proposalsActual === undefined || isNaN(kpiReview.proposalsActual) || kpiReview.proposalsActual < 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")} placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /><div className="text-[9px] font-black uppercase text-slate-500">Wins</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-xl font-black text-slate-800">{kpiReview.dealsTarget}</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.dealsActual || ''} onChange={(e) => updateKPI('dealsActual', parseInt(e.target.value) || 0)} className={cn("h-9 text-lg font-black w-full", (kpiReview.dealsActual === undefined || isNaN(kpiReview.dealsActual) || kpiReview.dealsActual < 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")} placeholder="0" /></div></div></div>
            <div className="space-y-2"><div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /><div className="text-[9px] font-black uppercase text-slate-500">Revenue</div></div><div className="flex gap-2"><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Target</div><div className="text-lg font-black text-slate-800">${(kpiReview.revenueTarget / 1000).toFixed(0)}K</div></div><div className="flex-1"><div className="text-[8px] font-bold text-slate-400 uppercase">Actual</div><Input type="number" value={kpiReview.revenueActual || ''} onChange={(e) => updateKPI('revenueActual', parseInt(e.target.value) || 0)} className={cn("h-9 text-lg font-black w-full", (kpiReview.revenueActual === undefined || isNaN(kpiReview.revenueActual) || kpiReview.revenueActual < 0) && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")} placeholder="0" /></div></div></div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black uppercase text-slate-500">Weekly KPI Notes & Commentary</div>
            <Textarea placeholder="Provide notes on your KPI performance this week..." value={kpiReview.kpiNotes} onChange={(e) => setKpiReview(prev => ({ ...prev, kpiNotes: e.target.value }))} className={cn("min-h-[80px] text-xs font-medium rounded-xl", !kpiReview.kpiNotes?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")} />
          </div>
          {previousFocusAccounts.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-accent" /> Previous Week's Focus Accounts (from Friday Plan)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {previousFocusAccounts.map((acc: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 border rounded-xl">
                    <p className="font-bold text-slate-800">{acc.accountName}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                      <Badge variant="outline" className="text-[7px] font-black uppercase">{acc.actionType}</Badge>
                      <span className="font-black">${(acc.eav || 0).toLocaleString()}</span>
                    </div>
                    {acc.aboutAccount && <p className="text-[10px] text-slate-600 mt-1 line-clamp-2">{acc.aboutAccount}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  function renderGuestView() { return (
    <div className="space-y-6">
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
      {renderBasicTWTWForm()}
    </div>
  ); }

  function renderBasicTWTWForm() {

    return (
      <div className="space-y-6">
          
          {/* Key Wins */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-500" /> Key Wins
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Significant closed business during the week
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Desktop Table View */}
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
                        <td colSpan={4} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                          No Wins reported yet. Add a custom row.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked View */}
              <div className="block sm:hidden space-y-4">
                {wins.map((w, idx) => (
                  <div key={w.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Win #{idx + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeWinRow(w.id)} className="h-6 w-6 text-red-500 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Customer</label>
                      <Input 
                        value={w.customer} 
                        onChange={(e) => updateWinField(w.id, 'customer', e.target.value)} 
                        placeholder="e.g. Acme Corp" 
                        className="h-8 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Business Unit</label>
                      <div className="flex flex-wrap gap-1">
                        {BUSINESS_UNITS.map(bu => (
                          <Badge 
                            key={bu} 
                            variant={(w.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                            className="cursor-pointer text-[10px] px-2 py-0.5 bg-white shadow-sm hover:bg-slate-100 text-slate-600"
                            style={(w.businessUnits || []).includes(bu) ? { backgroundColor: '#1e293b', color: 'white', borderColor: 'transparent' } : {}}
                            onClick={() => toggleBusinessUnit(w.id, bu)}
                          >
                            {bu}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">EAV ($)</label>
                        <Input 
                          type="number"
                          value={w.value || ''} 
                          onChange={(e) => updateWinField(w.id, 'value', parseFloat(e.target.value) || 0)} 
                          placeholder="Value" 
                          className="h-8 text-xs font-black text-emerald-600 bg-white"
                        />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black uppercase text-slate-400">Update</label>
                        <Input 
                          value={w.updateText || ''} 
                          onChange={(e) => updateWinField(w.id, 'updateText', e.target.value)} 
                          placeholder="Update text" 
                          className="h-8 text-xs bg-white"
                          maxLength={200}
                        />
                        <div className="text-right text-[8px] text-slate-400 font-bold mt-0.5">{(w.updateText || '').length}/200</div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                        <Input 
                          value={w.salespersonName} 
                          onChange={(e) => updateWinField(w.id, 'salespersonName', e.target.value)} 
                          placeholder="Name" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {wins.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No Wins reported yet. Add a custom row.
                  </div>
                )}
              </div>

              <Button onClick={addWinRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Win
              </Button>
            </CardContent>
          </Card>

          {/* Churn Risk Flags */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Churn Risk Flags
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Key accounts at risk of churning or revenue loss
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Desktop Table View */}
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

              {/* Mobile Stacked View */}
              <div className="block sm:hidden space-y-4">
                {risks.map((r, idx) => (
                  <div key={r.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Risk #{idx + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeRiskRow(r.id)} className="h-6 w-6 text-red-500 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Account / Cust</label>
                      <Input 
                        value={r.account} 
                        onChange={(e) => updateRiskField(r.id, 'account', e.target.value)} 
                        placeholder="e.g. Acme Corp" 
                        className="h-8 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Value at Risk ($)</label>
                        <Input 
                          type="number"
                          value={r.value || ''} 
                          onChange={(e) => updateRiskField(r.id, 'value', parseFloat(e.target.value) || 0)} 
                          placeholder="Value" 
                          className="h-8 text-xs font-black text-rose-600 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Mitigation</label>
                        <Input 
                          value={r.mitigation} 
                          onChange={(e) => updateRiskField(r.id, 'mitigation', e.target.value)} 
                          placeholder="Mitigation" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                        <Input 
                          value={r.salespersonName} 
                          onChange={(e) => updateRiskField(r.id, 'salespersonName', e.target.value)} 
                          placeholder="Name" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {risks.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No Risks flagged yet. Add a custom row.
                  </div>
                )}
              </div>

              <Button onClick={addRiskRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Risk
              </Button>
            </CardContent>
          </Card>

          {/* Major Pipeline & Customer Updates */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">
                Major Pipeline &amp; Customer Updates
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Key updates on deal stages, client milestones, and territory status
              </CardDescription>
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
                        <td colSpan={4} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                          No Wins reported yet. Add a custom rom.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked View */}
              <div className="block sm:hidden space-y-4">
                {majorUpdates.map((m, idx) => (
                  <div key={m.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Update #{idx + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeMajorUpdateRow(m.id)} className="h-6 w-6 text-red-500 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Customer</label>
                      <Input 
                        value={m.customer} 
                        onChange={(e) => updateMajorUpdateField(m.id, 'customer', e.target.value)} 
                        placeholder="e.g. Acme Corp" 
                        className="h-8 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Business Unit</label>
                      <div className="flex flex-wrap gap-1">
                        {BUSINESS_UNITS.map(bu => (
                          <Badge 
                            key={bu} 
                            variant={(m.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                            className="cursor-pointer text-[10px] px-2 py-0.5 bg-white shadow-sm hover:bg-slate-100 text-slate-600"
                            style={(m.businessUnits || []).includes(bu) ? { backgroundColor: '#1e293b', color: 'white', borderColor: 'transparent' } : {}}
                            onClick={() => toggleMajorUpdateBU(m.id, bu)}
                          >
                            {bu}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">EAV ($)</label>
                        <Input 
                          type="number"
                          value={m.value || ''} 
                          onChange={(e) => updateMajorUpdateField(m.id, 'value', parseFloat(e.target.value) || 0)} 
                          placeholder="Value" 
                          className="h-8 text-xs font-black text-emerald-600 bg-white"
                        />
                      </div>
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black uppercase text-slate-400">Update</label>
                        <Input 
                          value={m.updateText || ''} 
                          onChange={(e) => updateMajorUpdateField(m.id, 'updateText', e.target.value)} 
                          placeholder="Update text" 
                          className="h-8 text-xs bg-white"
                          maxLength={200}
                        />
                        <div className="text-right text-[8px] text-slate-400 font-bold mt-0.5">{(m.updateText || '').length}/200</div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                        <Input 
                          value={m.salespersonName} 
                          onChange={(e) => updateMajorUpdateField(m.id, 'salespersonName', e.target.value)} 
                          placeholder="Name" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {majorUpdates.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No Wins reported yet. Add a custom rom.
                  </div>
                )}
              </div>

              <Button onClick={addMajorUpdateRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Update
              </Button>
            </CardContent>
          </Card>

          {/* 30 Day Projected Wins >$200k */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> 30 Day Projected Wins
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  High-value closures expected within the next 30 days
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Desktop Table View */}
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
                    )})}
                    {projectedWins.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                          No projected wins &gt;$200k found. Add a custom row.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked View */}
              <div className="block sm:hidden space-y-4">
                {projectedWins.map((p, idx) => {
                  return (
                  <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Projected Win #{idx + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeProjectedRow(p.id)} className="h-6 w-6 text-red-500 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Account / Cust</label>
                      <Input 
                        value={p.account} 
                        onChange={(e) => updateProjectedField(p.id, 'account', e.target.value)} 
                        placeholder="e.g. Acme Corp" 
                        className="h-8 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">EAV ($)</label>
                        <Input 
                          type="number"
                          value={p.value || ''} 
                          onChange={(e) => updateProjectedField(p.id, 'value', parseFloat(e.target.value) || 0)} 
                          placeholder="Value" 
                          className="h-8 text-xs font-black text-blue-600 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Business Unit</label>
                        <div className="flex flex-wrap gap-1">
                          {BUSINESS_UNITS.map(bu => (
                            <Badge 
                              key={bu} 
                              variant={(p.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                              className="cursor-pointer text-[10px] px-2 py-0.5 bg-white shadow-sm hover:bg-slate-100 text-slate-600"
                              style={(p.businessUnits || []).includes(bu) ? { backgroundColor: '#1e293b', color: 'white', borderColor: 'transparent' } : {}}
                              onClick={() => toggleProjectedWinBU(p.id, bu)}
                            >
                              {bu}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 relative">
                        <label className="text-[9px] font-black uppercase text-slate-400">Update</label>
                        <Input 
                          value={p.updateText || ''} 
                          onChange={(e) => updateProjectedField(p.id, 'updateText', e.target.value)} 
                          placeholder="Update" 
                          className="h-8 text-xs bg-white"
                          maxLength={200}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                        <Input 
                          value={p.salespersonName} 
                          onChange={(e) => updateProjectedField(p.id, 'salespersonName', e.target.value)} 
                          placeholder="Name" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )})}
                {projectedWins.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No projected wins &gt;$200k found. Add a custom row.
                  </div>
                )}
              </div>

              <Button onClick={addProjectedRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom projected win
              </Button>
            </CardContent>
          </Card>
        {/* Bottom Cards: Priorities and Submission Actions */}
          {/* Priorities */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" /> Priorities for Week Ahead
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Key areas of focus for the next 7 days
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                      <th className="text-left pb-2 w-[70%]">Priority / Focus Area</th>
                      <th className="text-left pb-2 w-[25%]">Salesperson</th>
                      <th className="text-center pb-2 w-[5%]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {priorities.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-2">
                          <Input 
                            value={p.text || ''} 
                            onChange={(e) => updatePriorityField(p.id, 'text', e.target.value)} 
                            placeholder="e.g. Focus on Neerabup zone wins" 
                            className={cn("h-8 text-xs font-semibold", !p.text?.trim() && "border-red-500 focus-visible:ring-red-500 bg-red-50/10")}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            value={p.salespersonName} 
                            onChange={(e) => updatePriorityField(p.id, 'salespersonName', e.target.value)} 
                            placeholder="Name" 
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
                          No priorities added yet. Add a row below.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block sm:hidden space-y-3">
                {priorities.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 relative">
                    <Button variant="ghost" size="icon" onClick={() => removePriority(p.id)} className="absolute top-2 right-2 h-6 w-6 text-red-500 rounded-lg">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Priority / Focus Area</label>
                      <Input 
                        value={p.text || ''} 
                        onChange={(e) => updatePriorityField(p.id, 'text', e.target.value)} 
                        placeholder="e.g. Focus on Neerabup zone wins" 
                        className="h-8 text-xs bg-white"
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
                {priorities.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No priorities added yet. Add a row below.
                  </div>
                )}
              </div>

              <Button onClick={addPriority} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Priority Focus
              </Button>
            </CardContent>
          </Card>

          {/* Strategy Document Compliance Check */}
          {profile?.role !== 'GUEST' && (
            <Card className="border-slate-200 shadow-lg rounded-3xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-200 py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Weekly Compliance Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-6">
                {/* Call Plans */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">📞 Call Plans</h5>
                  {cpPlans && cpPlans.length > 0 ? (
                    <div className="space-y-2">
                      {cpPlans.map((cp: any, idx: number) => {
                        const dt = cp.createdAt?.toDate ? cp.createdAt.toDate() : (cp.createdAt ? new Date(cp.createdAt) : null);
                        const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                        return (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 border rounded-xl p-3">
                            <span className="text-xs font-bold text-slate-700">{cp.accountName || cp.dealName || 'Unnamed Plan'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Created: {timeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-black text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">No Call Plans Created</p>
                  )}
                </div>

                {/* White Space */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">🗺️ White Space Reports</h5>
                  {wsPlans && wsPlans.filter((ws: any) => isCreatedThisWeek(ws.createdAt)).length > 0 ? (
                    <div className="space-y-2">
                      {wsPlans.filter((ws: any) => isCreatedThisWeek(ws.createdAt)).map((ws: any, idx: number) => {
                        const dt = ws.createdAt?.toDate ? ws.createdAt.toDate() : (ws.createdAt ? new Date(ws.createdAt) : null);
                        const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                        return (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 border rounded-xl p-3">
                            <span className="text-xs font-bold text-slate-700">{ws.accountName || 'Unnamed Diagnostic'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Created: {timeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-black text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">No White Space Reports Created</p>
                  )}
                </div>

                {/* Fact Finding */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">🔍 Fact Finding Reports</h5>
                  {ffDocs && ffDocs.filter((ff: any) => isCreatedThisWeek(ff.createdAt)).length > 0 ? (
                    <div className="space-y-2">
                      {ffDocs.filter((ff: any) => isCreatedThisWeek(ff.createdAt)).map((ff: any, idx: number) => {
                        const dt = ff.createdAt?.toDate ? ff.createdAt.toDate() : (ff.createdAt ? new Date(ff.createdAt) : null);
                        const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                        return (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 border rounded-xl p-3">
                            <span className="text-xs font-bold text-slate-700">{ff.companyName || ff.customerName || 'Unnamed Doc'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Created: {timeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-black text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">No Fact Finding Sessions Completed</p>
                  )}
                </div>

                {/* Ops Reports */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">⚠️ Ops Reports</h5>
                  {opsReps && opsReps.length > 0 ? (
                    <div className="space-y-2">
                      {opsReps.map((ops: any, idx: number) => {
                        const dt = ops.createdAt?.toDate ? ops.createdAt.toDate() : (ops.createdAt ? new Date(ops.createdAt) : null);
                        const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                        return (
                          <div key={idx} className="flex justify-between items-center bg-slate-50 border rounded-xl p-3">
                            <span className="text-xs font-bold text-slate-700">{ops.customerName || 'Ops Issue'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Status: {ops.status || 'SUBMITTED'} | {timeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submission Panel */}
          <Card className="border-slate-200 shadow-lg rounded-3xl overflow-hidden bg-slate-900 text-white">
            <CardHeader className="border-b border-slate-800 py-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" /> Publication Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</span>
                <Badge className={cn(
                  "border-none text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                  status === 'SUBMITTED' ? "bg-green-500/20 text-green-300 border-green-500/30" :
                  status === 'DRAFT' ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-slate-500/20 text-slate-300"
                )}>
                  {status === 'SUBMITTED' ? 'Submitted' : status === 'DRAFT' ? 'Draft' : 'Not Started'}
                </Badge>
              </div>

              <div className="space-y-2.5 pt-2">
                <Button 
                  onClick={() => handleSave('DRAFT')} 
                  disabled={isSaving || isSubmitting}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-sm border border-slate-700"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-slate-300" />}
                  Save Draft
                </Button>
                <Button 
                  onClick={() => handleSave('SUBMITTED')} 
                  disabled={isSaving || isSubmitting || !isFormComplete}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-lg shadow-accent/20 disabled:opacity-40"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {status === 'SUBMITTED' ? 'Update Submission' : 'Submit to Leadership'}
                </Button>

                {!isFormComplete && (
                  <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl space-y-1 mt-2">
                    <p className="text-[10px] font-black uppercase text-red-400 tracking-wider text-left">Required to Submit:</p>
                    <ul className="text-[9px] text-slate-300 space-y-0.5 list-disc pl-3 text-left">
                      {!wins.every(w => w.customer?.trim() && (w.value || 0) > 0 && w.businessUnits?.length > 0 && w.updateText?.trim() && w.salespersonName?.trim()) && <li>Complete all fields in added Key Wins rows</li>}
                      {!risks.every(r => r.account?.trim() && (r.value || 0) > 0 && r.mitigation?.trim() && r.salespersonName?.trim()) && <li>Complete all fields in added Churn Risks rows</li>}
                      {!majorUpdates.every(m => m.customer?.trim() && m.businessUnits?.length > 0 && m.updateText?.trim() && m.salespersonName?.trim()) && <li>Complete all fields in added Major Updates rows</li>}
                      {!projectedWins.every(p => p.account?.trim() && (p.value || 0) > 0 && p.updateText?.trim() && p.salespersonName?.trim()) && <li>Complete all fields in added Projected Wins rows</li>}
                      {!priorities.every(p => p.text?.trim() && p.salespersonName?.trim()) && <li>Complete all fields in added Priorities rows</li>}
                      {isRegisteredUser && (
                        <>
                          {(kpiReview.callsActual === undefined || isNaN(kpiReview.callsActual) || kpiReview.callsActual < 0 ||
                            kpiReview.appointmentsActual === undefined || isNaN(kpiReview.appointmentsActual) || kpiReview.appointmentsActual < 0 ||
                            kpiReview.proposalsActual === undefined || isNaN(kpiReview.proposalsActual) || kpiReview.proposalsActual < 0 ||
                            kpiReview.dealsActual === undefined || isNaN(kpiReview.dealsActual) || kpiReview.dealsActual < 0 ||
                            kpiReview.revenueActual === undefined || isNaN(kpiReview.revenueActual) || kpiReview.revenueActual < 0) && <li>Complete all KPI Actual values</li>}
                          {!kpiReview.kpiNotes?.trim() && <li>Enter notes explaining KPI performance</li>}
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
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
            You can still edit and update your information at any time. Simply make your changes and click "Update Submission".
          </div>
          <DialogFooter className="sm:justify-center">
            <Button 
              onClick={() => setSuccessDialogOpen(false)} 
              className="bg-primary text-white font-black h-12 px-8 uppercase tracking-widest rounded-xl"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    );
  }

  function renderCollationHub() {
    const collatedSubmissionsCount = mappedSubmissions?.length || 0;
    const teamUsers = allUsers?.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER' || u.role === 'GUEST') || [];

    const renderItem = (item: any, type: string, subId: string, content: React.ReactNode) => {
      if (item.isHidden && !showHiddenItems) return null;
      return (
        <div key={`${subId}-${type}-${item.id}`} className={cn(
          "relative group p-2 mb-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-all",
          item.isHidden && "opacity-50 border-dashed bg-slate-100/50"
        )}>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
            <Button size="icon" variant="secondary" className={cn("w-6 h-6 shadow-sm border bg-white", item.isStarred ? "border-amber-400 text-amber-500" : "border-slate-200 text-slate-400 hover:text-amber-500")} onClick={() => toggleItemState(subId, type as any, item.id, 'isStarred')}>
              <Star className={cn("w-3 h-3", item.isStarred && "fill-current")} />
            </Button>
            <Button size="icon" variant="secondary" className={cn("w-6 h-6 shadow-sm border bg-white hover:text-slate-600", item.isHidden ? "border-red-400 text-red-500" : "border-slate-200 text-slate-400")} onClick={() => toggleItemState(subId, type as any, item.id, 'isHidden')}>
              {item.isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </Button>
          </div>
          <div className={cn("pr-8", item.isHidden && "line-through text-slate-400")}>
            {content}
          </div>
        </div>
      );
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Team status overview */}
        <div className="space-y-6 col-span-1">
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800">
                Team Submission Status
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Active BDM &amp; AM submissions for Week {selectedWeek.split('-')[1]}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="divide-y divide-slate-100">
                {teamUsers.map(u => {
                  const sub = mappedSubmissions?.find(s => s.userId === u.id);
                  const subStatus = sub ? sub.status : 'NONE';
                  return (
                    <div key={u.id} className="flex justify-between items-center py-3">
                      <div>
                        <p className="text-xs font-black text-slate-800">{u.name}</p>
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5">{u.role?.replace('_', ' ')}</p>
                      </div>
                      <Badge className={cn(
                        "border-none text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                        subStatus === 'SUBMITTED' ? "bg-green-100 text-green-700" :
                        subStatus === 'DRAFT' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {subStatus === 'SUBMITTED' ? 'Submitted' : subStatus === 'DRAFT' ? 'Draft' : 'Pending'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 2 Columns: Collated Output */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-accent" /> Master TWTW Collation
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Aggregated team performance data for executive reporting
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
                  disabled={collatedSubmissionsCount === 0 || isExporting}
                  className="bg-accent hover:bg-accent/90 text-white font-black h-9 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-sm"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  Export to Landscape PDF
                </Button>
                <Button 
                  onClick={handleExportOversizedPdf}
                  disabled={collatedSubmissionsCount === 0 || isExporting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-9 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-sm"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Export PDF
                </Button>
                <Button 
                  onClick={handleExportCondensedPdf}
                  disabled={collatedSubmissionsCount === 0 || isExporting}
                  className="bg-primary hover:bg-primary/90 text-white font-black h-9 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-sm"
                >
                  {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Export to Condensed PDF
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
                      <h3 className="text-lg font-black uppercase text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                        {state} Region <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-500 font-black">{subs.length} Reps</Badge>
                      </h3>
                      
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="uppercase text-[9px] font-black tracking-widest text-slate-500">
                              <th className="p-3 w-[16%]">Key Wins</th>
                              <th className="p-3 w-[16%]">Churn Risk</th>
                              <th className="p-3 w-[16%]">Major Updates</th>
                              <th className="p-3 w-[16%]">30 Day Projected</th>
                              <th className="p-3 w-[16%]">Priorities</th>
                              <th className="p-3 w-[20%]">Governance Verification</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subs.map((sub, idx) => {
                              const subCP = allCallPlans?.filter((cp: any) => cp.userId === sub.userId) || [];
                              const subWS = allWhitespacePlans?.filter((ws: any) => ws.userId === sub.userId && isCreatedThisWeek(ws.createdAt)) || [];
                              const subOps = allOpsReports?.filter((ops: any) => ops.userId === sub.userId) || [];
                              const subFF = allFactFindings?.filter((ff: any) => ff.userId === sub.userId && isCreatedThisWeek(ff.createdAt)) || [];

                              return (
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
                                    <div className="mt-4 flex gap-2">
                                      <Button size="sm" variant="outline" className="w-full text-[10px] uppercase font-black" onClick={() => handleEditSubmission(sub)}><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                                      <Button size="sm" variant="destructive" className="w-full text-[10px] uppercase font-black" onClick={() => handleDeleteSubmission(sub.id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                                    </div>
                                  </td>
                                  <td className="p-3 text-slate-600 space-y-3 bg-slate-50/50">
                                    {/* Call Plans */}
                                    <div className="space-y-1">
                                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">📞 Call Plans</div>
                                      {subCP.length > 0 ? (
                                        subCP.map((cp: any, i: number) => {
                                          const dt = cp.createdAt?.toDate ? cp.createdAt.toDate() : (cp.createdAt ? new Date(cp.createdAt) : null);
                                          const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                                          return (
                                            <div key={i} className="text-[10px] text-slate-700 bg-white p-2 border rounded-xl flex flex-col gap-0.5 shadow-sm">
                                              <span className="font-bold truncate">{cp.accountName || cp.dealName}</span>
                                              <span className="text-[8px] text-slate-400">Created: {timeStr}</span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[10px] font-black text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 block">No Call Plans Created</span>
                                      )}
                                    </div>

                                    {/* Whitespace */}
                                    <div className="space-y-1">
                                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">🗺️ Whitespace</div>
                                      {subWS.length > 0 ? (
                                        subWS.map((ws: any, i: number) => {
                                          const dt = ws.createdAt?.toDate ? ws.createdAt.toDate() : (ws.createdAt ? new Date(ws.createdAt) : null);
                                          const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                                          return (
                                            <div key={i} className="text-[10px] text-slate-700 bg-white p-2 border rounded-xl flex flex-col gap-0.5 shadow-sm">
                                              <span className="font-bold truncate">{ws.accountName}</span>
                                              <span className="text-[8px] text-slate-400">Created: {timeStr}</span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[10px] font-black text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 block">No White Space Reports Created</span>
                                      )}
                                    </div>

                                    {/* Fact Finding */}
                                    <div className="space-y-1">
                                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">🔍 Fact Finding</div>
                                      {subFF.length > 0 ? (
                                        subFF.map((ff: any, i: number) => {
                                          const dt = ff.createdAt?.toDate ? ff.createdAt.toDate() : (ff.createdAt ? new Date(ff.createdAt) : null);
                                          const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                                          return (
                                            <div key={i} className="text-[10px] text-slate-700 bg-white p-2 border rounded-xl flex flex-col gap-0.5 shadow-sm">
                                              <span className="font-bold truncate">{ff.companyName || ff.customerName}</span>
                                              <span className="text-[8px] text-slate-400">Created: {timeStr}</span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[10px] font-black text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 block">No Fact Finding Sessions Completed</span>
                                      )}
                                    </div>

                                    {/* Ops Reports */}
                                    <div className="space-y-1">
                                      <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">⚠️ Ops Reports</div>
                                      {subOps.length > 0 ? (
                                        subOps.map((ops: any, i: number) => {
                                          const dt = ops.createdAt?.toDate ? ops.createdAt.toDate() : (ops.createdAt ? new Date(ops.createdAt) : null);
                                          const timeStr = dt ? dt.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
                                          return (
                                            <div key={i} className="text-[10px] text-slate-700 bg-white p-2 border rounded-xl flex flex-col gap-0.5 shadow-sm">
                                              <span className="font-bold truncate">{ops.customerName}</span>
                                              <span className="text-[8px] text-slate-400">Status: {ops.status || 'SUBMITTED'} | {timeStr}</span>
                                            </div>
                                          );
                                        })
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderKeyStandouts() {
    const getStarred = (arrayField: string) => {
      const items: any[] = [];
      mappedSubmissions?.forEach(sub => {
        const arr = sub[arrayField as keyof typeof sub] as any[];
        if (arr) {
          arr.filter(i => i.isStarred).forEach(i => items.push({ ...i, subId: sub.id, state: sub.state }));
        }
      });
      return items;
    };

    const starredWins = getStarred('wins');
    const starredRisks = getStarred('risks');
    const starredUpdates = getStarred('majorUpdates');
    const starredProjected = getStarred('projectedWins');
    const starredPriorities = getStarred('priorities');

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Wins Column */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">Key Wins <Badge>{starredWins.length}</Badge></h3>
            {starredWins.map(w => (
              <Card key={w.id} className="border-amber-200 bg-amber-50 shadow-sm relative group">
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleItemState(w.subId, 'wins', w.id, 'isStarred')}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-[8px] bg-white">{w.state}</Badge>
                  <div className="font-bold text-slate-800">{w.customer}</div>
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
            <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">Churn Risks <Badge>{starredRisks.length}</Badge></h3>
            {starredRisks.map(r => (
              <Card key={r.id} className="border-rose-200 bg-rose-50 shadow-sm relative group">
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleItemState(r.subId, 'risks', r.id, 'isStarred')}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-[8px] bg-white">{r.state}</Badge>
                  <div className="font-bold text-slate-800">{r.account}</div>
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
            <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">Major Updates <Badge>{starredUpdates.length}</Badge></h3>
            {starredUpdates.map(m => (
              <Card key={m.id} className="border-blue-200 bg-blue-50 shadow-sm relative group">
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleItemState(m.subId, 'majorUpdates', m.id, 'isStarred')}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-[8px] bg-white">{m.state}</Badge>
                  <div className="font-bold text-slate-800">{m.customer}</div>
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
            <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">30 Day Projected <Badge>{starredProjected.length}</Badge></h3>
            {starredProjected.map(p => (
              <Card key={p.id} className="border-purple-200 bg-purple-50 shadow-sm relative group">
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleItemState(p.subId, 'projectedWins', p.id, 'isStarred')}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-[8px] bg-white">{p.state}</Badge>
                  <div className="font-bold text-slate-800">{p.account}</div>
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
            <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-2 flex items-center justify-between">Priorities <Badge>{starredPriorities.length}</Badge></h3>
            {starredPriorities.map(p => (
              <Card key={p.id} className="border-indigo-200 bg-indigo-50 shadow-sm relative group">
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => toggleItemState(p.subId, 'priorities', p.id, 'isStarred')}>
                  <Trash2 className="w-3 h-3" />
                </Button>
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-[8px] bg-white">{p.state}</Badge>
                  <div className="font-bold text-slate-800 text-sm">{p.text}</div>
                  <div className="text-[10px] text-slate-500">{p.salespersonName || 'N/A'}</div>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      </div>
    );
  }
}
