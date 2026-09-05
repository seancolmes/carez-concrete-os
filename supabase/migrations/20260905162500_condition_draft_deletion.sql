-- Issue #55 QA reset support: allow authorized users to remove draft Project
-- Concrete Conditions and Condition-linked takeoffs from editable estimate revisions.
-- Verified Conditions and issued/accepted estimate history remain immutable.

create or replace function public.carez_delete_takeoff_measurement(p_measurement_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid := public.get_my_company_id();
  v_estimate_id uuid;
  v_takeoff_set_id uuid;
  v_estimate_status text;
  v_linked_version_ids uuid[] := '{}'::uuid[];
  v_generated_item_ids uuid[] := '{}'::uuid[];
begin
  if v_company_id is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;

  select measurement.estimate_id, measurement.takeoff_set_id
    into v_estimate_id, v_takeoff_set_id
  from public.takeoff_measurements measurement
  where measurement.id = p_measurement_id
    and measurement.company_id = v_company_id;
  if v_estimate_id is null then raise exception 'Takeoff measurement not found.'; end if;

  select estimate.status into v_estimate_status
  from public.estimates estimate
  where estimate.id = v_estimate_id and estimate.company_id = v_company_id;
  if v_estimate_status in ('accepted','approved','superseded') then
    raise exception 'This estimate revision is locked.';
  end if;
  if exists (
    select 1 from public.proposal_presentations presentation
    where presentation.company_id = v_company_id and presentation.estimate_id = v_estimate_id
  ) then
    raise exception 'This estimate revision was already issued. Create the next revision before changing takeoff.';
  end if;

  select coalesce(array_agg(version.id), '{}'::uuid[])
    into v_linked_version_ids
  from public.project_concrete_condition_versions version
  where version.company_id = v_company_id
    and (
      version.compatibility_anchor_measurement_id = p_measurement_id
      or exists (
        select 1
        from public.project_condition_measurement_roles role
        where role.company_id = v_company_id
          and role.condition_version_id = version.id
          and role.measurement_id = p_measurement_id
      )
    );

  if exists (
    select 1
    from public.project_concrete_condition_versions version
    where version.company_id = v_company_id
      and version.id = any(v_linked_version_ids)
      and version.status = 'verified'
  ) then
    raise exception 'This takeoff belongs to a verified Concrete Condition and cannot be deleted from this revision.';
  end if;

  if cardinality(v_linked_version_ids) > 0 then
    perform set_config('carez.project_condition_commit','1',true);

    select coalesce(array_agg(distinct output.generated_estimate_item_id)
      filter (where output.generated_estimate_item_id is not null), '{}'::uuid[])
      into v_generated_item_ids
    from public.project_condition_outputs output
    where output.company_id = v_company_id
      and output.condition_version_id = any(v_linked_version_ids);

    -- A linked role changed, so all calculated projections for those draft
    -- versions are invalid until the estimator explicitly saves/recalculates.
    delete from public.project_condition_holds hold
    where hold.company_id = v_company_id
      and hold.condition_version_id = any(v_linked_version_ids);

    delete from public.project_condition_outputs output
    where output.company_id = v_company_id
      and output.condition_version_id = any(v_linked_version_ids);

    if cardinality(v_generated_item_ids) > 0 then
      delete from public.estimate_items item
      where item.company_id = v_company_id
        and item.id = any(v_generated_item_ids);
    end if;

    delete from public.project_condition_measurement_roles role
    where role.company_id = v_company_id
      and role.condition_version_id = any(v_linked_version_ids)
      and role.measurement_id = p_measurement_id;

    update public.project_concrete_condition_versions version
    set compatibility_anchor_measurement_id = case
          when version.compatibility_anchor_measurement_id = p_measurement_id then null
          else version.compatibility_anchor_measurement_id
        end,
        updated_at = now()
    where version.company_id = v_company_id
      and version.id = any(v_linked_version_ids);

    update public.project_concrete_conditions condition
    set compatibility_projection_version_id = null,
        updated_at = now()
    where condition.company_id = v_company_id
      and condition.compatibility_projection_version_id = any(v_linked_version_ids);
  end if;

  delete from public.estimate_items item
  where item.company_id = v_company_id
    and item.source_takeoff_measurement_id = p_measurement_id;

  delete from public.takeoff_measurements measurement
  where measurement.id = p_measurement_id
    and measurement.company_id = v_company_id;
end;
$$;

revoke all on function public.carez_delete_takeoff_measurement(uuid) from public,anon;
grant execute on function public.carez_delete_takeoff_measurement(uuid) to authenticated,service_role;

create or replace function public.carez_delete_project_concrete_condition(
  p_condition_id uuid,
  p_delete_linked_measurements boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid := public.get_my_company_id();
  v_takeoff_set_id uuid;
  v_estimate_id uuid;
  v_estimate_status text;
  v_version_ids uuid[] := '{}'::uuid[];
  v_measurement_ids uuid[] := '{}'::uuid[];
  v_version_id uuid;
  v_measurement_id uuid;
  v_deleted_measurements integer := 0;
  v_preserved_measurements integer := 0;
begin
  if v_company_id is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;

  select condition.takeoff_set_id, takeoff_set.estimate_id
    into v_takeoff_set_id, v_estimate_id
  from public.project_concrete_conditions condition
  join public.takeoff_sets takeoff_set
    on takeoff_set.company_id = condition.company_id
   and takeoff_set.id = condition.takeoff_set_id
  where condition.company_id = v_company_id
    and condition.id = p_condition_id
  for update of condition, takeoff_set;

  if v_takeoff_set_id is null then raise exception 'Project Concrete Condition not found.'; end if;
  if not exists (
    select 1 from public.takeoff_sets takeoff_set
    where takeoff_set.company_id = v_company_id
      and takeoff_set.id = v_takeoff_set_id
      and takeoff_set.status = 'active'
  ) then raise exception 'Active takeoff set not found.'; end if;

  select estimate.status into v_estimate_status
  from public.estimates estimate
  where estimate.company_id = v_company_id and estimate.id = v_estimate_id;
  if v_estimate_status in ('accepted','approved','superseded') then
    raise exception 'This estimate revision is locked.';
  end if;
  if exists (
    select 1 from public.proposal_presentations presentation
    where presentation.company_id = v_company_id and presentation.estimate_id = v_estimate_id
  ) then
    raise exception 'This estimate revision was already issued. Create the next revision before changing takeoff.';
  end if;

  select coalesce(array_agg(version.id), '{}'::uuid[])
    into v_version_ids
  from public.project_concrete_condition_versions version
  where version.company_id = v_company_id and version.condition_id = p_condition_id;

  if exists (
    select 1 from public.project_concrete_condition_versions version
    where version.company_id = v_company_id
      and version.condition_id = p_condition_id
      and version.status = 'verified'
  ) then
    raise exception 'Verified Concrete Conditions are immutable and cannot be deleted. Create a new estimate revision or retire the Condition instead.';
  end if;

  if exists (
    select 1
    from public.project_concrete_condition_versions version
    where version.company_id = v_company_id
      and version.condition_id <> p_condition_id
      and version.source_version_id = any(v_version_ids)
  ) then
    raise exception 'This Condition is referenced by another Condition revision and cannot be deleted.';
  end if;

  select coalesce(array_agg(distinct linked.measurement_id), '{}'::uuid[])
    into v_measurement_ids
  from (
    select role.measurement_id
    from public.project_condition_measurement_roles role
    where role.company_id = v_company_id
      and role.condition_version_id = any(v_version_ids)
    union
    select version.compatibility_anchor_measurement_id
    from public.project_concrete_condition_versions version
    where version.company_id = v_company_id
      and version.id = any(v_version_ids)
      and version.compatibility_anchor_measurement_id is not null
  ) linked;

  perform set_config('carez.project_condition_commit','1',true);

  -- Delete calculated Condition records first so their RESTRICT links to
  -- measurement roles/modules/legacy outputs are released.
  delete from public.project_condition_holds hold
  where hold.company_id = v_company_id
    and hold.condition_version_id = any(v_version_ids);

  delete from public.project_condition_outputs output
  where output.company_id = v_company_id
    and output.condition_version_id = any(v_version_ids);

  delete from public.project_condition_measurement_roles role
  where role.company_id = v_company_id
    and role.condition_version_id = any(v_version_ids);

  delete from public.project_condition_module_instances module
  where module.company_id = v_company_id
    and module.condition_version_id = any(v_version_ids);

  update public.project_concrete_conditions condition
  set compatibility_projection_version_id = null,
      updated_at = now()
  where condition.company_id = v_company_id and condition.id = p_condition_id;

  -- source_version_id is RESTRICT, so newest draft revisions are removed first.
  for v_version_id in
    select version.id
    from public.project_concrete_condition_versions version
    where version.company_id = v_company_id and version.condition_id = p_condition_id
    order by version.revision_no desc
  loop
    delete from public.project_concrete_condition_versions version
    where version.company_id = v_company_id and version.id = v_version_id;
  end loop;

  delete from public.project_concrete_conditions condition
  where condition.company_id = v_company_id and condition.id = p_condition_id;

  if p_delete_linked_measurements then
    foreach v_measurement_id in array v_measurement_ids loop
      -- Never delete geometry still used by another Condition. This also
      -- protects intentionally shared secondary roles.
      if exists (
        select 1 from public.project_condition_measurement_roles role
        where role.company_id = v_company_id and role.measurement_id = v_measurement_id
      ) or exists (
        select 1 from public.project_concrete_condition_versions version
        where version.company_id = v_company_id
          and version.compatibility_anchor_measurement_id = v_measurement_id
      ) then
        v_preserved_measurements := v_preserved_measurements + 1;
      elsif exists (
        select 1 from public.takeoff_measurements measurement
        where measurement.company_id = v_company_id and measurement.id = v_measurement_id
      ) then
        perform public.carez_delete_takeoff_measurement(v_measurement_id);
        v_deleted_measurements := v_deleted_measurements + 1;
      end if;
    end loop;
  else
    v_preserved_measurements := cardinality(v_measurement_ids);
  end if;

  return jsonb_build_object(
    'condition_id', p_condition_id,
    'takeoff_set_id', v_takeoff_set_id,
    'deleted_measurements', v_deleted_measurements,
    'preserved_measurements', v_preserved_measurements
  );
end;
$$;

revoke all on function public.carez_delete_project_concrete_condition(uuid,boolean) from public,anon;
grant execute on function public.carez_delete_project_concrete_condition(uuid,boolean) to authenticated,service_role;

comment on function public.carez_delete_project_concrete_condition(uuid,boolean) is
  'Deletes only draft Project Concrete Conditions from editable estimate revisions. Optionally removes linked takeoffs that are not shared by another Condition; verified/issued history remains immutable.';
