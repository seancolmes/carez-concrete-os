-- Versioned employee RPC names avoid legacy float8/numeric overloads and return-type conflicts.
alter table public.employee_shift_sessions add column if not exists employee_profile_id uuid references public.profiles(id);
-- Serialize employee transitions. Do not clear readiness gates or infer GPS presence.
create or replace function public.carez_validate_clock_coordinates(p_lat numeric,p_lng numeric,p_accuracy numeric)
returns void language plpgsql immutable set search_path=pg_catalog as $$ begin
 if (p_lat is null) <> (p_lng is null) or (p_lat is not null and (p_lat::text in ('NaN','Infinity','-Infinity') or p_lat not between -90 and 90))
 or (p_lng is not null and (p_lng::text in ('NaN','Infinity','-Infinity') or p_lng not between -180 and 180))
 or (p_accuracy is not null and (p_accuracy::text in ('NaN','Infinity','-Infinity') or p_accuracy<0)) then raise exception 'Invalid supplied clock coordinates.'; end if;
end $$;
revoke all on function public.carez_validate_clock_coordinates(numeric,numeric,numeric) from public,anon;
grant execute on function public.carez_validate_clock_coordinates(numeric,numeric,numeric) to authenticated;
-- Fail migration on pre-existing duplicates; never merge or discard recorded work.
create unique index employee_one_open_segment on public.employee_task_segments(company_id,shift_id) where ended_at is null;
create unique index employee_one_open_break on public.employee_break_periods(company_id,shift_id) where ended_at is null;
create unique index timecard_one_source_shift on public.timecards(company_id,source_shift_id) where source_shift_id is not null;
create or replace function public.carez_employee_clock_in_v2(p_project_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric,p_device_label text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_project public.projects%rowtype;v_inside boolean;v_distance numeric;v_id uuid;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 select * into v_project from public.projects where company_id=v_company and id=p_project_id;
 if v_project.id is null or v_project.status <> 'active' then raise exception 'Active job not found.'; end if;
 if v_project.site_latitude is not null and v_project.site_longitude is not null then v_distance:=sqrt(power((p_lat-v_project.site_latitude)*364000,2)+power((p_lng-v_project.site_longitude)*cos(radians(v_project.site_latitude))*288200,2));v_inside:=v_distance<=coalesce(v_project.geofence_radius_ft,500);end if;
 insert into public.employee_shift_sessions(company_id,project_id,crew_member_id,employee_profile_id,work_date,status,clock_in_at,clock_in_latitude,clock_in_longitude,clock_in_accuracy_m,clock_in_inside_geofence,clock_in_distance_ft)
 values(v_company,p_project_id,v_crew,auth.uid(),current_date,'active',now(),p_lat,p_lng,p_accuracy_m,v_inside,v_distance) returning id into v_id;
 return jsonb_build_object('shift_id',v_id);
end; $$;

create or replace function public.carez_employee_clock_out_v2(p_lat numeric,p_lng numeric,p_accuracy_m numeric,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift public.employee_shift_sessions%rowtype;v_project public.projects%rowtype;v_distance numeric;v_inside boolean;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 select * into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 if v_shift.id is null then raise exception 'No active shift.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift.id and ended_at is null) then raise exception 'End your break before clocking out.'; end if;
 select * into v_project from public.projects where company_id=v_company and id=v_shift.project_id;
 if v_project.site_latitude is not null and v_project.site_longitude is not null then v_distance:=sqrt(power((p_lat-v_project.site_latitude)*364000,2)+power((p_lng-v_project.site_longitude)*cos(radians(v_project.site_latitude))*288200,2));v_inside:=v_distance<=coalesce(v_project.geofence_radius_ft,500);end if;
 update public.employee_task_segments set ended_at=now(),end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=now() where company_id=v_company and shift_id=v_shift.id and ended_at is null;
 update public.employee_shift_sessions set status='submitted',clock_out_at=now(),clock_out_latitude=p_lat,clock_out_longitude=p_lng,clock_out_accuracy_m=p_accuracy_m,clock_out_inside_geofence=v_inside,clock_out_distance_ft=v_distance,employee_note=p_note,updated_at=now() where id=v_shift.id;
 return jsonb_build_object('shift_id',v_shift.id,'status','submitted');
end; $$;

create or replace function public.carez_employee_start_task_v2(p_task_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_id uuid;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 if v_shift is null or not exists(select 1 from public.production_tasks where company_id=v_company and id=p_task_id and active) then raise exception 'Active shift or work type not found.'; end if;
 if not exists(select 1 from public.employee_shift_sessions s join public.projects p on p.company_id=s.company_id and p.id=s.project_id where s.id=v_shift and s.company_id=v_company and p.status='active') then raise exception 'Active job is required before starting work.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'End your break before starting work.'; end if;
 if not exists(select 1 from public.project_job_readiness_summary r join public.employee_shift_sessions s on s.company_id=r.company_id and s.project_id=r.project_id where s.id=v_shift and r.company_id=v_company and r.job_ready) then raise exception 'Job setup is not ready for physical work.'; end if;
 select id into v_id from public.employee_task_segments where company_id=v_company and shift_id=v_shift and ended_at is null and production_task_id=p_task_id and work_package_operation_id is null;
 if v_id is not null then return jsonb_build_object('segment_id',v_id); end if;
 update public.employee_task_segments set ended_at=now(),end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=now() where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,p_task_id,now(),p_lat,p_lng,p_accuracy_m) returning id into v_id;
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.carez_employee_start_work_v2(p_work_package_operation_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;v_id uuid;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select * into v_op from public.work_package_operations where company_id=v_company and id=p_work_package_operation_id;
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 if v_op.id is null or v_shift is null or not exists(select 1 from public.production_tasks where company_id=v_company and id=v_op.production_task_id and active) then raise exception 'Active work operation or shift not found.'; end if;
 if not exists(select 1 from public.work_packages w join public.employee_shift_sessions s on s.project_id=w.project_id and s.company_id=w.company_id where w.id=v_op.work_package_id and w.company_id=v_company and s.id=v_shift) then raise exception 'Operation does not belong to the active job.'; end if;
 if not exists(select 1 from public.work_package_operation_readiness where company_id=v_company and operation_id=v_op.id and ready_to_start) then raise exception 'Work is not ready to start.'; end if;
 if not exists(select 1 from public.employee_shift_sessions s join public.projects p on p.company_id=s.company_id and p.id=s.project_id where s.id=v_shift and s.company_id=v_company and p.status='active') then raise exception 'Active job is required before starting work.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'End your break before starting work.'; end if;
 if not exists(select 1 from public.project_job_readiness_summary r join public.employee_shift_sessions s on s.company_id=r.company_id and s.project_id=r.project_id where s.id=v_shift and r.company_id=v_company and r.job_ready) then raise exception 'Job setup is not ready for physical work.'; end if;
 select id into v_id from public.employee_task_segments where company_id=v_company and shift_id=v_shift and ended_at is null and work_package_operation_id=v_op.id;
 if v_id is not null then return jsonb_build_object('segment_id',v_id); end if;
 update public.employee_task_segments set ended_at=now(),end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=now() where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,v_op.production_task_id,v_op.id,now(),p_lat,p_lng,p_accuracy_m) returning id into v_id;
 update public.work_package_operations set status='in_progress',updated_at=now() where company_id=v_company and id=v_op.id and status='planned';
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.carez_employee_start_break_v2() returns void language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$ declare v_company uuid;v_crew uuid;v_shift uuid;begin select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;if v_shift is null then raise exception 'No active shift.';end if;if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'Break already active.';end if;update public.employee_task_segments set ended_at=now(),updated_at=now() where company_id=v_company and shift_id=v_shift and ended_at is null;insert into public.employee_break_periods(company_id,shift_id) values(v_company,v_shift);end; $$;
create or replace function public.carez_employee_end_break_v2() returns void language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$ declare v_company uuid;v_crew uuid;begin select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;perform 1 from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') for update;update public.employee_break_periods b set ended_at=now() from public.employee_shift_sessions s where b.company_id=v_company and b.shift_id=s.id and s.crew_member_id=v_crew and s.status in ('active','open') and b.ended_at is null;end; $$;

-- Owner internal-cost approval only. Statutory payroll is excluded until its
-- tax/cap contracts are source-controlled and independently qualified.
create or replace function public.carez_approve_owner_shift(p_shift_id uuid,p_regular_hours numeric,p_overtime_hours numeric,p_note text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id();v_shift public.employee_shift_sessions%rowtype;
 v_crew public.crew_members%rowtype;v_oh record;v_rate numeric;v_hours numeric;v_gross numeric;v_id uuid;v_existing public.timecards%rowtype;
 v_task uuid;v_task_names text;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 if p_regular_hours is null or p_overtime_hours is null or p_regular_hours::text in ('NaN','Infinity','-Infinity') or p_overtime_hours::text in ('NaN','Infinity','-Infinity')
 or p_regular_hours<0 or p_overtime_hours<0 or p_regular_hours+p_overtime_hours<=0
 or round(p_regular_hours,2)<>p_regular_hours or round(p_overtime_hours,2)<>p_overtime_hours then raise exception 'Enter finite, nonnegative hours to two decimals with a positive total.'; end if;
 select * into v_shift from public.employee_shift_sessions where company_id=v_company and id=p_shift_id for update;
 if not found then raise exception 'Shift unavailable.'; end if;
 select * into v_existing from public.timecards where company_id=v_company and source_shift_id=v_shift.id;
 if v_shift.status='approved' and v_existing.id=v_shift.approved_timecard_id then
   if v_existing.regular_hours=p_regular_hours and v_existing.overtime_hours=p_overtime_hours and coalesce(v_shift.owner_note,'')=coalesce(nullif(btrim(p_note),''),'') then return v_existing.id; end if;
   raise exception 'This shift was already approved with different values. Reopen the recorded result.';
 end if;
 if v_shift.status<>'submitted' or v_existing.id is not null then raise exception 'Shift is not eligible for approval; review existing posting.'; end if;
 select * into v_crew from public.crew_members where company_id=v_company and id=v_shift.crew_member_id;
 if not coalesce(v_crew.is_owner,false) then raise exception 'Statutory employee costing is unavailable in this pilot. Time remains submitted; no cost was posted.'; end if;
 v_rate:=coalesce(v_crew.internal_field_rate,v_crew.hourly_rate);
 if v_rate is null or v_rate<0 or v_rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Recorded internal field rate is required.'; end if;
 select * into v_oh from public.capture_overhead_rate_snapshot(v_shift.work_date);
 if v_oh.id is null or v_oh.overhead_rate_per_productive_hour is null then raise exception 'Overhead snapshot unavailable.'; end if;
 v_hours:=p_regular_hours+p_overtime_hours;v_gross:=round(p_regular_hours*v_rate+p_overtime_hours*v_rate*1.5,2);
 select case when count(distinct e.production_task_id)=1 then (array_agg(distinct e.production_task_id))[1] else null end,
   string_agg(distinct t.name,', ' order by t.name) into v_task,v_task_names
 from public.employee_task_segments e join public.production_tasks t on t.id=e.production_task_id and t.company_id=e.company_id
 where e.company_id=v_company and e.shift_id=v_shift.id;
 insert into public.timecards(company_id,project_id,crew_member_id,worker_name,work_date,task,production_task_id,hours,regular_hours,overtime_hours,hourly_rate,base_hourly_rate,
 gross_wage_cost,direct_labor_cost,overhead_snapshot_id,overhead_rate_snapshot,overhead_recovery_cost,overhead_cost_method,labor_cost_method,notes,source_shift_id,approval_status)
 values(v_company,v_shift.project_id,v_crew.id,v_crew.name,v_shift.work_date,coalesce(v_task_names,'General'),v_task,v_hours,p_regular_hours,p_overtime_hours,v_rate,v_rate,
 v_gross,v_gross,v_oh.id,v_oh.overhead_rate_per_productive_hour,round(v_hours*v_oh.overhead_rate_per_productive_hour,2),
 case when v_oh.source_type='unconfigured_zero' then 'unconfigured_zero' else 'productive_hour_v1' end,'owner_internal_v1',coalesce(nullif(btrim(p_note),''),v_shift.employee_note),v_shift.id,'approved') returning id into v_id;
 update public.employee_shift_sessions set status='approved',approved_by=auth.uid(),approved_at=now(),approved_timecard_id=v_id,owner_note=nullif(btrim(p_note),''),updated_at=now() where company_id=v_company and id=v_shift.id;
 if not found then raise exception 'Shift approval did not persist.'; end if;
 return v_id;
end $$;
revoke all on function public.carez_approve_owner_shift(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.carez_approve_owner_shift(uuid,numeric,numeric,text) to authenticated;

create or replace function public.carez_record_verified_production(p_project_id uuid,p_work_date date,p_task_id uuid,p_quantity numeric,p_unit text,p_notes text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id();v_id uuid;v_unit text;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 if p_work_date is null or p_quantity is null or p_quantity<0 or p_quantity::text in ('NaN','Infinity','-Infinity') then raise exception 'A date and finite nonnegative quantity are required.'; end if;
 if not exists(select 1 from public.projects where company_id=v_company and id=p_project_id and status='active') then raise exception 'Active job unavailable.'; end if;
 select production_unit into v_unit from public.production_tasks where company_id=v_company and id=p_task_id and active;
 if v_unit is null or v_unit is distinct from p_unit then raise exception 'Production unit must match the recorded work type.'; end if;
 insert into public.daily_production_records(company_id,project_id,work_date,production_task_id,quantity_completed,unit,notes,source,review_status,verified_by)
 values(v_company,p_project_id,p_work_date,p_task_id,p_quantity,p_unit,nullif(btrim(p_notes),''),'owner','verified',auth.uid())
 on conflict(company_id,project_id,work_date,production_task_id) do update set quantity_completed=excluded.quantity_completed,unit=excluded.unit,notes=excluded.notes,review_status='verified',verified_by=auth.uid(),updated_at=now()
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.carez_record_verified_production(uuid,date,uuid,numeric,text,text) from public,anon;
grant execute on function public.carez_record_verified_production(uuid,date,uuid,numeric,text,text) to authenticated;
alter table public.daily_logs add column if not exists client_request_id uuid;
alter table public.daily_logs add column if not exists request_payload jsonb;
alter table public.daily_logs add constraint daily_log_request_identity unique(company_id,client_request_id);
create or replace function public.carez_record_daily_log(p_request_id uuid,p_project_id uuid,p_date date,p_work text,p_crew integer,p_yards numeric,p_weather text,p_delays text,p_notes text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id();v_id uuid;v_existing public.daily_logs%rowtype;v_payload jsonb;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 if p_request_id is null or p_date is null or nullif(btrim(p_work),'') is null or p_crew is null or p_crew<0 or p_yards is null or p_yards<0 or p_yards::text in ('NaN','Infinity','-Infinity') then raise exception 'Date, completed work, nonnegative crew count and finite placed quantity are required.'; end if;
 v_payload:=jsonb_build_array(p_project_id,p_date,p_work,p_crew,p_yards,p_weather,p_delays,p_notes);
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||p_request_id::text,0));
 select * into v_existing from public.daily_logs where company_id=v_company and client_request_id=p_request_id;
 if found then if v_existing.request_payload is distinct from v_payload then raise exception 'This request already recorded different work. Reopen the saved log.'; end if;return v_existing.id;end if;
 if not exists(select 1 from public.projects where id=p_project_id and company_id=v_company and status='active') then raise exception 'Active job unavailable.'; end if;
 insert into public.daily_logs(company_id,project_id,log_date,weather,crew_count,work_completed,concrete_yards,delays_issues,notes,created_by,client_request_id,request_payload)
 values(v_company,p_project_id,p_date,nullif(btrim(p_weather),''),p_crew,btrim(p_work),p_yards,nullif(btrim(p_delays),''),nullif(btrim(p_notes),''),auth.uid(),p_request_id,v_payload) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.carez_record_daily_log(uuid,uuid,date,text,integer,numeric,text,text,text) from public,anon;
grant execute on function public.carez_record_daily_log(uuid,uuid,date,text,integer,numeric,text,text,text) to authenticated;
create or replace function public.carez_employee_complete_work_package_operation_v2(p_work_package_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;
begin
 select p.company_id,c.id into v_company,v_crew from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id where p.id=auth.uid() and p.role='employee' and c.active;
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 select * into v_op from public.work_package_operations where company_id=v_company and id=p_work_package_operation_id for update;
 if v_op.id is not null and v_op.status='completed' and v_op.completed_by_crew_member_id=v_crew and v_op.completion_source='employee_confirmation' then return jsonb_build_object('operation_id',v_op.id,'quantity_completed',v_op.actual_quantity);end if;
 if v_op.id is null or v_shift is null or not exists(select 1 from public.employee_task_segments where company_id=v_company and shift_id=v_shift and work_package_operation_id=v_op.id and ended_at is null) then raise exception 'This operation is not your active work.'; end if;
 if v_op.measurement_method='ticket' then raise exception 'Ticket-tracked production closes from pour evidence.'; end if;
 update public.employee_task_segments set ended_at=now(),updated_at=now() where company_id=v_company and shift_id=v_shift and work_package_operation_id=v_op.id and ended_at is null;
 update public.work_package_operations set status='completed',completed_at=now(),completed_by_crew_member_id=v_crew,completion_source='employee_confirmation',actual_quantity=coalesce(actual_quantity,planned_quantity),actual_quantity_source=coalesce(actual_quantity_source,'completion'),updated_at=now() where company_id=v_company and id=v_op.id;
 return jsonb_build_object('operation_id',v_op.id,'quantity_completed',coalesce(v_op.actual_quantity,v_op.planned_quantity));
end $$;

revoke all on function public.carez_employee_clock_in_v2(uuid,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.carez_employee_clock_in_v2(uuid,numeric,numeric,numeric,text) to authenticated;
revoke all on function public.carez_employee_clock_out_v2(numeric,numeric,numeric,text) from public,anon;
grant execute on function public.carez_employee_clock_out_v2(numeric,numeric,numeric,text) to authenticated;
revoke all on function public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric) to authenticated;
revoke all on function public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric) to authenticated;
revoke all on function public.carez_employee_start_break_v2() from public,anon;
grant execute on function public.carez_employee_start_break_v2() to authenticated;
revoke all on function public.carez_employee_end_break_v2() from public,anon;
grant execute on function public.carez_employee_end_break_v2() to authenticated;
revoke all on function public.carez_employee_complete_work_package_operation_v2(uuid) from public,anon;
grant execute on function public.carez_employee_complete_work_package_operation_v2(uuid) to authenticated;
