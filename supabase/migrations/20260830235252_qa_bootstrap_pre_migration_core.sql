create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'owner' check (role in ('owner','office','employee')),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  billing_terms text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,name)
);

create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  role text not null,
  hourly_rate numeric(10,2),
  day_rate numeric(10,2),
  employment_type text not null default 'employee' check (employment_type in ('employee','on_call','subcontractor')),
  rating text check (rating in ('A','B','C')),
  available boolean not null default true,
  phone text,
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(company_id,name)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  project_name text not null,
  address text,
  city text,
  state text not null default 'WA',
  scope text not null default '',
  estimated_value numeric(12,2),
  bid_due date,
  follow_up date,
  status text not null default 'new' check (status in ('new','reviewing','estimating','proposal_sent','follow_up','won','lost')),
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_number text not null,
  name text not null,
  address text,
  city text,
  state text not null default 'WA',
  status text not null default 'active' check (status in ('active','scheduled','on_hold','complete','completed')),
  contract_value numeric(12,2) not null default 0,
  approved_changes numeric(12,2) not null default 0,
  backcharges numeric(12,2) not null default 0,
  billed numeric(12,2) not null default 0,
  collected numeric(12,2) not null default 0,
  actual_cost numeric(12,2) not null default 0,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,job_number)
);

create or replace function public.get_my_company_id()
returns uuid language sql stable security definer set search_path=public as $$
  select company_id from public.profiles where id=auth.uid() and role<>'employee';
$$;

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid();
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

create or replace function public.seed_carez_starter_data()
returns void language plpgsql set search_path=public as $$
declare cid uuid; coombes_id uuid; private_id uuid;
begin
  cid:=public.get_my_company_id();
  if cid is null then raise exception 'No company found for current user'; end if;
  insert into public.customers(company_id,name) values(cid,'Coombes Development') on conflict(company_id,name) do nothing;
  insert into public.customers(company_id,name) values(cid,'Private Customer') on conflict(company_id,name) do nothing;
  select id into coombes_id from public.customers where company_id=cid and name='Coombes Development' limit 1;
  select id into private_id from public.customers where company_id=cid and name='Private Customer' limit 1;
  insert into public.projects(company_id,customer_id,job_number,name,address,city,state,status,contract_value,approved_changes,backcharges,billed,collected,actual_cost,next_action)
  values(cid,coombes_id,'D58','307 NW 52nd St','307 NW 52nd Street','Seattle','WA','active',6362.01,0,165.83,0,0,0,'Confirm remaining billable scope') on conflict(company_id,job_number) do nothing;
  insert into public.projects(company_id,customer_id,job_number,name,address,city,state,status,contract_value,approved_changes,backcharges,billed,collected,actual_cost,next_action)
  values(cid,private_id,'LAB-01','Weekly Labor Project',null,null,'WA','active',0,0,0,0,0,0,'Record weekly labor billing') on conflict(company_id,job_number) do nothing;
  insert into public.crew_members(company_id,name,role,employment_type,available) values(cid,'Nik','Owner / Foreman','employee',true) on conflict(company_id,name) do nothing;
  insert into public.crew_members(company_id,name,role,hourly_rate,employment_type,available) values(cid,'Richard Montes','Concrete Laborer',30,'employee',true) on conflict(company_id,name) do nothing;
end;
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.crew_members enable row level security;
alter table public.leads enable row level security;
alter table public.projects enable row level security;

create policy "company members can view company" on public.companies for select to authenticated using (id=public.get_my_company_id());
create policy "company members can update company" on public.companies for update to authenticated using (id=public.get_my_company_id()) with check (id=public.get_my_company_id());
create policy "company members can view profiles" on public.profiles for select to authenticated using (company_id=public.get_my_company_id());
create policy "employee can view own profile" on public.profiles for select to authenticated using (id=auth.uid());
create policy "users can update own profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and company_id=public.get_my_company_id());
create policy "company access customers" on public.customers for all to authenticated using (company_id=public.get_my_company_id()) with check (company_id=public.get_my_company_id());
create policy "company access crew" on public.crew_members for all to authenticated using (company_id=public.get_my_company_id()) with check (company_id=public.get_my_company_id());
create policy "company access leads" on public.leads for all to authenticated using (company_id=public.get_my_company_id()) with check (company_id=public.get_my_company_id());
create policy "company access projects" on public.projects for all to authenticated using (company_id=public.get_my_company_id()) with check (company_id=public.get_my_company_id());

create trigger set_leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

grant select,insert,update,delete on public.companies,public.profiles,public.customers,public.crew_members,public.leads,public.projects to authenticated;
grant execute on function public.get_my_company_id() to authenticated,service_role;
grant execute on function public.get_my_role() to authenticated,service_role;
revoke all on function public.seed_carez_starter_data() from public,anon,authenticated;
grant execute on function public.seed_carez_starter_data() to service_role;;
