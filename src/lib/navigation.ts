import { LucideIcon, LayoutDashboard, Navigation, Clock, CalendarCheck, Send, FileSearch, LayoutGrid, PhoneCall, ClipboardList, Archive, BookOpen, Coins, AlertCircle, Shield, Database, Settings, Star, Sparkles, Map, Users, Upload, Megaphone } from 'lucide-react';

export type DashboardView =
  | 'DASHBOARD' | 'CALL_PLANNING' | 'ALL_CALL_PLANNING' | 'WHITE_SPACE' 
  | 'WHITESPACE_HISTORY' | 'STRATEGIC_ARCHIVE' | 'BRIEFS' | 'TEAM_GOALS' | 'STRATEGY' 
  | 'TEAM' | 'GM_REVIEW' | 'UPLOAD' | 'ARCHIVE' | 'SETTINGS' | 'REPORTS' | 'DATA_EXPLORER' 
  | 'FACT_FINDING' | 'OPS_REPORT' | 'OPS_REVIEW' | 'TWIW' | 'DEMO_DASH' | 'BROADCAST' 
  | 'FRIDAY_FW' | 'PLAYBOOK' | 'ACTUAL_SPEND' | 'STRATEGIC_REPOSITORY' | 'SUCCESS_PLANS' 
  | 'MANAGE_TIME' | 'AM_BD' | 'CANVASSING' | 'DATA_HEALTH';

export type UserRole = 'BDM' | 'ACCOUNT_MANAGER' | 'LEADER' | 'GM' | 'ADMIN' | 'GUEST';

export interface NavItem {
  view: DashboardView;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  guestAllowed?: boolean;
  roles?: UserRole[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAVIGATION_REGISTRY: NavGroup[] = [
  {
    id: 'core',
    label: 'Core Workflows',
    items: [
      { view: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, guestAllowed: true },
      { view: 'TWIW', label: 'TWTW', icon: CalendarCheck, guestAllowed: true },
      { view: 'FRIDAY_FW', label: 'Friday FW', icon: Send },
      { view: 'MANAGE_TIME', label: 'Manage Time', icon: Clock },
      { view: 'CALL_PLANNING', label: 'Call Plans', icon: PhoneCall },
    ]
  },
  {
    id: 'field',
    label: 'Field & Discovery',
    items: [
      { view: 'CANVASSING', label: 'Canvassing', icon: Navigation },
      { view: 'FACT_FINDING', label: 'Fact Finding', icon: FileSearch },
      { view: 'WHITE_SPACE', label: 'White Space', icon: LayoutGrid, guestAllowed: true },
      { view: 'ACTUAL_SPEND', label: 'Actual Spend', icon: Coins },
    ]
  },
  {
    id: 'strategy',
    label: 'Strategy & Playbooks',
    items: [
      { view: 'SUCCESS_PLANS', label: 'Success Plans', icon: ClipboardList },
      { view: 'PLAYBOOK', label: 'Playbooks', icon: BookOpen },
      { view: 'STRATEGIC_ARCHIVE', label: 'Strategic Archive', icon: Archive },
    ]
  },
  {
    id: 'reporting',
    label: 'Reporting',
    items: [
      { view: 'ARCHIVE', label: 'Weekly Snapshot', icon: Archive },
      { view: 'OPS_REPORT', label: 'Ops Report', icon: AlertCircle, guestAllowed: true },
    ]
  },
  {
    id: 'admin_leadership',
    label: 'Leadership & Admin',
    items: [
      { view: 'TEAM', label: 'Team', icon: Users, adminOnly: true },
      { view: 'GM_REVIEW', label: 'GM Command Hub', icon: Shield, adminOnly: true },
      { view: 'AM_BD', label: 'AM/BD Notes Admin', icon: ClipboardList, adminOnly: true },
      { view: 'TEAM_GOALS', label: 'Team Goals', icon: Star, adminOnly: true },
      { view: 'STRATEGY', label: 'Strategy', icon: Map, adminOnly: true },
      { view: 'STRATEGIC_REPOSITORY', label: 'Strategic Repo', icon: Sparkles, adminOnly: true },
      { view: 'BRIEFS', label: 'Briefs', icon: Sparkles, adminOnly: true },
      { view: 'OPS_REVIEW', label: 'Ops Review Ledger', icon: Shield, adminOnly: true },
    ]
  },
  {
    id: 'admin_system',
    label: 'System Admin',
    items: [
      { view: 'DATA_HEALTH', label: 'Data Health', icon: Shield, adminOnly: true },
      { view: 'DATA_EXPLORER', label: 'Data Explorer', icon: Database, adminOnly: true },
      { view: 'UPLOAD', label: 'CRM Import', icon: Upload, adminOnly: true },
      { view: 'BROADCAST', label: 'Broadcast Admin', icon: Megaphone, adminOnly: true },
      { view: 'SETTINGS', label: 'Settings', icon: Settings },
    ]
  }
];

export function getNavigationForUser(role: UserRole | undefined, isLeader: boolean): NavGroup[] {
  if (!role) return [];

  return NAVIGATION_REGISTRY.map(group => {
    const filteredItems = group.items.filter(item => {
      if (role === 'GUEST') return item.guestAllowed;
      if (item.adminOnly && !isLeader) return false;
      if (item.roles && !item.roles.includes(role)) return false;
      return true;
    });

    return {
      ...group,
      items: filteredItems
    };
  }).filter(group => group.items.length > 0);
}
