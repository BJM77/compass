/**
 * Whole-team NWA helpers: one entry per team member for a plan week, built from the
 * weeklyCommitments docs (plan week + the week being reviewed), with each person's colour.
 */
import { assignTeamColors, type NwaColor } from '@/lib/nwa-colors';
import {
  type NwaPlan, type NwaSectionId,
  isLegacyFridayDoc, mapStoredNwa, mergeCommitmentReview, previousCommitmentsFrom,
} from '@/lib/nwa';


/** Minimal team-user shape (matches UnifiedTeamUser from useTeamUsers). */
export interface TeamUserLike { id: string; name: string; role: string; linkedIds: string[]; nwaColor?: string }

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
}

/** Whether a person has anything to show in a section. */
export function memberHasContent(m: TeamMemberNwa, id: NwaSectionId | 'review'): boolean {
  const p = m.plan;
  switch (id) {
    case 'review': return p.commitmentReview.length > 0;
    case 'wins': return [p.wins.customerWins, p.wins.closedOpportunities, p.wins.positiveFeedback, p.wins.teamRecognition, p.wins.shoutOut.teammate].some(has);
    case 'appointments': return p.appointments.some(a => has(a.customer));
    case 'pipeline': return Object.values(p.pipeline).some(rows => rows.some(r => has(r.account))) || p.accounts.handovers.some(h => has(h.account));
    case 'accounts': return p.accounts.atRisk.some(r => has(r.account)) || p.accounts.renewals.some(r => has(r.account)) || p.accounts.growth.some(r => has(r.account));
    case 'kpis': return !!m.doc && !m.legacy;
    case 'priorities': return p.topPriorities.some(has);
    case 'challenges': return Object.values(p.challenges).some(has);
    case 'commitments': return p.commitments.some(c => has(c.text));
    default: return false;
  }
}

/** Build each member's NWA for the plan week from weeklyCommitments docs (matched on the user's linked ids). */
export function buildTeamMembers(users: TeamUserLike[], docs: any[], planWeek: string, reviewWeek: string): TeamMemberNwa[] {
  const colors = assignTeamColors(users);
  return users.map(u => {
    const ids = new Set([u.id, ...(u.linkedIds || [])]);
    const mine = docs.filter(d => ids.has(d?.userId));
    const doc = mine.find(d => d.week === planWeek) || null;
    const prevDoc = mine.find(d => d.week === reviewWeek) || null;
    const plan = mapStoredNwa(doc || {}, u.role);
    plan.commitmentReview = mergeCommitmentReview(plan.commitmentReview, previousCommitmentsFrom(prevDoc));
    return {
      user: u,
      color: colors[u.id],
      doc,
      prevDoc,
      plan,
      prevPlan: prevDoc ? mapStoredNwa(prevDoc, u.role) : null,
      status: doc?.status || 'NOT_STARTED',
      legacy: !!doc && isLegacyFridayDoc(doc),
    };
  });
}

