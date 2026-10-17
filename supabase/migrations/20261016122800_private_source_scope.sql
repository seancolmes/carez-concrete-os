-- Explicit privacy is independent of document purpose. Existing retained identity and storage guards remain in force.
create or replace function public.carez_register_source_document_v2(p_project_id uuid,p_path text,p_hash text,p_bytes bigint,p_mime text,p_type text,p_title text,p_filename text,p_source_reference text,p_revision_label text,p_supersedes_id uuid default null,p_visibility text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_visibility text;v_doc public.company_documents%rowtype;v_parent public.company_documents%rowtype;v_private boolean:=p_visibility='office_private';
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 if p_visibility is null or p_visibility not in ('job','office_private') then raise exception 'Choose job or office-private access.';end if;
 if p_type in ('w9','tax') and p_visibility<>'office_private' then raise exception 'W9 and tax sources require office-private access.';end if;
 v_visibility:=p_visibility;
 if not v_private and p_project_id is null then raise exception 'Choose a job for a job source; company-only sources belong in the private vault.';end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes<=0 or p_bytes>104857600 or nullif(btrim(p_title),'') is null or nullif(btrim(p_filename),'') is null or nullif(btrim(p_source_reference),'') is null then raise exception 'Verified bytes, title and source identity are required.'; end if;
 if p_type not in ('plan','agreement','proposal','rfq','reference','insurance','w9','tax') then raise exception 'Unsupported source document type.'; end if;
 if p_path not like (v_company::text||'/'||(case when v_private then 'office-private/' else 'sources/' end)||'%') or p_path like '%..%' then raise exception 'Source path is outside its privacy scope.'; end if;
 if v_private and p_project_id is not null then raise exception 'Private company sources cannot be linked to a job.'; end if;
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
revoke all on function public.carez_register_source_document_v2(uuid,text,text,bigint,text,text,text,text,text,text,uuid,text) from public,anon;
grant execute on function public.carez_register_source_document_v2(uuid,text,text,bigint,text,text,text,text,text,text,uuid,text) to authenticated;

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
 if tg_op='UPDATE' and (old.content_sha256 is not null or exists(select 1 from public.takeoff_sets where source_document_id=old.id)) and (new.id,new.company_id,new.project_id,new.content_sha256,new.byte_size,new.storage_path,new.visibility,new.supersedes_id,new.document_type,new.mime_type)
  is distinct from (old.id,old.company_id,old.project_id,old.content_sha256,old.byte_size,old.storage_path,old.visibility,old.supersedes_id,old.document_type,old.mime_type) then raise exception 'Retained source identity is immutable. Upload a revision instead.'; end if;
 return new;
end $$;
revoke all on function public.carez_guard_retained_document() from public,anon,authenticated;

revoke all on function public.carez_guard_retained_document() from public,anon,authenticated;
