-- Let the partner also see the cycle (still just the two of them — public
-- signup is disabled). Flips cycle_days from owner-only read to shared-read.
-- Idempotent: safe whether or not the owner-only policy exists.
drop policy if exists cycle_days_select_own on public.cycle_days;
drop policy if exists cycle_days_select_all on public.cycle_days;
create policy cycle_days_select_all on public.cycle_days
  for select to authenticated using (true);
