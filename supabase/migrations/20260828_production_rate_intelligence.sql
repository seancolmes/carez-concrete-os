alter table public.timecards add column if not exists production_task_id uuid references public.production_tasks(id) on delete set null;
create index if not exists timecards_production_task_idx on public.timecards(company_id,project_id,work_date,production_task_id) where production_task_id is not null;

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
where l.employee_time_approved and l.man_hours>0;

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

create or replace view public.production_task_rate_summary
with (security_invoker=true)
as
select h.company_id,h.production_task_id,h.task_name,h.unit,count(*)::integer as sample_days,
  min(h.work_date) as first_sample_date,max(h.work_date) as latest_sample_date,
  coalesce(sum(h.quantity_completed),0)::numeric as total_quantity,
  coalesce(sum(h.man_hours),0)::numeric as total_man_hours,
  case when coalesce(sum(h.man_hours),0)>0 then round(sum(h.quantity_completed)/sum(h.man_hours),3) else null end as weighted_units_per_man_hour,
  case when coalesce(sum(h.quantity_completed),0)>0 then round(sum(h.man_hours)/sum(h.quantity_completed),4) else null end as weighted_man_hours_per_unit,
  round(avg(h.units_per_man_hour),3) as average_daily_units_per_man_hour
from public.production_rate_history h
group by h.company_id,h.production_task_id,h.task_name,h.unit;

grant select on public.production_task_rate_summary to authenticated;

create or replace view public.project_production_rate_summary
with (security_invoker=true)
as
select h.company_id,h.project_id,p.job_number,p.name as project_name,h.production_task_id,h.task_name,h.unit,
  count(*)::integer as sample_days,coalesce(sum(h.quantity_completed),0)::numeric as total_quantity,
  coalesce(sum(h.man_hours),0)::numeric as total_man_hours,
  case when coalesce(sum(h.man_hours),0)>0 then round(sum(h.quantity_completed)/sum(h.man_hours),3) else null end as units_per_man_hour,
  case when coalesce(sum(h.quantity_completed),0)>0 then round(sum(h.man_hours)/sum(h.quantity_completed),4) else null end as man_hours_per_unit,
  max(h.work_date) as latest_work_date
from public.production_rate_history h
join public.projects p on p.id=h.project_id and p.company_id=h.company_id
group by h.company_id,h.project_id,p.job_number,p.name,h.production_task_id,h.task_name,h.unit;

grant select on public.project_production_rate_summary to authenticated;
