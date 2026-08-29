-- Expand Carez's 2026 concrete L&I catalog from the broad 214/217 rate classes
-- into the WAC scope subtypes. Washington's 2026 rate sheet carries one rate for
-- class 214 and one for class 217; the WAC descriptions split the work into subtypes.
-- Existing company rates are copied so the burden remains exact.

insert into public.li_risk_classes(company_id,tax_year,code,name,composite_rate_per_hour,employee_deduction_per_hour,employer_rate_per_hour,active)
select r.company_id,r.tax_year,x.code,x.name,r.composite_rate_per_hour,r.employee_deduction_per_hour,r.employer_rate_per_hour,r.active
from public.li_risk_classes r
cross join (values
  ('0214-00','Concrete paving / repaving — roadways N.O.C.'),
  ('0214-02','Concrete median / retaining walls — roadways'),
  ('0214-03','Concrete sawing / drilling / cutting — roadways')
) as x(code,name)
where r.tax_year=2026 and r.code='0214-01'
on conflict (company_id,tax_year,code) do nothing;

insert into public.li_risk_classes(company_id,tax_year,code,name,composite_rate_per_hour,employee_deduction_per_hour,employer_rate_per_hour,active)
select r.company_id,r.tax_year,x.code,x.name,r.composite_rate_per_hour,r.employee_deduction_per_hour,r.employer_rate_per_hour,r.active
from public.li_risk_classes r
cross join (values
  ('0217-00','Concrete flatwork — N.O.C.'),
  ('0217-02','Concrete sawing / drilling / cutting — N.O.C.')
) as x(code,name)
where r.tax_year=2026 and r.code='0217-01'
on conflict (company_id,tax_year,code) do nothing;

-- FLAT-BROOM v2: generic non-roadway flatwork belongs in 0217-00 by default.
-- Preserve v1 exactly; clone its formulas into a new published version.
do $$
declare
  a record;
  prior_id uuid;
  new_id uuid;
begin
  for a in
    select id,company_id from public.concrete_assemblies where code='FLAT-BROOM'
  loop
    if not exists(select 1 from public.concrete_assembly_versions where assembly_id=a.id and version_no=2) then
      select id into prior_id from public.concrete_assembly_versions where assembly_id=a.id and version_no=1;
      insert into public.concrete_assembly_versions(
        company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes
      ) values (
        a.company_id,a.id,2,'draft','blended','2026 National Construction Estimator + WAC 296-17A-0217',2026,
        'Productivity baselines preserved from v1. WAC 296-17A-0217-00 covers concrete flatwork N.O.C.; the 2026 rate sheet prices broad class 217, shared by its subtypes.',
        '0217-00',
        'General non-roadway flatwork defaults to 0217-00. Select 0217-01 when the scope is specifically foundation/flatwork in connection with a wood-frame structure.'
      ) returning id into new_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order)
      select company_id,new_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order
      from public.concrete_assembly_variables where assembly_version_id=prior_id order by sort_order;

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order)
      select company_id,new_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order
      from public.concrete_assembly_components where assembly_version_id=prior_id order by sort_order;

      update public.concrete_assembly_versions set status='published' where id=new_id;
    end if;
  end loop;
end $$;

-- ROW retaining wall v2 documents the rate/subtype relationship without editing v1.
do $$
declare
  a record;
  prior_id uuid;
  new_id uuid;
begin
  for a in
    select id,company_id from public.concrete_assemblies where code='WALL-RETAIN-ROW'
  loop
    if not exists(select 1 from public.concrete_assembly_versions where assembly_id=a.id and version_no=2) then
      select id into prior_id from public.concrete_assembly_versions where assembly_id=a.id and version_no=1;
      insert into public.concrete_assembly_versions(
        company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes
      ) values (
        a.company_id,a.id,2,'draft','blended','2026 National Construction Estimator + WAC 296-17A-0214 + 2026 L&I rate table',2026,
        'WAC 296-17A-0214-02 describes roadway-connected concrete median and retaining walls. Washington’s 2026 rate sheet prices broad class 214; Carez maps subtype 0214-02 to that shared class-214 rate.',
        '0214-02',
        'Use only for concrete median/retaining wall work in connection with highways, streets or roadways after grade/subbase preparation. The physical formulas are preserved from v1.'
      ) returning id into new_id;

      insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order)
      select company_id,new_id,variable_key,label,value_type,unit,default_value,min_value,max_value,required,help_text,sort_order
      from public.concrete_assembly_variables where assembly_version_id=prior_id order by sort_order;

      insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order)
      select company_id,new_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order
      from public.concrete_assembly_components where assembly_version_id=prior_id order by sort_order;

      update public.concrete_assembly_versions set status='published' where id=new_id;
    end if;
  end loop;
end $$;
