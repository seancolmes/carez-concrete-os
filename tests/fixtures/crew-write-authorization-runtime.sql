-- Synthetic, transactional role/isolation qualification. No retained business rows change.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,email) values
 ('ef100000-0000-4000-8000-000000000001','crew-owner@pilot.invalid'),
 ('ef100000-0000-4000-8000-000000000002','crew-office@pilot.invalid'),
 ('ef100000-0000-4000-8000-000000000003','crew-employee@pilot.invalid');
insert into public.companies(id,name) values
 ('ef200000-0000-4000-8000-000000000001','Crew role fixture'),
 ('ef200000-0000-4000-8000-000000000002','Other crew role fixture');
insert into public.profiles(id,company_id,role,full_name) values
 ('ef100000-0000-4000-8000-000000000001','ef200000-0000-4000-8000-000000000001','owner','Fixture owner'),
 ('ef100000-0000-4000-8000-000000000002','ef200000-0000-4000-8000-000000000001','office','Fixture office'),
 ('ef100000-0000-4000-8000-000000000003','ef200000-0000-4000-8000-000000000001','employee','Fixture employee');
insert into public.crew_members(id,company_id,name,role,hourly_rate) values
 ('ef300000-0000-4000-8000-000000000001','ef200000-0000-4000-8000-000000000001','Preserved worker','Finisher',40),
 ('ef300000-0000-4000-8000-000000000002','ef200000-0000-4000-8000-000000000002','Foreign worker','Finisher',50);
select set_config('request.jwt.claim.sub','ef100000-0000-4000-8000-000000000003',true);
set local role authenticated;
select extensions.is((select count(*) from public.crew_members),0::bigint,'employee retains the existing RPC-only crew access boundary');
select extensions.throws_ok($$insert into public.crew_members(company_id,name,role) values('ef200000-0000-4000-8000-000000000001','Denied employee insert','Finisher')$$,'42501',null,'employee direct insert denied');
with changed as (update public.crew_members set hourly_rate=999 where id='ef300000-0000-4000-8000-000000000001' returning id)
 select extensions.is((select count(*) from changed),0::bigint,'employee cannot change same-company rates');
with removed as (delete from public.crew_members where id='ef300000-0000-4000-8000-000000000001' returning id)
 select extensions.is((select count(*) from removed),0::bigint,'employee cannot delete same-company workers');
reset role;
select extensions.is((select hourly_rate from public.crew_members where id='ef300000-0000-4000-8000-000000000001'),40::numeric,'denied operations preserve recorded rate');
select set_config('request.jwt.claim.sub','ef100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($$insert into public.crew_members(id,company_id,name,role,hourly_rate) values('ef300000-0000-4000-8000-000000000003','ef200000-0000-4000-8000-000000000001','Owner-created fixture','Finisher',0)$$,'owner retains existing same-company creation permission');
with changed as (update public.crew_members set phone='fixture phone' where id='ef300000-0000-4000-8000-000000000003' returning id)
 select extensions.is((select count(*) from changed),1::bigint,'owner retains same-company profile update');
select extensions.is((select hourly_rate from public.crew_members where id='ef300000-0000-4000-8000-000000000003'),0::numeric,'recorded zero is preserved');
with changed as (update public.crew_members set hourly_rate=1 where id='ef300000-0000-4000-8000-000000000002' returning id)
 select extensions.is((select count(*) from changed),0::bigint,'owner cannot change another company worker');
select extensions.throws_ok($$insert into public.crew_members(company_id,name,role) values('ef200000-0000-4000-8000-000000000002','Denied foreign insert','Finisher')$$,'42501',null,'owner cannot insert into another company');
reset role;
select set_config('request.jwt.claim.sub','ef100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.lives_ok($$insert into public.crew_members(id,company_id,name,role) values('ef300000-0000-4000-8000-000000000004','ef200000-0000-4000-8000-000000000001','Office-created fixture','Finisher')$$,'office retains existing creation permission');
with changed as (update public.crew_members set available=false where id='ef300000-0000-4000-8000-000000000004' returning id)
 select extensions.is((select count(*) from changed),1::bigint,'office retains existing same-company update permission');
with removed as (delete from public.crew_members where id='ef300000-0000-4000-8000-000000000004' returning id)
 select extensions.is((select count(*) from removed),1::bigint,'office retains existing same-company delete permission');
reset role;
set local role anon;
select extensions.throws_ok($$insert into public.crew_members(company_id,name,role) values('ef200000-0000-4000-8000-000000000001','Denied anonymous insert','Finisher')$$,'42501',null,'anonymous insert denied');
reset role;
select extensions.is((select hourly_rate from public.crew_members where id='ef300000-0000-4000-8000-000000000002'),50::numeric,'foreign rate remains unchanged');
select * from extensions.finish();
rollback;
