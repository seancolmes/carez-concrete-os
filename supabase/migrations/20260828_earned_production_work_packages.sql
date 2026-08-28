-- Earned production work packages
-- Physical scope carries known takeoff quantities forward into scheduling, field time, and learned Carez production rates.

create table if not exists public.work_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  location text,
  description text,
  drawing_reference text,
  source_type text not null default 'manual',
  source_estimate_id uuid references public.estimates(id) on delete set null,
  status text not null default 'planned',
  planned_start_date date,
  planned_end_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_packages_source_type_check check (source_type in ('manual','estimate','takeoff','import')),
  constraint work_packages_status_check check (status in ('planned','active','completed','on_hold','cancelled'))
);

create index if not exists work_packages_company_project_idx on public.work_packages(company_id,project_id,status);

create table if not exists public.work_package_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_package_id uuid not null references public.work_packages(id) on delete cascade,
  production_task_id uuid not null references public.production_tasks(id) on delete restrict,
  source_estimate_item_id uuid references public.estimate_items(id) on delete set null,
  field_label text,
  sequence integer not null default 0,
  planned_quantity numeric not null,
  unit text not null,
  budgeted_man_hours numeric,
  baseline_man_hours_per_unit numeric,
  baseline_source text not null default 'manual',
  measurement_method text not null default 'completion',
  status text not null default 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  completed_by_crew_member_id uuid references public.crew_members(id) on delete set null,
  completion_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_package_operations_quantity_check check (planned_quantity > 0),
  constraint work_package_operations_budget_mh_check check (budgeted_man_hours is null or budgeted_man_hours >= 0),
  constraint work_package_operations_baseline_check check (baseline_man_hours_per_unit is null or baseline_man_hours_per_unit >= 0),
  constraint work_package_operations_measurement_check check (measurement_method in ('completion','ticket','plan','manual')),
  constraint work_package_operations_status_check check (status in ('planned','in_progress','completed','on_hold','cancelled')),
  constraint work_package_operations_baseline_source_check check (baseline_source in ('manual','national_estimator','carez_blend','carez_actual'))
);

create index if not exists work_package_operations_package_idx on public.work_package_operations(company_id,work_package_id,status,sequence);
create index if not exists work_package_operations_task_idx on public.work_package_operations(company_id,production_task_id,status);

alter table public.work_schedule_items add column if not exists work_package_operation_id uuid references public.work_package_operations(id) on delete set null;
alter table public.employee_task_segments add column if not exists work_package_operation_id uuid references public.work_package_operations(id) on delete set null;
alter table public.employee_break_periods add column if not exists resume_work_package_operation_id uuid references public.work_package_operations(id) on delete set null;

create index if not exists work_schedule_operation_idx on public.work_schedule_items(company_id,work_package_operation_id,schedule_date) where work_package_operation_id is not null;
create index if not exists employee_segment_operation_idx on public.employee_task_segments(company_id,work_package_operation_id,started_at) where work_package_operation_id is not null;

alter table public.work_packages enable row level security;
alter table public.work_package_operations enable row level security;

create policy "office access work packages" on public.work_packages for all
using (company_id=get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

create policy "office access work package operations" on public.work_package_operations for all
using (company_id=get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'))
with check (company_id=get_my_company_id() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role<>'employee'));

grant select,insert,update,delete on public.work_packages to authenticated;
grant select,insert,update,delete on public.work_package_operations to authenticated;

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
  case when o.budgeted_man_hours is not null and o.budgeted_man_hours>0 then round(100*coalesce(l.tracked_man_hours,0)/o.budgeted_man_hours,1) else null end as budget_hours_used_percent
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
  o.id as operation_id,o.production_task_id,t.name as task_name,o.planned_quantity as quantity_completed,o.unit,
  round(l.man_hours,2) as man_hours,l.worker_count,
  case when l.man_hours>0 then round(o.planned_quantity/l.man_hours,3) else null end as units_per_man_hour,
  case when o.planned_quantity>0 then round(l.man_hours/o.planned_quantity,4) else null end as man_hours_per_unit,
  o.budgeted_man_hours,o.baseline_man_hours_per_unit,o.baseline_source,o.completed_at::date as completed_date,o.completed_at,
  l.first_work_at,l.last_work_at,o.completion_source
from public.work_package_operations o
join public.work_packages p on p.id=o.work_package_id and p.company_id=o.company_id
join public.projects pr on pr.id=p.project_id and pr.company_id=p.company_id
join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
join labor l on l.company_id=o.company_id and l.work_package_operation_id=o.id
where o.status='completed' and l.time_approved and l.man_hours>0;

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

create or replace function public.employee_clock_in(p_project_id uuid,p_lat double precision,p_lng double precision,p_accuracy_m numeric,p_device_label text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile public.profiles%rowtype;v_crew public.crew_members%rowtype;v_project public.projects%rowtype;v_id uuid;v_dist numeric;v_inside boolean;
  v_work_date date:=(now() at time zone 'America/Los_Angeles')::date;v_task_count integer:=0;v_task_id uuid;v_operation_count integer:=0;v_operation_id uuid;
begin
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';if not found then raise exception 'Employee account required';end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;if not found then raise exception 'Employee record not linked';end if;
  if exists(select 1 from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active') then raise exception 'Already clocked in';end if;
  select * into v_project from public.projects where id=p_project_id and company_id=v_profile.company_id and status='active';if not found then raise exception 'Job not available';end if;
  v_dist:=public.carez_distance_ft(p_lat,p_lng,v_project.site_latitude,v_project.site_longitude);v_inside:=case when v_dist is null then null else v_dist<=v_project.geofence_radius_ft end;
  insert into public.employee_shift_sessions(company_id,crew_member_id,employee_profile_id,project_id,work_date,clock_in_at,clock_in_latitude,clock_in_longitude,clock_in_accuracy_m,clock_in_distance_ft,clock_in_inside_geofence,device_label,status,requires_review,review_reasons)
  values(v_profile.company_id,v_crew.id,auth.uid(),v_project.id,v_work_date,now(),p_lat,p_lng,p_accuracy_m,v_dist,v_inside,p_device_label,'active',false,'{}'::text[]) returning id into v_id;

  select count(*),(array_agg(operation_id))[1] into v_operation_count,v_operation_id from(
    select distinct w.work_package_operation_id operation_id
    from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
    where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.project_id=v_project.id and w.schedule_date=v_work_date and w.status<>'cancelled' and w.work_package_operation_id is not null
  )q;

  if v_operation_count=1 and v_operation_id is not null then
    select production_task_id into v_task_id from public.work_package_operations where id=v_operation_id and company_id=v_profile.company_id and status not in ('completed','cancelled');
    if v_task_id is not null then
      insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m,notes)
      values(v_profile.company_id,v_id,v_crew.id,v_project.id,v_task_id,v_operation_id,now(),p_lat,p_lng,p_accuracy_m,'Auto-started from today''s work package');
      update public.work_package_operations set status=case when status='planned' then 'in_progress' else status end,started_at=coalesce(started_at,now()),updated_at=now() where id=v_operation_id and company_id=v_profile.company_id;
      update public.work_packages p set status=case when p.status='planned' then 'active' else p.status end,updated_at=now() where p.id=(select work_package_id from public.work_package_operations where id=v_operation_id);
    end if;
  elsif v_operation_count=0 then
    select count(*),(array_agg(task_id))[1] into v_task_count,v_task_id from(
      select distinct w.production_task_id task_id from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
      where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.project_id=v_project.id and w.schedule_date=v_work_date and w.status<>'cancelled' and w.production_task_id is not null
    )q;
    if v_task_count=1 and v_task_id is not null then
      insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m,notes)
      values(v_profile.company_id,v_id,v_crew.id,v_project.id,v_task_id,now(),p_lat,p_lng,p_accuracy_m,'Auto-started from today''s assigned work');
    end if;
  end if;
  return v_id;
end$$;

create or replace function public.employee_start_work(p_work_package_operation_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy_m numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_shift public.employee_shift_sessions%rowtype;v_operation public.work_package_operations%rowtype;v_package public.work_packages%rowtype;v_id uuid;v_scheduled boolean;
begin
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;if not found then raise exception 'Clock in first';end if;
  if exists(select 1 from public.employee_break_periods where shift_id=v_shift.id and ended_at is null) then raise exception 'End break before starting work';end if;
  select * into v_operation from public.work_package_operations where id=p_work_package_operation_id and company_id=v_shift.company_id and status not in ('completed','cancelled');if not found then raise exception 'This work package is not available';end if;
  select * into v_package from public.work_packages where id=v_operation.work_package_id and company_id=v_shift.company_id and project_id=v_shift.project_id;if not found then raise exception 'This work belongs to a different job';end if;
  select exists(select 1 from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id where a.company_id=v_shift.company_id and a.crew_member_id=v_shift.crew_member_id and w.project_id=v_shift.project_id and w.schedule_date=v_shift.work_date and w.status<>'cancelled' and w.work_package_operation_id=v_operation.id) into v_scheduled;
  if not v_scheduled then raise exception 'This work is not assigned to you today';end if;
  update public.employee_task_segments set ended_at=now() where shift_id=v_shift.id and ended_at is null;
  insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m)
  values(v_shift.company_id,v_shift.id,v_shift.crew_member_id,v_shift.project_id,v_operation.production_task_id,v_operation.id,now(),p_lat,p_lng,p_accuracy_m) returning id into v_id;
  update public.work_package_operations set status=case when status='planned' then 'in_progress' else status end,started_at=coalesce(started_at,now()),updated_at=now() where id=v_operation.id;
  update public.work_packages set status=case when status='planned' then 'active' else status end,updated_at=now() where id=v_package.id;
  return v_id;
end$$;

grant execute on function public.employee_start_work(uuid,double precision,double precision,numeric) to authenticated;

create or replace function public.employee_start_break() returns uuid language plpgsql security definer set search_path=public as $$
declare v_shift public.employee_shift_sessions%rowtype;v_id uuid;v_resume uuid;v_resume_operation uuid;
begin
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' limit 1;if not found then raise exception 'Clock in first';end if;
  if exists(select 1 from public.employee_break_periods where shift_id=v_shift.id and ended_at is null) then raise exception 'Already on break';end if;
  select production_task_id,work_package_operation_id into v_resume,v_resume_operation from public.employee_task_segments where shift_id=v_shift.id and ended_at is null order by started_at desc limit 1;
  update public.employee_task_segments set ended_at=now() where shift_id=v_shift.id and ended_at is null;
  insert into public.employee_break_periods(company_id,shift_id,started_at,resume_production_task_id,resume_work_package_operation_id) values(v_shift.company_id,v_shift.id,now(),v_resume,v_resume_operation) returning id into v_id;
  return v_id;
end$$;

create or replace function public.employee_end_break() returns void language plpgsql security definer set search_path=public as $$
declare v_shift public.employee_shift_sessions%rowtype;v_break public.employee_break_periods%rowtype;v_task public.production_tasks%rowtype;v_operation public.work_package_operations%rowtype;
begin
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' limit 1;if not found then raise exception 'Clock in first';end if;
  select * into v_break from public.employee_break_periods where shift_id=v_shift.id and ended_at is null order by started_at desc limit 1;if not found then raise exception 'No active break';end if;
  update public.employee_break_periods set ended_at=now() where id=v_break.id;
  if v_break.resume_work_package_operation_id is not null then
    select * into v_operation from public.work_package_operations where id=v_break.resume_work_package_operation_id and company_id=v_shift.company_id and status not in ('completed','cancelled');
    if found then insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,work_package_operation_id,started_at,notes) values(v_shift.company_id,v_shift.id,v_shift.crew_member_id,v_shift.project_id,v_operation.production_task_id,v_operation.id,now(),'Auto-resumed after break');return;end if;
  end if;
  if v_break.resume_production_task_id is not null then
    select * into v_task from public.production_tasks where id=v_break.resume_production_task_id and company_id=v_shift.company_id and active=true;
    if found then insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,started_at,notes) values(v_shift.company_id,v_shift.id,v_shift.crew_member_id,v_shift.project_id,v_task.id,now(),'Auto-resumed after break');end if;
  end if;
end$$;

create or replace function public.employee_complete_work_package_operation(p_work_package_operation_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile public.profiles%rowtype;v_crew public.crew_members%rowtype;v_shift public.employee_shift_sessions%rowtype;v_operation public.work_package_operations%rowtype;v_package public.work_packages%rowtype;v_assigned boolean;
begin
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';if not found then raise exception 'Employee account required';end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;if not found then raise exception 'Employee record not linked';end if;
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;if not found then raise exception 'Clock in first';end if;
  select * into v_operation from public.work_package_operations where id=p_work_package_operation_id and company_id=v_shift.company_id and status not in ('completed','cancelled');if not found then raise exception 'This work is already finished or unavailable';end if;
  select * into v_package from public.work_packages where id=v_operation.work_package_id and company_id=v_shift.company_id and project_id=v_shift.project_id;if not found then raise exception 'This work belongs to a different job';end if;
  select exists(select 1 from public.work_schedule_assignments a join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id where a.company_id=v_shift.company_id and a.crew_member_id=v_crew.id and w.work_package_operation_id=v_operation.id and w.status<>'cancelled') into v_assigned;
  if not v_assigned then raise exception 'This work is not assigned to you';end if;
  update public.employee_task_segments set ended_at=now() where shift_id=v_shift.id and work_package_operation_id=v_operation.id and ended_at is null;
  update public.work_package_operations set status='completed',completed_at=now(),completed_by_profile_id=auth.uid(),completed_by_crew_member_id=v_crew.id,completion_source='employee_confirmation',updated_at=now() where id=v_operation.id;
  if not exists(select 1 from public.work_package_operations o where o.work_package_id=v_package.id and o.status not in ('completed','cancelled')) then
    update public.work_packages set status='completed',updated_at=now() where id=v_package.id;
  else
    update public.work_packages set status='active',updated_at=now() where id=v_package.id and status<>'cancelled';
  end if;
  return v_operation.id;
end$$;

grant execute on function public.employee_complete_work_package_operation(uuid) to authenticated;

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
    'active_task',(select jsonb_build_object('id',s.id,'production_task_id',s.production_task_id,'work_package_operation_id',s.work_package_operation_id,'started_at',s.started_at,'task_name',t.name,'unit',t.production_unit,'work_package_name',wp.name,'work_package_location',wp.location,'planned_quantity',wo.planned_quantity,'operation_unit',wo.unit,'operation_status',wo.status) from public.employee_task_segments s join public.production_tasks t on t.id=s.production_task_id left join public.work_package_operations wo on wo.id=s.work_package_operation_id left join public.work_packages wp on wp.id=wo.work_package_id where s.shift_id=v_shift.id and s.ended_at is null limit 1),
    'active_break',(select jsonb_build_object('id',b.id,'started_at',b.started_at,'resume_production_task_id',b.resume_production_task_id,'resume_work_package_operation_id',b.resume_work_package_operation_id) from public.employee_break_periods b where b.shift_id=v_shift.id and b.ended_at is null limit 1),
    'work_tracking',jsonb_build_object('paid_work_minutes',round(v_work/60.0,0),'tracked_task_minutes',round(v_task/60.0,0),'coverage_percent',v_coverage,'needs_attention',v_shift.id is not null and v_work>=1800 and v_coverage<90),
    'today_reports',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'production_task_id',r.production_task_id,'task_name',t.name,'quantity',r.quantity_completed,'unit',r.unit,'review_status',r.review_status) order by t.sort_order),'[]'::jsonb) from public.daily_production_records r join public.production_tasks t on t.id=r.production_task_id where r.company_id=v_profile.company_id and (v_shift.id is null or r.project_id=v_shift.project_id) and r.work_date=coalesce(v_shift.work_date,v_today)),
    'recent',(select coalesce(jsonb_agg(x),'[]'::jsonb) from(select jsonb_build_object('id',s.id,'work_date',s.work_date,'clock_in_at',s.clock_in_at,'clock_out_at',s.clock_out_at,'status',s.status,'task_coverage_percent',s.task_coverage_percent,'requires_review',s.requires_review,'project',p.job_number||' - '||p.name)x from public.employee_shift_sessions s join public.projects p on p.id=s.project_id where s.employee_profile_id=auth.uid() order by s.work_date desc,s.clock_in_at desc limit 7)q)
  );
end$$;

grant execute on function public.employee_portal_state() to authenticated;
