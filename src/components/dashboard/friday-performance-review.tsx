"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getNextWeekKey, formatEAV, getPreviousWeekKey, normalizeBdmName, getWeekForDate, openSalesforceSearch } from '@/lib/utils';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Loader2, TrendingUp, DollarSign, Target, Phone, CalendarCheck, 
  Users, Briefcase, AlertTriangle, CheckCircle2, ArrowRight,
  FileText, Calendar, RefreshCw, Save, Send, ChevronRight,
  Award, Clock, Activity, PieChart, BarChart3, Plus, Trash2, LifeBuoy, ClipboardCheck,
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
  const [activeWeek, setActiveWeek] = useState<string>(selectedWeek || getCurrentWeek());

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
        badgeColor: 'bg-success-soft text-success-ink border-none',
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
        badgeColor: 'bg-info-soft text-primary border-none',
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
          badgeColor: 'bg-info-soft text-primary border-none',
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
        badgeColor: 'bg-info-soft text-primary border-none',
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
          badgeColor: 'bg-success-soft text-success-ink border-none',
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
        badgeColor: 'bg-info-soft text-primary border-none',
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
          badgeColor: 'bg-info-soft text-primary border-none',
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
          badgeColor: 'bg-info-soft text-primary border-none',
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
  
  // ─── Next Week Planning Data ─────────────────────────────────────────────
  const [nextWeekPlan, setNextWeekPlan] = useState({
    focusAccounts: [] as { id: string; accountName: string; actionType: string; eav: number; aboutAccount: string }[],
    kpiTargets: {
      callsToMake: userRole === 'BDM' ? 50 : 30,
      appointmentsToSet: userRole === 'BDM' ? 15 : 10,
      proposalsToSend: 8,
      dealsToClose: 3,
      revenueTarget: 250000
    },
    actionPlan: ['', '', '', '', ''] as string[],
    roadblocks: '',
    supportNeeded: '',
    strategicFocus: '',
  });
  
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
        
        // 6. Load next week planning data & admin notes (if exists)
        const twtwPriorities = twtwData.priorities || [];
        const twtwActions = twtwPriorities.map((p: any) => typeof p === 'string' ? p : p.text).filter((t: string) => t && t.trim());

        if (nextWeekData && Object.keys(nextWeekData).length > 0) {
          setStatus(nextWeekData.status || 'NOT_STARTED');
          setAdminCoachingNotes(nextWeekData.adminCoachingNotes || '');
          setAdminReviewedBy(nextWeekData.adminReviewedBy || '');
          setAdminReviewedAt(nextWeekData.adminReviewedAt || null);
          
          let actionPlan = nextWeekData.actionPlan || [];
          if ((actionPlan.length === 0 || actionPlan.every((a: string) => !a.trim())) && twtwActions.length > 0) {
            actionPlan = twtwActions;
          }
          if (actionPlan.length === 0) {
            actionPlan = ['', '', '', '', ''];
          }

          setNextWeekPlan({
            focusAccounts: nextWeekData.focusAccounts || [],
            kpiTargets: nextWeekData.kpiTargets || {
              callsToMake: activeUserRole === 'BDM' ? 50 : 30,
              appointmentsToSet: activeUserRole === 'BDM' ? 15 : 10,
              proposalsToSend: 8,
              dealsToClose: 3,
              revenueTarget: 250000
            },
            actionPlan: actionPlan,
            roadblocks: nextWeekData.roadblocks || '',
            supportNeeded: nextWeekData.supportNeeded || '',
            strategicFocus: nextWeekData.strategicFocus || '',
          });
        } else {
          const initialActions = twtwActions.length > 0 ? twtwActions : ['', '', '', '', ''];
          setStatus('NOT_STARTED');
          setAdminCoachingNotes('');
          setAdminReviewedBy('');
          setAdminReviewedAt(null);

          setNextWeekPlan({
            focusAccounts: [],
            kpiTargets: {
              callsToMake: activeUserRole === 'BDM' ? 50 : 30,
              appointmentsToSet: activeUserRole === 'BDM' ? 15 : 10,
              proposalsToSend: 8,
              dealsToClose: 3,
              revenueTarget: 250000
            },
            actionPlan: initialActions,
            roadblocks: '',
            supportNeeded: '',
            strategicFocus: '',
          });
        }
        
      } catch (error) {
        console.error("Failed to load Friday data:", error);
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
        focusAccounts: nextWeekPlan.focusAccounts,
        kpiTargets: nextWeekPlan.kpiTargets,
        actionPlan: nextWeekPlan.actionPlan.filter(a => a.trim()),
        roadblocks: nextWeekPlan.roadblocks,
        supportNeeded: nextWeekPlan.supportNeeded,
        strategicFocus: nextWeekPlan.strategicFocus,
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
        focusAccounts: nextWeekPlan.focusAccounts,
        kpiTargets: nextWeekPlan.kpiTargets,
        actionPlan: nextWeekPlan.actionPlan.filter(a => a.trim()),
        roadblocks: nextWeekPlan.roadblocks,
        supportNeeded: nextWeekPlan.supportNeeded,
        strategicFocus: nextWeekPlan.strategicFocus,
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
        title: "✅ Friday Pack Submitted", 
        description: "Weekly review submitted and next week's plan is locked in." 
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
        focusAccounts: nextWeekPlan.focusAccounts,
        kpiTargets: nextWeekPlan.kpiTargets,
        actionPlan: nextWeekPlan.actionPlan.filter(a => a.trim()),
        roadblocks: nextWeekPlan.roadblocks,
        supportNeeded: nextWeekPlan.supportNeeded,
        strategicFocus: nextWeekPlan.strategicFocus,
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
        title: "✅ Friday 1-on-1 Approved",
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

    updateFocusAccount(selectorAccountId, 'accountName', crmAcc.pipeline || crmAcc.opportunityName || '');
    updateFocusAccount(selectorAccountId, 'eav', Number(crmAcc.value) || Number(crmAcc.currentRevenue) || 0);
    updateFocusAccount(selectorAccountId, 'actionType', matchedActionType);
    updateFocusAccount(selectorAccountId, 'aboutAccount', aboutAccount);
    
    setIsSelectorOpen(false);
    setSelectorAccountId(null);
    setCrmSearch('');
  };

  // ─── Helper Functions ─────────────────────────────────────────────────────
  const addFocusAccount = () => {
    setNextWeekPlan(prev => ({
      ...prev,
      focusAccounts: [...prev.focusAccounts, {
        id: crypto.randomUUID(),
        accountName: '',
        actionType: 'Prospect',
        eav: 0,
        aboutAccount: ''
      }]
    }));
  };
  
  const removeFocusAccount = (id: string) => {
    setNextWeekPlan(prev => ({
      ...prev,
      focusAccounts: prev.focusAccounts.filter(f => f.id !== id)
    }));
  };
  
  const updateFocusAccount = (id: string, field: string, value: any) => {
    setNextWeekPlan(prev => ({
      ...prev,
      focusAccounts: prev.focusAccounts.map(f => 
        f.id === id ? { ...f, [field]: value } : f
      )
    }));
  };
  
  const addAction = () => {
    setNextWeekPlan(prev => ({
      ...prev,
      actionPlan: [...prev.actionPlan, '']
    }));
  };
  
  const removeAction = (index: number) => {
    if (nextWeekPlan.actionPlan.length <= 1) return;
    setNextWeekPlan(prev => ({
      ...prev,
      actionPlan: prev.actionPlan.filter((_, i) => i !== index)
    }));
  };
  
  const updateAction = (index: number, value: string) => {
    setNextWeekPlan(prev => ({
      ...prev,
      actionPlan: prev.actionPlan.map((a, i) => i === index ? value : a)
    }));
  };
  
  // ─── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
        <p className="text-xs font-semibold text-muted-foreground">
          Loading your performance data...
        </p>
      </div>
    );
  }
  
  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Super Admin / Leader Representative Selector */}
      {isSuperAdminOrLeader && (
        <Card className="border-2 border-accent bg-gradient-to-r from-primary via-primary to-primary text-white shadow-xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-success-fill text-foreground rounded-xl font-bold shadow-md shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  Super Admin 1-on-1 Friday Review Mode
                  {adminReviewedBy && (
                    <Badge className="bg-success-fill/20 text-success border-success/40 text-xs">
                      ✓ Reviewed
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-info/70 mt-0.5">
                  Reviewing: <strong className="text-success font-bold">{activeUserName}</strong> ({activeUserRole})
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-info/70">Rep:</span>
                <Select value={selectedRepId} onValueChange={(val) => setSelectedRepId(val)}>
                  <SelectTrigger className="w-[190px] bg-card text-foreground font-bold text-xs h-10">
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
                <span className="text-xs font-bold text-info/70">Week:</span>
                <Select value={activeWeek} onValueChange={(val) => setActiveWeek(val)}>
                  <SelectTrigger className="w-[160px] bg-card text-foreground font-bold text-xs h-10">
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
      <header className="flex flex-col lg:flex-row justify-between lg:items-center bg-primary p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <TrendingUp className="w-64 h-64" />
        </div>
        <div className="relative z-10 space-y-2">
          <Badge className="bg-accent text-white font-semibold text-xs px-3 mb-2">
            Friday Performance Review
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tighter leading-none">
            Week {currentWeek.split('-')[1]} Review &amp; Week {nextWeek.split('-')[1]} Planning
          </h2>
          <p className="text-xs font-bold text-muted-foreground">
            {activeUserName} · {activeUserRole} · {activeUserState} Region
          </p>
        </div>
        <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full lg:w-auto justify-end">
          <div className="text-right hidden sm:block mr-2">
            <p className="text-xs font-semibold text-accent">Revenue YTD</p>
            <p className="text-3xl font-extrabold">{formatEAV(currentWeekData.revenue.ytd)}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSaveDraft} 
            disabled={isSaving || isSubmitting} 
            className="font-semibold h-16 px-6 rounded-2xl shadow-sm gap-2 border-primary/70 bg-primary text-primary-foreground/85 hover:bg-primary/90 hover:text-white text-xs w-full sm:w-auto"
          >
            {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            Save Draft
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isSaving} 
            className="bg-accent hover:bg-accent/90 text-white font-semibold h-16 px-8 rounded-2xl shadow-xl gap-3 text-xs w-full sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
            Submit Friday Pack
          </Button>
        </div>
      </header>

      {/* Previous Friday FW Viewer */}
      {previousFridayFw && (
        <Card className="border-accent/20 bg-accent/5 shadow-md">
          <CardHeader className="pb-3 border-b border-accent/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-accent tracking-tighter flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  This Week's Active Plan (Submitted Last Week)
                </CardTitle>
                <CardDescription className="text-xs font-bold mt-1">
                  Your submitted Friday FW for Week {previousWeekKey.split('-')[1]} which acts as your plan for this current week.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs font-semibold border-accent text-accent hover:bg-accent hover:text-white"
                onClick={() => setShowPreviousPlan(!showPreviousPlan)}
              >
                {showPreviousPlan ? (
                  <>Hide Plan</>
                ) : (
                  <><Eye className="w-4 h-4 mr-2" /> View Plan</>
                )}
              </Button>
            </div>
          </CardHeader>
          {showPreviousPlan && (
            <CardContent className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Strategic Focus & Narrative</h4>
                <p className="text-sm text-foreground/85 bg-card p-4 rounded-xl border border-border italic whitespace-pre-wrap">
                  {previousFridayFw.strategicFocus || previousFridayFw.weeklyNotes || 'No narrative provided.'}
                </p>
              </div>
              
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Key Actions Planned</h4>
                <div className="bg-card rounded-xl border border-border divide-y divide-border">
                  {previousFridayFw.actionPlan && previousFridayFw.actionPlan.length > 0 ? (
                    previousFridayFw.actionPlan.map((action: string, i: number) => (
                      <div key={i} className="p-3 text-sm flex gap-3">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <span className="font-medium text-foreground/85">{action}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-xs italic text-muted-foreground">No actions planned.</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Focus Accounts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previousFridayFw.focusAccounts && previousFridayFw.focusAccounts.length > 0 ? (
                    previousFridayFw.focusAccounts.map((acc: any, i: number) => (
                      <div key={i} className="bg-card p-3 rounded-xl border border-border shadow-sm flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-sm text-primary">{acc.accountName}</span>
                          <Badge variant="outline" className="text-xs">{acc.actionType}</Badge>
                        </div>
                        <span className="text-xs font-bold text-accent">{formatEAV(acc.eav)}</span>
                        {acc.aboutAccount && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{acc.aboutAccount}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full p-4 text-xs italic text-muted-foreground bg-card rounded-xl border border-border">No focus accounts planned.</div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
      
      {/* ─── Section 1: Previous Week Performance (CRM Data) ───────────────── */}
      <Card className="border-none shadow-xl bg-card overflow-hidden">
        <CardHeader className="bg-secondary/60 border-b py-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent" />
                Week {currentWeek.split('-')[1]} Performance Summary
              </CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground mt-0.5">
                Combined CRM data and Thursday TWTW submission
              </CardDescription>
            </div>
            <Badge className="bg-success-soft text-success-ink border-none font-bold text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {currentWeekData.wins.length} Wins
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* KPI Cards (Clickable to view detailed breakdowns in popup) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Calls Card */}
            <div 
              onClick={() => setKpiModalType('CALLS')}
              className="bg-info-soft hover:bg-info-soft/80 p-4 rounded-2xl border border-info/20 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-accent">Calls</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{currentWeekData.activity.calls}</p>
              <p className="text-xs font-semibold text-accent/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 2. Appointments Card */}
            <div 
              onClick={() => setKpiModalType('APPOINTMENTS')}
              className="bg-success-soft hover:bg-success-soft/80 p-4 rounded-2xl border border-success/20 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-success-ink group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-success-ink">Appointments</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-success opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{currentWeekData.activity.apps}</p>
              <p className="text-xs font-semibold text-success-ink/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 3. Opportunities Card */}
            <div 
              onClick={() => setKpiModalType('OPPORTUNITIES')}
              className="bg-info-soft hover:bg-info-soft/80 p-4 rounded-2xl border border-info/20 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-accent">Opportunities</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{currentWeekData.opportunities.length}</p>
              <p className="text-xs font-semibold text-accent/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 4. Pipeline Value Card */}
            <div 
              onClick={() => setKpiModalType('PIPELINE_VALUE')}
              className="bg-warning-soft hover:bg-warning-soft/80 p-4 rounded-2xl border border-warning/20 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-warning-ink group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-warning-ink">Pipeline Value</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-warning opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{formatEAV(currentWeekData.revenue.pipeline)}</p>
              <p className="text-xs font-semibold text-warning-ink/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 5. Canvass Leads Card */}
            <div 
              onClick={() => setKpiModalType('CANVASS_LEADS')}
              className="bg-info-soft hover:bg-info-soft/80 p-4 rounded-2xl border border-info/20 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
                  <p className="text-xs font-semibold text-accent">Canvass Leads</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{currentWeekCanvassLeadsCount}</p>
              <p className="text-xs font-semibold text-accent/70 mt-1 flex items-center gap-1">
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
                  <p className="text-xs font-semibold text-teal-600">Sent to SF</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">{currentWeekSalesforceLeadsCount}</p>
              <p className="text-xs font-semibold text-teal-600/70 mt-1 flex items-center gap-1">
                View Details <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>
          </div>
          
          {/* CRM Opportunities Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground/85 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" />
              Active Opportunities ({currentWeekData.opportunities.length})
            </h4>
            {currentWeekData.opportunities.length > 0 ? (
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 border-b">
                    <tr className="text-xs font-semibold text-muted-foreground">
                      <th className="px-4 py-2 text-left">Account</th>
                      <th className="px-4 py-2 text-left">Stage</th>
                      <th className="px-4 py-2 text-right">Value</th>
                      <th className="px-4 py-2 text-right">Probability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentWeekData.opportunities.map((opp: any) => (
                      <tr key={opp.id} className="hover:bg-secondary/60">
                        <td className="px-4 py-2 font-bold text-foreground/85">{opp.pipeline}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-xs font-semibold">
                            {opp.stage || 'Discovery'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-bold">{formatEAV(opp.value || 0)}</td>
                        <td className="px-4 py-2 text-right font-bold">{opp.probability || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No active opportunities found in CRM for this week.</p>
            )}
          </div>
          
          {/* Thursday TWTW Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground/85 flex items-center gap-2">
                <Award className="w-4 h-4 text-success" />
                Thursday TWTW Wins ({currentWeekData.wins.length})
              </h4>
              {currentWeekData.wins.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.wins.map((w: any, i: number) => (
                    <div key={i} className="p-3 bg-success-soft border border-success/20 rounded-xl">
                      <p className="font-bold text-foreground">{w.customer}</p>
                      <p className="text-sm font-semibold text-success-ink">{formatEAV(w.value)}</p>
                      {w.updateText && <p className="text-xs text-foreground/75 mt-1">{w.updateText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No wins logged in Thursday TWTW.</p>
              )}
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground/85 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Risks & Barriers
              </h4>
              {currentWeekData.risks.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.risks.map((r: any, i: number) => (
                    <div key={i} className="p-3 bg-danger-soft border border-destructive/20 rounded-xl">
                      <p className="font-bold text-foreground">{r.account}</p>
                      <p className="text-sm font-semibold text-destructive">{formatEAV(r.value)}</p>
                      {r.mitigation && <p className="text-xs text-foreground/75 mt-1">Mitigation: {r.mitigation}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No risks logged in Thursday TWTW.</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground/85 flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                30 Day Projected Wins ({currentWeekData.projectedWins.length})
              </h4>
              {currentWeekData.projectedWins.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.projectedWins.map((w: any, i: number) => (
                    <div key={i} className="p-3 bg-info-soft border border-info/20 rounded-xl">
                      <p className="font-bold text-foreground">{w.account}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm font-semibold text-accent">{formatEAV(w.value)}</p>
                        <Badge variant="outline" className="text-xs bg-card text-foreground/75">{w.expectedDate}</Badge>
                      </div>
                      {w.updateText && <p className="text-xs text-foreground/75 mt-2">{w.updateText}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No projected wins logged.</p>
              )}
            </div>
            
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground/85 flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                Major Pipeline & Customer Updates ({currentWeekData.updates.length})
              </h4>
              {currentWeekData.updates.length > 0 ? (
                <div className="space-y-2">
                  {currentWeekData.updates.map((u: any, i: number) => (
                    <div key={i} className="p-3 bg-info-soft border border-info/20 rounded-xl">
                      <p className="font-bold text-foreground">{u.customer}</p>
                      {u.value > 0 && <p className="text-sm font-semibold text-accent">{formatEAV(u.value)}</p>}
                      <p className="text-xs text-foreground/85 mt-1">{u.updateText}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No major updates logged.</p>
              )}
            </div>
          </div>
          
          {/* Weekly Compliance Audit */}
          <div className="pt-4 border-t space-y-4">
            <h4 className="text-xs font-semibold text-foreground/85 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" />
              Weekly Compliance Audit
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Call Plans */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground">📞 Call Plans</h5>
                {userCallPlans.length > 0 ? (
                  <div className="space-y-2">
                    {userCallPlans.map((plan: any) => (
                      <div key={plan.id} className="text-xs p-3 bg-card border rounded-xl shadow-sm">
                        <div className="font-bold text-foreground">{plan.customerName || 'Unnamed'}</div>
                        <div className="text-muted-foreground mt-1 flex justify-between">
                          <span>{plan.objective || 'No objective'}</span>
                          <span className="font-bold text-success-ink">{plan.status || 'Draft'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-destructive bg-danger-soft border border-destructive/20 rounded-xl p-3">No Call Plans Created</p>
                )}
              </div>

              {/* White Space */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground">🗺️ White Space Reports</h5>
                {userWhitespace.length > 0 ? (
                  <div className="space-y-2">
                    {userWhitespace.map((ws: any) => (
                      <div key={ws.id} className="text-xs p-3 bg-card border rounded-xl shadow-sm">
                        <div className="font-bold text-foreground">{ws.customerName || 'Unnamed'}</div>
                        <div className="text-muted-foreground mt-1 flex justify-between">
                          <span>{ws.competitor || 'No competitor listed'}</span>
                          <span className="font-bold text-success-ink">{formatEAV(ws.estimatedValue || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-destructive bg-danger-soft border border-destructive/20 rounded-xl p-3">No White Space Reports Created</p>
                )}
              </div>

              {/* Ops Reports */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground">⚠️ Ops Reports</h5>
                {userOps.length > 0 ? (
                  <div className="space-y-2">
                    {userOps.map((op: any) => (
                      <div key={op.id} className="text-xs p-3 bg-card border rounded-xl shadow-sm">
                        <div className="font-bold text-foreground">{op.customerName || 'Unnamed'}</div>
                        <div className="text-muted-foreground mt-1 flex justify-between">
                          <span className="truncate pr-2">{op.issueType || 'General'}</span>
                          <span className={cn("font-bold", op.status === 'Resolved' ? 'text-success-ink' : 'text-warning-ink')}>{op.status || 'Open'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-success-ink bg-success-soft border border-success/20 rounded-xl p-3">No Ops Issues Logged</p>
                )}
              </div>
            </div>
          </div>
          
          {/* User Narrative */}
          {currentWeekData.narrative && (
            <div className="p-4 bg-secondary/60 border rounded-xl">
              <p className="text-xs font-semibold text-muted-foreground mb-2">📝 Narrative Summary</p>
              <p className="text-sm text-foreground/85 whitespace-pre-wrap">{currentWeekData.narrative}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ─── Section 2: Next Week Planning ─────────────────────────────────── */}
      <Card className="border-none shadow-xl bg-card overflow-hidden">
        <CardHeader className="bg-secondary/60 border-b py-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                Week {nextWeek.split('-')[1]} Planning
              </CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground mt-0.5">
                Set your KPI targets, focus accounts, and actions for the coming week
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {/* KPI Targets */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-foreground/85">KPI Targets</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Calls Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.callsToMake} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, callsToMake: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Appts Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.appointmentsToSet} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, appointmentsToSet: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Proposals Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.proposalsToSend} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, proposalsToSend: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Deals Target</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.dealsToClose} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, dealsToClose: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-semibold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Revenue ($)</Label>
                <Input 
                  type="number" 
                  value={nextWeekPlan.kpiTargets.revenueTarget} 
                  onChange={e => setNextWeekPlan(prev => ({
                    ...prev,
                    kpiTargets: { ...prev.kpiTargets, revenueTarget: parseInt(e.target.value) || 0 }
                  }))}
                  className="h-9 text-xs font-semibold"
                />
              </div>
            </div>
          </div>
          
          {/* Focus Accounts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground/85">Focus Accounts</h4>
            </div>
            <div className="space-y-3">
              {nextWeekPlan.focusAccounts.map((acc) => (
                <div key={acc.id} className="p-4 bg-secondary/60 border rounded-xl space-y-3 relative group">
                  <div className="flex justify-between items-center gap-2">
                    <Input 
                      placeholder="Account Name..." 
                      value={acc.accountName} 
                      onChange={e => updateFocusAccount(acc.id, 'accountName', e.target.value)}
                      className="h-9 text-xs font-bold flex-1"
                    />
                    <Button 
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectorAccountId(acc.id);
                        setIsSelectorOpen(true);
                      }}
                      className="h-9 w-9 bg-card border-border text-muted-foreground hover:text-accent hover:border-accent shrink-0 rounded-xl"
                      title="Select from CRM Upload"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeFocusAccount(acc.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      value={acc.actionType} 
                      onChange={e => updateFocusAccount(acc.id, 'actionType', e.target.value)}
                      className="h-9 text-xs font-semibold rounded-lg border bg-card px-2"
                    >
                      {['Prospect', 'Develop', 'Propose', 'Negotiate', 'Finalise', 'Pending Trade', 'Closed - Won'].map(t => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                    <Input 
                      type="number" 
                      placeholder="EAV ($)" 
                      value={acc.eav || ''} 
                      onChange={e => updateFocusAccount(acc.id, 'eav', parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs bg-card"
                    />
                  </div>
                  <Textarea 
                    placeholder="About account..." 
                    value={acc.aboutAccount} 
                    onChange={e => updateFocusAccount(acc.id, 'aboutAccount', e.target.value)}
                    className="min-h-[60px] text-xs"
                  />
                </div>
              ))}
              {nextWeekPlan.focusAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4">No focus accounts added yet.</p>
              )}
              <div className="pt-1">
                <Button 
                  onClick={addFocusAccount} 
                  variant="outline" 
                  size="sm" 
                  className="text-xs font-semibold h-9 border-dashed border-border hover:border-muted-foreground/40 bg-card shadow-sm hover:bg-secondary/60 text-foreground/85 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Focus Account
                </Button>
              </div>
            </div>
          </div>
          
          {/* This Weeks Actions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground/85">This Weeks Actions</h4>
            </div>
            <div className="space-y-2">
              {nextWeekPlan.actionPlan.map((action, index) => (
                <div key={index} className="flex gap-3 items-center group">
                  <Badge className="bg-secondary text-foreground/85 font-semibold text-xs border shrink-0">
                    Action {index + 1}
                  </Badge>
                  <Input 
                    placeholder="Enter tactical action..." 
                    value={action} 
                    onChange={e => updateAction(index, e.target.value)}
                    className="h-9 text-xs font-bold"
                  />
                  {nextWeekPlan.actionPlan.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeAction(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="pt-1">
                <Button 
                  onClick={addAction} 
                  variant="outline" 
                  size="sm" 
                  className="text-xs font-semibold h-9 border-dashed border-border hover:border-muted-foreground/40 bg-card shadow-sm hover:bg-secondary/60 text-foreground/85 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Action Item
                </Button>
              </div>
            </div>
          </div>
          
          {/* Roadblocks & Support */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Anticipated Roadblocks
              </Label>
              <Textarea 
                placeholder="What roadblocks do you anticipate next week?" 
                value={nextWeekPlan.roadblocks} 
                onChange={e => setNextWeekPlan(prev => ({ ...prev, roadblocks: e.target.value }))}
                className="min-h-[90px] text-xs font-medium rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-accent flex items-center gap-1">
                <LifeBuoy className="w-3.5 h-3.5 text-accent" /> Management Support Needed
              </Label>
              <Textarea 
                placeholder="What support do you need from leadership?" 
                value={nextWeekPlan.supportNeeded} 
                onChange={e => setNextWeekPlan(prev => ({ ...prev, supportNeeded: e.target.value }))}
                className="min-h-[90px] text-xs font-medium rounded-xl"
              />
            </div>
          </div>
          
          {/* Strategic Focus */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-accent flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-accent" /> Strategic Focus for Next Week
            </Label>
            <Textarea 
              placeholder="What is your primary strategic focus next week?" 
              value={nextWeekPlan.strategicFocus} 
              onChange={e => setNextWeekPlan(prev => ({ ...prev, strategicFocus: e.target.value }))}
              className="min-h-[60px] text-xs font-medium rounded-xl"
            />
          </div>

          {/* Publication Status Panel (uniform with TWTW but full-width) */}
          <div className="mt-8 pt-6 border-t w-full">
            <Card className="border-primary/80 shadow-xl rounded-3xl overflow-hidden bg-primary text-white w-full">
              <CardHeader className="border-b border-primary/80 py-4">
                <CardTitle className="text-xs font-semibold text-accent flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" /> Publication Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex justify-between items-center md:justify-start md:gap-6 bg-card/5 border border-white/10 rounded-2xl p-3 md:flex-1">
                  <span className="text-xs font-semibold text-muted-foreground">Current Status</span>
                  <Badge className={cn(
                    "border-none text-xs font-semibold px-2 py-0.5 rounded-full",
                    status === 'SUBMITTED' ? "bg-success-fill/20 text-success border-success/30" :
                    status === 'DRAFT' ? "bg-warning/20 text-warning border-warning/30" : "bg-muted-foreground/20 text-muted-foreground/60"
                  )}>
                    {status === 'SUBMITTED' ? 'Submitted' : status === 'DRAFT' ? 'Draft' : 'Not Started'}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 md:flex-1 justify-end">
                  <Button 
                    onClick={handleSaveDraft} 
                    disabled={isSaving || isSubmitting}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold h-11 text-xs rounded-2xl gap-2 shadow-sm border border-primary/70 w-full sm:w-auto px-6"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-muted-foreground/60" />}
                    Save Draft
                  </Button>

                  <Button 
                    onClick={handleSubmit} 
                    disabled={isSaving || isSubmitting}
                    className="bg-accent hover:bg-accent/90 text-white font-semibold h-11 text-xs rounded-2xl gap-2 shadow-lg shadow-accent/20 w-full sm:w-auto px-8"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === 'SUBMITTED' ? 'Update Submission' : 'Submit Friday Pack'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Super Admin 1-on-1 Review & Approval Panel */}
      {isSuperAdminOrLeader && (
        <Card className="border-2 border-accent shadow-xl bg-gradient-to-br from-primary via-primary to-primary text-white overflow-hidden rounded-3xl mt-8">
          <CardHeader className="border-b border-primary/60 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-success-fill text-foreground rounded-xl shadow-md font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                    Super Admin 1-on-1 Friday Review &amp; Sign-off
                  </CardTitle>
                  <CardDescription className="text-xs text-info/70">
                    Conducting Friday afternoon review with <strong className="text-success font-bold">{activeUserName}</strong> ({activeUserRole})
                  </CardDescription>
                </div>
              </div>

              {adminReviewedBy && (
                <Badge className="bg-success-fill/20 text-success border-success/40 text-xs px-3 py-1 font-bold">
                  ✓ Reviewed by {adminReviewedBy}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-info/70 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-warning" />
                Super Admin Coaching Notes &amp; 1-on-1 Discussion Summary
              </Label>
              <Textarea
                placeholder="Enter 1-on-1 coaching feedback, agreed key actions, or performance notes discussed during Friday afternoon review..."
                value={adminCoachingNotes}
                onChange={e => setAdminCoachingNotes(e.target.value)}
                className="bg-primary/80 border-primary text-white placeholder:text-primary-foreground/60 min-h-[100px] text-xs font-medium focus-visible:ring-info/50"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-primary/60">
              <div className="text-xs text-info font-medium">
                {status === 'REVIEWED_BY_ADMIN' ? (
                  <span className="text-success font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> This Friday Review Pack has been signed off and locked by Admin.
                  </span>
                ) : (
                  <span>Review status: <strong className="text-warning">{status}</strong>. Click button to complete 1-on-1 sign-off.</span>
                )}
              </div>

              <Button
                onClick={handleAdminApprove}
                disabled={isSaving}
                className="w-full sm:w-auto bg-gradient-to-r from-success-fill to-teal-600 hover:from-success-fill hover:to-teal-700 text-foreground font-semibold text-xs h-11 px-6 rounded-xl shadow-lg gap-2"
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
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden p-6 border border-border shadow-2xl bg-card">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-foreground">
              <Building2 className="w-5 h-5 text-accent" /> Select Focus Account
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-0.5">
              Choose an active opportunity or customer from your CRM uploads to auto-populate fields.
            </DialogDescription>
          </DialogHeader>

          {/* Search bar inside popup */}
          <div className="py-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts by name, stage, or business unit..."
                value={crmSearch}
                onChange={e => setCrmSearch(e.target.value)}
                className="pl-10 h-10 text-xs font-medium bg-secondary/60 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-accent"
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
                      <p className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                        {crmAcc.pipeline || crmAcc.opportunityName || 'Unnamed Account'}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-secondary text-foreground/75 font-bold border-none text-xs px-2 py-0.5 rounded-full">
                          {isOpp ? 'Opportunity' : 'Customer'}
                        </Badge>
                        {crmAcc.stage && (
                          <Badge className="bg-info-soft text-accent font-bold border-none text-xs px-2 py-0.5 rounded-full">
                            {crmAcc.stage}
                          </Badge>
                        )}
                        {crmAcc.businessUnit && (
                          <span className="text-xs text-muted-foreground font-bold">
                            BU: {crmAcc.businessUnit}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs font-semibold text-foreground">{formatEAV(value)}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {isOpp ? 'Expected Value' : 'YTD Revenue'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center">
                <Building2 className="w-12 h-12 text-border mx-auto mb-3" />
                <p className="text-xs text-muted-foreground font-medium">No uploaded accounts found matching search.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── KPI Detail Breakdown Dialog Popup ────────────────────────────────── */}
      <Dialog open={!!kpiModalType} onOpenChange={(open) => { if (!open) setKpiModalType(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col rounded-3xl overflow-hidden p-6 border border-border shadow-2xl bg-card">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-2xl font-bold text-white shadow-md",
                kpiModalType === 'CALLS' ? "bg-accent" :
                kpiModalType === 'APPOINTMENTS' ? "bg-success-fill" :
                kpiModalType === 'OPPORTUNITIES' ? "bg-accent" :
                kpiModalType === 'PIPELINE_VALUE' ? "bg-warning" :
                kpiModalType === 'CANVASS_LEADS' ? "bg-accent" : "bg-teal-600"
              )}>
                {kpiModalType === 'CALLS' && <Phone className="w-5 h-5" />}
                {kpiModalType === 'APPOINTMENTS' && <CalendarCheck className="w-5 h-5" />}
                {kpiModalType === 'OPPORTUNITIES' && <Briefcase className="w-5 h-5" />}
                {kpiModalType === 'PIPELINE_VALUE' && <DollarSign className="w-5 h-5" />}
                {kpiModalType === 'CANVASS_LEADS' && <MapPin className="w-5 h-5" />}
                {kpiModalType === 'SENT_TO_SF' && <ExternalLink className="w-5 h-5" />}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  {kpiModalType === 'CALLS' && `Phone Calls Breakdown · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'APPOINTMENTS' && `Appointments & Meetings Breakdown · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'OPPORTUNITIES' && `Active Opportunities · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'PIPELINE_VALUE' && `Pipeline Value Breakdown · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'CANVASS_LEADS' && `Canvassed Field Leads · Week ${currentWeek.split('-')[1]}`}
                  {kpiModalType === 'SENT_TO_SF' && `Salesforce Submitted Leads · Week ${currentWeek.split('-')[1]}`}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground mt-0.5">
                  Representative: <strong className="text-foreground font-bold">{activeUserName}</strong> · Week {currentWeek.split('-')[1]}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Content Details */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[300px] max-h-[55vh] pr-1">
            {/* CALLS DETAIL */}
            {kpiModalType === 'CALLS' && (
              <div className="space-y-4">
                <div className="bg-info-soft p-4 rounded-2xl border border-info/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-primary">Total Calls Logged</span>
                    <p className="text-xs text-primary font-medium">Phone calls and outreach logged for Week {currentWeek.split('-')[1]}</p>
                  </div>
                  <Badge className="bg-accent text-white font-semibold text-sm px-3 py-1">{currentWeekData.activity.calls}</Badge>
                </div>
                <div className="border rounded-2xl overflow-hidden divide-y divide-border">
                  {callsList.length > 0 ? (
                    callsList.map((item, i) => (
                      <div key={item.id || i} className="p-4 bg-card hover:bg-secondary/60 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                              {item.title}
                            </h4>
                            {item.dateTime && (
                              <p className="text-xs font-bold text-primary mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-accent" />
                                {item.dateTime}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-xs font-semibold px-2.5 py-1 ${item.badgeColor}`}>
                              {item.type}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold gap-1 text-foreground/85 border-border hover:bg-secondary"
                              onClick={() => openSalesforceSearch(item.title, item.salesforceId)}
                            >
                              Salesforce <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>

                        {/* Details Metadata */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-foreground/75 font-medium pt-1 border-t border-border">
                          {item.contactName && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              <strong>Contact:</strong> {item.contactName}
                            </span>
                          )}
                          {item.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {item.contactPhone}
                            </span>
                          )}
                          {item.contactEmail && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              ✉ {item.contactEmail}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                              {item.location}
                            </span>
                          )}
                          {item.businessUnit && (
                            <span className="font-bold text-accent text-xs">
                              BU: {item.businessUnit}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-foreground/75 italic bg-secondary/60 p-2.5 rounded-xl border border-border">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">No detailed call logs found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* APPOINTMENTS DETAIL */}
            {kpiModalType === 'APPOINTMENTS' && (
              <div className="space-y-4">
                <div className="bg-success-soft p-4 rounded-2xl border border-success/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-success-ink">Total Appointments &amp; Meetings</span>
                    <p className="text-xs text-success-ink font-medium">Client visits, meetings &amp; appointments for Week {currentWeek.split('-')[1]}</p>
                  </div>
                  <Badge className="bg-success-fill text-white font-semibold text-sm px-3 py-1">{currentWeekData.activity.apps}</Badge>
                </div>
                <div className="border rounded-2xl overflow-hidden divide-y divide-border">
                  {appointmentList.length > 0 ? (
                    appointmentList.map((item, i) => (
                      <div key={item.id || i} className="p-4 bg-card hover:bg-secondary/60 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                              {item.title}
                            </h4>
                            {item.dateTime && (
                              <p className="text-xs font-bold text-success-ink mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-success-ink" />
                                {item.dateTime}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-xs font-semibold px-2.5 py-1 ${item.badgeColor}`}>
                              {item.type}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold gap-1 text-foreground/85 border-border hover:bg-secondary"
                              onClick={() => openSalesforceSearch(item.title, item.salesforceId)}
                            >
                              Salesforce <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>

                        {/* Details Metadata */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-foreground/75 font-medium pt-1 border-t border-border">
                          {item.contactName && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              <strong>Contact:</strong> {item.contactName}
                            </span>
                          )}
                          {item.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {item.contactPhone}
                            </span>
                          )}
                          {item.contactEmail && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              ✉ {item.contactEmail}
                            </span>
                          )}
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                              {item.location}
                            </span>
                          )}
                          {item.businessUnit && (
                            <span className="font-bold text-accent text-xs">
                              BU: {item.businessUnit}
                            </span>
                          )}
                        </div>

                        {item.notes && (
                          <p className="text-xs text-foreground/75 italic bg-secondary/60 p-2.5 rounded-xl border border-border">
                            "{item.notes}"
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">No appointment entries found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* OPPORTUNITIES DETAIL */}
            {kpiModalType === 'OPPORTUNITIES' && (
              <div className="space-y-4">
                <div className="bg-info-soft p-4 rounded-2xl border border-info/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">Active Opportunities Count</span>
                  <Badge className="bg-accent text-white font-semibold text-sm px-3 py-1">{currentWeekData.opportunities.length}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekData.opportunities.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-secondary/60">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Opportunity / Pipeline</TableHead>
                          <TableHead className="text-xs font-semibold">Stage</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Expected EAV</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Salesforce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekData.opportunities.map((opp: any) => (
                          <TableRow key={opp.id} className="hover:bg-secondary/60">
                            <TableCell className="font-bold text-xs text-foreground">{opp.pipeline || opp.opportunityName}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{opp.stage || 'Discovery'}</Badge></TableCell>
                            <TableCell className="text-right font-bold text-success-ink">{formatEAV(opp.value || 0)}</TableCell>
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
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">No active opportunities found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* PIPELINE VALUE DETAIL */}
            {kpiModalType === 'PIPELINE_VALUE' && (
              <div className="space-y-4">
                <div className="bg-warning-soft p-4 rounded-2xl border border-warning/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-warning-ink">Total Pipeline Value</span>
                  <Badge className="bg-warning text-white font-bold text-base px-4 py-1">{formatEAV(currentWeekData.revenue.pipeline)}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekData.opportunities.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-secondary/60">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Deal / Account</TableHead>
                          <TableHead className="text-xs font-semibold">Stage</TableHead>
                          <TableHead className="text-xs font-semibold">Business Unit</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekData.opportunities.map((opp: any) => (
                          <TableRow key={opp.id} className="hover:bg-secondary/60">
                            <TableCell className="font-bold text-xs text-foreground">{opp.pipeline}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{opp.stage}</Badge></TableCell>
                            <TableCell className="text-xs font-semibold text-muted-foreground">{opp.businessUnit || 'General'}</TableCell>
                            <TableCell className="text-right font-bold text-warning-ink">{formatEAV(opp.value || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">No pipeline deals found for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* CANVASS LEADS DETAIL */}
            {kpiModalType === 'CANVASS_LEADS' && (
              <div className="space-y-4">
                <div className="bg-info-soft p-4 rounded-2xl border border-info/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">Canvassed Field Leads</span>
                  <Badge className="bg-accent text-white font-semibold text-sm px-3 py-1">{currentWeekCanvassLeadsCount}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekCanvassLeads.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-secondary/60">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Company Name</TableHead>
                          <TableHead className="text-xs font-semibold">Contact Person</TableHead>
                          <TableHead className="text-xs font-semibold">Phone / Email</TableHead>
                          <TableHead className="text-xs font-semibold">Location</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekCanvassLeads.map((lead: any) => (
                          <TableRow key={lead.id} className="hover:bg-secondary/60">
                            <TableCell className="font-bold text-xs text-foreground">{lead.companyName}</TableCell>
                            <TableCell className="text-xs font-medium">{lead.firstName ? `${lead.firstName} ${lead.lastName}` : lead.lastName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{lead.phone} · {lead.email || 'No email'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{lead.suburb || lead.addressLine1 || 'Perth Metro'}</TableCell>
                            <TableCell className="text-center">
                              {lead.inSalesforce ? (
                                <Badge className="bg-teal-100 text-teal-800 border-none text-xs font-bold">In Salesforce</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs font-bold">Captured</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">No canvassing leads logged for this week.</div>
                  )}
                </div>
              </div>
            )}

            {/* SENT TO SF DETAIL */}
            {kpiModalType === 'SENT_TO_SF' && (
              <div className="space-y-4">
                <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900">Leads Submitted to Salesforce</span>
                  <Badge className="bg-teal-600 text-white font-semibold text-sm px-3 py-1">{currentWeekSalesforceLeadsCount}</Badge>
                </div>
                <div className="border rounded-2xl overflow-x-auto">
                  {currentWeekSalesforceLeads.length > 0 ? (
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-secondary/60">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Company Name</TableHead>
                          <TableHead className="text-xs font-semibold">Contact Name</TableHead>
                          <TableHead className="text-xs font-semibold">Salesforce ID</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentWeekSalesforceLeads.map((lead: any) => (
                          <TableRow key={lead.id} className="hover:bg-secondary/60">
                            <TableCell className="font-bold text-xs text-foreground">{lead.companyName}</TableCell>
                            <TableCell className="text-xs font-medium">{lead.firstName ? `${lead.firstName} ${lead.lastName}` : lead.lastName}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">{lead.salesforceId || 'Submitted'}</TableCell>
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
                    <div className="p-8 text-center text-xs text-muted-foreground font-medium">No leads submitted to Salesforce for this week yet.</div>
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
