-- Richer task status for the quick-action menu.
alter table public.calendar_tasks
  add column if not exists status text not null default 'todo'
  check (status in ('todo', 'in_progress', 'done', 'skipped'));

-- Backfill from the existing done flag.
update public.calendar_tasks set status = 'done' where done and status = 'todo';
