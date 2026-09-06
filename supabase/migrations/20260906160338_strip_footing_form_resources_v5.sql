-- ADR-023 / Issue #55: replace the normal Strip LF/LF form-material factor
-- with an estimator-selected physical form board. Published v1-v4 contracts
-- remain unchanged. Contract v5 preserves the existing compatibility output
-- key/unit while runtime trace records the physical-board calculation.

do $$
declare
  v_v4 public.platform_condition_archetype_versions%rowtype;
  v_modules jsonb;
  v_outputs jsonb;
begin
  select version.* into v_v4
  from public.platform_condition_archetype_versions version
  where version.archetype_code_snapshot='strip_wall_footing'
    and version.version_no=4
    and version.status='published'
    and version.engine_key='concrete_condition_v1'
  limit 1;
  if not found then raise exception 'Published Strip / Wall Footing v4 contract not found.'; end if;

  if exists (
    select 1 from public.platform_condition_archetype_versions version
    where version.archetype_id=v_v4.archetype_id and version.version_no=5
  ) then return; end if;

  select coalesce(jsonb_agg(
    case when module->>'key'='forms' then
      jsonb_set(
        module,
        '{input_schema}',
        (
          select coalesce(jsonb_agg(
            case when input->>'key'='resource_tracking'
              then input || jsonb_build_object('label','Track form boards')
              else input
            end
            order by ordinality
          ),'[]'::jsonb)
          from jsonb_array_elements(coalesce(module->'input_schema','[]'::jsonb)) with ordinality source(input,ordinality)
          where input->>'key'<>'form_material_factor_lf_per_lf'
        ) || jsonb_build_array(
          jsonb_build_object(
            'key','form_resource_model',
            'label','Form resource model',
            'value_type','select',
            'options',jsonb_build_array('physical_boards_v5')
          ),
          jsonb_build_object(
            'key','form_board_size',
            'label','Form board',
            'value_type','select',
            'options',jsonb_build_array('2x4','2x6','2x8','2x10','2x12','custom')
          ),
          jsonb_build_object(
            'key','form_board_custom_course_height_in',
            'label','Custom board course height',
            'value_type','number',
            'unit','IN',
            'minimum',0.000001
          )
        ),
        true
      )
    else module end
    order by ordinality
  ),'[]'::jsonb) into v_modules
  from jsonb_array_elements(v_v4.module_schema) with ordinality source(module,ordinality);

  select coalesce(jsonb_agg(
    case when output->>'key'='forms.form_material_lf' then
      output || jsonb_build_object(
        'label','Form boards — installed',
        'resource_model','physical_boards_v5'
      )
    else output end
    order by ordinality
  ),'[]'::jsonb) into v_outputs
  from jsonb_array_elements(v_v4.output_schema) with ordinality source(output,ordinality);

  insert into public.platform_condition_archetype_versions(
    archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
  ) values (
    v_v4.archetype_id,5,'published','concrete_condition_v1',
    v_v4.role_schema,v_v4.input_schema,v_modules,v_outputs,
    coalesce(v_v4.projection_schema,'{}'::jsonb) || jsonb_build_object('form_resource_model','physical_boards_v5'),
    'ADR-023 / Issue #55: wood-lumber form board LF is derived from authoritative formed-edge geometry, footing depth, and estimator-selected board course height. Generic LF/LF factor removed.',
    now()
  );
end;
$$;

create or replace function public.carez_ensure_strip_footing_v5_template()
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_v4_result jsonb;
  v_v4_template public.company_condition_template_versions%rowtype;
  v_archetype public.platform_condition_archetypes%rowtype;
  v_v5 public.platform_condition_archetype_versions%rowtype;
  v_existing public.company_condition_template_versions%rowtype;
  v_target_id uuid;
  v_mapping_count integer;
  v_module_defaults jsonb;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Office access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':strip_wall_footing:v5',0));

  v_v4_result:=public.carez_ensure_strip_footing_v4_template();
  select * into v_v4_template
  from public.company_condition_template_versions
  where company_id=v_company and id=(v_v4_result->>'template_version_id')::uuid and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v4 company template not found.'; end if;

  select * into v_archetype
  from public.platform_condition_archetypes
  where code='strip_wall_footing' and active;
  if not found then raise exception 'Active Strip / Wall Footing archetype not found.'; end if;

  select * into v_v5
  from public.platform_condition_archetype_versions
  where archetype_id=v_archetype.id and version_no=5 and status='published' and engine_key='concrete_condition_v1'
  limit 1;
  if not found then raise exception 'Published Strip / Wall Footing v5 contract not found.'; end if;

  select template_version.* into v_existing
  from public.company_condition_template_versions template_version
  where template_version.company_id=v_company
    and template_version.template_id=v_v4_template.template_id
    and template_version.archetype_version_id=v_v5.id
    and template_version.status='published'
  order by template_version.version_no desc
  limit 1;
  if found then
    return jsonb_build_object(
      'template_version_id',v_existing.id,
      'legacy_assembly_version_id',v_existing.legacy_assembly_version_id,
      'created',false
    );
  end if;

  v_module_defaults:=coalesce(v_v4_template.module_defaults,'{}'::jsonb) || jsonb_build_object(
    'forms',
    coalesce(v_v4_template.module_defaults->'forms','{}'::jsonb) || jsonb_build_object(
      'inputs',
      coalesce(v_v4_template.module_defaults->'forms'->'inputs','{}'::jsonb) || jsonb_build_object(
        'form_resource_model','physical_boards_v5'
      )
    )
  );

  insert into public.company_condition_template_versions(
    company_id,template_id,archetype_version_id,version_no,status,template_code_snapshot,template_name_snapshot,
    template_description_snapshot,module_defaults,input_defaults,input_provenance,pricing_defaults,legacy_assembly_version_id,notes,created_by
  ) values (
    v_company,v_v4_template.template_id,v_v5.id,
    coalesce((select max(version_no)+1 from public.company_condition_template_versions where company_id=v_company and template_id=v_v4_template.template_id),1),
    'draft',v_v4_template.template_code_snapshot,v_v4_template.template_name_snapshot,v_v4_template.template_description_snapshot,
    v_module_defaults,coalesce(v_v4_template.input_defaults,'{}'::jsonb),
    coalesce(v_v4_template.input_provenance,'{}'::jsonb),coalesce(v_v4_template.pricing_defaults,'{}'::jsonb),
    v_v4_template.legacy_assembly_version_id,
    'ADR-023 Strip / Wall Footing v5. Wood form-board demand is a physical installed quantity derived from geometry and board choice.',auth.uid()
  ) returning id into v_target_id;

  insert into public.condition_legacy_output_mappings(
    company_id,template_version_id,output_key,legacy_assembly_component_id,legacy_component_key_snapshot,output_unit_snapshot,created_by
  )
  select v_company,v_target_id,mapping.output_key,mapping.legacy_assembly_component_id,
         mapping.legacy_component_key_snapshot,mapping.output_unit_snapshot,auth.uid()
  from public.condition_legacy_output_mappings mapping
  where mapping.company_id=v_company and mapping.template_version_id=v_v4_template.id
    and exists (select 1 from jsonb_array_elements(v_v5.output_schema) output where output->>'key'=mapping.output_key);

  select count(*) into v_mapping_count
  from public.condition_legacy_output_mappings mapping
  where mapping.company_id=v_company and mapping.template_version_id=v_target_id;
  if v_mapping_count<>jsonb_array_length(v_v5.output_schema) then
    raise exception 'Strip v5 compatibility projection is incomplete.';
  end if;

  perform public.carez_publish_company_condition_template_version(v_target_id);
  return jsonb_build_object(
    'template_version_id',v_target_id,
    'legacy_assembly_version_id',v_v4_template.legacy_assembly_version_id,
    'created',true
  );
end;
$$;

revoke all on function public.carez_ensure_strip_footing_v5_template() from public,anon;
grant execute on function public.carez_ensure_strip_footing_v5_template() to authenticated,service_role;

create or replace function public.carez_upgrade_strip_condition_draft_to_v5(p_condition_version_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_source public.project_concrete_condition_versions%rowtype;
  v_condition public.project_concrete_conditions%rowtype;
  v_current_contract integer;
  v_from_contract integer;
  v_code text;
  v_target_result jsonb;
  v_target_template public.company_condition_template_versions%rowtype;
  v_target_archetype public.platform_condition_archetype_versions%rowtype;
  v_primary_measurement_id uuid;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Office access required.'; end if;

  select * into v_source from public.project_concrete_condition_versions
  where id=p_condition_version_id and company_id=v_company for update;
  if not found then raise exception 'Project Condition version not found.'; end if;
  if v_source.status<>'draft' then raise exception 'Only a draft Project Condition can be upgraded. Verified history is immutable.'; end if;

  select * into v_condition from public.project_concrete_conditions
  where id=v_source.condition_id and company_id=v_company for update;
  if not found or v_condition.status<>'active' then raise exception 'Active Project Concrete Condition not found.'; end if;

  if not exists (
    select 1 from public.takeoff_sets takeoff_set
    join public.estimates estimate on estimate.company_id=takeoff_set.company_id and estimate.id=takeoff_set.estimate_id
    where takeoff_set.company_id=v_company and takeoff_set.id=v_condition.takeoff_set_id
      and takeoff_set.status='active' and estimate.status not in ('accepted','approved','superseded')
  ) or exists (
    select 1 from public.proposal_presentations presentation
    join public.takeoff_sets takeoff_set on takeoff_set.company_id=presentation.company_id and takeoff_set.estimate_id=presentation.estimate_id
    where takeoff_set.company_id=v_company and takeoff_set.id=v_condition.takeoff_set_id
  ) then raise exception 'This estimate revision is locked.'; end if;

  select version_no,archetype_code_snapshot into v_current_contract,v_code
  from public.platform_condition_archetype_versions where id=v_source.archetype_version_id;
  if v_code<>'strip_wall_footing' then raise exception 'Only Strip / Wall Footing Conditions support this contract upgrade.'; end if;
  v_from_contract:=v_current_contract;
  if v_current_contract>=5 then
    return jsonb_build_object('condition_version_id',v_source.id,'from_contract_version',v_current_contract,'to_contract_version',v_current_contract,'upgraded',false,'requires_recalculation',false);
  end if;

  if v_current_contract<4 then
    perform public.carez_upgrade_strip_condition_draft_to_v4(p_condition_version_id);
    select * into v_source from public.project_concrete_condition_versions
    where id=p_condition_version_id and company_id=v_company for update;
    select version_no into v_current_contract from public.platform_condition_archetype_versions where id=v_source.archetype_version_id;
    if v_current_contract<>4 then raise exception 'Strip v4 prerequisite upgrade did not complete.'; end if;
  end if;

  v_target_result:=public.carez_ensure_strip_footing_v5_template();
  select * into v_target_template from public.company_condition_template_versions
  where company_id=v_company and id=(v_target_result->>'template_version_id')::uuid and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v5 company template not found.'; end if;
  select * into v_target_archetype from public.platform_condition_archetype_versions
  where id=v_target_template.archetype_version_id and status='published' and engine_key='concrete_condition_v1';
  if not found or v_target_archetype.archetype_code_snapshot<>'strip_wall_footing' or v_target_archetype.version_no<>5 then
    raise exception 'Published Strip / Wall Footing v5 contract not found.';
  end if;

  select measurement_id into v_primary_measurement_id
  from public.project_condition_measurement_roles
  where company_id=v_company and condition_version_id=v_source.id and role_key='run'
  order by is_primary desc,sort_order,id limit 1;
  if v_primary_measurement_id is not null and exists (
    select 1 from public.project_condition_measurement_roles role
    where role.company_id=v_company and role.measurement_id=v_primary_measurement_id and role.condition_version_id<>v_source.id
  ) then raise exception 'The primary takeoff is shared by another Condition revision. Preserve that history and create/reassign a fresh takeoff before upgrading this draft.'; end if;

  perform set_config('carez.project_condition_commit','1',true);

  delete from public.project_condition_holds where company_id=v_company and condition_version_id=v_source.id;
  delete from public.project_condition_outputs where company_id=v_company and condition_version_id=v_source.id;

  if v_primary_measurement_id is not null then
    delete from public.estimate_items estimate_item
    where estimate_item.company_id=v_company and estimate_item.source_takeoff_output_id in (
      select output.id from public.takeoff_measurement_outputs output
      where output.company_id=v_company and output.measurement_id=v_primary_measurement_id
    );
    delete from public.takeoff_measurement_outputs where company_id=v_company and measurement_id=v_primary_measurement_id;
    update public.takeoff_measurements set variables='{}'::jsonb,method_profile_id=null,updated_at=now()
    where company_id=v_company and id=v_primary_measurement_id;
  end if;

  -- Retarget first so contract-aware module validation accepts v5-only inputs.
  update public.project_concrete_condition_versions set
    template_version_id=v_target_template.id,
    archetype_version_id=v_target_archetype.id,
    compatibility_anchor_measurement_id=v_primary_measurement_id,
    updated_at=now()
  where company_id=v_company and id=v_source.id;

  update public.project_condition_module_instances module set
    input_values=(coalesce(module.input_values,'{}'::jsonb) - 'form_material_factor_lf_per_lf') || jsonb_build_object(
      'form_resource_model','physical_boards_v5'
    ),
    input_provenance=(coalesce(module.input_provenance,'{}'::jsonb) - 'form_material_factor_lf_per_lf') || jsonb_build_object(
      'form_resource_model',jsonb_build_object('mode','platform_default','sourceLabel','Strip v5 physical form-board model')
    ),
    updated_at=now()
  where module.company_id=v_company and module.condition_version_id=v_source.id
    and module.module_key='forms' and module.instance_key='default';

  update public.project_concrete_conditions set compatibility_projection_version_id=null,updated_at=now()
  where company_id=v_company and id=v_condition.id;

  return jsonb_build_object(
    'condition_version_id',v_source.id,
    'from_contract_version',v_from_contract,
    'to_contract_version',5,
    'upgraded',true,
    'requires_recalculation',true,
    'message','Upgraded to Contract v5. Form material factor was removed. If wood form boards are tracked, select the physical Form board and recalculate.'
  );
end;
$$;

revoke all on function public.carez_upgrade_strip_condition_draft_to_v5(uuid) from public,anon;
grant execute on function public.carez_upgrade_strip_condition_draft_to_v5(uuid) to authenticated,service_role;

comment on function public.carez_upgrade_strip_condition_draft_to_v5(uuid) is
  'Upgrades only editable Strip drafts to ADR-023 v5 physical form-board modeling. Published/verified history remains unchanged.';;
