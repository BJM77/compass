import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection, query, where, serverTimestamp, increment } from 'firebase/firestore';

let env: RulesTestEnvironment;

const LEADER = 'leader-uid';
const GM = 'gm-uid';
const SUPER = 'super-uid';
const BDM = 'bdm-uid';
const BDM2 = 'bdm2-uid';
const AM = 'am-uid';
const GUEST = 'guest-uid';
const STRANGER = 'stranger-uid'; // self-signed-up, no users doc

const db = (uid?: string, token: Record<string, unknown> = {}) =>
  uid ? env.authenticatedContext(uid, token).firestore() : env.unauthenticatedContext().firestore();

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
      [LEADER]: { name: 'Lea', role: 'LEADER', email: 'lea@teamglobalexp.com' },
      [GM]: { name: 'Gem', role: 'GM', email: 'gm@teamglobalexp.com' },
      [SUPER]: { name: 'Sup', role: 'SUPER_ADMIN', email: 'sup@teamglobalexp.com' },
      [BDM]: { name: 'Bea', role: 'BDM', email: 'bea@teamglobalexp.com', target: 2500000 },
      [BDM2]: { name: 'Bob', role: 'BDM', email: 'bob@teamglobalexp.com' },
      [AM]: { name: 'Amy', role: 'ACCOUNT_MANAGER', email: 'amy@teamglobalexp.com' },
      [GUEST]: { name: 'Gus', role: 'GUEST', isGuest: true, email: 'gus@teamglobalexp.com' },
    };
    for (const [id, data] of Object.entries(users)) await setDoc(doc(a, 'users', id), data);
    await setDoc(doc(a, 'actualRevenues', 'r1'), { customer: 'Acme', spend: 1000, category: '2026-28' });
    await setDoc(doc(a, 'accountMappings', 'acme'), { assignedToId: BDM });
    await setDoc(doc(a, 'customers', 'c1'), { name: 'Acme' });
    await setDoc(doc(a, 'aiBriefs', 'b1'), { userId: BDM, summary: 'x' });
    await setDoc(doc(a, 'factFindingDocs', 'f1'), { userId: BDM, companyName: 'Acme' });
    await setDoc(doc(a, 'factFindingDocs', 'f2'), { userId: BDM2, companyName: 'Other' });
    await setDoc(doc(a, 'twiwSubmissions', 't-guest'), { userId: GUEST, week: '2026-28' });
    await setDoc(doc(a, 'twiwSubmissions', 't-bdm'), { userId: BDM, week: '2026-28' });
    await setDoc(doc(a, 'appSettings', 'global'), { lastCrmSync: 1 });
    await setDoc(doc(a, 'strategyConfig', 'territoryPlaybooks'), { data: {} });
    await setDoc(doc(a, 'systemAnnouncements', 'current'), { message: 'hi', active: true });
    await setDoc(doc(a, 'onboardingProgress', 'SHARED_GROUP_90'), { tasks: {} });
    await setDoc(doc(a, 'ambdNotes', 'n1'), { userId: BDM, title: 't', status: 'PENDING' });
  });
});

describe('privilege escalation', () => {
  test('BDM cannot promote themselves', async () => {
    await assertFails(updateDoc(doc(db(BDM), 'users', BDM), { role: 'GM' }));
    await assertFails(updateDoc(doc(db(BDM), 'users', BDM), { role: 'SUPER_ADMIN' }));
    await assertFails(updateDoc(doc(db(BDM), 'users', BDM), { target: 1 }));
  });
  test('guest cannot promote themselves or flip isGuest', async () => {
    await assertFails(updateDoc(doc(db(GUEST), 'users', GUEST), { role: 'LEADER' }));
    await assertFails(updateDoc(doc(db(GUEST), 'users', GUEST), { isGuest: false }));
  });
  test('stranger cannot create a privileged users doc', async () => {
    await assertFails(setDoc(doc(db(STRANGER), 'users', STRANGER), { role: 'GM', email: 'x@teamglobalexp.com' }));
    await assertFails(setDoc(doc(db(STRANGER), 'users', STRANGER), { role: 'GUEST', email: 'x@evil.com' }));
  });
  test('users can still update non-privileged fields (login timestamp, guest re-login)', async () => {
    await assertSucceeds(updateDoc(doc(db(BDM), 'users', BDM), { lastLoginAt: serverTimestamp(), isOnline: true }));
    await assertSucceeds(setDoc(doc(db(GUEST), 'users', GUEST),
      { email: 'gus@teamglobalexp.com', name: 'Gus', role: 'GUEST', isGuest: true, lastLoginAt: serverTimestamp() }, { merge: true }));
  });
  test('new guest can create own GUEST doc with TGE email', async () => {
    await assertSucceeds(setDoc(doc(db('new-guest'), 'users', 'new-guest'),
      { email: 'ng@teamglobalexp.com', name: 'NG', state: 'QLD', role: 'GUEST', isGuest: true }));
  });
  test('admins can change roles', async () => {
    await assertSucceeds(updateDoc(doc(db(LEADER), 'users', BDM), { role: 'ACCOUNT_MANAGER' }));
    await assertSucceeds(updateDoc(doc(db(SUPER), 'users', BDM2), { target: 3000000 }));
  });
});

describe('guests and strangers cannot read sensitive data', () => {
  for (const [label, uid] of [['anonymous/guest', GUEST], ['self-signed-up stranger', STRANGER]] as const) {
    test(`${label}: cannot list users, revenue, mappings, customers, briefs`, async () => {
      const d = db(uid);
      await assertFails(getDocs(collection(d, 'users')));
      await assertFails(getDocs(collection(d, 'actualRevenues')));
      await assertFails(getDocs(collection(d, 'accountMappings')));
      await assertFails(getDocs(collection(d, 'customers')));
      await assertFails(getDocs(collection(d, 'aiBriefs')));
      await assertFails(getDoc(doc(d, 'appSettings', 'global')));
      await assertFails(getDoc(doc(d, 'strategyConfig', 'territoryPlaybooks')));
    });
  }
  test('unauthenticated cannot read anything, including announcements', async () => {
    await assertFails(getDoc(doc(db(), 'systemAnnouncements', 'current')));
    await assertFails(getDocs(collection(db(), 'users')));
  });
  test('guest TWTW portal: own doc, announcements, own submission create/read', async () => {
    const d = db(GUEST);
    await assertSucceeds(getDoc(doc(d, 'users', GUEST)));
    await assertSucceeds(getDoc(doc(d, 'systemAnnouncements', 'current')));
    await assertSucceeds(getDoc(doc(d, 'twiwSubmissions', 't-guest')));
    await assertSucceeds(getDocs(query(collection(d, 'twiwSubmissions'), where('userId', '==', GUEST))));
    await assertSucceeds(setDoc(doc(d, 'twiwSubmissions', 't-guest-2'), { userId: GUEST, week: '2026-29' }));
    await assertFails(getDoc(doc(d, 'twiwSubmissions', 't-bdm')));
    await assertFails(setDoc(doc(d, 'factFindingDocs', 'g1'), { userId: GUEST }));
  });
});

describe('leaders keep team-wide access', () => {
  for (const uid of [LEADER, GM, SUPER]) {
    test(`${uid}: reads team, revenue, all fact finding and TWTW`, async () => {
      const d = db(uid);
      await assertSucceeds(getDocs(collection(d, 'users')));
      await assertSucceeds(getDocs(collection(d, 'actualRevenues')));
      await assertSucceeds(getDocs(collection(d, 'accountMappings')));
      await assertSucceeds(getDocs(collection(d, 'factFindingDocs')));
      await assertSucceeds(getDocs(query(collection(d, 'twiwSubmissions'), where('week', '==', '2026-28'))));
      await assertSucceeds(getDocs(collection(d, 'aiBriefs')));
      await assertSucceeds(setDoc(doc(d, 'systemAnnouncements', 'current'), { message: 'nudge', active: true }));
      await assertSucceeds(setDoc(doc(d, 'accountMappings', 'acme'), { assignedToId: BDM2 }, { merge: true }));
      await assertSucceeds(addDoc(collection(d, 'ambdNotes'), { userId: BDM, title: 'Do X' }));
    });
  }
});

describe('BDM / AM main screens keep working', () => {
  for (const uid of [BDM, AM]) {
    test(`${uid}: own data CRUD`, async () => {
      const d = db(uid);
      await assertSucceeds(getDoc(doc(d, 'users', uid)));
      await assertSucceeds(getDocs(collection(d, 'users'))); // name lookups (canvass timeline, etc.)
      await assertSucceeds(addDoc(collection(d, 'factFindingDocs'), { userId: uid, companyName: 'New' }));
      await assertSucceeds(getDocs(query(collection(d, 'factFindingDocs'), where('userId', '==', uid))));
      await assertSucceeds(addDoc(collection(d, 'twiwSubmissions'), { userId: uid, week: '2026-28' }));
      await assertSucceeds(addDoc(collection(d, 'callPlans'), { userId: uid, target: 'Acme' }));
      await assertSucceeds(addDoc(collection(d, 'whitespacePlans'), { userId: uid }));
      await assertSucceeds(addDoc(collection(d, 'timeManagementPlans'), { userId: uid }));
      await assertSucceeds(addDoc(collection(d, 'canvass_leads'), { userId: uid, companyName: 'Lead' }));
      await assertSucceeds(addDoc(collection(d, 'opsReports'), { userId: uid, type: 'x' }));
      await assertSucceeds(addDoc(collection(d, 'pipelineReviews'), { userId: uid, week: '2026-28' }));
      await assertSucceeds(addDoc(collection(d, 'successPlans'), { createdBy: uid, teamMemberId: uid }));
      await assertSucceeds(setDoc(doc(d, 'weeklyProgress', `${uid}_2026-28`), { userId: uid, week: '2026-28', calls: increment(1) }, { merge: true }));
      await assertSucceeds(setDoc(doc(d, 'onboardingProgress', `${uid}_BDM_NORTH_90`), { tasks: {} }, { merge: true }));
      await assertSucceeds(setDoc(doc(d, 'onboardingProgress', 'SHARED_GROUP_90'), { tasks: { a: true } }, { merge: true }));
      await assertSucceeds(getDocs(query(collection(d, 'actualRevenues')))); // Actual Spend screen
      await assertSucceeds(getDoc(doc(d, 'appSettings', 'global')));
      await assertSucceeds(getDoc(doc(d, 'strategyConfig', 'territoryPlaybooks')));
      await assertSucceeds(setDoc(doc(d, 'appSettings', uid), { notifyEmail: true }, { merge: true }));
    });
  }
  test('BDM confirms an AM/BD note (status only)', async () => {
    await assertSucceeds(updateDoc(doc(db(BDM), 'ambdNotes', 'n1'), { status: 'READ', readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BDM), 'ambdNotes', 'n1'), { title: 'changed' }));
  });
  test('BDM cannot touch other people or admin data', async () => {
    const d = db(BDM);
    await assertFails(getDoc(doc(d, 'factFindingDocs', 'f2')));
    await assertFails(getDocs(collection(d, 'factFindingDocs')));
    await assertFails(addDoc(collection(d, 'factFindingDocs'), { userId: BDM2, companyName: 'Spoof' }));
    await assertFails(updateDoc(doc(d, 'factFindingDocs', 'f1'), { userId: BDM2 }));
    await assertFails(setDoc(doc(d, 'onboardingProgress', `${BDM2}_BDM_NORTH_90`), { tasks: {} }));
    await assertFails(setDoc(doc(d, 'systemAnnouncements', 'current'), { message: 'pwned' }));
    await assertFails(setDoc(doc(d, 'actualRevenues', 'r1'), { spend: 0 }));
    await assertFails(setDoc(doc(d, 'appSettings', 'global'), { x: 1 }));
    await assertFails(setDoc(doc(d, 'telemetryAggregates', 'v'), { viewKey: 'v', evil: true }));
    await assertFails(getDocs(collection(d, 'aiBriefs'))); // unfiltered list of everyone's briefs
  });
  test('telemetry: staff may increment aggregates in the expected shape', async () => {
    await assertSucceeds(setDoc(doc(db(BDM), 'telemetryAggregates', 'DASHBOARD'),
      { viewKey: 'DASHBOARD', viewCount: increment(1), lastUpdated: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(doc(db(BDM), 'telemetryEvents', 'e1'), { userId: BDM, viewKey: 'DASHBOARD' }));
    await assertFails(setDoc(doc(db(GUEST), 'telemetryEvents', 'e2'), { userId: GUEST, viewKey: 'X' }));
  });
});
