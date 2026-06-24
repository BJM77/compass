const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try {
  initializeApp({ projectId: 'studio-5306701288-d19b1' });
} catch (error) {
  if (!/already exists/.test(error.message)) {
    console.error('Firebase initialization error', error.stack);
  }
}

const db = getFirestore();

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function run() {
  console.log('Clearing twiwSubmissions...');
  await deleteCollection('twiwSubmissions', 500);
  console.log('Clearing weeklyCommitments...');
  await deleteCollection('weeklyCommitments', 500);
  console.log('Clearing weeklyProgress...');
  await deleteCollection('weeklyProgress', 500);
  console.log('Demo data cleared successfully.');
}

run().catch(console.error);
