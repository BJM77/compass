"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { 
  TrendingUp, DollarSign, FileCheck, Target, Rocket, Shield, Activity, 
  MessageSquare, Star, Send, Loader2, Download, TrendingDown, Users,
  ShieldCheck, PhoneCall, AlertTriangle, LifeBuoy, CalendarPlus, Phone, CalendarCheck,
  ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { cn, getCurrentWeek, formatEAV } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { OnboardingPlan } from './onboarding-plan';
import { usePipelineData } from '@/contexts/pipeline-context';
import { getMonthWeeksForWeek } from '@/lib/utils';
import { calculateDealHealth } from '@/lib/deal-health';

export interface CrmMetrics {
  eav: number;
  weekOpps: number; mtdOpps: number;
  weekSigned: number; mtdSigned: number;
  weekWon: number; mtdWon: number;
}

interface BDMWeeklyReport {
  id?: string;
  userId: string;
  userName: string;
  week: string;
  summary: {
    totalEAV: number;
    newOpportunitiesCount: number;
    signedPaperworkCount: number;
    newBusinessCount: number;
    callsMade?: number;
    meetingsHeld?: number;
    crmCalls?: number;
    crmApps?: number;
  };
  weeklyNotes: string;
  roadblocks?: string;
  supportNeeded?: string;
  nextWeekCommitments?: string;
  gmFeedback?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED';
  submittedAt?: any;
  whitespaceCount?: number;
  callPlanCount?: number;
}

export function GMWeeklyReview({ week: propWeek }: { week?: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useAuth();
  const { allPipelineReviews } = usePipelineData();
  const currentWeek = propWeek || getCurrentWeek();
  
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [reportData, setReportData] = useState<BDMWeeklyReport[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [paperwork, setPaperwork] = useState<any[]>([]);
  const [newBusiness, setNewBusiness] = useState<any[]>([]);
  const [opsReports, setOpsReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [includeGroupPlan, setIncludeGroupPlan] = useState(false);
  
  const [allFactFindings, setAllFactFindings] = useState<any[]>([]);
  const [allCallPlans, setAllCallPlans] = useState<any[]>([]);
  const [allWhitespacePlans, setAllWhitespacePlans] = useState<any[]>([]);

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users } = useCollection(usersQuery);

  const teamPlansQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', 'TEAM_NODE'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: teamPlans } = useCollection(teamPlansQuery);

  useEffect(() => {
    async function fetchMetadata() {
      if (!db) return;
      const snap = await getDocs(collection(db, 'weeklyReports'));
      const current = getCurrentWeek();
      let weeks = Array.from(new Set([current, ...snap.docs.map(d => d.data().week as string)]));
      weeks = weeks.filter(w => w && w <= current).sort().reverse();
      setAvailableWeeks(weeks);
    }
    fetchMetadata();
  }, [db]);

  useEffect(() => {
    async function fetchReports() {
      if (!db || !users) return;
      setIsLoading(true);
      try {
        const [reportsSnap, commitmentsSnap, oppsSnap, paperworkSnap, businessSnap, progressSnap, whitespaceSnap, callPlansSnap, opsSnap, factFindingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'weeklyReports'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'weeklyCommitments'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'opportunities'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'signedPaperwork'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'newBusiness'), where('week', '==', selectedWeek))),
          getDocs(query(collection(db, 'weeklyProgress'), where('week', '==', selectedWeek))),
          getDocs(collection(db, 'whitespacePlans')),
          getDocs(collection(db, 'callPlans')),
          getDocs(query(collection(db, 'opsReports'), where('week', '==', selectedWeek))),
          getDocs(collection(db, 'factFindingDocs'))
        ]);

        const bdms = users.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER');
        
        const reports = bdms.map(bdm => {
          const reportDoc = reportsSnap.docs.find(d => d.data().userId === bdm.id);
          const commitmentDoc = commitmentsSnap.docs.find(d => d.data().userId === bdm.id);
          const progressDoc = progressSnap.docs.find(d => d.data().userId === bdm.id);
          const userWS = whitespaceSnap.docs.filter(d => d.data().userId === bdm.id).length;
          const userCP = callPlansSnap.docs.filter(d => d.data().userId === bdm.id).length;
          
          const reportData = reportDoc?.data();
          const commitData = commitmentDoc?.data();
          const progressData = progressDoc?.data();

          // Join actionPlan array into a single string for display
          const joinedCommitments = commitData?.actionPlan?.length > 0 
            ? commitData?.actionPlan?.map((a: string, i: number) => a.trim() ? `${i+1}. ${a}` : '').filter((a: string) => a).join('\n')
            : commitData?.nextWeekCommitments || '';

          const summary = reportData?.summary || { totalEAV: 0, newOpportunitiesCount: 0, signedPaperworkCount: 0, newBusinessCount: 0, callsMade: 0, meetingsHeld: 0, crmCalls: 0, crmApps: 0 };
          
          // Override or fallback callsMade and meetingsHeld from progressData (manual entries)
          const callsMade = progressData?.calls !== undefined ? progressData.calls : (summary.callsMade || 0);
          const meetingsHeld = progressData?.apps !== undefined ? progressData.apps : (summary.meetingsHeld || 0);

          // Retrieve or fallback crmCalls and crmApps (imported CRM entries)
          const crmCalls = progressData?.crmCalls !== undefined ? progressData.crmCalls : (summary.crmCalls || 0);
          const crmApps = progressData?.crmApps !== undefined ? progressData.crmApps : (summary.crmApps || 0);

          return {
            id: reportDoc?.id,
            userId: bdm.id,
            userName: bdm.name,
            week: selectedWeek,
            summary: {
              ...summary,
              callsMade,
              meetingsHeld,
              crmCalls,
              crmApps
            },
            weeklyNotes: reportData?.weeklyNotes || '',
            roadblocks: commitData?.roadblocks || '',
            supportNeeded: commitData?.supportNeeded || '',
            nextWeekCommitments: joinedCommitments,
            gmFeedback: reportData?.gmFeedback || '',
            status: reportData?.status || 'DRAFT',
            whitespaceCount: userWS,
            callPlanCount: userCP,
            submittedAt: reportData?.submittedAt
          } as BDMWeeklyReport;
        });

        setReportData(reports);
        setOpportunities(oppsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPaperwork(paperworkSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setNewBusiness(businessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setOpsReports(opsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((r: any) => r.status === 'ESCALATED'));
        setAllFactFindings(factFindingsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllCallPlans(callPlansSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAllWhitespacePlans(whitespaceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchReports();
  }, [db, users, selectedWeek]);

  const saveGMFeedback = async (userId: string, feedback: string) => {

    if (!db) return;
    try {
      // Use the actual doc ID from loaded state when available.
      // Falls back to the canonical pattern if report wasn't loaded from Firestore yet.
      const existingReport = reportData.find(r => r.userId === userId);
      const reportId = existingReport?.id || `${userId}_${selectedWeek}`;
      await updateDoc(doc(db, 'weeklyReports', reportId), {
        gmFeedback: feedback,
        status: 'REVIEWED',
        reviewedAt: serverTimestamp()
      });
      
      setReportData(prev => prev.map(r => r.userId === userId ? { ...r, gmFeedback: feedback, status: 'REVIEWED' } : r));
      toast({ title: "Feedback Archived", description: "Node updated for BDM review." });
    } catch (e) {
      toast({ variant: "destructive", title: "Save Failed" });
    }
  };

  const [execReview, setExecReview] = useState<string>('');
  const [showReviewArea, setShowReviewArea] = useState(false);

  const generateExecutiveReview = () => {
    // Aggregation calculations
    const teamOppsCount = metrics.totalOpps;
    const teamSignedCount = metrics.totalSigned;
    const teamNewBizCount = metrics.totalNewBiz;
    
    // Appointments (CRM/Man)
    const crmApps = metrics.totalCrmApps;
    const manApps = metrics.totalApps;
    
    // Calls (CRM/Man)
    const crmCalls = metrics.totalCrmCalls;
    const manCalls = metrics.totalCalls;

    // Estimate EAV
    const totalEAVStr = (metrics.totalEAV / 1000000).toFixed(2);

    const summaryDraft = `EXECUTIVE PERFORMANCE SUMMARY - WEEK ${selectedWeek.split('-')[1]}
- Appointments: ${crmApps} completed via CRM (Manual logs show ${manApps} meetings).
- Client Calls: ${crmCalls} logged in CRM (Manual: ${manCalls} calls total).
- Opportunities: ${teamOppsCount} new active opportunities valued at $${totalEAVStr}M in pipeline.
- New Trading Accounts / New Business: ${teamNewBizCount} accounts successfully started trading live freight.
- Governance Wins: ${teamSignedCount} agreements signed and verified this week.
The team demonstrates strong pipeline momentum with steady transition from prospecting to active trading.`;
    
    setExecReview(summaryDraft);
    setShowReviewArea(true);
    toast({ title: "Review Created", description: "Executive summary drafted. Review and edit below before dispatching." });
  };

  const mtdWeeks = useMemo(() => {
    return getMonthWeeksForWeek(selectedWeek).filter(w => w <= selectedWeek);
  }, [selectedWeek]);

  const crmMetricsByUserId = useMemo(() => {
    const map = new Map<string, CrmMetrics>();
    reportData.forEach(r => map.set(r.userId, { eav: 0, weekOpps: 0, mtdOpps: 0, weekSigned: 0, mtdSigned: 0, weekWon: 0, mtdWon: 0 }));

    const mtdReviews = allPipelineReviews.filter(r => mtdWeeks.includes(r.week));
    const weekReviews = allPipelineReviews.filter(r => r.week === selectedWeek);

    // 1. EAV & Weekly Metrics
    weekReviews.forEach(r => {
      if (r.isBareAccount || r.stage === 'Closed Lost') return;
      const entry = map.get(r.userId);
      if (!entry) return;

      const val = Number(r.value) || 0;
      if (val > 0) entry.eav += val;

      if (['Finalise', 'Pending Trade'].includes(r.stage || '')) entry.weekSigned += 1;
      if (r.stage === 'Closed Won') entry.weekWon += 1;
    });

    // 2. MTD Metrics (Unique Opps)
    const mtdSignedOpps = new Set<string>();
    const mtdWonOpps = new Set<string>();
    mtdReviews.forEach(r => {
      if (r.isBareAccount) return;
      const key = r.salesforceId || r.opportunityName;
      if (!key) return;
      const entry = map.get(r.userId);
      if (!entry) return;

      if (['Finalise', 'Pending Trade'].includes(r.stage || '')) {
        if (!mtdSignedOpps.has(key)) { mtdSignedOpps.add(key); entry.mtdSigned += 1; }
      }
      if (r.stage === 'Closed Won') {
        if (!mtdWonOpps.has(key)) { mtdWonOpps.add(key); entry.mtdWon += 1; }
      }
    });

    // 3. New Opps (First Appearance)
    const oppFirstWeek = new Map<string, string>();
    allPipelineReviews.forEach(r => {
      if (r.isBareAccount) return;
      const key = r.salesforceId || r.opportunityName;
      if (!key) return;
      const existing = oppFirstWeek.get(key);
      if (!existing || r.week < existing) oppFirstWeek.set(key, r.week);
    });

    oppFirstWeek.forEach((firstWeek, key) => {
      if (firstWeek === selectedWeek) {
        const opp = weekReviews.find(r => (r.salesforceId || r.opportunityName) === key);
        if (opp && map.has(opp.userId)) map.get(opp.userId)!.weekOpps += 1;
      }
      if (mtdWeeks.includes(firstWeek)) {
        const opp = mtdReviews.find(r => (r.salesforceId || r.opportunityName) === key && r.week === firstWeek);
        if (opp && map.has(opp.userId)) map.get(opp.userId)!.mtdOpps += 1;
      }
    });

    return map;
  }, [allPipelineReviews, selectedWeek, mtdWeeks, reportData]);

  const teamCrmEAV = useMemo(() => {
    let sum = 0;
    crmMetricsByUserId.forEach(v => sum += v.eav);
    return sum;
  }, [crmMetricsByUserId]);

  const exportReport = () => {
    const headers = ['Identity', 'Calls', 'Apps', 'Total EAV', 'New Opps', 'Signed Deals', 'New Business', 'Status'];
    const rows = reportData.map(r => {
      const metrics = crmMetricsByUserId.get(r.userId);
      return [
        r.userName, 
        r.summary.callsMade || 0,
        r.summary.meetingsHeld || 0,
        metrics?.eav || r.summary.totalEAV || 0, 
        metrics?.weekOpps || r.summary.newOpportunitiesCount, 
        metrics?.weekSigned || r.summary.signedPaperworkCount, 
        metrics?.weekWon || r.summary.newBusinessCount, 
        r.status
      ];
    });
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TGE_GM_Review_${selectedWeek}.csv`;
    a.click();
    toast({ title: "Export Complete" });
  };

  const pdfBdmIds = reportData.map(r => `gm-pdf-bdm-${r.userId}`);

  const handleDispatchToGM = async (isBW = false) => {
    setIsGeneratingPDF(true);

    setTimeout(async () => {
      try {
        toast({ title: "Generating PDF", description: "Compiling Multi-Page A4 Report..." });

        const baseCanvasOptions = (doc: Document) => {
          const style = doc.createElement('style');
          let css = `
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              transition: none !important;
              animation: none !important;
            }
          `;
          if (isBW) {
            css += `
              p, span, h1, h2, h3, h4, th, td, div { color: #0f172a !important; }
              .text-accent, .text-blue-600, .text-emerald-600, .text-purple-600, .text-orange-600 {
                color: #1e293b !important; font-weight: 900 !important;
              }
              .text-muted-foreground, .text-slate-400 { color: #475569 !important; opacity: 1 !important; }
              .bg-slate-50, .bg-blue-50, .bg-green-50, .bg-purple-50, .bg-amber-50 { background-color: #f8fafc !important; }
              .shadow-xl, .shadow-lg, .shadow-sm, .backdrop-blur { box-shadow: none !important; backdrop-filter: none !important; }
              .border, .border-b, .border-t { border-color: #e2e8f0 !important; }
            `;
          }
          style.innerHTML = css;
          doc.head.appendChild(style);
        };

        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 28;
        const usableWidth = pageWidth - margin * 2;
        const usableHeight = pageHeight - margin * 2;

        const pdf = new jsPDF('p', 'pt', 'a4');

        // ── PAGE 1: Cover / Summary Page ──────────────────────────────────────
        const coverEl = document.getElementById('gm-pdf-cover');
        if (coverEl) {
          const coverCanvas = await html2canvas(coverEl, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (d) => baseCanvasOptions(d),
          });
          const coverImg = coverCanvas.toDataURL('image/jpeg', 0.88);
          const coverHeight = (coverCanvas.height * usableWidth) / coverCanvas.width;
          let pos = margin;
          let left = coverHeight;
          pdf.addImage(coverImg, 'JPEG', margin, pos, usableWidth, coverHeight);
          left -= usableHeight;
          while (left > 0) {
            pos -= usableHeight;
            pdf.addPage();
            pdf.addImage(coverImg, 'JPEG', margin, pos, usableWidth, coverHeight);
            left -= usableHeight;
          }
        }

        // ── PAGE 2+: One page per BDM ──────────────────────────────────────────
        const extraSections = [...pdfBdmIds];
        if (includeGroupPlan) {
          extraSections.push('gm-pdf-group90-p1', 'gm-pdf-group90-p2', 'gm-pdf-group90-p3');
        }
        for (const sectionId of extraSections) {
          const sectionEl = document.getElementById(sectionId);
          if (!sectionEl) continue;
          const sectionCanvas = await html2canvas(sectionEl, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (d) => baseCanvasOptions(d),
          });
          const sectionImg = sectionCanvas.toDataURL('image/jpeg', 0.88);
          const sectionHeight = (sectionCanvas.height * usableWidth) / sectionCanvas.width;
          let pos = margin;
          let left = sectionHeight;
          pdf.addPage();
          pdf.addImage(sectionImg, 'JPEG', margin, pos, usableWidth, sectionHeight);
          left -= usableHeight;
          while (left > 0) {
            pos -= usableHeight;
            pdf.addPage();
            pdf.addImage(sectionImg, 'JPEG', margin, pos, usableWidth, sectionHeight);
            left -= usableHeight;
          }
        }

        const fileName = isBW
          ? `GM_Dispatch_Report_BW_Week_${selectedWeek}.pdf`
          : `GM_Dispatch_Report_Week_${selectedWeek}.pdf`;
        pdf.save(fileName);
        toast({ title: "Dispatch Complete", description: "Multi-page A4 PDF downloaded." });
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF." });
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 1200);
  };

  const metrics = useMemo(() => {
    const totalEAV = teamCrmEAV || 0;
    
    const weekReviews = allPipelineReviews.filter(r => r.week === selectedWeek);
    const totalOpps = weekReviews.filter(r => !r.isBareAccount && r.stage !== 'Closed Lost').length;
    const totalSigned = weekReviews.filter(r => !r.isBareAccount && ['Finalise', 'Pending Trade'].includes(r.stage || '')).length;
    const totalNewBiz = weekReviews.filter(r => !r.isBareAccount && r.stage === 'Closed Won').length;

    const totalCalls = reportData.reduce((sum, r) => sum + (r.summary.callsMade || 0), 0);
    const totalApps = reportData.reduce((sum, r) => sum + (r.summary.meetingsHeld || 0), 0);
    const totalCrmCalls = reportData.reduce((sum, r) => sum + (r.summary.crmCalls || 0), 0);
    const totalCrmApps = reportData.reduce((sum, r) => sum + (r.summary.crmApps || 0), 0);
    return { totalEAV, totalOpps, totalSigned, totalNewBiz, totalCalls, totalApps, totalCrmCalls, totalCrmApps };
  }, [reportData, allPipelineReviews, selectedWeek, teamCrmEAV]);

  const performanceData = reportData.map(r => {
    const metrics = crmMetricsByUserId.get(r.userId);
    return {
      name: r.userName.split(' ')[0],
      eav: (metrics?.eav || r.summary.totalEAV || 0) / 1000,
      deals: metrics?.weekSigned || r.summary.signedPaperworkCount || 0,
      calls: r.summary.callsMade || 0
    };
  });

  const pipelineStatusData = [
    { name: 'Total Opps', value: metrics.totalOpps, color: '#3b82f6' },
    { name: 'Signed', value: metrics.totalSigned, color: '#10b981' },
    { name: 'Portfolio', value: metrics.totalNewBiz, color: '#8b5cf6' }
  ];

  if (isLoading) return <div className="flex items-center justify-center py-40"><Loader2 className="w-12 h-12 animate-spin text-accent" /></div>;

  return (
    <div id="gm-report-capture" className="space-y-8 animate-in fade-in duration-700 pb-20 bg-slate-50 p-6 rounded-xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase text-primary flex items-center gap-3">
            <Shield className="w-8 h-8 text-accent" />
            GM Weekly Performance Node
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Week {selectedWeek.split('-')[1]} • Team Performance & Pipeline Health</p>
            <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="rounded-lg border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              {(availableWeeks.length > 0 ? availableWeeks : [selectedWeek]).map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2" data-html2canvas-ignore="true">
          <Button variant="outline" onClick={generateExecutiveReview} className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase h-10 shadow-lg shadow-amber-500/20">
            <ClipboardList className="w-4 h-4 mr-2" /> CREATE REVIEW
          </Button>
          <Button variant="outline" onClick={exportReport} className="font-black text-[10px] uppercase h-10 bg-white">
            <Download className="w-4 h-4 mr-2" /> EXPORT CSV
          </Button>
          <label className="flex items-center gap-2 cursor-pointer border border-slate-200 bg-white px-3 h-10 rounded-md shadow-sm hover:bg-slate-50 transition-colors">
            <input 
              type="checkbox" 
              checked={includeGroupPlan} 
              onChange={(e) => setIncludeGroupPlan(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
            />
            <span className="text-[10px] font-black text-slate-700 uppercase pt-0.5">Include 30/60/90 Plan in PDF</span>
          </label>
          <Button onClick={() => handleDispatchToGM(true)} disabled={isGeneratingPDF} className="bg-slate-800 hover:bg-slate-700 font-black text-[10px] uppercase h-10 text-white shadow-lg shadow-slate-800/20">
            {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck className="w-4 h-4 mr-2" />} 
            {isGeneratingPDF ? 'COMPILING...' : 'DISPATCH(B&W)'}
          </Button>
          <Button onClick={() => handleDispatchToGM(false)} disabled={isGeneratingPDF} className="bg-primary font-black text-[10px] uppercase h-10 text-white shadow-lg shadow-primary/20">
            {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} 
            {isGeneratingPDF ? 'COMPILING...' : 'DISPATCH TO GM'}
          </Button>
        </div>
      </header>

      {showReviewArea && (
        <Card className="border-none shadow-md bg-white overflow-hidden p-6 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase text-primary">Edit Executive Summary Draft (8-10 Lines max)</h3>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none font-bold text-[9px] uppercase px-2 py-0.5">Editable Draft</Badge>
          </div>
          <Textarea 
            className="w-full text-xs font-medium leading-relaxed font-sans border-primary/20 bg-slate-50/50 p-4 rounded-xl min-h-[160px]" 
            value={execReview} 
            onChange={(e) => setExecReview(e.target.value)} 
          />
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Pipeline EAV" value={`$${(metrics.totalEAV / 1000000).toFixed(1)}M`} sub="Target Achievement" icon={<DollarSign className="w-4 h-4" />} color="blue" />
        <MetricCard title="Total Opps" value={metrics.totalOpps} sub="Active Pipeline" icon={<Target className="w-4 h-4" />} color="green" />
        <MetricCard title="Signed Paperwork" value={metrics.totalSigned} sub="Governance Win" icon={<FileCheck className="w-4 h-4" />} color="purple" />
        <MetricCard title="New Biz Started" value={metrics.totalNewBiz} sub="Live Freight" icon={<Rocket className="w-4 h-4" />} color="orange" />
        <MetricCard title="Team Calls" value={metrics.totalCrmCalls} sub={`Man: ${metrics.totalCalls} completed`} icon={<Phone className="w-4 h-4" />} color="blue" />
        <MetricCard title="Team Apps" value={metrics.totalCrmApps} sub={`Man: ${metrics.totalApps} completed`} icon={<CalendarCheck className="w-4 h-4" />} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-2.5 px-4"><CardTitle className="text-xs font-black uppercase">Activity & Achievement Index</CardTitle></CardHeader>
          <CardContent className="h-56 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={9} fontWeight="bold" />
                <YAxis fontSize={9} fontWeight="bold" />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="eav" fill="#3b82f6" name="EAV ($K)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="calls" fill="#6366f1" name="Calls" radius={[3, 3, 0, 0]} />
                <Bar dataKey="deals" fill="#10b981" name="Deals" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b py-2.5 px-4"><CardTitle className="text-xs font-black uppercase">Pipeline Distribution</CardTitle></CardHeader>
          <CardContent className="h-56 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pipelineStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={4} dataKey="value">
                  {pipelineStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── PDF CAPTURE ZONES (hidden from screen, shown only when generating) ── */}
      {isGeneratingPDF && (
        <div className="fixed left-[-9999px] top-0 z-[-1]">

          {/* ZONE 1: Cover Page */}
          <div id="gm-pdf-cover" style={{width: '794px', background: '#fff', padding: '40px', fontFamily: 'Inter, system-ui, sans-serif'}}>
            {/* Header Band */}
            <div style={{background: '#f1f5f9', borderRadius: '16px', padding: '36px 40px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px'}}>
                  <div style={{width: '8px', height: '44px', background: '#f59e0b', borderRadius: '4px'}} />
                  <div>
                    <div style={{color: '#0f172a', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px', textTransform: 'uppercase'}}>WA Parcels Performance Review</div>
                    <div style={{color: '#475569', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px'}}>Week {selectedWeek.split('-W')[1] || selectedWeek.split('-')[1]} • Team Performance & Pipeline Health</div>
                  </div>
                </div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{color: '#64748b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>Report Generated</div>
                <div style={{color: '#0f172a', fontSize: '13px', fontWeight: 700, marginTop: '2px'}}>{new Date().toLocaleDateString('en-AU', {day: '2-digit', month: 'long', year: 'numeric'})}</div>
                <div style={{color: '#64748b', fontSize: '10px', marginTop: '2px', fontWeight: 600}}>TGE Freight • Confidential</div>
              </div>
            </div>

            {/* Executive Summary Review */}
            {execReview && execReview.trim() && (
              <div style={{background: '#f8fafc', borderLeft: '4px solid #1e40af', padding: '16px 20px', marginBottom: '28px', borderRadius: '0 8px 8px 0'}}>
                <div style={{fontSize: '10px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Executive Summary</div>
                <div style={{fontSize: '12px', fontWeight: 500, color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap'}}>
                  {execReview}
                </div>
              </div>
            )}

            {/* Team Member Avatars Row */}
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px', alignItems: 'center', justifyContent: 'center'}}>
              {reportData.map((r) => (
                <div key={r.userId} style={{display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', borderRadius: '20px', padding: '4px 12px 4px 4px', border: '1px solid #e2e8f0'}}>
                  <div style={{width: '24px', height: '24px', borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '11px'}}>{r.userName.charAt(0)}</div>
                  <span style={{fontSize: '11px', fontWeight: 700, color: '#1e293b'}}>
                    {r.userName.split(' ')[0]}
                    <span style={{color: '#64748b', fontSize: '9px', fontWeight: 600, marginLeft: '4px'}}>(C:{r.summary.crmCalls || 0} M:{r.summary.callsMade || 0} · A:{r.summary.crmApps || 0} M:{r.summary.meetingsHeld || 0})</span>
                  </span>
                </div>
              ))}
            </div>

            {/* KPI Cards: 6 across */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '24px'}}>
              {([
                {label: 'Pipeline EAV', value: `$${(metrics.totalEAV/1000000).toFixed(1)}M`, sub: 'Target Achievement', color: '#1d4ed8', bg: '#eff6ff'},
                {label: 'Total Opps', value: metrics.totalOpps, sub: 'Active Pipeline', color: '#059669', bg: '#f0fdf4'},
                {label: 'Signed Paperwork', value: metrics.totalSigned, sub: 'Governance Win', color: '#7c3aed', bg: '#f5f3ff'},
                {label: 'New Biz Started', value: metrics.totalNewBiz, sub: 'Live Freight', color: '#d97706', bg: '#fffbeb'},
                {label: 'Team Calls', value: metrics.totalCalls, sub: `CRM: ${metrics.totalCrmCalls} Touch`, color: '#1d4ed8', bg: '#eff6ff'},
                {label: 'Team Apps', value: metrics.totalApps, sub: `CRM: ${metrics.totalCrmApps} F2F`, color: '#059669', bg: '#f0fdf4'},
              ] as {label:string;value:string|number;sub:string;color:string;bg:string}[]).map((m) => (
                <div key={m.label} style={{background: m.bg, border: `1px solid ${m.color}22`, borderRadius: '12px', padding: '14px 12px', textAlign: 'center'}}>
                  <div style={{fontSize: '9px', fontWeight: 800, color: m.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', lineHeight: '1.2'}}>{m.label}</div>
                  <div style={{fontSize: '26px', fontWeight: 900, color: '#0f172a', lineHeight: '1'}}>{m.value}</div>
                  <div style={{fontSize: '8px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: '4px'}}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px'}}>
                <div style={{fontSize: '10px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px'}}>Activity & Achievement Index</div>
                <div style={{height: '200px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={9} fontWeight="bold" />
                      <YAxis fontSize={9} fontWeight="bold" />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                      <Bar dataKey="eav" fill="#3b82f6" name="EAV ($K)" radius={[3,3,0,0]} />
                      <Bar dataKey="calls" fill="#6366f1" name="Calls" radius={[3,3,0,0]} />
                      <Bar dataKey="deals" fill="#10b981" name="Deals" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px'}}>
                <div style={{fontSize: '10px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px'}}>Pipeline Distribution</div>
                <div style={{height: '200px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pipelineStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                        {pipelineStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{marginTop: '28px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>TGE Freight Group — Confidential Management Report</div>
              <div style={{fontSize: '9px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>Page 1</div>
            </div>
          </div>

          {/* ZONES 2+: One polished page per BDM */}
          {reportData.map((report, idx) => {
            const metrics = crmMetricsByUserId.get(report.userId);
            return (
              <BDMPdfPage
                key={report.userId}
                report={report}
                pageNum={idx + 2}
                weekLabel={selectedWeek.split('-W')[1] || selectedWeek.split('-')[1]}
                crmMetrics={metrics}
              />
            );
          })}

          {/* ZONES 3a/3b/3c: Group Success Plan — one page per phase */}
          {includeGroupPlan && (
            <>
              <Group90PdfPhase phase={30} phaseIndex={1} weekLabel={selectedWeek.split('-W')[1] || selectedWeek.split('-')[1]} />
              <Group90PdfPhase phase={60} phaseIndex={2} weekLabel={selectedWeek.split('-W')[1] || selectedWeek.split('-')[1]} />
              <Group90PdfPhase phase={90} phaseIndex={3} weekLabel={selectedWeek.split('-W')[1] || selectedWeek.split('-')[1]} />
            </>
          )}

        </div>
      )}

      {/* ── INTERACTIVE TAB VIEW (screen only) ─────────────────────────────── */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-auto inline-flex overflow-x-auto scrollbar-hide max-w-full">
          <TabsTrigger value="overview" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">Team Performance</TabsTrigger>
          <TabsTrigger value="group90" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><ClipboardList className="w-3 h-3 text-accent" /> Group Success Plan</TabsTrigger>
          <TabsTrigger value="strategy" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Team Strategy</TabsTrigger>
          <TabsTrigger value="opportunities" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">Opportunities</TabsTrigger>
          <TabsTrigger value="signed" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">Signed Work</TabsTrigger>
          <TabsTrigger value="business" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">New Business</TabsTrigger>
          <TabsTrigger value="opsReports" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-red-500" /> Ops Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {reportData.map((report) => {
            const metrics = crmMetricsByUserId.get(report.userId);
            return (
              <BDMReportCard 
                key={report.userId} 
                report={report} 
                onSaveFeedback={saveGMFeedback} 
                crmMetrics={metrics} 
                allDeals={allPipelineReviews || []}
                factFindings={allFactFindings}
                callPlans={allCallPlans}
                whitespacePlans={allWhitespacePlans}
              />
            );
          })}
        </TabsContent>

        <TabsContent value="group90" className="animate-in fade-in duration-500">
          {user && <OnboardingPlan userId="CORPORATE_NODE" userName="Corporate" planType="GROUP_90" />}
        </TabsContent>

        <TabsContent value="strategy" className="space-y-6">
          <StrategyTable data={teamPlans ?? []} />
        </TabsContent>

        <TabsContent value="opportunities"><OpportunitiesTable data={opportunities} /></TabsContent>
        <TabsContent value="signed"><SignedPaperworkTable data={paperwork} /></TabsContent>
        <TabsContent value="business"><NewBusinessTable data={newBusiness} /></TabsContent>
        <TabsContent value="opsReports">
          <Card className="border-none shadow-md bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm font-black uppercase text-primary">Escalated Operations Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {opsReports.length > 0 ? (
                <div className="grid gap-4">
                  {opsReports.map((report: any) => (
                    <div key={report.id} className="p-4 rounded-xl border bg-slate-50">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={report.type === 'PROBLEM' ? 'bg-orange-100 text-orange-800 border-none' : 'bg-emerald-100 text-emerald-800 border-none'}>
                          {report.type === 'PROBLEM' ? 'PROBLEM' : 'POSITIVE EVENT'}
                        </Badge>
                        <span className="font-bold text-sm text-primary">{report.userName}</span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest text-center py-10">No escalated reports for this week.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BDMReportCard({ 
  report, 
  onSaveFeedback, 
  forceOpen = false, 
  crmMetrics,
  allDeals = [],
  factFindings = [],
  callPlans = [],
  whitespacePlans = []
}: { 
  report: BDMWeeklyReport; 
  onSaveFeedback: (uid: string, f: string) => void; 
  forceOpen?: boolean; 
  crmMetrics?: CrmMetrics;
  allDeals?: any[];
  factFindings?: any[];
  callPlans?: any[];
  whitespacePlans?: any[];
}) {
  const [feedback, setFeedback] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const userDeals = useMemo(() => {
    return allDeals.filter((d: any) => d.userId === report.userId);
  }, [allDeals, report.userId]);

  const lowHealthDeals = useMemo(() => {
    const ffNames = new Set(
      factFindings
        .map((ff: any) => (ff.companyName || '').toUpperCase())
        .filter(Boolean)
    );
    const cpNames = new Set(
      callPlans
        .map((cp: any) => (cp.accountName || '').toUpperCase())
        .filter(Boolean)
    );
    const wpNames = new Set(
      whitespacePlans
        .map((wp: any) => (wp.accountName || '').toUpperCase())
        .filter(Boolean)
    );

    return userDeals.map((deal: any) => {
      const health = calculateDealHealth(deal, factFindings, callPlans, whitespacePlans);
      
      let coachingPrompt = "";
      const dealNameUpper = (deal.pipeline || '').toUpperCase();
      const oppNameUpper = (deal.opportunityName || '').toUpperCase();
      
      const hasFF = ffNames.has(dealNameUpper) || ffNames.has(oppNameUpper);
      const hasCP = cpNames.has(dealNameUpper) || cpNames.has(oppNameUpper);
      const hasWP = wpNames.has(dealNameUpper) || wpNames.has(oppNameUpper);

      if (!hasFF) {
        coachingPrompt = "Needs Fact Finding Log";
      } else if (!hasCP) {
        coachingPrompt = "Needs SPIN Call Plan";
      } else if (!hasWP) {
        coachingPrompt = "Needs Whitespace Diagnostic";
      } else if (Number(deal.daysInStage) > 30) {
        coachingPrompt = "Stalled in stage (>30 days)";
      } else {
        coachingPrompt = "Review barrier context";
      }

      return {
        ...deal,
        healthScore: health.score,
        coachingPrompt
      };
    }).filter((d: any) => d.healthScore < 40);
  }, [userDeals, factFindings, callPlans, whitespacePlans]);

  return (
    <Card className="border-none shadow-lg bg-white overflow-hidden transition-all hover:shadow-xl border-slate-200/80">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-black text-xl shadow-md border-2 border-slate-100">{report.userName.charAt(0)}</div>
            <div>
              <h3 className="font-black text-lg uppercase text-primary leading-none">{report.userName}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={cn("text-[8px] font-black uppercase border-none", report.status === 'REVIEWED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                  {report.status}
                </Badge>
                {report.submittedAt && <span className="text-[9px] font-bold text-muted-foreground uppercase">Sub: {format(report.submittedAt.toDate(), 'MMM d, h:mm a')}</span>}
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={() => setIsOpen(!isOpen)} data-html2canvas-ignore="true" className="text-accent font-black text-[10px] uppercase">
            <MessageSquare className="w-4 h-4 mr-2" /> {isOpen ? 'CLOSE FEEDBACK' : 'REVIEW NOTES'}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Calls</p>
            <p className="text-xl font-black text-primary">{report.summary.crmCalls || 0}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Man: {report.summary.callsMade || 0}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Apps</p>
            <p className="text-xl font-black text-primary">{report.summary.crmApps || 0}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Man: {report.summary.meetingsHeld || 0}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><p className="text-[9px] font-black text-blue-600 uppercase mb-1">Total EAV</p><p className="text-xl font-black text-blue-900">{formatEAV(crmMetrics?.eav ?? report.summary.totalEAV)}</p></div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-indigo-600 uppercase mb-1">Whitespace</p><p className="text-xl font-black text-primary">{report.whitespaceCount || 0}</p></div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-blue-600 uppercase mb-1">Call Plans</p><p className="text-xl font-black text-primary">{report.callPlanCount || 0}</p></div>
          <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
            <p className="text-[9px] font-black text-green-600 uppercase mb-1">New Opps</p>
            <p className="text-xl font-black text-green-900">{crmMetrics?.weekOpps ?? report.summary.newOpportunitiesCount}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">MTD: {crmMetrics?.mtdOpps ?? 0}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
            <p className="text-[9px] font-black text-purple-600 uppercase mb-1">Signed</p>
            <p className="text-xl font-black text-purple-900">{crmMetrics?.weekSigned ?? report.summary.signedPaperworkCount}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">MTD: {crmMetrics?.mtdSigned ?? 0}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
            <p className="text-[9px] font-black text-orange-600 uppercase mb-1">New Biz</p>
            <p className="text-xl font-black text-orange-900">{crmMetrics?.weekWon ?? report.summary.newBusinessCount}</p>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">MTD: {crmMetrics?.mtdWon ?? 0}</p>
          </div>
        </div>

        {(isOpen || forceOpen) && (
          <div className="mt-6 pt-6 border-t space-y-6 animate-in slide-in-from-top-4 duration-300">
             {/* 1x4 stack layout to show sections cleanly, no text truncation/clipping */}
             <div className="grid grid-cols-1 gap-6 bdm-text-fields-grid">
                <div className="bg-slate-50 p-6 rounded-2xl border min-h-[100px] h-auto text-field-container">
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> High-Level Summary (Friday)</p>
                  <div className="h-auto w-full pr-2 text-field-container">
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic whitespace-pre-line break-words">
                      "{report.weeklyNotes || 'No summary notes submitted.'}"
                    </p>
                  </div>
                </div>
                
                <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100 min-h-[100px] h-auto text-field-container">
                  <p className="text-[10px] font-black uppercase text-red-600 mb-3 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Roadblocks & Account Barriers (Monday)</p>
                  <div className="h-auto w-full pr-2 text-field-container">
                    <p className="text-sm font-bold text-red-800 leading-relaxed italic whitespace-pre-line break-words">
                      "{report.roadblocks || 'None reported.'}"
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 min-h-[100px] h-auto text-field-container">
                  <p className="text-[10px] font-black uppercase text-blue-600 mb-3 flex items-center gap-2"><LifeBuoy className="w-3.5 h-3.5" /> Management Support (Monday)</p>
                  <div className="h-auto w-full pr-2 text-field-container">
                    <p className="text-sm font-bold text-blue-800 leading-relaxed italic whitespace-pre-line break-words">
                      "{report.supportNeeded || 'None requested.'}"
                    </p>
                  </div>
                </div>

                <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 min-h-[100px] h-auto text-field-container">
                  <p className="text-[10px] font-black uppercase text-green-600 mb-3 flex items-center gap-2"><CalendarPlus className="w-3.5 h-3.5" /> Commitments for Week Ahead (Monday)</p>
                  <div className="bg-white p-4 rounded-xl border border-green-100 shadow-inner h-auto w-full text-field-container">
                    <p className="text-[11px] font-bold text-green-800 leading-relaxed whitespace-pre-line break-words">
                      {report.nextWeekCommitments || 'No tactical commitments set.'}
                    </p>
                  </div>
                </div>
             </div>

             {/* Coaching Alerts for Low Health Deals */}
             {lowHealthDeals.length > 0 && (
               <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl space-y-4">
                 <p className="text-[10px] font-black uppercase text-rose-700 flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-rose-650 animate-pulse" /> 
                   Coaching Alert: Stalled / High-Risk Deals ({lowHealthDeals.length})
                 </p>
                 <div className="space-y-2">
                   {lowHealthDeals.map((deal: any) => (
                     <div key={deal.id} className="bg-white p-4 rounded-xl border border-rose-100/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-sm">
                       <div>
                         <p className="font-bold text-xs text-slate-800 uppercase tracking-tight">{deal.pipeline}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                           Stage: {deal.stage || 'Discovery'} · Value: {formatEAV(deal.value)} · Stalled: {deal.daysInStage || 0} days
                         </p>
                       </div>
                       <div className="flex items-center gap-2 sm:self-center">
                         <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-750 border border-rose-200">
                           Health: {deal.healthScore}%
                         </span>
                         <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                           {deal.coachingPrompt}
                         </span>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {report.gmFeedback && (
               <div className="bg-accent/5 p-6 rounded-2xl border border-accent/20 h-auto text-field-container">
                  <p className="text-[10px] font-black uppercase text-accent mb-2">Historical GM Feedback</p>
                  <div className="h-auto pr-2 text-field-container">
                    <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line break-words">"{report.gmFeedback}"</p>
                  </div>
               </div>
             )}
             <div data-html2canvas-ignore="true" className="space-y-3">
                <p className="text-[10px] font-black uppercase text-primary">Provide Strategic Feedback</p>
                <div className="flex flex-wrap gap-2 mb-2">
                   <button 
                     type="button"
                     onClick={() => setFeedback("Excellent Progress: Outstanding pipeline velocity and activity levels. Whitespace plans are fully populated.")}
                     className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 px-2.5 py-1 rounded-lg transition-colors"
                   >
                     👍 Excellent Progress
                   </button>
                   <button 
                     type="button"
                     onClick={() => setFeedback("Pipeline Risk: High value deals are showing stalled days-in-stage. Focus on closing call plan outcomes this week.")}
                     className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-rose-300 text-slate-600 hover:text-rose-700 px-2.5 py-1 rounded-lg transition-colors"
                   >
                     ⚠️ Pipeline Risk
                   </button>
                   <button 
                     type="button"
                     onClick={() => setFeedback("Data Gaps: Active opportunities are missing Fact Finding discovery logs or Whitespace diagnostics. Complete these nodes.")}
                     className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-amber-300 text-slate-600 hover:text-amber-700 px-2.5 py-1 rounded-lg transition-colors"
                   >
                     🔍 Data Gaps
                   </button>
                   <button 
                     type="button"
                     onClick={() => setFeedback("Action Required: Territory activity levels (calls/apps) are currently below threshold. Prioritize customer engagement.")}
                     className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 px-2.5 py-1 rounded-lg transition-colors"
                   >
                     ⚡ Action Required
                   </button>
                </div>
                <Textarea placeholder="Coach this team member on their weekly performance..." value={feedback} onChange={(e) => setFeedback(e.target.value)} className="min-h-[100px] rounded-2xl border-primary/20 bg-white text-xs font-bold leading-relaxed" />
                <Button onClick={() => { onSaveFeedback(report.userId, feedback); setFeedback(''); }} disabled={!feedback.trim()} className="w-full bg-accent font-black uppercase text-xs h-12 rounded-xl shadow-lg">SAVE FEEDBACK NODE</Button>
             </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const GROUP_90_DEFAULT: Record<number, { focus: string; tasks: string[]; markers: string[] }> = {
  30: { focus: "Team Alignment & Grounding", tasks: ["Initial team integration to new office and services.", "Review shared territory goals.", "Establish Salesforce cadence. Allow for a reset.", "Review Non-Trading Accounts. (TGE Thursdays)", "Review under-performing accounts.", "Implement rules and processes around White Space reviews for all accounts over 100k.", "Start focusing & canvassing designated areas.", "Increase Urgency & Accountability throughout the team.", "Update Linked-In Profiles", "Review local pricing and ensure a competitive solution can be offered to SME", "Discuss WA Pricing and design WA Rate card for Parcel and small bulk.", "Discuss and Implement 'Sales & Account Management Tier / Top 10'", "Implement sales process utilising the Spin Selling Model."], markers: ["Culture fit verified.", "Salesforce cadence locked in.", "Completion of reviews for non-trading and under-performing accounts.", "BDM and AMs booking in meetings with customers.", "White Space plans completed before each call over 100k.", "16 New Business Opportunities in each zone. (North, South and AMs)", "Linked-In profile updated.", "Competitive Rate schedule created.", "Weekly review and alignment to Sales & Account Management."] },
  60: { focus: "Group Momentum", tasks: ["Run cross-territory campaigns.", "Share best practices across teams."], markers: ["Internal collaboration active."] },
  90: { focus: "Standardised Scale", tasks: ["Finalise group performance audit.", "Lock quarterly objectives."], markers: ["Elite standard achieved."] },
};

const phaseLabels: Record<number, string> = {
  30: "Phase 1: First 30 Days",
  60: "Phase 2: Days 31–60",
  90: "Phase 3: Days 61–90",
};
const phaseIds: Record<number, string> = { 30: 'gm-pdf-group90-p1', 60: 'gm-pdf-group90-p2', 90: 'gm-pdf-group90-p3' };

function Group90PdfPhase({ phase, phaseIndex, weekLabel }: { phase: 30 | 60 | 90; phaseIndex: number; weekLabel: string }) {
  const db = useFirestore();
  const { user } = useAuth();
  const configRef = useMemoFirebase(() => (db && user) ? doc(db, 'strategyConfig', 'onboardingPlans') : null, [db, user]);
  const { data: config } = useDoc(configRef);
  const progressRef = useMemoFirebase(() => (db && user) ? doc(db, 'onboardingProgress', 'SHARED_GROUP_90') : null, [db, user]);
  const { data: savedProgress } = useDoc(progressRef);

  const plans = config?.data || { GROUP_90: GROUP_90_DEFAULT };
  const plan = plans.GROUP_90 || GROUP_90_DEFAULT;
  const phaseData = plan[phase] || GROUP_90_DEFAULT[phase];
  const savedState = savedProgress?.tasks || {};

  const tasks = (phaseData?.tasks || []).map((title: string, i: number) => ({
    id: `${phase}-${i}`,
    title,
    completed: savedState[`${phase}-${i}`] === true,
  }));

  const completedCount = tasks.filter((t: any) => t.completed).length;

  return (
    <div
      id={phaseIds[phase]}
      style={{ width: '794px', background: '#fff', padding: '36px 40px 32px', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
    >
      {/* Header */}
      <div style={{ background: '#f1f5f9', borderRadius: '14px', padding: '24px 28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Section 2 — Group Success Plan (30-60-90 Day)</div>
          <div style={{ color: '#0f172a', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.3px' }}>{phaseLabels[phase]}</div>
          <div style={{ color: '#475569', fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>Focus: {phaseData?.focus}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#64748b', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Week {weekLabel} • TGE Freight</div>
          <div style={{ marginTop: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ color: '#0f172a', fontSize: '18px', fontWeight: 900 }}>{completedCount}/{tasks.length}</div>
            <div style={{ color: '#475569', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase' }}>Tasks Done</div>
          </div>
        </div>
      </div>

      {/* Two-column layout: tasks left, markers right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
        {/* Tasks */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '8px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px' }}>Action Items & Tasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map((task: any) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: task.completed ? 'none' : '1.5px solid #cbd5e1', background: task.completed ? '#10b981' : 'transparent', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {task.completed && <svg width="10" height="10" viewBox="0 0 20 20" fill="white"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>}
                </div>
                <div style={{ fontSize: '11px', color: task.completed ? '#94a3b8' : '#1e293b', lineHeight: '1.5', textDecoration: task.completed ? 'line-through' : 'none', fontWeight: task.completed ? 400 : 500 }}>{task.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Success Markers */}
        <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '8px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '14px' }}>✦ Success Markers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(phaseData?.markers || []).map((marker: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: '4px' }} />
                <div style={{ fontSize: '11px', color: '#1e293b', lineHeight: '1.5', fontWeight: 500 }}>{marker}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>TGE Freight Group — Confidential Management Report</div>
        <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700 }}>{phaseLabels[phase]}</div>
      </div>
    </div>
  );
}

function BDMPdfPage({ report, pageNum, weekLabel, crmMetrics }: { report: BDMWeeklyReport, pageNum: number, weekLabel: string, crmMetrics?: CrmMetrics }) {
  const statusColor = report.status === 'REVIEWED' ? '#059669' : '#d97706';
  const s = report.summary;
  return (
    <div
      id={`gm-pdf-bdm-${report.userId}`}
      style={{ width: '794px', background: '#fff', padding: '36px 40px 32px', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
    >
      {/* ── Header ── */}
      <div style={{ background: '#f1f5f9', borderRadius: '14px', padding: '24px 28px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#1e40af', border: '3px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '22px', flexShrink: 0 }}>
            {report.userName.charAt(0)}
          </div>
          <div>
            <div style={{ color: '#0f172a', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.3px', lineHeight: 1 }}>{report.userName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <span style={{ background: statusColor, color: '#fff', fontSize: '8px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{report.status}</span>
              {report.submittedAt && (
                <span style={{ color: '#475569', fontSize: '10px', fontWeight: 700 }}>
                  Submitted: {format(report.submittedAt.toDate(), 'MMM d, h:mm a')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#64748b', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Team Performance & Tactical Review</div>
          <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>Week {weekLabel} • TGE Freight</div>
        </div>
      </div>

      {/* ── KPI Pills ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '22px' }}>
        {([
          { label: 'Calls', value: s.callsMade || 0, subValue: s.crmCalls !== undefined ? `CRM: ${s.crmCalls}` : null, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Apps', value: s.meetingsHeld || 0, subValue: s.crmApps !== undefined ? `CRM: ${s.crmApps}` : null, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Total EAV', value: formatEAV(crmMetrics?.eav ?? s.totalEAV), color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'New Opps', value: crmMetrics?.weekOpps ?? s.newOpportunitiesCount, subValue: `MTD: ${crmMetrics?.mtdOpps ?? 0}`, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Signed', value: crmMetrics?.weekSigned ?? s.signedPaperworkCount, subValue: `MTD: ${crmMetrics?.mtdSigned ?? 0}`, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
          { label: 'New Biz', value: crmMetrics?.weekWon ?? s.newBusinessCount, subValue: `MTD: ${crmMetrics?.mtdWon ?? 0}`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        ] as {label:string;value:string|number;subValue?:string|null;color:string;bg:string;border:string}[]).map((m) => (
          <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: '10px', padding: '12px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '8px', fontWeight: 800, color: m.color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{m.value}</div>
            {m.subValue && (
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', marginTop: '4px', letterSpacing: '0.5px' }}>{m.subValue}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Text Sections: 2x2 grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* High-Level Summary */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: '#64748b', borderRadius: '2px' }} />
            <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px' }}>High-Level Summary (Friday)</div>
          </div>
          <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.7', fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            "{report.weeklyNotes || 'No summary notes submitted.'}"
          </div>
        </div>

        {/* Roadblocks */}
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: '#dc2626', borderRadius: '2px' }} />
            <div style={{ fontSize: '8px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Roadblocks & Account Barriers</div>
          </div>
          <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: '1.7', fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            "{report.roadblocks || 'None reported.'}"
          </div>
        </div>

        {/* Management Support */}
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: '#0284c7', borderRadius: '2px' }} />
            <div style={{ fontSize: '8px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Management Support Needed</div>
          </div>
          <div style={{ fontSize: '12px', color: '#0c4a6e', lineHeight: '1.7', fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            "{report.supportNeeded || 'None requested.'}"
          </div>
        </div>

        {/* Commitments */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: '#16a34a', borderRadius: '2px' }} />
            <div style={{ fontSize: '8px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Commitments for Week Ahead</div>
          </div>
          <div style={{ fontSize: '12px', color: '#14532d', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {report.nextWeekCommitments || 'No tactical commitments set.'}
          </div>
        </div>

        {/* GM Feedback (if present) */}
        {report.gmFeedback && (
          <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '16px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <div style={{ width: '3px', height: '14px', background: '#9333ea', borderRadius: '2px' }} />
              <div style={{ fontSize: '8px', fontWeight: 800, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '1.5px' }}>GM Feedback</div>
            </div>
            <div style={{ fontSize: '12px', color: '#581c87', lineHeight: '1.7', fontStyle: 'italic', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              "{report.gmFeedback}"
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>TGE Freight Group — Confidential Management Report</div>
        <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Page {pageNum}</div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon, color }: any) {
  const gradients: any = {
    blue: 'from-blue-500 to-blue-700',
    green: 'from-emerald-500 to-emerald-700',
    purple: 'from-violet-500 to-violet-700',
    orange: 'from-orange-500 to-orange-700'
  };
  return (
    <Card className="border-none shadow-xl overflow-hidden group">
      <div className={cn("bg-gradient-to-br p-6 text-white h-full", gradients[color])}>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{title}</p>
            <p className="text-3xl font-black tracking-tight">{value}</p>
            <p className="text-[9px] font-bold uppercase opacity-70 mt-1">{sub}</p>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur group-hover:scale-110 transition-transform">{icon}</div>
        </div>
      </div>
    </Card>
  );
}

function OpportunitiesTable({ data }: { data: any[] }) {
  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow className="uppercase text-[9px] font-black"><TableHead className="pl-6">Identity</TableHead><TableHead>Account</TableHead><TableHead>Opportunity</TableHead><TableHead>EAV ($K)</TableHead><TableHead>Stage</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((o) => (<TableRow key={o.id} className="hover:bg-slate-50 transition-colors"><TableCell className="pl-6 font-black uppercase text-xs">{o.userName}</TableCell><TableCell className="font-bold text-xs uppercase">{o.accountName}</TableCell><TableCell className="text-xs font-medium">{o.opportunityName}</TableCell><TableCell className="font-black text-primary">${(o.eav / 1000).toFixed(0)}k</TableCell><TableCell><Badge variant="outline" className="text-[8px] font-black border-accent/20 text-accent uppercase">{o.stage}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SignedPaperworkTable({ data }: { data: any[] }) {
  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow className="uppercase text-[9px] font-black"><TableHead className="pl-6">Identity</TableHead><TableHead>Account</TableHead><TableHead>EAV ($K)</TableHead><TableHead>Signed Date</TableHead><TableHead>Term (M)</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((p) => (<TableRow key={p.id} className="hover:bg-slate-50 transition-colors"><TableCell className="pl-6 font-black uppercase text-xs">{p.userName}</TableCell><TableCell className="font-bold text-xs uppercase">{p.accountName}</TableCell><TableCell className="font-black text-green-600">${(p.eav / 1000).toFixed(0)}k</TableCell><TableCell className="text-xs font-medium">{p.signedDate?.toDate ? format(p.signedDate.toDate(), 'MMM d') : 'N/A'}</TableCell><TableCell className="font-bold text-xs">{p.termMonths}</TableCell><TableCell className="max-w-[200px] truncate text-[10px] italic">"{p.notes}"</TableCell></TableRow>))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewBusinessTable({ data }: { data: any[] }) {
  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden border-slate-200">
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50"><TableRow className="uppercase text-[9px] font-black"><TableHead className="pl-6">Identity</TableHead><TableHead>Account</TableHead><TableHead>EAV ($K)</TableHead><TableHead>Go Live</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((b) => (<TableRow key={b.id} className="hover:bg-slate-50 transition-colors"><TableCell className="pl-6 font-black uppercase text-xs">{b.userName}</TableCell><TableCell className="font-bold text-xs uppercase">{b.accountName}</TableCell><TableCell className="font-black text-purple-600">${(b.eav / 1000).toFixed(0)}k</TableCell><TableCell className="text-xs font-medium">{b.goLiveDate?.toDate ? format(b.goLiveDate.toDate(), 'MMM d') : 'N/A'}</TableCell><TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{b.status}</Badge></TableCell></TableRow>))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StrategyTable({ data }: { data: any[] }) {
  return (
    <Card className="border-none shadow-xl bg-white overflow-hidden border-slate-200">
      <CardHeader className="bg-slate-900 text-white pb-6">
        <CardTitle className="text-xl font-black uppercase flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-accent" />
          Corporate Strategy Blueprints
        </CardTitle>
        <CardDescription className="text-slate-400">Standardized frameworks deployed by Sales Administration.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="uppercase text-[9px] font-black">
              <TableHead className="pl-6">Blueprint Name</TableHead>
              <TableHead>Primary Objective</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map(plan => (
              <TableRow key={plan.id}>
                <TableCell className="pl-6 font-black uppercase text-xs text-primary">{plan.accountName}</TableCell>
                <TableCell className="text-xs font-medium italic">"{plan.objective}"</TableCell>
                <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                  {plan.createdAt?.toDate ? format(plan.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
            {(!data || data.length === 0) && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-20 bg-slate-50/50">
                  <PhoneCall className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No strategic blueprints deployed.</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
