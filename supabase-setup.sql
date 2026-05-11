create table if not exists public.app_state (
  app_id text primary key,
  payload jsonb not null default '{}'::jsonb
);
alter table public.app_state enable row level security;

drop policy if exists "allow anon select app_state" on public.app_state;
create policy "allow anon select app_state"
on public.app_state
for select
to anon
using (true);

drop policy if exists "allow anon insert app_state" on public.app_state;
create policy "allow anon insert app_state"
on public.app_state
for insert
to anon
with check (true);

drop policy if exists "allow anon update app_state" on public.app_state;
create policy "allow anon update app_state"
on public.app_state
for update
to anon
using (true)
with check (true);
