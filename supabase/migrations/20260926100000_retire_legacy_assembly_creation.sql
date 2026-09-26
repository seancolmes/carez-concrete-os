-- P0.5E retired legacy assembly authoring. Preserve the old signature so stale
-- privileged clients fail deliberately, without recreating obsolete schema or
-- changing any referenced assembly/version history.
create or replace function public.carez_create_custom_assembly(
  p_code text,p_name text,p_category text,p_primary_measurement text,
  p_folder_id uuid default null,p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public
as $$
begin
  raise exception using
    errcode='0A000',
    message='Legacy assembly authoring is retired. Create a Project Concrete Condition instead.';
end;
$$;

revoke all on function public.carez_create_custom_assembly(text,text,text,text,uuid,text)
  from public,anon,authenticated,service_role;

comment on function public.carez_create_custom_assembly(text,text,text,text,uuid,text) is
  'Retired P0.5E authoring entry point. Historical assemblies remain readable; new scope uses Concrete Conditions.';
