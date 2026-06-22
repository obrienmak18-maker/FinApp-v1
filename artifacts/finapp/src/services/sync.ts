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
  await set(ref(firebaseDb, `groups/${groupId}`), sanitizeForFirebase(payload));
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

  const snap = await get(ref(firebaseDb, `groups/${groupId}`));
  return snap.exists() ? (snap.val() as SyncPayload) : null;
}

// ── Real-time subscription ─────────────────────────────────────────────────

export function subscribeToGroup(
  groupId: string,
  onUpdate: (payload: SyncPayload) => void
): () => void {
  if (SUPABASE_AVAILABLE && supabase) {
    return supabaseSubscribeGroup(groupId, onUpdate);
  }

  // Firebase fallback — onValue fires immediately + on any change
  const myDeviceId = getDeviceId();
  const unsub = onValue(ref(firebaseDb, `groups/${groupId}`), (snap) => {
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

  const localTx = await db.transactions.toArray();

  // Build lookup maps
  const localByUuid = new Map<string, Transaction>();
  for (const t of localTx) {
    if (t.uuid) localByUuid.set(t.uuid, t);
  }

  const toAdd: Omit<Transaction, 'id'>[] = [];
  const toUpdate: { id: number; changes: Partial<Transaction> }[] = [];

  const remoteTx = (remote.transactions || []) as Transaction[];

  for (const rt of remoteTx) {
    if (!rt.uuid) continue;

    const lt = localByUuid.get(rt.uuid);

    if (!lt) {
      // Brand new transaction from remote device — add it
      const { id: _id, ...rest } = rt as Transaction;
      toAdd.push(rest);
    } else {
      const remoteTs = rt.updatedAt ?? 0;
      const localTs = lt.updatedAt ?? 0;
      if (remoteTs > localTs) {
        // Remote is newer — update local copy
        toUpdate.push({ id: lt.id!, changes: { ...rt, id: lt.id } });
      }
      // else: local is newer or equal — keep local
    }
  }

  // Apply transaction changes
  for (const t of toAdd) await db.transactions.add(t as Transaction);
  for (const { id, changes } of toUpdate) await db.transactions.update(id, changes);

  // Merge categories — add any new ones from remote (match by nom + type)
  const localCats = await db.categories.toArray();
  const localCatKeys = new Set(localCats.map(c => `${c.type}::${c.nom.toLowerCase()}`));
  for (const rc of (remote.categories || []) as Category[]) {
    const key = `${rc.type}::${rc.nom.toLowerCase()}`;
    if (!localCatKeys.has(key)) {
      const { id: _id, parentId: _pid, ...rest } = rc;
      await db.categories.add({ ...rest, parentId: undefined });
    }
  }

  // Merge budgets — add missing ones (categorie + mois + annee key)
  const localBudgets = await db.budgets.toArray();
  const localBudgetKeys = new Set(localBudgets.map(b => `${b.categorie}::${b.mois}::${b.annee}`));
  for (const rb of (remote.budgets || []) as Budget[]) {
    const key = `${rb.categorie}::${rb.mois}::${rb.annee}`;
    if (!localBudgetKeys.has(key)) {
      const { id: _id, ...rest } = rb;
      await db.budgets.add(rest);
    }
  }

  // Merge projects — add missing ones (by titre)
  const localProjects = await db.projects.toArray();
  const localProjectTitles = new Set(localProjects.map(p => p.titre.toLowerCase()));
  for (const rp of (remote.projects || []) as Project[]) {
    if (!localProjectTitles.has(rp.titre.toLowerCase())) {
      const { id: _id, ...rest } = rp;
      await db.projects.add(rest);
    }
  }

  // ── Balance conflict detection ─────────────────────────────────────────
  const allTx = await db.transactions.toArray();
  const newBalance = allTx.reduce(
    (acc, t) => t.type === 'revenu' ? acc + t.montantConverti : acc - t.montantConverti,
    0
  );

  const conflicts: ConflictItem[] = [];

  if (newBalance < -0.01) {
    // Find recently added remote transactions (depenses) that likely caused the deficit
    for (const t of toAdd) {
      if (t.type === 'depense') {
        conflicts.push({
          uuid: t.uuid || '',
          amount: t.montantConverti,
          date: t.date,
          category: t.categorie,
          reason: 'balance_deficit',
        });
      }
    }
  }

  return { addedCount: toAdd.length, updatedCount: toUpdate.length, conflicts, newBalance };
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
