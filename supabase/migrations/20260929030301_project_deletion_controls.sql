-- Install only: this migration does not wipe any data.
-- The reset is global across all companies and cascades into referencing tables.
-- Invoke only from a database administrator session against an explicitly chosen
-- environment with a verified backup. Storage objects are not removed.
create or replace function public.admin_wipe_all_project_data(confirmation text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Database administrator access required' using errcode = '42501';
  end if;
  if confirmation is distinct from 'WIPE ALL PROJECT DATA' then
    raise exception 'Explicit global wipe confirmation required';
  end if;
  truncate table public.projects, public.leads, public.estimates, public.takeoff_sets cascade;
end;
$$;

revoke all on function public.admin_wipe_all_project_data(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_wipe_all_project_data(text) to postgres;

-- Restrictive policy also guards direct API deletion alongside existing policies.
create policy projects_delete_owner_office on public.projects
as restrictive for delete to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() in ('owner', 'office'));
