"use client";

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
import { cn, getCurrentWeek } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { OnboardingPlan } from './onboarding-plan';

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
  };
  weeklyNotes: string;
  roadblocks?: string;
  supportNeeded?: string;
  nextWeekCommitments?: string;
  gmFeedback?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED';
  submittedAt?: any;
}

export function GMWeeklyReview({ week: propWeek }: { week?: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = propWeek || getCurrentWeek();
  
  const [reportData, setReportData] = useState<BDMWeeklyReport[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [paperwork, setPaperwork] = useState<any[]>([]);
  const [newBusiness, setNewBusiness] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: users } = useCollection(usersQuery);

  const teamPlansQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', 'TEAM_NODE'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: teamPlans } = useCollection(teamPlansQuery);

  useEffect(() => {
    async function fetchReports() {
      if (!db || !users) return;
      setIsLoading(true);
      try {
        const [reportsSnap, commitmentsSnap, oppsSnap, paperworkSnap, businessSnap] = await Promise.all([
          getDocs(query(collection(db, 'weeklyReports'), where('week', '==', currentWeek))),
          getDocs(query(collection(db, 'weeklyCommitments'), where('week', '==', currentWeek))),
          getDocs(query(collection(db, 'opportunities'), where('week', '==', currentWeek))),
          getDocs(query(collection(db, 'signedPaperwork'), where('week', '==', currentWeek))),
          getDocs(query(collection(db, 'newBusiness'), where('week', '==', currentWeek)))
        ]);

        const bdms = users.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER');
        
        const reports = bdms.map(bdm => {
          const reportDoc = reportsSnap.docs.find(d => d.data().userId === bdm.id);
          const commitmentDoc = commitmentsSnap.docs.find(d => d.data().userId === bdm.id);
          
          const reportData = reportDoc?.data();
          const commitData = commitmentDoc?.data();

          // Join actionPlan array into a single string for display
          const joinedCommitments = commitData?.actionPlan?.length > 0 
            ? commitData?.actionPlan?.map((a: string, i: number) => a.trim() ? `${i+1}. ${a}` : '').filter((a: string) => a).join('\n')
            : commitData?.nextWeekCommitments || '';

          return {
            id: reportDoc?.id,
            userId: bdm.id,
            userName: bdm.name,
            week: currentWeek,
            summary: reportData?.summary || { totalEAV: 0, newOpportunitiesCount: 0, signedPaperworkCount: 0, newBusinessCount: 0, callsMade: 0, meetingsHeld: 0 },
            weeklyNotes: reportData?.weeklyNotes || '',
            roadblocks: commitData?.roadblocks || '',
            supportNeeded: commitData?.supportNeeded || '',
            nextWeekCommitments: joinedCommitments,
            gmFeedback: reportData?.gmFeedback || '',
            status: reportData?.status || 'DRAFT',
            submittedAt: reportData?.submittedAt
          } as BDMWeeklyReport;
        });

        setReportData(reports);
        setOpportunities(oppsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPaperwork(paperworkSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setNewBusiness(businessSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchReports();
  }, [db, users, currentWeek]);

  const saveGMFeedback = async (userId: string, feedback: string) => {
    if (!db) return;
    try {
      // Use the actual doc ID from loaded state when available.
      // Falls back to the canonical pattern if report wasn't loaded from Firestore yet.
      const existingReport = reportData.find(r => r.userId === userId);
      const reportId = existingReport?.id || `${userId}_${currentWeek}`;
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

  const exportReport = () => {
    const headers = ['Identity', 'Calls', 'Apps', 'Total EAV', 'New Opps', 'Signed Deals', 'New Business', 'Status'];
    const rows = reportData.map(r => [
      r.userName, 
      r.summary.callsMade || 0,
      r.summary.meetingsHeld || 0,
      r.summary.totalEAV, 
      r.summary.newOpportunitiesCount, 
      r.summary.signedPaperworkCount, 
      r.summary.newBusinessCount, 
      r.status
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TGE_GM_Review_${currentWeek}.csv`;
    a.click();
    toast({ title: "Export Complete" });
  };

  const handleDispatchToGM = async (isBW = false) => {
    setIsGeneratingPDF(true);
    
    // Delay to allow DOM to render the unrolled layout fully and animations to finish
    setTimeout(async () => {
      try {
        const element = document.getElementById('gm-report-capture');
        if (!element) throw new Error("Capture element not found");
        
        toast({ title: "Generating PDF", description: "Compiling Multi-Page A4 Report..." });
        
        const canvas = await html2canvas(element, { 
          scale: 4, // Increased to 4x for extreme clarity
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const style = clonedDoc.createElement('style');
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
                /* Force all text to be high-contrast dark slate/black */
                p, span, h1, h2, h3, h4, th, td, div { 
                  color: #0f172a !important; 
                }
                /* Exceptions for badges/accents to keep some branding but ensure they are dark */
                .text-accent, .text-blue-600, .text-emerald-600, .text-purple-600, .text-orange-600 {
                  color: #1e293b !important;
                  font-weight: 900 !important;
                }
                .text-muted-foreground, .text-slate-400 {
                  color: #475569 !important;
                  opacity: 1 !important;
                }
                /* Ensure backgrounds are solid and visible */
                .bg-slate-50, .bg-blue-50, .bg-green-50, .bg-purple-50, .bg-amber-50 {
                  background-color: #f8fafc !important;
                  opacity: 1 !important;
                }
                /* Remove shadows and blurs which can cause artifacts in html2canvas */
                .shadow-xl, .shadow-lg, .shadow-sm, .backdrop-blur {
                  box-shadow: none !important;
                  backdrop-filter: none !important;
                }
                /* Ensure borders are crisp */
                .border, .border-b, .border-t {
                  border-color: #e2e8f0 !important;
                }
              `;
            }
            style.innerHTML = css;
            clonedDoc.head.appendChild(style);
          }
        });
        
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // A4 dimensions in pt: 595.28 x 841.89
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 24; // 24pt margins
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const pdf = new jsPDF('p', 'pt', 'a4');
        let heightLeft = imgHeight;
        let position = margin;
        
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
        
        while (heightLeft > 0) {
          position -= (pageHeight - margin * 2);
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= (pageHeight - margin * 2);
        }
        
        const fileName = isBW ? `GM_Dispatch_Report_BW_Week_${currentWeek}.pdf` : `GM_Dispatch_Report_Week_${currentWeek}.pdf`;
        pdf.save(fileName);
        toast({ title: "Dispatch Complete", description: "Multi-page A4 PDF downloaded successfully." });
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF." });
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 1000); // 1s delay to ensure all CSS animations complete
  };

  const metrics = useMemo(() => {
    const totalEAV = reportData.reduce((sum, r) => sum + (r.summary.totalEAV || 0), 0);
    const totalNewOpps = opportunities.length;
    const totalSigned = paperwork.length;
    const totalNewBiz = newBusiness.length;
    const totalCalls = reportData.reduce((sum, r) => sum + (r.summary.callsMade || 0), 0);
    const totalApps = reportData.reduce((sum, r) => sum + (r.summary.meetingsHeld || 0), 0);
    return { totalEAV, totalNewOpps, totalSigned, totalNewBiz, totalCalls, totalApps };
  }, [reportData, opportunities, paperwork, newBusiness]);

  const performanceData = reportData.map(r => ({
    name: r.userName.split(' ')[0],
    eav: (r.summary.totalEAV || 0) / 1000,
    deals: r.summary.signedPaperworkCount || 0,
    calls: r.summary.callsMade || 0
  }));

  const pipelineStatusData = [
    { name: 'New Opps', value: opportunities.length, color: '#3b82f6' },
    { name: 'Signed', value: paperwork.length, color: '#10b981' },
    { name: 'Portfolio', value: newBusiness.length, color: '#8b5cf6' }
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
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Week {currentWeek.split('-')[1]} • Team Performance & Pipeline Health</p>
        </div>
        <div className="flex gap-2" data-html2canvas-ignore="true">
          <Button variant="outline" onClick={exportReport} className="font-black text-[10px] uppercase h-10 bg-white">
            <Download className="w-4 h-4 mr-2" /> EXPORT CSV
          </Button>
          <Button onClick={() => handleDispatchToGM(true)} disabled={isGeneratingPDF} className="bg-slate-800 hover:bg-slate-700 font-black text-[10px] uppercase h-10 text-white shadow-lg shadow-slate-800/20">
            {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck className="w-4 h-4 mr-2" />} 
            {isGeneratingPDF ? 'COMPILING...' : 'DISPATCH (B&W)'}
          </Button>
          <Button onClick={() => handleDispatchToGM(false)} disabled={isGeneratingPDF} className="bg-primary font-black text-[10px] uppercase h-10 text-white shadow-lg shadow-primary/20">
            {isGeneratingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} 
            {isGeneratingPDF ? 'COMPILING...' : 'DISPATCH TO GM'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Pipeline EAV" value={`$${(metrics.totalEAV / 1000000).toFixed(1)}M`} sub="Target Achievement" icon={<DollarSign className="w-5 h-5" />} color="blue" />
        <MetricCard title="New Opps" value={metrics.totalNewOpps} sub="Weekly Growth" icon={<Target className="w-5 h-5" />} color="green" />
        <MetricCard title="Signed Paperwork" value={metrics.totalSigned} sub="Governance Win" icon={<FileCheck className="w-5 h-5" />} color="purple" />
        <MetricCard title="New Biz Started" value={metrics.totalNewBiz} sub="Live Freight" icon={<Rocket className="w-5 h-5" />} color="orange" />
        <MetricCard title="Team Calls" value={metrics.totalCalls} sub="Customer Touch" icon={<Phone className="w-5 h-5" />} color="blue" />
        <MetricCard title="Team Apps" value={metrics.totalApps} sub="Face to Face" icon={<CalendarCheck className="w-5 h-5" />} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b"><CardTitle className="text-sm font-black uppercase">Activity & Achievement Index</CardTitle></CardHeader>
          <CardContent className="h-80 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                <YAxis fontSize={10} fontWeight="bold" />
                <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                <Bar dataKey="eav" fill="#3b82f6" name="EAV ($K)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" fill="#6366f1" name="Calls" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deals" fill="#10b981" name="Deals" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50 border-b"><CardTitle className="text-sm font-black uppercase">Pipeline Distribution</CardTitle></CardHeader>
          <CardContent className="h-80 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pipelineStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pipelineStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase'}} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {isGeneratingPDF ? (
        <div className="space-y-16 pt-8 bg-white text-slate-900 rounded-2xl p-8 border shadow-sm">
          <div>
            <div className="border-b-2 border-primary pb-3 mb-6">
              <h2 className="text-2xl font-black uppercase text-primary tracking-tight">1. Team Performance & Tactical Review</h2>
            </div>
            <div className="space-y-6">
              {reportData.map((report) => (
                <BDMReportCard key={report.userId} report={report} onSaveFeedback={saveGMFeedback} forceOpen={true} />
              ))}
            </div>
          </div>

          <div className="pt-8">
            <div className="border-b-2 border-primary pb-3 mb-6">
              <h2 className="text-2xl font-black uppercase text-primary tracking-tight">2. Group Success Plan (90-Day Milestones)</h2>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <OnboardingPlan userId="CORPORATE_NODE" userName="Corporate" planType="GROUP_90" />
            </div>
          </div>

          <div className="pt-8">
            <div className="border-b-2 border-primary pb-3 mb-6">
              <h2 className="text-2xl font-black uppercase text-primary tracking-tight">3. Corporate Strategy Blueprints</h2>
            </div>
            <StrategyTable data={teamPlans ?? []} />
          </div>

          <div className="pt-8">
            <div className="border-b-2 border-primary pb-3 mb-6">
              <h2 className="text-2xl font-black uppercase text-primary tracking-tight">4. Active Pipeline Opportunities</h2>
            </div>
            <OpportunitiesTable data={opportunities} />
          </div>

          <div className="pt-8">
            <div className="border-b-2 border-primary pb-3 mb-6">
              <h2 className="text-2xl font-black uppercase text-primary tracking-tight">5. Signed Governance Work</h2>
            </div>
            <SignedPaperworkTable data={paperwork} />
          </div>

          <div className="pt-8">
            <div className="border-b-2 border-primary pb-3 mb-6">
              <h2 className="text-2xl font-black uppercase text-primary tracking-tight">6. Live Freight & New Business</h2>
            </div>
            <NewBusinessTable data={newBusiness} />
          </div>
        </div>
      ) : (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-auto inline-flex overflow-x-auto scrollbar-hide max-w-full">
            <TabsTrigger value="overview" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">Team Performance</TabsTrigger>
            <TabsTrigger value="group90" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><ClipboardList className="w-3 h-3 text-accent" /> Group Success Plan</TabsTrigger>
            <TabsTrigger value="strategy" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Team Strategy</TabsTrigger>
            <TabsTrigger value="opportunities" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">Opportunities</TabsTrigger>
            <TabsTrigger value="signed" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">Signed Work</TabsTrigger>
            <TabsTrigger value="business" className="rounded-lg px-6 py-2.5 font-black uppercase text-[10px] tracking-widest">New Business</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {reportData.map((report) => (
              <BDMReportCard key={report.userId} report={report} onSaveFeedback={saveGMFeedback} />
            ))}
          </TabsContent>

          <TabsContent value="group90" className="animate-in fade-in duration-500">
             <OnboardingPlan userId="CORPORATE_NODE" userName="Corporate" planType="GROUP_90" />
          </TabsContent>

          <TabsContent value="strategy" className="space-y-6">
             <StrategyTable data={teamPlans ?? []} />
          </TabsContent>

          <TabsContent value="opportunities"><OpportunitiesTable data={opportunities} /></TabsContent>
          <TabsContent value="signed"><SignedPaperworkTable data={paperwork} /></TabsContent>
          <TabsContent value="business"><NewBusinessTable data={newBusiness} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function BDMReportCard({ report, onSaveFeedback, forceOpen = false }: { report: BDMWeeklyReport; onSaveFeedback: (uid: string, f: string) => void; forceOpen?: boolean }) {
  const [feedback, setFeedback] = useState('');
  const [isOpen, setIsOpen] = useState(false);

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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-blue-600 uppercase mb-1">Calls</p><p className="text-xl font-black text-primary">{report.summary.callsMade || 0}</p></div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Apps</p><p className="text-xl font-black text-primary">{report.summary.meetingsHeld || 0}</p></div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><p className="text-[9px] font-black text-blue-600 uppercase mb-1">Total EAV</p><p className="text-xl font-black text-blue-900">${(report.summary.totalEAV / 1000).toFixed(0)}K</p></div>
          <div className="bg-green-50 p-4 rounded-2xl border border-green-100"><p className="text-[9px] font-black text-green-600 uppercase mb-1">New Opps</p><p className="text-xl font-black text-green-900">{report.summary.newOpportunitiesCount}</p></div>
          <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100"><p className="text-[9px] font-black text-purple-600 uppercase mb-1">Signed</p><p className="text-xl font-black text-purple-900">{report.summary.signedPaperworkCount}</p></div>
          <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100"><p className="text-[9px] font-black text-orange-600 uppercase mb-1">New Biz</p><p className="text-xl font-black text-orange-900">{report.summary.newBusinessCount}</p></div>
        </div>

        {(isOpen || forceOpen) && (
          <div className="mt-6 pt-6 border-t space-y-6 animate-in slide-in-from-top-4 duration-300">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-2xl border">
                  <p className="text-[10px] font-black uppercase text-muted-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> High-Level Summary (Friday)</p>
                  <div className="max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic whitespace-pre-line">
                      "{report.weeklyNotes || 'No summary notes submitted.'}"
                    </p>
                  </div>
                </div>
                <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
                  <p className="text-[10px] font-black uppercase text-red-600 mb-3 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Roadblocks & Account Barriers (Monday)</p>
                  <div className="max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                    <p className="text-sm font-bold text-red-800 leading-relaxed italic whitespace-pre-line">
                      "{report.roadblocks || 'None reported.'}"
                    </p>
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-black uppercase text-blue-600 mb-3 flex items-center gap-2"><LifeBuoy className="w-3.5 h-3.5" /> Management Support (Monday)</p>
                  <div className="max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                    <p className="text-sm font-bold text-blue-800 leading-relaxed italic whitespace-pre-line">
                      "{report.supportNeeded || 'None requested.'}"
                    </p>
                  </div>
                </div>
                <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100">
                  <p className="text-[10px] font-black uppercase text-green-600 mb-3 flex items-center gap-2"><CalendarPlus className="w-3.5 h-3.5" /> Commitments for Week Ahead (Monday)</p>
                  <div className="bg-white p-3 rounded-xl border border-green-100 shadow-inner max-h-[200px] overflow-y-auto scrollbar-thin">
                    <p className="text-[11px] font-bold text-green-800 leading-relaxed whitespace-pre-line">
                      {report.nextWeekCommitments || 'No tactical commitments set.'}
                    </p>
                  </div>
                </div>
             </div>

             {report.gmFeedback && (
               <div className="bg-accent/5 p-6 rounded-2xl border border-accent/20">
                  <p className="text-[10px] font-black uppercase text-accent mb-2">Historical GM Feedback</p>
                  <div className="max-h-[150px] overflow-y-auto pr-2 scrollbar-thin">
                    <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">"{report.gmFeedback}"</p>
                  </div>
               </div>
             )}
             <div data-html2canvas-ignore="true" className="space-y-3">
                <p className="text-[10px] font-black uppercase text-primary">Provide Strategic Feedback</p>
                <Textarea placeholder="Coach this team member on their weekly performance..." value={feedback} onChange={(e) => setFeedback(e.target.value)} className="min-h-[100px] rounded-2xl border-primary/20 bg-white" />
                <Button onClick={() => onSaveFeedback(report.userId, feedback)} disabled={!feedback.trim()} className="w-full bg-accent font-black uppercase text-xs h-12 rounded-xl shadow-lg">SAVE FEEDBACK NODE</Button>
             </div>
          </div>
        )}
      </div>
    </Card>
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
          <TableHeader className="bg-slate-50"><TableRow className="uppercase text-[9px] font-black"><TableHead className="pl-6">Identity</TableHead><TableHead>Account</TableHead><TableHead>Opportunity</TableHead><TableHead>EAV ($K)</TableHead><TableHead>Prob (%)</TableHead><TableHead>Stage</TableHead><TableHead>Expected Close</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((o) => (<TableRow key={o.id} className="hover:bg-slate-50 transition-colors"><TableCell className="pl-6 font-black uppercase text-xs">{o.userName}</TableCell><TableCell className="font-bold text-xs uppercase">{o.accountName}</TableCell><TableCell className="text-xs font-medium">{o.opportunityName}</TableCell><TableCell className="font-black text-primary">${(o.eav / 1000).toFixed(0)}k</TableCell><TableCell className="font-bold text-xs">{o.probability}%</TableCell><TableCell><Badge variant="outline" className="text-[8px] font-black border-accent/20 text-accent uppercase">{o.stage}</Badge></TableCell><TableCell className="text-[9px] font-bold text-muted-foreground uppercase">{o.expectedCloseDate?.toDate ? format(o.expectedCloseDate.toDate(), 'MMM d') : 'TBC'}</TableCell></TableRow>))}</TableBody>
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
          <TableHeader className="bg-slate-50"><TableRow className="uppercase text-[9px] font-black"><TableHead className="pl-6">Identity</TableHead><TableHead>Account</TableHead><TableHead>EAV ($K)</TableHead><TableHead>Go Live</TableHead><TableHead>Status</TableHead><TableHead>AE</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((b) => (<TableRow key={b.id} className="hover:bg-slate-50 transition-colors"><TableCell className="pl-6 font-black uppercase text-xs">{b.userName}</TableCell><TableCell className="font-bold text-xs uppercase">{b.accountName}</TableCell><TableCell className="font-black text-purple-600">${(b.eav / 1000).toFixed(0)}k</TableCell><TableCell className="text-xs font-medium">{b.goLiveDate?.toDate ? format(b.goLiveDate.toDate(), 'MMM d') : 'N/A'}</TableCell><TableCell><Badge variant="outline" className="text-[8px] font-black uppercase">{b.status}</Badge></TableCell><TableCell className="text-[10px] font-bold uppercase">{b.assignedAE}</TableCell></TableRow>))}</TableBody>
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
