/**
 * Time Management helpers (Eisenhower matrix tasks, due dates, reminders).
 *
 * All wall-clock maths is done in Australia/Perth (AWST, UTC+8, no daylight
 * saving), independent of the browser/server timezone.
 */

export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/** Per-task reminder offsets (web push). */
export type ReminderOffset = '15m' | 'morning' | 'dayBefore';

export const REMINDER_OFFSETS: { id: ReminderOffset; label: string }[] = [
  { id: '15m', label: '15 min before' },
  { id: 'morning', label: 'Morning of (8am)' },
  { id: 'dayBefore', label: 'Day before' },
];

export type Task = {
  id: string;
  text: string;
  quadrant?: Quadrant | null;
  completed?: boolean;
  movedToSoonAt?: number | null;
  /** Due date/time, epoch ms. */
  dueAt?: number | null;
  /** Reminder offsets to push for this task. */
  reminders?: ReminderOffset[];
  /** Snoozed (from a notification) until, epoch ms – a reminder fires then. */
  snoozedUntil?: number | null;
  /** Last time the task was edited/moved, epoch ms (for escalation). */
  touchedAt?: number | null;
  /** When the task was (auto-)promoted to Do Now, epoch ms. */
  promotedAt?: number | null;
};

export const PERTH_TZ = 'Australia/Perth';
export const PERTH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PerthParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** Wall-clock parts in Perth for an epoch ms. month is 1-12, weekday 0=Sun. */
export function perthParts(ms: number): PerthParts {
  const d = new Date(ms + PERTH_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** Epoch ms for a Perth wall-clock time (month 1-12). Overflowing days roll over. */
export function perthTime(year: number, month: number, day: number, hour = 0, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - PERTH_OFFSET_MS;
}

export function perthStartOfDay(ms: number): number {
  const p = perthParts(ms);
  return perthTime(p.year, p.month, p.day);
}

export function isSamePerthDay(a: number, b: number): boolean {
  return perthStartOfDay(a) === perthStartOfDay(b);
}

/** Quick picks for a due date. */
export function quickPick(kind: 'today5pm' | 'tomorrow9am' | 'friday5pm', now = Date.now()): number {
  const p = perthParts(now);
  if (kind === 'today5pm') return perthTime(p.year, p.month, p.day, 17);
  if (kind === 'tomorrow9am') return perthTime(p.year, p.month, p.day + 1, 9);
  // This Friday 5pm; if it's already past Friday 5pm, next Friday.
  let add = (5 - p.weekday + 7) % 7;
  let t = perthTime(p.year, p.month, p.day + add, 17);
  if (t <= now) t = perthTime(p.year, p.month, p.day + add + 7, 17);
  return t;
}

/** Value for <input type="datetime-local"> in Perth time. */
export function toPerthInputValue(ms: number): string {
  const p = perthParts(ms);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

/** Parse "YYYY-MM-DDTHH:mm" as Perth wall-clock time. */
export function fromPerthInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return perthTime(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

export function formatPerth(ms: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }): string {
  return new Intl.DateTimeFormat('en-AU', { timeZone: PERTH_TZ, ...opts }).format(new Date(ms));
}

export type DueStatus = 'overdue' | 'today' | 'later' | null;

export function dueStatus(task: Pick<Task, 'dueAt' | 'completed'>, now = Date.now()): DueStatus {
  if (!task.dueAt) return null;
  if (task.dueAt < now) return 'overdue';
  if (isSamePerthDay(task.dueAt, now)) return 'today';
  return 'later';
}

/** Overdue or due today, and not completed – counts for the bell + auto-promotion. */
export function needsAttention(task: Task, now = Date.now()): boolean {
  if (task.completed) return false;
  const s = dueStatus(task, now);
  return s === 'overdue' || s === 'today';
}

export const ESCALATION_MS = 2 * DAY_MS;

/** Do Now task untouched for 2+ days → "Delegate or Delete?" */
export function isStale(task: Task, now = Date.now()): boolean {
  if (task.completed || task.quadrant !== 'Q1') return false;
  const last = Math.max(task.touchedAt || 0, task.promotedAt || 0);
  return last > 0 && now - last >= ESCALATION_MS;
}

/** Fire time for a reminder offset, or null. */
export function reminderFireAt(dueAt: number, offset: ReminderOffset): number {
  if (offset === '15m') return dueAt - 15 * 60 * 1000;
  if (offset === 'dayBefore') return dueAt - DAY_MS;
  const p = perthParts(dueAt);
  return perthTime(p.year, p.month, p.day, 8);
}

/** Remove undefined keys (Firestore rejects undefined). */
export function cleanTask(task: Task): Task {
  const out: any = { ...task };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

// ─── iCalendar ────────────────────────────────────────────────────────────────

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

function icsUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Build an .ics (VEVENT, 30 min) for a task with a due date. */
export function buildIcs(task: Task, now = Date.now()): string {
  const start = task.dueAt || now;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BDM Compass//Time Management//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${task.id.replace(/[^\w.-]/g, '')}@bdm-compass`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(start + 30 * 60 * 1000)}`,
    `SUMMARY:${icsEscape(task.text || 'Task')}`,
    'DESCRIPTION:From BDM Compass – Manage Time',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(task.text || 'Task')}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(task: Task) {
  const blob = new Blob([buildIcs(task)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (task.text || 'task').replace(/[^\w]+/g, '-').slice(0, 40).replace(/^-|-$/g, '') || 'task';
  a.download = `${slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Notification preferences ────────────────────────────────────────────────

export type NotificationPrefs = {
  enabled: boolean;
  /** Quiet-hours *allowed* window, Perth time, "HH:mm". */
  allowedStart: string;
  allowedEnd: string;
  /** Only send on weekdays (Mon–Fri). */
  weekdaysOnly: boolean;
  dailyDigest: boolean;
  deadlineNudges: boolean;
  escalation: boolean;
  updatedAt?: unknown;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: false,
  allowedStart: '07:00',
  allowedEnd: '18:00',
  weekdaysOnly: true,
  dailyDigest: true,
  deadlineNudges: true,
  escalation: true,
};

// ─── Continuous plan (no weekly reset) ─────────────────────────────────────
// A user may have several timeManagementPlans docs (history). The newest is the
// ACTIVE plan; every incomplete task from older plans is carried into it.
// Dedupe is idempotent by task id, and the active plan records `carriedIds`
// (every id ever carried in) so a task deleted/completed in the active plan is
// never resurrected from an older doc. Older docs are never modified.
export type PlanLike = { id: string; tasks?: Task[]; createdAt?: any; carriedIds?: string[] };

const planMs = (p: PlanLike): number => {
  const c = p.createdAt;
  if (!c) return Number.MAX_SAFE_INTEGER; // pending serverTimestamp = newest
  if (typeof c === 'number') return c;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (typeof c._seconds === 'number') return c._seconds * 1000;
  if (typeof c.seconds === 'number') return c.seconds * 1000;
  return 0;
};

export type MergedPlan = {
  /** Active (newest) plan id, or null if the user has no plans yet. */
  activePlanId: string | null;
  /** Active plan's tasks followed by open tasks carried from older plans. */
  tasks: Task[];
  /** Ids to store on the active plan (existing + newly carried). */
  carriedIds: string[];
  /** Ids newly carried on this merge (if non-empty, persist to the active plan). */
  newlyCarried: string[];
};

export function mergeContinuousPlans(plans: PlanLike[]): MergedPlan {
  const sorted = [...plans].sort((a, b) => planMs(b) - planMs(a));
  const active = sorted[0];
  if (!active) return { activePlanId: null, tasks: [], carriedIds: [], newlyCarried: [] };
  const tasks: Task[] = [...(active.tasks || [])];
  const seen = new Set<string>([...tasks.map(t => t.id), ...(active.carriedIds || [])]);
  const newlyCarried: string[] = [];
  // Newest older plan first, so the most recent copy of a task wins.
  for (const p of sorted.slice(1)) {
    for (const t of p.tasks || []) {
      if (!t?.id || t.completed || seen.has(t.id)) continue;
      seen.add(t.id);
      tasks.push(t);
      newlyCarried.push(t.id);
    }
  }
  const carriedIds = Array.from(new Set([...(active.carriedIds || []), ...newlyCarried]));
  return { activePlanId: active.id, tasks, carriedIds, newlyCarried };
}
