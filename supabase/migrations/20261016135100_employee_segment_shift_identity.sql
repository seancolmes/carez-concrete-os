-- Persist the active shift identity on new task segments. The captured deployed
-- schema requires these existing Crew and project references. Derive both from
-- the locked, authenticated shift; accept no caller-supplied replacement IDs.
-- Preserve all existing readiness, break, role, retry and tenant checks.
-- No table, constraint, existing record or historical labor basis is changed.
-- Retain the 134000 hardener's trusted search path, including pg_temp LAST.
set local search_path=pg_catalog,public,extensions,pg_temp;

create or replace function public.carez_employee_start_task_v2(p_task_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_id uuid;
v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin
 select * into v_clock_shift from public.carez_employee_active_shift(true);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 if v_shift is null or not exists(select 1 from public.production_tasks where company_id=v_company and id=p_task_id and active) then raise exception 'Active shift or work type not found.'; end if;
 if not exists(select 1 from public.employee_shift_sessions s join public.projects p on p.company_id=s.company_id and p.id=s.project_id where s.id=v_shift and s.company_id=v_company and p.status='active') then raise exception 'Active job is required before starting work.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'End your break before starting work.'; end if;
 if not exists(select 1 from public.project_job_readiness_summary r join public.employee_shift_sessions s on s.company_id=r.company_id and s.project_id=r.project_id where s.id=v_shift and r.company_id=v_company and r.job_ready) then raise exception 'Job setup is not ready for physical work.'; end if;
 select id into v_id from public.employee_task_segments where company_id=v_company and shift_id=v_shift and ended_at is null and production_task_id=p_task_id and work_package_operation_id is null;
 if v_id is not null then return jsonb_build_object('segment_id',v_id); end if;
 update public.employee_task_segments set ended_at=v_clock_instant,end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=v_clock_instant where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,v_crew,v_clock_shift.project_id,p_task_id,v_clock_instant,p_lat,p_lng,p_accuracy_m) returning id into v_id;
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.carez_employee_start_work_v2(p_work_package_operation_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;v_id uuid;
v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin
 select * into v_clock_shift from public.carez_employee_active_shift(true);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();
 select * into v_op from public.work_package_operations where company_id=v_company and id=p_work_package_operation_id;
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 if v_op.id is null or v_shift is null or not exists(select 1 from public.production_tasks where company_id=v_company and id=v_op.production_task_id and active) then raise exception 'Active work operation or shift not found.'; end if;
 if not exists(select 1 from public.work_packages w join public.employee_shift_sessions s on s.project_id=w.project_id and s.company_id=w.company_id where w.id=v_op.work_package_id and w.company_id=v_company and s.id=v_shift) then raise exception 'Operation does not belong to the active job.'; end if;
 if not exists(select 1 from public.work_package_start_readiness where company_id=v_company and operation_id=v_op.id and ready_to_start_all) then raise exception 'Work is not ready to start.'; end if;
 if not exists(select 1 from public.employee_shift_sessions s join public.projects p on p.company_id=s.company_id and p.id=s.project_id where s.id=v_shift and s.company_id=v_company and p.status='active') then raise exception 'Active job is required before starting work.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'End your break before starting work.'; end if;
 if not exists(select 1 from public.project_job_readiness_summary r join public.employee_shift_sessions s on s.company_id=r.company_id and s.project_id=r.project_id where s.id=v_shift and r.company_id=v_company and r.job_ready) then raise exception 'Job setup is not ready for physical work.'; end if;
 select id into v_id from public.employee_task_segments where company_id=v_company and shift_id=v_shift and ended_at is null and work_package_operation_id=v_op.id;
 if v_id is not null then return jsonb_build_object('segment_id',v_id); end if;
 update public.employee_task_segments set ended_at=v_clock_instant,end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=v_clock_instant where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,v_crew,v_clock_shift.project_id,v_op.production_task_id,v_op.id,v_clock_instant,p_lat,p_lng,p_accuracy_m) returning id into v_id;
 update public.work_package_operations set status='in_progress',updated_at=v_clock_instant where company_id=v_company and id=v_op.id and status='planned';
 return jsonb_build_object('segment_id',v_id);
end; $$;

revoke all on function public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric) from public,anon;
revoke all on function public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric) to authenticated;
