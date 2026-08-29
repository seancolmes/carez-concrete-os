-- Estimating labor pricing sits apart from productivity.
-- Productivity decides MH/unit; this profile decides current Carez dollars/MH.

create table if not exists public.estimating_labor_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  burdened_hourly_rate numeric not null,
  base_risk_class_code text,
  source_type text not null default 'manual',
  source_label text,
  source_hours numeric,
  source_total_payroll_cost numeric,
  effective_date date not null default current_date,
  is_default boolean not null default false,
  active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimating_labor_profiles_rate_chk check (burdened_hourly_rate >= 0),
  constraint estimating_labor_profiles_source_chk check (source_type in ('historical_payroll','payroll_live','manual','blended','national_reference'))
);

create unique index if not exists estimating_labor_profiles_default_uk
on public.estimating_labor_profiles(company_id)
where is_default and active;

create index if not exists estimating_labor_profiles_company_idx
on public.estimating_labor_profiles(company_id, active, effective_date desc);

alter table public.estimating_labor_profiles enable row level security;
drop policy if exists "office access estimating_labor_profiles" on public.estimating_labor_profiles;
create policy "office access estimating_labor_profiles"
on public.estimating_labor_profiles for all
using (company_id = get_my_company_id() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role <> 'employee'))
with check (company_id = get_my_company_id() and exists (select 1 from public.profiles p where p.id=auth.uid() and p.role <> 'employee'));

create trigger carez_estimating_labor_profiles_touch
before update on public.estimating_labor_profiles
for each row execute function public.carez_takeoff_touch_updated_at();

alter table public.takeoff_measurements
  add column if not exists risk_class_code text;

-- Historical Carez starting profile derived from the provided Jan-May 2026 payroll detail:
-- 2,080.35 hours and $97,972.33 total payroll cost = $47.0942/MH.
-- It is attached only to a company that currently has an owner profile, and remains visibly dated/source-labeled.
insert into public.estimating_labor_profiles(
  company_id,name,burdened_hourly_rate,base_risk_class_code,source_type,source_label,
  source_hours,source_total_payroll_cost,effective_date,is_default,active,notes
)
select distinct
  p.company_id,
  'Carez Historical Payroll — 2026 YTD',
  47.0942,
  '0217-01',
  'historical_payroll',
  'Carez Payroll Details report through 2026-05-05',
  2080.35,
  97972.33,
  date '2026-05-05',
  true,
  true,
  'Historical fully burdened average. For a different L&I class, Carez adjusts only the employer L&I rate differential. Refresh as current payroll data becomes available.'
from public.profiles p
where p.role='owner'
  and not exists (
    select 1 from public.estimating_labor_profiles x
    where x.company_id=p.company_id and x.is_default and x.active
  );
