import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

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
export { ref, set, get };

export function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'finapp-sync-';
  for (let i = 0; i < 7; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
