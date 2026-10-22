"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getNextWeekKey, formatEAV, getPreviousWeekKey, normalizeBdmName, getWeekForDate, openSalesforceSearch, getNwaReviewWeek } from '@/lib/utils';
import { useTeamUsers } from '@/hooks/use-team-users';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Loader2, TrendingUp, DollarSign, Target, Phone, CalendarCheck, 
  Users, Briefcase, AlertTriangle, CheckCircle2, ArrowRight,
  FileText, Calendar, RefreshCw, Save, Send, ChevronRight,
  Award, Clock, Activity, PieChart, BarChart3, Plus, ListOrdered, Trash2, LifeBuoy, ClipboardCheck,
  Search, Building2, Eye, ShieldCheck, MessageSquare, MapPin, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useCRMSummary } from '@/hooks/use-crm-summary';

interface FridayPerformanceReviewProps {
  userId: string;
  userName: string;
  userRole: string;
  userState: string;
  selectedWeek: string;
}

export function FridayPerformanceReview({ 
  userId, 
  userName, 
  userRole, 
  userState,
  selectedWeek 
}: FridayPerformanceReviewProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { profile, isLeader, user } = useAuth();
  
  // Active Week state for reviewing past & current weeks
  const [activeWeek, setActiveWeek] = useState<string>(selectedWeek || getNwaReviewWeek());

  useEffect(() => {
    if (selectedWeek) setActiveWeek(selectedWeek);
  }, [selectedWeek]);

  const currentWeek = activeWeek;
  const nextWeek = getNextWeekKey(activeWeek);
  const previousWeekKey = getPreviousWeekKey(activeWeek);

  const availableWeeks = useMemo(() => {
    const curr = getCurrentWeek();
    const parts = curr.split('-');
    const year = parseInt(parts[0], 10) || 2026;
    const currNum = parseInt(parts[1], 10) || 36;
    const list: string[] = [];

    for (let i = 0; i < 20; i++) {
      let wNum = currNum - i;
      let wYear = year;
      if (wNum <= 0) {
        wNum = 52 + wNum;
        wYear = year - 1;
      }
      const padded = wNum.toString().padStart(2, '0');
      list.push(`${wYear}-${padded}`);
    }
    return list;
  }, []);
  
  // KPI Detail Modal Popup State
  const [kpiModalType, setKpiModalType] = useState<'CALLS' | 'APPOINTMENTS' | 'OPPORTUNITIES' | 'PIPELINE_VALUE' | 'CANVASS_LEADS' | 'SENT_TO_SF' | null>(null);

  // Loading & submission states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'NOT_STARTED' | 'REVIEWED_BY_ADMIN'>('NOT_STARTED');

  const isSuperAdminOrLeader = isLeader || profile?.role === 'LEADER' || profile?.role === 'GM';

  // Unified site-wide deduplicated team members hook
  const { teamUsers, isLoading: isUsersLoading } = useTeamUsers();

  // Selected Rep ID state for Super Admin switching
  const [selectedRepId, setSelectedRepId] = useState<string>(userId);

  useEffect(() => {
    if (userId) setSelectedRepId(userId);
  }, [userId]);

  const activeUserId = selectedRepId || userId;
  const activeUserObj = teamUsers.find(u => u.id === activeUserId);
  const activeUserName = normalizeBdmName(activeUserObj?.name || userName, activeUserId);
  const activeUserRole = activeUserObj?.role || userRole;
  const activeUserState = activeUserObj?.state || userState;

  // Super Admin Review & Coaching Notes
  const [adminCoachingNotes, setAdminCoachingNotes] = useState('');
  const [adminReviewedBy, setAdminReviewedBy] = useState('');
  const [adminReviewedAt, setAdminReviewedAt] = useState<any>(null);

  // ─── CRM Data (from existing hooks) ──────────────────────────────────────
  const { pipelineReviews: allDeals, weeklyProgresses: allActivity } = usePipelineData();
  const crmSummary = useCRMSummary(activeUserId, isLeader, allDeals || []);

  const callPlansQuery = useMemoFirebase(() => {
    if (!db || !activeUserId) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', activeUserId), where('week', '==', selectedWeek));
  }, [db, activeUserId, selectedWeek]);
  const { data: callPlans } = useCollection(callPlansQuery);

  const whitespaceReportsQuery = useMemoFirebase(() => {
    if (!db || !activeUserId) return null;
    return query(collection(db, 'whitespacePlans'), where('userId', '==', activeUserId), where('week', '==', selectedWeek));
  }, [db, activeUserId, selectedWeek]);
  const { data: whitespaceReports } = useCollection(whitespaceReportsQuery);

  const opsReportsQuery = useMemoFirebase(() => {
    if (!db || !activeUserId) return null;
    return query(collection(db, 'opsReports'), where('userId', '==', activeUserId), where('week', '==', selectedWeek));
  }, [db, activeUserId, selectedWeek]);
  const { data: opsReports } = useCollection(opsReportsQuery);

  const userCallPlans = callPlans?.filter(p => p.userId === activeUserId) || [];
  const userWhitespace = whitespaceReports?.filter(p => p.userId === activeUserId) || [];
  const userOps = opsReports?.filter(p => p.userId === activeUserId) || [];

  // ─── Canvassing Leads Query ─────────────────────────────────────────────
  const canvassLeadsQuery = useMemoFirebase(() => {
    if (!db || !activeUserId) return null;
    return query(collection(db, 'canvass_leads'), where('userId', '==', activeUserId));
  }, [db, activeUserId]);
  const { data: userCanvassLeads } = useCollection<any>(canvassLeadsQuery);

  const currentWeekCanvassLeads = useMemo(() => {
    if (!userCanvassLeads) return [];
    return userCanvassLeads.filter(lead => {
      if (lead.archived) return false;

      let leadDate: Date | null = null;
      if (lead.createdAt?.toDate) leadDate = lead.createdAt.toDate();
      else if (lead.createdAt) leadDate = new Date(lead.createdAt);
      else if (lead.formCompletedAt?.toDate) leadDate = lead.formCompletedAt.toDate();
      else if (lead.formCompletedAt) leadDate = new Date(lead.formCompletedAt);
      else if (lead.searchTimestamp?.toDate) leadDate = lead.searchTimestamp.toDate();
      else if (lead.searchTimestamp) leadDate = new Date(lead.searchTimestamp);

      if (!leadDate || isNaN(leadDate.getTime())) {
        return currentWeek === getCurrentWeek();
      }

      const leadWeek = getWeekForDate(leadDate);
      return leadWeek === currentWeek;
    });
  }, [userCanvassLeads, currentWeek]);

  const currentWeekSalesforceLeads = useMemo(() => {
    return currentWeekCanvassLeads.filter(lead => 
      lead.inSalesforce || !!lead.salesforceId || lead.leadStatus === 'SUBMITTED' || lead.leadStatus === 'COMPLETED'
    );
  }, [currentWeekCanvassLeads]);

  const currentWeekCanvassLeadsCount = currentWeekCanvassLeads.length;
  const currentWeekSalesforceLeadsCount = currentWeekSalesforceLeads.length;

  const userActivity = useMemo(() => {
    return allActivity?.filter(a => {
      if (a.week !== currentWeek) return false;
      if (a.userId === activeUserId) return true;
      if (a.userName && normalizeBdmName(a.userName, a.userId) === activeUserName) return true;
      return false;
    }) || [];
  }, [allActivity, currentWeek, activeUserId, activeUserName]);

  // ─── Previous Friday FW Viewer ───────────────────────────────────────────
  const previousFridayFwRef = useMemoFirebase(() => {
    if (!db || !activeUserId) return null;
    return doc(db, 'weeklyCommitments', `${activeUserId}_${previousWeekKey}`);
  }, [db, activeUserId, previousWeekKey]);
  const { data: previousFridayFw } = useDoc(previousFridayFwRef);
  const [showPreviousPlan, setShowPreviousPlan] = useState(false);
  
  // ─── User's Data for Current Week ─────────────────────────────────────────
  const [currentWeekData, setCurrentWeekData] = useState({
    // From CRM
    opportunities: [] as any[],
    accounts: [] as any[],
    activity: { calls: 0, apps: 0, proposals: 0, deals: 0 },
    revenue: { won: 0, pipeline: 0, ytd: 0 },
    
    // From Thursday TWTW
    wins: [] as any[],
    risks: [] as any[],
    updates: [] as any[],
    projectedWins: [] as any[],
    priorities: [] as any[],
    
    // User-entered
    narrative: '',
    roadblocks: '',
    supportNeeded: '',
    keyLearnings: '',
  });

  const appointmentList = useMemo(() => {
    function getFormattedDateTime(record: any): string {
      if (!record) return '';
      const dateVal = record.date || record.callDate || record.meetingDate || record.createdAt || record.formCompletedAt || record.completedDate || record.searchTimestamp || record.createdDate;
      const timeVal = record.time || record.appointmentTime || record.callTime || record.meetingTime;

      let dateStr = '';
      if (dateVal) {
        try {
          let d: Date | null = null;
          if (dateVal?.toDate) d = dateVal.toDate();
          else if (dateVal instanceof Date) d = dateVal;
          else if (typeof dateVal === 'string' || typeof dateVal === 'number') d = new Date(dateVal);

          if (d && !isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
          } else if (typeof dateVal === 'string') {
            dateStr = dateVal;
          }
        } catch (e) {}
      }

      let timeStr = '';
      if (timeVal) {
        timeStr = typeof timeVal === 'string' ? timeVal : '';
      } else if (dateVal?.toDate || dateVal instanceof Date) {
        try {
          const d = dateVal.toDate ? dateVal.toDate() : dateVal;
          if (d && !isNaN(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
            timeStr = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
          }
        } catch (e) {}
      }

      if (dateStr && timeStr) return `${dateStr} at ${timeStr}`;
      if (dateStr) return dateStr;
      if (timeStr) return `Time: ${timeStr}`;
      return '';
    }

    const list: Array<{
      id: string;
      title: string;
      dateTime?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      location?: string;
      notes?: string;
      businessUnit?: string;
      type: string;
      badgeColor: string;
      salesforceId?: string;
    }> = [];

    // 1. Call Plans (scheduled customer appointments)
    userCallPlans.forEach((plan: any, i: number) => {
      list.push({
        id: plan.id || `plan_${i}`,
        title: plan.customerName || plan.companyName || `Call Plan Visit #${i+1}`,
        dateTime: getFormattedDateTime(plan) || `Scheduled Visit (Week ${currentWeek.split('-')[1]})`,
        contactName: plan.contactName || plan.contactPerson,
        contactPhone: plan.phone,
        contactEmail: plan.email,
        location: plan.location || plan.suburb || plan.address,
        notes: plan.purpose || plan.notes || plan.objective,
        businessUnit: plan.businessUnit,
        type: 'Call Plan Visit',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-none',
        salesforceId: plan.salesforceId
      });
    });

    // 2. Canvassing Visits
    currentWeekCanvassLeads.forEach((lead: any, i: number) => {
      list.push({
        id: lead.id || `canvass_${i}`,
        title: lead.companyName,
        dateTime: getFormattedDateTime(lead) || `Field Visit (Week ${currentWeek.split('-')[1]})`,
        contactName: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
        contactPhone: lead.phone,
        contactEmail: lead.email,
        location: [lead.addressLine1, lead.suburb, lead.state || 'WA'].filter(Boolean).join(', '),
        notes: lead.notes || lead.leadTopic || lead.freightProfile,
        businessUnit: lead.businessUnit,
        type: 'Field Visit',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-none',
        salesforceId: lead.salesforceId
      });
    });

    // 3. CRM Activity Entries (where activity type is meeting/visit/app)
    userActivity.forEach((act: any, i: number) => {
      const appCount = (act.apps || 0) + (act.crmApps || 0) + (act.meetingsHeld || 0);
      if (appCount > 0) {
        list.push({
          id: act.id || `act_${i}`,
          title: act.account || act.companyName || act.subject || `CRM Meeting Logged (${appCount})`,
          dateTime: getFormattedDateTime(act) || `CRM Meeting (Week ${currentWeek.split('-')[1]})`,
          contactName: act.contactName || act.contact,
          location: act.location || act.suburb,
          notes: act.subject || act.notes || `${appCount} completed CRM meeting(s) logged`,
          businessUnit: act.businessUnit,
          type: 'CRM Meeting',
          badgeColor: 'bg-blue-100 text-blue-800 border-none',
          salesforceId: act.salesforceId
        });
      }
    });

    // 4. Whitespace Plans
    userWhitespace.forEach((ws: any, i: number) => {
      list.push({
        id: ws.id || `ws_${i}`,
        title: ws.accountName || ws.companyName || `Whitespace Account Plan #${i+1}`,
        dateTime: getFormattedDateTime(ws) || `Whitespace Plan (Week ${currentWeek.split('-')[1]})`,
        notes: ws.notes || ws.strategy || 'Account whitespace review meeting',
        type: 'Whitespace Review',
        badgeColor: 'bg-purple-100 text-purple-800 border-none',
        salesforceId: ws.salesforceId
      });
    });

    // 5. Fallback synthetic list matching opportunities or accounts if list.length < totalApps
    const totalAppsCount = currentWeekData.activity.apps;
    if (list.length < totalAppsCount) {
      const missing = totalAppsCount - list.length;
      for (let i = 0; i < missing; i++) {
        const opp = currentWeekData.opportunities[i % (currentWeekData.opportunities.length || 1)] ||
                    currentWeekData.accounts[i % (currentWeekData.accounts.length || 1)];
        list.push({
          id: `summary_app_${i}`,
          title: opp?.pipeline || opp?.opportunityName || opp?.companyName || `Client Meeting #${list.length + 1}`,
          dateTime: getFormattedDateTime(opp) || `Week ${currentWeek.split('-')[1]} Scheduled Meeting`,
          notes: opp?.stage ? `Meeting completed · Stage: ${opp.stage} · BU: ${opp.businessUnit || 'General'}` : 'Completed client appointment logged in CRM',
          businessUnit: opp?.businessUnit,
          type: 'Completed Appointment',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-none',
          salesforceId: opp?.salesforceId
        });
      }
    }

    return list;
  }, [userCallPlans, currentWeekCanvassLeads, userActivity, userWhitespace, currentWeekData, currentWeek]);

  const callsList = useMemo(() => {
    function getFormattedDateTime(record: any): string {
      if (!record) return '';
      const dateVal = record.date || record.callDate || record.meetingDate || record.createdAt || record.formCompletedAt || record.completedDate || record.searchTimestamp || record.createdDate;
      const timeVal = record.time || record.appointmentTime || record.callTime || record.meetingTime;

      let dateStr = '';
      if (dateVal) {
        try {
          let d: Date | null = null;
          if (dateVal?.toDate) d = dateVal.toDate();
          else if (dateVal instanceof Date) d = dateVal;
          else if (typeof dateVal === 'string' || typeof dateVal === 'number') d = new Date(dateVal);

          if (d && !isNaN(d.getTime())) {
            dateStr = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
          } else if (typeof dateVal === 'string') {
            dateStr = dateVal;
          }
        } catch (e) {}
      }

      let timeStr = '';
      if (timeVal) {
        timeStr = typeof timeVal === 'string' ? timeVal : '';
      } else if (dateVal?.toDate || dateVal instanceof Date) {
        try {
          const d = dateVal.toDate ? dateVal.toDate() : dateVal;
          if (d && !isNaN(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
            timeStr = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
          }
        } catch (e) {}
      }

      if (dateStr && timeStr) return `${dateStr} at ${timeStr}`;
      if (dateStr) return dateStr;
      if (timeStr) return `Time: ${timeStr}`;
      return '';
    }

    const list: Array<{
      id: string;
      title: string;
      dateTime?: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      location?: string;
      notes?: string;
      businessUnit?: string;
      type: string;
      badgeColor: string;
      salesforceId?: string;
    }> = [];

    // 1. Call Plans
    userCallPlans.forEach((plan: any, i: number) => {
      list.push({
        id: plan.id || `call_plan_${i}`,
        title: plan.customerName || plan.companyName || `Call Plan #${i+1}`,
        dateTime: getFormattedDateTime(plan) || `Scheduled Call (Week ${currentWeek.split('-')[1]})`,
        contactName: plan.contactName || plan.contactPerson,
        contactPhone: plan.phone,
        contactEmail: plan.email,
        location: plan.location || plan.suburb || plan.address,
        notes: plan.notes || plan.purpose || 'Scheduled phone outreach',
        businessUnit: plan.businessUnit,
        type: 'Call Plan',
        badgeColor: 'bg-blue-100 text-blue-800 border-none',
        salesforceId: plan.salesforceId
      });
    });

    // 2. CRM Activity
    userActivity.forEach((act: any, i: number) => {
      const callCount = (act.calls || 0) + (act.crmCalls || 0);
      if (callCount > 0) {
        list.push({
          id: act.id || `act_call_${i}`,
          title: act.account || act.companyName || act.subject || `CRM Phone Calls (${callCount})`,
          dateTime: getFormattedDateTime(act) || `CRM Phone Call (Week ${currentWeek.split('-')[1]})`,
          contactName: act.contactName || act.contact,
          notes: act.subject || act.notes || `${callCount} phone call interactions logged`,
          type: 'CRM Phone Calls',
          badgeColor: 'bg-indigo-100 text-indigo-800 border-none',
          salesforceId: act.salesforceId
        });
      }
    });

    // 3. Fallback to opportunities if totalCalls > list.length
    const totalCalls = currentWeekData.activity.calls;
    if (list.length < totalCalls) {
      const missing = totalCalls - list.length;
      for (let i = 0; i < missing; i++) {
        const opp = currentWeekData.opportunities[i % (currentWeekData.opportunities.length || 1)] ||
                    currentWeekData.accounts[i % (currentWeekData.accounts.length || 1)];
        list.push({
          id: `summary_call_${i}`,
          title: opp?.pipeline || opp?.opportunityName || opp?.companyName || `Phone Call #${list.length + 1}`,
          dateTime: getFormattedDateTime(opp) || `Week ${currentWeek.split('-')[1]} Phone Call`,
          notes: opp?.stage ? `Phone outreach call · Stage: ${opp.stage} · BU: ${opp.businessUnit || 'General'}` : 'Client phone call logged in CRM',
          businessUnit: opp?.businessUnit,
          type: 'Phone Call Logged',
          badgeColor: 'bg-blue-100 text-blue-800 border-none',
          salesforceId: opp?.salesforceId
        });
      }
    }

    return list;
  }, [userCallPlans, userActivity, currentWeekData, currentWeek]);
  
  // ─── CRM Account Selector State ──────────────────────────────────────────
  const [selectorAccountId, setSelectorAccountId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [crmSearch, setCrmSearch] = useState('');
  
  // ─── NWA (Next Weeks Activity) Planning Data ─────────────────────────────
  const emptyNwaPlan = (role: string): NwaPlan => ({
    focusAccounts: [],
    kpiTargets: defaultKpiTargets(role),
    actionPlan: [],
    roadblocks: '',
    supportNeeded: '',
    strategicFocus: '',
    wins: { customerWins: '', closedOpportunities: '', positiveFeedback: '', teamRecognition: '' },
    appointments: [],
    pipeline: { progressing: [], stalled: [], created: [], handedOver: [] },
    keyFocusMetrics: '',
    individualCommitment: '',
    topPriorities: ['', '', ''],
    challenges: { customerIssues: '', internalIssues: '', resourcesRequired: '' },
    commitments: [],
    commitmentReview: [],
  });
  const [nextWeekPlan, setNextWeekPlan] = useState<NwaPlan>(() => emptyNwaPlan(userRole));
  const [twtwActionList, setTwtwActionList] = useState<string[]>([]);

  // Call plans for the planned week (prefill Upcoming Appointments)
  const nextWeekCallPlansQuery = useMemoFirebase(() => {
    if (!db || !activeUserId) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', activeUserId), where('week', '==', nextWeek));
  }, [db, activeUserId, nextWeek]);
  const { data: nextWeekCallPlans } = useCollection(nextWeekCallPlansQuery);

  // Team-level Business Updates (one entry per week, editable by leaders)
  const businessUpdatesRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'appSettings', 'nwaBusinessUpdates');
  }, [db]);
  const { data: businessUpdatesDoc } = useDoc(businessUpdatesRef);
  const [businessUpdates, setBusinessUpdates] = useState({ pricingChanges: '', productUpdates: '', competitorActivity: '' });
  useEffect(() => {
    const wk = (businessUpdatesDoc as any)?.byWeek?.[nextWeek];
    setBusinessUpdates({
      pricingChanges: wk?.pricingChanges || '',
      productUpdates: wk?.productUpdates || '',
      competitorActivity: wk?.competitorActivity || '',
    });
  }, [businessUpdatesDoc, nextWeek]);
  const [isSavingUpdates, setIsSavingUpdates] = useState(false);
  const handleSaveBusinessUpdates = async () => {
    if (!db) return;
    setIsSavingUpdates(true);
    try {
      await setDoc(doc(db, 'appSettings', 'nwaBusinessUpdates'), {
        byWeek: { [nextWeek]: { ...businessUpdates, updatedBy: profile?.name || user?.email || 'Leader', updatedAt: serverTimestamp() } }
      }, { merge: true });
      toast({ title: 'Business Updates Saved', description: `Team updates for Week ${nextWeek.split('-')[1]} are now visible to all reps.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err?.message || 'Only managers can edit Business Updates.' });
    } finally {
      setIsSavingUpdates(false);
    }
  };

  // Prefill appointments from call plans when the NWA has none yet
  useEffect(() => {
    if (isLoading || !nextWeekCallPlans || nextWeekCallPlans.length === 0) return;
    setNextWeekPlan(prev => {
      if (prev.appointments.length > 0) return prev;
      return {
        ...prev,
        appointments: nextWeekCallPlans.map((plan: any) => ({
          id: crypto.randomUUID(),
          customer: plan.customerName || plan.companyName || '',
          date: typeof plan.date === 'string' ? plan.date : (plan.date?.toDate ? plan.date.toDate().toISOString().slice(0, 10) : ''),
          meetingType: 'Face to Face',
          purpose: plan.objective || plan.purpose || '',
          desiredOutcome: '',
          supportRequired: '',
        })),
      };
    });
  }, [isLoading, nextWeekCallPlans]);
  
  // ─── Load All Data ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAllData() {
      if (!db || !activeUserId) return;
      setIsLoading(true);
      
      try {
        // 1. Load Thursday TWTW submission
        const twtwDoc = await getDocs(
          query(collection(db, 'twiwSubmissions'), 
            where('userId', '==', activeUserId),
            where('week', '==', currentWeek)
          )
        );
        
        let twtwData: any = {};
        if (!twtwDoc.empty) {
          twtwData = twtwDoc.docs[0].data();
        }
        
        // 2. Load user's weeklyProgress for activity
        const progressDoc = await getDocs(
          query(collection(db, 'weeklyProgress'),
            where('userId', '==', activeUserId),
            where('week', '==', currentWeek)
          )
        );
        
        let progressData: any = {};
        if (!progressDoc.empty) {
          progressData = progressDoc.docs[0].data();
        }
        
        // 3. Load next week's commitments (if they exist)
        const nextWeekDoc = await getDocs(
          query(collection(db, 'weeklyCommitments'),
            where('userId', '==', activeUserId),
            where('week', '==', nextWeek)
          )
        );
        
        let nextWeekData: any = {};
        if (!nextWeekDoc.empty) {
          nextWeekData = nextWeekDoc.docs[0].data();
        }
        
        // 4. Filter CRM data for current week
        const userDeals = allDeals?.filter(d => {
          if (d.userId !== activeUserId && (!d.userName || normalizeBdmName(d.userName, d.userId) !== activeUserName)) return false;
          return !d.week || d.week === currentWeek;
        }) || [];

        const userActivity = allActivity?.filter(a => {
          if (a.week !== currentWeek) return false;
          if (a.userId === activeUserId) return true;
          if (a.userName && normalizeBdmName(a.userName, a.userId) === activeUserName) return true;
          return false;
        }) || [];
        
        // 5. Build the data objects with comprehensive appointment calculations
        const crmActCalls = userActivity.reduce((sum, a) => sum + (a.calls || 0) + (a.crmCalls || 0), 0);
        const crmActApps = userActivity.reduce((sum, a) => sum + (a.apps || 0) + (a.crmApps || 0) + (a.meetingsHeld || 0), 0);

        const totalCallsCount = Math.max(
          (progressData?.crmCalls || 0) + (progressData?.calls || 0),
          crmActCalls
        );

        const totalAppsCount = Math.max(
          (progressData?.crmApps || 0) + (progressData?.apps || 0) + (progressData?.meetingsHeld || 0),
          crmActApps,
          userCallPlans.length
        );

        setCurrentWeekData({
          // CRM Data
          opportunities: userDeals.filter(d => !d.isBareAccount),
          accounts: userDeals.filter(d => d.isBareAccount),
          activity: {
            calls: totalCallsCount,
            apps: totalAppsCount,
            proposals: progressData?.proposals || userActivity.reduce((sum, a) => sum + (a.proposals || 0), 0),
            deals: progressData?.deals || userActivity.reduce((sum, a) => sum + (a.deals || 0), 0),
          },
          revenue: {
            won: userDeals.filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (d.value || 0), 0),
            pipeline: userDeals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').reduce((sum, d) => sum + (d.value || 0), 0),
            ytd: crmSummary.myStats?.custYTDRevenueThisFY || 0,
          },
          
          // Thursday TWTW Data
          wins: twtwData.wins || [],
          risks: twtwData.risks || [],
          updates: twtwData.majorUpdates || [],
          projectedWins: twtwData.projectedWins || [],
          priorities: twtwData.priorities || [],
          
          // User-entered
          narrative: twtwData.updates || '',
          roadblocks: twtwData.roadblocks || '',
          supportNeeded: twtwData.supportNeeded || '',
          keyLearnings: twtwData.keyLearnings || '',
        });
        
        // 6. Load NWA planning data & admin notes (if exists).
        // TWTW "This Weeks Actions" (priorities) for the reviewed week prefill
        // Top 3 Priorities + Commitments, only when those fields are still empty.
        const twtwPriorities = twtwData.priorities || [];
        const twtwActions: string[] = twtwPriorities.map((p: any) => typeof p === 'string' ? p : p.text).filter((t: string) => t && t.trim());
        setTwtwActionList(twtwActions);

        if (nextWeekData && Object.keys(nextWeekData).length > 0) {
          setStatus(nextWeekData.status || 'NOT_STARTED');
          setAdminCoachingNotes(nextWeekData.adminCoachingNotes || '');
          setAdminReviewedBy(nextWeekData.adminReviewedBy || '');
          setAdminReviewedAt(nextWeekData.adminReviewedAt || null);
          setNextWeekPlan(mapStoredNwa(nextWeekData, activeUserRole, twtwActions));
        } else {
          setStatus('NOT_STARTED');
          setAdminCoachingNotes('');
          setAdminReviewedBy('');
          setAdminReviewedAt(null);
          setNextWeekPlan(mapStoredNwa({}, activeUserRole, twtwActions));
        }
        
      } catch (error) {
        console.error("Failed to load NWA data:", error);
        toast({ 
          variant: "destructive", 
          title: "Data Load Failed", 
          description: "Could not load performance data." 
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAllData();
  }, [db, activeUserId, currentWeek, nextWeek, allDeals, allActivity, crmSummary, activeUserRole]);
  
  // ─── Save & Approve Functions ───────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!db || !activeUserId) return;
    setIsSaving(true);
    
    try {
      await setDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${nextWeek}`), {
        userId: activeUserId,
        week: nextWeek,
        ...buildNwaPayload(nextWeekPlan),
        adminCoachingNotes,
        status: 'DRAFT',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({ title: "Draft Saved", description: "Next week's plan has been saved as a draft." });
      setStatus('DRAFT');
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!db || !activeUserId) return;
    setIsSubmitting(true);
    
    try {
      await setDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${nextWeek}`), {
        userId: activeUserId,
        week: nextWeek,
        ...buildNwaPayload(nextWeekPlan),
        adminCoachingNotes,
        status: 'SUBMITTED',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      await setDoc(doc(db, 'weeklyReports', `${activeUserId}_${currentWeek}`), {
        userId: activeUserId,
        userName: activeUserName,
        week: currentWeek,
        weeklyNotes: currentWeekData.narrative,
        keyLearnings: currentWeekData.keyLearnings,
        roadblocks: currentWeekData.roadblocks,
        supportNeeded: currentWeekData.supportNeeded,
        nwaSubmitted: true,
        summary: {
          totalEAV: currentWeekData.revenue.pipeline + currentWeekData.revenue.won,
          newOpportunitiesCount: currentWeekData.opportunities.length,
          signedPaperworkCount: currentWeekData.wins.length,
          newBusinessCount: currentWeekData.accounts.filter(a => a.stage === 'Closed Won').length,
          callsMade: currentWeekData.activity.calls,
          meetingsHeld: currentWeekData.activity.apps,
          crmCalls: currentWeekData.activity.calls,
          crmApps: currentWeekData.activity.apps,
          totalCanvassLeads: currentWeekCanvassLeadsCount,
          salesforceLeadsSubmitted: currentWeekSalesforceLeadsCount
        },
        status: 'REVIEWED',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      toast({ 
        title: "✅ NWA Submitted", 
        description: "Your Next Weeks Activity is submitted for the Monday meeting." 
      });
      setStatus('SUBMITTED');
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Submission Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminApprove = async () => {
    if (!db || !activeUserId) return;
    setIsSaving(true);
    try {
      const adminName = profile?.name || user?.email || 'Super Admin';
      await setDoc(doc(db, 'weeklyCommitments', `${activeUserId}_${nextWeek}`), {
        userId: activeUserId,
        week: nextWeek,
        ...buildNwaPayload(nextWeekPlan),
        adminCoachingNotes,
        adminReviewedBy: adminName,
        adminReviewedAt: serverTimestamp(),
        status: 'REVIEWED_BY_ADMIN',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, 'weeklyReports', `${activeUserId}_${currentWeek}`), {
        userId: activeUserId,
        userName: activeUserName,
        week: currentWeek,
        adminCoachingNotes,
        adminReviewedBy: adminName,
        adminReviewedAt: serverTimestamp(),
        status: 'REVIEWED_BY_ADMIN',
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast({
        title: "✅ Monday NWA Review Approved",
        description: `Review completed & approved for ${activeUserName}.`
      });
      setStatus('REVIEWED_BY_ADMIN');
      setAdminReviewedBy(adminName);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Approval Failed', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };
  
  // ─── CRM Account Selector Logic ──────────────────────────────────────────
  const crmAccounts = useMemo(() => {
    return allDeals?.filter((d: any) => d.userId === activeUserId) || [];
  }, [allDeals, activeUserId]);

  const filteredCrmAccounts = useMemo(() => {
    if (!crmSearch.trim()) return crmAccounts;
    const q = crmSearch.toLowerCase();
    return crmAccounts.filter((a: any) => 
      (a.pipeline || '').toLowerCase().includes(q) ||
      (a.stage || '').toLowerCase().includes(q) ||
      (a.businessUnit || '').toLowerCase().includes(q)
    );
  }, [crmAccounts, crmSearch]);

  const handleSelectCrmAccount = (crmAcc: any) => {
    if (!selectorAccountId) return;
    
    let matchedActionType = 'Prospect';
    const crmStage = (crmAcc.stage || '').trim().toLowerCase();
    if (crmStage.includes('develop')) matchedActionType = 'Develop';
    else if (crmStage.includes('propose')) matchedActionType = 'Propose';
    else if (crmStage.includes('negotiat')) matchedActionType = 'Negotiate';
    else if (crmStage.includes('finalis')) matchedActionType = 'Finalise';
    else if (crmStage.includes('pending')) matchedActionType = 'Pending Trade';
    else if (crmStage.includes('won')) matchedActionType = 'Closed - Won';
    
    const notesParts = [];
    if (crmAcc.businessUnit) notesParts.push(`BU: ${crmAcc.businessUnit}`);
    if (crmAcc.lastActivity) notesParts.push(`Last Activity: ${crmAcc.lastActivity}`);
    if (crmAcc.creditHold) notesParts.push(`CREDIT HOLD`);
    
    const aboutAccount = notesParts.join(' | ');

    const [listKey, rowId] = selectorAccountId.split('::');
    const name = crmAcc.pipeline || crmAcc.opportunityName || '';
    if (listKey === 'appointments') {
      updateAppointment(rowId, 'customer', name);
    } else {
      updatePipelineRow(listKey as PipelineKey, rowId, 'account', name);
      updatePipelineRow(listKey as PipelineKey, rowId, 'value', Number(crmAcc.value) || Number(crmAcc.currentRevenue) || 0);
      updatePipelineRow(listKey as PipelineKey, rowId, 'note', [matchedActionType, aboutAccount].filter(Boolean).join(' | '));
    }
    
    setIsSelectorOpen(false);
    setSelectorAccountId(null);
    setCrmSearch('');
  };

  // ─── Helper Functions ─────────────────────────────────────────────────────
  const addAppointment = () => setNextWeekPlan(prev => ({
    ...prev,
    appointments: [...prev.appointments, { id: crypto.randomUUID(), customer: '', date: '', meetingType: 'Face to Face', purpose: '', desiredOutcome: '', supportRequired: '' }]
  }));
  const removeAppointment = (id: string) => setNextWeekPlan(prev => ({ ...prev, appointments: prev.appointments.filter(a => a.id !== id) }));
  const updateAppointment = (id: string, field: keyof NwaAppointment, value: string) => setNextWeekPlan(prev => ({
    ...prev,
    appointments: prev.appointments.map(a => a.id === id ? { ...a, [field]: value } : a)
  }));

  const addPipelineRow = (key: PipelineKey) => setNextWeekPlan(prev => ({
    ...prev,
    pipeline: { ...prev.pipeline, [key]: [...prev.pipeline[key], { id: crypto.randomUUID(), account: '', value: 0, note: '' }] }
  }));
  const removePipelineRow = (key: PipelineKey, id: string) => setNextWeekPlan(prev => ({
    ...prev,
    pipeline: { ...prev.pipeline, [key]: prev.pipeline[key].filter(r => r.id !== id) }
  }));
  const updatePipelineRow = (key: PipelineKey, id: string, field: keyof NwaPipelineRow, value: any) => setNextWeekPlan(prev => ({
    ...prev,
    pipeline: { ...prev.pipeline, [key]: prev.pipeline[key].map(r => r.id === id ? { ...r, [field]: value } : r) }
  }));

  const updatePriority = (index: number, value: string) => setNextWeekPlan(prev => ({
    ...prev,
    topPriorities: prev.topPriorities.map((p, i) => i === index ? value : p)
  }));

  const addCommitment = (text = '') => setNextWeekPlan(prev => ({
    ...prev,
    commitments: [...prev.commitments, { id: crypto.randomUUID(), text, done: false }]
  }));
  const removeCommitment = (id: string) => setNextWeekPlan(prev => ({ ...prev, commitments: prev.commitments.filter(c => c.id !== id) }));
  const updateCommitment = (id: string, value: string) => setNextWeekPlan(prev => ({
    ...prev,
    commitments: prev.commitments.map(c => c.id === id ? { ...c, text: value } : c)
  }));

  // Commitments made at the last NWA (for the reviewed week), ticked done / not done
  const previousCommitments: NwaCommitment[] = useMemo(() => {
    if (!previousFridayFw) return [];
    return previousCommitmentsFrom(previousFridayFw);
  }, [previousFridayFw]);
  const getReviewDone = (c: NwaCommitment): boolean | null => {
    const r = nextWeekPlan.commitmentReview.find(x => x.id === c.id || x.text === c.text);
    return r ? r.done : null;
  };
  const setReviewDone = (c: NwaCommitment, done: boolean) => setNextWeekPlan(prev => {
    const others = prev.commitmentReview.filter(x => !(x.id === c.id || x.text === c.text));
    return { ...prev, commitmentReview: [...others, { id: c.id, text: c.text, done }] };
  });
  const prevTargets = (previousFridayFw as any)?.kpiTargets || null;

  // ─── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Loading your NWA data...
        </p>
      </div>
    );
  }
  
  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Super Admin / Leader Representative Selector */}
      {isSuperAdminOrLeader && (
        <Card className="border-2 border-indigo-500 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 text-slate-950 rounded-xl font-bold shadow-md shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  Super Admin Monday NWA Review Mode
                  {adminReviewedBy && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                      ✓ Reviewed
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Reviewing: <strong className="text-emerald-300 font-bold">{activeUserName}</strong> ({activeUserRole})
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-indigo-200">Rep:</span>
                <Select value={selectedRepId} onValueChange={(val) => setSelectedRepId(val)}>
                  <SelectTrigger className="w-[190px] bg-white text-slate-900 font-bold text-xs h-10">
                    <SelectValue placeholder="Select BDM / AM" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamUsers.map(u => (
                      <SelectItem key={u.id} value={u.id} className="font-bold text-xs">
                        {normalizeBdmName(u.name, u.id)} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-indigo-200">Week:</span>
                <Select value={activeWeek} onValueChange={(val) => setActiveWeek(val)}>
                  <SelectTrigger className="w-[160px] bg-white text-slate-900 font-bold text-xs h-10">
                    <SelectValue placeholder="Select Week" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableWeeks.map(w => {
                      const wNum = w.split('-')[1];
                      const isCurr = w === getCurrentWeek();
                      return (
                        <SelectItem key={w} value={w} className="font-bold text-xs">
                          Week {wNum} {isCurr ? '(Current)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Header */}
      <header className="flex flex-col lg:flex-row justify-between lg:items-center bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <TrendingUp className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <Badge className="bg-accent text-white font-black text-[9px] uppercase tracking-widest px-3 mb-2">
            Next Weeks Activity (NWA) · Monday Review
          </Badge>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
            NWA: Week {currentWeek.split('-')[1]} Review &amp; Week {nextWeek.split('-')[1]} Plan
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {activeUserName} · {activeUserRole} · {activeUserState} Region
          </p>
        </div>
        <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full lg:w-auto justify-end">
          <div className="text-right hidden sm:block mr-2">
            <p className="text-[10px] font-black text-accent uppercase tracking-widest">Revenue YTD</p>
            <p className="text-3xl font-black">{formatEAV(currentWeekData.revenue.ytd)}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSaveDraft} 
            disabled={isSaving || isSubmitting} 
            className="font-black h-16 px-6 rounded-2xl shadow-sm gap-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-xs w-full sm:w-auto"
          >
            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            Save Draft
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isSaving} 
            className="bg-accent hover:bg-accent/90 text-white font-black h-16 px-8 rounded-2xl shadow-xl gap-3 text-xs w-full sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
            Submit NWA
          </Button>
        </div>
      </header>

      {/* Commitments from the last NWA, ticked done / not done */}
      {previousFridayFw && (
        <Card className="border-accent/20 bg-accent/5 shadow-md">
          <CardHeader className="pb-3 border-b border-accent/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black uppercase text-accent tracking-tighter flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Last Meeting&apos;s Commitments
                </CardTitle>
                <CardDescription className="text-xs font-bold mt-1">
                  Committed at the last NWA for Week {currentWeek.split('-')[1]}. Tick whether each one was completed.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-[10px] font-black uppercase tracking-widest border-accent text-accent hover:bg-accent hover:text-white"
                onClick={() => setShowPreviousPlan(!showPreviousPlan)}
              >
                {showPreviousPlan ? (<>Hide Last NWA</>) : (<><Eye className="w-4 h-4 mr-2" /> View Last NWA</>)}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {previousCommitments.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">
                {previousCommitments.map((c) => {
                  const done = getReviewDone(c);
                  return (
                    <div key={c.id} className="p-3 text-sm flex items-center gap-3">
                      <span className="flex-1 font-medium text-slate-700">{c.text}</span>
                      <Button size="sm" variant={done === true ? 'default' : 'outline'} onClick={() => setReviewDone(c, true)}
                        className={cn("h-8 text-[10px] font-black uppercase", done === true && "bg-emerald-600 hover:bg-emerald-700")}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                      </Button>
                      <Button size="sm" variant={done === false ? 'default' : 'outline'} onClick={() => setReviewDone(c, false)}
                        className={cn("h-8 text-[10px] font-black uppercase", done === false && "bg-rose-600 hover:bg-rose-700")}>
                        Not Done
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-xs italic text-slate-400 bg-white rounded-xl border border-slate-100">No commitments recorded at the last meeting.</div>
            )}
            {showPreviousPlan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Top 3 Priorities (Last NWA)</h4>
                  <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">
                    {((previousFridayFw as any).topPriorities || (previousFridayFw as any).actionPlan || []).filter((a: string) => a && a.trim()).map((a: string, i: number) => (
                      <div key={i} className="p-3 text-sm flex gap-3"><Badge className="bg-slate-100 text-slate-700 border">{i + 1}</Badge><span className="text-slate-700">{a}</span></div>
                    ))}
                  </div>
                </div>
                {(previousFridayFw as any).strategicFocus && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Strategic Focus (legacy)</h4>
                    <p className="text-sm text-slate-700 bg-white p-4 rounded-xl border border-slate-100 italic whitespace-pre-wrap">{(previousFridayFw as any).strategicFocus}</p>
                  </div>
                )}
                {((previousFridayFw as any).focusAccounts || []).length > 0 && (
                  <div className="md:col-span-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Focus Accounts (legacy)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(previousFridayFw as any).focusAccounts.map((acc: any, i: number) => (
                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 text-xs">
                          <span className="font-black text-primary">{acc.accountName}</span> · {acc.actionType} · {formatEAV(acc.eav)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* ─── Section 1: Previous Week Performance (CRM Data) ───────────────── */}
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                1. Wins Since Last Meeting · Week {currentWeek.split('-')[1]}
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Wins first, then CRM performance and Thursday TWTW data
              </CardDescription>
            </div>
            <Badge className="bg-green-100 text-green-700 border-none font-bold text-[9px] uppercase">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {currentWeekData.wins.length} Wins
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Wins entered by the rep */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ['customerWins', 'Customer Wins', 'New customers, signed paperwork, volume won...'],
              ['closedOpportunities', 'Closed Opportunities', 'Opportunities closed since last meeting...'],
              ['positiveFeedback', 'Positive Feedback', 'Customer or internal feedback worth sharing...'],
              ['teamRecognition', 'Team Recognition', 'Who helped make it happen?'],
            ] as const).map(([key, label, ph]) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {label}</Label>
                <Textarea placeholder={ph} value={nextWeekPlan.wins[key]}
                  onChange={e => setNextWeekPlan(prev => ({ ...prev, wins: { ...prev.wins, [key]: e.target.value } }))}
                  className="min-h-[70px] text-xs font-medium rounded-xl" />
              </div>
            ))}
          </div>

          {/* KPI Cards (Clickable to view detailed breakdowns in popup) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Calls Card */}
            <div 
              onClick={() => setKpiModalType('CALLS')}
              className="bg-blue-50 hover:bg-blue-100/80 p-4 rounded-2xl border border-blue-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Calls</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekData.activity.calls}</p>
              <p className="text-[9px] font-semibold text-blue-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 2. Appointments Card */}
            <div 
              onClick={() => setKpiModalType('APPOINTMENTS')}
              className="bg-emerald-50 hover:bg-emerald-100/80 p-4 rounded-2xl border border-emerald-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Appointments</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekData.activity.apps}</p>
              <p className="text-[9px] font-semibold text-emerald-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 3. Opportunities Card */}
            <div 
              onClick={() => setKpiModalType('OPPORTUNITIES')}
              className="bg-purple-50 hover:bg-purple-100/80 p-4 rounded-2xl border border-purple-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest">Opportunities</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekData.opportunities.length}</p>
              <p className="text-[9px] font-semibold text-purple-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 4. Pipeline Value Card */}
            <div 
              onClick={() => setKpiModalType('PIPELINE_VALUE')}
              className="bg-amber-50 hover:bg-amber-100/80 p-4 rounded-2xl border border-amber-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pipeline Value</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-black text-slate-800">{formatEAV(currentWeekData.revenue.pipeline)}</p>
              <p className="text-[9px] font-semibold text-amber-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 5. Canvass Leads Card */}
            <div 
              onClick={() => setKpiModalType('CANVASS_LEADS')}
              className="bg-indigo-50 hover:bg-indigo-100/80 p-4 rounded-2xl border border-indigo-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Canvass Leads</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekCanvassLeadsCount}</p>
              <p className="text-[9px] font-semibold text-indigo-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 6. Sent to SF Card */}
            <div 
              onClick={() => setKpiModalType('SENT_TO_SF')}
              className="bg-teal-50 hover:bg-teal-100/80 p-4 rounded-2xl border border-teal-100 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Sent to SF</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-black text-slate-800">{currentWeekSalesforceLeadsCount}</p>
              <p className="text-[9px] font-semibold text-teal-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>
          </div>
          
          {/* CRM Opportunities Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" />
              Active Opportunities ({currentWeekData.opportunities.length})
            </h4>
            {currentWeekData.opportunities.length > 0 ? (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Stage</th>
                      <th className="px-4 py-2 text-right">Value</th>
                      <th className="px-4 py-2 text-right">Probability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentWeekData.opportunities.map((opp: any) => (
                      <tr key={opp.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-bold text-slate-700">{opp.pipeline}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-[8px] font-black uppercase">
                            {opp.stage || 'Discovery'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-black">{formatEAV(opp.value || 0)}</td>
                        <td className="px-4 py-2 text-right font-bold">{opp.probability || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No active opportunities found in CRM for this week.</p>
            )}
          </div>
          
          {/* Thursday TWTW Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500" />
                Thursday TWTW Wins ({currentWeekData.wins.length})
              </h4>
              {currentWeekData.wins.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.wins.map((w: any, i: number) => (
                    <div key={i} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <p className="font-bold text-slate-800">{w.customer}</p>
                      <p className="text-sm font-black text-emerald-600">{formatEAV(w.value)}</p>
                      {w.updateText && <p className="text-xs text-slate-600 mt-1">{w.updateText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No wins logged in Thursday TWTW.</p>
              )}
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Risks & Barriers
              </h4>
              {currentWeekData.risks.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.risks.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                      <p className="font-bold text-slate-800">{r.account}</p>
                      <p className="text-sm font-black text-rose-600">{formatEAV(r.value)}</p>
                      {r.mitigation && <p className="text-xs text-slate-600 mt-1">Mitigation: {r.mitigation}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No risks logged in Thursday TWTW.</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                30 Day Projected Wins ({currentWeekData.projectedWins.length})
              </h4>
              {currentWeekData.projectedWins.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.projectedWins.map((w: any, i: number) => (
                    <div key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="font-bold text-slate-800">{w.account}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm font-black text-blue-600">{formatEAV(w.value)}</p>
                        <Badge variant="outline" className="text-[9px] bg-white text-slate-600">{w.expectedDate}</Badge>
                      </div>
                      {w.updateText && <p className="text-xs text-slate-600 mt-2">{w.updateText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No projected wins logged.</p>
              )}
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                Major Pipeline & Customer Updates ({currentWeekData.updates.length})
              </h4>
              {currentWeekData.updates.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.updates.map((u: any, i: number) => (
                    <div key={i} className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                      <p className="font-bold text-slate-800">{u.customer}</p>
                      {u.value > 0 && <p className="text-sm font-black text-purple-600">{formatEAV(u.value)}</p>}
                      <p className="text-xs text-slate-700 mt-1">{u.updateText}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No major updates logged.</p>
              )}
            </div>
          </div>
          
          {/* Weekly Compliance Audit */}
          <div className="pt-4 border-t space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Weekly Compliance Audit
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Call Plans */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">📞 Call Plans</h5>
                {userCallPlans.length > 0 ? (
                  <div className="space-y-2">
                    {userCallPlans.map((plan: any) => (
                      <div key={plan.id} className="text-xs p-3 bg-white border rounded-xl shadow-sm">
                        <div className="font-bold text-slate-800">{plan.customerName || 'Unnamed'}</div>
                        <div className="text-slate-500 mt-1 flex justify-between">
                          <span>{plan.objective || 'No objective'}</span>
                          <span className="font-black text-emerald-600">{plan.status || 'Draft'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-black text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">No Call Plans Created</p>
                )}
              </div>

              {/* White Space */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">🗺️ White Space Reports</h5>
                {userWhitespace.length > 0 ? (
                  <div className="space-y-2">
                    {userWhitespace.map((ws: any) => (
                      <div key={ws.id} className="text-xs p-3 bg-white border rounded-xl shadow-sm">
                        <div className="font-bold text-slate-800">{ws.customerName || 'Unnamed'}</div>
                        <div className="text-slate-500 mt-1 flex justify-between">
                          <span>{ws.competitor || 'No competitor listed'}</span>
                          <span className="font-black text-emerald-600">{formatEAV(ws.estimatedValue || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-black text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">No White Space Reports Created</p>
                )}
              </div>

              {/* Ops Reports */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">⚠️ Ops Reports</h5>
                {userOps.length > 0 ? (
                  <div className="space-y-2">
                    {userOps.map((op: any) => (
                      <div key={op.id} className="text-xs p-3 bg-white border rounded-xl shadow-sm">
                        <div className="font-bold text-slate-800">{op.customerName || 'Unnamed'}</div>
                        <div className="text-slate-500 mt-1 flex justify-between">
                          <span className="truncate pr-2">{op.issueType || 'General'}</span>
                          <span className={cn("font-black", op.status === 'Resolved' ? 'text-emerald-600' : 'text-amber-600')}>{op.status || 'Open'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl p-3">No Ops Issues Logged</p>
                )}
              </div>
            </div>
          </div>
          
          {/* User Narrative */}
          {currentWeekData.narrative && (
            <div className="p-4 bg-slate-50 border rounded-xl">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">📝 Narrative Summary</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{currentWeekData.narrative}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-accent" />
            2. Upcoming Appointments · Week {nextWeek.split('-')[1]}
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Face to face meetings set for the week, why we are meeting, desired outcome and support
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-3">
            {nextWeekPlan.appointments.map((a) => (
              <div key={a.id} className="p-4 bg-slate-50 border rounded-xl space-y-3">
                <div className="flex gap-2 items-center">
                  <Input placeholder="Customer..." value={a.customer} onChange={e => updateAppointment(a.id, 'customer', e.target.value)} className="h-9 text-xs font-bold flex-1" />
                  <Button type="button" variant="outline" size="icon" title="Select from CRM" onClick={() => { setSelectorAccountId(`appointments::${a.id}`); setIsSelectorOpen(true); }} className="h-9 w-9 bg-white shrink-0 rounded-xl"><Search className="w-4 h-4" /></Button>
                  <Input type="date" value={a.date} onChange={e => updateAppointment(a.id, 'date', e.target.value)} className="h-9 text-xs w-[150px]" />
                  <select value={a.meetingType} onChange={e => updateAppointment(a.id, 'meetingType', e.target.value)} className="h-9 text-[10px] font-black uppercase rounded-lg border bg-white px-2">
                    {['Face to Face', 'Video', 'Phone', 'Site Visit'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => removeAppointment(a.id)} className="h-8 w-8 text-red-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Textarea placeholder="Why are we meeting?" value={a.purpose} onChange={e => updateAppointment(a.id, 'purpose', e.target.value)} className="min-h-[60px] text-xs" />
                  <Textarea placeholder="Desired outcome" value={a.desiredOutcome} onChange={e => updateAppointment(a.id, 'desiredOutcome', e.target.value)} className="min-h-[60px] text-xs" />
                  <Textarea placeholder="Support required" value={a.supportRequired} onChange={e => updateAppointment(a.id, 'supportRequired', e.target.value)} className="min-h-[60px] text-xs" />
                </div>
              </div>
            ))}
            {nextWeekPlan.appointments.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-4">No appointments yet. Call plans for Week {nextWeek.split('-')[1]} are added automatically.</p>
            )}
            <Button onClick={addAppointment} variant="outline" size="sm" className="text-[10px] font-black uppercase tracking-wider h-9 border-dashed border-slate-300 bg-white text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Appointment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-accent" />
            3. Pipeline / Opportunities Review
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Key deals progressing, stalled opportunities, new opportunities and accounts handed over
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {PIPELINE_SECTIONS.map(({ key, label, notePlaceholder }) => (
              <div key={key} className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-700">{label}</h4>
                {nextWeekPlan.pipeline[key].map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 border rounded-xl space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input placeholder="Account / opportunity..." value={r.account} onChange={e => updatePipelineRow(key, r.id, 'account', e.target.value)} className="h-9 text-xs font-bold flex-1" />
                      <Button type="button" variant="outline" size="icon" title="Select from CRM" onClick={() => { setSelectorAccountId(`${key}::${r.id}`); setIsSelectorOpen(true); }} className="h-9 w-9 bg-white shrink-0 rounded-xl"><Search className="w-4 h-4" /></Button>
                      <Input type="number" placeholder="EAV ($)" value={r.value || ''} onChange={e => updatePipelineRow(key, r.id, 'value', parseFloat(e.target.value) || 0)} className="h-9 text-xs w-[110px] bg-white" />
                      <Button variant="ghost" size="icon" onClick={() => removePipelineRow(key, r.id)} className="h-8 w-8 text-red-300 hover:text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <Input placeholder={notePlaceholder} value={r.note} onChange={e => updatePipelineRow(key, r.id, 'note', e.target.value)} className="h-9 text-xs bg-white" />
                  </div>
                ))}
                <Button onClick={() => addPipelineRow(key)} variant="outline" size="sm" className="text-[10px] font-black uppercase tracking-wider h-9 border-dashed border-slate-300 bg-white text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            4. Weekly Goals &amp; KPIs · Week {nextWeek.split('-')[1]}
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Targets for the week, with last week's actual vs target
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Calls Target</Label>
                <Input type="number" value={nextWeekPlan.kpiTargets.callsToMake}
                  onChange={e => setNextWeekPlan(prev => ({ ...prev, kpiTargets: { ...prev.kpiTargets, callsToMake: parseInt(e.target.value) || 0 } }))}
                  className="h-9 text-xs font-black" />
                <p className="text-[9px] font-bold text-slate-500">Last week: {currentWeekData.activity.calls}{prevTargets ? ` / ${prevTargets.callsToMake ?? 0} target` : ''}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Appts Target</Label>
                <Input type="number" value={nextWeekPlan.kpiTargets.appointmentsToSet}
                  onChange={e => setNextWeekPlan(prev => ({ ...prev, kpiTargets: { ...prev.kpiTargets, appointmentsToSet: parseInt(e.target.value) || 0 } }))}
                  className="h-9 text-xs font-black" />
                <p className="text-[9px] font-bold text-slate-500">Last week: {currentWeekData.activity.apps}{prevTargets ? ` / ${prevTargets.appointmentsToSet ?? 0} target` : ''}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Proposals Target</Label>
                <Input type="number" value={nextWeekPlan.kpiTargets.proposalsToSend}
                  onChange={e => setNextWeekPlan(prev => ({ ...prev, kpiTargets: { ...prev.kpiTargets, proposalsToSend: parseInt(e.target.value) || 0 } }))}
                  className="h-9 text-xs font-black" />
                <p className="text-[9px] font-bold text-slate-500">Last week: {currentWeekData.activity.proposals}{prevTargets ? ` / ${prevTargets.proposalsToSend ?? 0} target` : ''}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Deals Target</Label>
                <Input type="number" value={nextWeekPlan.kpiTargets.dealsToClose}
                  onChange={e => setNextWeekPlan(prev => ({ ...prev, kpiTargets: { ...prev.kpiTargets, dealsToClose: parseInt(e.target.value) || 0 } }))}
                  className="h-9 text-xs font-black" />
                <p className="text-[9px] font-bold text-slate-500">Last week: {currentWeekData.activity.deals}{prevTargets ? ` / ${prevTargets.dealsToClose ?? 0} target` : ''}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[8px] font-black uppercase text-slate-400">Revenue ($) Target</Label>
                <Input type="number" value={nextWeekPlan.kpiTargets.revenueTarget}
                  onChange={e => setNextWeekPlan(prev => ({ ...prev, kpiTargets: { ...prev.kpiTargets, revenueTarget: parseInt(e.target.value) || 0 } }))}
                  className="h-9 text-xs font-black" />
                <p className="text-[9px] font-bold text-slate-500">Last week: {currentWeekData.revenue.won ? formatEAV(currentWeekData.revenue.won) : formatEAV(0)}{prevTargets ? ` / ${formatEAV(prevTargets.revenueTarget || 0)} target` : ''}</p>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-indigo-600">Key Focus Metrics</Label>
              <Textarea placeholder="e.g. 3 new F2F meetings with B2B prospects, 2 proposals over $100k..." value={nextWeekPlan.keyFocusMetrics} onChange={e => setNextWeekPlan(prev => ({ ...prev, keyFocusMetrics: e.target.value }))} className="min-h-[70px] text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-indigo-600">Individual Commitment</Label>
              <Textarea placeholder="What I personally commit to this week..." value={nextWeekPlan.individualCommitment} onChange={e => setNextWeekPlan(prev => ({ ...prev, individualCommitment: e.target.value }))} className="min-h-[70px] text-xs rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-accent" />
            5. Top 3 Priorities
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Most important task, second and third priority
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            {nextWeekPlan.topPriorities.map((p, index) => (
              <div key={index} className="flex gap-3 items-center">
                <Badge className="bg-accent text-white font-black text-[10px] shrink-0 w-7 justify-center">{index + 1}</Badge>
                <Input placeholder={['Most important task', 'Second priority', 'Third priority'][index]} value={p} onChange={e => updatePriority(index, e.target.value)} className="h-9 text-xs font-bold" />
              </div>
            ))}
          </div>
          {twtwActionList.length > 0 && (
            <div className="p-4 bg-slate-50 border rounded-xl space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-500">This Weeks Actions from Thursday TWTW (Week {currentWeek.split('-')[1]})</p>
              {twtwActionList.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-slate-700">{a}</span>
                  <Button size="sm" variant="outline" className="h-7 text-[9px] font-black uppercase" onClick={() => addCommitment(a)}><Plus className="w-3 h-3 mr-1" /> Commitment</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent" />
            6. Challenges &amp; Roadblocks
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            What's slowing progress?
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              ['customerIssues', 'Customer Issues', 'Customer problems slowing progress...'],
              ['internalIssues', 'Internal Process Issues', 'What internal process is slowing you down?'],
              ['resourcesRequired', 'Resources / Support Required', 'What support do you need from leadership?'],
            ] as const).map(([key, label, ph]) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {label}</Label>
                <Textarea placeholder={ph} value={nextWeekPlan.challenges[key]} onChange={e => setNextWeekPlan(prev => ({ ...prev, challenges: { ...prev.challenges, [key]: e.target.value } }))} className="min-h-[90px] text-xs rounded-xl" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            7. Business Updates
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Team-level pricing, product and competitor updates (entered by managers)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              ['pricingChanges', 'Pricing Changes'],
              ['productUpdates', 'Product Updates'],
              ['competitorActivity', 'Competitor Activity'],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-blue-600">{label}</Label>
                {isSuperAdminOrLeader ? (
                  <Textarea value={businessUpdates[key]} onChange={e => setBusinessUpdates(prev => ({ ...prev, [key]: e.target.value }))} className="min-h-[80px] text-xs rounded-xl" />
                ) : (
                  <p className="min-h-[80px] text-xs text-slate-700 bg-slate-50 border rounded-xl p-3 whitespace-pre-wrap">{businessUpdates[key] || 'No update this week.'}</p>
                )}
              </div>
            ))}
          </div>
          {isSuperAdminOrLeader && (
            <div className="flex justify-end">
              <Button onClick={handleSaveBusinessUpdates} disabled={isSavingUpdates} size="sm" className="text-[10px] font-black uppercase gap-1.5">
                {isSavingUpdates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Team Updates
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-5">
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-accent" />
            8. Commitments Before Next Meeting
          </CardTitle>
          <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Reviewed with done / not done ticks at next Monday&apos;s NWA
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <div className="space-y-2">
            {nextWeekPlan.commitments.map((c) => (
              <div key={c.id} className="flex gap-3 items-center">
                <Checkbox checked={false} disabled className="shrink-0" />
                <Input placeholder="I will complete..." value={c.text} onChange={e => updateCommitment(c.id, e.target.value)} className="h-9 text-xs font-bold" />
                <Button variant="ghost" size="icon" onClick={() => removeCommitment(c.id)} className="h-8 w-8 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            {nextWeekPlan.commitments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">No commitments yet.</p>}
            <Button onClick={() => addCommitment()} variant="outline" size="sm" className="text-[10px] font-black uppercase tracking-wider h-9 border-dashed border-slate-300 bg-white text-slate-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Commitment
            </Button>
          </div>

          {/* Publication Status Panel (uniform with TWTW but full-width) */}
          <div className="mt-8 pt-6 border-t w-full">
            <Card className="border-slate-800 shadow-xl rounded-3xl overflow-hidden bg-slate-900 text-white w-full">
              <CardHeader className="border-b border-slate-800 py-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" /> Publication Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex justify-between items-center md:justify-start md:gap-6 bg-white/5 border border-white/10 rounded-2xl p-3 md:flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</span>
                  <Badge className={cn(
                    "border-none text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                    status === 'SUBMITTED' ? "bg-green-500/20 text-green-300 border-green-500/30" :
                    status === 'DRAFT' ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-slate-500/20 text-slate-300"
                  )}>
                    {status === 'SUBMITTED' ? 'Submitted' : status === 'DRAFT' ? 'Draft' : 'Not Started'}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 md:flex-1 justify-end">
                  <Button 
                    onClick={handleSaveDraft} 
                    disabled={isSaving || isSubmitting}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-sm border border-slate-700 w-full sm:w-auto px-6"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-slate-300" />}
                    Save Draft
                  </Button>

                  <Button 
                    onClick={handleSubmit} 
                    disabled={isSaving || isSubmitting}
                    className="bg-accent hover:bg-accent/90 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto px-8"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === 'SUBMITTED' ? 'Update Submission' : 'Submit NWA'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Super Admin 1-on-1 Review & Approval Panel */}
      {isSuperAdminOrLeader && (
        <Card className="border-2 border-indigo-500 shadow-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white overflow-hidden rounded-3xl mt-8">
          <CardHeader className="border-b border-indigo-800/60 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl shadow-md font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                    Monday NWA Review &amp; Sign-off
                  </CardTitle>
                  <CardDescription className="text-xs text-indigo-200">
                    Conducting Monday morning NWA review with <strong className="text-emerald-300 font-bold">{activeUserName}</strong> ({activeUserRole})
                  </CardDescription>
                </div>
              </div>

              {adminReviewedBy && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1 font-bold">
                  ✓ Reviewed by {adminReviewedBy}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                Super Admin Coaching Notes &amp; 1-on-1 Discussion Summary
              </Label>
              <Textarea
                placeholder="Enter 1-on-1 coaching feedback, agreed key actions, or performance notes discussed during the Monday NWA review..."
                value={adminCoachingNotes}
                onChange={e => setAdminCoachingNotes(e.target.value)}
                className="bg-slate-950/80 border-indigo-800 text-white placeholder:text-slate-500 min-h-[100px] text-xs font-medium focus-visible:ring-indigo-400"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-indigo-800/60">
              <div className="text-xs text-indigo-300 font-medium">
                {status === 'REVIEWED_BY_ADMIN' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> This NWA has been signed off and locked by Admin.
                  </span>
                ) : (
                  <span>Review status: <strong className="text-amber-400 uppercase">{status}</strong>. Click button to complete 1-on-1 sign-off.</span>
                )}
              </div>

              <Button
                onClick={handleAdminApprove}
                disabled={isSaving}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-black text-xs h-11 px-6 rounded-xl shadow-lg gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Approve &amp; Mark 1-on-1 Reviewed ✓</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CRM Account Selector Dialog popup */}
      <Dialog open={isSelectorOpen} onOpenChange={setIsSelectorOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden p-6 border border-slate-100 shadow-2xl bg-white">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-slate-800">
              <Building2 className="w-5 h-5 text-accent" /> Select CRM Account
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              Choose an active opportunity or customer from your CRM uploads to auto-populate fields.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar inside popup */}
          <div className="py-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search accounts by name, stage, or business unit..."
                value={crmSearch}
                onChange={e => setCrmSearch(e.target.value)}
                className="pl-10 h-10 text-xs font-medium bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-accent"
              />
            </div>
          </div>

          {/* List area inside popup */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px] max-h-[45vh] pr-1">
            {filteredCrmAccounts.length > 0 ? (
              filteredCrmAccounts.map((crmAcc: any) => {
                const isOpp = !crmAcc.isBareAccount;
                const value = crmAcc.value || crmAcc.currentRevenue || 0;
                return (
                  <div 
                    key={crmAcc.salesforceId || crmAcc.id}
                    onClick={() => handleSelectCrmAccount(crmAcc)}
                    className="p-4 border rounded-2xl hover:border-accent hover:bg-accent/5 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-800 group-hover:text-accent transition-colors">
                        {crmAcc.pipeline || crmAcc.opportunityName || 'Unnamed Account'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-slate-100 text-slate-600 font-bold border-none text-[8px] uppercase tracking-wide px-2 py-0.5 rounded-full">
                          {isOpp ? 'Opportunity' : 'Customer'}
                        </Badge>
                        {crmAcc.stage && (
                          <Badge className="bg-blue-50 text-blue-600 font-bold border-none text-[8px] uppercase tracking-wide px-2 py-0.5 rounded-full">
                            {crmAcc.stage}
                          </Badge>
                        )}
                        {crmAcc.businessUnit && (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            BU: {crmAcc.businessUnit}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{formatEAV(value)}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        {isOpp ? 'Expected Value' : 'YTD Revenue'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center">
                <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-xs text-slate-400 font-medium">No uploaded accounts found matching search.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── KPI Detail Breakdown Dialog Popup ────────────────────────────────── */}
      <Dialog open={!!kpiModalType} onOpenChange={(open) => { if (!open) setKpiModalType(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden p-6 border border-slate-100 shadow-2xl bg-white">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-2xl font-bold text-white shadow-md",
                kpiModalType === 'CALLS' ? "bg-blue-600" :
                kpiModalType === 'APPOINTMENTS' ? "bg-emerald-600" :
                kpiModalType === 'OPPORTUNITIES' ? "bg-purple-600" :
                kpiModalType === 'PIPELINE_VALUE' ? "bg-amber-600" :
                kpiModalType === 'CANVASS_LEADS' ? "bg-indigo-600" : "bg-teal-600"
              )}>
                {kpiModalType === 'CALLS' && <Phone className="w-5 h-5" />}
                {kpiModalType === 'APPOINTMENTS' && <CalendarCheck className="w-5 h-5" />}
                {kpiModalType === 'OPPORTUNITIES' && <Briefcase className="w-5 h-5" />}
                {kpiModalType === 'PIPELINE_VALUE' && <DollarSign className="w-5 h-5" />}
                {kpiModalType === 'CANVASS_LEADS' && <MapPin className="w-5 h-5" />}
                {kpiModalType === 'SENT_TO_SF' && <ExternalLink className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900">
                  {kpiModalType === 'CALLS' && `Phone Calls Breakdown · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'APPOINTMENTS' && `Appointments & Meetings Breakdown · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'OPPORTUNITIES' && `Active Opportunities · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'PIPELINE_VALUE' && `Pipeline Value Breakdown · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'CANVASS_LEADS' && `Canvassed Field Leads · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'SENT_TO_SF' && `Salesforce Submitted Leads · Week ${currentWeek.split('-')[1]}`}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  Representative: <strong className="text-slate-900 font-black">{activeUserName}</strong> · Week {currentWeek.split('-')[1]}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Content Details */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[300px] max-h-[55vh] pr-1">
            {/* CALLS DETAIL */}
            {kpiModalType === 'CALLS' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Total Calls Logged</span>
                    <p className="text-[10px] text-blue-700 font-medium">Phone calls and outreach logged for Week {currentWeek.split('-')[1]}</p>
                  </div>
                  <Badge className="bg-blue-600 text-white font-black text-sm px-3 py-1">{currentWeekData.activity.calls}</Badge>
                </div>
                <div className="border rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {callsList.length > 0 ? (
                    callsList.map((item, i) => (
                      <div key={item.id || i} className="p-4 bg-white hover:bg-slate-50 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                              {item.title}
                            </h4>
                            {item.dateTime && (
                              <p className="text-xs font-bold text-blue-700 mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                {item.dateTime}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-[10px] uppercase font-black px-2.5 py-1 ${item.badgeColor}`}>
                              {item.type}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-100"
                              onClick={() => openSalesforceSearch(item.title, item.salesforceId)}
                            >
                              Salesforce <ExternalLink className="w-3 h-3 text-slate-400" />
                            </Button>
                          </div>
                        </div>

                        {/* Details Metadata */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 font-medium pt-1 border-t border-slate-50">
                          {item.contactName && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <strong>Contact:</strong> {item.contactName}
                            </span>
                          )}
                          {item.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {item.contactPhone}
                            </span>
                          )}
                          {item.contactEmail && (
                            <span className="flex items-center gap-1 text-slate-500">
                              ✉ {item.contactEmail}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {item.location}
                            </span>
                          )}
                          {item.businessUnit && (
                            <span className="font-bold text-indigo-600 uppercase text-[10px]">
                              BU: {item.businessUnit}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">No detailed call logs found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* APPOINTMENTS DETAIL */}
            {kpiModalType === 'APPOINTMENTS' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Total Appointments &amp; Meetings</span>
                    <p className="text-[10px] text-emerald-700 font-medium">Client visits, meetings &amp; appointments for Week {currentWeek.split('-')[1]}</p>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-black text-sm px-3 py-1">{currentWeekData.activity.apps}</Badge>
                </div>
                <div className="border rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {appointmentList.length > 0 ? (
                    appointmentList.map((item, i) => (
                      <div key={item.id || i} className="p-4 bg-white hover:bg-slate-50 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                              {item.title}
                            </h4>
                            {item.dateTime && (
                              <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                {item.dateTime}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-[10px] uppercase font-black px-2.5 py-1 ${item.badgeColor}`}>
                              {item.type}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold gap-1 text-slate-700 border-slate-200 hover:bg-slate-100"
                              onClick={() => openSalesforceSearch(item.title, item.salesforceId)}
                            >
                              Salesforce <ExternalLink className="w-3 h-3 text-slate-400" />
                            </Button>
                          </div>
                        </div>

                        {/* Details Metadata */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600 font-medium pt-1 border-t border-slate-50">
                          {item.contactName && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <strong>Contact:</strong> {item.contactName}
                            </span>
                          )}
                          {item.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {item.contactPhone}
                            </span>
                          )}
                          {item.contactEmail && (
                            <span className="flex items-center gap-1 text-slate-500">
                              ✉ {item.contactEmail}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {item.location}
                            </span>
                          )}
                          {item.businessUnit && (
                            <span className="font-bold text-indigo-600 uppercase text-[10px]">
                              BU: {item.businessUnit}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">No appointment entries found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* OPPORTUNITIES DETAIL */}
            {kpiModalType === 'OPPORTUNITIES' && (
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">Active Opportunities Count</span>
                  <Badge className="bg-purple-600 text-white font-black text-sm px-3 py-1">{currentWeekData.opportunities.length}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekData.opportunities.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs font-black">Opportunity / Pipeline</TableHead>
                          <TableHead className="text-xs font-black">Stage</TableHead>
                          <TableHead className="text-xs font-black text-right">Expected EAV</TableHead>
                          <TableHead className="text-xs font-black text-center">Salesforce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekData.opportunities.map((opp: any) => (
                          <TableRow key={opp.id} className="hover:bg-slate-50">
                            <TableCell className="font-bold text-xs text-slate-900">{opp.pipeline || opp.opportunityName}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[9px] uppercase">{opp.stage || 'Discovery'}</Badge></TableCell>
                            <TableCell className="text-right font-black text-emerald-600">{formatEAV(opp.value || 0)}</TableCell>
                            <TableCell className="text-center">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-xs text-primary font-bold gap-1"
                                onClick={() => openSalesforceSearch(opp.pipeline, opp.salesforceId)}
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">No active opportunities found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* PIPELINE VALUE DETAIL */}
            {kpiModalType === 'PIPELINE_VALUE' && (
              <div className="space-y-4">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">Total Pipeline Value</span>
                  <Badge className="bg-amber-600 text-white font-black text-base px-4 py-1">{formatEAV(currentWeekData.revenue.pipeline)}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekData.opportunities.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs font-black">Deal / Account</TableHead>
                          <TableHead className="text-xs font-black">Stage</TableHead>
                          <TableHead className="text-xs font-black">Business Unit</TableHead>
                          <TableHead className="text-xs font-black text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekData.opportunities.map((opp: any) => (
                          <TableRow key={opp.id} className="hover:bg-slate-50">
                            <TableCell className="font-bold text-xs text-slate-900">{opp.pipeline}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[9px] uppercase">{opp.stage}</Badge></TableCell>
                            <TableCell className="text-xs font-semibold text-slate-500">{opp.businessUnit || 'General'}</TableCell>
                            <TableCell className="text-right font-black text-amber-700">{formatEAV(opp.value || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">No pipeline deals found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* CANVASS LEADS DETAIL */}
            {kpiModalType === 'CANVASS_LEADS' && (
              <div className="space-y-4">
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Canvassed Field Leads</span>
                  <Badge className="bg-indigo-600 text-white font-black text-sm px-3 py-1">{currentWeekCanvassLeadsCount}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekCanvassLeads.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs font-black">Company Name</TableHead>
                          <TableHead className="text-xs font-black">Contact Person</TableHead>
                          <TableHead className="text-xs font-black">Phone / Email</TableHead>
                          <TableHead className="text-xs font-black">Location</TableHead>
                          <TableHead className="text-xs font-black text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekCanvassLeads.map((lead: any) => (
                          <TableRow key={lead.id} className="hover:bg-slate-50">
                            <TableCell className="font-bold text-xs text-slate-900">{lead.companyName}</TableCell>
                            <TableCell className="text-xs font-medium">{lead.firstName ? `${lead.firstName} ${lead.lastName}` : lead.lastName}</TableCell>
                            <TableCell className="text-xs text-slate-500">{lead.phone} · {lead.email || 'No email'}</TableCell>
                            <TableCell className="text-xs text-slate-500">{lead.suburb || lead.addressLine1 || 'Perth Metro'}</TableCell>
                            <TableCell className="text-center">
                              {lead.inSalesforce ? (
                                <Badge className="bg-teal-100 text-teal-800 border-none text-[9px] uppercase font-bold">In Salesforce</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] uppercase font-bold">Captured</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">No canvassing leads logged for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* SENT TO SF DETAIL */}
            {kpiModalType === 'SENT_TO_SF' && (
              <div className="space-y-4">
                <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 uppercase tracking-wide">Leads Submitted to Salesforce</span>
                  <Badge className="bg-teal-600 text-white font-black text-sm px-3 py-1">{currentWeekSalesforceLeadsCount}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekSalesforceLeads.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs font-black">Company Name</TableHead>
                          <TableHead className="text-xs font-black">Contact Name</TableHead>
                          <TableHead className="text-xs font-black">Salesforce ID</TableHead>
                          <TableHead className="text-xs font-black text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekSalesforceLeads.map((lead: any) => (
                          <TableRow key={lead.id} className="hover:bg-slate-50">
                            <TableCell className="font-bold text-xs text-slate-900">{lead.companyName}</TableCell>
                            <TableCell className="text-xs font-medium">{lead.firstName ? `${lead.firstName} ${lead.lastName}` : lead.lastName}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-500">{lead.salesforceId || 'Submitted'}</TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-bold gap-1 border-teal-200 text-teal-700 hover:bg-teal-50"
                                onClick={() => openSalesforceSearch(lead.companyName, lead.salesforceId)}
                              >
                                View in SF <ExternalLink className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">No leads submitted to Salesforce for this week yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── NWA (Next Weeks Activity) data model ───────────────────────────────────
// Stored in weeklyCommitments/{uid}_{plannedWeek} (same collection as the old
// Friday FW). Legacy fields (actionPlan, roadblocks, supportNeeded,
// focusAccounts, strategicFocus) are still written/kept so older views load.

export type PipelineKey = 'progressing' | 'stalled' | 'created' | 'handedOver';
export interface NwaPipelineRow { id: string; account: string; value: number; note: string }
export interface NwaAppointment { id: string; customer: string; date: string; meetingType: string; purpose: string; desiredOutcome: string; supportRequired: string }
export interface NwaCommitment { id: string; text: string; done: boolean }
export interface NwaPlan {
  focusAccounts: { id: string; accountName: string; actionType: string; eav: number; aboutAccount: string }[];
  kpiTargets: { callsToMake: number; appointmentsToSet: number; proposalsToSend: number; dealsToClose: number; revenueTarget: number };
  actionPlan: string[];
  roadblocks: string;
  supportNeeded: string;
  strategicFocus: string;
  wins: { customerWins: string; closedOpportunities: string; positiveFeedback: string; teamRecognition: string };
  appointments: NwaAppointment[];
  pipeline: Record<PipelineKey, NwaPipelineRow[]>;
  keyFocusMetrics: string;
  individualCommitment: string;
  topPriorities: string[];
  challenges: { customerIssues: string; internalIssues: string; resourcesRequired: string };
  commitments: NwaCommitment[];
  commitmentReview: NwaCommitment[];
}

const PIPELINE_SECTIONS: { key: PipelineKey; label: string; notePlaceholder: string }[] = [
  { key: 'progressing', label: 'Key Deals Progressing This Week', notePlaceholder: 'Next step / stage...' },
  { key: 'stalled', label: 'Stalled Opportunities', notePlaceholder: 'Why has it stalled?' },
  { key: 'created', label: 'New Opportunities Created', notePlaceholder: 'Notes...' },
  { key: 'handedOver', label: 'Accounts Handed Over', notePlaceholder: 'Handed over to / notes...' },
];

export function defaultKpiTargets(role: string): NwaPlan['kpiTargets'] {
  return {
    callsToMake: role === 'BDM' ? 50 : 30,
    appointmentsToSet: role === 'BDM' ? 15 : 10,
    proposalsToSend: 8,
    dealsToClose: 3,
    revenueTarget: 250000,
  };
}

const str = (v: any) => (typeof v === 'string' ? v : '');
const rowsOf = (v: any): NwaPipelineRow[] => Array.isArray(v)
  ? v.map((r: any) => ({ id: r.id || crypto.randomUUID(), account: str(r.account), value: Number(r.value) || 0, note: str(r.note) }))
  : [];

/** Commitments a stored NWA (or legacy Friday FW) asked the rep to complete. */
export function previousCommitmentsFrom(d: any): NwaCommitment[] {
  if (Array.isArray(d?.commitments) && d.commitments.length > 0) {
    return d.commitments.filter((c: any) => str(c?.text).trim()).map((c: any, i: number) => ({ id: c.id || `c_${i}`, text: c.text, done: !!c.done }));
  }
  // Legacy Friday FW: the action plan acted as the commitments for the week.
  return (Array.isArray(d?.actionPlan) ? d.actionPlan : [])
    .filter((a: any) => str(a).trim())
    .map((a: string, i: number) => ({ id: `legacy_${i}`, text: a, done: false }));
}

/**
 * Map a stored weeklyCommitments doc (new NWA or legacy Friday FW) into the form.
 * twtwActions (Thursday TWTW "This Weeks Actions") prefill Top 3 Priorities and
 * Commitments only when those are empty.
 */
export function mapStoredNwa(d: any, role: string, twtwActions: string[]): NwaPlan {
  const legacyActions: string[] = (Array.isArray(d.actionPlan) ? d.actionPlan : []).filter((a: any) => str(a).trim());
  let topPriorities: string[] = Array.isArray(d.topPriorities) ? d.topPriorities.map(str) : [];
  if (topPriorities.every(p => !p.trim())) topPriorities = legacyActions.length > 0 ? legacyActions.slice(0, 3) : twtwActions.slice(0, 3);
  while (topPriorities.length < 3) topPriorities.push('');
  topPriorities = topPriorities.slice(0, 3);

  let commitments: NwaCommitment[] = Array.isArray(d.commitments)
    ? d.commitments.map((c: any) => ({ id: c.id || crypto.randomUUID(), text: str(c.text), done: !!c.done }))
    : [];
  if (commitments.length === 0) {
    const source = legacyActions.length > 3 ? legacyActions.slice(3) : (legacyActions.length === 0 ? twtwActions : []);
    commitments = source.map(t => ({ id: crypto.randomUUID(), text: t, done: false }));
  }

  const ch = d.challenges || {};
  return {
    focusAccounts: Array.isArray(d.focusAccounts) ? d.focusAccounts : [],
    kpiTargets: { ...defaultKpiTargets(role), ...(d.kpiTargets || {}) },
    actionPlan: legacyActions,
    roadblocks: str(d.roadblocks),
    supportNeeded: str(d.supportNeeded),
    strategicFocus: str(d.strategicFocus),
    wins: {
      customerWins: str(d.wins?.customerWins), closedOpportunities: str(d.wins?.closedOpportunities),
      positiveFeedback: str(d.wins?.positiveFeedback), teamRecognition: str(d.wins?.teamRecognition),
    },
    appointments: Array.isArray(d.appointments) ? d.appointments.map((a: any) => ({
      id: a.id || crypto.randomUUID(), customer: str(a.customer), date: str(a.date), meetingType: str(a.meetingType) || 'Face to Face',
      purpose: str(a.purpose), desiredOutcome: str(a.desiredOutcome), supportRequired: str(a.supportRequired),
    })) : [],
    pipeline: {
      progressing: rowsOf(d.pipeline?.progressing), stalled: rowsOf(d.pipeline?.stalled),
      created: rowsOf(d.pipeline?.created), handedOver: rowsOf(d.pipeline?.handedOver),
    },
    keyFocusMetrics: str(d.keyFocusMetrics),
    individualCommitment: str(d.individualCommitment),
    topPriorities,
    challenges: {
      customerIssues: str(ch.customerIssues),
      // Legacy "Anticipated Roadblocks" → Internal Process Issues; "Support Needed" → Resources Required
      internalIssues: ch.internalIssues !== undefined ? str(ch.internalIssues) : str(d.roadblocks),
      resourcesRequired: ch.resourcesRequired !== undefined ? str(ch.resourcesRequired) : str(d.supportNeeded),
    },
    commitments,
    commitmentReview: Array.isArray(d.commitmentReview) ? d.commitmentReview : [],
  };
}

/** Firestore payload: new NWA fields plus legacy mirrors for older views. */
export function buildNwaPayload(p: NwaPlan) {
  const roadblocks = [p.challenges.customerIssues && `Customer: ${p.challenges.customerIssues}`, p.challenges.internalIssues]
    .filter(Boolean).join('\n');
  return {
    formVersion: 'NWA_V1',
    kpiTargets: p.kpiTargets,
    wins: p.wins,
    appointments: p.appointments,
    pipeline: p.pipeline,
    keyFocusMetrics: p.keyFocusMetrics,
    individualCommitment: p.individualCommitment,
    topPriorities: p.topPriorities,
    challenges: p.challenges,
    commitments: p.commitments.filter(c => c.text.trim()),
    commitmentReview: p.commitmentReview,
    // Legacy mirrors (weekly archive, GM review, TWTW prefill)
    actionPlan: [...p.topPriorities, ...p.commitments.map(c => c.text)].filter(a => a && a.trim()),
    roadblocks,
    supportNeeded: p.challenges.resourcesRequired,
  };
}
