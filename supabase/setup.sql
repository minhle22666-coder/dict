-- Focci's Little World: the cloud save.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
--
-- One row per person: everything the app keeps on the device that is THEIRS
-- (recent searches, saved words, words the AI wrote for them, XP, streaks,
-- quests, animals, the journal, game settings) as one JSON document. The
-- dictionary itself is not in it -- every device downloads that anyway.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  device     text,
  updated_at timestamptz not null default now()
);

-- Row-level security: a signed-in person can see and change only their own
-- row. This is what makes the public "anon" key in cloud-config.js safe.
alter table public.user_state enable row level security;

drop policy if exists "own row: read"   on public.user_state;
drop policy if exists "own row: insert" on public.user_state;
drop policy if exists "own row: update" on public.user_state;
drop policy if exists "own row: delete" on public.user_state;

create policy "own row: read"   on public.user_state for select using (auth.uid() = user_id);
create policy "own row: insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own row: update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.user_state for delete using (auth.uid() = user_id);

-- Newer Supabase projects do not hand table rights to the API roles on their
-- own: without this a signed-in person got "permission denied for table
-- user_state" before the row-level policies above were even asked. Signed-in
-- users only; the policies still limit each one to their own row.
grant select, insert, update, delete on public.user_state to authenticated;
