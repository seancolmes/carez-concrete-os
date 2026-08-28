-- Carez OS: field scope drift detection + work-package financial intelligence

create table if not exists public.scope_drift_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  work_package_operation_id uuid references public.work_package_operations(id) on delete set null,
  signal_key text,
  source_type text not null check (source_type in ('off_schedule_time','labor_overrun','quantity_variance','material_variance','field_note','drawing_change','manual')),
  detected_at timestamptz not null default now(),
  work_date date,
  severity text not null default 'watch' check (severity in ('watch','high','critical')),
  title text not null,
  details text,
  labor_hours numeric,
  quantity_variance numeric,
  unit text,
  classification text not null default 'unknown' check (classification in ('unknown','customer_change','gc_direction','design_change','unforeseen_condition','rework','estimate_miss','productivity','internal_error','no_scope_change')),
  status text not null default 'open' check (status in ('open','explained','potential_change','linked_change_order','dismissed')),
  change_order_id uuid references public.change_orders(id) on delete set null,
  resolution_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,signal_key)
);
create index if not exists scope_drift_events_project_idx on public.scope_drift_events(project_id,status,detected_at desc);
create index if not exists scope_drift_events_operation_idx on public.scope_drift_events(work_package_operation_id);

alter table public.scope_drift_events enable row level security;
drop policy if exists "office access scope drift events" on public.scope_drift_events;
create policy "office access scope drift events" on public.scope_drift_events for all to authenticated
using (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=public.get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

create or replace view public.scope_drift_auto_signals as
with off_schedule as (
  select s.company_id,sh.project_id,null::uuid work_package_operation_id,
    'off:'||sh.id::text||':'||s.production_task_id::text signal_key,
    'off_schedule_time'::text source_type,sh.work_date,case when sum(extract(epoch from(coalesce(s.ended_at,now())-s.started_at))/3600.0)>=2 then 'high' else 'watch' end severity,
    'Unplanned crew work — '||t.name title,
    'Employee time was recorded on work that was not assigned on the day schedule.' details,
    round(sum(extract(epoch from(coalesce(s.ended_at,now())-s.started_at))/3600.0),2) labor_hours,
    null::numeric quantity_variance,null::text unit
  from public.employee_task_segments s
  join public.employee_shift_sessions sh on sh.id=s.shift_id and sh.company_id=s.company_id
  join public.production_tasks t on t.id=s.production_task_id and t.company_id=s.company_id
  where coalesce(s.notes,'') ilike '%not assigned on today%'
  group by s.company_id,sh.project_id,sh.id,s.production_task_id,sh.work_date,t.name
), labor_over as (
  select r.company_id,r.project_id,r.operation_id work_package_operation_id,
    'labor:'||r.operation_id::text signal_key,'labor_overrun'::text source_type,
    (now() at time zone 'America/Los_Angeles')::date work_date,
    case when r.labor_risk='critical' then 'critical' else 'high' end severity,
    r.job_number||' — '||r.package_name||' labor plan exceeded' title,
    coalesce(r.field_label,r.task_name)||' has used '||coalesce(round(r.budget_hours_used_percent,0)::text,'more than planned')||'% of its labor budget and is not complete.' details,
    greatest(coalesce(r.tracked_man_hours,0)-coalesce(r.budgeted_man_hours,0),0) labor_hours,
    null::numeric quantity_variance,r.unit
  from public.production_operation_risk r
  where r.operation_status not in ('completed','cancelled') and r.labor_risk in ('over_budget','critical')
), quantity_variance as (
  select o.company_id,wp.project_id,o.id work_package_operation_id,
    'quantity:'||o.id::text signal_key,'quantity_variance'::text source_type,
    coalesce(o.completed_at::date,(now() at time zone 'America/Los_Angeles')::date) work_date,
    'high'::text severity,
    pr.job_number||' — '||wp.name||' quantity differs from plan' title,
    coalesce(o.field_label,t.name)||' planned '||round(o.planned_quantity,2)||' '||o.unit||' but actual evidence shows '||round(coalesce(o.actual_quantity,0),2)||' '||o.unit||'.' details,
    null::numeric labor_hours,coalesce(o.actual_quantity,0)-o.planned_quantity quantity_variance,o.unit
  from public.work_package_operations o
  join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
  join public.projects pr on pr.id=wp.project_id and pr.company_id=wp.company_id
  join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
  where o.quantity_review_status='needs_review' and o.actual_quantity is not null
)
select * from off_schedule
union all select * from labor_over
union all select * from quantity_variance;

create or replace view public.scope_drift_inbox as
select s.*,
  e.id captured_event_id,e.classification,e.status event_status,e.change_order_id,e.resolution_note,
  (e.id is null) uncaptured
from public.scope_drift_auto_signals s
left join public.scope_drift_events e on e.company_id=s.company_id and e.signal_key=s.signal_key;

grant select on public.scope_drift_auto_signals,public.scope_drift_inbox to authenticated;

create or replace view public.work_package_labor_actual_summary as
with seg as (
  select s.company_id,s.shift_id,s.work_package_operation_id,
    sum(extract(epoch from(s.ended_at-s.started_at)))/3600.0 operation_hours
  from public.employee_task_segments s
  where s.work_package_operation_id is not null and s.ended_at is not null
  group by s.company_id,s.shift_id,s.work_package_operation_id
), allocated as (
  select tc.company_id,seg.work_package_operation_id,
    seg.operation_hours approved_operation_hours,
    case when coalesce(tc.hours,0)>0 then coalesce(tc.direct_labor_cost,0)*(seg.operation_hours/tc.hours) else 0 end allocated_direct_labor_cost,
    case when coalesce(tc.hours,0)>0 then coalesce(tc.overhead_recovery_cost,0)*(seg.operation_hours/tc.hours) else 0 end allocated_overhead_cost
  from seg
  join public.timecards tc on tc.company_id=seg.company_id and tc.source_shift_id=seg.shift_id
)
select company_id,work_package_operation_id,
  round(sum(approved_operation_hours),2) approved_operation_hours,
  round(sum(allocated_direct_labor_cost),2) actual_direct_labor_cost,
  round(sum(allocated_overhead_cost),2) actual_overhead_cost,
  round(sum(allocated_direct_labor_cost+allocated_overhead_cost),2) actual_company_labor_cost
from allocated
group by company_id,work_package_operation_id;

create or replace view public.work_package_procurement_financial_summary as
select pol.company_id,pol.work_package_operation_id,
  round(coalesce(sum(pfs.total_cost) filter(where pfs.po_status in ('issued','closed')),0),2) committed_cost,
  round(coalesce(sum(pfs.actual_cost),0),2) procurement_actual_cost,
  round(coalesce(sum(pfs.open_commitment),0),2) open_commitment,
  round(coalesce(sum(pfs.actual_vs_po_variance),0),2) procurement_variance
from public.purchase_order_lines pol
join public.purchase_order_line_financial_summary pfs on pfs.purchase_order_line_id=pol.id and pfs.company_id=pol.company_id
where pol.work_package_operation_id is not null
group by pol.company_id,pol.work_package_operation_id;

create or replace view public.work_package_direct_cost_summary as
select pc.company_id,pc.work_package_operation_id,
  round(coalesce(sum(pc.total),0),2) direct_posted_cost
from public.project_costs pc
where pc.work_package_operation_id is not null and pc.purchase_order_line_id is null
  and coalesce(pc.source_type,'') not in ('timecard','payroll','employee_time')
group by pc.company_id,pc.work_package_operation_id;

create or replace view public.work_package_financial_summary as
select o.company_id,o.id operation_id,o.work_package_id,wp.project_id,pr.job_number,pr.name project_name,
  wp.name package_name,wp.location,o.production_task_id,t.name task_name,o.field_label,o.status operation_status,
  o.planned_quantity,o.actual_quantity,o.unit,o.budgeted_man_hours,o.source_estimate_item_id,
  ei.item_type source_estimate_item_type,ei.description source_estimate_description,ei.direct_cost source_estimate_direct_cost,
  coalesce(l.approved_operation_hours,0) approved_operation_hours,
  coalesce(l.actual_direct_labor_cost,0) actual_direct_labor_cost,
  coalesce(l.actual_overhead_cost,0) actual_overhead_cost,
  coalesce(pf.committed_cost,0) committed_procurement_cost,
  coalesce(pf.procurement_actual_cost,0) procurement_actual_cost,
  coalesce(pf.open_commitment,0) open_commitment,
  coalesce(dc.direct_posted_cost,0) other_posted_direct_cost,
  round(coalesce(l.actual_direct_labor_cost,0)+coalesce(pf.procurement_actual_cost,0)+coalesce(dc.direct_posted_cost,0),2) actual_direct_cost_to_date,
  round(coalesce(l.actual_direct_labor_cost,0)+coalesce(l.actual_overhead_cost,0)+coalesce(pf.procurement_actual_cost,0)+coalesce(dc.direct_posted_cost,0),2) actual_company_cost_to_date,
  round(coalesce(l.actual_direct_labor_cost,0)+coalesce(l.actual_overhead_cost,0)+coalesce(pf.procurement_actual_cost,0)+coalesce(dc.direct_posted_cost,0)+coalesce(pf.open_commitment,0),2) current_cost_exposure,
  case when o.status='completed' and coalesce(o.actual_quantity,o.planned_quantity)>0 then
    round((coalesce(l.actual_direct_labor_cost,0)+coalesce(l.actual_overhead_cost,0)+coalesce(pf.procurement_actual_cost,0)+coalesce(dc.direct_posted_cost,0))/coalesce(o.actual_quantity,o.planned_quantity),4)
    else null end actual_company_cost_per_unit,
  case when o.status='completed' and ei.direct_cost is not null then
    round((coalesce(l.actual_direct_labor_cost,0)+coalesce(pf.procurement_actual_cost,0)+coalesce(dc.direct_posted_cost,0))-ei.direct_cost,2)
    else null end completed_direct_cost_variance_to_source,
  case
    when o.source_estimate_item_id is null then 'no_source_budget'
    when o.status='completed' and ei.direct_cost is not null and (coalesce(l.actual_direct_labor_cost,0)+coalesce(pf.procurement_actual_cost,0)+coalesce(dc.direct_posted_cost,0))>ei.direct_cost then 'over_source_cost'
    when o.status='completed' and ei.direct_cost is not null then 'under_source_cost'
    when coalesce(pf.open_commitment,0)>0 then 'committed'
    else 'tracking'
  end financial_status
from public.work_package_operations o
join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
join public.projects pr on pr.id=wp.project_id and pr.company_id=wp.company_id
join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
left join public.estimate_items ei on ei.id=o.source_estimate_item_id and ei.company_id=o.company_id
left join public.work_package_labor_actual_summary l on l.company_id=o.company_id and l.work_package_operation_id=o.id
left join public.work_package_procurement_financial_summary pf on pf.company_id=o.company_id and pf.work_package_operation_id=o.id
left join public.work_package_direct_cost_summary dc on dc.company_id=o.company_id and dc.work_package_operation_id=o.id;

grant select on public.scope_drift_auto_signals,public.scope_drift_inbox,public.work_package_labor_actual_summary,public.work_package_procurement_financial_summary,public.work_package_direct_cost_summary,public.work_package_financial_summary to authenticated;
