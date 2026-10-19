-- PRIVATE PROPOSAL: trusted registration contract only; no source/app grants changed.
-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Synthetic storage metadata only. Actual file bytes are qualified separately.
begin;
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('ed100000-0000-4000-8000-000000000001', 'vault-owner@local.invalid', jsonb_build_object('company_name','Private Vault Test','full_name','Vault Owner','operating_timezone','UTC')),
  ('ed100000-0000-4000-8000-000000000002', 'vault-employee@local.invalid', jsonb_build_object('company_name','Private Vault Test','full_name','Vault Employee','operating_timezone','UTC')),
  ('ed100000-0000-4000-8000-000000000003', 'vault-other@local.invalid', jsonb_build_object('company_name','Other Vault Test','full_name','Other Vault Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('ed200000-0000-4000-8000-000000000001', 'Private Vault Test', 'UTC'),
  ('ed200000-0000-4000-8000-000000000002', 'Other Vault Test', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('ed100000-0000-4000-8000-000000000001', 'ed200000-0000-4000-8000-000000000001', 'owner', 'Vault Owner'),
  ('ed100000-0000-4000-8000-000000000002', 'ed200000-0000-4000-8000-000000000001', 'employee', 'Vault Employee'),
  ('ed100000-0000-4000-8000-000000000003', 'ed200000-0000-4000-8000-000000000002', 'owner', 'Other Vault Owner')) v(id,company_id,role,full_name)
where p.id=v.id::uuid;
insert into public.projects(id,company_id,name,job_number,status) values('ed300000-0000-4000-8000-000000000001','ed200000-0000-4000-8000-000000000001','Vault test job','LOCAL-VAULT-1','active');
insert into storage.objects(bucket_id,name) values('carez-documents','ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf'),('carez-documents','ed200000-0000-4000-8000-000000000001/office-private/reference.json'),('carez-documents','ed200000-0000-4000-8000-000000000001/sources/wrong-scope.pdf'),('carez-documents','ed200000-0000-4000-8000-000000000001/office-private/unlinked-insurance.pdf');
select set_config('request.jwt.claim.sub','ed100000-0000-4000-8000-000000000001',true);set local role authenticated;
-- Application callers cannot claim verified byte identity. This fixture uses
-- synthetic metadata and then the same service-only sealing/registration SQL
-- boundary as the server; actual uploaded bytes remain a separate HTTP check.
select extensions.throws_like($$select public.carez_register_source_document_v3(null,'ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf',repeat('a',64),12,'application/pdf','insurance','Synthetic insurance','insurance.pdf','Fictional company source','R1',null,'office_private',null,null,'ed100000-0000-4000-8000-000000000001')$$,'%permission denied%','a client cannot attest fabricated original-byte fingerprints');
reset role;set local role service_role;
select public.carez_seal_source_upload('ed100000-0000-4000-8000-000000000001',array[
 'ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf',
 'ed200000-0000-4000-8000-000000000001/office-private/reference.json',
 'ed200000-0000-4000-8000-000000000001/sources/wrong-scope.pdf',
 'ed200000-0000-4000-8000-000000000001/office-private/unlinked-insurance.pdf']);

select extensions.lives_ok($$select public.carez_register_source_document_v3(null,'ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf',repeat('a',64),12,'application/pdf','insurance','Synthetic insurance','insurance.pdf','Fictional company source','R1',null,'office_private',null,null,'ed100000-0000-4000-8000-000000000001')$$,'insurance keeps actual purpose with independent private scope');
select extensions.lives_ok($$select public.carez_register_source_document_v3(null,'ed200000-0000-4000-8000-000000000001/office-private/reference.json',repeat('b',64),15,'application/json','reference','Synthetic private review','review.json','Fictional review package','R1',null,'office_private',null,null,'ed100000-0000-4000-8000-000000000001')$$,'JSON review remains a private reference rather than false tax classification');
reset role;set local role authenticated;
select extensions.is((select count(*)::integer from public.company_documents where visibility='office_private' and project_id is null and document_type in ('insurance','reference')),2,'both retained records are company-only');
select extensions.is((select count(*)::integer from public.document_source_aliases),2,'original alias provenance retained');
reset role;set local role service_role;
select extensions.throws_like($$select public.carez_register_source_document_v3('ed300000-0000-4000-8000-000000000001','ed200000-0000-4000-8000-000000000001/sources/wrong-scope.pdf',repeat('c',64),12,'application/pdf','w9','Tax scope bypass','w9.pdf','Fictional source','R1',null,'job',null,null,'ed100000-0000-4000-8000-000000000001')$$,'%require office-private%','W9 cannot be registered in job scope');
select extensions.throws_like($$select public.carez_register_source_document_v3('ed300000-0000-4000-8000-000000000001','ed200000-0000-4000-8000-000000000001/office-private/unlinked-insurance.pdf',repeat('d',64),12,'application/pdf','insurance','Private to job bypass','insurance.pdf','Fictional source','R1',null,'office_private',null,null,'ed100000-0000-4000-8000-000000000001')$$,'%cannot be linked to a job%','private records cannot carry a job association');
select extensions.throws_like($$select public.carez_register_source_document_v3(null,'ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf',repeat('c',64),12,'application/pdf','reference','Wrong storage scope','reference.pdf','Fictional source','R1',null,'job',null,null,'ed100000-0000-4000-8000-000000000001')$$,'%Choose a job%','job scope cannot disguise a company-only record');
reset role;set local role authenticated;
select extensions.throws_like($$update public.company_documents set project_id='ed300000-0000-4000-8000-000000000001' where document_type='insurance'$$,'%cannot become job attachments%','direct update cannot turn private insurance into a job attachment');
select extensions.throws_like($$delete from storage.objects where bucket_id='carez-documents' and name='ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf'$$,'%Direct deletion from storage tables is not allowed%','direct SQL storage deletion is denied by the provider guard');
select extensions.is((select count(*)::integer from storage.objects where bucket_id='carez-documents' and name='ed200000-0000-4000-8000-000000000001/office-private/insurance.pdf'),1,'private object metadata remains after denied SQL deletion');
select set_config('request.jwt.claim.sub','ed100000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.company_documents where company_id='ed200000-0000-4000-8000-000000000001'),0,'employee cannot read private company metadata');
select extensions.is((select count(*)::integer from storage.objects where bucket_id='carez-documents'),0,'employee cannot read private object metadata');
select set_config('request.jwt.claim.sub','ed100000-0000-4000-8000-000000000003',true);
select extensions.is((select count(*)::integer from public.company_documents where company_id='ed200000-0000-4000-8000-000000000001'),0,'foreign owner cannot read private sources');
reset role;set local role anon;
select extensions.is((select count(*)::integer from storage.objects where bucket_id='carez-documents'),0,'anonymous access does not expose private sources');
reset role;select * from extensions.finish();rollback;
