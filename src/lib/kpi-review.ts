/**
 * TWTW KPI review (twiwSubmissions.kpiReview). Saved shape:
 *   { targets: { appointments, proposals, deals, revenue, calls? }, actuals: {...}, notes }
 * Older docs may carry the flat form shape (appointmentsActual, appointmentsTarget, kpiNotes).
 * Calls are no longer a KPI and are never shown.
 */
export type KpiReviewMetric = 'appointments' | 'proposals' | 'deals' | 'revenue';

export const KPI_REVIEW_METRICS: { key: KpiReviewMetric; label: string; money?: boolean }[] = [
  { key: 'appointments', label: 'Appointments' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'deals', label: 'Wins' },
  { key: 'revenue', label: 'Revenue', money: true },
];

export interface KpiReviewRow {
  key: KpiReviewMetric;
  label: string;
  money: boolean;
  target: number;
  actual: number;
}

export interface KpiReviewView {
  rows: KpiReviewRow[];
  notes: string;
  /** True if anything worth showing was saved (a non-zero number or notes). */
  hasData: boolean;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Normalise a saved kpiReview (new nested or legacy flat shape) for display. */
export function readKpiReview(raw: any): KpiReviewView {
  if (!raw || typeof raw !== 'object') return { rows: [], notes: '', hasData: false };
  const targets = raw.targets && typeof raw.targets === 'object' ? raw.targets : {};
  const actuals = raw.actuals && typeof raw.actuals === 'object' ? raw.actuals : {};
  const rows: KpiReviewRow[] = KPI_REVIEW_METRICS.map(m => ({
    key: m.key,
    label: m.label,
    money: !!m.money,
    target: num(targets[m.key] ?? raw[`${m.key}Target`]),
    actual: num(actuals[m.key] ?? raw[`${m.key}Actual`]),
  }));
  const notes = String(raw.notes ?? raw.kpiNotes ?? '').trim();
  const hasData = !!notes || rows.some(r => r.target !== 0 || r.actual !== 0);
  return { rows, notes, hasData };
}

/** Saved kpiReview -> TWTW form fields (only the fields that were saved). */
export function kpiReviewToFormFields(raw: any): {
  appointmentsTarget?: number; proposalsTarget?: number; dealsTarget?: number; revenueTarget?: number;
  appointmentsActual?: number; proposalsActual?: number; dealsActual?: number; revenueActual?: number;
  kpiNotes?: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const targets = raw.targets && typeof raw.targets === 'object' ? raw.targets : {};
  const actuals = raw.actuals && typeof raw.actuals === 'object' ? raw.actuals : {};
  const out: Record<string, number | string> = {};
  for (const m of KPI_REVIEW_METRICS) {
    const t = targets[m.key] ?? raw[`${m.key}Target`];
    const a = actuals[m.key] ?? raw[`${m.key}Actual`];
    if (t !== undefined && t !== null) out[`${m.key}Target`] = num(t);
    if (a !== undefined && a !== null) out[`${m.key}Actual`] = num(a);
  }
  const notes = raw.notes ?? raw.kpiNotes;
  if (typeof notes === 'string') out.kpiNotes = notes;
  return Object.keys(out).length ? (out as any) : null;
}

/** Appointments actual from a saved kpiReview (either shape). */
export function kpiReviewAppointments(raw: any): number {
  return readKpiReview(raw).rows.find(r => r.key === 'appointments')?.actual || 0;
}
