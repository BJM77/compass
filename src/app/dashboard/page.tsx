"use client";

import { useState, useEffect } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { ViewSkeleton } from '@/components/ui/view-skeleton';

const BDMDashboard = dynamic(() => import('@/components/dashboard/bdm-dashboard').then(m => m.BDMDashboard), { loading: () => <ViewSkeleton /> });
const LeaderDashboard = dynamic(() => import('@/components/dashboard/leader-dashboard').then(m => m.LeaderDashboard), { loading: () => <ViewSkeleton /> });
const UserManagement = dynamic(() => import('@/components/dashboard/user-management').then(m => m.UserManagement), { loading: () => <ViewSkeleton /> });
const GMWeeklyReview = dynamic(() => import('@/components/dashboard/gm-weekly-review').then(m => m.GMWeeklyReview), { loading: () => <ViewSkeleton /> });
const StrategyManagement = dynamic(() => import('@/components/dashboard/strategy-management').then(m => m.StrategyManagement), { loading: () => <ViewSkeleton /> });
const AIBriefsHub = dynamic(() => import('@/components/dashboard/ai-briefs-hub').then(m => m.AIBriefsHub), { loading: () => <ViewSkeleton /> });
const FridayReviewHub = dynamic(() => import('@/components/dashboard/friday-review-hub').then(m => m.FridayReviewHub), { loading: () => <ViewSkeleton /> });
const CallPlanning = dynamic(() => import('@/components/dashboard/call-planning').then(m => m.CallPlanning), { loading: () => <ViewSkeleton /> });
const AdminCallPlanning = dynamic(() => import('@/components/dashboard/admin-call-planning').then(m => m.AdminCallPlanning), { loading: () => <ViewSkeleton /> });
const SettingsHub = dynamic(() => import('@/components/dashboard/settings-hub').then(m => m.SettingsHub), { loading: () => <ViewSkeleton /> });
const WhitespaceAnalysis = dynamic(() => import('@/components/dashboard/whitespace-analysis').then(m => m.WhitespaceAnalysis), { loading: () => <ViewSkeleton /> });
const WhitespaceHistory = dynamic(() => import('@/components/dashboard/whitespace-history').then(m => m.WhitespaceHistory), { loading: () => <ViewSkeleton /> });
const StrategicArchive = dynamic(() => import('@/components/dashboard/strategic-archive').then(m => m.StrategicArchive), { loading: () => <ViewSkeleton /> });
const SmartGoalsAudit = dynamic(() => import('@/components/dashboard/smart-goals-audit').then(m => m.SmartGoalsAudit), { loading: () => <ViewSkeleton /> });
const WeeklyArchive = dynamic(() => import('@/components/dashboard/weekly-archive').then(m => m.WeeklyArchive), { loading: () => <ViewSkeleton /> });
const BIReportsViewer = dynamic(() => import('@/components/dashboard/bi-reports-viewer').then(m => m.BIReportsViewer), { loading: () => <ViewSkeleton /> });
const DataExplorer = dynamic(() => import('@/components/dashboard/data-explorer').then(m => m.DataExplorer), { loading: () => <ViewSkeleton /> });
const FactFindingHub = dynamic(() => import('@/components/dashboard/fact-finding-hub').then(m => m.FactFindingHub), { loading: () => <ViewSkeleton /> });
const OpsReportForm = dynamic(() => import('@/components/dashboard/ops-report-form').then(m => m.OpsReportForm), { loading: () => <ViewSkeleton /> });
const OpsReviewLedger = dynamic(() => import('@/components/dashboard/ops-report-review').then(m => m.OpsReportReview), { loading: () => <ViewSkeleton /> }); // renamed internally for matching
const TWIWView = dynamic(() => import('@/components/dashboard/twiw-view').then(m => m.TWIWView), { loading: () => <ViewSkeleton /> });
const DemoDashView = dynamic(() => import('@/components/dashboard/demo-dash-view').then(m => m.DemoDashView), { loading: () => <ViewSkeleton /> });
const SystemBroadcast = dynamic(() => import('@/components/dashboard/system-broadcast').then(m => m.SystemBroadcast), { loading: () => <ViewSkeleton /> });
const FridayPerformanceReview = dynamic(() => import('@/components/dashboard/friday-performance-review').then(m => m.FridayPerformanceReview), { loading: () => <ViewSkeleton /> });
const PlaybookView = dynamic(() => import('@/components/dashboard/playbook-view').then(m => m.PlaybookView), { loading: () => <ViewSkeleton /> });
const ActualSpendView = dynamic(() => import('@/components/dashboard/actual-spend-view').then(m => m.ActualSpendView), { loading: () => <ViewSkeleton /> });
const StrategicRepository = dynamic(() => import('@/components/dashboard/strategic-repository').then(m => m.StrategicRepository), { loading: () => <ViewSkeleton /> });
const SuccessPlansView = dynamic(() => import('@/components/dashboard/success-plans').then(m => m.SuccessPlansView), { loading: () => <ViewSkeleton /> });
const ManageTimeView = dynamic(() => import('@/components/dashboard/manage-time-view').then(m => m.ManageTimeView), { loading: () => <ViewSkeleton /> });
const AMBDManagement = dynamic(() => import('@/components/dashboard/ambd-management').then(m => m.AMBDManagement), { loading: () => <ViewSkeleton /> });
const FFAdminHub = dynamic(() => import('@/components/dashboard/ff-admin-view').then(m => m.FFAdminHub), { loading: () => <ViewSkeleton /> });
const CanvassingHub = dynamic(() => import('@/components/dashboard/canvassing-hub').then(m => m.CanvassingHub), { loading: () => <ViewSkeleton /> });
const DataHealthDashboard = dynamic(() => import('@/components/dashboard/data-health-dashboard').then(m => m.DataHealthDashboard), { loading: () => <ViewSkeleton /> });
const OverviewHub = dynamic(() => import('@/components/dashboard/overview-hub').then(m => m.OverviewHub), { loading: () => <ViewSkeleton /> });
const AlignCustomer = dynamic(() => import('@/components/dashboard/align-customer').then(m => m.AlignCustomer), { loading: () => <ViewSkeleton /> });
import { CreateNoteDialog } from '@/components/dashboard/create-note-dialog';
import { DeveloperDiagnostics } from '@/components/dev/developer-diagnostics';
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader,
  SidebarTrigger, SidebarInset, SidebarFooter, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent
} from '@/components/ui/sidebar';
import {
  LayoutDashboard, Users, Settings, LogOut, Compass, ShieldCheck,
  UserCircle, XCircle, PhoneCall, Archive, Shield, MoreHorizontal, X, LayoutGrid, History, Link as LinkIcon,
  Loader2, Star, Sparkles, Map, Database, BarChart4, FileSearch, AlertCircle, ClipboardList, Coins, CalendarCheck, Beaker, Upload, Megaphone, Send, BookOpen, Clock, Smartphone, Navigation, ChevronDown, ChevronRight
} from 'lucide-react';
const CRMImporter = dynamic(() => import('@/components/dashboard/crm-importer').then(m => m.CRMImporter), { loading: () => <ViewSkeleton /> });
import { useAuth as useFirebaseAuth, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/lib/mobile-utils';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { PipelineProvider, usePipelineData } from '@/contexts/pipeline-context';
import { NavigationProvider, useNavigation } from '@/contexts/navigation-context';
import { getNavigationForUser, DashboardView } from '@/lib/navigation';
import { MobileDashboard } from '@/components/dashboard/mobile-dashboard';

function DashboardContent() {
  const { profile, isLeader, user, loading: isAuthLoading } = useAuth();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { currentView, viewParams, navigateTo } = useNavigation();
  
  const { activeUserId, simulationUid, setSimulationUid } = usePipelineData();


  const usersQuery = useMemoFirebase(() => { if (!db || !isLeader) return null; return collection(db, 'users'); }, [db, isLeader]);
  const { data: allUsers } = useCollection(usersQuery);
  const simulatedUserProfile = allUsers?.find(u => u.id === simulationUid);
  
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    field: true,
    strategy: true,
    reporting: true,
    admin_leadership: true,
    admin_system: true,
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };
  
  const settingsRef = useMemoFirebase(() => (db && user) ? doc(db, 'appSettings', 'global') : null, [db, user]);
  const { data: settingsData } = useDoc(settingsRef);

  const handleSignOut = async () => { 
    if (auth) { 
      await signOut(auth); 
      document.cookie = "auth_status=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      router.push('/login'); 
    } 
  };
  const handleSimulate = (uid: string) => { setSimulationUid(uid); navigateTo('DASHBOARD'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    // Temporary escalation removed in favor of hardcoded check in auth-context

  const activeView = profile?.role === 'GUEST' ? 'TWIW' : currentView;

  const renderContent = () => {
    // DEFENSIVE: Block rendering if activeUserId is not yet resolved
    if (!activeUserId && !isAuthLoading) return <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin" /></div>;

    if (activeView === 'TEAM' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><UserManagement onSimulate={handleSimulate} /></div>;
    if (activeView === 'CALL_PLANNING') return <div className="w-full p-4 md:p-8"><CallPlanning userId={activeUserId || ''} initialParams={viewParams} /></div>;
    if (activeView === 'STRATEGIC_ARCHIVE') return <div className="w-full p-4 md:p-8"><StrategicArchive userId={activeUserId || ''} /></div>;
    if (activeView === 'BRIEFS' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><AIBriefsHub /></div>;
    if (activeView === 'TEAM_GOALS' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><SmartGoalsAudit /></div>;
    if (activeView === 'STRATEGY' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><StrategyManagement /></div>;
    if (activeView === 'GM_REVIEW' && isLeader) return <div className="w-full p-4 md:p-8"><GMWeeklyReview /></div>;
    if (activeView === 'WHITE_SPACE') return <div className="w-full p-4 md:p-8"><WhitespaceAnalysis userId={activeUserId || ''} /></div>;
    if (activeView === 'REPORTS') return <div className="w-full p-4 md:p-8"><BIReportsViewer /></div>;
    if (activeView === 'UPLOAD' && isLeader) return <div className="w-full p-4 md:p-8"><CRMImporter /></div>;
    if (activeView === 'ARCHIVE') return <div className="w-full p-4 md:p-8"><WeeklyArchive /></div>;
    if (activeView === 'FACT_FINDING') return <div className="w-full p-4 md:p-8"><FactFindingHub /></div>;
    if (activeView === 'ACTUAL_SPEND') return <div className="w-full p-4 md:p-8"><ActualSpendView /></div>;
    if (activeView === 'ALIGN_CUSTOMER') return <div className="w-full p-4 md:p-8"><AlignCustomer /></div>;
    if (activeView === 'PLAYBOOK') return <div className="w-full p-4 md:p-8"><PlaybookView /></div>;
    if (activeView === 'DATA_EXPLORER' && isLeader) return <div className="w-full p-4 md:p-8"><DataExplorer /></div>;
    if (activeView === 'SETTINGS') return <div className="w-full p-4 md:p-8"><SettingsHub /></div>;
    if (activeView === 'OPS_REPORT') return <div className="w-full p-4 md:p-8"><OpsReportForm /></div>;
    if (activeView === 'OPS_REVIEW' && isLeader) return <div className="w-full p-4 md:p-8"><OpsReviewLedger /></div>;
    if (activeView === 'TWIW') return <div className="w-full p-4 md:p-8"><TWIWView userId={activeUserId || ''} isLeader={isLeader} /></div>;
    if (activeView === 'FRIDAY_FW') return <div className="w-full p-4 md:p-8"><FridayPerformanceReview userId={activeUserId || ''} userName={profile?.name || ''} userRole={profile?.role || 'BDM'} userState={profile?.state || 'WA'} selectedWeek={getCurrentWeek()} /></div>;
    if (activeView === 'DEMO_DASH') return <div className="w-full p-4 md:p-8"><DemoDashView /></div>;
    if (activeView === 'BROADCAST' && isLeader) return <div className="w-full p-4 md:p-8 max-w-xl mx-auto"><SystemBroadcast /></div>;
    if (activeView === 'STRATEGIC_REPOSITORY' && isLeader) return <div className="w-full p-4 md:p-8"><StrategicRepository /></div>;
    if (activeView === 'SUCCESS_PLANS') return <div className="w-full p-4 md:p-8"><SuccessPlansView userId={activeUserId || ''} isLeader={isLeader} /></div>;
    if (activeView === 'MANAGE_TIME') return <div className="w-full p-4 md:p-8"><ManageTimeView /></div>;
    if (activeView === 'CANVASSING') return <div className="w-full p-4 md:p-8"><CanvassingHub /></div>;
    if (activeView === 'AM_BD' && isLeader) return <div className="w-full p-4 md:p-8"><AMBDManagement /></div>;
    if (activeView === 'FF_ADMIN' && isLeader) return <div className="w-full p-4 md:p-8"><FFAdminHub /></div>;
    if (activeView === 'DATA_HEALTH' && isLeader) return <div className="w-full p-4 md:p-8"><DataHealthDashboard /></div>;
    if (activeView === 'OVERVIEW' && isLeader) return <div className="w-full p-4 md:p-8"><OverviewHub /></div>;
    
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
                          navigateTo('TEAM'); // Return to Governance/Users page
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all font-black text-xs uppercase tracking-wider border border-amber-500/20 mb-2 group"
                      >
                        <XCircle className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                        <span>Return to Governance</span>
                      </button>
                    </SidebarMenuItem>
                  )}
                  {getNavigationForUser(profile?.role as any, isLeader).map((group, groupIdx) => {
                    const isCollapsed = collapsedGroups[group.id] || false;
                    return (
                    <div key={group.id} className={groupIdx > 0 ? "mt-4" : ""}>
                      {groupIdx > 0 && (
                        <SidebarGroupLabel 
                          className="px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 cursor-pointer flex items-center gap-1 hover:text-slate-600 transition-colors"
                          onClick={() => toggleGroup(group.id)}
                        >
                          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {group.label}
                        </SidebarGroupLabel>
                      )}
                      {!isCollapsed && group.items.map(nav => (
                        <SidebarMenuItem key={nav.view}>
                          <SidebarMenuButton isActive={activeView === nav.view} onClick={() => navigateTo(nav.view)} tooltip={nav.label}>
                            <nav.icon className="w-4 h-4" />
                            <span>{nav.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </div>
                  )})}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => { localStorage.setItem('forceMobile', 'true'); window.dispatchEvent(new Event('force-mobile-change')); }} className="text-indigo-600">
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile Mode</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut} className="text-red-500">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-[#F7F6F8]">
          <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-slate-200/50 shadow-sm shrink-0 gap-2 print:hidden">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 md:hidden pl-1">
              <Compass className="w-5 h-5 text-indigo-600" />
              <span className="font-black uppercase tracking-tight text-xs text-slate-900">BDM Compass</span>
            </div>
            
            {isLeader && (
              <div className="ml-2">
                <CreateNoteDialog />
              </div>
            )}

            {simulationUid && isLeader && (
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>Simulating: <strong className="font-black">{simulatedUserProfile?.name || simulationUid}</strong></span>
                <button
                  onClick={() => {
                    setSimulationUid(null);
                    navigateTo('TEAM');
                  }}
                  className="ml-2 underline font-black hover:text-amber-950 uppercase text-[10px] tracking-wider"
                >
                  Exit
                </button>
              </div>
            )}

            {/* Top Menu for Admin, Leaders, Bdms, and AMs */}
            {(profile?.role === 'LEADER' || profile?.role === 'GM' || profile?.role === 'BDM' || profile?.role === 'ACCOUNT_MANAGER' || isLeader) && (
              <nav className="hidden md:flex items-center gap-1.5 ml-6 bg-slate-50/80 p-1 rounded-xl border border-slate-100/80">
                <a
                  href="https://studio--studio-7521332906-59af2.us-central1.hosted.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Just Easy</span>
                </a>
                <button
                  onClick={() => navigateTo('MANAGE_TIME')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeView === 'MANAGE_TIME'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Manage Time</span>
                </button>
                <button
                  onClick={() => navigateTo('FACT_FINDING')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeView === 'FACT_FINDING'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <FileSearch className="w-3.5 h-3.5" />
                  <span>Fact Finding</span>
                </button>
                <button
                  onClick={() => navigateTo('WHITE_SPACE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeView === 'WHITE_SPACE'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>White Space</span>
                </button>
              </nav>
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
          {/* Session Context Bar */}
          <div className="bg-slate-900 border-b border-slate-800 text-[10px] sm:text-xs font-semibold text-slate-300 py-2.5 px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm print:hidden">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              {/* User Context */}
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>BDM Context: <strong className="text-white">{simulationUid ? `${simulatedUserProfile?.name || simulationUid} (Simulating)` : `${profile?.name || user?.email || 'Guest'} (Me)`}</strong></span>
              </div>
              
              {/* Divider */}
              <span className="hidden sm:inline text-slate-700">|</span>

              {/* Week Context */}
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Sales Week: <strong className="text-white">{getCurrentWeek()}</strong></span>
              </div>
            </div>

            {/* Sync Context */}
            <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Last CRM Sync: <strong className="text-white">{settingsData?.lastCrmSync?.toDate ? format(settingsData.lastCrmSync.toDate(), 'MMM d, yyyy h:mm a') : 'Never'}</strong></span>
              </div>
            </div>
          </div>
          <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-4rem)] w-full max-w-[1600px] mx-auto px-3 md:px-4 lg:px-6 pb-24 md:pb-8">
            <ErrorBoundary>
              <Suspense fallback={<ViewSkeleton />}>
                {renderContent()}
              </Suspense>
            </ErrorBoundary>
          </main>
          <DeveloperDiagnostics />
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  // If loading or determining mobile status
  if (loading || isMobile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F8]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Handle unauthenticated user
  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <PipelineProvider>
      <NavigationProvider>
        {isMobile ? (
          <MobileDashboard userId={user.uid} userName={profile?.name || user.email || 'User'} />
        ) : (
          <DashboardContent />
        )}
      </NavigationProvider>
    </PipelineProvider>
  );
}