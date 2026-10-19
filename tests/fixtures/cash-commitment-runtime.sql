-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,raw_user_meta_data) values
  ('91111111-1111-4111-8111-111111111111', 'cash@carez.invalid', jsonb_build_object('company_name','Cash fixture','full_name','Cash Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('92222222-2222-4222-8222-222222222222', 'Cash fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('91111111-1111-4111-8111-111111111111', '92222222-2222-4222-8222-222222222222', 'Cash Owner', 'owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
insert into public.projects(id,company_id,job_number,name,status) values ('94444444-4444-4444-8444-444444444444','92222222-2222-4222-8222-222222222222','CASH-01','Cash Fixture Job','active');
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(5);
select extensions.ok(to_regclass('public.project_cash_funding_summary') is not null,'cash funding read model is source-controlled');
select extensions.is((select status from public.project_cash_funding_summary where project_id='94444444-4444-4444-8444-444444444444'),'active','cash funding preserves project status');
select extensions.is((select project_funding_balance from public.project_cash_funding_summary where project_id='94444444-4444-4444-8444-444444444444'),0::numeric,'cash funding has no fabricated balance without cash or cost facts');
select extensions.ok(to_regclass('public.project_commitment_summary') is not null,'commitment read model is source-controlled');
select extensions.ok((select commitment_status='known' and open_po_count=0 and open_po_commitments=0 from public.project_commitment_summary where project_id='94444444-4444-4444-8444-444444444444'),'successful empty procurement ledger exposes known zero commitments without fabricating an order');
reset role;
select * from extensions.finish();
rollback;
