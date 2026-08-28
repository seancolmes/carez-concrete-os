-- Job Startup / Ready-to-Work engine.
-- Carez automatically checks system data and leaves only field-only confirmations for the owner.

create table if not exists public.project_startup_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_key text not null,
  title text not null,
  detail text,
  category text not null default 'field',
  status text not null default 'open' check(status in ('open','done','not_needed')),
  notes text,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,item_key)
);

create index if not exists project_startup_items_company_project_idx
  on public.project_startup_items(company_id,project_id,sort_order);

alter table public.project_startup_items enable row level security;
drop policy if exists "owner access project startup items" on public.project_startup_items;
create policy "owner access project startup items" on public.project_startup_items
for all to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

create or replace function public.seed_project_startup_items(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company uuid;
begin
  select company_id into v_company from public.projects where id=p_project_id;
  if v_company is null then return; end if;

  insert into public.project_startup_items(company_id,project_id,item_key,title,detail,category,sort_order)
  values
    (v_company,p_project_id,'scope_review','Review awarded scope & exclusions','Make sure the crew plan matches exactly what Carez sold and what is excluded.','contract',10),
    (v_company,p_project_id,'site_access','Confirm access, staging & washout','Know where trucks, pump, materials, forms and concrete washout can safely go.','field',20),
    (v_company,p_project_id,'inspection_plan','Confirm permits / inspections','Know which inspections are required and what must be ready before each one.','field',30),
    (v_company,p_project_id,'procurement_plan','Confirm materials, pump & equipment plan','Confirm how concrete, rebar, lumber/forms, pump and equipment will be handled for startup.','purchasing',40),
    (v_company,p_project_id,'customer_start','Confirm start plan with customer / GC','Make sure the customer or GC knows the planned start and any access or coordination requirements.','customer',50)
  on conflict(project_id,item_key) do nothing;
end;
$$;
revoke all on function public.seed_project_startup_items(uuid) from public,anon,authenticated;

create or replace function public.carez_seed_project_startup()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.seed_project_startup_items(new.id);
  return new;
end;
$$;
revoke all on function public.carez_seed_project_startup() from public,anon,authenticated;

drop trigger if exists carez_seed_project_startup on public.projects;
create trigger carez_seed_project_startup
after insert on public.projects
for each row execute function public.carez_seed_project_startup();

-- Backfill current open jobs without changing any existing project data.
do $$
declare r record;
begin
  for r in select id from public.projects where status in ('active','scheduled','on_hold') loop
    perform public.seed_project_startup_items(r.id);
  end loop;
end $$;

create or replace view public.project_startup_readiness
with (security_invoker=true)
as
select
  p.id as project_id,
  p.company_id,
  p.job_number,
  p.name,
  p.address,
  p.city,
  p.state,
  p.status as project_status,
  c.name as customer_name,
  c.contact_name,
  c.phone as customer_phone,
  c.email as customer_email,
  exists(
    select 1 from public.project_budgets b
    where b.project_id=p.id and b.status='active' and b.budget_type='original'
  ) as has_awarded_budget,
  (p.address is not null and btrim(p.address)<>'' and p.city is not null and btrim(p.city)<>'') as has_jobsite,
  (c.id is not null and (nullif(btrim(coalesce(c.phone,'')),'') is not null or nullif(btrim(coalesce(c.email,'')),'') is not null)) as has_customer_contact,
  exists(
    select 1 from public.work_schedule_items w
    where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date
  ) as has_work_scheduled,
  (
    select min(w.schedule_date) from public.work_schedule_items w
    where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date
  ) as next_work_date,
  (
    select count(distinct a.crew_member_id)::integer
    from public.work_schedule_items w
    join public.work_schedule_assignments a on a.schedule_item_id=w.id
    where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date
  ) as crew_assigned_count,
  (
    select pp.name from public.pour_plans pp
    where pp.project_id=p.id and pp.status<>'cancelled' and (pp.scheduled_date>=current_date or pp.scheduled_date is null)
    order by pp.scheduled_date nulls last,pp.created_at limit 1
  ) as next_pour_name,
  (
    select pp.scheduled_date from public.pour_plans pp
    where pp.project_id=p.id and pp.status<>'cancelled' and (pp.scheduled_date>=current_date or pp.scheduled_date is null)
    order by pp.scheduled_date nulls last,pp.created_at limit 1
  ) as next_pour_date,
  (
    select pp.status from public.pour_plans pp
    where pp.project_id=p.id and pp.status<>'cancelled' and (pp.scheduled_date>=current_date or pp.scheduled_date is null)
    order by pp.scheduled_date nulls last,pp.created_at limit 1
  ) as next_pour_status,
  (
    select count(*)::integer from public.purchase_orders po
    where po.project_id=p.id and po.status='issued'
  ) as open_po_count,
  coalesce(m.manual_total,0)::integer as manual_total,
  coalesce(m.manual_open,0)::integer as manual_open,
  coalesce(m.manual_done,0)::integer as manual_done,
  (
    (case when exists(select 1 from public.project_budgets b where b.project_id=p.id and b.status='active' and b.budget_type='original') then 1 else 0 end) +
    (case when p.address is not null and btrim(p.address)<>'' and p.city is not null and btrim(p.city)<>'' then 1 else 0 end) +
    (case when c.id is not null and (nullif(btrim(coalesce(c.phone,'')),'') is not null or nullif(btrim(coalesce(c.email,'')),'') is not null) then 1 else 0 end) +
    (case when exists(select 1 from public.work_schedule_items w where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date) then 1 else 0 end) +
    (case when exists(select 1 from public.work_schedule_items w join public.work_schedule_assignments a on a.schedule_item_id=w.id where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date) then 1 else 0 end) +
    coalesce(m.manual_done,0)
  )::integer as ready_steps,
  (5+coalesce(m.manual_total,0))::integer as total_steps,
  case
    when exists(select 1 from public.project_budgets b where b.project_id=p.id and b.status='active' and b.budget_type='original')
     and p.address is not null and btrim(p.address)<>'' and p.city is not null and btrim(p.city)<>''
     and c.id is not null and (nullif(btrim(coalesce(c.phone,'')),'') is not null or nullif(btrim(coalesce(c.email,'')),'') is not null)
     and exists(select 1 from public.work_schedule_items w where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date)
     and exists(select 1 from public.work_schedule_items w join public.work_schedule_assignments a on a.schedule_item_id=w.id where w.project_id=p.id and w.status<>'cancelled' and w.schedule_date>=current_date)
     and coalesce(m.manual_open,0)=0
    then 'ready'
    else 'needs_setup'
  end as readiness_status
from public.projects p
left join public.customers c on c.id=p.customer_id
left join lateral (
  select
    count(*)::integer as manual_total,
    count(*) filter(where psi.status='open')::integer as manual_open,
    count(*) filter(where psi.status in ('done','not_needed'))::integer as manual_done
  from public.project_startup_items psi
  where psi.project_id=p.id
) m on true
where p.status in ('active','scheduled','on_hold');

grant select on public.project_startup_readiness to authenticated;
