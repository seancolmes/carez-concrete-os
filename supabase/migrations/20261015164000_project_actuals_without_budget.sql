-- Recorded actuals do not depend on whether a planning budget exists.
-- Preserve the existing labor and direct-project-cost inclusion rules exactly.
-- Budget/forecast and billing fields retain their existing contracts.
create view public.carez_project_actuals_without_budget_v2 with (security_invoker=true) as
with labor as (
 select t.company_id,t.project_id,coalesce(sum(t.hours),0)::numeric actual_labor_hours,
 coalesce(sum(t.direct_labor_cost),0)::numeric actual_direct_labor_cost
 from public.timecards t group by t.company_id,t.project_id
), manual as (
 select c.company_id,c.project_id,
 coalesce(sum(c.total_cost) filter(where cc.cost_type='material'),0)::numeric actual_material_cost,
 coalesce(sum(c.total_cost) filter(where cc.cost_type='equipment'),0)::numeric actual_equipment_cost,
 coalesce(sum(c.total_cost) filter(where cc.cost_type='subcontractor'),0)::numeric actual_subcontractor_cost,
 coalesce(sum(c.total_cost) filter(where cc.cost_type='other' or cc.cost_type is null),0)::numeric actual_other_direct_cost
 from public.project_costs c left join public.cost_codes cc on cc.company_id=c.company_id and cc.id=c.cost_code_id
 group by c.company_id,c.project_id
)
select p.company_id,p.id project_id,p.job_number,p.name project_name,p.contract_value authorized_contract,
  (coalesce(l.actual_direct_labor_cost,0)+coalesce(m.actual_material_cost,0)+coalesce(m.actual_equipment_cost,0)+coalesce(m.actual_subcontractor_cost,0)+coalesce(m.actual_other_direct_cost,0))::numeric actual_company_cost,coalesce(b.budget_total_company_cost,0) budget_company_cost,
  coalesce(b.total_cost_remaining,0) budget_remaining_cost,
  coalesce(b.budget_cost_used_percent,0) budget_cost_used_percent,
  coalesce(l.actual_labor_hours,0) actual_labor_hours,coalesce(b.labor_hours_remaining,0) labor_hours_remaining,
  coalesce(f.forecast_cost_at_completion,b.actual_total_company_cost) forecast_cost_at_completion,
  coalesce(f.forecast_margin_at_completion,0) forecast_margin_at_completion,
  coalesce(bs.outstanding_ar,0) outstanding_ar,coalesce(bs.unbilled_contract,0) unbilled_contract,
  coalesce(bs.billed_amount,0) billed_contract,coalesce(bs.collected_amount,0) cash_collected
from public.projects p
left join labor l on l.company_id=p.company_id and l.project_id=p.id
left join manual m on m.company_id=p.company_id and m.project_id=p.id
left join public.project_budget_actual_summary b on b.company_id=p.company_id and b.project_id=p.id
left join public.project_cost_to_complete_summary f on f.company_id=p.company_id and f.project_id=p.id
left join public.project_billing_summary bs on bs.company_id=p.company_id and bs.project_id=p.id;


-- Preserve each known prefix. Deployed financial position and reserves retain
-- their installed formulas; new operational fields are appended from the exact
-- source calculation above, including actuals when no planning budget exists.
do $compat$ declare names text[];shape jsonb;definition text;projection text;extras text;dependent text;begin
 select array_agg(attname order by attnum),jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) order by attnum) into names,shape
 from pg_attribute where attrelid='public.project_financial_summary'::regclass and attnum>0 and not attisdropped;
 if shape=$source$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"authorized_contract","type":"numeric(12,2)"},{"name":"actual_company_cost","type":"numeric"},{"name":"budget_company_cost","type":"numeric"},{"name":"budget_remaining_cost","type":"numeric"},{"name":"budget_cost_used_percent","type":"numeric"},{"name":"actual_labor_hours","type":"numeric"},{"name":"labor_hours_remaining","type":"numeric"},{"name":"forecast_cost_at_completion","type":"numeric"},{"name":"forecast_margin_at_completion","type":"numeric"},{"name":"outstanding_ar","type":"numeric"},{"name":"unbilled_contract","type":"numeric"},{"name":"billed_contract","type":"numeric"},{"name":"cash_collected","type":"numeric"}]$source$::jsonb then
  select string_agg(format('v.%I::%s as %I',attname,format_type(atttypid,atttypmod),attname),',' order by attnum) into projection from pg_attribute where attrelid='public.project_financial_summary'::regclass and attnum>0 and not attisdropped;
  execute 'create or replace view public.project_financial_summary with(security_invoker=true) as select '||projection||' from public.carez_project_actuals_without_budget_v2 v';
 elsif shape=$shape$[{"name":"project_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"status","type":"text"},{"name":"contract_value","type":"numeric(12,2)"},{"name":"approved_changes","type":"numeric(12,2)"},{"name":"backcharges","type":"numeric(12,2)"},{"name":"target_margin_percent","type":"numeric(6,2)"},{"name":"bo_classification","type":"text"},{"name":"bo_rate_percent","type":"numeric(8,5)"},{"name":"payment_processing_rate_percent","type":"numeric(8,5)"},{"name":"adjusted_contract","type":"numeric"},{"name":"labor_hours","type":"numeric"},{"name":"direct_labor_cost","type":"numeric"},{"name":"nonlabor_direct_cost","type":"numeric"},{"name":"material_cost","type":"numeric"},{"name":"equipment_cost","type":"numeric"},{"name":"subcontractor_cost","type":"numeric"},{"name":"other_direct_cost","type":"numeric"},{"name":"total_direct_cost","type":"numeric"},{"name":"overhead_recovery","type":"numeric"},{"name":"bo_cost_reserve","type":"numeric"},{"name":"payment_processing_cost_reserve","type":"numeric"},{"name":"revenue_cost_reserve","type":"numeric"},{"name":"true_company_cost","type":"numeric"},{"name":"target_cost_ceiling","type":"numeric"},{"name":"target_profit","type":"numeric"},{"name":"gross_profit_before_overhead","type":"numeric"},{"name":"profit_if_complete_now","type":"numeric"},{"name":"margin_if_complete_now","type":"numeric"},{"name":"cost_room_to_target","type":"numeric"}]$shape$::jsonb then
  definition:=pg_get_viewdef('public.project_financial_summary'::regclass,true);execute 'create view public.carez_project_financial_prefix_bridge with(security_invoker=true) as '||definition;
  -- These deployed formulas depend on the old financial prefix. Preserve that
  -- exact input before the public view appends fields derived from them.
  foreach dependent in array array['project_budget_actual_summary','project_cost_to_complete_summary'] loop
   definition:=pg_get_viewdef(('public.'||dependent)::regclass,true);
   if position('project_financial_summary' in definition)>0 then execute format('create or replace view public.%I with(security_invoker=true) as %s',dependent,replace(definition,'project_financial_summary','carez_project_financial_prefix_bridge'));end if;
  end loop;
  select string_agg(format('v.%I',attname),',' order by attnum) into extras from pg_attribute where attrelid='public.carez_project_actuals_without_budget_v2'::regclass and attnum>0 and not attisdropped and not(attname=any(names));
  execute 'create or replace view public.project_financial_summary with(security_invoker=true) as select old.*,'||extras||' from public.carez_project_financial_prefix_bridge old join public.carez_project_actuals_without_budget_v2 v on v.company_id=old.company_id and v.project_id=old.project_id';
  revoke all on public.carez_project_financial_prefix_bridge from public,anon,authenticated;grant select on public.carez_project_financial_prefix_bridge to authenticated;
 else raise exception 'Unrecognized project financial row shape: %',shape;end if;
end $compat$;
revoke all on public.carez_project_actuals_without_budget_v2,public.project_financial_summary from public,anon,authenticated;
grant select on public.carez_project_actuals_without_budget_v2,public.project_financial_summary to authenticated;
