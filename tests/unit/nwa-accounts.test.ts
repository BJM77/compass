import { describe, test, expect } from 'vitest';
import {
  NWA_SECTIONS, NWA_SECTIONS_AM, NWA_MEETING_MINUTES, nwaSectionsFor, isAmRole, kpiDefsFor, defaultKpiTargets, resolveKpiTargets,
  emptyNwaPlan, emptyAtRiskRow, emptyRenewalRow, emptyGrowthRow, emptyHandover, computeActuals, accountSignals, accountOptions,
  totalRevenueAtRisk, carryForwardAccounts, buildNwaPayload, mapStoredNwa, sectionComplete, focusAccountsMirror,
  strategicFocusMirror, convertLegacyFriday, legacyFridaySnapshot, isLegacyFridayDoc, businessUpdatesDocId, resolveBusinessUpdates,
} from '@/lib/nwa';
import { perthTime } from '@/lib/time-mgmt';
import { getCurrentWeek, getNwaReviewWeek, getPerthWeekKey, getWeekForDate } from '@/lib/utils';

describe('role-based sections', () => {
  test('AM agenda adds account management and still fits 45 minutes', () => {
    expect(NWA_SECTIONS_AM.map(s => s.id)).toEqual(['wins', 'appointments', 'pipeline', 'accounts', 'kpis', 'priorities', 'challenges', 'updates', 'commitments']);
    expect(NWA_SECTIONS_AM.reduce((t, s) => t + s.minutes, 0)).toBe(NWA_MEETING_MINUTES);
    expect(NWA_SECTIONS_AM.map(s => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  test('sections by role', () => {
    expect(isAmRole('ACCOUNT_MANAGER')).toBe(true);
    expect(isAmRole('AM')).toBe(true);
    expect(isAmRole('BDM')).toBe(false);
    expect(nwaSectionsFor('ACCOUNT_MANAGER')).toBe(NWA_SECTIONS_AM);
    expect(nwaSectionsFor('BDM')).toBe(NWA_SECTIONS);
  });
});

describe('role-based KPIs', () => {
  test('AM and BDM KPI sets', () => {
    const am = kpiDefsFor('ACCOUNT_MANAGER').map(k => k.key);
    const bdm = kpiDefsFor('BDM').map(k => k.key);
    expect(am).toEqual(expect.arrayContaining(['accountReviews', 'revenueRetained', 'renewals']));
    expect(bdm).toEqual(expect.arrayContaining(['calls', 'appointments', 'revenue']));
    expect(bdm).not.toContain('revenueRetained');
  });
  test('target precedence: person, team, annual target, default', () => {
    expect(resolveKpiTargets('BDM').source.callsToMake).toBe('default');
    expect(resolveKpiTargets('BDM').targets).toEqual(defaultKpiTargets('BDM'));
    const team = { byRole: { BDM: { callsToMake: 60 }, AM: { accountReviewsTarget: 12 } } };
    const r1 = resolveKpiTargets('BDM', { teamTargets: team, stats: { target: 5_200_000 } });
    expect(r1.targets.callsToMake).toBe(60);
    expect(r1.source.callsToMake).toBe('team');
    expect(r1.targets.revenueTarget).toBe(100000);
    expect(r1.source.revenueTarget).toBe('annualTarget');
    const r2 = resolveKpiTargets('BDM', { userDoc: { nwaKpiTargets: { callsToMake: 70 }, target: 1_040_000 }, teamTargets: team });
    expect(r2.targets.callsToMake).toBe(70);
    expect(r2.source.callsToMake).toBe('person');
    expect(r2.targets.revenueTarget).toBe(20000);
    const r3 = resolveKpiTargets('ACCOUNT_MANAGER', { teamTargets: team, stats: { target: 5_200_000 } });
    expect(r3.targets.accountReviewsTarget).toBe(12);
    expect(r3.source.revenueTarget).toBe('default'); // annual target only drives BDM new revenue
  });
  test('AM actuals: reviews = meetings, renewals agreed, revenue retained', () => {
    const accounts = {
      atRisk: [emptyAtRiskRow({ account: 'A', revenueAtRisk: 10000, status: 'saved' }), emptyAtRiskRow({ account: 'B', revenueAtRisk: 5000 })],
      renewals: [emptyRenewalRow({ account: 'C', value: 20000, status: 'agreed' }), emptyRenewalRow({ account: 'D', value: 9000, status: 'in_progress' })],
      growth: [], handovers: [],
    };
    const a = computeActuals({ progress: { crmApps: 6 }, activity: [], callPlanCount: 0, deals: [], accounts });
    expect(a.accountReviews).toBe(6);
    expect(a.renewals).toBe(1);
    expect(a.revenueRetained).toBe(30000);
    expect(totalRevenueAtRisk(accounts)).toBe(5000);
  });
});

describe('account signals', () => {
  const now = perthTime(2026, 10, 24, 12, 0);
  const rows = [
    { id: '1', isBareAccount: true, pipeline: 'Acme', accountMasterCode: 'AC1', ytdRevenueThisFY: 70000, ytdRevenueLastFY: 100000 },
    { id: '2', isBareAccount: true, pipeline: 'Steady', accountMasterCode: 'ST1', ytdRevenueThisFY: 100000, ytdRevenueLastFY: 100000, lastInvoiceDate: '2026-10-20' },
    { id: '3', isBareAccount: true, pipeline: 'Quiet', accountMasterCode: 'QU1', ytdRevenueThisFY: 5000, ytdRevenueLastFY: 5000, lastInvoiceDate: '2026-08-01' },
    { id: '4', pipeline: 'Deal X', opportunityName: 'Deal X', stage: 'Proposal' },
  ];
  test('flags declining and silent accounts, sorted by revenue at risk', () => {
    const s = accountSignals(rows, now);
    expect(s.map(x => x.name)).toEqual(['Acme', 'Quiet']);
    expect(s[0].revenueAtRisk).toBe(30000);
    expect(s[1].reasons.join()).toMatch(/No invoice/);
  });
  test('account picker options list CRM accounts first', () => {
    expect(accountOptions(rows)[0].name).toBe('Acme');
  });
});

describe('account management storage', () => {
  test('payload stores accounts, revenue at risk, role and mirrors', () => {
    const p = emptyNwaPlan('ACCOUNT_MANAGER');
    p.accounts.atRisk.push(emptyAtRiskRow({ account: 'Acme', revenueAtRisk: 30000, action: 'Visit' }));
    p.accounts.renewals.push(emptyRenewalRow({ account: 'Beta', value: 12000, dueDate: '2026-11-30' }));
    p.accounts.growth.push(emptyGrowthRow({ account: 'Gamma', opportunity: 'East lanes', value: 8000 }));
    p.accounts.handovers.push(emptyHandover({ account: 'Delta', fromName: 'Sam', toName: 'Alex' }));
    p.accounts.atRisk.push(emptyAtRiskRow()); // blank, dropped
    const out: any = buildNwaPayload(p, { role: 'ACCOUNT_MANAGER', kpiActuals: { calls: 3 } as any });
    expect(out.accounts.atRisk).toHaveLength(1);
    expect(out.revenueAtRisk).toBe(30000);
    expect(out.kpiRole).toBe('AM');
    expect(out.kpiActuals).toEqual({ calls: 3 });
    expect(out.pipeline.handedOver[0]).toMatchObject({ account: 'Delta' });
    expect(out.focusAccounts.map((f: any) => f.actionType)).toEqual(['At risk', 'Renewal', 'Growth']);
    expect(typeof out.strategicFocus).toBe('string');
    const back = mapStoredNwa(out, 'ACCOUNT_MANAGER');
    expect(back.accounts.handovers).toHaveLength(1);
    expect(back.pipeline.handedOver).toEqual([]);
    // Removing every handover doesn't bring back the mirror rows
    back.accounts.handovers = [];
    expect((buildNwaPayload(back) as any).pipeline.handedOver).toEqual([]);
    expect(sectionComplete(back, 'accounts', 'ACCOUNT_MANAGER')).toBe(true);
  });
  test('carry forward keeps only unresolved items', () => {
    const prev = {
      atRisk: [emptyAtRiskRow({ account: 'Open' }), emptyAtRiskRow({ account: 'Saved', status: 'saved' })],
      renewals: [emptyRenewalRow({ account: 'Due' }), emptyRenewalRow({ account: 'Done', status: 'agreed' })],
      growth: [emptyGrowthRow({ account: 'G' })],
      handovers: [emptyHandover({ account: 'H1' }), emptyHandover({ account: 'H2', status: 'complete' })],
    };
    const next = carryForwardAccounts(prev);
    expect(next.atRisk.map(r => r.account)).toEqual(['Open']);
    expect(next.renewals.map(r => r.account)).toEqual(['Due']);
    expect(next.growth.map(r => r.account)).toEqual(['G']);
    expect(next.handovers.map(r => r.account)).toEqual(['H1']);
  });
});

describe('legacy Friday FW', () => {
  const legacyDoc = {
    week: '2026-20', status: 'SUBMITTED', strategicFocus: 'Win back Acme',
    focusAccounts: [{ id: 'f1', accountName: 'Acme', actionType: 'Visit', eav: 5000, aboutAccount: 'Renewal due' }],
    actionPlan: ['Call Acme'], kpiTargets: { callsToMake: 40 },
  };
  test('focus accounts and strategic focus map onto the NWA', () => {
    const p = mapStoredNwa(legacyDoc, 'BDM');
    expect(p.pipeline.progressing[0]).toMatchObject({ account: 'Acme', value: 5000 });
    expect(p.keyFocusMetrics).toBe('Win back Acme');
  });
  test('Start NWA keeps the legacy fields as a snapshot', () => {
    expect(isLegacyFridayDoc(legacyDoc)).toBe(true);
    const { plan, legacyFriday } = convertLegacyFriday(legacyDoc, 'BDM');
    expect(legacyFriday).toEqual(legacyFridaySnapshot(legacyDoc));
    expect(legacyFriday.focusAccounts).toHaveLength(1);
    const out: any = buildNwaPayload(plan, { role: 'BDM' });
    expect(out.formVersion).toBe('NWA_V2');
    expect(isLegacyFridayDoc({ ...legacyDoc, ...out, legacyFriday })).toBe(false);
    expect(focusAccountsMirror(plan)[0].accountName).toBe('Acme');
    expect(strategicFocusMirror(plan)).toContain('Win back Acme');
  });
});

describe('business updates per week', () => {
  test('per-week doc wins, legacy byWeek is the fallback', () => {
    expect(businessUpdatesDocId('2026-31')).toBe('nwaBusinessUpdates_2026-31');
    const legacy = { byWeek: { '2026-31': { pricingChanges: 'Old' } } };
    expect(resolveBusinessUpdates(null, legacy, '2026-31').pricingChanges).toBe('Old');
    expect(resolveBusinessUpdates({ pricingChanges: 'New' }, legacy, '2026-31').pricingChanges).toBe('New');
    expect(resolveBusinessUpdates(null, null, '2026-31').pricingChanges).toBe('');
  });
});

describe('Perth week helpers', () => {
  test('week key follows the Perth calendar date, not the device timezone', () => {
    // Sunday 11:30pm Perth is still Sunday (15:30 UTC); Monday 12:30am Perth is Sunday in UTC.
    const sunLate = perthTime(2026, 10, 25, 23, 30);
    const monEarly = perthTime(2026, 10, 26, 0, 30);
    expect(getPerthWeekKey(sunLate)).toBe(getWeekForDate(new Date(2026, 9, 25)));
    expect(getPerthWeekKey(monEarly)).toBe(getWeekForDate(new Date(2026, 9, 26)));
    expect(getPerthWeekKey(monEarly)).not.toBe(getPerthWeekKey(sunLate));
    expect(getCurrentWeek()).toBe(getPerthWeekKey(Date.now()));
  });
  test('review week: Mon–Thu Perth looks back a week, Fri–Sun is this week', () => {
    const mon = new Date(perthTime(2026, 10, 26, 0, 30)); // Monday Perth, Sunday UTC
    const fri = new Date(perthTime(2026, 10, 23, 9, 0));
    expect(getNwaReviewWeek(mon)).toBe(getWeekForDate(new Date(2026, 9, 19)));
    expect(getNwaReviewWeek(fri)).toBe(getWeekForDate(new Date(2026, 9, 23)));
  });
});
