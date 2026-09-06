"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './auth-context';

export type DiagnosticCollectionStatus = 'ready' | 'empty' | 'loading' | 'error' | 'permission-denied' | 'not-loaded';

export interface DiagnosticCollectionReport {
  name: string;
  count?: number;
  status: DiagnosticCollectionStatus;
  error?: string;
  sampleIds?: string[];
  sampleNames?: string[];
  loadedAt?: Date;
}

export interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'identity' | 'schema' | 'performance' | 'security' | 'sync';
  title: string;
  detail: string;
  count?: number;
  docIds?: string[];
}

export interface PageDiagnosticData {
  pageName: string;
  reportedAt: Date;
  collections: DiagnosticCollectionReport[];
  customMetrics?: Record<string, any>;
  issues?: DiagnosticIssue[];
  rawSample?: any;
}

interface DiagnosticsContextType {
  activeReport: PageDiagnosticData | null;
  reportDiagnostic: (data: PageDiagnosticData) => void;
  clearDiagnostic: () => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  deepAuditResults: Record<string, any> | null;
  isDeepAuditing: boolean;
  runDeepAudit: () => Promise<void>;
}

const DiagnosticsContext = createContext<DiagnosticsContextType>({
  activeReport: null,
  reportDiagnostic: () => {},
  clearDiagnostic: () => {},
  isDrawerOpen: false,
  setIsDrawerOpen: () => {},
  deepAuditResults: null,
  isDeepAuditing: false,
  runDeepAudit: async () => {},
});

export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAuth();
  const [activeReport, setActiveReport] = useState<PageDiagnosticData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deepAuditResults, setDeepAuditResults] = useState<Record<string, any> | null>(null);
  const [isDeepAuditing, setIsDeepAuditing] = useState(false);

  const reportDiagnostic = useCallback((data: PageDiagnosticData) => {
    // If not super admin, drop immediately — execute nothing
    if (!isSuperAdmin) return;
    setActiveReport(data);
  }, [isSuperAdmin]);

  const clearDiagnostic = useCallback(() => {
    setActiveReport(null);
  }, []);

  const runDeepAudit = useCallback(async () => {
    if (!isSuperAdmin) return;
    setIsDeepAuditing(true);
    try {
      // Dynamic import to prevent loading audit bundles unless requested
      const { executeDeepIdentityAudit } = await import('@/lib/deep-identity-audit');
      const results = await executeDeepIdentityAudit();
      setDeepAuditResults(results);
    } catch (err: any) {
      console.error("Deep audit failed:", err);
      setDeepAuditResults({
        error: err?.message || String(err),
        timestamp: new Date()
      });
    } finally {
      setIsDeepAuditing(false);
    }
  }, [isSuperAdmin]);

  const value = useMemo(() => ({
    activeReport: isSuperAdmin ? activeReport : null,
    reportDiagnostic,
    clearDiagnostic,
    isDrawerOpen: isSuperAdmin ? isDrawerOpen : false,
    setIsDrawerOpen,
    deepAuditResults: isSuperAdmin ? deepAuditResults : null,
    isDeepAuditing,
    runDeepAudit,
  }), [isSuperAdmin, activeReport, reportDiagnostic, clearDiagnostic, isDrawerOpen, deepAuditResults, isDeepAuditing, runDeepAudit]);

  return (
    <DiagnosticsContext.Provider value={value}>
      {children}
    </DiagnosticsContext.Provider>
  );
}

export const useDiagnostics = () => useContext(DiagnosticsContext);
