import { describe, test, expect } from 'vitest';
import {
  perthTime, quickPick, dueStatus, needsAttention, isStale, buildIcs, reminderFireAt,
  toPerthInputValue, fromPerthInputValue, ESCALATION_MS,
} from '@/lib/time-mgmt';

// Fri 16 Oct 2026, 10:00 Perth
const NOW = perthTime(2026, 10, 16, 10, 0);

describe('time-mgmt (Australia/Perth)', () => {
  test('quick picks', () => {
    expect(quickPick('today5pm', NOW)).toBe(perthTime(2026, 10, 16, 17));
    expect(quickPick('tomorrow9am', NOW)).toBe(perthTime(2026, 10, 17, 9));
    expect(quickPick('friday5pm', NOW)).toBe(perthTime(2026, 10, 16, 17));
    // After Friday 5pm → next Friday
    expect(quickPick('friday5pm', perthTime(2026, 10, 16, 18))).toBe(perthTime(2026, 10, 23, 17));
    // Monday → that Friday; month rollover
    expect(quickPick('friday5pm', perthTime(2026, 10, 26, 9))).toBe(perthTime(2026, 10, 30, 17));
    expect(quickPick('tomorrow9am', perthTime(2026, 10, 31, 9))).toBe(perthTime(2026, 11, 1, 9));
  });

  test('due status & attention', () => {
    expect(dueStatus({ dueAt: NOW - 1 }, NOW)).toBe('overdue');
    expect(dueStatus({ dueAt: perthTime(2026, 10, 16, 23, 59) }, NOW)).toBe('today');
    expect(dueStatus({ dueAt: perthTime(2026, 10, 17, 0, 0) }, NOW)).toBe('later');
    expect(dueStatus({}, NOW)).toBe(null);
    expect(needsAttention({ id: '1', text: '', dueAt: NOW - 1 }, NOW)).toBe(true);
    expect(needsAttention({ id: '1', text: '', dueAt: NOW - 1, completed: true }, NOW)).toBe(false);
  });

  test('datetime-local round-trip is Perth time', () => {
    const ms = perthTime(2026, 12, 1, 8, 30);
    expect(toPerthInputValue(ms)).toBe('2026-12-01T08:30');
    expect(fromPerthInputValue('2026-12-01T08:30')).toBe(ms);
  });

  test('reminder offsets', () => {
    const due = perthTime(2026, 10, 20, 15, 0);
    expect(reminderFireAt(due, '15m')).toBe(perthTime(2026, 10, 20, 14, 45));
    expect(reminderFireAt(due, 'morning')).toBe(perthTime(2026, 10, 20, 8, 0));
    expect(reminderFireAt(due, 'dayBefore')).toBe(perthTime(2026, 10, 19, 15, 0));
  });

  test('stale Do Now', () => {
    expect(isStale({ id: '1', text: '', quadrant: 'Q1', touchedAt: NOW - ESCALATION_MS }, NOW)).toBe(true);
    expect(isStale({ id: '1', text: '', quadrant: 'Q2', touchedAt: NOW - ESCALATION_MS }, NOW)).toBe(false);
    expect(isStale({ id: '1', text: '', quadrant: 'Q1', touchedAt: NOW - 1000 }, NOW)).toBe(false);
  });

  test('ics export', () => {
    const ics = buildIcs({ id: 'abc', text: 'Call Acme, re: rates; urgent', dueAt: perthTime(2026, 10, 16, 17) }, NOW);
    expect(ics).toContain('DTSTART:20261016T090000Z'); // 5pm AWST
    expect(ics).toContain('SUMMARY:Call Acme\\, re: rates\\; urgent');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
