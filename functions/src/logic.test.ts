import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perthTime } from './shared/time-mgmt';
import {
  withinAllowedWindow, mergePrefs, perthWeekKey, taskNotifications, digestNotification,
  deadlineWindows, DEFAULT_NUDGE_CONFIG, applyAction, tomorrow9am,
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
  const mon7 = perthTime(2026, 10, 19, 7, 0);
  assert.deepEqual(deadlineWindows('BDM', prefs, DEFAULT_NUDGE_CONFIG, thu1pm), { twtw: true, fw: false });
  assert.deepEqual(deadlineWindows('BDM', prefs, DEFAULT_NUDGE_CONFIG, fri11), { twtw: false, fw: false });
  assert.deepEqual(deadlineWindows('BDM', prefs, DEFAULT_NUDGE_CONFIG, mon7), { twtw: false, fw: true });
  assert.deepEqual(deadlineWindows('GM', prefs, DEFAULT_NUDGE_CONFIG, mon7), { twtw: false, fw: false });
  assert.deepEqual(deadlineWindows('BDM', { ...prefs, deadlineNudges: false }, DEFAULT_NUDGE_CONFIG, thu1pm), { twtw: false, fw: false });
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
