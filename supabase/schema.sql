-- Run this file once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.series_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  collection text not null check (collection in ('watching', 'finished_airing_to_continue', 'up_to_date')),
  watched_episodes integer not null default 0 check (watched_episodes >= 0),
  total_episodes integer not null default 0 check (total_episodes >= 0),
  rating smallint check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title)
);

alter table public.series_entries enable row level security;

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
