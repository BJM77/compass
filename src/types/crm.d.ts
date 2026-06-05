export type UserRole = 'LEADER' | 'BDM' | 'ACCOUNT_MANAGER' | 'GM';
export type Territory = 'METRO_NORTH' | 'METRO_SOUTH' | 'WESTERN_TRADE_COAST' | 'REGIONAL' | 'FLEX';

export interface UserProfile {
  uid: string;
  name: string;
  role: UserRole;
  territory?: Territory;
  zones?: string[];
  specialisation?: string;
  salesforceUserId?: string;
  planType?: string;
  assignedAgents?: string[];
  isMock?: boolean;
  target?: number;
  email?: string;
}

export interface PipelineReview {
  id: string;
  userId: string;
  userName?: string;
  week: string;
  accountMasterCode?: string;
  salesforceId?: string;
  pipeline: string; // Account Name or Opportunity Name
  opportunityName?: string;
  stage?: string;
  value?: number;
  probability?: number;
  expectedDate?: string;
  businessUnit?: string;
  currentRevenue?: number;
  lastYearRevenue?: number;
  lastInvoiceDate?: string;
  lastActivity?: string;
  creditHold?: string;
  closedWonValue?: number;
  isBareAccount?: boolean;
  daysInStage?: number;
  rolloverCount?: number;
  barriers?: string;
  lastBarrierText?: string;
  starred?: boolean;
  notes?: string;
  createdAt?: any;
}

export interface WeeklyProgress {
  id: string;
  userId: string;
  week: string;
  crmCalls?: number;
  crmApps?: number;
  calls?: number;
  apps?: number;
  proposals?: number;
  deals?: number;
  createdAt?: any;
}

export interface CustomDashboard {
  id: string;
  name: string;
  visibleTo: string[];
}

export interface ReportWidget {
  id: string;
  dashboardId: string;
  name: string;
  dataSource: string;
  field: string;
  calculation: string;
  type: string;
}
