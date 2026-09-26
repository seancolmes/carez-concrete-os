create table public.pour_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  budget_section_id uuid,
  change_order_id uuid,
  name text not null check (length(btrim(name))>0),
  scheduled_date date,
  expected_concrete_yards numeric(14,2) not null default 0 check (expected_concrete_yards>=0),
  contingency_percent numeric(6,2) not null default 10 check (contingency_percent between 0 and 100),
  minimum_cash_buffer numeric(14,2) not null default 0 check (minimum_cash_buffer>=0),
  company_cash_support numeric(14,2) not null default 0 check (company_cash_support>=0),
  status text not null default 'planning' check (status in ('planning','authorized','hold','completed','cancelled')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,budget_section_id) references public.project_budget_sections(company_id,id) on delete set null,
  foreign key(company_id,change_order_id) references public.change_orders(company_id,id) on delete set null
);

create table public.pour_cost_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pour_plan_id uuid not null,
  item_type text not null check (item_type in ('concrete','pump','material','equipment','subcontractor','labor','other')),
  cost_code_id uuid,
  catalog_item_id uuid,
  crew_member_id uuid,
  description text not null check (length(btrim(description))>0),
  quantity numeric(14,4) not null default 0 check (quantity>=0),
  unit text not null default 'LS',
  unit_cost numeric(14,4) not null default 0 check (unit_cost>=0),
  expected_cost numeric(14,2) not null default 0 check (expected_cost>=0),
  regular_hours numeric(12,4) not null default 0 check (regular_hours>=0),
  overtime_hours numeric(12,4) not null default 0 check (overtime_hours>=0),
  risk_class_code text,
  base_hourly_rate_snapshot numeric(12,4),
  labor_cost_method text,
  committed boolean not null default false,
  vendor_name text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,pour_plan_id) references public.pour_plans(company_id,id) on delete cascade,
  foreign key(company_id,cost_code_id) references public.cost_codes(company_id,id) on delete set null,
  foreign key(company_id,catalog_item_id) references public.cost_catalog_items(company_id,id) on delete set null,
  foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) on delete set null
);

create table public.pour_authorization_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pour_plan_id uuid not null,
  project_funding_balance numeric(14,2) not null default 0,
  gross_customer_cash numeric(14,2) not null default 0,
  sales_tax_cash_reserved numeric(14,2) not null default 0,
  processing_fees_paid numeric(14,2) not null default 0,
  incurred_direct_cost numeric(14,2) not null default 0,
  planned_exposure numeric(14,2) not null default 0,
  contingency_amount numeric(14,2) not null default 0,
  minimum_cash_buffer numeric(14,2) not null default 0,
  company_cash_support numeric(14,2) not null default 0,
  funding_gap numeric(14,2) not null default 0,
  system_recommendation text not null check (system_recommendation in ('clear','hold')),
  decision text not null check (decision in ('authorized','hold')),
  override_used boolean not null default false,
  override_reason text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,pour_plan_id) references public.pour_plans(company_id,id) on delete cascade
);

create index pour_plans_project_status_idx on public.pour_plans(company_id,project_id,status,scheduled_date);
create index pour_cost_items_plan_idx on public.pour_cost_items(company_id,pour_plan_id,sort_order);
create index pour_authorization_plan_idx on public.pour_authorization_snapshots(company_id,pour_plan_id,reviewed_at desc);

create or replace view public.pour_plan_financial_summary with (security_invoker=true) as
with costs as (
  select i.company_id,i.pour_plan_id,
    coalesce(sum(i.expected_cost),0)::numeric planned_exposure,
    coalesce(sum(i.expected_cost) filter(where i.item_type='concrete'),0)::numeric concrete_cost,
    coalesce(sum(i.expected_cost) filter(where i.item_type='labor'),0)::numeric labor_cost,
    coalesce(sum(i.expected_cost) filter(where i.item_type='pump'),0)::numeric pump_cost,
    coalesce(sum(i.expected_cost) filter(where i.item_type in ('material','equipment')),0)::numeric material_equipment_cost,
    coalesce(sum(i.expected_cost) filter(where i.item_type='subcontractor'),0)::numeric subcontractor_cost,
    coalesce(sum(i.expected_cost) filter(where i.item_type='other'),0)::numeric other_cost
  from public.pour_cost_items i group by i.company_id,i.pour_plan_id
), project_cash as (
  select f.company_id,f.project_id,coalesce(f.cash_collected,0)::numeric gross_customer_cash,
    coalesce(f.cash_collected,0)::numeric project_funding_balance,
    coalesce(f.actual_company_cost,0)::numeric incurred_direct_cost
  from public.project_financial_summary f
)
select p.company_id,p.id pour_plan_id,p.project_id,pr.job_number,pr.name project_name,p.name,p.scheduled_date,
  p.expected_concrete_yards,p.contingency_percent,p.minimum_cash_buffer,p.company_cash_support,p.status,p.notes,
  coalesce(c.planned_exposure,0)::numeric planned_exposure,
  (coalesce(c.planned_exposure,0)*p.contingency_percent/100)::numeric contingency_amount,
  (coalesce(c.planned_exposure,0)*(1+p.contingency_percent/100))::numeric total_exposure_with_contingency,
  coalesce(c.concrete_cost,0)::numeric concrete_cost,coalesce(c.labor_cost,0)::numeric labor_cost,
  coalesce(c.pump_cost,0)::numeric pump_cost,coalesce(c.material_equipment_cost,0)::numeric material_equipment_cost,
  coalesce(c.subcontractor_cost,0)::numeric subcontractor_cost,coalesce(c.other_cost,0)::numeric other_cost,
  coalesce(pc.project_funding_balance,0)::numeric project_funding_balance,
  coalesce(pc.gross_customer_cash,0)::numeric gross_customer_cash,0::numeric sales_tax_cash_reserved,0::numeric processing_fees_paid,
  coalesce(pc.incurred_direct_cost,0)::numeric incurred_direct_cost,
  greatest((coalesce(c.planned_exposure,0)*(1+p.contingency_percent/100))+p.minimum_cash_buffer-coalesce(pc.project_funding_balance,0)-p.company_cash_support,0)::numeric required_additional_cash,
  case when coalesce(c.planned_exposure,0)>0 and greatest((coalesce(c.planned_exposure,0)*(1+p.contingency_percent/100))+p.minimum_cash_buffer-coalesce(pc.project_funding_balance,0)-p.company_cash_support,0)=0 then 'clear' else 'hold' end system_recommendation
from public.pour_plans p join public.projects pr on pr.company_id=p.company_id and pr.id=p.project_id
left join costs c on c.company_id=p.company_id and c.pour_plan_id=p.id
left join project_cash pc on pc.company_id=p.company_id and pc.project_id=p.project_id;

create or replace view public.pour_work_package_delivery_sync with (security_invoker=true) as
select p.company_id,p.id pour_plan_id,p.project_id,pr.job_number,p.name pour_name,p.scheduled_date,p.status pour_status,
  p.expected_concrete_yards planned_cy,0::numeric ordered_cy,0::numeric delivered_cy,p.expected_concrete_yards remaining_to_plan_cy,
  (-p.expected_concrete_yards)::numeric variance_to_plan_cy,0::numeric percent_of_plan_delivered,
  0::integer concrete_ticket_count,0::integer ticket_photo_count,0::integer tickets_missing_photo,
  null::date first_delivery_date,null::date latest_delivery_date,
  o.id operation_id,o.status operation_status,o.planned_quantity operation_planned_quantity,o.actual_quantity,
  o.quantity_review_status,o.quantity_review_reason,w.name package_name,w.location package_location,o.field_label,t.name task_name,
  case when o.id is null then 'unlinked' else 'waiting_delivery' end sync_status
from public.pour_plans p join public.projects pr on pr.company_id=p.company_id and pr.id=p.project_id
left join public.work_package_operations o on o.company_id=p.company_id and o.pour_plan_id=p.id and o.status<>'cancelled'
left join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id
left join public.production_tasks t on t.company_id=o.company_id and t.id=o.production_task_id;

alter table public.pour_plans enable row level security;
alter table public.pour_cost_items enable row level security;
alter table public.pour_authorization_snapshots enable row level security;
create policy pour_plan_owner_office on public.pour_plans for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy pour_cost_owner_office on public.pour_cost_items for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy pour_authorization_owner_office on public.pour_authorization_snapshots for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.pour_plans,public.pour_cost_items,public.pour_authorization_snapshots from public,anon;
grant select,insert,update,delete on public.pour_plans,public.pour_cost_items,public.pour_authorization_snapshots to authenticated;
revoke all on public.pour_plan_financial_summary,public.pour_work_package_delivery_sync from public,anon;
grant select on public.pour_plan_financial_summary,public.pour_work_package_delivery_sync to authenticated;
create trigger pour_plans_updated_at before update on public.pour_plans for each row execute function public.set_updated_at();

comment on table public.pour_plans is 'Scheduled concrete pour authority with explicit cash authorization state.';
comment on view public.pour_work_package_delivery_sync is 'Pour-to-production sync read model; delivery ticket provider evidence remains unconnected until procurement receipt authority is recovered.';
