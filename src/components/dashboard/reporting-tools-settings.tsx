"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutDashboard, FileText, Database, GripVertical, Trash2, Plus, Info, Check, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ReportLayout {
  id: string;
  name: string;
  dataSource: string;
  targetArea: string;
  visibleTo: string[];
}

export function ReportingToolsSettings({ 
  customReports, 
  onChange 
}: { 
  customReports: ReportLayout[], 
  onChange: (reports: ReportLayout[]) => void 
}) {
  const { toast } = useToast();
  const [draggedSource, setDraggedSource] = useState<string | null>(null);

  const dataSources = [
    { id: 'customers', label: 'Customers Export', icon: Database, color: 'bg-blue-100 text-blue-700' },
    { id: 'opportunities', label: 'Opportunities Export', icon: FileText, color: 'bg-green-100 text-green-700' },
    { id: 'activities', label: 'Activities Export', icon: LayoutDashboard, color: 'bg-purple-100 text-purple-700' },
  ];

  const targetAreas = [
    { id: 'crm-performance', label: 'CRM Performance Review' },
    { id: 'friday-synthesis', label: 'Friday Synthesis' },
    { id: 'portfolio', label: 'Portfolio (Accounts)' },
    { id: 'success-plan', label: 'Success Plan' }
  ];

  const handleDrop = (areaId: string) => {
    if (!draggedSource) return;
    
    const newReport: ReportLayout = {
      id: `report_${Date.now()}`,
      name: `Custom ${dataSources.find(d => d.id === draggedSource)?.label} View`,
      dataSource: draggedSource,
      targetArea: areaId,
      visibleTo: ['LEADER', 'GM'], // default visibility
    };
    
    onChange([...(customReports || []), newReport]);
    setDraggedSource(null);
    toast({ title: "Layout Assigned", description: "Configure visibility and name below." });
  };

  const removeReport = (id: string) => {
    onChange((customReports || []).filter(r => r.id !== id));
  };

  const updateReport = (id: string, key: keyof ReportLayout, value: any) => {
    onChange((customReports || []).map(r => r.id === id ? { ...r, [key]: value } : r));
  };

  const toggleVisibility = (reportId: string, role: string) => {
    const report = (customReports || []).find(r => r.id === reportId);
    if (!report) return;
    const current = new Set(report.visibleTo);
    if (current.has(role)) current.delete(role);
    else current.add(role);
    updateReport(reportId, 'visibleTo', Array.from(current));
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Expected Fields Dictionary */}
      <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Info className="w-4 h-4 text-indigo-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-900">CSV Field Dictionary</CardTitle>
              <CardDescription className="text-[11px] mt-0.5">Exact column headers expected by the CRM Importer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="font-black text-xs uppercase text-slate-800 border-b pb-2">Customers Export</h3>
              <ul className="text-[11px] font-medium text-slate-600 space-y-2">
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Customer ID</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Account Owner</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Account Name</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">YTD Revenue This FY</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Credit Hold</Badge></li>
                <li className="text-slate-400 italic">Optional: Business Unit, YTD Revenue Last FY, Last Activity</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-black text-xs uppercase text-slate-800 border-b pb-2">Opportunities Export</h3>
              <ul className="text-[11px] font-medium text-slate-600 space-y-2">
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Customer ID</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Opportunity ID</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Opportunity Owner</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Sales Stage</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Amount</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Probability (%)</Badge></li>
                <li className="text-slate-400 italic">Optional: Expected Trading Date, Opportunity Name</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-black text-xs uppercase text-slate-800 border-b pb-2">Activity Export</h3>
              <ul className="text-[11px] font-medium text-slate-600 space-y-2">
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Assigned</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Completed?</Badge> (1, true, yes)</li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Date</Badge></li>
                <li><Badge className="bg-slate-100 text-slate-800 font-mono text-[9px]">Activity Type</Badge></li>
                <li className="text-slate-400 italic">Optional: Subject</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Drag & Drop Layout Builder */}
      <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-900">Custom Layout Builder</CardTitle>
              <CardDescription className="text-[11px] mt-0.5">Drag a file source into a dashboard area below to configure visibility.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Draggable Sources Palette */}
            <div className="col-span-1 space-y-4">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-3">Available Data Sources</h3>
              <div className="space-y-3">
                {dataSources.map(ds => (
                  <div
                    key={ds.id}
                    draggable
                    onDragStart={() => setDraggedSource(ds.id)}
                    onDragEnd={() => setDraggedSource(null)}
                    className={`p-3 rounded-xl border-2 border-dashed ${ds.color.replace('text', 'border').replace('100', '200')} bg-white cursor-grab active:cursor-grabbing hover:shadow-md transition-all flex items-center gap-3`}
                  >
                    <GripVertical className="w-4 h-4 opacity-50 shrink-0" />
                    <ds.icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">{ds.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop Zones / Target Areas */}
            <div className="col-span-1 lg:col-span-3 space-y-6">
              {targetAreas.map(area => {
                const reportsInArea = (customReports || []).filter(r => r.targetArea === area.id);
                
                return (
                  <div 
                    key={area.id}
                    className={`rounded-2xl border-2 transition-all p-5
                      ${draggedSource ? 'border-dashed border-emerald-400 bg-emerald-50/50' : 'border-slate-100 bg-slate-50'}
                    `}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(area.id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2">
                        {area.label}
                      </h3>
                      {draggedSource && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] uppercase font-black">Drop Here</Badge>}
                    </div>

                    {reportsInArea.length === 0 ? (
                      <div className="h-20 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-white/50 text-slate-400 text-xs font-bold">
                        Drag a data source here to create a custom report block
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reportsInArea.map(report => {
                          const ds = dataSources.find(d => d.id === report.dataSource);
                          return (
                            <div key={report.id} className="bg-white border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-6 relative overflow-hidden">
                               <div className={`absolute top-0 bottom-0 left-0 w-1 ${ds?.color.split(' ')[0] || 'bg-slate-200'}`} />
                               <div className="flex-1 space-y-4">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                       <Badge className={`${ds?.color} border-none font-black text-[9px] uppercase px-2`}>{ds?.label}</Badge>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => removeReport(report.id)} className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                 </div>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] font-black uppercase text-slate-500">Block Title</Label>
                                      <Input 
                                        value={report.name} 
                                        onChange={e => updateReport(report.id, 'name', e.target.value)}
                                        className="h-9 text-xs font-bold"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><Eye className="w-3 h-3"/> Visible To</Label>
                                      <div className="flex gap-2">
                                        {['BDM', 'LEADER', 'GM'].map(role => {
                                          const isActive = report.visibleTo.includes(role);
                                          return (
                                            <Badge
                                              key={role}
                                              onClick={() => toggleVisibility(report.id, role)}
                                              className={`cursor-pointer transition-colors px-3 py-1 font-black text-[10px] border ${isActive ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                            >
                                              {role}
                                            </Badge>
                                          )
                                        })}
                                      </div>
                                    </div>
                                 </div>
                               </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
