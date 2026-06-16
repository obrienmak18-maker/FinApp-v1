import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAmbKOliv3RTdWI4RfYhi3zsZULpW05aFs",
  authDomain: "finapp-a0ba6.firebaseapp.com",
  projectId: "finapp-a0ba6",
  storageBucket: "finapp-a0ba6.firebasestorage.app",
  messagingSenderId: "3357518635",
  appId: "1:3357518635:web:f87d9ca84a421f1817736e",
  databaseURL: "https://finapp-a0ba6-default-rtdb.firebaseio.com"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseDb = getDatabase(firebaseApp);
export { ref, set, get, onValue };

export function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'finapp-sync-';
  for (let i = 0; i < 7; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * Firebase Realtime Database rejects any value that contains `undefined`.
 * This utility recursively removes undefined fields and converts them to null
 * so the payload is always safe to send.
 */
export function sanitizeForFirebase<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirebase) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = sanitizeForFirebase(v);
      }
      // undefined values are simply omitted (Firebase doesn't accept them)
    }
    return cleaned as T;
  }
  return value;
}
