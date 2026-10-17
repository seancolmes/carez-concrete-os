-- Atomic registration and optional Takeoff binding after server-side byte verification.
create or replace function public.carez_register_source_document_v3(p_project_id uuid,p_path text,p_hash text,p_bytes bigint,p_mime text,p_type text,p_title text,p_filename text,p_source_reference text,p_revision_label text,p_supersedes_id uuid default null,p_visibility text default null,p_manifest jsonb default null,p_takeoff_set_id uuid default null,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_visibility text;v_doc public.company_documents%rowtype;v_parent public.company_documents%rowtype;v_private boolean:=p_visibility='office_private';v_set public.takeoff_sets%rowtype;v_estimate public.estimates%rowtype;
begin
 select company_id,role into v_company,v_role from public.profiles where id=p_actor_id;
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 if p_visibility is null or p_visibility not in ('job','office_private') then raise exception 'Choose job or office-private access.';end if;
 if p_type in ('w9','tax') and p_visibility<>'office_private' then raise exception 'W9 and tax sources require office-private access.';end if;
 v_visibility:=p_visibility;
 if p_type is null or (p_type='plan' and p_mime is distinct from 'application/pdf') then raise exception 'Plan sources require original PDF content.';end if;
 if p_manifest is not null and p_manifest->>'filename' is distinct from p_filename then raise exception 'Original filename differs from the chunk manifest.';end if;
 if p_takeoff_set_id is not null then
  if v_private or p_type<>'plan' or p_mime<>'application/pdf' then raise exception 'Takeoff requires a job-scoped PDF source.';end if;
  select e.* into v_estimate from public.estimates e join public.takeoff_sets t on t.estimate_id=e.id and t.company_id=e.company_id where e.company_id=v_company and t.id=p_takeoff_set_id for update of e;
  if not found then raise exception 'Takeoff estimate unavailable.';end if;
  select * into v_set from public.takeoff_sets where company_id=v_company and id=p_takeoff_set_id and status='active' for update;
  if not found or v_set.estimate_id<>v_estimate.id then raise exception 'Active takeoff set unavailable.';end if;
  p_project_id:=v_estimate.project_id;
  if v_set.source_document_id is not null then
   select * into v_doc from public.company_documents where company_id=v_company and id=v_set.source_document_id;
   if v_doc.content_sha256=p_hash and v_doc.byte_size=p_bytes then return jsonb_build_object('id',v_doc.id,'storage_path',v_doc.storage_path,'revision_state',v_doc.revision_state,'takeoff_set_id',v_set.id);end if;
   raise exception 'This takeoff revision already has source plans. Create the next revision before replacing them.';
  end if;
  if v_estimate.status in ('accepted','approved','superseded') or exists(select 1 from public.proposal_presentations where company_id=v_company and estimate_id=v_estimate.id) then raise exception 'This estimate revision is locked.';end if;
  if exists(select 1 from public.takeoff_measurements where company_id=v_company and takeoff_set_id=v_set.id and status='active') then raise exception 'This takeoff already has measurements. Create the next revision before changing source plans.';end if;
 elsif not v_private and p_project_id is null then raise exception 'Choose a job for a job source; company-only sources belong in the private vault.';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes<=0 or p_bytes>104857600 or nullif(btrim(p_title),'') is null or nullif(btrim(p_filename),'') is null or nullif(btrim(p_source_reference),'') is null then raise exception 'Verified bytes, title and source identity are required.'; end if;
 if p_type not in ('plan','agreement','proposal','rfq','reference','insurance','w9','tax') then raise exception 'Unsupported source document type.'; end if;
 if p_path not like (v_company::text||'/'||(case when v_private then 'office-private/' else 'sources/' end)||'%') or p_path like '%..%' then raise exception 'Source path is outside its privacy scope.'; end if;
 if exists(select 1 from public.company_documents d where d.company_id=v_company and d.storage_path=p_path and d.content_sha256 is not null and (d.content_sha256,d.byte_size,d.storage_format,d.project_id,d.visibility,d.document_type,d.mime_type,d.source_manifest) is distinct from (p_hash,p_bytes,case when p_manifest is null then 'single' else 'chunked' end,p_project_id,p_visibility,p_type,p_mime,p_manifest)) then raise exception 'This retained source path already has a different immutable byte identity.';end if;
 if v_private and p_project_id is not null then raise exception 'Private company sources cannot be linked to a job.'; end if;
 if p_project_id is not null and not exists(select 1 from public.projects where company_id=v_company and id=p_project_id) then raise exception 'Job unavailable.'; end if;
 if not exists(select 1 from storage.objects where bucket_id='carez-documents' and name=p_path) then raise exception 'Uploaded source object is unavailable.'; end if;
 perform 1 from public.source_upload_seals where company_id=v_company and storage_path=p_path for update;
 if not found then raise exception 'Original source must be sealed before verification.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||coalesce(p_project_id::text,'company')||v_visibility||p_hash,0));
 select * into v_doc from public.company_documents where company_id=v_company and project_id is not distinct from p_project_id and visibility=v_visibility and content_sha256=p_hash;
 if v_doc.id is not null and v_doc.document_type<>p_type then raise exception 'Exact content is already recorded under a different source purpose. Use the existing classification.';end if;
 if v_doc.id is null then
  if p_supersedes_id is not null then
   select * into v_parent from public.company_documents where id=p_supersedes_id and company_id=v_company for update;
   if v_parent.id is null or v_parent.project_id is distinct from p_project_id or v_parent.visibility<>v_visibility or v_parent.document_type<>p_type or v_parent.revision_state<>'current' then raise exception 'Choose the current source in the same job, type and privacy scope.'; end if;
  end if;
  insert into public.company_documents(company_id,project_id,document_type,title,storage_path,mime_type,source,review_status,created_by,content_sha256,byte_size,visibility,supersedes_id,revision_label,storage_format,source_manifest)
   values(v_company,p_project_id,p_type,btrim(p_title),p_path,p_mime,'external_intake','filed',p_actor_id,p_hash,p_bytes,v_visibility,p_supersedes_id,nullif(btrim(p_revision_label),''),case when p_manifest is null then 'single' else 'chunked' end,p_manifest) returning * into v_doc;
  if v_parent.id is not null then update public.company_documents set revision_state='historical' where id=v_parent.id and company_id=v_company; end if;
 end if;
 if p_manifest is not null and v_doc.storage_path=p_path then perform public.carez_register_document_chunks(v_company,v_doc.id,p_manifest);end if;
 if p_takeoff_set_id is not null then update public.takeoff_sets set source_document_id=v_doc.id,source_filename=p_filename,page_count=null where company_id=v_company and id=p_takeoff_set_id;if not found then raise exception 'No Takeoff source attachment was confirmed.';end if;end if;
 insert into public.document_source_aliases(company_id,document_id,original_filename,source_reference,created_by)
 values(v_company,v_doc.id,p_filename,p_source_reference,p_actor_id) on conflict(document_id,original_filename,source_reference) do nothing;
 return jsonb_build_object('id',v_doc.id,'storage_path',v_doc.storage_path,'revision_state',v_doc.revision_state);
end $$;
revoke all on function public.carez_register_source_document_v3(uuid,text,text,bigint,text,text,text,text,text,text,uuid,text,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.carez_register_source_document_v3(uuid,text,text,bigint,text,text,text,text,text,text,uuid,text,jsonb,uuid,uuid) to service_role;


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
 if new.visibility='office_private' and (new.project_id is not null or new.bank_transaction_id is not null or new.purchase_order_id is not null or new.purchase_order_receipt_id is not null or new.vendor_bill_id is not null) then raise exception 'Private company sources cannot be linked to jobs or financial transactions.';end if;
 if new.document_type in ('w9','tax') and new.visibility<>'office_private' then raise exception 'Tax and W9 files require office-private storage.'; end if;
 if tg_op='UPDATE' and (old.content_sha256 is not null or exists(select 1 from public.takeoff_sets where source_document_id=old.id)) and (new.id,new.company_id,new.project_id,new.content_sha256,new.byte_size,new.storage_path,new.visibility,new.supersedes_id,new.document_type,new.mime_type,new.storage_format,new.source_manifest)
  is distinct from (old.id,old.company_id,old.project_id,old.content_sha256,old.byte_size,old.storage_path,old.visibility,old.supersedes_id,old.document_type,old.mime_type,old.storage_format,old.source_manifest) then raise exception 'Retained source identity is immutable. Upload a revision instead.'; end if;
 return new;
end $$;
revoke all on function public.carez_guard_retained_document() from public,anon,authenticated;

-- Retire the old unverified attachment entry point; no historical rows or functions are dropped.
revoke all on function public.carez_attach_takeoff_plan(uuid,text,text,text) from public,anon,authenticated;

-- Only the trusted server may attest verified original bytes.
revoke all on function public.carez_register_source_document(uuid,text,text,bigint,text,text,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function public.carez_register_source_document_v2(uuid,text,text,bigint,text,text,text,text,text,text,uuid,text) from public,anon,authenticated;
