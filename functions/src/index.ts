/**
 * BDM Compass – Manage Time notifications.
 *
 *  - sendTimeNotifications (every 5 min, australia-southeast1): task reminders
 *    (15 min before / 8am morning-of / day before), snoozes, stale Do Now
 *    escalations, 8am daily digest, TWTW + NWA (Monday) deadline nudges, and
 *    pushes for leader "Team Nudges" – all respecting each user's quiet hours.
 *  - notificationAction (HTTPS): Snooze 1h / Tomorrow / Mark done from a
 *    notification. Authenticated by a random, single-use, expiring action token
 *    issued with that notification (stored server-side in notificationActions,
 *    which clients can't read or write).
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { defineBoolean, defineInt } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { randomBytes } from 'crypto';
import { Task, NotificationPrefs, mergeContinuousPlans } from './shared/time-mgmt';
import { runFuelRefresh, type DbLike, type FetchLike } from './shared/fuel-surcharges';
import {
  PendingNotification, mergePrefs, withinAllowedWindow, taskNotifications, digestNotification,
  deadlineWindows, perthWeekKey, applyAction, DEFAULT_NUDGE_CONFIG, NudgeConfig,
} from './logic';

initializeApp();
const REGION = 'australia-southeast1';

// Deadline nudge flags (override in functions/.env.<project> – see README).
const TWTW_NUDGE_ENABLED = defineBoolean('TWTW_NUDGE_ENABLED', { default: true });
const TWTW_DUE_WEEKDAY = defineInt('TWTW_DUE_WEEKDAY', { default: DEFAULT_NUDGE_CONFIG.twtwDueWeekday });
const FW_NUDGE_ENABLED = defineBoolean('FW_NUDGE_ENABLED', { default: true });

const ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function actionUrl(): string {
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
  return `https://${REGION}-${project}.cloudfunctions.net/notificationAction`;
}

type Ctx = { db: Firestore; now: number };

async function loadTokens(db: Firestore, uid: string): Promise<{ id: string; token: string }[]> {
  const snap = await db.collection('users').doc(uid).collection('fcmTokens').get();
  return snap.docs.map(d => ({ id: d.id, token: String(d.get('token') || '') })).filter(t => t.token);
}

/** Claim a dedupe key; false if already sent. */
async function claim(db: Firestore, uid: string, key: string, now: number): Promise<boolean> {
  try {
    await db.collection('users').doc(uid).collection('notificationLog').doc(key.slice(0, 400)).create({ sentAt: now });
    return true;
  } catch (e: any) {
    if (e?.code === 6 || /already exists/i.test(String(e?.message))) return false;
    throw e;
  }
}

async function send(ctx: Ctx, uid: string, tokens: { id: string; token: string }[], n: PendingNotification, planId?: string) {
  const data: Record<string, string> = { title: n.title, body: n.body, link: n.link, kind: n.kind, tag: n.taskId ? `task-${n.taskId}` : n.kind };
  if (n.taskId && planId) {
    const token = randomBytes(24).toString('hex');
    await ctx.db.collection('notificationActions').doc(token).set({ uid, planId, taskId: n.taskId, expiresAt: ctx.now + ACTION_TTL_MS, used: false });
    data.actionToken = token;
    data.actionUrl = actionUrl();
  }
  const res = await getMessaging().sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    data,
    webpush: { headers: { Urgency: 'high', TTL: String(6 * 60 * 60) }, fcmOptions: { link: n.link } },
  });
  // Prune dead tokens.
  await Promise.all(res.responses.map((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
      return ctx.db.collection('users').doc(uid).collection('fcmTokens').doc(tokens[i].id).delete();
    }
    return null;
  }));
  logger.info('push sent', { uid, kind: n.kind, success: res.successCount, failure: res.failureCount });
}

async function processUser(ctx: Ctx, uid: string, prefs: NotificationPrefs, cfg: NudgeConfig) {
  const { db, now } = ctx;
  if (!prefs.enabled || !withinAllowedWindow(prefs, now)) return;
  const tokens = await loadTokens(db, uid);
  if (!tokens.length) return;

  const userSnap = await db.collection('users').doc(uid).get();
  const role = String(userSnap.get('role') || '');

  // Continuous plan: all of the user's plans, open tasks carried into the newest one.
  const planSnap = await db.collection('timeManagementPlans').where('userId', '==', uid).get();
  const merged = mergeContinuousPlans(planSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  const plan = merged.activePlanId ? { id: merged.activePlanId } : undefined;
  const tasks: Task[] = merged.tasks;

  const pending: PendingNotification[] = [...taskNotifications(tasks, prefs, now)];
  const digest = digestNotification(tasks, prefs, now);
  if (digest) pending.push(digest);

  const win = deadlineWindows(role, prefs, cfg, now);
  if (win.twtw || win.fw) {
    const week = perthWeekKey(now);
    if (win.twtw) {
      const s = await db.collection('twiwSubmissions').doc(`${uid}_${week}`).get();
      if (!s.exists || s.get('status') !== 'SUBMITTED') {
        pending.push({ key: `twtw_${week}`, kind: 'twtw', title: 'TWTW due today', body: "Your TWTW for this week hasn't been submitted yet.", link: '/dashboard?view=TWIW' });
      }
    }
    if (win.fw) {
      // Monday NWA reviews the week just finished (weeklyReports keyed by that week).
      const reviewWeek = perthWeekKey(now - 7 * 24 * 60 * 60 * 1000);
      const r = await db.collection('weeklyReports').doc(`${uid}_${reviewWeek}`).get();
      if (!r.exists || !r.get('submittedAt')) {
        pending.push({ key: `fw_${reviewWeek}`, kind: 'fw', title: 'NWA due this morning', body: "Your Next Weeks Activity (NWA) hasn't been submitted yet for today's meeting.", link: '/dashboard?view=FRIDAY_FW' });
      }
    }
  }

  // Leader Team Nudge (systemAnnouncements/nudge_<uid>) not yet pushed.
  const nudge = await db.collection('systemAnnouncements').doc(`nudge_${uid}`).get();
  if (nudge.exists && nudge.get('type') === 'TIME_NUDGE' && nudge.get('active') && nudge.get('updatedAt')) {
    const ts = nudge.get('updatedAt').toMillis?.() || 0;
    if (now - ts <= 72 * 3600 * 1000) {
      pending.push({ key: `nudge_${ts}`, kind: 'nudge', title: 'Team Nudge', body: String(nudge.get('message') || 'Please review your Manage Time plan.'), link: '/dashboard?view=MANAGE_TIME' });
    }
  }

  for (const n of pending.slice(0, 10)) {
    if (!(await claim(db, uid, n.key, now))) continue;
    try {
      await send(ctx, uid, tokens, n, plan?.id);
    } catch (e) {
      logger.error('send failed', { uid, key: n.key, error: String(e) });
    }
  }
}

export const sendTimeNotifications = onSchedule(
  { schedule: 'every 5 minutes', region: REGION, timeZone: 'Australia/Perth', retryCount: 0, memory: '256MiB', timeoutSeconds: 240 },
  async () => {
    const db = getFirestore();
    const ctx: Ctx = { db, now: Date.now() };
    const cfg: NudgeConfig = {
      ...DEFAULT_NUDGE_CONFIG,
      twtwEnabled: TWTW_NUDGE_ENABLED.value(),
      twtwDueWeekday: TWTW_DUE_WEEKDAY.value(),
      fwEnabled: FW_NUDGE_ENABLED.value(),
    };
    // Unfiltered collection-group read: no extra index needed; only users who opened Settings have a prefs doc.
    const prefsSnap = await db.collectionGroup('notificationSettings').get();
    for (const d of prefsSnap.docs) {
      const uid = d.ref.parent.parent?.id;
      if (!uid || d.id !== 'prefs') continue;
      try {
        await processUser(ctx, uid, mergePrefs(d.data() as Partial<NotificationPrefs>), cfg);
      } catch (e) {
        logger.error('processUser failed', { uid, error: String(e) });
      }
    }
  }
);

export const notificationAction = onRequest({ region: REGION, cors: true, memory: '256MiB', maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const action = req.body?.action;
  if (!/^[a-f0-9]{48}$/.test(token) || !['snooze1h', 'tomorrow', 'done'].includes(action)) {
    res.status(400).send('Bad request'); return;
  }
  const db = getFirestore();
  const now = Date.now();
  try {
    await db.runTransaction(async (tx) => {
      const aRef = db.collection('notificationActions').doc(token);
      const a = await tx.get(aRef);
      if (!a.exists || a.get('used') || (a.get('expiresAt') || 0) < now) throw Object.assign(new Error('invalid'), { status: 403 });
      const uid = String(a.get('uid'));
      const plansSnap = await tx.get(db.collection('timeManagementPlans').where('userId', '==', uid));
      if (!plansSnap.docs.some(d => d.id === String(a.get('planId')))) throw Object.assign(new Error('invalid'), { status: 403 });
      // Apply to the continuous set and write it to the active (newest) plan.
      const merged = mergeContinuousPlans(plansSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      const next = applyAction(merged.tasks, String(a.get('taskId')), action, now);
      if (!next || !merged.activePlanId) throw Object.assign(new Error('not found'), { status: 404 });
      tx.update(db.collection('timeManagementPlans').doc(merged.activePlanId), { tasks: next, carriedIds: merged.carriedIds, updatedAt: FieldValue.serverTimestamp() });
      tx.update(aRef, { used: true, usedAt: now, action });
    });
    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(e?.status || 500).send(e?.status ? 'Not allowed' : 'Error');
    if (!e?.status) logger.error('notificationAction failed', { error: String(e) });
  }
});

/** Weekly fuel-surcharge refresh: Monday 07:00 AWST (fixed carrier allow-list only). */
export const refreshFuelSurcharges = onSchedule(
  { schedule: '0 7 * * 1', region: REGION, timeZone: 'Australia/Perth', retryCount: 1, memory: '256MiB', timeoutSeconds: 120 },
  async () => {
    const r = await runFuelRefresh(getFirestore() as unknown as DbLike, fetch as unknown as FetchLike, Date.now(), { force: true, by: 'schedule' });
    logger.info('fuel surcharges refreshed', { results: r.results.map(x => `${x.carrierId}:${x.status}${x.changed ? '*' : ''}`).join(' ') });
  }
);
