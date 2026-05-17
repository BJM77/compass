
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
import { Plus, Loader2, ClipboardList, Trash2, Star, ExternalLink, Activity, AlertCircle, Zap, ShieldAlert } from 'lucide-react';
import { WeeklyActivitySummary } from './weekly-activity-summary';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { openSalesforceSearch } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { computeMomentum } from '@/lib/momentum';
import { cn } from '@/lib/utils';

export function PipelineReviewTable({ userId, readOnly }: { userId: string, readOnly?: boolean }) {
  const { isLeader } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const now = new Date();
  
  const isWithinGracePeriod = [5, 6].includes(now.getDay());
  const canPerformFridayActions = isWithinGracePeriod || isLeader;
  
  const currentWeek = format(now, 'yyyy-ww');

  const reviewsQuery = useMemoFirebase(() => db ? query(collection(db, 'pipelineReviews'), where('userId', '==', userId), where('week', '==', currentWeek)) : null, [db, userId, currentWeek]);
  const { data: reviews, isLoading } = useCollection(reviewsQuery);

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
        createdAt: serverTimestamp(), daysInStage: 0, rolloverCount: 0
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to add opportunity.' });
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
      const nextWeek = format(addWeeks(now, 1), 'yyyy-ww');
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
              <ClipboardList className="w-5 h-5 text-accent" /> Strategy Ledger
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
              <Plus className="w-4 h-4 mr-2" /> New Opp
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
                  <TableHead className="w-[250px]">Account / Opportunity</TableHead>
                  <TableHead className="w-[140px]">Value (M)</TableHead>
                  <TableHead className="w-[180px]">Stage</TableHead>
                  <TableHead className="w-[250px]">Barriers & Risks</TableHead>
                  <TableHead className="w-[250px]">Commitment / Next Action</TableHead>
                  <TableHead className="w-[80px] text-center">ROLL</TableHead>
                  <TableHead className="w-[80px] text-center">LOST</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary w-10 h-10" /></TableCell></TableRow>
                ) : reviews?.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest bg-slate-50/50">No opportunities identified.</TableCell></TableRow>
                ) : reviews?.map(row => {
                  const momentum = computeMomentum({
                    daysInStage: row.daysInStage || differenceInDays(now, row.createdAt?.toDate?.() || now),
                    rolloverCount: row.rolloverCount || 0,
                    barrierText: row.barriers || '',
                    lastBarrierText: row.lastBarrierText || ''
                  });
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
                        <div className="flex items-center gap-2">
                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Input className="text-xs font-black uppercase h-9 bg-transparent border-transparent focus:border-primary/20 flex-1" value={row.pipeline} onChange={e => handleUpdate(row.id, 'pipeline', e.target.value)} readOnly={readOnly} />
                              {row.creditHold && (
                                <span className="shrink-0 text-[7px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md border border-red-200">HOLD</span>
                              )}
                            </div>
                            {row.opportunityName && (
                              <p className="text-[9px] text-muted-foreground font-semibold italic truncate px-2">{row.opportunityName}</p>
                            )}
                            <Input
                              className="text-[9px] font-mono h-6 bg-transparent border-dashed border-slate-200 focus:border-accent/40 px-2 placeholder:text-slate-300 rounded"
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
                          {(row.closedWonValue > 0) && (
                            <p className="text-[8px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 text-center">
                              Won: ${Number(row.closedWonValue).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Input className="text-xs font-bold h-9 bg-transparent border-transparent focus:border-primary/20" value={row.stage} onChange={e => handleUpdate(row.id, 'stage', e.target.value)} readOnly={readOnly} /></TableCell>
                      <TableCell><Textarea className="text-[11px] font-medium min-h-[50px] resize-none bg-transparent border-transparent focus:border-primary/20" value={row.barriers} onChange={e => handleUpdate(row.id, 'barriers', e.target.value)} readOnly={readOnly} /></TableCell>
                      <TableCell><Textarea className="text-[11px] font-medium min-h-[50px] resize-none bg-transparent border-transparent focus:border-primary/20" value={row.actionsForBen} onChange={e => handleUpdate(row.id, 'actionsForBen', e.target.value)} readOnly={readOnly} placeholder="Enter immediate next steps..." /></TableCell>
                      <TableCell className="text-center">
                        <Checkbox disabled={!canPerformFridayActions || readOnly} checked={row.isRolledOver} onCheckedChange={() => handleRollover(row)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" disabled={!canPerformFridayActions || readOnly} onClick={async () => { if(confirm("Archive Closed-Lost?")) { await addDoc(collection(db!, 'lostCustomers'), { ...row, lostAt: serverTimestamp(), week: currentWeek }); await deleteDoc(doc(db!, 'pipelineReviews', row.id)); toast({ title: "Archived Lost" }); } }} className="text-red-300 hover:text-red-600 h-8 w-8"><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
