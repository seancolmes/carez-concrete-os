-- Restore two already-declared source contracts on captured older deployments.
-- Normal PostgreSQL trigger invocation does not require client EXECUTE grants.
-- Do not change the intentional public Proposal RPC surface or stored history.
revoke execute on function public.snapshot_purchase_order_branding()
  from public,anon,authenticated;

-- This legacy authoring entry point was retired in 20260926100000. Retain its
-- signature and deliberate error for privileged stale callers; never recreate
-- assemblies or rewrite referenced assembly/version records.
create or replace function public.carez_create_custom_assembly(
  p_code text,p_name text,p_category text,p_primary_measurement text,
  p_folder_id uuid default null,p_description text default null
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$
begin
  raise exception using errcode='0A000',
    message='Legacy assembly authoring is retired. Create a Project Concrete Condition instead.';
end;
$$;
revoke all on function public.carez_create_custom_assembly(text,text,text,text,uuid,text)
  from public,anon,authenticated,service_role;
comment on function public.carez_create_custom_assembly(text,text,text,text,uuid,text) is
  'Retired authoring entry point. Historical assemblies remain readable; new scope uses Concrete Conditions.';
