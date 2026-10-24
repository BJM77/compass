import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where, serverTimestamp, increment, Timestamp } from 'firebase/firestore';

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

describe('Manage Time: push tokens, prefs, nudges, team counts', () => {
  const prefs = { enabled: true, allowedStart: '07:00', allowedEnd: '18:00', weekdaysOnly: true, dailyDigest: true, deadlineNudges: true, escalation: true };

  test('users manage only their own FCM tokens and prefs', async () => {
    await assertSucceeds(setDoc(doc(db(BDM), 'users', BDM, 'fcmTokens', 'h1'), { token: 'tok', userAgent: 'ua', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(db(BDM), 'users', BDM, 'fcmTokens', 'h1')));
    await assertSucceeds(setDoc(doc(db(BDM), 'users', BDM, 'notificationSettings', 'prefs'), prefs));
    await assertSucceeds(getDoc(doc(db(BDM), 'users', BDM, 'notificationSettings', 'prefs')));
    // Other users – including admins – can't read or write them
    for (const other of [BDM2, LEADER, SUPER, GUEST, STRANGER]) {
      await assertFails(getDoc(doc(db(other), 'users', BDM, 'fcmTokens', 'h1')));
      await assertFails(getDocs(collection(db(other), 'users', BDM, 'fcmTokens')));
      await assertFails(getDoc(doc(db(other), 'users', BDM, 'notificationSettings', 'prefs')));
      await assertFails(setDoc(doc(db(other), 'users', BDM, 'fcmTokens', 'evil'), { token: 'x' }));
      await assertFails(setDoc(doc(db(other), 'users', BDM, 'notificationSettings', 'prefs'), prefs));
    }
    await assertFails(getDoc(doc(db(), 'users', BDM, 'fcmTokens', 'h1')));
  });

  test('token/prefs shape is enforced; server-only collections are closed', async () => {
    await assertFails(setDoc(doc(db(BDM), 'users', BDM, 'fcmTokens', 'h2'), { token: 'tok', role: 'SUPER_ADMIN' }));
    await assertFails(setDoc(doc(db(BDM), 'users', BDM, 'notificationSettings', 'other'), prefs));
    await assertFails(setDoc(doc(db(BDM), 'users', BDM, 'notificationSettings', 'prefs'), { ...prefs, isAdmin: true }));
    await assertFails(setDoc(doc(db(BDM), 'users', BDM, 'notificationLog', 'k'), { sentAt: 1 }));
    await assertFails(getDoc(doc(db(BDM), 'users', BDM, 'notificationLog', 'k')));
    await assertFails(getDoc(doc(db(SUPER), 'notificationActions', 'abc')));
    await assertFails(setDoc(doc(db(BDM), 'notificationActions', 'abc'), { uid: BDM, planId: 'p', taskId: 't', used: false }));
  });

  test('Team Nudge: admin writes nudge_<uid>; only target + admins read it', async () => {
    const nudge = { type: 'TIME_NUDGE', targetUserId: BDM, message: 'Time check', active: true, createdBy: LEADER, updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(db(LEADER), 'systemAnnouncements', `nudge_${BDM}`), nudge));
    await assertFails(setDoc(doc(db(BDM), 'systemAnnouncements', `nudge_${BDM2}`), { ...nudge, targetUserId: BDM2 }));
    await assertSucceeds(getDoc(doc(db(BDM), 'systemAnnouncements', `nudge_${BDM}`)));
    await assertSucceeds(getDoc(doc(db(GM), 'systemAnnouncements', `nudge_${BDM}`)));
    await assertFails(getDoc(doc(db(BDM2), 'systemAnnouncements', `nudge_${BDM}`)));
    await assertFails(getDoc(doc(db(GUEST), 'systemAnnouncements', `nudge_${BDM}`)));
    // Non-existent nudge doc reads cleanly (banner listens for it)
    await assertSucceeds(getDoc(doc(db(BDM2), 'systemAnnouncements', `nudge_${BDM2}`)));
    // Team broadcast still readable by everyone signed in
    await assertSucceeds(getDoc(doc(db(GUEST), 'systemAnnouncements', 'current')));
  });

  test('time plans: owner CRUD with dueAt; admins read team plans; peers cannot', async () => {
    const task = { id: 't1', text: 'Call Acme', quadrant: 'Q1', completed: false, dueAt: Date.now(), reminders: ['15m'] };
    await assertSucceeds(setDoc(doc(db(BDM), 'timeManagementPlans', 'p1'), { userId: BDM, tasks: [task], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(BDM), 'timeManagementPlans', 'p1'), { tasks: [{ ...task, completed: true }] }));
    await assertFails(setDoc(doc(db(BDM), 'timeManagementPlans', 'p2'), { userId: BDM2, tasks: [] }));
    await assertFails(getDoc(doc(db(BDM2), 'timeManagementPlans', 'p1')));
    await assertFails(updateDoc(doc(db(BDM), 'timeManagementPlans', 'p1'), { userId: BDM2 }));
    for (const admin of [LEADER, GM, SUPER]) {
      await assertSucceeds(getDocs(collection(db(admin), 'timeManagementPlans')));
    }
    await assertFails(getDocs(collection(db(BDM), 'timeManagementPlans')));
    await assertSucceeds(getDocs(query(collection(db(BDM), 'timeManagementPlans'), where('userId', '==', BDM))));
    // Continuous plan: owner may write carriedIds on any of their plans (incl. older ones); peers may not
    await assertSucceeds(setDoc(doc(db(BDM), 'timeManagementPlans', 'old1'), { userId: BDM, tasks: [task], createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(BDM), 'timeManagementPlans', 'old1'), { tasks: [], carriedIds: ['t1'], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BDM2), 'timeManagementPlans', 'old1'), { carriedIds: [] }));
    await assertFails(getDocs(query(collection(db(BDM2), 'timeManagementPlans'), where('userId', '==', BDM))));
  });
});

describe('Verticals: verticalProspects', () => {
  const base = (over: Record<string, unknown> = {}) => ({
    company: 'Acme Mining Supplies', vertical: 'MINING', belt: 'EAST', source: 'AUSTMINE',
    contactName: 'Jane', contactTitle: 'Logistics Manager', freightProfile: ['CARTON', 'PALLET'], notes: '',
    ownerUid: null, ownerName: null, claimedAt: null,
    sfStatus: 'UNCHECKED', sfCheckedBy: null, sfCheckedAt: null,
    scores: { frequency: false, freightFit: false, regionalNeed: false, carrierPain: false, growth: false }, score: 0,
    amUid: null, amName: null, amNotes: '',
    convertedAt: null, convertedBy: null,
    createdBy: BDM, createdByName: 'Bea', createdAt: serverTimestamp(), lastActivityAt: serverTimestamp(),
    ...over,
  });
  const seed = async (id: string, data: Record<string, unknown>) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'verticalProspects', id), data);
  });
  const daysAgo = (d: number) => Timestamp.fromMillis(Date.now() - d * 86400000);

  test('staff read; guests/strangers cannot', async () => {
    await seed('p1', { ...base(), createdAt: daysAgo(1), lastActivityAt: daysAgo(1) });
    for (const u of [BDM, AM, LEADER, GM, SUPER]) await assertSucceeds(getDoc(doc(db(u), 'verticalProspects', 'p1')));
    for (const u of [GUEST, STRANGER]) await assertFails(getDoc(doc(db(u), 'verticalProspects', 'p1')));
    await assertFails(getDocs(collection(db(GUEST), 'verticalProspects')));
  });

  test('BDM/admin create (validated); AM cannot; creator must be self', async () => {
    await assertSucceeds(addDoc(collection(db(BDM), 'verticalProspects'), base()));
    await assertSucceeds(addDoc(collection(db(LEADER), 'verticalProspects'), base({ createdBy: LEADER })));
    await assertSucceeds(addDoc(collection(db(BDM), 'verticalProspects'), base({ source: 'RESEARCH' })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ source: 'SCRAPED' })));
    await assertFails(addDoc(collection(db(AM), 'verticalProspects'), base({ createdBy: AM })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ createdBy: BDM2 })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ vertical: 'CRYPTO' })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ score: 6 })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ isAdmin: true })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ company: '' })));
    // score / claim require SF status first
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ score: 2 })));
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ ownerUid: BDM })));
    await assertSucceeds(addDoc(collection(db(BDM), 'verticalProspects'), base({ ownerUid: BDM, sfStatus: 'NOT_IN_SF', score: 3 })));
  });

  test('intel: LOOKALIKE source ok; clients cannot set/alter painSignals; server-written pain survives edits; intel collections closed', async () => {
    await assertSucceeds(addDoc(collection(db(BDM), 'verticalProspects'), base({ source: 'LOOKALIKE' })));
    const pain = { score: 'HIGH', carrier: 'X', findings: [], opening: null, checkedAt: 1, noSignal: false };
    await assertFails(addDoc(collection(db(BDM), 'verticalProspects'), base({ painSignals: pain })));
    await assertFails(addDoc(collection(db(LEADER), 'verticalProspects'), base({ createdBy: LEADER, painCheckedAt: serverTimestamp() })));
    // Doc already carrying server-written intel
    await seed('i1', { ...base(), painSignals: pain, painCheckedAt: daysAgo(1), createdAt: daysAgo(1), lastActivityAt: daysAgo(1) });
    await assertSucceeds(updateDoc(doc(db(BDM), 'verticalProspects', 'i1'), { notes: 'still fine', lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'i1'), { painSignals: { ...pain, score: 'NONE' }, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(LEADER), 'verticalProspects', 'i1'), { painCheckedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(LEADER), 'verticalProspects', 'i1'), { painSignals: null, lastActivityAt: serverTimestamp() }));
    for (const u of [BDM, LEADER, SUPER]) {
      await assertFails(getDoc(doc(db(u), 'intelCache', 'pain_acme')));
      await assertFails(setDoc(doc(db(u), 'intelUsage', `${u}_20261018`), { count: 0 }));
    }
  });

  test('claim: only after SF check, not for EXISTING_AM, not when claimed by someone else', async () => {
    await seed('u', { ...base(), createdAt: daysAgo(1), lastActivityAt: daysAgo(1) });
    await assertFails(updateDoc(doc(db(BDM2), 'verticalProspects', 'u'), { ownerUid: BDM2, ownerName: 'Bob', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(BDM2), 'verticalProspects', 'u'), { sfStatus: 'NOT_IN_SF', sfCheckedBy: BDM2, sfCheckedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(BDM2), 'verticalProspects', 'u'), { ownerUid: BDM2, ownerName: 'Bob', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    // Now owned by BDM2 → BDM can't edit/claim it
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'u'), { ownerUid: BDM, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'u'), { notes: 'hijack', lastActivityAt: serverTimestamp() }));
    // Can't claim on behalf of someone else
    await seed('u2', { ...base({ sfStatus: 'NOT_IN_SF' }), createdAt: daysAgo(1), lastActivityAt: daysAgo(1) });
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'u2'), { ownerUid: BDM2, lastActivityAt: serverTimestamp() }));
    // EXISTING_AM is locked from BDM claim
    await seed('am', { ...base({ sfStatus: 'EXISTING_AM' }), createdAt: daysAgo(1), lastActivityAt: daysAgo(1) });
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'am'), { ownerUid: BDM, ownerName: 'Bea', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    // Setting EXISTING_AM while owned is invalid unless released
    await seed('own', { ...base({ sfStatus: 'NOT_IN_SF', ownerUid: BDM }), createdAt: daysAgo(1), lastActivityAt: daysAgo(1) });
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'own'), { sfStatus: 'EXISTING_AM', lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db(BDM), 'verticalProspects', 'own'), { sfStatus: 'EXISTING_AM', ownerUid: null, ownerName: null, claimedAt: null, amUid: AM, amName: 'Amy', lastActivityAt: serverTimestamp() }));
  });

  test('lapsed claim (30+ days no activity) can be claimed by another BDM', async () => {
    await seed('old', { ...base({ sfStatus: 'NOT_IN_SF', ownerUid: BDM, ownerName: 'Bea' }), claimedAt: daysAgo(40), createdAt: daysAgo(40), lastActivityAt: daysAgo(31) });
    await assertSucceeds(updateDoc(doc(db(BDM2), 'verticalProspects', 'old'), { ownerUid: BDM2, ownerName: 'Bob', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    await seed('fresh', { ...base({ sfStatus: 'NOT_IN_SF', ownerUid: BDM, ownerName: 'Bea' }), claimedAt: daysAgo(20), createdAt: daysAgo(20), lastActivityAt: daysAgo(20) });
    await assertFails(updateDoc(doc(db(BDM2), 'verticalProspects', 'fresh'), { ownerUid: BDM2, ownerName: 'Bob', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
  });

  test('owner scores, converts, releases; cannot change creator', async () => {
    await seed('o', { ...base({ sfStatus: 'NOT_IN_SF', ownerUid: BDM }), createdAt: daysAgo(2), lastActivityAt: daysAgo(1) });
    const r = doc(db(BDM), 'verticalProspects', 'o');
    await assertSucceeds(updateDoc(r, { scores: { frequency: true, freightFit: true, regionalNeed: false, carrierPain: false, growth: false }, score: 2, lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(r, { convertedAt: serverTimestamp(), convertedBy: BDM, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(r, { createdBy: BDM2, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(r, { score: 9, lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(r, { ownerUid: null, ownerName: null, claimedAt: null, lastActivityAt: serverTimestamp() }));
  });

  test('AM: routed lead growth notes only; cannot claim or edit others', async () => {
    await seed('r', { ...base({ sfStatus: 'EXISTING_AM', amUid: AM, amName: 'Amy' }), createdAt: daysAgo(2), lastActivityAt: daysAgo(1) });
    await seed('n', { ...base({ sfStatus: 'NOT_IN_SF' }), createdAt: daysAgo(2), lastActivityAt: daysAgo(1) });
    await assertSucceeds(updateDoc(doc(db(AM), 'verticalProspects', 'r'), { amNotes: 'Upsell regional lanes', lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(AM), 'verticalProspects', 'r'), { sfStatus: 'NOT_IN_SF', lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(AM), 'verticalProspects', 'r'), { amUid: null, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(AM), 'verticalProspects', 'n'), { ownerUid: AM, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(AM), 'verticalProspects', 'n'), { amNotes: 'x', lastActivityAt: serverTimestamp() }));
  });

  test('AM assigned as owner by a leader can work and release it, not claim others', async () => {
    await seed('ao', { ...base({ sfStatus: 'NOT_IN_SF' }), createdAt: daysAgo(2), lastActivityAt: daysAgo(1) });
    await assertSucceeds(updateDoc(doc(db(LEADER), 'verticalProspects', 'ao'), { ownerUid: AM, ownerName: 'Amy', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    const r = doc(db(AM), 'verticalProspects', 'ao');
    await assertSucceeds(updateDoc(r, { notes: 'Called ops manager', lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(r, { scores: { frequency: true, freightFit: false, regionalNeed: false, carrierPain: false, growth: false }, score: 1, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(r, { ownerUid: BDM, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(BDM), 'verticalProspects', 'ao'), { notes: 'hijack', lastActivityAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(r, { ownerUid: null, ownerName: null, claimedAt: null, lastActivityAt: serverTimestamp() }));
    // Once released, the AM can't edit or re-claim it
    await assertFails(updateDoc(r, { ownerUid: AM, lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(r, { notes: 'x', lastActivityAt: serverTimestamp() }));
    // A lapsed AM-owned claim is no longer editable by that AM
    await seed('al', { ...base({ sfStatus: 'NOT_IN_SF', ownerUid: AM, ownerName: 'Amy' }), claimedAt: daysAgo(40), createdAt: daysAgo(40), lastActivityAt: daysAgo(31) });
    await assertFails(updateDoc(doc(db(AM), 'verticalProspects', 'al'), { notes: 'late', lastActivityAt: serverTimestamp() }));
  });

  test('admins override/reassign; delete by owner or admin only', async () => {
    await seed('a', { ...base({ sfStatus: 'NOT_IN_SF', ownerUid: BDM }), createdAt: daysAgo(2), lastActivityAt: daysAgo(1) });
    await assertSucceeds(updateDoc(doc(db(GM), 'verticalProspects', 'a'), { ownerUid: BDM2, ownerName: 'Bob', claimedAt: serverTimestamp(), lastActivityAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db(GM), 'verticalProspects', 'a'), { bogus: 1, lastActivityAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db(BDM), 'verticalProspects', 'a')));
    await assertFails(deleteDoc(doc(db(AM), 'verticalProspects', 'a')));
    await assertSucceeds(deleteDoc(doc(db(BDM2), 'verticalProspects', 'a')));
    await seed('b', { ...base(), createdAt: daysAgo(2), lastActivityAt: daysAgo(1) });
    await assertSucceeds(deleteDoc(doc(db(SUPER), 'verticalProspects', 'b')));
  });
});

describe('Fuel surcharges', () => {
  const ov = (over: Record<string, unknown> = {}) => ({ pct: 18.5, label: 'Domestic', note: 'Oct rate card', effective: '2026-10-01', enteredBy: LEADER, enteredByName: 'Lee', enteredAt: serverTimestamp(), ...over });
  test('staff read scraped data; nobody writes it client-side; guests cannot read', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'fuelSurcharges', 'tge'), { carrierId: 'tge', status: 'ok' });
      await setDoc(doc(ctx.firestore(), 'fuelSurchargeHistory', 'h1'), { carrierId: 'tge' });
    });
    for (const u of [BDM, AM, LEADER, SUPER]) {
      await assertSucceeds(getDoc(doc(db(u), 'fuelSurcharges', 'tge')));
      await assertSucceeds(getDocs(collection(db(u), 'fuelSurchargeHistory')));
    }
    for (const u of [GUEST, STRANGER]) await assertFails(getDoc(doc(db(u), 'fuelSurcharges', 'tge')));
    for (const u of [BDM, LEADER, SUPER]) {
      await assertFails(setDoc(doc(db(u), 'fuelSurcharges', 'tge'), { carrierId: 'tge', status: 'ok' }));
      await assertFails(addDoc(collection(db(u), 'fuelSurchargeHistory'), { carrierId: 'tge' }));
      await assertFails(setDoc(doc(db(u), 'fuelSurchargeMeta', 'refresh'), { lastRunAt: 0 }));
      await assertFails(getDoc(doc(db(u), 'fuelSurchargeMeta', 'refresh')));
    }
  });
  test('only admins write validated manual overrides', async () => {
    await assertSucceeds(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal'), ov()));
    await assertSucceeds(setDoc(doc(db(SUPER), 'fuelSurchargeOverrides', 'tge'), ov({ enteredBy: SUPER, effective: null })));
    await assertSucceeds(getDoc(doc(db(BDM), 'fuelSurchargeOverrides', 'kal')));
    await assertFails(getDoc(doc(db(GUEST), 'fuelSurchargeOverrides', 'kal')));
    await assertFails(setDoc(doc(db(BDM), 'fuelSurchargeOverrides', 'kal'), ov({ enteredBy: BDM })));
    await assertFails(setDoc(doc(db(AM), 'fuelSurchargeOverrides', 'kal'), ov({ enteredBy: AM })));
    await assertFails(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'evilcorp'), ov()));
    await assertFails(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal'), ov({ pct: 150 })));
    await assertFails(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal'), ov({ pct: '18' })));
    await assertFails(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal'), ov({ enteredBy: BDM })));
    await assertFails(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal'), ov({ extra: 1 })));
    await assertFails(setDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal'), ov({ effective: 'soon' })));
    await assertFails(deleteDoc(doc(db(BDM), 'fuelSurchargeOverrides', 'kal')));
    await assertSucceeds(deleteDoc(doc(db(LEADER), 'fuelSurchargeOverrides', 'kal')));
  });
});

describe('Verticals: verticalDismissals ("Trading with TGE")', () => {
  const payload = (uid: string, over: Record<string, unknown> = {}) => ({
    company: 'Kitchen Warehouse', reason: 'TRADING_WITH_TGE', suggestedId: 'kitchen-warehouse',
    dismissedBy: uid, dismissedByName: 'Someone', dismissedAt: serverTimestamp(), ...over,
  });
  const seed = async (key: string) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'verticalDismissals', key), { ...payload(BDM), dismissedAt: Timestamp.now() });
  });

  test('BDM, AM and admins can mark a company; the marker is shared with all staff', async () => {
    await assertSucceeds(setDoc(doc(db(BDM), 'verticalDismissals', 'kitchenwarehouse'), payload(BDM)));
    await assertSucceeds(setDoc(doc(db(AM), 'verticalDismissals', 'acme'), payload(AM)));
    await assertSucceeds(setDoc(doc(db(LEADER), 'verticalDismissals', 'bunnings'), payload(LEADER)));
    for (const u of [BDM, BDM2, AM, LEADER, GM, SUPER]) {
      await assertSucceeds(getDoc(doc(db(u), 'verticalDismissals', 'kitchenwarehouse')));
      await assertSucceeds(getDocs(collection(db(u), 'verticalDismissals')));
    }
  });

  test('guests and strangers cannot read or write', async () => {
    await seed('kitchenwarehouse');
    for (const u of [GUEST, STRANGER]) {
      await assertFails(getDoc(doc(db(u), 'verticalDismissals', 'kitchenwarehouse')));
      await assertFails(setDoc(doc(db(u), 'verticalDismissals', 'other'), payload(u)));
      await assertFails(deleteDoc(doc(db(u), 'verticalDismissals', 'kitchenwarehouse')));
    }
  });

  test('create is validated: own uid, fixed reason, clean key, no extra fields, server time', async () => {
    await assertFails(setDoc(doc(db(BDM), 'verticalDismissals', 'a'), payload(BDM2)));
    await assertFails(setDoc(doc(db(BDM), 'verticalDismissals', 'a'), payload(BDM, { reason: 'OTHER' })));
    await assertFails(setDoc(doc(db(BDM), 'verticalDismissals', 'Not Clean'), payload(BDM)));
    await assertFails(setDoc(doc(db(BDM), 'verticalDismissals', 'a'), payload(BDM, { isAdmin: true })));
    await assertFails(setDoc(doc(db(BDM), 'verticalDismissals', 'a'), payload(BDM, { company: '' })));
    await assertFails(setDoc(doc(db(BDM), 'verticalDismissals', 'a'), payload(BDM, { dismissedAt: Timestamp.fromMillis(1) })));
    await assertSucceeds(setDoc(doc(db(BDM), 'verticalDismissals', 'a'), (({ suggestedId, ...rest }) => rest)(payload(BDM))));
  });

  test('markers cannot be edited; staff can delete (undo / restore)', async () => {
    await seed('kitchenwarehouse');
    await assertFails(updateDoc(doc(db(BDM), 'verticalDismissals', 'kitchenwarehouse'), { company: 'x' }));
    await assertFails(setDoc(doc(db(BDM2), 'verticalDismissals', 'kitchenwarehouse'), payload(BDM2)));
    await assertSucceeds(deleteDoc(doc(db(BDM2), 'verticalDismissals', 'kitchenwarehouse')));
    await seed('kitchenwarehouse');
    await assertSucceeds(deleteDoc(doc(db(AM), 'verticalDismissals', 'kitchenwarehouse')));
  });
});

describe('Access: dataShares (one-way, full access)', () => {
  // BDM (owner) shares with BDM2 (viewer): FF (+ linked WS & CP) only. AM gets canvassing only.
  const share = (owner: string, viewer: string, areas: Record<string, boolean>) => ({
    ownerId: owner, viewerId: viewer, ownerName: 'o', viewerName: 'v', areas,
  });

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const a = ctx.firestore();
      await setDoc(doc(a, 'dataShares', `${BDM}_${BDM2}`), share(BDM, BDM2, { factFinding: true, whiteSpace: true, callPlans: true, canvassing: false }));
      await setDoc(doc(a, 'dataShares', `${BDM}_${AM}`), share(BDM, AM, { factFinding: false, whiteSpace: false, callPlans: false, canvassing: true }));
      await setDoc(doc(a, 'whitespacePlans', 'w1'), { userId: BDM, accountName: 'Acme' });
      await setDoc(doc(a, 'callPlans', 'cp1'), { userId: BDM, accountName: 'Acme' });
      await setDoc(doc(a, 'canvass_leads', 'l1'), { userId: BDM, companyName: 'Acme' });
      await setDoc(doc(a, 'canvass_leads', 'l2'), { userId: BDM2, companyName: 'Own' });
    });
  });

  test('only admins write shares; viewers read only their own incoming shares', async () => {
    await assertSucceeds(setDoc(doc(db(LEADER), 'dataShares', `${BDM2}_${AM}`), share(BDM2, AM, { factFinding: true })));
    await assertSucceeds(setDoc(doc(db(GM), 'dataShares', `${BDM2}_${BDM}`), share(BDM2, BDM, { canvassing: true })));
    await assertFails(setDoc(doc(db(BDM), 'dataShares', `${BDM}_${BDM2}`), share(BDM, BDM2, { factFinding: true })));
    await assertFails(setDoc(doc(db(BDM2), 'dataShares', `${BDM}_${BDM2}`), share(BDM, BDM2, { factFinding: true, canvassing: true })));
    await assertFails(deleteDoc(doc(db(BDM2), 'dataShares', `${BDM}_${BDM2}`)));
    // malformed: id mismatch, self share
    await assertFails(setDoc(doc(db(LEADER), 'dataShares', 'wrong-id'), share(BDM, BDM2, { factFinding: true })));
    await assertFails(setDoc(doc(db(LEADER), 'dataShares', `${BDM}_${BDM}`), share(BDM, BDM, { factFinding: true })));
    // viewer reads own incoming shares; not someone else's
    await assertSucceeds(getDocs(query(collection(db(BDM2), 'dataShares'), where('viewerId', '==', BDM2))));
    await assertSucceeds(getDoc(doc(db(BDM2), 'dataShares', `${BDM}_${BDM2}`)));
    await assertFails(getDoc(doc(db(BDM2), 'dataShares', `${BDM}_${AM}`)));
    await assertFails(getDocs(collection(db(BDM2), 'dataShares')));
    await assertFails(getDoc(doc(db(GUEST), 'dataShares', `${BDM}_${BDM2}`)));
    await assertSucceeds(getDocs(collection(db(LEADER), 'dataShares')));
  });

  test('a share does NOT make anyone an admin (no escalation via dataShares)', async () => {
    await assertFails(setDoc(doc(db(BDM2), 'users', BDM2), { name: 'Bob', role: 'ADMIN', email: 'bob@teamglobalexp.com' }));
    await assertFails(getDocs(collection(db(BDM2), 'canvass_leads')));
  });

  test('Fact Finding share: viewer gets full access to owner FF + linked White Space + Call Plans', async () => {
    await assertSucceeds(getDocs(query(collection(db(BDM2), 'factFindingDocs'), where('userId', '==', BDM))));
    await assertSucceeds(getDoc(doc(db(BDM2), 'factFindingDocs', 'f1')));
    await assertSucceeds(updateDoc(doc(db(BDM2), 'factFindingDocs', 'f1'), { companyName: 'Acme Edited' }));
    await assertSucceeds(getDocs(query(collection(db(BDM2), 'whitespacePlans'), where('userId', '==', BDM))));
    await assertSucceeds(updateDoc(doc(db(BDM2), 'whitespacePlans', 'w1'), { accountName: 'Acme 2' }));
    await assertSucceeds(getDoc(doc(db(BDM2), 'callPlans', 'cp1')));
    await assertSucceeds(updateDoc(doc(db(BDM2), 'callPlans', 'cp1'), { objective: 'x' }));
    await assertSucceeds(deleteDoc(doc(db(BDM2), 'callPlans', 'cp1')));
    await assertSucceeds(deleteDoc(doc(db(BDM2), 'whitespacePlans', 'w1')));
    await assertSucceeds(deleteDoc(doc(db(BDM2), 'factFindingDocs', 'f1')));
  });

  test('shared edits cannot take over ownership (keepsOwner)', async () => {
    await assertFails(updateDoc(doc(db(BDM2), 'factFindingDocs', 'f1'), { userId: BDM2 }));
    await assertFails(updateDoc(doc(db(BDM2), 'callPlans', 'cp1'), { userId: BDM2 }));
    await assertSucceeds(updateDoc(doc(db(BDM2), 'factFindingDocs', 'f1'), { userId: BDM, note: 'ok' }));
  });

  test('sharing is per area: FF share does not give Canvassing', async () => {
    await assertFails(getDoc(doc(db(BDM2), 'canvass_leads', 'l1')));
    await assertFails(updateDoc(doc(db(BDM2), 'canvass_leads', 'l1'), { companyName: 'x' }));
    await assertFails(deleteDoc(doc(db(BDM2), 'canvass_leads', 'l1')));
  });

  test('Canvassing share: AM gets canvass leads only, not Fact Finding / White Space / Call Plans', async () => {
    await assertSucceeds(getDocs(query(collection(db(AM), 'canvass_leads'), where('userId', '==', BDM))));
    await assertSucceeds(updateDoc(doc(db(AM), 'canvass_leads', 'l1'), { companyName: 'Edited' }));
    await assertSucceeds(deleteDoc(doc(db(AM), 'canvass_leads', 'l1')));
    await assertFails(getDoc(doc(db(AM), 'factFindingDocs', 'f1')));
    await assertFails(getDoc(doc(db(AM), 'whitespacePlans', 'w1')));
    await assertFails(getDoc(doc(db(AM), 'callPlans', 'cp1')));
    await assertFails(deleteDoc(doc(db(AM), 'factFindingDocs', 'f1')));
  });

  test('one-way: owner does NOT get the viewer\'s data', async () => {
    await assertFails(getDoc(doc(db(BDM), 'factFindingDocs', 'f2')));
    await assertFails(getDoc(doc(db(BDM), 'canvass_leads', 'l2')));
    await assertFails(updateDoc(doc(db(BDM), 'canvass_leads', 'l2'), { companyName: 'x' }));
  });

  test('shares do not leak to third parties, guests, or other owners\' data', async () => {
    await assertFails(getDoc(doc(db(AM), 'factFindingDocs', 'f1')));
    await assertFails(getDoc(doc(db(GUEST), 'factFindingDocs', 'f1')));
    await assertFails(getDoc(doc(db(STRANGER), 'factFindingDocs', 'f1')));
    // BDM2 has a share from BDM only; AM's own FF doc elsewhere stays private
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'factFindingDocs', 'f-am'), { userId: AM, companyName: 'AmCo' }); });
    await assertFails(getDoc(doc(db(BDM2), 'factFindingDocs', 'f-am')));
  });

  test('revoking a share removes access immediately', async () => {
    await assertSucceeds(getDoc(doc(db(BDM2), 'factFindingDocs', 'f1')));
    await assertSucceeds(deleteDoc(doc(db(LEADER), 'dataShares', `${BDM}_${BDM2}`)));
    await assertFails(getDoc(doc(db(BDM2), 'factFindingDocs', 'f1')));
    await assertFails(getDoc(doc(db(BDM2), 'callPlans', 'cp1')));
  });
});

describe('Dashboard Designer: appSettings/global layout writes are admin-only', () => {
  const payload = () => ({
    dashboardLayout: [{ id: 'today', name: 'Today', width: 3, visible: true }],
    leaderDashboardLayout: [{ id: 'team-snapshot', name: 'Team', width: 3, visible: true }],
    useSameLayoutForLeaders: false,
    dashboardLayoutHistory: [{ savedAt: 1, savedBy: LEADER, savedByName: 'Lea', everyone: [], leaders: [], useSameLayoutForLeaders: false }],
    dashboardLayoutUpdatedAt: serverTimestamp(),
    dashboardLayoutUpdatedBy: LEADER,
  });

  test('admin roles (role field only) can save the layout', async () => {
    for (const uid of [LEADER, GM, SUPER]) {
      await assertSucceeds(setDoc(doc(db(uid), 'appSettings', 'global'), payload(), { merge: true }));
    }
  });

  test('BDM, Account Manager, guests, strangers and signed-out users cannot', async () => {
    for (const uid of [BDM, AM, GUEST, STRANGER, undefined]) {
      await assertFails(setDoc(doc(db(uid), 'appSettings', 'global'), payload(), { merge: true }));
      await assertFails(updateDoc(doc(db(uid), 'appSettings', 'global'), { dashboardLayout: [] }));
    }
  });

  test('staff can read the layout (BDM/AM dashboards need it); guests and signed-out users cannot', async () => {
    for (const uid of [BDM, AM, LEADER]) await assertSucceeds(getDoc(doc(db(uid), 'appSettings', 'global')));
    for (const uid of [GUEST, STRANGER, undefined]) await assertFails(getDoc(doc(db(uid), 'appSettings', 'global')));
  });
});

describe('NWA: per-week business updates and team KPI targets (appSettings)', () => {
  const ids = ['nwaBusinessUpdates_2026-30', 'nwaKpiTargets'];

  test('staff can read; guests and signed-out users cannot', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const id of ids) await setDoc(doc(ctx.firestore(), 'appSettings', id), { seeded: true });
    });
    for (const id of ids) {
      for (const uid of [BDM, AM, LEADER]) await assertSucceeds(getDoc(doc(db(uid), 'appSettings', id)));
      for (const uid of [GUEST, STRANGER, undefined]) await assertFails(getDoc(doc(db(uid), 'appSettings', id)));
    }
  });

  test('leaders can write; BDMs and AMs cannot', async () => {
    for (const id of ids) {
      for (const uid of [LEADER, GM, SUPER]) await assertSucceeds(setDoc(doc(db(uid), 'appSettings', id), { updatedBy: uid }, { merge: true }));
      for (const uid of [BDM, AM, GUEST, undefined]) await assertFails(setDoc(doc(db(uid), 'appSettings', id), { updatedBy: 'x' }, { merge: true }));
    }
  });
});

describe('Verticals: discoveredLeads ("Find new leads")', () => {
  const lead = (over: Record<string, unknown> = {}) => ({
    company: 'New Med Supplies', website: 'https://newmed.com.au', domain: 'newmed.com.au', vertical: 'MEDICAL',
    whyTheyShip: 'Ships clinic consumables', discoveredBy: LEADER, discoveredByName: 'Lea', createdAt: serverTimestamp(), ...over,
  });
  const seed = async () => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'discoveredLeads', 'newmedsupplies'), { ...lead(), createdAt: Timestamp.now() });
  });

  test('all staff can read; guests and strangers cannot', async () => {
    await seed();
    for (const u of [BDM, BDM2, AM, LEADER, GM, SUPER]) {
      await assertSucceeds(getDoc(doc(db(u), 'discoveredLeads', 'newmedsupplies')));
      await assertSucceeds(getDocs(collection(db(u), 'discoveredLeads')));
    }
    for (const u of [GUEST, STRANGER]) {
      await assertFails(getDoc(doc(db(u), 'discoveredLeads', 'newmedsupplies')));
      await assertFails(getDocs(collection(db(u), 'discoveredLeads')));
    }
    await assertFails(getDoc(doc(db(), 'discoveredLeads', 'newmedsupplies')));
  });

  test('no client creates or edits, even for admins (server route only)', async () => {
    await seed();
    for (const u of [BDM, AM, LEADER, GM, SUPER, GUEST]) {
      await assertFails(setDoc(doc(db(u), 'discoveredLeads', 'other'), lead({ discoveredBy: u })));
      await assertFails(updateDoc(doc(db(u), 'discoveredLeads', 'newmedsupplies'), { company: 'x' }));
    }
  });

  test('only leaders/admins can remove a find', async () => {
    await seed();
    for (const u of [BDM, AM, GUEST, STRANGER]) await assertFails(deleteDoc(doc(db(u), 'discoveredLeads', 'newmedsupplies')));
    await assertSucceeds(deleteDoc(doc(db(GM), 'discoveredLeads', 'newmedsupplies')));
  });
});

describe('NWA whole-team view: person colours and team reads', () => {
  test('leaders can set and clear users/{uid}.nwaColor; BDMs cannot set a teammate’s', async () => {
    for (const uid of [LEADER, GM, SUPER]) {
      await assertSucceeds(setDoc(doc(db(uid), 'users', AM), { nwaColor: 'lavender' }, { merge: true }));
      await assertSucceeds(updateDoc(doc(db(uid), 'users', AM), { nwaColor: null }));
    }
    await assertFails(setDoc(doc(db(BDM), 'users', AM), { nwaColor: 'sky' }, { merge: true }));
    await assertFails(setDoc(doc(db(GUEST), 'users', AM), { nwaColor: 'sky' }, { merge: true }));
  });

  test('leaders can read every weeklyCommitments doc for the plan and review weeks; BDMs only their own', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const a = ctx.firestore();
      await setDoc(doc(a, 'weeklyCommitments', `${BDM}_2026-44`), { userId: BDM, week: '2026-44', status: 'SUBMITTED' });
      await setDoc(doc(a, 'weeklyCommitments', `${AM}_2026-43`), { userId: AM, week: '2026-43', status: 'SUBMITTED' });
    });
    const teamQuery = (uid?: string) => query(collection(db(uid), 'weeklyCommitments'), where('week', 'in', ['2026-44', '2026-43']));
    for (const uid of [LEADER, GM, SUPER]) {
      const snap = await assertSucceeds(getDocs(teamQuery(uid)));
      expect(snap.size).toBe(2);
    }
    await assertFails(getDocs(teamQuery(BDM)));
    await assertFails(getDoc(doc(db(BDM), 'weeklyCommitments', `${AM}_2026-43`)));
    await assertSucceeds(getDoc(doc(db(BDM), 'weeklyCommitments', `${BDM}_2026-44`)));
  });
});

describe('TWA leader sections: per-person notes and targets', () => {
  test('leaders write nwaLeaderNotes; the person reads their own; other reps cannot', async () => {
    const id = `${BDM}_2026-44`;
    const note = { userId: BDM, week: '2026-44', pipeline: 'Take over Acme', kpis: '', updates: '' };
    await assertSucceeds(getDoc(doc(db(BDM), 'nwaLeaderNotes', id))); // missing doc, own id
    await assertFails(getDoc(doc(db(BDM2), 'nwaLeaderNotes', id)));
    await assertFails(setDoc(doc(db(BDM), 'nwaLeaderNotes', id), note));
    for (const uid of [LEADER, GM, SUPER]) await assertSucceeds(setDoc(doc(db(uid), 'nwaLeaderNotes', id), note));
    await assertSucceeds(getDoc(doc(db(BDM), 'nwaLeaderNotes', id)));
    await assertFails(getDoc(doc(db(BDM2), 'nwaLeaderNotes', id)));
    await assertFails(getDoc(doc(db(GUEST), 'nwaLeaderNotes', id)));
    await assertSucceeds(getDocs(query(collection(db(LEADER), 'nwaLeaderNotes'), where('week', '==', '2026-44'))));
    await assertFails(getDocs(query(collection(db(BDM), 'nwaLeaderNotes'), where('week', '==', '2026-44'))));
  });

  test('reps cannot set their own nwaKpiTargets; leaders can', async () => {
    await assertFails(updateDoc(doc(db(BDM), 'users', BDM), { nwaKpiTargets: { callsTarget: 1 } }));
    await assertSucceeds(updateDoc(doc(db(BDM), 'users', BDM), { name: 'Bea M' }));
    await assertSucceeds(updateDoc(doc(db(LEADER), 'users', BDM), { nwaKpiTargets: { callsTarget: 40 } }));
  });

  test('leaders can read the team’s TWTWs and Salesforce appointments for a week', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'crmActivities', 'a1'), { userId: BDM, week: '2026-44', type: 'APP' });
    });
    await assertSucceeds(getDocs(query(collection(db(LEADER), 'twiwSubmissions'), where('week', '==', '2026-28'))));
    await assertSucceeds(getDocs(query(collection(db(LEADER), 'crmActivities'), where('type', '==', 'APP'), where('week', '==', '2026-44'))));
    await assertSucceeds(getDocs(query(collection(db(BDM), 'crmActivities'), where('userId', '==', BDM), where('week', '==', '2026-44'))));
  });
});
