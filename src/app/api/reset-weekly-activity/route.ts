import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ─── Firebase Admin initialisation ───────────────────────────────────────────
// Requires FIREBASE_SERVICE_ACCOUNT_JSON env var with the full service account JSON
function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
    );
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ─── Shared auth guard ────────────────────────────────────────────────────────
function isAuthorized(secret: string | undefined): boolean {
  return !!secret && secret === process.env.RESET_SECRET;
}

// ─── POST /api/reset-weekly-activity ─────────────────────────────────────────
// Resets calls/apps/proposals/deals to 0 for all weeklyProgress docs
// matching the provided week key.
// Protected by a shared RESET_SECRET env var.
export async function POST(req: Request) {
  try {
    const { week, secret } = await req.json();

    if (!isAuthorized(secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!week || typeof week !== 'string') {
      return NextResponse.json({ error: 'week param required (yyyy-ww)' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized. Missing Bearer token.' }, { status: 401 });
    }

    const db = getAdminDb();
    
    let callerUid;
    try {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await getAuth().verifyIdToken(idToken);
      callerUid = decodedToken.uid;
      
      const userDoc = await db.collection('users').doc(callerUid).get();
      const userData = userDoc.data();
      if (!userData || (userData.role !== 'ADMIN' && userData.role !== 'LEADER' && userData.role !== 'GM')) {
        return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
      }
    } catch (authError) {
      console.error('Auth verification failed:', authError);
      return NextResponse.json({ error: 'Unauthorized. Invalid token.' }, { status: 401 });
    }

    await db.collection('auditLogs').add({
      action: 'RESET_WEEKLY_ACTIVITY',
      invokedBy: callerUid,
      invokedAt: new Date(),
      params: { week }
    });

    const snap = await db
      .collection('weeklyProgress')
      .where('week', '==', week)
      .get();

    if (snap.empty) {
      return NextResponse.json({ message: 'No records found for that week', count: 0 });
    }

    const BATCH_SIZE = 400;
    let count = 0;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = snap.docs.slice(i, i + BATCH_SIZE);
      chunk.forEach(d => {
        batch.update(d.ref, { calls: 0, apps: 0, proposals: 0, deals: 0, resetAt: new Date() });
      });
      await batch.commit();
      count += chunk.length;
    }

    return NextResponse.json({ message: `Reset ${count} activity records for week ${week}`, count });
  } catch (err: unknown) {
    console.error('[reset-weekly-activity POST]', err);
    return NextResponse.json({ error: 'An internal error occurred.' }, { status: 500 });
  }
}
