/**
 * NWA (Next Week's Activity): the Monday team meeting pack.
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
  | 'wins' | 'appointments' | 'pipeline' | 'kpis' | 'priorities' | 'challenges' | 'updates' | 'commitments';

export interface NwaSectionDef {
  id: NwaSectionId;
  step: number;
  title: string;
  minutes: number;
  description: string;
}

export const NWA_SECTIONS: NwaSectionDef[] = [
  { id: 'wins', step: 1, title: 'Wins since last meeting', minutes: 5, description: 'Customer wins, closed opportunities, positive feedback and team recognition.' },
  { id: 'appointments', step: 2, title: 'Upcoming appointments', minutes: 8, description: 'Face-to-face meetings this week: why we are meeting, the outcome we want and the support needed.' },
  { id: 'pipeline', step: 3, title: 'Pipeline and opportunities review', minutes: 10, description: 'Deals progressing, stalled deals, new opportunities and accounts handed over.' },
  { id: 'kpis', step: 4, title: 'Weekly goals and KPIs', minutes: 5, description: "Last week's actuals against target, and this week's targets." },
  { id: 'priorities', step: 5, title: 'Top 3 priorities', minutes: 5, description: 'The three things that matter most this week.' },
  { id: 'challenges', step: 6, title: 'Challenges and roadblocks', minutes: 5, description: 'What is slowing progress and what you need.' },
  { id: 'updates', step: 7, title: 'Business updates', minutes: 4, description: 'Pricing, product and competitor news from the leadership team.' },
  { id: 'commitments', step: 8, title: 'Commitments before next meeting', minutes: 3, description: 'Clear actions with an owner and a due date.' },
];

// ─── Types ───────────────────────────────────────────────────────────────────
export type NwaStatus = 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'REVIEWED_BY_ADMIN';
export type CommitmentOutcome = 'done' | 'partly' | 'not_done';
export type PipelineKey = 'progressing' | 'stalled' | 'created' | 'handedOver';
export type KpiKey = 'calls' | 'appointments' | 'proposals' | 'deals' | 'revenue';

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
  source?: 'callPlan' | 'manual';
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

/** Legacy key names are kept so TWTW, demo dash and the archive read targets unchanged. */
export interface NwaKpiTargets {
  callsToMake: number;
  appointmentsToSet: number;
  proposalsToSend: number;
  dealsToClose: number;
  revenueTarget: number;
}

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
}

export interface NwaBusinessUpdates {
  pricingChanges: string;
  productUpdates: string;
  competitorActivity: string;
  other: string;
  updatedBy?: string;
  updatedAt?: any;
}

export const KPI_DEFS: { key: KpiKey; label: string; target: keyof NwaKpiTargets; currency?: boolean }[] = [
  { key: 'calls', label: 'Calls', target: 'callsToMake' },
  { key: 'appointments', label: 'Appointments', target: 'appointmentsToSet' },
  { key: 'proposals', label: 'Proposals', target: 'proposalsToSend' },
  { key: 'deals', label: 'Deals', target: 'dealsToClose' },
  { key: 'revenue', label: 'Revenue', target: 'revenueTarget', currency: true },
];

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

export function defaultKpiTargets(role: string): NwaKpiTargets {
  const isBdm = (role || '').toUpperCase() === 'BDM';
  return { callsToMake: isBdm ? 50 : 30, appointmentsToSet: isBdm ? 15 : 10, proposalsToSend: 8, dealsToClose: 3, revenueTarget: 250000 };
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
  };
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
export function computeActuals(input: { progress?: any; activity?: any[]; callPlanCount?: number; deals?: any[] }): Record<KpiKey, number> {
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
  return { calls, appointments, proposals, deals, revenue };
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
    })) : [],
    pipeline: {
      progressing: rowsOf(doc.pipeline?.progressing),
      stalled: rowsOf(doc.pipeline?.stalled),
      created: rowsOf(doc.pipeline?.created),
      handedOver: rowsOf(doc.pipeline?.handedOver),
    },
    kpiTargets,
    keyFocusMetrics: str(doc.keyFocusMetrics),
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
  };
}

/** Firestore payload: NWA V2 fields plus legacy mirrors for older views. */
export function buildNwaPayload(p: NwaPlan) {
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
      return out;
    }),
    pipeline: {
      progressing: clean(p.pipeline.progressing),
      stalled: clean(p.pipeline.stalled),
      created: clean(p.pipeline.created),
      handedOver: clean(p.pipeline.handedOver),
    },
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
  };
}

/** How complete the form is, per section (for the progress rail). */
export function sectionComplete(p: NwaPlan, id: NwaSectionId): boolean {
  switch (id) {
    case 'wins': return !!(p.wins.customerWins || p.wins.closedOpportunities || p.wins.positiveFeedback || p.wins.teamRecognition || p.wins.shoutOut.teammate).trim();
    case 'appointments': return p.appointments.some(a => a.customer.trim());
    case 'pipeline': return Object.values(p.pipeline).some(rows => rows.some(r => r.account.trim()));
    case 'kpis': return KPI_DEFS.every(k => p.kpiTargets[k.target] > 0);
    case 'priorities': return p.topPriorities.every(t => t.trim());
    case 'challenges': return !!(p.challenges.slowingProgress || p.challenges.customerIssues || p.challenges.internalIssues || p.challenges.resourcesRequired).trim();
    case 'updates': return true;
    case 'commitments': return p.commitments.some(c => c.text.trim());
    default: return false;
  }
}

export function emptyBusinessUpdates(): NwaBusinessUpdates {
  return { pricingChanges: '', productUpdates: '', competitorActivity: '', other: '' };
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
