"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Banknote, Calendar, Layers, Coins, Landmark, UserX } from 'lucide-react';
import { ActualSpendRecord, AccountMapping, UserProfile } from '@/types/crm';
import { useAuth } from '@/contexts/auth-context';
import { usePipelineData } from '@/contexts/pipeline-context';
import { HARDCODED_ACCOUNT_MAP } from "@/lib/account-mappings";

export function ActualSpendView() {
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [buFilter, setBuFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');

  const actualQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'actualRevenues'), orderBy('category', 'desc'));
  }, [db]);
  const mappingsQuery = useMemoFirebase(() => db ? collection(db, 'accountMappings') : null, [db]);
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);

  const { data: records, isLoading: isRecordsLoading } = useCollection<ActualSpendRecord>(actualQuery);
  const { data: mappingsData, isLoading: isMappingsLoading } = useCollection<AccountMapping>(mappingsQuery);
  const { data: usersData, isLoading: isUsersLoading } = useCollection<UserProfile>(usersQuery);

  const isLoading = isRecordsLoading || isMappingsLoading || isUsersLoading;

  const { toast } = useToast();

  const handleAssignStaff = async (companyName: string, staffUid: string) => {
    if (!db) return;
    const selectedUser = usersData?.find(u => u.uid === staffUid);
    if (!selectedUser) return;

    try {
      const cleanName = companyName.toLowerCase().replace(/\s*\(parcels\)\s*/, '').replace(/\s*\(freight\)\s*/, '').trim();
      const safeDocId = cleanName.replace(/\//g, '-');

      const data: AccountMapping = {
        id: cleanName,
        originalName: companyName,
        assignedToId: selectedUser.uid,
        assignedToName: selectedUser.name,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'accountMappings', safeDocId), data, { merge: true });
      toast({
        title: "Staff Assigned",
        description: `Successfully assigned ${companyName} to ${selectedUser.name}.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Assignment Failed",
        description: "Could not save account mapping to database.",
      });
    }
  };

  const formattedUsers = useMemo(() => {
    if (!usersData) return [];
    return [...usersData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [usersData]);


  const { profile, isLeader } = useAuth();
  const { allPipelineReviews } = usePipelineData();

  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'GM' || isLeader;

  const userAccountIds = useMemo(() => {
    if (isAdmin || !allPipelineReviews) return new Set<string>();
    return new Set(allPipelineReviews.map((d: any) => d.accountMasterCode).filter(Boolean) as string[]);
  }, [allPipelineReviews, isAdmin]);

  const userAccountNames = useMemo(() => {
    if (isAdmin || !allPipelineReviews) return new Set<string>();
    return new Set(allPipelineReviews.map((d: any) => d.pipeline?.toLowerCase()).filter(Boolean) as string[]);
  }, [allPipelineReviews, isAdmin]);

  const businessUnits = useMemo(() => {
    if (!records) return [];
    return Array.from(new Set(records.map(r => r.businessUnit).filter(Boolean))).sort();
  }, [records]);

  const categories = useMemo(() => {
    if (!records) return [];
    return Array.from(new Set(records.map(r => r.category).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  }, [records]);

  // 1. Build Base Mapping (Pipeline + Hardcoded)
  const baseAccountToUserMap = useMemo(() => {
    const map = new Map<string, string>();
    const users = usersData || [];
    Object.entries(HARDCODED_ACCOUNT_MAP).forEach(([acc, repName]) => {
      map.set(acc.toLowerCase().trim(), repName);
    });
    if (allPipelineReviews) {
      allPipelineReviews.forEach(p => {
        const u = users.find((u: any) => u.uid === p.userId || u.uid === p.userId);
        if (u) {
          if (p.accountMasterCode) map.set(p.accountMasterCode.toLowerCase().trim(), u.name);
          if (p.pipeline) map.set(p.pipeline.toLowerCase().trim(), u.name);
        }
      });
    }
    return map;
  }, [allPipelineReviews, usersData]);

  // 2. Build DB Override Mapping
  const dbMappingMap = useMemo(() => {
    const map = new Map<string, string>();
    if (mappingsData) {
      mappingsData.forEach(m => map.set(m.id.toLowerCase().trim(), m.assignedToName));
    }
    return map;
  }, [mappingsData]);

  const groupedRecords = useMemo(() => {
    if (!records || records.length === 0) return [];

    let filtered = records;
    if (!isAdmin) {
      filtered = filtered.filter(r => 
        (r.account && userAccountIds.has(r.account)) || 
        (r.companyName && userAccountNames.has(r.companyName.toLowerCase()))
      );
    }

    // Step 1: Map common customer name to all their unique business units
    const buMap = new Map<string, Set<string>>();
    filtered.forEach(r => {
      const name = r.companyName || 'Unnamed';
      if (!buMap.has(name)) buMap.set(name, new Set());
      if (r.businessUnit) buMap.get(name)!.add(r.businessUnit);
    });

    // Step 2: Group records
    const groups = new Map<string, {
      displayName: string;
      companyName: string;
      businessUnit: string;
      accounts: Set<string>;
      linesOfBusiness: Set<string>;
      value: number;
      categories: Set<string>;
      assignedRep: string;
      isManualMapped: boolean;
    }>();

    filtered.forEach(r => {
      const name = r.companyName || 'Unnamed';
      const cleanName = name.toLowerCase().replace(/\s*\(parcels\)\s*/, '').replace(/\s*\(freight\)\s*/, '').trim();
      const rawName = name.toLowerCase().trim();
      
      let assignedRep = 'Unassigned';
      let isManualMapped = false;
      if (dbMappingMap.has(rawName)) {
        assignedRep = dbMappingMap.get(rawName)!;
        isManualMapped = true;
      } else if (dbMappingMap.has(cleanName)) {
        assignedRep = dbMappingMap.get(cleanName)!;
        isManualMapped = true;
      } else if (baseAccountToUserMap.has(rawName)) {
        assignedRep = baseAccountToUserMap.get(rawName)!;
      } else if (baseAccountToUserMap.has(cleanName)) {
        assignedRep = baseAccountToUserMap.get(cleanName)!;
      }

      const hasMultipleBUs = (buMap.get(name)?.size || 0) > 1;
      // Group by BU if there are multiple BUs, otherwise just by customer name
      const groupKey = hasMultipleBUs ? `${name}::${r.businessUnit || 'Other'}` : name;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          displayName: hasMultipleBUs ? `${name} / ${r.businessUnit || 'Other'}` : name,
          companyName: name,
          businessUnit: hasMultipleBUs ? (r.businessUnit || 'Other') : Array.from(buMap.get(name) || [])[0] || 'Other',
          accounts: new Set(),
          linesOfBusiness: new Set(),
          value: 0,
          categories: new Set(),
          assignedRep,
          isManualMapped
        });
      }

      const g = groups.get(groupKey)!;
      if (r.account) g.accounts.add(r.account);
      if (r.lineOfBusiness) g.linesOfBusiness.add(r.lineOfBusiness);
      if (r.category) g.categories.add(r.category);
      g.value += (Number(r.value) || 0);
    });

    let result = Array.from(groups.values()).map((g, idx) => ({
      id: `group_${idx}`,
      companyName: g.displayName,
      account: Array.from(g.accounts).join(', '),
      businessUnit: g.businessUnit,
      lineOfBusiness: Array.from(g.linesOfBusiness).join(', '),
      value: g.value,
      category: Array.from(g.categories).join(', '),
      assignedRep: g.assignedRep,
      isManualMapped: g.isManualMapped
    })).sort((a, b) => b.value - a.value); // Sort by spend amount desc

    // Apply UI Filters
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.companyName || '').toLowerCase().includes(q) ||
        (r.account || '').toLowerCase().includes(q) ||
        (r.lineOfBusiness || '').toLowerCase().includes(q) ||
        (r.assignedRep || '').toLowerCase().includes(q)
      );
    }
    if (buFilter !== 'all') {
      result = result.filter(r => r.businessUnit === buFilter);
    }
    if (weekFilter !== 'all') {
      result = result.filter(r => r.category.includes(weekFilter));
    }
    if (assignmentFilter === 'ASSIGNED') {
      result = result.filter(r => r.assignedRep !== 'Unassigned');
    } else if (assignmentFilter === 'UNASSIGNED') {
      result = result.filter(r => r.assignedRep === 'Unassigned');
    }

    return result;
  }, [records, searchQuery, buFilter, weekFilter, assignmentFilter, isAdmin, userAccountIds, userAccountNames, baseAccountToUserMap, dbMappingMap]);

  const totalSpend = useMemo(() => {
    return groupedRecords.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  }, [groupedRecords]);

  const unassignedCount = useMemo(() => {
    return groupedRecords.filter(r => r.assignedRep === 'Unassigned').length;
  }, [groupedRecords]);

  const formatCategory = (categoryStr: string) => {
    if (!categoryStr) return '-';
    const cats = categoryStr.split(', ').filter(Boolean).sort();
    if (cats.length === 1) {
      const cat = cats[0];
      return `W${cat.substring(4)} (${cat.substring(0, 4)})`;
    }
    return `${cats.length} Weeks`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800 flex items-center gap-3">
            <Coins className="w-8 h-8 text-primary" />
            Actual Spend Ledger
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Weekly actual revenue tracking for business accounts.</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Filtered Spend</p>
              <h3 className="text-3xl font-black text-slate-800">${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer Groups</p>
              <h3 className="text-3xl font-black text-slate-800">{groupedRecords.length}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${unassignedCount > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white'}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className={`text-[10px] font-black uppercase tracking-widest ${unassignedCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>Unassigned Groups</p>
              <h3 className={`text-3xl font-black ${unassignedCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{unassignedCount}</h3>
            </div>
            <div className={`p-3 rounded-2xl border shrink-0 ${unassignedCount > 0 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
              <UserX className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-end mb-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Search customer, rep, or LOB..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-slate-200"
          />
        </div>
        
        <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
          <SelectTrigger className="w-full md:w-[160px] h-10 border-slate-200">
            <SelectValue placeholder="All Assignments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignments</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
          </SelectContent>
        </Select>

        <Select value={buFilter} onValueChange={setBuFilter}>
          <SelectTrigger className="w-full md:w-[180px] h-10 border-slate-200">
            <SelectValue placeholder="All BU" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Business Units</SelectItem>
            {businessUnits.map(bu => (
              <SelectItem key={bu} value={bu}>{bu}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-full md:w-[180px] h-10 border-slate-200">
            <SelectValue placeholder="All Weeks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>Week {cat.substring(4)} ({cat.substring(0, 4)})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchQuery || buFilter !== 'all' || weekFilter !== 'all' || assignmentFilter !== 'all') && (
          <Button variant="ghost" onClick={() => { setSearchQuery(''); setBuFilter('all'); setWeekFilter('all'); setAssignmentFilter('all'); }} className="h-10 text-slate-500 font-bold">
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
          Loading actual spend data...
        </div>
      ) : groupedRecords.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <Coins className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wide">No spend records found</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Try clearing your search filters or upload a weekly Actual Spend CSV.</p>
        </div>
      ) : (
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl max-w-full">
          <ScrollArea className="h-[600px] w-full">
            <div className="overflow-x-auto max-w-full">
              <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="font-bold">Common Customer Name</TableHead>
                  <TableHead className="font-bold">Assigned Rep</TableHead>
                  <TableHead className="font-bold">Account</TableHead>
                  <TableHead className="font-bold">Business Unit</TableHead>
                  <TableHead className="font-bold text-right">Spend</TableHead>
                  <TableHead className="font-bold text-center">Category/Week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRecords.map((r) => (
                  <TableRow key={r.id} className={`transition-colors ${r.assignedRep === 'Unassigned' ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50'}`}>
                    <TableCell>
                      <div className="font-black text-primary">{r.companyName}</div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={r.assignedRep === 'Unassigned' ? 'unassigned' : r.assignedRep}
                          onValueChange={(val) => {
                            if (val !== 'unassigned') {
                              handleAssignStaff(r.companyName, val);
                            }
                          }}
                        >
                          <SelectTrigger className={`h-8 min-w-[150px] text-xs font-bold ${r.assignedRep === 'Unassigned' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100/80' : 'border-slate-200 bg-white text-slate-800'}`}>
                            <SelectValue placeholder="Assign Staff...">
                              {r.assignedRep === 'Unassigned' ? (
                                <span className="text-red-600 font-extrabold uppercase tracking-wider text-[11px]">Unassigned</span>
                              ) : (
                                <span>
                                  {r.assignedRep}
                                  {r.isManualMapped && <span className="ml-1 text-[10px] text-indigo-500 font-bold">(Aligned)</span>}
                                </span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent align="start" className="max-h-[260px]">
                            <SelectItem value="unassigned" disabled className="text-xs text-slate-400 font-semibold">
                              Unassigned
                            </SelectItem>
                            {formattedUsers.map((u) => (
                              <SelectItem key={u.uid} value={u.uid} className="text-xs font-semibold">
                                {u.name} {u.role ? `(${u.role})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : r.assignedRep === 'Unassigned' ? (
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-600 border-red-200">
                          Unassigned
                        </Badge>
                      ) : (
                        <div className="font-semibold text-sm text-slate-700">
                          {r.assignedRep}
                          {r.isManualMapped && <span className="ml-1 text-[10px] text-indigo-500 font-bold">(Aligned)</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600 max-w-[220px] truncate" title={r.account}>
                      {r.account}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-700">
                        {r.businessUnit}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-black text-indigo-600 text-right">${r.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center font-bold text-slate-500 text-xs">
                      {formatCategory(r.category)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
