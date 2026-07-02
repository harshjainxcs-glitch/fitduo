-- Enable Supabase Realtime on the shared log tables + weekly_results so both
-- partners receive change events (RLS still applies to the receiver).
alter publication supabase_realtime add table public.meal_logs;
alter publication supabase_realtime add table public.water_logs;
alter publication supabase_realtime add table public.workout_logs;
alter publication supabase_realtime add table public.weekly_results;
