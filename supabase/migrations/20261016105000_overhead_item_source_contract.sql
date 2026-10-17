-- Recovered from the existing production catalog. No company-specific seed data.
create table if not exists public.overhead_items(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 category text not null,name text not null,frequency text not null default 'monthly' check(frequency in ('weekly','monthly','quarterly','annual')),
 amount numeric(12,2) not null default 0,business_use_percent numeric(6,2) not null default 100 check(business_use_percent between 0 and 100),
 item_type text not null default 'fixed',notes text,active boolean not null default true,sort_order integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,name)
);
alter table public.overhead_items enable row level security;
drop policy if exists "company access overhead items" on public.overhead_items;
create policy overhead_items_owner_office on public.overhead_items for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.overhead_items from public,anon,authenticated;
grant select,insert,update on public.overhead_items to authenticated;
