-- Reusable nested construction-method modules remain immutable assembly recipes.

alter table public.concrete_assemblies
  add column if not exists direct_takeoff_enabled boolean not null default true;

alter table public.concrete_assembly_children
  add column if not exists activation_rule jsonb;

create or replace function public.carez_validate_assembly_version_publish()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='published' and old.status<>'published' then
    if not exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id) and not exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id) then raise exception 'An assembly version must contain at least one output component or child assembly before publishing.'; end if;
    if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and (not public.carez_formula_ast_is_valid(c.quantity_formula) or (c.labor_rate_formula is not null and not public.carez_formula_ast_is_valid(c.labor_rate_formula)))) then raise exception 'Every assembly component formula must use the supported deterministic formula syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule)) then raise exception 'Every assembly component activation rule must use the supported deterministic rule syntax.'; end if;
    if exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule)) then raise exception 'Every child assembly activation rule must use the supported deterministic rule syntax.'; end if;
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
  select * into v_source from public.concrete_assembly_versions where id=p_assembly_version_id and company_id=v_company; if not found then raise exception 'Assembly version not found.'; end if;
  if v_source.status='draft' then raise exception 'Continue editing the existing draft instead of creating a revision from it.'; end if;
  select * into v_assembly from public.concrete_assemblies where id=v_source.assembly_id and company_id=v_company for update; if not found then raise exception 'Assembly not found.'; end if;
  if exists(select 1 from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id and status='draft') then raise exception 'This assembly already has a draft revision.'; end if;
  select coalesce(max(version_no),0)+1 into v_next from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id;
  insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes,assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,render_config,created_by) values(v_company,v_source.assembly_id,v_next,'draft',v_source.source_type,v_source.source_label,v_source.source_year,v_source.source_reference,v_source.default_risk_class_code,v_source.notes,v_assembly.code,v_assembly.name,v_assembly.category,v_assembly.primary_measurement,v_assembly.description,v_source.render_config,auth.uid()) returning id into v_new;
  insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override) select company_id,v_new,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override from public.concrete_assembly_variables where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order,activation_rule,resource_behavior,estimate_visible) select company_id,v_new,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order,activation_rule,resource_behavior,estimate_visible from public.concrete_assembly_components where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_children(company_id,assembly_version_id,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,activation_rule,sort_order,created_by) select company_id,v_new,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,activation_rule,sort_order,auth.uid() from public.concrete_assembly_children where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_property_bindings(company_id,assembly_version_id,variable_id,source_namespace,source_key,precedence,notes,sort_order,created_by) select b.company_id,v_new,nv.id,b.source_namespace,b.source_key,b.precedence,b.notes,b.sort_order,auth.uid() from public.concrete_assembly_property_bindings b join public.concrete_assembly_variables ov on ov.id=b.variable_id and ov.company_id=b.company_id join public.concrete_assembly_variables nv on nv.company_id=b.company_id and nv.assembly_version_id=v_new and nv.variable_key=ov.variable_key where b.company_id=v_company and b.assembly_version_id=v_source.id;
  return v_new;
end;
$$;
revoke all on function public.carez_create_assembly_revision(uuid) from public,anon;
grant execute on function public.carez_create_assembly_revision(uuid) to authenticated,service_role;
