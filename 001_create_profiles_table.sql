create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar text not null default '🤖',
  xp bigint not null default 0,
  level integer not null default 1,
  streak integer not null default 1,
  completed_lessons jsonb not null default '{}'::jsonb,
  quiz_scores jsonb not null default '{}'::jsonb,
  projects jsonb not null default '{}'::jsonb,
  badges jsonb not null default '[]'::jsonb,
  last_active_date timestamptz,
  activity jsonb not null default '[]'::jsonb,
  chat_history jsonb not null default '[]'::jsonb,
  active_roadmap_node text not null default 'intro_to_python',
  skill_assessment_completed boolean not null default false,
  settings jsonb not null default '{"leaderboardEnabled": true, "theme": "dark"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles_delete_own"
on public.profiles for delete
using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();
