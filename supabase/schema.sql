-- Run this file once in Supabase: SQL Editor -> New query -> Run.

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, media_type, title)
);

-- These lines also upgrade the first version of the ScreenVault schema.
alter table public.series_entries add column if not exists media_type text not null default 'series';
alter table public.series_entries add column if not exists tmdb_id integer;
alter table public.series_entries add column if not exists poster_path text;
alter table public.series_entries drop constraint if exists series_entries_user_id_title_key;
do $$ begin
  alter table public.series_entries add constraint series_entries_user_media_title_key unique (user_id, media_type, title);
exception when duplicate_object then null;
end $$;

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
