-- FitDuo — combined schema for the Supabase SQL editor.
-- Generated from supabase/migrations/*.sql (run once, in order).

-- ============================================================
-- supabase/migrations/20260702090000_init_schema.sql
-- ============================================================
-- FitDuo initial schema + RLS (PRD.md §6, CLAUDE.md §3/§5).
-- Closed two-user app: authenticated users read ALL shared rows; each user
-- writes only their own. push_subscriptions are private per user.
-- Scoring views (daily_scores / weekly_scores) land in a later migration.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (id = auth.users.id)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text not null,
  avatar_url text,
  water_target_ml int not null default 3000 check (water_target_ml >= 0),
  bottle_size_ml int not null default 750 check (bottle_size_ml > 0),
  workout_days smallint[] not null default '{}',
  weight_meals int not null default 60 check (weight_meals >= 0),
  weight_water int not null default 15 check (weight_water >= 0),
  weight_workout int not null default 25 check (weight_workout >= 0),
  notif_prefs jsonb not null default '{}'::jsonb,
  constraint profiles_weights_sum_100
    check (weight_meals + weight_water + weight_workout = 100)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- plan_items (recurring weekly plan)
-- ---------------------------------------------------------------------------
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Mon..6=Sun
  meal_slot text not null check (
    meal_slot in (
      'pre_breakfast', 'breakfast', 'post_breakfast', 'mid_morning_snack',
      'lunch', 'evening_snack', 'dinner', 'post_dinner'
    )
  ),
  title text not null,
  target_time time,
  note text,
  target_calories int check (target_calories is null or target_calories >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true
);

create index plan_items_user_dow_idx on public.plan_items (user_id, day_of_week);

create trigger plan_items_set_updated_at
  before update on public.plan_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_logs
-- ---------------------------------------------------------------------------
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_item_id uuid references public.plan_items (id) on delete set null, -- null = ad-hoc
  log_date date not null,
  logged_at timestamptz not null default now(),
  status text not null default 'completed' check (status in ('completed', 'skipped')),
  calories int check (calories is null or calories >= 0),
  photo_path text,
  note text
);

create index meal_logs_user_date_idx on public.meal_logs (user_id, log_date);

-- One log row per planned meal per day (supports tap-to-toggle via upsert).
create unique index meal_logs_unique_planned
  on public.meal_logs (user_id, plan_item_id, log_date)
  where plan_item_id is not null;

create trigger meal_logs_set_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- water_logs
-- ---------------------------------------------------------------------------
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  amount_ml int not null check (amount_ml > 0),
  note text
);

create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- workout_logs
-- ---------------------------------------------------------------------------
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  logged_at timestamptz not null default now(),
  type text,
  duration_min int check (duration_min is null or duration_min >= 0),
  photo_path text,
  note text
);

create index workout_logs_user_date_idx on public.workout_logs (user_id, log_date);

create trigger workout_logs_set_updated_at
  before update on public.workout_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- push_subscriptions (private per user)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- weekly_results
-- ---------------------------------------------------------------------------
create table public.weekly_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  week_start date not null unique, -- Monday, IST
  user_a uuid not null references public.profiles (id),
  points_a numeric not null default 0,
  user_b uuid not null references public.profiles (id),
  points_b numeric not null default 0,
  winner_id uuid references public.profiles (id), -- null = tie
  prize text,
  prize_paid boolean not null default false
);

create trigger weekly_results_set_updated_at
  before update on public.weekly_results
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- achievements (optional)
-- ---------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles          enable row level security;
alter table public.plan_items        enable row level security;
alter table public.meal_logs         enable row level security;
alter table public.water_logs        enable row level security;
alter table public.workout_logs      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.weekly_results    enable row level security;
alter table public.achievements      enable row level security;

-- profiles: shared read; each user updates only their own row (id = auth.uid()).
create policy profiles_select_all on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Shared-read + own-write for the log/plan tables.
create policy plan_items_select_all on public.plan_items
  for select to authenticated using (true);
create policy plan_items_insert_own on public.plan_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy plan_items_update_own on public.plan_items
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy plan_items_delete_own on public.plan_items
  for delete to authenticated using (user_id = (select auth.uid()));

create policy meal_logs_select_all on public.meal_logs
  for select to authenticated using (true);
create policy meal_logs_insert_own on public.meal_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy meal_logs_update_own on public.meal_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy meal_logs_delete_own on public.meal_logs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy water_logs_select_all on public.water_logs
  for select to authenticated using (true);
create policy water_logs_insert_own on public.water_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy water_logs_update_own on public.water_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy water_logs_delete_own on public.water_logs
  for delete to authenticated using (user_id = (select auth.uid()));

create policy workout_logs_select_all on public.workout_logs
  for select to authenticated using (true);
create policy workout_logs_insert_own on public.workout_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_logs_update_own on public.workout_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_logs_delete_own on public.workout_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- achievements: shared read, own write.
create policy achievements_select_all on public.achievements
  for select to authenticated using (true);
create policy achievements_insert_own on public.achievements
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy achievements_delete_own on public.achievements
  for delete to authenticated using (user_id = (select auth.uid()));

-- push_subscriptions: PRIVATE — own rows only for every operation.
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- weekly_results: shared read; either participant may write (server/service
-- role bypasses RLS entirely for the finalize_week job).
create policy weekly_results_select_all on public.weekly_results
  for select to authenticated using (true);
create policy weekly_results_insert_participant on public.weekly_results
  for insert to authenticated
  with check ((select auth.uid()) in (user_a, user_b));
create policy weekly_results_update_participant on public.weekly_results
  for update to authenticated
  using ((select auth.uid()) in (user_a, user_b))
  with check ((select auth.uid()) in (user_a, user_b));

-- ===========================================================================
-- Storage: private "photos" bucket, path {user_id}/{yyyy-mm-dd}/{uuid}.jpg
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Authenticated users may read any photo (shared visibility).
create policy photos_read_all on storage.objects
  for select to authenticated
  using (bucket_id = 'photos');

-- Writes only under the user's own {user_id}/ prefix.
create policy photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================
-- supabase/migrations/20260702091000_scoring_views.sql
-- ============================================================
-- Scoring SQL — mirrors lib/scoring/scoring.ts (PRD.md §7, CLAUDE.md §6).
-- log_date is already an IST calendar date, so weekday = isodow-1 (0=Mon..6=Sun).
-- Calories are never referenced here.

-- ---------------------------------------------------------------------------
-- daily_scores: per (user, date) meal/water/workout points + capped total.
-- ---------------------------------------------------------------------------
create or replace view public.daily_scores
with (security_invoker = true) as
with days as (
  select user_id, log_date from public.meal_logs
  union
  select user_id, log_date from public.water_logs
  union
  select user_id, log_date from public.workout_logs
),
agg as (
  select
    d.user_id,
    d.log_date,
    (extract(isodow from d.log_date)::int - 1) as dow, -- 0=Mon..6=Sun
    p.weight_meals,
    p.weight_water,
    p.weight_workout,
    p.water_target_ml,
    (extract(isodow from d.log_date)::int - 1) = any (p.workout_days) as workout_applicable,
    (
      select count(*) from public.plan_items pi
      where pi.user_id = d.user_id
        and pi.day_of_week = (extract(isodow from d.log_date)::int - 1)
        and pi.is_active
    ) as planned_meals,
    (
      select count(*) from public.meal_logs ml
      where ml.user_id = d.user_id
        and ml.log_date = d.log_date
        and ml.plan_item_id is not null
        and ml.status = 'completed'
    ) as completed_meals,
    (
      select coalesce(sum(w.amount_ml), 0) from public.water_logs w
      where w.user_id = d.user_id and w.log_date = d.log_date
    ) as water_logged,
    (
      select count(*) from public.workout_logs wo
      where wo.user_id = d.user_id and wo.log_date = d.log_date
    ) as workout_count
  from days d
  join public.profiles p on p.id = d.user_id
),
eff as (
  select
    a.*,
    (a.planned_meals > 0) as meals_applicable,
    (a.water_target_ml > 0) as water_applicable,
    (
      (case when a.planned_meals > 0 then a.weight_meals else 0 end)
      + (case when a.water_target_ml > 0 then a.weight_water else 0 end)
      + (case when a.workout_applicable then a.weight_workout else 0 end)
    )::numeric as appl_total
  from agg a
),
pts as (
  select
    e.user_id,
    e.log_date,
    case
      when e.appl_total > 0 and e.meals_applicable
      then (e.weight_meals / e.appl_total) * 100
           * least(1, e.completed_meals::numeric / nullif(e.planned_meals, 0))
      else 0
    end as meal_points,
    case
      when e.appl_total > 0 and e.water_applicable
      then (e.weight_water / e.appl_total) * 100
           * least(1, e.water_logged::numeric / nullif(e.water_target_ml, 0))
      else 0
    end as water_points,
    case
      when e.appl_total > 0 and e.workout_applicable and e.workout_count > 0
      then (e.weight_workout / e.appl_total) * 100
      else 0
    end as workout_points
  from eff e
)
select
  pts.user_id,
  pts.log_date,
  round(pts.meal_points, 4) as meal_points,
  round(pts.water_points, 4) as water_points,
  round(pts.workout_points, 4) as workout_points,
  least(100, round(pts.meal_points + pts.water_points + pts.workout_points))::int as total
from pts;

-- ---------------------------------------------------------------------------
-- weekly_scores: sum of daily totals per Monday-anchored IST week.
-- ---------------------------------------------------------------------------
create or replace view public.weekly_scores
with (security_invoker = true) as
select
  ds.user_id,
  (ds.log_date - (extract(isodow from ds.log_date)::int - 1)) as week_start,
  sum(ds.total)::numeric as total
from public.daily_scores ds
group by ds.user_id, (ds.log_date - (extract(isodow from ds.log_date)::int - 1));

grant select on public.daily_scores to authenticated;
grant select on public.weekly_scores to authenticated;

-- ---------------------------------------------------------------------------
-- finalize_week: freeze a week's result into weekly_results (winner or tie),
-- preserving any prize already attached. SQL is authoritative for results.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_week(p_week_start date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ua uuid;
  ub uuid;
  pa numeric;
  pb numeric;
  win uuid;
begin
  -- The two seeded users, deterministically ordered.
  select id into ua from public.profiles order by created_at, id limit 1;
  select id into ub from public.profiles where id <> ua order by created_at, id limit 1;

  if ua is null or ub is null then
    raise exception 'finalize_week requires exactly two profiles';
  end if;

  select coalesce(
    (select total from public.weekly_scores where user_id = ua and week_start = p_week_start), 0
  ) into pa;
  select coalesce(
    (select total from public.weekly_scores where user_id = ub and week_start = p_week_start), 0
  ) into pb;

  if pa > pb then
    win := ua;
  elsif pb > pa then
    win := ub;
  else
    win := null; -- tie
  end if;

  insert into public.weekly_results (week_start, user_a, points_a, user_b, points_b, winner_id)
  values (p_week_start, ua, pa, ub, pb, win)
  on conflict (week_start) do update
    set user_a = excluded.user_a,
        user_b = excluded.user_b,
        points_a = excluded.points_a,
        points_b = excluded.points_b,
        winner_id = excluded.winner_id;
        -- prize / prize_paid are intentionally left untouched.
end;
$$;

grant execute on function public.finalize_week(date) to authenticated;

-- ===========================================================================
-- Parity check (mirror of lib/scoring/scoring.test.ts). Run manually against a
-- scratch project to confirm daily_scores.total == computeDailyScore().total:
--
--   Given a user with weights 60/15/25 and water_target_ml = 3000:
--     * 7/7 planned meals completed, 3000 ml water, workout logged on a workout
--       day  -> total = 100.
--     * 5/7 planned meals, 2500 ml water, no workout (workout day)
--       -> meal 42.857 + water 12.5 + 0 = 55.357 -> total = 55.
--     * rest day, 3/3 meals, 2000/2000 ml water (workout not applicable)
--       -> meals 80 + water 20 -> total = 100.
-- ===========================================================================

-- ============================================================
-- supabase/migrations/20260702092000_realtime.sql
-- ============================================================
-- Enable Supabase Realtime on the shared log tables + weekly_results so both
-- partners receive change events (RLS still applies to the receiver).
alter publication supabase_realtime add table public.meal_logs;
alter publication supabase_realtime add table public.water_logs;
alter publication supabase_realtime add table public.workout_logs;
alter publication supabase_realtime add table public.weekly_results;

-- ============================================================
-- supabase/migrations/20260703090000_notifications.sql
-- ============================================================
-- Dedupe ledger for the reminder scheduler (Prompt 1.5.3). Only the cron job
-- (service role) reads/writes this — RLS is enabled with no policies so no
-- authenticated user can touch it.
create table public.notification_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,      -- water | meal | weekly_open | weekly_close | partner
  dedupe_key text not null,    -- e.g. '2026-07-03' or 'meal:<plan_item_id>:<date>'
  sent_at timestamptz not null default now(),
  unique (user_id, category, dedupe_key)
);

create index notification_sends_user_idx on public.notification_sends (user_id, sent_at);

alter table public.notification_sends enable row level security;
-- No policies on purpose: service role bypasses RLS; nobody else has access.

