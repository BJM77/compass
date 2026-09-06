"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useDiagnostics } from '@/contexts/diagnostics-context';
import { useNavigation } from '@/contexts/navigation-context';
import { usePipelineData } from '@/contexts/pipeline-context';
import { getCurrentWeek } from '@/lib/utils';
import { 
  Wrench, 
  X, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Clock, 
  ShieldAlert, 
  RefreshCw, 
  ChevronRight, 
  ChevronDown,
  Layers,
  UserCheck,
  Search,
  Zap,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function DeveloperDiagnostics() {
  const { isSuperAdmin, user, profile } = useAuth();
  const { 
    activeReport, 
    isDrawerOpen, 
    setIsDrawerOpen, 
    deepAuditResults, 
    isDeepAuditing, 
    runDeepAudit 
  } = useDiagnostics();
  const { currentView } = useNavigation();
  const { simulationUid, activeUserId } = usePipelineData();

  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    collections: true,
    issues: true,
    metrics: true,
    deepAudit: false
  });

  // HARD SECURITY GATE: If not super admin, render nothing and execute zero UI logic
  if (!isSuperAdmin) {
    return null;
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Compute overall status badge
  const issues = activeReport?.issues || [];
  const errorsCount = issues.filter(i => i.severity === 'error').length;
  const warningsCount = issues.filter(i => i.severity === 'warning').length;

  const currentWeek = getCurrentWeek();

  // Export full diagnostic report to clipboard
  const handleCopyReport = () => {
    const reportPayload = {
      diagnosticHeader: {
        timestamp: new Date().toISOString(),
        currentView,
        activePageReported: activeReport?.pageName || currentView,
        superAdminUser: user?.email,
        authUid: user?.uid,
        role: profile?.role,
        salesWeek: currentWeek,
        simulationUid: simulationUid || 'None (Direct)',
        activeUserId: activeUserId || user?.uid,
        appVersion: 'Compass-2026.1-prod'
      },
      pageCollections: activeReport?.collections || [],
      customMetrics: activeReport?.customMetrics || {},
      activeIssues: activeReport?.issues || [],
      deepAuditSnapshot: deepAuditResults || 'Not Run'
    };

    navigator.clipboard.writeText(JSON.stringify(reportPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      {/* Floating Trigger Pill (Fixed Bottom Right) */}
      <aside 
        aria-label="Developer Diagnostics Controls"
        className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 print:hidden"
      >
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl transition-all duration-300 border text-xs font-black uppercase tracking-wider backdrop-blur-md ${
            errorsCount > 0 
              ? 'bg-rose-950/90 text-rose-200 border-rose-600 hover:bg-rose-900 shadow-rose-900/40' 
              : warningsCount > 0
              ? 'bg-amber-950/90 text-amber-200 border-amber-600 hover:bg-amber-900 shadow-amber-900/40'
              : 'bg-slate-900/90 text-emerald-400 border-emerald-500/40 hover:bg-slate-800 shadow-slate-950/50'
          }`}
          title="Super Admin Developer Diagnostics"
        >
          <Wrench className={`w-3.5 h-3.5 ${isDeepAuditing ? 'animate-spin text-amber-400' : ''}`} />
          <span className="font-mono">Dev Diagnostics</span>
          {errorsCount > 0 ? (
            <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-mono">
              {errorsCount}
            </span>
          ) : warningsCount > 0 ? (
            <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-mono">
              {warningsCount}
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </aside>

      {/* Slide-over Diagnostics Drawer */}
      {isDrawerOpen && (
        <aside 
          aria-label="Developer Diagnostics Drawer"
          className="fixed inset-y-0 right-0 z-[10000] w-full sm:w-[540px] bg-slate-950 border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 print:hidden font-sans"
        >
          {/* Header */}
          <header className="p-4 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">Developer Diagnostics</h2>
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    Super Admin
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">Active Page: <strong className="text-indigo-400">{currentView}</strong></p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyReport}
                className="h-8 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Export JSON'}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsDrawerOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Body Content */}
          <ScrollArea className="flex-1 p-4 space-y-4">
            {/* System Context Banner */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session Context</span>
                <span className="font-mono text-[10px] text-emerald-400 font-bold">{user?.email}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500">Sales Week:</span> <strong className="text-white">{currentWeek}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Role:</span> <strong className="text-white">{profile?.role || 'None'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Active UID:</span> <strong className="text-indigo-400 truncate inline-block max-w-[150px] align-bottom" title={activeUserId || ''}>{activeUserId || 'None'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Simulating:</span> <strong className={simulationUid ? "text-amber-400" : "text-slate-400"}>{simulationUid ? 'YES' : 'NO'}</strong>
                </div>
              </div>
            </div>

            {/* In-Memory Collections Health */}
            <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden mt-4">
              <button 
                onClick={() => toggleSection('collections')}
                className="w-full p-3 flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Page Collections (In-Memory)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-800 text-slate-300">
                    {activeReport?.collections?.length || 0} Registered
                  </Badge>
                  {expandedSections.collections ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {expandedSections.collections && (
                <div className="p-3 divide-y divide-slate-800/60 text-xs">
                  {(!activeReport?.collections || activeReport.collections.length === 0) ? (
                    <div className="py-4 text-center text-slate-500 text-xs italic">
                      No explicit collection telemetry published for {currentView}.
                    </div>
                  ) : (
                    activeReport.collections.map((coll, idx) => (
                      <div key={coll.name + idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 font-mono text-[11px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 font-bold">{coll.name}</span>
                            {coll.status === 'ready' && coll.count === 0 && (
                              <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[9px] py-0">EMPTY</Badge>
                            )}
                            {coll.status === 'error' && (
                              <Badge className="bg-rose-950 text-rose-300 border-rose-800 text-[9px] py-0">ERROR</Badge>
                            )}
                            {coll.status === 'permission-denied' && (
                              <Badge className="bg-rose-900 text-rose-200 border-rose-700 text-[9px] py-0">DENIED</Badge>
                            )}
                            {coll.status === 'loading' && (
                              <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[9px] py-0">LOADING</Badge>
                            )}
                          </div>
                          {coll.error && (
                            <p className="text-[10px] text-rose-400 font-sans">{coll.error}</p>
                          )}
                          {coll.sampleNames && coll.sampleNames.length > 0 && (
                            <p className="text-[10px] text-slate-500 font-sans truncate max-w-[320px]">
                              Samples: {coll.sampleNames.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <span className={`font-bold ${coll.count === 0 ? 'text-slate-500' : 'text-emerald-400'}`}>
                            {coll.count !== undefined ? `${coll.count} docs` : '—'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>

            {/* Custom Page Metrics */}
            {activeReport?.customMetrics && Object.keys(activeReport.customMetrics).length > 0 && (
              <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden mt-4">
                <button 
                  onClick={() => toggleSection('metrics')}
                  className="w-full p-3 flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">View Metrics & State</h3>
                  </div>
                  {expandedSections.metrics ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expandedSections.metrics && (
                  <div className="p-3 grid grid-cols-2 gap-2 text-xs font-mono">
                    {Object.entries(activeReport.customMetrics).map(([key, val]) => (
                      <div key={key} className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/50">
                        <span className="text-[10px] text-slate-400 block truncate">{key}</span>
                        <strong className="text-slate-100 text-[11px] truncate block">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Potential Issues / Warnings */}
            <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden mt-4">
              <button 
                onClick={() => toggleSection('issues')}
                className="w-full p-3 flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Detected Issues & Heuristics</h3>
                </div>
                <Badge variant="outline" className={`text-[10px] ${issues.length > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {issues.length}
                </Badge>
              </button>

              {expandedSections.issues && (
                <div className="p-3 space-y-2 text-xs">
                  {issues.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>No schema anomalies or unmapped identifiers detected on this view.</span>
                    </div>
                  ) : (
                    issues.map((issue, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-xl border space-y-1 ${
                          issue.severity === 'error' 
                            ? 'bg-rose-950/40 border-rose-900/60 text-rose-200' 
                            : 'bg-amber-950/40 border-amber-900/60 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            {issue.severity === 'error' ? <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                            {issue.title}
                          </span>
                          <span className="text-[10px] uppercase font-mono tracking-widest opacity-75">{issue.category}</span>
                        </div>
                        <p className="text-[11px] opacity-90">{issue.detail}</p>
                        {issue.docIds && issue.docIds.length > 0 && (
                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            Doc IDs: {issue.docIds.join(', ')}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>

            {/* Opt-in Deep Identity Audit */}
            <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden mt-4">
              <button 
                onClick={() => toggleSection('deepAudit')}
                className="w-full p-3 flex items-center justify-between bg-slate-900/80 hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">Deep Identity & Orphan Audit (Opt-in)</h3>
                </div>
                {expandedSections.deepAudit ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>

              {expandedSections.deepAudit && (
                <div className="p-3 space-y-3 text-xs">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Scans 9 primary collections against the registry to detect orphaned records from ex-employees or unmigrated legacy IDs.
                  </p>

                  <Button
                    onClick={runDeepAudit}
                    disabled={isDeepAuditing}
                    className="w-full h-9 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDeepAuditing ? 'animate-spin' : ''}`} />
                    {isDeepAuditing ? 'Auditing Database...' : 'Run Deep Audit Now'}
                  </Button>

                  {deepAuditResults && (
                    <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-slate-400 text-[10px]">Registered Users: {deepAuditResults.totalRegisteredUsers}</span>
                        <span className="text-purple-400 text-[10px]">{deepAuditResults.scanDurationMs}ms</span>
                      </div>
                      
                      {deepAuditResults.auditedCollections && Object.entries(deepAuditResults.auditedCollections).map(([name, stat]: [string, any]) => (
                        <div key={name} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                          <span className="text-slate-300">{name}</span>
                          <span className="text-slate-400">
                            {stat.error ? (
                              <span className="text-rose-400">Error</span>
                            ) : (
                              <span>
                                {stat.totalDocs} docs | <strong className={stat.orphanCount > 0 ? "text-amber-400" : "text-emerald-400"}>{stat.orphanCount} orphans</strong>
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </ScrollArea>
        </aside>
      )}
    </>
  );
}
