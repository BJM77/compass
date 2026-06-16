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
import { useToast } from '@/hooks/use-toast';
import { getCurrentWeek, getNextWeekKey, formatEAV, cn } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
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
  account: string;
  value: number;
  notes: string;
}

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
        console.error("Failed to load TWIW submission", err);
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
          account: data.accountName || 'Unknown Win',
          value: Number(data.eav) || 0,
          notes: 'Signed contract win'
        };
      });

      // Sourced from CRM opportunities marked Closed Won in current week
      const crmWins = allDeals
        .filter(deal => deal.stage === 'Closed Won')
        .map(deal => ({
          id: deal.id,
          account: deal.pipeline,
          value: Number(deal.value) || 0,
          notes: 'CRM Closed Won'
        }));

      // Combine and filter unique
      const combined = [...wins];
      [...signedWins, ...crmWins].forEach(suggest => {
        if (!combined.some(w => w.account.toLowerCase() === suggest.account.toLowerCase())) {
          combined.push({
            id: crypto.randomUUID(),
            account: suggest.account,
            value: suggest.value,
            notes: suggest.notes
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
  const addWinRow = () => setWins([...wins, { id: crypto.randomUUID(), account: '', value: 0, notes: '' }]);
  const removeWinRow = (id: string) => setWins(wins.filter(w => w.id !== id));
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
        week: selectedWeek,
        wins: wins.filter(w => w.account.trim()),
        risks: risks.filter(r => r.account.trim()),
        updates: updates.trim(),
        projectedWins: projectedWins.filter(p => p.account.trim()),
        priorities: priorities.filter(p => p.trim()),
        status: submitState,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setStatus(submitState);
      toast({
        title: submitState === 'SUBMITTED' ? "Report Submitted" : "Draft Saved",
        description: submitState === 'SUBMITTED' 
          ? "Your TWIW report has been published to Leadership." 
          : "Your updates were successfully saved as a draft."
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Operation Failed", description: "Failed to upload TWIW report." });
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  // Collate all submissions (Leaders only)
  const collatedOutput = useMemo(() => {
    if (!allSubmissions || allSubmissions.length === 0) return "No submissions available to collate yet.";

    let md = `# THE WEEK THAT WAS (TWIW) - Week ${selectedWeek.split('-')[1]}\n`;
    md += `Collated Master Report for WA Territory\n\n`;

    // 1. Key Wins
    md += `## 🏆 KEY WINS\n`;
    let winsSection = '';
    allSubmissions.forEach((sub: any) => {
      const userWins = sub.wins || [];
      userWins.forEach((w: any) => {
        winsSection += `* **[${sub.userName}]** ${w.account} — ${formatEAV(w.value)} (${w.notes || 'No extra notes'})\n`;
      });
    });
    md += winsSection || `*No key wins reported by team members.*\n`;
    md += `\n`;

    // 2. Churn Risk Flags
    md += `## ⚠️ CHURN RISK FLAGS\n`;
    let risksSection = '';
    allSubmissions.forEach((sub: any) => {
      const userRisks = sub.risks || [];
      userRisks.forEach((r: any) => {
        risksSection += `* **[${sub.userName}]** ${r.account} — ${formatEAV(r.value)} | *Mitigation:* ${r.mitigation || 'N/A'}\n`;
      });
    });
    md += risksSection || `*No active churn risk flags reported.*\n`;
    md += `\n`;

    // 3. Major Pipeline & Customer updates
    md += `## 💼 MAJOR PIPELINE & CUSTOMER UPDATES\n`;
    let updatesSection = '';
    allSubmissions.forEach((sub: any) => {
      if (sub.updates?.trim()) {
        updatesSection += `### ${sub.userName}\n${sub.updates}\n\n`;
      }
    });
    md += updatesSection || `*No pipeline updates reported.*\n`;

    // 4. 30 Day Projected Wins >$200k
    md += `## 🚀 30 DAY PROJECTED WINS >$200K\n`;
    let projectedSection = '';
    allSubmissions.forEach((sub: any) => {
      const userProjected = sub.projectedWins || [];
      userProjected.forEach((p: any) => {
        projectedSection += `* **[${sub.userName}]** ${p.account} — ${formatEAV(p.value)} (Est. Close: ${p.expectedDate})\n`;
      });
    });
    md += projectedSection || `*No projected wins >$200k reported.*\n`;
    md += `\n`;

    // 5. Top Priorities for the week ahead
    md += `## 🎯 TOP PRIORITIES FOR THE WEEK AHEAD\n`;
    let prioritiesSection = '';
    allSubmissions.forEach((sub: any) => {
      const userPriorities = sub.priorities || [];
      if (userPriorities.length > 0) {
        prioritiesSection += `### ${sub.userName}\n`;
        userPriorities.forEach((p: string) => {
          prioritiesSection += `* ${p}\n`;
        });
        prioritiesSection += `\n`;
      }
    });
    md += prioritiesSection || `*No priorities set for the week ahead.*\n`;

    return md;
  }, [allSubmissions, selectedWeek]);

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(collatedOutput);
    setCopied(true);
    toast({ title: "Copied to Clipboard", description: "Collation document ready for email or report packs." });
    setTimeout(() => setCopied(false), 2000);
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
          <h1 className="text-xl md:text-3xl font-black font-headline text-primary tracking-tighter uppercase">TWIW: The Week That Was</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Columns: Entry Fields */}
        <div className="md:col-span-2 space-y-6">
          
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAutoSuggestWins}
                className="text-[9px] font-black uppercase border-accent/20 text-accent hover:bg-accent/5 rounded-xl h-8 gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> Auto-Suggest Wins
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                      <th className="text-left pb-2 w-[40%]">Account / Cust</th>
                      <th className="text-right pb-2 w-[25%]">EAV ($)</th>
                      <th className="text-left pb-2 w-[25%]">Notes</th>
                      <th className="text-center pb-2 w-[10%]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {wins.map((w) => (
                      <tr key={w.id}>
                        <td className="py-2 pr-2">
                          <Input 
                            value={w.account} 
                            onChange={(e) => updateWinField(w.id, 'account', e.target.value)} 
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
                          <Input 
                            value={w.notes} 
                            onChange={(e) => updateWinField(w.id, 'notes', e.target.value)} 
                            placeholder="e.g. Signed contract win" 
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
                          No Wins reported yet. Add a custom row or auto-suggest wins.
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
                      <label className="text-[9px] font-black uppercase text-slate-400">Account / Cust</label>
                      <Input 
                        value={w.account} 
                        onChange={(e) => updateWinField(w.id, 'account', e.target.value)} 
                        placeholder="e.g. Acme Corp" 
                        className="h-8 text-xs font-semibold bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                        <label className="text-[9px] font-black uppercase text-slate-400">Notes</label>
                        <Input 
                          value={w.notes} 
                          onChange={(e) => updateWinField(w.id, 'notes', e.target.value)} 
                          placeholder="Notes" 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {wins.length === 0 && (
                  <div className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                    No Wins reported yet. Add a custom row or auto-suggest wins.
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAutoSuggestRisks}
                className="text-[9px] font-black uppercase border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl h-8 gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> Auto-Suggest Risks
              </Button>
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
                          No Risks flagged yet. Add a custom row or auto-suggest risks.
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
                    No Risks flagged yet. Add a custom row or auto-suggest risks.
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAutoSuggestProjected}
                className="text-[9px] font-black uppercase border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl h-8 gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> Auto-Suggest Deals
              </Button>
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
                          No projected wins &gt;$200k found. Add a custom row or auto-suggest.
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
                    No projected wins &gt;$200k found. Add a custom row or auto-suggest.
                  </div>
                )}
              </div>

              <Button onClick={addProjectedRow} variant="outline" size="sm" className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom projected win
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Column: Priorities and Submission Actions */}
        <div className="space-y-6">
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAutoSuggestPriorities}
                className="text-[9px] font-black uppercase border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl h-8 gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> Auto-Suggest
              </Button>
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
                  Submit to Leadership
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
                  <ClipboardCheck className="w-4 h-4 text-accent" /> Master North Pack Draft
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Aggregated team performance data for executive reporting
                </CardDescription>
              </div>
              <Button 
                onClick={handleCopy}
                disabled={collatedSubmissionsCount === 0}
                className="text-[10px] font-black uppercase bg-accent hover:bg-accent/90 text-white rounded-xl h-9 shadow-md shadow-accent/10 px-4 gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Collation'}
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              <div className="bg-slate-900 border border-slate-800 text-slate-300 p-5 rounded-2xl font-mono text-xs leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap select-text">
                {collatedOutput}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
}
