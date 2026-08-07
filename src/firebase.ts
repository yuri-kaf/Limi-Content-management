import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const isConfigured = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;

const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const db = isConfigured ? getFirestore(app!) : (null as any);
export const auth = isConfigured ? getAuth(app!) : (null as any);

// Creating an account signs that account in. Doing it on the primary app would
// evict the admin who is doing the creating, so provisioning runs on a separate
// named app instance whose session we throw away immediately afterwards.
const PROVISIONING_APP = 'provisioning';

export function getProvisioningAuth(): Auth {
  const existing: FirebaseApp | undefined = getApps().find((a) => a.name === PROVISIONING_APP);
  const secondary = existing ?? initializeApp(firebaseConfig, PROVISIONING_APP);
  return getAuth(secondary);
}
