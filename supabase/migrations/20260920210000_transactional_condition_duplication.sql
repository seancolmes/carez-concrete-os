create or replace function public.carez_duplicate_project_concrete_condition(
  p_takeoff_set_id uuid,
  p_condition_version_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_source_version public.project_concrete_condition_versions%rowtype;
  v_source_condition public.project_concrete_conditions%rowtype;
  v_copy_number integer := 1;
  v_code text;
  v_name text;
  v_new_version_id uuid;
begin
  if v_company is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_takeoff_set_id::text, 0));

  select version.* into v_source_version
  from public.project_concrete_condition_versions version
  join public.project_concrete_conditions condition
    on condition.company_id = version.company_id
   and condition.id = version.condition_id
  where version.id = p_condition_version_id
    and version.company_id = v_company
    and version.status in ('draft', 'verified')
    and condition.takeoff_set_id = p_takeoff_set_id
    and condition.status = 'active';
  if not found then
    raise exception 'Project Concrete Condition version not found for this takeoff set.';
  end if;

  select * into v_source_condition
  from public.project_concrete_conditions
  where id = v_source_version.condition_id
    and company_id = v_company
    and takeoff_set_id = p_takeoff_set_id;

  loop
    v_code := upper(trim(v_source_condition.code)) || '-COPY'
      || case when v_copy_number = 1 then '' else '-' || v_copy_number::text end;
    v_name := trim(v_source_condition.name) || ' Copy'
      || case when v_copy_number = 1 then '' else ' ' || v_copy_number::text end;
    exit when not exists (
      select 1
      from public.project_concrete_conditions condition
      where condition.company_id = v_company
        and condition.takeoff_set_id = p_takeoff_set_id
        and (upper(condition.code) = v_code or lower(condition.name) = lower(v_name))
    );
    v_copy_number := v_copy_number + 1;
  end loop;

  v_new_version_id := public.carez_create_project_concrete_condition(
    p_takeoff_set_id,
    v_source_version.template_version_id,
    v_code,
    v_name,
    v_source_condition.description,
    v_source_version.plan_facts,
    v_source_version.method_inputs,
    v_source_version.production_inputs,
    v_source_version.commercial_inputs,
    v_source_version.drawing_inputs,
    v_source_version.input_provenance,
    '{}'::jsonb,
    v_source_version.legacy_method_profile_id
  );

  delete from public.project_condition_module_instances
  where company_id = v_company
    and condition_version_id = v_new_version_id;

  insert into public.project_condition_module_instances(
    company_id, condition_version_id, module_key, instance_key, label, enabled,
    input_values, input_provenance, legacy_child_key, sort_order, created_by
  )
  select
    v_company, v_new_version_id, module.module_key, module.instance_key, module.label,
    module.enabled, module.input_values, module.input_provenance, module.legacy_child_key,
    module.sort_order, auth.uid()
  from public.project_condition_module_instances module
  where module.company_id = v_company
    and module.condition_version_id = v_source_version.id;

  return v_new_version_id;
end;
$$;

revoke all on function public.carez_duplicate_project_concrete_condition(uuid, uuid) from public, anon;
grant execute on function public.carez_duplicate_project_concrete_condition(uuid, uuid) to authenticated, service_role;
