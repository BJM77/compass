"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutDashboard, FileText, Database, Plus, Trash2, Edit2, Eye, Activity, Calculator, TableProperties } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export interface CustomDashboard {
  id: string;
  name: string;
  visibleTo: string[];
}

export interface ReportWidget {
  id: string;
  dashboardId: string;
  name: string;
  dataSource: string;
  field: string;
  calculation: string; // 'sum' | 'count' | 'avg' | 'none'
  type: string; // 'kpi' | 'table'
}

const DATA_SOURCES = [
  { id: 'customers', label: 'Customers Export' },
  { id: 'opportunities', label: 'Opportunities Export' },
  { id: 'activities', label: 'Activities Export' }
];

const DICTIONARY: Record<string, string[]> = {
  customers: ['Customer ID', 'Account Owner', 'Account Name', 'YTD Revenue This FY', 'Credit Hold', 'Business Unit', 'YTD Revenue Last FY', 'Last Activity'],
  opportunities: ['Customer ID', 'Opportunity ID', 'Opportunity Owner', 'Sales Stage', 'Amount', 'Probability (%)', 'Expected Trading Date', 'Opportunity Name'],
  activities: ['Assigned', 'Completed?', 'Date', 'Activity Type', 'Subject']
};

export function ReportingToolsSettings({ 
  dashboards, 
  widgets,
  onDashboardsChange,
  onWidgetsChange
}: { 
  dashboards: CustomDashboard[], 
  widgets: ReportWidget[],
  onDashboardsChange: (d: CustomDashboard[]) => void,
  onWidgetsChange: (w: ReportWidget[]) => void
}) {
  const { toast } = useToast();
  const [activeDashId, setActiveDashId] = useState<string | null>(dashboards?.[0]?.id || null);
  
  // Widget Dialog state
  const [showWidgetDialog, setShowWidgetDialog] = useState(false);
  const [newWidget, setNewWidget] = useState<Partial<ReportWidget>>({
     type: 'kpi',
     dataSource: 'opportunities',
     calculation: 'sum'
  });

  const activeDash = dashboards?.find(d => d.id === activeDashId);
  const activeWidgets = widgets?.filter(w => w.dashboardId === activeDashId) || [];

  const addDashboard = () => {
    const newDash: CustomDashboard = {
      id: `dash_${Date.now()}`,
      name: 'New Custom Dashboard',
      visibleTo: ['LEADER', 'GM']
    };
    onDashboardsChange([...(dashboards || []), newDash]);
    setActiveDashId(newDash.id);
  };

  const removeDashboard = (id: string) => {
    onDashboardsChange((dashboards || []).filter(d => d.id !== id));
    onWidgetsChange((widgets || []).filter(w => w.dashboardId !== id));
    if (activeDashId === id) setActiveDashId(null);
  };

  const updateDashboard = (id: string, key: keyof CustomDashboard, val: any) => {
    onDashboardsChange((dashboards || []).map(d => d.id === id ? { ...d, [key]: val } : d));
  };

  const toggleDashVisibility = (dashId: string, role: string) => {
    const dash = (dashboards || []).find(d => d.id === dashId);
    if (!dash) return;
    const current = new Set(dash.visibleTo);
    if (current.has(role)) current.delete(role); else current.add(role);
    updateDashboard(dashId, 'visibleTo', Array.from(current));
  };

  const handleAddWidget = () => {
    if (!activeDashId || !newWidget.name || !newWidget.field) {
      toast({ variant: 'destructive', title: 'Incomplete Widget', description: 'Please fill out all fields.' });
      return;
    }
    const widget: ReportWidget = {
      id: `widget_${Date.now()}`,
      dashboardId: activeDashId,
      name: newWidget.name,
      dataSource: newWidget.dataSource!,
      field: newWidget.field,
      calculation: newWidget.calculation || 'none',
      type: newWidget.type || 'kpi'
    };
    onWidgetsChange([...(widgets || []), widget]);
    setShowWidgetDialog(false);
    setNewWidget({ type: 'kpi', dataSource: 'opportunities', calculation: 'sum' });
  };

  const removeWidget = (id: string) => {
    onWidgetsChange((widgets || []).filter(w => w.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6 lg:h-[700px]">
        {/* Left Pane: Dashboards */}
        <Card className="w-full lg:w-1/3 flex flex-col border-slate-200 shadow-sm overflow-hidden h-[300px] lg:h-auto">
          <CardHeader className="bg-slate-50 border-b p-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-800">Custom Dashboards</CardTitle>
              <Button size="sm" variant="ghost" onClick={addDashboard} className="h-7 w-7 p-0"><Plus className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
            {(dashboards || []).map(dash => (
               <div 
                 key={dash.id}
                 onClick={() => setActiveDashId(dash.id)}
                 className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group transition-all text-sm
                   ${activeDashId === dash.id ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-slate-100 text-slate-700'}
                 `}
               >
                 <span className="font-bold truncate pr-4">{dash.name}</span>
                 <Trash2 
                   className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${activeDashId === dash.id ? 'text-primary-foreground/50 hover:text-white' : 'text-slate-400 hover:text-red-500'}`} 
                   onClick={(e) => { e.stopPropagation(); removeDashboard(dash.id); }} 
                 />
               </div>
            ))}
            {!(dashboards?.length) && (
              <div className="p-8 text-center text-xs text-slate-400 font-bold uppercase">No dashboards yet.</div>
            )}
          </CardContent>
        </Card>

        {/* Right Pane: Canvas */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden h-[500px] lg:h-auto">
          {activeDash ? (
            <>
              <CardHeader className="bg-slate-50 border-b p-6 space-y-4">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 w-full max-w-md">
                     <Label className="text-[10px] font-black uppercase text-slate-500">Dashboard Title</Label>
                     <Input 
                       value={activeDash.name} 
                       onChange={e => updateDashboard(activeDash.id, 'name', e.target.value)}
                       className="font-black text-lg h-12"
                     />
                  </div>
                  <div className="space-y-2 lg:text-right w-full lg:w-auto">
                     <Label className="text-[10px] font-black uppercase text-slate-500 flex lg:justify-end gap-1"><Eye className="w-3 h-3"/> Visible To</Label>
                     <div className="flex gap-2">
                       {['BDM', 'LEADER', 'GM'].map(role => {
                         const isActive = activeDash.visibleTo.includes(role);
                         return (
                           <Badge
                             key={role}
                             onClick={() => toggleDashVisibility(activeDash.id, role)}
                             className={`cursor-pointer transition-colors px-3 py-1 font-black text-[10px] border ${isActive ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                           >
                             {role}
                           </Badge>
                         )
                       })}
                     </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-1 overflow-y-auto bg-slate-50/50">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="text-sm font-black uppercase text-slate-700">Dashboard Canvas</h3>
                   <Button size="sm" onClick={() => setShowWidgetDialog(true)} className="gap-2 font-bold text-xs"><Plus className="w-3.5 h-3.5" /> Add Widget</Button>
                 </div>
                 
                 {activeWidgets.length === 0 ? (
                   <div className="border-2 border-dashed border-slate-200 rounded-2xl h-40 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest bg-white">
                     Empty Canvas. Add a widget.
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {activeWidgets.map(w => (
                       <div key={w.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group">
                         <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center gap-2">
                             {w.type === 'kpi' ? <Activity className="w-4 h-4 text-emerald-500" /> : <TableProperties className="w-4 h-4 text-blue-500" />}
                             <span className="font-bold text-sm text-slate-800 truncate pr-2">{w.name}</span>
                           </div>
                           <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 opacity-0 group-hover:opacity-100" onClick={() => removeWidget(w.id)}>
                             <Trash2 className="w-3.5 h-3.5 hover:text-red-500" />
                           </Button>
                         </div>
                         <div className="space-y-1.5 text-xs">
                           <div className="flex justify-between text-slate-500"><span className="uppercase font-bold text-[9px]">Source:</span> <span className="font-medium truncate pl-2">{DATA_SOURCES.find(d=>d.id===w.dataSource)?.label}</span></div>
                           <div className="flex justify-between text-slate-500"><span className="uppercase font-bold text-[9px]">Field:</span> <span className="font-medium truncate pl-2">{w.field}</span></div>
                           <div className="flex justify-between text-slate-500"><span className="uppercase font-bold text-[9px]">Calculation:</span> <span className="font-bold uppercase text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">{w.calculation}</span></div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold uppercase">
              Select or create a dashboard
            </div>
          )}
        </Card>
      </div>

      <Dialog open={showWidgetDialog} onOpenChange={setShowWidgetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-slate-800">Configure New Widget</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase">Widget Name</Label>
              <Input placeholder="e.g. Total Revenue" value={newWidget.name || ''} onChange={e => setNewWidget({...newWidget, name: e.target.value})} className="font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Widget Type</Label>
                <Select value={newWidget.type} onValueChange={v => setNewWidget({...newWidget, type: v, calculation: v === 'table' ? 'none' : 'sum'})}>
                  <SelectTrigger className="font-bold"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kpi" className="font-bold">KPI Metric Card</SelectItem>
                    <SelectItem value="table" className="font-bold">Data Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Data Source</Label>
                <Select value={newWidget.dataSource} onValueChange={v => setNewWidget({...newWidget, dataSource: v, field: ''})}>
                  <SelectTrigger className="font-bold"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map(d => <SelectItem key={d.id} value={d.id} className="font-bold">{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Target Field</Label>
                <Select value={newWidget.field} onValueChange={v => setNewWidget({...newWidget, field: v})}>
                  <SelectTrigger className="font-bold"><SelectValue placeholder="Select..."/></SelectTrigger>
                  <SelectContent>
                    {DICTIONARY[newWidget.dataSource || 'opportunities'].map(f => <SelectItem key={f} value={f} className="font-bold">{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              
              {newWidget.type === 'kpi' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Calculation</Label>
                  <Select value={newWidget.calculation} onValueChange={v => setNewWidget({...newWidget, calculation: v})}>
                    <SelectTrigger className="font-bold"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum" className="font-bold">Sum (Total)</SelectItem>
                      <SelectItem value="count" className="font-bold">Count</SelectItem>
                      <SelectItem value="avg" className="font-bold">Average</SelectItem>
                      <SelectItem value="none" className="font-bold">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWidgetDialog(false)} className="font-black">CANCEL</Button>
            <Button onClick={handleAddWidget} className="font-black">CREATE WIDGET</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
