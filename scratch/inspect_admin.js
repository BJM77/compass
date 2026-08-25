const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

async function run() {
  console.log('--- USERS ---');
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Name: ${data.name} | Role: ${data.role} | Email: ${data.email}`);
    userMap.set(doc.id, data.name || doc.id);
  });

  console.log('\n--- WEEKLY PROGRESS (All Docs) ---');
  const progressSnap = await db.collection('weeklyProgress').get();
  progressSnap.forEach(doc => {
    const data = doc.data();
    const userName = userMap.get(data.userId) || `Unknown (${data.userId})`;
    console.log(`Doc ID: ${doc.id} | User: ${userName} (userId: ${data.userId}) | Week: ${data.week} | Calls: ${data.calls} | Apps: ${data.apps} | crmCalls: ${data.crmCalls} | crmApps: ${data.crmApps}`);
  });

  process.exit(0);
}

run().catch(console.error);
