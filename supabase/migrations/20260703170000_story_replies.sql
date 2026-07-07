-- Persisted story replies (inline chat thread under a story).
create table public.story_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
);
create index story_replies_story_idx on public.story_replies (story_id, created_at);
alter table public.story_replies enable row level security;
create policy story_replies_select_all on public.story_replies
  for select to authenticated using (true);
create policy story_replies_insert_own on public.story_replies
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy story_replies_delete_own on public.story_replies
  for delete to authenticated using (user_id = (select auth.uid()));
alter publication supabase_realtime add table public.story_replies;
