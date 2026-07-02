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
