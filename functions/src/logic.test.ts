import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perthTime } from './shared/time-mgmt';
import {
  withinAllowedWindow, mergePrefs, perthWeekKey, taskNotifications, digestNotification,
  deadlineWindows, DEFAULT_NUDGE_CONFIG, applyAction, tomorrow9am, nwaWeeks, nwaSubmitted,
  notificationGate, isFwDueKey, FW_DUE_CUTOFF_HOUR,
} from './logic';

const prefs = mergePrefs({ enabled: true });

test('quiet hours: weekdays 7am-6pm Perth', () => {
  assert.equal(withinAllowedWindow(prefs, perthTime(2026, 10, 16, 7, 0)), true);   // Fri 7:00
  assert.equal(withinAllowedWindow(prefs, perthTime(2026, 10, 16, 18, 0)), false); // Fri 18:00
  assert.equal(withinAllowedWindow(prefs, perthTime(2026, 10, 16, 6, 59)), false);
  assert.equal(withinAllowedWindow(prefs, perthTime(2026, 10, 17, 10, 0)), false); // Sat
  assert.equal(withinAllowedWindow({ ...prefs, weekdaysOnly: false }, perthTime(2026, 10, 17, 10, 0)), true);
});

test('week key matches app getWeekForDate (FY weeks from Monday on/before 1 April)', () => {
  // 1 Apr 2026 is a Wednesday → week 1 starts Mon 30 Mar 2026
  assert.equal(perthWeekKey(perthTime(2026, 3, 30, 9)), '2026-01');
  assert.equal(perthWeekKey(perthTime(2026, 3, 29, 9)), '2025-52');
  assert.equal(perthWeekKey(perthTime(2026, 10, 16, 9)), '2026-29');
  // 00:30 Perth Monday is still Sunday in UTC – must use Perth day
  assert.equal(perthWeekKey(perthTime(2026, 4, 6, 0, 30)), '2026-02');
});

test('task reminders fire once window reached, newest offset only', () => {
  const due = perthTime(2026, 10, 16, 15, 0);
  const t = { id: 't1', text: 'Call Acme', quadrant: 'Q1' as const, dueAt: due, reminders: ['15m', 'morning'] as any };
  assert.equal(taskNotifications([t], prefs, perthTime(2026, 10, 16, 7, 59)).filter(n => n.kind === 'reminder').length, 0);
  const at8 = taskNotifications([t], prefs, perthTime(2026, 10, 16, 8, 0)).filter(n => n.kind === 'reminder');
  assert.equal(at8.length, 1);
  const at1446 = taskNotifications([t], prefs, perthTime(2026, 10, 16, 14, 46)).filter(n => n.kind === 'reminder');
  assert.equal(at1446.length, 1);
  assert.notEqual(at8[0].key, at1446[0].key);
  assert.equal(taskNotifications([{ ...t, completed: true }], prefs, perthTime(2026, 10, 16, 14, 46)).length, 0);
});

test('escalation for Do Now untouched 2+ days', () => {
  const now = perthTime(2026, 10, 16, 10);
  const t = { id: 'x', text: 'Old', quadrant: 'Q1' as const, touchedAt: now - 3 * 86400000 };
  assert.equal(taskNotifications([t], prefs, now).some(n => n.kind === 'escalation'), true);
  assert.equal(taskNotifications([t], { ...prefs, escalation: false }, now).some(n => n.kind === 'escalation'), false);
});

test('digest from 8am with top 3 Do Now', () => {
  const tasks = [1, 2, 3, 4].map(i => ({ id: String(i), text: `T${i}`, quadrant: 'Q1' as const }));
  assert.equal(digestNotification(tasks, prefs, perthTime(2026, 10, 16, 7, 55)), null);
  const d = digestNotification(tasks, prefs, perthTime(2026, 10, 16, 8, 0));
  assert.ok(d && d.body.includes('T3') && !d.body.includes('T4'));
  assert.equal(d!.key, 'digest_20261016');
});

test('deadline nudge windows', () => {
  const thu1pm = perthTime(2026, 10, 15, 13, 0);
  const fri11 = perthTime(2026, 10, 16, 11, 0);
  const sun4pm = perthTime(2026, 10, 18, 16, 0);
  const sun3pm = perthTime(2026, 10, 18, 15, 0);
  const mon7 = perthTime(2026, 10, 19, 7, 0);
  const allDays = { ...prefs, weekdaysOnly: false };
  assert.deepEqual(deadlineWindows('BDM', prefs, DEFAULT_NUDGE_CONFIG, thu1pm), { twtw: true, fw: false, fwDue: false });
  assert.deepEqual(deadlineWindows('BDM', prefs, DEFAULT_NUDGE_CONFIG, fri11), { twtw: false, fw: false, fwDue: false });
  assert.deepEqual(deadlineWindows('BDM', prefs, DEFAULT_NUDGE_CONFIG, mon7), { twtw: false, fw: true, fwDue: false });
  assert.deepEqual(deadlineWindows('BDM', allDays, DEFAULT_NUDGE_CONFIG, sun4pm), { twtw: false, fw: false, fwDue: true });
  assert.deepEqual(deadlineWindows('BDM', allDays, DEFAULT_NUDGE_CONFIG, sun3pm), { twtw: false, fw: false, fwDue: false });
  assert.deepEqual(deadlineWindows('GM', prefs, DEFAULT_NUDGE_CONFIG, mon7), { twtw: false, fw: false, fwDue: false });
  assert.deepEqual(deadlineWindows('BDM', { ...prefs, deadlineNudges: false }, DEFAULT_NUDGE_CONFIG, thu1pm), { twtw: false, fw: false, fwDue: false });
  assert.deepEqual(deadlineWindows('BDM', { ...prefs, deadlineNudges: false }, DEFAULT_NUDGE_CONFIG, sun4pm), { twtw: false, fw: false, fwDue: false });
});

test('NWA weeks: Sunday reminder and Monday nudge target the same plan week', () => {
  const sun4pm = perthTime(2026, 10, 18, 16, 0);
  const mon7 = perthTime(2026, 10, 19, 7, 0);
  const monWeek = perthWeekKey(mon7);
  const prevWeek = perthWeekKey(perthTime(2026, 10, 12, 9, 0));
  assert.deepEqual(nwaWeeks(sun4pm), { planWeek: monWeek, reviewWeek: prevWeek });
  assert.deepEqual(nwaWeeks(mon7), { planWeek: monWeek, reviewWeek: prevWeek });
});

test('NWA submitted detection', () => {
  assert.equal(nwaSubmitted('SUBMITTED', null), true);
  assert.equal(nwaSubmitted('REVIEWED_BY_ADMIN', null), true);
  assert.equal(nwaSubmitted('DRAFT', null), false);
  assert.equal(nwaSubmitted(null, undefined), false);
  assert.equal(nwaSubmitted(undefined, { seconds: 1 }), true);
});

test('notification actions', () => {
  const now = perthTime(2026, 10, 16, 10);
  const tasks = [{ id: 'a', text: 'A' }];
  assert.equal(applyAction(tasks, 'a', 'done', now)![0].completed, true);
  assert.equal(applyAction(tasks, 'a', 'snooze1h', now)![0].snoozedUntil, now + 3600000);
  assert.equal(applyAction(tasks, 'a', 'tomorrow', now)![0].dueAt, perthTime(2026, 10, 17, 9));
  assert.equal(tomorrow9am(now), perthTime(2026, 10, 17, 9));
  assert.equal(applyAction(tasks, 'zzz', 'done', now), null);
});

test('Sunday NWA reminder is exempt from weekdaysOnly (that nudge only), inside allowed hours', () => {
  const sun4pm = perthTime(2026, 10, 18, 16, 0);
  const sun6pm = perthTime(2026, 10, 18, 18, 0);
  const sat10 = perthTime(2026, 10, 17, 10, 0);
  const fri11 = perthTime(2026, 10, 16, 11, 0);
  assert.equal(prefs.weekdaysOnly, true);
  assert.equal(withinAllowedWindow(prefs, sun4pm), false);
  assert.equal(withinAllowedWindow(prefs, sun4pm, { ignoreWeekdaysOnly: true }), true);
  assert.equal(notificationGate(prefs, sun4pm), 'fwDueOnly');
  assert.equal(notificationGate(prefs, sat10), 'fwDueOnly'); // gate only; deadlineWindows decides the day
  assert.equal(notificationGate(prefs, sun6pm), 'none');      // after allowed hours
  assert.equal(notificationGate(prefs, fri11), 'all');
  assert.equal(notificationGate({ ...prefs, enabled: false }, sun4pm), 'none');
  // weekdaysOnly users are in the fwDue window on Sunday afternoon
  assert.deepEqual(deadlineWindows('AM', prefs, DEFAULT_NUDGE_CONFIG, sun4pm), { twtw: false, fw: false, fwDue: true });
  assert.equal(isFwDueKey('fw_due_2026-30'), true);
  assert.equal(isFwDueKey('fw_2026-29'), false);
  assert.equal(isFwDueKey('digest_20261018'), false);
});

test('Sunday NWA reminder stops before the 8pm due time', () => {
  const allDays = { ...prefs, weekdaysOnly: false, allowedEnd: '22:00' };
  assert.equal(FW_DUE_CUTOFF_HOUR < 20, true);
  assert.equal(deadlineWindows('BDM', allDays, DEFAULT_NUDGE_CONFIG, perthTime(2026, 10, 18, 18, 30)).fwDue, true);
  assert.equal(deadlineWindows('BDM', allDays, DEFAULT_NUDGE_CONFIG, perthTime(2026, 10, 18, 19, 0)).fwDue, false);
  assert.equal(deadlineWindows('BDM', allDays, DEFAULT_NUDGE_CONFIG, perthTime(2026, 10, 18, 20, 30)).fwDue, false);
});
