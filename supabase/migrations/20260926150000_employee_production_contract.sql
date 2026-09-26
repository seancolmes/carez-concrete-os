alter table public.crew_members add column if not exists internal_field_rate numeric(10,2);
alter table public.crew_members add column if not exists is_owner boolean not null default false;
alter table public.crew_members add column if not exists default_risk_class_code text;
alter table public.projects add column if not exists site_latitude numeric(10,7);
alter table public.projects add column if not exists site_longitude numeric(10,7);
alter table public.projects add column if not exists geofence_radius_ft numeric(8,2) not null default 500;

create table public.employee_shift_sessions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null, crew_member_id uuid not null, work_date date not null,
  status text not null default 'active' check(status in ('active','open','submitted','approved','rejected')),
  clock_in_at timestamptz not null default now(), clock_out_at timestamptz,
  clock_in_latitude numeric(10,7),clock_in_longitude numeric(10,7),clock_in_accuracy_m numeric(10,2),clock_in_inside_geofence boolean,clock_in_distance_ft numeric(10,2),
  clock_out_latitude numeric(10,7),clock_out_longitude numeric(10,7),clock_out_accuracy_m numeric(10,2),clock_out_inside_geofence boolean,clock_out_distance_ft numeric(10,2),
  employee_note text,owner_note text,review_reasons text[] not null default '{}',task_coverage_percent numeric(6,2),
  approved_by uuid references public.profiles(id) on delete set null,approved_at timestamptz,approved_timecard_id uuid,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) on delete restrict
);
create unique index employee_shift_one_open on public.employee_shift_sessions(crew_member_id) where status in ('active','open','submitted');

create table public.employee_break_periods (
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null,started_at timestamptz not null default now(),ended_at timestamptz,notes text,created_at timestamptz not null default now(),
  unique(company_id,id),foreign key(company_id,shift_id) references public.employee_shift_sessions(company_id,id) on delete cascade
);

create table public.employee_task_segments (
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null,production_task_id uuid not null,work_package_operation_id uuid,started_at timestamptz not null default now(),ended_at timestamptz,
  start_latitude numeric(10,7),start_longitude numeric(10,7),start_accuracy_m numeric(10,2),end_latitude numeric(10,7),end_longitude numeric(10,7),end_accuracy_m numeric(10,2),notes text,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id),
  foreign key(company_id,shift_id) references public.employee_shift_sessions(company_id,id) on delete cascade,
  foreign key(company_id,production_task_id) references public.production_tasks(company_id,id) on delete restrict,
  foreign key(company_id,work_package_operation_id) references public.work_package_operations(company_id,id) on delete set null
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,project_id uuid not null,log_date date not null,
  weather text,crew_count integer not null default 0,work_completed text not null,concrete_yards numeric(12,2) not null default 0,delays_issues text,notes text,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade
);

create table public.daily_production_records (
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,project_id uuid not null,work_date date not null,production_task_id uuid not null,
  quantity_completed numeric(14,4) not null check(quantity_completed>=0),unit text not null,notes text,source text not null default 'owner',review_status text not null default 'needs_review' check(review_status in ('needs_review','verified','rejected')),verified_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,id),unique(company_id,project_id,work_date,production_task_id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,production_task_id) references public.production_tasks(company_id,id) on delete restrict
);

create index employee_shift_project_idx on public.employee_shift_sessions(company_id,project_id,work_date,status);
create index employee_segments_shift_idx on public.employee_task_segments(company_id,shift_id,started_at);
create index daily_production_project_idx on public.daily_production_records(company_id,project_id,work_date);

create or replace view public.earned_production_rate_history with (security_invoker=true) as
with segment_seconds as (
  select s.company_id,s.id shift_id,sum(extract(epoch from (e.ended_at-e.started_at))) filter(where e.ended_at is not null) total_seconds
  from public.employee_shift_sessions s join public.employee_task_segments e on e.company_id=s.company_id and e.shift_id=s.id group by s.company_id,s.id
), hours as (
  select e.company_id,e.work_package_operation_id,sum(t.hours*extract(epoch from (e.ended_at-e.started_at))/nullif(ss.total_seconds,0))::numeric man_hours
  from public.employee_task_segments e join public.employee_shift_sessions s on s.company_id=e.company_id and s.id=e.shift_id and s.status='approved'
  join public.timecards t on t.company_id=s.company_id and t.source_shift_id=s.id and t.approval_status='approved'
  join segment_seconds ss on ss.company_id=e.company_id and ss.shift_id=e.shift_id where e.work_package_operation_id is not null and e.ended_at is not null
  group by e.company_id,e.work_package_operation_id
)
select o.company_id,o.id operation_id,o.completed_at::date completed_date,o.completed_at,
  p.id project_id,p.job_number,w.name package_name,w.location,o.field_label,t.name task_name,o.production_task_id,
  coalesce(o.actual_quantity,o.planned_quantity) quantity_completed,o.unit,coalesce(h.man_hours,0)::numeric man_hours,
  case when coalesce(h.man_hours,0)>0 then (coalesce(o.actual_quantity,o.planned_quantity)/h.man_hours)::numeric else null end units_per_man_hour,
  case when coalesce(o.actual_quantity,o.planned_quantity)>0 then (coalesce(h.man_hours,0)/coalesce(o.actual_quantity,o.planned_quantity))::numeric else null end man_hours_per_unit,
  o.completion_source
from public.work_package_operations o join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id
join public.projects p on p.company_id=w.company_id and p.id=w.project_id join public.production_tasks t on t.company_id=o.company_id and t.id=o.production_task_id
left join hours h on h.company_id=o.company_id and h.work_package_operation_id=o.id where o.status='completed';

create or replace view public.production_rate_history with (security_invoker=true) as
select r.company_id,r.project_id,r.work_date,r.production_task_id,t.name task_name,r.quantity_completed,r.unit,
  coalesce(sum(tc.hours) filter(where tc.approval_status='approved'),0)::numeric man_hours,
  case when coalesce(sum(tc.hours) filter(where tc.approval_status='approved'),0)>0 then r.quantity_completed/sum(tc.hours) filter(where tc.approval_status='approved') else null end units_per_man_hour,
  case when r.quantity_completed>0 then sum(tc.hours) filter(where tc.approval_status='approved')/r.quantity_completed else null end man_hours_per_unit
from public.daily_production_records r join public.production_tasks t on t.company_id=r.company_id and t.id=r.production_task_id
left join public.timecards tc on tc.company_id=r.company_id and tc.project_id=r.project_id and tc.work_date=r.work_date
where r.review_status='verified' group by r.company_id,r.project_id,r.work_date,r.production_task_id,t.name,r.quantity_completed,r.unit;

create or replace view public.carez_production_learning_summary with (security_invoker=true) as
select e.company_id,e.production_task_id,e.task_name,e.unit,count(*)::integer sample_packages,count(distinct e.project_id)::integer sample_projects,
  sum(e.quantity_completed)::numeric total_quantity,sum(e.man_hours)::numeric total_man_hours,
  case when sum(e.man_hours)>0 then sum(e.quantity_completed)/sum(e.man_hours) else null end weighted_units_per_man_hour,
  case when sum(e.quantity_completed)>0 then sum(e.man_hours)/sum(e.quantity_completed) else null end weighted_man_hours_per_unit,
  case when count(*)>=5 then 'high' when count(*)>=2 then 'medium' else 'low' end confidence
from public.earned_production_rate_history e group by e.company_id,e.production_task_id,e.task_name,e.unit;

create or replace view public.production_operation_risk with (security_invoker=true) as
with tracked as (
  select e.company_id,e.operation_id work_package_operation_id,sum(e.man_hours)::numeric tracked_man_hours
  from public.earned_production_rate_history e group by e.company_id,e.operation_id
)
select p.company_id,p.operation_id,p.project_id,p.work_package_id,p.job_number,p.project_name,p.package_name,p.location,p.field_label,p.task_name,p.planned_quantity,p.unit,p.operation_status,p.sequence,p.measurement_method,p.budgeted_man_hours,
  coalesce(t.tracked_man_hours,0)::numeric tracked_man_hours,coalesce(t.tracked_man_hours,0)::numeric approved_man_hours,
  case when p.budgeted_man_hours is null or p.budgeted_man_hours=0 then null else round(100*coalesce(t.tracked_man_hours,0)/p.budgeted_man_hours,2) end budget_hours_used_percent,
  case when p.budgeted_man_hours is null then null else p.budgeted_man_hours-coalesce(t.tracked_man_hours,0) end budget_man_hours_remaining,
  case when p.budgeted_man_hours is null then null else greatest(coalesce(t.tracked_man_hours,0)-p.budgeted_man_hours,0) end over_budget_man_hours,
  case when p.budgeted_man_hours is null then 'no_budget' when coalesce(t.tracked_man_hours,0)>=p.budgeted_man_hours then 'over_budget' when coalesce(t.tracked_man_hours,0)>=p.budgeted_man_hours*.8 then 'watch' else 'on_track' end labor_risk,
  case when p.budgeted_man_hours is not null and coalesce(t.tracked_man_hours,0)>=p.budgeted_man_hours*.8 then true else false end needs_attention,
  null::text schedule_risk
from public.work_package_operation_progress p left join tracked t on t.company_id=p.company_id and t.work_package_operation_id=p.operation_id;

create or replace view public.production_work_queue with (security_invoker=true) as
select r.company_id,r.project_id,r.work_date,r.production_task_id,p.job_number,t.name task_name,r.unit,r.quantity_completed,coalesce(sum(tc.hours) filter(where tc.approval_status='approved'),0)::numeric tracked_man_hours,
  case when r.review_status='needs_review' then 'needs_report_review' else 'verified' end production_status
from public.daily_production_records r join public.projects p on p.company_id=r.company_id and p.id=r.project_id join public.production_tasks t on t.company_id=r.company_id and t.id=r.production_task_id
left join public.timecards tc on tc.company_id=r.company_id and tc.project_id=r.project_id and tc.work_date=r.work_date group by r.company_id,r.project_id,r.work_date,r.production_task_id,p.job_number,t.name,r.unit,r.quantity_completed,r.review_status;

create or replace function public.employee_portal_state()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_user uuid:=auth.uid();v_company uuid;v_crew uuid;v_shift jsonb;v_task jsonb;v_break jsonb;v_projects jsonb;v_tasks jsonb;v_schedule jsonb;v_recent jsonb;
begin
  select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=v_user and p.role='employee' and c.active;
  if v_company is null then raise exception 'Employee profile is not linked to an active crew member.'; end if;
  select to_jsonb(s) into v_shift from public.employee_shift_sessions s where s.company_id=v_company and s.crew_member_id=v_crew and s.status in ('active','open') order by s.clock_in_at desc limit 1;
  select to_jsonb(x) into v_task from (select e.id,e.production_task_id,e.work_package_operation_id,e.started_at,t.name task_name,w.name work_package_name,w.location work_package_location,o.planned_quantity,o.unit operation_unit,o.measurement_method
    from public.employee_task_segments e join public.employee_shift_sessions s on s.company_id=e.company_id and s.id=e.shift_id and s.status in ('active','open') join public.production_tasks t on t.company_id=e.company_id and t.id=e.production_task_id left join public.work_package_operations o on o.company_id=e.company_id and o.id=e.work_package_operation_id left join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id where e.company_id=v_company and s.crew_member_id=v_crew and e.ended_at is null order by e.started_at desc limit 1) x;
  select to_jsonb(b) into v_break from public.employee_break_periods b join public.employee_shift_sessions s on s.company_id=b.company_id and s.id=b.shift_id where b.company_id=v_company and s.crew_member_id=v_crew and b.ended_at is null limit 1;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_projects from (select p.id,p.job_number,p.name,p.address,p.city from public.projects p where p.company_id=v_company and p.status in ('active','on_hold')) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) into v_tasks from (select t.id,t.name,t.production_unit,t.category,t.sort_order from public.production_tasks t where t.company_id=v_company and t.active) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.schedule_date,x.start_time),'[]'::jsonb) into v_schedule from (select s.id,s.project_id,s.schedule_date,s.start_time,s.title,s.status,p.job_number,p.name project_name,o.id work_package_operation_id,w.name work_package_name,w.location work_package_location,t.name task_name,o.planned_quantity,o.unit operation_unit,o.measurement_method,r.ready_to_start,r.next_action readiness_action from public.work_schedule_items s join public.projects p on p.company_id=s.company_id and p.id=s.project_id left join public.work_package_operations o on o.company_id=s.company_id and o.id=s.work_package_operation_id left join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id left join public.production_tasks t on t.company_id=s.company_id and t.id=coalesce(o.production_task_id,s.production_task_id) left join public.work_package_operation_readiness r on r.company_id=s.company_id and r.operation_id=o.id join public.work_schedule_assignments a on a.company_id=s.company_id and a.schedule_item_id=s.id and a.crew_member_id=v_crew where s.company_id=v_company and s.status<>'cancelled') x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.work_date desc),'[]'::jsonb) into v_recent from (select s.id,s.work_date,s.clock_in_at,s.clock_out_at,s.status,p.name project,s.task_coverage_percent requires_review from public.employee_shift_sessions s join public.projects p on p.company_id=s.company_id and p.id=s.project_id where s.company_id=v_company and s.crew_member_id=v_crew and s.status in ('submitted','approved') order by s.work_date desc limit 20) x;
  return jsonb_build_object('employee',jsonb_build_object('id',v_crew,'name',(select name from public.crew_members where id=v_crew),'role','employee','can_report_production',true),'projects',v_projects,'tasks',v_tasks,'assigned_schedule',v_schedule,'suggested_tasks',v_schedule,'active_shift',v_shift,'active_task',v_task,'active_break',v_break,'work_tracking',jsonb_build_object(),'today_reports','[]'::jsonb,'recent',v_recent);
end; $$;

create or replace function public.employee_clock_in(p_project_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric,p_device_label text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_project public.projects%rowtype;v_inside boolean;v_distance numeric;v_id uuid;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select * into v_project from public.projects where company_id=v_company and id=p_project_id;
 if v_project.id is null then raise exception 'Job not found.'; end if;
 if v_project.site_latitude is not null and v_project.site_longitude is not null then v_distance:=sqrt(power((p_lat-v_project.site_latitude)*364000,2)+power((p_lng-v_project.site_longitude)*cos(radians(v_project.site_latitude))*288200,2));v_inside:=v_distance<=coalesce(v_project.geofence_radius_ft,500);end if;
 insert into public.employee_shift_sessions(company_id,project_id,crew_member_id,work_date,status,clock_in_at,clock_in_latitude,clock_in_longitude,clock_in_accuracy_m,clock_in_inside_geofence,clock_in_distance_ft)
 values(v_company,p_project_id,v_crew,current_date,'active',now(),p_lat,p_lng,p_accuracy_m,v_inside,v_distance) returning id into v_id;
 return jsonb_build_object('shift_id',v_id);
end; $$;

create or replace function public.employee_clock_out(p_lat numeric,p_lng numeric,p_accuracy_m numeric,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift public.employee_shift_sessions%rowtype;v_project public.projects%rowtype;v_distance numeric;v_inside boolean;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select * into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 if v_shift.id is null then raise exception 'No active shift.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift.id and ended_at is null) then raise exception 'End your break before clocking out.'; end if;
 select * into v_project from public.projects where company_id=v_company and id=v_shift.project_id;
 if v_project.site_latitude is not null and v_project.site_longitude is not null then v_distance:=sqrt(power((p_lat-v_project.site_latitude)*364000,2)+power((p_lng-v_project.site_longitude)*cos(radians(v_project.site_latitude))*288200,2));v_inside:=v_distance<=coalesce(v_project.geofence_radius_ft,500);end if;
 update public.employee_task_segments set ended_at=now(),end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=now() where company_id=v_company and shift_id=v_shift.id and ended_at is null;
 update public.employee_shift_sessions set status='submitted',clock_out_at=now(),clock_out_latitude=p_lat,clock_out_longitude=p_lng,clock_out_accuracy_m=p_accuracy_m,clock_out_inside_geofence=v_inside,clock_out_distance_ft=v_distance,employee_note=p_note,updated_at=now() where id=v_shift.id;
 return jsonb_build_object('shift_id',v_shift.id,'status','submitted');
end; $$;

create or replace function public.employee_start_task(p_task_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_id uuid;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1;
 if v_shift is null or not exists(select 1 from public.production_tasks where company_id=v_company and id=p_task_id and active) then raise exception 'Active shift or work type not found.'; end if;
 update public.employee_task_segments set ended_at=now(),end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=now() where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,p_task_id,now(),p_lat,p_lng,p_accuracy_m) returning id into v_id;
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.employee_start_work(p_work_package_operation_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;v_id uuid;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select * into v_op from public.work_package_operations where company_id=v_company and id=p_work_package_operation_id;
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1;
 if v_op.id is null or v_shift is null then raise exception 'Work operation or active shift not found.'; end if;
 if not exists(select 1 from public.work_package_operation_readiness where company_id=v_company and operation_id=v_op.id and ready_to_start) then raise exception 'Work is not ready to start.'; end if;
 update public.employee_task_segments set ended_at=now(),end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=now() where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,v_op.production_task_id,v_op.id,now(),p_lat,p_lng,p_accuracy_m) returning id into v_id;
 update public.work_package_operations set status='in_progress',updated_at=now() where company_id=v_company and id=v_op.id and status='planned';
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.employee_start_break() returns void language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$ declare v_company uuid;v_crew uuid;v_shift uuid;begin select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1;if v_shift is null then raise exception 'No active shift.';end if;if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'Break already active.';end if;update public.employee_task_segments set ended_at=now(),updated_at=now() where company_id=v_company and shift_id=v_shift and ended_at is null;insert into public.employee_break_periods(company_id,shift_id) values(v_company,v_shift);end; $$;
create or replace function public.employee_end_break() returns void language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$ declare v_company uuid;v_crew uuid;begin select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;update public.employee_break_periods b set ended_at=now() from public.employee_shift_sessions s where b.company_id=v_company and b.shift_id=s.id and s.crew_member_id=v_crew and s.status in ('active','open') and b.ended_at is null;end; $$;

create or replace function public.employee_complete_work_package_operation(p_work_package_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select * into v_op from public.work_package_operations where company_id=v_company and id=p_work_package_operation_id for update;
 select s.id into v_shift from public.employee_shift_sessions s join public.employee_task_segments e on e.company_id=s.company_id and e.shift_id=s.id where s.company_id=v_company and s.crew_member_id=v_crew and s.status in ('active','open') and e.work_package_operation_id=v_op.id and e.ended_at is null limit 1;
 if v_op.id is null or v_shift is null then raise exception 'This operation is not your active work.'; end if;
 if v_op.measurement_method='ticket' then raise exception 'Ticket-tracked production closes from pour evidence.'; end if;
 update public.employee_task_segments set ended_at=now(),updated_at=now() where company_id=v_company and shift_id=v_shift and work_package_operation_id=v_op.id and ended_at is null;
 update public.work_package_operations set status='completed',completed_at=now(),completed_by_crew_member_id=v_crew,completion_source='employee_confirmation',actual_quantity=coalesce(actual_quantity,planned_quantity),actual_quantity_source=coalesce(actual_quantity_source,'completion'),updated_at=now() where company_id=v_company and id=v_op.id;
 return jsonb_build_object('operation_id',v_op.id,'quantity_completed',coalesce(v_op.actual_quantity,v_op.planned_quantity));
end; $$;

alter table public.employee_shift_sessions enable row level security;alter table public.employee_break_periods enable row level security;alter table public.employee_task_segments enable row level security;alter table public.daily_logs enable row level security;alter table public.daily_production_records enable row level security;
create policy employee_shift_owner_office on public.employee_shift_sessions for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy employee_break_owner_office on public.employee_break_periods for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy employee_segment_owner_office on public.employee_task_segments for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy daily_log_owner_office on public.daily_logs for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy daily_production_owner_office on public.daily_production_records for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.employee_shift_sessions,public.employee_break_periods,public.employee_task_segments,public.daily_logs,public.daily_production_records from public,anon;
grant select,update on public.employee_shift_sessions to authenticated;
grant select,update on public.employee_break_periods to authenticated;
grant select on public.employee_task_segments to authenticated;
grant select,insert,update,delete on public.daily_logs,public.daily_production_records to authenticated;
revoke insert,delete on public.employee_shift_sessions,public.employee_break_periods,public.employee_task_segments from authenticated;
revoke all on public.earned_production_rate_history,public.production_rate_history,public.carez_production_learning_summary,public.production_operation_risk,public.production_work_queue from public,anon,authenticated;
grant select on public.earned_production_rate_history,public.production_rate_history,public.carez_production_learning_summary,public.production_operation_risk,public.production_work_queue to authenticated;
revoke all on function public.employee_portal_state(),public.employee_clock_in(uuid,numeric,numeric,numeric,text),public.employee_clock_out(numeric,numeric,numeric,text),public.employee_start_task(uuid,numeric,numeric,numeric),public.employee_start_work(uuid,numeric,numeric,numeric),public.employee_start_break(),public.employee_end_break(),public.employee_complete_work_package_operation(uuid) from public,anon;
grant execute on function public.employee_portal_state(),public.employee_clock_in(uuid,numeric,numeric,numeric,text),public.employee_clock_out(numeric,numeric,numeric,text),public.employee_start_task(uuid,numeric,numeric,numeric),public.employee_start_work(uuid,numeric,numeric,numeric),public.employee_start_break(),public.employee_end_break(),public.employee_complete_work_package_operation(uuid) to authenticated;

create trigger employee_shift_updated_at before update on public.employee_shift_sessions for each row execute function public.set_updated_at();
create trigger employee_segment_updated_at before update on public.employee_task_segments for each row execute function public.set_updated_at();
create trigger daily_log_updated_at before update on public.daily_logs for each row execute function public.set_updated_at();
create trigger daily_production_updated_at before update on public.daily_production_records for each row execute function public.set_updated_at();

comment on table public.employee_shift_sessions is 'GPS-captured employee work session; approval creates immutable labor cost evidence.';
comment on view public.earned_production_rate_history is 'Derived production samples from completed operation quantity and approved, segment-linked crew hours.';
