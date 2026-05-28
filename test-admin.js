const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function run() {
  try {
    // If running in an environment with Application Default Credentials
    // (e.g. cloud IDE or local with gcloud), this will just work.
    initializeApp({
      projectId: 'studio-5306701288-d19b1'
    });
    
    const db = getFirestore();
    const snap = await db.collection('weeklyCommitments').where('week', 'in', ['2026-21', '2026-22', '2025-21', '2025-22', '2024-21', '2024-22', '21', '22', 'Week 21', 'Week 22']).get();
    
    console.log(`Found ${snap.size} commitments.`);
    snap.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
  } catch(e) {
    console.error("Failed:", e);
  }
}

run();
