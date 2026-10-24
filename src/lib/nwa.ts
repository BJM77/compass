/**
 * TWA (This Week's Activities, formerly "NWA"): the Monday team meeting pack.
 * Internal names (nwa*, NWA_*, weeklyCommitments, the FRIDAY_FW view key) are unchanged so
 * stored data needs no migration; only user-facing text says TWA.
 *
 * Pure logic only (no React / Firebase imports) so it can be unit tested.
 *
 * Storage: weeklyCommitments/{uid}_{planWeek}, the same doc key the old Friday
 * FW used. New fields are additive; legacy mirrors (actionPlan, roadblocks,
 * supportNeeded, kpiTargets with the legacy keys) keep the TWTW prefill,
 * GM review, demo dash and weekly archive working.
 *
 * Timing (Australia/Perth): the plan for week W is due Sunday 8pm before W
 * starts, reviewed in the 45-minute Monday meeting, and overdue after that.
 */
import { perthTime, perthParts } from './time-mgmt';

export const NWA_FORM_VERSION = 'NWA_V2';
export const NWA_MEETING_MINUTES = 45;
export const STALL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Agenda ──────────────────────────────────────────────────────────────────
export type NwaSectionId =
  | 'wins' | 'shoutout' | 'appointments' | 'pipeline' | 'accounts' | 'kpis' | 'priorities' | 'challenges' | 'updates' | 'commitments';

/**
 * Who fills a section in:
 *  required: reps (BDM / AM) must complete it to submit, and it counts towards progress.
 *  optional: reps may add to it; never blocks submit.
 *  auto:     filled from CRM uploads or the rep's TWTW (read-only, no duplicate entry).
 *  leader:   maintained by the sales leader (targets, business updates).
 */
export type NwaSectionEntry = 'required' | 'optional' | 'auto' | 'leader';

export interface NwaSectionDef {
  id: NwaSectionId;
  step: number;
  title: string;
  minutes: number;
  description: string;
  entry: NwaSectionEntry;
}

export const NWA_ENTRY_LABEL: Record<NwaSectionEntry, string> = {
  required: 'Required',
  optional: 'Optional',
  auto: 'Auto-filled',
  leader: 'Leader',
};

export const NWA_SECTIONS: NwaSectionDef[] = [
  { id: 'wins', step: 1, title: 'Wins since last week', minutes: 4, entry: 'auto', description: 'From your TWTW for last week: customer wins, closed opportunities, positive feedback and team recognition.' },
  { id: 'shoutout', step: 2, title: 'Shout out', minutes: 2, entry: 'required', description: 'Call out a teammate: who, and what for.' },
  { id: 'appointments', step: 3, title: 'Upcoming appointments', minutes: 8, entry: 'auto', description: 'Appointments in Salesforce dated this week (from the latest upload).' },
  { id: 'pipeline', step: 4, title: 'Pipeline and opportunities review', minutes: 9, entry: 'auto', description: 'Deals progressing, stalled deals, new opportunities and accounts handed over, suggested from CRM.' },
  { id: 'kpis', step: 5, title: 'Weekly goals and KPIs', minutes: 5, entry: 'leader', description: "Last week's actuals from CRM against target, and this week's targets set by your leader." },
  { id: 'priorities', step: 6, title: 'Top 3 priorities', minutes: 5, entry: 'required', description: 'The three things that matter most this week.' },
  { id: 'challenges', step: 7, title: 'Challenges and roadblocks', minutes: 5, entry: 'optional', description: 'Optional: what is slowing progress and what you need.' },
  { id: 'updates', step: 8, title: 'Business updates', minutes: 4, entry: 'leader', description: 'Pricing, product and competitor news from the leadership team.' },
  { id: 'commitments', step: 9, title: 'Commitments before next meeting', minutes: 3, entry: 'required', description: 'Clear actions with an owner and a due date.' },
];

const ACCOUNTS_DESCRIPTION = 'At-risk and declining accounts, revenue at risk, renewals and rate reviews, growth in existing accounts and account handovers.';

const bySection = (id: NwaSectionId) => NWA_SECTIONS.find(s => s.id === id)!;

/** Account managers get an "Account health and growth" step; the 45 minutes are rebalanced from appointments and pipeline. */
export const NWA_SECTIONS_AM: NwaSectionDef[] = ([
  bySection('wins'),
  bySection('shoutout'),
  { ...bySection('appointments'), minutes: 6 },
  { ...bySection('pipeline'), minutes: 4 },
  { id: 'accounts', step: 0, title: 'Account health and growth', minutes: 7, entry: 'optional', description: ACCOUNTS_DESCRIPTION },
  ...NWA_SECTIONS.slice(NWA_SECTIONS.findIndex(s => s.id === 'kpis')),
] as NwaSectionDef[]).map((s, i) => ({ ...s, step: i + 1 }));

/** The only sections a rep (BDM or AM) has to complete. Progress, submit validation and due state count these. */
export const NWA_REP_REQUIRED: NwaSectionId[] = NWA_SECTIONS.filter(s => s.entry === 'required').map(s => s.id);

/** BDMs can add account items too, but the section is optional and outside the timed agenda. */
export const NWA_ACCOUNTS_OPTIONAL: NwaSectionDef = {
  id: 'accounts', step: 0, title: 'Account health and growth (optional)', minutes: 0, entry: 'optional', description: ACCOUNTS_DESCRIPTION,
};

/** ACCOUNT_MANAGER and AM roles (the role field only). */
export function isAmRole(role: string | undefined | null): boolean {
  const r = String(role || '').toUpperCase();
  return r === 'ACCOUNT_MANAGER' || r === 'AM';
}

export function nwaSectionsFor(role: string | undefined | null): NwaSectionDef[] {
  return isAmRole(role) ? NWA_SECTIONS_AM : NWA_SECTIONS;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type NwaStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'REVIEWED_BY_ADMIN';
export type CommitmentOutcome = 'done' | 'partly' | 'not_done';
export type PipelineKey = 'progressing' | 'stalled' | 'created' | 'handedOver';
export type KpiKey = 'calls' | 'appointments' | 'proposals' | 'deals' | 'revenue' | 'accountReviews' | 'revenueRetained' | 'renewals';

export interface NwaWins {
  customerWins: string;
  closedOpportunities: string;
  positiveFeedback: string;
  teamRecognition: string;
  shoutOut: { teammate: string; reason: string };
}

export interface NwaAppointment {
  id: string;
  customer: string;
  date: string; // yyyy-mm-dd
  meetingType: string;
  purpose: string;
  desiredOutcome: string;
  supportRequired: string;
  /** crm = an APP activity from the Salesforce upload (read-only); callPlan/manual = entered on older versions. */
  source?: 'callPlan' | 'manual' | 'crm';
  crmId?: string;
}

export interface NwaDealRow {
  id: string;
  account: string;
  value: number;
  nextStep: string;
  nextStepDate: string; // yyyy-mm-dd
  note: string; // stalled reason / handed over to / notes
  daysWithoutMovement?: number | null;
  autoFlagged?: boolean;
  crmId?: string;
}

/**
 * Legacy key names are kept so TWTW, demo dash and the archive read targets unchanged.
 * revenueTarget is "New revenue" for BDMs and "Growth revenue" for account managers.
 */
export interface NwaKpiTargets {
  /**
   * Legacy only: Calls was removed from the NWA weekly goals and KPIs.
   * Old docs may still carry it; it is preserved on read but never shown or defaulted.
   */
  callsToMake?: number;
  appointmentsToSet: number;
  proposalsToSend: number;
  dealsToClose: number;
  revenueTarget: number;
  /** Account manager targets. */
  accountReviewsTarget: number;
  revenueRetainedTarget: number;
  renewalsTarget: number;
}

// ─── Account management (AM section) ──────────────────────────────────────
export type RiskStatus = 'open' | 'saved' | 'lost';
export type RenewalType = 'renewal' | 'rate_review';
export type RenewalStatus = 'not_started' | 'in_progress' | 'agreed' | 'lost';
export type HandoverStatus = 'proposed' | 'in_progress' | 'complete';

/** An at-risk or declining-spend account. */
export interface NwaAtRiskRow {
  id: string;
  accountId: string;
  account: string;
  reason: string;
  revenueAtRisk: number;
  action: string;
  status: RiskStatus;
  /** CRM signal text when prefilled (e.g. "YTD down 22% on last FY"). */
  signal?: string;
  source: 'crm' | 'manual';
}

export interface NwaRenewalRow {
  id: string;
  accountId: string;
  account: string;
  type: RenewalType;
  dueDate: string; // yyyy-mm-dd
  value: number;
  status: RenewalStatus;
  note: string;
}

export interface NwaGrowthRow {
  id: string;
  accountId: string;
  account: string;
  opportunity: string;
  value: number;
  nextStep: string;
  nextStepDate: string; // yyyy-mm-dd
}

/** An account moving between an AM and a BDM (or any two team members). */
export interface NwaHandover {
  id: string;
  accountId: string;
  account: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  status: HandoverStatus;
  reason: string;
  date: string; // yyyy-mm-dd
}

export interface NwaAccountMgmt {
  atRisk: NwaAtRiskRow[];
  renewals: NwaRenewalRow[];
  growth: NwaGrowthRow[];
  handovers: NwaHandover[];
}

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = { open: 'Open', saved: 'Saved', lost: 'Lost' };
export const RENEWAL_TYPE_LABEL: Record<RenewalType, string> = { renewal: 'Renewal', rate_review: 'Rate review' };
export const RENEWAL_STATUS_LABEL: Record<RenewalStatus, string> = { not_started: 'Not started', in_progress: 'In progress', agreed: 'Agreed', lost: 'Lost' };
export const HANDOVER_STATUS_LABEL: Record<HandoverStatus, string> = { proposed: 'Proposed', in_progress: 'In progress', complete: 'Complete' };

export interface NwaCommitment {
  id: string;
  text: string;
  owner: string;
  dueDate: string; // yyyy-mm-dd
}

export interface NwaCommitmentReview extends NwaCommitment {
  outcome: CommitmentOutcome | null;
  note: string;
}

export interface NwaFollowThrough {
  score: number | null; // 0–100, null when nothing to review
  done: number;
  partly: number;
  notDone: number;
  reviewed: number;
  total: number;
}

export interface NwaPlan {
  wins: NwaWins;
  appointments: NwaAppointment[];
  pipeline: Record<PipelineKey, NwaDealRow[]>;
  kpiTargets: NwaKpiTargets;
  keyFocusMetrics: string;
  individualCommitment: string;
  topPriorities: [string, string, string];
  challenges: { slowingProgress: string; customerIssues: string; internalIssues: string; resourcesRequired: string };
  commitments: NwaCommitment[];
  commitmentReview: NwaCommitmentReview[];
  accounts: NwaAccountMgmt;
}

export interface NwaBusinessUpdates {
  pricingChanges: string;
  productUpdates: string;
  competitorActivity: string;
  other: string;
  updatedBy?: string;
  updatedAt?: any;
}

export interface KpiDef { key: KpiKey; label: string; target: keyof NwaKpiTargets; currency?: boolean }

/** BDM KPIs: activity and new business. */
export const BDM_KPI_DEFS: KpiDef[] = [
  { key: 'appointments', label: 'New appointments', target: 'appointmentsToSet' },
  { key: 'proposals', label: 'Proposals', target: 'proposalsToSend' },
  { key: 'deals', label: 'Deals closed', target: 'dealsToClose' },
  { key: 'revenue', label: 'New revenue', target: 'revenueTarget', currency: true },
];

/** Account manager KPIs: reviews, retention and renewals, plus growth in existing accounts. */
export const AM_KPI_DEFS: KpiDef[] = [
  { key: 'accountReviews', label: 'Account reviews', target: 'accountReviewsTarget' },
  { key: 'renewals', label: 'Renewals and rate reviews', target: 'renewalsTarget' },
  { key: 'revenueRetained', label: 'Revenue retained', target: 'revenueRetainedTarget', currency: true },
  { key: 'revenue', label: 'Growth revenue', target: 'revenueTarget', currency: true },
];

/** @deprecated use kpiDefsFor(role). Kept for older imports. */
export const KPI_DEFS = BDM_KPI_DEFS;

export function kpiDefsFor(role: string | undefined | null): KpiDef[] {
  return isAmRole(role) ? AM_KPI_DEFS : BDM_KPI_DEFS;
}

export const PIPELINE_GROUPS: { key: PipelineKey; title: string; hint: string; notePlaceholder: string }[] = [
  { key: 'progressing', title: 'Key deals progressing', hint: 'Value, next step and date.', notePlaceholder: 'Notes' },
  { key: 'stalled', title: 'Stalled deals', hint: `Deals with no movement for ${STALL_DAYS}+ days are flagged automatically.`, notePlaceholder: 'Why has it stalled?' },
  { key: 'created', title: 'New opportunities created', hint: 'Opportunities opened since the last meeting.', notePlaceholder: 'Notes' },
  { key: 'handedOver', title: 'Accounts handed over', hint: 'Who it went to and why.', notePlaceholder: 'Handed over to' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
let idCounter = 0;
export function nwaId(prefix = 'n'): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Fallback targets only: person and team targets (resolveKpiTargets) take precedence. */
export function defaultKpiTargets(role: string): NwaKpiTargets {
  const isBdm = (role || '').toUpperCase() === 'BDM';
  const am = isAmRole(role);
  return {
    appointmentsToSet: isBdm ? 15 : 10,
    proposalsToSend: 8,
    dealsToClose: 3,
    revenueTarget: 250000,
    accountReviewsTarget: am ? 8 : 0,
    revenueRetainedTarget: am ? 50000 : 0,
    renewalsTarget: am ? 2 : 0,
  };
}

export type KpiTargetSource = 'person' | 'team' | 'annualTarget' | 'default';

export const KPI_TARGET_KEYS: (keyof NwaKpiTargets)[] = [
  'appointmentsToSet', 'proposalsToSend', 'dealsToClose', 'revenueTarget',
  'accountReviewsTarget', 'revenueRetainedTarget', 'renewalsTarget',
];

/** Team targets are stored per role group in appSettings/nwaKpiTargets.byRole. */
export function kpiRoleGroup(role: string | undefined | null): 'AM' | 'BDM' {
  return isAmRole(role) ? 'AM' : 'BDM';
}

/**
 * Weekly KPI targets, in order of precedence:
 *  1. users/{uid}.nwaKpiTargets (set for one person)
 *  2. appSettings/nwaKpiTargets.byRole[AM|BDM] (team targets, set by a leader from the NWA form)
 *  3. BDM new revenue only: annual target (bdmStats/{uid}.target, else users/{uid}.target) ÷ 52
 *  4. defaultKpiTargets(role)
 */
export function resolveKpiTargets(
  role: string,
  src: { userDoc?: any; teamTargets?: any; stats?: any } = {},
): { targets: NwaKpiTargets; source: Record<keyof NwaKpiTargets, KpiTargetSource> } {
  const defaults = defaultKpiTargets(role);
  const person = src.userDoc?.nwaKpiTargets || {};
  const team = src.teamTargets?.byRole?.[kpiRoleGroup(role)] || {};
  const annual = num(src.stats?.target) || num(src.userDoc?.target);
  const has = (o: any, k: string) => o && o[k] !== undefined && o[k] !== null && o[k] !== '' && Number.isFinite(Number(o[k]));
  const targets = { ...defaults };
  const source = {} as Record<keyof NwaKpiTargets, KpiTargetSource>;
  KPI_TARGET_KEYS.forEach(k => {
    if (has(person, k)) { targets[k] = num(person[k]); source[k] = 'person'; }
    else if (has(team, k)) { targets[k] = num(team[k]); source[k] = 'team'; }
    else if (k === 'revenueTarget' && !isAmRole(role) && annual > 0) { targets[k] = Math.round(annual / 52); source[k] = 'annualTarget'; }
    else source[k] = 'default';
  });
  return { targets, source };
}

export function emptyWins(): NwaWins {
  return { customerWins: '', closedOpportunities: '', positiveFeedback: '', teamRecognition: '', shoutOut: { teammate: '', reason: '' } };
}

export function emptyNwaPlan(role: string): NwaPlan {
  return {
    wins: emptyWins(),
    appointments: [],
    pipeline: { progressing: [], stalled: [], created: [], handedOver: [] },
    kpiTargets: defaultKpiTargets(role),
    keyFocusMetrics: '',
    individualCommitment: '',
    topPriorities: ['', '', ''],
    challenges: { slowingProgress: '', customerIssues: '', internalIssues: '', resourcesRequired: '' },
    commitments: [],
    commitmentReview: [],
    accounts: emptyAccountMgmt(),
  };
}

export function emptyAccountMgmt(): NwaAccountMgmt {
  return { atRisk: [], renewals: [], growth: [], handovers: [] };
}

export function emptyAtRiskRow(partial: Partial<NwaAtRiskRow> = {}): NwaAtRiskRow {
  return { id: nwaId('risk'), accountId: '', account: '', reason: '', revenueAtRisk: 0, action: '', status: 'open', source: 'manual', ...partial };
}

export function emptyRenewalRow(partial: Partial<NwaRenewalRow> = {}): NwaRenewalRow {
  return { id: nwaId('ren'), accountId: '', account: '', type: 'renewal', dueDate: '', value: 0, status: 'not_started', note: '', ...partial };
}

export function emptyGrowthRow(partial: Partial<NwaGrowthRow> = {}): NwaGrowthRow {
  return { id: nwaId('grow'), accountId: '', account: '', opportunity: '', value: 0, nextStep: '', nextStepDate: '', ...partial };
}

export function emptyHandover(partial: Partial<NwaHandover> = {}): NwaHandover {
  return { id: nwaId('ho'), accountId: '', account: '', fromUserId: '', fromName: '', toUserId: '', toName: '', status: 'proposed', reason: '', date: '', ...partial };
}

export function emptyDealRow(partial: Partial<NwaDealRow> = {}): NwaDealRow {
  return { id: nwaId('deal'), account: '', value: 0, nextStep: '', nextStepDate: '', note: '', ...partial };
}

/** Accepts ISO strings, dd/mm/yyyy, epoch ms, Date and Firestore Timestamps. */
export function parseLooseDate(v: any): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v?.toDate === 'function') {
    const d = v.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') {
    const s = v.trim();
    const au = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
    if (au) {
      const d = new Date(Date.UTC(+au[3], +au[2] - 1, +au[1], 4)); // midday Perth
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** yyyy-mm-dd in Perth time, or '' */
export function toDateInput(v: any): string {
  const d = parseLooseDate(v);
  if (!d) return '';
  const p = perthParts(d.getTime());
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// ─── Weeks, due date and overdue ────────────────────────────────────────────
/** Monday (Perth calendar date) of a financial-year week key "YYYY-WW". Mirrors getWeekForDate(). */
export function weekStartDate(weekKey: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(weekKey || '');
  if (!m) return null;
  const year = +m[1];
  const week = +m[2];
  const apr1 = Date.UTC(year, 3, 1);
  const wd = new Date(apr1).getUTCDay();
  const monday = apr1 - ((wd + 6) % 7) * DAY_MS + (week - 1) * 7 * DAY_MS;
  const d = new Date(monday);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** The NWA for planWeek is due Sunday 8pm Perth, the evening before the week starts. */
export function nwaDueAt(planWeek: string): number | null {
  const s = weekStartDate(planWeek);
  if (!s) return null;
  return perthTime(s.year, s.month, s.day - 1, 20, 0);
}

/** Monday 9am meeting start (used for labels). */
export function nwaMeetingAt(planWeek: string): number | null {
  const s = weekStartDate(planWeek);
  if (!s) return null;
  return perthTime(s.year, s.month, s.day, 9, 0);
}

export type NwaDueState = 'submitted' | 'open' | 'due_soon' | 'overdue';

export function isSubmittedStatus(status: string | undefined | null): boolean {
  return status === 'SUBMITTED' || status === 'REVIEWED_BY_ADMIN';
}

export function nwaDueState(planWeek: string, status: string | undefined | null, now = Date.now()): NwaDueState {
  if (isSubmittedStatus(status)) return 'submitted';
  const due = nwaDueAt(planWeek);
  if (due === null) return 'open';
  if (now >= due) return 'overdue';
  if (due - now <= DAY_MS) return 'due_soon';
  return 'open';
}

export const NWA_DUE_LABEL = 'Due Sunday 8pm';

// ─── Stalled deals ──────────────────────────────────────────────────────────
const CLOSED = /closed|lost|won/i;
export function isOpenDeal(deal: any): boolean {
  return !!deal && !deal.isBareAccount && !CLOSED.test(str(deal.stage));
}

/**
 * Days since a deal last moved. Uses daysInStage if the CRM import provides it,
 * otherwise the later of the last stage change / last activity dates. null when
 * the data can't tell us.
 */
export function daysWithoutMovement(deal: any, now = Date.now()): number | null {
  if (!deal) return null;
  const dates = [parseLooseDate(deal.lastSalesStageChangeDate), parseLooseDate(deal.lastActivity)].filter(Boolean) as Date[];
  const fromDates = dates.length ? Math.floor((now - Math.max(...dates.map(d => d.getTime()))) / DAY_MS) : null;
  const inStage = typeof deal.daysInStage === 'number' && Number.isFinite(deal.daysInStage) ? deal.daysInStage : null;
  if (fromDates !== null && inStage !== null) return Math.max(0, Math.min(fromDates, inStage));
  if (fromDates !== null) return Math.max(0, fromDates);
  return inStage;
}

export function isStalledDeal(deal: any, now = Date.now()): boolean {
  if (!isOpenDeal(deal)) return false;
  const d = daysWithoutMovement(deal, now);
  return d !== null && d >= STALL_DAYS;
}

function dealName(d: any): string {
  return str(d?.opportunityName) || str(d?.pipeline) || 'Unnamed deal';
}

export function dealToRow(d: any, now = Date.now()): NwaDealRow {
  const days = daysWithoutMovement(d, now);
  return emptyDealRow({
    id: nwaId('deal'),
    account: dealName(d),
    value: num(d?.value),
    nextStepDate: toDateInput(d?.expectedDate),
    daysWithoutMovement: days,
    autoFlagged: isStalledDeal(d, now),
    crmId: str(d?.id) || undefined,
  });
}

/** CRM suggestions for the pipeline section (the rep picks what to bring to the meeting). */
export function pipelineSuggestions(deals: any[], reviewWeek: string, now = Date.now()) {
  const open = (deals || []).filter(isOpenDeal);
  const stalled = open.filter(d => isStalledDeal(d, now)).sort((a, b) => num(b.value) - num(a.value));
  const moving = open.filter(d => !isStalledDeal(d, now)).sort((a, b) => num(b.value) - num(a.value));
  const created = open.filter(d => {
    const c = parseLooseDate(d.createdDate) || parseLooseDate(d.createdAt);
    if (c) return now - c.getTime() <= 7 * DAY_MS;
    return typeof d.age === 'number' && d.age <= 7;
  });
  const closedWon = (deals || []).filter(d => /closed won/i.test(str(d?.stage)) && (!d.week || d.week === reviewWeek));
  return { stalled, progressing: moving.slice(0, 8), created, closedWon };
}

/** Text lines for "Closed opportunities", pre-filled from CRM Closed Won deals. */
export function closedWonLines(closedWon: any[]): string {
  return (closedWon || [])
    .map(d => `${dealName(d)}${num(d.value) ? ` – $${Math.round(num(d.value)).toLocaleString('en-AU')}` : ''}`)
    .join('\n');
}

// ─── Activity actuals ──────────────────────────────────────────────────────
/**
 * Actuals for the KPI table. Account reviews = meetings held (account managers' meetings are reviews of
 * existing accounts). Renewals and revenue retained come from the plan's account section: renewals marked
 * agreed, plus at-risk accounts marked saved. Resolved rows are not carried into the next week, so each
 * counts once.
 */
export function computeActuals(input: { progress?: any; activity?: any[]; callPlanCount?: number; deals?: any[]; accounts?: NwaAccountMgmt | null }): Record<KpiKey, number> {
  const p = input.progress || {};
  const acts = input.activity || [];
  const sum = (f: (a: any) => number) => acts.reduce((s, a) => s + f(a), 0);
  const calls = Math.max(num(p.crmCalls) + num(p.calls), sum(a => num(a.calls) + num(a.crmCalls)));
  const appointments = Math.max(
    num(p.crmApps) + num(p.apps) + num(p.meetingsHeld),
    sum(a => num(a.apps) + num(a.crmApps) + num(a.meetingsHeld)),
    input.callPlanCount || 0,
  );
  const proposals = num(p.proposals) || sum(a => num(a.proposals));
  const won = (input.deals || []).filter(d => /closed won/i.test(str(d?.stage)));
  const deals = Math.max(num(p.deals) || sum(a => num(a.deals)), won.length);
  const revenue = won.reduce((s, d) => s + num(d.value), 0);
  const acc = input.accounts || emptyAccountMgmt();
  const agreed = acc.renewals.filter(r => r.status === 'agreed');
  const saved = acc.atRisk.filter(r => r.status === 'saved');
  const renewals = agreed.length;
  const revenueRetained = agreed.reduce((s, r) => s + num(r.value), 0) + saved.reduce((s, r) => s + num(r.revenueAtRisk), 0);
  return { calls, appointments, proposals, deals, revenue, accountReviews: appointments, renewals, revenueRetained };
}

// ─── Account health signals (CRM customer accounts) ─────────────────────────
/** YTD spend down this much on the same period last FY flags an account as declining. */
export const DECLINE_THRESHOLD = 0.15;
/** No invoice for this many days flags an account as at risk. */
export const NO_INVOICE_DAYS = 45;

export interface AccountOption { id: string; name: string }

export interface AccountSignal extends AccountOption {
  ytdThisFY: number;
  ytdLastFY: number;
  declinePct: number | null; // negative = down
  daysSinceInvoice: number | null;
  creditHold: boolean;
  revenueAtRisk: number;
  reasons: string[];
}

function accountIdOf(d: any): string {
  return str(d?.accountMasterCode) || str(d?.salesforceId) || str(d?.pipeline) || str(d?.id);
}

/**
 * At-risk / declining customer accounts from the CRM import (pipelineReviews rows with isBareAccount:
 * ytdRevenueThisFY vs ytdRevenueLastFY, lastInvoiceDate, creditHold). Revenue at risk is the YTD shortfall
 * against last FY (or last FY YTD when the account has stopped invoicing).
 */
export function accountSignals(deals: any[], now = Date.now()): AccountSignal[] {
  const out: AccountSignal[] = [];
  const seen = new Set<string>();
  for (const d of latestDeals((deals || []).filter(x => x?.isBareAccount))) {
    const id = accountIdOf(d);
    const name = str(d?.pipeline) || str(d?.accountName);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const thisFY = num(d.ytdRevenueThisFY ?? d.currentRevenue);
    const lastFY = num(d.ytdRevenueLastFY ?? d.lastYearRevenue);
    const declinePct = lastFY > 0 ? (thisFY - lastFY) / lastFY : null;
    const inv = parseLooseDate(d.lastInvoiceDate);
    const daysSinceInvoice = inv ? Math.max(0, Math.floor((now - inv.getTime()) / DAY_MS)) : null;
    const creditHold = d.creditHold === true || /^(yes|true)$/i.test(str(d.creditHold));
    const reasons: string[] = [];
    if (declinePct !== null && declinePct <= -DECLINE_THRESHOLD) reasons.push(`YTD down ${Math.round(-declinePct * 100)}% on last FY`);
    if (daysSinceInvoice !== null && daysSinceInvoice >= NO_INVOICE_DAYS && (thisFY > 0 || lastFY > 0)) reasons.push(`No invoice for ${daysSinceInvoice} days`);
    if (creditHold) reasons.push('On credit hold');
    if (!reasons.length) continue;
    out.push({ id, name, ytdThisFY: thisFY, ytdLastFY: lastFY, declinePct, daysSinceInvoice, creditHold, revenueAtRisk: Math.max(0, Math.round(lastFY - thisFY)), reasons });
  }
  return out.sort((a, b) => b.revenueAtRisk - a.revenueAtRisk);
}

export function signalToAtRiskRow(sig: AccountSignal): NwaAtRiskRow {
  return emptyAtRiskRow({ accountId: sig.id, account: sig.name, revenueAtRisk: sig.revenueAtRisk, signal: sig.reasons.join(' · '), source: 'crm' });
}

/** Accounts for the pickers: CRM customer accounts first, then open opportunities, de-duplicated. */
export function accountOptions(deals: any[]): AccountOption[] {
  const byId = new Map<string, AccountOption>();
  const rows = latestDeals(deals || []);
  [...rows.filter(d => d?.isBareAccount), ...rows.filter(d => !d?.isBareAccount)].forEach(d => {
    const id = accountIdOf(d);
    const name = str(d?.pipeline) || str(d?.opportunityName);
    if (id && name && !byId.has(id)) byId.set(id, { id, name });
  });
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function totalRevenueAtRisk(acc: NwaAccountMgmt): number {
  return acc.atRisk.filter(r => r.status === 'open').reduce((s, r) => s + num(r.revenueAtRisk), 0);
}

/** Open account items from last week's plan carry into this week (resolved ones drop off). */
export function carryForwardAccounts(prev: NwaAccountMgmt | null | undefined): NwaAccountMgmt {
  if (!prev) return emptyAccountMgmt();
  return {
    atRisk: prev.atRisk.filter(r => r.status === 'open'),
    renewals: prev.renewals.filter(r => r.status === 'not_started' || r.status === 'in_progress'),
    growth: prev.growth.filter(r => r.account.trim()),
    handovers: prev.handovers.filter(h => h.status !== 'complete'),
  };
}

// ─── Commitments & follow-through ───────────────────────────────────────────
const OUTCOMES: CommitmentOutcome[] = ['done', 'partly', 'not_done'];
function outcomeOf(c: any): CommitmentOutcome | null {
  if (OUTCOMES.includes(c?.outcome)) return c.outcome;
  if (c?.done === true) return 'done';
  return null;
}

/** The commitments a stored plan asked for (NWA V2, NWA V1 or legacy Friday FW action plan). */
export function previousCommitmentsFrom(d: any): NwaCommitmentReview[] {
  if (Array.isArray(d?.commitments) && d.commitments.some((c: any) => str(c?.text).trim())) {
    return d.commitments
      .filter((c: any) => str(c?.text).trim())
      .map((c: any, i: number) => ({ id: str(c.id) || `c_${i}`, text: str(c.text), owner: str(c.owner), dueDate: str(c.dueDate), outcome: null, note: '' }));
  }
  return (Array.isArray(d?.actionPlan) ? d.actionPlan : [])
    .filter((a: any) => str(a).trim())
    .map((a: any, i: number) => ({ id: `legacy_${i}`, text: str(a), owner: '', dueDate: '', outcome: null, note: '' }));
}

/** Keep outcomes already marked, add any commitments from last week not yet in the review. */
export function mergeCommitmentReview(existing: NwaCommitmentReview[], previous: NwaCommitmentReview[]): NwaCommitmentReview[] {
  const byId = new Map(existing.map(r => [r.id, r]));
  const merged = previous.map(p => {
    const e = byId.get(p.id);
    return e ? { ...p, outcome: e.outcome, note: e.note } : p;
  });
  const prevIds = new Set(previous.map(p => p.id));
  existing.forEach(e => { if (!prevIds.has(e.id)) merged.push(e); });
  return merged;
}

export function followThroughScore(review: Array<{ outcome?: CommitmentOutcome | null; done?: boolean }>): NwaFollowThrough {
  const list = Array.isArray(review) ? review : [];
  let done = 0, partly = 0, notDone = 0;
  list.forEach(r => {
    const o = outcomeOf(r);
    if (o === 'done') done += 1;
    else if (o === 'partly') partly += 1;
    else if (o === 'not_done') notDone += 1;
  });
  const reviewed = done + partly + notDone;
  return { score: reviewed ? Math.round(((done + partly * 0.5) / reviewed) * 100) : null, done, partly, notDone, reviewed, total: list.length };
}

/** Follow-through history from a person's weeklyCommitments docs, oldest first. */
export function followThroughTrend(docs: any[], limit = 8): { week: string; score: number }[] {
  return (docs || [])
    .filter(d => d && typeof d.week === 'string')
    .map(d => {
      const stored = d.followThrough && typeof d.followThrough.score === 'number' ? d.followThrough.score : null;
      const score = stored ?? followThroughScore(d.commitmentReview || []).score;
      return { week: d.week as string, score };
    })
    .filter((x): x is { week: string; score: number } => typeof x.score === 'number')
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-limit);
}

export function averageScore(points: { score: number }[]): number | null {
  if (!points.length) return null;
  return Math.round(points.reduce((s, p) => s + p.score, 0) / points.length);
}

// ─── Mapping stored docs ────────────────────────────────────────────────────
/** True for a doc written by the old Friday FW form (no formVersion, Friday-only fields). */
export function isLegacyFridayDoc(d: any): boolean {
  if (!d || d.formVersion) return false;
  return (Array.isArray(d.focusAccounts) && d.focusAccounts.length > 0)
    || !!str(d.strategicFocus).trim()
    || (Array.isArray(d.actionPlan) && d.actionPlan.some((a: any) => str(a).trim()));
}

function rowsOf(v: any): NwaDealRow[] {
  return Array.isArray(v)
    ? v.map((r: any) => ({
        id: str(r?.id) || nwaId('deal'),
        account: str(r?.account),
        value: num(r?.value),
        nextStep: str(r?.nextStep),
        nextStepDate: str(r?.nextStepDate),
        note: str(r?.note),
        daysWithoutMovement: typeof r?.daysWithoutMovement === 'number' ? r.daysWithoutMovement : null,
        autoFlagged: !!r?.autoFlagged,
        ...(r?.crmId ? { crmId: str(r.crmId) } : {}),
      }))
    : [];
}

/**
 * Map a stored weeklyCommitments doc (NWA V2, NWA V1 or legacy Friday FW) into the form.
 * twtwActions (Thursday TWTW "This week's actions") prefill priorities only when empty.
 */
export function mapStoredNwa(d: any, role: string, twtwActions: string[] = []): NwaPlan {
  const doc = d || {};
  const base = emptyNwaPlan(role);
  const legacyActions: string[] = (Array.isArray(doc.actionPlan) ? doc.actionPlan : []).map(str).filter((a: string) => a.trim());
  const isV2 = doc.formVersion === NWA_FORM_VERSION;

  let priorities: string[] = Array.isArray(doc.topPriorities) ? doc.topPriorities.map(str) : [];
  if (priorities.every(p => !p.trim())) priorities = legacyActions.length ? legacyActions.slice(0, 3) : twtwActions.slice(0, 3);
  while (priorities.length < 3) priorities.push('');

  let commitments: NwaCommitment[] = Array.isArray(doc.commitments)
    ? doc.commitments.map((c: any) => ({ id: str(c?.id) || nwaId('c'), text: str(c?.text), owner: str(c?.owner), dueDate: str(c?.dueDate) }))
    : [];
  if (!commitments.length && !isV2 && legacyActions.length > 3) {
    commitments = legacyActions.slice(3).map(t => ({ id: nwaId('c'), text: t, owner: '', dueDate: '' }));
  }

  const w = doc.wins || {};
  const ch = doc.challenges || {};
  // Legacy kpiTargets may be strings; coerce.
  const kt = doc.kpiTargets || {};
  const kpiTargets: NwaKpiTargets = { ...base.kpiTargets };
  (Object.keys(kpiTargets) as (keyof NwaKpiTargets)[]).forEach(k => { if (kt[k] !== undefined && kt[k] !== '') kpiTargets[k] = num(kt[k]); });
  // Calls is no longer an NWA KPI; keep an old doc's value so a re-save doesn't lose it.
  if (kt.callsToMake !== undefined && kt.callsToMake !== '') kpiTargets.callsToMake = num(kt.callsToMake);

  // Legacy Friday focus accounts become "deals progressing" when the doc has no NWA pipeline.
  const hasPipeline = doc.pipeline && Object.values(doc.pipeline).some((v: any) => Array.isArray(v) && v.length);
  const legacyFocus: NwaDealRow[] = !isV2 && !hasPipeline && Array.isArray(doc.focusAccounts)
    ? doc.focusAccounts
        .filter((fa: any) => str(fa?.accountName).trim())
        .map((fa: any) => emptyDealRow({ account: str(fa.accountName), value: num(fa.eav), nextStep: str(fa.actionType), note: str(fa.aboutAccount) }))
    : [];
  const handedOverRows = rowsOf(doc.pipeline?.handedOver);
  const accounts = accountsOf(doc.accounts);
  // NWA rows handed over before structured handovers existed.
  if (!doc.accounts && handedOverRows.length) {
    accounts.handovers = handedOverRows.filter(r => r.account.trim()).map(r => emptyHandover({ account: r.account, toName: r.note, status: 'complete', date: r.nextStepDate }));
  }

  return {
    wins: {
      customerWins: str(w.customerWins),
      closedOpportunities: str(w.closedOpportunities),
      positiveFeedback: str(w.positiveFeedback),
      teamRecognition: str(w.teamRecognition),
      shoutOut: { teammate: str(w.shoutOut?.teammate), reason: str(w.shoutOut?.reason) },
    },
    appointments: Array.isArray(doc.appointments) ? doc.appointments.map((a: any) => ({
      id: str(a?.id) || nwaId('appt'),
      customer: str(a?.customer),
      date: str(a?.date),
      meetingType: str(a?.meetingType) || 'Face to face',
      purpose: str(a?.purpose),
      desiredOutcome: str(a?.desiredOutcome),
      supportRequired: str(a?.supportRequired),
      ...(a?.source ? { source: a.source } : {}),
      ...(a?.crmId ? { crmId: str(a.crmId) } : {}),
    })) : [],
    pipeline: {
      progressing: legacyFocus.length ? legacyFocus : rowsOf(doc.pipeline?.progressing),
      stalled: rowsOf(doc.pipeline?.stalled),
      created: rowsOf(doc.pipeline?.created),
      // Handovers live in accounts.handovers; pipeline.handedOver is only a mirror written for older readers.
      handedOver: [],
    },
    kpiTargets,
    keyFocusMetrics: str(doc.keyFocusMetrics) || (isV2 ? '' : str(doc.strategicFocus)),
    individualCommitment: str(doc.individualCommitment),
    topPriorities: [priorities[0], priorities[1], priorities[2]],
    challenges: {
      slowingProgress: str(ch.slowingProgress),
      customerIssues: str(ch.customerIssues),
      // Legacy "Roadblocks" → internal issues; "Support needed" → resources required
      internalIssues: ch.internalIssues !== undefined ? str(ch.internalIssues) : str(doc.roadblocks),
      resourcesRequired: ch.resourcesRequired !== undefined ? str(ch.resourcesRequired) : str(doc.supportNeeded),
    },
    commitments,
    commitmentReview: Array.isArray(doc.commitmentReview)
      ? doc.commitmentReview.map((r: any, i: number) => ({
          id: str(r?.id) || `r_${i}`, text: str(r?.text), owner: str(r?.owner), dueDate: str(r?.dueDate),
          outcome: outcomeOf(r), note: str(r?.note),
        }))
      : [],
    accounts,
  };
}

const RISK: RiskStatus[] = ['open', 'saved', 'lost'];
const REN_TYPES: RenewalType[] = ['renewal', 'rate_review'];
const REN_STATUS: RenewalStatus[] = ['not_started', 'in_progress', 'agreed', 'lost'];
const HO_STATUS: HandoverStatus[] = ['proposed', 'in_progress', 'complete'];
const pick = <T extends string>(v: unknown, list: T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

function accountsOf(a: any): NwaAccountMgmt {
  return {
    atRisk: arr(a?.atRisk).map(r => ({
      id: str(r?.id) || nwaId('risk'), accountId: str(r?.accountId), account: str(r?.account), reason: str(r?.reason),
      revenueAtRisk: num(r?.revenueAtRisk), action: str(r?.action), status: pick(r?.status, RISK, 'open'),
      ...(r?.signal ? { signal: str(r.signal) } : {}), source: r?.source === 'crm' ? 'crm' as const : 'manual' as const,
    })),
    renewals: arr(a?.renewals).map(r => ({
      id: str(r?.id) || nwaId('ren'), accountId: str(r?.accountId), account: str(r?.account), type: pick(r?.type, REN_TYPES, 'renewal'),
      dueDate: str(r?.dueDate), value: num(r?.value), status: pick(r?.status, REN_STATUS, 'not_started'), note: str(r?.note),
    })),
    growth: arr(a?.growth).map(r => ({
      id: str(r?.id) || nwaId('grow'), accountId: str(r?.accountId), account: str(r?.account), opportunity: str(r?.opportunity),
      value: num(r?.value), nextStep: str(r?.nextStep), nextStepDate: str(r?.nextStepDate),
    })),
    handovers: arr(a?.handovers).map(h => ({
      id: str(h?.id) || nwaId('ho'), accountId: str(h?.accountId), account: str(h?.account),
      fromUserId: str(h?.fromUserId), fromName: str(h?.fromName), toUserId: str(h?.toUserId), toName: str(h?.toName),
      status: pick(h?.status, HO_STATUS, 'proposed'), reason: str(h?.reason), date: str(h?.date),
    })),
  };
}

/** The Friday FW fields kept on a converted doc so the original stays viewable. */
export const LEGACY_FRIDAY_FIELDS = ['focusAccounts', 'strategicFocus', 'actionPlan', 'kpiTargets', 'roadblocks', 'supportNeeded', 'status', 'submittedAt', 'adminCoachingNotes'] as const;

export function legacyFridaySnapshot(d: any): Record<string, any> {
  const out: Record<string, any> = {};
  LEGACY_FRIDAY_FIELDS.forEach(k => { if (d?.[k] !== undefined) out[k] = d[k]; });
  return out;
}

/** "Start NWA" on a week that has an old Friday FW doc: map it into the NWA form, keeping a snapshot. */
export function convertLegacyFriday(d: any, role: string, twtwActions: string[] = []): { plan: NwaPlan; legacyFriday: Record<string, any> } {
  return { plan: mapStoredNwa(d, role, twtwActions), legacyFriday: d?.legacyFriday || legacyFridaySnapshot(d) };
}

/**
 * Legacy focusAccounts shape ({ id, accountName, actionType, eav, aboutAccount }) for the GM review,
 * TWTW focus-account review and demo dash, built from the NWA pipeline and account section.
 */
export function focusAccountsMirror(p: NwaPlan): { id: string; accountName: string; actionType: string; eav: number; aboutAccount: string }[] {
  const about = (...parts: (string | false | undefined)[]) => parts.filter(x => x && String(x).trim()).join(' · ');
  const deal = (type: string) => (r: NwaDealRow) => ({
    id: r.id, accountName: r.account, actionType: type, eav: num(r.value),
    aboutAccount: about(r.nextStep, r.nextStepDate && `by ${r.nextStepDate}`, r.note),
  });
  return [
    ...p.pipeline.progressing.map(deal('Progressing')),
    ...p.pipeline.stalled.map(deal('Stalled')),
    ...p.pipeline.created.map(deal('New opportunity')),
    ...p.accounts.atRisk.filter(r => r.status === 'open').map(r => ({
      id: r.id, accountName: r.account, actionType: 'At risk', eav: num(r.revenueAtRisk), aboutAccount: about(r.reason || r.signal, r.action),
    })),
    ...p.accounts.renewals.filter(r => r.status === 'not_started' || r.status === 'in_progress').map(r => ({
      id: r.id, accountName: r.account, actionType: RENEWAL_TYPE_LABEL[r.type], eav: num(r.value), aboutAccount: about(r.dueDate && `due ${r.dueDate}`, r.note),
    })),
    ...p.accounts.growth.map(r => ({
      id: r.id, accountName: r.account, actionType: 'Growth', eav: num(r.value), aboutAccount: about(r.opportunity, r.nextStep, r.nextStepDate && `by ${r.nextStepDate}`),
    })),
  ].filter(f => f.accountName.trim());
}

export function strategicFocusMirror(p: NwaPlan): string {
  return [p.keyFocusMetrics, p.individualCommitment].map(s => s.trim()).filter(Boolean).join('\n')
    || p.topPriorities.filter(t => t.trim()).join('; ');
}

/**
 * KPI actuals stored on the NWA doc: only the KPIs on the role's scorecard (Calls is no longer an
 * NWA KPI, so it is dropped here; CRM call counts still go to weeklyReports.summary).
 */
export function nwaKpiActuals(actuals: Partial<Record<KpiKey, number>>, role?: string): Partial<Record<KpiKey, number>> {
  const keys = new Set<KpiKey>(kpiDefsFor(role || 'BDM').map(k => k.key));
  const out: Partial<Record<KpiKey, number>> = {};
  for (const [k, v] of Object.entries(actuals || {})) if (keys.has(k as KpiKey) && typeof v === 'number') out[k as KpiKey] = v;
  return out;
}

/** Firestore payload: NWA V2 fields plus legacy mirrors for older views. */
export function buildNwaPayload(p: NwaPlan, opts: { kpiActuals?: Partial<Record<KpiKey, number>>; role?: string } = {}) {
  const roadblocks = [
    p.challenges.slowingProgress,
    p.challenges.customerIssues && `Customer: ${p.challenges.customerIssues}`,
    p.challenges.internalIssues && `Internal: ${p.challenges.internalIssues}`,
  ].filter(Boolean).join('\n');
  const commitments = p.commitments.filter(c => c.text.trim());
  const clean = (rows: NwaDealRow[]) => rows
    .filter(r => r.account.trim() || r.note.trim() || r.nextStep.trim())
    .map(r => {
      const out: any = { ...r, daysWithoutMovement: r.daysWithoutMovement ?? null, autoFlagged: !!r.autoFlagged };
      if (!out.crmId) delete out.crmId;
      return out;
    });
  return {
    formVersion: NWA_FORM_VERSION,
    wins: p.wins,
    appointments: p.appointments.filter(a => a.customer.trim() || a.purpose.trim()).map(a => {
      const out: any = { ...a };
      if (!out.source) delete out.source;
      if (!out.crmId) delete out.crmId;
      return out;
    }),
    pipeline: {
      progressing: clean(p.pipeline.progressing),
      stalled: clean(p.pipeline.stalled),
      created: clean(p.pipeline.created),
      // Mirror of structured handovers for older readers.
      handedOver: p.accounts.handovers.filter(h => h.account.trim()).map(h => ({
        id: h.id, account: h.account, value: 0, nextStep: HANDOVER_STATUS_LABEL[h.status], nextStepDate: h.date,
        note: [h.fromName && `from ${h.fromName}`, h.toName && `to ${h.toName}`].filter(Boolean).join(' '), daysWithoutMovement: null, autoFlagged: false,
      })),
    },
    accounts: {
      atRisk: p.accounts.atRisk.filter(r => r.account.trim()).map(r => { const o: any = { ...r }; if (!o.signal) delete o.signal; return o; }),
      renewals: p.accounts.renewals.filter(r => r.account.trim()),
      growth: p.accounts.growth.filter(r => r.account.trim()),
      handovers: p.accounts.handovers.filter(h => h.account.trim()),
    },
    revenueAtRisk: totalRevenueAtRisk(p.accounts),
    ...(opts.role ? { kpiRole: kpiRoleGroup(opts.role) } : {}),
    ...(opts.kpiActuals ? { kpiActuals: nwaKpiActuals(opts.kpiActuals, opts.role) } : {}),
    kpiTargets: p.kpiTargets,
    keyFocusMetrics: p.keyFocusMetrics,
    individualCommitment: p.individualCommitment,
    topPriorities: p.topPriorities,
    challenges: p.challenges,
    commitments,
    commitmentReview: p.commitmentReview,
    followThrough: followThroughScore(p.commitmentReview),
    // Legacy mirrors (weekly archive, GM review, TWTW prefill, demo dash)
    actionPlan: [...p.topPriorities, ...commitments.map(c => c.text)].filter(a => a && a.trim()),
    roadblocks,
    supportNeeded: p.challenges.resourcesRequired,
    focusAccounts: focusAccountsMirror(p),
    strategicFocus: strategicFocusMirror(p),
  };
}

/** How complete the form is, per section (for the progress rail). */
export function sectionComplete(p: NwaPlan, id: NwaSectionId, role = 'BDM'): boolean {
  switch (id) {
    case 'wins': return !!(p.wins.customerWins || p.wins.closedOpportunities || p.wins.positiveFeedback || p.wins.teamRecognition).trim();
    case 'shoutout': return !!(p.wins.shoutOut.teammate.trim() && p.wins.shoutOut.reason.trim());
    case 'appointments': return p.appointments.some(a => a.customer.trim());
    case 'pipeline': return Object.values(p.pipeline).some(rows => rows.some(r => r.account.trim()));
    case 'accounts': return Object.values(p.accounts).some((rows: any[]) => rows.some(r => str(r.account).trim()));
    case 'kpis': return kpiDefsFor(role).every(k => (p.kpiTargets[k.target] || 0) > 0);
    case 'priorities': return p.topPriorities.every(t => t.trim());
    case 'challenges': return !!(p.challenges.slowingProgress || p.challenges.customerIssues || p.challenges.internalIssues || p.challenges.resourcesRequired).trim();
    case 'updates': return true;
    case 'commitments': return p.commitments.some(c => c.text.trim());
    default: return false;
  }
}

/** Required rep sections for a role, in agenda order. */
export function requiredSectionsFor(role: string | undefined | null): NwaSectionDef[] {
  return nwaSectionsFor(role).filter(s => s.entry === 'required');
}

/**
 * Progress over the rep-required sections only (Shout out, Top 3 priorities, Commitments).
 * Optional, auto-filled and leader sections never count, so they can't hold a rep's submission back.
 */
export function requiredProgress(p: NwaPlan, role: string | undefined | null = 'BDM'): { done: NwaSectionDef[]; missing: NwaSectionDef[]; total: number; pct: number } {
  const req = requiredSectionsFor(role);
  const done = req.filter(s => sectionComplete(p, s.id, role || 'BDM'));
  const missing = req.filter(s => !done.includes(s));
  return { done, missing, total: req.length, pct: req.length ? Math.round((done.length / req.length) * 100) : 100 };
}

// ─── Appointments from the Salesforce (CRM) upload ───────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

/** Monday to Sunday (Perth calendar dates, yyyy-mm-dd) of a financial-year week key. */
export function weekDateRange(weekKey: string): { start: string; end: string } | null {
  const s = weekStartDate(weekKey);
  if (!s) return null;
  const end = new Date(Date.UTC(s.year, s.month - 1, s.day + 6));
  return { start: ymd(s.year, s.month, s.day), end: ymd(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate()) };
}

/**
 * Calendar day of a crmActivities date. The importer stores the uploader's local midnight as an ISO
 * string (e.g. 2026-10-25T16:00:00.000Z for 26 Oct in Perth), so shift by 12h before taking the UTC
 * date: right for any uploader between UTC-11 and UTC+12. Plain yyyy-mm-dd strings pass through.
 */
export function crmActivityDay(value: any): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = typeof value?.toMillis === 'function' ? value.toMillis() : typeof value === 'number' ? value : Date.parse(String(value));
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + 12 * 60 * 60 * 1000);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Appointments for a plan week from uploaded CRM activity: every APP-type crmActivities record for the
 * person's ids dated Monday to Sunday of planWeek (Perth), or tagged with that week by the importer.
 * Re-uploads create new random ids, so identical rows (same person, day, company and subject) are merged.
 */
export function crmAppointmentsForWeek(activities: any[], planWeek: string, userIds?: string[] | Set<string>): NwaAppointment[] {
  const range = weekDateRange(planWeek);
  const ids = userIds ? new Set(Array.from(userIds)) : null;
  const seen = new Set<string>();
  const out: NwaAppointment[] = [];
  for (const a of activities || []) {
    if (str(a?.type).toUpperCase() !== 'APP') continue;
    if (ids && !ids.has(str(a?.userId))) continue;
    const day = crmActivityDay(a?.date);
    const inRange = !!range && !!day && day >= range.start && day <= range.end;
    if (!inRange && str(a?.week) !== planWeek) continue;
    const customer = str(a?.companyName) || str(a?.accountName) || 'Unknown account';
    const purpose = str(a?.subject);
    const key = [str(a?.userId), day, customer.toLowerCase(), purpose.toLowerCase()].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `crm-${str(a?.id) || key}`,
      customer,
      date: day,
      meetingType: 'Salesforce appointment',
      purpose,
      desiredOutcome: '',
      supportRequired: '',
      source: 'crm',
      ...(a?.id ? { crmId: str(a.id) } : {}),
    });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.customer.localeCompare(y.customer));
}

const tsMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
};

/** Latest Salesforce upload time: appSettings/global.lastCrmSync, else the newest crmActivities.uploadedAt. */
export function latestCrmUploadMs(lastCrmSync: any, activities: any[] = []): number | null {
  const best = Math.max(tsMs(lastCrmSync), ...(activities || []).map(a => tsMs(a?.uploadedAt)), 0);
  return best > 0 ? best : null;
}

// ─── Wins since last week, from the rep's TWTW ───────────────────────────────
/** Customer wins text from TWTW Key Wins rows (customer, value, update). */
export function twtwCustomerWinsText(wins: any[]): string {
  return (Array.isArray(wins) ? wins : [])
    .filter(w => str(w?.customer).trim() && !w?.isHidden)
    .map(w => {
      const v = num(w?.value);
      const head = `${str(w.customer).trim()}${v ? ` – $${Math.round(v).toLocaleString('en-AU')}` : ''}`;
      return str(w?.updateText).trim() ? `${head}: ${str(w.updateText).trim()}` : head;
    })
    .join('\n');
}

export type NwaWinsSource = 'twtw' | 'stored' | 'none';

/**
 * "Wins since last week" for the TWA, read-only. Pulled from the rep's TWTW for reviewWeek
 * (twiwSubmissions/{uid}_{reviewWeek}) so nothing is typed twice:
 *   Customer wins = TWTW Key Wins rows; Positive feedback / Team recognition = the TWTW fields of the
 *   same name; Closed opportunities = CRM Closed Won deals for the week (TWTW closed won wins as a fallback).
 * Without a TWTW, older TWA docs that stored typed wins still show them (source 'stored').
 * The rep's shout-out always comes from the TWA itself.
 */
export function winsFromTwtw(twtw: any | null | undefined, closedWonText: string, stored?: NwaWins | null): { wins: NwaWins; source: NwaWinsSource } {
  const shoutOut = stored?.shoutOut || { teammate: '', reason: '' };
  if (twtw) {
    return {
      source: 'twtw',
      wins: {
        customerWins: twtwCustomerWinsText(twtw.wins),
        closedOpportunities: closedWonText || str(twtw.closedOpportunities),
        positiveFeedback: str(twtw.positiveFeedback),
        teamRecognition: str(twtw.teamRecognition),
        shoutOut,
      },
    };
  }
  const legacy = stored && [stored.customerWins, stored.positiveFeedback, stored.teamRecognition].some(x => str(x).trim());
  if (legacy && stored) return { source: 'stored', wins: { ...stored, closedOpportunities: stored.closedOpportunities || closedWonText, shoutOut } };
  return { source: 'none', wins: { customerWins: '', closedOpportunities: closedWonText, positiveFeedback: '', teamRecognition: '', shoutOut } };
}

export function emptyBusinessUpdates(): NwaBusinessUpdates {
  return { pricingChanges: '', productUpdates: '', competitorActivity: '', other: '' };
}

/** Per-week doc id in appSettings (covered by the existing appSettings rule: staff read, leaders write). */
export function businessUpdatesDocId(planWeek: string): string {
  return `nwaBusinessUpdates_${planWeek}`;
}

/**
 * Business updates for planWeek: the per-week doc (appSettings/nwaBusinessUpdates_{week}) when it has
 * content, else the legacy single doc's byWeek[planWeek].
 */
export function resolveBusinessUpdates(weekDoc: any, legacyDoc: any, planWeek: string): NwaBusinessUpdates {
  const fromWeek = businessUpdatesFor({ byWeek: { [planWeek]: weekDoc || {} } }, planWeek);
  return hasBusinessUpdates(fromWeek) ? fromWeek : businessUpdatesFor(legacyDoc, planWeek);
}

export function businessUpdatesFor(doc: any, planWeek: string): NwaBusinessUpdates {
  const wk = doc?.byWeek?.[planWeek] || {};
  return {
    pricingChanges: str(wk.pricingChanges),
    productUpdates: str(wk.productUpdates),
    competitorActivity: str(wk.competitorActivity),
    other: str(wk.other),
    updatedBy: str(wk.updatedBy) || undefined,
    updatedAt: wk.updatedAt,
  };
}

export function hasBusinessUpdates(u: NwaBusinessUpdates): boolean {
  return !!(u.pricingChanges || u.productUpdates || u.competitorActivity || u.other).trim();
}

// ─── CRM / call plan adapters ───────────────────────────────────────────────
/** pipelineReviews can hold one snapshot per week; keep the latest snapshot of each deal. */
export function latestDeals(deals: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const d of deals || []) {
    const key = str(d?.salesforceId) || `${str(d?.pipeline)}|${str(d?.opportunityName)}` || str(d?.id);
    const prev = byKey.get(key);
    if (!prev || str(d?.week) > str(prev?.week)) byKey.set(key, d);
  }
  return Array.from(byKey.values());
}

export function callPlanToAppointment(cp: any): NwaAppointment {
  return {
    id: nwaId('appt'),
    customer: str(cp?.customerName) || str(cp?.companyName) || str(cp?.accountName),
    date: toDateInput(cp?.date ?? cp?.meetingDate),
    meetingType: str(cp?.meetingType) || 'Face to face',
    purpose: str(cp?.objective) || str(cp?.purpose),
    desiredOutcome: str(cp?.desiredOutcome),
    supportRequired: '',
    source: 'callPlan',
  };
}

// ─── Leader-maintained sections (one place per week) ────────────────────────
/**
 * Sections the sales leader writes once a week, shown read-only on every TWA and in the team view:
 *  - Team-wide: extra fields on the per-week business updates doc appSettings/nwaBusinessUpdates_{week}
 *    (teamPipeline, teamKpis), next to the four business update fields. Staff read, leaders write.
 *  - Per person: nwaLeaderNotes/{uid}_{week} = { userId, week, updates, pipeline, kpis }. Only that
 *    person and leaders can read it; only leaders write (firestore.rules).
 * KPI targets stay where they were: appSettings/nwaKpiTargets.byRole (team) and users/{uid}.nwaKpiTargets.
 */
export interface NwaLeaderNotes {
  /** Pipeline and handovers notes. */
  pipeline: string;
  /** KPI focus for the week. */
  kpis: string;
  /** Extra business updates. */
  updates: string;
}

export const NWA_LEADER_NOTE_FIELDS: { key: keyof NwaLeaderNotes; section: NwaSectionId; label: string; hint: string }[] = [
  { key: 'pipeline', section: 'pipeline', label: 'Pipeline and handovers', hint: 'Deals to push, accounts handed over, who owns what.' },
  { key: 'kpis', section: 'kpis', label: 'KPI focus', hint: 'The one or two numbers that matter most this week.' },
  { key: 'updates', section: 'updates', label: 'Business updates', hint: 'Anything else the team needs to know.' },
];

export function emptyLeaderNotes(): NwaLeaderNotes {
  return { pipeline: '', kpis: '', updates: '' };
}

/** Per-person leader additions doc id (collection nwaLeaderNotes). */
export function leaderNotesDocId(uid: string, week: string): string {
  return `${uid}_${week}`;
}

/** Per-person leader additions from nwaLeaderNotes/{uid}_{week}. */
export function mapLeaderNotes(doc: any): NwaLeaderNotes {
  return { pipeline: str(doc?.pipeline), kpis: str(doc?.kpis), updates: str(doc?.updates) };
}

/** Team-wide leader sections from the per-week business updates doc (teamPipeline / teamKpis). */
export function teamLeaderNotes(weekDoc: any): NwaLeaderNotes {
  return { pipeline: str(weekDoc?.teamPipeline), kpis: str(weekDoc?.teamKpis), updates: '' };
}

export function hasLeaderNotes(n: Partial<NwaLeaderNotes> | null | undefined): boolean {
  return !!n && [n.pipeline, n.kpis, n.updates].some(x => str(x).trim());
}

// ─── Submission timeliness ───────────────────────────────────────────────────
/**
 * Whether a submitted TWA was late: the stored submittedLate flag, else submittedAt after dueAt
 * (stored, or Sunday 8pm before the plan week). Unknown or not submitted → false.
 */
export function isLateSubmission(d: any): boolean {
  if (!d || !isSubmittedStatus(d.status)) return false;
  if (typeof d.submittedLate === 'boolean') return d.submittedLate;
  const at = tsMs(d.submittedAt);
  const due = typeof d.dueAt === 'number' ? d.dueAt : nwaDueAt(str(d.week));
  return !!(at && due && at > due);
}

/** The n plan weeks ending at (and including) lastWeek, oldest first. */
export function recentWeeks(lastWeek: string, n: number, prevWeek: (w: string) => string): string[] {
  const out: string[] = [];
  let w = lastWeek;
  for (let i = 0; i < n && w; i++) { out.unshift(w); w = prevWeek(w); }
  return out;
}

/**
 * On-time rate over the given plan weeks for one person: weeks submitted and not late ÷ weeks.
 * A week with no submitted TWA counts as not on time.
 */
export function onTimeRate(docs: any[], weeks: string[]): { onTime: number; late: number; missed: number; total: number; pct: number | null } {
  const byWeek = new Map<string, any>();
  for (const d of docs || []) {
    if (!d?.week) continue;
    const prev = byWeek.get(str(d.week));
    // Linked ids can give two docs for one week: keep a submitted one.
    if (!prev || (!isSubmittedStatus(prev.status) && isSubmittedStatus(d.status))) byWeek.set(str(d.week), d);
  }
  let onTime = 0; let late = 0; let missed = 0;
  for (const w of weeks) {
    const d = byWeek.get(w);
    if (!d || !isSubmittedStatus(d.status)) missed += 1;
    else if (isLateSubmission(d)) late += 1;
    else onTime += 1;
  }
  const total = weeks.length;
  return { onTime, late, missed, total, pct: total ? Math.round((onTime / total) * 100) : null };
}

// ─── Auto-filled sections applied to a plan ─────────────────────────────────
/**
 * The plan as shown, saved and counted: wins from the TWTW, appointments from the Salesforce
 * upload, pipeline from the CRM. Used by the individual TWA and the team view so both agree.
 *  - Appointments: CRM APP activities for the plan week; if none are loaded (the upload keeps four
 *    weeks), the CRM snapshot saved on the doc. Older manual / call plan rows stay, read-only.
 *  - Pipeline: while live (not submitted, not a past week) rows come from CRM suggestions, keeping
 *    any rows typed on older versions; once frozen the saved rows are shown.
 */
export function applyAutoSections(
  plan: NwaPlan,
  src: {
    twtw?: any | null;
    closedWonText?: string;
    crmAppointments?: NwaAppointment[];
    suggestions?: { progressing: any[]; stalled: any[]; created: any[] } | null;
    live?: boolean;
    now?: number;
  },
): { plan: NwaPlan; winsSource: NwaWinsSource } {
  const { wins, source } = winsFromTwtw(src.twtw, src.closedWonText || '', plan.wins);
  const storedCrm = plan.appointments.filter(a => a.source === 'crm');
  const legacy = plan.appointments.filter(a => a.source !== 'crm');
  const crm = src.crmAppointments && src.crmAppointments.length ? src.crmAppointments : storedCrm;
  let pipeline = plan.pipeline;
  if (src.live && src.suggestions) {
    const now = src.now ?? Date.now();
    const build = (key: 'progressing' | 'stalled' | 'created') => {
      const typed = (plan.pipeline[key] || []).filter(r => !r.crmId);
      const prev = new Map((plan.pipeline[key] || []).filter(r => r.crmId).map(r => [r.crmId, r]));
      const fromCrm = (src.suggestions![key] || []).map(d => {
        const row = dealToRow(d, now);
        const old = row.crmId ? prev.get(row.crmId) : undefined;
        return old ? { ...row, id: old.id, nextStep: old.nextStep, note: old.note } : row;
      });
      return [...fromCrm, ...typed];
    };
    pipeline = { ...plan.pipeline, progressing: build('progressing'), stalled: build('stalled'), created: build('created') };
  }
  return { plan: { ...plan, wins, appointments: [...crm, ...legacy], pipeline }, winsSource: source };
}
