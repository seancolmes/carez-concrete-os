-- Keep unverified field exceptions out of measured production rates and prevent
-- a field report from overwriting a quantity the office already verified.

create or replace view public.production_rate_history
with (security_invoker=true)
as
with employee_hours as (
  select s.company_id,s.project_id,(s.started_at at time zone 'America/Los_Angeles')::date as work_date,s.production_task_id,
    round(sum(extract(epoch from (s.ended_at-s.started_at)))/3600.0,4) as employee_man_hours,
    bool_and(sh.status='approved') as employee_time_approved
  from public.employee_task_segments s
  join public.employee_shift_sessions sh on sh.id=s.shift_id and sh.company_id=s.company_id
  where s.ended_at is not null and sh.status in ('active','submitted','approved')
  group by s.company_id,s.project_id,(s.started_at at time zone 'America/Los_Angeles')::date,s.production_task_id
),
manual_hours as (
  select tc.company_id,tc.project_id,tc.work_date,tc.production_task_id,round(sum(tc.hours),4) as manual_man_hours
  from public.timecards tc
  where tc.source_shift_id is null and tc.production_task_id is not null and tc.hours>0
  group by tc.company_id,tc.project_id,tc.work_date,tc.production_task_id
),
labor_keys as (
  select company_id,project_id,work_date,production_task_id from employee_hours
  union
  select company_id,project_id,work_date,production_task_id from manual_hours
),
labor as (
  select k.company_id,k.project_id,k.work_date,k.production_task_id,
    coalesce(e.employee_man_hours,0)::numeric as employee_man_hours,
    coalesce(m.manual_man_hours,0)::numeric as manual_man_hours,
    (coalesce(e.employee_man_hours,0)+coalesce(m.manual_man_hours,0))::numeric as man_hours,
    case when e.production_task_id is null then true else e.employee_time_approved end as employee_time_approved
  from labor_keys k
  left join employee_hours e on e.company_id=k.company_id and e.project_id=k.project_id and e.work_date=k.work_date and e.production_task_id=k.production_task_id
  left join manual_hours m on m.company_id=k.company_id and m.project_id=k.project_id and m.work_date=k.work_date and m.production_task_id=k.production_task_id
)
select r.company_id,r.project_id,r.work_date,r.production_task_id,t.name as task_name,r.quantity_completed,r.unit,
  round(l.man_hours,2) as man_hours,
  case when l.man_hours>0 then round(r.quantity_completed/l.man_hours,3) else null end as units_per_man_hour,
  case when r.quantity_completed>0 then round(l.man_hours/r.quantity_completed,4) else null end as man_hours_per_unit,
  round(l.employee_man_hours,2) as employee_man_hours,round(l.manual_man_hours,2) as manual_man_hours
from public.daily_production_records r
join public.production_tasks t on t.id=r.production_task_id and t.company_id=r.company_id
join labor l on l.company_id=r.company_id and l.project_id=r.project_id and l.work_date=r.work_date and l.production_task_id=r.production_task_id
where l.employee_time_approved and l.man_hours>0 and coalesce(r.review_status,'verified')<>'needs_review';

grant select on public.production_rate_history to authenticated;

create or replace view public.production_work_queue
with (security_invoker=true)
as
with employee_hours as (
  select s.company_id,s.project_id,(s.started_at at time zone 'America/Los_Angeles')::date as work_date,s.production_task_id,
    round(sum(extract(epoch from (s.ended_at-s.started_at)))/3600.0,2) as employee_man_hours,
    count(distinct s.crew_member_id)::integer as employee_count,
    bool_and(sh.status='approved') as employee_time_approved
  from public.employee_task_segments s
  join public.employee_shift_sessions sh on sh.id=s.shift_id and sh.company_id=s.company_id
  where s.ended_at is not null and sh.status in ('active','submitted','approved')
  group by s.company_id,s.project_id,(s.started_at at time zone 'America/Los_Angeles')::date,s.production_task_id
),
manual_hours as (
  select tc.company_id,tc.project_id,tc.work_date,tc.production_task_id,
    round(sum(tc.hours),2) as manual_man_hours,count(distinct tc.crew_member_id)::integer as manual_worker_count
  from public.timecards tc
  where tc.source_shift_id is null and tc.production_task_id is not null and tc.hours>0
  group by tc.company_id,tc.project_id,tc.work_date,tc.production_task_id
),
keys as (
  select company_id,project_id,work_date,production_task_id from employee_hours
  union select company_id,project_id,work_date,production_task_id from manual_hours
  union select company_id,project_id,work_date,production_task_id from public.daily_production_records
)
select k.company_id,k.project_id,p.job_number,p.name as project_name,k.work_date,k.production_task_id,
  t.name as task_name,t.category,t.production_unit as unit,
  coalesce(e.employee_man_hours,0)::numeric as employee_man_hours,
  coalesce(m.manual_man_hours,0)::numeric as manual_man_hours,
  (coalesce(e.employee_man_hours,0)+coalesce(m.manual_man_hours,0))::numeric as tracked_man_hours,
  coalesce(e.employee_count,0)::integer as employee_count,
  coalesce(m.manual_worker_count,0)::integer as manual_worker_count,
  case when e.production_task_id is null then true else e.employee_time_approved end as employee_time_approved,
  r.id as production_record_id,r.quantity_completed,r.notes as production_note,r.verified_by,
  h.units_per_man_hour,h.man_hours_per_unit,
  case when r.id is null then 'needs_quantity'
       when r.review_status='needs_review' then 'needs_report_review'
       when e.production_task_id is not null and not e.employee_time_approved then 'waiting_time_approval'
       when coalesce(e.employee_man_hours,0)+coalesce(m.manual_man_hours,0)<=0 then 'quantity_no_task_time'
       else 'rate_ready' end as production_status
from keys k
join public.projects p on p.id=k.project_id and p.company_id=k.company_id
join public.production_tasks t on t.id=k.production_task_id and t.company_id=k.company_id
left join employee_hours e on e.company_id=k.company_id and e.project_id=k.project_id and e.work_date=k.work_date and e.production_task_id=k.production_task_id
left join manual_hours m on m.company_id=k.company_id and m.project_id=k.project_id and m.work_date=k.work_date and m.production_task_id=k.production_task_id
left join public.daily_production_records r on r.company_id=k.company_id and r.project_id=k.project_id and r.work_date=k.work_date and r.production_task_id=k.production_task_id
left join public.production_rate_history h on h.company_id=k.company_id and h.project_id=k.project_id and h.work_date=k.work_date and h.production_task_id=k.production_task_id;

grant select on public.production_work_queue to authenticated;

create or replace function public.employee_report_production(
  p_task_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_crew public.crew_members%rowtype;
  v_shift public.employee_shift_sessions%rowtype;
  v_task public.production_tasks%rowtype;
  v_existing public.daily_production_records%rowtype;
  v_record uuid;
  v_related boolean;
  v_review text := 'auto';
begin
  if p_quantity is null or p_quantity<0 then raise exception 'Enter a valid quantity'; end if;
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';
  if not found then raise exception 'Employee account required'; end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;
  if not found or not v_crew.can_report_production then raise exception 'Production reporting is not enabled for this employee'; end if;
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;
  if not found then raise exception 'Clock in before reporting crew production'; end if;
  select * into v_task from public.production_tasks where id=p_task_id and company_id=v_shift.company_id and active=true;
  if not found then raise exception 'Task not available'; end if;

  select * into v_existing from public.daily_production_records
  where company_id=v_shift.company_id and project_id=v_shift.project_id and work_date=v_shift.work_date and production_task_id=p_task_id;
  if found and v_existing.review_status='verified' and v_existing.source='owner' then
    raise exception 'The office already verified this production quantity';
  end if;

  select (
    exists(select 1 from public.employee_task_segments s where s.shift_id=v_shift.id and s.production_task_id=p_task_id)
    or exists(
      select 1 from public.work_schedule_assignments a
      join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
      where a.company_id=v_shift.company_id and a.crew_member_id=v_shift.crew_member_id
        and w.project_id=v_shift.project_id and w.schedule_date=v_shift.work_date
        and w.status<>'cancelled' and w.production_task_id=p_task_id
    )
  ) into v_related;
  if not v_related then v_review:='needs_review'; end if;

  insert into public.daily_production_records(
    company_id,project_id,work_date,production_task_id,quantity_completed,unit,notes,
    verified_by,reported_by_crew_member_id,reported_by_profile_id,source,review_status,reported_at,updated_at
  ) values(
    v_shift.company_id,v_shift.project_id,v_shift.work_date,v_task.id,p_quantity,v_task.production_unit,
    nullif(trim(p_note),''),null,v_crew.id,auth.uid(),'employee_lead',v_review,now(),now()
  )
  on conflict(project_id,work_date,production_task_id) do update set
    quantity_completed=excluded.quantity_completed,unit=excluded.unit,notes=excluded.notes,
    verified_by=null,reported_by_crew_member_id=excluded.reported_by_crew_member_id,
    reported_by_profile_id=excluded.reported_by_profile_id,source=excluded.source,
    review_status=excluded.review_status,reported_at=excluded.reported_at,updated_at=now()
  returning id into v_record;
  return v_record;
end;
$$;

grant execute on function public.employee_report_production(uuid,numeric,text) to authenticated;
