-- Carez OS: geometry edits must preserve reviewed/manual output pricing.

create or replace function public.carez_update_drawing_measurement(
  p_measurement_id uuid,
  p_geometry jsonb,
  p_raw_quantity numeric,
  p_raw_unit text,
  p_variables jsonb,
  p_outputs jsonb
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_company_id uuid;
  v_measurement public.takeoff_measurements%rowtype;
  v_estimate_status text;
  v_expected_count integer;
  v_payload_count integer;
  v_payload jsonb;
  v_component public.concrete_assembly_components%rowtype;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_production_quantity numeric;
  v_man_hours numeric;
  v_unit_cost numeric;
  v_direct_cost numeric;
  v_cost_source text;
  v_pricing_status text;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'
  ) then
    raise exception 'Owner access required.';
  end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id=p_measurement_id and company_id=v_company_id
  for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if v_measurement.source<>'drawing' or v_measurement.sheet_id is null then
    raise exception 'Only drawing takeoff geometry can be edited here.';
  end if;

  select status into v_estimate_status
  from public.estimates
  where id=v_measurement.estimate_id and company_id=v_company_id;
  if v_estimate_status in ('accepted','approved','superseded')
     or exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_measurement.estimate_id) then
    raise exception 'This estimate revision is locked.';
  end if;

  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then raise exception 'Assembly outputs must be an array.'; end if;

  select count(*) into v_expected_count
  from public.concrete_assembly_components c
  where c.company_id=v_company_id and c.assembly_version_id=v_measurement.assembly_version_id;
  select count(distinct value->>'assembly_component_id') into v_payload_count
  from jsonb_array_elements(coalesce(p_outputs,'[]'::jsonb));
  if v_expected_count=0
     or jsonb_array_length(coalesce(p_outputs,'[]'::jsonb))<>v_expected_count
     or v_payload_count<>v_expected_count then
    raise exception 'Assembly output set is incomplete or contains duplicate components.';
  end if;

  update public.takeoff_measurements
  set raw_quantity=p_raw_quantity,
      raw_unit=p_raw_unit,
      variables=coalesce(p_variables,'{}'::jsonb),
      geometry=p_geometry,
      updated_at=now()
  where id=v_measurement.id and company_id=v_company_id;

  for v_payload in select value from jsonb_array_elements(p_outputs)
  loop
    select * into v_component
    from public.concrete_assembly_components c
    where c.id=nullif(v_payload->>'assembly_component_id','')::uuid
      and c.company_id=v_company_id
      and c.assembly_version_id=v_measurement.assembly_version_id;
    if v_component.id is null then raise exception 'Output component does not belong to the takeoff assembly.'; end if;

    select * into v_output
    from public.takeoff_measurement_outputs o
    where o.company_id=v_company_id
      and o.measurement_id=v_measurement.id
      and o.assembly_component_id=v_component.id
    for update;
    if v_output.id is null then raise exception 'Existing takeoff output is missing.'; end if;

    v_production_quantity:=greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0);
    v_man_hours:=greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0);

    if v_output.pricing_status='manual_override' then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0);
      v_cost_source:=coalesce(v_output.cost_source,'manual_override');
      v_pricing_status:='manual_override';
      v_direct_cost:=round(
        case when v_component.estimate_item_type='labor' then v_man_hours else v_production_quantity end
        * v_unit_cost,
        2
      );
    else
      v_unit_cost:=greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0);
      v_cost_source:=nullif(v_payload->>'cost_source','');
      v_pricing_status:=coalesce(v_payload->>'pricing_status','missing_price');
      v_direct_cost:=greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0);
    end if;

    update public.takeoff_measurement_outputs
    set production_quantity=v_production_quantity,
        production_unit=v_component.output_unit,
        estimated_man_hours=v_man_hours,
        baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,
        baseline_source=v_component.baseline_source,
        unit_cost=v_unit_cost,
        cost_source=v_cost_source,
        direct_cost=v_direct_cost,
        pricing_status=v_pricing_status,
        formula_trace=coalesce(v_payload->'formula_trace','{}'::jsonb),
        updated_at=now()
    where id=v_output.id and company_id=v_company_id;

    update public.estimate_items
    set quantity=case when v_component.estimate_item_type='labor' then v_man_hours else v_production_quantity end,
        unit=case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
        unit_cost=v_unit_cost,
        direct_cost=v_direct_cost,
        regular_hours=case when v_component.estimate_item_type='labor' then v_man_hours else 0 end,
        overtime_hours=0,
        production_task_id=v_component.production_task_id,
        production_quantity=v_production_quantity,
        production_unit=v_component.output_unit,
        baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,
        baseline_source=v_component.baseline_source,
        updated_at=now()
    where id=v_output.generated_estimate_item_id
      and company_id=v_company_id
      and source_takeoff_measurement_id=v_measurement.id;
  end loop;

  return v_measurement.id;
end;
$$;

revoke all on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb) from public,anon;
grant execute on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb) to authenticated;
