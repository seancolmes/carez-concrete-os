-- Tenant-owned company branding. Public logo bytes are non-sensitive and are
-- stored under <company_id>/logos/... while metadata remains RLS protected.

create table if not exists public.company_branding (
  company_id uuid primary key references public.companies(id) on delete cascade,
  logo_path text,
  logo_original_name text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_branding_logo_path_company check (
    logo_path is null or split_part(logo_path,'/',1)=company_id::text
  )
);

alter table public.company_branding enable row level security;

drop policy if exists "company branding read" on public.company_branding;
create policy "company branding read" on public.company_branding for select to authenticated
using (company_id=public.get_my_company_id());

drop policy if exists "company branding insert" on public.company_branding;
create policy "company branding insert" on public.company_branding for insert to authenticated
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

drop policy if exists "company branding update" on public.company_branding;
create policy "company branding update" on public.company_branding for update to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

drop policy if exists "company branding delete" on public.company_branding;
create policy "company branding delete" on public.company_branding for delete to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'carez-branding',
  'carez-branding',
  true,
  5242880,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "carez branding insert" on storage.objects;
create policy "carez branding insert" on storage.objects for insert to authenticated
with check (
  bucket_id='carez-branding'
  and split_part(name,'/',1)=public.get_my_company_id()::text
  and split_part(name,'/',2)='logos'
  and public.get_my_role()<>'employee'
);

drop policy if exists "carez branding update" on storage.objects;
create policy "carez branding update" on storage.objects for update to authenticated
using (
  bucket_id='carez-branding'
  and split_part(name,'/',1)=public.get_my_company_id()::text
  and split_part(name,'/',2)='logos'
  and public.get_my_role()<>'employee'
)
with check (
  bucket_id='carez-branding'
  and split_part(name,'/',1)=public.get_my_company_id()::text
  and split_part(name,'/',2)='logos'
  and public.get_my_role()<>'employee'
);

drop policy if exists "carez branding delete" on storage.objects;
create policy "carez branding delete" on storage.objects for delete to authenticated
using (
  bucket_id='carez-branding'
  and split_part(name,'/',1)=public.get_my_company_id()::text
  and split_part(name,'/',2)='logos'
  and public.get_my_role()<>'employee'
);

-- Purchase orders already snapshot issuer identity. Add a logo-path snapshot when
-- that module exists so later branding changes do not rewrite issued PO identity.
create or replace function public.snapshot_purchase_order_branding()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='issued'
     and old.status is distinct from new.status
     and new.from_logo_storage_path_snapshot is null then
    select cb.logo_path into new.from_logo_storage_path_snapshot
    from public.company_branding cb
    where cb.company_id=new.company_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.purchase_orders') is not null then
    execute 'alter table public.purchase_orders add column if not exists from_logo_storage_path_snapshot text';
    execute 'drop trigger if exists purchase_orders_snapshot_branding on public.purchase_orders';
    execute 'create trigger purchase_orders_snapshot_branding before update of status on public.purchase_orders for each row execute function public.snapshot_purchase_order_branding()';
  end if;
end;
$$;
