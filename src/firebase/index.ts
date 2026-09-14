'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';


/**
 * Global Firebase Initializer
 * Explicitly prioritizes the verified config object to resolve API Key expiration
 * and environment mismatch issues during hosting deployment.
 */
export function initializeFirebase() {
  let firebaseApp: FirebaseApp;

  if (!getApps().length) {
    // Explicitly initialize with the verified config object
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }

  return getSdks(firebaseApp);
}

import { initializeFirestore, getFirestore } from 'firebase/firestore';

export function getSdks(firebaseApp: FirebaseApp) {
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {});
  } catch (e) {
    firestore = getFirestore(firebaseApp);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
