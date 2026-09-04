-- Carez P0.5A/C: server-authoritative pilot persistence and compatibility reconciliation.
--
-- This is additive. Existing Takeoff measurements, assembly versions, output
-- rows, estimate items, and atomic legacy RPCs remain the compatibility layer.

alter table public.project_concrete_condition_versions
  add column compatibility_anchor_measurement_id uuid
    references public.takeoff_measurements(id) on delete restrict;

alter table public.project_concrete_conditions
  add column compatibility_projection_version_id uuid
    references public.project_concrete_condition_versions(id) on delete set null;

create index project_condition_versions_anchor_idx
  on public.project_concrete_condition_versions(company_id,compatibility_anchor_measurement_id)
  where compatibility_anchor_measurement_id is not null;

create index project_conditions_projection_idx
  on public.project_concrete_conditions(company_id,compatibility_projection_version_id)
  where compatibility_projection_version_id is not null;

create or replace function public.carez_guard_project_condition_projection()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.compatibility_projection_version_id is distinct from old.compatibility_projection_version_id then
    if coalesce(current_setting('carez.project_condition_commit',true),'') <> '1' then
      raise exception 'Use the atomic Project Condition calculation action to change compatibility projection lineage.';
    end if;
    if new.compatibility_projection_version_id is not null and not exists (
      select 1
      from public.project_concrete_condition_versions version
      where version.id = new.compatibility_projection_version_id
        and version.company_id = new.company_id
        and version.condition_id = new.id
    ) then
      raise exception 'Compatibility projection version must belong to this Project Concrete Condition.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_project_condition_projection() from public,anon,authenticated;

create trigger project_concrete_conditions_projection_guard
before update on public.project_concrete_conditions
for each row execute function public.carez_guard_project_condition_projection();

create or replace function public.carez_validate_project_condition_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_condition public.project_concrete_conditions%rowtype;
  v_template_version public.company_condition_template_versions%rowtype;
  v_archetype_version public.platform_condition_archetype_versions%rowtype;
  v_template_archetype_id uuid;
  v_profile public.takeoff_method_profiles%rowtype;
  v_anchor public.takeoff_measurements%rowtype;
begin
  select * into v_condition
  from public.project_concrete_conditions
  where id = new.condition_id and company_id = new.company_id;
  if not found then raise exception 'Project Concrete Condition not found.'; end if;

  new.condition_code_snapshot := v_condition.code;
  new.condition_name_snapshot := v_condition.name;
  new.condition_description_snapshot := v_condition.description;

  select * into v_template_version
  from public.company_condition_template_versions
  where id = new.template_version_id and company_id = new.company_id and status = 'published';
  if not found or v_template_version.template_id <> v_condition.template_id then
    raise exception 'Project Condition requires a published version of its selected Company Condition Template.';
  end if;

  select archetype_id into v_template_archetype_id
  from public.company_condition_templates
  where id = v_template_version.template_id and company_id = new.company_id;

  select * into v_archetype_version
  from public.platform_condition_archetype_versions
  where id = new.archetype_version_id and status = 'published';
  if not found
     or v_archetype_version.id <> v_template_version.archetype_version_id
     or v_archetype_version.archetype_id <> v_template_archetype_id then
    raise exception 'Project Condition archetype lineage does not match the published Company Condition Template.';
  end if;

  if not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'planFacts',new.plan_facts)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'methods',new.method_inputs)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'production',new.production_inputs)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'commercial',new.commercial_inputs)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'drawing',new.drawing_inputs) then
    raise exception 'Project Condition inputs do not match the typed archetype schema.';
  end if;

  if not public.carez_condition_output_overrides_are_valid(new.output_overrides) then
    raise exception 'Project Condition output overrides require a nonnegative quantity and reason.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(new.output_overrides) supplied(key)
    where not exists (
      select 1 from jsonb_array_elements(v_archetype_version.output_schema) output
      where output->>'key' = supplied.key
    )
  ) then raise exception 'Project Condition contains an override for an unknown output.'; end if;

  if new.legacy_method_profile_id is not null then
    if v_template_version.legacy_assembly_version_id is null then
      raise exception 'A legacy method profile requires a compatible legacy assembly version.';
    end if;
    select * into v_profile
    from public.takeoff_method_profiles
    where id = new.legacy_method_profile_id
      and company_id = new.company_id
      and takeoff_set_id = v_condition.takeoff_set_id
      and assembly_version_id = v_template_version.legacy_assembly_version_id
      and status = 'verified';
    if not found then
      raise exception 'Legacy method profile must be verified and match the Condition takeoff set and compatibility assembly.';
    end if;
  end if;

  if new.compatibility_anchor_measurement_id is not null then
    if v_template_version.legacy_assembly_version_id is null then
      raise exception 'A compatibility anchor requires a compatible legacy assembly version.';
    end if;
    select * into v_anchor
    from public.takeoff_measurements
    where id = new.compatibility_anchor_measurement_id
      and company_id = new.company_id
      and takeoff_set_id = v_condition.takeoff_set_id
      and status = 'active';
    if not found or v_anchor.assembly_version_id <> v_template_version.legacy_assembly_version_id then
      raise exception 'Compatibility anchor must be an active measurement using the template compatibility assembly.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_version() from public,anon,authenticated;

create or replace function public.carez_guard_project_condition_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.status = 'verified' then
    raise exception 'Verified Project Concrete Condition versions are immutable. Create a new revision.';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(current_setting('carez.project_condition_commit',true),'') <> '1'
     and exists (
       select 1 from public.project_concrete_conditions condition
       where condition.company_id = old.company_id
         and condition.id = old.condition_id
         and condition.compatibility_projection_version_id = old.id
     )
     and (
       new.plan_facts is distinct from old.plan_facts
       or new.method_inputs is distinct from old.method_inputs
       or new.production_inputs is distinct from old.production_inputs
       or new.commercial_inputs is distinct from old.commercial_inputs
       or new.drawing_inputs is distinct from old.drawing_inputs
       or new.input_provenance is distinct from old.input_provenance
       or new.output_overrides is distinct from old.output_overrides
       or new.compatibility_anchor_measurement_id is distinct from old.compatibility_anchor_measurement_id
     ) then
    raise exception 'Use the atomic Project Condition calculation action to change projected inputs.';
  end if;

  if tg_op <> 'DELETE' and new.status = 'verified' then
    if coalesce(current_setting('carez.project_condition_verify',true),'') <> '1' then
      raise exception 'Use the Project Condition verification action.';
    end if;
    new.verified_at := coalesce(new.verified_at,now());
    new.verified_by := coalesce(new.verified_by,auth.uid());
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_project_condition_version() from public,anon,authenticated;

create or replace function public.carez_guard_project_condition_child()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id uuid;
  v_status text;
  v_is_projection boolean;
begin
  if tg_op = 'DELETE' then v_version_id := old.condition_version_id;
  else v_version_id := new.condition_version_id;
  end if;

  select version.status,
         exists (
           select 1 from public.project_concrete_conditions condition
           where condition.company_id = version.company_id
             and condition.id = version.condition_id
             and condition.compatibility_projection_version_id = version.id
         )
    into v_status,v_is_projection
  from public.project_concrete_condition_versions version
  where version.id = v_version_id;

  if v_status = 'verified' then
    raise exception 'Verified Project Concrete Condition details are immutable. Create a new revision.';
  end if;
  if coalesce(current_setting('carez.project_condition_commit',true),'') <> '1'
     and (tg_table_name in ('project_condition_outputs','project_condition_holds') or coalesce(v_is_projection,false)) then
    raise exception 'Use the atomic Project Condition calculation action to change projected details.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_project_condition_child() from public,anon,authenticated;

create or replace function public.carez_validate_project_condition_measurement_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_condition public.project_concrete_conditions%rowtype;
  v_condition_version public.project_concrete_condition_versions%rowtype;
  v_template_version public.company_condition_template_versions%rowtype;
  v_measurement public.takeoff_measurements%rowtype;
  v_role jsonb;
begin
  select * into v_condition_version
  from public.project_concrete_condition_versions
  where id = new.condition_version_id and company_id = new.company_id;
  if not found then raise exception 'Project Condition version not found.'; end if;

  select * into v_condition
  from public.project_concrete_conditions
  where id = v_condition_version.condition_id and company_id = new.company_id;

  select * into v_template_version
  from public.company_condition_template_versions
  where id = v_condition_version.template_version_id and company_id = new.company_id;

  select role into v_role
  from public.platform_condition_archetype_versions version,
       lateral jsonb_array_elements(version.role_schema) role
  where version.id = v_condition_version.archetype_version_id
    and role->>'key' = new.role_key;
  if v_role is null then raise exception 'Measurement role is not supported by the selected archetype version.'; end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id = new.measurement_id
    and company_id = new.company_id
    and takeoff_set_id = v_condition.takeoff_set_id
    and status = 'active';
  if not found then raise exception 'Measurement role must reference active geometry from the same company and takeoff set.'; end if;

  if upper(v_measurement.raw_unit) <> upper(v_role->>'unit')
     or v_measurement.measurement_type <> v_role->>'measurement_type'
     or (v_measurement.geometry is not null and v_measurement.geometry->>'type' <> v_role->>'geometry_type') then
    raise exception 'Measurement unit/type does not match the Condition role contract.';
  end if;

  if new.is_primary <> coalesce((v_role->>'primary')::boolean,false) then
    raise exception 'Measurement primary/secondary designation does not match the Condition role contract.';
  end if;

  if new.measurement_id = v_condition_version.compatibility_anchor_measurement_id
     and (
       not new.is_primary
       or v_template_version.legacy_assembly_version_id is null
       or v_measurement.assembly_version_id <> v_template_version.legacy_assembly_version_id
     ) then
    raise exception 'Compatibility anchor must be a primary role using the selected compatibility assembly version.';
  end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_measurement_role() from public,anon,authenticated;

create or replace function public.carez_commit_project_condition_calculation(
  p_condition_version_id uuid,
  p_expected_version_updated_at timestamptz,
  p_expected_projection_version_id uuid,
  p_compatibility_anchor_measurement_id uuid,
  p_plan_facts jsonb,
  p_method_inputs jsonb,
  p_production_inputs jsonb,
  p_commercial_inputs jsonb,
  p_drawing_inputs jsonb,
  p_input_provenance jsonb,
  p_output_overrides jsonb,
  p_modules jsonb,
  p_measurement_roles jsonb,
  p_condition_outputs jsonb,
  p_legacy_measurement_updates jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.project_concrete_condition_versions%rowtype;
  v_condition public.project_concrete_conditions%rowtype;
  v_template public.company_condition_template_versions%rowtype;
  v_archetype public.platform_condition_archetype_versions%rowtype;
  v_measurement public.takeoff_measurements%rowtype;
  v_estimate_status text;
  v_module jsonb;
  v_role jsonb;
  v_output jsonb;
  v_hold jsonb;
  v_update jsonb;
  v_module_id uuid;
  v_driver_role_id uuid;
  v_condition_output_id uuid;
  v_legacy_output public.takeoff_measurement_outputs%rowtype;
  v_output_definition jsonb;
  v_measurement_id uuid;
  v_previous_measurement_ids uuid[] := '{}'::uuid[];
  v_new_measurement_ids uuid[] := '{}'::uuid[];
  v_all_measurement_ids uuid[] := '{}'::uuid[];
  v_reconciliation jsonb := '{}'::jsonb;
  v_output_count integer;
  v_hold_count integer;
  v_estimate_item_count integer;
  v_orphan_count integer;
begin
  if v_company is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;

  if jsonb_typeof(coalesce(p_modules,'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_measurement_roles,'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_condition_outputs,'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_legacy_measurement_updates,'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_plan_facts,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_method_inputs,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_production_inputs,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_commercial_inputs,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_drawing_inputs,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_input_provenance,'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_output_overrides,'null'::jsonb)) <> 'object' then
    raise exception 'Project Condition calculation payload is malformed.';
  end if;

  select * into v_version
  from public.project_concrete_condition_versions
  where id = p_condition_version_id and company_id = v_company
  for update;
  if not found or v_version.status <> 'draft' then
    raise exception 'Draft Project Condition version not found.';
  end if;
  if v_version.updated_at is distinct from p_expected_version_updated_at then
    raise exception 'Project Condition changed while it was being calculated. Reload and try again.';
  end if;

  select * into v_condition
  from public.project_concrete_conditions
  where id = v_version.condition_id and company_id = v_company
  for update;
  if not found or v_condition.status <> 'active' then raise exception 'Active Project Concrete Condition not found.'; end if;
  if v_condition.compatibility_projection_version_id is distinct from p_expected_projection_version_id then
    raise exception 'Project Condition projection changed while it was being calculated. Reload and try again.';
  end if;

  select estimate.status into v_estimate_status
  from public.takeoff_sets takeoff_set
  join public.estimates estimate
    on estimate.id = takeoff_set.estimate_id and estimate.company_id = takeoff_set.company_id
  where takeoff_set.id = v_condition.takeoff_set_id
    and takeoff_set.company_id = v_company
    and takeoff_set.status = 'active'
  for update of takeoff_set,estimate;
  if not found then raise exception 'Active takeoff set and estimate not found.'; end if;
  if v_estimate_status in ('accepted','approved','superseded') then raise exception 'This estimate revision is locked.'; end if;
  if exists (
    select 1 from public.proposal_presentations proposal
    join public.takeoff_sets takeoff_set on takeoff_set.estimate_id = proposal.estimate_id
    where proposal.company_id = v_company and takeoff_set.id = v_condition.takeoff_set_id
  ) then raise exception 'This estimate revision was already issued. Create the next revision before changing takeoff.'; end if;

  select * into v_template
  from public.company_condition_template_versions
  where id = v_version.template_version_id and company_id = v_company and status = 'published';
  if not found or v_template.legacy_assembly_version_id is null then
    raise exception 'Published compatibility template version not found.';
  end if;
  select * into v_archetype
  from public.platform_condition_archetype_versions
  where id = v_version.archetype_version_id and status = 'published';
  if not found or v_archetype.engine_key <> 'concrete_condition_v1' then
    raise exception 'Published Concrete Condition calculation contract not found.';
  end if;

  if jsonb_array_length(p_modules) <> jsonb_array_length(v_archetype.module_schema)
     or (select count(distinct item->>'module_key') from jsonb_array_elements(p_modules) item) <> jsonb_array_length(v_archetype.module_schema)
     or exists (
       select 1 from jsonb_array_elements(p_modules) item
       where item->>'instance_key' <> 'default'
          or nullif(trim(item->>'label'),'') is null
          or jsonb_typeof(item->'enabled') <> 'boolean'
          or jsonb_typeof(item->'input_values') <> 'object'
          or jsonb_typeof(item->'input_provenance') <> 'object'
          or not exists (
            select 1 from jsonb_array_elements(v_archetype.module_schema) definition
            where definition->>'key' = item->>'module_key'
          )
     ) then
    raise exception 'Pilot calculation requires one valid default instance for every Condition module.';
  end if;

  if jsonb_array_length(p_measurement_roles) = 0
     or jsonb_array_length(p_measurement_roles) <> (
       select count(distinct item->>'measurement_id') from jsonb_array_elements(p_measurement_roles) item
     )
     or jsonb_array_length(p_measurement_roles) <> (
       select count(distinct (item->>'role_key') || ':' || (item->>'role_instance_key'))
       from jsonb_array_elements(p_measurement_roles) item
     )
     or exists (
       select 1 from jsonb_array_elements(p_measurement_roles) item
       where nullif(trim(item->>'role_instance_key'),'') is null
          or jsonb_typeof(item->'is_primary') <> 'boolean'
          or not exists (
            select 1 from jsonb_array_elements(v_archetype.role_schema) definition
            where definition->>'key' = item->>'role_key'
              and coalesce((definition->>'primary')::boolean,false) = (item->>'is_primary')::boolean
          )
     )
     or exists (
       select 1 from jsonb_array_elements(v_archetype.role_schema) definition
       where coalesce((definition->>'required')::boolean,false)
         and not exists (
           select 1 from jsonb_array_elements(p_measurement_roles) assigned
           where assigned->>'role_key' = definition->>'key'
         )
     ) then
    raise exception 'Condition measurement role payload is incomplete or invalid.';
  end if;

  if (select count(*) from jsonb_array_elements(p_measurement_roles) item
      where (item->>'measurement_id')::uuid = p_compatibility_anchor_measurement_id
        and (item->>'is_primary')::boolean) <> 1 then
    raise exception 'Compatibility anchor must be assigned exactly once as a primary measurement role.';
  end if;

  if jsonb_array_length(p_condition_outputs) <> jsonb_array_length(v_archetype.output_schema)
     or (select count(distinct item->>'output_key') from jsonb_array_elements(p_condition_outputs) item) <> jsonb_array_length(v_archetype.output_schema)
     or exists (
       select 1
       from jsonb_array_elements(p_condition_outputs) item
       where item->>'output_instance_key' <> 'default'
          or item->>'module_instance_key' <> 'default'
          or item->>'quantity_mode' not in ('derived','explicit_override')
          or item->>'status' not in ('ready','held','inactive')
          or jsonb_typeof(item->'provenance') <> 'object'
          or item->'provenance'->>'authority' <> 'server'
          or jsonb_typeof(item->'calculation_trace') <> 'object'
          or item->'calculation_trace'->>'conditionVersionId' <> p_condition_version_id::text
          or jsonb_typeof(item->'holds') <> 'array'
          or (item->>'status' = 'held' and (
            jsonb_typeof(item->'production_quantity') <> 'null'
            or jsonb_array_length(item->'holds') = 0
          ))
          or (item->>'status' in ('ready','inactive') and (
            jsonb_typeof(item->'production_quantity') <> 'number'
            or (item->>'production_quantity')::numeric < 0
            or jsonb_array_length(item->'holds') <> 0
          ))
          or not exists (
            select 1 from jsonb_array_elements(v_archetype.output_schema) definition
            where definition->>'key' = item->>'output_key'
              and definition->>'module_key' = item->>'module_key'
              and upper(definition->>'unit') = upper(item->>'production_unit')
              and definition->>'resource_class' = item->>'resource_class'
          )
          or (
            nullif(item->>'driver_measurement_id','') is not null
            and not exists (
              select 1 from jsonb_array_elements(p_measurement_roles) role
              where role->>'measurement_id' = item->>'driver_measurement_id'
            )
          )
     ) then
    raise exception 'Condition output payload is incomplete or violates the published archetype contract.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_condition_outputs) item,
         lateral jsonb_array_elements(item->'holds') hold
    where hold->>'hold_code' not in (
      'input_required','labor_rate_required','method_verification_required',
      'price_required','review_required','3d_input_required'
    ) or nullif(trim(hold->>'message'),'') is null
      or jsonb_typeof(hold->'details') <> 'object'
  ) then raise exception 'Condition hold payload is invalid.'; end if;

  select coalesce(array_agg(distinct (item->>'measurement_id')::uuid order by (item->>'measurement_id')::uuid),'{}'::uuid[])
    into v_new_measurement_ids
  from jsonb_array_elements(p_measurement_roles) item;
  if v_condition.compatibility_projection_version_id is not null then
    select coalesce(array_agg(distinct measurement_id order by measurement_id),'{}'::uuid[])
      into v_previous_measurement_ids
    from public.project_condition_measurement_roles
    where company_id = v_company
      and condition_version_id = v_condition.compatibility_projection_version_id;
  end if;
  select coalesce(array_agg(distinct measurement_id order by measurement_id),'{}'::uuid[])
    into v_all_measurement_ids
  from unnest(v_new_measurement_ids || v_previous_measurement_ids) measurement_id;

  if jsonb_array_length(p_legacy_measurement_updates) <> cardinality(v_all_measurement_ids)
     or jsonb_array_length(p_legacy_measurement_updates) <> (
       select count(distinct item->>'measurement_id') from jsonb_array_elements(p_legacy_measurement_updates) item
     ) then
    raise exception 'Legacy measurement update set does not match current and prior Condition roles.';
  end if;

  perform measurement.id
  from public.takeoff_measurements measurement
  where measurement.company_id = v_company
    and measurement.id = any(v_all_measurement_ids)
  order by measurement.id
  for update;
  if (select count(*) from public.takeoff_measurements measurement
      where measurement.company_id = v_company
        and measurement.id = any(v_all_measurement_ids)
        and measurement.takeoff_set_id = v_condition.takeoff_set_id
        and measurement.status = 'active') <> cardinality(v_all_measurement_ids) then
    raise exception 'Condition roles must reference active measurements from one takeoff set.';
  end if;

  if exists (
    select 1
    from public.project_condition_measurement_roles role
    join public.project_concrete_conditions other_condition
      on other_condition.company_id = role.company_id
     and other_condition.compatibility_projection_version_id = role.condition_version_id
    where role.company_id = v_company
      and role.measurement_id = any(v_new_measurement_ids)
      and other_condition.id <> v_condition.id
      and other_condition.status = 'active'
  ) then raise exception 'A measurement is already projected by another active Project Concrete Condition.'; end if;

  for v_update in select item from jsonb_array_elements(p_legacy_measurement_updates) item loop
    v_measurement_id := (v_update->>'measurement_id')::uuid;
    select * into v_measurement
    from public.takeoff_measurements
    where id = v_measurement_id and company_id = v_company;
    if not found
       or v_measurement.updated_at is distinct from (v_update->>'expected_updated_at')::timestamptz
       or jsonb_typeof(v_update->'outputs') <> 'array' then
      raise exception 'A Condition measurement changed while it was being calculated. Reload and try again.';
    end if;
    if v_measurement_id = p_compatibility_anchor_measurement_id then
      if v_update->>'mode' <> 'condition_projection'
         or v_measurement.assembly_version_id <> v_template.legacy_assembly_version_id then
        raise exception 'Compatibility anchor update is invalid.';
      end if;
    elsif v_measurement_id = any(v_new_measurement_ids) then
      if v_update->>'mode' <> 'suppressed' then raise exception 'Non-anchor Condition roles must suppress duplicate legacy estimate lines.'; end if;
    elsif v_measurement_id = any(v_previous_measurement_ids) then
      if v_update->>'mode' <> 'restored' then raise exception 'Detached Condition measurements must restore their legacy outputs.'; end if;
    else
      raise exception 'Legacy measurement update is not part of the Condition transition.';
    end if;
  end loop;

  select item into v_update
  from jsonb_array_elements(p_legacy_measurement_updates) item
  where (item->>'measurement_id')::uuid = p_compatibility_anchor_measurement_id;
  if jsonb_array_length(v_update->'outputs') <> (
       select count(*) from public.condition_legacy_output_mappings mapping
       where mapping.company_id = v_company and mapping.template_version_id = v_template.id
     )
     or jsonb_array_length(v_update->'outputs') <> (
       select count(distinct item->>'condition_output_key') from jsonb_array_elements(v_update->'outputs') item
     )
     or exists (
       select 1
       from jsonb_array_elements(v_update->'outputs') item
       where item->'formula_trace'->>'condition_version_id' <> p_condition_version_id::text
          or not exists (
            select 1 from public.condition_legacy_output_mappings mapping
            where mapping.company_id = v_company
              and mapping.template_version_id = v_template.id
              and mapping.output_key = item->>'condition_output_key'
              and mapping.legacy_assembly_component_id = (item->>'assembly_component_id')::uuid
          )
     ) then
    raise exception 'Condition compatibility output projection is incomplete or incorrectly mapped.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_condition_outputs) output
    left join lateral (
      select item
      from jsonb_array_elements(v_update->'outputs') item
      where item->>'condition_output_key' = output->>'output_key'
    ) legacy on true
    where legacy.item is null
       or (output->>'status' = 'ready' and (legacy.item->>'production_quantity')::numeric is distinct from (output->>'production_quantity')::numeric)
       or (output->>'status' in ('held','inactive') and coalesce((legacy.item->>'production_quantity')::numeric,0) <> 0)
       or (output->>'status' = 'held' and legacy.item->>'pricing_status' <> 'missing_input')
       or (output->>'status' = 'inactive' and coalesce((legacy.item->>'estimate_visible')::boolean,true))
  ) then raise exception 'Condition and compatibility output quantities do not reconcile.'; end if;

  perform set_config('carez.project_condition_commit','1',true);
  update public.project_concrete_condition_versions
  set plan_facts = p_plan_facts,
      method_inputs = p_method_inputs,
      production_inputs = p_production_inputs,
      commercial_inputs = p_commercial_inputs,
      drawing_inputs = p_drawing_inputs,
      input_provenance = p_input_provenance,
      output_overrides = p_output_overrides,
      compatibility_anchor_measurement_id = p_compatibility_anchor_measurement_id
  where id = v_version.id and company_id = v_company;

  delete from public.project_condition_holds
  where company_id = v_company and condition_version_id = v_version.id;
  delete from public.project_condition_outputs
  where company_id = v_company and condition_version_id = v_version.id;
  delete from public.project_condition_measurement_roles
  where company_id = v_company and condition_version_id = v_version.id;
  delete from public.project_condition_module_instances
  where company_id = v_company and condition_version_id = v_version.id;

  for v_module in select item from jsonb_array_elements(p_modules) item loop
    insert into public.project_condition_module_instances(
      company_id,condition_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,
      legacy_child_key,sort_order,created_by
    ) values (
      v_company,v_version.id,v_module->>'module_key',v_module->>'instance_key',trim(v_module->>'label'),
      (v_module->>'enabled')::boolean,v_module->'input_values',v_module->'input_provenance',
      nullif(v_module->>'legacy_child_key',''),coalesce((v_module->>'sort_order')::integer,0),auth.uid()
    );
  end loop;

  for v_role in select item from jsonb_array_elements(p_measurement_roles) item loop
    insert into public.project_condition_measurement_roles(
      company_id,condition_version_id,measurement_id,role_key,role_instance_key,is_primary,sort_order,created_by
    ) values (
      v_company,v_version.id,(v_role->>'measurement_id')::uuid,v_role->>'role_key',v_role->>'role_instance_key',
      (v_role->>'is_primary')::boolean,coalesce((v_role->>'sort_order')::integer,0),auth.uid()
    );
  end loop;

  for v_update in
    select item from jsonb_array_elements(p_legacy_measurement_updates) item
    order by case item->>'mode' when 'restored' then 1 when 'suppressed' then 2 else 3 end
  loop
    perform public.carez_sync_takeoff_measurement_outputs(
      (v_update->>'measurement_id')::uuid,
      v_update->'outputs'
    );
  end loop;

  for v_output in select item from jsonb_array_elements(p_condition_outputs) item loop
    select definition into v_output_definition
    from jsonb_array_elements(v_archetype.output_schema) definition
    where definition->>'key' = v_output->>'output_key';

    select id into v_module_id
    from public.project_condition_module_instances
    where company_id = v_company
      and condition_version_id = v_version.id
      and module_key = v_output->>'module_key'
      and instance_key = v_output->>'module_instance_key';

    v_driver_role_id := null;
    if nullif(v_output->>'driver_measurement_id','') is not null then
      select id into v_driver_role_id
      from public.project_condition_measurement_roles
      where company_id = v_company
        and condition_version_id = v_version.id
        and measurement_id = (v_output->>'driver_measurement_id')::uuid;
    end if;

    select legacy.* into v_legacy_output
    from public.condition_legacy_output_mappings mapping
    join public.takeoff_measurement_outputs legacy
      on legacy.company_id = mapping.company_id
     and legacy.measurement_id = p_compatibility_anchor_measurement_id
     and legacy.assembly_component_id = mapping.legacy_assembly_component_id
    where mapping.company_id = v_company
      and mapping.template_version_id = v_template.id
      and mapping.output_key = v_output->>'output_key';
    if not found then raise exception 'Mapped compatibility output was not committed.'; end if;

    insert into public.project_condition_outputs(
      company_id,condition_version_id,module_instance_id,driver_measurement_role_id,
      output_key,output_instance_key,label,resource_class,production_quantity,production_unit,
      quantity_mode,status,estimated_man_hours,unit_cost,direct_cost,pricing_status,
      provenance,calculation_trace,legacy_takeoff_output_id,generated_estimate_item_id
    ) values (
      v_company,v_version.id,v_module_id,v_driver_role_id,
      v_output->>'output_key',v_output->>'output_instance_key',v_output_definition->>'label',
      v_output_definition->>'resource_class',
      case when v_output->>'status' = 'held' then null else (v_output->>'production_quantity')::numeric end,
      v_output_definition->>'unit',v_output->>'quantity_mode',v_output->>'status',
      v_legacy_output.estimated_man_hours,v_legacy_output.unit_cost,v_legacy_output.direct_cost,
      v_legacy_output.pricing_status,v_output->'provenance',v_output->'calculation_trace',
      v_legacy_output.id,v_legacy_output.generated_estimate_item_id
    ) returning id into v_condition_output_id;

    for v_hold in select item from jsonb_array_elements(v_output->'holds') item loop
      insert into public.project_condition_holds(
        company_id,condition_version_id,output_id,hold_code,status,message,details
      ) values (
        v_company,v_version.id,v_condition_output_id,v_hold->>'hold_code','open',trim(v_hold->>'message'),v_hold->'details'
      );
    end loop;
  end loop;

  update public.project_concrete_conditions
  set compatibility_projection_version_id = v_version.id
  where id = v_condition.id and company_id = v_company;

  select count(*) into v_output_count
  from public.project_condition_outputs
  where company_id = v_company and condition_version_id = v_version.id;
  select count(*) into v_hold_count
  from public.project_condition_holds
  where company_id = v_company and condition_version_id = v_version.id and status = 'open';
  select count(*) into v_estimate_item_count
  from public.project_condition_outputs output
  where output.company_id = v_company
    and output.condition_version_id = v_version.id
    and output.generated_estimate_item_id is not null;
  select count(*) into v_orphan_count
  from public.takeoff_measurement_outputs legacy
  where legacy.company_id = v_company
    and legacy.measurement_id = p_compatibility_anchor_measurement_id
    and legacy.estimate_visible
    and not exists (
      select 1 from public.project_condition_outputs output
      where output.company_id = v_company
        and output.condition_version_id = v_version.id
        and output.legacy_takeoff_output_id = legacy.id
    );

  select coalesce(jsonb_object_agg(status,total),'{}'::jsonb) into v_reconciliation
  from (
    select reconciliation_status as status,count(*) as total
    from public.condition_legacy_reconciliation
    where company_id = v_company and condition_version_id = v_version.id
    group by reconciliation_status
  ) counts;

  return jsonb_build_object(
    'condition_version_id',v_version.id,
    'takeoff_set_id',v_condition.takeoff_set_id,
    'compatibility_anchor_measurement_id',p_compatibility_anchor_measurement_id,
    'output_count',v_output_count,
    'open_hold_count',v_hold_count,
    'estimate_item_count',v_estimate_item_count,
    'orphan_legacy_output_count',v_orphan_count,
    'reconciliation',v_reconciliation
  );
end;
$$;

revoke all on function public.carez_commit_project_condition_calculation(
  uuid,timestamptz,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb
) from public,anon;
grant execute on function public.carez_commit_project_condition_calculation(
  uuid,timestamptz,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb
) to authenticated,service_role;

create or replace view public.condition_legacy_reconciliation
with (security_invoker = true)
as
select
  output.company_id,
  output.condition_version_id,
  output.id as condition_output_id,
  output.output_key,
  output.output_instance_key,
  output.status as condition_status,
  output.production_quantity as condition_quantity,
  output.production_unit as condition_unit,
  output.direct_cost as condition_direct_cost,
  output.legacy_takeoff_output_id,
  legacy.production_quantity as legacy_quantity,
  legacy.production_unit as legacy_unit,
  legacy.direct_cost as legacy_direct_cost,
  output.generated_estimate_item_id,
  legacy.generated_estimate_item_id as legacy_estimate_item_id,
  case
    when condition.compatibility_projection_version_id is distinct from output.condition_version_id then 'superseded'
    when output.legacy_takeoff_output_id is null or legacy.id is null then 'unmapped'
    when legacy.formula_trace->>'condition_version_id' is distinct from output.condition_version_id::text then 'lineage_mismatch'
    when upper(output.production_unit) <> upper(legacy.production_unit) then 'unit_mismatch'
    when output.status = 'held'
      and legacy.pricing_status = 'missing_input'
      and legacy.production_quantity = 0
      and output.generated_estimate_item_id is not distinct from legacy.generated_estimate_item_id then 'held'
    when output.status = 'inactive'
      and legacy.production_quantity = 0
      and not legacy.estimate_visible
      and legacy.generated_estimate_item_id is null
      and estimate.id is null then 'inactive'
    when output.status = 'ready'
      and output.production_quantity is not distinct from legacy.production_quantity
      and output.direct_cost is not distinct from legacy.direct_cost
      and output.generated_estimate_item_id is not distinct from legacy.generated_estimate_item_id
      and (
        estimate.id is null
        or (
          estimate.source_takeoff_output_id = legacy.id
          and estimate.source_takeoff_measurement_id = version.compatibility_anchor_measurement_id
          and estimate.production_quantity is not distinct from legacy.production_quantity
          and upper(estimate.production_unit) = upper(legacy.production_unit)
          and estimate.direct_cost is not distinct from legacy.direct_cost
        )
      ) then 'exact'
    else 'mismatch'
  end as reconciliation_status,
  condition.compatibility_projection_version_id = output.condition_version_id as is_current_projection,
  version.compatibility_anchor_measurement_id,
  legacy.pricing_status as legacy_pricing_status,
  legacy.is_active as legacy_is_active,
  legacy.estimate_visible as legacy_estimate_visible,
  estimate.id as estimate_item_id
from public.project_condition_outputs output
join public.project_concrete_condition_versions version
  on version.company_id = output.company_id and version.id = output.condition_version_id
join public.project_concrete_conditions condition
  on condition.company_id = version.company_id and condition.id = version.condition_id
left join public.takeoff_measurement_outputs legacy
  on legacy.id = output.legacy_takeoff_output_id and legacy.company_id = output.company_id
left join public.estimate_items estimate
  on estimate.id = output.generated_estimate_item_id and estimate.company_id = output.company_id;

create or replace view public.condition_legacy_reconciliation_summary
with (security_invoker = true)
as
select
  company_id,
  condition_version_id,
  bool_or(is_current_projection) as is_current_projection,
  count(*) as output_count,
  count(*) filter (where reconciliation_status = 'exact') as exact_count,
  count(*) filter (where reconciliation_status = 'held') as held_count,
  count(*) filter (where reconciliation_status = 'inactive') as inactive_count,
  count(*) filter (where reconciliation_status not in ('exact','held','inactive','superseded')) as mismatch_count,
  count(*) filter (where reconciliation_status = 'superseded') as superseded_count
from public.condition_legacy_reconciliation
group by company_id,condition_version_id;

revoke all on public.condition_legacy_reconciliation,public.condition_legacy_reconciliation_summary from public,anon;
grant select on public.condition_legacy_reconciliation,public.condition_legacy_reconciliation_summary to authenticated,service_role;

create or replace function public.carez_verify_project_condition_version(
  p_condition_version_id uuid,
  p_verification_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.project_concrete_condition_versions%rowtype;
  v_condition public.project_concrete_conditions%rowtype;
  v_output_count integer;
  v_expected_output_count integer;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;

  select * into v_version
  from public.project_concrete_condition_versions
  where id = p_condition_version_id and company_id = v_company
  for update;
  if not found or v_version.status <> 'draft' then raise exception 'Draft Project Condition version not found.'; end if;

  select * into v_condition
  from public.project_concrete_conditions
  where id = v_version.condition_id and company_id = v_company
  for update;
  if not found or v_condition.compatibility_projection_version_id is distinct from v_version.id then
    raise exception 'Calculate and reconcile this Project Condition revision before verification.';
  end if;

  if exists (
    select 1
    from public.platform_condition_archetype_versions archetype_version,
         lateral jsonb_array_elements(archetype_version.role_schema) role
    where archetype_version.id = v_version.archetype_version_id
      and coalesce((role->>'required')::boolean,false)
      and not exists (
        select 1
        from public.project_condition_measurement_roles assigned
        where assigned.company_id = v_company
          and assigned.condition_version_id = v_version.id
          and assigned.role_key = role->>'key'
      )
  ) then raise exception 'Assign every required measurement role before verifying the Project Condition.'; end if;

  select jsonb_array_length(output_schema) into v_expected_output_count
  from public.platform_condition_archetype_versions
  where id = v_version.archetype_version_id;
  select count(*) into v_output_count
  from public.project_condition_outputs
  where company_id = v_company and condition_version_id = v_version.id;
  if v_output_count <> v_expected_output_count then
    raise exception 'Calculate and persist every Condition output before verification.';
  end if;

  if exists (
    select 1
    from public.project_condition_outputs output
    where output.company_id = v_company
      and output.condition_version_id = v_version.id
      and output.status = 'held'
      and not exists (
        select 1 from public.project_condition_holds hold
        where hold.company_id = v_company
          and hold.condition_version_id = v_version.id
          and hold.output_id = output.id
          and hold.status = 'open'
      )
  ) then raise exception 'Every held Condition output requires an explicit open hold.'; end if;

  if exists (
    select 1 from public.condition_legacy_reconciliation reconciliation
    where reconciliation.company_id = v_company
      and reconciliation.condition_version_id = v_version.id
      and reconciliation.reconciliation_status not in ('exact','held','inactive')
  ) then raise exception 'Project Condition compatibility projection must reconcile before verification.'; end if;

  perform set_config('carez.project_condition_verify','1',true);
  update public.project_concrete_condition_versions
  set status = 'verified',verification_notes = nullif(trim(coalesce(p_verification_notes,'')),''),
      verified_by = auth.uid(),verified_at = now()
  where id = v_version.id and company_id = v_company;
end;
$$;

revoke all on function public.carez_verify_project_condition_version(uuid,text) from public,anon;
grant execute on function public.carez_verify_project_condition_version(uuid,text) to authenticated,service_role;

comment on function public.carez_commit_project_condition_calculation(
  uuid,timestamptz,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb
) is 'Atomically persists one server-calculated Concrete Condition revision, its measurement roles/modules/holds, the legacy Takeoff compatibility projection, and estimate-item lineage.';
