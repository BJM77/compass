import { useState, useMemo } from 'react';
import { usePipelineData } from '@/contexts/pipeline-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, FileText, Database, Users, Briefcase, Activity, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend, PieChart, Pie } from 'recharts';

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

  // Automated Smart Insights
  const smartInsights = useMemo(() => {
    const insights: { type: 'warning' | 'info' | 'success'; text: string }[] = [];

    // 1. Stalled deals / High value deals at risk
    const highValueStalled = pipelineReviews.filter(r => 
      !r.isBareAccount && 
      r.stage !== 'Existing Customer' && 
      (r.value || 0) >= 500000 && 
      (r.daysInStage || 0) > 30
    );
    if (highValueStalled.length > 0) {
      insights.push({
        type: 'warning',
        text: `Alert: ${highValueStalled.length} high-value opportunity(s) (>= $500K) have been stalled in their stage for over 30 days.`
      });
    }

    // 2. Accounts on Credit Hold with active pipeline
    const creditHoldWithPipeline = pipelineReviews.filter(r => 
      r.creditHold && 
      !r.isBareAccount && 
      r.stage !== 'Existing Customer' && 
      (r.value || 0) > 0
    );
    if (creditHoldWithPipeline.length > 0) {
      const totalRisk = creditHoldWithPipeline.reduce((sum, r) => sum + (r.value || 0), 0);
      insights.push({
        type: 'warning',
        text: `Risk: ${creditHoldWithPipeline.length} customer accounts on Credit Hold have active opportunities worth ${formatMoney(totalRisk)}.`
      });
    }

    // 3. Top performing BDM
    let topBDM = { name: '', value: 0 };
    const bdmWonMap = new Map<string, number>();
    pipelineReviews.forEach(r => {
      if (r.userName && r.closedWonValue) {
        bdmWonMap.set(r.userName, (bdmWonMap.get(r.userName) || 0) + r.closedWonValue);
      }
    });
    bdmWonMap.forEach((val, name) => {
      if (val > topBDM.value) topBDM = { name, value: val };
    });
    if (topBDM.value > 0) {
      insights.push({
        type: 'success',
        text: `BDM Milestone: ${topBDM.name} leads the team this week with ${formatMoney(topBDM.value)} in Closed-Won revenue!`
      });
    }

    // 4. Low activity alert
    const lowActivityBDMs: string[] = [];
    weeklyProgresses.forEach(p => {
      const name = userIdToName.get(p.userId) || p.userId;
      if ((p.calls || 0) + (p.apps || 0) < 5) {
        lowActivityBDMs.push(name);
      }
    });
    if (lowActivityBDMs.length > 0) {
      insights.push({
        type: 'info',
        text: `Activity Alert: ${lowActivityBDMs.join(', ')} logged fewer than 5 client interactions (calls + meetings) this week.`
      });
    }

    // 5. Total active pipeline value
    const activeOpps = pipelineReviews.filter(r => !r.isBareAccount && r.stage !== 'Existing Customer');
    if (activeOpps.length > 0) {
      const totalPipeline = activeOpps.reduce((sum, r) => sum + (r.value || 0), 0);
      insights.push({
        type: 'info',
        text: `Pipeline Strength: Total active sales pipeline is valued at ${formatMoney(totalPipeline)} across ${activeOpps.length} opportunities.`
      });
    }

    return insights;
  }, [pipelineReviews, weeklyProgresses, userIdToName]);

  // Chart data calculations
  const opportunitiesChartData = useMemo(() => {
    const stageMap = new Map<string, { stage: string; value: number; count: number }>();
    opportunities.forEach(o => {
      const stageName = o.stage || 'Unknown';
      const existing = stageMap.get(stageName) || { stage: stageName, value: 0, count: 0 };
      existing.value += o.value || 0;
      existing.count += 1;
      stageMap.set(stageName, existing);
    });
    return Array.from(stageMap.values()).map(s => ({
      stage: s.stage,
      value: Math.round(s.value / 1000) / 1000, // format to Millions (e.g., $1.2M)
      count: s.count
    }));
  }, [opportunities]);

  const activitiesChartData = useMemo(() => {
    return activities.map(a => {
      const name = userIdToName.get(a.userId) || `BDM (${a.userId})`;
      return {
        name,
        calls: a.calls || 0,
        meetings: a.apps || 0,
        proposals: a.proposals || 0,
        wins: a.deals || 0
      };
    });
  }, [activities, userIdToName]);

  const customersChartData = useMemo(() => {
    const buMap = new Map<string, { name: string; value: number }>();
    customers.forEach(c => {
      const bu = c.businessUnit || 'Default';
      const existing = buMap.get(bu) || { name: bu, value: 0 };
      existing.value += c.currentRevenue || 0;
      buMap.set(bu, existing);
    });
    const COLORS = ['#2563eb', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'];
    return Array.from(buMap.values()).map((bu, index) => ({
      ...bu,
      value: Math.round(bu.value / 1000) / 1000, // Millions
      color: COLORS[index % COLORS.length]
    }));
  }, [customers]);

  const [insightIndex, setInsightIndex] = useState(0);

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

      {/* Smart Insights Banner */}
      {smartInsights.length > 0 && (
        <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/20 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase text-indigo-950 tracking-widest">Compass CRM Insights Engine</span>
            </div>
            {smartInsights.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setInsightIndex(prev => (prev - 1 + smartInsights.length) % smartInsights.length)}
                  className="p-1 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-800 transition-colors"
                >
                  &lt;
                </button>
                <span className="text-[9px] font-bold text-slate-500 uppercase">{insightIndex + 1} / {smartInsights.length}</span>
                <button 
                  onClick={() => setInsightIndex(prev => (prev + 1) % smartInsights.length)}
                  className="p-1 rounded hover:bg-slate-200/50 text-slate-400 hover:text-slate-800 transition-colors"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
          <CardContent className="p-4 px-6 flex items-center justify-between min-h-[52px]">
            <p className="text-xs font-bold text-slate-700 leading-relaxed">
              {smartInsights[insightIndex].text}
            </p>
          </CardContent>
        </Card>
      )}

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
          {customersChartData.length > 0 && (
            <Card className="border-none shadow-xl bg-white p-6 mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-4">Customer Revenue Split by Business Unit</h3>
              <div className="h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customersChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      label={({ name, value }: { name: string; value: number }) => `${name}: $${value.toFixed(1)}M`}
                    >
                      {customersChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}M`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

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
          {opportunitiesChartData.length > 0 && (
            <Card className="border-none shadow-xl bg-white p-6 mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-4">Active Pipeline Value by Stage</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opportunitiesChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="stage" tickLine={false} className="text-[10px] font-bold uppercase tracking-wider text-slate-500" />
                    <YAxis tickLine={false} className="text-[10px] font-bold text-slate-500" unit="M" />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}M`} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                      {opportunitiesChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2563eb' : '#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

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
          {activitiesChartData.length > 0 && (
            <Card className="border-none shadow-xl bg-white p-6 mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider mb-4">BDM Weekly Activity Comparison</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activitiesChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} className="text-[10px] font-bold uppercase tracking-wider text-slate-500" />
                    <YAxis tickLine={false} className="text-[10px] font-bold text-slate-500" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="calls" name="Calls Logged" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="meetings" name="Meetings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="proposals" name="Proposals" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

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
