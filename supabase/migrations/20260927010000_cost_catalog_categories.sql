-- Company-owned catalog categories. Existing catalog items remain uncategorized.
create table public.cost_catalog_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);

create unique index cost_catalog_categories_company_name_uk
  on public.cost_catalog_categories (company_id, lower(name));

alter table public.cost_catalog_categories enable row level security;
create policy "company catalog categories" on public.cost_catalog_categories
  for all to authenticated
  using (company_id = public.get_my_company_id())
  with check (company_id = public.get_my_company_id());
grant select, insert, update on public.cost_catalog_categories to authenticated;

alter table public.cost_catalog_items
  add column category_id uuid;
alter table public.cost_catalog_items
  add constraint cost_catalog_items_company_category_fk
  foreign key (company_id, category_id)
  references public.cost_catalog_categories(company_id, id)
  on delete set null (category_id);

create index cost_catalog_items_company_category_name_idx
  on public.cost_catalog_items (company_id, category_id, name);
