/**
 * Fact Finding owner actions (admins/leaders only in the UI and rules):
 *  - "M"  : message the record owner (bell notification + message history on the record)
 *  - "TD" : add a "Follow up" task to the owner's Manage Time "Do Soon" quadrant,
 *           due 3pm Perth on the next working day (weekends + WA public holidays skipped).
 *           If still open at that time it is shown in / auto-moved to "Do Now".
 *
 * All wall-clock maths is Australia/Perth (UTC+8, no daylight saving).
 */
import { Task, Quadrant, perthParts, perthTime, needsAttention } from './time-mgmt';

/** WA public holidays (wa.gov.au, 2026-2027), incl. Monday/Tuesday substitute days. YYYY-MM-DD. */
export const WA_PUBLIC_HOLIDAYS: ReadonlyArray<string> = [
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-26', // Australia Day
  '2026-03-02', // Labour Day
  '2026-04-03', // Good Friday
  '2026-04-05', // Easter Sunday
  '2026-04-06', // Easter Monday
  '2026-04-25', // Anzac Day (Sat)
  '2026-04-27', // Anzac Day (Mon substitute)
  '2026-06-01', // Western Australia Day
  '2026-09-28', // King's Birthday
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day (Sat)
  '2026-12-28', // Boxing Day (Mon substitute)
  // 2027
  '2027-01-01', // New Year's Day
  '2027-01-26', // Australia Day
  '2027-03-01', // Labour Day
  '2027-03-26', // Good Friday
  '2027-03-28', // Easter Sunday
  '2027-03-29', // Easter Monday
  '2027-04-25', // Anzac Day (Sun)
  '2027-04-26', // Anzac Day (Mon substitute)
  '2027-06-07', // Western Australia Day
  '2027-09-27', // King's Birthday
  '2027-12-25', // Christmas Day (Sat)
  '2027-12-26', // Boxing Day (Sun)
  '2027-12-27', // Christmas Day (Mon substitute)
  '2027-12-28', // Boxing Day (Tue substitute)
];

const HOLIDAY_SET = new Set(WA_PUBLIC_HOLIDAYS);

const z = (n: number) => String(n).padStart(2, '0');

/** Perth calendar date key (YYYY-MM-DD) for an epoch ms. */
export function perthDateKey(ms: number): string {
  const p = perthParts(ms);
  return `${p.year}-${z(p.month)}-${z(p.day)}`;
}

export function isWaPublicHoliday(ms: number): boolean {
  return HOLIDAY_SET.has(perthDateKey(ms));
}

/** Mon–Fri in Perth and not a WA public holiday. */
export function isPerthWorkingDay(ms: number): boolean {
  const wd = perthParts(ms).weekday;
  return wd >= 1 && wd <= 5 && !isWaPublicHoliday(ms);
}

export const FOLLOW_UP_HOUR = 15;

/**
 * 3pm Perth on the next working day after `now` (never today).
 * Fri/Sat/Sun -> Monday 15:00; Mon -> Tue 15:00; holidays are skipped.
 */
export function nextWorkingDay3pm(now = Date.now()): number {
  const p = perthParts(now);
  for (let i = 1; i <= 31; i++) {
    const t = perthTime(p.year, p.month, p.day + i, FOLLOW_UP_HOUR);
    if (isPerthWorkingDay(t)) return t;
  }
  // Unreachable with a sane holiday list; fall back to tomorrow 3pm.
  return perthTime(p.year, p.month, p.day + 1, FOLLOW_UP_HOUR);
}

// ─── Follow-up task ─────────────────────────────────────────────────────────

export const FOLLOW_UP_SOURCE = 'FACT_FINDING_TD';

/** Manage Time task created by the TD button (extra fields are ignored by older code). */
export type FollowUpTask = Task & {
  source?: typeof FOLLOW_UP_SOURCE;
  /** factFindingDocs/{id} this task follows up. */
  factFindingId?: string;
  /** Stay in its quadrant until dueAt (no early "due today"/24h promotion), then Do Now. */
  holdUntilDue?: boolean;
  assignedBy?: string;
  assignedByName?: string;
};

export function followUpTitle(companyName?: string | null): string {
  const name = (companyName || '').trim() || 'Unnamed customer';
  return `Follow up: ${name} Fact Finding`;
}

export function buildFollowUpTask(
  input: { factFindingId: string; companyName?: string | null; assignedBy: string; assignedByName?: string | null },
  now = Date.now(),
): FollowUpTask {
  const task: FollowUpTask = {
    id: `ff_${input.factFindingId}_${now}`,
    text: followUpTitle(input.companyName),
    quadrant: 'Q2',
    completed: false,
    dueAt: nextWorkingDay3pm(now),
    reminders: ['15m'],
    touchedAt: now,
    source: FOLLOW_UP_SOURCE,
    factFindingId: input.factFindingId,
    holdUntilDue: true,
    assignedBy: input.assignedBy,
  };
  if (input.assignedByName) task.assignedByName = input.assignedByName;
  return task;
}

/** An open (not completed) TD follow-up for this record already in the owner's tasks. */
export function findOpenFollowUp(tasks: Task[], factFindingId: string): FollowUpTask | null {
  const hit = (tasks as FollowUpTask[]).find(t => t && !t.completed && t.factFindingId === factFindingId);
  return hit || null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Should Manage Time auto-move this task to Do Now?
 *  - held follow-ups: only once their due time has passed;
 *  - everything else: existing rules (overdue/due today, or 24h+ in Do Soon).
 */
export function autoPromoteReason(task: Task, now = Date.now()): 'due' | 'stale' | null {
  const t = task as FollowUpTask;
  if (!t || t.completed || t.quadrant === 'Q1') return null;
  if (t.holdUntilDue) return t.dueAt && t.dueAt <= now ? 'due' : null;
  if (needsAttention(t, now)) return 'due';
  if (t.quadrant === 'Q2' && t.movedToSoonAt && now - t.movedToSoonAt > DAY_MS) return 'stale';
  return null;
}

/**
 * Quadrant to render a task in. A held follow-up that is past due shows in Do Now
 * even before the auto-move has been saved (e.g. an admin viewing someone's plan).
 */
export function displayQuadrant(task: Task, now = Date.now()): Quadrant | null {
  const t = task as FollowUpTask;
  if (!t.completed && t.holdUntilDue && t.dueAt && t.dueAt <= now) return 'Q1';
  return t.quadrant ?? null;
}

// ─── Notifications ──────────────────────────────────────────────────────────

/** users/{uid}/notifications/{id} – in-app bell items. */
export type NotificationType = 'FACT_FINDING_MESSAGE' | 'FACT_FINDING_TODO';

export const MESSAGE_MAX = 2000;
