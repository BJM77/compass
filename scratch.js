const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function run() {
  try {
    const doc = await db.collection('users').doc('joanne_ballantyne').get();
    if (doc.exists) {
      console.log('Success:', doc.data());
    } else {
      console.log('Document not found');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}
run();
