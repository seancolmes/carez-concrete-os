begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email) values ('b1111111-1111-4111-8111-111111111111','execution@carez.invalid');
insert into public.companies(id,name) values ('b2222222-2222-4222-8222-222222222222','Execution fixture');
insert into public.profiles(id,company_id,full_name,role)
values ('b1111111-1111-4111-8111-111111111111','b2222222-2222-4222-8222-222222222222','Execution Owner','owner');
insert into public.customers(id,company_id,name)
values ('b3333333-3333-4333-8333-333333333333','b2222222-2222-4222-8222-222222222222','Execution Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,status)
values ('b4444444-4444-4444-8444-444444444444','b2222222-2222-4222-8222-222222222222','b3333333-3333-4333-8333-333333333333','EXEC-01','Execution Fixture Job','active');
insert into public.production_tasks(id,company_id,name,category,production_unit)
values ('b5555555-5555-4555-8555-555555555555','b2222222-2222-4222-8222-222222222222','Place Footing','Concrete','SF');
insert into public.crew_members(id,company_id,name,role,active)
values ('b6666666-6666-4666-8666-666666666666','b2222222-2222-4222-8222-222222222222','Fixture Crew','finisher',true);
select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(11);
select extensions.ok(to_regclass('public.work_packages') is not null,'work package table is source-controlled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.work_packages'::regclass),'work packages enforce RLS');
select extensions.ok(to_regclass('public.work_package_operation_readiness') is not null,'readiness view is source-controlled');
select extensions.ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.work_package_operation_readiness'::regclass),'readiness view uses invoker security');
insert into public.work_packages(company_id,project_id,name,location,planned_start_date,planned_end_date,created_by)
values ('b2222222-2222-4222-8222-222222222222','b4444444-4444-4444-8444-444444444444','Footings','North wing','2026-09-28','2026-09-30','b1111111-1111-4111-8111-111111111111');
insert into public.work_package_operations(company_id,work_package_id,production_task_id,field_label,sequence,planned_quantity,unit,budgeted_man_hours,baseline_man_hours_per_unit,status)
select 'b2222222-2222-4222-8222-222222222222',id,'b5555555-5555-4555-8555-555555555555','North footing',10,100,'SF',20,0.2,'planned'
from public.work_packages where name='Footings';
select extensions.is((select readiness_status from public.work_package_operation_readiness where job_number='EXEC-01'),'ready','operation is ready before optional inspection evidence');
insert into public.project_inspections(company_id,project_id,required_for_operation_id,title,inspection_type,status,created_by)
select 'b2222222-2222-4222-8222-222222222222','b4444444-4444-4444-8444-444444444444',id,'Footing inspection','forms','required','b1111111-1111-4111-8111-111111111111'
from public.work_package_operations where field_label='North footing';
select extensions.is((select inspection_blocking_count from public.work_package_operation_readiness where job_number='EXEC-01'),1,'required inspection blocks operation start');
select extensions.ok(not (select ready_to_start from public.work_package_operation_readiness where job_number='EXEC-01'),'readiness does not report blocked work as ready');
insert into public.work_schedule_items(company_id,project_id,schedule_date,item_type,title,production_task_id,work_package_operation_id,crew_needed,created_by)
select 'b2222222-2222-4222-8222-222222222222','b4444444-4444-4444-8444-444444444444','2026-09-28','work','North footing','b5555555-5555-4555-8555-555555555555',id,1,'b1111111-1111-4111-8111-111111111111'
from public.work_package_operations where field_label='North footing';
insert into public.work_schedule_assignments(company_id,schedule_item_id,crew_member_id)
select 'b2222222-2222-4222-8222-222222222222',s.id,'b6666666-6666-4666-8666-666666666666'
from public.work_schedule_items s where s.title='North footing';
select extensions.is((select assigned_crew from public.work_package_lookahead where job_number='EXEC-01'),1,'look-ahead derives assigned crew from schedule assignments');
update public.project_inspections set status='passed',completed_at=now(),updated_by='b1111111-1111-4111-8111-111111111111'
where title='Footing inspection';
select extensions.ok((select ready_to_start from public.work_package_operation_readiness where job_number='EXEC-01'),'passing inspection clears the readiness gate');
select extensions.is((select inspection_clear_count from public.work_package_operation_readiness where job_number='EXEC-01'),1,'readiness preserves cleared inspection evidence');
insert into public.work_package_operations(company_id,work_package_id,production_task_id,field_label,sequence,planned_quantity,unit,measurement_method,status)
select 'b2222222-2222-4222-8222-222222222222',id,'b5555555-5555-4555-8555-555555555555','Ticket footing',20,20,'CY','ticket','planned'
from public.work_packages where name='Footings';
select extensions.ok(not (select ready_to_start from public.work_package_operation_readiness where field_label='Ticket footing'),'ticket work without a linked pour remains blocked');
reset role;
select * from extensions.finish();
rollback;
