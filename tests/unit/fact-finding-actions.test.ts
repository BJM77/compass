import { describe, it, expect } from 'vitest';
import { perthTime, perthParts, type Task } from '@/lib/time-mgmt';
import {
  WA_PUBLIC_HOLIDAYS, isWaPublicHoliday, isPerthWorkingDay, nextWorkingDay3pm,
  buildFollowUpTask, findOpenFollowUp, followUpTitle, autoPromoteReason, displayQuadrant,
} from '@/lib/fact-finding-actions';

const P = (y: number, m: number, d: number, h = 0, min = 0) => perthTime(y, m, d, h, min);
const HOUR = 60 * 60 * 1000;

describe('WA public holidays', () => {
  it('list is valid, unique, sorted and covers 2026-2027', () => {
    expect(new Set(WA_PUBLIC_HOLIDAYS).size).toBe(WA_PUBLIC_HOLIDAYS.length);
    expect([...WA_PUBLIC_HOLIDAYS].sort()).toEqual([...WA_PUBLIC_HOLIDAYS]);
    for (const k of WA_PUBLIC_HOLIDAYS) {
      const [y, m, d] = k.split('-').map(Number);
      const p = perthParts(P(y, m, d, 12));
      expect([p.year, p.month, p.day]).toEqual([y, m, d]);
      expect(y === 2026 || y === 2027).toBe(true);
    }
    expect(WA_PUBLIC_HOLIDAYS.filter(k => k.startsWith('2026'))).toHaveLength(13);
    expect(WA_PUBLIC_HOLIDAYS.filter(k => k.startsWith('2027'))).toHaveLength(14);
  });

  it('detects holidays by Perth date', () => {
    expect(isWaPublicHoliday(P(2026, 12, 25, 9))).toBe(true);
    expect(isWaPublicHoliday(P(2026, 6, 1, 9))).toBe(true); // WA Day
    expect(isWaPublicHoliday(P(2026, 6, 2, 9))).toBe(false);
    // 2026-12-24T16:30Z is 00:30 on Christmas Day in Perth (UTC date is still the 24th)
    expect(isWaPublicHoliday(Date.UTC(2026, 11, 24, 16, 30))).toBe(true);
  });

  it('working days are Mon-Fri and not holidays', () => {
    expect(isPerthWorkingDay(P(2026, 10, 23, 12))).toBe(true); // Fri
    expect(isPerthWorkingDay(P(2026, 10, 24, 12))).toBe(false); // Sat
    expect(isPerthWorkingDay(P(2026, 10, 25, 12))).toBe(false); // Sun
    expect(isPerthWorkingDay(P(2026, 9, 28, 12))).toBe(false); // King's Birthday (Mon)
  });
});

describe('nextWorkingDay3pm', () => {
  const MON_26_OCT_3PM = P(2026, 10, 26, 15);

  it('Fri / Sat / Sun -> Monday 3pm', () => {
    expect(nextWorkingDay3pm(P(2026, 10, 23, 10))).toBe(MON_26_OCT_3PM); // Fri morning
    expect(nextWorkingDay3pm(P(2026, 10, 23, 17))).toBe(MON_26_OCT_3PM); // Fri after 3pm
    expect(nextWorkingDay3pm(P(2026, 10, 24, 11))).toBe(MON_26_OCT_3PM); // Sat
    expect(nextWorkingDay3pm(P(2026, 10, 25, 20))).toBe(MON_26_OCT_3PM); // Sun
  });

  it('Mon -> Tue 3pm, Thu -> Fri 3pm (never same day)', () => {
    expect(nextWorkingDay3pm(P(2026, 10, 26, 9))).toBe(P(2026, 10, 27, 15));
    expect(nextWorkingDay3pm(P(2026, 10, 26, 14, 59))).toBe(P(2026, 10, 27, 15));
    expect(nextWorkingDay3pm(P(2026, 10, 26, 16))).toBe(P(2026, 10, 27, 15));
    expect(nextWorkingDay3pm(P(2026, 10, 29, 9))).toBe(P(2026, 10, 30, 15));
  });

  it('result is always 15:00 Perth on a working day', () => {
    const p = perthParts(nextWorkingDay3pm(P(2026, 11, 4, 8)));
    expect([p.hour, p.minute]).toEqual([15, 0]);
    expect(p.weekday).toBeGreaterThanOrEqual(1);
    expect(p.weekday).toBeLessThanOrEqual(5);
  });

  it('skips WA public holidays', () => {
    // Fri 25 Sep 2026 -> Mon 28 Sep King's Birthday -> Tue 29 Sep
    expect(nextWorkingDay3pm(P(2026, 9, 25, 10))).toBe(P(2026, 9, 29, 15));
    // Fri 29 May 2026 -> Mon 1 Jun WA Day -> Tue 2 Jun
    expect(nextWorkingDay3pm(P(2026, 5, 29, 10))).toBe(P(2026, 6, 2, 15));
    // Thu 24 Dec 2026 -> Fri 25, Sat, Sun, Mon 28 (Boxing Day sub) -> Tue 29 Dec
    expect(nextWorkingDay3pm(P(2026, 12, 24, 10))).toBe(P(2026, 12, 29, 15));
    // Thu 31 Dec 2026 -> Fri 1 Jan 2027 -> Mon 4 Jan 2027 (year rollover)
    expect(nextWorkingDay3pm(P(2026, 12, 31, 10))).toBe(P(2027, 1, 4, 15));
    // Thu 25 Mar 2027 -> Good Fri 26, Easter Mon 29 -> Tue 30 Mar
    expect(nextWorkingDay3pm(P(2027, 3, 25, 10))).toBe(P(2027, 3, 30, 15));
    // Fri 24 Dec 2027 -> Mon 27 + Tue 28 substitutes -> Wed 29 Dec
    expect(nextWorkingDay3pm(P(2027, 12, 24, 10))).toBe(P(2027, 12, 29, 15));
  });

  it('uses the Perth calendar day, not UTC', () => {
    // Sun 25 Oct 23:59 Perth (15:59Z) -> Monday
    expect(nextWorkingDay3pm(Date.UTC(2026, 9, 25, 15, 59))).toBe(MON_26_OCT_3PM);
    // Mon 26 Oct 00:00 Perth (still Sunday 16:00Z in UTC) -> Tuesday
    expect(nextWorkingDay3pm(Date.UTC(2026, 9, 25, 16, 0))).toBe(P(2026, 10, 27, 15));
    // 3pm Perth is 07:00Z
    expect(MON_26_OCT_3PM).toBe(Date.UTC(2026, 9, 26, 7, 0));
  });
});

describe('follow-up task', () => {
  const now = P(2026, 10, 23, 10); // Fri
  const task = buildFollowUpTask({ factFindingId: 'ff1', companyName: 'Acme Pty Ltd', assignedBy: 'lead1', assignedByName: 'Ben' }, now);

  it('builds a held Do Soon task due 3pm next working day', () => {
    expect(task.text).toBe('Follow up: Acme Pty Ltd Fact Finding');
    expect(task.quadrant).toBe('Q2');
    expect(task.completed).toBe(false);
    expect(task.dueAt).toBe(P(2026, 10, 26, 15));
    expect(task.reminders).toEqual(['15m']);
    expect(task.holdUntilDue).toBe(true);
    expect(task.factFindingId).toBe('ff1');
    expect(task.assignedBy).toBe('lead1');
    expect(task.movedToSoonAt).toBeUndefined();
    expect(Object.values(task).some(v => v === undefined)).toBe(false);
  });

  it('titles unnamed customers', () => {
    expect(followUpTitle('  ')).toBe('Follow up: Unnamed customer Fact Finding');
  });

  it('finds only an open follow-up for the same record', () => {
    const other: Task = { id: 'x', text: 'x', quadrant: 'Q2' };
    expect(findOpenFollowUp([other], 'ff1')).toBeNull();
    expect(findOpenFollowUp([other, task], 'ff1')?.id).toBe(task.id);
    expect(findOpenFollowUp([{ ...task, completed: true }], 'ff1')).toBeNull();
    expect(findOpenFollowUp([task], 'ff2')).toBeNull();
  });

  it('held task stays in Do Soon until 3pm on the due day, then goes to Do Now', () => {
    expect(autoPromoteReason(task, P(2026, 10, 24, 9))).toBeNull();
    expect(autoPromoteReason(task, P(2026, 10, 26, 9))).toBeNull(); // due today, but held
    expect(autoPromoteReason(task, P(2026, 10, 26, 14, 59))).toBeNull();
    expect(autoPromoteReason(task, P(2026, 10, 26, 15))).toBe('due');
    expect(autoPromoteReason({ ...task, movedToSoonAt: now - 48 * HOUR }, P(2026, 10, 26, 9))).toBeNull();
    expect(autoPromoteReason({ ...task, completed: true }, P(2026, 10, 27, 9))).toBeNull();
    expect(displayQuadrant(task, P(2026, 10, 26, 14))).toBe('Q2');
    expect(displayQuadrant(task, P(2026, 10, 26, 15, 1))).toBe('Q1');
  });

  it('keeps existing rules for normal tasks', () => {
    const at = P(2026, 10, 26, 9);
    expect(autoPromoteReason({ id: 'a', text: 'a', quadrant: 'Q2', dueAt: P(2026, 10, 26, 17) }, at)).toBe('due');
    expect(autoPromoteReason({ id: 'b', text: 'b', quadrant: 'Q2', movedToSoonAt: at - 25 * HOUR }, at)).toBe('stale');
    expect(autoPromoteReason({ id: 'c', text: 'c', quadrant: 'Q2', movedToSoonAt: at - 23 * HOUR }, at)).toBeNull();
    expect(autoPromoteReason({ id: 'd', text: 'd', quadrant: 'Q1', dueAt: at - HOUR }, at)).toBeNull();
    expect(displayQuadrant({ id: 'e', text: 'e', quadrant: 'Q3', dueAt: at - HOUR }, at)).toBe('Q3');
  });
});
