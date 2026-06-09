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
import { DataExplorer } from '@/components/dashboard/data-explorer';
import { FactFindingHub } from '@/components/dashboard/fact-finding-hub';
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader,
  SidebarTrigger, SidebarInset, SidebarFooter, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Settings, LogOut, Compass, ShieldCheck,
  UserCircle, XCircle, PhoneCall, Archive, Shield, MoreHorizontal, X, LayoutGrid, History,
  Loader2, Star, Sparkles, Map, Database, BarChart4, FileSearch
} from 'lucide-react';
import { CRMImporter } from '@/components/dashboard/crm-importer';
import { useAuth as useFirebaseAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { PipelineProvider, usePipelineData } from '@/contexts/pipeline-context';

type DashboardView =
  | 'DASHBOARD' | 'CALL_PLANNING' | 'ALL_CALL_PLANNING' | 'WHITE_SPACE' 
  | 'WHITESPACE_HISTORY' | 'BRIEFS' | 'TEAM_GOALS' | 'STRATEGY' 
  | 'TEAM' | 'GM_REVIEW' | 'UPLOAD' | 'ARCHIVE' | 'SETTINGS' | 'REPORTS' | 'DATA_EXPLORER' | 'FACT_FINDING';

const NAV_ITEMS = [
  { view: 'DASHBOARD' as DashboardView,         label: 'Dashboard',         icon: LayoutDashboard,  adminOnly: false, group: 'main' },
  { view: 'ARCHIVE' as DashboardView,           label: 'Weekly Snapshot',   icon: Archive,          adminOnly: false, group: 'main' },
  { view: 'FACT_FINDING' as DashboardView,      label: 'Fact Finding',      icon: FileSearch,       adminOnly: false, group: 'main' },
  { view: 'CALL_PLANNING' as DashboardView,     label: 'Call Plans',        icon: PhoneCall,        adminOnly: false, group: 'main' },
  { view: 'WHITE_SPACE' as DashboardView,       label: 'White Space',       icon: LayoutGrid,       adminOnly: false, group: 'main' },
  { view: 'DATA_EXPLORER' as DashboardView,     label: 'Data Explorer',     icon: Database,         adminOnly: true,  group: 'main' },
  { view: 'SETTINGS' as DashboardView,          label: 'Settings',          icon: Settings,         adminOnly: false, group: 'main' },
  
  // Admin Items
  { view: 'TEAM_GOALS' as DashboardView,        label: 'Team Goals',        icon: Star,             adminOnly: true,  group: 'admin' },
  { view: 'BRIEFS' as DashboardView,            label: 'Briefs',            icon: Sparkles,         adminOnly: true,  group: 'admin' },
  { view: 'STRATEGY' as DashboardView,          label: 'Strategy',          icon: Map,              adminOnly: true,  group: 'admin' },
  { view: 'TEAM' as DashboardView,              label: 'Team',              icon: Users,            adminOnly: true,  group: 'admin' },
  { view: 'GM_REVIEW' as DashboardView,         label: 'GM Command Hub',    icon: Shield,           adminOnly: true,  group: 'admin' },
  { view: 'ALL_CALL_PLANNING' as DashboardView, label: 'All Call Plans',    icon: Archive,          adminOnly: true,  group: 'admin' },
  { view: 'WHITESPACE_HISTORY' as DashboardView, label: 'Saved Plans',      icon: History,          adminOnly: false, group: 'admin' },
  { view: 'REPORTS' as DashboardView,           label: 'BI Dashboards',     icon: BarChart4,        adminOnly: false, group: 'admin' },
  { view: 'UPLOAD' as DashboardView,            label: 'Upload CRM',        icon: Database,         adminOnly: true,  group: 'admin' },
];

function DashboardContent() {
  const { profile, isLeader, user, loading: isAuthLoading } = useAuth();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [currentView, setCurrentView] = useState<DashboardView>('DASHBOARD');
  
  const { activeUserId, simulationUid, setSimulationUid } = usePipelineData();

  const usersQuery = useMemoFirebase(() => { if (!db || !isLeader) return null; return collection(db, 'users'); }, [db, isLeader]);
  const { data: allUsers } = useCollection(usersQuery);
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

    if (currentView === 'TEAM' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><UserManagement onSimulate={handleSimulate} /></div>;
    if (currentView === 'CALL_PLANNING') return <div className="w-full p-4 md:p-8"><CallPlanning userId={activeUserId || ''} /></div>;
    if (currentView === 'ALL_CALL_PLANNING' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><AdminCallPlanning /></div>;
    if (currentView === 'BRIEFS' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><AIBriefsHub /></div>;
    if (currentView === 'TEAM_GOALS' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><SmartGoalsAudit /></div>;
    if (currentView === 'STRATEGY' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><StrategyManagement /></div>;
    if (currentView === 'GM_REVIEW' && isLeader) return <div className="w-full p-4 md:p-8"><GMWeeklyReview /></div>;
    if (currentView === 'WHITE_SPACE') return <div className="w-full p-4 md:p-8"><WhitespaceAnalysis userId={activeUserId || ''} /></div>;
    if (currentView === 'WHITESPACE_HISTORY') return <div className="w-full p-4 md:p-8"><WhitespaceHistory userId={activeUserId || ''} /></div>;
    if (currentView === 'REPORTS') return <div className="w-full p-4 md:p-8"><BIReportsViewer /></div>;
    if (currentView === 'UPLOAD' && isLeader) return <div className="w-full p-4 md:p-8"><CRMImporter /></div>;
    if (currentView === 'ARCHIVE') return <div className="w-full p-4 md:p-8"><WeeklyArchive /></div>;
    if (currentView === 'FACT_FINDING') return <div className="w-full p-4 md:p-8"><FactFindingHub /></div>;
    if (currentView === 'DATA_EXPLORER' && isLeader) return <div className="w-full p-4 md:p-8"><DataExplorer /></div>;
    if (currentView === 'SETTINGS') return <div className="w-full p-4 md:p-8"><SettingsHub /></div>;
    
    if (isLeader && !simulationUid) return <LeaderDashboard onSimulate={handleSimulate} />;
    return <BDMDashboard simulatedUser={simulationUid ? { uid: simulationUid, profile: simulatedUserProfile! } : undefined} />;
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="p-4 flex items-center gap-2"><Compass className="w-6 h-6 text-primary" /><span className="font-bold text-lg text-primary group-data-[collapsible=icon]:hidden">BDM Compass</span></SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
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
                  {NAV_ITEMS.filter(item => item.group === 'main' && (item.adminOnly ? isLeader : true)).map(nav => (
                    <SidebarMenuItem key={nav.view}>
                      <SidebarMenuButton isActive={currentView === nav.view} onClick={() => setCurrentView(nav.view)} tooltip={nav.label}>
                        <nav.icon className="w-4 h-4" />
                        <span>{nav.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {NAV_ITEMS.some(item => item.group === 'admin' && (item.adminOnly ? isLeader : true)) && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest mt-4 mb-1">
                  Admin
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="px-2 space-y-1">
                    {NAV_ITEMS.filter(item => item.group === 'admin' && (item.adminOnly ? isLeader : true)).map(nav => (
                      <SidebarMenuItem key={nav.view}>
                        <SidebarMenuButton isActive={currentView === nav.view} onClick={() => setCurrentView(nav.view)} tooltip={nav.label}>
                          <nav.icon className="w-4 h-4" />
                          <span>{nav.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="p-4 border-t"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={handleSignOut} className="text-red-500"><LogOut className="w-4 h-4" /><span>Sign Out</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-[#F7F6F8]">
          <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-slate-200/50 shadow-sm shrink-0 gap-2">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 md:hidden pl-1">
              <Compass className="w-5 h-5 text-indigo-600" />
              <span className="font-black uppercase tracking-tight text-xs text-slate-900">BDM Compass</span>
            </div>
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
                  Exit
                </button>
              </div>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">{profile?.name || user?.email}</p>
                <p className="text-[10px] font-bold text-slate-400 capitalize">{profile?.role?.replace('_', ' ').toLowerCase() || 'No Role'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-xs uppercase shrink-0">
                {(profile?.name || user?.email || '?').charAt(0)}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-4rem)] w-full max-w-[1600px] mx-auto">
            {renderContent()}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}

export default function DashboardPage() {
  return (
    <PipelineProvider>
      <DashboardContent />
    </PipelineProvider>
  );
}