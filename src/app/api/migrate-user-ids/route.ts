// src/app/api/migrate-user-ids/route.ts
import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Migration map connecting legacy string IDs to authoritative Firebase Auth UIDs.
 * If a legacy ID matches a key in this map, all documents referencing it will be updated
 * to use the corresponding Auth UID value.
 */
const USER_ID_MIGRATION_MAP: Record<string, string> = {
  // BDM & Account Manager legacy string IDs to Auth UIDs mapping
  'namra_khan': 'waHEXgLsIhVQTIvju6xiIef2gZg1',
  'namra': 'waHEXgLsIhVQTIvju6xiIef2gZg1',
  'jacqui_tibos': 'jacqui_tibos_uid_here',
  'jacqui': 'jacqui_tibos_uid_here',
  'joanne_ballantyne': 'Yk45HRB1jgUEMNt8KA9d0A2J4Ec2',
  'joanne': 'Yk45HRB1jgUEMNt8KA9d0A2J4Ec2',
  'joshua_mostratos': 'RkDxqotbg4a9KnQSJmFUpF2w5952',
  'joshua': 'RkDxqotbg4a9KnQSJmFUpF2w5952',
  'rienzie_delilkan': 'ggWpBYxcBFTyEtvXQLwlTLXLaU53',
  'rienzie': 'ggWpBYxcBFTyEtvXQLwlTLXLaU53',
  'isaac_depina': 'L5ts1fVEaQgf2oNhFDlr0C6eaIZ2',
  'isaac': 'L5ts1fVEaQgf2oNhFDlr0C6eaIZ2',
};

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        initializeApp({ credential: cert(serviceAccount) });
      } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
        initializeApp();
      }
    } else {
      initializeApp();
    }
  }
  return getFirestore();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { secret, customMappings } = body;
    const migrationSecret = process.env.MIGRATION_SECRET || 'compass-migration-secret';

    if (secret !== migrationSecret) {
      return NextResponse.json({ error: 'Unauthorized. Invalid secret.' }, { status: 401 });
    }

    const migrationMap = {
      ...USER_ID_MIGRATION_MAP,
      ...(customMappings || {}),
    };

    const db = getAdminDb();

    // Define all collections that contain a `userId` or user key field
    const collectionsToMigrate = [
      'pipelineReviews',
      'weeklyReports',
      'weeklyCommitments',
      'weeklyProgress',
      'factFindingDocs',
      'callPlans',
      'whitespacePlans',
      'opsReports',
      'twiwSubmissions',
      'monthlySmartGoals',
      'onboardingProgress',
      'successPlans',
      'canvass_leads',
    ];

    let totalUpdated = 0;
    const migrationLog: string[] = [];

    for (const collectionName of collectionsToMigrate) {
      console.log(`[Migration] Processing collection: ${collectionName}`);
      const snapshot = await db.collection(collectionName).get();

      if (snapshot.empty) {
        migrationLog.push(`Collection ${collectionName} is empty. Skipped.`);
        continue;
      }

      let batch = db.batch();
      let batchCount = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const currentUserId = data.userId || data.bdmId || data.salespersonId;

        if (!currentUserId) continue;

        const targetUid = migrationMap[currentUserId];
        if (targetUid && targetUid !== currentUserId) {
          const updates: Record<string, any> = {};
          if (data.userId) updates.userId = targetUid;
          if (data.bdmId) updates.bdmId = targetUid;
          if (data.salespersonId) updates.salespersonId = targetUid;

          batch.update(docSnap.ref, updates);
          batchCount++;
          totalUpdated++;

          // Also rename document IDs if they follow the pattern ${userId}_${week}
          if (docSnap.id.startsWith(`${currentUserId}_`)) {
            const newDocId = docSnap.id.replace(`${currentUserId}_`, `${targetUid}_`);
            const newDocRef = db.collection(collectionName).doc(newDocId);
            batch.set(newDocRef, { ...data, ...updates });
            batch.delete(docSnap.ref);
            batchCount++;
          }
        }

        // Commit in batches of 400 to observe Firestore limits (500 max operations per batch)
        if (batchCount >= 400) {
          await batch.commit();
          console.log(`[Migration] Committed ${batchCount} operations for ${collectionName}.`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`[Migration] Committed final ${batchCount} operations for ${collectionName}.`);
      }

      migrationLog.push(`Collection ${collectionName} processed.`);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully.',
      totalUpdated,
      migrationLog,
    });
  } catch (error: any) {
    console.error('Migration endpoint error:', error);
    return NextResponse.json({ error: error?.message || 'Migration failed' }, { status: 500 });
  }
}
