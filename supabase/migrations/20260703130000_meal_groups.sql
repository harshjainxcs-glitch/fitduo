-- Diet plan v2: meals become GROUPS (Breakfast, Lunch, …) that apply to every
-- day; plan_items become the food ITEMS within a group on a specific day.
create table public.meal_groups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  target_time time,
  sort_order int not null default 0
);
create index meal_groups_user_idx on public.meal_groups (user_id, sort_order);
create trigger meal_groups_set_updated_at
  before update on public.meal_groups
  for each row execute function public.set_updated_at();

alter table public.meal_groups enable row level security;
create policy meal_groups_select_all on public.meal_groups
  for select to authenticated using (true);
create policy meal_groups_insert_own on public.meal_groups
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy meal_groups_update_own on public.meal_groups
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy meal_groups_delete_own on public.meal_groups
  for delete to authenticated using (user_id = (select auth.uid()));

-- plan_items = a food item under a group, on a given day.
alter table public.plan_items
  add column if not exists meal_group_id uuid references public.meal_groups (id) on delete cascade;

-- meal_logs: completion is now per meal group per day.
alter table public.meal_logs
  add column if not exists meal_group_id uuid references public.meal_groups (id) on delete cascade;
create unique index if not exists meal_logs_unique_group
  on public.meal_logs (user_id, meal_group_id, log_date)
  where meal_group_id is not null;

alter publication supabase_realtime add table public.meal_groups;

-- ---------------------------------------------------------------------------
-- daily_scores: planned meals = number of meal groups (constant per day);
-- completed = distinct groups logged completed that day. (mirrors scoring.ts)
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
    (extract(isodow from d.log_date)::int - 1) as dow,
    p.weight_meals,
    p.weight_water,
    p.weight_workout,
    p.water_target_ml,
    (extract(isodow from d.log_date)::int - 1) = any (p.workout_days) as workout_applicable,
    (
      select count(*) from public.meal_groups mg where mg.user_id = d.user_id
    ) as planned_meals,
    (
      select count(*) from public.meal_logs ml
      where ml.user_id = d.user_id
        and ml.log_date = d.log_date
        and ml.meal_group_id is not null
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
