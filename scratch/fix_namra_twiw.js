const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env' });

async function run() {
  let app;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      app = initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error('Failed to parse JSON', e);
      return;
    }
  } else {
    console.error('No FIREBASE_SERVICE_ACCOUNT_JSON found in .env.local');
    return;
  }

  const db = getFirestore(app);
  
  const submissionsRef = db.collection('twiwSubmissions');
  const q = submissionsRef.where('userId', '==', 'waHEXgLsIhVQTIvju6xiIef2gZg1');
  const snapshot = await q.get();

  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.userName === 'BDM') {
      await doc.ref.update({ userName: 'Namra Khan' });
      count++;
      console.log(`Updated document: ${doc.id}`);
    }
  }

  console.log(`Finished updating ${count} documents.`);
}

run().catch(console.error);
