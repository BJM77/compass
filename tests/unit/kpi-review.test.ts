import { describe, it, expect } from 'vitest';
import { readKpiReview, kpiReviewToFormFields, kpiReviewAppointments } from '@/lib/kpi-review';

describe('kpi review', () => {
  const saved = {
    targets: { calls: 50, appointments: 5, proposals: 2, deals: 1, revenue: 20000 },
    actuals: { calls: 40, appointments: 4, proposals: 3, deals: 0, revenue: 15000 },
    notes: ' Slow week ',
  };
  it('reads the nested saved shape without calls', () => {
    const v = readKpiReview(saved);
    expect(v.rows.map(r => r.key)).toEqual(['appointments', 'proposals', 'deals', 'revenue']);
    expect(v.rows[0]).toMatchObject({ target: 5, actual: 4 });
    expect(v.notes).toBe('Slow week');
    expect(v.hasData).toBe(true);
  });
  it('reads the legacy flat shape', () => {
    expect(kpiReviewAppointments({ appointmentsActual: 7, kpiNotes: 'x' })).toBe(7);
    expect(kpiReviewAppointments(saved)).toBe(4);
  });
  it('handles empty values', () => {
    expect(readKpiReview(null).hasData).toBe(false);
    expect(readKpiReview({ targets: {}, actuals: {}, notes: '' }).hasData).toBe(false);
  });
  it('maps saved values back to form fields', () => {
    expect(kpiReviewToFormFields(saved)).toEqual({
      appointmentsTarget: 5, appointmentsActual: 4, proposalsTarget: 2, proposalsActual: 3,
      dealsTarget: 1, dealsActual: 0, revenueTarget: 20000, revenueActual: 15000, kpiNotes: ' Slow week ',
    });
    expect(kpiReviewToFormFields(undefined)).toBeNull();
  });
});
