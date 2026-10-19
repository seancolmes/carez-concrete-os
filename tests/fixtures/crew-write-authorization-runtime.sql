-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Synthetic, transactional role/isolation qualification. No retained business rows change.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('ef100000-0000-4000-8000-000000000001', 'crew-owner@pilot.invalid', jsonb_build_object('company_name','Crew role fixture','full_name','Fixture owner','operating_timezone','UTC')),
  ('ef100000-0000-4000-8000-000000000002', 'crew-office@pilot.invalid', jsonb_build_object('company_name','Crew role fixture','full_name','Fixture office','operating_timezone','UTC')),
  ('ef100000-0000-4000-8000-000000000003', 'crew-employee@pilot.invalid', jsonb_build_object('company_name','Crew role fixture','full_name','Fixture employee','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('ef200000-0000-4000-8000-000000000001', 'Crew role fixture', 'UTC'),
  ('ef200000-0000-4000-8000-000000000002', 'Other crew role fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('ef100000-0000-4000-8000-000000000001', 'ef200000-0000-4000-8000-000000000001', 'owner', 'Fixture owner'),
  ('ef100000-0000-4000-8000-000000000002', 'ef200000-0000-4000-8000-000000000001', 'office', 'Fixture office'),
  ('ef100000-0000-4000-8000-000000000003', 'ef200000-0000-4000-8000-000000000001', 'employee', 'Fixture employee')) v(id,company_id,role,full_name)
where p.id=v.id::uuid;
insert into public.crew_members(id,company_id,name,role,hourly_rate) values
 ('ef300000-0000-4000-8000-000000000001','ef200000-0000-4000-8000-000000000001','Preserved worker','Finisher',40),
 ('ef300000-0000-4000-8000-000000000002','ef200000-0000-4000-8000-000000000002','Foreign worker','Finisher',50);
create temp table crew_fixture_results(key text primary key,value jsonb);grant all on crew_fixture_results to authenticated;
create function pg_temp.crew_fixture_values(label text,enabled boolean default true) returns jsonb language sql as $$select jsonb_build_object('name',label,'role','Finisher','worker_type','employee','availability_type','regular','hourly_rate',0,'internal_field_rate',null,'skills','[]'::jsonb,'active',enabled,'effective_date',current_date,'reason','Explicit synthetic terms in isolated authorization fixture');$$;
select set_config('request.jwt.claim.sub','ef100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select extensions.is((select count(*) from public.crew_members),0::bigint,'employee retains the existing RPC-only crew access boundary');
select extensions.throws_like($$insert into public.crew_members(company_id,name,role) values('ef200000-0000-4000-8000-000000000001','Denied employee insert','Finisher')$$,'%Owner or office access required%','employee direct insert denied by authority guard');
with changed as (update public.crew_members set hourly_rate=999 where id='ef300000-0000-4000-8000-000000000001' returning id)
 select extensions.is((select count(*) from changed),0::bigint,'employee cannot change same-company rates');
with removed as (delete from public.crew_members where id='ef300000-0000-4000-8000-000000000001' returning id)
 select extensions.is((select count(*) from removed),0::bigint,'employee cannot delete same-company workers');
reset role;
select extensions.is((select hourly_rate from public.crew_members where id='ef300000-0000-4000-8000-000000000001'),40::numeric,'denied operations preserve recorded rate');
select set_config('request.jwt.claim.sub','ef100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($$insert into crew_fixture_results values('owner',public.carez_administer_crew('create','ef900000-0000-4000-8000-000000000001',null,null,pg_temp.crew_fixture_values('Owner-created fixture')))$$,'owner creates same-company worker through audited administration');
select extensions.lives_ok($$select public.carez_administer_crew('update','ef900000-0000-4000-8000-000000000002',(select (value->>'crew_member_id')::uuid from crew_fixture_results where key='owner'),1,pg_temp.crew_fixture_values('Owner-created fixture')||'{"phone":"fixture phone"}')$$,'owner updates own-company worker through audited revision');
select extensions.is((select hourly_rate from public.crew_members where id=(select (value->>'crew_member_id')::uuid from crew_fixture_results where key='owner')),0::numeric,'recorded zero is preserved');
with changed as (update public.crew_members set hourly_rate=1 where id='ef300000-0000-4000-8000-000000000002' returning id)
 select extensions.is((select count(*) from changed),0::bigint,'owner cannot change another company worker');
select extensions.throws_like($$select public.carez_administer_crew('rate','ef900000-0000-4000-8000-000000000003','ef300000-0000-4000-8000-000000000002',0,jsonb_build_object('amount',99,'effective_date',current_date,'reason','Denied foreign rate'))$$,'%Worker unavailable in this company%','owner cannot administer another company worker');
reset role;
select set_config('request.jwt.claim.sub','ef100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.lives_ok($$insert into crew_fixture_results values('office',public.carez_administer_crew('create','ef900000-0000-4000-8000-000000000004',null,null,pg_temp.crew_fixture_values('Office-created fixture')))$$,'office creates same-company worker through audited administration');
select extensions.lives_ok($$select public.carez_administer_crew('update','ef900000-0000-4000-8000-000000000005',(select (value->>'crew_member_id')::uuid from crew_fixture_results where key='office'),1,pg_temp.crew_fixture_values('Office-created fixture',false))$$,'office deactivates a worker through audited administration');
select extensions.throws_like($$delete from public.crew_members where id=(select (value->>'crew_member_id')::uuid from crew_fixture_results where key='office')$$,'%audited Crew administration%','office cannot erase the worker and immutable term history through direct deletion');
select extensions.ok((select not active from public.crew_members where id=(select (value->>'crew_member_id')::uuid from crew_fixture_results where key='office')),'deactivated worker remains retained');
reset role;
set local role anon;
select extensions.throws_like($$select public.carez_administer_crew('create',gen_random_uuid(),null,null,'{}')$$,'%permission denied%','anonymous cannot call Crew administration');
reset role;
select extensions.is((select hourly_rate from public.crew_members where id='ef300000-0000-4000-8000-000000000002'),50::numeric,'foreign rate remains unchanged');
select * from extensions.finish();
rollback;
