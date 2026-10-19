-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,raw_user_meta_data) values
  ('81111111-1111-4111-8111-111111111111', 'pour@carez.invalid', jsonb_build_object('company_name','Pour fixture','full_name','Pour Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('82222222-2222-4222-8222-222222222222', 'Pour fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('81111111-1111-4111-8111-111111111111', '82222222-2222-4222-8222-222222222222', 'Pour Owner', 'owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
insert into public.customers(id,company_id,name) values ('83333333-3333-4333-8333-333333333333','82222222-2222-4222-8222-222222222222','Pour Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,status) values ('84444444-4444-4444-8444-444444444444','82222222-2222-4222-8222-222222222222','83333333-3333-4333-8333-333333333333','POUR-01','Pour Fixture Job','active');
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
create temp table pour_fixture_results(key text primary key,value jsonb);grant all on pour_fixture_results to authenticated;
set local role authenticated;
select extensions.plan(7);
select extensions.ok(to_regclass('public.pour_plans') is not null,'pour plan table is source-controlled');
select extensions.ok(to_regclass('public.pour_cost_items') is not null,'pour cost table is source-controlled');
insert into pour_fixture_results values('plan',public.carez_pour_planning_command_v1('89999999-9999-4999-8999-999999999991','create_plan','{"project_id":"84444444-4444-4444-8444-444444444444","name":"Fixture Pour","expected_concrete_yards":10,"contingency_percent":10,"minimum_cash_buffer":50,"company_cash_support":0}'));
select public.carez_pour_planning_command_v1('89999999-9999-4999-8999-999999999992','add_cost',(select jsonb_build_object('pour_plan_id',p.id,'expected_updated_at',p.updated_at,'item_type','concrete','description','Ready mix','quantity',1,'unit','LS','unit_cost',100) from public.pour_plans p where p.id=(select (value->>'id')::uuid from pour_fixture_results where key='plan')));
select extensions.is((select planned_exposure from public.pour_plan_financial_summary where name='Fixture Pour'),100::numeric,'pour summary preserves planned exposure');
select extensions.is((select system_recommendation from public.pour_plan_financial_summary where name='Fixture Pour'),'hold','unfunded pour remains on hold');
select extensions.is((select sync_status from public.pour_work_package_delivery_sync where pour_name='Fixture Pour'),'unlinked','delivery sync exposes missing production link');
select extensions.ok((select relrowsecurity from pg_class where oid='public.pour_authorization_snapshots'::regclass),'authorization snapshots enforce RLS');
select extensions.ok(not has_table_privilege('anon','public.pour_plans','SELECT'),'anonymous cannot read pour plans');
reset role;
select * from extensions.finish();
rollback;
