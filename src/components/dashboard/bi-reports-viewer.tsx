"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, doc, query, where, setDoc } from 'firebase/firestore';
import { getCurrentWeek } from '@/lib/utils';
import { Loader2, LayoutDashboard, TableProperties, Activity, AlertCircle } from 'lucide-react';

interface CustomDashboard {
  id: string;
  name: string;
  visibleTo: string[];
}

interface ReportWidget {
  id: string;
  dashboardId: string;
  name: string;
  dataSource: string; // 'customers' | 'opportunities' | 'activities'
  field: string;
  calculation: string; // 'sum' | 'count' | 'avg' | 'none'
  type: string; // 'kpi' | 'table'
}

const FIELD_MAP: Record<string, string> = {
  'Customer ID': 'accountMasterCode',
  'Account Owner': 'userName',
  'Account Name': 'pipeline',
  'YTD Revenue This FY': 'currentRevenue',
  'Credit Hold': 'creditHold',
  'Business Unit': 'businessUnit',
  'YTD Revenue Last FY': 'lastYearRevenue',
  'Last Activity': 'lastActivity',
  'Opportunity ID': 'salesforceId',
  'Opportunity Owner': 'userName',
  'Sales Stage': 'stage',
  'Amount': 'value',
  'Probability (%)': 'probability',
  'Expected Trading Date': 'expectedDate',
  'Opportunity Name': 'opportunityName'
};

export function BIReportsViewer() {
  const { profile, isLeader, isGM } = useAuth();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();
  const isAdmin = isLeader || isGM;
  const [isSeeding, setIsSeeding] = useState(false);

  // Load configuration
  const settingsRef = useMemoFirebase(() => db ? doc(db, 'appSettings', 'global') : null, [db]);
  const { data: settingsData, isLoading: isSettingsLoading } = useDoc(settingsRef);

  // Filter dashboards by role visibility
  const availableDashboards: CustomDashboard[] = useMemo(() => {
    if (!settingsData?.customDashboards || !profile) return [];
    return settingsData.customDashboards.filter((d: CustomDashboard) => d.visibleTo.includes(profile.role));
  }, [settingsData, profile]);

  const widgets: ReportWidget[] = settingsData?.reportWidgets || [];

  const [activeTab, setActiveTab] = useState<string | null>(null);

  // Set default tab when dashboards load
  useMemo(() => {
    if (availableDashboards.length > 0 && !activeTab) {
      setActiveTab(availableDashboards[0].id);
    }
  }, [availableDashboards, activeTab]);

  // Load Data
  const pipelineQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'pipelineReviews'), where('week', '==', currentWeek));
  }, [db, currentWeek]);
  const { data: pipelineRecords, isLoading: isPipelineLoading } = useCollection(pipelineQuery);

  const activityQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'weeklyProgress'), where('week', '==', currentWeek));
  }, [db, currentWeek]);
  const { data: activityRecords, isLoading: isActivityLoading } = useCollection(activityQuery);

  const handleInitializeDefaults = async () => {
    if (!db) return;
    setIsSeeding(true);
    try {
      const globalDocRef = doc(db, 'appSettings', 'global');
      await setDoc(globalDocRef, {
        customDashboards: [
          {
            id: 'dash_revenue',
            name: 'Executive Revenue Dashboard',
            visibleTo: ['LEADER', 'GM']
          },
          {
            id: 'dash_activities',
            name: 'Team Activity Breakdown',
            visibleTo: ['LEADER', 'GM', 'BDM']
          }
        ],
        reportWidgets: [
          // Executive Revenue Dashboard
          {
            id: 'widget_rev_total',
            dashboardId: 'dash_revenue',
            name: 'Total Opportunity Value',
            dataSource: 'opportunities',
            field: 'Amount',
            calculation: 'sum',
            type: 'kpi'
          },
          {
            id: 'widget_rev_avg',
            dashboardId: 'dash_revenue',
            name: 'Average Deal Size',
            dataSource: 'opportunities',
            field: 'Amount',
            calculation: 'avg',
            type: 'kpi'
          },
          {
            id: 'widget_rev_count',
            dashboardId: 'dash_revenue',
            name: 'Active Opportunities',
            dataSource: 'opportunities',
            field: 'Opportunity ID',
            calculation: 'count',
            type: 'kpi'
          },
          {
            id: 'widget_rev_table',
            dashboardId: 'dash_revenue',
            name: 'Top Active Deals',
            dataSource: 'opportunities',
            field: 'Amount',
            calculation: 'none',
            type: 'table'
          },
          // Team Activity Breakdown
          {
            id: 'widget_act_count',
            dashboardId: 'dash_activities',
            name: 'Total Activities Logged',
            dataSource: 'activities',
            field: 'Created By: Full Name',
            calculation: 'count',
            type: 'kpi'
          },
          {
            id: 'widget_act_table',
            dashboardId: 'dash_activities',
            name: 'Recent Activities',
            dataSource: 'activities',
            field: 'Subject',
            calculation: 'none',
            type: 'table'
          }
        ]
      }, { merge: true });
    } catch (e) {
      console.error("Failed to seed default BI dashboards", e);
    } finally {
      setIsSeeding(false);
    }
  };

  if (isSettingsLoading || isPipelineLoading || isActivityLoading) {
    return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (availableDashboards.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 max-w-md">
        <div className="bg-indigo-50 p-4 rounded-2xl shadow-inner animate-pulse">
          <LayoutDashboard className="w-12 h-12 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">No Custom Dashboards</h2>
        {isAdmin ? (
          <>
            <p className="text-muted-foreground text-sm leading-relaxed">
              No custom BI dashboards have been configured yet. As an administrator, you can initialize premium default dashboards instantly or configure them in settings.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-2">
              <Button 
                onClick={handleInitializeDefaults} 
                disabled={isSeeding}
                className="font-black uppercase text-xs tracking-wider bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 h-11 px-6 rounded-xl"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Initializing...
                  </>
                ) : (
                  "Initialize Default Dashboards"
                )}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed">
            There are no BI Dashboards configured for your role. Contact your administrator to build reports.
          </p>
        )}
      </div>
    );
  }

  const renderWidget = (widget: ReportWidget) => {
    const rawData = widget.dataSource === 'activities' ? activityRecords : pipelineRecords;
    
    // Filter data based on source
    let filteredData = rawData || [];
    if (widget.dataSource === 'customers') {
      filteredData = (pipelineRecords || []).filter(r => r.isBareAccount);
    } else if (widget.dataSource === 'opportunities') {
      filteredData = (pipelineRecords || []).filter(r => !r.isBareAccount);
    }

    if (widget.type === 'kpi') {
      let result = 0;
      const internalField = FIELD_MAP[widget.field] || widget.field;
      
      if (widget.calculation === 'count') {
        result = filteredData.length;
      } else if (widget.calculation === 'sum' || widget.calculation === 'avg') {
        const sum = filteredData.reduce((acc: number, val: any) => acc + (Number(val[internalField]) || 0), 0);
        result = widget.calculation === 'avg' ? (filteredData.length ? sum / filteredData.length : 0) : sum;
      }

      // Format result (heuristic: if large number, format as money/abbreviated)
      let displayValue = result.toString();
      if (result > 10000 && (widget.field.includes('Revenue') || widget.field.includes('Amount'))) {
        displayValue = `$${(result / 1000000).toFixed(2)}M`;
      } else if (result % 1 !== 0) {
        displayValue = result.toFixed(1);
      } else {
         displayValue = result.toLocaleString();
      }

      return (
        <Card key={widget.id} className="border-none shadow-xl bg-white hover:scale-[1.02] transition-transform">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{widget.name}</p>
              <Activity className="w-4 h-4 text-accent opacity-50" />
            </div>
            <h3 className="text-3xl font-black tracking-tighter text-slate-800">{displayValue}</h3>
            <p className="text-[10px] mt-2 font-bold text-slate-400 capitalize">{widget.calculation} of {widget.field}</p>
          </CardContent>
        </Card>
      );
    }

    if (widget.type === 'table') {
      const internalField = FIELD_MAP[widget.field] || widget.field;
      
      return (
        <Card key={widget.id} className="border-none shadow-xl bg-white col-span-full overflow-hidden">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
              <TableProperties className="w-4 h-4 text-primary" />
              {widget.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0 uppercase text-[9px] font-black tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Primary Entity</th>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-right">{widget.field}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.slice(0, 100).map((row: any, i: number) => {
                    const val = row[internalField];
                    let displayVal = val;
                    if (typeof val === 'number') {
                      displayVal = val > 10000 ? `$${(val/1000000).toFixed(2)}M` : val.toLocaleString();
                    }
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-xs truncate max-w-[200px]">{row.pipeline || row.userId}</td>
                        <td className="px-4 py-3 font-medium text-xs">{row.userName || row.userId}</td>
                        <td className="px-4 py-3 text-right font-black text-xs text-primary">{displayVal}</td>
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-xs font-bold uppercase tracking-widest">No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredData.length > 100 && (
              <div className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-500">Showing first 100 records</div>
            )}
          </CardContent>
        </Card>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg rotate-3">
          <LayoutDashboard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-headline text-slate-900 tracking-tighter uppercase">BI Engine</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Real-time Performance Rendering</p>
        </div>
      </header>

      <Tabs value={activeTab || ''} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border p-1 rounded-xl shadow-sm h-12 inline-flex overflow-x-auto scrollbar-hide max-w-full">
          {availableDashboards.map(dash => (
            <TabsTrigger key={dash.id} value={dash.id} className="font-black uppercase text-[10px] md:text-xs tracking-widest h-full px-6">
              {dash.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {availableDashboards.map(dash => {
          const dashWidgets = widgets.filter(w => w.dashboardId === dash.id);
          return (
            <TabsContent key={dash.id} value={dash.id} className="mt-6">
              {dashWidgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed text-center">
                  <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-500">No widgets configured for this dashboard.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {dashWidgets.map(widget => renderWidget(widget))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
