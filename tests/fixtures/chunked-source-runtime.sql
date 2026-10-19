-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Schema/authority fixture using synthetic object metadata, not uploaded-byte proof.
begin;
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('f1100000-0000-4000-8000-000000000001', 'chunk-owner@local.invalid', jsonb_build_object('company_name','Chunk Source Contractor','full_name','Chunk Owner','operating_timezone','UTC')),
  ('f1100000-0000-4000-8000-000000000002', 'chunk-employee@local.invalid', jsonb_build_object('company_name','Chunk Source Contractor','full_name','Chunk Employee','operating_timezone','UTC')),
  ('f1100000-0000-4000-8000-000000000003', 'chunk-other@local.invalid', jsonb_build_object('company_name','Other Chunk Contractor','full_name','Other Chunk Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('f1200000-0000-4000-8000-000000000001', 'Chunk Source Contractor', 'UTC'),
  ('f1200000-0000-4000-8000-000000000002', 'Other Chunk Contractor', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('f1100000-0000-4000-8000-000000000001', 'f1200000-0000-4000-8000-000000000001', 'owner', 'Chunk Owner'),
  ('f1100000-0000-4000-8000-000000000002', 'f1200000-0000-4000-8000-000000000001', 'employee', 'Chunk Employee'),
  ('f1100000-0000-4000-8000-000000000003', 'f1200000-0000-4000-8000-000000000002', 'owner', 'Other Chunk Owner')) v(id,company_id,role,full_name)
where p.id=v.id::uuid;
insert into public.projects(id,company_id,name,job_number,status) values('f1300000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','Synthetic chunk job','LOCAL-CHUNK-1','active');
insert into public.estimates(id,company_id,project_id,estimate_number,version,name,status) values('f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001','E-LOCAL-CHUNK-1',1,'Synthetic source estimate','draft');
insert into public.takeoff_sets(id,company_id,estimate_id,name,status) values('f1500000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1400000-0000-4000-8000-000000000001','Synthetic original source','active');
insert into storage.objects(bucket_id,name) values('carez-documents','f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/manifest.json'),('carez-documents','f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/part-00000');
create temp table chunk_test_context(key text primary key,value jsonb);grant all on chunk_test_context to authenticated,service_role;
insert into chunk_test_context values('manifest','{"version":1,"kind":"pourtrace-chunked-source","filename":"Synthetic original.pdf","mimeType":"application/pdf","size":17,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","chunks":[{"index":0,"path":"f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/part-00000","size":17,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}');
create function pg_temp.register_chunks(p_hash text default repeat('a',64),p_manifest jsonb default null,p_set uuid default null) returns jsonb language sql as $$select public.carez_register_source_document_v3('f1300000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/manifest.json',p_hash,17,'application/pdf','plan','Synthetic retained plan','Synthetic original.pdf','Isolated original source','R1',null,'job',coalesce(p_manifest,(select value from chunk_test_context where key='manifest')),p_set,auth.uid());$$;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);set local role authenticated;
select extensions.throws_like($$select pg_temp.register_chunks()$$,'%permission denied%','a direct client cannot attest fabricated original-byte fingerprints');
select extensions.throws_like($$select public.carez_seal_source_upload(auth.uid(),array['f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/manifest.json'])$$,'%permission denied%','only the trusted server may seal an upload');
reset role;set local role service_role;
select public.carez_seal_source_upload(auth.uid(),array['f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/manifest.json','f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/part-00000']);
select extensions.throws_like($$update storage.objects set metadata='{}'::jsonb where name='f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/part-00000'$$,'%sealed%','even a privileged overwrite cannot change sealed bytes during verification');
insert into chunk_test_context values('registered',pg_temp.register_chunks());
-- The registration above executes as the real trusted service role. Inspect
-- stored rows as the isolated verifier; minimal canonical service ACLs do not
-- grant raw document-table reads merely for fixture assertions.
reset role;
select extensions.is((select storage_format from public.company_documents where id=(select (value->>'id')::uuid from chunk_test_context where key='registered')),'chunked','original identity is marked chunked rather than serving the JSON as a PDF');
select extensions.is((select byte_size from public.company_documents where id=(select (value->>'id')::uuid from chunk_test_context where key='registered')),17::bigint,'document byte length is the original length, not manifest length');
select extensions.is((select count(*)::integer from public.company_document_chunks),1,'part metadata saved atomically with the document');
set local role service_role;
select extensions.is(pg_temp.register_chunks()->>'id',(select value->>'id' from chunk_test_context where key='registered'),'same source retry reopens the retained identity');
select extensions.throws_like($$select pg_temp.register_chunks(repeat('b',64),(select value||jsonb_build_object('sha256',repeat('b',64)) from chunk_test_context where key='manifest'))$$,'%different immutable byte identity%','a retained manifest path cannot be retagged with another original hash');
select extensions.lives_ok($$select pg_temp.register_chunks(repeat('a',64),null,'f1500000-0000-4000-8000-000000000001')$$,'existing retained chunks attach to an editable Takeoff without copying or recompression');
reset role;
select extensions.is((select source_document_id::text from public.takeoff_sets where id='f1500000-0000-4000-8000-000000000001'),(select value->>'id' from chunk_test_context where key='registered'),'Takeoff pins the exact retained document identity');
select extensions.is((select source_filename from public.takeoff_sets where id='f1500000-0000-4000-8000-000000000001'),'Synthetic original.pdf','original filename remains associated with the set');
select extensions.is((select count(*)::integer from public.takeoff_measurements where takeoff_set_id='f1500000-0000-4000-8000-000000000001'),0,'file attachment does not invent measured quantities');
set local role service_role;
select extensions.throws_like($$select public.carez_release_unused_source_upload(auth.uid(),array['f1200000-0000-4000-8000-000000000001/sources/f1600000-0000-4000-8000-000000000001/part-00000'])$$,'%cannot be released%','confirmed retained chunks cannot be made removable');
reset role;set local role authenticated;
select extensions.throws_like($$update public.company_document_chunks set content_sha256=repeat('b',64)$$,'%permission denied%','app roles cannot rewrite recorded chunk fingerprints');
select extensions.throws_like($$update public.company_documents set storage_path='f1200000-0000-4000-8000-000000000001/sources/different' where id=(select (value->>'id')::uuid from chunk_test_context where key='registered')$$,'%immutable%','retained document cannot point at a replacement object');
select extensions.throws_like($$select public.carez_attach_takeoff_plan('f1500000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001/plans/unverified.pdf','unverified.pdf','application/pdf')$$,'%permission denied%','the old unverified attachment API is retired');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.company_document_chunks),0,'employee cannot inspect private storage part paths');
reset role;set local role service_role;
select extensions.throws_like($$select pg_temp.register_chunks()$$,'%Owner or office%','server rechecks the actor role at registration');
reset role;set local role authenticated;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000003',true);
select extensions.is((select count(*)::integer from public.company_document_chunks where company_id='f1200000-0000-4000-8000-000000000001'),0,'foreign owner cannot inspect another company part metadata');
reset role;set local role service_role;
select extensions.throws_like($$select pg_temp.register_chunks()$$,'%outside its privacy scope%','server rechecks the actor tenant at registration');
reset role;select * from extensions.finish();rollback;
