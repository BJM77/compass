"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Link as LinkIcon, Loader2, Save, Filter, Plus, Target, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";
import { HARDCODED_ACCOUNT_MAP } from "@/lib/account-mappings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import type { ActualSpendRecord, PipelineReview, UserProfile, AccountMapping } from '@/types/crm';
import { formatCurrency, getCurrentWeek } from '@/lib/utils';

export function AlignCustomer() {
  const db = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'UNASSIGNED' | 'ASSIGNED' | 'ALL'>('UNASSIGNED');
  const [repFilter, setRepFilter] = useState('ALL');

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustYtd, setNewCustYtd] = useState('');
  const [newCustTarget, setNewCustTarget] = useState('');
  const [newCustRep, setNewCustRep] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const actualQuery = useMemoFirebase(() => db ? query(collection(db, 'actualRevenues'), orderBy('category', 'desc')) : null, [db]);
  const pipelineQuery = useMemoFirebase(() => db ? query(collection(db, 'pipelineReviews')) : null, [db]);
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const mappingsQuery = useMemoFirebase(() => db ? collection(db, 'accountMappings') : null, [db]);

  const { data: actualSpendData, isLoading: isLoadingActual } = useCollection(actualQuery);
  const { data: pipelineData, isLoading: isLoadingPipeline } = useCollection(pipelineQuery);
  const { data: usersData, isLoading: isLoadingUsers } = useCollection(usersQuery);
  const { data: mappingsData, isLoading: isLoadingMappings } = useCollection(mappingsQuery);

  const isLoading = isLoadingActual || isLoadingPipeline || isLoadingUsers || isLoadingMappings;

  const users = (usersData as UserProfile[]) || [];
  const actualSpend = (actualSpendData as ActualSpendRecord[]) || [];
  const pipelines = (pipelineData as PipelineReview[]) || [];
  const dbMappings = (mappingsData as AccountMapping[]) || [];

  const currentWeek = getCurrentWeek();

  // 1. Build Base Mapping (Pipeline + Hardcoded)
  const baseAccountToUserMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(HARDCODED_ACCOUNT_MAP).forEach(([acc, repName]) => {
      map.set(acc.toLowerCase().trim(), repName);
    });
    pipelines.forEach(p => {
      const u = users.find(u => u.uid === p.userId || u.id === p.userId);
      if (u) {
        if (p.accountMasterCode) map.set(p.accountMasterCode.toLowerCase().trim(), u.name);
        if (p.pipeline) map.set(p.pipeline.toLowerCase().trim(), u.name);
      }
    });
    return map;
  }, [pipelines, users]);

  // 2. Build DB Override Mapping
  const dbMappingMap = useMemo(() => {
    const map = new Map<string, AccountMapping>();
    dbMappings.forEach(m => map.set(m.id.toLowerCase().trim(), m));
    return map;
  }, [dbMappings]);

  // 3. Aggregate all accounts from actual spend
  const aggregatedAccounts = useMemo(() => {
    const agg = new Map<string, { originalName: string, cleanName: string, ytdRevenue: number, assignedToName?: string, assignedToId?: string, isManualMapping: boolean, annualTarget?: number }>();

    actualSpend.forEach(s => {
      const rawName = (s.companyName || s.account || 'Unnamed').trim().toLowerCase();
      const cleanName = rawName.replace(/\s*\(parcels\)\s*/, '').replace(/\s*\(freight\)\s*/, '').trim();
      const originalName = s.companyName || s.account || 'Unnamed';
      
      let assignedToName: string | undefined = undefined;
      let assignedToId: string | undefined = undefined;
      let isManualMapping = false;
      let annualTarget: number | undefined = undefined;

      // Check DB Mappings first
      if (dbMappingMap.has(rawName)) {
        assignedToName = dbMappingMap.get(rawName)!.assignedToName;
        assignedToId = dbMappingMap.get(rawName)!.assignedToId;
        annualTarget = dbMappingMap.get(rawName)!.annualTarget;
        isManualMapping = true;
      } else if (dbMappingMap.has(cleanName)) {
        assignedToName = dbMappingMap.get(cleanName)!.assignedToName;
        assignedToId = dbMappingMap.get(cleanName)!.assignedToId;
        annualTarget = dbMappingMap.get(cleanName)!.annualTarget;
        isManualMapping = true;
      } else {
        // Fallback to base map
        assignedToName = baseAccountToUserMap.get(rawName) || baseAccountToUserMap.get(cleanName);
        if (assignedToName) {
          const u = users.find(x => x.name === assignedToName);
          if (u) assignedToId = u.id || u.uid;
        }
      }

      if (!agg.has(rawName)) {
        agg.set(rawName, {
          originalName,
          cleanName,
          ytdRevenue: 0,
          assignedToName,
          assignedToId,
          annualTarget,
          isManualMapping
        });
      }
      
      const record = agg.get(rawName)!;
      record.ytdRevenue += (Number(s.value) || 0);
    });

    return Array.from(agg.values()).sort((a, b) => b.ytdRevenue - a.ytdRevenue);
  }, [actualSpend, baseAccountToUserMap, dbMappingMap, users]);


  const filteredAccounts = useMemo(() => {
    let result = aggregatedAccounts;
    
    if (filterMode === 'UNASSIGNED') result = result.filter(r => !r.assignedToId);
    else if (filterMode === 'ASSIGNED') result = result.filter(r => !!r.assignedToId);

    if (repFilter !== 'ALL') {
      result = result.filter(r => r.assignedToId === repFilter);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => r.originalName.toLowerCase().includes(lower) || r.assignedToName?.toLowerCase().includes(lower));
    }

    return result;
  }, [aggregatedAccounts, filterMode, searchTerm, repFilter]);


  const handleAssign = async (accountId: string, originalName: string, userId: string, existingTarget?: number) => {
    if (!db || userId === 'UNASSIGNED') return;
    
    const user = users.find(u => u.id === userId || u.uid === userId);
    if (!user) return;

    try {
      const mappingId = accountId.toLowerCase().trim();
      const safeDocId = mappingId.replace(/\//g, '-');

      const data: AccountMapping = {
        id: mappingId,
        originalName,
        assignedToId: user.id || user.uid,
        assignedToName: user.name,
        updatedAt: serverTimestamp(),
      };
      
      // Preserve existing target if not overwriting
      if (existingTarget !== undefined) {
        data.annualTarget = existingTarget;
      }

      await setDoc(doc(db, 'accountMappings', safeDocId), data, { merge: true });
      toast({ title: "Account Assigned Successfully" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error Saving Assignment" });
      console.error(e);
    }
  };

  const handleAddMissingCustomer = async () => {
    if (!db || !newCustName || !newCustYtd || !newCustRep) {
      toast({ variant: "destructive", title: "Missing Required Fields" });
      return;
    }
    
    setIsAdding(true);
    try {
      const user = users.find(u => u.id === newCustRep || u.uid === newCustRep);
      if (!user) throw new Error("User not found");

      const companyName = newCustName.trim();
      const mappingId = companyName.toLowerCase();
      const safeDocId = mappingId.replace(/\//g, '-');
      const ytdNum = Number(newCustYtd.replace(/[^0-9.-]+/g, ''));
      const targetNum = newCustTarget ? Number(newCustTarget.replace(/[^0-9.-]+/g, '')) : undefined;

      // 1. Add to actualRevenues
      const newRevRef = doc(collection(db, 'actualRevenues'));
      await setDoc(newRevRef, {
        id: newRevRef.id,
        companyName: companyName,
        account: companyName,
        value: ytdNum,
        category: "MANUAL",
        uploadedAt: serverTimestamp(),
        businessUnit: "MANUAL",
        lineOfBusiness: "MANUAL"
      });

      // 2. Add to accountMappings
      const data: AccountMapping = {
        id: mappingId,
        originalName: companyName,
        assignedToId: user.id || user.uid,
        assignedToName: user.name,
        updatedAt: serverTimestamp()
      };
      
      if (targetNum !== undefined && targetNum > 0) {
        data.annualTarget = targetNum;
      }

      await setDoc(doc(db, 'accountMappings', safeDocId), data, { merge: true });

      toast({ title: "Missing Customer Injected Successfully" });
      setIsDialogOpen(false);
      setNewCustName('');
      setNewCustYtd('');
      setNewCustTarget('');
      setNewCustRep('');

    } catch (e) {
      toast({ variant: "destructive", title: "Error Adding Customer" });
      console.error(e);
    } finally {
      setIsAdding(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Account Name', 'Assigned Rep', 'Annual Target', 'Expected YTD (Wk ' + currentWeek + ')', 'Actual YTD', 'Variance'];
    const rows = filteredAccounts.map(acc => {
      const expectedYtd = acc.annualTarget ? (acc.annualTarget / 52) * currentWeek : 0;
      const variance = acc.annualTarget ? acc.ytdRevenue - expectedYtd : 0;
      return [
        `"${acc.originalName.replace(/"/g, '""')}"`,
        `"${acc.assignedToName || 'Unassigned'}"`,
        acc.annualTarget || 0,
        expectedYtd.toFixed(2),
        acc.ytdRevenue.toFixed(2),
        variance.toFixed(2)
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Account_Alignment_Export_Wk${currentWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validReps = users.filter(u => u.role === 'BDM' || u.role === 'ACCOUNT_MANAGER');

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-xl">
        <CardHeader className="bg-primary/5 pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-indigo-600" /> Account Alignment & Targets
              </CardTitle>
              <CardDescription>Assign orphaned revenue and add missing customers manually</CardDescription>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input 
                  placeholder="Search accounts..." 
                  className="pl-9 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterMode} onValueChange={(v: any) => setFilterMode(v)}>
                <SelectTrigger className="w-40 bg-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="ALL">All Accounts</SelectItem>
                </SelectContent>
              </Select>

              {filterMode !== 'UNASSIGNED' && (
                <Select value={repFilter} onValueChange={setRepFilter}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Filter by Rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Reps</SelectItem>
                    {validReps.map(u => (
                      <SelectItem key={u.id || u.uid} value={u.id || u.uid}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Button variant="outline" onClick={handleExportCSV} className="text-slate-600 print:hidden">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Missing Customer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Missing Customer Revenue</DialogTitle>
                    <CardDescription>
                      Manually inject a customer that is missing from the Actual Spend CSV. This will permanently add their YTD revenue to the assigned rep's total.
                    </CardDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Customer Name</Label>
                      <Input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="e.g. ACME Corp" />
                    </div>
                    <div className="space-y-2">
                      <Label>Actual YTD Revenue ($)</Label>
                      <Input type="number" value={newCustYtd} onChange={e => setNewCustYtd(e.target.value)} placeholder="e.g. 500000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Annual Target ($) <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                      <Input type="number" value={newCustTarget} onChange={e => setNewCustTarget(e.target.value)} placeholder="e.g. 1000000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Assign To Rep</Label>
                      <Select value={newCustRep} onValueChange={setNewCustRep}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Rep" />
                        </SelectTrigger>
                        <SelectContent>
                          {validReps.map(u => (
                            <SelectItem key={u.id || u.uid} value={u.id || u.uid}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddMissingCustomer} disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700">
                      {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Inject Revenue
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>
          ) : (
            <ScrollArea className="h-[75vh]">
              {filteredAccounts.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No accounts found matching the criteria.</div>
              ) : (
                <div className="min-w-[800px] divide-y">
                  <div className="grid grid-cols-12 gap-4 p-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-slate-50 sticky top-0 z-10">
                    <div className="col-span-4">Account Name</div>
                    <div className="col-span-2 text-right">Annual Target</div>
                    <div className="col-span-2 text-right">YTD Pace (Wk {currentWeek})</div>
                    <div className="col-span-2 text-right">Actual YTD</div>
                    <div className="col-span-2 pl-4">Assigned Rep</div>
                  </div>
                  {filteredAccounts.map((acc, i) => {
                    const expectedYtd = acc.annualTarget ? (acc.annualTarget / 52) * currentWeek : 0;
                    const variance = acc.annualTarget ? acc.ytdRevenue - expectedYtd : 0;
                    
                    return (
                      <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">
                        <div className="col-span-4">
                          <div className="font-bold text-sm truncate text-slate-800" title={acc.originalName}>{acc.originalName}</div>
                          {acc.isManualMapping && <Badge variant="outline" className="text-[9px] mt-1 text-indigo-600 border-indigo-200 bg-indigo-50 font-bold uppercase tracking-widest">Aligned</Badge>}
                        </div>
                        
                        <div className="col-span-2 text-right font-medium text-sm text-slate-500">
                          {acc.annualTarget ? formatCurrency(acc.annualTarget) : '-'}
                        </div>
                        
                        <div className="col-span-2 text-right font-medium text-sm text-slate-500">
                          {acc.annualTarget ? formatCurrency(expectedYtd) : '-'}
                        </div>
                        
                        <div className="col-span-2 text-right">
                          <div className="font-bold text-sm text-slate-900">{formatCurrency(acc.ytdRevenue)}</div>
                          {acc.annualTarget ? (
                            <div className={`text-[10px] font-bold mt-0.5 ${variance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                            </div>
                          ) : null}
                        </div>
                        
                        <div className="col-span-2 pl-4">
                          <Select 
                            value={acc.assignedToId || 'UNASSIGNED'} 
                            onValueChange={(val) => handleAssign(acc.cleanName, acc.originalName, val, acc.annualTarget)}
                          >
                            <SelectTrigger className={`h-9 ${!acc.assignedToId ? 'border-amber-400 bg-amber-50 shadow-sm' : 'bg-white'}`}>
                              <SelectValue placeholder="Select Rep" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UNASSIGNED" className="text-muted-foreground italic">Unassigned</SelectItem>
                              {validReps.map(u => (
                                <SelectItem key={u.id || u.uid} value={u.id || u.uid}>
                                  {u.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
