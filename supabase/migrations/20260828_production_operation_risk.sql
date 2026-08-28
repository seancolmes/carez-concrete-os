-- Proactive labor-burn warnings for open earned-production work.
-- No field percent-complete entry is required: Carez watches consumed man-hours against the package labor budget.

create or replace view public.production_operation_risk
with (security_invoker=true)
as
select
  x.company_id,x.operation_id,x.work_package_id,x.project_id,x.job_number,x.project_name,
  x.package_name,x.location,x.drawing_reference,x.production_task_id,x.task_name,x.field_label,
  x.planned_quantity,x.unit,x.operation_status,x.started_at,x.completed_at,
  p.planned_start_date,p.planned_end_date,
  x.tracked_man_hours,x.approved_man_hours,x.worker_count,x.budgeted_man_hours,
  x.baseline_man_hours_per_unit,x.baseline_source,
  case when x.budgeted_man_hours is null or x.budgeted_man_hours<=0 then null
       else round(greatest(x.budgeted_man_hours-x.tracked_man_hours,0),2) end as budget_man_hours_remaining,
  case when x.budgeted_man_hours is null or x.budgeted_man_hours<=0 then 0
       else round(greatest(x.tracked_man_hours-x.budgeted_man_hours,0),2) end as over_budget_man_hours,
  x.budget_hours_used_percent,
  case
    when x.operation_status in ('completed','cancelled') then 'closed'
    when x.budgeted_man_hours is null or x.budgeted_man_hours<=0 then 'no_budget'
    when x.tracked_man_hours>=x.budgeted_man_hours*1.20 then 'critical'
    when x.tracked_man_hours>=x.budgeted_man_hours then 'over_budget'
    when x.tracked_man_hours>=x.budgeted_man_hours*0.80 then 'watch'
    else 'on_track'
  end as labor_risk,
  case
    when x.operation_status in ('completed','cancelled') then 'closed'
    when p.planned_end_date is not null and p.planned_end_date < (now() at time zone 'America/Los_Angeles')::date then 'overdue'
    when p.planned_end_date = (now() at time zone 'America/Los_Angeles')::date then 'due_today'
    else 'on_schedule'
  end as schedule_risk,
  case
    when x.operation_status in ('completed','cancelled') then false
    when x.budgeted_man_hours is not null and x.budgeted_man_hours>0 and x.tracked_man_hours>=x.budgeted_man_hours*0.80 then true
    when p.planned_end_date is not null and p.planned_end_date < (now() at time zone 'America/Los_Angeles')::date then true
    else false
  end as needs_attention
from public.work_package_operation_progress x
join public.work_packages p on p.id=x.work_package_id and p.company_id=x.company_id;

grant select on public.production_operation_risk to authenticated;
