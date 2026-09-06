-- ADR-022 / Issue #55: publish Strip / Wall Footing v4 without a drawable
-- End forms EA role. Bulkhead/pour-stop count is an estimator-approved Forms
-- input whose run-endpoint candidate is derived from authoritative run geometry.
-- Published v1/v2/v3 contracts remain unchanged.

do $$
declare
  v_v3 public.platform_condition_archetype_versions%rowtype;
  v_roles jsonb;
  v_modules jsonb;
  v_outputs jsonb;
begin
  select version.* into v_v3
  from public.platform_condition_archetype_versions version
  where version.archetype_code_snapshot='strip_wall_footing'
    and version.version_no=3
    and version.status='published'
    and version.engine_key='concrete_condition_v1'
  limit 1;
  if not found then raise exception 'Published Strip / Wall Footing v3 contract not found.'; end if;

  if exists (
    select 1 from public.platform_condition_archetype_versions version
    where version.archetype_id=v_v3.archetype_id and version.version_no=4
  ) then return; end if;

  select coalesce(jsonb_agg(role order by ordinality),'[]'::jsonb) into v_roles
  from jsonb_array_elements(v_v3.role_schema) with ordinality source(role,ordinality)
  where role->>'key'<>'end_forms';

  select coalesce(jsonb_agg(
    case when module->>'key'='forms' then
      jsonb_set(
        module,
        '{input_schema}',
        coalesce(module->'input_schema','[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'key','bulkhead_count_source',
            'label','End bulkheads / pour stops',
            'value_type','select',
            'options',jsonb_build_array('run_endpoints','explicit_count','none')
          ),
          jsonb_build_object(
            'key','bulkhead_explicit_count',
            'label','Explicit bulkhead count',
            'value_type','integer',
            'unit','EA',
            'minimum',0
          )
        ),
        true
      )
    else module end
    order by ordinality
  ),'[]'::jsonb) into v_modules
  from jsonb_array_elements(v_v3.module_schema) with ordinality source(module,ordinality);

  select coalesce(jsonb_agg(
    case
      when output->>'key'='forms.end_contact_sf' then output || jsonb_build_object(
        'label','End bulkhead contact area',
        'algorithm','strip-end-bulkhead-v4'
      )
      when output->>'key'='forms.form_material_lf' then output || jsonb_build_object(
        'algorithm','strip-form-material-v4'
      )
      else output
    end
    order by ordinality
  ),'[]'::jsonb) into v_outputs
  from jsonb_array_elements(v_v3.output_schema) with ordinality source(output,ordinality);

  insert into public.platform_condition_archetype_versions(
    archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
  ) values (
    v_v3.archetype_id,4,'published','concrete_condition_v1',
    v_roles,v_v3.input_schema,v_modules,v_outputs,
    coalesce(v_v3.projection_schema,'{}'::jsonb) || jsonb_build_object('bulkhead_source','forms.bulkhead_count_source'),
    'ADR-022 / Issue #55: End bulkheads / pour stops are derived from Strip run geometry or estimator-entered explicitly; drawable end_forms role removed.',
    now()
  );
end;
$$;

create or replace function public.carez_ensure_strip_v4_anchor_role_assembly()
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_code text := 'COND-STRIP-ANCHOR-EMBED-RUNTIME';
  v_assembly_id uuid;
  v_version_id uuid;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Office access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':strip_anchor_embed_role:v4',0));

  select assembly.id into v_assembly_id
  from public.concrete_assemblies assembly
  where assembly.company_id=v_company and assembly.code=v_code
  limit 1;
  if v_assembly_id is null then
    insert into public.concrete_assemblies(
      company_id,code,name,category,primary_measurement,description,active,direct_takeoff_enabled,created_by
    ) values (
      v_company,v_code,'Strip / Wall Footing — Anchors / embeds','Concrete Condition Roles','EA',
      'Role-specific geometry carrier for Strip / Wall Footing anchor/embed locations. Not an estimate demand.',
      true,true,auth.uid()
    ) returning id into v_assembly_id;
  end if;

  select version.id into v_version_id
  from public.concrete_assembly_versions version
  where version.company_id=v_company and version.assembly_id=v_assembly_id and version.status='published'
  order by version.version_no desc
  limit 1;
  if v_version_id is not null then return v_version_id; end if;

  insert into public.concrete_assembly_versions(
    company_id,assembly_id,version_no,status,source_type,source_label,notes,
    assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,created_by
  ) values (
    v_company,v_assembly_id,1,'draft','carez','Concrete Condition role geometry',
    'ADR-022 role-specific EA identity; replaces unit-only compatibility lookup for new Strip anchor/embed drawings.',
    v_code,'Strip / Wall Footing — Anchors / embeds','Concrete Condition Roles','EA',
    'Role-specific geometry carrier for Strip / Wall Footing anchor/embed locations. Not an estimate demand.',auth.uid()
  ) returning id into v_version_id;

  insert into public.concrete_assembly_components(
    company_id,assembly_version_id,component_key,label,estimate_item_type,output_unit,quantity_formula,
    baseline_source,pricing_strategy,resource_behavior,estimate_visible,authoring_config,sort_order
  ) values (
    v_company,v_version_id,'condition_role_anchor_embed','Anchors / embeds role','material','EA',jsonb_build_object('var','quantity'),
    'Condition role geometry only','none','consumed_material',false,
    jsonb_build_object('mode','condition_role_geometry','archetype','strip_wall_footing','role_key','anchors_embeds'),10
  );

  update public.concrete_assembly_versions
  set status='published',published_at=now()
  where id=v_version_id and company_id=v_company;
  return v_version_id;
end;
$$;

revoke all on function public.carez_ensure_strip_v4_anchor_role_assembly() from public,anon;
grant execute on function public.carez_ensure_strip_v4_anchor_role_assembly() to authenticated,service_role;

create or replace function public.carez_ensure_strip_footing_v4_template()
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_v3_result jsonb;
  v_v3_template public.company_condition_template_versions%rowtype;
  v_archetype public.platform_condition_archetypes%rowtype;
  v_v4 public.platform_condition_archetype_versions%rowtype;
  v_existing public.company_condition_template_versions%rowtype;
  v_target_id uuid;
  v_anchor_version_id uuid;
  v_mapping_count integer;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Office access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':strip_wall_footing:v4',0));

  v_v3_result:=public.carez_ensure_strip_footing_v3_template();
  select * into v_v3_template
  from public.company_condition_template_versions
  where company_id=v_company and id=(v_v3_result->>'template_version_id')::uuid and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v3 company template not found.'; end if;

  select * into v_archetype
  from public.platform_condition_archetypes
  where code='strip_wall_footing' and active;
  if not found then raise exception 'Active Strip / Wall Footing archetype not found.'; end if;

  select * into v_v4
  from public.platform_condition_archetype_versions
  where archetype_id=v_archetype.id and version_no=4 and status='published' and engine_key='concrete_condition_v1'
  limit 1;
  if not found then raise exception 'Published Strip / Wall Footing v4 contract not found.'; end if;

  v_anchor_version_id:=public.carez_ensure_strip_v4_anchor_role_assembly();

  select template_version.* into v_existing
  from public.company_condition_template_versions template_version
  where template_version.company_id=v_company
    and template_version.template_id=v_v3_template.template_id
    and template_version.archetype_version_id=v_v4.id
    and template_version.status='published'
  order by template_version.version_no desc
  limit 1;
  if found then
    return jsonb_build_object(
      'template_version_id',v_existing.id,
      'legacy_assembly_version_id',v_existing.legacy_assembly_version_id,
      'anchor_role_assembly_version_id',v_anchor_version_id,
      'created',false
    );
  end if;

  insert into public.company_condition_template_versions(
    company_id,template_id,archetype_version_id,version_no,status,template_code_snapshot,template_name_snapshot,
    template_description_snapshot,module_defaults,input_defaults,input_provenance,pricing_defaults,legacy_assembly_version_id,notes,created_by
  ) values (
    v_company,v_v3_template.template_id,v_v4.id,
    coalesce((select max(version_no)+1 from public.company_condition_template_versions where company_id=v_company and template_id=v_v3_template.template_id),1),
    'draft',v_v3_template.template_code_snapshot,v_v3_template.template_name_snapshot,v_v3_template.template_description_snapshot,
    coalesce(v_v3_template.module_defaults,'{}'::jsonb),coalesce(v_v3_template.input_defaults,'{}'::jsonb),
    coalesce(v_v3_template.input_provenance,'{}'::jsonb),coalesce(v_v3_template.pricing_defaults,'{}'::jsonb),
    v_v3_template.legacy_assembly_version_id,
    'ADR-022 Strip / Wall Footing v4. Bulkhead/pour-stop count source remains estimator-controlled.',auth.uid()
  ) returning id into v_target_id;

  insert into public.condition_legacy_output_mappings(
    company_id,template_version_id,output_key,legacy_assembly_component_id,legacy_component_key_snapshot,output_unit_snapshot,created_by
  )
  select v_company,v_target_id,mapping.output_key,mapping.legacy_assembly_component_id,
         mapping.legacy_component_key_snapshot,mapping.output_unit_snapshot,auth.uid()
  from public.condition_legacy_output_mappings mapping
  where mapping.company_id=v_company and mapping.template_version_id=v_v3_template.id
    and exists (select 1 from jsonb_array_elements(v_v4.output_schema) output where output->>'key'=mapping.output_key);

  select count(*) into v_mapping_count
  from public.condition_legacy_output_mappings mapping
  where mapping.company_id=v_company and mapping.template_version_id=v_target_id;
  if v_mapping_count<>jsonb_array_length(v_v4.output_schema) then
    raise exception 'Strip v4 compatibility projection is incomplete.';
  end if;

  perform public.carez_publish_company_condition_template_version(v_target_id);
  return jsonb_build_object(
    'template_version_id',v_target_id,
    'legacy_assembly_version_id',v_v3_template.legacy_assembly_version_id,
    'anchor_role_assembly_version_id',v_anchor_version_id,
    'created',true
  );
end;
$$;

revoke all on function public.carez_ensure_strip_footing_v4_template() from public,anon;
grant execute on function public.carez_ensure_strip_footing_v4_template() to authenticated,service_role;

create or replace function public.carez_upgrade_strip_condition_draft_to_v4(p_condition_version_id uuid)
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
  v_end_measurement_id uuid;
  v_end_count numeric;
  v_end_shared boolean := false;
  v_deleted_end_measurement boolean := false;
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
  if v_current_contract>=4 then
    return jsonb_build_object('condition_version_id',v_source.id,'from_contract_version',v_current_contract,'to_contract_version',v_current_contract,'upgraded',false,'requires_recalculation',false);
  end if;

  if v_current_contract<3 then
    perform public.carez_upgrade_strip_condition_draft_to_v3(p_condition_version_id);
    select * into v_source from public.project_concrete_condition_versions
    where id=p_condition_version_id and company_id=v_company for update;
    select version_no into v_current_contract from public.platform_condition_archetype_versions where id=v_source.archetype_version_id;
    if v_current_contract<>3 then raise exception 'Strip v3 prerequisite upgrade did not complete.'; end if;
  end if;

  select role.measurement_id,measurement.raw_quantity
    into v_end_measurement_id,v_end_count
  from public.project_condition_measurement_roles role
  join public.takeoff_measurements measurement on measurement.company_id=role.company_id and measurement.id=role.measurement_id
  where role.company_id=v_company and role.condition_version_id=v_source.id and role.role_key='end_forms'
  order by role.sort_order,role.id limit 1;

  if v_end_measurement_id is not null then
    select exists(
      select 1 from public.project_condition_measurement_roles role
      where role.company_id=v_company and role.measurement_id=v_end_measurement_id and role.condition_version_id<>v_source.id
      union all
      select 1 from public.project_concrete_condition_versions version
      where version.company_id=v_company and version.compatibility_anchor_measurement_id=v_end_measurement_id and version.id<>v_source.id
    ) into v_end_shared;
    if not v_end_shared then
      perform public.carez_delete_takeoff_measurement(v_end_measurement_id);
      v_deleted_end_measurement:=true;
      select * into v_source from public.project_concrete_condition_versions
      where id=p_condition_version_id and company_id=v_company for update;
    end if;
  end if;

  v_target_result:=public.carez_ensure_strip_footing_v4_template();
  select * into v_target_template from public.company_condition_template_versions
  where company_id=v_company and id=(v_target_result->>'template_version_id')::uuid and status='published';
  if not found then raise exception 'Published Strip / Wall Footing v4 company template not found.'; end if;
  select * into v_target_archetype from public.platform_condition_archetype_versions
  where id=v_target_template.archetype_version_id and status='published' and engine_key='concrete_condition_v1';
  if not found or v_target_archetype.archetype_code_snapshot<>'strip_wall_footing' or v_target_archetype.version_no<>4 then
    raise exception 'Published Strip / Wall Footing v4 contract not found.';
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
    update public.takeoff_measurements set
      assembly_version_id=v_target_template.legacy_assembly_version_id,variables='{}'::jsonb,method_profile_id=null,updated_at=now()
    where company_id=v_company and id=v_primary_measurement_id;
  end if;

  delete from public.project_condition_measurement_roles
  where company_id=v_company and condition_version_id=v_source.id and role_key='end_forms';

  if v_end_count is not null then
    update public.project_condition_module_instances module set
      input_values=coalesce(module.input_values,'{}'::jsonb) || jsonb_build_object(
        'bulkhead_count_source','explicit_count','bulkhead_explicit_count',v_end_count
      ),
      input_provenance=coalesce(module.input_provenance,'{}'::jsonb) || jsonb_build_object(
        'bulkhead_count_source',jsonb_build_object('mode','project_value','sourceLabel','Converted from Strip v3 End forms role'),
        'bulkhead_explicit_count',jsonb_build_object('mode','project_value','sourceLabel','Converted from Strip v3 End forms role')
      ),
      updated_at=now()
    where module.company_id=v_company and module.condition_version_id=v_source.id
      and module.module_key='forms' and module.instance_key='default';
  end if;

  update public.project_concrete_condition_versions set
    template_version_id=v_target_template.id,
    archetype_version_id=v_target_archetype.id,
    compatibility_anchor_measurement_id=v_primary_measurement_id,
    updated_at=now()
  where company_id=v_company and id=v_source.id;

  update public.project_concrete_conditions set compatibility_projection_version_id=null,updated_at=now()
  where company_id=v_company and id=v_condition.id;

  return jsonb_build_object(
    'condition_version_id',v_source.id,
    'from_contract_version',v_from_contract,
    'to_contract_version',4,
    'upgraded',true,
    'requires_recalculation',true,
    'converted_end_form_count',v_end_count,
    'deleted_obsolete_end_form_takeoff',v_deleted_end_measurement,
    'preserved_shared_end_form_takeoff',v_end_shared,
    'message',case when v_end_count is not null
      then 'Upgraded to Contract v4. Existing End forms count was converted to an explicit End bulkheads / pour stops count. Review and recalculate.'
      else 'Upgraded to Contract v4. Review End bulkheads / pour stops and recalculate.' end
  );
end;
$$;

revoke all on function public.carez_upgrade_strip_condition_draft_to_v4(uuid) from public,anon;
grant execute on function public.carez_upgrade_strip_condition_draft_to_v4(uuid) to authenticated,service_role;

comment on function public.carez_ensure_strip_footing_v4_template() is
  'Creates immutable Strip / Wall Footing v4 company template while preserving v1-v3 and using the existing one-to-one compatibility projection.';
comment on function public.carez_upgrade_strip_condition_draft_to_v4(uuid) is
  'Upgrades only editable Strip drafts to ADR-022 v4. Existing explicit End forms counts are converted to End bulkheads / pour stops; published/verified history is unchanged.';
