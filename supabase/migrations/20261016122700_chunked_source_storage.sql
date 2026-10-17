-- Large originals use bounded private objects; the document identity is the
-- SHA-256 of the byte-exact original, never the JSON manifest or a compressed PDF.
-- Seal staged objects before the trusted server reads them. A registered digest
-- must never describe bytes that a concurrent uploader can replace or remove.
create table public.source_upload_seals(
 company_id uuid not null references public.companies(id),storage_path text primary key,storage_object_id uuid not null references storage.objects(id) on delete restrict,
 sealed_by uuid not null references public.profiles(id),sealed_at timestamptz not null default now()
);
alter table public.source_upload_seals enable row level security;
create policy source_upload_seals_read on public.source_upload_seals for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.source_upload_seals from public,anon,authenticated;grant select on public.source_upload_seals to authenticated;
create function public.carez_seal_source_upload(p_actor_id uuid,p_paths text[]) returns void language plpgsql security definer set search_path=pg_catalog,public,storage as $$
declare v_company uuid;v_role text;v_path text;v_object_id uuid;
begin
 select company_id,role into v_company,v_role from public.profiles where id=p_actor_id;
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 if cardinality(p_paths) not between 1 and 35 then raise exception 'Source upload paths unavailable.';end if;
 for v_path in select distinct unnest(p_paths) order by 1 loop
  if v_path is null or v_path like '%..%' or (v_path not like v_company::text||'/sources/%' and v_path not like v_company::text||'/office-private/%') then raise exception 'Source path is outside its privacy scope.';end if;
  select id into v_object_id from storage.objects where bucket_id='carez-documents' and name=v_path for update;
  if not found then raise exception 'Uploaded source object is unavailable.';end if;
  insert into public.source_upload_seals(company_id,storage_path,storage_object_id,sealed_by) values(v_company,v_path,v_object_id,p_actor_id) on conflict(storage_path) do nothing;
  if not exists(select 1 from public.source_upload_seals where storage_path=v_path and company_id=v_company and storage_object_id=v_object_id) then raise exception 'Sealed source object identity changed.';end if;
 end loop;
end $$;
revoke all on function public.carez_seal_source_upload(uuid,text[]) from public,anon,authenticated;grant execute on function public.carez_seal_source_upload(uuid,text[]) to service_role;
create function public.carez_guard_sealed_source_object() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if old.bucket_id='carez-documents' and exists(select 1 from public.source_upload_seals where storage_path=old.name) then raise exception 'Verified source bytes are sealed. Upload a new revision instead.';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.carez_guard_sealed_source_object() from public,anon,authenticated;
create trigger guard_sealed_source_bytes before update or delete on storage.objects for each row execute function public.carez_guard_sealed_source_object();
create policy sealed_source_bytes_preserve on storage.objects as restrictive for delete to authenticated using(bucket_id<>'carez-documents' or not exists(select 1 from public.source_upload_seals where storage_path=name));
create policy sealed_source_bytes_immutable on storage.objects as restrictive for update to authenticated using(bucket_id<>'carez-documents' or not exists(select 1 from public.source_upload_seals where storage_path=name)) with check(bucket_id<>'carez-documents' or not exists(select 1 from public.source_upload_seals where storage_path=name));
alter table public.company_documents add column storage_format text not null default 'single' check(storage_format in ('single','chunked'));
alter table public.company_documents add column source_manifest jsonb;
alter table public.company_documents add constraint document_storage_manifest check((storage_format='single' and source_manifest is null) or (storage_format='chunked' and source_manifest is not null and content_sha256 is not null and byte_size>0));
create unique index if not exists company_document_company_identity on public.company_documents(company_id,id);
create table public.company_document_chunks(
 company_id uuid not null,document_id uuid not null,chunk_index integer not null check(chunk_index between 0 and 33),
 storage_path text not null,byte_size integer not null check(byte_size between 1 and 3145728),content_sha256 text not null check(content_sha256~'^[a-f0-9]{64}$'),
 primary key(document_id,chunk_index),foreign key(company_id,document_id) references public.company_documents(company_id,id) on delete restrict,
 unique(document_id,storage_path)
);
create index document_chunk_storage_identity on public.company_document_chunks(storage_path);
alter table public.company_document_chunks enable row level security;
create policy document_chunks_owner_office on public.company_document_chunks for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.company_document_chunks from public,anon,authenticated;grant select on public.company_document_chunks to authenticated;
create function public.carez_immutable_document_chunks() returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'Retained source chunks are immutable.';end $$;
create trigger immutable_document_chunks before update or delete on public.company_document_chunks for each row execute function public.carez_immutable_document_chunks();
revoke all on function public.carez_immutable_document_chunks() from public,anon,authenticated;

create function public.carez_register_document_chunks(p_company_id uuid,p_document_id uuid,p_manifest jsonb) returns void language plpgsql security invoker set search_path=pg_catalog,public,storage as $$
declare v_doc public.company_documents%rowtype;v_part jsonb;v_index integer:=0;v_size integer;v_root text;v_count integer;v_prefix text;
begin
 select * into v_doc from public.company_documents where company_id=p_company_id and id=p_document_id;
 if not found or v_doc.storage_format<>'chunked' or v_doc.source_manifest is distinct from p_manifest then raise exception 'Chunked document identity unavailable.';end if;
 v_prefix:=p_company_id::text||case when v_doc.visibility='office_private' then '/office-private/' else '/sources/' end;
 v_root:=left(v_doc.storage_path,length(v_doc.storage_path)-14);
 if right(v_doc.storage_path,14)<>'/manifest.json' or left(v_root,length(v_prefix))<>v_prefix or substr(v_root,length(v_prefix)+1)!~'^[a-fA-F0-9-]{16,80}$' then raise exception 'Chunk root is outside its tenant and privacy scope.';end if;
 if p_manifest->>'kind' is distinct from 'pourtrace-chunked-source' or p_manifest->>'version' is distinct from '1' or (p_manifest->>'size')::bigint is distinct from v_doc.byte_size or p_manifest->>'sha256' is distinct from v_doc.content_sha256 or p_manifest->>'mimeType' is distinct from v_doc.mime_type or jsonb_typeof(p_manifest->'chunks') is distinct from 'array' or length(p_manifest::text)>65536 then raise exception 'Chunk manifest does not match the original document identity.';end if;
 v_count:=ceil(v_doc.byte_size::numeric/3145728)::integer;
 if v_count not between 1 and 34 or jsonb_array_length(p_manifest->'chunks')<>v_count then raise exception 'Source chunks are incomplete.';end if;
 for v_part in select value from jsonb_array_elements(p_manifest->'chunks') loop
  v_size:=least(3145728,v_doc.byte_size-v_index::bigint*3145728)::integer;
  if (v_part->>'index')::integer is distinct from v_index or (v_part->>'size')::integer is distinct from v_size or v_part->>'path' is distinct from v_root||'/part-'||lpad(v_index::text,5,'0') or coalesce(v_part->>'sha256','')!~'^[a-f0-9]{64}$' then raise exception 'Source chunk order, length, path or fingerprint is invalid.';end if;
  if not exists(select 1 from storage.objects where bucket_id='carez-documents' and name=v_part->>'path') then raise exception 'A source chunk object is unavailable.';end if;
  perform 1 from public.source_upload_seals where company_id=p_company_id and storage_path=v_part->>'path' for update;
  if not found then raise exception 'Source chunks must be sealed before verification.';end if;
  if exists(select 1 from public.company_document_chunks where document_id=p_document_id and chunk_index=v_index and (storage_path,byte_size,content_sha256) is distinct from (v_part->>'path',v_size,v_part->>'sha256')) then raise exception 'Recorded source chunks cannot be replaced.';end if;
  insert into public.company_document_chunks(company_id,document_id,chunk_index,storage_path,byte_size,content_sha256) values(p_company_id,p_document_id,v_index,v_part->>'path',v_size,v_part->>'sha256') on conflict(document_id,chunk_index) do nothing;
  v_index:=v_index+1;
 end loop;
end $$;
revoke all on function public.carez_register_document_chunks(uuid,uuid,jsonb) from public,anon,authenticated;

create policy source_chunk_bytes_preserve on storage.objects as restrictive for delete to authenticated using(bucket_id<>'carez-documents' or not exists(select 1 from public.company_document_chunks c where c.storage_path=name));
create policy source_chunk_bytes_immutable on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'carez-documents' or not exists(select 1 from public.company_document_chunks c where c.storage_path=name))
 with check(bucket_id<>'carez-documents' or not exists(select 1 from public.company_document_chunks c where c.storage_path=name));

-- Only a confirmed, unreferenced duplicate may be made removable. Failed or
-- uncertain registrations retain their sealed bytes for safe retries.
create function public.carez_release_unused_source_upload(p_actor_id uuid,p_paths text[]) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid;v_role text;v_path text;
begin
 select company_id,role into v_company,v_role from public.profiles where id=p_actor_id;
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 if cardinality(p_paths) not between 1 and 35 then raise exception 'Source upload paths unavailable.';end if;
 for v_path in select distinct unnest(p_paths) order by 1 loop
  if v_path is null or v_path like '%..%' or (v_path not like v_company::text||'/sources/%' and v_path not like v_company::text||'/office-private/%') then raise exception 'Source path is outside its privacy scope.';end if;
  perform 1 from storage.objects where bucket_id='carez-documents' and name=v_path for update;
  perform 1 from public.source_upload_seals where company_id=v_company and storage_path=v_path and sealed_by=p_actor_id for update;
  if not found then raise exception 'Only this actor''s unused sealed upload can be released.';end if;
  if exists(select 1 from public.company_documents where storage_path=v_path) or exists(select 1 from public.company_document_chunks where storage_path=v_path) then raise exception 'Retained source bytes cannot be released.';end if;
  delete from public.source_upload_seals where company_id=v_company and storage_path=v_path;
 end loop;
end $$;
revoke all on function public.carez_release_unused_source_upload(uuid,text[]) from public,anon,authenticated;grant execute on function public.carez_release_unused_source_upload(uuid,text[]) to service_role;
