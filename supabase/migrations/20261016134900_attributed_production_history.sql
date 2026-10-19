-- Preserve verified daily quantity samples. Reuse the existing earned-history
-- approved-hour/closed-segment ratio; whole shifts must not repeat per task.
create or replace view public.production_rate_history with(security_invoker=true) as
with segment_seconds as (
 select e.company_id,e.shift_id,
  sum(extract(epoch from(e.ended_at-e.started_at)))::numeric total_seconds,
  bool_and(e.ended_at is not null and e.ended_at>e.started_at) valid
 from public.employee_task_segments e group by e.company_id,e.shift_id
),task_labor as (
 select tc.company_id,tc.project_id,tc.work_date,e.production_task_id,
  case when bool_and(ss.valid and ss.total_seconds>0 and tc.hours is not null
   and tc.hours::text not in ('NaN','Infinity','-Infinity') and tc.hours>=0)
   then sum(tc.hours*extract(epoch from(e.ended_at-e.started_at))/nullif(ss.total_seconds,0))::numeric end man_hours
 from public.employee_task_segments e
 join public.employee_shift_sessions s on s.company_id=e.company_id and s.id=e.shift_id and s.status='approved'
 join public.timecards tc on tc.company_id=s.company_id and tc.source_shift_id=s.id and tc.approval_status='approved'
 join segment_seconds ss on ss.company_id=e.company_id and ss.shift_id=e.shift_id
 group by tc.company_id,tc.project_id,tc.work_date,e.production_task_id
),manual_labor as (
 -- Preserve approved historical manual attribution by recorded task ID. A
 -- free-text work label is never an assignment to a production task.
 select tc.company_id,tc.project_id,tc.work_date,tc.production_task_id,
  case when bool_and(tc.hours is not null and tc.hours>0 and tc.hours::text not in ('NaN','Infinity','-Infinity'))
   then sum(tc.hours)::numeric end man_hours
 from public.timecards tc
 where tc.source_shift_id is null and tc.production_task_id is not null and tc.approval_status='approved'
 group by tc.company_id,tc.project_id,tc.work_date,tc.production_task_id
),labor_keys as (
 select company_id,project_id,work_date,production_task_id from task_labor
 union select company_id,project_id,work_date,production_task_id from manual_labor
),labor as (
 select k.*,
  case when e.company_id is not null and e.man_hours is null or m.company_id is not null and m.man_hours is null then null
   else coalesce(e.man_hours,0)+coalesce(m.man_hours,0) end man_hours,
  case when e.company_id is null then 0 else e.man_hours end employee_man_hours,
  case when m.company_id is null then 0 else m.man_hours end manual_man_hours
 from labor_keys k
 left join task_labor e using(company_id,project_id,work_date,production_task_id)
 left join manual_labor m using(company_id,project_id,work_date,production_task_id)
)
select r.company_id,r.project_id,r.work_date,r.production_task_id,t.name task_name,
 r.quantity_completed,r.unit,round(h.man_hours,2) man_hours,
 case when h.man_hours>0 then round(r.quantity_completed/h.man_hours,3) end units_per_man_hour,
 case when r.quantity_completed>0 then round(h.man_hours/r.quantity_completed,4) end man_hours_per_unit,
 round(h.employee_man_hours,2) employee_man_hours,round(h.manual_man_hours,2) manual_man_hours
from public.daily_production_records r
join public.production_tasks t on t.company_id=r.company_id and t.id=r.production_task_id
left join labor h on h.company_id=r.company_id and h.project_id=r.project_id
 and h.work_date=r.work_date and h.production_task_id=r.production_task_id
where r.review_status='verified';
