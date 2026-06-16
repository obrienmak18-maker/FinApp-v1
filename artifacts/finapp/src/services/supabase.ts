import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export const SUPABASE_AVAILABLE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ─────────────────────────────────────────────────────
   SETUP REQUIRED — run once in Supabase SQL Editor:
   https://supabase.com/dashboard/project/pjrwkppngrpkaedfuunh/sql/new

   create table if not exists public.sync_sessions (
     session_id  text        primary key,
     payload     jsonb       not null default '{}'::jsonb,
     created_at  timestamptz not null default now()
   );
   alter table public.sync_sessions enable row level security;
   create policy "allow all on sync_sessions"
     on public.sync_sessions for all using (true) with check (true);
───────────────────────────────────────────────────── */

export type SyncPayload = {
  transactions: object[];
  categories: object[];
  budgets: object[];
  projects: object[];
  timestamp: number;
};

export class SupabaseSetupError extends Error {
  readonly setupRequired = true;
  constructor() {
    super('Table sync_sessions introuvable. Veuillez créer la table dans le SQL Editor Supabase.');
  }
}

export async function supabaseCheckReady(): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('sync_sessions').select('session_id').limit(1);
  // PGRST116 = zero rows (table exists but empty) — that's fine
  if (!error || error.code === 'PGRST116') return true;
  // Table not found or RLS blocks read
  return false;
}

export async function supabasePushSession(sessionId: string, payload: SyncPayload): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré');
  const ready = await supabaseCheckReady();
  if (!ready) throw new SupabaseSetupError();
  const { error } = await supabase
    .from('sync_sessions')
    .upsert({ session_id: sessionId, payload }, { onConflict: 'session_id' });
  if (error) throw new Error(error.message);
}

export async function supabasePullSession(sessionId: string): Promise<SyncPayload | null> {
  if (!supabase) throw new Error('Supabase non configuré');
  const ready = await supabaseCheckReady();
  if (!ready) throw new SupabaseSetupError();
  const { data, error } = await supabase
    .from('sync_sessions')
    .select('payload')
    .eq('session_id', sessionId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(error.message);
  }
  return (data?.payload as SyncPayload) ?? null;
}
