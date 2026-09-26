-- Replace the SECURITY DEFINER operational-reference view with an explicit
-- authenticated RPC so employee reads do not pass through view-owner access.
drop view public.approved_change_order_references;

create or replace function public.carez_list_approved_change_order_references(p_project_id uuid default null)
returns table(
  id uuid,
  project_id uuid,
  co_number text,
  title text,
  status text,
  field_work_status text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_company:=public.carez_commercial_actor_company();
  if v_company is null then
    raise exception 'Company profile missing.';
  end if;

  if p_project_id is not null and not exists(
    select 1 from public.projects p where p.id=p_project_id and p.company_id=v_company
  ) then
    raise exception 'Project not found.';
  end if;

  return query
    select co.id,co.project_id,co.co_number,co.title,co.status,co.field_work_status
    from public.change_orders co
    where co.company_id=v_company
      and co.status='approved'
      and (p_project_id is null or co.project_id=p_project_id)
    order by co.co_number;
end
$$;

revoke all on function public.carez_list_approved_change_order_references(uuid) from public,anon;
grant execute on function public.carez_list_approved_change_order_references(uuid) to authenticated;

comment on function public.carez_list_approved_change_order_references(uuid) is
  'Returns only approved operational Change Order references for the authenticated caller company.';
