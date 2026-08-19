'use client';

import React, { createContext, useContext, useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type DashboardView =
  | 'DASHBOARD' | 'CALL_PLANNING' | 'ALL_CALL_PLANNING' | 'WHITE_SPACE' 
  | 'WHITESPACE_HISTORY' | 'STRATEGIC_ARCHIVE' | 'BRIEFS' | 'TEAM_GOALS' | 'STRATEGY' 
  | 'TEAM' | 'GM_REVIEW' | 'UPLOAD' | 'ARCHIVE' | 'SETTINGS' | 'REPORTS' | 'DATA_EXPLORER' | 'FACT_FINDING' | 'OPS_REPORT' | 'OPS_REVIEW' | 'TWIW' | 'DEMO_DASH' | 'BROADCAST' | 'FRIDAY_FW' | 'PLAYBOOK' | 'ACTUAL_SPEND' | 'STRATEGIC_REPOSITORY' | 'SUCCESS_PLANS' | 'MANAGE_TIME';

interface NavigationContextType {
  currentView: DashboardView;
  viewParams: any;
  navigateTo: (view: DashboardView, params?: any) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

function NavigationContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentView, setCurrentView] = useState<DashboardView>('DASHBOARD');
  const [viewParams, setViewParams] = useState<any>(null);

  // Sync view from URL search params on mount or when searchParams change
  useEffect(() => {
    const view = searchParams.get('view') as DashboardView | null;
    if (view) {
      setCurrentView(view);
    } else {
      setCurrentView('DASHBOARD');
    }
  }, [searchParams]);

  const navigateTo = (view: DashboardView, params?: any) => {
    setCurrentView(view);
    setViewParams(params || null);
    
    // Sync to URL query param
    if (view === 'DASHBOARD') {
      router.push('/dashboard');
    } else {
      router.push(`/dashboard?view=${view}`);
    }
  };

  // Intercept legacy switch-view custom events to ensure backward compatibility
  useEffect(() => {
    const handleSwitchView = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.view) {
        navigateTo(customEvent.detail.view, customEvent.detail.params);
      }
    };
    window.addEventListener('switch-view', handleSwitchView);
    return () => window.removeEventListener('switch-view', handleSwitchView);
  }, []);

  return (
    <NavigationContext.Provider value={{ currentView, viewParams, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <NavigationContent>{children}</NavigationContent>
    </Suspense>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
