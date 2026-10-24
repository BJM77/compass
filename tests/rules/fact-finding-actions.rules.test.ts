import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  serverTimestamp, arrayUnion, writeBatch,
} from 'firebase/firestore';

// Fact Finding "M" (message owner) and "TD" (follow-up task for owner) actions.
let env: RulesTestEnvironment;

const LEADER = 'leader-uid';
const GM = 'gm-uid';
const BDM = 'bdm-uid';   // owns f1
const BDM2 = 'bdm2-uid'; // owns f2
const GUEST = 'guest-uid';

const db = (uid?: string) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

const msg = (from: string, to: string, extra: Record<string, unknown> = {}) => ({
  fromUid: from, fromName: 'Lea', toUid: to, text: 'Please update the volumes', createdAt: serverTimestamp(), ...extra,
});
const note = (from: string, extra: Record<string, unknown> = {}) => ({
  type: 'FACT_FINDING_MESSAGE', title: 'Lea · Acme Fact Finding', body: 'Please update the volumes',
  factFindingId: 'f1', fromUid: from, fromName: 'Lea', read: false, createdAt: serverTimestamp(), ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-compass-rules',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const a = ctx.firestore();
    const users: Record<string, any> = {
      [LEADER]: { name: 'Lea', role: 'LEADER' },
      [GM]: { name: 'Gem', role: 'GM' },
      [BDM]: { name: 'Bea', role: 'BDM' },
      [BDM2]: { name: 'Bob', role: 'BDM' },
      [GUEST]: { name: 'Gus', role: 'GUEST', isGuest: true },
    };
    for (const [id, data] of Object.entries(users)) await setDoc(doc(a, 'users', id), data);
    await setDoc(doc(a, 'factFindingDocs', 'f1'), { userId: BDM, companyName: 'Acme' });
    await setDoc(doc(a, 'factFindingDocs', 'f2'), { userId: BDM2, companyName: 'Other' });
    await setDoc(doc(a, 'factFindingDocs', 'f1', 'messages', 'm1'), { fromUid: LEADER, fromName: 'Lea', toUid: BDM, text: 'hi', createdAt: new Date() });
    await setDoc(doc(a, 'users', BDM, 'notifications', 'n1'), { ...note(LEADER), createdAt: new Date() });
    await setDoc(doc(a, 'timeManagementPlans', 'p-bdm'), { userId: BDM, tasks: [], carriedIds: [] });
  });
});

describe('M: message the Fact Finding owner', () => {
  test('leader/GM can post a message + bell notification in one batch', async () => {
    for (const admin of [LEADER, GM]) {
      const d = db(admin);
      const b = writeBatch(d);
      b.set(doc(collection(d, 'factFindingDocs', 'f1', 'messages')), msg(admin, BDM));
      b.set(doc(collection(d, 'users', BDM, 'notifications')), note(admin));
      await assertSucceeds(b.commit());
    }
  });
  test('BDM / guest / signed-out cannot message or notify others', async () => {
    for (const uid of [BDM2, BDM, GUEST, undefined]) {
      await assertFails(setDoc(doc(collection(db(uid), 'factFindingDocs', 'f1', 'messages')), msg(uid || 'x', BDM)));
      await assertFails(setDoc(doc(collection(db(uid), 'users', BDM, 'notifications')), note(uid || 'x')));
    }
  });
  test('admin cannot spoof sender, mis-address, send empty/oversized text or extra fields', async () => {
    const d = db(LEADER);
    const m = (x: Record<string, unknown>) => setDoc(doc(collection(d, 'factFindingDocs', 'f1', 'messages')), msg(LEADER, BDM, x));
    await assertFails(m({ fromUid: GM }));
    await assertFails(m({ toUid: BDM2 }));
    await assertFails(m({ text: '' }));
    await assertFails(m({ text: 'x'.repeat(2001) }));
    await assertFails(m({ extra: true }));
    const n = (x: Record<string, unknown>) => setDoc(doc(collection(d, 'users', BDM, 'notifications')), note(LEADER, x));
    await assertFails(n({ fromUid: GM }));
    await assertFails(n({ read: true }));
    await assertFails(n({ type: 'SOMETHING_ELSE' }));
    await assertFails(n({ body: 'x'.repeat(2001) }));
    await assertFails(n({ extra: 1 }));
  });
  test('owner and admins read the record messages; other BDMs cannot', async () => {
    await assertSucceeds(getDocs(collection(db(BDM), 'factFindingDocs', 'f1', 'messages')));
    await assertSucceeds(getDocs(collection(db(LEADER), 'factFindingDocs', 'f1', 'messages')));
    await assertFails(getDocs(collection(db(BDM2), 'factFindingDocs', 'f1', 'messages')));
    await assertFails(getDocs(collection(db(GUEST), 'factFindingDocs', 'f1', 'messages')));
  });
  test('messages are immutable; only admins delete', async () => {
    await assertFails(updateDoc(doc(db(BDM), 'factFindingDocs', 'f1', 'messages', 'm1'), { text: 'edited' }));
    await assertFails(updateDoc(doc(db(LEADER), 'factFindingDocs', 'f1', 'messages', 'm1'), { text: 'edited' }));
    await assertFails(deleteDoc(doc(db(BDM), 'factFindingDocs', 'f1', 'messages', 'm1')));
    await assertSucceeds(deleteDoc(doc(db(LEADER), 'factFindingDocs', 'f1', 'messages', 'm1')));
  });
  test('owner reads their unread notifications; others cannot', async () => {
    const q = (uid: string) => getDocs(query(collection(db(uid), 'users', BDM, 'notifications'), where('read', '==', false)));
    await assertSucceeds(q(BDM));
    await assertSucceeds(q(LEADER));
    await assertFails(q(BDM2));
    await assertFails(getDoc(doc(db(GUEST), 'users', BDM, 'notifications', 'n1')));
  });
  test('owner can only mark a notification read', async () => {
    const ref = (uid: string) => doc(db(uid), 'users', BDM, 'notifications', 'n1');
    await assertFails(updateDoc(ref(BDM), { body: 'changed' }));
    await assertFails(updateDoc(ref(BDM), { read: true, body: 'changed' }));
    await assertFails(updateDoc(ref(BDM2), { read: true, readAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(BDM), { read: true, readAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref(BDM)));
  });
});

describe('TD: follow-up in the owner\u2019s Manage Time', () => {
  const task = { id: 'ff_f1_1', text: 'Follow up: Acme Fact Finding', quadrant: 'Q2', completed: false, dueAt: 1, reminders: ['15m'], holdUntilDue: true, factFindingId: 'f1', assignedBy: LEADER };

  test('admin can read the owner\u2019s plans and append a task', async () => {
    await assertSucceeds(getDocs(query(collection(db(LEADER), 'timeManagementPlans'), where('userId', '==', BDM))));
    await assertSucceeds(updateDoc(doc(db(LEADER), 'timeManagementPlans', 'p-bdm'), { tasks: arrayUnion(task), updatedAt: serverTimestamp() }));
  });
  test('admin can create the first plan for an owner who has none', async () => {
    await assertSucceeds(setDoc(doc(db(GM), 'timeManagementPlans', 'p-new'), { userId: BDM2, tasks: [task], carriedIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  test('admin can send the follow-up bell notification', async () => {
    await assertSucceeds(setDoc(doc(collection(db(LEADER), 'users', BDM, 'notifications')), note(LEADER, { type: 'FACT_FINDING_TODO' })));
  });
  test('another BDM cannot add tasks to someone else\u2019s plan', async () => {
    await assertFails(updateDoc(doc(db(BDM2), 'timeManagementPlans', 'p-bdm'), { tasks: arrayUnion(task) }));
    await assertFails(setDoc(doc(db(BDM2), 'timeManagementPlans', 'p-x'), { userId: BDM, tasks: [task] }));
  });
  test('owner can still update their own plan (complete / move the task)', async () => {
    await assertSucceeds(updateDoc(doc(db(BDM), 'timeManagementPlans', 'p-bdm'), { tasks: [{ ...task, quadrant: 'Q1' }] }));
  });
});
