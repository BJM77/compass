// scripts/verify-isaac.js
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

async function verifyIsaac() {
  try {
    initializeApp({ projectId: 'studio-5306701288-d19b1' });
    const db = getFirestore();
    const auth = getAuth();

    // Check Auth
    const userRecord = await auth.getUserByEmail('isaac.depina@teamglobalexp.com');
    console.log('✅ Auth user found:', userRecord.uid);

    // Check Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    if (userDoc.exists) {
      console.log('✅ Firestore user found:', userDoc.data());
    } else {
      console.log('❌ Firestore user not found');
    }

    // Check BDM Stats
    const statsDoc = await db.collection('bdmStats').doc(userRecord.uid).get();
    if (statsDoc.exists) {
      console.log('✅ BDM stats found:', statsDoc.data());
    } else {
      console.log('❌ BDM stats not found');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyIsaac();
