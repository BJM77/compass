"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  FileSearch, 
  LayoutGrid, 
  Target, 
  Send, 
  CalendarCheck,
  LogOut,
  Compass,
  ChevronRight,
  User,
  Phone,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  X,
  XCircle,
  Users,
  Menu,
  Clock,
  ClipboardList,
  BookOpen,
  Coins,
  Archive,
  AlertCircle,
  Shield,
  Database,
  Upload,
  Map,
  BarChart4,
  Settings,
  Sparkles
} from 'lucide-react';

import { UserManagement } from './user-management';
import { MobileModule } from '@/lib/mobile-utils';
import { KPICard } from './kpi-card';
import { FactFindingHub } from './fact-finding-hub';
import { WhitespaceAnalysis } from './whitespace-analysis';
import { WeeklyGoals } from './weekly-goals';
import { FridayPerformanceReview } from './friday-performance-review';
import { TWIWView } from './twiw-view';
import { CallPlanning } from './call-planning';
import { ManageTimeView } from './manage-time-view';
import { SuccessPlansView } from './success-plans';
import { StrategicArchive } from './strategic-archive';
import { PlaybookView } from './playbook-view';
import { ActualSpendView } from './actual-spend-view';
import { OpsReportForm } from './ops-report-form';
import { OpsReportReview } from './ops-report-review';
import { SettingsHub } from './settings-hub';
import { DataExplorer } from './data-explorer';
import { WeeklyArchive } from './weekly-archive';
import { CRMImporter } from './crm-importer';
import { StrategyManagement } from './strategy-management';
import { BIReportsViewer } from './bi-reports-viewer';

import { usePipelineData } from '@/contexts/pipeline-context';
import { useCRMSummary } from '@/hooks/use-crm-summary';
import { getCurrentWeek, formatEAV } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MobileDashboardProps {
  userId: string;
  userName: string;
}

export function MobileDashboard({ userId, userName }: MobileDashboardProps) {
  const { profile, isLeader } = useAuth();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const [activeModule, setActiveModule] = useState<MobileModule>('DASHBOARD');
  const [showBackButton, setShowBackButton] = useState(false);
  const [twtwDefaultTab, setTwtwDefaultTab] = useState<string>('my-report');
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  
  const currentWeek = getCurrentWeek();
  const { pipelineReviews, isLoading, activeUserId, simulationUid, setSimulationUid } = usePipelineData();
  const currentUserId = activeUserId || userId;
  const crmSummary = useCRMSummary(currentUserId, isLeader);

  // Listen for navigation events from other components
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      if (e.detail?.view) {
        const viewMap: Record<string, MobileModule> = {
          'FACT_FINDING': 'FACT_FINDING',
          'WHITE_SPACE': 'WHITE_SPACE',
          'MONDAY_PLANNING': 'MONDAY_PLANNING',
          'FRIDAY_FW': 'FRIDAY_FW',
          'TWIW': 'TWIW',
          'TEAM': 'TEAM',
          'DASHBOARD': 'DASHBOARD',
          'MANAGE_TIME': 'MANAGE_TIME',
          'SUCCESS_PLANS': 'SUCCESS_PLANS',
          'STRATEGIC_ARCHIVE': 'STRATEGIC_ARCHIVE',
          'PLAYBOOK': 'PLAYBOOK',
          'ACTUAL_SPEND': 'ACTUAL_SPEND',
          'OPS_REPORT': 'OPS_REPORT',
          'OPS_REVIEW': 'OPS_REVIEW',
          'SETTINGS': 'SETTINGS',
          'DATA_EXPLORER': 'DATA_EXPLORER',
          'ARCHIVE': 'ARCHIVE',
          'UPLOAD': 'UPLOAD',
          'STRATEGY': 'STRATEGY',
          'REPORTS': 'REPORTS'
        };
        const module = viewMap[e.detail.view];
        if (module) {
          setActiveModule(module);
          setShowBackButton(true);
          if (module === 'TWIW') {
            setTwtwDefaultTab(e.detail.params?.tab || 'my-report');
          }
        }
      }
    };

    window.addEventListener('switch-view', handleNavigate as EventListener);
    return () => window.removeEventListener('switch-view', handleNavigate as EventListener);
  }, []);

  // Compute quick stats for the dashboard overview
  const showTeamTotals = isLeader && !simulationUid;
  
  const stats = {
    totalPipeline: showTeamTotals 
      ? (crmSummary.team?.opportunityValue || 0)
      : (pipelineReviews?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) || 0),
    opportunityCount: showTeamTotals 
      ? (crmSummary.team?.opportunityCount || 0)
      : (pipelineReviews?.filter(d => !d.isBareAccount).length || 0),
    revenueYTD: showTeamTotals 
      ? (crmSummary.team?.custYTDRevenueThisFY || 0)
      : (crmSummary.myStats?.custYTDRevenueThisFY || 0),
    target: showTeamTotals 
      ? (crmSummary.team?.customerCount * 500000 || 25000000) 
      : (profile?.target || 2500000),
    topDeals: showTeamTotals
      ? (crmSummary.team?.oppRecords || [])
          .sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0))
          .slice(0, 3)
      : (pipelineReviews?.filter(d => !d.isBareAccount && d.value)
          .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
          .slice(0, 3) || []),
    oppRecords: showTeamTotals 
      ? (crmSummary.team?.oppRecords || [])
      : (crmSummary.myStats?.oppRecords || []),
    custRecords: showTeamTotals
      ? (crmSummary.team?.custRecords || [])
      : (crmSummary.myStats?.custRecords || [])
  };

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      document.cookie = "auth_status=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      router.push('/login');
    }
  };

  const handleBack = () => {
    setActiveModule('DASHBOARD');
    setShowBackButton(false);
  };

  const selectModule = (module: MobileModule) => {
    setActiveModule(module);
    setShowBackButton(module !== 'DASHBOARD');
    setMenuSheetOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'DASHBOARD':
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} onSelectModule={selectModule} />;
      case 'MANAGE_TIME':
        return <ManageTimeView />;
      case 'FACT_FINDING':
        return <FactFindingHub />;
      case 'WHITE_SPACE':
        return <WhitespaceAnalysis userId={currentUserId} />;
      case 'MONDAY_PLANNING':
        return <CallPlanning userId={currentUserId} />;
      case 'FRIDAY_FW':
        return <FridayPerformanceReview 
          userId={currentUserId} 
          userName={userName} 
          userRole={profile?.role || 'BDM'} 
          userState={profile?.state || 'WA'}
          selectedWeek={currentWeek}
        />;
      case 'TWIW':
        return <TWIWView userId={currentUserId} isLeader={isLeader} defaultTab={twtwDefaultTab} />;
      case 'SUCCESS_PLANS':
        return <SuccessPlansView userId={currentUserId} isLeader={isLeader} />;
      case 'STRATEGIC_ARCHIVE':
        return <StrategicArchive userId={currentUserId} />;
      case 'PLAYBOOK':
        return <PlaybookView />;
      case 'ACTUAL_SPEND':
        return <ActualSpendView />;
      case 'OPS_REPORT':
        return <OpsReportForm />;
      case 'OPS_REVIEW':
        if (isLeader) return <OpsReportReview />;
        return <OpsReportForm />;
      case 'SETTINGS':
        return <SettingsHub />;
      case 'DATA_EXPLORER':
        if (isLeader) return <DataExplorer />;
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} onSelectModule={selectModule} />;
      case 'ARCHIVE':
        return <WeeklyArchive />;
      case 'UPLOAD':
        if (isLeader) return <CRMImporter />;
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} onSelectModule={selectModule} />;
      case 'STRATEGY':
        if (isLeader) return <StrategyManagement />;
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} onSelectModule={selectModule} />;
      case 'REPORTS':
        return <BIReportsViewer />;
      case 'TEAM':
        if (isLeader) {
          return <UserManagement onSimulate={(uid) => {
            setSimulationUid(uid);
            setActiveModule('DASHBOARD');
            setShowBackButton(false);
          }} />;
        }
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} onSelectModule={selectModule} />;
      default:
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} onSelectModule={selectModule} />;
    }
  };

  const getModuleTitle = (module: MobileModule): string => {
    const titles: Record<MobileModule, string> = {
      'DASHBOARD': 'Dashboard',
      'MANAGE_TIME': 'Manage Time',
      'FACT_FINDING': 'Fact Finding',
      'WHITE_SPACE': 'White Space',
      'MONDAY_PLANNING': 'Call Plan',
      'FRIDAY_FW': 'Friday FW',
      'TWIW': 'TWTW',
      'SUCCESS_PLANS': 'Success Plans',
      'STRATEGIC_ARCHIVE': 'Strategic Archive',
      'PLAYBOOK': 'Playbooks',
      'ACTUAL_SPEND': 'Actual Spend',
      'OPS_REPORT': 'Ops Report',
      'OPS_REVIEW': 'Ops Review Ledger',
      'SETTINGS': 'Settings',
      'DATA_EXPLORER': 'Data Explorer',
      'ARCHIVE': 'Weekly Snapshot',
      'TEAM': 'Team Governance',
      'UPLOAD': 'CRM Import',
      'STRATEGY': 'Strategy Management',
      'REPORTS': 'BI Reports'
    };
    return titles[module] || 'Dashboard';
  };

  // Primary bottom navigation (4 key tabs + Menu button)
  const bottomNavTabs = [
    { id: 'DASHBOARD' as MobileModule, label: 'Home', icon: LayoutDashboard },
    { id: 'TWIW' as MobileModule, label: 'TWTW', icon: CalendarCheck },
    { id: 'MONDAY_PLANNING' as MobileModule, label: 'Call Plan', icon: Phone },
    { id: 'FRIDAY_FW' as MobileModule, label: 'Friday FW', icon: Send },
  ];

  // Organized Categories for the Full Navigation Drawer Sheet
  const menuCategories = [
    {
      title: 'Daily & Execution Tools',
      items: [
        { id: 'DASHBOARD' as MobileModule, label: 'Dashboard Home', description: 'Overview & quick stats', icon: LayoutDashboard },
        { id: 'MANAGE_TIME' as MobileModule, label: 'Manage Time', description: 'Matrix & task priorities', icon: Clock },
        { id: 'TWIW' as MobileModule, label: 'TWTW Collation', description: 'This week that was submission', icon: CalendarCheck },
        { id: 'FRIDAY_FW' as MobileModule, label: 'Friday Fieldwork', description: 'Weekly performance review', icon: Send },
        { id: 'MONDAY_PLANNING' as MobileModule, label: 'Call Planning', description: 'SPIN prep & customer calls', icon: Phone },
      ]
    },
    {
      title: 'Sales & Growth Strategy',
      items: [
        { id: 'FACT_FINDING' as MobileModule, label: 'Fact Finding Hub', description: 'Customer discovery & audit', icon: FileSearch },
        { id: 'WHITE_SPACE' as MobileModule, label: 'White Space Analysis', description: 'Account expansion opportunities', icon: LayoutGrid },
        { id: 'SUCCESS_PLANS' as MobileModule, label: 'Success Plans', description: 'Strategic account growth', icon: ClipboardList },
        { id: 'PLAYBOOK' as MobileModule, label: 'Playbooks', description: 'Sales playbooks & guides', icon: BookOpen },
        { id: 'ACTUAL_SPEND' as MobileModule, label: 'Actual Spend', description: 'Customer revenue ledger', icon: Coins },
        { id: 'STRATEGIC_ARCHIVE' as MobileModule, label: 'Strategic Archive', description: 'Historical plans & reports', icon: Archive },
      ]
    },
    {
      title: 'Reporting & Operations',
      items: [
        { id: 'OPS_REPORT' as MobileModule, label: 'Ops Report Form', description: 'Log operational issues', icon: AlertCircle },
        { id: 'ARCHIVE' as MobileModule, label: 'Weekly Snapshot', description: 'Weekly historical records', icon: Archive },
        { id: 'REPORTS' as MobileModule, label: 'BI Reports', description: 'Analytics & insights', icon: BarChart4 },
        { id: 'SETTINGS' as MobileModule, label: 'Settings', description: 'Account & app preferences', icon: Settings },
      ]
    },
    ...(isLeader ? [{
      title: 'Leadership & Governance',
      items: [
        { id: 'TEAM' as MobileModule, label: 'Team Governance', description: 'User simulation & rights', icon: Users },
        { id: 'OPS_REVIEW' as MobileModule, label: 'Ops Review Ledger', description: 'Review operational escalations', icon: Shield },
        { id: 'DATA_EXPLORER' as MobileModule, label: 'Data Explorer', description: 'Database query & export', icon: Database },
        { id: 'STRATEGY' as MobileModule, label: 'Strategy Management', description: 'Business Unit goals & targets', icon: Map },
        { id: 'UPLOAD' as MobileModule, label: 'CRM Import', description: 'Upload revenue & pipeline CSVs', icon: Upload },
      ]
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F8] flex flex-col max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-sm w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton && activeModule !== 'DASHBOARD' ? (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-slate-700"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700" />
                <span className="text-xs font-bold text-slate-600 hidden sm:inline">Back</span>
              </button>
            ) : (
              <Compass className="w-5 h-5 text-primary shrink-0" />
            )}
            <span className="font-bold text-sm text-primary truncate max-w-[170px] sm:max-w-none">
              {showBackButton ? getModuleTitle(activeModule) : 'BDM Compass'}
            </span>
            <Badge variant="outline" className="text-[8px] font-black uppercase shrink-0">
              Mobile
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              W{currentWeek.split('-')[1]}
            </span>
            <button
              onClick={handleSignOut}
              aria-label="Sign Out"
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Simulation Banner */}
      {simulationUid && isLeader && (
        <div className="bg-amber-100 px-4 py-2 flex items-center justify-between border-b border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold animate-pulse truncate">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
            <span className="truncate">Simulating: {currentUserId}</span>
          </div>
          <button
            onClick={() => {
              setSimulationUid(null);
              setActiveModule('TEAM');
              setShowBackButton(true);
            }}
            className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-900 bg-amber-200/50 px-2 py-1 rounded-md shrink-0 ml-2"
          >
            <XCircle className="w-3 h-3" /> Exit
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 w-full">
        <ScrollArea key={activeModule} className="h-full w-full">
          <div className="p-3 sm:p-4 max-w-full overflow-x-hidden">
            {renderModule()}
          </div>
        </ScrollArea>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-50 shadow-lg px-1">
        <div className="flex justify-around items-center h-16">
          {bottomNavTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id && !menuSheetOpen;
            return (
              <button
                key={item.id}
                onClick={() => selectModule(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1 rounded-lg ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${
                  isActive ? 'text-primary font-black' : 'text-slate-400'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Menu Drawer Button */}
          <Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  menuSheetOpen || !bottomNavTabs.some(t => t.id === activeModule) ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1 rounded-lg ${menuSheetOpen || !bottomNavTabs.some(t => t.id === activeModule) ? 'bg-primary/10' : ''}`}>
                  <Menu className="w-5 h-5 stroke-[2.5px]" />
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${
                  menuSheetOpen || !bottomNavTabs.some(t => t.id === activeModule) ? 'text-primary font-black' : 'text-slate-400'
                }`}>
                  Menu
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl px-0 py-5 bg-[#F8FAFC]">
              <SheetHeader className="px-5 pb-3 border-b border-slate-200/60 flex flex-row items-center justify-between">
                <div>
                  <SheetTitle className="text-left text-base font-black text-slate-900 flex items-center gap-2">
                    <Compass className="w-5 h-5 text-primary" />
                    BDM Compass Navigation
                  </SheetTitle>
                  <p className="text-[11px] font-medium text-slate-500 text-left">Access all system tools & modules</p>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(88vh-80px)] px-5 py-4">
                <div className="space-y-6 pb-12">
                  {menuCategories.map((cat, cIdx) => (
                    <div key={cIdx} className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                        {cat.title}
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {cat.items.map((item) => {
                          const Icon = item.icon;
                          const isSelected = activeModule === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => selectModule(item.id)}
                              className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                                isSelected 
                                  ? 'bg-primary text-white border-primary shadow-md' 
                                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-primary/40 hover:bg-slate-50 active:scale-[0.99]'
                              }`}
                            >
                              <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/5 text-primary'}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                    {item.label}
                                  </p>
                                  {isSelected && (
                                    <Badge className="bg-white/20 text-white border-none text-[8px] font-black uppercase">
                                      Active
                                    </Badge>
                                  )}
                                </div>
                                <p className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                  {item.description}
                                </p>
                              </div>
                              <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white/70' : 'text-slate-300'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Sign Out Button in Drawer */}
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={handleSignOut}
                      className="w-full p-3.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out of Compass</span>
                    </button>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}

// Mobile Dashboard Overview Component
function MobileDashboardView({ 
  userId, 
  userName, 
  stats, 
  isLeader, 
  setSimulationUid,
  onSelectModule 
}: { 
  userId: string; 
  userName: string; 
  stats: any; 
  isLeader: boolean; 
  setSimulationUid?: (uid: string) => void;
  onSelectModule: (module: MobileModule) => void;
}) {
  const db = useFirestore();
  const usersQuery = useMemoFirebase(() => {
    if (!db || !isLeader) return null;
    return collection(db, 'users');
  }, [db, isLeader]);
  const { data: users } = useCollection(usersQuery);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pipelineSheetOpen, setPipelineSheetOpen] = useState(false);
  const [revenueSheetOpen, setRevenueSheetOpen] = useState(false);

  const activeUserObj = users?.find(u => u.id === userId);
  const displayName = activeUserObj?.name || userName;

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-full">
      {/* Welcome Card */}
      {isLeader ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="w-full text-left bg-gradient-to-br from-primary via-primary/95 to-primary/80 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden active:scale-[0.98] transition-transform">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-xs font-medium opacity-80">Welcome back</p>
                  <h2 className="text-lg font-black mt-0.5 flex items-center gap-2">
                    {displayName}
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-white/20 text-white border-none text-[9px] font-black">
                      Week {getCurrentWeek().split('-')[1]}
                    </Badge>
                    <span className="text-[10px] opacity-70">•</span>
                    <span className="text-[10px] opacity-70">Tap to Simulate User</span>
                  </div>
                </div>
                <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl px-0 py-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle className="text-left text-base font-black">Select User to Simulate</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full px-6 pb-12">
              <div className="space-y-2">
                {users?.map(u => (
                  <button 
                    key={u.id} 
                    onClick={() => { 
                      if (setSimulationUid) setSimulationUid(u.id); 
                      setSheetOpen(false); 
                    }} 
                    className="w-full text-left p-3 rounded-2xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-3 active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {u.name?.charAt(0) || u.email?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-slate-800 truncate">{u.name || 'Unnamed User'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      ) : (
        <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium opacity-80">Welcome back</p>
              <h2 className="text-lg font-black mt-0.5">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/20 text-white border-none text-[9px] font-black">
                  Week {getCurrentWeek().split('-')[1]}
                </Badge>
                <span className="text-[10px] opacity-70">•</span>
                <span className="text-[10px] opacity-70">Mobile Compass</span>
              </div>
            </div>
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-sm">
              <User className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Sheet open={pipelineSheetOpen} onOpenChange={setPipelineSheetOpen}>
          <SheetTrigger asChild>
            <button className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 text-left hover:border-primary/40 transition-all active:scale-[0.98] min-w-0">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pipeline</p>
                  <p className="text-base sm:text-lg font-black text-primary mt-0.5 truncate">{formatEAV(stats.totalPipeline)}</p>
                  <p className="text-[10px] font-bold text-slate-500 truncate">{stats.opportunityCount} opps</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl px-0 py-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle className="text-left text-base font-black">Pipeline Opportunities</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full px-6 pb-12">
              <div className="space-y-2">
                {stats.oppRecords?.map((opp: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-2xl border border-slate-100 flex flex-col gap-1.5 bg-slate-50/50">
                    <div className="w-full">
                      <p className="text-xs font-bold text-slate-800">{opp.pipeline || opp.accountMasterName || 'Unnamed Deal'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{opp.stage || 'Discovery'} • {opp.userName || userId}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-primary">{formatEAV(opp.value || 0)}</p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase">
                        {opp.probability || 0}%
                      </Badge>
                    </div>
                  </div>
                ))}
                {!stats.oppRecords?.length && (
                  <p className="text-xs text-slate-500 text-center py-6">No active opportunities.</p>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <Sheet open={revenueSheetOpen} onOpenChange={setRevenueSheetOpen}>
          <SheetTrigger asChild>
            <button className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 text-left hover:border-emerald-500/40 transition-all active:scale-[0.98] min-w-0">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Revenue YTD</p>
                  <p className="text-base sm:text-lg font-black text-emerald-600 mt-0.5 truncate">{formatEAV(stats.revenueYTD)}</p>
                  <p className="text-[10px] font-bold text-slate-500 truncate">Target: {formatEAV(stats.target)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl px-0 py-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle className="text-left text-base font-black">Customer Revenue</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full px-6 pb-12">
              <div className="space-y-2">
                {stats.custRecords?.sort((a: any, b: any) => (Number(b.currentRevenue) || 0) - (Number(a.currentRevenue) || 0)).map((cust: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-2xl border border-slate-100 flex flex-col gap-1.5 bg-slate-50/50">
                    <div className="w-full">
                      <p className="text-xs font-bold text-slate-800">{cust.accountMasterName || cust.pipeline || 'Unnamed Account'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{cust.userName || userId}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-emerald-600">{formatEAV(cust.currentRevenue || 0)}</p>
                      <span className="text-[9px] font-bold text-slate-400">YTD Revenue</span>
                    </div>
                  </div>
                ))}
                {!stats.custRecords?.length && (
                  <p className="text-xs text-slate-500 text-center py-6">No customer revenue recorded.</p>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Top Deals Card */}
      {stats.topDeals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Top Opportunities
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.topDeals.map((deal: any, idx: number) => (
              <div key={idx} className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{deal.pipeline}</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase truncate">{deal.stage || 'Discovery'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-primary">{formatEAV(deal.value || 0)}</p>
                  <Badge variant="outline" className="text-[8px] font-black uppercase mt-0.5">
                    {deal.probability || 0}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Action Cards Grid */}
      <div className="space-y-2">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
          Quick Access
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickActionTile
            title="Manage Time"
            subtitle="Task matrix"
            icon={Clock}
            onClick={() => onSelectModule('MANAGE_TIME')}
          />
          <QuickActionTile
            title="TWTW"
            subtitle="Weekly log"
            icon={CalendarCheck}
            onClick={() => onSelectModule('TWIW')}
          />
          <QuickActionTile
            title="Call Planning"
            subtitle="SPIN prep"
            icon={Phone}
            onClick={() => onSelectModule('MONDAY_PLANNING')}
          />
          <QuickActionTile
            title="Friday FW"
            subtitle="Weekly review"
            icon={Send}
            onClick={() => onSelectModule('FRIDAY_FW')}
          />
          <QuickActionTile
            title="Fact Finding"
            subtitle="Log discovery"
            icon={FileSearch}
            onClick={() => onSelectModule('FACT_FINDING')}
          />
          <QuickActionTile
            title="White Space"
            subtitle="Account matrix"
            icon={LayoutGrid}
            onClick={() => onSelectModule('WHITE_SPACE')}
          />
          <QuickActionTile
            title="Success Plans"
            subtitle="Strategic plans"
            icon={ClipboardList}
            onClick={() => onSelectModule('SUCCESS_PLANS')}
          />
          <QuickActionTile
            title="Archive"
            subtitle="Past reports"
            icon={Archive}
            onClick={() => onSelectModule('STRATEGIC_ARCHIVE')}
          />
        </div>
      </div>
    </div>
  );
}

function QuickActionTile({ 
  title, 
  subtitle, 
  icon: Icon, 
  onClick 
}: { 
  title: string; 
  subtitle: string; 
  icon: any; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 hover:border-primary/40 transition-all text-left active:scale-[0.98] group flex flex-col justify-between min-h-[84px] min-w-0"
    >
      <div className="flex items-center justify-between w-full">
        <div className="p-2 bg-primary/5 rounded-xl group-hover:bg-primary/10 transition-colors text-primary">
          <Icon className="w-4 h-4" />
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="mt-2 min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate">{title}</p>
        <p className="text-[10px] font-medium text-slate-400 truncate">{subtitle}</p>
      </div>
    </button>
  );
}
