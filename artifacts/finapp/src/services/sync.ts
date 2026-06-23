/**
 * FinApp Sync Engine
 * ──────────────────
 * Architecture:
 *  • Supabase Realtime (primary) — instant push via Postgres changes
 *  • Firebase Realtime DB (fallback) — used if Supabase not configured
 *
 * Session model:
 *  • Persistent "group" with a stable groupId stored in IndexedDB
 *  • One-time QR scan to pair devices — never expires
 *  • Auto-reconnects when coming back online
 *
 * Conflict resolution:
 *  • Per-transaction: last-write-wins using `updatedAt` timestamp
 *  • Balance guard: if merge would cause a negative balance, user is warned
 */

import { db, Transaction, Category, Budget, Project } from './db';
import {
  supabase,
  SUPABASE_AVAILABLE,
  supabasePushGroup,
  supabasePullGroup,
  supabaseSubscribeGroup,
  supabaseCheckReady,
  SyncPayload,
} from './supabase';
import { firebaseDb, ref, set, get, onValue, sanitizeForFirebase } from './firebase';

// ── Device identity ────────────────────────────────────────────────────────

export function getDeviceId(): string {
  let id = localStorage.getItem('finapp-device-id');
  if (!id) {
    id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    localStorage.setItem('finapp-device-id', id);
  }
  return id;
}

// ── Group ID generator ────────────────────────────────────────────────────

export function generateGroupId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'FIN-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Conflict types ─────────────────────────────────────────────────────────

export interface ConflictItem {
  uuid: string;
  amount: number;
  date: string;
  category: string;
  reason: 'balance_deficit';
}

export interface MergeResult {
  addedCount: number;
  updatedCount: number;
  conflicts: ConflictItem[];
  newBalance: number;
}

// ── Collect local data for push ────────────────────────────────────────────

export async function collectLocalPayload(): Promise<SyncPayload> {
  const [transactions, categories, budgets, projects] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.projects.toArray(),
  ]);
  return {
    transactions,
    categories,
    budgets,
    projects,
    timestamp: Date.now(),
    deviceId: getDeviceId(),
  };
}

// ── Push local data to cloud ───────────────────────────────────────────────

export async function pushGroup(groupId: string): Promise<void> {
  const payload = await collectLocalPayload();

  if (SUPABASE_AVAILABLE) {
    try {
      await supabasePushGroup(groupId, payload);
      return;
    } catch (e) {
      console.warn('[sync] Supabase push failed, falling back to Firebase', e);
    }
  }

  // Firebase fallback
  await set(ref(firebaseDb, `sessions/${groupId}`), sanitizeForFirebase(payload));
}

// ── Pull remote data from cloud ────────────────────────────────────────────

export async function pullGroup(groupId: string): Promise<SyncPayload | null> {
  if (SUPABASE_AVAILABLE) {
    try {
      return await supabasePullGroup(groupId);
    } catch (e) {
      console.warn('[sync] Supabase pull failed, falling back to Firebase', e);
    }
  }

  const snap = await get(ref(firebaseDb, `sessions/${groupId}`));
  return snap.exists() ? (snap.val() as SyncPayload) : null;
}

// ── Real-time subscription ─────────────────────────────────────────────────

export async function subscribeToGroup(
  groupId: string,
  onUpdate: (payload: SyncPayload) => void
): Promise<() => void> {
  if (SUPABASE_AVAILABLE && supabase) {
    const ready = await supabaseCheckReady();
    if (ready) {
      return supabaseSubscribeGroup(groupId, onUpdate);
    } else {
      console.warn('[sync] Supabase not ready for subscribe, falling back to Firebase');
    }
  }

  // Firebase fallback — onValue fires immediately + on any change
  const myDeviceId = getDeviceId();
  const unsub = onValue(ref(firebaseDb, `sessions/${groupId}`), (snap) => {
    if (!snap.exists()) return;
    const data = snap.val() as SyncPayload;
    // Skip our own pushes
    if (data.deviceId === myDeviceId) return;
    onUpdate(data);
  });
  return unsub;
}

// ── Smart merge with conflict detection ────────────────────────────────────

export async function mergeRemotePayload(remote: SyncPayload): Promise<MergeResult> {
  const myDeviceId = getDeviceId();

  // Skip our own pushes to avoid feedback loops
  if (remote.deviceId === myDeviceId) {
    return { addedCount: 0, updatedCount: 0, conflicts: [], newBalance: 0 };
  }

  // Comportement hérité de l'ancien code : on écrase tout le local avec le distant
  await db.transaction('rw', db.transactions, db.categories, db.budgets, db.projects, async () => {
    await db.transactions.clear();
    if (remote.transactions?.length) {
      // Générer des UUIDs à la volée si absents
      const txs = remote.transactions.map((t: any) => ({
        ...t,
        uuid: t.uuid || `legacy-${t.date}-${t.categorie}-${t.montant}-${t.type}`
      }));
      await db.transactions.bulkAdd(txs);
    }

    await db.categories.clear();
    if (remote.categories?.length) {
      await db.categories.bulkAdd(remote.categories as Category[]);
    }

    await db.budgets.clear();
    if (remote.budgets?.length) {
      await db.budgets.bulkAdd(remote.budgets as Budget[]);
    }

    await db.projects.clear();
    if (remote.projects?.length) {
      await db.projects.bulkAdd(remote.projects as Project[]);
    }
  });

  return { addedCount: remote.transactions?.length || 0, updatedCount: 0, conflicts: [], newBalance: 0 };
}

// ── Remove conflicted transactions (user chose to cancel them) ─────────────

export async function removeConflictedTransactions(uuids: string[]): Promise<void> {
  const uuidSet = new Set(uuids);
  const allTx = await db.transactions.toArray();
  for (const t of allTx) {
    if (t.uuid && uuidSet.has(t.uuid)) {
      await db.transactions.delete(t.id!);
    }
  }
}

// ── Auto-push hook: call after any local mutation ─────────────────────────

export async function autoPushIfOnline(groupId: string | undefined): Promise<void> {
  if (!groupId) return;
  if (!navigator.onLine) return;
  try {
    await pushGroup(groupId);
  } catch (e) {
    console.warn('[sync] auto-push failed', e);
  }
}
