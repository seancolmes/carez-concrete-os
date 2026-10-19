-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,raw_user_meta_data) values
  ('91111111-1111-4111-8111-111111111111', 'profile-security@carez.invalid', jsonb_build_object('company_name','Profile security fixture','full_name','Office','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('92222222-2222-4222-8222-222222222222', 'Profile security fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('91111111-1111-4111-8111-111111111111', '92222222-2222-4222-8222-222222222222', 'Office', 'office')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$
begin
  begin
    update public.profiles set role='owner' where id=auth.uid();
    raise exception 'Office self-promotion succeeded';
  exception when insufficient_privilege then null; end;
  update public.profiles set full_name='Updated office' where id=auth.uid();
  if not found then raise exception 'Own display-name update was blocked'; end if;
end $$;
reset role;
select extensions.plan(3);
select extensions.is((select role from public.profiles where id='91111111-1111-4111-8111-111111111111'),'office','office cannot self-promote');
select extensions.is((select full_name from public.profiles where id='91111111-1111-4111-8111-111111111111'),'Updated office','safe self-profile editing remains available');
select extensions.ok(not has_column_privilege('authenticated','public.profiles','company_id','UPDATE'),'tenant identity cannot be self-edited');
select * from extensions.finish();
rollback;
