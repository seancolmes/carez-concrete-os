-- Completes the full existing publication checks with variable applicability validation.
create or replace function public.carez_validate_assembly_version_publish() returns trigger language plpgsql set search_path=public as $$ begin
 if new.status='published' and old.status<>'published' then
  if not exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id) and not exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id) then raise exception 'An assembly version must contain at least one output component or child assembly before publishing.'; end if;
  if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and (not public.carez_formula_ast_is_valid(c.quantity_formula) or (c.labor_rate_formula is not null and not public.carez_formula_ast_is_valid(c.labor_rate_formula)))) then raise exception 'Every assembly component formula must use the supported deterministic formula syntax.'; end if;
  if exists(select 1 from public.concrete_assembly_components c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule)) then raise exception 'Every assembly component activation rule must use the supported deterministic rule syntax.'; end if;
  if exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id and c.activation_rule is not null and not public.carez_activation_rule_is_valid(c.activation_rule)) then raise exception 'Every child assembly activation rule must use the supported deterministic rule syntax.'; end if;
  if exists(select 1 from public.concrete_assembly_variables v where v.company_id=new.company_id and v.assembly_version_id=new.id and v.activation_rule is not null and not public.carez_variable_activation_rule_is_valid(v.activation_rule)) then raise exception 'Every assembly property activation rule must use the supported deterministic rule syntax.'; end if;
  if exists(select 1 from public.concrete_assembly_children c join public.concrete_assembly_versions v on v.id=c.child_assembly_version_id and v.company_id=c.company_id where c.company_id=new.company_id and c.assembly_version_id=new.id and v.status<>'published') then raise exception 'Every child assembly version must be published before the parent can be published.'; end if;
  if exists(select 1 from public.concrete_assembly_children c where c.company_id=new.company_id and c.assembly_version_id=new.id and not public.carez_formula_ast_is_valid(c.quantity_formula)) then raise exception 'Every child quantity formula must use the supported deterministic formula syntax.'; end if;
  if exists(select 1 from public.concrete_assembly_children c cross join lateral jsonb_each(c.variable_bindings) b where c.company_id=new.company_id and c.assembly_version_id=new.id and (not exists(select 1 from public.concrete_assembly_variables cv where cv.company_id=c.company_id and cv.assembly_version_id=c.child_assembly_version_id and cv.variable_key=b.key) or not public.carez_formula_ast_is_valid(b.value))) then raise exception 'Child property bindings must target child properties and use supported deterministic formulas.'; end if;
  if exists(select 1 from public.concrete_assembly_property_bindings b where b.company_id=new.company_id and b.assembly_version_id=new.id and b.source_namespace='property' and not exists(select 1 from public.concrete_assembly_variables v where v.company_id=b.company_id and v.assembly_version_id=b.assembly_version_id and v.variable_key=b.source_key)) then raise exception 'Property-to-property bindings must reference a property in the same assembly version.'; end if;
 end if; return new; end $$;
revoke all on function public.carez_validate_assembly_version_publish() from public,anon,authenticated;

do $$
declare definition text;
begin
 select pg_get_functiondef('public.carez_create_assembly_revision(uuid)'::regprocedure) into definition;
 definition := replace(definition,
  'property_group,expose_in_takeoff,allow_override) select company_id,v_new,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override from public.concrete_assembly_variables',
  'property_group,expose_in_takeoff,allow_override,activation_rule) select company_id,v_new,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override,activation_rule from public.concrete_assembly_variables');
 if position('allow_override,activation_rule' in definition)=0 then raise exception 'Could not extend canonical assembly revision variable clone.'; end if;
 execute definition;
end $$;
