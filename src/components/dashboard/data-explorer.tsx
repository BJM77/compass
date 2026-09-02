import { useState, useMemo } from 'react';
import { getCurrentWeek, normalizeBdmName } from '@/lib/utils';
import { usePipelineData } from '@/contexts/pipeline-context';
import { useAuth } from '@/contexts/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { PipelineReview, WeeklyProgress } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Filter, 
  FileText, 
  Database, 
  Users, 
  Briefcase, 
  Activity, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Building2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend, PieChart, Pie } from 'recharts';

export function DataExplorer() {
  const { allPipelineReviews, allWeeklyProgresses, isLoading } = usePipelineData();
  const { isLeader } = useAuth();
  const db = useFirestore();

  // Fetch Firestore users to identify and filter out GUEST users
  const usersQuery = useMemoFirebase(() => db ? collection(db, 'users') : null, [db]);
  const { data: allUsers } = useCollection<any>(usersQuery);

  const [activeTab, setActiveTab] = useState('customers');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedBu, setSelectedBu] = useState('all');
  const [creditHoldFilter, setCreditHoldFilter] = useState('all');
  const [valueRangeFilter, setValueRangeFilter] = useState('all');

  // Sort states for each tab
  const [customerSortField, setCustomerSortField] = useState<'currentRevenue' | 'closedWonValue' | 'pipeline' | 'accountMasterCode'>('currentRevenue');
  const [customerSortDir, setCustomerSortDir] = useState<'asc' | 'desc'>('desc');

  const [oppSortField, setOppSortField] = useState<'value' | 'probability' | 'opportunityName' | 'pipeline' | 'stage'>('value');
  const [oppSortDir, setOppSortDir] = useState<'asc' | 'desc'>('desc');

  const [actSortField, setActSortField] = useState<'total' | 'calls' | 'apps' | 'proposals' | 'deals' | 'name'>('total');
  const [actSortDir, setActSortDir] = useState<'asc' | 'desc'>('desc');

  const availableWeeks = useMemo(() => {
    const current = getCurrentWeek();
    const weeks = new Set<string>([current]);
    allPipelineReviews.forEach(r => { if (r.week) weeks.add(r.week); });
    allWeeklyProgresses.forEach(r => { if (r.week) weeks.add(r.week); });
    return Array.from(weeks).filter(w => w && w <= current).sort().reverse();
  }, [allPipelineReviews, allWeeklyProgresses]);

  const pipelineReviews = useMemo(() => {
    if (selectedWeek !== 'all') {
      return allPipelineReviews.filter(r => r.week === selectedWeek);
    }
    const latestMap = new Map<string, PipelineReview>();
    allPipelineReviews.forEach(r => {
      const key = r.salesforceId || r.accountMasterCode || r.id;
      if (!key) return;
      const existing = latestMap.get(key);
      if (!existing || (r.week || '') > (existing.week || '')) {
        latestMap.set(key, r);
      }
    });
    return Array.from(latestMap.values());
  }, [allPipelineReviews, selectedWeek]);

  const weeklyProgresses = useMemo(() => {
    if (selectedWeek !== 'all') {
      return allWeeklyProgresses.filter(r => r.week === selectedWeek);
    }
    const userTotals = new Map<string, WeeklyProgress>();
    allWeeklyProgresses.forEach(r => {
      const existing = userTotals.get(r.userId) || { ...r, calls: 0, apps: 0, proposals: 0, deals: 0 };
      existing.calls = (existing.calls || 0) + (r.calls || 0);
      existing.apps = (existing.apps || 0) + (r.apps || 0);
      existing.proposals = (existing.proposals || 0) + (r.proposals || 0);
      existing.deals = (existing.deals || 0) + (r.deals || 0);
      userTotals.set(r.userId, existing);
    });
    return Array.from(userTotals.values());
  }, [allWeeklyProgresses, selectedWeek]);

  // Create a helper map to resolve userId -> userName from all data
  const userIdToName = useMemo(() => {
    const map = new Map<string, string>();
    allPipelineReviews.forEach(r => {
      if (r.userName) map.set(r.userId, normalizeBdmName(r.userName, r.userId));
    });
    if (allUsers) {
      allUsers.forEach((u: any) => {
        if (u.id && u.name) map.set(u.id, normalizeBdmName(u.name, u.id));
      });
    }
    return map;
  }, [allPipelineReviews, allUsers]);

  // Set of guest user IDs to EXCLUDE from reporting tools & dropdowns
  const guestUserIds = useMemo(() => {
    const set = new Set<string>();
    if (allUsers) {
      allUsers.forEach((u: any) => {
        const roleUpper = (u.role || '').toUpperCase();
        if (roleUpper === 'GUEST') {
          set.add(u.id);
        }
      });
    }
    return set;
  }, [allUsers]);

  // Extract unique users from data for the filter dropdown (EXCLUDING GUESTS & DEDUPLICATED BY NAME)
  const users = useMemo(() => {
    const userMap = new Map<string, string>();
    const seenNames = new Map<string, string>(); // normalizedName -> userId

    allPipelineReviews.forEach(r => {
      if (r.userId && !guestUserIds.has(r.userId)) {
        const norm = normalizeBdmName(r.userName, r.userId);
        const normKey = norm.toLowerCase();
        if (!seenNames.has(normKey)) {
          seenNames.set(normKey, r.userId);
          userMap.set(r.userId, norm);
        }
      }
    });

    allWeeklyProgresses.forEach(r => {
      if (r.userId && !guestUserIds.has(r.userId)) {
        const norm = userIdToName.get(r.userId) || normalizeBdmName(undefined, r.userId);
        const normKey = norm.toLowerCase();
        if (!seenNames.has(normKey) && !userMap.has(r.userId)) {
          seenNames.set(normKey, r.userId);
          userMap.set(r.userId, norm);
        }
      }
    });

    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [allPipelineReviews, allWeeklyProgresses, userIdToName, guestUserIds]);

  // Extract unique business units
  const businessUnits = useMemo(() => {
    const set = new Set<string>();
    allPipelineReviews.forEach(r => {
      if (r.businessUnit) set.add(r.businessUnit);
    });
    return Array.from(set);
  }, [allPipelineReviews]);

  // Extract unique stages for opportunities
  const stages = useMemo(() => {
    const stageSet = new Set<string>();
    allPipelineReviews.forEach(r => {
      if (!r.isBareAccount && r.stage && r.stage !== 'Existing Customer') {
        stageSet.add(r.stage);
      }
    });
    return Array.from(stageSet);
  }, [allPipelineReviews]);

  // Filter & Sort Customers
  const customers = useMemo(() => {
    const filtered = pipelineReviews.filter(r => {
      const isCustomer = r.isBareAccount || r.stage === 'Existing Customer';
      if (!isCustomer) return false;
      if (r.userId && guestUserIds.has(r.userId)) return false; // Exclude Guest user records
      if (selectedUser !== 'all' && r.userId !== selectedUser) return false;
      if (selectedBu !== 'all' && r.businessUnit !== selectedBu) return false;
      
      if (creditHoldFilter === 'yes' && !r.creditHold) return false;
      if (creditHoldFilter === 'no' && r.creditHold) return false;

      const rev = r.currentRevenue || 0;
      if (valueRangeFilter === 'under100k' && rev >= 100000) return false;
      if (valueRangeFilter === '100kTo500k' && (rev < 100000 || rev > 500000)) return false;
      if (valueRangeFilter === 'over500k' && rev < 500000) return false;

      if (searchQuery) {
        const queryStr = searchQuery.toLowerCase();
        const matchesPipeline = r.pipeline.toLowerCase().includes(queryStr);
        const matchesCode = r.accountMasterCode?.toLowerCase().includes(queryStr) ?? false;
        const matchesUser = r.userName?.toLowerCase().includes(queryStr) ?? false;
        if (!matchesPipeline && !matchesCode && !matchesUser) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let valA: any = a[customerSortField] ?? 0;
      let valB: any = b[customerSortField] ?? 0;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return customerSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return customerSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pipelineReviews, selectedUser, selectedBu, creditHoldFilter, valueRangeFilter, searchQuery, customerSortField, customerSortDir, guestUserIds]);

  // Filter & Sort Opportunities
  const opportunities = useMemo(() => {
    const filtered = pipelineReviews.filter(r => {
      const isOpp = !r.isBareAccount && r.stage !== 'Existing Customer';
      if (!isOpp) return false;
      if (r.userId && guestUserIds.has(r.userId)) return false; // Exclude Guest user records
      if (selectedUser !== 'all' && r.userId !== selectedUser) return false;
      if (selectedStage !== 'all' && r.stage !== selectedStage) return false;
      if (selectedBu !== 'all' && r.businessUnit !== selectedBu) return false;

      const val = r.value || 0;
      if (valueRangeFilter === 'under100k' && val >= 100000) return false;
      if (valueRangeFilter === '100kTo500k' && (val < 100000 || val > 500000)) return false;
      if (valueRangeFilter === 'over500k' && val < 500000) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesPipe = r.pipeline.toLowerCase().includes(q);
        const matchesOpp = r.opportunityName?.toLowerCase().includes(q) ?? false;
        const matchesUser = r.userName?.toLowerCase().includes(q) ?? false;
        if (!matchesPipe && !matchesOpp && !matchesUser) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let valA: any = a[oppSortField] ?? 0;
      let valB: any = b[oppSortField] ?? 0;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return oppSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return oppSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pipelineReviews, selectedUser, selectedStage, selectedBu, valueRangeFilter, searchQuery, oppSortField, oppSortDir, guestUserIds]);

  // Filter & Sort Activities
  const activities = useMemo(() => {
    const filtered = weeklyProgresses.filter(r => {
      if (r.userId && guestUserIds.has(r.userId)) return false; // Exclude Guest user records
      if (selectedUser !== 'all' && r.userId !== selectedUser) return false;
      if (searchQuery) {
        const name = userIdToName.get(r.userId) || r.userId;
        if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (actSortField === 'total') {
        valA = (a.calls || 0) + (a.apps || 0) + (a.proposals || 0) + (a.deals || 0);
        valB = (b.calls || 0) + (b.apps || 0) + (b.proposals || 0) + (b.deals || 0);
      } else if (actSortField === 'name') {
        const nameA = (userIdToName.get(a.userId) || '').toLowerCase();
        const nameB = (userIdToName.get(b.userId) || '').toLowerCase();
        if (nameA < nameB) return actSortDir === 'asc' ? -1 : 1;
        if (nameA > nameB) return actSortDir === 'asc' ? 1 : -1;
        return 0;
      } else {
        valA = (a[actSortField] as number) || 0;
        valB = (b[actSortField] as number) || 0;
      }

      if (valA < valB) return actSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return actSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [weeklyProgresses, selectedUser, searchQuery, userIdToName, actSortField, actSortDir, guestUserIds]);

  const formatMoney = (val: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val || 0);

  // CSV Exporter
  const handleExportCsv = () => {
    let csvContent = '';
    let filename = `compass_${activeTab}_export.csv`;

    if (activeTab === 'customers') {
      csvContent = 'Account Code,Account Name,BDM,Business Unit,YTD Revenue,Closed Won Revenue,Credit Hold\n';
      customers.forEach(c => {
        csvContent += `"${c.accountMasterCode || ''}","${(c.pipeline || '').replace(/"/g, '""')}","${c.userName || ''}","${c.businessUnit || ''}",${c.currentRevenue || 0},${c.closedWonValue || 0},"${c.creditHold ? 'YES' : 'NO'}"\n`;
      });
    } else if (activeTab === 'opportunities') {
      csvContent = 'Salesforce ID,Opportunity Name,Account Name,BDM,Business Unit,Stage,Amount,Probability\n';
      opportunities.forEach(o => {
        csvContent += `"${o.salesforceId || ''}","${(o.opportunityName || '').replace(/"/g, '""')}","${(o.pipeline || '').replace(/"/g, '""')}","${o.userName || ''}","${o.businessUnit || ''}","${o.stage || ''}",${o.value || 0},${o.probability || 0}\n`;
      });
    } else if (activeTab === 'activities') {
      csvContent = 'BDM Name,Calls Logged,Meetings/Apps,Proposals,Deals Won\n';
      activities.forEach(a => {
        const name = userIdToName.get(a.userId) || a.userId;
        csvContent += `"${name}",${a.calls || 0},${a.apps || 0},${a.proposals || 0},${a.deals || 0}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      value: Math.round(s.value / 1000) / 1000,
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
      value: Math.round(bu.value / 1000) / 1000,
      color: COLORS[index % COLORS.length]
    }));
  }, [customers]);

  const [insightIndex, setInsightIndex] = useState(0);

  const toggleCustomerSort = (field: 'currentRevenue' | 'closedWonValue' | 'pipeline' | 'accountMasterCode') => {
    if (customerSortField === field) {
      setCustomerSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCustomerSortField(field);
      setCustomerSortDir('desc');
    }
  };

  const toggleOppSort = (field: 'value' | 'probability' | 'opportunityName' | 'pipeline' | 'stage') => {
    if (oppSortField === field) {
      setOppSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setOppSortField(field);
      setOppSortDir('desc');
    }
  };

  const toggleActSort = (field: 'total' | 'calls' | 'apps' | 'proposals' | 'deals' | 'name') => {
    if (actSortField === field) {
      setActSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setActSortField(field);
      setActSortDir('desc');
    }
  };

  if (isLoading) {
    return <div className="flex h-[400px] items-center justify-center text-slate-500 font-bold uppercase tracking-widest">Loading CRM Data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <Database className="w-7 h-7 text-primary" />
            CRM Data Explorer & Analytics
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs font-medium">
            Multi-dimensional reporting, advanced filtering, and instant CSV export across all accounts and representatives.
          </p>
        </div>
        
        <Button onClick={handleExportCsv} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shrink-0">
          <Download className="w-4 h-4" />
          <span>Export {activeTab.toUpperCase()} CSV</span>
        </Button>
      </div>

      {/* Advanced Filter Toolbar */}
      <Card className="p-4 bg-slate-50/80 dark:bg-slate-900/50 border shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-500" /> Filter & Search Controls
          </span>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => { setActiveTab('activities'); setSelectedWeek(availableWeeks[0] || 'all'); setSearchQuery(''); setSelectedUser('all'); }}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              This Week's Activity
            </button>
            <button 
              onClick={() => { setActiveTab('opportunities'); setSelectedWeek('all'); setSearchQuery(''); setSelectedUser('all'); setSelectedStage('all'); }}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
            >
              All Revenue & Pipeline
            </button>
            <button 
              onClick={() => { setActiveTab('customers'); setSelectedWeek('all'); setSearchQuery(''); setSelectedUser('all'); setSelectedBu('all'); setCreditHoldFilter('all'); }}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              Customer Accounts
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search accounts, opps, or reps..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 font-medium bg-white dark:bg-slate-950"
            />
          </div>

          {/* Week */}
          <Select value={selectedWeek} onValueChange={setSelectedWeek}>
            <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-950">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-xs">All Time</SelectItem>
              {availableWeeks.map(w => (
                <SelectItem key={w} value={w} className="font-medium text-xs">Week {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User (BDM & AM Only) */}
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-950">
              <SelectValue placeholder="BDMs & AMs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-xs">All BDMs & AMs</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id} className="font-medium text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Business Unit */}
          <Select value={selectedBu} onValueChange={setSelectedBu}>
            <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-950">
              <SelectValue placeholder="Business Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-xs">All Business Units</SelectItem>
              {businessUnits.map(bu => (
                <SelectItem key={bu} value={bu} className="font-medium text-xs">{bu}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value Range */}
          <Select value={valueRangeFilter} onValueChange={setValueRangeFilter}>
            <SelectTrigger className="h-9 text-xs font-bold bg-white dark:bg-slate-950">
              <SelectValue placeholder="Revenue Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-xs">All Value Ranges</SelectItem>
              <SelectItem value="under100k" className="font-medium text-xs">&lt; $100K</SelectItem>
              <SelectItem value="100kTo500k" className="font-medium text-xs">$100K - $500K</SelectItem>
              <SelectItem value="over500k" className="font-medium text-xs">$500K+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Smart Insights Banner */}
      {smartInsights.length > 0 && (
        <Card className="border border-slate-200 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/20 dark:from-slate-900 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
              <span className="text-[10px] font-black uppercase text-indigo-950 dark:text-indigo-300 tracking-widest">Compass CRM Insights Engine</span>
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
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
              {smartInsights[insightIndex].text}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl mb-6">
          <TabsTrigger value="customers" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary data-[state=active]:shadow-xs px-6">
            <Users className="w-4 h-4 mr-2" />
            Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary data-[state=active]:shadow-xs px-6">
            <Briefcase className="w-4 h-4 mr-2" />
            Opportunities ({opportunities.length})
          </TabsTrigger>
          <TabsTrigger value="activities" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary data-[state=active]:shadow-xs px-6">
            <Activity className="w-4 h-4 mr-2" />
            Activities ({activities.length})
          </TabsTrigger>
        </TabsList>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers">
          {customersChartData.length > 0 && (
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 p-6 mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider mb-4">Customer Revenue Split by Business Unit</h3>
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

          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            {/* Customer Specific Sub-Filters */}
            <div className="bg-slate-50 dark:bg-slate-950 border-b p-3 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Credit Hold:</span>
                <Select value={creditHoldFilter} onValueChange={setCreditHoldFilter}>
                  <SelectTrigger className="w-[150px] h-8 text-xs font-bold bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Credit Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="font-bold text-xs">All Customers</SelectItem>
                    <SelectItem value="yes" className="font-medium text-xs text-red-600 font-bold">Credit Hold Only</SelectItem>
                    <SelectItem value="no" className="font-medium text-xs">Normal (No Hold)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs font-bold text-slate-500">
                Showing {customers.length} Accounts
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950 border-b">
                  <TableRow>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleCustomerSort('accountMasterCode')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Customer ID</span>
                        {customerSortField === 'accountMasterCode' ? (customerSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleCustomerSort('pipeline')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Account Name</span>
                        {customerSortField === 'pipeline' ? (customerSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead className="font-black text-slate-600 dark:text-slate-400">BDM / AM</TableHead>
                    <TableHead className="font-black text-slate-600 dark:text-slate-400">Business Unit</TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-right cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleCustomerSort('currentRevenue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>YTD Revenue</span>
                        {customerSortField === 'currentRevenue' ? (customerSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-right cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleCustomerSort('closedWonValue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Won Revenue</span>
                        {customerSortField === 'closedWonValue' ? (customerSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead className="font-black text-slate-600 dark:text-slate-400 text-center">Credit Hold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400 font-bold">No customer accounts match criteria.</TableCell></TableRow>
                  ) : customers.map(c => (
                    <TableRow key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <TableCell className="font-medium text-xs">{c.accountMasterCode || '—'}</TableCell>
                      <TableCell className="font-bold text-slate-900 dark:text-slate-100">{c.pipeline}</TableCell>
                      <TableCell className="text-xs font-semibold">{normalizeBdmName(c.userName, c.userId)}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-500">{c.businessUnit || 'General'}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(c.currentRevenue || 0)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatMoney(c.closedWonValue || 0)}</TableCell>
                      <TableCell className="text-center">
                        {c.creditHold ? <Badge variant="destructive" className="text-[10px]">YES</Badge> : <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400">NO</Badge>}
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
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 p-6 mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider mb-4">Active Pipeline Value by Stage</h3>
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

          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-950 border-b p-3 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Stage Filter:</span>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger className="w-[180px] h-8 text-xs font-bold bg-white dark:bg-slate-900">
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

              <div className="text-xs font-bold text-slate-500">
                Showing {opportunities.length} Opportunities
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950 border-b">
                  <TableRow>
                    <TableHead className="font-black text-slate-600 dark:text-slate-400">Opp ID</TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleOppSort('opportunityName')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Opp Name</span>
                        {oppSortField === 'opportunityName' ? (oppSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleOppSort('pipeline')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Account Name</span>
                        {oppSortField === 'pipeline' ? (oppSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead className="font-black text-slate-600 dark:text-slate-400">BDM / AM</TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleOppSort('stage')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Stage</span>
                        {oppSortField === 'stage' ? (oppSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-right cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleOppSort('value')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        {oppSortField === 'value' ? (oppSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-right cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleOppSort('probability')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Prob (%)</span>
                        {oppSortField === 'probability' ? (oppSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400 font-bold">No opportunities match criteria.</TableCell></TableRow>
                  ) : opportunities.map(o => (
                    <TableRow key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <TableCell className="font-medium text-xs text-slate-500">{o.salesforceId || '—'}</TableCell>
                      <TableCell className="font-bold text-sm text-primary">{o.opportunityName || '—'}</TableCell>
                      <TableCell className="font-medium text-xs">{o.pipeline}</TableCell>
                      <TableCell className="text-xs font-semibold">{normalizeBdmName(o.userName, o.userId)}</TableCell>
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
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 p-6 mb-6">
              <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider mb-4">BDM Weekly Activity Comparison</h3>
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

          <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 border-b border-blue-100 dark:border-blue-900 flex items-start gap-3">
              <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-black text-blue-900 dark:text-blue-300 uppercase">Aggregated Weekly Activity</h4>
                <p className="text-xs text-blue-700/80 dark:text-blue-400 mt-1 font-medium max-w-2xl">
                  This table shows the summarized totals of all activities imported for the selected timeframe.
                  Click column headers to sort by calls, meetings, proposals, or wins.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950 border-b">
                  <TableRow>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleActSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>BDM / AM Name</span>
                        {actSortField === 'name' ? (actSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-center cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleActSort('calls')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Calls</span>
                        {actSortField === 'calls' ? (actSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-center cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleActSort('apps')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Meetings / Apps</span>
                        {actSortField === 'apps' ? (actSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-center cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleActSort('proposals')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Opps Created</span>
                        {actSortField === 'proposals' ? (actSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-black text-slate-600 dark:text-slate-400 text-center cursor-pointer hover:text-primary transition-colors"
                      onClick={() => toggleActSort('deals')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Wins</span>
                        {actSortField === 'deals' ? (actSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400 font-bold">No activities match criteria.</TableCell></TableRow>
                  ) : activities.map(a => (
                    <TableRow key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <TableCell className="font-bold text-sm">{normalizeBdmName(userIdToName.get(a.userId), a.userId)}</TableCell>
                      <TableCell className="text-center font-black text-slate-700 dark:text-slate-300">{a.calls || 0}</TableCell>
                      <TableCell className="text-center font-black text-slate-700 dark:text-slate-300">{a.apps || 0}</TableCell>
                      <TableCell className="text-center font-black text-slate-700 dark:text-slate-300">{a.proposals || 0}</TableCell>
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
