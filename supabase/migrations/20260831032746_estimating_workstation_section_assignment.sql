create or replace function public.carez_assign_takeoff_measurement_section(
  p_measurement_id uuid,
  p_section_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid := public.get_my_company_id();
  v_measurement public.takeoff_measurements%rowtype;
  v_estimate_status text;
begin
  if v_company_id is null
     or not exists (
       select 1
       from public.profiles p
       where p.id = (select auth.uid())
         and p.company_id = v_company_id
         and p.role <> 'employee'
     ) then
    raise exception 'Owner access required.';
  end if;

  select *
  into v_measurement
  from public.takeoff_measurements
  where id = p_measurement_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'Takeoff measurement not found.';
  end if;

  select status
  into v_estimate_status
  from public.estimates
  where id = v_measurement.estimate_id
    and company_id = v_company_id
  for update;

  if v_estimate_status is null then
    raise exception 'Estimate not found.';
  end if;

  if v_estimate_status in ('accepted','approved','superseded')
     or exists (
       select 1
       from public.proposal_presentations p
       where p.company_id = v_company_id
         and p.estimate_id = v_measurement.estimate_id
     ) then
    raise exception 'This estimate revision is locked.';
  end if;

  if p_section_id is not null
     and not exists (
       select 1
       from public.estimate_sections s
       where s.id = p_section_id
         and s.company_id = v_company_id
         and s.estimate_id = v_measurement.estimate_id
     ) then
    raise exception 'Estimate scope section not found.';
  end if;

  update public.takeoff_measurements
  set estimate_section_id = p_section_id,
      updated_at = now()
  where id = v_measurement.id
    and company_id = v_company_id;

  update public.estimate_items
  set section_id = p_section_id,
      updated_at = now()
  where company_id = v_company_id
    and estimate_id = v_measurement.estimate_id
    and source_takeoff_measurement_id = v_measurement.id;
end;
$$;

revoke all on function public.carez_assign_takeoff_measurement_section(uuid,uuid) from public, anon;
grant execute on function public.carez_assign_takeoff_measurement_section(uuid,uuid) to authenticated, service_role;
