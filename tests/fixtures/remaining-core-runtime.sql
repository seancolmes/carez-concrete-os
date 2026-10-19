-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,raw_user_meta_data) values
  ('f1111111-1111-4111-8111-111111111111', 'core@carez.invalid', jsonb_build_object('company_name','Core fixture','full_name','Core Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('f2222222-2222-4222-8222-222222222222', 'Core fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('f1111111-1111-4111-8111-111111111111', 'f2222222-2222-4222-8222-222222222222', 'Core Owner', 'owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
insert into public.customers(id,company_id,name) values ('f3333333-3333-4333-8333-333333333333','f2222222-2222-4222-8222-222222222222','Core Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,status) values ('f4444444-4444-4444-8444-444444444444','f2222222-2222-4222-8222-222222222222','f3333333-3333-4333-8333-333333333333','CORE-01','Core Fixture Job','active');
insert into public.production_tasks(id,company_id,name,production_unit,active) values ('f5555555-5555-4555-8555-555555555555','f2222222-2222-4222-8222-222222222222','Core Task','SF',true);
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(9);
select extensions.ok(to_regclass('public.overhead_rate_snapshots') is not null,'overhead snapshot table is source-controlled');
select extensions.throws_like($$select public.capture_overhead_rate_snapshot(current_date-1)$$,'%Historical configured overhead basis unavailable%','missing historical overhead is not silently backdated or recorded as zero');
select extensions.is((select count(*) from public.overhead_rate_snapshots where company_id='f2222222-2222-4222-8222-222222222222'),0::bigint,'failed historical capture leaves no fabricated overhead snapshot');
select extensions.ok(to_regclass('public.project_award_operations_handoff') is not null,'award handoff read model is source-controlled');
select extensions.ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='public.project_award_operations_handoff'::regclass),'award handoff uses invoker security');
insert into public.work_packages(company_id,project_id,name,created_by) values ('f2222222-2222-4222-8222-222222222222','f4444444-4444-4444-8444-444444444444','Core Package','f1111111-1111-4111-8111-111111111111');
insert into public.work_package_operations(company_id,work_package_id,production_task_id,planned_quantity,unit)
select 'f2222222-2222-4222-8222-222222222222',id,'f5555555-5555-4555-8555-555555555555',10,'SF' from public.work_packages where name='Core Package';
select extensions.is((select count(*) from public.work_package_operations o join public.work_packages p on p.id=o.work_package_id where p.project_id='f4444444-4444-4444-8444-444444444444'),1::bigint,'physical quantity planning persists without fabricated Award');
-- Two source-controlled installed contracts are intentionally preserved:
-- canonical project/package handoff and deployed estimate/Takeoff handoff.
select case when exists(select 1 from pg_attribute where attrelid='public.project_award_operations_handoff'::regclass and attname='estimate_id' and attnum>0 and not attisdropped)
 then extensions.is((select count(*) from public.project_award_operations_handoff where project_id='f4444444-4444-4444-8444-444444444444'),0::bigint,'estimate handoff does not invent a source-estimate row for manual work')
 else extensions.is((select handoff_status from public.project_award_operations_handoff where project_id='f4444444-4444-4444-8444-444444444444'),'generated','project package handoff reports the physically generated manual package') end;
select extensions.ok((select financial_status in ('no_source_budget','in_progress') and source_estimate_item_id is null from public.work_package_financial_summary where project_id='f4444444-4444-4444-8444-444444444444'),'installed financial contract retains explicit absence of source estimate; no priced budget is fabricated');
select extensions.ok(not has_function_privilege('anon','public.capture_overhead_rate_snapshot(date)','execute'),'anonymous cannot capture overhead snapshots');
reset role;
select * from extensions.finish();
rollback;
