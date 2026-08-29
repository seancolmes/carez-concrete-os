-- Atomic takeoff commit/update/delete so geometry/assembly outputs and estimate lines cannot drift apart.

create or replace function public.carez_commit_takeoff_measurement(
  p_takeoff_set_id uuid,
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
  p_outputs jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_estimate_id uuid;
  v_measurement_id uuid;
  v_output_id uuid;
  v_item_id uuid;
  v_estimate_status text;
  v_component jsonb;
  v_sort integer := 100;
begin
  v_company_id := public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role <> 'employee') then
    raise exception 'Owner access required.';
  end if;

  select s.estimate_id into v_estimate_id
  from public.takeoff_sets s
  where s.id=p_takeoff_set_id and s.company_id=v_company_id and s.status='active';
  if v_estimate_id is null then raise exception 'Active takeoff set not found.'; end if;

  select e.status into v_estimate_status
  from public.estimates e
  where e.id=v_estimate_id and e.company_id=v_company_id;
  if v_estimate_status is null then raise exception 'Estimate not found.'; end if;
  if v_estimate_status in ('accepted','approved','superseded') then raise exception 'This estimate revision is locked.'; end if;
  if exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_estimate_id) then
    raise exception 'This estimate revision was already issued. Create the next revision before changing takeoff.';
  end if;

  if not exists(select 1 from public.concrete_assembly_versions v where v.id=p_assembly_version_id and v.company_id=v_company_id and v.status='published') then
    raise exception 'Published concrete assembly version not found.';
  end if;
  if p_estimate_section_id is not null and not exists(select 1 from public.estimate_sections s where s.id=p_estimate_section_id and s.estimate_id=v_estimate_id and s.company_id=v_company_id) then
    raise exception 'Estimate scope section does not belong to this estimate.';
  end if;
  if p_raw_quantity < 0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  if coalesce(jsonb_array_length(p_outputs),0)=0 then raise exception 'Assembly produced no estimate outputs.'; end if;

  insert into public.takeoff_measurements(
    company_id,takeoff_set_id,estimate_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,
    measurement_type,raw_quantity,raw_unit,variables,risk_class_code,source,created_by
  ) values (
    v_company_id,p_takeoff_set_id,v_estimate_id,p_estimate_section_id,p_assembly_version_id,trim(p_name),nullif(trim(p_location),''),nullif(trim(p_drawing_reference),''),
    p_measurement_type,p_raw_quantity,p_raw_unit,coalesce(p_variables,'{}'::jsonb),nullif(trim(p_risk_class_code),''),'manual',auth.uid()
  ) returning id into v_measurement_id;

  for v_component in select value from jsonb_array_elements(p_outputs)
  loop
    insert into public.takeoff_measurement_outputs(
      company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,
      production_quantity,production_unit,estimated_man_hours,baseline_man_hours_per_unit,baseline_source,unit_cost,cost_source,direct_cost,pricing_status,formula_trace
    ) values (
      v_company_id,v_measurement_id,(v_component->>'assembly_component_id')::uuid,v_component->>'component_key',v_component->>'label',v_component->>'estimate_item_type',
      nullif(v_component->>'cost_code_id','')::uuid,nullif(v_component->>'catalog_item_id','')::uuid,nullif(v_component->>'production_task_id','')::uuid,
      coalesce((v_component->>'production_quantity')::numeric,0),v_component->>'production_unit',coalesce((v_component->>'estimated_man_hours')::numeric,0),
      nullif(v_component->>'baseline_man_hours_per_unit','')::numeric,nullif(v_component->>'baseline_source',''),coalesce((v_component->>'unit_cost')::numeric,0),
      nullif(v_component->>'cost_source',''),coalesce((v_component->>'direct_cost')::numeric,0),coalesce(v_component->>'pricing_status','missing_price'),
      coalesce(v_component->'formula_trace','{}'::jsonb)
    ) returning id into v_output_id;

    insert into public.estimate_items(
      company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,labor_task,risk_class_code,description,
      quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,
      source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,
      baseline_man_hours_per_unit,baseline_source
    ) values (
      v_company_id,v_estimate_id,p_estimate_section_id,v_component->>'estimate_item_type',nullif(v_component->>'cost_code_id','')::uuid,nullif(v_component->>'catalog_item_id','')::uuid,
      nullif(v_component->>'labor_task',''),case when v_component->>'estimate_item_type'='labor' then nullif(trim(p_risk_class_code),'') else null end,
      trim(p_name)||' — '||(v_component->>'label'),
      case when v_component->>'estimate_item_type'='labor' then coalesce((v_component->>'estimated_man_hours')::numeric,0) else coalesce((v_component->>'production_quantity')::numeric,0) end,
      case when v_component->>'estimate_item_type'='labor' then 'HR' else v_component->>'production_unit' end,
      coalesce((v_component->>'unit_cost')::numeric,0),coalesce((v_component->>'direct_cost')::numeric,0),
      case when v_component->>'estimate_item_type'='labor' then coalesce((v_component->>'estimated_man_hours')::numeric,0) else 0 end,0,
      'Generated by Takeoff / Assembly Engine. Edit the physical takeoff or component price rather than this line.',v_sort,
      v_output_id,v_measurement_id,p_assembly_version_id,nullif(v_component->>'production_task_id','')::uuid,
      coalesce((v_component->>'production_quantity')::numeric,0),v_component->>'production_unit',nullif(v_component->>'baseline_man_hours_per_unit','')::numeric,
      nullif(v_component->>'baseline_source','')
    ) returning id into v_item_id;

    update public.takeoff_measurement_outputs set generated_estimate_item_id=v_item_id where id=v_output_id;
    v_sort := v_sort + 10;
  end loop;

  return v_measurement_id;
end;
$$;

grant execute on function public.carez_commit_takeoff_measurement(uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb) to authenticated;
revoke execute on function public.carez_commit_takeoff_measurement(uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb) from public, anon;

create or replace function public.carez_delete_takeoff_measurement(p_measurement_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_estimate_id uuid;
begin
  v_company_id := public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role <> 'employee') then raise exception 'Owner access required.'; end if;
  select estimate_id into v_estimate_id from public.takeoff_measurements where id=p_measurement_id and company_id=v_company_id;
  if v_estimate_id is null then raise exception 'Takeoff measurement not found.'; end if;
  if exists(select 1 from public.proposal_presentations where company_id=v_company_id and estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates where id=v_estimate_id and status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;
  delete from public.estimate_items where company_id=v_company_id and source_takeoff_measurement_id=p_measurement_id;
  delete from public.takeoff_measurements where id=p_measurement_id and company_id=v_company_id;
end;
$$;

grant execute on function public.carez_delete_takeoff_measurement(uuid) to authenticated;
revoke execute on function public.carez_delete_takeoff_measurement(uuid) from public, anon;

create or replace function public.carez_update_takeoff_output_price(p_output_id uuid,p_unit_cost numeric)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_estimate_id uuid;
  v_new_cost numeric;
begin
  v_company_id := public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role <> 'employee') then raise exception 'Owner access required.'; end if;
  if p_unit_cost < 0 then raise exception 'Unit cost cannot be negative.'; end if;
  select * into v_output from public.takeoff_measurement_outputs where id=p_output_id and company_id=v_company_id;
  if v_output.id is null then raise exception 'Takeoff output not found.'; end if;
  select estimate_id into v_estimate_id from public.takeoff_measurements where id=v_output.measurement_id;
  if exists(select 1 from public.proposal_presentations where company_id=v_company_id and estimate_id=v_estimate_id)
     or exists(select 1 from public.estimates where id=v_estimate_id and status in ('accepted','approved','superseded')) then
    raise exception 'This estimate revision is locked.';
  end if;
  if v_output.estimate_item_type='labor' then
    v_new_cost := round(v_output.estimated_man_hours*p_unit_cost,2);
  else
    v_new_cost := round(v_output.production_quantity*p_unit_cost,2);
  end if;
  update public.takeoff_measurement_outputs
    set unit_cost=p_unit_cost,direct_cost=v_new_cost,pricing_status='manual_override',cost_source='manual takeoff override'
  where id=p_output_id;
  update public.estimate_items
    set unit_cost=p_unit_cost,direct_cost=v_new_cost
  where id=v_output.generated_estimate_item_id and company_id=v_company_id;
end;
$$;

grant execute on function public.carez_update_takeoff_output_price(uuid,numeric) to authenticated;
revoke execute on function public.carez_update_takeoff_output_price(uuid,numeric) from public, anon;
