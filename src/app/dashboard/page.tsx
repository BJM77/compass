"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import { BDMDashboard } from '@/components/dashboard/bdm-dashboard';
import { LeaderDashboard } from '@/components/dashboard/leader-dashboard';
import { UserManagement } from '@/components/dashboard/user-management';
import { GMWeeklyReview } from '@/components/dashboard/gm-weekly-review';
import { StrategyManagement } from '@/components/dashboard/strategy-management';
import { AIBriefsHub } from '@/components/dashboard/ai-briefs-hub';
import { FridayReviewHub } from '@/components/dashboard/friday-review-hub';
import { CallPlanning } from '@/components/dashboard/call-planning';
import { AdminCallPlanning } from '@/components/dashboard/admin-call-planning';
import { SettingsHub } from '@/components/dashboard/settings-hub';
import { WhitespaceAnalysis } from '@/components/dashboard/whitespace-analysis';
import { WhitespaceHistory } from '@/components/dashboard/whitespace-history';
import { SmartGoalsAudit } from '@/components/dashboard/smart-goals-audit';
import { WeeklyArchive } from '@/components/dashboard/weekly-archive';
import { BIReportsViewer } from '@/components/dashboard/bi-reports-viewer';
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader,
  SidebarTrigger, SidebarInset, SidebarFooter, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Settings, LogOut, Compass, ShieldCheck,
  UserCircle, XCircle, PhoneCall, Archive, Shield, MoreHorizontal, X, LayoutGrid, History,
  Loader2, Star, Sparkles, Map, Database, BarChart4
} from 'lucide-react';
import { CRMImporter } from '@/components/dashboard/crm-importer';
import { useAuth as useFirebaseAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';

type DashboardView =
  | 'DASHBOARD' | 'CALL_PLANNING' | 'ALL_CALL_PLANNING' | 'WHITE_SPACE' 
  | 'WHITESPACE_HISTORY' | 'BRIEFS' | 'TEAM_GOALS' | 'STRATEGY' 
  | 'TEAM' | 'GM_REVIEW' | 'UPLOAD' | 'ARCHIVE' | 'SETTINGS' | 'REPORTS';

const NAV_ITEMS = [
  { view: 'DASHBOARD' as DashboardView,         label: 'Dashboard',         icon: LayoutDashboard,  adminOnly: false },
  { view: 'ARCHIVE' as DashboardView,           label: 'Weekly Snapshot',   icon: Archive,          adminOnly: false },
  { view: 'TEAM_GOALS' as DashboardView,        label: 'Team Goals',        icon: Star,             adminOnly: true },
  { view: 'CALL_PLANNING' as DashboardView,     label: 'Call Plans',        icon: PhoneCall,        adminOnly: false },
  { view: 'WHITE_SPACE' as DashboardView,       label: 'White Space',       icon: LayoutGrid,       adminOnly: false },
  { view: 'BRIEFS' as DashboardView,            label: 'Briefs',            icon: Sparkles,         adminOnly: true },
  { view: 'STRATEGY' as DashboardView,          label: 'Strategy',          icon: Map,              adminOnly: true },
  { view: 'TEAM' as DashboardView,              label: 'Team',              icon: Users,            adminOnly: true },
  { view: 'GM_REVIEW' as DashboardView,         label: 'GM Command Hub',    icon: Shield,           adminOnly: true },
  { view: 'ALL_CALL_PLANNING' as DashboardView, label: 'All Call Plans',    icon: Archive,          adminOnly: true },
  { view: 'WHITESPACE_HISTORY' as DashboardView, label: 'Saved Plans',      icon: History,          adminOnly: false },
  { view: 'REPORTS' as DashboardView,           label: 'BI Dashboards',     icon: BarChart4,        adminOnly: false },
  { view: 'UPLOAD' as DashboardView,            label: 'Upload CRM',        icon: Database,         adminOnly: true },
  { view: 'SETTINGS' as DashboardView,          label: 'Settings',          icon: Settings,         adminOnly: false },
];

export default function DashboardPage() {
  const { profile, isLeader, user, loading: isAuthLoading } = useAuth();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [currentView, setCurrentView] = useState<DashboardView>('DASHBOARD');
  const [simulationUid, setSimulationUid] = useState<string | null>(null);

  const usersQuery = useMemoFirebase(() => { if (!db || !isLeader) return null; return collection(db, 'users'); }, [db, isLeader]);
  const { data: allUsers } = useCollection(usersQuery);

  const activeUserId = simulationUid || user?.uid || null;
  const simulatedUserProfile = allUsers?.find(u => u.id === simulationUid);

  const handleSignOut = async () => { 
    if (auth) { 
      await signOut(auth); 
      document.cookie = "auth_status=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      router.push('/login'); 
    } 
  };
  const handleSimulate = (uid: string) => { setSimulationUid(uid); setCurrentView('DASHBOARD'); window.scrollTo({ top: 0, behavior: 'smooth' }); };



  const renderContent = () => {
    // DEFENSIVE: Block rendering if activeUserId is not yet resolved
    if (!activeUserId && !isAuthLoading) return <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin" /></div>;

    if (currentView === 'TEAM' && isLeader) return <div className="container mx-auto p-4 md:p-8 space-y-8"><UserManagement onSimulate={handleSimulate} /></div>;
    if (currentView === 'CALL_PLANNING') return <div className="container mx-auto p-4 md:p-8"><CallPlanning userId={activeUserId || ''} /></div>;
    if (currentView === 'ALL_CALL_PLANNING' && isLeader) return <div className="container mx-auto p-4 md:p-8 space-y-8"><AdminCallPlanning /></div>;
    if (currentView === 'BRIEFS' && isLeader) return <div className="container mx-auto p-4 md:p-8 space-y-8"><AIBriefsHub /></div>;
    if (currentView === 'TEAM_GOALS' && isLeader) return <div className="container mx-auto p-4 md:p-8 space-y-8"><SmartGoalsAudit /></div>;
    if (currentView === 'STRATEGY' && isLeader) return <div className="container mx-auto p-4 md:p-8 space-y-8"><StrategyManagement /></div>;
    if (currentView === 'GM_REVIEW' && isLeader) return <div className="container mx-auto p-4 md:p-8"><GMWeeklyReview /></div>;
    if (currentView === 'WHITE_SPACE') return <div className="container mx-auto p-4 md:p-8"><WhitespaceAnalysis userId={activeUserId || ''} /></div>;
    if (currentView === 'WHITESPACE_HISTORY') return <div className="container mx-auto p-4 md:p-8"><WhitespaceHistory userId={activeUserId || ''} /></div>;
    if (currentView === 'REPORTS') return <div className="container mx-auto p-4 md:p-8 max-w-[1600px]"><BIReportsViewer /></div>;
    if (currentView === 'UPLOAD' && isLeader) return <div className="container mx-auto p-4 md:p-8 max-w-5xl"><CRMImporter /></div>;
    if (currentView === 'ARCHIVE') return <div className="container mx-auto p-4 md:p-8"><WeeklyArchive /></div>;
    if (currentView === 'SETTINGS') return <div className="container mx-auto p-4 md:p-8"><SettingsHub /></div>;
    
    if (isLeader && !simulationUid) return <LeaderDashboard onSimulate={handleSimulate} />;
    return <BDMDashboard simulatedUser={simulationUid ? { uid: simulationUid, profile: simulatedUserProfile! } : undefined} />;
  };

  return (
    <AuthGuard>
      {isMobile ? (
        <div className="min-h-screen bg-[#F7F6F8]">
          <header className="sticky top-0 z-30 flex items-center justify-between px-5 h-16 bg-slate-900 text-white shadow-xl">
            <div className="flex items-center gap-2"><Compass className="w-6 h-6 text-accent" /><span className="font-black uppercase tracking-tight">BDM Compass</span></div>
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-black">{profile?.name?.charAt(0)}</div>
          </header>
          <main className="pb-24">{renderContent()}</main>
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-white/10 px-2 py-3 flex justify-around shadow-2xl">
            {NAV_ITEMS.filter(i => !i.adminOnly).slice(0, 4).map(i => (
              <button key={i.view} onClick={() => setCurrentView(i.view)} className={`flex flex-col items-center gap-1 ${currentView === i.view ? 'text-accent' : 'text-white/40'}`}>
                <i.icon className="w-5 h-5" />
                <span className="text-[8px] font-black uppercase">{i.label}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <SidebarProvider>
          <Sidebar collapsible="icon">
            <SidebarHeader className="p-4 flex items-center gap-2"><Compass className="w-6 h-6 text-primary" /><span className="font-bold text-lg text-primary group-data-[collapsible=icon]:hidden">BDM Compass</span></SidebarHeader>
            <SidebarContent>
              <SidebarMenu className="px-2 space-y-1">
                {simulationUid && isLeader && (
                  <SidebarMenuItem>
                    <button
                      onClick={() => {
                        setSimulationUid(null);
                        setCurrentView('TEAM'); // Return to Governance/Users page
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all font-black text-xs uppercase tracking-wider border border-amber-500/20 mb-2 group"
                    >
                      <XCircle className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                      <span>Return to Governance</span>
                    </button>
                  </SidebarMenuItem>
                )}
                {NAV_ITEMS.filter(item => item.adminOnly ? isLeader : true).map(nav => (
                  <SidebarMenuItem key={nav.view}>
                    <SidebarMenuButton isActive={currentView === nav.view} onClick={() => setCurrentView(nav.view)} tooltip={nav.label}>
                      <nav.icon className="w-4 h-4" />
                      <span>{nav.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4 border-t"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={handleSignOut} className="text-red-500"><LogOut className="w-4 h-4" /><span>Sign Out</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
          </Sidebar>
          <SidebarInset className="bg-[#F7F6F8]">
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-white px-6 shadow-sm">
              <SidebarTrigger />
              {simulationUid && isLeader && (
                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span>Simulating: <strong className="font-black">{simulatedUserProfile?.name || simulationUid}</strong></span>
                  <button
                    onClick={() => {
                      setSimulationUid(null);
                      setCurrentView('TEAM');
                    }}
                    className="ml-2 underline font-black hover:text-amber-950 uppercase text-[10px] tracking-wider"
                  >
                    Exit &amp; Return
                  </button>
                </div>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-bold leading-none">{profile?.name || user?.email?.split('@')[0] || 'User'}</p>
                  <p className="text-[9px] text-muted-foreground uppercase mt-0.5 tracking-widest">{profile?.role || 'Loading...'}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xs shadow-md border-2 border-white">
                  {profile?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || '?'}
                </div>
              </div>
            </header>
            <main className="min-h-screen">{renderContent()}</main>
          </SidebarInset>
        </SidebarProvider>
      )}
    </AuthGuard>
  );
}