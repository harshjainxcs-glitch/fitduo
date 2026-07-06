-- Ephemeral stories (Instagram-style): a photo + optional text overlay, shown
-- for 24h then filtered out. Both partners can post and view each other's.
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text not null,
  text text,
  text_color text,
  text_position text not null default 'bottom'
    check (text_position in ('top', 'center', 'bottom'))
);
create index stories_created_idx on public.stories (created_at desc);

alter table public.stories enable row level security;
create policy stories_select_all on public.stories
  for select to authenticated using (true);
create policy stories_insert_own on public.stories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy stories_delete_own on public.stories
  for delete to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.stories;
