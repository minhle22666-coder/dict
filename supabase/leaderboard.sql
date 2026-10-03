-- Focci's Little World: the leaderboard.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
--
-- A SEPARATE, slim table from user_state on purpose. user_state's RLS only
-- ever let someone read their own row -- that is what makes the public
-- "anon" key in cloud-config.js safe, because a row there is everything the
-- app keeps about a person (recent searches, saved words, the journal...).
-- A leaderboard needs the opposite -- everyone signed in can read every
-- row -- so it must never be the same table or the same columns. This one
-- carries only what is meant to be shown to other people: a name, a score,
-- a time-in-app total, and a heartbeat.

create table if not exists public.leaderboard (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Explorer',
  xp         integer not null default 0,
  time_ms    bigint not null default 0,
  avatar     text not null default 'mascot-avatar',
  last_seen  timestamptz not null default now()
);

-- If the table was already made without it (this file ran before the avatar
-- existed), this adds the column; on a fresh table it does nothing.
alter table public.leaderboard add column if not exists avatar text not null default 'mascot-avatar';

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard: read all"   on public.leaderboard;
drop policy if exists "leaderboard: own insert" on public.leaderboard;
drop policy if exists "leaderboard: own update" on public.leaderboard;
drop policy if exists "leaderboard: own delete" on public.leaderboard;

-- Anyone signed in can read every row (that is the whole point of a board).
-- Only a signed-in person's OWN row can be written by them.
create policy "leaderboard: read all"   on public.leaderboard for select using (auth.role() = 'authenticated');
create policy "leaderboard: own insert" on public.leaderboard for insert with check (auth.uid() = user_id);
create policy "leaderboard: own update" on public.leaderboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "leaderboard: own delete" on public.leaderboard for delete using (auth.uid() = user_id);

-- Same reason user_state needed this: newer Supabase projects do not hand
-- table rights to API roles on their own, RLS or not.
grant select, insert, update, delete on public.leaderboard to authenticated;
