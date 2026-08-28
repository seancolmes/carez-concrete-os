-- Private document bucket. Files are stored under <company_id>/...
insert into storage.buckets(id,name,public)
values ('carez-documents','carez-documents',false)
on conflict (id) do nothing;

drop policy if exists "carez document read" on storage.objects;
create policy "carez document read" on storage.objects for select to authenticated
using (bucket_id='carez-documents' and split_part(name,'/',1)=public.get_my_company_id()::text);

drop policy if exists "carez document insert" on storage.objects;
create policy "carez document insert" on storage.objects for insert to authenticated
with check (bucket_id='carez-documents' and split_part(name,'/',1)=public.get_my_company_id()::text and public.get_my_role()<>'employee');

drop policy if exists "carez document update" on storage.objects;
create policy "carez document update" on storage.objects for update to authenticated
using (bucket_id='carez-documents' and split_part(name,'/',1)=public.get_my_company_id()::text and public.get_my_role()<>'employee')
with check (bucket_id='carez-documents' and split_part(name,'/',1)=public.get_my_company_id()::text and public.get_my_role()<>'employee');

drop policy if exists "carez document delete" on storage.objects;
create policy "carez document delete" on storage.objects for delete to authenticated
using (bucket_id='carez-documents' and split_part(name,'/',1)=public.get_my_company_id()::text and public.get_my_role()<>'employee');
