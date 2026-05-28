import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./src/firebase/config.ts', 'utf8').match(/\{[\s\S]*?\}/)[0].replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/'/g, '"'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "weeklyCommitments"), where("week", "in", ["2026-21", "2026-22"]));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({id: d.id, ...d.data()}));
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}
run().catch(console.error);
