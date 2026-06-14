
"use client";

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, serverTimestamp, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, addWeeks, differenceInDays } from 'date-fns';
import { Plus, Loader2, ClipboardList, Trash2, Star, ExternalLink, Activity, AlertCircle, Zap, ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import { WeeklyActivitySummary } from './weekly-activity-summary';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { openSalesforceSearch } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { computeMomentum } from '@/lib/momentum';
import { cn, getCurrentWeek, getWeekForDate } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
import { calculateDealHealth } from '@/lib/deal-health';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function PipelineReviewTable({ userId, readOnly, filterType = 'opportunities' }: { userId: string, readOnly?: boolean, filterType?: 'opportunities' | 'accounts' | 'all' }) {
  const { isLeader } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const now = new Date();
  
  const isWithinGracePeriod = [5, 6].includes(now.getDay());
  const canPerformFridayActions = isWithinGracePeriod || isLeader;
  
  const currentWeek = getCurrentWeek();

  const { pipelineReviews: allDeals, isLoading } = usePipelineData();

  // Load Fact Findings
  const ffQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'factFindingDocs'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: factFindings } = useCollection(ffQuery);

  // Load Call Plans
  const cpQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'callPlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: callPlans } = useCollection(cpQuery);

  // Load Whitespace Plans
  const wpQuery = useMemoFirebase(() => {
    if (!db || !userId) return null;
    return query(collection(db, 'whitespacePlans'), where('userId', '==', userId));
  }, [db, userId]);
  const { data: whitespacePlans } = useCollection(wpQuery);

  // Win/Loss Analysis Log State
  const [winLossDialogOpen, setWinLossDialogOpen] = useState(false);
  const [winLossData, setWinLossData] = useState({
    dealId: '',
    accountName: '',
    opportunityName: '',
    outcome: 'WON' as 'WON' | 'LOST',
    reason: '',
    competitor: '',
    priceDetail: '',
    notes: '',
    value: 0
  });

  const triggerWinLossModal = (row: any, type: 'WON' | 'LOST') => {
    setWinLossData({
      dealId: row.id,
      accountName: row.pipeline || '',
      opportunityName: row.opportunityName || '',
      outcome: type,
      reason: '',
      competitor: '',
      priceDetail: '',
      notes: '',
      value: row.value || 0
    });
    setWinLossDialogOpen(true);
  };

  const handleSaveWinLoss = async () => {
    if (!db || !winLossData.dealId) return;
    try {
      const logRef = collection(db, 'winLossLogs');
      await addDoc(logRef, {
        userId,
        dealId: winLossData.dealId,
        accountName: winLossData.accountName,
        opportunityName: winLossData.opportunityName,
        outcome: winLossData.outcome,
        reason: winLossData.reason,
        competitor: winLossData.competitor,
        priceDetail: winLossData.priceDetail,
        notes: winLossData.notes,
        value: winLossData.value,
        week: currentWeek,
        createdAt: serverTimestamp()
      });

      if (winLossData.outcome === 'WON') {
        await updateDoc(doc(db, 'pipelineReviews', winLossData.dealId), {
          stage: 'Closed Won',
          closedWonValue: winLossData.value,
          updatedAt: serverTimestamp()
        });
        toast({ title: "Deal Marked Won 🎉", description: "Win analysis successfully logged to governance hub." });
      } else {
        const row = reviews?.find(r => r.id === winLossData.dealId);
        await addDoc(collection(db, 'lostCustomers'), {
          ...row,
          lostReason: winLossData.reason,
          lostCompetitor: winLossData.competitor,
          lostNotes: winLossData.notes,
          lostAt: serverTimestamp(),
          week: currentWeek
        });
        await deleteDoc(doc(db, 'pipelineReviews', winLossData.dealId));
        toast({ title: "Deal Archived as Lost", description: "Loss analysis logged." });
      }

      setWinLossDialogOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not log Win/Loss details." });
    }
  };

  const rawReviews = useMemo(() => {
    if (!allDeals) return [];
    return allDeals.filter(d => d.userId === userId);
  }, [allDeals, userId]);

  const reviews = useMemo(() => {
    if (!rawReviews) return [];
    if (filterType === 'accounts') {
      return rawReviews.filter(r => r.isBareAccount);
    }
    if (filterType === 'opportunities') {
      return rawReviews.filter(r => !r.isBareAccount);
    }
    return rawReviews;
  }, [rawReviews, filterType]);

  const selectedCount = useMemo(() => reviews?.filter(r => r.isReviewSelected).length || 0, [reviews]);

  const handleUpdate = async (id: string, field: string, val: any) => { 
    if (!db || readOnly) return; 
    const row = reviews?.find(r => r.id === id);
    const updatePayload: any = { [field]: val, updatedAt: serverTimestamp() };
    if (field === 'barriers' && row) {
      updatePayload.lastBarrierText = row.barriers || '';
    }
    await updateDoc(doc(db, 'pipelineReviews', id), updatePayload); 
  };

  const handleAddRow = async () => {
    if (!db) return;
    try {
      await addDoc(collection(db, 'pipelineReviews'), {
        userId, week: currentWeek, pipeline: '', value: 0,
        stage: 'Discovery', salesforceId: '',
        createdAt: serverTimestamp(), daysInStage: 0, rolloverCount: 0,
        isBareAccount: filterType === 'accounts'
      });
    } catch (e) {
      toast({ variant: 'destructive', title: filterType === 'accounts' ? 'Failed to add account.' : 'Failed to add opportunity.' });
    }
  };

  const toggleSelection = async (row: any) => {
    if (readOnly) return;
    if (!row.isReviewSelected && selectedCount >= 8) {
      toast({ variant: "destructive", title: "Review Cap Reached", description: "Focus on your Top 8 strategic priorities for the Friday meeting." });
      return;
    }
    await handleUpdate(row.id, 'isReviewSelected', !row.isReviewSelected);
  };

  const handleRollover = async (row: any) => {
    if (!db || readOnly || !canPerformFridayActions) return;
    
    try {
      const nextWeek = getWeekForDate(addWeeks(now, 1));
      const rolloverCount = (row.rolloverCount || 0) + 1;
      
      await addDoc(collection(db, 'pipelineReviews'), { 
        ...row, 
        id: undefined, 
        week: nextWeek, 
        createdAt: serverTimestamp(),
        isRolledOver: false,
        isReviewSelected: false,
        rolloverCount,
        lastBarrierText: row.barriers || ''
      }); 
      
      await handleUpdate(row.id, 'isRolledOver', true); 
      toast({ title: "Deal Rolled Over", description: `Count: ${rolloverCount}. Target node: Wk ${nextWeek.split('-')[1]}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Rollover Failed" });
    }
  };

  return (
    <div className="space-y-6">
      <WeeklyActivitySummary userId={userId} readOnly={readOnly} />
      <Card className="border-none shadow-2xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 p-6 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-accent" /> {filterType === 'accounts' ? 'Accounts Ledger' : 'Strategy Ledger'}
            </CardTitle>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase text-accent tracking-widest">
                Wk {currentWeek.split('-')[1]}
              </p>
              <div className="h-4 w-px bg-slate-300" />
              <Badge variant={selectedCount > 8 ? "destructive" : "outline"} className={cn("text-[10px] font-black uppercase tracking-widest h-5 px-3 border-accent/30", selectedCount === 8 && "bg-accent text-white")}>
                 Selection: {selectedCount} / 8
              </Badge>
            </div>
          </div>
          {!readOnly && (
            <Button 
              onClick={handleAddRow}
              className="bg-primary font-black uppercase text-xs h-10 px-6"
            >
              <Plus className="w-4 h-4 mr-2" /> {filterType === 'accounts' ? 'New Account' : 'New Opp'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1400px]">
              <TableHeader className="bg-white">
                <TableRow className="uppercase text-[9px] font-black tracking-widest border-b-2">
                  <TableHead className="w-[60px] text-center">MTG</TableHead>
                  <TableHead>Momentum</TableHead>
                  <TableHead className="w-[100px]">Health</TableHead>
                  <TableHead className="w-[250px]">Account / Opportunity</TableHead>
                  <TableHead className="w-[140px]">Value (M)</TableHead>
                  <TableHead className="w-[180px]">Stage</TableHead>
                  <TableHead className="w-[250px]">Barriers & Risks</TableHead>
                  <TableHead className="w-[250px]">Commitment / Next Action</TableHead>
                  <TableHead className="w-[80px] text-center">ROLL</TableHead>
                  <TableHead className="w-[100px] text-center">CLOSE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary w-10 h-10" /></TableCell></TableRow>
                ) : reviews?.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest bg-slate-50/50">No opportunities identified.</TableCell></TableRow>
                ) : reviews?.map(row => {
                  const momentum = computeMomentum({
                    daysInStage: row.daysInStage || differenceInDays(now, row.createdAt?.toDate?.() || now),
                    rolloverCount: row.rolloverCount || 0,
                    barrierText: row.barriers || '',
                    lastBarrierText: row.lastBarrierText || ''
                  });

                  const health = calculateDealHealth(
                    row,
                    factFindings || [],
                    callPlans || [],
                    whitespacePlans || []
                  );

                  let healthColor = "bg-rose-50 border-rose-200 text-rose-700";
                  if (health.score >= 80) {
                    healthColor = "bg-emerald-50 border-emerald-200 text-emerald-700";
                  } else if (health.score >= 50) {
                    healthColor = "bg-amber-50 border-amber-200 text-amber-700";
                  }

                  return (
                    <TableRow key={row.id} className={cn("hover:bg-slate-50 transition-colors group", row.isReviewSelected && "bg-accent/5")}>
                      <TableCell className="text-center">
                        <button onClick={() => toggleSelection(row)} className={`p-2.5 rounded-xl transition-all ${row.isReviewSelected ? 'bg-accent text-white shadow-lg' : 'text-slate-200 hover:text-slate-300'}`}>
                          <Star className={`w-5 h-5 ${row.isReviewSelected && "fill-current"}`} />
                        </button>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-full w-fit border ${momentum.bg}`}>
                                <Activity className={`w-3 h-3 ${momentum.color}`} />
                                <span className={`text-[8px] font-black uppercase ${momentum.color}`}>{momentum.score}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white font-bold text-[10px]">{momentum.reason}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full w-fit border cursor-help font-black text-[9px] uppercase tracking-wide", healthColor)}>
                                <span>Health: {health.score}%</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-950 text-white p-3.5 max-w-[280px] rounded-xl space-y-2.5 border border-slate-800 shadow-xl">
                              <p className="font-black text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-accent inline-block animate-pulse" />
                                Deal Health Diagnosis
                              </p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[9px] font-bold text-slate-300">
                                <span>Activity (25%):</span> <span className="text-right text-white">{health.breakdown.activity}/25</span>
                                <span>Stage duration (25%):</span> <span className="text-right text-white">{health.breakdown.stage}/25</span>
                                <span>Fact Finding (20%):</span> <span className="text-right text-white">{health.breakdown.factFinding}/20</span>
                                <span>Call Plan (15%):</span> <span className="text-right text-white">{health.breakdown.callPlan}/15</span>
                                <span>Whitespace (15%):</span> <span className="text-right text-white">{health.breakdown.whitespace}/15</span>
                              </div>
                              {health.alerts.length > 0 && (
                                <div className="border-t border-slate-850 pt-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase tracking-wider text-rose-400">Improvement Areas:</p>
                                  {health.alerts.map((a, idx) => (
                                    <p key={idx} className="text-[9px] leading-relaxed text-slate-400">• {a}</p>
                                  ))}
                                </div>
                              )}
                              {health.positives.length > 0 && (
                                <div className="border-t border-slate-855 pt-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase tracking-wider text-emerald-400">Strengths:</p>
                                  {health.positives.map((p, idx) => (
                                    <p key={idx} className="text-[9px] leading-relaxed text-slate-400">• {p}</p>
                                  ))}
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Input className="text-xs font-black uppercase h-9 bg-transparent border-transparent focus:border-primary/20 flex-1" value={row.pipeline} onChange={e => handleUpdate(row.id, 'pipeline', e.target.value)} readOnly={readOnly} />
                              {row.creditHold && (
                                <span className="shrink-0 text-[7px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md border border-red-200">HOLD</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 px-2">
                              {row.pipeline && (
                                <a 
                                  href="#" 
                                  onClick={(e) => { e.preventDefault(); openSalesforceSearch(row.pipeline); }}
                                  className="text-[8px] text-accent font-black hover:underline tracking-wider uppercase block w-fit"
                                  title="Open Account in Salesforce"
                                >
                                  SF Account Link
                                </a>
                              )}
                              {row.opportunityName && (
                                <a 
                                  href="#"
                                  onClick={(e) => { e.preventDefault(); openSalesforceSearch(row.opportunityName || '', row.salesforceId); }}
                                  className="text-[9px] text-muted-foreground font-semibold italic hover:text-accent hover:underline truncate block w-fit"
                                  title="Open Opportunity in Salesforce"
                                >
                                  {row.opportunityName}
                                </a>
                              )}
                              {row.isReviewSelected && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    window.dispatchEvent(new CustomEvent('switch-view', {
                                      detail: {
                                        view: 'CALL_PLANNING',
                                        params: { type: 'top8', data: row }
                                      }
                                    }));
                                  }}
                                  className="text-[8px] text-indigo-600 hover:text-indigo-800 font-black hover:underline tracking-wider uppercase block w-fit mt-1"
                                >
                                  Prepare Call Plan
                                </button>
                              )}
                            </div>
                            <Input
                              className="text-[9px] font-mono h-6 bg-transparent border-dashed border-slate-200 focus:border-accent/40 px-2 placeholder:text-slate-300 rounded mt-1"
                              placeholder="Salesforce ID (optional)..."
                              value={row.salesforceId || ''}
                              onChange={e => handleUpdate(row.id, 'salesforceId', e.target.value.trim())}
                              readOnly={readOnly}
                            />
                          </div>
                          <button
                            onClick={() => openSalesforceSearch(row.pipeline, row.salesforceId)}
                            className={`shrink-0 transition-colors ${row.salesforceId ? 'text-accent hover:text-accent/80' : 'text-slate-300 hover:text-accent'}`}
                            title={row.salesforceId ? 'Open Salesforce Record (ID)' : 'Search in Salesforce (by name)'}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span><Input type="number" className="text-xs font-black h-9 pl-6 bg-transparent border-transparent focus:border-primary/20" value={row.value || 0} onChange={e => handleUpdate(row.id, 'value', parseFloat(e.target.value) || 0)} readOnly={readOnly} /></div>
                          {(((row as any).closedWonValue || 0) > 0) && (
                            <p className="text-[8px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 text-center">
                              Won: ${Number((row as any).closedWonValue).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Input className="text-xs font-bold h-9 bg-transparent border-transparent focus:border-primary/20" value={row.stage} onChange={e => handleUpdate(row.id, 'stage', e.target.value)} readOnly={readOnly} /></TableCell>
                      <TableCell><Textarea className="text-[11px] font-medium min-h-[50px] resize-none bg-transparent border-transparent focus:border-primary/20" value={row.barriers} onChange={e => handleUpdate(row.id, 'barriers', e.target.value)} readOnly={readOnly} /></TableCell>
                      <TableCell><Textarea className="text-[11px] font-medium min-h-[50px] resize-none bg-transparent border-transparent focus:border-primary/20" value={row.actionsForBen} onChange={e => handleUpdate(row.id, 'actionsForBen', e.target.value)} readOnly={readOnly} placeholder="Enter immediate next steps..." /></TableCell>
                      <TableCell className="text-center">
                        <Checkbox disabled={!canPerformFridayActions || readOnly} checked={(row as any).isRolledOver} onCheckedChange={() => handleRollover(row)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={!canPerformFridayActions || readOnly} 
                            onClick={() => triggerWinLossModal(row, 'WON')} 
                            className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8 rounded-lg shrink-0"
                            title="Mark Closed-Won"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={!canPerformFridayActions || readOnly} 
                            onClick={() => triggerWinLossModal(row, 'LOST')} 
                            className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 rounded-lg shrink-0"
                            title="Mark Closed-Lost"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={winLossDialogOpen} onOpenChange={setWinLossDialogOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5 text-accent" />
              {winLossData.outcome === 'WON' ? 'Log Closed-Won Success' : 'Log Closed-Lost Analysis'}
            </DialogTitle>
            <DialogDescription className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mt-1">
              Analyze strategic factors for {winLossData.accountName || 'this opportunity'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Primary Factor</Label>
              <Select value={winLossData.reason} onValueChange={(val) => setWinLossData({ ...winLossData, reason: val })}>
                <SelectTrigger className="h-10 font-bold text-xs">
                  <SelectValue placeholder="SELECT PRIMARY REASON..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Price" className="font-bold">PRICE / BUDGET COMPETITIVENESS</SelectItem>
                  <SelectItem value="Competitor" className="font-bold">COMPETITOR RELATIONSHIP / OFFERING</SelectItem>
                  <SelectItem value="Timing" className="font-bold">TIMING / URGENCY SHIFT</SelectItem>
                  <SelectItem value="Service" className="font-bold">SERVICE QUALITY / CAPABILITY</SelectItem>
                  <SelectItem value="Relationship" className="font-bold">RELATIONSHIP / TRUST LEVEL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Incumbent / Competitor Name</Label>
              <Input 
                placeholder="Name of competitor..."
                value={winLossData.competitor}
                onChange={(e) => setWinLossData({ ...winLossData, competitor: e.target.value })}
                className="h-10 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pricing / Contract Details</Label>
              <Input 
                placeholder="Rate details, discount offered, target margin..."
                value={winLossData.priceDetail}
                onChange={(e) => setWinLossData({ ...winLossData, priceDetail: e.target.value })}
                className="h-10 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Debrief Notes</Label>
              <Textarea 
                placeholder="Additional strategic context, lessons learned, or follow-up plans..."
                value={winLossData.notes}
                onChange={(e) => setWinLossData({ ...winLossData, notes: e.target.value })}
                className="min-h-[80px] rounded-xl text-xs font-medium leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setWinLossDialogOpen(false)} className="font-black h-11 uppercase text-xs">Cancel</Button>
            <Button onClick={handleSaveWinLoss} className="bg-primary hover:bg-primary/95 text-white font-black h-11 uppercase text-xs px-6">Save & Close Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
