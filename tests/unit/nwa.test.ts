import { describe, test, expect } from 'vitest';
import {
  NWA_SECTIONS, NWA_MEETING_MINUTES, weekStartDate, nwaDueAt, nwaDueState, daysWithoutMovement, isStalledDeal,
  pipelineSuggestions, computeActuals, previousCommitmentsFrom, mergeCommitmentReview, followThroughScore,
  followThroughTrend, mapStoredNwa, buildNwaPayload, isLegacyFridayDoc, closedWonLines, businessUpdatesFor,
  parseLooseDate, emptyNwaPlan,
} from '@/lib/nwa';
import { perthTime } from '@/lib/time-mgmt';
import { getWeekForDate, getNextWeekKey } from '@/lib/utils';

describe('NWA agenda', () => {
  test('sections follow the 45-minute agenda', () => {
    expect(NWA_SECTIONS.map(s => s.id)).toEqual(['wins', 'appointments', 'pipeline', 'kpis', 'priorities', 'challenges', 'updates', 'commitments']);
    expect(NWA_SECTIONS.map(s => s.minutes)).toEqual([5, 8, 10, 5, 5, 5, 4, 3]);
    expect(NWA_SECTIONS.reduce((s, x) => s + x.minutes, 0)).toBe(NWA_MEETING_MINUTES);
  });
});

describe('NWA due dates (Australia/Perth)', () => {
  test('week start matches getWeekForDate', () => {
    const wk = getWeekForDate(new Date(2026, 9, 28, 12)); // Wed 28 Oct 2026
    expect(weekStartDate(wk)).toEqual({ year: 2026, month: 10, day: 26 });
    const first = getWeekForDate(new Date(2026, 3, 1, 12));
    expect(first).toBe('2026-01');
    expect(weekStartDate(first)).toEqual({ year: 2026, month: 3, day: 30 });
    expect(weekStartDate('bad')).toBeNull();
  });

  test('due Sunday 8pm before the planned week, overdue Monday morning', () => {
    const plan = getWeekForDate(new Date(2026, 9, 28, 12));
    expect(nwaDueAt(plan)).toBe(perthTime(2026, 10, 25, 20, 0));
    expect(nwaDueState(plan, 'DRAFT', perthTime(2026, 10, 23, 10))).toBe('open');
    expect(nwaDueState(plan, 'DRAFT', perthTime(2026, 10, 25, 9))).toBe('due_soon');
    expect(nwaDueState(plan, undefined, perthTime(2026, 10, 26, 7))).toBe('overdue');
    expect(nwaDueState(plan, 'SUBMITTED', perthTime(2026, 10, 26, 7))).toBe('submitted');
    expect(nwaDueState(plan, 'REVIEWED_BY_ADMIN', perthTime(2026, 10, 26, 7))).toBe('submitted');
  });

  test('plan week is the week after the reviewed week', () => {
    const review = getWeekForDate(new Date(2026, 9, 25, 12)); // Sunday belongs to the finishing week
    expect(getNextWeekKey(review)).toBe(getWeekForDate(new Date(2026, 9, 26, 12)));
  });
});

describe('stalled deals', () => {
  const now = perthTime(2026, 10, 26, 9);
  test('days without movement from dates or daysInStage', () => {
    expect(daysWithoutMovement({ lastSalesStageChangeDate: '2026-10-01' }, now)).toBe(25);
    expect(daysWithoutMovement({ lastActivity: '20/10/2026' }, now)).toBe(5);
    expect(daysWithoutMovement({ daysInStage: 30 }, now)).toBe(30);
    expect(daysWithoutMovement({ daysInStage: 30, lastActivity: '2026-10-24' }, now)).toBe(2);
    expect(daysWithoutMovement({}, now)).toBeNull();
  });
  test('14+ days flags open deals only', () => {
    expect(isStalledDeal({ stage: 'Proposal', daysInStage: 14 }, now)).toBe(true);
    expect(isStalledDeal({ stage: 'Proposal', daysInStage: 13 }, now)).toBe(false);
    expect(isStalledDeal({ stage: 'Closed Won', daysInStage: 40 }, now)).toBe(false);
    expect(isStalledDeal({ stage: 'Proposal' }, now)).toBe(false);
  });
  test('pipeline suggestions', () => {
    const deals = [
      { id: 'a', pipeline: 'Acme', stage: 'Proposal', value: 100, daysInStage: 20 },
      { id: 'b', pipeline: 'Beta', stage: 'Qualify', value: 500, daysInStage: 2, createdDate: '2026-10-22' },
      { id: 'c', pipeline: 'Cee', stage: 'Closed Won', value: 900, week: '2026-30' },
      { id: 'd', pipeline: 'Old win', stage: 'Closed Won', value: 50, week: '2026-20' },
    ];
    const s = pipelineSuggestions(deals, '2026-30', now);
    expect(s.stalled.map(d => d.id)).toEqual(['a']);
    expect(s.progressing.map(d => d.id)).toEqual(['b']);
    expect(s.created.map(d => d.id)).toEqual(['b']);
    expect(s.closedWon.map(d => d.id)).toEqual(['c']);
    expect(closedWonLines(s.closedWon)).toBe('Cee – $900');
  });
  test('parseLooseDate handles AU dates and timestamps', () => {
    expect(parseLooseDate('05/11/2026')?.getUTCMonth()).toBe(10);
    expect(parseLooseDate({ toDate: () => new Date(0) })?.getTime()).toBe(0);
    expect(parseLooseDate('nope')).toBeNull();
  });
});

describe('actuals', () => {
  test('takes the larger of progress and activity, revenue from Closed Won', () => {
    const a = computeActuals({
      progress: { crmCalls: 10, calls: 5, crmApps: 2, proposals: 3 },
      activity: [{ calls: 20 }, { apps: 1 }],
      callPlanCount: 4,
      deals: [{ stage: 'Closed Won', value: 1000 }, { stage: 'Proposal', value: 50 }],
    });
    expect(a).toEqual({ calls: 20, appointments: 4, proposals: 3, deals: 1, revenue: 1000 });
  });
});

describe('commitments and follow-through', () => {
  test('previous commitments from V2, V1 and legacy Friday docs', () => {
    expect(previousCommitmentsFrom({ commitments: [{ id: 'x', text: 'Call Bob', owner: 'Me', dueDate: '2026-10-28' }, { text: ' ' }] }))
      .toEqual([{ id: 'x', text: 'Call Bob', owner: 'Me', dueDate: '2026-10-28', outcome: null, note: '' }]);
    expect(previousCommitmentsFrom({ commitments: [{ text: 'Old V1', done: true }] })[0].text).toBe('Old V1');
    expect(previousCommitmentsFrom({ actionPlan: ['A', '', 'B'] }).map(c => c.text)).toEqual(['A', 'B']);
    expect(previousCommitmentsFrom(undefined)).toEqual([]);
  });
  test('merge keeps outcomes already marked', () => {
    const prev = previousCommitmentsFrom({ commitments: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }] });
    const merged = mergeCommitmentReview([{ ...prev[0], outcome: 'done', note: 'ok' }], prev);
    expect(merged.map(m => m.outcome)).toEqual(['done', null]);
  });
  test('score: done 1, partly 0.5, unmarked ignored', () => {
    const s = followThroughScore([{ outcome: 'done' }, { outcome: 'partly' }, { outcome: 'not_done' }, { outcome: null }]);
    expect(s).toEqual({ score: 50, done: 1, partly: 1, notDone: 1, reviewed: 3, total: 4 });
    expect(followThroughScore([]).score).toBeNull();
    expect(followThroughScore([{ done: true }]).score).toBe(100);
  });
  test('trend sorted by week, uses stored score', () => {
    const t = followThroughTrend([
      { week: '2026-31', followThrough: { score: 80 } },
      { week: '2026-29', commitmentReview: [{ outcome: 'done' }, { outcome: 'not_done' }] },
      { week: '2026-30' },
    ]);
    expect(t).toEqual([{ week: '2026-29', score: 50 }, { week: '2026-31', score: 80 }]);
  });
});

describe('backward compatibility', () => {
  const legacy = {
    userId: 'u1', week: '2026-20', status: 'SUBMITTED',
    focusAccounts: [{ accountName: 'Acme', actionType: 'Close', eav: 1000 }],
    kpiTargets: { callsToMake: '40', appointmentsToSet: 12, proposalsToSend: 5, dealsToClose: 2, revenueTarget: 100000 },
    actionPlan: ['P1', 'P2', 'P3', 'Extra'],
    roadblocks: 'Slow credit checks', supportNeeded: 'Pricing help', strategicFocus: 'Mining',
  };
  test('legacy Friday docs are recognised and mapped', () => {
    expect(isLegacyFridayDoc(legacy)).toBe(true);
    expect(isLegacyFridayDoc({ formVersion: 'NWA_V2', actionPlan: ['x'] })).toBe(false);
    const p = mapStoredNwa(legacy, 'BDM');
    expect(p.topPriorities).toEqual(['P1', 'P2', 'P3']);
    expect(p.commitments.map(c => c.text)).toEqual(['Extra']);
    expect(p.kpiTargets.callsToMake).toBe(40);
    expect(p.challenges.internalIssues).toBe('Slow credit checks');
    expect(p.challenges.resourcesRequired).toBe('Pricing help');
  });
  test('NWA V1 docs map (commitments without owner, pipeline note only)', () => {
    const p = mapStoredNwa({ formVersion: 'NWA_V1', commitments: [{ id: 'a', text: 'Do it', done: false }], pipeline: { stalled: [{ account: 'Z', value: 5, note: 'Budget' }] }, wins: { customerWins: 'Big one' } }, 'AM');
    expect(p.commitments[0]).toMatchObject({ id: 'a', text: 'Do it', owner: '', dueDate: '' });
    expect(p.pipeline.stalled[0]).toMatchObject({ account: 'Z', value: 5, note: 'Budget', nextStep: '' });
    expect(p.wins.shoutOut).toEqual({ teammate: '', reason: '' });
    expect(p.kpiTargets.callsToMake).toBe(30);
  });
  test('payload writes V2 plus legacy mirrors and round-trips', () => {
    const plan = emptyNwaPlan('BDM');
    plan.topPriorities = ['One', 'Two', ''];
    plan.commitments = [{ id: 'c1', text: 'Send quote', owner: 'Sam', dueDate: '2026-10-28' }, { id: 'c2', text: '', owner: '', dueDate: '' }];
    plan.challenges = { slowingProgress: 'Pricing', customerIssues: 'Late payer', internalIssues: 'Approvals', resourcesRequired: 'Solutions engineer' };
    plan.commitmentReview = [{ id: 'r', text: 'x', owner: '', dueDate: '', outcome: 'partly', note: '' }];
    plan.pipeline.progressing = [{ id: 'p', account: 'Acme', value: 10, nextStep: 'Demo', nextStepDate: '2026-10-29', note: '' }, { id: 'e', account: '', value: 0, nextStep: '', nextStepDate: '', note: '' }];
    const payload = buildNwaPayload(plan);
    expect(payload.formVersion).toBe('NWA_V2');
    expect(payload.actionPlan).toEqual(['One', 'Two', 'Send quote']);
    expect(payload.roadblocks).toBe('Pricing\nCustomer: Late payer\nInternal: Approvals');
    expect(payload.supportNeeded).toBe('Solutions engineer');
    expect(payload.commitments).toHaveLength(1);
    expect(payload.pipeline.progressing).toHaveLength(1);
    expect(payload.followThrough.score).toBe(50);
    expect(JSON.stringify(payload)).not.toContain('undefined');
    const back = mapStoredNwa(payload, 'BDM');
    expect(back.topPriorities).toEqual(['One', 'Two', '']);
    expect(back.commitments).toEqual([plan.commitments[0]]);
    expect(back.challenges).toEqual(plan.challenges);
    expect(back.commitmentReview[0].outcome).toBe('partly');
  });
  test('payload has no undefined values (Firestore rejects them)', () => {
    const hasUndefined = (v: any): boolean => v === undefined || (v && typeof v === 'object' && Object.values(v).some(hasUndefined));
    const plan = emptyNwaPlan('BDM');
    plan.appointments = [{ id: 'a', customer: 'Acme', date: '', meetingType: 'Face to face', purpose: '', desiredOutcome: '', supportRequired: '' }];
    plan.pipeline.stalled = [{ id: 's', account: 'B', value: 0, nextStep: '', nextStepDate: '', note: '' }];
    expect(hasUndefined(buildNwaPayload(plan))).toBe(false);
  });
  test('business updates by week', () => {
    const u = businessUpdatesFor({ byWeek: { '2026-31': { pricingChanges: 'Up 3%' } } }, '2026-31');
    expect(u.pricingChanges).toBe('Up 3%');
    expect(businessUpdatesFor(null, '2026-31').productUpdates).toBe('');
  });
});

describe('CRM adapters', () => {
  test('latestDeals keeps the newest weekly snapshot', async () => {
    const { latestDeals } = await import('@/lib/nwa');
    const out = latestDeals([
      { salesforceId: 'X', week: '2026-29', stage: 'Proposal' },
      { salesforceId: 'X', week: '2026-30', stage: 'Negotiation' },
      { pipeline: 'P', opportunityName: 'O', week: '2026-30' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find(d => d.salesforceId === 'X').stage).toBe('Negotiation');
  });
  test('callPlanToAppointment maps call plan fields', async () => {
    const { callPlanToAppointment } = await import('@/lib/nwa');
    expect(callPlanToAppointment({ customerName: 'Acme', date: '2026-10-27', objective: 'Renewal' }))
      .toMatchObject({ customer: 'Acme', date: '2026-10-27', purpose: 'Renewal', source: 'callPlan' });
  });
});
