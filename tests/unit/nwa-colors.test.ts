import { describe, expect, test } from 'vitest';
import { NWA_COLORS, assignTeamColors, autoNwaColor, isNwaColorId, nwaColorById, resolveNwaColor } from '@/lib/nwa-colors';
import { buildTeamMembers, memberHasContent } from '@/lib/nwa-team';

// WCAG relative luminance / contrast
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('NWA colour palette', () => {
  test('12 unique colours including light purple, ink readable on tint', () => {
    expect(NWA_COLORS).toHaveLength(12);
    expect(new Set(NWA_COLORS.map(c => c.id)).size).toBe(12);
    expect(nwaColorById('lavender')?.label).toBe('Light purple');
    for (const c of NWA_COLORS) {
      expect(contrast(c.ink, c.tint)).toBeGreaterThanOrEqual(4.5);
      expect(lum(c.tint)).toBeGreaterThan(0.7); // light tints
    }
  });
  test('ids validate and resolve, with hashed fallback', () => {
    expect(isNwaColorId('sky')).toBe(true);
    expect(isNwaColorId('#fff')).toBe(false);
    expect(resolveNwaColor('u1', 'mint').id).toBe('mint');
    expect(resolveNwaColor('u1', 'nope')).toEqual(autoNwaColor('u1'));
    expect(autoNwaColor('abc')).toEqual(autoNwaColor('abc'));
  });
  test('team assignment: admin colours win, others avoid clashes and ignore list order', () => {
    const users = Array.from({ length: 6 }, (_, i) => ({ id: `uid${i}` }));
    const withAdmin = [{ id: 'namra', nwaColor: 'lavender' }, ...users];
    const a = assignTeamColors(withAdmin);
    const b = assignTeamColors([...withAdmin].reverse());
    expect(a.namra.id).toBe('lavender');
    expect(new Set(Object.values(a).map(c => c.id)).size).toBe(7);
    expect(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.id]))).toEqual(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.id])));
    // more people than colours still get a colour
    const many = assignTeamColors(Array.from({ length: 15 }, (_, i) => ({ id: `p${i}` })));
    expect(Object.keys(many)).toHaveLength(15);
  });
});

describe('whole-team NWA members', () => {
  const users = [
    { id: 'a', name: 'Namra', role: 'AM', linkedIds: ['a', 'a2'], nwaColor: 'lavender' },
    { id: 'b', name: 'Sam', role: 'BDM', linkedIds: ['b'] },
  ];
  const docs = [
    { userId: 'a2', week: '2026-44', status: 'SUBMITTED', formVersion: 'NWA_V2', topPriorities: ['Visit Acme', '', ''], kpiActuals: { accountReviews: 3 } },
    { userId: 'a', week: '2026-43', formVersion: 'NWA_V2', commitments: [{ id: 'c1', text: 'Send rates', owner: 'Namra', dueDate: '' }] },
    { userId: 'zz', week: '2026-44', status: 'SUBMITTED' },
  ];
  test('matches docs on linked ids, carries last week’s commitments, colours and status', () => {
    const [namra, sam] = buildTeamMembers(users, docs, '2026-44', '2026-43');
    expect(namra.color.id).toBe('lavender');
    expect(namra.status).toBe('SUBMITTED');
    expect(namra.plan.topPriorities[0]).toBe('Visit Acme');
    expect(namra.plan.commitmentReview.map(c => c.text)).toEqual(['Send rates']);
    expect(memberHasContent(namra, 'priorities')).toBe(true);
    expect(memberHasContent(namra, 'review')).toBe(true);
    expect(memberHasContent(namra, 'kpis')).toBe(true);
    expect(sam.doc).toBeNull();
    expect(sam.status).toBe('NOT_STARTED');
    expect(memberHasContent(sam, 'priorities')).toBe(false);
    expect(memberHasContent(sam, 'kpis')).toBe(false);
  });
});
