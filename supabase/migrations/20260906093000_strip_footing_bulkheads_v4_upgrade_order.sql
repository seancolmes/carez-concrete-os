-- ADR-022 / Issue #55 follow-up: the v3 -> v4 upgrader must retarget the
-- draft Condition contract before writing v4-only Forms inputs so the existing
-- module validation trigger evaluates those fields against the v4 schema.

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

  -- Retarget the draft first. Module validation is contract-aware and must see
  -- v4 before v4-only bulkhead fields are written.
  update public.project_concrete_condition_versions set
    template_version_id=v_target_template.id,
    archetype_version_id=v_target_archetype.id,
    compatibility_anchor_measurement_id=v_primary_measurement_id,
    updated_at=now()
  where company_id=v_company and id=v_source.id;

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

comment on function public.carez_upgrade_strip_condition_draft_to_v4(uuid) is
  'Upgrades only editable Strip drafts to ADR-022 v4. Contract retarget occurs before v4-only module inputs are written; published/verified history is unchanged.';
