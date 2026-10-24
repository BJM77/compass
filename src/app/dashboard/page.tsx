"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
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
const AccessHub = dynamic(() => import('@/components/dashboard/access-hub').then(m => m.AccessHub), { loading: () => <ViewSkeleton /> });
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
import { OverdueTaskStrip } from '@/components/dashboard/overdue-task-strip';
import { HeaderClock } from '@/components/dashboard/header-clock';
import { TimeReminderBell } from '@/components/dashboard/time-reminder-bell';
import { ThemeToggle } from '@/components/ui/theme-toggle';
const VerticalsView = dynamic(() => import('@/components/dashboard/verticals-view').then(m => m.VerticalsView), { loading: () => <ViewSkeleton /> });
const FuelSurchargesView = dynamic(() => import('@/components/dashboard/fuel-surcharges-view').then(m => m.FuelSurchargesView), { loading: () => <ViewSkeleton /> });
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
  Loader2, Star, Sparkles, Map, Database, BarChart4, FileSearch, AlertCircle, ClipboardList, Coins, CalendarCheck, Beaker, Upload, Megaphone, Send, BookOpen, Clock, Smartphone, Monitor, Navigation, ChevronDown, ChevronRight
} from 'lucide-react';
const BdAmReview = dynamic(() => import('@/components/dashboard/bd-am-review').then(m => m.BdAmReview), { loading: () => <ViewSkeleton /> });
const CRMImporter = dynamic(() => import('@/components/dashboard/crm-importer').then(m => m.CRMImporter), { loading: () => <ViewSkeleton /> });
import { useAuth as useFirebaseAuth, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { PipelineProvider, usePipelineData } from '@/contexts/pipeline-context';
import { NavigationProvider, useNavigation } from '@/contexts/navigation-context';
import { getNavigationForUser, findGroupIdForView, DEFAULT_COLLAPSED_GROUPS, DashboardView } from '@/lib/navigation';
import { CommandPalette, CommandPaletteTrigger, useCommandPalette } from '@/components/dashboard/command-palette';
import { MobileStickyMenu } from '@/components/dashboard/mobile-sticky-menu';

function DashboardContent() {
  const { profile, isLeader, user, loading: isAuthLoading } = useAuth();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const { currentView, viewParams, navigateTo } = useNavigation();
  
  const { activeUserId, simulationUid, setSimulationUid } = usePipelineData();


  const usersQuery = useMemoFirebase(() => { if (!db || !isLeader) return null; return collection(db, 'users'); }, [db, isLeader]);
  const { data: allUsers } = useCollection(usersQuery);
  const simulatedUserProfile = allUsers?.find(u => u.id === simulationUid);
  
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({ ...DEFAULT_COLLAPSED_GROUPS });
  const palette = useCommandPalette();

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
  // Logo/title home button: back to the main Dashboard view.
  const goHome = () => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/dashboard')) {
      router.push('/dashboard');
      return;
    }
    navigateTo('DASHBOARD');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleSimulate = (uid: string) => { setSimulationUid(uid); navigateTo('DASHBOARD'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    // Temporary escalation removed in favor of hardcoded check in auth-context

  const activeView = profile?.role === 'GUEST' ? 'TWIW' : currentView;
  // Single source of truth for role-based menu visibility (sidebar + mobile sticky menu).
  const navGroups = getNavigationForUser(profile?.role as any, isLeader);

  // Always open the sidebar group that holds the page being viewed.
  useEffect(() => {
    const gid = findGroupIdForView(activeView as DashboardView);
    if (gid) setCollapsedGroups(prev => (prev[gid] ? { ...prev, [gid]: false } : prev));
  }, [activeView]);

  const activeNav = navGroups.flatMap(g => g.items.map(i => ({ ...i, groupLabel: g.label }))).find(i => i.view === activeView);
  const pageTitle = activeNav?.label ?? 'Dashboard';
  const pageGroup = activeNav?.groupLabel;

  const renderContent = () => {
    // DEFENSIVE: Block rendering if activeUserId is not yet resolved
    if (!activeUserId && !isAuthLoading) return <div className="flex items-center justify-center py-40"><Loader2 className="animate-spin" /></div>;

    if (activeView === 'TEAM' && isLeader) return <div className="w-full p-4 md:p-8 space-y-8"><UserManagement onSimulate={handleSimulate} /></div>;
    if (activeView === 'ACCESS' && isLeader) return <div className="w-full p-4 md:p-8"><AccessHub /></div>;
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
    if (activeView === 'FUEL_SURCHARGES') return <div className="w-full p-4 md:p-8"><FuelSurchargesView /></div>;
    if (activeView === 'VERTICALS') return <div className="w-full p-4 md:p-8"><VerticalsView /></div>;
    if (activeView === 'MANAGE_TIME') return <div className="w-full p-4 md:p-8"><ManageTimeView /></div>;
    if (activeView === 'CANVASSING') return <div className="w-full p-4 md:p-8"><CanvassingHub /></div>;
    if (activeView === 'AM_BD' && isLeader) return <div className="w-full p-4 md:p-8"><AMBDManagement /></div>;
    if (activeView === 'FF_ADMIN' && isLeader) return <div className="w-full p-4 md:p-8"><FFAdminHub /></div>;
    if (activeView === 'DATA_HEALTH' && isLeader) return <div className="w-full p-4 md:p-8"><DataHealthDashboard /></div>;
    if (activeView === 'OVERVIEW' && isLeader) return <div className="w-full p-4 md:p-8"><OverviewHub /></div>;
    if (activeView === 'BD_AM_REVIEW') return <div className="w-full p-4 md:p-8"><BdAmReview /></div>;
    
    if (isLeader && !simulationUid) return <LeaderDashboard onSimulate={handleSimulate} />;
    return <BDMDashboard simulatedUser={simulationUid && simulatedUserProfile ? { uid: simulationUid, profile: simulatedUserProfile } : undefined} />;
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <Sidebar collapsible="icon" className="border-sidebar-border">
          <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
            <button type="button" onClick={goHome} aria-label="Home" title="Home" className="flex items-center gap-3 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"><Compass className="w-5 h-5" /></span>
              <span className="flex flex-col items-start leading-tight group-data-[collapsible=icon]:hidden">
                <span className="font-semibold text-base text-white tracking-tight">BDM Compass</span>
                <span className="text-xs text-sidebar-muted">Sales performance</span>
              </span>
            </button>
          </SidebarHeader>
          <SidebarContent className="py-2">
            <SidebarGroup className="py-0">
              <SidebarGroupContent>
                <SidebarMenu className="px-2 space-y-1">
                  {simulationUid && isLeader && (
                    <SidebarMenuItem>
                      <button
                        onClick={() => {
                          setSimulationUid(null);
                          navigateTo('TEAM'); // Return to Governance/Users page
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/15 text-gold hover:bg-warning/25 transition-colors font-semibold text-sm border border-gold/30 mb-2 group"
                      >
                        <XCircle className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="group-data-[collapsible=icon]:hidden">Return to Governance</span>
                      </button>
                    </SidebarMenuItem>
                  )}
                  {navGroups.map((group, groupIdx) => {
                    const isCollapsed = collapsedGroups[group.id] || false;
                    return (
                    <div key={group.id} className={cn(groupIdx > 0 && "mt-3 group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:pt-2 group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:border-sidebar-border")}>
                      <SidebarGroupLabel
                        role="button"
                        aria-expanded={!isCollapsed}
                        className="px-3 text-xs font-semibold text-sidebar-muted tracking-wide mb-1 cursor-pointer flex items-center justify-between hover:text-white transition-colors"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <span>{group.label}</span>
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </SidebarGroupLabel>
                      {/* In icon-collapse mode every group's icons stay visible regardless of the group's open state. */}
                      <div className={cn("space-y-0.5", isCollapsed && "hidden group-data-[collapsible=icon]:block")}>
                        {group.items.map(nav => (
                          <SidebarMenuItem key={nav.view}>
                            <SidebarMenuButton isActive={activeView === nav.view} onClick={() => navigateTo(nav.view)} tooltip={nav.label}>
                              <nav.icon className="w-4 h-4" />
                              <span>{nav.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </div>
                    </div>
                  )})}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                {typeof window !== 'undefined' && localStorage.getItem('forceMobile') === 'true' ? (
                  <SidebarMenuButton
                    onClick={() => {
                      localStorage.removeItem('forceMobile');
                      window.dispatchEvent(new Event('force-mobile-change'));
                    }}
                    tooltip="Desktop Mode"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Desktop Mode</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    onClick={() => {
                      localStorage.setItem('forceMobile', 'true');
                      window.dispatchEvent(new Event('force-mobile-change'));
                    }}
                    tooltip="Mobile Mode"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Mobile Mode</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out" className="text-sidebar-foreground/80 hover:text-sidebar-accent-foreground">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-30 flex items-center h-16 px-4 min-w-0 max-w-full bg-card border-b border-border shadow-card shrink-0 gap-3 print:hidden">
            <SidebarTrigger className="-ml-1 text-muted-foreground" />
            <button type="button" onClick={goHome} aria-label="Home" title="Home" className="flex items-center gap-2 nav:hidden cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Compass className="w-4 h-4" /></span>
              <span className="font-semibold text-sm text-foreground">BDM Compass</span>
            </button>
            <div className="hidden nav:flex flex-col justify-center leading-tight min-w-0">
              {pageGroup && <span className="text-xs font-medium text-muted-foreground">{pageGroup}</span>}
              <h1 className="text-lg font-semibold text-foreground truncate">{pageTitle}</h1>
            </div>

            {isLeader && (
              <div className="ml-2">
                <CreateNoteDialog />
              </div>
            )}

            {simulationUid && isLeader && (
              <div className="flex items-center gap-2 bg-warning-soft px-3 py-1 rounded-full border border-warning/30 text-warning-ink text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-warning inline-block animate-pulse" />
                <span>Simulating: <strong className="font-semibold">{simulatedUserProfile?.name || simulationUid}</strong></span>
                <button
                  onClick={() => {
                    setSimulationUid(null);
                    navigateTo('TEAM');
                  }}
                  className="ml-1 underline font-semibold hover:opacity-80 text-xs"
                >
                  Exit
                </button>
              </div>
            )}

            <div className="flex-1" />
            <CommandPaletteTrigger onClick={() => palette.setOpen(true)} />
            {/* External tool link kept from the old top menu; page links now live in the sidebar and Cmd/Ctrl+K. */}
            {(profile?.role === 'LEADER' || profile?.role === 'GM' || profile?.role === 'BDM' || profile?.role === 'ACCOUNT_MANAGER' || isLeader) && (
              <a
                href="https://studio--studio-7521332906-59af2.us-central1.hosted.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden nav:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-accent hover:bg-info-soft transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Just Easy</span>
              </a>
            )}
            <HeaderClock />
            <TimeReminderBell onOpenManageTime={() => navigateTo('MANAGE_TIME')} />
            <ThemeToggle />
            <div className="flex items-center gap-3 min-w-0 pl-1">
              <div className="text-right hidden sm:block min-w-0">
                <p className="text-sm font-semibold text-foreground truncate max-w-[40vw] nav:max-w-none">{profile?.name || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role === 'GM' ? 'GM' : profile?.role?.replace('_', ' ').toLowerCase() || 'No Role'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm uppercase shrink-0 ring-2 ring-border">
                {(profile?.name || user?.email || '?').charAt(0)}
              </div>
            </div>
          </header>
          <OverdueTaskStrip onRearrange={(taskId) => navigateTo('MANAGE_TIME', taskId ? { highlightTaskId: taskId } : undefined)} />
          {/* Session Context Bar */}
          <div className="bg-secondary/70 border-b border-border text-xs font-medium text-muted-foreground py-2 px-4 sm:px-6 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-2 min-w-0 max-w-full print:hidden">
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              {/* User Context */}
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-info shrink-0" />
                <span>BDM context: <strong className="font-semibold text-foreground">{simulationUid ? `${simulatedUserProfile?.name || simulationUid} (Simulating)` : `${profile?.name || user?.email || 'Guest'} (Me)`}</strong></span>
              </div>

              {/* Divider */}
              <span className="hidden sm:inline text-border">|</span>

              {/* Week Context */}
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-success shrink-0" />
                <span>Sales week: <strong className="font-semibold text-foreground">{getCurrentWeek()}</strong></span>
              </div>
            </div>

            {/* Sync Context */}
            <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-between sm:justify-start">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-warning shrink-0" />
                <span>Last CRM sync: <strong className="font-semibold text-foreground">{settingsData?.lastCrmSync?.toDate ? format(settingsData.lastCrmSync.toDate(), 'MMM d, yyyy h:mm a') : 'Never'}</strong></span>
              </div>
            </div>
          </div>
          <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-4rem)] w-full max-w-[1600px] mx-auto px-3 md:px-4 lg:px-6 pb-24 nav:pb-8">
            <ErrorBoundary>
              <Suspense fallback={<ViewSkeleton />}>
                {renderContent()}
              </Suspense>
            </ErrorBoundary>
          </main>
          <DeveloperDiagnostics />
        </SidebarInset>
        <CommandPalette groups={navGroups} activeView={activeView as DashboardView} onNavigate={navigateTo} open={palette.open} setOpen={palette.setOpen} />
        <MobileStickyMenu
          groups={navGroups}
          activeView={activeView as DashboardView}
          onNavigate={navigateTo}
          onSignOut={handleSignOut}
          email={user?.email || profile?.email || ''}
          showReturnToGovernance={!!(simulationUid && isLeader)}
          onReturnToGovernance={() => { setSimulationUid(null); navigateTo('TEAM'); }}
        />
      </SidebarProvider>
    </AuthGuard>
  );
}

export default function DashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  // If loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
        <DashboardContent />
      </NavigationProvider>
    </PipelineProvider>
  );
}