-- Carez OS remaining module schema
-- Applied only during final integration release.

create extension if not exists pgcrypto;

-- CRM activity / follow-up history
create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null default 'note',
  activity_date timestamptz not null default now(),
  note text,
  next_follow_up date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities(lead_id, activity_date desc);
alter table public.lead_activities enable row level security;
drop policy if exists "company access lead activities" on public.lead_activities;
create policy "company access lead activities" on public.lead_activities for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

-- Project / receipt / company document metadata. Actual bytes live in Supabase Storage.
create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid references public.projects(id) on delete set null,
  document_type text not null default 'other',
  title text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  document_date date,
  amount numeric,
  storage_path text,
  mime_type text,
  source text not null default 'manual',
  bank_transaction_id uuid references public.plaid_transactions(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  vendor_bill_id uuid references public.vendor_bills(id) on delete set null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists company_documents_project_idx on public.company_documents(project_id, created_at desc);
alter table public.company_documents enable row level security;
drop policy if exists "company access documents" on public.company_documents;
create policy "company access documents" on public.company_documents for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

-- Equipment / owned assets
create table if not exists public.equipment_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  asset_number text,
  name text not null,
  category text not null default 'tool',
  make text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric,
  status text not null default 'available',
  assigned_project_id uuid references public.projects(id) on delete set null,
  assigned_crew_member_id uuid references public.crew_members(id) on delete set null,
  service_interval_hours numeric,
  current_meter_hours numeric not null default 0,
  next_service_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists equipment_assets_company_idx on public.equipment_assets(company_id, active, category);
alter table public.equipment_assets enable row level security;
drop policy if exists "company access equipment" on public.equipment_assets;
create policy "company access equipment" on public.equipment_assets for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

create table if not exists public.equipment_service_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  service_date date not null default current_date,
  meter_hours numeric,
  description text not null,
  cost numeric not null default 0,
  vendor text,
  next_service_date date,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.equipment_service_logs enable row level security;
drop policy if exists "company access equipment service" on public.equipment_service_logs;
create policy "company access equipment service" on public.equipment_service_logs for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

-- Consumable / form inventory
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  category text not null default 'formwork',
  unit text not null default 'EA',
  quantity_on_hand numeric not null default 0,
  reorder_point numeric not null default 0,
  target_quantity numeric,
  average_unit_cost numeric not null default 0,
  storage_location text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory_items enable row level security;
drop policy if exists "company access inventory" on public.inventory_items;
create policy "company access inventory" on public.inventory_items for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  transaction_type text not null,
  quantity numeric not null,
  unit_cost numeric,
  transaction_date date not null default current_date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.inventory_transactions enable row level security;
drop policy if exists "company access inventory transactions" on public.inventory_transactions;
create policy "company access inventory transactions" on public.inventory_transactions for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

-- Project closeout
create table if not exists public.project_closeouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  status text not null default 'open',
  punch_complete boolean not null default false,
  timecards_complete boolean not null default false,
  purchase_orders_closed boolean not null default false,
  vendor_bills_complete boolean not null default false,
  change_orders_complete boolean not null default false,
  customer_billed_complete boolean not null default false,
  customer_paid_complete boolean not null default false,
  documents_complete boolean not null default false,
  warranty_sent boolean not null default false,
  closeout_notes text,
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_closeouts enable row level security;
drop policy if exists "company access closeouts" on public.project_closeouts;
create policy "company access closeouts" on public.project_closeouts for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

-- Public proposal acceptance tokens. Token values are random and treated as secrets.
create table if not exists public.proposal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.proposal_access_tokens enable row level security;
drop policy if exists "company access proposal tokens" on public.proposal_access_tokens;
create policy "company access proposal tokens" on public.proposal_access_tokens for all to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id());

create table if not exists public.proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  accepted_name text not null,
  accepted_email text,
  accepted_at timestamptz not null default now(),
  acceptance_ip text,
  acceptance_note text
);
alter table public.proposal_acceptances enable row level security;
drop policy if exists "company access proposal acceptances" on public.proposal_acceptances;
create policy "company access proposal acceptances" on public.proposal_acceptances for select to authenticated using (company_id = public.get_my_company_id());
