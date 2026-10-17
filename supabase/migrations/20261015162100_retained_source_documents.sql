-- Retained external source documents. No filename or sheet-label based identity.
alter table public.company_documents add column if not exists content_sha256 text check(content_sha256 ~ '^[a-f0-9]{64}$');
alter table public.company_documents add column if not exists byte_size bigint check(byte_size>0);
alter table public.company_documents add column if not exists visibility text not null default 'job' check(visibility in ('job','office_private'));
alter table public.company_documents add column if not exists supersedes_id uuid references public.company_documents(id) on delete restrict;
alter table public.company_documents add column if not exists revision_label text;
alter table public.company_documents add column if not exists revision_state text not null default 'current' check(revision_state in ('current','historical'));
create unique index retained_document_content on public.company_documents(company_id,coalesce(project_id,'00000000-0000-0000-0000-000000000000'::uuid),visibility,content_sha256) where content_sha256 is not null;
create table public.document_source_aliases(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),document_id uuid not null references public.company_documents(id) on delete restrict,
 original_filename text not null,source_reference text not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 unique(document_id,original_filename,source_reference)
);
alter table public.document_source_aliases enable row level security;
create policy document_alias_read on public.document_source_aliases for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.document_source_aliases from public,anon,authenticated;grant select on public.document_source_aliases to authenticated;
create or replace function public.carez_guard_retained_document() returns trigger language plpgsql set search_path=public as $$ begin
 if tg_op='DELETE' then
  if old.content_sha256 is not null or exists(select 1 from public.takeoff_sets where source_document_id=old.id) then raise exception 'Retained or referenced source documents cannot be deleted.'; end if;return old;
 end if;
 if current_user='authenticated' and (tg_op='INSERT' or (new.company_id,new.project_id,new.storage_path,new.visibility) is distinct from (old.company_id,old.project_id,old.storage_path,old.visibility)) and new.storage_path is not null then
  if new.storage_path not like new.company_id::text||'/%' or new.storage_path like '%..%' then raise exception 'Document path must remain in the company storage scope.';end if;
  if new.storage_path like new.company_id::text||'/office-private/%' and new.visibility<>'office_private' then raise exception 'Office-private paths cannot become job attachments.';end if;
 end if;
 if new.project_id is not null and not exists(select 1 from public.projects where id=new.project_id and company_id=new.company_id) then raise exception 'Document job must belong to the same company.'; end if;
 if new.visibility='office_private' and new.project_id is not null then raise exception 'Office-private files cannot become job attachments.'; end if;
 if new.visibility='office_private' and (new.bank_transaction_id is not null or new.vendor_bill_id is not null or new.purchase_order_id is not null or new.purchase_order_receipt_id is not null) then raise exception 'Office-private files cannot become transaction evidence.'; end if;
 if new.supersedes_id is not null and not exists(select 1 from public.company_documents d where d.id=new.supersedes_id and d.company_id=new.company_id and d.project_id is not distinct from new.project_id and d.visibility=new.visibility) then raise exception 'Revision parent must have the same tenant and privacy scope.'; end if;
 if new.document_type in ('w9','tax') and new.visibility<>'office_private' then raise exception 'Tax and W9 files require office-private storage.'; end if;
 if tg_op='UPDATE' and (old.content_sha256 is not null or exists(select 1 from public.takeoff_sets where source_document_id=old.id)) and (new.id,new.company_id,new.project_id,new.content_sha256,new.byte_size,new.storage_path,new.visibility,new.supersedes_id,new.document_type,new.mime_type)
  is distinct from (old.id,old.company_id,old.project_id,old.content_sha256,old.byte_size,old.storage_path,old.visibility,old.supersedes_id,old.document_type,old.mime_type) then raise exception 'Retained source identity is immutable. Upload a revision instead.'; end if;
 return new;
end $$;
revoke all on function public.carez_guard_retained_document() from public,anon,authenticated;
create trigger retained_document_guard before insert or update or delete on public.company_documents for each row execute function public.carez_guard_retained_document();
-- Legacy upload/review fields remain available under their existing RLS. Verified
-- identity and revision transitions can only be written by registration's definer.
revoke insert,update on public.company_documents from authenticated;
grant insert(id,company_id,project_id,document_type,title,vendor_id,document_date,amount,storage_path,mime_type,source,bank_transaction_id,purchase_order_id,vendor_bill_id,notes,created_by,created_at,review_status,reference_number,purchase_order_receipt_id,reviewed_at,reviewed_by,updated_at) on public.company_documents to authenticated;
grant update(id,company_id,project_id,document_type,title,vendor_id,document_date,amount,storage_path,mime_type,source,bank_transaction_id,purchase_order_id,vendor_bill_id,notes,created_by,created_at,review_status,reference_number,purchase_order_receipt_id,reviewed_at,reviewed_by,updated_at) on public.company_documents to authenticated;
create or replace function public.carez_register_source_document(p_project_id uuid,p_path text,p_hash text,p_bytes bigint,p_mime text,p_type text,p_title text,p_filename text,p_source_reference text,p_revision_label text,p_supersedes_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_visibility text;v_doc public.company_documents%rowtype;v_parent public.company_documents%rowtype;v_private boolean:=p_type in ('w9','tax');
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 v_visibility:=case when v_private then 'office_private' else 'job' end;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes<=0 or p_bytes>104857600 or nullif(btrim(p_title),'') is null or nullif(btrim(p_filename),'') is null or nullif(btrim(p_source_reference),'') is null then raise exception 'Verified bytes, title and source identity are required.'; end if;
 if p_type not in ('plan','agreement','proposal','rfq','reference','w9','tax') then raise exception 'Unsupported source document type.'; end if;
 if p_path not like (v_company::text||'/'||(case when v_private then 'office-private/' else 'sources/' end)||'%') or p_path like '%..%' then raise exception 'Source path is outside its privacy scope.'; end if;
 if v_private and p_project_id is not null then raise exception 'Private tax files cannot be linked to a job.'; end if;
 if p_project_id is not null and not exists(select 1 from public.projects where company_id=v_company and id=p_project_id) then raise exception 'Job unavailable.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='carez-documents' and name=p_path) then raise exception 'Uploaded source object is unavailable.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||coalesce(p_project_id::text,'company')||v_visibility||p_hash,0));
 select * into v_doc from public.company_documents where company_id=v_company and project_id is not distinct from p_project_id and visibility=v_visibility and content_sha256=p_hash;
 if v_doc.id is not null and v_doc.document_type<>p_type then raise exception 'Exact content is already recorded under a different source purpose. Use the existing classification.';end if;
 if v_doc.id is null then
  if p_supersedes_id is not null then
   select * into v_parent from public.company_documents where id=p_supersedes_id and company_id=v_company for update;
   if v_parent.id is null or v_parent.project_id is distinct from p_project_id or v_parent.visibility<>v_visibility or v_parent.document_type<>p_type or v_parent.revision_state<>'current' then raise exception 'Choose the current source in the same job, type and privacy scope.'; end if;
  end if;
  insert into public.company_documents(company_id,project_id,document_type,title,storage_path,mime_type,source,review_status,created_by,content_sha256,byte_size,visibility,supersedes_id,revision_label)
   values(v_company,p_project_id,p_type,btrim(p_title),p_path,p_mime,'external_intake','filed',auth.uid(),p_hash,p_bytes,v_visibility,p_supersedes_id,nullif(btrim(p_revision_label),'')) returning * into v_doc;
  if v_parent.id is not null then update public.company_documents set revision_state='historical' where id=v_parent.id and company_id=v_company; end if;
 end if;
 insert into public.document_source_aliases(company_id,document_id,original_filename,source_reference,created_by)
 values(v_company,v_doc.id,p_filename,p_source_reference,auth.uid()) on conflict(document_id,original_filename,source_reference) do nothing;
 return jsonb_build_object('id',v_doc.id,'storage_path',v_doc.storage_path,'revision_state',v_doc.revision_state);
end $$;
revoke all on function public.carez_register_source_document(uuid,text,text,bigint,text,text,text,text,text,text,uuid) from public,anon;
grant execute on function public.carez_register_source_document(uuid,text,text,bigint,text,text,text,text,text,text,uuid) to authenticated;
-- Preserve a pre-existing private bucket's limits; do not silently convert public storage.
insert into storage.buckets(id,name,public) values('carez-documents','carez-documents',false) on conflict(id) do nothing;
do $$ begin if exists(select 1 from storage.buckets where id='carez-documents' and public) then raise exception 'carez-documents must be private; review compatibility before deployment.'; end if;end $$;
create policy source_documents_owner_office on storage.objects for all to authenticated
 using(bucket_id='carez-documents' and (storage.foldername(name))[1]=public.get_my_company_id()::text and public.get_my_role() in ('owner','office'))
 with check(bucket_id='carez-documents' and (storage.foldername(name))[1]=public.get_my_company_id()::text and public.get_my_role() in ('owner','office'));
create policy source_documents_tenant_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'carez-documents' or ((storage.foldername(name))[1]=public.get_my_company_id()::text and public.get_my_role() in ('owner','office')))
 with check(bucket_id<>'carez-documents' or ((storage.foldername(name))[1]=public.get_my_company_id()::text and public.get_my_role() in ('owner','office')));
create policy source_documents_preserve on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'carez-documents' or not exists(select 1 from public.company_documents d where d.storage_path=name));
create policy source_documents_no_anonymous on storage.objects as restrictive for all to anon using(bucket_id<>'carez-documents') with check(bucket_id<>'carez-documents');
create policy source_documents_immutable_bytes on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'carez-documents' or not exists(select 1 from public.company_documents d where d.storage_path=name))
 with check(bucket_id<>'carez-documents' or not exists(select 1 from public.company_documents d where d.storage_path=name));

create or replace function public.carez_open_external_job_takeoff(p_project_id uuid,p_document_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id();v_project public.projects%rowtype;v_doc public.company_documents%rowtype;v_estimate uuid;v_set uuid;v_number text;v_version integer;v_oh record;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 select * into v_project from public.projects where id=p_project_id and company_id=v_company for update;
 if v_project.id is null or not exists(select 1 from public.project_external_intakes where company_id=v_company and project_id=v_project.id) then raise exception 'Existing external job unavailable.'; end if;
 select * into v_doc from public.company_documents where id=p_document_id and company_id=v_company and project_id=v_project.id;
 if v_doc.id is null or v_doc.document_type<>'plan' or v_doc.mime_type<>'application/pdf' or v_doc.visibility<>'job' or v_doc.revision_state<>'current' or v_doc.content_sha256 is null then raise exception 'Choose a verified current PDF plan source for this job.'; end if;
 select ts.id into v_set from public.takeoff_sets ts join public.estimates e on e.id=ts.estimate_id and e.company_id=ts.company_id where ts.company_id=v_company and e.project_id=v_project.id and ts.source_document_id=v_doc.id order by ts.created_at desc limit 1;
 if v_set is not null then return v_set; end if;
 v_number:='E-'||v_project.job_number;
 select coalesce(max(version),0)+1 into v_version from public.estimates where company_id=v_company and estimate_number=v_number;
 select * into v_oh from public.capture_overhead_rate_snapshot(current_date);
 if v_oh.id is null then raise exception 'Overhead snapshot unavailable.'; end if;
 insert into public.estimates(company_id,project_id,estimate_number,opportunity_number,version,name,notes,overhead_snapshot_id,overhead_rate_snapshot,created_by)
 values(v_company,v_project.id,v_number,v_project.job_number,v_version,v_project.name||' · post-award plan quantities','External job planning estimate. Not the source agreement, approved budget, or accepted commercial baseline.',v_oh.id,v_oh.overhead_rate_per_productive_hour,auth.uid()) returning id into v_estimate;
 insert into public.estimate_sections(company_id,estimate_id,name,scope_type,sort_order) values(v_company,v_estimate,'Footings','footing',10),(v_company,v_estimate,'Slabs / Flatwork','flatwork',20);
 insert into public.takeoff_sets(company_id,estimate_id,name,revision_label,source_document_id,source_filename,notes,created_by)
 values(v_company,v_estimate,v_project.name,coalesce(v_doc.revision_label,'Current source'),v_doc.id,v_doc.title,'Pinned retained source. Repeated sheet labels do not establish governing scope.',auth.uid()) returning id into v_set;
 return v_set;
end $$;
revoke all on function public.carez_open_external_job_takeoff(uuid,uuid) from public,anon;
grant execute on function public.carez_open_external_job_takeoff(uuid,uuid) to authenticated;
