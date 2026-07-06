-- Instant partner notifications, task comments, and story "seen" state.

-- activities = the notification centre (bell) + instant-push log.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  url text,
  read boolean not null default false
);
create index activities_recipient_idx on public.activities (recipient_id, created_at desc);
alter table public.activities enable row level security;
create policy activities_select_own on public.activities
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy activities_insert_actor on public.activities
  for insert to authenticated with check (actor_id = (select auth.uid()));
create policy activities_update_own on public.activities
  for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- task comments (updates back-and-forth on a calendar task).
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task_id uuid not null references public.calendar_tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);
alter table public.task_comments enable row level security;
create policy task_comments_select_all on public.task_comments
  for select to authenticated using (true);
create policy task_comments_insert_own on public.task_comments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy task_comments_delete_own on public.task_comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- story views (grey the ring once seen).
create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
alter table public.story_views enable row level security;
create policy story_views_select_all on public.story_views
  for select to authenticated using (true);
create policy story_views_insert_own on public.story_views
  for insert to authenticated with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.story_views;
