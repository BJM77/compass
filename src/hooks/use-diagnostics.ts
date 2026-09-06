"use client";

import { useEffect, useRef } from 'react';
import { useDiagnostics, PageDiagnosticData } from '@/contexts/diagnostics-context';
import { useAuth } from '@/contexts/auth-context';

/**
 * Hook for pages to report their in-memory data to the Developer Diagnostics bus.
 * Zero queries executed — reports strictly what is already in component memory.
 */
export function useReportDiagnostic(reportBuilder: () => PageDiagnosticData | null, deps: any[] = []) {
  const { isSuperAdmin } = useAuth();
  const { reportDiagnostic } = useDiagnostics();
  const lastSerialized = useRef<string>('');

  useEffect(() => {
    // If not super admin, execute nothing
    if (!isSuperAdmin) return;

    try {
      const data = reportBuilder();
      if (!data) return;

      // Deduplicate reports if identical
      const serialized = JSON.stringify({
        pageName: data.pageName,
        collections: data.collections?.map(c => ({ name: c.name, count: c.count, status: c.status, error: c.error })),
        customMetrics: data.customMetrics,
        issuesCount: data.issues?.length
      });

      if (serialized !== lastSerialized.current) {
        lastSerialized.current = serialized;
        reportDiagnostic(data);
      }
    } catch (e) {
      console.warn("Developer Diagnostics: Failed to record telemetry", e);
    }
  }, [isSuperAdmin, reportDiagnostic, ...deps]);
}
