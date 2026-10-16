/**
 * Pure scheduling logic (no Firebase imports) so it can be unit tested.
 * All wall-clock times are Australia/Perth (AWST, UTC+8).
 */
import {
  Task, NotificationPrefs, DEFAULT_NOTIFICATION_PREFS, perthParts, perthTime,
  reminderFireAt, isStale, needsAttention, formatPerth, isSamePerthDay,
} from './shared/time-mgmt';

export const CATCH_UP_MS = 72 * 60 * 60 * 1000;

/** Config for TWTW / Friday FW nudges (see README in functions/). */
export type NudgeConfig = {
  twtwEnabled: boolean;
  /** 0=Sun … 4=Thu. TWTW is the "Thursday TWTW" in the app. */
  twtwDueWeekday: number;
  twtwHour: number;
  fwEnabled: boolean;
  fwWeekday: number;
  fwHour: number;
};

export const DEFAULT_NUDGE_CONFIG: NudgeConfig = {
  twtwEnabled: true,
  twtwDueWeekday: 4,
  twtwHour: 13,
  fwEnabled: true,
  fwWeekday: 5,
  fwHour: 11,
};

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

/** True if `now` falls inside the user's allowed (non-quiet) window. */
export function withinAllowedWindow(prefs: NotificationPrefs, now: number): boolean {
  const p = perthParts(now);
  if (prefs.weekdaysOnly && (p.weekday === 0 || p.weekday === 6)) return false;
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
export function deadlineWindows(role: string, prefs: NotificationPrefs, cfg: NudgeConfig, now: number): { twtw: boolean; fw: boolean } {
  if (!prefs.deadlineNudges) return { twtw: false, fw: false };
  const p = perthParts(now);
  const inWin = (wd: number, h: number) => p.weekday === wd && p.hour >= h && p.hour < SAME_DAY_CUTOFF_HOUR;
  return {
    twtw: cfg.twtwEnabled && TWTW_ROLES.includes(role) && inWin(cfg.twtwDueWeekday, cfg.twtwHour),
    fw: cfg.fwEnabled && FW_ROLES.includes(role) && inWin(cfg.fwWeekday, cfg.fwHour),
  };
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
    if (action === 'done') return { ...t, completed: true, snoozedUntil: null, touchedAt: now };
    if (action === 'tomorrow') return { ...t, dueAt: tomorrow9am(now), snoozedUntil: null, touchedAt: now };
    return { ...t, snoozedUntil: now + 60 * 60 * 1000, touchedAt: now };
  });
  return found ? next : null;
}

export { needsAttention };
