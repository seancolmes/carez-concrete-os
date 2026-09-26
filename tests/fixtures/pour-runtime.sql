begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email) values ('81111111-1111-4111-8111-111111111111','pour@carez.invalid');
insert into public.companies(id,name) values ('82222222-2222-4222-8222-222222222222','Pour fixture');
insert into public.profiles(id,company_id,full_name,role) values ('81111111-1111-4111-8111-111111111111','82222222-2222-4222-8222-222222222222','Pour Owner','owner');
insert into public.customers(id,company_id,name) values ('83333333-3333-4333-8333-333333333333','82222222-2222-4222-8222-222222222222','Pour Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,status) values ('84444444-4444-4444-8444-444444444444','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333','POUR-01','Pour Fixture Job','active');
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(7);
select extensions.ok(to_regclass('public.pour_plans') is not null,'pour plan table is source-controlled');
select extensions.ok(to_regclass('public.pour_cost_items') is not null,'pour cost table is source-controlled');
insert into public.pour_plans(company_id,project_id,name,expected_concrete_yards,contingency_percent,minimum_cash_buffer)
values ('82222222-2222-4222-8222-222222222222','84444444-4444-4444-8444-444444444444','Fixture Pour',10,10,50);
insert into public.pour_cost_items(company_id,pour_plan_id,item_type,description,quantity,unit,unit_cost,expected_cost)
select '82222222-2222-4222-8222-222222222222',id,'concrete','Ready mix',1,'LS',100,100 from public.pour_plans where name='Fixture Pour';
select extensions.is((select planned_exposure from public.pour_plan_financial_summary where name='Fixture Pour'),100::numeric,'pour summary preserves planned exposure');
select extensions.is((select system_recommendation from public.pour_plan_financial_summary where name='Fixture Pour'),'hold','unfunded pour remains on hold');
select extensions.is((select sync_status from public.pour_work_package_delivery_sync where pour_name='Fixture Pour'),'unlinked','delivery sync exposes missing production link');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pour_authorization_snapshots'::regclass),'authorization snapshots enforce RLS');
select extensions.ok(not has_table_privilege('anon','public.pour_plans','SELECT'),'anonymous cannot read pour plans');
reset role;
select * from extensions.finish();
rollback;
