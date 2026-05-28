import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8eWxEjK57tndLBXYFxGCswYF47aHo080",
  authDomain: "studio-5306701288-d19b1.firebaseapp.com",
  projectId: "studio-5306701288-d19b1",
  storageBucket: "studio-5306701288-d19b1.firebasestorage.app",
  messagingSenderId: "581796544364",
  appId: "1:581796544364:web:5c577736cc62792dc8fd49",
  measurementId: "G-GHP1P0T67S",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "weeklyCommitments"), where("week", "in", ["2026-21", "2026-22", "2026-W21", "2026-W22", "2026-w21", "2026-w22", "2026-08", "2026-09"]));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({id: d.id, ...d.data()}));
  
  if (results.length === 0) {
     console.log("No results found for weeks 21, 22, 08, 09.");
  } else {
     console.log(JSON.stringify(results, null, 2));
  }
  process.exit(0);
}
run().catch(console.error);
