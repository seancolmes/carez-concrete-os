begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email) values ('71111111-1111-4111-8111-111111111111','readiness@carez.invalid');
insert into public.companies(id,name) values ('72222222-2222-4222-8222-222222222222','Readiness fixture');
insert into public.profiles(id,company_id,full_name,role) values ('71111111-1111-4111-8111-111111111111','72222222-2222-4222-8222-222222222222','Readiness Owner','owner');
insert into public.customers(id,company_id,name) values ('73333333-3333-4333-8333-333333333333','72222222-2222-4222-8222-222222222222','Readiness Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,status) values ('74444444-4444-4444-8444-444444444444','72222222-2222-4222-8222-222222222222','73333333-3333-4333-8333-333333333333','READY-01','Readiness Fixture Job','active');
insert into public.production_tasks(id,company_id,name,production_unit,active) values ('75555555-5555-4555-8555-555555555555','72222222-2222-4222-8222-222222222222','Readiness Task','SF',true);
insert into public.work_packages(id,company_id,project_id,name,created_by) values ('76666666-6666-4666-8666-666666666666','72222222-2222-4222-8222-222222222222','74444444-4444-4444-8444-444444444444','Readiness Package','71111111-1111-4111-8111-111111111111');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,planned_quantity,unit,budgeted_man_hours)
values ('77777777-7777-4777-8777-777777777777','72222222-2222-4222-8222-222222222222','76666666-6666-4666-8666-666666666666','75555555-5555-4555-8555-555555555555',100,'SF',1);
select set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(8);
select extensions.ok(to_regclass('public.scope_drift_events') is not null,'scope drift event table is source-controlled');
select extensions.ok(to_regclass('public.scope_drift_inbox') is not null,'scope drift inbox is source-controlled');
select extensions.is((select count(*) from public.scope_drift_inbox where company_id='72222222-2222-4222-8222-222222222222'),0::bigint,'scope drift inbox has no fabricated signals');
insert into public.scope_drift_events(company_id,project_id,work_package_operation_id,signal_key,source_type,title,created_by)
values ('72222222-2222-4222-8222-222222222222','74444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777','manual:ready-1','manual','Fixture scope change','71111111-1111-4111-8111-111111111111');
select extensions.is((select status from public.scope_drift_events where signal_key='manual:ready-1'),'open','scope drift starts in human review');
select extensions.ok(to_regclass('public.work_package_resource_requirements') is not null,'resource requirement table is source-controlled');
insert into public.work_package_resource_requirements(company_id,work_package_operation_id,resource_type,label,required_quantity,unit,created_by)
values ('72222222-2222-4222-8222-222222222222','77777777-7777-4777-8777-777777777777','material','Fixture form ties',10,'EA','71111111-1111-4111-8111-111111111111');
select extensions.is((select resource_status from public.work_package_resource_requirement_status where label='Fixture form ties'),'needed','unconnected material is not reported ready');
select extensions.ok((select blocking_reason is not null from public.work_package_resource_requirement_status where label='Fixture form ties'),'unconnected material exposes a blocking reason');
select extensions.ok(not has_table_privilege('anon','public.work_package_resource_requirements','SELECT'),'anonymous cannot read resource requirements');
reset role;
select * from extensions.finish();
rollback;
