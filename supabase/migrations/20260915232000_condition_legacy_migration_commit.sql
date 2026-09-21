-- Carez P0.5E Task 4: idempotent compatibility rebind for supported legacy -> Condition migration.
--
-- Quantity authority remains the persisted takeoff measurement. This RPC only
-- rebinds compatibility identity and records the transition in the migration
-- ledger. Condition quantities are calculated later by the existing
-- server-authoritative Condition persistence path.

create unique index if not exists condition_legacy_migration_apply_dry_run_uk
  on public.condition_legacy_migration_runs (
    company_id,
    ((source_snapshot->>'dry_run_id'))
  )
  where mode = 'apply'
    and source_snapshot ? 'dry_run_id';

create or replace function public.carez_commit_legacy_condition_migration(
  p_run_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_run public.condition_legacy_migration_runs%rowtype;
  v_item public.condition_legacy_migration_items%rowtype;
  v_source_run public.condition_legacy_migration_runs%rowtype;
  v_source_item public.condition_legacy_migration_items%rowtype;
  v_takeoff_set public.takeoff_sets%rowtype;
  v_estimate public.estimates%rowtype;
  v_measurement public.takeoff_measurements%rowtype;
  v_after public.takeoff_measurements%rowtype;
  v_target_template public.company_condition_template_versions%rowtype;
  v_source_run_id uuid;
  v_source_measurement_id uuid;
  v_source_assembly_version_id uuid;
  v_target_template_version_id uuid;
  v_target_assembly_version_id uuid;
  v_expected_updated_at timestamptz;
  v_expected_raw_quantity numeric;
  v_expected_raw_unit text;
  v_old_method_profile_id uuid;
  v_applied jsonb;
begin
  if v_company is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;

  select * into v_run
  from public.condition_legacy_migration_runs
  where id = p_run_id
    and company_id = v_company
  for update;
  if not found then raise exception 'Legacy migration apply run not found.'; end if;
  if v_run.mode <> 'apply' then raise exception 'Legacy migration commit requires an apply run.'; end if;
  if v_run.status not in ('running','completed') then
    raise exception 'Legacy migration apply run is not executable.';
  end if;

  select * into v_item
  from public.condition_legacy_migration_items
  where id = p_item_id
    and company_id = v_company
    and run_id = v_run.id
  for update;
  if not found
     or v_item.object_type <> 'measurement'
     or v_item.classification <> 'mapped' then
    raise exception 'Mapped legacy measurement migration item not found.';
  end if;

  v_source_run_id := nullif(v_run.source_snapshot->>'dry_run_id','')::uuid;
  if v_source_run_id is null then raise exception 'Apply run is missing its dry-run lineage.'; end if;

  select * into v_source_run
  from public.condition_legacy_migration_runs
  where id = v_source_run_id
    and company_id = v_company
    and takeoff_set_id = v_run.takeoff_set_id;
  if not found or v_source_run.mode <> 'dry_run' or v_source_run.status <> 'completed' then
    raise exception 'Completed source dry run not found.';
  end if;

  select * into v_source_item
  from public.condition_legacy_migration_items
  where company_id = v_company
    and run_id = v_source_run.id
    and object_type = 'measurement'
    and legacy_id = v_item.legacy_id
    and classification = 'mapped';
  if not found
     or v_source_item.details->'migration_preparation'->>'status' <> 'ready' then
    raise exception 'Source dry-run measurement is not migration-ready.';
  end if;

  v_source_measurement_id := nullif(v_source_item.details->>'source_measurement_id','')::uuid;
  v_source_assembly_version_id := nullif(v_source_item.details->>'source_assembly_version_id','')::uuid;
  v_target_template_version_id := nullif(v_source_item.details->>'target_template_version_id','')::uuid;
  v_target_assembly_version_id := nullif(v_source_item.details->>'target_compatibility_assembly_version_id','')::uuid;
  v_expected_updated_at := nullif(v_source_item.details->>'updated_at','')::timestamptz;
  v_expected_raw_quantity := nullif(v_source_item.details->>'raw_quantity','')::numeric;
  v_expected_raw_unit := nullif(v_source_item.details->>'raw_unit','');

  if v_source_measurement_id is distinct from v_item.legacy_id
     or v_source_assembly_version_id is null
     or v_target_template_version_id is null
     or v_target_assembly_version_id is null
     or v_expected_updated_at is null
     or v_expected_raw_quantity is null
     or nullif(trim(coalesce(v_expected_raw_unit,'')),'') is null then
    raise exception 'Source dry-run snapshot is incomplete.';
  end if;

  select * into v_target_template
  from public.company_condition_template_versions
  where id = v_target_template_version_id
    and company_id = v_company
    and status = 'published';
  if not found
     or v_target_template.legacy_assembly_version_id is distinct from v_target_assembly_version_id then
    raise exception 'Published target Condition compatibility template changed after dry run.';
  end if;

  select * into v_takeoff_set
  from public.takeoff_sets
  where id = v_run.takeoff_set_id
    and company_id = v_company
    and status = 'active'
  for update;
  if not found then raise exception 'Active takeoff set not found.'; end if;

  select * into v_estimate
  from public.estimates estimate
  where estimate.id = v_takeoff_set.estimate_id
    and estimate.company_id = v_company
  for update;
  if not found or v_estimate.status <> 'draft' then
    raise exception 'Legacy migration requires an editable draft estimate.';
  end if;
  if exists (
    select 1
    from public.proposal_presentations
    where company_id = v_company
      and estimate_id = v_estimate.id
  ) then
    raise exception 'Legacy migration is blocked after a proposal has been created.';
  end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id = v_item.legacy_id
    and company_id = v_company
    and takeoff_set_id = v_takeoff_set.id
    and status = 'active'
  for update;
  if not found then raise exception 'Active legacy measurement not found.'; end if;

  v_applied := coalesce(v_item.details->'compatibility_rebind','{}'::jsonb);
  if v_applied->>'status' = 'applied' then
    if v_measurement.assembly_version_id is distinct from v_target_assembly_version_id then
      raise exception 'Previously applied compatibility rebind no longer matches the target assembly.';
    end if;
    return jsonb_build_object(
      'run_id',v_run.id,
      'item_id',v_item.id,
      'measurement_id',v_measurement.id,
      'old_assembly_version_id',v_source_assembly_version_id,
      'new_assembly_version_id',v_target_assembly_version_id,
      'rebound',false,
      'idempotent',true
    );
  end if;

  if v_run.status <> 'running' then
    raise exception 'Completed apply run cannot perform a new compatibility rebind.';
  end if;

  if v_measurement.updated_at is distinct from v_expected_updated_at
     or v_measurement.assembly_version_id is distinct from v_source_assembly_version_id
     or v_measurement.raw_quantity is distinct from v_expected_raw_quantity
     or upper(v_measurement.raw_unit) is distinct from upper(v_expected_raw_unit) then
    raise exception 'Legacy measurement changed after the dry run. Run migration inventory again.';
  end if;

  v_old_method_profile_id := v_measurement.method_profile_id;

  update public.takeoff_measurements
  set assembly_version_id = v_target_assembly_version_id,
      method_profile_id = null,
      updated_at = now()
  where id = v_measurement.id
    and company_id = v_company;

  select * into v_after
  from public.takeoff_measurements
  where id = v_measurement.id
    and company_id = v_company;

  if not found
     or v_after.id is distinct from v_measurement.id
     or v_after.geometry is distinct from v_measurement.geometry
     or v_after.raw_quantity is distinct from v_measurement.raw_quantity
     or v_after.raw_unit is distinct from v_measurement.raw_unit
     or v_after.sheet_id is distinct from v_measurement.sheet_id
     or v_after.scale_region_id is distinct from v_measurement.scale_region_id then
    raise exception 'Compatibility rebind changed authoritative measurement geometry or quantity.';
  end if;

  v_applied := jsonb_build_object(
    'status','applied',
    'measurement_id',v_measurement.id,
    'old_assembly_version_id',v_source_assembly_version_id,
    'new_assembly_version_id',v_target_assembly_version_id,
    'old_method_profile_id',v_old_method_profile_id,
    'new_method_profile_id',null,
    'applied_at',now()
  );

  update public.condition_legacy_migration_items
  set details = details || jsonb_build_object('compatibility_rebind',v_applied),
      result_status = 'pending',
      error_text = null,
      updated_at = now()
  where id = v_item.id
    and company_id = v_company;

  return jsonb_build_object(
    'run_id',v_run.id,
    'item_id',v_item.id,
    'measurement_id',v_measurement.id,
    'old_assembly_version_id',v_source_assembly_version_id,
    'new_assembly_version_id',v_target_assembly_version_id,
    'rebound',v_source_assembly_version_id is distinct from v_target_assembly_version_id,
    'idempotent',false
  );
end;
$$;

revoke all on function public.carez_commit_legacy_condition_migration(uuid,uuid)
  from public,anon;
grant execute on function public.carez_commit_legacy_condition_migration(uuid,uuid)
  to authenticated,service_role;

comment on function public.carez_commit_legacy_condition_migration(uuid,uuid) is
  'P0.5E Task 4: idempotently rebinds one dry-run-approved legacy measurement to its published Condition compatibility assembly without changing authoritative geometry or quantity.';
