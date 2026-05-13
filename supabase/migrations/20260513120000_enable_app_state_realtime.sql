alter table public.app_state replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.app_state;
exception
  when duplicate_object then null;
end $$;
