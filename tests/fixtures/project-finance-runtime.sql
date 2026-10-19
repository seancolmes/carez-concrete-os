-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,raw_user_meta_data) values
  ('c1111111-1111-4111-8111-111111111111', 'finance@carez.invalid', jsonb_build_object('company_name','Finance fixture','full_name','Finance Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('c2222222-2222-4222-8222-222222222222', 'Finance fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('c1111111-1111-4111-8111-111111111111', 'c2222222-2222-4222-8222-222222222222', 'Finance Owner', 'owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
insert into public.customers(id,company_id,name) values ('c3333333-3333-4333-8333-333333333333','c2222222-2222-4222-8222-222222222222','Finance Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,contract_value,bo_rate_percent,payment_processing_rate_percent) values ('c4444444-4444-4444-8444-444444444444','c2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333','FIN-01','Finance Fixture Job',1000,0,0);
insert into public.cost_codes(id,company_id,code,name,cost_type) values ('c5555555-5555-4555-8555-555555555555','c2222222-2222-4222-8222-222222222222','MAT','Materials','material');
insert into public.production_tasks(id,company_id,name,production_unit) values ('c6666666-6666-4666-8666-666666666666','c2222222-2222-4222-8222-222222222222','Finance Task','SF');
insert into public.crew_members(id,company_id,name,role,active) values ('c7777777-7777-4777-8777-777777777777','c2222222-2222-4222-8222-222222222222','Finance Crew','finisher',true);
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(10);
select extensions.ok(to_regclass('public.project_budgets') is not null,'project budgets are source-controlled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.project_costs'::regclass),'project costs enforce RLS');
insert into public.project_budgets(company_id,project_id,label,status,target_margin_percent,labor_hours,direct_labor_cost,material_cost,total_direct_cost,overhead_cost,revenue_cost_reserve,total_company_cost) values ('c2222222-2222-4222-8222-222222222222','c4444444-4444-4444-8444-444444444444','Original Budget','active',30,10,400,200,600,0,0,600);
insert into public.project_budget_sections(company_id,budget_id,name,scope_type,budget_labor_hours,budget_direct_labor_cost,budget_material_cost) select 'c2222222-2222-4222-8222-222222222222',id,'Concrete Scope','base',10,400,200 from public.project_budgets where label='Original Budget';
-- Explicit privileged synthetic legacy approved-cost setup for read-model
-- qualification only; this does not qualify clock, labor review or posting.
reset role;
insert into public.timecards(company_id,project_id,budget_section_id,crew_member_id,worker_name,work_date,task,hours,regular_hours,gross_wage_cost,direct_labor_cost,overhead_recovery_cost,approval_status) select 'c2222222-2222-4222-8222-222222222222','c4444444-4444-4444-8444-444444444444',s.id,'c7777777-7777-4777-8777-777777777777','Finance Crew','2026-09-26','Place concrete',2,2,80,80,0,'approved' from public.project_budget_sections s where s.name='Concrete Scope';
insert into public.project_costs(company_id,project_id,budget_section_id,cost_code_id,description,quantity,unit,unit_cost,subtotal,total_cost) select 'c2222222-2222-4222-8222-222222222222','c4444444-4444-4444-8444-444444444444',s.id,'c5555555-5555-4555-8555-555555555555','Ready mix',1,'LS',50,50,50 from public.project_budget_sections s where s.name='Concrete Scope';
set local role authenticated;
select extensions.is((select actual_total_company_cost from public.project_budget_actual_summary where project_id='c4444444-4444-4444-8444-444444444444'),130::numeric,'budget actual summary combines approved labor and direct job cost');
select extensions.is((select budget_total_company_cost from public.project_budget_actual_summary where project_id='c4444444-4444-4444-8444-444444444444'),600::numeric,'budget actual summary preserves section budget authority');
select extensions.ok((select budget_cost_used_percent in (21.67::numeric,21.7::numeric) and actual_total_company_cost=130 and budget_total_company_cost=600 from public.project_budget_actual_summary where project_id='c4444444-4444-4444-8444-444444444444'),'130 of600 utilization preserves declared canonical two-place or deployed one-place rounding');
insert into public.project_scope_progress_updates(company_id,project_id,budget_id,budget_section_id,as_of_date,physical_percent_complete,remaining_labor_hours_override) select 'c2222222-2222-4222-8222-222222222222','c4444444-4444-4444-8444-444444444444',s.budget_id,s.id,'2026-09-26',50,8 from public.project_budget_sections s where s.name='Concrete Scope';
select extensions.is((select physical_percent_complete from public.project_scope_forecast_summary where project_id='c4444444-4444-4444-8444-444444444444'),50::numeric,'scope forecast retains physical progress update');
select extensions.is((select forecast_remaining_labor_hours from public.project_scope_forecast_summary where project_id='c4444444-4444-4444-8444-444444444444'),8::numeric,'scope forecast honors remaining labor override');
select extensions.ok((select forecast_cost_at_completion from public.project_cost_to_complete_summary where project_id='c4444444-4444-4444-8444-444444444444') is not null,'cost to complete is a derived financial fact');
select extensions.ok((select actual_company_cost from public.project_financial_summary where project_id='c4444444-4444-4444-8444-444444444444')=130,'project financial summary exposes actual direct cost');
select extensions.ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.project_financial_summary'::regclass),'financial summary uses invoker security');
reset role;
select * from extensions.finish();
rollback;
