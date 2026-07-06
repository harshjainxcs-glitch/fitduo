-- Calendar / daily timetable. Each partner has their own calendar (owner_id);
-- both can see each other's and add tasks to each other's (created_by).
create table public.calendar_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title text not null,
  note text,
  task_date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  tags text[] not null default '{}',
  recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'weekdays')),
  remind boolean not null default true,
  remind_lead_min int not null default 0,
  done boolean not null default false
);

create index calendar_tasks_owner_date_idx
  on public.calendar_tasks (owner_id, task_date);

create trigger calendar_tasks_set_updated_at
  before update on public.calendar_tasks
  for each row execute function public.set_updated_at();

alter table public.calendar_tasks enable row level security;

-- Shared read; either partner may create (created_by = self) and edit/delete
-- tasks they own or created.
create policy calendar_tasks_select_all on public.calendar_tasks
  for select to authenticated using (true);
create policy calendar_tasks_insert on public.calendar_tasks
  for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy calendar_tasks_update on public.calendar_tasks
  for update to authenticated
  using (owner_id = (select auth.uid()) or created_by = (select auth.uid()))
  with check (owner_id = (select auth.uid()) or created_by = (select auth.uid()));
create policy calendar_tasks_delete on public.calendar_tasks
  for delete to authenticated
  using (owner_id = (select auth.uid()) or created_by = (select auth.uid()));

alter publication supabase_realtime add table public.calendar_tasks;
