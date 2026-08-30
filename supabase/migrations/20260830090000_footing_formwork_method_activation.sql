-- Carez OS: immutable assembly construction-method activation and auditable output lifecycle.

alter table public.takeoff_measurement_outputs
  add column if not exists is_active boolean not null default true,
  add column if not exists resource_behavior text,
  add column if not exists estimate_visible boolean not null default true;

create or replace function public.carez_activation_rule_is_valid(p_rule jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path=public
as $$
declare
  v_op text;
  v_value jsonb;
begin
  if p_rule is null or jsonb_typeof(p_rule) <> 'object' then return false; end if;
  if p_rule ? 'var' then return jsonb_typeof(p_rule->'var')='string' and length(trim(p_rule->>'var'))>0; end if;
  if p_rule ? 'const' then
    return jsonb_typeof(p_rule->'const') in ('string','number','boolean','null')
      or (jsonb_typeof(p_rule->'const')='array' and not exists(select 1 from jsonb_array_elements(p_rule->'const') x where jsonb_typeof(x) not in ('string','number','boolean','null')));
  end if;
  v_op:=coalesce(p_rule->>'op','');
  if v_op in ('eq','neq','gt','gte','lt','lte') then
    return public.carez_activation_rule_is_valid(p_rule->'left') and public.carez_activation_rule_is_valid(p_rule->'right');
  elsif v_op in ('and','or') then
    return jsonb_typeof(p_rule->'args')='array' and jsonb_array_length(p_rule->'args')>0
      and not exists(select 1 from jsonb_array_elements(p_rule->'args') x where not public.carez_activation_rule_is_valid(x));
  elsif v_op='not' then
    return public.carez_activation_rule_is_valid(p_rule->'arg');
  elsif v_op='exists' then
    return public.carez_activation_rule_is_valid(p_rule->'value');
  elsif v_op='in' then
    return public.carez_activation_rule_is_valid(p_rule->'value')
      and jsonb_typeof(p_rule->'values')='array'
      and not exists(select 1 from jsonb_array_elements(p_rule->'values') x where not public.carez_activation_rule_is_valid(x));
  end if;
  return false;
end;
$$;
revoke all on function public.carez_activation_rule_is_valid(jsonb) from public,anon;
grant execute on function public.carez_activation_rule_is_valid(jsonb) to authenticated,service_role;

create or replace function public.carez_validate_assembly_version_publish()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='published' and old.status<>'published' then
    if not exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id)
       and not exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id) then raise exception 'An assembly version must contain at least one output component or child assembly before publishing.'; end if;
    if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and (not public.carez_formula_ast_is_valid(c.quantity_formula) or (c.labor_rate_formula is not null and not public.carez_formula_ast_is_valid(c.labor_rate_formula)))) then raise exception 'Every assembly component formula must use the supported deterministic formula syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule)) then raise exception 'Every assembly component activation rule must use the supported deterministic rule syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_children c join public.concrete_assembly_versions v on v.id=c.child_assembly_version_id and v.company_id=c.company_id where c.company_id=new.company_id and c.assembly_version_id=new.id and v.status<>'published') then raise exception 'Every child assembly version must be published before the parent can be published.'; end if;
    if exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id and not public.carez_formula_ast_is_valid(c.quantity_formula)) then raise exception 'Every child quantity formula must use the supported deterministic formula syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_children c cross join lateral jsonb_each(c.variable_bindings) b where c.company_id=new.company_id and c.assembly_version_id=new.id and (not exists(select 1 from public.concrete_assembly_variables cv where cv.company_id=c.company_id and cv.assembly_version_id=c.child_assembly_version_id and cv.variable_key=b.key) or not public.carez_formula_ast_is_valid(b.value))) then raise exception 'Child property bindings must target child properties and use supported deterministic formulas.'; end if;
    if exists(select 1 from public.concrete_assembly_property_bindings b where b.company_id=new.company_id and b.assembly_version_id=new.id and b.source_namespace='property' and not exists(select 1 from public.concrete_assembly_variables v where v.company_id=b.company_id and v.assembly_version_id=b.assembly_version_id and v.variable_key=b.source_key)) then raise exception 'Property-to-property bindings must reference a property in the same assembly version.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.carez_validate_assembly_version_publish() from public,anon,authenticated;

create or replace function public.carez_create_assembly_revision(p_assembly_version_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id(); v_source public.concrete_assembly_versions%rowtype; v_assembly public.concrete_assemblies%rowtype; v_new uuid; v_next integer;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required.'; end if;
  select * into v_source from public.concrete_assembly_versions where id=p_assembly_version_id and company_id=v_company;
  if not found then raise exception 'Assembly version not found.'; end if;
  if v_source.status='draft' then raise exception 'Continue editing the existing draft instead of creating a revision from it.'; end if;
  select * into v_assembly from public.concrete_assemblies where id=v_source.assembly_id and company_id=v_company for update;
  if not found then raise exception 'Assembly not found.'; end if;
  if exists(select 1 from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id and status='draft') then raise exception 'This assembly already has a draft revision.'; end if;
  select coalesce(max(version_no),0)+1 into v_next from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id;
  insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes,assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,render_config,created_by)
  values(v_company,v_source.assembly_id,v_next,'draft',v_source.source_type,v_source.source_label,v_source.source_year,v_source.source_reference,v_source.default_risk_class_code,v_source.notes,v_assembly.code,v_assembly.name,v_assembly.category,v_assembly.primary_measurement,v_assembly.description,v_source.render_config,auth.uid()) returning id into v_new;
  insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override)
  select company_id,v_new,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override from public.concrete_assembly_variables where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order,activation_rule,resource_behavior,estimate_visible)
  select company_id,v_new,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order,activation_rule,resource_behavior,estimate_visible from public.concrete_assembly_components where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_children(company_id,assembly_version_id,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,sort_order,created_by) select company_id,v_new,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,sort_order,auth.uid() from public.concrete_assembly_children where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_property_bindings(company_id,assembly_version_id,variable_id,source_namespace,source_key,precedence,notes,sort_order,created_by) select b.company_id,v_new,nv.id,b.source_namespace,b.source_key,b.precedence,b.notes,b.sort_order,auth.uid() from public.concrete_assembly_property_bindings b join public.concrete_assembly_variables ov on ov.id=b.variable_id and ov.company_id=b.company_id join public.concrete_assembly_variables nv on nv.company_id=b.company_id and nv.assembly_version_id=v_new and nv.variable_key=ov.variable_key where b.company_id=v_company and b.assembly_version_id=v_source.id;
  return v_new;
end;
$$;
revoke all on function public.carez_create_assembly_revision(uuid) from public,anon;
grant execute on function public.carez_create_assembly_revision(uuid) to authenticated,service_role;

create or replace function public.carez_sync_takeoff_measurement_outputs(p_measurement_id uuid,p_outputs jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare
  v_company uuid:=public.get_my_company_id(); v_measurement public.takeoff_measurements%rowtype; v_payload jsonb; v_component public.concrete_assembly_components%rowtype; v_output public.takeoff_measurement_outputs%rowtype; v_item_id uuid; v_expected integer; v_actual integer; v_path text; v_active boolean; v_visible boolean; v_behavior text; v_qty numeric; v_hours numeric; v_unit_cost numeric; v_direct numeric; v_cost_source text; v_status text; v_sort integer:=100;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then raise exception 'Assembly outputs must be an array.'; end if;
  select count(*) into v_expected from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id);
  select count(distinct value->>'component_key') into v_actual from jsonb_array_elements(p_outputs);
  if v_expected=0 or jsonb_array_length(p_outputs)<>v_expected or v_actual<>v_expected then raise exception 'Assembly output set is incomplete or contains duplicate component paths.'; end if;
  if exists(select 1 from jsonb_array_elements(p_outputs) p(value) where not exists(select 1 from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f where f.component_id=nullif(p.value->>'assembly_component_id','')::uuid and f.component_path_key=p.value->>'component_key')) then raise exception 'Assembly output component path does not belong to the takeoff assembly.'; end if;
  for v_payload in select value from jsonb_array_elements(p_outputs) loop
    v_path:=v_payload->>'component_key';
    select c.* into v_component from public.concrete_assembly_components c join public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f on f.component_id=c.id where c.company_id=v_company and f.component_path_key=v_path and c.id=nullif(v_payload->>'assembly_component_id','')::uuid limit 1;
    if v_component.id is null then raise exception 'Output component path does not belong to the takeoff assembly.'; end if;
    v_active:=coalesce(nullif(v_payload->>'is_active','')::boolean,true);
    v_visible:=coalesce(nullif(v_payload->>'estimate_visible','')::boolean,v_component.estimate_visible,true);
    v_behavior:=coalesce(nullif(v_payload->>'resource_behavior',''),nullif(v_component.resource_behavior,''),case v_component.estimate_item_type when 'labor' then 'labor' when 'material' then 'consumed_material' when 'equipment' then 'owned_equipment' when 'subcontractor' then 'subcontractor' else 'legacy_other' end);
    v_qty:=case when v_active then greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0) else 0 end;
    v_hours:=case when v_active then greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0) else 0 end;
    select * into v_output from public.takeoff_measurement_outputs o where o.company_id=v_company and o.measurement_id=v_measurement.id and o.assembly_component_id=v_component.id and o.component_key=v_path for update;
    if v_active and v_output.id is not null and v_output.pricing_status='manual_override' then v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0); v_cost_source:=coalesce(v_output.cost_source,'manual_override'); v_status:='manual_override'; v_direct:=round((case when v_component.estimate_item_type='labor' then v_hours else v_qty end)*v_unit_cost,2); else v_unit_cost:=case when v_active then greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0) else 0 end; v_cost_source:=case when v_active then nullif(v_payload->>'cost_source','') else null end; v_status:=case when v_active then coalesce(v_payload->>'pricing_status','missing_price') else 'not_priced' end; v_direct:=case when v_active then greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0) else 0 end; end if;
    if v_output.id is null then insert into public.takeoff_measurement_outputs(company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,production_quantity,production_unit,estimated_man_hours,baseline_man_hours_per_unit,baseline_source,unit_cost,cost_source,direct_cost,pricing_status,is_active,resource_behavior,estimate_visible,formula_trace) values(v_company,v_measurement.id,v_component.id,v_path,v_component.label,v_component.estimate_item_type,v_component.cost_code_id,v_component.catalog_item_id,v_component.production_task_id,v_qty,v_component.output_unit,v_hours,nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,v_component.baseline_source,v_unit_cost,v_cost_source,v_direct,v_status,v_active,v_behavior,v_visible,coalesce(v_payload->'formula_trace','{}'::jsonb)) returning * into v_output; else update public.takeoff_measurement_outputs set production_quantity=v_qty,production_unit=v_component.output_unit,estimated_man_hours=v_hours,baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,baseline_source=v_component.baseline_source,unit_cost=v_unit_cost,cost_source=v_cost_source,direct_cost=v_direct,pricing_status=v_status,is_active=v_active,resource_behavior=v_behavior,estimate_visible=v_visible,formula_trace=coalesce(v_payload->'formula_trace','{}'::jsonb),updated_at=now() where id=v_output.id returning * into v_output; end if;
    if not v_active or not v_visible then delete from public.estimate_items where company_id=v_company and source_takeoff_output_id=v_output.id; update public.takeoff_measurement_outputs set generated_estimate_item_id=null where id=v_output.id; else
      select id into v_item_id from public.estimate_items where company_id=v_company and source_takeoff_output_id=v_output.id for update;
      if v_item_id is null then insert into public.estimate_items(company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source) values(v_company,v_measurement.estimate_id,v_measurement.estimate_section_id,v_component.estimate_item_type,v_component.cost_code_id,v_component.catalog_item_id,v_component.labor_task,case when v_component.estimate_item_type='labor' then v_measurement.risk_class_code else null end,v_measurement.name||' — '||v_path||' — '||v_component.label,case when v_component.estimate_item_type='labor' then v_hours else v_qty end,case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,v_unit_cost,v_direct,case when v_component.estimate_item_type='labor' then v_hours else 0 end,0,'Generated by Takeoff / Assembly Engine. Edit the physical takeoff or component price rather than this line.',v_sort,v_output.id,v_measurement.id,v_measurement.assembly_version_id,v_component.production_task_id,v_qty,v_component.output_unit,nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,v_component.baseline_source) returning id into v_item_id; else update public.estimate_items set quantity=case when v_component.estimate_item_type='labor' then v_hours else v_qty end,unit=case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,unit_cost=v_unit_cost,direct_cost=v_direct,regular_hours=case when v_component.estimate_item_type='labor' then v_hours else 0 end,overtime_hours=0,production_task_id=v_component.production_task_id,production_quantity=v_qty,production_unit=v_component.output_unit,baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,baseline_source=v_component.baseline_source,updated_at=now() where id=v_item_id and company_id=v_company; end if;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=v_item_id where id=v_output.id; v_sort:=v_sort+10;
    end if;
  end loop;
end;
$$;
revoke all on function public.carez_sync_takeoff_measurement_outputs(uuid,jsonb) from public,anon;
grant execute on function public.carez_sync_takeoff_measurement_outputs(uuid,jsonb) to authenticated,service_role;

create or replace function public.carez_commit_takeoff_measurement(p_takeoff_set_id uuid,p_estimate_section_id uuid,p_assembly_version_id uuid,p_name text,p_location text,p_drawing_reference text,p_measurement_type text,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_risk_class_code text,p_outputs jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id(); v_estimate uuid; v_measurement uuid; v_status text;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Takeoff object name is required.'; end if;
  select s.estimate_id into v_estimate from public.takeoff_sets s where s.id=p_takeoff_set_id and s.company_id=v_company and s.status='active'; if v_estimate is null then raise exception 'Active takeoff set not found.'; end if;
  select status into v_status from public.estimates where id=v_estimate and company_id=v_company; if v_status is null then raise exception 'Estimate not found.'; end if; if v_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company and p.estimate_id=v_estimate) then raise exception 'This estimate revision is locked.'; end if;
  if not exists(select 1 from public.concrete_assembly_versions v where v.id=p_assembly_version_id and v.company_id=v_company and v.status='published') then raise exception 'Published concrete assembly version not found.'; end if;
  if p_estimate_section_id is not null and not exists(select 1 from public.estimate_sections s where s.id=p_estimate_section_id and s.estimate_id=v_estimate and s.company_id=v_company) then raise exception 'Estimate scope section does not belong to this estimate.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  if nullif(trim(p_risk_class_code),'') is not null and not exists(select 1 from public.li_risk_classes r where r.company_id=v_company and r.code=trim(p_risk_class_code) and r.active) then raise exception 'Selected L&I class is not active for this company.'; end if;
  insert into public.takeoff_measurements(company_id,takeoff_set_id,estimate_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,measurement_type,raw_quantity,raw_unit,variables,risk_class_code,source,created_by) values(v_company,p_takeoff_set_id,v_estimate,p_estimate_section_id,p_assembly_version_id,trim(p_name),nullif(trim(p_location),''),nullif(trim(p_drawing_reference),''),p_measurement_type,p_raw_quantity,p_raw_unit,coalesce(p_variables,'{}'::jsonb),nullif(trim(p_risk_class_code),''),'manual',auth.uid()) returning id into v_measurement;
  perform public.carez_sync_takeoff_measurement_outputs(v_measurement,p_outputs); return v_measurement;
end;
$$;
revoke all on function public.carez_commit_takeoff_measurement(uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.carez_commit_takeoff_measurement(uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb) to authenticated;

create or replace function public.carez_update_drawing_measurement(p_measurement_id uuid,p_geometry jsonb,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_outputs jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id(); v_measurement public.takeoff_measurements%rowtype; v_status text;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company for update; if not found then raise exception 'Takeoff measurement not found.'; end if;
  if v_measurement.source<>'drawing' or v_measurement.sheet_id is null then raise exception 'Only drawing takeoff geometry can be edited here.'; end if;
  select status into v_status from public.estimates where id=v_measurement.estimate_id and company_id=v_company; if v_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company and p.estimate_id=v_measurement.estimate_id) then raise exception 'This estimate revision is locked.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if; if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  update public.takeoff_measurements set raw_quantity=p_raw_quantity,raw_unit=p_raw_unit,variables=coalesce(p_variables,'{}'::jsonb),geometry=p_geometry,updated_at=now() where id=v_measurement.id and company_id=v_company;
  perform public.carez_sync_takeoff_measurement_outputs(v_measurement.id,p_outputs); return v_measurement.id;
end;
$$;
revoke all on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb) from public,anon;
grant execute on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb) to authenticated;
