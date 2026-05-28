const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

async function fixStatus() {
  initializeApp({ projectId: 'studio-5306701288-d19b1' });
  const db = getFirestore();
  
  const snap = await db.collection('weeklyCommitments').where('week', '==', '2026-08').get();
  let count = 0;
  
  const batch = db.batch();
  snap.forEach(doc => {
    // If we change it to 'SUBMITTED', it will show in the dashboard!
    batch.update(doc.ref, { status: 'SUBMITTED' });
    count++;
  });
  
  if (count > 0) {
    await batch.commit();
    console.log(`Successfully updated status to SUBMITTED for ${count} plans in week 8.`);
  } else {
    console.log('No documents found for week 8.');
  }
}

fixStatus().catch(console.error);
