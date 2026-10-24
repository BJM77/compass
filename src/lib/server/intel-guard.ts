// Server-only: auth (Firebase ID token + staff role) and per-user daily rate limit.
import { adminAuth, adminDb } from './admin';
import { INTEL_DAILY_LIMIT, DISCOVER_ROLES } from '@/lib/intel';

export const STAFF_ROLES = ['BDM', 'ACCOUNT_MANAGER', 'AM', 'LEADER', 'GM', 'ADMIN', 'SUPER_ADMIN'];
export const SOURCING_ROLES = ['BDM', 'LEADER', 'GM', 'ADMIN', 'SUPER_ADMIN'];

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export type Caller = { uid: string; role: string; name: string };

export async function requireStaff(req: Request): Promise<Caller> {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.{20,4096})$/);
  if (!m) throw new HttpError(401, 'Missing token');
  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(m[1], true)).uid; }
  catch { throw new HttpError(401, 'Invalid token'); }
  const snap = await adminDb().doc(`users/${uid}`).get();
  const role = String(snap.get('role') || '');
  if (!STAFF_ROLES.includes(role)) throw new HttpError(403, 'Staff only');
  return { uid, role, name: String(snap.get('name') || '') };
}

/** Staff check plus leader/admin role (users/{uid}.role only; no email allow-lists). */
export async function requireLeader(req: Request): Promise<Caller> {
  const caller = await requireStaff(req);
  if (!DISCOVER_ROLES.includes(caller.role)) throw new HttpError(403, 'Leaders and admins only');
  return caller;
}

/** Perth calendar day, e.g. 20261018. */
export function perthDay(now = Date.now()): string {
  return new Date(now + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Atomically count one call; throws 429 past the daily limit.
 * `kindLimit` optionally caps this kind separately (it still counts toward the overall limit).
 */
export async function consumeQuota(uid: string, kind: string, kindLimit?: number): Promise<number> {
  const db = adminDb();
  const ref = db.doc(`intelUsage/${uid}_${perthDay()}`);
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    const n = (s.exists ? Number(s.get('count') || 0) : 0) + 1;
    const k = (s.exists ? Number(s.get(`by_${kind}`) || 0) : 0) + 1;
    if (n > INTEL_DAILY_LIMIT) throw new HttpError(429, `Daily limit of ${INTEL_DAILY_LIMIT} intel checks reached`);
    if (kindLimit != null && k > kindLimit) throw new HttpError(429, `Daily limit of ${kindLimit} reached for this search. Try again tomorrow.`);
    tx.set(ref, { uid, count: n, [`by_${kind}`]: k, updatedAt: new Date() }, { merge: true });
    return kindLimit != null ? Math.min(INTEL_DAILY_LIMIT - n, kindLimit - k) : INTEL_DAILY_LIMIT - n;
  });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error('[intel]', e instanceof Error ? e.message : e);
  return Response.json({ error: 'Intel check failed' }, { status: 500 });
}
