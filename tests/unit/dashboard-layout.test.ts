import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYOUT, WIDGET_META, HISTORY_LIMIT, normalizeLayout, resolveLayout, visibleWidgets, widgetSpanClass, moveWidget,
  cleanLayout, pushHistory, normalizeHistory, type LayoutHistoryEntry,
} from '@/lib/dashboard-layout';

const ids = (l: { id: string }[]) => l.map(w => w.id);
const entry = (n: number, over: Partial<LayoutHistoryEntry> = {}): LayoutHistoryEntry => ({
  savedAt: n, savedBy: 'u', savedByName: 'U', everyone: moveWidget(DEFAULT_LAYOUT, 0, n % DEFAULT_LAYOUT.length), leaders: DEFAULT_LAYOUT, useSameLayoutForLeaders: true, ...over,
});

describe('registry', () => {
  it('has ten core widgets visible by default and the pipeline tables optional', () => {
    const core = WIDGET_META.filter(w => w.defaultVisible);
    expect(core).toHaveLength(10);
    expect(WIDGET_META.filter(w => !w.defaultVisible).map(w => w.id).sort()).toEqual(['crm-summary', 'customer-review', 'pipeline-review']);
  });
  it('has unique ids and the team snapshot is leader-only', () => {
    expect(new Set(ids(DEFAULT_LAYOUT)).size).toBe(DEFAULT_LAYOUT.length);
    expect(WIDGET_META.filter(w => w.leaderOnly).map(w => w.id)).toEqual(['team-snapshot']);
  });
  it('is Parcel only (no other-division wording)', () => {
    expect(JSON.stringify(WIDGET_META).toLowerCase()).not.toContain(['frei', 'ght'].join(''));
  });
});

describe('normalizeLayout (backwards compatible)', () => {
  it('returns the default layout for nothing stored', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout('x')).toEqual(DEFAULT_LAYOUT);
  });
  it('maps legacy ids, keeps order, drops monday-planning and unknown ids, appends new widgets', () => {
    const legacy = [
      { id: 'monday-planning', name: 'Monday', width: 3, visible: true },
      { id: 'kpi-cards', width: 2, visible: true },
      { id: 'twiw', width: 1, visible: true },
      { id: 'friday-fw', width: 1, visible: false },
      { id: 'call-prep', width: 1, visible: true },
      { id: 'voice-logger', width: 1, visible: true },
      { id: 'ambd-notes', width: 2, visible: false },
    ];
    const out = normalizeLayout(legacy);
    expect(ids(out).slice(0, 4)).toEqual(['kpi-pipeline', 'weekly-rhythm', 'call-plans', 'ambd-notes']);
    expect(ids(out)).not.toContain('monday-planning');
    expect(ids(out)).not.toContain('voice-logger');
    expect(new Set(ids(out)).size).toBe(ids(out).length);
    expect(out.find(w => w.id === 'kpi-pipeline')).toMatchObject({ width: 2, visible: true });
    // twiw visible + friday-fw hidden -> the merged widget stays visible
    expect(out.find(w => w.id === 'weekly-rhythm')!.visible).toBe(true);
    expect(out.find(w => w.id === 'ambd-notes')).toMatchObject({ width: 2, visible: false });
    // every current widget exists exactly once
    expect(ids(out).sort()).toEqual(ids(DEFAULT_LAYOUT).sort());
    // widgets that did not exist in the old layout come in with their defaults
    expect(out.find(w => w.id === 'today')).toMatchObject({ visible: true });
  });
  it('clamps bad widths and ignores junk entries', () => {
    const out = normalizeLayout([null, 5, { id: 'today', width: 9, visible: true }, { id: 'fuel', width: 0 }]);
    expect(out.find(w => w.id === 'today')!.width).toBe(3);
    expect(out.find(w => w.id === 'fuel')!.width).toBeGreaterThanOrEqual(1);
  });
});

describe('resolveLayout', () => {
  const everyone = [{ id: 'fuel', width: 1, visible: true }];
  const leaders = [{ id: 'team-snapshot', width: 3, visible: true }, { id: 'today', width: 1, visible: false }];
  it('leaders use the Everyone layout by default and when the switch is on', () => {
    expect(ids(resolveLayout({ dashboardLayout: everyone, leaderDashboardLayout: leaders }, 'leader'))[0]).toBe('fuel');
    expect(ids(resolveLayout({ dashboardLayout: everyone, leaderDashboardLayout: leaders, useSameLayoutForLeaders: true }, 'leader'))[0]).toBe('fuel');
  });
  it('leaders get their own layout only when the switch is off', () => {
    expect(ids(resolveLayout({ dashboardLayout: everyone, leaderDashboardLayout: leaders, useSameLayoutForLeaders: false }, 'leader'))[0]).toBe('team-snapshot');
  });
  it('everyone else always gets the Everyone layout', () => {
    expect(ids(resolveLayout({ dashboardLayout: everyone, leaderDashboardLayout: leaders, useSameLayoutForLeaders: false }, 'everyone'))[0]).toBe('fuel');
  });
  it('falls back to the Everyone layout if the switch is off but no leader layout exists', () => {
    expect(ids(resolveLayout({ dashboardLayout: everyone, useSameLayoutForLeaders: false }, 'leader'))[0]).toBe('fuel');
  });
});

describe('visibleWidgets / spans / move', () => {
  it('hides hidden widgets and hides leader-only widgets from non-leaders', () => {
    const l = normalizeLayout([{ id: 'team-snapshot', width: 3, visible: true }, { id: 'fuel', width: 1, visible: false }, { id: 'today', width: 3, visible: true }]);
    expect(ids(visibleWidgets(l, 'everyone'))).not.toContain('team-snapshot');
    expect(ids(visibleWidgets(l, 'leader'))).toContain('team-snapshot');
    expect(ids(visibleWidgets(l, 'leader'))).not.toContain('fuel');
  });
  it('mobile is a single column for every width', () => {
    for (const w of [1, 2, 3] as const) expect(widgetSpanClass(w).split(' ')[0]).toBe('col-span-1');
    expect(widgetSpanClass(3)).toContain('lg:col-span-3');
    expect(widgetSpanClass(1)).toBe('col-span-1');
  });
  it('moveWidget reorders without mutating and ignores bad indexes', () => {
    const a = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any[];
    expect(ids(moveWidget(a, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(ids(a)).toEqual(['a', 'b', 'c']);
    expect(moveWidget(a, 0, 9)).toBe(a);
    expect(moveWidget(a, 1, 1)).toBe(a);
  });
});

describe('version history', () => {
  it('keeps the last 5, newest first', () => {
    let h: LayoutHistoryEntry[] = [];
    for (let i = 1; i <= 8; i++) h = pushHistory(h, entry(i));
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h.map(e => e.savedAt)).toEqual([8, 7, 6, 5, 4]);
  });
  it('does not duplicate an identical consecutive save', () => {
    const h = pushHistory(pushHistory([], entry(1)), entry(2, { everyone: entry(1).everyone }));
    expect(h).toHaveLength(1);
    expect(h[0].savedAt).toBe(1);
  });
  it('stores only known, defined fields (Firestore rejects undefined)', () => {
    const h = pushHistory([], entry(1));
    expect(JSON.stringify(h)).not.toContain('undefined');
    expect(h[0].everyone.every(w => typeof w.name === 'string')).toBe(true);
    expect(cleanLayout([{ id: 'today', width: 2, visible: true, extra: 1 } as any])[0]).toEqual({ id: 'today', name: expect.any(String), width: 2, visible: true });
  });
  it('normalizeHistory tolerates junk', () => {
    expect(normalizeHistory(undefined)).toEqual([]);
    expect(normalizeHistory([null, { nope: 1 }])).toEqual([]);
    expect(normalizeHistory([entry(3)])[0].savedAt).toBe(3);
    expect(normalizeHistory(Array.from({ length: 9 }, (_, i) => entry(i)))).toHaveLength(HISTORY_LIMIT);
  });
});
