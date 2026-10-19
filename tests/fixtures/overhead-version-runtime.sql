-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Run against both canonical TABLE-return and production composite-return wrappers.
begin;
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('ec100000-0000-4000-8000-000000000001', 'overhead-owner@local.invalid', jsonb_build_object('company_name','Overhead Version Test','full_name','Overhead Owner','operating_timezone','UTC')),
  ('ec100000-0000-4000-8000-000000000002', 'overhead-employee@local.invalid', jsonb_build_object('company_name','Overhead Version Test','full_name','Overhead Employee','operating_timezone','UTC'));
insert into public.companies(id,name,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate,operating_timezone) values
  ('ec200000-0000-4000-8000-000000000001', 'Overhead Version Test', 2000, 100000, 1000, 50, 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('ec100000-0000-4000-8000-000000000001', 'ec200000-0000-4000-8000-000000000001', 'owner', 'Overhead Owner'),
  ('ec100000-0000-4000-8000-000000000002', 'ec200000-0000-4000-8000-000000000001', 'employee', 'Overhead Employee')) v(id,company_id,role,full_name)
where p.id=v.id::uuid;
insert into public.overhead_items(id,company_id,category,name,amount,frequency,business_use_percent) values('ec300000-0000-4000-8000-000000000001','ec200000-0000-4000-8000-000000000001','Facilities','Synthetic rent',1000,'monthly',100);
create temp table overhead_test_context(key text primary key,value jsonb);grant all on overhead_test_context to authenticated;
select set_config('request.jwt.claim.sub','ec100000-0000-4000-8000-000000000001',true);set local role authenticated;
insert into overhead_test_context values('first',public.carez_capture_overhead_v2(current_date));
select extensions.is((select (value->>'overhead_rate_per_productive_hour')::numeric from overhead_test_context where key='first'),31::numeric,'real company plan formula: (12000 regular + 50000 management) / 2000 hours');
select extensions.is((select (value->>'annual_overhead')::numeric from overhead_test_context where key='first'),62000::numeric,'annual overhead records its independent basis');
select extensions.is((public.carez_capture_overhead_v2(current_date)->>'id'),(select value->>'id' from overhead_test_context where key='first'),'same inputs reuse the immutable version');
update public.overhead_items set amount=2000 where id='ec300000-0000-4000-8000-000000000001';
insert into overhead_test_context values('second',public.carez_capture_overhead_v2(current_date));
select extensions.is((select (value->>'overhead_rate_per_productive_hour')::numeric from overhead_test_context where key='second'),37::numeric,'changed item inputs create the new 74000 / 2000 rate');
select extensions.isnt((select value->>'id' from overhead_test_context where key='first'),(select value->>'id' from overhead_test_context where key='second'),'same-day changes have different snapshot identities');
select extensions.is((select overhead_rate_per_productive_hour from public.overhead_rate_snapshots where id=(select (value->>'id')::uuid from overhead_test_context where key='first')),31::numeric,'earlier stored rate is unchanged');
select extensions.is((select id::text from public.capture_overhead_rate_snapshot(current_date)),(select value->>'id' from overhead_test_context where key='second'),'legacy return contract routes to the same immutable input version');
select extensions.throws_like($$update public.overhead_rate_snapshots set overhead_rate_per_productive_hour=0$$,'%permission denied%','app roles cannot rewrite snapshots directly');
select extensions.throws_like($$select public.carez_capture_overhead_v2(current_date-10)$$,'%Historical configured overhead basis unavailable%','today plan is not silently backdated');
select public.carez_save_company_plan('ec400000-0000-4000-8000-000000000001',0,'{"target_margin_percent":0,"planned_productive_hours_annual":2000,"owner_compensation_target_annual":0,"owner_planned_field_hours_annual":0,"owner_field_rate":0}');
update public.overhead_items set active=false where id='ec300000-0000-4000-8000-000000000001';
select extensions.is((public.carez_capture_overhead_v2(current_date)->>'overhead_rate_per_productive_hour')::numeric,0::numeric,'configured zero remains a real zero');
select set_config('request.jwt.claim.sub','ec100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select public.carez_capture_overhead_v2(current_date)$$,'%Owner or office%','employee cannot read company financial assumptions through the RPC');
reset role;select * from extensions.finish();rollback;
