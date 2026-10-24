/**
 * Whole-team TWA helpers: one entry per team member for a plan week, built from the
 * weeklyCommitments docs (plan week + the week being reviewed), with each person's colour.
 * The auto-filled sections use the same sources as the individual TWA (applyAutoSections):
 * wins from each person's TWTW for reviewWeek, appointments from Salesforce APP activities for
 * planWeek, pipeline from the CRM upload. Leader notes are team-wide plus optional per person.
 */
import { assignTeamColors, type NwaColor } from '@/lib/nwa-colors';
import {
  type NwaLeaderNotes, type NwaPlan, type NwaSectionId, type NwaWinsSource,
  applyAutoSections, closedWonLines, crmAppointmentsForWeek, emptyLeaderNotes, isLateSubmission, isLegacyFridayDoc, isSubmittedStatus,
  latestDeals, mapLeaderNotes, mapStoredNwa, mergeCommitmentReview, onTimeRate, pipelineSuggestions, previousCommitmentsFrom, resolveKpiTargets,
} from '@/lib/nwa';


/** Minimal team-user shape (matches UnifiedTeamUser from useTeamUsers). */
export interface TeamUserLike { id: string; name: string; role: string; linkedIds: string[]; nwaColor?: string; nwaKpiTargets?: Record<string, number> }

const has = (s: string | undefined | null) => !!(s && s.trim());

export interface TeamMemberNwa {
  user: TeamUserLike;
  color: NwaColor;
  doc: any | null;
  prevDoc: any | null;
  plan: NwaPlan;
  prevPlan: NwaPlan | null;
  status: string;
  legacy: boolean;
  winsSource: NwaWinsSource;
  /** Leader's per-person additions for the plan week. */
  leaderNotes: NwaLeaderNotes;
  /** Submitted after Sunday 8pm. */
  late: boolean;
  /** On-time rate over the history weeks passed in (null when none were). */
  onTime: ReturnType<typeof onTimeRate> | null;
}

export interface TeamExtras {
  /** twiwSubmissions for reviewWeek. */
  twtwDocs?: any[];
  /** crmActivities for planWeek (type APP). */
  crmActivities?: any[];
  /** pipelineReviews (CRM deals). */
  deals?: any[];
  /** nwaLeaderNotes for planWeek. */
  leaderNotes?: any[];
  /** appSettings/nwaKpiTargets, for open plans' targets. */
  teamTargets?: any;
  /** The plan week is the current one (not a past week): open plans follow live CRM and targets. */
  live?: boolean;
  /** Plan weeks for the on-time rate (docs for these weeks must be included in docs). */
  historyWeeks?: string[];
}

/** Whether a person has anything to show in a section. */
export function memberHasContent(m: TeamMemberNwa, id: NwaSectionId | 'review'): boolean {
  const p = m.plan;
  const n = m.leaderNotes;
  switch (id) {
    case 'review': return p.commitmentReview.length > 0;
    case 'wins': return [p.wins.customerWins, p.wins.closedOpportunities, p.wins.positiveFeedback, p.wins.teamRecognition].some(has);
    case 'shoutout': return has(p.wins.shoutOut.teammate) || has(p.wins.shoutOut.reason);
    case 'appointments': return p.appointments.some(a => has(a.customer));
    case 'pipeline': return Object.values(p.pipeline).some(rows => rows.some(r => has(r.account))) || p.accounts.handovers.some(h => has(h.account)) || has(n?.pipeline);
    case 'accounts': return p.accounts.atRisk.some(r => has(r.account)) || p.accounts.renewals.some(r => has(r.account)) || p.accounts.growth.some(r => has(r.account));
    case 'kpis': return (!!m.doc && !m.legacy) || has(n?.kpis);
    case 'priorities': return p.topPriorities.some(has);
    case 'challenges': return Object.values(p.challenges).some(has);
    case 'updates': return has(n?.updates);
    case 'commitments': return p.commitments.some(c => has(c.text));
    default: return false;
  }
}

/** Build each member's TWA for the plan week from weeklyCommitments docs (matched on the user's linked ids). */
export function buildTeamMembers(users: TeamUserLike[], docs: any[], planWeek: string, reviewWeek: string, extras: TeamExtras = {}): TeamMemberNwa[] {
  const colors = assignTeamColors(users);
  return users.map(u => {
    const ids = new Set([u.id, ...(u.linkedIds || [])]);
    const mine = docs.filter(d => ids.has(d?.userId));
    const doc = mine.find(d => d.week === planWeek) || null;
    const prevDoc = mine.find(d => d.week === reviewWeek) || null;
    const stored = mapStoredNwa(doc || {}, u.role);
    stored.commitmentReview = mergeCommitmentReview(stored.commitmentReview, previousCommitmentsFrom(prevDoc));
    const submitted = isSubmittedStatus(doc?.status);
    const open = !!extras.live && !submitted;
    if (open && extras.teamTargets !== undefined) {
      stored.kpiTargets = resolveKpiTargets(u.role, { userDoc: { nwaKpiTargets: u.nwaKpiTargets }, teamTargets: extras.teamTargets }).targets;
    }
    const twtw = (extras.twtwDocs || []).find(t => ids.has(t?.userId) && t?.week === reviewWeek) || null;
    const deals = latestDeals((extras.deals || []).filter(d => ids.has(d?.userId)));
    const sugg = pipelineSuggestions(deals, reviewWeek);
    const { plan, winsSource } = applyAutoSections(stored, {
      twtw,
      closedWonText: closedWonLines(sugg.closedWon),
      crmAppointments: crmAppointmentsForWeek(extras.crmActivities || [], planWeek, ids),
      suggestions: extras.deals ? sugg : null,
      live: open,
    });
    const notesDoc = (extras.leaderNotes || []).find(n => n?.userId === u.id && n?.week === planWeek);
    return {
      user: u,
      color: colors[u.id],
      doc,
      prevDoc,
      plan,
      prevPlan: prevDoc ? mapStoredNwa(prevDoc, u.role) : null,
      status: doc?.status || 'NOT_STARTED',
      legacy: !!doc && isLegacyFridayDoc(doc),
      winsSource,
      leaderNotes: notesDoc ? mapLeaderNotes(notesDoc) : emptyLeaderNotes(),
      late: isLateSubmission(doc),
      onTime: extras.historyWeeks?.length ? onTimeRate(mine, extras.historyWeeks) : null,
    };
  });
}
