-- Geometry edits currently commit raw quantity plus legacy assembly outputs only.
-- Condition tables require the guarded commit setting, so application-only
-- follow-up calls cannot guarantee stale-output invalidation if they fail.
-- Invalidate inside the existing measurement RPC; preserve its API and RLS.

create or replace function public.carez_update_drawing_measurement(
  p_measurement_id uuid,
  p_geometry jsonb,
  p_raw_quantity numeric,
  p_raw_unit text,
  p_variables jsonb,
  p_outputs jsonb,
  p_scale_region_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_measurement public.takeoff_measurements%rowtype;
  v_status text;
  v_scale_region public.takeoff_scale_regions%rowtype;
  v_scale_region_id uuid;
  v_version_ids uuid[] := '{}'::uuid[];
  v_legacy_output_ids uuid[] := '{}'::uuid[];
  v_item_ids uuid[] := '{}'::uuid[];
  v_commit_setting text := coalesce(current_setting('carez.project_condition_commit',true),'');
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if v_measurement.source<>'drawing' or v_measurement.sheet_id is null then raise exception 'Only drawing takeoff geometry can be edited here.'; end if;
  select status into v_status from public.estimates where id=v_measurement.estimate_id and company_id=v_company for update;
  if v_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company and p.estimate_id=v_measurement.estimate_id) then raise exception 'This estimate revision is locked.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;

  v_scale_region_id:=coalesce(p_scale_region_id,v_measurement.scale_region_id);
  if p_raw_unit<>'EA' then
    if v_scale_region_id is null then select id into v_scale_region_id from public.takeoff_scale_regions where company_id=v_company and sheet_id=v_measurement.sheet_id and is_default limit 1; end if;
    select * into v_scale_region from public.takeoff_scale_regions where id=v_scale_region_id and company_id=v_company and sheet_id=v_measurement.sheet_id;
    if v_scale_region.id is null then raise exception 'An accepted scale region is required for LF or SF takeoff.'; end if;
    if not public.carez_geometry_within_scale_bounds(p_geometry,v_scale_region.region_bounds) then raise exception 'Takeoff geometry must stay inside one accepted scale region.'; end if;
  else
    v_scale_region_id:=null;
  end if;

  -- Serialize with Condition calculation/verification before deciding whether
  -- these references are mutable. All shared primary, secondary and anchor links
  -- participate; geometry and role assignments are never deleted here.
  perform version.id
  from public.project_concrete_condition_versions version
  where version.company_id = v_company
    and (version.compatibility_anchor_measurement_id = v_measurement.id or exists (
      select 1 from public.project_condition_measurement_roles role
      where role.company_id = v_company and role.condition_version_id = version.id
        and role.measurement_id = v_measurement.id
    ))
  order by version.id
  for update;

  select coalesce(array_agg(version.id), '{}'::uuid[]) into v_version_ids
  from public.project_concrete_condition_versions version
  where version.company_id = v_company
    and (version.compatibility_anchor_measurement_id = v_measurement.id or exists (
      select 1 from public.project_condition_measurement_roles role
      where role.company_id = v_company and role.condition_version_id = version.id
        and role.measurement_id = v_measurement.id
    ));

  if exists (
    select 1 from public.project_concrete_condition_versions version
    where version.company_id = v_company and version.id = any(v_version_ids)
      and version.status = 'verified'
  ) then
    raise exception 'This takeoff belongs to a verified Concrete Condition and cannot be edited from this revision.';
  end if;

  if cardinality(v_version_ids) > 0 then
    -- Same guarded invalidation boundary used by draft Condition deletion.
    -- Clear both the Condition outputs and their compatibility/estimate rows,
    -- including a different anchor when the edited geometry is a secondary role.
    perform set_config('carez.project_condition_commit','1',true);
    select coalesce(array_agg(legacy.id), '{}'::uuid[]) into v_legacy_output_ids
    from public.takeoff_measurement_outputs legacy
    where legacy.company_id = v_company and (
      legacy.measurement_id = v_measurement.id
      or legacy.formula_trace->>'condition_version_id' = any(v_version_ids::text[])
      or exists (
        select 1 from public.project_condition_outputs output
        where output.company_id = v_company and output.condition_version_id = any(v_version_ids)
          and output.legacy_takeoff_output_id = legacy.id
      )
    );

    select coalesce(array_agg(distinct linked.id), '{}'::uuid[]) into v_item_ids
    from (
      select output.generated_estimate_item_id as id
      from public.project_condition_outputs output
      where output.company_id = v_company and output.condition_version_id = any(v_version_ids)
      union
      select legacy.generated_estimate_item_id
      from public.takeoff_measurement_outputs legacy
      where legacy.company_id = v_company and legacy.id = any(v_legacy_output_ids)
      union
      select item.id from public.estimate_items item
      where item.company_id = v_company and item.source_takeoff_output_id = any(v_legacy_output_ids)
    ) linked where linked.id is not null;

    delete from public.project_condition_holds hold
    where hold.company_id = v_company and hold.condition_version_id = any(v_version_ids);
    delete from public.project_condition_outputs output
    where output.company_id = v_company and output.condition_version_id = any(v_version_ids);
    delete from public.takeoff_measurement_outputs legacy
    where legacy.company_id = v_company and legacy.id = any(v_legacy_output_ids);
    delete from public.estimate_items item
    where item.company_id = v_company and item.id = any(v_item_ids);

    update public.project_concrete_conditions condition
    set compatibility_projection_version_id = null, updated_at = now()
    where condition.company_id = v_company
      and condition.compatibility_projection_version_id = any(v_version_ids);
    -- Reject calculations prepared against the state before this edit.
    update public.project_concrete_condition_versions version
    set updated_at = now()
    where version.company_id = v_company and version.id = any(v_version_ids)
      and version.status = 'draft';
    perform set_config('carez.project_condition_commit',v_commit_setting,true);
  end if;

  update public.takeoff_measurements
    set raw_quantity=p_raw_quantity,raw_unit=p_raw_unit,variables=coalesce(p_variables,'{}'::jsonb),geometry=p_geometry,
        scale_region_id=v_scale_region_id,updated_at=now()
    where id=v_measurement.id and company_id=v_company;
  -- A Condition-linked measurement must never fall back to assembly quantities.
  -- The server may now recalculate its former projection using persisted inputs;
  -- if that fails, absence of outputs remains the safe authoritative state.
  if cardinality(v_version_ids) = 0 then
    perform public.carez_sync_takeoff_measurement_outputs(v_measurement.id,p_outputs);
  end if;
  return v_measurement.id;
end;
$$;
revoke all on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb,uuid) to authenticated,service_role;
