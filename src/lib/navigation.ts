import { LucideIcon, LayoutDashboard, Navigation, Clock, CalendarCheck, Send, FileSearch, LayoutGrid, PhoneCall, ClipboardList, Archive, BookOpen, Coins, AlertCircle, Shield, Database, Settings, Star, Sparkles, Map, Users, Upload, Megaphone, Factory, Fuel, KeyRound, Presentation } from 'lucide-react';

export type DashboardView =
  | 'DASHBOARD' | 'CALL_PLANNING' | 'ALL_CALL_PLANNING' | 'WHITE_SPACE' 
  | 'WHITESPACE_HISTORY' | 'STRATEGIC_ARCHIVE' | 'BRIEFS' | 'TEAM_GOALS' | 'ACCESS' | 'STRATEGY' 
  | 'TEAM' | 'GM_REVIEW' | 'UPLOAD' | 'ARCHIVE' | 'SETTINGS' | 'REPORTS' | 'DATA_EXPLORER' 
  | 'FACT_FINDING' | 'OPS_REPORT' | 'OPS_REVIEW' | 'TWIW' | 'DEMO_DASH' | 'BROADCAST' 
  | 'FRIDAY_FW' | 'NWA_MEETING' | 'PLAYBOOK' | 'ACTUAL_SPEND' | 'STRATEGIC_REPOSITORY' | 'SUCCESS_PLANS' 
  | 'MANAGE_TIME' | 'AM_BD' | 'CANVASSING' | 'DATA_HEALTH' | 'OVERVIEW' | 'ALIGN_CUSTOMER' | 'FF_ADMIN' | 'BD_AM_REVIEW' | 'VERTICALS' | 'FUEL_SURCHARGES';

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

/**
 * Navigation is grouped by what the user is trying to do: Today / Pipeline / Insights / Library / Admin.
 * Role access is decided per item (adminOnly / guestAllowed / roles) in getNavigationForUser, so regrouping
 * never changes who can see what.
 */
export const NAVIGATION_REGISTRY: NavGroup[] = [
  {
    id: 'today',
    label: 'Today',
    items: [
      { view: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, guestAllowed: true },
      { view: 'TWIW', label: 'TWTW', icon: CalendarCheck, guestAllowed: true },
      { view: 'FRIDAY_FW', label: 'NWA', icon: Send },
      { view: 'NWA_MEETING', label: 'Team meeting', icon: Presentation, adminOnly: true },
      { view: 'MANAGE_TIME', label: 'Manage Time', icon: Clock },
      { view: 'CALL_PLANNING', label: 'Call Plans', icon: PhoneCall },
    ]
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    items: [
      { view: 'WHITE_SPACE', label: 'White Space', icon: LayoutGrid, guestAllowed: true },
      { view: 'SUCCESS_PLANS', label: 'Success Plans', icon: ClipboardList },
      { view: 'FACT_FINDING', label: 'Fact Finding', icon: FileSearch },
      { view: 'CANVASSING', label: 'Canvassing', icon: Navigation },
      { view: 'VERTICALS', label: 'Verticals', icon: Factory },
      { view: 'FUEL_SURCHARGES', label: 'Fuel Surcharges', icon: Fuel },
    ]
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { view: 'BD_AM_REVIEW', label: 'BD/AM Review', icon: Users, guestAllowed: true },
      { view: 'ACTUAL_SPEND', label: 'Actual Spend', icon: Coins },
      { view: 'ARCHIVE', label: 'Weekly Snapshot', icon: Archive },
      { view: 'OPS_REPORT', label: 'Ops Report', icon: AlertCircle, guestAllowed: true },
      { view: 'GM_REVIEW', label: 'GM Command Hub', icon: Shield, adminOnly: true },
      { view: 'OVERVIEW', label: 'Executive Overview', icon: LayoutDashboard, adminOnly: true },
      { view: 'DATA_HEALTH', label: 'Data Health', icon: Shield, adminOnly: true },
    ]
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      { view: 'PLAYBOOK', label: 'Playbooks', icon: BookOpen },
      { view: 'STRATEGIC_ARCHIVE', label: 'Strategic Archive', icon: Archive },
      { view: 'STRATEGIC_REPOSITORY', label: 'Strategic Repo', icon: Sparkles, adminOnly: true },
      { view: 'BRIEFS', label: 'Briefs', icon: Sparkles, adminOnly: true },
    ]
  },
  {
    id: 'admin',
    label: 'Admin & Settings',
    items: [
      { view: 'TEAM', label: 'Team', icon: Users, adminOnly: true },
      { view: 'ACCESS', label: 'Access', icon: KeyRound, adminOnly: true },
      { view: 'TEAM_GOALS', label: 'Team Goals', icon: Star, adminOnly: true },
      { view: 'STRATEGY', label: 'Strategy', icon: Map, adminOnly: true },
      { view: 'AM_BD', label: 'AM/BD Notes Admin', icon: ClipboardList, adminOnly: true },
      { view: 'FF_ADMIN', label: 'FF Admin', icon: FileSearch, adminOnly: true },
      { view: 'OPS_REVIEW', label: 'Ops Review Ledger', icon: Shield, adminOnly: true },
      { view: 'DATA_EXPLORER', label: 'Data Explorer', icon: Database, adminOnly: true },
      { view: 'UPLOAD', label: 'CRM Import', icon: Upload, adminOnly: true },
      { view: 'BROADCAST', label: 'Broadcast Admin', icon: Megaphone, adminOnly: true },
      { view: 'ALIGN_CUSTOMER', label: 'Align Customer', icon: Database, adminOnly: true },
      { view: 'SETTINGS', label: 'Settings', icon: Settings },
    ]
  }
];

/** Groups that start collapsed in the desktop sidebar (the group holding the active view is always opened). */
export const DEFAULT_COLLAPSED_GROUPS: Record<string, boolean> = {
  insights: true,
  library: true,
  admin: true,
};

/** Find the group id that contains a view. */
export function findGroupIdForView(view: DashboardView): string | undefined {
  return NAVIGATION_REGISTRY.find(g => g.items.some(i => i.view === view))?.id;
}

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
