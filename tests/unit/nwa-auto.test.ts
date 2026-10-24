import { describe, test, expect } from 'vitest';
import {
  emptyNwaPlan, requiredSectionsFor, requiredProgress, weekDateRange, crmAppointmentsForWeek, winsFromTwtw, applyAutoSections,
  isLateSubmission, onTimeRate, recentWeeks, nwaDueAt, mapLeaderNotes, teamLeaderNotes, hasLeaderNotes, latestCrmUploadMs,
} from '@/lib/nwa';
import { buildTeamMembers, memberHasContent } from '@/lib/nwa-team';
import { getWeekForDate, getPreviousWeekKey } from '@/lib/utils';

const week = getWeekForDate(new Date(2026, 9, 28, 12)); // week of Mon 26 Oct 2026

describe('rep-required sections', () => {
  test('only commitments, top 3 priorities and shout out are required', () => {
    expect(requiredSectionsFor('BDM').map(s => s.id).sort()).toEqual(['commitments', 'priorities', 'shoutout']);
    expect(requiredSectionsFor('ACCOUNT_MANAGER').map(s => s.id).sort()).toEqual(['commitments', 'priorities', 'shoutout']);
  });
  test('progress counts only the required sections', () => {
    const p = emptyNwaPlan();
    expect(requiredProgress(p).pct).toBe(0);
    p.topPriorities = ['a', 'b', 'c'];
    p.commitments = [{ id: 'c', text: 'Send rates', owner: '', dueDate: '' }];
    const r1 = requiredProgress(p);
    expect(r1.missing.map(s => s.id)).toEqual(['shoutout']);
    p.wins.shoutOut = { teammate: 'Sam', reason: 'Covered my run' };
    expect(requiredProgress(p).pct).toBe(100); // challenges and auto sections empty, still complete
  });
});

describe('appointments from Salesforce APP activities', () => {
  test('week range is Monday to Sunday', () => {
    expect(weekDateRange(week)).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
  test('filters APP rows in the week for the user, dedupes', () => {
    const acts = [
      { id: '1', userId: 'u', type: 'APP', date: '2026-10-26T00:00:00+08:00', companyName: 'Acme', subject: 'Rates' },
      { id: '2', userId: 'u', type: 'APP', date: '2026-11-01T00:00:00+08:00', companyName: 'Beta', subject: '' },
      { id: '3', userId: 'u', type: 'CALL', date: '2026-10-27T00:00:00+08:00', companyName: 'Call Co' },
      { id: '4', userId: 'u', type: 'APP', date: '2026-11-02T00:00:00+08:00', companyName: 'Next week' },
      { id: '5', userId: 'x', type: 'APP', date: '2026-10-27T00:00:00+08:00', companyName: 'Other rep' },
      { id: '6', userId: 'u', type: 'APP', date: '2026-10-26T00:00:00+08:00', companyName: 'Acme', subject: 'Rates' },
    ];
    const rows = crmAppointmentsForWeek(acts, week, ['u']);
    expect(rows.map(r => [r.customer, r.date])).toEqual([['Acme', '2026-10-26'], ['Beta', '2026-11-01']]);
    expect(rows.every(r => r.source === 'crm')).toBe(true);
  });
  test('latest upload prefers appSettings/global.lastCrmSync', () => {
    expect(latestCrmUploadMs(1000, [])).toBe(1000);
    expect(latestCrmUploadMs(null, [])).toBeNull();
  });
});

describe('wins from TWTW', () => {
  test('maps the TWTW fields, keeps the shout out', () => {
    const stored = { ...emptyNwaPlan().wins, shoutOut: { teammate: 'Sam', reason: 'x' } };
    const { wins, source } = winsFromTwtw({ wins: [{ customer: 'Acme', value: 5000, updateText: 'Won lane' }, { customer: 'Hidden', isHidden: true }], positiveFeedback: 'Great', teamRecognition: 'Jo' }, 'Deal A', stored);
    expect(source).toBe('twtw');
    expect(wins.customerWins).toBe('Acme – $5,000: Won lane');
    expect(wins.closedOpportunities).toBe('Deal A');
    expect(wins.positiveFeedback).toBe('Great');
    expect(wins.teamRecognition).toBe('Jo');
    expect(wins.shoutOut.teammate).toBe('Sam');
  });
  test('old typed wins stay readable without a TWTW', () => {
    const stored = { ...emptyNwaPlan().wins, customerWins: 'Old win' };
    expect(winsFromTwtw(null, '', stored).source).toBe('stored');
    expect(winsFromTwtw(null, '', emptyNwaPlan().wins).source).toBe('none');
  });
});

describe('applyAutoSections', () => {
  test('live CRM appointments replace the stored snapshot, old manual rows kept', () => {
    const p = emptyNwaPlan();
    p.appointments = [
      { id: 'm', customer: 'Manual', date: '2026-10-27', meetingType: 'Visit', purpose: '', desiredOutcome: '', supportRequired: '' },
      { id: 'old', customer: 'Stale', date: '2026-10-27', meetingType: '', purpose: '', desiredOutcome: '', supportRequired: '', source: 'crm' },
    ] as any;
    const crm = crmAppointmentsForWeek([{ id: '1', userId: 'u', type: 'APP', date: '2026-10-28T00:00:00+08:00', companyName: 'Acme' }], week);
    const { plan } = applyAutoSections(p, { crmAppointments: crm });
    expect(plan.appointments.map(a => a.customer)).toEqual(['Acme', 'Manual']);
    const kept = applyAutoSections(p, { crmAppointments: [] }).plan;
    expect(kept.appointments.map(a => a.customer)).toEqual(['Stale', 'Manual']);
  });
});

describe('timeliness', () => {
  test('late flag, else submittedAt after due', () => {
    expect(isLateSubmission({ status: 'SUBMITTED', submittedLate: true })).toBe(true);
    expect(isLateSubmission({ status: 'DRAFT', submittedLate: true })).toBe(false);
    const due = nwaDueAt(week)!;
    expect(isLateSubmission({ status: 'SUBMITTED', week, submittedAt: due + 60_000 })).toBe(true);
    expect(isLateSubmission({ status: 'SUBMITTED', week, submittedAt: due - 60_000 })).toBe(false);
  });
  test('8-week on-time rate counts missing weeks as missed', () => {
    const weeks = recentWeeks(week, 8, getPreviousWeekKey);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toBe(week); // oldest first
    const docs = [
      { week: weeks[7], status: 'SUBMITTED', submittedLate: false },
      { week: weeks[6], status: 'SUBMITTED', submittedLate: true },
      { week: weeks[5], status: 'SUBMITTED', submittedLate: false },
      { week: weeks[5], status: 'DRAFT' },
    ];
    expect(onTimeRate(docs, weeks)).toEqual({ onTime: 2, late: 1, missed: 5, total: 8, pct: 25 });
  });
});

describe('leader notes', () => {
  test('team notes from the business updates doc, per-person from nwaLeaderNotes', () => {
    expect(teamLeaderNotes({ teamPipeline: 'Handover Acme to Sam', teamKpis: '' }).pipeline).toBe('Handover Acme to Sam');
    expect(hasLeaderNotes(mapLeaderNotes({ kpis: 'Push calls' }))).toBe(true);
    expect(hasLeaderNotes(mapLeaderNotes(null))).toBe(false);
  });
  test('team members pick up TWTW wins, CRM appointments, notes and late flag', () => {
    const users = [{ id: 'u', name: 'Sam', role: 'BDM', linkedIds: ['u'] }];
    const prev = getPreviousWeekKey(week);
    const [m] = buildTeamMembers(users, [{ userId: 'u', week, status: 'SUBMITTED', submittedLate: true, wins: { shoutOut: { teammate: 'Jo', reason: 'help' } } }], week, prev, {
      twtwDocs: [{ userId: 'u', week: prev, positiveFeedback: 'Nice' }],
      crmActivities: [{ id: '1', userId: 'u', type: 'APP', date: '2026-10-28T00:00:00+08:00', companyName: 'Acme' }],
      leaderNotes: [{ userId: 'u', week, updates: 'Well done' }],
      historyWeeks: [prev],
    });
    expect(m.winsSource).toBe('twtw');
    expect(m.plan.wins.positiveFeedback).toBe('Nice');
    expect(m.plan.appointments.map(a => a.customer)).toEqual(['Acme']);
    expect(memberHasContent(m, 'shoutout')).toBe(true);
    expect(memberHasContent(m, 'updates')).toBe(true);
    expect(m.late).toBe(true);
    expect(m.onTime?.missed).toBe(1);
  });
});
