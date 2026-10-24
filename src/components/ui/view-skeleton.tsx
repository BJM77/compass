import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/** Full-view loading placeholder: header, four KPI cards and a list panel. */
export function ViewSkeleton() {
  return (
    <div className="w-full space-y-8 p-4 md:p-8" role="status" aria-busy="true" aria-label="Loading">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg md:w-96" />
        </div>
        <div className="hidden gap-2 md:flex">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 space-y-4 rounded-xl border border-border/60 bg-card p-4 shadow-card">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>

      <div className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-card">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
