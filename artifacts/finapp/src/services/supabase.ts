import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null;

export const SUPABASE_AVAILABLE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ─────────────────────────────────────────────────────────────────────
   SQL TO RUN ONCE in Supabase SQL Editor
   (https://supabase.com/dashboard/project/pjrwkppngrpkaedfuunh/sql/new)

   -- Persistent sync groups (never expires)
   create table if not exists public.finapp_sync_groups (
     group_id   text        primary key,
     payload    jsonb       not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );
   alter table public.finapp_sync_groups enable row level security;
   create policy "allow_all_sync_groups"
     on public.finapp_sync_groups for all using (true) with check (true);

   -- Enable Realtime for instant sync
   alter publication supabase_realtime add table public.finapp_sync_groups;
───────────────────────────────────────────────────────────────────── */

export type SyncPayload = {
  transactions: object[];
  categories: object[];
  budgets: object[];
  projects: object[];
  timestamp: number;
  deviceId: string;
};

export class SupabaseSetupError extends Error {
  readonly setupRequired = true;
  constructor() {
    super('Table finapp_sync_groups introuvable. Veuillez exécuter le SQL de configuration.');
  }
}

/** Check if the sync group table exists and is accessible */
export async function supabaseCheckReady(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('finapp_sync_groups')
      .select('group_id')
      .limit(1);
    if (!error || error.code === 'PGRST116') return true;
    return false;
  } catch {
    return false;
  }
}

/** Push payload to a persistent sync group (upsert) */
export async function supabasePushGroup(groupId: string, payload: SyncPayload): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré');
  const ready = await supabaseCheckReady();
  if (!ready) throw new SupabaseSetupError();
  const { error } = await supabase
    .from('finapp_sync_groups')
    .upsert(
      { group_id: groupId, payload, updated_at: new Date().toISOString() },
      { onConflict: 'group_id' }
    );
  if (error) throw new Error(error.message);
}

/** Pull the latest payload from a sync group */
export async function supabasePullGroup(groupId: string): Promise<SyncPayload | null> {
  if (!supabase) throw new Error('Supabase non configuré');
  const ready = await supabaseCheckReady();
  if (!ready) throw new SupabaseSetupError();
  const { data, error } = await supabase
    .from('finapp_sync_groups')
    .select('payload')
    .eq('group_id', groupId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return (data?.payload as SyncPayload) ?? null;
}

/** Subscribe to real-time changes on a sync group.
 *  Returns an unsubscribe function. */
export function supabaseSubscribeGroup(
  groupId: string,
  onUpdate: (payload: SyncPayload) => void
): () => void {
  if (!supabase) return () => {};
  const channel: RealtimeChannel = supabase
    .channel('finapp_group_' + groupId)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'finapp_sync_groups',
        filter: `group_id=eq.${groupId}`,
      },
      (pg) => {
        const p = (pg.new as { payload?: SyncPayload })?.payload;
        if (p) onUpdate(p);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'finapp_sync_groups',
        filter: `group_id=eq.${groupId}`,
      },
      (pg) => {
        const p = (pg.new as { payload?: SyncPayload })?.payload;
        if (p) onUpdate(p);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Legacy functions (kept for backward compat) ──────────────────────
export async function supabasePushSession(sessionId: string, payload: SyncPayload): Promise<void> {
  return supabasePushGroup(sessionId, payload);
}

export async function supabasePullSession(sessionId: string): Promise<SyncPayload | null> {
  return supabasePullGroup(sessionId);
}
