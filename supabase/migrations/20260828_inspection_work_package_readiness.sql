-- Inspection and work-package readiness automation.
-- Carez derives whether physical work can start from real project facts rather than asking field staff to maintain a checklist.

alter table public.work_package_operations
  add column if not exists requires_prior_operations boolean not null default true,
  add column if not exists readiness_hold_reason text,
  add column if not exists readiness_hold_at timestamptz,
  add column if not exists readiness_hold_by uuid references public.profiles(id) on delete set null;

create or replace function public.carez_assign_work_package_sequence()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.sequence is null or new.sequence=0 then
    select coalesce(max(o.sequence),0)+10
      into new.sequence
    from public.work_package_operations o
    where o.company_id=new.company_id
      and o.work_package_id=new.work_package_id;
  end if;
  return new;
end$$;

drop trigger if exists carez_work_package_sequence on public.work_package_operations;
create trigger carez_work_package_sequence
before insert on public.work_package_operations
for each row execute function public.carez_assign_work_package_sequence();

create table if not exists public.project_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  required_for_operation_id uuid references public.work_package_operations(id) on delete cascade,
  title text not null,
  inspection_type text not null default 'general',
  authority text,
  status text not null default 'required',
  requested_at timestamptz,
  scheduled_date date,
  scheduled_time time,
  completed_at timestamptz,
  reference_number text,
  result_notes text,
  waived_reason text,
  evidence_document_id uuid references public.company_documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_inspections_status_check check (status in ('required','requested','scheduled','passed','failed','waived','cancelled')),
  constraint project_inspections_waiver_check check (status<>'waived' or nullif(trim(coalesce(waived_reason,'')),'') is not null)
);

create index if not exists project_inspections_company_project_idx on public.project_inspections(company_id,project_id,status);
create index if not exists project_inspections_operation_idx on public.project_inspections(company_id,required_for_operation_id,status) where required_for_operation_id is not null;

alter table public.project_inspections enable row level security;

drop policy if exists "office access project inspections" on public.project_inspections;
create policy "office access project inspections" on public.project_inspections for all
using (
  company_id=public.get_my_company_id()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee')
)
with check (
  company_id=public.get_my_company_id()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee')
);

grant select,insert,update,delete on public.project_inspections to authenticated;

alter table public.work_schedule_items
  add column if not exists inspection_id uuid references public.project_inspections(id) on delete cascade;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='work_schedule_items_inspection_unique'
      and conrelid='public.work_schedule_items'::regclass
  ) then
    alter table public.work_schedule_items
      add constraint work_schedule_items_inspection_unique unique(inspection_id);
  end if;
end$$;

create or replace function public.carez_sync_inspection_schedule()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_task_id uuid;
  v_title text;
  v_schedule_status text;
begin
  if tg_op='DELETE' then
    delete from public.work_schedule_items where inspection_id=old.id;
    return old;
  end if;

  if new.required_for_operation_id is not null then
    select production_task_id into v_task_id
    from public.work_package_operations
    where id=new.required_for_operation_id and company_id=new.company_id;
  end if;

  if new.scheduled_date is null then
    delete from public.work_schedule_items where inspection_id=new.id;
    return new;
  end if;

  v_title:='Inspection — '||new.title;
  v_schedule_status:=case
    when new.status in ('passed','waived') then 'completed'
    when new.status='cancelled' then 'cancelled'
    when new.status='scheduled' then 'confirmed'
    else 'planned'
  end;

  insert into public.work_schedule_items(
    company_id,project_id,schedule_date,item_type,title,production_task_id,
    work_package_operation_id,start_time,crew_needed,status,notes,created_by,inspection_id
  ) values(
    new.company_id,new.project_id,new.scheduled_date,'inspection',v_title,v_task_id,
    new.required_for_operation_id,new.scheduled_time,0,v_schedule_status,
    nullif(concat_ws(' · ',new.authority,new.reference_number),''),new.created_by,new.id
  )
  on conflict(inspection_id) do update set
    project_id=excluded.project_id,
    schedule_date=excluded.schedule_date,
    title=excluded.title,
    production_task_id=excluded.production_task_id,
    work_package_operation_id=excluded.work_package_operation_id,
    start_time=excluded.start_time,
    status=excluded.status,
    notes=excluded.notes,
    updated_at=now();

  return new;
end$$;

drop trigger if exists carez_inspection_schedule_sync on public.project_inspections;
create trigger carez_inspection_schedule_sync
after insert or update or delete on public.project_inspections
for each row execute function public.carez_sync_inspection_schedule();

create or replace view public.work_package_operation_readiness
with (security_invoker=true)
as
with prior as (
  select
    o.company_id,
    o.id as operation_id,
    count(p.id) filter (where p.status not in ('completed','cancelled'))::integer as prior_open_count,
    coalesce(
      array_agg(coalesce(p.field_label,t.name) order by p.sequence)
        filter (where p.id is not null and p.status not in ('completed','cancelled')),
      '{}'::text[]
    ) as prior_open_labels
  from public.work_package_operations o
  left join public.work_package_operations p
    on p.company_id=o.company_id
   and p.work_package_id=o.work_package_id
   and p.sequence<o.sequence
  left join public.production_tasks t
    on t.id=p.production_task_id
   and t.company_id=p.company_id
  group by o.company_id,o.id
),
inspection_rollup as (
  select
    i.company_id,
    i.required_for_operation_id as operation_id,
    count(*)::integer as inspection_count,
    count(*) filter (where i.status in ('passed','waived'))::integer as inspection_clear_count,
    count(*) filter (where i.status not in ('passed','waived'))::integer as inspection_blocking_count,
    count(*) filter (where i.status='failed')::integer as inspection_failed_count,
    min(i.scheduled_date) filter (where i.status not in ('passed','waived','cancelled')) as next_inspection_date,
    coalesce(array_agg(i.title order by i.created_at) filter (where i.status not in ('passed','waived')),'{}'::text[]) as open_inspection_labels
  from public.project_inspections i
  where i.required_for_operation_id is not null
  group by i.company_id,i.required_for_operation_id
),
scheduled as (
  select company_id,work_package_operation_id as operation_id,
    min(schedule_date) filter (where status<>'cancelled' and item_type='work') as scheduled_work_date,
    count(*) filter (where status in ('confirmed','in_progress') and item_type='work')::integer as confirmed_work_items
  from public.work_schedule_items
  where work_package_operation_id is not null
  group by company_id,work_package_operation_id
),
facts as (
  select
    o.company_id,o.id as operation_id,o.work_package_id,wp.project_id,
    pr.job_number,pr.name as project_name,wp.name as package_name,wp.location,wp.drawing_reference,
    o.production_task_id,t.name as task_name,o.field_label,o.sequence,o.planned_quantity,o.unit,
    o.measurement_method,o.status as operation_status,o.requires_prior_operations,
    o.readiness_hold_reason,o.readiness_hold_at,
    coalesce(j.job_ready,true) as job_setup_ready,
    j.readiness_reason as job_setup_reason,
    coalesce(px.prior_open_count,0) as prior_open_count,
    coalesce(px.prior_open_labels,'{}'::text[]) as prior_open_labels,
    coalesce(ix.inspection_count,0) as inspection_count,
    coalesce(ix.inspection_clear_count,0) as inspection_clear_count,
    coalesce(ix.inspection_blocking_count,0) as inspection_blocking_count,
    coalesce(ix.inspection_failed_count,0) as inspection_failed_count,
    ix.next_inspection_date,coalesce(ix.open_inspection_labels,'{}'::text[]) as open_inspection_labels,
    sx.scheduled_work_date,coalesce(sx.confirmed_work_items,0) as confirmed_work_items,
    o.pour_plan_id,pp.name as pour_name,pp.status as pour_status,
    coalesce(pd.planned_cy,0)::numeric as pour_planned_cy,
    coalesce(pd.ordered_cy,0)::numeric as ordered_cy
  from public.work_package_operations o
  join public.work_packages wp on wp.id=o.work_package_id and wp.company_id=o.company_id
  join public.projects pr on pr.id=wp.project_id and pr.company_id=wp.company_id
  join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
  left join public.project_job_readiness_summary j on j.project_id=wp.project_id and j.company_id=wp.company_id
  left join prior px on px.operation_id=o.id and px.company_id=o.company_id
  left join inspection_rollup ix on ix.operation_id=o.id and ix.company_id=o.company_id
  left join scheduled sx on sx.operation_id=o.id and sx.company_id=o.company_id
  left join public.pour_plans pp on pp.id=o.pour_plan_id and pp.company_id=o.company_id
  left join public.pour_delivery_actual_summary pd on pd.pour_plan_id=o.pour_plan_id and pd.company_id=o.company_id
),
evaluated as (
  select f.*,
    array_remove(array[
      case when f.readiness_hold_reason is not null then 'Management hold: '||f.readiness_hold_reason end,
      case when not f.job_setup_ready then coalesce(f.job_setup_reason,'Job setup is not ready') end,
      case when f.requires_prior_operations and f.prior_open_count>0 then 'Finish prior work: '||array_to_string(f.prior_open_labels,', ') end,
      case when f.inspection_failed_count>0 then 'Inspection failed — correct work and obtain a passing result' end,
      case when f.inspection_blocking_count>0 and f.inspection_failed_count=0 then 'Inspection not cleared: '||array_to_string(f.open_inspection_labels,', ') end,
      case when f.measurement_method='ticket' and f.pour_plan_id is null then 'Concrete placement is not linked to a Pour Plan' end,
      case when f.measurement_method='ticket' and f.pour_plan_id is not null and coalesce(f.pour_status,'planning') not in ('authorized','completed') then 'Pour is not authorized' end,
      case when f.measurement_method='ticket' and f.pour_plan_id is not null and coalesce(f.pour_status,'planning')='authorized' and f.ordered_cy<=0 then 'Ready-mix order has not been issued' end
    ],null)::text[] as blocking_reasons,
    array_remove(array[
      case when f.measurement_method='ticket' and f.ordered_cy>0 and f.pour_planned_cy>0 and f.ordered_cy<f.pour_planned_cy then 'Concrete order is below planned CY' end,
      case when f.scheduled_work_date is not null and f.next_inspection_date is not null and f.next_inspection_date>=f.scheduled_work_date then 'Inspection is scheduled on or after the planned work date' end
    ],null)::text[] as warning_reasons
  from facts f
)
select e.*,
  case
    when e.operation_status='completed' then false
    when e.operation_status='cancelled' then false
    else cardinality(e.blocking_reasons)=0
  end as ready_to_start,
  case
    when e.operation_status='completed' then 'completed'
    when e.operation_status='cancelled' then 'cancelled'
    when e.readiness_hold_reason is not null then 'management_hold'
    when not e.job_setup_ready then 'job_setup_hold'
    when e.requires_prior_operations and e.prior_open_count>0 then 'waiting_prior_work'
    when e.inspection_failed_count>0 then 'inspection_failed'
    when e.inspection_blocking_count>0 then 'waiting_inspection'
    when e.measurement_method='ticket' and e.pour_plan_id is null then 'waiting_pour_link'
    when e.measurement_method='ticket' and coalesce(e.pour_status,'planning') not in ('authorized','completed') then 'waiting_pour_authorization'
    when e.measurement_method='ticket' and e.pour_status='authorized' and e.ordered_cy<=0 then 'waiting_concrete_order'
    else 'ready'
  end as readiness_status,
  case
    when e.operation_status in ('completed','cancelled') then initcap(e.operation_status)
    when cardinality(e.blocking_reasons)=0 then 'Ready to start'
    else e.blocking_reasons[1]
  end as next_action
from evaluated e;

grant select on public.work_package_operation_readiness to authenticated;

create or replace view public.project_work_readiness_summary
with (security_invoker=true)
as
select
  r.company_id,r.project_id,r.job_number,r.project_name,
  count(*) filter (where r.operation_status not in ('completed','cancelled'))::integer as open_operations,
  count(*) filter (where r.operation_status not in ('completed','cancelled') and r.ready_to_start)::integer as ready_operations,
  count(*) filter (where r.operation_status not in ('completed','cancelled') and not r.ready_to_start)::integer as blocked_operations,
  count(*) filter (where r.inspection_blocking_count>0 and r.operation_status not in ('completed','cancelled'))::integer as inspection_blocked_operations,
  count(*) filter (where r.inspection_failed_count>0 and r.operation_status not in ('completed','cancelled'))::integer as failed_inspection_operations,
  min(r.scheduled_work_date) filter (where r.operation_status not in ('completed','cancelled')) as next_scheduled_work_date
from public.work_package_operation_readiness r
group by r.company_id,r.project_id,r.job_number,r.project_name;

grant select on public.project_work_readiness_summary to authenticated;

create or replace function public.employee_clock_in(p_project_id uuid,p_lat double precision,p_lng double precision,p_accuracy_m numeric,p_device_label text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile public.profiles%rowtype;v_crew public.crew_members%rowtype;v_project public.projects%rowtype;v_id uuid;v_dist numeric;v_inside boolean;
  v_work_date date:=(now() at time zone 'America/Los_Angeles')::date;
  v_task_count integer:=0;v_task_id uuid;v_operation_count integer:=0;v_ready_operation_count integer:=0;v_operation_id uuid;v_block_reason text;
begin
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';if not found then raise exception 'Employee account required';end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;if not found then raise exception 'Employee record not linked';end if;
  if exists(select 1 from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active') then raise exception 'Already clocked in';end if;
  select * into v_project from public.projects where id=p_project_id and company_id=v_profile.company_id and status='active';if not found then raise exception 'Job not available';end if;

  select
    count(distinct w.work_package_operation_id),
    count(distinct w.work_package_operation_id) filter (where coalesce(r.ready_to_start,false)),
    (array_agg(r.next_action order by w.start_time nulls last) filter (where w.work_package_operation_id is not null and not coalesce(r.ready_to_start,false)))[1]
  into v_operation_count,v_ready_operation_count,v_block_reason
  from public.work_schedule_assignments a
  join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
  left join public.work_package_operation_readiness r on r.operation_id=w.work_package_operation_id and r.company_id=w.company_id
  where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id
    and w.project_id=v_project.id and w.schedule_date=v_work_date and w.status<>'cancelled'
    and w.item_type='work';

  select count(distinct w.production_task_id),(array_agg(distinct w.production_task_id))[1]
  into v_task_count,v_task_id
  from public.work_schedule_assignments a
  join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
  where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id
    and w.project_id=v_project.id and w.schedule_date=v_work_date and w.status<>'cancelled'
    and w.item_type='work' and w.work_package_operation_id is null and w.production_task_id is not null;

  if v_operation_count>0 and v_ready_operation_count=0 and v_task_count=0 then
    raise exception 'Today''s assigned work is on hold: %',coalesce(v_block_reason,'Office must clear work readiness first');
  end if;

  v_dist:=public.carez_distance_ft(p_lat,p_lng,v_project.site_latitude,v_project.site_longitude);v_inside:=case when v_dist is null then null else v_dist<=v_project.geofence_radius_ft end;
  insert into public.employee_shift_sessions(company_id,crew_member_id,employee_profile_id,project_id,work_date,clock_in_at,clock_in_latitude,clock_in_longitude,clock_in_accuracy_m,clock_in_distance_ft,clock_in_inside_geofence,device_label,status,requires_review,review_reasons)
  values(v_profile.company_id,v_crew.id,auth.uid(),v_project.id,v_work_date,now(),p_lat,p_lng,p_accuracy_m,v_dist,v_inside,p_device_label,'active',false,'{}'::text[]) returning id into v_id;

  if v_ready_operation_count=1 then
    select w.work_package_operation_id into v_operation_id
    from public.work_schedule_assignments a
    join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
    join public.work_package_operation_readiness r on r.operation_id=w.work_package_operation_id and r.company_id=w.company_id and r.ready_to_start
    where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id
      and w.project_id=v_project.id and w.schedule_date=v_work_date and w.status<>'cancelled' and w.item_type='work'
    order by w.start_time nulls last limit 1;

    select production_task_id into v_task_id from public.work_package_operations where id=v_operation_id and company_id=v_profile.company_id and status not in ('completed','cancelled');
    if v_task_id is not null then
      insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m,notes)
      values(v_profile.company_id,v_id,v_crew.id,v_project.id,v_task_id,v_operation_id,now(),p_lat,p_lng,p_accuracy_m,'Auto-started from today''s ready work package');
      update public.work_package_operations set status=case when status='planned' then 'in_progress' else status end,started_at=coalesce(started_at,now()),updated_at=now() where id=v_operation_id and company_id=v_profile.company_id;
      update public.work_packages p set status=case when p.status='planned' then 'active' else p.status end,updated_at=now() where p.id=(select work_package_id from public.work_package_operations where id=v_operation_id);
    end if;
  elsif v_ready_operation_count=0 and v_task_count=1 and v_task_id is not null then
    insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m,notes)
    values(v_profile.company_id,v_id,v_crew.id,v_project.id,v_task_id,now(),p_lat,p_lng,p_accuracy_m,'Auto-started from today''s assigned work');
  end if;
  return v_id;
end$$;

create or replace function public.employee_start_work(p_work_package_operation_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy_m numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_shift public.employee_shift_sessions%rowtype;v_operation public.work_package_operations%rowtype;v_package public.work_packages%rowtype;v_id uuid;v_scheduled boolean;v_ready boolean;v_reason text;
begin
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;if not found then raise exception 'Clock in first';end if;
  if exists(select 1 from public.employee_break_periods where shift_id=v_shift.id and ended_at is null) then raise exception 'End break before starting work';end if;
  select * into v_operation from public.work_package_operations where id=p_work_package_operation_id and company_id=v_shift.company_id and status not in ('completed','cancelled');if not found then raise exception 'This work package is not available';end if;
  select * into v_package from public.work_packages where id=v_operation.work_package_id and company_id=v_shift.company_id and project_id=v_shift.project_id;if not found then raise exception 'This work belongs to a different job';end if;
  select exists(select 1 from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id where a.company_id=v_shift.company_id and a.crew_member_id=v_shift.crew_member_id and w.project_id=v_shift.project_id and w.schedule_date=v_shift.work_date and w.status<>'cancelled' and w.work_package_operation_id=v_operation.id and w.item_type='work') into v_scheduled;
  if not v_scheduled then raise exception 'This work is not assigned to you today';end if;
  select ready_to_start,next_action into v_ready,v_reason from public.work_package_operation_readiness where operation_id=v_operation.id and company_id=v_shift.company_id;
  if not coalesce(v_ready,false) then raise exception 'This work is on hold: %',coalesce(v_reason,'Office must clear readiness first');end if;
  update public.employee_task_segments set ended_at=now() where shift_id=v_shift.id and ended_at is null;
  insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m)
  values(v_shift.company_id,v_shift.id,v_shift.crew_member_id,v_shift.project_id,v_operation.production_task_id,v_operation.id,now(),p_lat,p_lng,p_accuracy_m) returning id into v_id;
  update public.work_package_operations set status=case when status='planned' then 'in_progress' else status end,started_at=coalesce(started_at,now()),updated_at=now() where id=v_operation.id;
  update public.work_packages set status=case when status='planned' then 'active' else status end,updated_at=now() where id=v_package.id;
  return v_id;
end$$;

create or replace function public.employee_portal_state()
returns jsonb language plpgsql security definer set search_path=public as $$
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
      select jsonb_build_object('id',w.id,'schedule_date',w.schedule_date,'start_time',w.start_time,'end_time',w.end_time,'title',w.title,'item_type',w.item_type,'status',w.status,'notes',w.notes,'project_id',w.project_id,'job_number',p.job_number,'project_name',p.name,'address',p.address,'city',p.city,'production_task_id',w.production_task_id,'task_name',pt.name,'production_unit',pt.production_unit,'work_package_operation_id',w.work_package_operation_id,'work_package_id',wp.id,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status,'measurement_method',wo.measurement_method,'ready_to_start',coalesce(rr.ready_to_start,true),'readiness_status',rr.readiness_status,'readiness_action',rr.next_action,'blocking_reasons',coalesce(to_jsonb(rr.blocking_reasons),'[]'::jsonb),'warning_reasons',coalesce(to_jsonb(rr.warning_reasons),'[]'::jsonb)) x
      from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id left join public.projects p on p.id=w.project_id left join public.production_tasks pt on pt.id=w.production_task_id left join public.work_package_operations wo on wo.id=w.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id left join public.work_package_operation_readiness rr on rr.operation_id=wo.id and rr.company_id=w.company_id
      where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.status<>'cancelled' and w.schedule_date between v_today and v_today+7
    )q),
    'suggested_tasks',(select coalesce(jsonb_agg(x order by x->>'sort_order',x->>'name'),'[]'::jsonb) from(
      select distinct jsonb_build_object('id',t.id,'name',t.name,'category',t.category,'unit',t.production_unit,'sort_order',lpad(t.sort_order::text,6,'0'),'scheduled_title',w.title,'work_package_operation_id',wo.id,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status,'measurement_method',wo.measurement_method,'ready_to_start',coalesce(rr.ready_to_start,true),'readiness_status',rr.readiness_status,'readiness_action',rr.next_action,'blocking_reasons',coalesce(to_jsonb(rr.blocking_reasons),'[]'::jsonb)) x
      from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id join public.production_tasks t on t.id=w.production_task_id and t.company_id=w.company_id left join public.work_package_operations wo on wo.id=w.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id left join public.work_package_operation_readiness rr on rr.operation_id=wo.id and rr.company_id=w.company_id
      where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.status<>'cancelled' and w.item_type='work' and w.schedule_date=coalesce(v_shift.work_date,v_today) and (v_shift.id is null or w.project_id=v_shift.project_id) and (wo.id is null or wo.status not in ('completed','cancelled'))
    )q),
    'active_shift',case when v_shift.id is null then null else jsonb_build_object('id',v_shift.id,'project_id',v_shift.project_id,'clock_in_at',v_shift.clock_in_at,'clock_in_inside_geofence',v_shift.clock_in_inside_geofence,'clock_in_distance_ft',v_shift.clock_in_distance_ft) end,
    'active_task',(select jsonb_build_object('id',s.id,'production_task_id',s.production_task_id,'work_package_operation_id',s.work_package_operation_id,'started_at',s.started_at,'task_name',t.name,'unit',t.production_unit,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status,'measurement_method',wo.measurement_method,'actual_quantity',wo.actual_quantity,'actual_quantity_source',wo.actual_quantity_source) from public.employee_task_segments s join public.production_tasks t on t.id=s.production_task_id left join public.work_package_operations wo on wo.id=s.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id where s.shift_id=v_shift.id and s.ended_at is null limit 1),
    'active_break',(select jsonb_build_object('id',b.id,'started_at',b.started_at,'resume_production_task_id',b.resume_production_task_id,'resume_work_package_operation_id',b.resume_work_package_operation_id) from public.employee_break_periods b where b.shift_id=v_shift.id and b.ended_at is null limit 1),
    'work_tracking',jsonb_build_object('paid_work_minutes',round(v_work/60.0,0),'tracked_task_minutes',round(v_task/60.0,0),'coverage_percent',v_coverage,'needs_attention',v_shift.id is not null and v_work>=1800 and v_coverage<90),
    'today_reports',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'production_task_id',r.production_task_id,'task_name',t.name,'quantity',r.quantity_completed,'unit',r.unit,'review_status',r.review_status) order by t.sort_order),'[]'::jsonb) from public.daily_production_records r join public.production_tasks t on t.id=r.production_task_id where r.company_id=v_profile.company_id and (v_shift.id is null or r.project_id=v_shift.project_id) and r.work_date=coalesce(v_shift.work_date,v_today)),
    'recent',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(select jsonb_build_object('id',s.id,'work_date',s.work_date,'clock_in_at',s.clock_in_at,'clock_out_at',s.clock_out_at,'status',s.status,'task_coverage_percent',s.task_coverage_percent,'requires_review',s.requires_review,'project',p.job_number||' - '||p.name)x from public.employee_shift_sessions s join public.projects p on p.id=s.project_id where s.employee_profile_id=auth.uid() order by s.work_date desc,s.clock_in_at desc limit 7)q)
  );
end$$;

grant execute on function public.employee_clock_in(uuid,double precision,double precision,numeric,text) to authenticated;
grant execute on function public.employee_start_work(uuid,double precision,double precision,numeric) to authenticated;
grant execute on function public.employee_portal_state() to authenticated;
