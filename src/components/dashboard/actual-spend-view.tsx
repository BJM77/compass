"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Banknote, Calendar, Layers, Coins, Landmark } from 'lucide-react';
import { ActualSpendRecord } from '@/types/crm';

export function ActualSpendView() {
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [buFilter, setBuFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');

  const actualQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'actualRevenues'), orderBy('category', 'desc'));
  }, [db]);

  const { data: records, isLoading } = useCollection<ActualSpendRecord>(actualQuery);

  const businessUnits = useMemo(() => {
    if (!records) return [];
    return Array.from(new Set(records.map(r => r.businessUnit).filter(Boolean))).sort();
  }, [records]);

  const categories = useMemo(() => {
    if (!records) return [];
    return Array.from(new Set(records.map(r => r.category).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    let result = [...records];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        (r.companyName || '').toLowerCase().includes(q) ||
        (r.account || '').toLowerCase().includes(q) ||
        (r.lineOfBusiness || '').toLowerCase().includes(q)
      );
    }

    if (buFilter !== 'all') {
      result = result.filter(r => r.businessUnit === buFilter);
    }

    if (weekFilter !== 'all') {
      result = result.filter(r => r.category === weekFilter);
    }

    return result;
  }, [records, searchQuery, buFilter, weekFilter]);

  const totalSpend = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  }, [filteredRecords]);

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
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Actual Spend</p>
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
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Active Accounts</p>
              <h3 className="text-3xl font-black text-slate-800">{new Set(filteredRecords.map(r => r.account)).size}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
              <Landmark className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Record Entries Count</p>
              <h3 className="text-3xl font-black text-slate-800">{filteredRecords.length}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-end mb-4 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1 w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Search customer, account or LOB..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-slate-200"
          />
        </div>
        
        <Select value={buFilter} onValueChange={setBuFilter}>
          <SelectTrigger className="w-full md:w-[200px] h-10 border-slate-200">
            <SelectValue placeholder="Filter by Business Unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Business Units</SelectItem>
            {businessUnits.map(bu => (
              <SelectItem key={bu} value={bu}>{bu}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-full md:w-[200px] h-10 border-slate-200">
            <SelectValue placeholder="Filter by Week/Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>Week {cat.substring(4)} ({cat.substring(0, 4)})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchQuery || buFilter !== 'all' || weekFilter !== 'all') && (
          <Button variant="ghost" onClick={() => { setSearchQuery(''); setBuFilter('all'); setWeekFilter('all'); }} className="h-10 text-slate-500 font-bold">
            Clear Filters
          </Button>
        )}
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center text-slate-500 font-bold uppercase tracking-widest">
          Loading actual spend data...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl bg-slate-50">
          <Coins className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wide">No spend records found</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Try clearing your search filters or upload a weekly Actual Spend CSV.</p>
        </div>
      ) : (
        <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl">
          <ScrollArea className="h-[600px] w-full">
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="font-bold">Common Customer Name</TableHead>
                  <TableHead className="font-bold">Account</TableHead>
                  <TableHead className="font-bold">Business Unit</TableHead>
                  <TableHead className="font-bold">Line of Business</TableHead>
                  <TableHead className="font-bold text-right">Spend</TableHead>
                  <TableHead className="font-bold text-center">Category/Week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((r, i) => (
                  <TableRow key={r.id || i} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-black text-primary">{r.companyName || 'Unnamed'}</TableCell>
                    <TableCell className="text-xs font-semibold text-slate-600">{r.account || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-700">
                        {r.businessUnit || 'Other'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-semibold">{r.lineOfBusiness || '-'}</TableCell>
                    <TableCell className="font-black text-indigo-600 text-right">${(Number(r.value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center font-bold text-slate-500 text-xs">
                      {r.category ? `W${r.category.substring(4)} (${r.category.substring(0,4)})` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
