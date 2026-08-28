-- Concrete ticket -> work package automation.
-- Ready-mix receipt quantities become the actual CY source for ticket-measured placement operations.
-- The planned takeoff quantity remains intact for estimate-vs-actual comparison.

alter table public.work_package_operations
  add column if not exists pour_plan_id uuid references public.pour_plans(id) on delete set null,
  add column if not exists actual_quantity numeric,
  add column if not exists actual_quantity_source text,
  add column if not exists quantity_review_status text not null default 'auto',
  add column if not exists quantity_review_reason text,
  add column if not exists quantity_synced_at timestamptz;

do $$ begin
  if not exists(
    select 1 from pg_constraint
    where conname='work_package_operations_actual_quantity_check'
      and conrelid='public.work_package_operations'::regclass
  ) then
    alter table public.work_package_operations
      add constraint work_package_operations_actual_quantity_check
      check(actual_quantity is null or actual_quantity>=0);
  end if;
  if not exists(
    select 1 from pg_constraint
    where conname='work_package_operations_quantity_source_check'
      and conrelid='public.work_package_operations'::regclass
  ) then
    alter table public.work_package_operations
      add constraint work_package_operations_quantity_source_check
      check(actual_quantity_source is null or actual_quantity_source in ('delivery_tickets','manual','plan','completion'));
  end if;
  if not exists(
    select 1 from pg_constraint
    where conname='work_package_operations_quantity_review_check'
      and conrelid='public.work_package_operations'::regclass
  ) then
    alter table public.work_package_operations
      add constraint work_package_operations_quantity_review_check
      check(quantity_review_status in ('auto','needs_review','verified','excluded'));
  end if;
end $$;

create index if not exists work_package_operation_pour_idx
  on public.work_package_operations(company_id,pour_plan_id)
  where pour_plan_id is not null;

-- One pour may feed only one CY production quantity. Otherwise the same trucks could be double-counted.
create unique index if not exists work_package_ticket_pour_unique
  on public.work_package_operations(pour_plan_id)
  where pour_plan_id is not null and measurement_method='ticket' and status<>'cancelled';

create or replace view public.work_package_operation_progress
with (security_invoker=true)
as
with labor as (
  select s.company_id,s.work_package_operation_id,
    round(sum(extract(epoch from (coalesce(s.ended_at,now())-s.started_at)))/3600.0,2) as tracked_man_hours,
    round(sum(case when sh.status='approved' and s.ended_at is not null then extract(epoch from (s.ended_at-s.started_at)) else 0 end)/3600.0,2) as approved_man_hours,
    count(distinct s.crew_member_id)::integer as worker_count,
    bool_and(sh.status='approved') filter (where s.ended_at is not null) as ended_time_approved
  from public.employee_task_segments s
  join public.employee_shift_sessions sh on sh.id=s.shift_id and sh.company_id=s.company_id
  where s.work_package_operation_id is not null and sh.status in ('active','submitted','approved')
  group by s.company_id,s.work_package_operation_id
)
select o.company_id,o.id as operation_id,o.work_package_id,p.project_id,pr.job_number,pr.name as project_name,
  p.name as package_name,p.location,p.drawing_reference,p.status as package_status,
  o.production_task_id,t.name as task_name,o.field_label,o.sequence,o.planned_quantity,o.unit,o.budgeted_man_hours,
  o.baseline_man_hours_per_unit,o.baseline_source,o.measurement_method,o.status as operation_status,o.started_at,o.completed_at,
  coalesce(l.tracked_man_hours,0)::numeric as tracked_man_hours,coalesce(l.approved_man_hours,0)::numeric as approved_man_hours,
  coalesce(l.worker_count,0)::integer as worker_count,coalesce(l.ended_time_approved,true) as ended_time_approved,
  case when o.budgeted_man_hours is not null and o.budgeted_man_hours>0 then round(100*coalesce(l.tracked_man_hours,0)/o.budgeted_man_hours,1) else null end as budget_hours_used_percent,
  o.pour_plan_id,o.actual_quantity,o.actual_quantity_source,o.quantity_review_status,o.quantity_review_reason,o.quantity_synced_at
from public.work_package_operations o
join public.work_packages p on p.id=o.work_package_id and p.company_id=o.company_id
join public.projects pr on pr.id=p.project_id and pr.company_id=p.company_id
join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
left join labor l on l.company_id=o.company_id and l.work_package_operation_id=o.id;

grant select on public.work_package_operation_progress to authenticated;

create or replace view public.earned_production_rate_history
with (security_invoker=true)
as
with labor as (
  select s.company_id,s.work_package_operation_id,
    round(sum(extract(epoch from (s.ended_at-s.started_at)))/3600.0,4) as man_hours,
    count(distinct s.crew_member_id)::integer as worker_count,
    bool_and(sh.status='approved') as time_approved,
    min(s.started_at) as first_work_at,max(s.ended_at) as last_work_at
  from public.employee_task_segments s
  join public.employee_shift_sessions sh on sh.id=s.shift_id and sh.company_id=s.company_id
  where s.work_package_operation_id is not null and s.ended_at is not null and sh.status in ('submitted','approved')
  group by s.company_id,s.work_package_operation_id
)
select o.company_id,p.project_id,pr.job_number,pr.name as project_name,o.work_package_id,p.name as package_name,p.location,
  o.id as operation_id,o.production_task_id,t.name as task_name,coalesce(o.actual_quantity,o.planned_quantity) as quantity_completed,o.unit,
  round(l.man_hours,2) as man_hours,l.worker_count,
  case when l.man_hours>0 then round(coalesce(o.actual_quantity,o.planned_quantity)/l.man_hours,3) else null end as units_per_man_hour,
  case when coalesce(o.actual_quantity,o.planned_quantity)>0 then round(l.man_hours/coalesce(o.actual_quantity,o.planned_quantity),4) else null end as man_hours_per_unit,
  o.budgeted_man_hours,o.baseline_man_hours_per_unit,o.baseline_source,o.completed_at::date as completed_date,o.completed_at,
  l.first_work_at,l.last_work_at,o.completion_source,
  o.actual_quantity_source,o.quantity_review_status,o.pour_plan_id
from public.work_package_operations o
join public.work_packages p on p.id=o.work_package_id and p.company_id=o.company_id
join public.projects pr on pr.id=p.project_id and pr.company_id=p.company_id
join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
join labor l on l.company_id=o.company_id and l.work_package_operation_id=o.id
where o.status='completed'
  and l.time_approved
  and l.man_hours>0
  and o.quantity_review_status in ('auto','verified');

grant select on public.earned_production_rate_history to authenticated;

create or replace view public.carez_production_learning_summary
with (security_invoker=true)
as
select h.company_id,h.production_task_id,h.task_name,h.unit,
  count(*)::integer as sample_packages,count(distinct h.project_id)::integer as sample_projects,
  min(h.completed_date) as first_sample_date,max(h.completed_date) as latest_sample_date,
  round(sum(h.quantity_completed),2) as total_quantity,round(sum(h.man_hours),2) as total_man_hours,
  case when sum(h.man_hours)>0 then round(sum(h.quantity_completed)/sum(h.man_hours),3) else null end as weighted_units_per_man_hour,
  case when sum(h.quantity_completed)>0 then round(sum(h.man_hours)/sum(h.quantity_completed),4) else null end as weighted_man_hours_per_unit,
  case when count(*)>=10 and count(distinct h.project_id)>=3 then 'high'
       when count(*)>=5 and count(distinct h.project_id)>=2 then 'medium'
       when count(*)>=2 then 'low' else 'seed' end as confidence
from public.earned_production_rate_history h
group by h.company_id,h.production_task_id,h.task_name,h.unit;

grant select on public.carez_production_learning_summary to authenticated;

-- Keep the early-warning view useful while exposing the quantity source and linked pour.
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
  end as needs_attention,
  x.measurement_method,x.pour_plan_id,x.actual_quantity,x.actual_quantity_source,
  x.quantity_review_status,x.quantity_review_reason,x.quantity_synced_at
from public.work_package_operation_progress x
join public.work_packages p on p.id=x.work_package_id and p.company_id=x.company_id;

grant select on public.production_operation_risk to authenticated;

-- All pour plans remain visible, even when production has not been linked yet.
create or replace view public.pour_work_package_delivery_sync
with (security_invoker=true)
as
select
  d.company_id,d.pour_plan_id,d.project_id,d.job_number,d.project_name,d.pour_name,d.pour_status,d.scheduled_date,
  d.planned_cy,d.ordered_cy,d.delivered_cy,d.variance_to_plan_cy,d.remaining_to_plan_cy,d.percent_of_plan_delivered,
  d.concrete_ticket_count,d.ticket_photo_count,d.tickets_missing_photo,d.first_delivery_date,d.latest_delivery_date,
  o.id as operation_id,o.work_package_id,wp.name as package_name,wp.location as package_location,
  o.production_task_id,t.name as task_name,o.field_label,o.planned_quantity as operation_planned_quantity,o.unit as operation_unit,
  o.status as operation_status,o.actual_quantity,o.actual_quantity_source,o.quantity_review_status,o.quantity_review_reason,o.quantity_synced_at,
  case
    when o.id is null then 'unlinked'
    when d.pour_status='cancelled' then 'cancelled'
    when coalesce(d.delivered_cy,0)<=0 and d.pour_status='completed' then 'closed_no_delivery'
    when coalesce(d.delivered_cy,0)<=0 then 'waiting_delivery'
    when coalesce(d.tickets_missing_photo,0)>0 then 'missing_evidence'
    when d.pour_status<>'completed' then 'pour_open'
    when o.status='completed' and o.quantity_review_status='needs_review' then 'needs_review'
    when o.status='completed' and o.quantity_review_status='excluded' then 'excluded'
    when o.status='completed' then 'synced'
    else 'ready_to_sync'
  end as sync_status,
  (o.id is not null and d.pour_status='completed' and coalesce(d.delivered_cy,0)>0 and coalesce(d.tickets_missing_photo,0)=0) as can_auto_complete
from public.pour_delivery_actual_summary d
left join public.work_package_operations o
  on o.pour_plan_id=d.pour_plan_id
 and o.measurement_method='ticket'
 and o.status<>'cancelled'
left join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
left join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id;

grant select on public.pour_work_package_delivery_sync to authenticated;

-- Core sync. Receipt quantity is authoritative actual CY; expected/takeoff CY remains the plan.
create or replace function public.carez_sync_ticket_work_packages_for_pour(p_pour_plan_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v record;
  o record;
  v_review text;
  v_reason text;
  v_changed boolean;
  v_ready boolean;
begin
  if p_pour_plan_id is null then return; end if;

  select d.*,pp.status as current_pour_status,pp.project_id as current_project_id
  into v
  from public.pour_delivery_actual_summary d
  join public.pour_plans pp on pp.id=d.pour_plan_id and pp.company_id=d.company_id
  where d.pour_plan_id=p_pour_plan_id;
  if not found then return; end if;

  for o in
    select wo.*,wp.project_id as package_project_id
    from public.work_package_operations wo
    join public.work_packages wp on wp.id=wo.work_package_id and wp.company_id=wo.company_id
    where wo.pour_plan_id=p_pour_plan_id
      and wo.measurement_method='ticket'
      and wo.status<>'cancelled'
  loop
    v_changed := o.actual_quantity is distinct from coalesce(v.delivered_cy,0);
    v_review := 'auto';
    v_reason := null;

    if o.package_project_id is distinct from v.current_project_id then
      v_review := 'needs_review';
      v_reason := 'Linked pour belongs to a different project.';
    elsif upper(coalesce(o.unit,''))<>'CY' then
      v_review := 'needs_review';
      v_reason := 'Concrete ticket production requires a CY work-package operation.';
    elsif coalesce(v.delivered_cy,0)<=0 then
      if v.current_pour_status='completed' then
        v_review := 'needs_review';
        v_reason := 'Pour is closed but no concrete delivery quantity is recorded.';
      end if;
    elsif coalesce(v.tickets_missing_photo,0)>0 then
      v_review := 'needs_review';
      v_reason := v.tickets_missing_photo||' concrete delivery ticket photo(s) still need matched evidence.';
    elsif abs(coalesce(v.delivered_cy,0)-o.planned_quantity)>greatest(1::numeric,o.planned_quantity*0.10) then
      if not v_changed and o.quantity_review_status in ('verified','excluded') then
        v_review := o.quantity_review_status;
        v_reason := o.quantity_review_reason;
      else
        v_review := 'needs_review';
        v_reason := 'Ticket actual differs from planned quantity by more than 10% or 1 CY.';
      end if;
    elsif not v_changed and o.quantity_review_status in ('verified','excluded') then
      v_review := o.quantity_review_status;
      v_reason := o.quantity_review_reason;
    end if;

    v_ready := o.package_project_id=v.current_project_id
      and upper(coalesce(o.unit,''))='CY'
      and v.current_pour_status='completed'
      and coalesce(v.delivered_cy,0)>0
      and coalesce(v.tickets_missing_photo,0)=0;

    update public.work_package_operations
    set actual_quantity=coalesce(v.delivered_cy,0),
        actual_quantity_source='delivery_tickets',
        quantity_review_status=v_review,
        quantity_review_reason=v_reason,
        quantity_synced_at=now(),
        status=case when v_ready then 'completed' else status end,
        completed_at=case when v_ready then coalesce(completed_at,now()) else completed_at end,
        completed_by_profile_id=case when v_ready then null else completed_by_profile_id end,
        completed_by_crew_member_id=case when v_ready then null else completed_by_crew_member_id end,
        completion_source=case when v_ready then 'delivery_tickets' else completion_source end,
        updated_at=now()
    where id=o.id and company_id=o.company_id;

    if v_ready then
      update public.work_packages p
      set status=case when exists(
        select 1 from public.work_package_operations q
        where q.work_package_id=p.id and q.status not in ('completed','cancelled')
      ) then 'active' else 'completed' end,
      updated_at=now()
      where p.id=o.work_package_id and p.company_id=o.company_id and p.status<>'cancelled';
    end if;
  end loop;
end$$;

revoke all on function public.carez_sync_ticket_work_packages_for_pour(uuid) from public,anon,authenticated;

create or replace function public.carez_ticket_receipt_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_new_pour uuid;v_old_pour uuid;
begin
  if tg_op<>'DELETE' then
    select pour_plan_id into v_new_pour from public.purchase_order_lines where id=new.purchase_order_line_id and company_id=new.company_id;
    perform public.carez_sync_ticket_work_packages_for_pour(v_new_pour);
  end if;
  if tg_op<>'INSERT' then
    select pour_plan_id into v_old_pour from public.purchase_order_lines where id=old.purchase_order_line_id and company_id=old.company_id;
    if v_old_pour is distinct from v_new_pour then perform public.carez_sync_ticket_work_packages_for_pour(v_old_pour); end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end$$;

create or replace function public.carez_ticket_document_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_receipt uuid;v_line uuid;v_pour uuid;
begin
  if tg_op<>'DELETE' and new.purchase_order_receipt_id is not null then
    v_receipt:=new.purchase_order_receipt_id;
    select r.purchase_order_line_id into v_line from public.purchase_order_receipts r where r.id=v_receipt and r.company_id=new.company_id;
    select pour_plan_id into v_pour from public.purchase_order_lines where id=v_line and company_id=new.company_id;
    perform public.carez_sync_ticket_work_packages_for_pour(v_pour);
  end if;
  if tg_op<>'INSERT' and old.purchase_order_receipt_id is not null
     and (tg_op='DELETE' or old.purchase_order_receipt_id is distinct from new.purchase_order_receipt_id or old.review_status is distinct from new.review_status) then
    v_receipt:=old.purchase_order_receipt_id;
    select r.purchase_order_line_id into v_line from public.purchase_order_receipts r where r.id=v_receipt and r.company_id=old.company_id;
    select pour_plan_id into v_pour from public.purchase_order_lines where id=v_line and company_id=old.company_id;
    perform public.carez_sync_ticket_work_packages_for_pour(v_pour);
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end$$;

create or replace function public.carez_ticket_pour_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.carez_sync_ticket_work_packages_for_pour(new.id);
  return new;
end$$;

create or replace function public.carez_ticket_operation_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.pour_plan_id is distinct from new.pour_plan_id and old.pour_plan_id is not null then
    perform public.carez_sync_ticket_work_packages_for_pour(old.pour_plan_id);
  end if;
  if new.measurement_method='ticket' and new.pour_plan_id is not null then
    perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id);
  end if;
  return new;
end$$;

create or replace function public.carez_ticket_operation_insert_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.measurement_method='ticket' and new.pour_plan_id is not null then
    perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id);
  end if;
  return new;
end$$;

create or replace function public.carez_ticket_po_line_sync_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op<>'DELETE' and new.pour_plan_id is not null then perform public.carez_sync_ticket_work_packages_for_pour(new.pour_plan_id); end if;
  if tg_op<>'INSERT' and old.pour_plan_id is not null and (tg_op='DELETE' or old.pour_plan_id is distinct from new.pour_plan_id) then perform public.carez_sync_ticket_work_packages_for_pour(old.pour_plan_id); end if;
  if tg_op='DELETE' then return old; else return new; end if;
end$$;

drop trigger if exists carez_ticket_receipt_sync on public.purchase_order_receipts;
create trigger carez_ticket_receipt_sync after insert or update or delete on public.purchase_order_receipts
for each row execute function public.carez_ticket_receipt_sync_trigger();

drop trigger if exists carez_ticket_document_sync on public.company_documents;
create trigger carez_ticket_document_sync after insert or update or delete on public.company_documents
for each row execute function public.carez_ticket_document_sync_trigger();

drop trigger if exists carez_ticket_pour_sync on public.pour_plans;
create trigger carez_ticket_pour_sync after update of status on public.pour_plans
for each row execute function public.carez_ticket_pour_sync_trigger();

drop trigger if exists carez_ticket_operation_sync on public.work_package_operations;
create trigger carez_ticket_operation_sync after update of pour_plan_id,measurement_method,planned_quantity on public.work_package_operations
for each row execute function public.carez_ticket_operation_sync_trigger();

drop trigger if exists carez_ticket_operation_insert_sync on public.work_package_operations;
create trigger carez_ticket_operation_insert_sync after insert on public.work_package_operations
for each row execute function public.carez_ticket_operation_insert_sync_trigger();

drop trigger if exists carez_ticket_po_line_sync on public.purchase_order_lines;
create trigger carez_ticket_po_line_sync after insert or update or delete on public.purchase_order_lines
for each row execute function public.carez_ticket_po_line_sync_trigger();

-- Ticket-measured concrete cannot be manually marked complete by an employee.
create or replace function public.employee_complete_work_package_operation(p_work_package_operation_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile public.profiles%rowtype;v_crew public.crew_members%rowtype;v_shift public.employee_shift_sessions%rowtype;v_operation public.work_package_operations%rowtype;v_package public.work_packages%rowtype;v_assigned boolean;
begin
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';if not found then raise exception 'Employee account required';end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;if not found then raise exception 'Employee record not linked';end if;
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;if not found then raise exception 'Clock in first';end if;
  select * into v_operation from public.work_package_operations where id=p_work_package_operation_id and company_id=v_shift.company_id and status not in ('completed','cancelled');if not found then raise exception 'This work is already finished or unavailable';end if;
  if v_operation.measurement_method='ticket' then raise exception 'Concrete quantity is tracked automatically from delivery tickets. Switch work or clock out when placement is done; Carez closes production when the pour and ticket evidence are complete.';end if;
  select * into v_package from public.work_packages where id=v_operation.work_package_id and company_id=v_shift.company_id and project_id=v_shift.project_id;if not found then raise exception 'This work belongs to a different job';end if;
  select exists(select 1 from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id where a.company_id=v_shift.company_id and a.crew_member_id=v_crew.id and w.work_package_operation_id=v_operation.id and w.status<>'cancelled') into v_assigned;
  if not v_assigned then raise exception 'This work is not assigned to you';end if;
  update public.employee_task_segments set ended_at=now() where shift_id=v_shift.id and work_package_operation_id=v_operation.id and ended_at is null;
  update public.work_package_operations set status='completed',completed_at=now(),completed_by_profile_id=auth.uid(),completed_by_crew_member_id=v_crew.id,completion_source='employee_confirmation',actual_quantity=coalesce(actual_quantity,planned_quantity),actual_quantity_source=coalesce(actual_quantity_source,'completion'),updated_at=now() where id=v_operation.id;
  if not exists(select 1 from public.work_package_operations o where o.work_package_id=v_package.id and o.status not in ('completed','cancelled')) then
    update public.work_packages set status='completed',updated_at=now() where id=v_package.id;
  else
    update public.work_packages set status='active',updated_at=now() where id=v_package.id and status<>'cancelled';
  end if;
  return v_operation.id;
end$$;

-- Employee portal: ticket-tracked placement is clearly distinguished from tap-to-finish work.
create or replace function public.employee_portal_state() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_profile public.profiles%rowtype;v_crew public.crew_members%rowtype;v_shift public.employee_shift_sessions%rowtype;v_today date:=(now() at time zone 'America/Los_Angeles')::date;v_elapsed numeric:=0;v_break numeric:=0;v_task numeric:=0;v_work numeric:=0;v_coverage numeric:=0;
begin
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';if not found then raise exception 'Employee account required';end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;if not found then raise exception 'Employee record is not linked';end if;
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;
  if v_shift.id is not null then v_elapsed:=greatest(extract(epoch from(now()-v_shift.clock_in_at)),0);select coalesce(sum(extract(epoch from(coalesce(ended_at,now())-started_at))),0) into v_break from public.employee_break_periods where shift_id=v_shift.id;select coalesce(sum(extract(epoch from(coalesce(ended_at,now())-started_at))),0) into v_task from public.employee_task_segments where shift_id=v_shift.id;v_work:=greatest(v_elapsed-v_break,0);v_coverage:=case when v_work>0 then least(100,round(100*v_task/v_work,1)) else 0 end;end if;
  return jsonb_build_object(
    'employee',jsonb_build_object('id',v_crew.id,'name',v_crew.name,'role',v_crew.role,'can_report_production',v_crew.can_report_production),
    'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'job_number',p.job_number,'name',p.name,'address',p.address,'city',p.city,'site_latitude',p.site_latitude,'site_longitude',p.site_longitude,'geofence_radius_ft',p.geofence_radius_ft) order by p.job_number),'[]'::jsonb) from public.projects p where p.company_id=v_profile.company_id and p.status='active'),
    'tasks',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'category',t.category,'unit',t.production_unit) order by t.sort_order,t.name),'[]'::jsonb) from public.production_tasks t where t.company_id=v_profile.company_id and t.active=true),
    'assigned_schedule',(select coalesce(jsonb_agg(x order by x->>'schedule_date',x->>'start_time'),'[]'::jsonb) from(
      select jsonb_build_object('id',w.id,'schedule_date',w.schedule_date,'start_time',w.start_time,'end_time',w.end_time,'title',w.title,'item_type',w.item_type,'status',w.status,'notes',w.notes,'project_id',w.project_id,'job_number',p.job_number,'project_name',p.name,'address',p.address,'city',p.city,'production_task_id',w.production_task_id,'task_name',pt.name,'production_unit',pt.production_unit,'work_package_operation_id',w.work_package_operation_id,'work_package_id',wp.id,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status,'measurement_method',wo.measurement_method) x
      from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id left join public.projects p on p.id=w.project_id left join public.production_tasks pt on pt.id=w.production_task_id left join public.work_package_operations wo on wo.id=w.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id
      where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.status<>'cancelled' and w.schedule_date between v_today and v_today+7
    )q),
    'suggested_tasks',(select coalesce(jsonb_agg(x order by x->>'sort_order',x->>'name'),'[]'::jsonb) from(
      select distinct jsonb_build_object('id',t.id,'name',t.name,'category',t.category,'unit',t.production_unit,'sort_order',lpad(t.sort_order::text,6,'0'),'scheduled_title',w.title,'work_package_operation_id',wo.id,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status,'measurement_method',wo.measurement_method) x
      from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id join public.production_tasks t on t.id=w.production_task_id and t.company_id=w.company_id left join public.work_package_operations wo on wo.id=w.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id
      where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.status<>'cancelled' and w.schedule_date=coalesce(v_shift.work_date,v_today) and (v_shift.id is null or w.project_id=v_shift.project_id) and (wo.id is null or wo.status not in ('completed','cancelled'))
    )q),
    'active_shift',case when v_shift.id is null then null else jsonb_build_object('id',v_shift.id,'project_id',v_shift.project_id,'clock_in_at',v_shift.clock_in_at,'clock_in_inside_geofence',v_shift.clock_in_inside_geofence,'clock_in_distance_ft',v_shift.clock_in_distance_ft) end,
    'active_task',(select jsonb_build_object('id',s.id,'production_task_id',s.production_task_id,'work_package_operation_id',s.work_package_operation_id,'started_at',s.started_at,'task_name',t.name,'unit',t.production_unit,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status,'measurement_method',wo.measurement_method,'actual_quantity',wo.actual_quantity,'actual_quantity_source',wo.actual_quantity_source) from public.employee_task_segments s join public.production_tasks t on t.id=s.production_task_id left join public.work_package_operations wo on wo.id=s.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id where s.shift_id=v_shift.id and s.ended_at is null limit 1),
    'active_break',(select jsonb_build_object('id',b.id,'started_at',b.started_at,'resume_production_task_id',b.resume_production_task_id,'resume_work_package_operation_id',b.resume_work_package_operation_id) from public.employee_break_periods b where b.shift_id=v_shift.id and b.ended_at is null limit 1),
    'work_tracking',jsonb_build_object('paid_work_minutes',round(v_work/60.0,0),'tracked_task_minutes',round(v_task/60.0,0),'coverage_percent',v_coverage,'needs_attention',v_shift.id is not null and v_work>=1800 and v_coverage<90),
    'today_reports',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'production_task_id',r.production_task_id,'task_name',t.name,'quantity',r.quantity_completed,'unit',r.unit,'review_status',r.review_status) order by t.sort_order),'[]'::jsonb) from public.daily_production_records r join public.production_tasks t on t.id=r.production_task_id where r.company_id=v_profile.company_id and (v_shift.id is null or r.project_id=v_shift.project_id) and r.work_date=coalesce(v_shift.work_date,v_today)),
    'recent',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(select jsonb_build_object('id',s.id,'work_date',s.work_date,'clock_in_at',s.clock_in_at,'clock_out_at',s.clock_out_at,'status',s.status,'task_coverage_percent',s.task_coverage_percent,'requires_review',s.requires_review,'project',p.job_number||' - '||p.name)x from public.employee_shift_sessions s join public.projects p on p.id=s.project_id where s.employee_profile_id=auth.uid() order by s.work_date desc,s.clock_in_at desc limit 7)q)
  );
end$$;

-- Seed/synchronize any existing ticket-linked rows created before this migration finishes.
do $$ declare r record; begin
  for r in select distinct pour_plan_id from public.work_package_operations where pour_plan_id is not null and measurement_method='ticket' loop
    perform public.carez_sync_ticket_work_packages_for_pour(r.pour_plan_id);
  end loop;
end $$;
