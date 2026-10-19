import { describe, it, expect } from 'vitest';
import { mergeContinuousPlans, type Task } from '@/lib/time-mgmt';

const t = (id: string, over: Partial<Task> = {}): Task => ({ id, text: `task ${id}`, ...over });
const ts = (ms: number) => ({ toMillis: () => ms });

describe('mergeContinuousPlans (no weekly reset)', () => {
  const oldest = { id: 'w1', createdAt: ts(1000), tasks: [t('a', { quadrant: 'Q2', dueAt: 5, reminders: ['15m'], movedToSoonAt: 7 }), t('b', { completed: true }), t('c')] };
  const middle = { id: 'w2', createdAt: ts(2000), tasks: [t('c', { text: 'newer c', quadrant: 'Q1' }), t('d')] };
  const active = { id: 'w3', createdAt: ts(3000), tasks: [t('e')] };

  it('carries every open task from older plans into the newest plan, keeping fields', () => {
    const m = mergeContinuousPlans([oldest, active, middle]);
    expect(m.activePlanId).toBe('w3');
    expect(m.tasks.map(x => x.id)).toEqual(['e', 'c', 'd', 'a']);
    expect(m.tasks.find(x => x.id === 'a')).toMatchObject({ quadrant: 'Q2', dueAt: 5, reminders: ['15m'], movedToSoonAt: 7 });
    // newest copy of a duplicated task wins
    expect(m.tasks.find(x => x.id === 'c')).toMatchObject({ text: 'newer c', quadrant: 'Q1' });
    // completed tasks stay in their own plan
    expect(m.tasks.some(x => x.id === 'b')).toBe(false);
    expect(m.newlyCarried.sort()).toEqual(['a', 'c', 'd']);
    expect(m.carriedIds.sort()).toEqual(['a', 'c', 'd']);
  });

  it('is idempotent once persisted, and never resurrects tasks completed or deleted in the active plan', () => {
    const first = mergeContinuousPlans([oldest, middle, active]);
    // Persisted: c completed, d deleted
    const saved = { ...active, tasks: first.tasks.filter(x => x.id !== 'd').map(x => (x.id === 'c' ? { ...x, completed: true } : x)), carriedIds: first.carriedIds };
    const again = mergeContinuousPlans([oldest, middle, saved]);
    expect(again.newlyCarried).toEqual([]);
    expect(again.tasks.map(x => x.id)).toEqual(['e', 'c', 'a']);
    expect(again.tasks.find(x => x.id === 'c')?.completed).toBe(true);
  });

  it('handles no plans, a single plan, and a pending (unsaved) createdAt as newest', () => {
    expect(mergeContinuousPlans([])).toEqual({ activePlanId: null, tasks: [], carriedIds: [], newlyCarried: [] });
    expect(mergeContinuousPlans([active]).tasks.map(x => x.id)).toEqual(['e']);
    expect(mergeContinuousPlans([oldest, { id: 'new', createdAt: null, tasks: [] }]).activePlanId).toBe('new');
  });
});
