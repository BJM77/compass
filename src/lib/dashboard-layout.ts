/**
 * Dashboard layout model (pure logic, no React / Firebase).
 *
 * Stored in `appSettings/global` (admin-only write, staff read):
 *   dashboardLayout            – layout used by everyone (BDM + Account Manager, and Leaders when "same")
 *   leaderDashboardLayout      – separate layout for Leaders (used only when useSameLayoutForLeaders === false)
 *   useSameLayoutForLeaders    – default true
 *   dashboardLayoutHistory     – last few saved layouts (newest first) for "Restore"
 *
 * Older documents stored `dashboardLayout` with 17 legacy widget ids (and names). Those are mapped
 * onto the current ids by `normalizeLayout`; legacy widgets with no equivalent are dropped.
 */

export type WidthCols = 1 | 2 | 3;

export type WidgetId =
  | 'today'
  | 'kpi-pipeline'
  | 'weekly-rhythm'
  | 'verticals'
  | 'fuel'
  | 'fact-finding'
  | 'canvassing'
  | 'call-plans'
  | 'ambd-notes'
  | 'team-snapshot'
  | 'crm-summary'
  | 'customer-review'
  | 'pipeline-review';

export interface DashboardWidgetConfig {
  id: string;
  /** Display name. Written for compatibility with older app versions that read `name`; the registry title is what renders. */
  name?: string;
  width: WidthCols;
  visible: boolean;
}

export interface WidgetMeta {
  id: WidgetId;
  title: string;
  description: string;
  defaultWidth: WidthCols;
  defaultVisible: boolean;
  /** Only rendered for Leaders (LEADER / GM / ADMIN / SUPER_ADMIN). Still positionable in the Everyone layout. */
  leaderOnly?: boolean;
  /** Where the widget links to (DashboardView in navigation.ts). */
  view?: string;
}

/** Registry order = default order. */
export const WIDGET_META: WidgetMeta[] = [
  { id: 'today', title: 'Today', description: 'Overdue and due-today tasks from Manage Time.', defaultWidth: 3, defaultVisible: true, view: 'MANAGE_TIME' },
  { id: 'kpi-pipeline', title: 'Revenue & Pipeline', description: 'Revenue YTD, weighted forecast, strategic yield and velocity pulse (Leaders see team totals).', defaultWidth: 3, defaultVisible: true },
  { id: 'weekly-rhythm', title: 'Weekly Rhythm', description: 'Thursday TWTW and Monday This Week’s Activities (TWA) status.', defaultWidth: 2, defaultVisible: true, view: 'TWIW' },
  { id: 'ambd-notes', title: 'AM/BD Notes', description: 'Notes from your AM/BD partner or leader.', defaultWidth: 1, defaultVisible: true },
  { id: 'verticals', title: 'Verticals Prospecting', description: 'New, claimed and pain-flagged prospects plus top suggested WA targets.', defaultWidth: 2, defaultVisible: true, view: 'VERTICALS' },
  { id: 'fuel', title: 'Fuel Surcharges', description: 'TGE vs competitor fuel surcharge, and when it was last checked.', defaultWidth: 1, defaultVisible: true, view: 'FUEL_SURCHARGES' },
  { id: 'fact-finding', title: 'Fact Finding in Progress', description: 'Open fact finds by stage, most recently updated first.', defaultWidth: 1, defaultVisible: true, view: 'FACT_FINDING' },
  { id: 'canvassing', title: 'Canvassing Leads', description: 'Leads captured this week and leads not yet in Salesforce.', defaultWidth: 1, defaultVisible: true, view: 'CANVASSING' },
  { id: 'call-plans', title: 'Call Plans & White Space', description: 'Top-8 accounts that still need a call plan or white space diagnostic.', defaultWidth: 1, defaultVisible: true, view: 'CALL_PLANNING' },
  { id: 'team-snapshot', title: 'Team Snapshot', description: 'Leaders only: TWTW submitted, shared access and CRM data freshness.', defaultWidth: 3, defaultVisible: true, leaderOnly: true },
  { id: 'crm-summary', title: 'CRM Summary', description: 'Opportunity and customer revenue summary (optional, off by default).', defaultWidth: 3, defaultVisible: false },
  { id: 'customer-review', title: 'Customers Table', description: 'Customer pipeline review table (optional, off by default).', defaultWidth: 3, defaultVisible: false },
  { id: 'pipeline-review', title: 'Opportunities Table', description: 'Opportunities table with AI Deal Whisperer (optional, off by default).', defaultWidth: 3, defaultVisible: false },
];

export const WIDGET_IDS = WIDGET_META.map(w => w.id) as string[];
export const widgetMeta = (id: string): WidgetMeta | undefined => WIDGET_META.find(w => w.id === id);

export const DEFAULT_LAYOUT: DashboardWidgetConfig[] = WIDGET_META.map(w => ({ id: w.id, width: w.defaultWidth, visible: w.defaultVisible }));

/** Old widget ids -> current ids. Legacy ids not listed here are dropped. */
export const LEGACY_ID_MAP: Record<string, WidgetId> = {
  'kpi-cards': 'kpi-pipeline',
  'twiw': 'weekly-rhythm',
  'friday-fw': 'weekly-rhythm',
  'call-prep': 'call-plans',
  'ambd-notes': 'ambd-notes',
  'crm-summary': 'crm-summary',
  'customer-review': 'customer-review',
  'pipeline-review': 'pipeline-review',
};

const clampWidth = (w: unknown): WidthCols => (w === 1 || w === 2 || w === 3 ? w : 3);

/**
 * Turn whatever is stored (undefined, legacy array, current array) into a clean layout that
 * contains every current widget exactly once. Order is preserved; unknown ids are dropped;
 * widgets missing from the stored layout are appended with their defaults.
 */
export function normalizeLayout(raw: unknown): DashboardWidgetConfig[] {
  const out: DashboardWidgetConfig[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const rawId = String((item as any).id ?? '');
      const id = WIDGET_IDS.includes(rawId) ? rawId : LEGACY_ID_MAP[rawId];
      if (!id) continue;
      const meta = widgetMeta(id)!;
      if (seen.has(id)) {
        // Several legacy widgets can map to one (twiw + friday-fw): visible if any was visible.
        if (rawId !== id && (item as any).visible === true) out.find(w => w.id === id)!.visible = true;
        continue;
      }
      seen.add(id);
      out.push({
        id,
        width: (item as any).width === undefined ? meta.defaultWidth : clampWidth((item as any).width),
        visible: typeof (item as any).visible === 'boolean' ? (item as any).visible : meta.defaultVisible,
      });
    }
  }
  for (const meta of WIDGET_META) {
    if (!seen.has(meta.id)) out.push({ id: meta.id, width: meta.defaultWidth, visible: meta.defaultVisible });
  }
  return out;
}

export interface DashboardLayoutSettings {
  dashboardLayout?: unknown;
  leaderDashboardLayout?: unknown;
  useSameLayoutForLeaders?: boolean;
}

export type Audience = 'everyone' | 'leader';

/** Which layout a viewer gets. Leaders get their own only when the switch is explicitly off. */
export function resolveLayout(settings: DashboardLayoutSettings | null | undefined, audience: Audience): DashboardWidgetConfig[] {
  const same = settings?.useSameLayoutForLeaders !== false;
  if (audience === 'leader' && !same && settings?.leaderDashboardLayout) return normalizeLayout(settings.leaderDashboardLayout);
  return normalizeLayout(settings?.dashboardLayout);
}

/** Widgets to render for an audience: visible, and leader-only ones only for leaders. */
export function visibleWidgets(layout: DashboardWidgetConfig[], audience: Audience): DashboardWidgetConfig[] {
  return layout.filter(w => w.visible && !(widgetMeta(w.id)?.leaderOnly && audience !== 'leader'));
}

/**
 * Column spans. Mobile is always a single column (same order); md = 2 columns; lg = 3 columns.
 * Full class strings so Tailwind keeps them.
 */
export function widgetSpanClass(width: WidthCols): string {
  if (width === 3) return 'col-span-1 md:col-span-2 lg:col-span-3';
  if (width === 2) return 'col-span-1 md:col-span-2 lg:col-span-2';
  return 'col-span-1';
}

export function moveWidget(layout: DashboardWidgetConfig[], from: number, to: number): DashboardWidgetConfig[] {
  if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) return layout;
  const next = [...layout];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ─── Version history ────────────────────────────────────────────────────────

export const HISTORY_LIMIT = 5;

export interface LayoutHistoryEntry {
  savedAt: number; // epoch ms
  savedBy: string; // uid
  savedByName: string;
  everyone: DashboardWidgetConfig[];
  leaders: DashboardWidgetConfig[];
  useSameLayoutForLeaders: boolean;
}

/** Firestore rejects `undefined`; keep only the known fields. */
export const cleanLayout = (l: DashboardWidgetConfig[]): DashboardWidgetConfig[] =>
  l.map(w => ({ id: w.id, name: widgetMeta(w.id)?.title ?? w.id, width: clampWidth(w.width), visible: !!w.visible }));

const sameLayout = (a: DashboardWidgetConfig[], b: DashboardWidgetConfig[]) => JSON.stringify(cleanLayout(a)) === JSON.stringify(cleanLayout(b));

export function normalizeHistory(raw: unknown): LayoutHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e: any) => e && typeof e === 'object' && Array.isArray(e.everyone))
    .map((e: any) => ({
      savedAt: Number(e.savedAt) || 0,
      savedBy: String(e.savedBy || ''),
      savedByName: String(e.savedByName || ''),
      everyone: normalizeLayout(e.everyone),
      leaders: normalizeLayout(e.leaders ?? e.everyone),
      useSameLayoutForLeaders: e.useSameLayoutForLeaders !== false,
    }))
    .slice(0, HISTORY_LIMIT);
}

/** Prepend a saved layout (newest first), skipping an identical consecutive save, capped at HISTORY_LIMIT. */
export function pushHistory(history: LayoutHistoryEntry[], entry: LayoutHistoryEntry): LayoutHistoryEntry[] {
  const top = history[0];
  const clean: LayoutHistoryEntry = { ...entry, everyone: cleanLayout(entry.everyone), leaders: cleanLayout(entry.leaders) };
  if (top && sameLayout(top.everyone, clean.everyone) && sameLayout(top.leaders, clean.leaders) && top.useSameLayoutForLeaders === clean.useSameLayoutForLeaders) {
    return history.slice(0, HISTORY_LIMIT);
  }
  return [clean, ...history].slice(0, HISTORY_LIMIT);
}
