"use client";

import React, { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useIsMobileNav } from '@/hooks/use-mobile';
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

  // Hidden on phones/tablets and in Mobile Mode (it overlaps the sticky bottom bar).
  const isMobileNav = useIsMobileNav();
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    collections: true,
    issues: true,
    metrics: true,
    deepAudit: false
  });

  // HARD SECURITY GATE: If not super admin, render nothing and execute zero UI logic
  if (!isSuperAdmin || isMobileNav) {
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
        className="dev-diagnostics-fab fixed bottom-4 right-4 z-[9999] hidden nav:flex items-center gap-2 print:hidden"
      >
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl transition-all duration-300 border text-xs font-semibold backdrop-blur-md ${
            errorsCount > 0 
              ? 'bg-destructive/80 text-panel-foreground/80 border-destructive hover:bg-destructive/90 shadow-destructive/10' 
              : warningsCount > 0
              ? 'bg-warning/80 text-warning/40 border-warning hover:bg-warning/90 shadow-warning/10'
              : 'bg-panel/90 text-success-fill border-success-fill/40 hover:bg-panel/80 shadow-primary/5'
          }`}
          title="Super Admin Developer Diagnostics"
        >
          <Wrench className={`w-3.5 h-3.5 ${isDeepAuditing ? 'animate-spin text-gold' : ''}`} />
          <span className="font-mono">Dev Diagnostics</span>
          {errorsCount > 0 ? (
            <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-mono">
              {errorsCount}
            </span>
          ) : warningsCount > 0 ? (
            <span className="w-5 h-5 rounded-full bg-warning text-warning-foreground flex items-center justify-center text-xs font-mono">
              {warningsCount}
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-success-fill/80 animate-pulse" />
          )}
        </button>
      </aside>

      {/* Slide-over Diagnostics Drawer */}
      {isDrawerOpen && (
        <aside 
          aria-label="Developer Diagnostics Drawer"
          className="fixed inset-y-0 right-0 z-[10000] w-full sm:w-[540px] bg-panel border-l border-panel-foreground/15 text-panel-foreground/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 print:hidden font-sans"
        >
          {/* Header */}
          <header className="p-4 border-b border-panel-foreground/15 bg-panel/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-warning/10 border border-warning/20 text-gold">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Developer Diagnostics</h2>
                  <Badge variant="outline" className="text-xs bg-success-fill/10 text-success-fill border-success-fill/30">
                    Super Admin
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">Active Page: <strong className="text-accent">{currentView}</strong></p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyReport}
                className="h-8 px-2.5 text-xs text-panel-foreground/70 hover:text-white hover:bg-panel/80"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success-fill mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? 'Copied' : 'Export JSON'}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsDrawerOpen(false)}
                className="h-8 w-8 text-panel-foreground/60 hover:text-white hover:bg-panel/80"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Body Content */}
          <ScrollArea className="flex-1 p-4 space-y-4">
            {/* System Context Banner */}
            <div className="bg-panel/90 border border-panel-foreground/15 p-3 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-foreground/25 pb-2">
                <span className="text-xs font-semibold text-panel-foreground/60">Session Context</span>
                <span className="font-mono text-xs text-success-fill font-bold">{user?.email}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-panel-foreground/60">Sales Week:</span> <strong className="text-white">{currentWeek}</strong>
                </div>
                <div>
                  <span className="text-panel-foreground/60">Role:</span> <strong className="text-white">{profile?.role || 'None'}</strong>
                </div>
                <div>
                  <span className="text-panel-foreground/60">Active UID:</span> <strong className="text-accent truncate inline-block max-w-[150px] align-bottom" title={activeUserId || ''}>{activeUserId || 'None'}</strong>
                </div>
                <div>
                  <span className="text-panel-foreground/60">Simulating:</span> <strong className={simulationUid ? "text-gold" : "text-panel-foreground/60"}>{simulationUid ? 'YES' : 'NO'}</strong>
                </div>
              </div>
            </div>

            {/* In-Memory Collections Health */}
            <section className="bg-panel/60 border border-panel-foreground/10 rounded-2xl overflow-hidden mt-4">
              <button 
                onClick={() => toggleSection('collections')}
                className="w-full p-3 flex items-center justify-between bg-panel/80 hover:bg-panel/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold text-panel-foreground/90">Page Collections (In-Memory)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-panel-foreground/15 bg-panel/90 text-panel-foreground/70">
                    {activeReport?.collections?.length || 0} Registered
                  </Badge>
                  {expandedSections.collections ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedSections.collections && (
                <div className="p-3 divide-y divide-foreground/20 text-xs">
                  {(!activeReport?.collections || activeReport.collections.length === 0) ? (
                    <div className="py-4 text-center text-muted-foreground text-xs italic">
                      No explicit collection telemetry published for {currentView}.
                    </div>
                  ) : (
                    activeReport.collections.map((coll, idx) => (
                      <div key={coll.name + idx} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 font-mono text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-panel-foreground/90 font-bold">{coll.name}</span>
                            {coll.status === 'ready' && coll.count === 0 && (
                              <Badge className="bg-panel/90 text-panel-foreground/60 border-panel-foreground/15 text-xs py-0">EMPTY</Badge>
                            )}
                            {coll.status === 'error' && (
                              <Badge className="bg-destructive/90 text-destructive border-destructive text-xs py-0">ERROR</Badge>
                            )}
                            {coll.status === 'permission-denied' && (
                              <Badge className="bg-destructive/90 text-panel-foreground/80 border-destructive text-xs py-0">DENIED</Badge>
                            )}
                            {coll.status === 'loading' && (
                              <Badge className="bg-warning/90 text-gold border-warning text-xs py-0">LOADING</Badge>
                            )}
                          </div>
                          {coll.error && (
                            <p className="text-xs text-destructive font-sans">{coll.error}</p>
                          )}
                          {coll.sampleNames && coll.sampleNames.length > 0 && (
                            <p className="text-xs text-muted-foreground font-sans truncate max-w-[320px]">
                              Samples: {coll.sampleNames.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <span className={`font-bold ${coll.count === 0 ? 'text-muted-foreground' : 'text-success-fill'}`}>
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
              <section className="bg-panel/60 border border-panel-foreground/10 rounded-2xl overflow-hidden mt-4">
                <button 
                  onClick={() => toggleSection('metrics')}
                  className="w-full p-3 flex items-center justify-between bg-panel/80 hover:bg-panel/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gold" />
                    <h3 className="text-xs font-bold text-panel-foreground/90">View Metrics & State</h3>
                  </div>
                  {expandedSections.metrics ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>

                {expandedSections.metrics && (
                  <div className="p-3 grid grid-cols-2 gap-2 text-xs font-mono">
                    {Object.entries(activeReport.customMetrics).map(([key, val]) => (
                      <div key={key} className="bg-panel/60 p-2 rounded-xl border border-panel-foreground/10">
                        <span className="text-xs text-muted-foreground block truncate">{key}</span>
                        <strong className="text-panel-foreground/90 text-xs truncate block">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '—')}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Potential Issues / Warnings */}
            <section className="bg-panel/60 border border-panel-foreground/10 rounded-2xl overflow-hidden mt-4">
              <button 
                onClick={() => toggleSection('issues')}
                className="w-full p-3 flex items-center justify-between bg-panel/80 hover:bg-panel/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gold" />
                  <h3 className="text-xs font-bold text-panel-foreground/90">Detected Issues & Heuristics</h3>
                </div>
                <Badge variant="outline" className={`text-xs ${issues.length > 0 ? 'bg-warning/10 text-gold border-warning/30' : 'bg-panel/90 text-panel-foreground/60'}`}>
                  {issues.length}
                </Badge>
              </button>

              {expandedSections.issues && (
                <div className="p-3 space-y-2 text-xs">
                  {issues.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-success/30 border border-success/40 text-success-fill">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>No schema anomalies or unmapped identifiers detected on this view.</span>
                    </div>
                  ) : (
                    issues.map((issue, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-xl border space-y-1 ${
                          issue.severity === 'error' 
                            ? 'bg-destructive/35 border-destructive/60 text-panel-foreground/80' 
                            : 'bg-warning/35 border-warning/60 text-warning/40'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            {issue.severity === 'error' ? <AlertCircle className="w-3.5 h-3.5 text-destructive" /> : <AlertTriangle className="w-3.5 h-3.5 text-gold" />}
                            {issue.title}
                          </span>
                          <span className="text-xs uppercase font-mono tracking-wide opacity-75">{issue.category}</span>
                        </div>
                        <p className="text-xs opacity-90">{issue.detail}</p>
                        {issue.docIds && issue.docIds.length > 0 && (
                          <p className="text-xs font-mono text-muted-foreground truncate">
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
            <section className="bg-panel/60 border border-panel-foreground/10 rounded-2xl overflow-hidden mt-4">
              <button 
                onClick={() => toggleSection('deepAudit')}
                className="w-full p-3 flex items-center justify-between bg-panel/80 hover:bg-panel/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-chart-5" />
                  <h3 className="text-xs font-bold text-panel-foreground/90">Deep Identity & Orphan Audit (Opt-in)</h3>
                </div>
                {expandedSections.deepAudit ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>

              {expandedSections.deepAudit && (
                <div className="p-3 space-y-3 text-xs">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Scans 9 primary collections against the registry to detect orphaned records from ex-employees or unmigrated legacy IDs.
                  </p>

                  <Button
                    onClick={runDeepAudit}
                    disabled={isDeepAuditing}
                    className="w-full h-9 bg-chart-5 hover:bg-chart-5/90 text-white font-semibold text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDeepAuditing ? 'animate-spin' : ''}`} />
                    {isDeepAuditing ? 'Auditing Database...' : 'Run Deep Audit Now'}
                  </Button>

                  {deepAuditResults && (
                    <div className="mt-3 bg-panel p-3 rounded-xl border border-panel-foreground/15 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between border-b border-foreground/30 pb-1.5">
                        <span className="text-panel-foreground/60 text-xs">Registered Users: {deepAuditResults.totalRegisteredUsers}</span>
                        <span className="text-chart-5 text-xs">{deepAuditResults.scanDurationMs}ms</span>
                      </div>
                      
                      {deepAuditResults.auditedCollections && Object.entries(deepAuditResults.auditedCollections).map(([name, stat]: [string, any]) => (
                        <div key={name} className="flex items-center justify-between py-1 border-b border-foreground/30 last:border-0">
                          <span className="text-panel-foreground/50">{name}</span>
                          <span className="text-panel-foreground/60">
                            {stat.error ? (
                              <span className="text-destructive">Error</span>
                            ) : (
                              <span>
                                {stat.totalDocs} docs | <strong className={stat.orphanCount > 0 ? "text-gold" : "text-success-fill"}>{stat.orphanCount} orphans</strong>
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
