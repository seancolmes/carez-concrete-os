create or replace function public.carez_takeoff_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end $$;

create or replace function public.carez_formula_ast_is_valid(p_expr jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare v_type text; v_op text; v_arg jsonb; v_case jsonb;
begin
  if p_expr is null then return false; end if;
  v_type:=jsonb_typeof(p_expr);
  if v_type='number' then return true; end if;
  if v_type<>'object' then return false; end if;
  if p_expr ? 'const' then return jsonb_typeof(p_expr->'const')='number'; end if;
  if p_expr ? 'var' then return jsonb_typeof(p_expr->'var')='string' and length(trim(p_expr->>'var'))>0; end if;
  v_op:=coalesce(p_expr->>'op','');
  if v_op in ('add','sub','mul','div','min','max') then
    if jsonb_typeof(p_expr->'args')<>'array' then return false; end if;
    if v_op='div' and jsonb_array_length(p_expr->'args')<>2 then return false; end if;
    for v_arg in select value from jsonb_array_elements(p_expr->'args') loop
      if not public.carez_formula_ast_is_valid(v_arg) then return false; end if;
    end loop;
    return true;
  elsif v_op in ('ceil','floor','round') then
    return public.carez_formula_ast_is_valid(p_expr->'value');
  elsif v_op='piecewise_lte' then
    if not public.carez_formula_ast_is_valid(p_expr->'value') or jsonb_typeof(p_expr->'cases')<>'array' then return false; end if;
    for v_case in select value from jsonb_array_elements(p_expr->'cases') loop
      if jsonb_typeof(v_case)<>'object' or jsonb_typeof(v_case->'lte')<>'number' or not(v_case?'then') or not public.carez_formula_ast_is_valid(v_case->'then') then return false; end if;
    end loop;
    return (p_expr?'else') and public.carez_formula_ast_is_valid(p_expr->'else');
  end if;
  return false;
end $$;

create or replace function public.carez_activation_rule_value_is_valid(p_value jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then return false; end if;
  if p_value?'var' then return jsonb_typeof(p_value->'var')='string' and length(trim(p_value->>'var'))>0; end if;
  if p_value?'const' then
    return jsonb_typeof(p_value->'const') in ('string','number','boolean','null')
      or (jsonb_typeof(p_value->'const')='array' and not exists(select 1 from jsonb_array_elements(p_value->'const') x where jsonb_typeof(x) not in ('string','number','boolean','null')));
  end if;
  return false;
end $$;

create or replace function public.carez_activation_rule_is_valid(p_rule jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare v_op text;
begin
  if p_rule is null or jsonb_typeof(p_rule)<>'object' then return false; end if;
  v_op:=coalesce(p_rule->>'op','');
  if v_op in ('eq','neq','gt','gte','lt','lte') then
    return public.carez_activation_rule_value_is_valid(p_rule->'left') and public.carez_activation_rule_value_is_valid(p_rule->'right');
  elsif v_op in ('and','or') then
    return jsonb_typeof(p_rule->'args')='array' and jsonb_array_length(p_rule->'args')>0
      and not exists(select 1 from jsonb_array_elements(p_rule->'args') x where not public.carez_activation_rule_is_valid(x));
  elsif v_op='not' then return public.carez_activation_rule_is_valid(p_rule->'arg');
  elsif v_op='exists' then return public.carez_activation_rule_value_is_valid(p_rule->'value');
  elsif v_op='in' then
    return public.carez_activation_rule_value_is_valid(p_rule->'value') and jsonb_typeof(p_rule->'values')='array'
      and not exists(select 1 from jsonb_array_elements(p_rule->'values') x where not public.carez_activation_rule_value_is_valid(x));
  end if;
  return false;
end $$;

create or replace function public.carez_variable_activation_rule_is_valid(p_rule jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
begin
  if p_rule is null then return true; end if;
  return public.carez_activation_rule_is_valid(p_rule);
exception when others then return false;
end $$;

create or replace function public.carez_guard_assembly_identity_measurement()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.primary_measurement is distinct from old.primary_measurement and exists(
    select 1 from public.concrete_assembly_versions v where v.company_id=old.company_id and v.assembly_id=old.id and v.status='published'
  ) then raise exception 'Primary measurement is part of published assembly lineage. Create a new assembly identity.'; end if;
  return new;
end $$;

create or replace function public.carez_guard_published_assembly_child()
returns trigger language plpgsql set search_path=public as $$
declare v_old_status text; v_new_status text;
begin
  if tg_op in ('UPDATE','DELETE') then
    select status into v_old_status from public.concrete_assembly_versions where id=old.assembly_version_id;
    if v_old_status='published' then raise exception 'Published assembly components, properties, bindings, and child links are immutable. Create a new assembly version.'; end if;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    select status into v_new_status from public.concrete_assembly_versions where id=new.assembly_version_id;
    if v_new_status='published' then raise exception 'Published assembly components, properties, bindings, and child links are immutable. Create a new assembly version.'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.carez_guard_published_assembly_version()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='DELETE' then
    if old.status='published' then raise exception 'Published assembly versions are immutable. Create a new version.'; end if;
    return old;
  end if;
  if old.status='published' then raise exception 'Published assembly versions are immutable. Create a new version.'; end if;
  if new.status='published' and new.published_at is null then new.published_at=now(); end if;
  return new;
end $$;

create or replace function public.carez_guard_assembly_child_cycle()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.assembly_version_id=new.child_assembly_version_id then raise exception 'An assembly version cannot include itself.'; end if;
  if exists(
    with recursive descendants(version_id) as (
      select new.child_assembly_version_id
      union
      select c.child_assembly_version_id from public.concrete_assembly_children c join descendants d on d.version_id=c.assembly_version_id
      where c.company_id=new.company_id and c.id<>new.id
    ) select 1 from descendants where version_id=new.assembly_version_id
  ) then raise exception 'Assembly child relationship would create a cycle.'; end if;
  return new;
end $$;

create or replace function public.carez_validate_assembly_version_publish()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='published' and old.status<>'published' then
    if not exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id)
       and not exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id)
      then raise exception 'An assembly version must contain at least one output component or child assembly before publishing.'; end if;
    if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and (not public.carez_formula_ast_is_valid(c.quantity_formula) or (c.labor_rate_formula is not null and not public.carez_formula_ast_is_valid(c.labor_rate_formula))))
      then raise exception 'Every assembly component formula must use the supported deterministic formula syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule))
      then raise exception 'Every assembly component activation rule must use the supported deterministic rule syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule))
      then raise exception 'Every child assembly activation rule must use the supported deterministic rule syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_variables v where v.company_id=new.company_id and v.assembly_version_id=new.id and v.activation_rule is not null and not public.carez_variable_activation_rule_is_valid(v.activation_rule))
      then raise exception 'Every assembly property activation rule must use the supported deterministic rule syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_children c join public.concrete_assembly_versions v on v.id=c.child_assembly_version_id and v.company_id=c.company_id where c.company_id=new.company_id and c.assembly_version_id=new.id and v.status<>'published')
      then raise exception 'Every child assembly version must be published before the parent can be published.'; end if;
    if exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id and not public.carez_formula_ast_is_valid(c.quantity_formula))
      then raise exception 'Every child quantity formula must use the supported deterministic formula syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_children c cross join lateral jsonb_each(c.variable_bindings) b where c.company_id=new.company_id and c.assembly_version_id=new.id and (not exists(select 1 from public.concrete_assembly_variables cv where cv.company_id=c.company_id and cv.assembly_version_id=c.child_assembly_version_id and cv.variable_key=b.key) or not public.carez_formula_ast_is_valid(b.value)))
      then raise exception 'Child property bindings must target child properties and use supported deterministic formulas.'; end if;
    if exists(select 1 from public.concrete_assembly_property_bindings b where b.company_id=new.company_id and b.assembly_version_id=new.id and b.source_namespace='property' and not exists(select 1 from public.concrete_assembly_variables v where v.company_id=b.company_id and v.assembly_version_id=b.assembly_version_id and v.variable_key=b.source_key))
      then raise exception 'Property-to-property bindings must reference a property in the same assembly version.'; end if;
  end if;
  return new;
end $$;

create or replace function public.carez_assembly_component_paths(p_company_id uuid,p_root_version_id uuid)
returns table(component_id uuid,component_path_key text,component_label text,component_version_id uuid)
language sql stable set search_path=public as $$
  with recursive tree(version_id,path_key,depth,visited) as (
    select v.id,''::text,0,array[v.id] from public.concrete_assembly_versions v
    where v.id=p_root_version_id and v.company_id=p_company_id and v.status='published'
    union all
    select ch.child_assembly_version_id,case when t.path_key='' then ch.child_key else t.path_key||'/'||ch.child_key end,
           t.depth+1,t.visited||ch.child_assembly_version_id
    from tree t join public.concrete_assembly_children ch on ch.company_id=p_company_id and ch.assembly_version_id=t.version_id
    join public.concrete_assembly_versions cv on cv.company_id=ch.company_id and cv.id=ch.child_assembly_version_id and cv.status='published'
    where t.depth<16 and not ch.child_assembly_version_id=any(t.visited)
  )
  select c.id,case when t.path_key='' then c.component_key else t.path_key||'/'||c.component_key end,c.label,c.assembly_version_id
  from tree t join public.concrete_assembly_components c on c.company_id=p_company_id and c.assembly_version_id=t.version_id;
$$;

create or replace function public.carez_sync_takeoff_measurement_outputs(p_measurement_id uuid,p_outputs jsonb)
returns void language plpgsql set search_path=public as $$
declare
  v_company uuid:=public.get_my_company_id(); v_measurement public.takeoff_measurements%rowtype; v_payload jsonb;
  v_component public.concrete_assembly_components%rowtype; v_output public.takeoff_measurement_outputs%rowtype;
  v_item_id uuid; v_expected integer; v_actual integer; v_path text; v_active boolean; v_visible boolean; v_behavior text;
  v_qty numeric; v_hours numeric; v_unit_cost numeric; v_direct numeric; v_cost_source text; v_status text; v_sort integer:=100;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then raise exception 'Assembly outputs must be an array.'; end if;
  select count(*) into v_expected from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id);
  select count(distinct value->>'component_key') into v_actual from jsonb_array_elements(p_outputs);
  if v_expected=0 or jsonb_array_length(p_outputs)<>v_expected or v_actual<>v_expected then raise exception 'Assembly output set is incomplete or contains duplicate component paths.'; end if;
  if exists(select 1 from jsonb_array_elements(p_outputs) p(value) where not exists(
    select 1 from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f
    where f.component_id=nullif(p.value->>'assembly_component_id','')::uuid and f.component_path_key=p.value->>'component_key'
  )) then raise exception 'Assembly output component path does not belong to the takeoff assembly.'; end if;

  for v_payload in select value from jsonb_array_elements(p_outputs) loop
    v_path:=v_payload->>'component_key';
    select c.* into v_component
    from public.concrete_assembly_components c
    join public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f on f.component_id=c.id
    where c.company_id=v_company and f.component_path_key=v_path and c.id=nullif(v_payload->>'assembly_component_id','')::uuid limit 1;
    if v_component.id is null then raise exception 'Output component path does not belong to the takeoff assembly.'; end if;
    v_active:=coalesce(nullif(v_payload->>'is_active','')::boolean,true);
    v_visible:=coalesce(nullif(v_payload->>'estimate_visible','')::boolean,v_component.estimate_visible,true);
    v_behavior:=coalesce(nullif(v_payload->>'resource_behavior',''),nullif(v_component.resource_behavior,''),
      case v_component.estimate_item_type when 'labor' then 'labor' when 'material' then 'consumed_material' when 'equipment' then 'owned_equipment' when 'subcontractor' then 'subcontractor' else 'legacy_other' end);
    v_qty:=case when v_active then greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0) else 0 end;
    v_hours:=case when v_active then greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0) else 0 end;

    select * into v_output from public.takeoff_measurement_outputs o
    where o.company_id=v_company and o.measurement_id=v_measurement.id and o.assembly_component_id=v_component.id and o.component_key=v_path for update;
    if v_active and v_output.id is not null and v_output.pricing_status='manual_override' then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0); v_cost_source:=coalesce(v_output.cost_source,'manual_override'); v_status:='manual_override';
      v_direct:=round((case when v_component.estimate_item_type='labor' then v_hours else v_qty end)*v_unit_cost,2);
    else
      v_unit_cost:=case when v_active then greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0) else 0 end;
      v_cost_source:=case when v_active then nullif(v_payload->>'cost_source','') else null end;
      v_status:=case when v_active then coalesce(v_payload->>'pricing_status','missing_price') else 'not_priced' end;
      v_direct:=case when v_active then greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0) else 0 end;
    end if;

    if v_output.id is null then
      insert into public.takeoff_measurement_outputs(company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,production_quantity,production_unit,estimated_man_hours,baseline_man_hours_per_unit,baseline_source,unit_cost,cost_source,direct_cost,pricing_status,is_active,resource_behavior,estimate_visible,formula_trace)
      values(v_company,v_measurement.id,v_component.id,v_path,v_component.label,v_component.estimate_item_type,v_component.cost_code_id,v_component.catalog_item_id,v_component.production_task_id,v_qty,v_component.output_unit,v_hours,nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,v_component.baseline_source,v_unit_cost,v_cost_source,v_direct,v_status,v_active,v_behavior,v_visible,coalesce(v_payload->'formula_trace','{}'::jsonb)) returning * into v_output;
    else
      update public.takeoff_measurement_outputs set production_quantity=v_qty,production_unit=v_component.output_unit,estimated_man_hours=v_hours,
        baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,baseline_source=v_component.baseline_source,
        unit_cost=v_unit_cost,cost_source=v_cost_source,direct_cost=v_direct,pricing_status=v_status,is_active=v_active,
        resource_behavior=v_behavior,estimate_visible=v_visible,formula_trace=coalesce(v_payload->'formula_trace','{}'::jsonb),updated_at=now()
      where id=v_output.id returning * into v_output;
    end if;

    if not v_active or not v_visible then
      delete from public.estimate_items where company_id=v_company and source_takeoff_output_id=v_output.id;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=null where id=v_output.id;
    else
      select id into v_item_id from public.estimate_items where company_id=v_company and source_takeoff_output_id=v_output.id for update;
      if v_item_id is null then
        insert into public.estimate_items(company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source)
        values(v_company,v_measurement.estimate_id,v_measurement.estimate_section_id,v_component.estimate_item_type,v_component.cost_code_id,v_component.catalog_item_id,v_component.labor_task,
          case when v_component.estimate_item_type='labor' then v_measurement.risk_class_code else null end,
          v_measurement.name||' — '||v_path||' — '||v_component.label,
          case when v_component.estimate_item_type='labor' then v_hours else v_qty end,
          case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
          v_unit_cost,v_direct,case when v_component.estimate_item_type='labor' then v_hours else 0 end,0,
          'Generated by Takeoff / Assembly Engine. Edit the physical takeoff or component price rather than this line.',v_sort,
          v_output.id,v_measurement.id,v_measurement.assembly_version_id,v_component.production_task_id,v_qty,v_component.output_unit,
          nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,v_component.baseline_source) returning id into v_item_id;
      else
        update public.estimate_items set quantity=case when v_component.estimate_item_type='labor' then v_hours else v_qty end,
          unit=case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
          unit_cost=v_unit_cost,direct_cost=v_direct,regular_hours=case when v_component.estimate_item_type='labor' then v_hours else 0 end,overtime_hours=0,
          production_task_id=v_component.production_task_id,production_quantity=v_qty,production_unit=v_component.output_unit,
          baseline_man_hours_per_unit=nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric,baseline_source=v_component.baseline_source,updated_at=now()
        where id=v_item_id and company_id=v_company;
      end if;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=v_item_id where id=v_output.id;
      v_sort:=v_sort+10;
    end if;
  end loop;
end $$;

create or replace function public.carez_commit_takeoff_measurement(
  p_takeoff_set_id uuid,p_estimate_section_id uuid,p_assembly_version_id uuid,p_name text,p_location text,p_drawing_reference text,
  p_measurement_type text,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_risk_class_code text,p_outputs jsonb)
returns uuid language plpgsql set search_path=public as $$
declare v_company uuid:=public.get_my_company_id(); v_estimate uuid; v_measurement uuid; v_status text;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Takeoff object name is required.'; end if;
  select s.estimate_id into v_estimate from public.takeoff_sets s where s.id=p_takeoff_set_id and s.company_id=v_company and s.status='active';
  if v_estimate is null then raise exception 'Active takeoff set not found.'; end if;
  select status into v_status from public.estimates where id=v_estimate and company_id=v_company;
  if v_status is null then raise exception 'Estimate not found.'; end if;
  if v_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company and p.estimate_id=v_estimate) then raise exception 'This estimate revision is locked.'; end if;
  if not exists(select 1 from public.concrete_assembly_versions v where v.id=p_assembly_version_id and v.company_id=v_company and v.status='published') then raise exception 'Published concrete assembly version not found.'; end if;
  if p_estimate_section_id is not null and not exists(select 1 from public.estimate_sections s where s.id=p_estimate_section_id and s.estimate_id=v_estimate and s.company_id=v_company) then raise exception 'Estimate scope section does not belong to this estimate.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  if nullif(trim(p_risk_class_code),'') is not null and not exists(select 1 from public.li_risk_classes r where r.company_id=v_company and r.code=trim(p_risk_class_code) and r.active) then raise exception 'Selected L&I class is not active for this company.'; end if;
  insert into public.takeoff_measurements(company_id,takeoff_set_id,estimate_id,estimate_section_id,assembly_version_id,name,location,drawing_reference,measurement_type,raw_quantity,raw_unit,variables,risk_class_code,source,created_by)
  values(v_company,p_takeoff_set_id,v_estimate,p_estimate_section_id,p_assembly_version_id,trim(p_name),nullif(trim(p_location),''),nullif(trim(p_drawing_reference),''),p_measurement_type,p_raw_quantity,p_raw_unit,coalesce(p_variables,'{}'::jsonb),nullif(trim(p_risk_class_code),''),'manual',auth.uid()) returning id into v_measurement;
  perform public.carez_sync_takeoff_measurement_outputs(v_measurement,p_outputs);
  return v_measurement;
end $$;

create or replace function public.carez_commit_drawing_measurement(
  p_takeoff_set_id uuid,p_sheet_id uuid,p_estimate_section_id uuid,p_assembly_version_id uuid,p_name text,p_location text,p_drawing_reference text,
  p_measurement_type text,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_risk_class_code text,p_geometry jsonb,p_outputs jsonb)
returns uuid language plpgsql set search_path=public as $$
declare v_company_id uuid; v_measurement_id uuid;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if p_sheet_id is null or not exists(select 1 from public.takeoff_sheets s where s.id=p_sheet_id and s.company_id=v_company_id and s.takeoff_set_id=p_takeoff_set_id) then raise exception 'Drawing sheet does not belong to this takeoff set.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  v_measurement_id:=public.carez_commit_takeoff_measurement(p_takeoff_set_id,p_estimate_section_id,p_assembly_version_id,p_name,p_location,p_drawing_reference,p_measurement_type,p_raw_quantity,p_raw_unit,p_variables,p_risk_class_code,p_outputs);
  update public.takeoff_measurements set sheet_id=p_sheet_id,geometry=p_geometry,source='drawing' where id=v_measurement_id and company_id=v_company_id;
  return v_measurement_id;
end $$;

create or replace function public.carez_update_drawing_measurement(p_measurement_id uuid,p_geometry jsonb,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_outputs jsonb)
returns uuid language plpgsql set search_path=public as $$
declare v_company uuid:=public.get_my_company_id(); v_measurement public.takeoff_measurements%rowtype; v_status text;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select * into v_measurement from public.takeoff_measurements where id=p_measurement_id and company_id=v_company for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;
  if v_measurement.source<>'drawing' or v_measurement.sheet_id is null then raise exception 'Only drawing takeoff geometry can be edited here.'; end if;
  select status into v_status from public.estimates where id=v_measurement.estimate_id and company_id=v_company;
  if v_status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations p where p.company_id=v_company and p.estimate_id=v_measurement.estimate_id) then raise exception 'This estimate revision is locked.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  if p_raw_quantity<0 then raise exception 'Takeoff quantity cannot be negative.'; end if;
  update public.takeoff_measurements set raw_quantity=p_raw_quantity,raw_unit=p_raw_unit,variables=coalesce(p_variables,'{}'::jsonb),geometry=p_geometry,updated_at=now() where id=v_measurement.id and company_id=v_company;
  perform public.carez_sync_takeoff_measurement_outputs(v_measurement.id,p_outputs);
  return v_measurement.id;
end $$;

create or replace function public.carez_delete_takeoff_measurement(p_measurement_id uuid)
returns void language plpgsql set search_path=public as $$
declare v_company_id uuid; v_estimate_id uuid;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select estimate_id into v_estimate_id from public.takeoff_measurements where id=p_measurement_id and company_id=v_company_id;
  if v_estimate_id is null then raise exception 'Takeoff measurement not found.'; end if;
  if exists(select 1 from public.proposal_presentations where company_id=v_company_id and estimate_id=v_estimate_id) or exists(select 1 from public.estimates where id=v_estimate_id and status in ('accepted','approved','superseded')) then raise exception 'This estimate revision is locked.'; end if;
  delete from public.estimate_items where company_id=v_company_id and source_takeoff_measurement_id=p_measurement_id;
  delete from public.takeoff_measurements where id=p_measurement_id and company_id=v_company_id;
end $$;

create or replace function public.carez_update_takeoff_output_price(p_output_id uuid,p_unit_cost numeric)
returns void language plpgsql set search_path=public as $$
declare v_company_id uuid; v_output public.takeoff_measurement_outputs%rowtype; v_estimate_id uuid; v_new_cost numeric;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if p_unit_cost<0 then raise exception 'Unit cost cannot be negative.'; end if;
  select * into v_output from public.takeoff_measurement_outputs where id=p_output_id and company_id=v_company_id;
  if v_output.id is null then raise exception 'Takeoff output not found.'; end if;
  select estimate_id into v_estimate_id from public.takeoff_measurements where id=v_output.measurement_id;
  if exists(select 1 from public.proposal_presentations where company_id=v_company_id and estimate_id=v_estimate_id) or exists(select 1 from public.estimates where id=v_estimate_id and status in ('accepted','approved','superseded')) then raise exception 'This estimate revision is locked.'; end if;
  if v_output.estimate_item_type='labor' then v_new_cost:=round(v_output.estimated_man_hours*p_unit_cost,2); else v_new_cost:=round(v_output.production_quantity*p_unit_cost,2); end if;
  update public.takeoff_measurement_outputs set unit_cost=p_unit_cost,direct_cost=v_new_cost,pricing_status='manual_override',cost_source='manual takeoff override' where id=p_output_id;
  update public.estimate_items set unit_cost=p_unit_cost,direct_cost=v_new_cost where id=v_output.generated_estimate_item_id and company_id=v_company_id;
end $$;

create or replace function public.carez_save_takeoff_sheet_calibration(p_sheet_id uuid,p_page_width numeric,p_page_height numeric,p_calibration jsonb)
returns void language plpgsql set search_path=public as $$
declare v_company_id uuid; v_estimate_id uuid;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  select ts.estimate_id into v_estimate_id from public.takeoff_sheets sh join public.takeoff_sets ts on ts.id=sh.takeoff_set_id where sh.id=p_sheet_id and sh.company_id=v_company_id;
  if v_estimate_id is null then raise exception 'Takeoff sheet not found.'; end if;
  if exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_estimate_id) or exists(select 1 from public.estimates e where e.id=v_estimate_id and e.status in ('accepted','approved','superseded')) then raise exception 'This estimate revision is locked.'; end if;
  if p_page_width<=0 or p_page_height<=0 then raise exception 'PDF page dimensions are invalid.'; end if;
  if p_calibration is null or coalesce((p_calibration->>'known_distance_ft')::numeric,0)<=0 or coalesce((p_calibration->>'pdf_distance')::numeric,0)<=0 then raise exception 'Calibration requires a known real distance and two distinct drawing points.'; end if;
  update public.takeoff_sheets set page_width=p_page_width,page_height=p_page_height,calibration=p_calibration,scale_status='calibrated' where id=p_sheet_id and company_id=v_company_id;
end $$;

create or replace function public.carez_attach_takeoff_plan(p_takeoff_set_id uuid,p_storage_path text,p_source_filename text,p_mime_type text default 'application/pdf')
returns uuid language plpgsql set search_path=public as $$
declare v_company_id uuid; v_estimate_id uuid; v_existing_document_id uuid; v_document_id uuid; v_expected_prefix text;
begin
  v_company_id:=public.get_my_company_id();
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if nullif(trim(p_storage_path),'') is null or nullif(trim(p_source_filename),'') is null then raise exception 'PDF plan file is required.'; end if;
  if length(trim(p_storage_path))>500 or length(trim(p_source_filename))>255 then raise exception 'Plan file name or path is too long.'; end if;
  if lower(coalesce(p_mime_type,''))<>'application/pdf' and lower(p_source_filename) not like '%.pdf' then raise exception 'The drawing workspace currently requires a PDF plan set.'; end if;
  v_expected_prefix:=v_company_id::text||'/plans/';
  if position(v_expected_prefix in trim(p_storage_path))<>1 then raise exception 'Plan storage path does not belong to this company.'; end if;
  select ts.estimate_id,ts.source_document_id into v_estimate_id,v_existing_document_id from public.takeoff_sets ts where ts.id=p_takeoff_set_id and ts.company_id=v_company_id and ts.status='active' for update;
  if v_estimate_id is null then raise exception 'Active takeoff set not found.'; end if;
  if v_existing_document_id is not null then raise exception 'This takeoff revision already has a source plan. Create a new takeoff/estimate revision to replace plans.'; end if;
  if exists(select 1 from public.proposal_presentations pp where pp.company_id=v_company_id and pp.estimate_id=v_estimate_id) or exists(select 1 from public.estimates e where e.id=v_estimate_id and e.company_id=v_company_id and e.status in ('accepted','approved','superseded')) then raise exception 'This estimate revision is locked.'; end if;
  if exists(select 1 from public.takeoff_measurements m where m.company_id=v_company_id and m.takeoff_set_id=p_takeoff_set_id and m.status='active') then raise exception 'This takeoff already contains measurements. Create a new takeoff revision before attaching different source plans.'; end if;
  insert into public.company_documents(company_id,document_type,title,storage_path,mime_type,source,review_status,reviewed_at,reviewed_by,notes,created_by)
  values(v_company_id,'plan',trim(p_source_filename),trim(p_storage_path),'application/pdf','upload','filed',now(),(select auth.uid()),'Source plans for takeoff set '||p_takeoff_set_id::text,(select auth.uid())) returning id into v_document_id;
  update public.takeoff_sets set source_document_id=v_document_id,source_filename=trim(p_source_filename),page_count=null where id=p_takeoff_set_id and company_id=v_company_id;
  return v_document_id;
end $$;

create trigger carez_concrete_assemblies_touch before update on public.concrete_assemblies for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_guard_assembly_identity_measurement before update of primary_measurement on public.concrete_assemblies for each row execute function public.carez_guard_assembly_identity_measurement();
create trigger carez_concrete_assembly_versions_touch before update on public.concrete_assembly_versions for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_guard_published_assembly_version before delete or update on public.concrete_assembly_versions for each row execute function public.carez_guard_published_assembly_version();
create trigger carez_validate_assembly_version_publish before update on public.concrete_assembly_versions for each row execute function public.carez_validate_assembly_version_publish();
create trigger carez_guard_published_assembly_variables before insert or delete or update on public.concrete_assembly_variables for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_guard_published_assembly_components before insert or delete or update on public.concrete_assembly_components for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_concrete_assembly_children_touch before update on public.concrete_assembly_children for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_guard_assembly_child_cycle before insert or update on public.concrete_assembly_children for each row execute function public.carez_guard_assembly_child_cycle();
create trigger carez_guard_published_assembly_children before insert or delete or update on public.concrete_assembly_children for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_concrete_assembly_property_bindings_touch before update on public.concrete_assembly_property_bindings for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_guard_published_assembly_bindings before insert or delete or update on public.concrete_assembly_property_bindings for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_takeoff_sets_touch before update on public.takeoff_sets for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_sheets_touch before update on public.takeoff_sheets for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_measurements_touch before update on public.takeoff_measurements for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_outputs_touch before update on public.takeoff_measurement_outputs for each row execute function public.carez_takeoff_touch_updated_at();

revoke all on function public.carez_commit_takeoff_measurement(uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb) from public,anon;
revoke all on function public.carez_sync_takeoff_measurement_outputs(uuid,jsonb) from public,anon;
revoke all on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb) from public,anon;
revoke all on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb) from public,anon;
revoke all on function public.carez_delete_takeoff_measurement(uuid) from public,anon;
revoke all on function public.carez_update_takeoff_output_price(uuid,numeric) from public,anon;
revoke all on function public.carez_save_takeoff_sheet_calibration(uuid,numeric,numeric,jsonb) from public,anon;
revoke all on function public.carez_attach_takeoff_plan(uuid,text,text,text) from public,anon;
grant execute on function public.carez_commit_takeoff_measurement(uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb) to authenticated;
grant execute on function public.carez_sync_takeoff_measurement_outputs(uuid,jsonb) to authenticated;
grant execute on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb) to authenticated;
grant execute on function public.carez_update_drawing_measurement(uuid,jsonb,numeric,text,jsonb,jsonb) to authenticated;
grant execute on function public.carez_delete_takeoff_measurement(uuid) to authenticated;
grant execute on function public.carez_update_takeoff_output_price(uuid,numeric) to authenticated;
grant execute on function public.carez_save_takeoff_sheet_calibration(uuid,numeric,numeric,jsonb) to authenticated;
grant execute on function public.carez_attach_takeoff_plan(uuid,text,text,text) to authenticated;;
