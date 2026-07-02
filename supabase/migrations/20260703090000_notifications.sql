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
