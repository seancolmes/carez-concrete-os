-- Carez Takeoff drawing workspace.
-- PDF geometry stays attached to the same deterministic takeoff measurement used by Estimate/Work Package lineage.

create or replace function public.carez_commit_drawing_measurement(
  p_takeoff_set_id uuid,
  p_sheet_id uuid,
  p_estimate_section_id uuid,
  p_assembly_version_id uuid,
  p_name text,
  p_location text,
  p_drawing_reference text,
  p_measurement_type text,
  p_raw_quantity numeric,
  p_raw_unit text,
  p_variables jsonb,
  p_risk_class_code text,
  p_geometry jsonb,
  p_outputs jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_measurement_id uuid;
begin
  v_company_id := public.get_my_company_id();
  if v_company_id is null or not exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role <> 'employee'
  ) then
    raise exception 'Owner access required.';
  end if;

  if p_sheet_id is null or not exists(
    select 1
    from public.takeoff_sheets s
    where s.id=p_sheet_id
      and s.company_id=v_company_id
      and s.takeoff_set_id=p_takeoff_set_id
  ) then
    raise exception 'Drawing sheet does not belong to this takeoff set.';
  end if;

  if p_geometry is null or jsonb_typeof(p_geometry) <> 'object' then
    raise exception 'Drawing geometry is required.';
  end if;

  v_measurement_id := public.carez_commit_takeoff_measurement(
    p_takeoff_set_id,
    p_estimate_section_id,
    p_assembly_version_id,
    p_name,
    p_location,
    p_drawing_reference,
    p_measurement_type,
    p_raw_quantity,
    p_raw_unit,
    p_variables,
    p_risk_class_code,
    p_outputs
  );

  update public.takeoff_measurements
  set sheet_id=p_sheet_id,
      geometry=p_geometry,
      source='drawing'
  where id=v_measurement_id
    and company_id=v_company_id;

  return v_measurement_id;
end;
$$;

grant execute on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb) to authenticated;
revoke execute on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb) from public, anon;

create or replace function public.carez_save_takeoff_sheet_calibration(
  p_sheet_id uuid,
  p_page_width numeric,
  p_page_height numeric,
  p_calibration jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_estimate_id uuid;
begin
  v_company_id := public.get_my_company_id();
  if v_company_id is null or not exists(
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role <> 'employee'
  ) then
    raise exception 'Owner access required.';
  end if;

  select ts.estimate_id into v_estimate_id
  from public.takeoff_sheets sh
  join public.takeoff_sets ts on ts.id=sh.takeoff_set_id
  where sh.id=p_sheet_id and sh.company_id=v_company_id;
  if v_estimate_id is null then raise exception 'Takeoff sheet not found.'; end if;
  if exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates e where e.id=v_estimate_id and e.status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;

  if p_page_width <= 0 or p_page_height <= 0 then raise exception 'PDF page dimensions are invalid.'; end if;
  if p_calibration is null
     or coalesce((p_calibration->>'known_distance_ft')::numeric,0) <= 0
     or coalesce((p_calibration->>'pdf_distance')::numeric,0) <= 0 then
    raise exception 'Calibration requires a known real distance and two distinct drawing points.';
  end if;

  update public.takeoff_sheets
  set page_width=p_page_width,
      page_height=p_page_height,
      calibration=p_calibration,
      scale_status='calibrated'
  where id=p_sheet_id and company_id=v_company_id;
end;
$$;

grant execute on function public.carez_save_takeoff_sheet_calibration(uuid,numeric,numeric,jsonb) to authenticated;
revoke execute on function public.carez_save_takeoff_sheet_calibration(uuid,numeric,numeric,jsonb) from public, anon;

create index if not exists takeoff_sheets_company_set_idx
  on public.takeoff_sheets(company_id,takeoff_set_id,page_number);

comment on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb)
is 'Atomically commits normalized PDF geometry plus the same assembly outputs and estimate-line lineage used by manual takeoff.';
