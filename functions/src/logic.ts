/**
 * Pure scheduling logic (no Firebase imports) so it can be unit tested.
 * All wall-clock times are Australia/Perth (AWST, UTC+8).
 */
import {
  Task, NotificationPrefs, DEFAULT_NOTIFICATION_PREFS, perthParts, perthTime,
  reminderFireAt, isStale, needsAttention, formatPerth, isSamePerthDay,
} from './shared/time-mgmt';

export const CATCH_UP_MS = 72 * 60 * 60 * 1000;

/** Config for TWTW / NWA (Next Week's Activity: due Sunday 8pm, Monday meeting) nudges (see README in functions/). */
export type NudgeConfig = {
  twtwEnabled: boolean;
  /** 0=Sun … 4=Thu. TWTW is the "Thursday TWTW" in the app. */
  twtwDueWeekday: number;
  twtwHour: number;
  fwEnabled: boolean;
  /** Overdue nudge: Monday morning, before the NWA meeting. */
  fwWeekday: number;
  fwHour: number;
  /** Reminder the evening the NWA is due (Sunday 8pm Perth). */
  fwDueWeekday: number;
  fwDueHour: number;
};

export const DEFAULT_NUDGE_CONFIG: NudgeConfig = {
  twtwEnabled: true,
  twtwDueWeekday: 4,
  twtwHour: 13,
  fwEnabled: true,
  /** NWA is due Sunday 8pm and reviewed in the Monday meeting: overdue nudge 7am Monday Perth. */
  fwWeekday: 1,
  fwHour: 7,
  /**
   * "NWA due 8pm tonight" reminder from 4pm Sunday Perth, stopping before 7pm (FW_DUE_CUTOFF_HOUR).
   * It is the one nudge exempt from the weekdaysOnly preference; the user's allowed hours still apply.
   */
  fwDueWeekday: 0,
  fwDueHour: 16,
};

/** The Sunday NWA reminder is not sent from this hour (Perth): an hour before the 8pm due time. */
export const FW_DUE_CUTOFF_HOUR = 19;

export const DIGEST_HOUR = 8;
/** Digests/nudges not sent by this hour on the day are dropped (stale). */
export const SAME_DAY_CUTOFF_HOUR = 18;

export function mergePrefs(p: Partial<NotificationPrefs> | undefined | null): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(p || {}) };
}

function hm(s: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
  return m ? +m[1] * 60 + +m[2] : fallback;
}

/**
 * True if `now` falls inside the user's allowed (non-quiet) window.
 * ignoreWeekdaysOnly: used only for the Sunday "NWA due tonight" reminder.
 */
export function withinAllowedWindow(prefs: NotificationPrefs, now: number, opts: { ignoreWeekdaysOnly?: boolean } = {}): boolean {
  const p = perthParts(now);
  if (prefs.weekdaysOnly && !opts.ignoreWeekdaysOnly && (p.weekday === 0 || p.weekday === 6)) return false;
  const mins = p.hour * 60 + p.minute;
  const start = hm(prefs.allowedStart, 7 * 60);
  const end = hm(prefs.allowedEnd, 18 * 60);
  return start <= end ? mins >= start && mins < end : mins >= start || mins < end;
}

/** Financial-year week key "YYYY-WW" (Monday weeks, FY from the week containing 1 April) in Perth time. Mirrors getWeekForDate() in src/lib/utils.ts. */
export function perthWeekKey(now: number): string {
  const p = perthParts(now);
  const dayIdx = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const today = dayIdx(p.year, p.month, p.day);
  const fyStart = (y: number) => {
    const apr1 = dayIdx(y, 4, 1);
    const wd = new Date(apr1 * 86400000).getUTCDay();
    return apr1 - ((wd + 6) % 7); // back to Monday
  };
  let year = p.year;
  let start = fyStart(year);
  if (today < start) { year -= 1; start = fyStart(year); }
  const week = Math.floor((today - start) / 7) + 1;
  return `${year}-${String(week).padStart(2, '0')}`;
}

export function perthDateKey(now: number): string {
  const p = perthParts(now);
  return `${p.year}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}`;
}

/**
 * What may be sent to this user right now: everything, only the Sunday NWA due reminder
 * (weekend, weekdaysOnly on, inside allowed hours), or nothing.
 */
export function notificationGate(prefs: NotificationPrefs, now: number): 'all' | 'fwDueOnly' | 'none' {
  if (!prefs.enabled) return 'none';
  if (withinAllowedWindow(prefs, now)) return 'all';
  if (withinAllowedWindow(prefs, now, { ignoreWeekdaysOnly: true })) return 'fwDueOnly';
  return 'none';
}

export function isFwDueKey(key: string): boolean {
  return key.startsWith('fw_due_');
}

export type PendingNotification = {
  /** Dedupe key (one send per key per user). */
  key: string;
  kind: 'reminder' | 'snooze' | 'escalation' | 'digest' | 'twtw' | 'fw' | 'nudge';
  title: string;
  body: string;
  link: string;
  taskId?: string;
};

const MANAGE_TIME_LINK = '/dashboard?view=MANAGE_TIME';

function dueText(t: Task): string {
  return t.dueAt ? `Due ${formatPerth(t.dueAt)}` : '';
}

/** Task reminders, snoozes and stale-Do-Now escalations due at `now`. */
export function taskNotifications(tasks: Task[], prefs: NotificationPrefs, now: number): PendingNotification[] {
  const out: PendingNotification[] = [];
  for (const t of tasks) {
    if (!t || t.completed || !t.id) continue;
    const label = (t.text || 'Task').slice(0, 120);
    if (t.snoozedUntil && now >= t.snoozedUntil && now - t.snoozedUntil <= CATCH_UP_MS) {
      out.push({ key: `snz_${t.id}_${t.snoozedUntil}`, kind: 'snooze', taskId: t.id, title: `⏰ ${label}`, body: dueText(t) || 'Snoozed reminder', link: MANAGE_TIME_LINK });
    } else if (t.dueAt) {
      // Only the most recent reminder that's due (avoid a burst after quiet hours).
      const fired = (t.reminders || [])
        .map(o => ({ o, at: reminderFireAt(t.dueAt as number, o) }))
        .filter(r => now >= r.at && now - r.at <= CATCH_UP_MS)
        .sort((a, b) => b.at - a.at);
      if (fired.length) {
        const overdue = (t.dueAt as number) < now;
        out.push({
          key: `rem_${t.id}_${t.dueAt}_${fired.map(f => f.o).sort().join('+')}`,
          kind: 'reminder', taskId: t.id,
          title: overdue ? `Overdue: ${label}` : `Reminder: ${label}`,
          body: `${dueText(t)} (Perth time)`,
          link: MANAGE_TIME_LINK,
        });
      }
    }
    if (prefs.escalation && isStale(t, now)) {
      const last = Math.max(t.touchedAt || 0, t.promotedAt || 0);
      out.push({ key: `esc_${t.id}_${last}`, kind: 'escalation', taskId: t.id, title: 'Delegate or Delete?', body: `"${label}" has sat in Do Now for 2+ days untouched.`, link: MANAGE_TIME_LINK });
    }
  }
  return out;
}

/** 8am digest: top 3 Do Now + due today. */
export function digestNotification(tasks: Task[], prefs: NotificationPrefs, now: number): PendingNotification | null {
  if (!prefs.dailyDigest) return null;
  const p = perthParts(now);
  if (p.hour < DIGEST_HOUR || p.hour >= SAME_DAY_CUTOFF_HOUR) return null;
  const open = tasks.filter(t => t && !t.completed);
  const doNow = open.filter(t => t.quadrant === 'Q1').sort((a, b) => (a.dueAt || Infinity) - (b.dueAt || Infinity)).slice(0, 3);
  const dueToday = open.filter(t => t.dueAt && (isSamePerthDay(t.dueAt, now) || t.dueAt < now));
  if (!doNow.length && !dueToday.length) return null;
  const lines: string[] = [];
  if (doNow.length) lines.push(`Do Now: ${doNow.map(t => (t.text || 'Task').slice(0, 40)).join(' · ')}`);
  if (dueToday.length) lines.push(`${dueToday.length} due today/overdue`);
  return { key: `digest_${perthDateKey(now)}`, kind: 'digest', title: 'Your day at a glance', body: lines.join('\n'), link: MANAGE_TIME_LINK };
}

export const TWTW_ROLES = ['BDM', 'ACCOUNT_MANAGER', 'AM', 'GUEST'];
export const FW_ROLES = ['BDM', 'ACCOUNT_MANAGER', 'AM'];

/** Which deadline nudges are in their window right now (submission checks happen in index.ts). */
export function deadlineWindows(role: string, prefs: NotificationPrefs, cfg: NudgeConfig, now: number): { twtw: boolean; fw: boolean; fwDue: boolean } {
  if (!prefs.deadlineNudges) return { twtw: false, fw: false, fwDue: false };
  const p = perthParts(now);
  const inWin = (wd: number, h: number) => p.weekday === wd && p.hour >= h && p.hour < SAME_DAY_CUTOFF_HOUR;
  return {
    twtw: cfg.twtwEnabled && TWTW_ROLES.includes(role) && inWin(cfg.twtwDueWeekday, cfg.twtwHour),
    fw: cfg.fwEnabled && FW_ROLES.includes(role) && inWin(cfg.fwWeekday, cfg.fwHour),
    fwDue: cfg.fwEnabled && FW_ROLES.includes(role)
      && p.weekday === cfg.fwDueWeekday && p.hour >= cfg.fwDueHour && p.hour < Math.min(FW_DUE_CUTOFF_HOUR, SAME_DAY_CUTOFF_HOUR + 1),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * NWA week keys for a deadline nudge. The NWA submitted on Sunday/Monday plans the week starting
 * that Monday (weeklyCommitments/{uid}_{planWeek}) and reviews the week just finished
 * (weeklyReports/{uid}_{reviewWeek}).
 */
export function nwaWeeks(now: number): { planWeek: string; reviewWeek: string } {
  const p = perthParts(now);
  if (p.weekday === 0) return { planWeek: perthWeekKey(now + DAY_MS), reviewWeek: perthWeekKey(now) };
  return { planWeek: perthWeekKey(now), reviewWeek: perthWeekKey(now - 7 * DAY_MS) };
}

export const NWA_SUBMITTED_STATUSES = ['SUBMITTED', 'REVIEWED_BY_ADMIN'];

/** True if the NWA counts as submitted: the plan doc is submitted/reviewed, or the legacy weekly report has submittedAt. */
export function nwaSubmitted(planStatus: unknown, reportSubmittedAt: unknown): boolean {
  return NWA_SUBMITTED_STATUSES.includes(String(planStatus || '')) || !!reportSubmittedAt;
}

/** Tomorrow 9am Perth. */
export function tomorrow9am(now: number): number {
  const p = perthParts(now);
  return perthTime(p.year, p.month, p.day + 1, 9);
}

/** Apply a notification action to a task list. Returns null if task not found. */
export function applyAction(tasks: Task[], taskId: string, action: 'snooze1h' | 'tomorrow' | 'done', now: number): Task[] | null {
  let found = false;
  const next = tasks.map(t => {
    if (t.id !== taskId) return t;
    found = true;
    if (action === 'done') return { ...t, completed: true, completedAt: now, completedFromQuadrant: t.quadrant ?? null, snoozedUntil: null, touchedAt: now };
    if (action === 'tomorrow') return { ...t, dueAt: tomorrow9am(now), snoozedUntil: null, touchedAt: now };
    return { ...t, snoozedUntil: now + 60 * 60 * 1000, touchedAt: now };
  });
  return found ? next : null;
}

export { needsAttention };
