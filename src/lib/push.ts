'use client';

/**
 * Firebase Cloud Messaging (web push) client helpers.
 *
 * Tokens live in users/{uid}/fcmTokens/{sha256(token)} and preferences in
 * users/{uid}/notificationSettings/prefs. Firestore rules only let the owner
 * read/write those; Cloud Functions (Admin SDK) read them to send pushes.
 */
import type { FirebaseApp } from 'firebase/app';
import { Firestore, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { env } from '@/env';
import { firebaseConfig } from '@/firebase/config';

export const VAPID_KEY = env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'Notification' in window
    && 'PushManager' in window;
}

/** iOS only supports web push for sites added to the Home Screen (iOS 16.4+). */
export function isIosNotInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  return ios && !standalone;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Service worker URL carrying the (public) Firebase web config as query params. */
function swUrl(): string {
  const p = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  return `/firebase-messaging-sw.js?${p.toString()}`;
}

async function getMessagingToken(app: FirebaseApp): Promise<string> {
  if (!VAPID_KEY) throw new Error('Push is not configured (NEXT_PUBLIC_FIREBASE_VAPID_KEY missing).');
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) throw new Error('This browser does not support push notifications.');
  const registration = await navigator.serviceWorker.register(swUrl(), { scope: '/firebase-cloud-messaging-push-scope' });
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Could not get a push token.');
  return token;
}

/** Ask permission, get an FCM token and store it under the user. */
export async function enablePush(app: FirebaseApp, db: Firestore, uid: string): Promise<void> {
  if (!pushSupported()) throw new Error(isIosNotInstalled()
    ? 'On iPhone/iPad, add BDM Compass to your Home Screen first, then enable notifications from the installed app.'
    : 'This browser does not support push notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');
  const token = await getMessagingToken(app);
  await setDoc(doc(db, 'users', uid, 'fcmTokens', await sha256Hex(token)), {
    token,
    userAgent: navigator.userAgent.slice(0, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Remove this device's token. */
export async function disablePushOnThisDevice(app: FirebaseApp, db: Firestore, uid: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted' || !VAPID_KEY) return;
  try {
    const token = await getMessagingToken(app);
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', await sha256Hex(token)));
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    await deleteToken(getMessaging(app));
  } catch (e) {
    console.warn('disablePush', e);
  }
}

/** Show foreground pushes as toasts. Returns an unsubscribe fn. */
export async function listenForeground(app: FirebaseApp, onMsg: (title: string, body: string) => void): Promise<() => void> {
  if (!pushSupported() || !VAPID_KEY || Notification.permission !== 'granted') return () => {};
  const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return () => {};
  return onMessage(getMessaging(app), (payload) => {
    const d = payload.data || {};
    onMsg(d.title || payload.notification?.title || 'BDM Compass', d.body || payload.notification?.body || '');
  });
}
