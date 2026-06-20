"use client";

import { useState, useMemo, useEffect } from 'react';
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
  Target, Database
} from 'lucide-react';

// Type definitions
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

export function DemoDashView() {
  const { toast } = useToast();

  // --- Simulation Controls State ---
  const [simUserRole, setSimUserRole] = useState<'REGISTERED' | 'GUEST'>('REGISTERED');
  const [simDay, setSimDay] = useState<'THURSDAY' | 'FRIDAY'>('THURSDAY');

  // --- Mock Database / State ---
  // Previous Friday's Plan
  const defaultPrevFridayPlan = {
    focusAccounts: [
      { id: 'fa1', accountName: 'ACME LOGISTICS', actionType: 'Develop', eav: 150000, aboutAccount: 'Meet operations director to discuss trial route.' },
      { id: 'fa2', accountName: 'ZENITH MANUFACTURING', actionType: 'Propose', eav: 280000, aboutAccount: 'Submit final contract terms by Wednesday.' },
      { id: 'fa3', accountName: 'PACIFIC DISTRIBUTORS', actionType: 'Prospect', eav: 95000, aboutAccount: 'Introductory discovery call.' }
    ] as FocusAccount[],
    kpiTargets: {
      callsToMake: 50,
      appointmentsToSet: 15,
      proposalsToSend: 8,
      dealsToClose: 3,
      revenueTarget: 250000
    } as KPITargets,
    actionPlan: [
      'Conduct ACME trial presentation on Tuesday morning',
      'Finalise Zenith proposal pricing markup',
      'Follow up on Pacific Distributors call schedule',
      'Audit Western trade region whitespace list',
      'Attend Thursday leadership pipeline sync'
    ] as string[],
    roadblocks: 'Direct competitor offering 10% spot discount in Western region.',
    supportNeeded: 'Need commercial credit approval for Zenith credit limit extension.'
  };

  const [dbPrevFridayPlan, setDbPrevFridayPlan] = useState(defaultPrevFridayPlan);

  // Thursday TWTW Submission Data
  const [wins, setWins] = useState<WinItem[]>([]);
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [updates, setUpdates] = useState('');
  const [projectedWins, setProjectedWins] = useState<ProjectedWin[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState('');
  const [twtwStatus, setTwtwStatus] = useState<'NONE' | 'DRAFT' | 'SUBMITTED'>('NONE');

  // TWTW Registered-only Extra Data
  const [twtwFocusAccounts, setTwtwFocusAccounts] = useState<FocusAccount[]>([]);
  const [twtwKpiActuals, setTwtwKpiActuals] = useState<KPITargetsActuals>({
    callsToMake: 50, appointmentsToSet: 15, proposalsToSend: 8, dealsToClose: 3, revenueTarget: 250000,
    callsMade: 0, appointmentsSet: 0, proposalsSent: 0, dealsClosed: 0, revenueWon: 0
  });
  const [twtwRoadblocks, setTwtwRoadblocks] = useState('');
  const [twtwSupport, setTwtwSupport] = useState('');

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
    setProjectedWins([]);
    setPriorities([]);
    setTwtwStatus('NONE');
    setTwtwFocusAccounts([]);
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

    toast({ title: "Reset Complete", description: "Simulation database reset to defaults." });
  };

  // --- Thursday Pre-population triggers ---
  const handleLoadPreviousFridayData = () => {
    // 1. Priorities are populated from previous actions
    setPriorities([...dbPrevFridayPlan.actionPlan]);
    // 2. Focus accounts loaded
    setTwtwFocusAccounts(dbPrevFridayPlan.focusAccounts.map(acc => ({ ...acc, status: 'WORKING', update: '' })));
    // 3. KPI targets mapped & actuals simulated
    setTwtwKpiActuals({
      ...dbPrevFridayPlan.kpiTargets,
      callsMade: 43,
      appointmentsSet: 11,
      proposalsSent: 6,
      dealsClosed: 1,
      revenueWon: 150000
    });
    // 4. Roadblocks & support mapped
    setTwtwRoadblocks(dbPrevFridayPlan.roadblocks);
    setTwtwSupport(dbPrevFridayPlan.supportNeeded);

    // Auto-fill Wins, Risks, Projected using CRM Logic
    setWins([
      { id: 'w1', account: 'ACME LOGISTICS', value: 150000, notes: 'Signed develop agreement, trial scheduled!' }
    ]);
    setRisks([
      { id: 'r1', account: 'GLOBAL CARRIERS', value: 80000, mitigation: 'Reviewing rates & negotiating spot discounts.' }
    ]);
    setProjectedWins([
      { id: 'p1', account: 'ZENITH MANUFACTURING', value: 280000, expectedDate: 'End of month' }
    ]);
    setUpdates('Zenith and ACME progressed strongly. Global Carriers remains a minor rate risk.');

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
    setFridaySignedDeals(wins.map(w => ({ id: w.id, accountName: w.account, eav: w.value, notes: w.notes })));
    setFridayOpportunities(projectedWins.map(p => ({ id: p.id, accountName: p.account, eav: p.value, stage: 'Propose', probability: 50 })));
    
    toast({
      title: "Thursday Data Pulled",
      description: "Friday pack details initialized from Thursday TWTW submissions & wins."
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
  const handleAddWin = () => setWins([...wins, { id: crypto.randomUUID(), account: '', value: 0, notes: '' }]);
  const handleDeleteWin = (id: string) => setWins(wins.filter(w => w.id !== id));

  const handleAddRisk = () => setRisks([...risks, { id: crypto.randomUUID(), account: '', value: 0, mitigation: '' }]);
  const handleDeleteRisk = (id: string) => setRisks(risks.filter(r => r.id !== id));

  const handleAddProjected = () => setProjectedWins([...projectedWins, { id: crypto.randomUUID(), account: '', value: 0, expectedDate: '' }]);
  const handleDeleteProjected = (id: string) => setProjectedWins(projectedWins.filter(p => p.id !== id));

  const handleAddPriority = () => {
    if (!newPriority.trim()) return;
    setPriorities([...priorities, newPriority.trim()]);
    setNewPriority('');
  };
  const handleDeletePriority = (idx: number) => setPriorities(priorities.filter((_, i) => i !== idx));

  // --- PDF Export helper ---
  const handleExportPdf = () => {
    const printContents = document.getElementById('twtw-demo-print-area')?.innerHTML;
    if (!printContents) {
      toast({ variant: "destructive", title: "Error", description: "No data available to print." });
      return;
    }
    
    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to export to PDF." });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>TWTW Demo Master Collation - Landscape</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 10px;
            }
            h1 { font-size: 18px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; letter-spacing: -0.5px; }
            p.subtitle { font-size: 9px; font-weight: bold; color: #64748b; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
            .region-title { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px; margin-bottom: 8px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9px; vertical-align: top; text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
            th { background-color: #f8fafc; font-weight: 800; text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px; color: #475569; }
            .bold { font-weight: bold; }
            .rose { color: #be123c; }
            .blue { color: #1d4ed8; }
            .whitespace-pre-line { white-space: pre-line; }
            .avoid-break { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <h1>The Week That Was - Executive Weekly Briefing</h1>
          <p class="subtitle">Consolidated Team Summary • Landscape Report</p>
          ${printContents}
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
    const userWinsFormatted = wins.map(w => `• ${w.account || 'TBC'} ($${w.value.toLocaleString()}) - ${w.notes}`).join('\n') || '-';
    const userRisksFormatted = risks.map(r => `• ${r.account || 'TBC'} ($${r.value.toLocaleString()})\n  Mitigation: ${r.mitigation}`).join('\n\n') || '-';
    const userProjectedFormatted = projectedWins.map(p => `• ${p.account || 'TBC'} ($${p.value.toLocaleString()}) (${p.expectedDate})`).join('\n') || '-';
    
    let userPrioritiesFormatted = priorities.map(p => `• ${p}`).join('\n') || '-';
    let userUpdatesFormatted = updates || '-';

    // If registered user, append extra monday/friday metrics to details for collation
    if (simUserRole === 'REGISTERED') {
      const kpis = `[KPI Actuals: ${twtwKpiActuals.callsMade}/${twtwKpiActuals.callsToMake} Calls, ${twtwKpiActuals.appointmentsSet}/${twtwKpiActuals.appointmentsToSet} Appts]`;
      const faCount = twtwFocusAccounts.length > 0 ? `\n[Focus Accounts Active: ${twtwFocusAccounts.length}]` : '';
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
  }, [wins, risks, updates, projectedWins, priorities, simUserRole, twtwKpiActuals, twtwFocusAccounts, twtwRoadblocks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Simulation Control Banner */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-amber-500 text-slate-950 rounded-lg"><Beaker className="w-4 h-4 animate-pulse" /></span>
            <h2 className="text-sm font-black uppercase tracking-widest text-amber-400">Consolidated Reporting Simulator</h2>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Use these switches to test what happens when staff roles and days change.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* User Type Toggle */}
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Staff User Role</label>
            <div className="flex bg-slate-850 p-1 rounded-xl border border-slate-700">
              <button 
                onClick={() => setSimUserRole('REGISTERED')}
                className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", 
                  simUserRole === 'REGISTERED' ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                Registered Staff
              </button>
              <button 
                onClick={() => setSimUserRole('GUEST')}
                className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", 
                  simUserRole === 'GUEST' ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                Guest User
              </button>
            </div>
          </div>

          {/* Simulated Day Toggle */}
          <div className="space-y-1">
            <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider block">Simulation Phase</label>
            <div className="flex bg-slate-850 p-1 rounded-xl border border-slate-700">
              <button 
                onClick={() => setSimDay('THURSDAY')}
                className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", 
                  simDay === 'THURSDAY' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                Thursday (TWTW)
              </button>
              <button 
                onClick={() => setSimDay('FRIDAY')}
                className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", 
                  simDay === 'FRIDAY' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                )}
              >
                Friday (Combined Pack)
              </button>
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={resetAllData} 
            className="h-10 text-[9px] font-black uppercase tracking-wider border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5 rounded-xl self-end"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Demo
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="simulator" className="w-full">
        <TabsList className="bg-white border p-1.5 rounded-2xl shadow-sm mb-6 w-full md:w-auto flex flex-col md:flex-row gap-1">
          <TabsTrigger value="simulator" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <Beaker className="w-3.5 h-3.5 text-indigo-600" /> BDM Simulator
          </TabsTrigger>
          <TabsTrigger value="collation" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" /> Executive Collation (TWTW PDF)
          </TabsTrigger>
          <TabsTrigger value="guide" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <Info className="w-3.5 h-3.5 text-amber-500" /> Architectural Design
          </TabsTrigger>
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

        {/* --- TAB 2: INTERACTIVE SIMULATOR --- */}
        <TabsContent value="simulator" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Side - Current Day View */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* --- THURSDAY TWTW REPORT FORM --- */}
              {simDay === 'THURSDAY' && (
                <div className="space-y-6">
                  <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden gap-4">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32" /></div>
                    <div className="relative z-10 space-y-1">
                      <Badge className="bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest px-2.5 mb-1">
                        Thursday Afternoon Deadline
                      </Badge>
                      <h3 className="text-xl font-black uppercase tracking-tight">The Week That Was (TWTW)</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Role View: {simUserRole === 'GUEST' ? 'Guest User (Standard Questions)' : 'Registered Staff (Extended Context)'}
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

                  {/* Standard Questions - All Users */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500" /> Standard TWTW Core (Wins & Risks)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      
                      {/* Wins Table */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Key Wins (This Week)</label>
                          <Button variant="outline" size="sm" onClick={handleAddWin} className="h-7 text-[9px] font-black uppercase gap-1.5 border-dashed border-2 rounded-lg">
                            <Plus className="w-3 h-3" /> Add Win Row
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {wins.map((w, index) => (
                            <div key={w.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl relative group align-center">
                              <div className="col-span-4">
                                <Input placeholder="Account Name..." value={w.account} onChange={e => {
                                  const list = [...wins];
                                  list[index].account = e.target.value;
                                  setWins(list);
                                }} className="h-9 text-xs font-bold bg-white rounded-xl" />
                              </div>
                              <div className="col-span-3 relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                                <Input type="number" placeholder="Value..." value={w.value || ''} onChange={e => {
                                  const list = [...wins];
                                  list[index].value = parseFloat(e.target.value) || 0;
                                  setWins(list);
                                }} className="h-9 pl-6 text-xs font-bold bg-white rounded-xl" />
                              </div>
                              <div className="col-span-4">
                                <Input placeholder="Wins Notes..." value={w.notes} onChange={e => {
                                  const list = [...wins];
                                  list[index].notes = e.target.value;
                                  setWins(list);
                                }} className="h-9 text-xs font-medium bg-white rounded-xl" />
                              </div>
                              <div className="col-span-1 flex items-center justify-end">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteWin(w.id)} className="h-8 w-8 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                          {wins.length === 0 && <p className="text-[10px] text-muted-foreground italic">No wins added. Load previous Friday data or add manually.</p>}
                        </div>
                      </div>

                      {/* Risks Table */}
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Churn Risks / Competitor Activity</label>
                          <Button variant="outline" size="sm" onClick={handleAddRisk} className="h-7 text-[9px] font-black uppercase gap-1.5 border-dashed border-2 rounded-lg">
                            <Plus className="w-3 h-3" /> Add Risk Row
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {risks.map((r, index) => (
                            <div key={r.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl relative group">
                              <div className="col-span-4">
                                <Input placeholder="Account Name..." value={r.account} onChange={e => {
                                  const list = [...risks];
                                  list[index].account = e.target.value;
                                  setRisks(list);
                                }} className="h-9 text-xs font-bold bg-white rounded-xl" />
                              </div>
                              <div className="col-span-3 relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                                <Input type="number" placeholder="Value..." value={r.value || ''} onChange={e => {
                                  const list = [...risks];
                                  list[index].value = parseFloat(e.target.value) || 0;
                                  setRisks(list);
                                }} className="h-9 pl-6 text-xs font-bold bg-white rounded-xl" />
                              </div>
                              <div className="col-span-4">
                                <Input placeholder="Mitigation Strategy..." value={r.mitigation} onChange={e => {
                                  const list = [...risks];
                                  list[index].mitigation = e.target.value;
                                  setRisks(list);
                                }} className="h-9 text-xs font-medium bg-white rounded-xl" />
                              </div>
                              <div className="col-span-1 flex items-center justify-end">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteRisk(r.id)} className="h-8 w-8 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                          {risks.length === 0 && <p className="text-[10px] text-muted-foreground italic">No churn risks added.</p>}
                        </div>
                      </div>

                      {/* Projected Wins */}
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-slate-800 tracking-wider">30-Day Projected High-Value Wins</label>
                          <Button variant="outline" size="sm" onClick={handleAddProjected} className="h-7 text-[9px] font-black uppercase gap-1.5 border-dashed border-2 rounded-lg">
                            <Plus className="w-3 h-3" /> Add Projected Row
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {projectedWins.map((p, index) => (
                            <div key={p.id} className="grid grid-cols-12 gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl relative group">
                              <div className="col-span-5">
                                <Input placeholder="Account Name..." value={p.account} onChange={e => {
                                  const list = [...projectedWins];
                                  list[index].account = e.target.value;
                                  setProjectedWins(list);
                                }} className="h-9 text-xs font-bold bg-white rounded-xl" />
                              </div>
                              <div className="col-span-3 relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">$</span>
                                <Input type="number" placeholder="Value..." value={p.value || ''} onChange={e => {
                                  const list = [...projectedWins];
                                  list[index].value = parseFloat(e.target.value) || 0;
                                  setProjectedWins(list);
                                }} className="h-9 pl-6 text-xs font-bold bg-white rounded-xl" />
                              </div>
                              <div className="col-span-3">
                                <Input placeholder="Expected Close Date..." value={p.expectedDate} onChange={e => {
                                  const list = [...projectedWins];
                                  list[index].expectedDate = e.target.value;
                                  setProjectedWins(list);
                                }} className="h-9 text-xs font-medium bg-white rounded-xl" />
                              </div>
                              <div className="col-span-1 flex items-center justify-end">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteProjected(p.id)} className="h-8 w-8 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ))}
                          {projectedWins.length === 0 && <p className="text-[10px] text-muted-foreground italic">No projected wins added.</p>}
                        </div>
                      </div>

                      {/* Performance Narrative */}
                      <div className="space-y-2 pt-4 border-t">
                        <label className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Performance Narrative (Major Updates)</label>
                        <Textarea 
                          placeholder="Provide a high-level summary of shifts and wins achieved this week..." 
                          value={updates}
                          onChange={e => setUpdates(e.target.value)}
                          className="min-h-[100px] text-xs font-medium rounded-xl border-slate-200" 
                        />
                      </div>

                      {/* Next Week Priorities */}
                      <div className="space-y-3 pt-4 border-t">
                        <label className="text-[10px] font-black uppercase text-slate-800 tracking-wider">Priorities for the Week Ahead</label>
                        <div className="flex gap-2">
                          <Input placeholder="Enter priority focus area..." value={newPriority} onChange={e => setNewPriority(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddPriority()} className="h-9 text-xs" />
                          <Button onClick={handleAddPriority} className="h-9 px-4 text-xs font-bold uppercase shrink-0">Add</Button>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          {priorities.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border text-xs font-semibold text-slate-700">
                              <span>• {p}</span>
                              <Button variant="ghost" size="icon" onClick={() => handleDeletePriority(idx)} className="h-6 w-6 text-red-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          ))}
                          {priorities.length === 0 && <p className="text-[10px] text-muted-foreground italic">No priorities added. Loaded priorities from previous Friday will show here.</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ADDITIONAL REGISTERED USER ONLY FIELDS */}
                  {simUserRole === 'REGISTERED' && (
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

                      {/* Focus Accounts Update Section */}
                      <Card className="border border-indigo-100 shadow-md">
                        <CardHeader className="bg-indigo-900 text-indigo-100 py-4 rounded-t-3xl">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                            <Target className="w-4 h-4 font-black" /> Focus Account Progress Review
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          {twtwFocusAccounts.map((acc, index) => (
                            <div key={acc.id} className="p-4 bg-slate-50 border rounded-2xl space-y-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="text-xs font-black text-slate-800 uppercase">{acc.accountName}</h4>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{acc.actionType} • ${acc.eav?.toLocaleString() || 0} EAV</p>
                                </div>
                                <select 
                                  value={acc.status || 'WORKING'} 
                                  onChange={e => {
                                    const list = [...twtwFocusAccounts];
                                    list[index].status = e.target.value as any;
                                    setTwtwFocusAccounts(list);
                                  }}
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
                                  const list = [...twtwFocusAccounts];
                                  list[index].update = e.target.value;
                                  setTwtwFocusAccounts(list);
                                }}
                                className="h-8 text-xs bg-white" 
                              />
                            </div>
                          ))}
                          {twtwFocusAccounts.length === 0 && (
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
                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button variant="outline" onClick={() => handleTwtwSubmit('DRAFT')} className="font-black h-12 px-6 uppercase tracking-wider text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                      Save Draft
                    </Button>
                    <Button onClick={() => handleTwtwSubmit('SUBMITTED')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 px-8 uppercase tracking-wider text-xs shadow-lg shadow-indigo-100">
                      {twtwStatus === 'SUBMITTED' ? 'Update Submission' : 'Submit TWTW Report'}
                    </Button>
                  </div>
                </div>
              )}

              {/* --- FRIDAY COMBINED PACK FORM --- */}
              {simDay === 'FRIDAY' && (
                <div className="space-y-6">
                  <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden gap-4">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32" /></div>
                    <div className="relative z-10 space-y-1">
                      <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-widest px-2.5 mb-1">
                        Friday Pack & Monday Planning
                      </Badge>
                      <h3 className="text-xl font-black uppercase tracking-tight">Combined Weekly Wrap & Next Plan</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Complete your Week Review and set up Next Week Monday Plan in one go.
                      </p>
                    </div>
                    <div className="flex gap-2 relative z-10 w-full sm:w-auto">
                      <Button 
                        onClick={handlePreFillFridayFromThursday}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest h-12 px-5 rounded-2xl shadow-lg w-full sm:w-auto gap-2"
                      >
                        <RefreshCw className="w-4 h-4" /> Pull Thursday TWTW Data
                      </Button>
                    </div>
                  </header>

                  <Tabs defaultValue="current" className="w-full">
                    <TabsList className="bg-slate-100 border p-1 rounded-xl w-full grid grid-cols-2">
                      <TabsTrigger value="current" className="font-black uppercase text-[10px] tracking-widest py-2">
                        Phase A: Close Current Week (Friday Pack)
                      </TabsTrigger>
                      <TabsTrigger value="next" className="font-black uppercase text-[10px] tracking-widest py-2">
                        Phase B: Setup Next Week (Monday Plan)
                      </TabsTrigger>
                    </TabsList>

                    {/* PHASE A: CLOSE CURRENT WEEK */}
                    <TabsContent value="current" className="mt-4 space-y-6">
                      
                      {/* Monday Commitments Review */}
                      <Card className="border shadow-md">
                        <CardHeader className="bg-slate-50 border-b py-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4 text-emerald-600" /> Review Monday Commitments
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
                                    className="w-5 h-5 mt-0.5 accent-emerald-600 rounded cursor-pointer"
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
                          </div>
                        </CardContent>
                      </Card>

                      {/* Current Week Focus Accounts Review */}
                      <Card className="border shadow-md">
                        <CardHeader className="bg-slate-50 border-b py-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <Target className="w-4 h-4 text-emerald-600" /> Focus Accounts Performance
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="space-y-4">
                            {currentWeekFocusAccounts.map((acc, idx) => (
                              <div key={acc.id} className={cn("p-4 bg-white rounded-2xl border shadow-sm space-y-3 transition-all",
                                acc.status === 'WON' && "border-emerald-100 bg-emerald-50/10",
                                acc.status === 'LOST' && "border-red-100 bg-red-50/10",
                                acc.status === 'WORKING' && "border-slate-200"
                              )}>
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                  <div>
                                    <span className="text-xs font-black text-slate-800 block">{acc.accountName}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{acc.actionType} • ${acc.eav?.toLocaleString()} EAV</span>
                                  </div>
                                  
                                  <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0 border">
                                    {['WORKING', 'WON', 'LOST'].map((status) => (
                                      <button
                                        key={status}
                                        onClick={() => handleFridayFocusAccountStatusChange(idx, status as any)}
                                        className={cn("px-2.5 py-1 text-[9px] font-black uppercase rounded-lg transition-all",
                                          acc.status === status 
                                            ? status === 'WON' ? "bg-emerald-600 text-white shadow-sm"
                                              : status === 'LOST' ? "bg-rose-600 text-white shadow-sm"
                                              : "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                        )}
                                      >
                                        {status === 'WORKING' ? 'Working (Roll)' : status}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <Input
                                  placeholder="Progress notes..."
                                  value={acc.update || ''}
                                  onChange={e => {
                                    const updated = [...currentWeekFocusAccounts];
                                    updated[idx].update = e.target.value;
                                    setCurrentWeekFocusAccounts(updated);
                                  }}
                                  className="h-8 text-xs bg-slate-50/50"
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Performance Narrative */}
                      <Card className="border shadow-md">
                        <CardHeader className="bg-slate-50 border-b py-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <Star className="w-4 h-4 text-emerald-600" /> Weekly Synthesis Narrative
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">
                            Pre-populated from Thursday's TWTW Narrative. Avoid typing things twice!
                          </p>
                          <Textarea 
                            placeholder="Final high-level performance commentary..." 
                            value={fridayNarrative} 
                            onChange={e => setFridayNarrative(e.target.value)}
                            className="min-h-[120px] text-xs font-medium rounded-xl"
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* PHASE B: SETUP NEXT WEEK */}
                    <TabsContent value="next" className="mt-4 space-y-6">
                      
                      {/* Next Week targets */}
                      <Card className="border border-emerald-100 shadow-md">
                        <CardHeader className="bg-slate-50 border-b py-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-emerald-600" /> Setup Next Week KPI Targets
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Calls Target</span>
                              <Input type="number" value={nextWeekKpiTargets.callsToMake} onChange={e => setNextWeekKpiTargets({ ...nextWeekKpiTargets, callsToMake: parseInt(e.target.value) || 0 })} className="h-9 text-xs font-black" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Appts Target</span>
                              <Input type="number" value={nextWeekKpiTargets.appointmentsToSet} onChange={e => setNextWeekKpiTargets({ ...nextWeekKpiTargets, appointmentsToSet: parseInt(e.target.value) || 0 })} className="h-9 text-xs font-black" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Proposals Target</span>
                              <Input type="number" value={nextWeekKpiTargets.proposalsToSend} onChange={e => setNextWeekKpiTargets({ ...nextWeekKpiTargets, proposalsToSend: parseInt(e.target.value) || 0 })} className="h-9 text-xs font-black" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Deals Target</span>
                              <Input type="number" value={nextWeekKpiTargets.dealsToClose} onChange={e => setNextWeekKpiTargets({ ...nextWeekKpiTargets, dealsToClose: parseInt(e.target.value) || 0 })} className="h-9 text-xs font-black" />
                            </div>
                            <div className="space-y-1 col-span-2 sm:col-span-1">
                              <span className="text-[8px] font-black uppercase text-muted-foreground">Revenue ($)</span>
                              <Input type="number" value={nextWeekKpiTargets.revenueTarget} onChange={e => setNextWeekKpiTargets({ ...nextWeekKpiTargets, revenueTarget: parseInt(e.target.value) || 0 })} className="h-9 text-xs font-black" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Next Week Focus Accounts */}
                      <Card className="border border-emerald-100 shadow-md">
                        <CardHeader className="bg-slate-50 border-b py-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <Target className="w-4 h-4 text-emerald-600" /> Setup Next Week Focus Accounts
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          {nextWeekFocusAccounts.map((acc, index) => (
                            <div key={acc.id} className="p-4 bg-slate-50 border rounded-2xl space-y-3 relative group">
                              <div className="flex justify-between items-center gap-2">
                                <Input placeholder="Account Name..." value={acc.accountName} onChange={e => {
                                  const list = [...nextWeekFocusAccounts];
                                  list[index].accountName = e.target.value;
                                  setNextWeekFocusAccounts(list);
                                }} className="h-9 text-xs font-bold bg-white" />
                                <Button variant="ghost" size="icon" onClick={() => setNextWeekFocusAccounts(nextWeekFocusAccounts.filter(fa => fa.id !== acc.id))} className="h-8 w-8 text-red-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <select 
                                  value={acc.actionType} 
                                  onChange={e => {
                                    const list = [...nextWeekFocusAccounts];
                                    list[index].actionType = e.target.value;
                                    setNextWeekFocusAccounts(list);
                                  }}
                                  className="h-9 text-[10px] font-black uppercase rounded-lg border bg-white px-2"
                                >
                                  {ACTION_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                                <Input type="number" placeholder="EAV ($)" value={acc.eav || ''} onChange={e => {
                                  const list = [...nextWeekFocusAccounts];
                                  list[index].eav = parseFloat(e.target.value) || 0;
                                  setNextWeekFocusAccounts(list);
                                }} className="h-9 text-xs bg-white" />
                              </div>
                            </div>
                          ))}
                          <Button 
                            variant="outline" 
                            onClick={() => setNextWeekFocusAccounts([...nextWeekFocusAccounts, { id: crypto.randomUUID(), accountName: '', actionType: 'Prospect', eav: 0, aboutAccount: '' }])}
                            className="w-full h-11 border-dashed border-2 rounded-xl text-[10px] font-black uppercase text-slate-500 bg-slate-50/50 hover:bg-slate-50"
                          >
                            + Add Focus Account
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Next Week Monday commitments */}
                      <Card className="border border-emerald-100 shadow-md">
                        <CardHeader className="bg-slate-50 border-b py-4">
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                            <ClipboardCheck className="w-4 h-4 text-emerald-600" /> Setup Next Week Actions (Monday Plan)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-3">
                          {nextWeekActions.map((act, index) => (
                            <div key={index} className="flex gap-3 items-center group">
                              <Badge className="bg-slate-100 text-slate-700 font-black text-[9px] uppercase border shrink-0">Action {index + 1}</Badge>
                              <Input placeholder="Enter tactical action..." value={act} onChange={e => {
                                const list = [...nextWeekActions];
                                list[index] = e.target.value;
                                setNextWeekActions(list);
                              }} className="h-9 text-xs font-bold" />
                              {nextWeekActions.length > 5 && (
                                <Button variant="ghost" size="icon" onClick={() => setNextWeekActions(nextWeekActions.filter((_, i) => i !== index))} className="h-8 w-8 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></Button>
                              )}
                            </div>
                          ))}
                          <Button 
                            variant="outline" 
                            onClick={() => setNextWeekActions([...nextWeekActions, ''])}
                            className="h-9 text-[10px] font-black uppercase border-dashed border-2 rounded-xl text-slate-500 gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Additional Action
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>

                  {/* Submit Pack */}
                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button variant="outline" onClick={() => handleFridaySubmit('DRAFT')} className="font-black h-12 px-6 uppercase tracking-wider text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                      Save Draft
                    </Button>
                    <Button onClick={() => handleFridaySubmit('SUBMITTED')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 px-8 uppercase tracking-wider text-xs shadow-lg shadow-emerald-100">
                      Submit Friday Pack
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Live Simulated Database State */}
            <div className="lg:col-span-4 space-y-6">
              
              <Card className="border shadow-lg bg-white sticky top-24">
                <CardHeader className="bg-slate-50 border-b py-4">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" /> Simulated Database State
                  </CardTitle>
                  <CardDescription className="text-[9px] uppercase tracking-wider font-bold">Watch how data is preserved/shared across reports</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-5">
                  
                  {/* Prev Friday Data */}
                  <div className="space-y-2 bg-slate-50 p-3.5 border rounded-2xl text-[11px] font-medium text-slate-700">
                    <h4 className="font-black text-[9px] text-slate-900 uppercase tracking-widest flex items-center justify-between">
                      <span>Loaded Database Draft (Previous Friday)</span>
                      <Badge className="bg-indigo-100 text-indigo-800 border-none text-[8px] font-black uppercase">Active</Badge>
                    </h4>
                    <p className="border-t pt-1.5 mt-1.5"><strong>Actions Logged:</strong> {dbPrevFridayPlan.actionPlan.length}</p>
                    <p><strong>Focus Accounts:</strong> {dbPrevFridayPlan.focusAccounts.map(fa => fa.accountName).join(', ') || 'None'}</p>
                    <p><strong>KPI Revenue Target:</strong> ${dbPrevFridayPlan.kpiTargets.revenueTarget.toLocaleString()}</p>
                  </div>

                  {/* Active Thursday TWTW Submissions */}
                  <div className="space-y-2 bg-indigo-50/50 p-3.5 border border-indigo-100 rounded-2xl text-[11px] font-medium text-indigo-950">
                    <h4 className="font-black text-[9px] text-indigo-900 uppercase tracking-widest flex items-center justify-between">
                      <span>Simulated Thursday TWTW doc</span>
                      <Badge className={cn("border-none text-[8px] font-black uppercase",
                        twtwStatus === 'SUBMITTED' ? "bg-green-100 text-green-700" :
                        twtwStatus === 'DRAFT' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                      )}>
                        {twtwStatus}
                      </Badge>
                    </h4>
                    <p className="border-t border-indigo-100 pt-1.5 mt-1.5"><strong>Wins:</strong> {wins.length} logged</p>
                    <p><strong>Risks:</strong> {risks.length} logged</p>
                    <p><strong>Priorities:</strong> {priorities.length} items</p>
                    {simUserRole === 'REGISTERED' && (
                      <p className="text-[10px] text-indigo-800 italic">Registered extra BDM metrics loaded: KPI actuals tracking is active.</p>
                    )}
                  </div>

                  {/* Active Friday pack */}
                  <div className="space-y-2 bg-emerald-50/30 p-3.5 border border-emerald-100 rounded-2xl text-[11px] font-medium text-emerald-950">
                    <h4 className="font-black text-[9px] text-emerald-900 uppercase tracking-widest flex items-center justify-between">
                      <span>Simulated Friday Pack doc</span>
                      <Badge className={cn("border-none text-[8px] font-black uppercase",
                        fridayStatus === 'SUBMITTED' ? "bg-green-100 text-green-700" :
                        fridayStatus === 'DRAFT' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                      )}>
                        {fridayStatus}
                      </Badge>
                    </h4>
                    <p className="border-t border-emerald-100 pt-1.5 mt-1.5"><strong>Completed Actions:</strong> {currentWeekActions.filter(c => c.completed).length} / {currentWeekActions.length}</p>
                    <p><strong>Working Focus Accounts:</strong> {currentWeekFocusAccounts.filter(fa => fa.status === 'WORKING').length} (to rollover)</p>
                    <p><strong>Next Week Focus Setup:</strong> {nextWeekFocusAccounts.length} added</p>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        {/* --- TAB 3: EXECUTIVE COLLATION TAB --- */}
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
              <Button 
                onClick={handleExportPdf}
                className="bg-indigo-600 hover:bg-indigo-750 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
              >
                <ClipboardCheck className="w-4 h-4" /> Export to Landscape PDF
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              
              {/* Display Table in 6-column landscape format */}
              <div className="p-6 space-y-10">
                {Object.entries(collatedMockSubmissions).map(([state, subs]) => (
                  <div key={state} className="space-y-3">
                    <h3 className="text-sm font-black uppercase text-slate-800 border-b pb-1.5 flex items-center gap-2">
                      {state} Region <Badge className="bg-slate-100 text-slate-600 font-bold border">{subs.length} Reps</Badge>
                    </h3>
                    
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="uppercase text-[9px] font-black tracking-widest text-slate-500">
                            <th className="p-3 w-[15%]">Rep Name</th>
                            <th className="p-3 w-[18%]">Key Wins</th>
                            <th className="p-3 w-[18%]">Churn Risk</th>
                            <th className="p-3 w-[18%]">Major Updates</th>
                            <th className="p-3 w-[18%]">30 Day Projected</th>
                            <th className="p-3 w-[15%] font-black">Priorities</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {subs.map((sub, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 align-top transition-colors">
                              <td className="p-3 font-black text-slate-850 break-words">{sub.name}</td>
                              <td className="p-3 text-slate-600 whitespace-pre-line leading-relaxed">{sub.wins}</td>
                              <td className="p-3 text-rose-600 whitespace-pre-line leading-relaxed">{sub.risks}</td>
                              <td className="p-3 text-slate-600 whitespace-pre-line leading-relaxed font-medium">{sub.updates}</td>
                              <td className="p-3 text-indigo-700 whitespace-pre-line leading-relaxed">{sub.projected}</td>
                              <td className="p-3 text-slate-600 whitespace-pre-line leading-relaxed">{sub.priorities}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hidden Print Container */}
              <div id="twtw-demo-print-area" className="hidden">
                ${Object.entries(collatedMockSubmissions).map(([state, subs]) => `
                  <div class="avoid-break">
                    <div class="region-title">${state} Region</div>
                    <table>
                      <thead>
                        <tr>
                          <th style="width: 15%">Rep Name</th>
                          <th style="width: 18%">Key Wins</th>
                          <th style="width: 18%">Churn Risk</th>
                          <th style="width: 18%">Major Updates</th>
                          <th style="width: 18%">30 Day Projected</th>
                          <th style="width: 15%">Priorities</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${subs.map(sub => `
                          <tr>
                            <td class="bold">${sub.name}</td>
                            <td class="whitespace-pre-line">${sub.wins.replace(/\n/g, '<br>')}</td>
                            <td class="whitespace-pre-line rose">${sub.risks.replace(/\n/g, '<br>')}</td>
                            <td class="whitespace-pre-line">${sub.updates.replace(/\n/g, '<br>')}</td>
                            <td class="whitespace-pre-line blue">${sub.projected.replace(/\n/g, '<br>')}</td>
                            <td class="whitespace-pre-line">${sub.priorities.replace(/\n/g, '<br>')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `).join('')}
              </div>

            </CardContent>
          </Card>
        </TabsContent>
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
  );
}
