-- FinApp Sync Sessions Table
-- Run this once in your Supabase SQL Editor (https://supabase.com/dashboard/project/pjrwkppngrpkaedfuunh/sql)

-- 1. Create the sync sessions table
create table if not exists public.sync_sessions (
  session_id  text        primary key,
  payload     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.sync_sessions enable row level security;

-- 3. Allow anyone to read/write (sessions are temporary, code-protected)
create policy "allow all on sync_sessions"
  on public.sync_sessions
  for all
  using (true)
  with check (true);

-- 4. Index for cleanup queries
create index if not exists idx_sync_sessions_created_at
  on public.sync_sessions (created_at);

-- 5. Optional: Auto-delete sessions older than 2 hours via pg_cron
-- (enable pg_cron in Supabase extensions first)
-- select cron.schedule('cleanup-sync-sessions', '0 * * * *',
--   $$delete from public.sync_sessions where created_at < now() - interval '2 hours'$$);
