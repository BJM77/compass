const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  console.log('Logging in as 1@1.com...');
  await signInWithEmailAndPassword(auth, '1@1.com', '123456');
  console.log('Logged in successfully!');

  console.log('--- USERS ---');
  const usersSnap = await getDocs(collection(db, 'users'));
  const userMap = new Map();
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Name: ${data.name} | Role: ${data.role} | Email: ${data.email}`);
    userMap.set(doc.id, data.name || doc.id);
  });

  console.log('\n--- WEEKLY PROGRESS (All Docs) ---');
  const progressSnap = await getDocs(collection(db, 'weeklyProgress'));
  progressSnap.forEach(doc => {
    const data = doc.data();
    const userName = userMap.get(data.userId) || `Unknown (${data.userId})`;
    console.log(`Doc ID: ${doc.id} | User: ${userName} (userId: ${data.userId}) | Week: ${data.week} | Calls: ${data.calls} | Apps: ${data.apps} | crmCalls: ${data.crmCalls} | crmApps: ${data.crmApps}`);
  });
  
  process.exit(0);
}

run().catch(console.error);
