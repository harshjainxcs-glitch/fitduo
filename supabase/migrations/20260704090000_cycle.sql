-- Menstrual cycle tracking (opt-in per user, Apple-style).
-- Cycle data is PRIVATE: only the owner can read it (unlike the app's other
-- shared-read tables). The cron scheduler uses the service-role client, which
-- bypasses RLS, so caring reminders still work.

alter table public.profiles
  add column if not exists tracks_cycle boolean not null default false,
  add column if not exists cycle_avg_length int not null default 28,
  add column if not exists cycle_period_length int not null default 5;

-- Tag so "period self-care" movement logs are distinguishable from real workouts.
alter table public.workout_logs
  add column if not exists source text;

-- Per-day flow / symptoms / mood (one row per user per day).
create table if not exists public.cycle_days (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  flow text,                       -- spotting | light | medium | heavy | null
  symptoms text[] not null default '{}',
  mood text,
  note text,
  unique (user_id, day)
);
create index if not exists cycle_days_user_day_idx on public.cycle_days (user_id, day);

alter table public.cycle_days enable row level security;

-- Owner-only for every operation (health data stays private).
create policy cycle_days_select_own on public.cycle_days
  for select to authenticated using (user_id = (select auth.uid()));
create policy cycle_days_insert_own on public.cycle_days
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy cycle_days_update_own on public.cycle_days
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cycle_days_delete_own on public.cycle_days
  for delete to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.cycle_days;
