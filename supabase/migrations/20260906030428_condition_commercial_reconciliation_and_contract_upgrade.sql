-- QA defects: keep Condition commercial state aligned with explicit estimate pricing,
-- and provide a governed draft-only Strip / Wall Footing contract upgrade path.

create or replace function public.carez_update_takeoff_output_price(
  p_output_id uuid,
  p_unit_cost numeric
)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company_id uuid := public.get_my_company_id();
  v_output public.takeoff_measurement_outputs%rowtype;
  v_estimate_id uuid;
  v_new_cost numeric;
  v_condition_output_count integer;
begin
  if v_company_id is null or public.get_my_role()='employee' then
    raise exception 'Owner access required.';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative.';
  end if;

  select * into v_output
  from public.takeoff_measurement_outputs
  where id=p_output_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Takeoff output not found.'; end if;

  select estimate_id into v_estimate_id
  from public.takeoff_measurements
  where id=v_output.measurement_id and company_id=v_company_id;

  if exists(select 1 from public.proposal_presentations where company_id=v_company_id and estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates where id=v_estimate_id and company_id=v_company_id and status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;

  if exists (
    select 1
    from public.project_condition_outputs condition_output
    join public.project_concrete_condition_versions condition_version
      on condition_version.company_id=condition_output.company_id
     and condition_version.id=condition_output.condition_version_id
    where condition_output.company_id=v_company_id
      and condition_output.legacy_takeoff_output_id=p_output_id
      and condition_version.status='verified'
  ) then
    raise exception 'Verified Project Concrete Condition pricing is immutable. Create a new Condition revision before overriding price.';
  end if;

  select count(*) into v_condition_output_count
  from public.project_condition_outputs
  where company_id=v_company_id and legacy_takeoff_output_id=p_output_id;
  if v_condition_output_count > 1 then
    raise exception 'Takeoff output is linked to multiple Project Condition outputs. Reconcile lineage before changing price.';
  end if;

  if v_output.estimate_item_type='labor' then
    v_new_cost:=round(coalesce(v_output.estimated_man_hours,0)*p_unit_cost,2);
  else
    v_new_cost:=round(coalesce(v_output.production_quantity,0)*p_unit_cost,2);
  end if;

  update public.takeoff_measurement_outputs
  set unit_cost=p_unit_cost,
      direct_cost=v_new_cost,
      pricing_status='manual_override',
      cost_source='manual takeoff override',
      updated_at=now()
  where id=p_output_id and company_id=v_company_id;

  update public.estimate_items
  set unit_cost=p_unit_cost,direct_cost=v_new_cost,updated_at=now()
  where id=v_output.generated_estimate_item_id and company_id=v_company_id;

  if v_condition_output_count=1 then
    perform set_config('carez.project_condition_commit','1',true);
    update public.project_condition_outputs condition_output
    set unit_cost=p_unit_cost,
        direct_cost=v_new_cost,
        pricing_status='manual_override',
        generated_estimate_item_id=coalesce(v_output.generated_estimate_item_id,condition_output.generated_estimate_item_id),
        provenance=coalesce(condition_output.provenance,'{}'::jsonb) || jsonb_build_object(
          'pricing',jsonb_build_object(
            'mode','explicit_override',
            'source','manual takeoff override',
            'updated_by',auth.uid(),
            'updated_at',now()
          )
        ),
        updated_at=now()
    where condition_output.company_id=v_company_id
      and condition_output.legacy_takeoff_output_id=p_output_id
      and exists (
        select 1 from public.project_concrete_condition_versions condition_version
        where condition_version.company_id=v_company_id
          and condition_version.id=condition_output.condition_version_id
          and condition_version.status='draft'
      );
  end if;
end;
$$;

revoke all on function public.carez_update_takeoff_output_price(uuid,numeric) from public,anon;
grant execute on function public.carez_update_takeoff_output_price(uuid,numeric) to authenticated,service_role;

comment on function public.carez_update_takeoff_output_price(uuid,numeric) is
  'Applies an explicit output price to the Takeoff output, generated Estimate item, and linked draft Project Condition output in one transaction. Verified Condition history remains immutable.';

create or replace function public.carez_upgrade_strip_condition_draft_to_v3(
  p_condition_version_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_source public.project_concrete_condition_versions%rowtype;
  v_condition public.project_concrete_conditions%rowtype;
  v_target_result jsonb;
  v_target_template public.company_condition_template_versions%rowtype;
  v_target_archetype public.platform_condition_archetype_versions%rowtype;
  v_current_contract integer;
  v_current_archetype_code text;
  v_primary_measurement_id uuid;
  v_source_modules jsonb := '[]'::jsonb;
  v_plan jsonb := '{}'::jsonb;
  v_methods jsonb := '{}'::jsonb;
  v_production jsonb := '{}'::jsonb;
  v_commercial jsonb := '{}'::jsonb;
  v_drawing jsonb := '{}'::jsonb;
begin
  if v_company is null or public.get_my_role()='employee' then
    raise exception 'Office access required.';
  end if;

  select * into v_source
  from public.project_concrete_condition_versions
  where id=p_condition_version_id and company_id=v_company
  for update;
  if not found then raise exception 'Project Condition version not found.'; end if;
  if v_source.status<>'draft' then
    raise exception 'Only a draft Project Condition can be upgraded. Verified history is immutable.';
  end if;

  select * into v_condition
  from public.project_concrete_conditions
  where id=v_source.condition_id and company_id=v_company
  for update;
  if not found or v_condition.status<>'active' then raise exception 'Active Project Concrete Condition not found.'; end if;

  if not exists (
    select 1
    from public.takeoff_sets takeoff_set
    join public.estimates estimate
      on estimate.company_id=takeoff_set.company_id and estimate.id=takeoff_set.estimate_id
    where takeoff_set.company_id=v_company
      and takeoff_set.id=v_condition.takeoff_set_id
      and takeoff_set.status='active'
      and estimate.status not in ('accepted','approved','superseded')
  ) or exists (
    select 1 from public.proposal_presentations presentation
    join public.takeoff_sets takeoff_set
      on takeoff_set.company_id=presentation.company_id and takeoff_set.estimate_id=presentation.estimate_id
    where takeoff_set.company_id=v_company and takeoff_set.id=v_condition.takeoff_set_id
  ) then
    raise exception 'This estimate revision is locked.';
  end if;

  select version_no,archetype_code_snapshot
    into v_current_contract,v_current_archetype_code
  from public.platform_condition_archetype_versions
  where id=v_source.archetype_version_id;
  if v_current_archetype_code<>'strip_wall_footing' then
    raise exception 'Only Strip / Wall Footing Conditions support this contract upgrade.';
  end if;
  if v_current_contract>=3 then
    return jsonb_build_object(
      'condition_version_id',v_source.id,
      'from_contract_version',v_current_contract,
      'to_contract_version',v_current_contract,
      'upgraded',false,
      'requires_recalculation',false
    );
  end if;

  v_target_result:=public.carez_ensure_strip_footing_v3_template();
  select * into v_target_template
  from public.company_condition_template_versions
  where company_id=v_company
    and id=(v_target_result->>'template_version_id')::uuid
    and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v3 company template not found.'; end if;

  select * into v_target_archetype
  from public.platform_condition_archetype_versions
  where id=v_target_template.archetype_version_id
    and status='published'
    and engine_key='concrete_condition_v1';
  if not found or v_target_archetype.archetype_code_snapshot<>'strip_wall_footing' or v_target_archetype.version_no<>3 then
    raise exception 'Published Strip / Wall Footing v3 contract not found.';
  end if;
  if v_target_template.legacy_assembly_version_id is null then
    raise exception 'Strip / Wall Footing v3 compatibility assembly is unavailable.';
  end if;

  select measurement_id into v_primary_measurement_id
  from public.project_condition_measurement_roles
  where company_id=v_company
    and condition_version_id=v_source.id
    and role_key='run'
  order by is_primary desc,sort_order,id
  limit 1;

  if v_primary_measurement_id is not null then
    if not exists (
      select 1 from public.takeoff_measurements measurement
      where measurement.company_id=v_company
        and measurement.id=v_primary_measurement_id
        and measurement.takeoff_set_id=v_condition.takeoff_set_id
        and measurement.status='active'
    ) then raise exception 'Active primary footing takeoff not found.'; end if;

    if exists (
      select 1
      from public.project_condition_measurement_roles role
      where role.company_id=v_company
        and role.measurement_id=v_primary_measurement_id
        and role.condition_version_id<>v_source.id
    ) then
      raise exception 'The primary takeoff is shared by another Condition revision. Preserve that history and create/reassign a fresh takeoff before upgrading this draft.';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'module_key',module.module_key,
    'instance_key',module.instance_key,
    'label',module.label,
    'enabled',module.enabled,
    'input_values',module.input_values,
    'sort_order',module.sort_order
  ) order by module.sort_order,module.module_key,module.instance_key),'[]'::jsonb)
  into v_source_modules
  from public.project_condition_module_instances module
  where module.company_id=v_company and module.condition_version_id=v_source.id;

  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) into v_plan
  from jsonb_each(coalesce(v_source.plan_facts,'{}'::jsonb)) entry
  where exists (
    select 1 from jsonb_array_elements(v_target_archetype.input_schema) input
    where input->>'group'='planFacts' and input->>'key'=entry.key
  );
  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) into v_methods
  from jsonb_each(coalesce(v_source.method_inputs,'{}'::jsonb)) entry
  where exists (
    select 1 from jsonb_array_elements(v_target_archetype.input_schema) input
    where input->>'group'='methods' and input->>'key'=entry.key
  );
  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) into v_production
  from jsonb_each(coalesce(v_source.production_inputs,'{}'::jsonb)) entry
  where exists (
    select 1 from jsonb_array_elements(v_target_archetype.input_schema) input
    where input->>'group'='production' and input->>'key'=entry.key
  );
  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) into v_commercial
  from jsonb_each(coalesce(v_source.commercial_inputs,'{}'::jsonb)) entry
  where exists (
    select 1 from jsonb_array_elements(v_target_archetype.input_schema) input
    where input->>'group'='commercial' and input->>'key'=entry.key
  );
  select coalesce(jsonb_object_agg(entry.key,entry.value),'{}'::jsonb) into v_drawing
  from jsonb_each(coalesce(v_source.drawing_inputs,'{}'::jsonb)) entry
  where exists (
    select 1 from jsonb_array_elements(v_target_archetype.input_schema) input
    where input->>'group'='drawing' and input->>'key'=entry.key
  );

  perform set_config('carez.project_condition_commit','1',true);

  delete from public.project_condition_holds
  where company_id=v_company and condition_version_id=v_source.id;
  delete from public.project_condition_outputs
  where company_id=v_company and condition_version_id=v_source.id;

  if v_primary_measurement_id is not null then
    delete from public.estimate_items estimate_item
    where estimate_item.company_id=v_company
      and estimate_item.source_takeoff_output_id in (
        select output.id from public.takeoff_measurement_outputs output
        where output.company_id=v_company and output.measurement_id=v_primary_measurement_id
      );
    delete from public.takeoff_measurement_outputs
    where company_id=v_company and measurement_id=v_primary_measurement_id;

    update public.takeoff_measurements
    set assembly_version_id=v_target_template.legacy_assembly_version_id,
        variables='{}'::jsonb,
        method_profile_id=null,
        updated_at=now()
    where company_id=v_company and id=v_primary_measurement_id;
  end if;

  delete from public.project_condition_module_instances
  where company_id=v_company and condition_version_id=v_source.id;

  insert into public.project_condition_module_instances(
    company_id,condition_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,
    legacy_child_key,sort_order,created_by
  )
  select
    v_company,
    v_source.id,
    source_entry.value->>'module_key',
    coalesce(nullif(source_entry.value->>'instance_key',''),'default'),
    coalesce(nullif(source_entry.value->>'label',''),initcap(replace(source_entry.value->>'module_key','_',' '))),
    coalesce((source_entry.value->>'enabled')::boolean,false),
    coalesce(v_target_template.module_defaults->(source_entry.value->>'module_key')->'inputs','{}'::jsonb) || coalesce((
      select jsonb_object_agg(input_entry.key,input_entry.value)
      from jsonb_each(coalesce(source_entry.value->'input_values','{}'::jsonb)) input_entry
      where exists (
        select 1 from jsonb_array_elements(coalesce(target.module_definition->'input_schema','[]'::jsonb)) field
        where field->>'key'=input_entry.key
      )
    ),'{}'::jsonb),
    '{}'::jsonb,
    null,
    coalesce((source_entry.value->>'sort_order')::integer,target.ordinality::integer*10),
    auth.uid()
  from jsonb_array_elements(v_source_modules) source_entry(value)
  join lateral (
    select module_definition,ordinality
    from jsonb_array_elements(v_target_archetype.module_schema) with ordinality target_module(module_definition,ordinality)
    where module_definition->>'key'=source_entry.value->>'module_key'
    limit 1
  ) target on true
  where source_entry.value->>'module_key'<>'reinforcing';

  insert into public.project_condition_module_instances(
    company_id,condition_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,
    legacy_child_key,sort_order,created_by
  )
  select
    v_company,
    v_source.id,
    module_definition->>'key',
    'default',
    initcap(replace(module_definition->>'key','_',' ')),
    case when module_definition->>'key'='reinforcing' then false
      else coalesce((v_target_template.module_defaults->(module_definition->>'key')->>'enabled')::boolean,(module_definition->>'default_enabled')::boolean,true)
    end,
    case when module_definition->>'key'='reinforcing' then '{}'::jsonb
      else coalesce(v_target_template.module_defaults->(module_definition->>'key')->'inputs','{}'::jsonb)
    end,
    '{}'::jsonb,
    null,
    ordinality::integer*10,
    auth.uid()
  from jsonb_array_elements(v_target_archetype.module_schema) with ordinality target_module(module_definition,ordinality)
  where not exists (
    select 1 from public.project_condition_module_instances existing
    where existing.company_id=v_company
      and existing.condition_version_id=v_source.id
      and existing.module_key=module_definition->>'key'
  );

  update public.project_concrete_conditions
  set template_id=v_target_template.template_id,
      compatibility_projection_version_id=null,
      updated_at=now()
  where company_id=v_company and id=v_condition.id;

  update public.project_concrete_condition_versions
  set template_version_id=v_target_template.id,
      archetype_version_id=v_target_archetype.id,
      plan_facts=v_plan,
      method_inputs=v_methods,
      production_inputs=v_production,
      commercial_inputs=v_commercial,
      drawing_inputs=v_drawing,
      input_provenance='{}'::jsonb,
      output_overrides='{}'::jsonb,
      legacy_method_profile_id=null,
      compatibility_anchor_measurement_id=v_primary_measurement_id,
      updated_at=now()
  where company_id=v_company and id=v_source.id;

  return jsonb_build_object(
    'condition_version_id',v_source.id,
    'from_contract_version',v_current_contract,
    'to_contract_version',v_target_archetype.version_no,
    'upgraded',true,
    'requires_recalculation',true,
    'reset_modules',jsonb_build_array('reinforcing'),
    'reset_inputs',jsonb_build_array('legacy labor productivity','output overrides'),
    'message','Review reinforcing and labor productivity, then Save & recalculate.'
  );
end;
$$;

revoke all on function public.carez_upgrade_strip_condition_draft_to_v3(uuid) from public,anon;
grant execute on function public.carez_upgrade_strip_condition_draft_to_v3(uuid) to authenticated,service_role;

comment on function public.carez_upgrade_strip_condition_draft_to_v3(uuid) is
  'Upgrades an editable Strip / Wall Footing draft to the published v3 contract while preserving compatible inputs and modules, clearing stale commercial projections, and leaving verified history immutable.';;
