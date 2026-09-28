-- Persist an unmeasured Condition draft without creating quantities or compatibility outputs.
-- Once a measurement is linked, the existing atomic calculation action remains the only writer.
create or replace function public.carez_save_unmeasured_condition_draft(
  p_condition_version_id uuid,
  p_inputs jsonb,
  p_input_provenance jsonb,
  p_modules jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.project_concrete_condition_versions%rowtype;
  v_set public.takeoff_sets%rowtype;
  v_estimate_status text;
  v_module jsonb;
begin
  if v_company is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;
  if jsonb_typeof(p_inputs) is distinct from 'object'
     or jsonb_typeof(p_input_provenance) is distinct from 'object'
     or jsonb_typeof(p_modules) is distinct from 'array' then
    raise exception 'Condition draft inputs, provenance, and modules are required.';
  end if;

  select * into v_version
  from public.project_concrete_condition_versions
  where id = p_condition_version_id and company_id = v_company
  for update;
  if not found or v_version.status <> 'draft' then
    raise exception 'Editable Condition draft not found.';
  end if;

  select takeoff_set.* into v_set
  from public.project_concrete_conditions condition
  join public.takeoff_sets takeoff_set
    on takeoff_set.id = condition.takeoff_set_id and takeoff_set.company_id = condition.company_id
  where condition.id = v_version.condition_id and condition.company_id = v_company;
  if not found or v_set.status <> 'active' then
    raise exception 'Active takeoff set not found.';
  end if;
  select status into v_estimate_status
  from public.estimates where id = v_set.estimate_id and company_id = v_company;
  if v_estimate_status is null or v_estimate_status in ('accepted','approved','superseded')
     or exists(select 1 from public.proposal_presentations
               where estimate_id = v_set.estimate_id and company_id = v_company) then
    raise exception 'This estimate revision is locked.';
  end if;

  if exists(select 1 from public.project_concrete_conditions
            where id = v_version.condition_id and company_id = v_company
              and compatibility_projection_version_id = v_version.id)
     or exists(select 1 from public.project_condition_measurement_roles
               where condition_version_id = v_version.id and company_id = v_company)
     or exists(select 1 from public.project_condition_outputs
               where condition_version_id = v_version.id and company_id = v_company) then
    raise exception 'Use the atomic Condition calculation action after linking a takeoff.';
  end if;

  update public.project_concrete_condition_versions set
    plan_facts = coalesce(p_inputs->'planFacts','{}'::jsonb),
    method_inputs = coalesce(p_inputs->'methods','{}'::jsonb),
    production_inputs = coalesce(p_inputs->'production','{}'::jsonb),
    commercial_inputs = coalesce(p_inputs->'commercial','{}'::jsonb),
    drawing_inputs = coalesce(p_inputs->'drawing','{}'::jsonb),
    input_provenance = p_input_provenance
  where id = v_version.id and company_id = v_company;

  delete from public.project_condition_module_instances
  where condition_version_id = v_version.id and company_id = v_company;

  for v_module in select value from jsonb_array_elements(p_modules) loop
    insert into public.project_condition_module_instances(
      company_id,condition_version_id,module_key,instance_key,label,enabled,
      input_values,input_provenance,legacy_child_key,sort_order,created_by
    ) values (
      v_company,v_version.id,v_module->>'moduleKey',coalesce(nullif(v_module->>'instanceKey',''),'default'),
      v_module->>'label',coalesce((v_module->>'enabled')::boolean,true),
      coalesce(v_module->'inputValues','{}'::jsonb),coalesce(v_module->'inputProvenance','{}'::jsonb),
      nullif(v_module->>'legacyChildKey',''),coalesce((v_module->>'sortOrder')::integer,0),auth.uid()
    );
  end loop;
end;
$$;

revoke all on function public.carez_save_unmeasured_condition_draft(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.carez_save_unmeasured_condition_draft(uuid,jsonb,jsonb,jsonb) to authenticated,service_role;
