-- Run this file once in Supabase: SQL Editor -> New query -> Run.
-- It is idempotent: safe to run multiple times.

-- ─── series_entries ───────────────────────────────────────────────────────────

create table if not exists public.series_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null default 'series' check (media_type in ('series', 'movie')),
  tmdb_id integer,
  title text not null,
  poster_path text,
  collection text not null check (collection in ('watching', 'finished_airing_to_continue', 'up_to_date')),
  watched_episodes integer not null default 0 check (watched_episodes >= 0),
  total_episodes integer not null default 0 check (total_episodes >= 0),
  rating smallint check (rating between 1 and 5),
  review text,
  last_watched bigint,         -- unix ms timestamp of last episode marked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, media_type, title)
);

-- Upgrade from v1 schema (safe no-ops if columns already exist)
alter table public.series_entries add column if not exists media_type text not null default 'series';
alter table public.series_entries add column if not exists tmdb_id integer;
alter table public.series_entries add column if not exists poster_path text;
alter table public.series_entries add column if not exists last_watched bigint;
alter table public.series_entries drop constraint if exists series_entries_user_id_title_key;
alter table public.series_entries drop constraint if exists series_entries_user_media_title_key;
alter table public.series_entries add constraint series_entries_user_media_title_key unique (user_id, media_type, title);

alter table public.series_entries enable row level security;

drop policy if exists "Users can read their own series" on public.series_entries;
drop policy if exists "Users can add their own series" on public.series_entries;
drop policy if exists "Users can update their own series" on public.series_entries;
drop policy if exists "Users can delete their own series" on public.series_entries;

create policy "Users can read their own series"
  on public.series_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own series"
  on public.series_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own series"
  on public.series_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own series"
  on public.series_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ─── watchlist ────────────────────────────────────────────────────────────────

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('series', 'movie')),
  title text not null,
  poster_path text,
  overview text,
  created_at timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

alter table public.watchlist enable row level security;

drop policy if exists "Users can read their own watchlist" on public.watchlist;
drop policy if exists "Users can add to their watchlist" on public.watchlist;
drop policy if exists "Users can delete from their watchlist" on public.watchlist;

create policy "Users can read their own watchlist"
  on public.watchlist for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add to their watchlist"
  on public.watchlist for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their watchlist"
  on public.watchlist for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete from their watchlist"
  on public.watchlist for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ─── profiles (Username & Bio for future friends feature) ──────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  bio text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;

alter table public.profiles enable row level security;

drop policy if exists "Anyone authenticated can view profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

-- Anyone authenticated can view profiles so friends feature can see usernames & bios
create policy "Anyone authenticated can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ─── avatars storage bucket ───────────────────────────────────────────────────
-- Run separately in Supabase Storage UI or via the dashboard:
--   1. Create a private bucket named "avatars"
--   2. Add these storage policies:

-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
-- on conflict (id) do nothing;

-- create policy "Users can upload their own avatar"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- create policy "Users can read their own avatar"
--   on storage.objects for select
--   to authenticated
--   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- create policy "Users can update their own avatar"
--   on storage.objects for update
--   to authenticated
--   using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Realtime Replication ───────────────────────────────────────────────────────
-- Run in Supabase SQL editor to enable instant live sync across open devices:
alter publication supabase_realtime add table public.series_entries;
alter publication supabase_realtime add table public.watchlist;
alter publication supabase_realtime add table public.profiles;

-- ─── JWT Header Detox & Permanent Guard (Fixes & Prevents HTTP 431) ───────────────
-- 1. Run once to immediately clean any existing bloated metadata:
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'avatar_url' - 'banner_url';

-- 2. Permanent guard trigger: Automatically strips base64/heavy strings (>500 chars) from
--    raw_user_meta_data before it ever enters auth.users. This guarantees the JWT access token
--    remains compact (<1KB) and HTTP 431 / Cloudflare 520 / CORS blocks are permanently impossible.
create or replace function public.clean_user_meta_data()
returns trigger as $$
begin
  if new.raw_user_meta_data ? 'avatar_url' and length(new.raw_user_meta_data->>'avatar_url') > 500 then
    new.raw_user_meta_data = new.raw_user_meta_data - 'avatar_url';
  end if;
  if new.raw_user_meta_data ? 'banner_url' and length(new.raw_user_meta_data->>'banner_url') > 500 then
    new.raw_user_meta_data = new.raw_user_meta_data - 'banner_url';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_clean_user_meta_data on auth.users;
create trigger tr_clean_user_meta_data
before insert or update on auth.users
for each row execute function public.clean_user_meta_data();



