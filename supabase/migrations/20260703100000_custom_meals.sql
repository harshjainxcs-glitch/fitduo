-- Custom meal times: drop the fixed meal_slot enum so users can name their own
-- meals freely. Each plan_item is now just {title, target_time, calories}.
-- Scoring (daily_scores) counts plan_items regardless of slot, so this is safe.
alter table public.plan_items drop constraint if exists plan_items_meal_slot_check;
alter table public.plan_items alter column meal_slot drop not null;
