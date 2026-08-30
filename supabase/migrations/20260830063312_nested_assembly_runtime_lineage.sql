-- Allow a published parent assembly version to emit outputs from immutable published child versions.

alter table public.concrete_assembly_components
  add constraint concrete_assembly_components_path_key_chk check(position('/' in component_key)=0);
alter table public.concrete_assembly_children
  add constraint concrete_assembly_children_path_key_chk check(position('/' in child_key)=0);

create or replace function public.carez_assembly_component_paths(p_company_id uuid,p_root_version_id uuid)
returns table(component_id uuid,component_path_key text,component_label text,component_version_id uuid)
language sql
stable
security invoker
set search_path=public
as $$
  with recursive tree(version_id,path_key,depth,visited) as (
    select v.id,''::text,0,array[v.id]
    from public.concrete_assembly_versions v
    where v.id=p_root_version_id and v.company_id=p_company_id and v.status='published'
    union all
    select ch.child_assembly_version_id,
           case when t.path_key='' then ch.child_key else t.path_key||'/'||ch.child_key end,
           t.depth+1,
           t.visited||ch.child_assembly_version_id
    from tree t
    join public.concrete_assembly_children ch
      on ch.company_id=p_company_id and ch.assembly_version_id=t.version_id
    join public.concrete_assembly_versions cv
      on cv.company_id=ch.company_id and cv.id=ch.child_assembly_version_id and cv.status='published'
    where t.depth<16 and not ch.child_assembly_version_id=any(t.visited)
  )
  select c.id,
         case when t.path_key='' then c.component_key else t.path_key||'/'||c.component_key end,
         c.label,
         c.assembly_version_id
  from tree t
  join public.concrete_assembly_components c
    on c.company_id=p_company_id and c.assembly_version_id=t.version_id;
$$;
revoke all on function public.carez_assembly_component_paths(uuid,uuid) from public,anon;
grant execute on function public.carez_assembly_component_paths(uuid,uuid) to authenticated,service_role;

create or replace function public.carez_commit_takeoff_measurement(p_takeoff_set_id uuid,p_estimate_section_id uuid,p_assembly_version_id uuid,p_name text,p_location text,p_drawing_reference text,p_measurement_type text,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_risk_class_code text,p_outputs jsonb)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_company_id uuid;
  v_estimate_id uuid;
  v_measurement_id uuid;
  v_output_id uuid;
  v_item_id uuid;
  v_estimate_status text;
  v_payload jsonb;
  v_component public.concrete_assembly_components%rowtype;
  v_sort integer:=100;
  v_expected_count integer;
  v_payload_count integer;
  v_path_key text;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Takeoff object name is required.'; end if;
  select s.estimate_id into v_estimate_id from public.takeoff_sets s where s.id=p_takeoff_set_id and s.company_id=v_company_id and s.status='active';
  if v_estimate_id is null then raise exception 'Active takeoff set not found.'; end if;
  select e.status into v_estimate_status from public.estimates e where e.id=v_estimate_id and e.company_id=v_company_id;
  if v_estimate_status is null then raise exception 'Estimate not found.'; end if;
  if v_estimate_status in ('accepted','approved','superseded') then raise exception 'This estimate revision is locked.'; end if;
  if exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_estimate_id) then raise exception 'This estimate revision was already issued. Create the next revision before changing takeoff.'; end if;
  if not exists(select 1 from public.concrete_assembly_versions v where v.id=p_assembly_version_id and v.company_id=v_company_id and v.status='published') then raise exception 'Published concrete assembly version not found.'; end if;
  if p_estimate_section_id is not null and not exists(select 1 from public.estimate_sections s where s.id=p_estimate_section_id and s.estimate_id=v_estimate_id and s.company_id=v_company_id) then raise exception 'Estimate scope section does not belong to this estimate.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then raise exception 'Assembly outputs must be an array.'; end if;

  select count(*) into v_expected_count from public.carez_assembly_component_paths(v_company_id,p_assembly_version_id);
  select count(distinct value->>'component_key') into v_payload_count from jsonb_array_elements(coalesce(p_outputs,'[]'::jsonb));
  if v_expected_count=0 or jsonb_array_length(coalesce(p_outputs,'[]'::jsonb))<>v_expected_count or v_payload_count<>v_expected_count then
    raise exception 'Assembly output set is incomplete or contains duplicate component paths.';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_outputs) p(value)
    where not exists(
      select 1 from public.carez_assembly_component_paths(v_company_id,p_assembly_version_id) f
      where f.component_id=nullif(p.value->>'assembly_component_id','')::uuid
        and f.component_path_key=p.value->>'component_key'
    )
  ) then raise exception 'Assembly output component path does not belong to the selected assembly version.'; end if;
  if nullif(trim(p_risk_class_code),'') is not null and not exists(select 1 from public.li_risk_classes r where r.company_id=v_company_id and r.code=trim(p_risk_class_code) and r.active) then raise exception 'Selected L&I class is not active for this company.'; end if;

  insert into public.takeoff_measurements(company_id,takeoff_set_id,estimate_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,measurement_type,raw_quantity,raw_unit,variables,risk_class_code,source,created_by)
  values(v_company_id,p_takeoff_set_id,v_estimate_id,p_estimate_section_id,p_assembly_version_id,trim(p_name),nullif(trim(p_location),''),nullif(trim(p_drawing_reference),''),p_measurement_type,p_raw_quantity,p_raw_unit,coalesce(p_variables,'{}'::jsonb),nullif(trim(p_risk_class_code),''),'manual',auth.uid())
  returning id into v_measurement_id;

  for v_payload in select value from jsonb_array_elements(p_outputs) loop
    v_path_key:=v_payload->>'component_key';
    select c.* into v_component
    from public.concrete_assembly_components c
    join public.carez_assembly_component_paths(v_company_id,p_assembly_version_id) f on f.component_id=c.id
    where c.company_id=v_company_id and f.component_path_key=v_path_key
      and c.id=nullif(v_payload->>'assembly_component_id','')::uuid
    limit 1;
    if v_component.id is null then raise exception 'Output component path does not belong to the selected assembly version.'; end if;

    insert into public.takeoff_measurement_outputs(company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,production_quantity,production_unit,estimated_man_hours,baseline_man_hours_per_unit,baseline_source,unit_cost,cost_source,direct_cost,pricing_status,formula_trace)
    values(v_company_id,v_measurement_id,v_component.id,v_path_key,v_component.label,v_component.estimate_item_type,v_component.cost_code_id,v_component.catalog_item_id,v_component.production_task_id,greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0),v_component.output_unit,greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0),nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,v_component.baseline_source,greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0),nullif(v_payload->>'cost_source',''),greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0),coalesce(v_payload->>'pricing_status','missing_price'),coalesce(v_payload->'formula_trace','{}'::jsonb))
    returning id into v_output_id;

    insert into public.estimate_items(company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source)
    values(v_company_id,v_estimate_id,p_estimate_section_id,v_component.estimate_item_type,v_component.cost_code_id,v_component.catalog_item_id,v_component.labor_task,case when v_component.estimate_item_type='labor' then nullif(trim(p_risk_class_code),'') else null end,trim(p_name)||' — '||v_path_key||' — '||v_component.label,case when v_component.estimate_item_type='labor' then greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0) else greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0) end,case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0),greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0),case when v_component.estimate_item_type='labor' then greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0) else 0 end,0,'Generated by Takeoff / Assembly Engine. Edit the physical takeoff or component price rather than this line.',v_sort,v_output_id,v_measurement_id,p_assembly_version_id,v_component.production_task_id,greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0),v_component.output_unit,nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,v_component.baseline_source)
    returning id into v_item_id;
    update public.takeoff_measurement_outputs set generated_estimate_item_id=v_item_id where id=v_output_id;
    v_sort:=v_sort+10;
  end loop;
  return v_measurement_id;
end;
$$;

create or replace function public.carez_update_drawing_measurement(p_measurement_id uuid,p_geometry jsonb,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_outputs jsonb)
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
  v_path_key text;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company_id for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if v_measurement.source<>'drawing' or v_measurement.sheet_id is null then raise exception 'Only drawing takeoff geometry can be edited here.'; end if;
  select status into v_estimate_status from public.estimates where id=v_measurement.estimate_id and company_id=v_company_id;
  if v_estimate_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_measurement.estimate_id) then raise exception 'This estimate revision is locked.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then raise exception 'Assembly outputs must be an array.'; end if;

  select count(*) into v_expected_count from public.carez_assembly_component_paths(v_company_id,v_measurement.assembly_version_id);
  select count(distinct value->>'component_key') into v_payload_count from jsonb_array_elements(coalesce(p_outputs,'[]'::jsonb));
  if v_expected_count=0 or jsonb_array_length(coalesce(p_outputs,'[]'::jsonb))<>v_expected_count or v_payload_count<>v_expected_count then raise exception 'Assembly output set is incomplete or contains duplicate component paths.'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_outputs) p(value)
    where not exists(
      select 1 from public.carez_assembly_component_paths(v_company_id,v_measurement.assembly_version_id) f
      where f.component_id=nullif(p.value->>'assembly_component_id','')::uuid and f.component_path_key=p.value->>'component_key'
    )
  ) then raise exception 'Assembly output component path does not belong to the takeoff assembly.'; end if;

  update public.takeoff_measurements set raw_quantity=p_raw_quantity,raw_unit=p_raw_unit,variables=coalesce(p_variables,'{}'::jsonb),geometry=p_geometry,updated_at=now() where id=v_measurement.id and company_id=v_company_id;

  for v_payload in select value from jsonb_array_elements(p_outputs) loop
    v_path_key:=v_payload->>'component_key';
    select c.* into v_component
    from public.concrete_assembly_components c
    join public.carez_assembly_component_paths(v_company_id,v_measurement.assembly_version_id) f on f.component_id=c.id
    where c.company_id=v_company_id and f.component_path_key=v_path_key and c.id=nullif(v_payload->>'assembly_component_id','')::uuid
    limit 1;
    if v_component.id is null then raise exception 'Output component path does not belong to the takeoff assembly.'; end if;
    select * into v_output from public.takeoff_measurement_outputs o where o.company_id=v_company_id and o.measurement_id=v_measurement.id and o.assembly_component_id=v_component.id and o.component_key=v_path_key for update;
    if v_output.id is null then raise exception 'Existing takeoff output is missing.'; end if;

    v_production_quantity:=greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0);
    v_man_hours:=greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0);
    if v_output.pricing_status='manual_override' then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0);
      v_cost_source:=coalesce(v_output.cost_source,'manual_override');
      v_pricing_status:='manual_override';
      v_direct_cost:=round((case when v_component.estimate_item_type='labor' then v_man_hours else v_production_quantity end)*v_unit_cost,2);
    else
      v_unit_cost:=greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0);
      v_cost_source:=nullif(v_payload->>'cost_source','');
      v_pricing_status:=coalesce(v_payload->>'pricing_status','missing_price');
      v_direct_cost:=greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0);
    end if;

    update public.takeoff_measurement_outputs
    set production_quantity=v_production_quantity,production_unit=v_component.output_unit,estimated_man_hours=v_man_hours,
        baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,baseline_source=v_component.baseline_source,
        unit_cost=v_unit_cost,cost_source=v_cost_source,direct_cost=v_direct_cost,pricing_status=v_pricing_status,
        formula_trace=coalesce(v_payload->'formula_trace','{}'::jsonb),updated_at=now()
    where id=v_output.id and company_id=v_company_id;

    update public.estimate_items
    set quantity=case when v_component.estimate_item_type='labor' then v_man_hours else v_production_quantity end,
        unit=case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
        unit_cost=v_unit_cost,direct_cost=v_direct_cost,regular_hours=case when v_component.estimate_item_type='labor' then v_man_hours else 0 end,overtime_hours=0,
        production_task_id=v_component.production_task_id,production_quantity=v_production_quantity,production_unit=v_component.output_unit,
        baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,baseline_source=v_component.baseline_source,updated_at=now()
    where id=v_output.generated_estimate_item_id and company_id=v_company_id and source_takeoff_measurement_id=v_measurement.id;
  end loop;
  return v_measurement.id;
end;
$$;
