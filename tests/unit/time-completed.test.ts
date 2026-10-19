import { describe, it, expect } from 'vitest';
import {
  perthPeriodStart, inCompletedPeriod, formatCompletedAt, completedDayLabel, completeTask, uncompleteTask,
  allCompletedTasks, mergeContinuousPlans, perthTime, type Task,
} from '@/lib/time-mgmt';

// Mon 19 Oct 2026 12:41 Perth
const NOW = perthTime(2026, 10, 19, 12, 41);
const done = (id: string, at: number | null): Task => ({ id, text: id, completed: true, completedAt: at });

describe('Perth period boundaries', () => {
  it('today / week (Monday) / month / year start at Perth midnight', () => {
    expect(perthPeriodStart('today', NOW)).toBe(Date.UTC(2026, 9, 18, 16)); // 19 Oct 00:00 AWST
    expect(perthPeriodStart('week', NOW)).toBe(perthTime(2026, 10, 19)); // Monday itself
    expect(perthPeriodStart('week', perthTime(2026, 10, 25, 23, 59))).toBe(perthTime(2026, 10, 19)); // Sunday → previous Monday
    expect(perthPeriodStart('month', NOW)).toBe(perthTime(2026, 10, 1));
    expect(perthPeriodStart('year', NOW)).toBe(perthTime(2026, 1, 1));
  });
  it('filters across the boundaries (incl. UTC-day vs Perth-day edge)', () => {
    const justBeforeToday = perthTime(2026, 10, 18, 23, 59); // Sun 23:59 Perth (= Sun 15:59 UTC)
    const justAfterMidnight = perthTime(2026, 10, 19, 0, 1); // Mon 00:01 Perth (= Sun 16:01 UTC)
    expect(inCompletedPeriod(done('a', justAfterMidnight), 'today', NOW)).toBe(true);
    expect(inCompletedPeriod(done('b', justBeforeToday), 'today', NOW)).toBe(false);
    expect(inCompletedPeriod(done('b', justBeforeToday), 'week', NOW)).toBe(false); // previous week
    expect(inCompletedPeriod(done('b', justBeforeToday), 'month', NOW)).toBe(true);
    expect(inCompletedPeriod(done('c', perthTime(2026, 9, 30, 23, 59)), 'month', NOW)).toBe(false);
    expect(inCompletedPeriod(done('c', perthTime(2026, 9, 30, 23, 59)), 'year', NOW)).toBe(true);
    expect(inCompletedPeriod(done('d', perthTime(2025, 12, 31, 23, 59)), 'year', NOW)).toBe(false);
    // unknown date: only under All; open tasks never
    expect(inCompletedPeriod(done('e', null), 'year', NOW)).toBe(false);
    expect(inCompletedPeriod(done('e', null), 'all', NOW)).toBe(true);
    expect(inCompletedPeriod({ id: 'f', text: 'f' }, 'all', NOW)).toBe(false);
  });
  it('formats completed time and day groups in Perth', () => {
    expect(formatCompletedAt(NOW)).toBe('Mon 19 Oct 2026, 12:41 pm WST');
    expect(formatCompletedAt(perthTime(2026, 10, 19, 0, 5))).toBe('Mon 19 Oct 2026, 12:05 am WST');
    expect(completedDayLabel(done('x', NOW))).toBe('Monday 19 October 2026');
    expect(completedDayLabel(done('y', null))).toBe('Completed (date unknown)');
  });
});

describe('complete / restore and persistence across the continuous plan', () => {
  it('tick stamps completedAt + remembers quadrant; un-tick restores it', () => {
    const c = completeTask({ id: 't', text: 't', quadrant: 'Q2' }, NOW);
    expect(c).toMatchObject({ completed: true, completedAt: NOW, completedFromQuadrant: 'Q2' });
    expect(uncompleteTask(c, NOW + 1)).toMatchObject({ completed: false, completedAt: null, quadrant: 'Q2', completedFromQuadrant: null });
  });
  it('completed tasks from all plans are listed (newest copy wins), never carried as open', () => {
    const old = { id: 'p1', createdAt: { toMillis: () => 1 }, tasks: [done('old-done', NOW - 5e8), { id: 'x', text: 'x' }, done('legacy', null)] };
    const act = { id: 'p2', createdAt: { toMillis: () => 2 }, tasks: [done('x', NOW)] };
    expect(mergeContinuousPlans([old, act]).tasks.map(t => t.id)).toEqual(['x']); // completed x not re-opened
    expect(allCompletedTasks([old, act]).map(t => t.id)).toEqual(['x', 'old-done', 'legacy']);
  });
});
