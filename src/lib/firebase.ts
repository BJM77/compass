import { initializeFirebase } from '@/firebase';

/**
 * BDM Compass Firebase SDK Node
 * Consolidated to use the central initialization logic in @/firebase/index.ts
 * ensuring environment variables are respected and preventing key leakage.
 */
const { firebaseApp, auth, firestore } = initializeFirebase();

export { firebaseApp as default, auth, firestore as db };
export const storage = null; // Storage not currently implemented in core architecture
