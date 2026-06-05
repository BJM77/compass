const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

async function run() {
  try {
    initializeApp({ projectId: 'studio-5306701288-d19b1' });
    const db = getFirestore();
    const auth = getAuth();
    
    // Get all users from Auth
    const listUsersResult = await auth.listUsers();
    for (const userRecord of listUsersResult.users) {
      console.log(`Ensuring ${userRecord.email} (${userRecord.uid}) is LEADER...`);
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || userRecord.email.split('@')[0],
        role: 'LEADER'
      }, { merge: true });
    }
    console.log("Done! All users are now Leaders. Refresh the page to see the Admin menu.");
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();
