-- Carez OS: resource readiness + constraint-driven look-ahead

alter table public.purchase_order_lines
  add column if not exists work_package_operation_id uuid references public.work_package_operations(id) on delete set null;
alter table public.vendor_bill_lines
  add column if not exists work_package_operation_id uuid references public.work_package_operations(id) on delete set null;
alter table public.project_costs
  add column if not exists work_package_operation_id uuid references public.work_package_operations(id) on delete set null;
alter table public.inventory_transactions
  add column if not exists work_package_operation_id uuid references public.work_package_operations(id) on delete set null;

create index if not exists purchase_order_lines_work_package_operation_idx on public.purchase_order_lines(work_package_operation_id);
create index if not exists vendor_bill_lines_work_package_operation_idx on public.vendor_bill_lines(work_package_operation_id);
create index if not exists project_costs_work_package_operation_idx on public.project_costs(work_package_operation_id);
create index if not exists inventory_transactions_work_package_operation_idx on public.inventory_transactions(work_package_operation_id);

create table if not exists public.work_package_resource_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_package_operation_id uuid not null references public.work_package_operations(id) on delete cascade,
  resource_type text not null check (resource_type in ('material','equipment','vendor')),
  label text not null,
  required_quantity numeric not null default 1 check (required_quantity > 0),
  unit text not null default 'EA',
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  equipment_asset_id uuid references public.equipment_assets(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  purchase_order_line_id uuid references public.purchase_order_lines(id) on delete set null,
  required_before_start boolean not null default true,
  need_offset_days integer not null default 0,
  need_by_override date,
  vendor_status text not null default 'needed' check (vendor_status in ('needed','requested','confirmed','completed','cancelled')),
  vendor_reference text,
  waived_at timestamptz,
  waived_by uuid references auth.users(id) on delete set null,
  waiver_reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (waived_at is null or nullif(trim(waiver_reason),'') is not null)
);

create index if not exists work_package_resource_requirements_operation_idx on public.work_package_resource_requirements(work_package_operation_id);
create index if not exists work_package_resource_requirements_inventory_idx on public.work_package_resource_requirements(inventory_item_id);
create index if not exists work_package_resource_requirements_equipment_idx on public.work_package_resource_requirements(equipment_asset_id);
create index if not exists work_package_resource_requirements_vendor_idx on public.work_package_resource_requirements(vendor_id);

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_requirement_id uuid not null unique references public.work_package_resource_requirements(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved','consumed','released','cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_reservations_item_idx on public.inventory_reservations(inventory_item_id,status);

create table if not exists public.equipment_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_requirement_id uuid not null unique references public.work_package_resource_requirements(id) on delete cascade,
  equipment_asset_id uuid not null references public.equipment_assets(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned','confirmed','completed','cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists equipment_reservations_asset_dates_idx on public.equipment_reservations(equipment_asset_id,start_date,end_date,status);

alter table public.work_package_resource_requirements enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.equipment_reservations enable row level security;

drop policy if exists "office access work package resource requirements" on public.work_package_resource_requirements;
create policy "office access work package resource requirements" on public.work_package_resource_requirements for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

drop policy if exists "office access inventory reservations" on public.inventory_reservations;
create policy "office access inventory reservations" on public.inventory_reservations for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

drop policy if exists "office access equipment reservations" on public.equipment_reservations;
create policy "office access equipment reservations" on public.equipment_reservations for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

create or replace view public.work_package_resource_requirement_status as
with schedule_date as (
  select w.work_package_operation_id operation_id,min(w.schedule_date) filter(where w.schedule_date >= (now() at time zone 'America/Los_Angeles')::date) next_schedule_date
  from public.work_schedule_items w
  where w.status<>'cancelled' and w.item_type='work' and w.work_package_operation_id is not null
  group by w.work_package_operation_id
),
material_reservation as (
  select ir.resource_requirement_id,ir.inventory_item_id,
    coalesce(sum(ir.quantity) filter(where ir.status in ('reserved','consumed')),0) requirement_reserved_qty
  from public.inventory_reservations ir group by ir.resource_requirement_id,ir.inventory_item_id
),
material_total_reserved as (
  select ir.inventory_item_id,coalesce(sum(ir.quantity) filter(where ir.status='reserved'),0) total_reserved_qty
  from public.inventory_reservations ir group by ir.inventory_item_id
),
po_actual as (
  select pol.id purchase_order_line_id,po.status po_status,po.expected_delivery_date,
    pol.quantity ordered_qty,
    coalesce(sum(r.quantity_received),0) received_qty,
    po.po_number
  from public.purchase_order_lines pol
  join public.purchase_orders po on po.id=pol.purchase_order_id and po.company_id=pol.company_id
  left join public.purchase_order_receipts r on r.purchase_order_line_id=pol.id and r.company_id=pol.company_id
  group by pol.id,po.status,po.expected_delivery_date,pol.quantity,po.po_number
),
equipment_state as (
  select er.resource_requirement_id,er.equipment_asset_id,er.start_date,er.end_date,er.status reservation_status,
    a.name equipment_name,a.active equipment_active,a.status equipment_status,a.next_service_date,
    (select count(*) from public.equipment_reservations x
      where x.equipment_asset_id=er.equipment_asset_id and x.id<>er.id and x.status in ('planned','confirmed')
        and daterange(x.start_date,x.end_date,'[]') && daterange(er.start_date,er.end_date,'[]'))::int conflict_count
  from public.equipment_reservations er
  join public.equipment_assets a on a.id=er.equipment_asset_id and a.company_id=er.company_id
),
base as (
  select rr.*,o.work_package_id,wp.project_id,wp.planned_start_date,
    coalesce(rr.need_by_override,sd.next_schedule_date + rr.need_offset_days,wp.planned_start_date + rr.need_offset_days) need_by_date,
    i.name inventory_name,i.quantity_on_hand,i.active inventory_active,
    mr.requirement_reserved_qty,mtr.total_reserved_qty,
    pa.po_status,pa.expected_delivery_date,pa.ordered_qty,pa.received_qty,pa.po_number,
    es.start_date equipment_start_date,es.end_date equipment_end_date,es.reservation_status,es.equipment_name,es.equipment_active,es.equipment_status,es.next_service_date,es.conflict_count,
    v.name vendor_name,v.active vendor_active
  from public.work_package_resource_requirements rr
  join public.work_package_operations o on o.id=rr.work_package_operation_id and o.company_id=rr.company_id
  join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
  left join schedule_date sd on sd.operation_id=rr.work_package_operation_id
  left join public.inventory_items i on i.id=rr.inventory_item_id and i.company_id=rr.company_id
  left join material_reservation mr on mr.resource_requirement_id=rr.id
  left join material_total_reserved mtr on mtr.inventory_item_id=rr.inventory_item_id
  left join po_actual pa on pa.purchase_order_line_id=rr.purchase_order_line_id
  left join equipment_state es on es.resource_requirement_id=rr.id
  left join public.vendors v on v.id=rr.vendor_id and v.company_id=rr.company_id
), calc as (
  select b.*,
    case when b.inventory_item_id is not null then
      least(coalesce(b.requirement_reserved_qty,0),greatest(coalesce(b.quantity_on_hand,0)-greatest(coalesce(b.total_reserved_qty,0)-coalesce(b.requirement_reserved_qty,0),0),0))
      else 0 end as safe_inventory_qty
  from base b
)
select c.*,
  greatest(c.required_quantity-(c.safe_inventory_qty+coalesce(c.received_qty,0)),0) shortage_quantity,
  case
    when c.waived_at is not null then 'waived'
    when c.resource_type='material' and c.safe_inventory_qty+coalesce(c.received_qty,0)>=c.required_quantity then 'ready'
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' then 'ordered'
    when c.resource_type='material' then 'missing'
    when c.resource_type='equipment' and coalesce(c.reservation_status,'')='confirmed' and coalesce(c.equipment_active,false)
      and coalesce(c.equipment_status,'available') not in ('service','out_of_service')
      and coalesce(c.conflict_count,0)=0
      and (c.next_service_date is null or c.need_by_date is null or c.next_service_date>c.need_by_date) then 'ready'
    when c.resource_type='equipment' and c.equipment_asset_id is null then 'missing'
    when c.resource_type='equipment' and coalesce(c.reservation_status,'')='planned' then 'needs_confirmation'
    when c.resource_type='equipment' then 'blocked'
    when c.resource_type='vendor' and c.vendor_status in ('confirmed','completed') and coalesce(c.vendor_active,true) then 'ready'
    when c.resource_type='vendor' and c.vendor_status='requested' then 'needs_confirmation'
    when c.resource_type='vendor' then 'missing'
    else 'missing'
  end resource_status,
  case
    when c.waived_at is not null then null
    when c.resource_type='material' and c.safe_inventory_qty+coalesce(c.received_qty,0)>=c.required_quantity then null
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' and c.expected_delivery_date is not null and c.need_by_date is not null and c.expected_delivery_date>c.need_by_date then c.label||' arrives after it is needed'
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' then c.label||' is ordered but not received'
    when c.resource_type='material' then c.label||' is not reserved or received'
    when c.resource_type='equipment' and c.equipment_asset_id is null then c.label||' has no equipment assigned'
    when c.resource_type='equipment' and not coalesce(c.equipment_active,false) then c.label||' equipment is inactive'
    when c.resource_type='equipment' and coalesce(c.equipment_status,'available') in ('service','out_of_service') then c.label||' equipment is unavailable'
    when c.resource_type='equipment' and coalesce(c.conflict_count,0)>0 then c.label||' equipment is reserved for conflicting work'
    when c.resource_type='equipment' and c.next_service_date is not null and c.need_by_date is not null and c.next_service_date<=c.need_by_date then c.label||' needs service before the work starts'
    when c.resource_type='equipment' and coalesce(c.reservation_status,'')<>'confirmed' then c.label||' equipment reservation is not confirmed'
    when c.resource_type='vendor' and c.vendor_id is null then c.label||' has no vendor selected'
    when c.resource_type='vendor' and not coalesce(c.vendor_active,true) then c.label||' vendor is inactive'
    when c.resource_type='vendor' and c.vendor_status not in ('confirmed','completed') then c.label||' vendor is not confirmed'
    else null
  end blocking_reason,
  case
    when c.waived_at is not null then null
    when c.resource_type='material' and c.purchase_order_line_id is not null and c.po_status='issued' and c.expected_delivery_date is not null and c.need_by_date is not null and c.expected_delivery_date=c.need_by_date then c.label||' is scheduled to arrive the day it is needed'
    when c.resource_type='material' and coalesce(c.total_reserved_qty,0)>coalesce(c.quantity_on_hand,0) then c.label||' inventory is over-reserved across work packages'
    when c.resource_type='equipment' and c.reservation_status='planned' then c.label||' equipment reservation still needs confirmation'
    when c.resource_type='vendor' and c.vendor_status='requested' then c.label||' vendor confirmation is still pending'
    else null
  end warning_reason
from calc c;

create or replace view public.work_package_resource_summary as
select r.company_id,r.work_package_operation_id,
  count(*)::int resource_count,
  count(*) filter(where r.required_before_start and r.waived_at is null and r.resource_status not in ('ready','waived'))::int blocking_resource_count,
  count(*) filter(where r.warning_reason is not null)::int warning_resource_count,
  count(*) filter(where r.resource_type='material')::int material_count,
  count(*) filter(where r.resource_type='equipment')::int equipment_count,
  count(*) filter(where r.resource_type='vendor')::int vendor_count,
  coalesce(array_agg(r.blocking_reason order by r.need_by_date nulls last,r.label) filter(where r.required_before_start and r.blocking_reason is not null),'{}'::text[]) blocking_reasons,
  coalesce(array_agg(r.warning_reason order by r.need_by_date nulls last,r.label) filter(where r.warning_reason is not null),'{}'::text[]) warning_reasons,
  min(r.need_by_date) filter(where r.required_before_start and r.resource_status not in ('ready','waived')) next_blocked_need_by
from public.work_package_resource_requirement_status r
group by r.company_id,r.work_package_operation_id;

create or replace view public.work_package_start_readiness as
select b.*,
  coalesce(rs.resource_count,0) resource_count,
  coalesce(rs.blocking_resource_count,0) blocking_resource_count,
  coalesce(rs.warning_resource_count,0) resource_warning_count,
  coalesce(rs.material_count,0) material_count,
  coalesce(rs.equipment_count,0) equipment_count,
  coalesce(rs.vendor_count,0) vendor_count,
  coalesce(rs.blocking_reasons,'{}'::text[]) resource_blocking_reasons,
  coalesce(rs.warning_reasons,'{}'::text[]) resource_warning_reasons,
  b.blocking_reasons || coalesce(rs.blocking_reasons,'{}'::text[]) all_blocking_reasons,
  b.warning_reasons || coalesce(rs.warning_reasons,'{}'::text[]) all_warning_reasons,
  (b.ready_to_start and coalesce(rs.blocking_resource_count,0)=0) ready_to_start_all,
  case
    when not b.ready_to_start then b.readiness_status
    when coalesce(rs.blocking_resource_count,0)>0 then 'resource_hold'
    when coalesce(rs.warning_resource_count,0)>0 or cardinality(b.warning_reasons)>0 then 'ready_with_warning'
    else 'ready'
  end start_readiness_status,
  case
    when not b.ready_to_start then b.next_action
    when coalesce(rs.blocking_resource_count,0)>0 then rs.blocking_reasons[1]
    when coalesce(rs.warning_resource_count,0)>0 then 'Ready, but check: '||rs.warning_reasons[1]
    else 'Ready to start'
  end start_next_action
from public.work_package_operation_readiness b
left join public.work_package_resource_summary rs on rs.company_id=b.company_id and rs.work_package_operation_id=b.operation_id;

create or replace view public.work_package_lookahead as
with assigned as (
  select a.company_id,a.schedule_item_id,count(*)::int assigned_crew
  from public.work_schedule_assignments a group by a.company_id,a.schedule_item_id
), scheduled as (
  select w.company_id,w.id schedule_item_id,w.project_id,w.schedule_date,w.start_time,w.end_time,w.title,w.status schedule_status,w.crew_needed,
    coalesce(a.assigned_crew,0) assigned_crew,w.work_package_operation_id
  from public.work_schedule_items w
  left join assigned a on a.company_id=w.company_id and a.schedule_item_id=w.id
  where w.item_type='work' and w.status<>'cancelled' and w.work_package_operation_id is not null
), risk as (
  select operation_id,budgeted_man_hours,tracked_man_hours,budget_hours_used_percent
  from public.production_operation_risk
)
select s.*,r.job_number,r.project_name,r.package_name,r.location,r.task_name,r.field_label,r.planned_quantity,r.unit,r.operation_status,
  r.ready_to_start_all ready_to_start,r.start_readiness_status readiness_status,r.start_next_action next_action,
  r.all_blocking_reasons blocking_reasons,r.all_warning_reasons warning_reasons,
  r.blocking_resource_count,r.resource_warning_count,r.prior_open_count,r.inspection_blocking_count,
  risk.budgeted_man_hours,risk.tracked_man_hours,risk.budget_hours_used_percent,
  case when not r.ready_to_start_all and risk.budgeted_man_hours is not null then greatest(risk.budgeted_man_hours-coalesce(risk.tracked_man_hours,0),0) else 0 end planned_man_hours_at_risk,
  alt.operation_id replacement_operation_id,alt.package_name replacement_package_name,alt.work_label replacement_work_label
from scheduled s
join public.work_package_start_readiness r on r.company_id=s.company_id and r.operation_id=s.work_package_operation_id
left join risk on risk.operation_id=s.work_package_operation_id
left join lateral (
  select ar.operation_id,ar.package_name,coalesce(ar.field_label,ar.task_name) work_label
  from public.work_package_start_readiness ar
  where ar.company_id=s.company_id and ar.project_id=s.project_id and ar.ready_to_start_all
    and ar.operation_status in ('planned','in_progress','on_hold') and ar.operation_id<>s.work_package_operation_id
    and not exists(select 1 from public.work_schedule_items x where x.company_id=s.company_id and x.schedule_date=s.schedule_date and x.status<>'cancelled' and x.work_package_operation_id=ar.operation_id)
  order by ar.sequence,ar.package_name
  limit 1
) alt on true;

grant select on public.work_package_resource_requirement_status,public.work_package_resource_summary,public.work_package_start_readiness,public.work_package_lookahead to authenticated;
