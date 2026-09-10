import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        initializeApp({ credential: cert(serviceAccount) });
      } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
        initializeApp();
      }
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    
    // 48 hours ago
    const thresholdDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    const submissionsSnap = await db.collection('twiwSubmissions').get();
    let updatedCount = 0;
    
    const batch = db.batch();
    
    submissionsSnap.forEach((doc) => {
      const data = doc.data();
      let shouldUpdate = false;
      
      const createdDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
      const updatedDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : null);
      
      if ((createdDate && createdDate > thresholdDate) || (updatedDate && updatedDate > thresholdDate)) {
        shouldUpdate = true;
      }
      
      if (shouldUpdate) {
        batch.update(doc.ref, {
          week: '2026-W24', // Update to Week 24
          status: 'SUBMITTED',
          submitted: true,
          submittedAt: data.submittedAt || new Date()
        });
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
    }
    
    return NextResponse.json({ success: true, updatedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
