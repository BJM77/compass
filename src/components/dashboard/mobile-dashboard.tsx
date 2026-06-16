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
  Users
} from 'lucide-react';
import { UserManagement } from './user-management';
import { MobileModule, MOBILE_MODULES } from '@/lib/mobile-utils';
import { KPICard } from './kpi-card';
import { FactFindingHub } from './fact-finding-hub';
import { WhitespaceAnalysis } from './whitespace-analysis';
import { WeeklyGoals } from './weekly-goals';
import { BDMWeeklySubmission } from './bdm-weekly-submission';
import { TWIWView } from './twiw-view';
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
          'FRIDAY_SYNTHESIS': 'FRIDAY_SYNTHESIS',
          'TWIW': 'TWIW',
          'TEAM': 'TEAM',
          'DASHBOARD': 'DASHBOARD'
        };
        const module = viewMap[e.detail.view];
        if (module) {
          setActiveModule(module);
          setShowBackButton(true);
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

  const renderModule = () => {
    switch (activeModule) {
      case 'DASHBOARD':
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} />;
      case 'FACT_FINDING':
        return <FactFindingHub />;
      case 'WHITE_SPACE':
        return <WhitespaceAnalysis userId={currentUserId} />;
      case 'MONDAY_PLANNING':
        return <WeeklyGoals userId={currentUserId} />;
      case 'FRIDAY_SYNTHESIS':
        return <BDMWeeklySubmission userId={currentUserId} userName={userName} />;
      case 'TWIW':
        return <TWIWView userId={currentUserId} isLeader={false} />;
      case 'TEAM':
        if (isLeader) {
          return <UserManagement onSimulate={(uid) => {
            setSimulationUid(uid);
            setActiveModule('DASHBOARD');
            setShowBackButton(false);
          }} />;
        }
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} />;
      default:
        return <MobileDashboardView userId={currentUserId} userName={userName} stats={stats} isLeader={isLeader} setSimulationUid={setSimulationUid} />;
    }
  };

  const getModuleTitle = (module: MobileModule): string => {
    const titles = {
      'DASHBOARD': 'Dashboard',
      'FACT_FINDING': 'Fact Finding',
      'WHITE_SPACE': 'White Space',
      'MONDAY_PLANNING': 'Monday Planning',
      'FRIDAY_SYNTHESIS': 'Friday Synthesis',
      'TWIW': 'The Week That Was',
      'TEAM': 'Team Governance'
    };
    return titles[module] || 'Dashboard';
  };

  const navItems = [
    { id: 'DASHBOARD' as MobileModule, label: 'Home', icon: LayoutDashboard },
    { id: 'FACT_FINDING' as MobileModule, label: 'Fact Finding', icon: FileSearch },
    { id: 'WHITE_SPACE' as MobileModule, label: 'White Space', icon: LayoutGrid },
    { id: 'MONDAY_PLANNING' as MobileModule, label: 'Monday Plan', icon: Target },
    { id: 'FRIDAY_SYNTHESIS' as MobileModule, label: 'Friday Report', icon: Send },
    { id: 'TWIW' as MobileModule, label: 'TWIW', icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F8] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-sm w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton && activeModule !== 'DASHBOARD' ? (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            ) : (
              <Compass className="w-5 h-5 text-primary" />
            )}
            <span className="font-bold text-sm text-primary">
              {showBackButton ? getModuleTitle(activeModule) : 'BDM Compass'}
            </span>
            <Badge variant="outline" className="text-[8px] font-black uppercase ml-1">
              {showBackButton ? 'Mobile' : 'Mobile'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-600">
              Week {currentWeek.split('-')[1]}
            </span>
            <button
              onClick={handleSignOut}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Simulation Banner */}
      {simulationUid && isLeader && (
        <div className="bg-amber-100 px-4 py-2 flex items-center justify-between border-b border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            <span>Simulating: {currentUserId}</span>
          </div>
          <button
            onClick={() => {
              setSimulationUid(null);
              setActiveModule('TEAM');
              setShowBackButton(true);
            }}
            className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-900 bg-amber-200/50 px-2 py-1 rounded-md"
          >
            <XCircle className="w-3 h-3" /> Exit
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <ScrollArea key={activeModule} className="h-full">
          <div className="p-4">
            {renderModule()}
          </div>
        </ScrollArea>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-50 shadow-lg">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveModule(item.id);
                  if (item.id !== 'DASHBOARD') {
                    setShowBackButton(true);
                  } else {
                    setShowBackButton(false);
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-primary/10' : ''}`} />
                <span className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${
                  isActive ? 'text-primary' : 'text-slate-400'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// Mobile Dashboard Overview Component
function MobileDashboardView({ userId, userName, stats, isLeader, setSimulationUid }: { userId: string; userName: string; stats: any; isLeader: boolean; setSimulationUid?: (uid: string) => void }) {
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
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Welcome Card */}
      {isLeader ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="w-full text-left bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden active:scale-[0.98] transition-transform">
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
                    <span className="text-[10px] opacity-70">Mobile View</span>
                  </div>
                </div>
                <div className="bg-white/20 p-2 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 py-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle>Select User to Simulate</SheetTitle>
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
                    className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {u.name?.charAt(0) || u.email?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{u.name || 'Unnamed User'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      ) : (
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium opacity-80">Welcome back</p>
              <h2 className="text-lg font-black mt-0.5">{displayName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-white/20 text-white border-none text-[9px] font-black">
                  Week {getCurrentWeek().split('-')[1]}
                </Badge>
                <span className="text-[10px] opacity-70">•</span>
                <span className="text-[10px] opacity-70">Mobile View</span>
              </div>
            </div>
            <div className="bg-white/20 p-2 rounded-xl">
              <User className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <Sheet open={pipelineSheetOpen} onOpenChange={setPipelineSheetOpen}>
          <SheetTrigger asChild>
            <button className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-left hover:border-primary/30 transition-all active:scale-[0.98]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pipeline</p>
                  <p className="text-lg font-black text-primary mt-0.5">{formatEAV(stats.totalPipeline)}</p>
                  <p className="text-[10px] font-bold text-slate-500">{stats.opportunityCount} opportunities</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-2" />
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 py-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle>Pipeline Opportunities</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full px-6 pb-12">
              <div className="space-y-2">
                {stats.oppRecords?.map((opp: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                    <div className="w-full">
                      <p className="text-sm font-bold text-slate-800">{opp.pipeline || opp.accountMasterName || 'Unnamed Deal'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{opp.stage || 'Discovery'} • {opp.userName || userId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-primary">{formatEAV(opp.value || 0)}</p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase">
                        {opp.probability || 0}%
                      </Badge>
                    </div>
                  </div>
                ))}
                {!stats.oppRecords?.length && (
                  <p className="text-sm text-slate-500 text-center py-4">No active opportunities.</p>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <Sheet open={revenueSheetOpen} onOpenChange={setRevenueSheetOpen}>
          <SheetTrigger asChild>
            <button className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-left hover:border-emerald-500/30 transition-all active:scale-[0.98]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Revenue</p>
                  <p className="text-lg font-black text-emerald-600 mt-0.5">{formatEAV(stats.revenueYTD)}</p>
                  <p className="text-[10px] font-bold text-slate-500">Target: {formatEAV(stats.target)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-2" />
              </div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 py-6">
            <SheetHeader className="px-6 mb-4">
              <SheetTitle>Customer Revenue</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full px-6 pb-12">
              <div className="space-y-2">
                {stats.custRecords?.sort((a: any, b: any) => (Number(b.currentRevenue) || 0) - (Number(a.currentRevenue) || 0)).map((cust: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                    <div className="w-full">
                      <p className="text-sm font-bold text-slate-800">{cust.accountMasterName || cust.pipeline || 'Unnamed Account'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{cust.userName || userId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-emerald-600">{formatEAV(cust.currentRevenue || 0)}</p>
                      <span className="text-[10px] font-medium text-slate-400">YTD Revenue</span>
                    </div>
                  </div>
                ))}
                {!stats.custRecords?.length && (
                  <p className="text-sm text-slate-500 text-center py-4">No customer revenue recorded.</p>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Top Deals */}
      {stats.topDeals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              Top Opportunities
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.topDeals.map((deal: any, idx: number) => (
              <div key={idx} className="p-4 flex flex-col gap-2">
                <div className="w-full">
                  <p className="text-sm font-bold text-slate-800 truncate">{deal.pipeline}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{deal.stage || 'Discovery'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-primary">{formatEAV(deal.value || 0)}</p>
                  <Badge variant="outline" className="text-[8px] font-black uppercase">
                    {deal.probability || 0}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 gap-3">
        <QuickActionCard
          title="Fact Finding"
          description="Log discovery"
          icon={FileSearch}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('switch-view', {
              detail: { view: 'FACT_FINDING' }
            }));
          }}
        />
        <QuickActionCard
          title="White Space"
          description="Analyze expansion"
          icon={LayoutGrid}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('switch-view', {
              detail: { view: 'WHITE_SPACE' }
            }));
          }}
        />
        <QuickActionCard
          title="Monday Plan"
          description="Set weekly goals"
          icon={Target}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('switch-view', {
              detail: { view: 'MONDAY_PLANNING' }
            }));
          }}
        />
        <QuickActionCard
          title="Friday Report"
          description="Submit synthesis"
          icon={Send}
          onClick={() => {
            window.dispatchEvent(new CustomEvent('switch-view', {
              detail: { view: 'FRIDAY_SYNTHESIS' }
            }));
          }}
        />
        {isLeader && (
          <QuickActionCard
            title="Team Governance"
            description="Simulate users"
            icon={Users}
            onClick={() => {
              window.dispatchEvent(new CustomEvent('switch-view', {
                detail: { view: 'TEAM' }
              }));
            }}
          />
        )}
      </div>
    </div>
  );
}

function QuickActionCard({ 
  title, 
  description, 
  icon: Icon, 
  onClick 
}: { 
  title: string; 
  description: string; 
  icon: any; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-accent/30 hover:shadow-md transition-all text-left group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-[10px] font-medium text-slate-400">{description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}
