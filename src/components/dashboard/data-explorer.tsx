"use client";

import { useState, useMemo } from 'react';
import { usePipelineData } from '@/contexts/pipeline-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, FileText, Database, Users, Briefcase, Activity } from 'lucide-react';

export function DataExplorer() {
  const { pipelineReviews, weeklyProgresses, isLoading } = usePipelineData();
  
  const [activeTab, setActiveTab] = useState('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');

  // Create a helper map to resolve userId -> userName from pipelineReviews
  const userIdToName = useMemo(() => {
    const map = new Map<string, string>();
    pipelineReviews.forEach(r => {
      if (r.userName) map.set(r.userId, r.userName);
    });
    return map;
  }, [pipelineReviews]);

  // Extract unique users from data for the filter dropdown
  const users = useMemo(() => {
    const userMap = new Map<string, string>();
    pipelineReviews.forEach(r => {
      if (r.userName) userMap.set(r.userId, r.userName);
    });
    weeklyProgresses.forEach(r => {
      if (!userMap.has(r.userId)) {
        userMap.set(r.userId, userIdToName.get(r.userId) || `BDM (${r.userId})`);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [pipelineReviews, weeklyProgresses, userIdToName]);

  // Extract unique stages for opportunities
  const stages = useMemo(() => {
    const stageSet = new Set<string>();
    pipelineReviews.forEach(r => {
      if (!r.isBareAccount && r.stage && r.stage !== 'Existing Customer') {
        stageSet.add(r.stage);
      }
    });
    return Array.from(stageSet);
  }, [pipelineReviews]);

  // Filter Data
  const customers = useMemo(() => {
    return pipelineReviews.filter(r => {
      const isCustomer = r.isBareAccount || r.stage === 'Existing Customer';
      if (!isCustomer) return false;
      if (selectedUser !== 'all' && r.userId !== selectedUser) return false;
      if (searchQuery) {
        const queryStr = searchQuery.toLowerCase();
        const matchesPipeline = r.pipeline.toLowerCase().includes(queryStr);
        const matchesCode = r.accountMasterCode?.toLowerCase().includes(queryStr) ?? false;
        if (!matchesPipeline && !matchesCode) return false;
      }
      return true;
    });
  }, [pipelineReviews, selectedUser, searchQuery]);

  const opportunities = useMemo(() => {
    return pipelineReviews.filter(r => {
      const isOpp = !r.isBareAccount && r.stage !== 'Existing Customer';
      if (!isOpp) return false;
      if (selectedUser !== 'all' && r.userId !== selectedUser) return false;
      if (selectedStage !== 'all' && r.stage !== selectedStage) return false;
      if (searchQuery && !r.pipeline.toLowerCase().includes(searchQuery.toLowerCase()) && !r.opportunityName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [pipelineReviews, selectedUser, selectedStage, searchQuery]);

  const activities = useMemo(() => {
    return weeklyProgresses.filter(r => {
      if (selectedUser !== 'all' && r.userId !== selectedUser) return false;
      if (searchQuery) {
        const name = userIdToName.get(r.userId) || r.userId;
        if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [weeklyProgresses, selectedUser, searchQuery, userIdToName]);

  const formatMoney = (val: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val || 0);

  if (isLoading) {
    return <div className="flex h-[400px] items-center justify-center text-slate-500 font-bold uppercase tracking-widest">Loading CRM Data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-800 flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            Data Explorer
          </h2>
          <p className="text-slate-500 mt-1 font-medium">Browse, filter, and inspect all imported CRM records.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search names or IDs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 font-medium border-slate-200"
            />
          </div>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-full sm:w-[200px] font-bold">
              <SelectValue placeholder="Filter by User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">All Users</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id} className="font-medium">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="customers" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6">
            <Users className="w-4 h-4 mr-2" />
            Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6">
            <Briefcase className="w-4 h-4 mr-2" />
            Opportunities ({opportunities.length})
          </TabsTrigger>
          <TabsTrigger value="activities" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6">
            <Activity className="w-4 h-4 mr-2" />
            Activities ({activities.length})
          </TabsTrigger>
        </TabsList>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b">
                  <TableRow>
                    <TableHead className="font-black text-slate-500">Customer ID</TableHead>
                    <TableHead className="font-black text-slate-500">Account Name</TableHead>
                    <TableHead className="font-black text-slate-500">BDM</TableHead>
                    <TableHead className="font-black text-slate-500 text-right">YTD Revenue</TableHead>
                    <TableHead className="font-black text-slate-500 text-right">Won Revenue</TableHead>
                    <TableHead className="font-black text-slate-500 text-center">Credit Hold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400 font-bold">No customers found.</TableCell></TableRow>
                  ) : customers.map(c => (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-xs">{c.accountMasterCode}</TableCell>
                      <TableCell className="font-bold">{c.pipeline}</TableCell>
                      <TableCell className="text-xs">{c.userName}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(c.currentRevenue || 0)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatMoney(c.closedWonValue || 0)}</TableCell>
                      <TableCell className="text-center">
                        {c.creditHold ? <Badge variant="destructive" className="text-[10px]">YES</Badge> : <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-400">NO</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* OPPORTUNITIES TAB */}
        <TabsContent value="opportunities">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            {activeTab === 'opportunities' && (
              <div className="bg-slate-50 border-b p-3 flex gap-4 items-center">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 ml-2">Stage Filter:</span>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger className="w-[200px] h-8 text-xs font-bold bg-white">
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-bold text-xs">All Stages</SelectItem>
                    {stages.map(s => (
                      <SelectItem key={s} value={s} className="font-medium text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b">
                  <TableRow>
                    <TableHead className="font-black text-slate-500">Opp ID</TableHead>
                    <TableHead className="font-black text-slate-500">Opp Name</TableHead>
                    <TableHead className="font-black text-slate-500">Account Name</TableHead>
                    <TableHead className="font-black text-slate-500">BDM</TableHead>
                    <TableHead className="font-black text-slate-500">Stage</TableHead>
                    <TableHead className="font-black text-slate-500 text-right">Amount</TableHead>
                    <TableHead className="font-black text-slate-500 text-right">Prob (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400 font-bold">No opportunities found.</TableCell></TableRow>
                  ) : opportunities.map(o => (
                    <TableRow key={o.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-xs text-slate-500">{o.salesforceId}</TableCell>
                      <TableCell className="font-bold text-sm text-primary">{o.opportunityName || '—'}</TableCell>
                      <TableCell className="font-medium text-xs">{o.pipeline}</TableCell>
                      <TableCell className="text-xs">{o.userName}</TableCell>
                      <TableCell>
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">{o.stage}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatMoney(o.value || 0)}</TableCell>
                      <TableCell className="text-right font-medium text-xs">{o.probability}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ACTIVITIES TAB */}
        <TabsContent value="activities">
          <Card className="border-none shadow-xl bg-white overflow-hidden">
            <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-start gap-3">
              <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-blue-900 uppercase">Aggregated Weekly Activity</h4>
                <p className="text-xs text-blue-700/80 mt-1 font-medium max-w-2xl">
                  This table shows the summarized totals of all activities imported for the current week. 
                  Individual phone calls and meetings are aggregated into these totals during the CRM import process.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 border-b">
                  <TableRow>
                    <TableHead className="font-black text-slate-500">BDM Name</TableHead>
                    <TableHead className="font-black text-slate-500 text-center">Calls</TableHead>
                    <TableHead className="font-black text-slate-500 text-center">Meetings / Apps</TableHead>
                    <TableHead className="font-black text-slate-500 text-center">Opps Created</TableHead>
                    <TableHead className="font-black text-slate-500 text-center">Wins</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400 font-bold">No activities found.</TableCell></TableRow>
                  ) : activities.map(a => (
                    <TableRow key={a.id} className="hover:bg-slate-50">
                      <TableCell className="font-bold text-sm">{userIdToName.get(a.userId) || `BDM (${a.userId})`}</TableCell>
                      <TableCell className="text-center font-black text-slate-700">{a.calls || 0}</TableCell>
                      <TableCell className="text-center font-black text-slate-700">{a.apps || 0}</TableCell>
                      <TableCell className="text-center font-black text-slate-700">{a.proposals || 0}</TableCell>
                      <TableCell className="text-center font-black text-emerald-600">{a.deals || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
