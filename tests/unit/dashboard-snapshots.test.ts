import { describe, it, expect } from 'vitest';
import { todaySnapshot, fuelSnapshot, verticalsSnapshot, topSuggested, factFindingSnapshot, canvassSnapshot, planGaps, teamSnapshot } from '@/lib/dashboard-snapshots';
import { CARRIERS } from '@/lib/fuel-surcharges';

const NOW = Date.UTC(2026, 9, 21, 4, 0); // Wed 21 Oct 2026 12:00 AWST
const H = 3_600_000;

describe('todaySnapshot', () => {
  it('splits overdue and due-today, ignoring completed and undated tasks', () => {
    const tasks: any[] = [
      { id: 'a', title: 'late', dueAt: NOW - 30 * H, completed: false },
      { id: 'b', title: 'today', dueAt: NOW + 1 * H, completed: false },
      { id: 'c', title: 'done', dueAt: NOW - 30 * H, completed: true },
      { id: 'd', title: 'later', dueAt: NOW + 72 * H, completed: false },
      { id: 'e', title: 'nodate', completed: false },
    ];
    const s = todaySnapshot(tasks, NOW);
    expect(s.overdue.map(t => t.id)).toEqual(['a']);
    expect(s.today.map(t => t.id)).toEqual(['b']);
    expect(s.total).toBe(2);
  });
});

describe('fuelSnapshot', () => {
  it('works with no data (seed docs) and never throws', () => {
    const s = fuelSnapshot(null, null);
    expect(Array.isArray(s.competitors)).toBe(true);
    expect(s.competitors.length).toBeLessThanOrEqual(4);
  });
  it('a manual override wins and the difference is vs TGE', () => {
    const comp = CARRIERS.find(c => !c.ours && !c.notPublished)!;
    const s = fuelSnapshot([], [{ id: comp.id, pct: 99 }], 20);
    const row = s.competitors.find(r => r.id === comp.id)!;
    expect(row.pct).toBe(99);
    expect(row.manual).toBe(true);
    if (s.tgePct != null) expect(row.diff).toBeCloseTo(99 - s.tgePct, 2);
  });
});

describe('verticalsSnapshot / topSuggested', () => {
  it('counts mine, new this week, pain flagged', () => {
    const day = 86_400_000;
    const ps: any[] = [
      { ownerUid: 'me', claimedAt: NOW - day, createdAt: NOW - day, lastActivityAt: NOW - day, painSignals: [] },
      { createdAt: NOW - 30 * day, painSignals: [] },
    ];
    const s = verticalsSnapshot(ps, 'me', NOW);
    expect(s.total).toBe(2);
    expect(s.claimedByMe).toBeLessThanOrEqual(1);
    expect(s.newThisWeek).toBeLessThanOrEqual(1);
  });
  it('suggests high confidence first and skips existing, dismissed and low priority', () => {
    const list = [
      { company: 'Alpha Pty Ltd', confidence: 'medium', lowPriority: false },
      { company: 'Beta Pty Ltd', confidence: 'high', lowPriority: false },
      { company: 'Gamma Pty Ltd', confidence: 'high', lowPriority: true },
      { company: 'Delta Pty Ltd', confidence: 'high', lowPriority: false },
      { company: 'Epsilon Pty Ltd', confidence: 'high', lowPriority: false },
    ];
    const out = topSuggested(list, ['Beta Pty Ltd'], c => c === 'Delta Pty Ltd', 3);
    expect(out.map(o => o.company)).toEqual(['Epsilon Pty Ltd', 'Alpha Pty Ltd']);
  });
});

describe('factFindingSnapshot', () => {
  it('counts only in-progress, non-archived, newest first', () => {
    const s = factFindingSnapshot([
      { id: '1', stage: 'New', createdAt: 1000 },
      { id: '2', stage: 'Meeting', createdAt: 3000 },
      { id: '3', stage: 'Signed', createdAt: 5000 },
      { id: '4', stage: 'Proposal Sent', isArchived: true, createdAt: 6000 },
      { id: '5', createdAt: 2000 },
    ]);
    expect(s.open).toBe(3);
    expect(s.latest.map(d => d.id)).toEqual(['2', '5', '1']);
    expect(s.byStage.find(b => b.stage === 'New')!.count).toBe(2);
  });
});

describe('canvassSnapshot', () => {
  it('counts live leads, this week and not yet in Salesforce', () => {
    const s = canvassSnapshot([
      { createdAt: NOW - H, inSalesforce: false, companyName: 'A' },
      { createdAt: NOW - 20 * 86_400_000, inSalesforce: true, companyName: 'B' },
      { createdAt: NOW - H, archived: true, inSalesforce: false },
    ], NOW);
    expect(s.total).toBe(2);
    expect(s.thisWeek).toBe(1);
    expect(s.toSync).toBe(1);
  });
});

describe('planGaps', () => {
  const deals = [
    { userId: 'me', isReviewSelected: true, pipeline: 'Acme', opportunityName: 'x', isBareAccount: true },
    { userId: 'me', isReviewSelected: true, pipeline: 'Bolt', opportunityName: 'y', isBareAccount: false },
    { userId: 'other', isReviewSelected: true, pipeline: 'Zed', isBareAccount: true },
    { userId: 'me', isReviewSelected: false, pipeline: 'Skip', isBareAccount: true },
  ];
  it('flags fact-finding without a call plan and bare accounts without white space; only my selected deals', () => {
    const s = planGaps(deals, 'me', [{ companyName: 'acme' }, { companyName: 'Bolt' }], [{ accountName: 'Bolt' }], []);
    expect(s.callPlansDue).toEqual(['Acme']);
    expect(s.whiteSpaceDue).toEqual(['Acme']);
  });
});

describe('teamSnapshot', () => {
  it('summarises submissions, sharing and CRM data health', () => {
    const s = teamSnapshot({
      teamIds: ['a', 'b', 'c'],
      twtwSubmissions: [{ userId: 'a', status: 'SUBMITTED' }, { userId: 'b', status: 'DRAFT' }, { userId: 'zzz', status: 'SUBMITTED' }],
      shares: [{ ownerId: 'a', viewerId: 'b' }, { ownerId: 'a', viewerId: 'c' }],
      lastCrmSyncMs: NOW - 10 * 86_400_000,
      now: NOW,
    });
    expect(s).toMatchObject({ teamSize: 3, twtwSubmitted: 1, shareCount: 2, sharingOwners: 1, syncAgeDays: 10, crmStale: true });
    expect(teamSnapshot({ teamIds: [], twtwSubmissions: [], shares: [], lastCrmSyncMs: NOW - H, now: NOW }).crmStale).toBe(false);
    expect(teamSnapshot({ teamIds: [], twtwSubmissions: [], shares: [], lastCrmSyncMs: null, now: NOW }).crmStale).toBe(true);
  });
});
