-- PRIVATE PROPOSAL: current service-only source registration and preserved owner/employee phases.
-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Metadata/tenant/retry fixture. Real uploaded bytes are verified separately in
-- local browser acceptance, never inferred from these storage metadata rows.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('d1000000-0000-4000-8000-000000000001', 'intake-owner@pilot.invalid', jsonb_build_object('company_name','Fictional Pilot Contractor','full_name','Pilot Owner','operating_timezone','UTC')),
  ('d1000000-0000-4000-8000-000000000002', 'intake-employee@pilot.invalid', jsonb_build_object('company_name','Fictional Pilot Contractor','full_name','Pilot Employee','operating_timezone','UTC')),
  ('d1000000-0000-4000-8000-000000000003', 'other-intake@pilot.invalid', jsonb_build_object('company_name','Foreign Contractor','full_name','Other Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('d2000000-0000-4000-8000-000000000001', 'Fictional Pilot Contractor', 'UTC'),
  ('d2000000-0000-4000-8000-000000000002', 'Foreign Contractor', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('d1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'owner', 'Pilot Owner'),
  ('d1000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'employee', 'Pilot Employee'),
  ('d1000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000002', 'owner', 'Other Owner')) v(id,company_id,role,full_name)
where p.id=v.id::uuid;
insert into public.customers(id,company_id,name) values('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','Foreign customer');
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare payload jsonb:=jsonb_build_object('job_number','LOCAL-EXT-17','name','Fictional training refurbishment','customer_name','Example General Contractor','contact_name','Example Contact','agreement_reference','EXT-AG-17','agreement_evidence','reported_signed_no_executed_copy','agreement_amount',25000,'external_proposal_amount',25000.12,'provisional_change_reference','CO-TEST','provisional_change_amount',800,'external_notes','Unpriced RFQ; workbook is empty template, not actual costs.','state','WA');
 v_project uuid;v_retry uuid;v_customer uuid;v_rows integer;
begin
 begin perform public.carez_intake_external_job('d4000000-0000-4000-8000-000000000001',payload||'{"customer_name":null}');raise exception 'failure was accepted';exception when raise_exception then if sqlerrm='failure was accepted' then raise;end if;end;
 if exists(select 1 from public.projects where job_number='LOCAL-EXT-17') then raise exception 'failed save created a partial job';end if;
 v_project:=public.carez_intake_external_job('d4000000-0000-4000-8000-000000000001',payload);
 v_retry:=public.carez_intake_external_job('d4000000-0000-4000-8000-000000000001',payload);
 if v_project<>v_retry then raise exception 'retry created another job';end if;
 if (select count(*) from public.customers where name='Example General Contractor')<>1 then raise exception 'customer duplicated';end if;
 if not exists(select 1 from public.projects p join public.customers c on c.id=p.customer_id and c.company_id=p.company_id where p.id=v_project and p.job_number='LOCAL-EXT-17' and c.contact_name='Example Contact' and p.contract_value=25000 and p.source_estimate_id is null and p.award_decision_id is null) then raise exception 'source identity/linkage not preserved';end if;
 if exists(select 1 from public.leads) or exists(select 1 from public.proposal_presentations) or exists(select 1 from public.award_decisions) or exists(select 1 from public.commercial_baselines) then raise exception 'fabricated commercial history';end if;
 if not exists(select 1 from public.project_external_intakes where project_id=v_project and supplied_agreement_amount=25000 and external_proposal_amount=25000.12 and provisional_change_amount=800) then raise exception 'source measures reconciled or lost';end if;
 if (select job_ready from public.project_job_readiness_summary where project_id=v_project) then raise exception 'external attestation cleared authoritative hold';end if;
 begin perform public.carez_intake_external_job(gen_random_uuid(),payload||'{"job_number":" local-ext-17 "}');raise exception 'duplicate accepted';exception when raise_exception then if sqlerrm='duplicate accepted' then raise;end if;end;
 begin perform public.carez_intake_external_job(gen_random_uuid(),payload||'{"job_number":"LOCAL-OTHER","customer_id":"d3000000-0000-4000-8000-000000000001"}');raise exception 'foreign customer accepted';exception when raise_exception then if sqlerrm='foreign customer accepted' then raise;end if;end;
 select customer_id into v_customer from public.projects where id=v_project;
 update public.customers set billing_address_line1='10 Fictional Road',billing_address_line2='Suite 9',billing_city='Test City',billing_state='OR',billing_postal_code='01234' where id=v_customer;
 if (select billing_profile_revision from public.customers where id=v_customer)<>1 then raise exception 'address revision missing';end if;
 update public.customers set billing_address_line1='stale overwrite' where id=v_customer and billing_profile_revision=0;get diagnostics v_rows=row_count;
 if v_rows<>0 then raise exception 'stale save overwrote address';end if;
end $$;
select extensions.pass('external job entry, retry, exact identity, distinct source amounts, governing hold and customer CAS passed');

-- Historical invoice schema seam only. This privileged setup does not claim
-- invoice issue/posting authority; real Billing commands are tested separately.
reset role;
do $$ declare v_project uuid;v_customer uuid;begin
 select id,customer_id into v_project,v_customer from public.projects
 where company_id='d2000000-0000-4000-8000-000000000001' and job_number='LOCAL-EXT-17';
 insert into public.invoices(company_id,project_id,customer_id,invoice_number,invoice_type,status,issue_date,from_name,from_address_line2,bill_to_name,bill_to_address_line1,bill_to_address_line2,bill_to_city,bill_to_state,bill_to_postal_code,created_by)
 select p.company_id,p.id,c.id,'LOCAL-SNAPSHOT','progress','sent',current_date,'Sender fixture','Sender suite',c.name,c.billing_address_line1,c.billing_address_line2,c.billing_city,c.billing_state,c.billing_postal_code,auth.uid() from public.projects p join public.customers c on c.id=p.customer_id where p.id=v_project;
end $$;
set local role authenticated;
do $$ declare v_project uuid;v_customer uuid;begin
 select id,customer_id into v_project,v_customer from public.projects where job_number='LOCAL-EXT-17';
 update public.customers set billing_address_line2='Updated later' where id=v_customer;
 if not exists(select 1 from public.invoices where invoice_number='LOCAL-SNAPSHOT' and bill_to_address_line2='Suite 9' and bill_to_postal_code='01234' and from_address_line2='Sender suite') then raise exception 'snapshot changed with customer or sender';end if;
end $$;
select extensions.pass('owner customer edit preserves historical bill-to address and separate sender snapshot');
reset role;
insert into storage.objects(bucket_id,name) values
 ('carez-documents','d2000000-0000-4000-8000-000000000001/sources/a'),
 ('carez-documents','d2000000-0000-4000-8000-000000000001/sources/b'),
 ('carez-documents','d2000000-0000-4000-8000-000000000001/office-private/c');
create temp table intake_test_context(key text primary key,value jsonb);
grant all on intake_test_context to authenticated,service_role;
insert into intake_test_context select 'project',jsonb_build_object('id',id)
 from public.projects where company_id='d2000000-0000-4000-8000-000000000001' and job_number='LOCAL-EXT-17';
-- INVOKER fixture adapter. Calling it as a client still cannot execute v3.
-- Synthetic metadata models the trusted server's explicit actor and seals;
-- uploaded-byte verification remains separately qualified over actual HTTP.
create function pg_temp.intake_register_source(p_project uuid,p_path text,p_hash text,p_bytes bigint,p_type text,p_title text,p_filename text,p_reference text,p_revision text,p_parent uuid default null,p_visibility text default 'job')
 returns jsonb language sql as $$select public.carez_register_source_document_v3(p_project,p_path,p_hash,p_bytes,'application/pdf',p_type,p_title,p_filename,p_reference,p_revision,p_parent,p_visibility,null,null,auth.uid());$$;
set local role authenticated;
select extensions.throws_like($$select pg_temp.intake_register_source((select (value->>'id')::uuid from intake_test_context where key='project'),'d2000000-0000-4000-8000-000000000001/sources/a',repeat('a',64),120,'plan','Client source claim','drawing-A.pdf','Client claim','R1')$$,'%permission denied%','application caller cannot attest unverified original bytes');
reset role;set local role service_role;
select public.carez_seal_source_upload(auth.uid(),array[
 'd2000000-0000-4000-8000-000000000001/sources/a',
 'd2000000-0000-4000-8000-000000000001/sources/b',
 'd2000000-0000-4000-8000-000000000001/office-private/c']);
insert into intake_test_context values('a',pg_temp.intake_register_source((select (value->>'id')::uuid from intake_test_context where key='project'),'d2000000-0000-4000-8000-000000000001/sources/a',repeat('a',64),120,'plan','Fictional current bundle','drawing-A.pdf','Package A','R1'));
insert into intake_test_context values('duplicate',pg_temp.intake_register_source((select (value->>'id')::uuid from intake_test_context where key='project'),'d2000000-0000-4000-8000-000000000001/sources/a',repeat('a',64),120,'plan','Alias title','duplicate-name.pdf','Package B','R1'));
reset role;set local role authenticated;
do $$ declare v_project uuid;v_a jsonb;v_dup jsonb;v_set uuid;v_reopen uuid;begin
 select (value->>'id')::uuid into v_project from intake_test_context where key='project';
 select value into v_a from intake_test_context where key='a';
 select value into v_dup from intake_test_context where key='duplicate';
 if v_a->>'id'<>v_dup->>'id' or (select count(*) from public.document_source_aliases where document_id=(v_a->>'id')::uuid)<>2 then raise exception 'exact-content aliases failed';end if;
 v_set:=public.carez_open_external_job_takeoff(v_project,(v_a->>'id')::uuid);
 v_reopen:=public.carez_open_external_job_takeoff(v_project,(v_a->>'id')::uuid);
 if v_set<>v_reopen then raise exception 'reopen duplicated planning estimate';end if;
 if not exists(select 1 from public.takeoff_sets ts join public.estimates e on e.id=ts.estimate_id join public.projects p on p.id=e.project_id where ts.id=v_set and e.status='draft' and e.lead_id is null and e.job_spine_id=p.job_spine_id and ts.source_document_id=(v_a->>'id')::uuid) then raise exception 'planning lineage failed';end if;
 insert into intake_test_context values('set',jsonb_build_object('id',v_set));
end $$;
select extensions.pass('registered original aliases and owner planning reopen retain exact job/estimate/source lineage');
reset role;set local role service_role;
insert into intake_test_context values('b',pg_temp.intake_register_source((select (value->>'id')::uuid from intake_test_context where key='project'),'d2000000-0000-4000-8000-000000000001/sources/b',repeat('b',64),140,'plan','Fictional changed bundle','drawing-B.pdf','Package C','R2',(select (value->>'id')::uuid from intake_test_context where key='a')));
select extensions.throws_like($$select pg_temp.intake_register_source((select (value->>'id')::uuid from intake_test_context where key='project'),'d2000000-0000-4000-8000-000000000001/office-private/c',repeat('c',64),100,'w9','Private W9','private.pdf','Office source',null,null,'office_private')$$,'%cannot be linked to a job%','trusted registration still refuses private source/job linkage');
insert into intake_test_context values('private',pg_temp.intake_register_source(null,'d2000000-0000-4000-8000-000000000001/office-private/c',repeat('c',64),100,'w9','Private W9','private.pdf','Office source',null,null,'office_private'));
reset role;set local role authenticated;
do $$ declare v_project uuid;v_a jsonb;v_b jsonb;v_private jsonb;v_set uuid;begin
 select (value->>'id')::uuid into v_project from intake_test_context where key='project';
 select value into v_a from intake_test_context where key='a';
 select value into v_b from intake_test_context where key='b';
 select value into v_private from intake_test_context where key='private';
 select (value->>'id')::uuid into v_set from intake_test_context where key='set';
 if not exists(select 1 from public.company_documents where id=(v_a->>'id')::uuid and revision_state='historical') or not exists(select 1 from public.company_documents where id=(v_b->>'id')::uuid and supersedes_id=(v_a->>'id')::uuid and revision_state='current') then raise exception 'revision retention failed';end if;
 if (select source_document_id from public.takeoff_sets where id=v_set)<>(v_a->>'id')::uuid then raise exception 'existing Takeoff silently moved to new revision';end if;
 if not exists(select 1 from public.company_documents where id=(v_private->>'id')::uuid and project_id is null and visibility='office_private') then raise exception 'private scope failed';end if;
 begin insert into public.company_documents(company_id,project_id,title,storage_path) values(public.get_my_company_id(),v_project,'Private alias bypass','d2000000-0000-4000-8000-000000000001/office-private/c');raise exception 'private path alias accepted';exception when raise_exception then if sqlerrm='private path alias accepted' then raise;end if;end;
 begin update public.company_documents set revision_state='current' where id=(v_a->>'id')::uuid;raise exception 'direct revision rewrite accepted';exception when insufficient_privilege then null;end;
 begin insert into public.company_documents(company_id,title,content_sha256) values(public.get_my_company_id(),'Unverified direct hash',repeat('f',64));raise exception 'direct hash insert accepted';exception when insufficient_privilege then null;end;
 begin delete from public.company_documents where id=(v_a->>'id')::uuid;raise exception 'historical deletion accepted';exception when raise_exception then if sqlerrm='historical deletion accepted' then raise;end if;end;
 begin
  update storage.objects set name=name||'-rewrite' where bucket_id='carez-documents' and name='d2000000-0000-4000-8000-000000000001/sources/a';
  if found then raise exception 'retained bytes mutable';end if;
 exception when insufficient_privilege then null;
  when raise_exception then if sqlerrm not ilike '%sealed%' then raise;end if;
 end;
 begin
  delete from storage.objects where bucket_id='carez-documents' and name='d2000000-0000-4000-8000-000000000001/sources/a';
  if found then raise exception 'retained object deleted';end if;
 exception when insufficient_privilege then null;
 end;
 if not exists(select 1 from storage.objects where bucket_id='carez-documents' and name='d2000000-0000-4000-8000-000000000001/sources/a') then raise exception 'retained metadata disappeared';end if;
end $$;
-- Historical pin setup is privileged; clients cannot revive retired authoring.
reset role;
do $$ declare v_doc uuid;v_set uuid;begin
 insert into public.company_documents(company_id,project_id,title,document_type,mime_type,storage_path)
 select company_id,id,'Legacy pinned plan','plan','application/pdf','d2000000-0000-4000-8000-000000000001/legacy-pinned-path' from public.projects where company_id='d2000000-0000-4000-8000-000000000001' and job_number='LOCAL-EXT-17' returning id into v_doc;
 insert into public.takeoff_sets(company_id,estimate_id,name,source_document_id,status)
 select company_id,estimate_id,'Legacy pinned fixture',v_doc,'superseded' from public.takeoff_sets where company_id='d2000000-0000-4000-8000-000000000001' limit 1 returning id into v_set;
 begin update public.company_documents set storage_path='rewritten-path' where id=v_doc;raise exception 'legacy pinned identity rewritten';exception when raise_exception then if sqlerrm='legacy pinned identity rewritten' then raise;end if;end;
end $$;
select extensions.pass('source revisions, pinned planning identity, private scope and retained object immutability passed');
reset role;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.is((select count(*) from public.company_documents),0::bigint,'employee cannot see office source documents');
select extensions.is((select count(*) from storage.objects where bucket_id='carez-documents'),0::bigint,'employee cannot see source objects');
select extensions.throws_ok($$select public.carez_intake_external_job(gen_random_uuid(),'{}'::jsonb)$$,'P0001','Owner or office access required.','employee cannot intake jobs');
reset role;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select extensions.is((select count(*) from public.project_external_intakes),0::bigint,'foreign owner cannot read intake evidence');
select extensions.is((select count(*) from public.document_source_aliases),0::bigint,'foreign owner cannot read aliases');
select * from extensions.finish();
rollback;
