"use client";

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { Compass } from 'lucide-react';
import { useAuth, UserProfile } from '@/contexts/auth-context';
import { ViewSkeleton } from '@/components/ui/view-skeleton';
import { Badge } from '@/components/ui/badge';
import { useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { useDashboardLayout } from '@/hooks/use-dashboard-layout';
import { useReportDiagnostic } from '@/hooks/use-diagnostics';
import { getCurrentWeek } from '@/lib/utils';
import { DashboardWidgetGrid } from './widgets/dashboard-widget-grid';

interface BDMDashboardProps {
  simulatedUser?: {
    uid: string;
    profile: UserProfile;
  };
}

/**
 * BDM / Account Manager dashboard. What shows, in what order and at what width is decided by the
 * layout an admin/leader saved in Dashboard Design (appSettings/global.dashboardLayout). There are
 * no hard-coded overrides: the saved layout is what renders.
 */
export function BDMDashboard({ simulatedUser }: BDMDashboardProps) {
  const { profile: authProfile, user: authUser } = useAuth();
  const db = useFirestore();
  const currentWeek = getCurrentWeek();

  const userId = simulatedUser?.uid || authUser?.uid || null;
  const profile = simulatedUser?.profile || authProfile;

  const statsDocRef = useMemoFirebase(() => (db && userId ? doc(db, 'bdmStats', userId) : null), [db, userId]);
  const { data: stats, isLoading: isStatsLoading } = useDoc<any>(statsDocRef);

  const { layout, isLoading: isLayoutLoading } = useDashboardLayout('everyone');

  // Report telemetry to Developer Diagnostics bus
  useReportDiagnostic(() => ({
    pageName: 'BDM Rep Dashboard (DASHBOARD)',
    reportedAt: new Date(),
    collections: [
      { name: `bdmStats/${userId}`, count: stats ? 1 : 0, status: isStatsLoading ? 'loading' : (stats ? 'ready' : 'empty') },
      { name: 'appSettings/global', count: layout.length, status: isLayoutLoading ? 'loading' : 'ready' },
    ],
    customMetrics: {
      'Active User ID': userId || 'None',
      'User Name': profile?.name || 'Unknown',
      'User Role': profile?.role || 'BDM',
      'Sales Week': currentWeek,
      'Visible Widgets': layout.filter(w => w.visible).map(w => w.id).join(', '),
      'Target Assigned ($)': stats?.target ? `$${Number(stats.target).toLocaleString()}` : 'No Target Set',
    },
    issues: [
      ...(!stats?.target ? [{
        severity: 'warning' as const,
        category: 'schema' as const,
        title: 'Missing BDM Revenue Target',
        detail: `User ${profile?.name || userId} has no revenue target set in bdmStats.`
      }] : []),
    ]
  }), [userId, profile, stats, isStatsLoading, layout, isLayoutLoading, currentWeek]);

  const context = useMemo(() => ({
    userId: userId || '',
    userName: profile?.name || 'BDM',
    role: profile?.role || 'BDM',
    territory: profile?.territory,
    audience: 'everyone' as const,
  }), [userId, profile]);

  if (!profile) return <ViewSkeleton />;
  const isAM = profile.role === 'ACCOUNT_MANAGER';
  if (isStatsLoading || isLayoutLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Compass className="animate-spin" /></div>;

  return (
    <div className="w-full p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-black font-headline text-primary tracking-tighter uppercase">{isAM ? 'Portfolio Intelligence' : 'Professional Brief'}</h1>
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-accent-foreground border-none font-black text-[9px] uppercase tracking-widest">{profile.territory?.replace('_', ' ')}</Badge>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-tight">{profile.name}</p>
          </div>
        </div>
      </header>

      <DashboardWidgetGrid layout={layout} context={context} anchors collapsible />
    </div>
  );
}
