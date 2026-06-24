"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getNextWeekKey, formatEAV, cn } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useAuth } from '@/contexts/auth-context';
import { computeMomentum } from '@/lib/momentum';
import { 
  Sparkles, Save, Send, Copy, Check, ChevronRight, AlertTriangle, 
  Award, TrendingUp, HelpCircle, Loader2, Calendar, ClipboardCheck, Trash2, Plus, Target
} from 'lucide-react';

interface TWIWViewProps {
  userId: string;
  isLeader: boolean;
}

interface WinItem {
  id: string;
  customer: string;
  value: number;
  businessUnits: string[];
  updateText: string;
  salespersonName: string;
}

const BUSINESS_UNITS = ['Road Express', 'Ecommerce', 'Priority B2B', 'Courier'];

interface RiskItem {
  id: string;
  account: string;
  value: number;
  mitigation: string;
}

interface ProjectedWin {
  id: string;
  account: string;
  value: number;
  expectedDate: string;
}

export function TWIWView({ userId, isLeader }: TWIWViewProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const currentWeek = getCurrentWeek();
  const { pipelineReviews: allDeals } = usePipelineData();
  const { profile, user } = useAuth();

  // Active Week State
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  // Submission Form State
  const [wins, setWins] = useState<WinItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [updates, setUpdates] = useState('');
  const [projectedWins, setProjectedWins] = useState<ProjectedWin[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'NONE'>('NONE');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

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
          setWins(data.wins || []);
          setRisks(data.risks || []);
          setUpdates(data.updates || '');
          setProjectedWins(data.projectedWins || []);
          setPriorities(data.priorities || []);
          setStatus(data.status || 'DRAFT');
        } else {
          // Reset fields
          setWins([]);
          setRisks([]);
          setUpdates('');
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
        mitigation: deal.barriers || 'Flagged for stalling momentum.'
      }));

    const combined = [...risks];
    riskDeals.forEach(suggest => {
      if (!combined.some(r => r.account.toLowerCase() === suggest.account.toLowerCase())) {
        combined.push({
          id: crypto.randomUUID(),
          account: suggest.account,
          value: suggest.value,
          mitigation: suggest.mitigation
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
        expectedDate: deal.expectedDate || 'Within 30 Days'
      }));

    const combined = [...projectedWins];
    activeProjected.forEach(suggest => {
      if (!combined.some(p => p.account.toLowerCase() === suggest.account.toLowerCase())) {
        combined.push({
          id: crypto.randomUUID(),
          account: suggest.account,
          value: suggest.value,
          expectedDate: suggest.expectedDate
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
        if (!combined.includes(p)) {
          combined.push(p);
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

  const addRiskRow = () => setRisks([...risks, { id: crypto.randomUUID(), account: '', value: 0, mitigation: '' }]);
  const removeRiskRow = (id: string) => setRisks(risks.filter(r => r.id !== id));
  const updateRiskField = (id: string, field: keyof RiskItem, val: any) => {
    setRisks(risks.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const addProjectedRow = () => setProjectedWins([...projectedWins, { id: crypto.randomUUID(), account: '', value: 0, expectedDate: '' }]);
  const removeProjectedRow = (id: string) => setProjectedWins(projectedWins.filter(p => p.id !== id));
  const updateProjectedField = (id: string, field: keyof ProjectedWin, val: any) => {
    setProjectedWins(projectedWins.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const addPriority = () => {
    if (!newPriority.trim()) return;
    setPriorities([...priorities, newPriority.trim()]);
    setNewPriority('');
  };
  const removePriority = (index: number) => setPriorities(priorities.filter((_, idx) => idx !== index));

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
        projectedWins: projectedWins.filter(p => p.account.trim()),
        priorities: priorities.filter(p => p.trim()),
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
    if (!allSubmissions || allSubmissions.length === 0) return {};
    const grouped: Record<string, any[]> = {};
    
    // Filter and group by state
    allSubmissions.forEach(sub => {
      // Only include if they actually submitted or saved a draft
      if (sub.status === 'NONE' && !sub.wins?.length && !sub.risks?.length) return; 
      
      const state = sub.state || 'WA';
      if (!grouped[state]) grouped[state] = [];
      grouped[state].push(sub);
    });

    // Sort emails within each state
    Object.keys(grouped).forEach(state => {
      grouped[state].sort((a, b) => {
        const emailA = a.email || a.userName || '';
        const emailB = b.email || b.userName || '';
        return emailA.localeCompare(emailB);
      });
    });

    return grouped;
  }, [allSubmissions, selectedWeek]);

  const [isExporting, setIsExporting] = useState(false);
  const handleExportPdf = () => {
    setIsExporting(true);
    const printContents = document.getElementById('twtw-print-area')?.innerHTML;
    if (!printContents) {
      toast({ variant: "destructive", title: "Error", description: "No data available to print." });
      setIsExporting(false);
      return;
    }
    
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to export to PDF." });
      setIsExporting(false);
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>TWTW Export - Week ${selectedWeek.split('-')[1]}</title>
          <style>
            @page { size: landscape; margin: 15mm; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              -webkit-print-color-adjust: exact; 
              color-adjust: exact; 
              color: #0f172a;
            }
            h1 { font-size: 24px; text-align: center; text-transform: uppercase; margin-bottom: 30px; letter-spacing: 1px; }
            .state-container { margin-bottom: 40px; page-break-after: always; }
            .state-container:last-child { page-break-after: auto; }
            h2 { font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 16px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
            th { background-color: #f1f5f9; font-weight: 800; text-transform: uppercase; color: #475569; font-size: 10px; letter-spacing: 0.5px; }
            td { line-height: 1.4; word-break: break-word; }
            .avoid-break { page-break-inside: avoid; }
            .whitespace-pre-line { white-space: pre-line; }
            .empty-state { text-align: center; color: #64748b; font-style: italic; padding: 20px; }
          </style>
        </head>
        <body>
          <h1>The Week That Was (TWTW) - Week ${selectedWeek.split('-')[1]}</h1>
          ${printContents}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Small delay to ensure styles apply
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
        <Tabs defaultValue="my-report" className="w-full">
          <TabsList className="bg-slate-100/60 p-1 rounded-2xl grid grid-cols-2 max-w-md mb-8 h-12 border">
            <TabsTrigger value="my-report" className="rounded-xl font-black text-xs uppercase tracking-widest h-10">My Report</TabsTrigger>
            <TabsTrigger value="collation" className="rounded-xl font-black text-xs uppercase tracking-widest h-10">Collation Hub</TabsTrigger>
          </TabsList>

          <TabsContent value="my-report">
            {isLoading ? (
              <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
            ) : (
              renderSubmissionForm()
            )}
          </TabsContent>

          <TabsContent value="collation">
            {renderCollationHub()}
          </TabsContent>
        </Tabs>
      ) : (
        isLoading ? (
          <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>
        ) : (
          renderSubmissionForm()
        )
      )}
    </div>
  );

  function renderSubmissionForm() {
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
                            className="h-8 text-xs font-semibold"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            type="number"
                            value={w.value || ''} 
                            onChange={(e) => updateWinField(w.id, 'value', parseFloat(e.target.value) || 0)} 
                            placeholder="Value" 
                            className="h-8 text-xs font-black text-right text-emerald-600"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex flex-wrap gap-1">
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
                          <Input 
                            value={w.updateText} 
                            onChange={(e) => updateWinField(w.id, 'updateText', e.target.value)} 
                            placeholder="e.g. Signed contract win" 
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            value={w.salespersonName} 
                            onChange={(e) => updateWinField(w.id, 'salespersonName', e.target.value)} 
                            placeholder="Name" 
                            className="h-8 text-xs"
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
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Update</label>
                        <Input 
                          value={w.updateText} 
                          onChange={(e) => updateWinField(w.id, 'updateText', e.target.value)} 
                          placeholder="Update text" 
                          className="h-8 text-xs bg-white"
                        />
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
                      <th className="text-left pb-2 w-[40%]">Account / Cust</th>
                      <th className="text-right pb-2 w-[25%]">Value at Risk ($)</th>
                      <th className="text-left pb-2 w-[25%]">Mitigation</th>
                      <th className="text-center pb-2 w-[10%]">Action</th>
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
                            className="h-8 text-xs font-semibold"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            type="number"
                            value={r.value || ''} 
                            onChange={(e) => updateRiskField(r.id, 'value', parseFloat(e.target.value) || 0)} 
                            placeholder="Value" 
                            className="h-8 text-xs font-black text-right text-rose-600"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            value={r.mitigation} 
                            onChange={(e) => updateRiskField(r.id, 'mitigation', e.target.value)} 
                            placeholder="e.g. Setup review meeting" 
                            className="h-8 text-xs"
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
                        <td colSpan={4} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
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
              <Textarea 
                value={updates}
                onChange={e => setUpdates(e.target.value)}
                placeholder="Include a concise summary of key updates on accounts and major opportunities..."
                rows={5}
                className="text-xs font-semibold"
              />
            </CardContent>
          </Card>

          {/* 30 Day Projected Wins >$200k */}
          <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> 30 Day Projected Wins &gt;$200k
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
                      <th className="text-left pb-2 w-[40%]">Account / Cust</th>
                      <th className="text-right pb-2 w-[25%]">EAV ($)</th>
                      <th className="text-left pb-2 w-[25%]">Est. Close Date</th>
                      <th className="text-center pb-2 w-[10%]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {projectedWins.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-2">
                          <Input 
                            value={p.account} 
                            onChange={(e) => updateProjectedField(p.id, 'account', e.target.value)} 
                            placeholder="e.g. Acme Corp" 
                            className="h-8 text-xs font-semibold"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            type="number"
                            value={p.value || ''} 
                            onChange={(e) => updateProjectedField(p.id, 'value', parseFloat(e.target.value) || 0)} 
                            placeholder="Value" 
                            className="h-8 text-xs font-black text-right text-blue-600"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input 
                            value={p.expectedDate} 
                            onChange={(e) => updateProjectedField(p.id, 'expectedDate', e.target.value)} 
                            placeholder="e.g. 2026-07-15" 
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="py-2 text-center">
                          <Button variant="ghost" size="icon" onClick={() => removeProjectedRow(p.id)} className="h-8 w-8 text-red-500 rounded-xl">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {projectedWins.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                          No projected wins &gt;$200k found. Add a custom row.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked View */}
              <div className="block sm:hidden space-y-4">
                {projectedWins.map((p, idx) => (
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
                        <label className="text-[9px] font-black uppercase text-slate-400">Est. Close Date</label>
                        <Input 
                          value={p.expectedDate} 
                          onChange={(e) => updateProjectedField(p.id, 'expectedDate', e.target.value)} 
                          placeholder="e.g. 2026-07-15" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
              {/* Input row */}
              <div className="flex gap-2">
                <Input 
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  placeholder="e.g. Focus on Neerabup zone wins"
                  className="h-8 text-xs font-semibold"
                  onKeyDown={e => e.key === 'Enter' && addPriority()}
                />
                <Button size="sm" onClick={addPriority} className="h-8 text-xs font-black uppercase bg-primary px-3 rounded-xl">Add</Button>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {priorities.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center gap-3 p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold">
                    <span className="text-slate-800 leading-tight">{p}</span>
                    <Button variant="ghost" size="icon" onClick={() => removePriority(idx)} className="h-6 w-6 text-red-500 rounded-lg">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {priorities.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No priorities added yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                  disabled={isSaving || isSubmitting}
                  className="w-full bg-accent hover:bg-accent/90 text-white font-black h-11 text-xs uppercase tracking-widest rounded-2xl gap-2 shadow-lg shadow-accent/20"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {status === 'SUBMITTED' ? 'Update Submission' : 'Submit to Leadership'}
                </Button>
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
    const collatedSubmissionsCount = allSubmissions?.length || 0;
    const teamUsers = allUsers?.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER') || [];

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
                  const sub = allSubmissions?.find(s => s.userId === u.id);
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
                {teamUsers.length === 0 && (
                  <div className="text-center py-8 text-xs font-bold text-slate-400 uppercase">
                    No active BDM/AM accounts found.
                  </div>
                )}
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
              <Button 
                onClick={handleExportPdf}
                disabled={collatedSubmissionsCount === 0 || isExporting}
                className="bg-accent hover:bg-accent/90 text-white font-black h-9 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-sm"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                Export to Landscape PDF
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {/* Display View */}
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
                              <th className="p-3 w-[15%]">Email/Name</th>
                              <th className="p-3 w-[17%]">Key Wins</th>
                              <th className="p-3 w-[17%]">Churn Risk</th>
                              <th className="p-3 w-[17%]">Major Updates</th>
                              <th className="p-3 w-[17%]">30 Day Projected</th>
                              <th className="p-3 w-[17%]">Priorities</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subs.map((sub, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 align-top transition-colors">
                                <td className="p-3 font-bold text-slate-800 break-words">{sub.email || sub.userName}</td>
                                <td className="p-3 text-slate-600 whitespace-pre-line">
                                  {(sub.wins || []).map((w: any) => `• ${w.customer} - ${formatEAV(w.value)}
  BU: ${(w.businessUnits || []).join(', ') || 'N/A'}
  Rep: ${w.salespersonName || 'N/A'}
  Update: ${w.updateText || '-'}`).join('\n\n') || '-'}
                                </td>
                                <td className="p-3 text-slate-600 whitespace-pre-line text-rose-600/90">
                                  {(sub.risks || []).map((r: any) => `• ${r.account} - ${formatEAV(r.value)}\n  Mitigation: ${r.mitigation}`).join('\n\n') || '-'}
                                </td>
                                <td className="p-3 text-slate-600 whitespace-pre-line">
                                  {sub.updates || '-'}
                                </td>
                                <td className="p-3 text-slate-600 whitespace-pre-line text-blue-600/90">
                                  {(sub.projectedWins || []).map((p: any) => `• ${p.account} - ${formatEAV(p.value)}\n  (${p.expectedDate})`).join('\n\n') || '-'}
                                </td>
                                <td className="p-3 text-slate-600 whitespace-pre-line">
                                  {(sub.priorities || []).map((p: string) => `• ${p}`).join('\n') || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Hidden Print Area (used by handleExportPdf) */}
              <div id="twtw-print-area" className="hidden">
                {Object.entries(submissionsByState).map(([state, subs]) => (
                  <div key={state} className="state-container">
                    <h2>{state} Region</h2>
                    {subs.length === 0 ? (
                      <div className="empty-state">No data available for this region.</div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th style={{width: '15%'}}>Email/Name</th>
                            <th style={{width: '17%'}}>Key Wins</th>
                            <th style={{width: '17%'}}>Churn Risk</th>
                            <th style={{width: '17%'}}>Major Updates</th>
                            <th style={{width: '17%'}}>30 Day Projected</th>
                            <th style={{width: '17%'}}>Priorities</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subs.map((sub, idx) => (
                            <tr key={idx} className="avoid-break">
                              <td style={{fontWeight: 'bold'}}>{sub.email || sub.userName}</td>
                              <td className="whitespace-pre-line">
                                {(sub.wins || []).map((w: any) => `• ${w.customer} - ${formatEAV(w.value)}<br>&nbsp;&nbsp;BU: ${(w.businessUnits || []).join(', ') || 'N/A'}<br>&nbsp;&nbsp;Rep: ${w.salespersonName || 'N/A'}<br>&nbsp;&nbsp;Update: ${w.updateText || '-'}`).join('<br><br>') || '-'}
                              </td>
                              <td className="whitespace-pre-line">
                                {(sub.risks || []).map((r: any) => `• ${r.account} - ${formatEAV(r.value)}\n  Mitigation: ${r.mitigation}`).join('\n\n') || '-'}
                              </td>
                              <td className="whitespace-pre-line">
                                {sub.updates || '-'}
                              </td>
                              <td className="whitespace-pre-line">
                                {(sub.projectedWins || []).map((p: any) => `• ${p.account} - ${formatEAV(p.value)}\n  (${p.expectedDate})`).join('\n\n') || '-'}
                              </td>
                              <td className="whitespace-pre-line">
                                {(sub.priorities || []).map((p: string) => `• ${p}`).join('\n') || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}
