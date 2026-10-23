/**
 * Pure helpers behind the dashboard widgets (kept out of React so they can be unit tested).
 * Every input is data the widgets already load with a bounded, owner-scoped query.
 */
import { dueStatus, type Task } from './time-mgmt';
import { CARRIERS, TGE_BENCHMARK_LABEL, seedDoc, type FuelDoc, type FuelOverride } from './fuel-surcharges';
import { hasCarrierPain } from './intel';
import { isClaimExpired, isClaimable, perthWeekStart, tsMs, normaliseCompany, type VerticalProspect } from './verticals';

// ─── Today strip ────────────────────────────────────────────────────────────
export function todaySnapshot(tasks: Task[], now: number) {
  const open = tasks.filter(t => !t.completed && t.dueAt);
  const overdue = open.filter(t => dueStatus(t, now) === 'overdue').sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  const today = open.filter(t => dueStatus(t, now) === 'today').sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
  return { overdue, today, total: overdue.length + today.length };
}

// ─── Fuel surcharges ────────────────────────────────────────────────────────
export interface FuelSnapshotRow { id: string; name: string; pct: number; diff: number | null; manual: boolean }
export function fuelSnapshot(docs: Partial<FuelDoc & { id: string }>[] | null | undefined, overrides: Partial<FuelOverride & { id: string }>[] | null | undefined, maxRows = 4) {
  const find = (id: string) => (docs || []).find(x => x.id === id || x.carrierId === id) as FuelDoc | undefined;
  const rows = CARRIERS.map(c => {
    const d = find(c.id) || seedDoc(c);
    const o = (overrides || []).find(x => x.id === c.id) as FuelOverride | undefined;
    const h = o ? { pct: o.pct } : c.ours ? d.current.find(x => x.label === TGE_BENCHMARK_LABEL) : d.current[0];
    return { c, d, pct: h ? h.pct : null, manual: !!o };
  });
  const tge = rows.find(r => r.c.ours);
  const tgePct = tge?.pct ?? null;
  const competitors: FuelSnapshotRow[] = rows
    .filter(r => !r.c.ours && r.pct != null)
    .map(r => ({ id: r.c.id, name: r.c.name, pct: r.pct as number, manual: r.manual, diff: tgePct == null ? null : Math.round(((r.pct as number) - tgePct) * 100) / 100 }))
    .slice(0, maxRows);
  const lastChecked = Math.max(0, ...rows.map(r => r.d.lastCheckedAt || 0));
  const stale = rows.some(r => !r.c.notPublished && r.d.status === 'stale');
  return { tgePct, competitors, lastChecked: lastChecked || null, stale };
}

// ─── Verticals ──────────────────────────────────────────────────────────────
export function verticalsSnapshot(prospects: Pick<VerticalProspect, 'ownerUid' | 'lastActivityAt' | 'claimedAt' | 'createdAt' | 'painSignals' | 'sfStatus'>[], uid: string, now = Date.now()) {
  const weekStart = perthWeekStart(now);
  let claimedByMe = 0, newThisWeek = 0, painFlagged = 0, unclaimed = 0;
  for (const p of prospects) {
    if (p.ownerUid === uid && !isClaimExpired(p, now)) claimedByMe++;
    if (tsMs(p.createdAt) >= weekStart) newThisWeek++;
    if (hasCarrierPain(p.painSignals)) painFlagged++;
    if (isClaimable(p as VerticalProspect, now) && p.sfStatus !== 'EXISTING_AM') unclaimed++;
  }
  return { total: prospects.length, newThisWeek, claimedByMe, painFlagged, unclaimed };
}

/** Top suggested WA prospects: high-confidence, not low priority, not already added, not "trading with TGE". */
export function topSuggested<T extends { company: string; confidence: string; lowPriority: boolean }>(
  list: T[], existingCompanies: string[], isDismissed: (company: string) => boolean, n = 3,
): T[] {
  const existing = new Set(existingCompanies.map(normaliseCompany));
  const rank = (c: string) => (c === 'high' ? 0 : c === 'medium' ? 1 : 2);
  return list
    .filter(s => !s.lowPriority && !existing.has(normaliseCompany(s.company)) && !isDismissed(s.company))
    .sort((a, b) => rank(a.confidence) - rank(b.confidence))
    .slice(0, n);
}

// ─── Fact finding ───────────────────────────────────────────────────────────
/** Stages before the customer has signed; later stages are onboarding / trading. */
export const FF_IN_PROGRESS_STAGES = ['New', 'Meeting', 'Proposal Required', 'Proposal Sent'];

export function factFindingSnapshot(docs: { id?: string; companyName?: string; stage?: string; isArchived?: boolean; lastModifiedAt?: any; createdAt?: any }[], recent = 3) {
  const open = docs.filter(d => !d.isArchived && FF_IN_PROGRESS_STAGES.includes(d.stage || 'New'));
  const byStage = FF_IN_PROGRESS_STAGES.map(stage => ({ stage, count: open.filter(d => (d.stage || 'New') === stage).length }));
  const latest = [...open]
    .sort((a, b) => Math.max(tsMs(b.lastModifiedAt), tsMs(b.createdAt)) - Math.max(tsMs(a.lastModifiedAt), tsMs(a.createdAt)))
    .slice(0, recent);
  return { open: open.length, byStage, latest };
}

// ─── Canvassing ─────────────────────────────────────────────────────────────
export function canvassSnapshot(leads: { createdAt?: any; inSalesforce?: boolean; archived?: boolean; companyName?: string }[], now = Date.now()) {
  const weekStart = perthWeekStart(now);
  const live = leads.filter(l => !l.archived);
  const thisWeek = live.filter(l => tsMs(l.createdAt) >= weekStart).length;
  const toSync = live.filter(l => !l.inSalesforce);
  return { total: live.length, thisWeek, toSync: toSync.length, latestToSync: toSync.slice(0, 3) };
}

// ─── Call plans / white space gaps (Top-8 deals) ────────────────────────────
const up = (s: unknown) => String(s || '').toUpperCase();
export function planGaps(
  deals: { id?: string; userId?: string; isReviewSelected?: boolean; pipeline?: string; opportunityName?: string; isBareAccount?: boolean }[],
  uid: string,
  factFindings: { companyName?: string }[],
  callPlans: { accountName?: string }[],
  whitespacePlans: { accountName?: string }[],
) {
  const matches = (name: string, deal: { pipeline?: string; opportunityName?: string }) => !!name && (name === up(deal.pipeline) || name === up(deal.opportunityName));
  const callPlansDue: string[] = [];
  const whiteSpaceDue: string[] = [];
  for (const deal of deals.filter(d => d.userId === uid && d.isReviewSelected)) {
    const hasFF = factFindings.some(f => matches(up(f.companyName), deal));
    const hasCP = callPlans.some(c => matches(up(c.accountName), deal));
    const hasWP = whitespacePlans.some(w => matches(up(w.accountName), deal));
    if (hasFF && !hasCP) callPlansDue.push(deal.pipeline || 'Unnamed');
    if (!hasWP && deal.isBareAccount) whiteSpaceDue.push(deal.pipeline || 'Unnamed');
  }
  return { callPlansDue, whiteSpaceDue };
}

// ─── Team (leaders) ─────────────────────────────────────────────────────────
export function teamSnapshot(args: {
  teamIds: string[];
  twtwSubmissions: { userId?: string; status?: string }[];
  shares: { ownerId?: string; viewerId?: string }[];
  lastCrmSyncMs: number | null;
  now?: number;
}) {
  const now = args.now ?? Date.now();
  const team = new Set(args.teamIds);
  const submitted = new Set(args.twtwSubmissions.filter(s => s.status === 'SUBMITTED' && s.userId && team.has(s.userId)).map(s => s.userId));
  const owners = new Set(args.shares.map(s => s.ownerId).filter(Boolean));
  const syncAgeDays = args.lastCrmSyncMs ? Math.floor((now - args.lastCrmSyncMs) / 86_400_000) : null;
  return {
    teamSize: team.size,
    twtwSubmitted: submitted.size,
    shareCount: args.shares.length,
    sharingOwners: owners.size,
    syncAgeDays,
    /** Data health: a CRM import older than 7 days (or never) is flagged. */
    crmStale: syncAgeDays === null || syncAgeDays > 7,
  };
}
