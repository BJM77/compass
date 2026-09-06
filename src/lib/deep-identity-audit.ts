import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';

/**
 * Opt-in deep identity and schema audit.
 * ONLY called when Super Admin explicitly clicks "Run Deep Audit" in the Developer Diagnostic UI.
 * Never runs on mount.
 */
export async function executeDeepIdentityAudit() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const db = getFirestore(app);

  const startTime = Date.now();

  // 1. Fetch users to build the ground truth UID set
  const usersSnap = await getDocs(collection(db, 'users'));
  const validUids = new Set<string>();
  const userNameMap = new Map<string, string>();

  usersSnap.forEach(d => {
    validUids.add(d.id);
    const data = d.data();
    if (data.name) userNameMap.set(d.id, data.name);
  });

  // 2. Audit primary collections for orphaned IDs or missing key fields
  const targetCollections = [
    { name: 'pipelineReviews', userField: 'userId', valueField: 'value' },
    { name: 'weeklyProgress', userField: 'userId', valueField: null },
    { name: 'weeklyReports', userField: 'userId', valueField: null },
    { name: 'weeklyCommitments', userField: 'userId', valueField: null },
    { name: 'whitespacePlans', userField: 'userId', valueField: null },
    { name: 'callPlans', userField: 'userId', valueField: null },
    { name: 'canvass_leads', userField: 'userId', valueField: null },
    { name: 'opsReports', userField: 'userId', valueField: null },
    { name: 'twiwSubmissions', userField: 'userId', valueField: null },
  ];

  const results: Record<string, any> = {
    totalRegisteredUsers: validUids.size,
    auditedCollections: {},
    overallOrphansFound: 0,
    scanDurationMs: 0,
    timestamp: new Date().toISOString(),
  };

  for (const target of targetCollections) {
    try {
      const snap = await getDocs(collection(db, target.name));
      const orphans = new Set<string>();
      let missingUserFieldCount = 0;
      let missingValueFieldCount = 0;

      snap.forEach(d => {
        const data = d.data();
        const uid = data[target.userField];
        if (!uid) {
          missingUserFieldCount++;
        } else if (!validUids.has(uid)) {
          orphans.add(uid);
        }

        if (target.valueField && (data[target.valueField] === undefined || data[target.valueField] === null)) {
          missingValueFieldCount++;
        }
      });

      results.auditedCollections[target.name] = {
        totalDocs: snap.size,
        distinctOrphanIds: Array.from(orphans),
        orphanCount: orphans.size,
        missingUserFieldCount,
        missingValueFieldCount,
      };

      results.overallOrphansFound += orphans.size;
    } catch (err: any) {
      results.auditedCollections[target.name] = {
        error: err?.message || String(err),
      };
    }
  }

  results.scanDurationMs = Date.now() - startTime;
  return results;
}
