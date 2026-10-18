// Server-only: Firebase Admin (Application Default Credentials on App Hosting).
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (typeof window !== 'undefined') throw new Error('admin.ts is server-only');

function app() {
  return getApps()[0] || initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT });
}
export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
