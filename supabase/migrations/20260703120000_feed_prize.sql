-- Private-Instagram feed: standalone photo posts + persistent likes + comments.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_date date not null,
  image_path text not null,
  caption text,
  kind text not null default 'moment'
);
create index posts_date_idx on public.posts (post_date, created_at desc);
alter table public.posts enable row level security;
create policy posts_select_all on public.posts
  for select to authenticated using (true);
create policy posts_insert_own on public.posts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy posts_delete_own on public.posts
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;
create policy post_likes_select_all on public.post_likes
  for select to authenticated using (true);
create policy post_likes_insert_own on public.post_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy post_likes_delete_own on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
alter table public.post_comments enable row level security;
create policy post_comments_select_all on public.post_comments
  for select to authenticated using (true);
create policy post_comments_insert_own on public.post_comments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy post_comments_delete_own on public.post_comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Prize proof photo — the week's prize stays "due" until this is set.
alter table public.weekly_results add column if not exists prize_photo_path text;

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;
