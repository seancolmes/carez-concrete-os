-- Freeze prospective work dates and financial worker terms at the server clock.
-- Historical approved amounts and unverified legacy dates are never reconstructed.
set local search_path=pg_catalog,public,extensions;
alter table public.employee_shift_sessions add column if not exists employee_profile_id uuid references public.profiles(id);
alter table public.employee_shift_sessions add column if not exists crew_terms_id uuid;
alter table public.employee_shift_sessions add column if not exists worker_type_snapshot text;
alter table public.employee_shift_sessions add column if not exists base_hourly_rate_snapshot numeric(10,2);
alter table public.employee_shift_sessions add column if not exists default_risk_class_snapshot text;
alter table public.employee_shift_sessions add column if not exists work_timezone_snapshot text;
alter table public.employee_shift_sessions add column if not exists company_terms_date date;
alter table public.employee_shift_sessions add column if not exists work_date_policy_version text;
alter table public.employee_shift_sessions add column if not exists labor_basis_source text;
alter table public.employee_shift_sessions add column if not exists labor_basis_review_id uuid;
alter table public.timecards add column if not exists crew_terms_id uuid;
alter table public.timecards add column if not exists worker_type_snapshot text;
alter table public.timecards add column if not exists work_timezone_snapshot text;
alter table public.timecards add column if not exists work_date_policy_version text;
alter table public.timecards add column if not exists labor_basis_source text;
alter table public.timecards add column if not exists labor_basis_review_id uuid;
create unique index if not exists crew_terms_tenant_worker_identity on public.crew_employment_terms(company_id,crew_member_id,id);
alter table public.employee_shift_sessions add constraint shift_terms_tenant_worker foreign key(company_id,crew_member_id,crew_terms_id) references public.crew_employment_terms(company_id,crew_member_id,id);
alter table public.timecards add constraint timecard_terms_tenant_worker foreign key(company_id,crew_member_id,crew_terms_id) references public.crew_employment_terms(company_id,crew_member_id,id);
drop index if exists public.employee_shift_one_open;
create unique index employee_shift_one_open on public.employee_shift_sessions(company_id,crew_member_id) where status in ('active','open');

create or replace function public.carez_employee_active_shift(p_require_current_access boolean default false)
returns public.employee_shift_sessions language plpgsql security definer set search_path=pg_catalog,public as $$
declare company uuid; s public.employee_shift_sessions%rowtype; c public.crew_members%rowtype;
begin
 select company_id into company from public.profiles where id=auth.uid() and role='employee';
 if company is null then raise exception 'Employee session required'; end if;
 perform 1 from public.companies where id=company for update;
 select * into s from public.employee_shift_sessions where company_id=company and employee_profile_id=auth.uid() and status in ('active','open') order by clock_in_at desc limit 1;
 if s.id is null then raise exception 'No active shift bound to this employee session'; end if;
 select * into c from public.crew_members where company_id=company and id=s.crew_member_id for update;
 select * into s from public.employee_shift_sessions where id=s.id and company_id=company and employee_profile_id=auth.uid() and status in ('active','open') for update;
 if s.id is null then raise exception 'No active shift bound to this employee session'; end if;
 if p_require_current_access and (not c.active or c.profile_id is distinct from auth.uid()
  or (c.start_date is not null and c.start_date>public.carez_company_calendar_date(company,clock_timestamp()))
  or (c.end_date is not null and c.end_date<public.carez_company_calendar_date(company,clock_timestamp()))) then
  raise exception 'Current Crew access is required before starting new work';
 end if;
 return s;
end $$;
revoke all on function public.carez_employee_active_shift(boolean) from public,anon,authenticated;

create or replace function public.carez_employee_clock_in_v2(p_project_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric,p_device_label text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare company uuid; c public.crew_members%rowtype; p public.projects%rowtype; t public.crew_employment_terms%rowtype;
 instant timestamptz; terms_date date; zone text; inside boolean; distance numeric; v_id uuid; existing public.employee_shift_sessions%rowtype;
begin
 select company_id into company from public.profiles where id=auth.uid() and role='employee';
 if company is null then raise exception 'Employee session required'; end if;
 perform 1 from public.companies where id=company for update;
 select * into c from public.crew_members where company_id=company and profile_id=auth.uid() for update;
 if c.id is null then raise exception 'Employee profile is not linked to Crew'; end if;
 select * into existing from public.employee_shift_sessions where company_id=company and crew_member_id=c.id and status in ('active','open') for update;
 if existing.id is not null then
  if existing.employee_profile_id=auth.uid() and existing.project_id=p_project_id then return jsonb_build_object('shift_id',existing.id); end if;
  raise exception 'An existing clock must be resolved before starting another shift';
 end if;
 instant:=clock_timestamp();terms_date:=public.carez_company_calendar_date(company,instant);
 if terms_date is null then raise exception 'Company operating time zone must be configured before starting a shift'; end if;
 if not c.active or (c.start_date is not null and c.start_date>terms_date) or (c.end_date is not null and c.end_date<terms_date) then raise exception 'Current active Crew access is required'; end if;
 select * into p from public.projects where id=p_project_id and company_id=company for update;
 if p.id is null or p.status<>'active' then raise exception 'Active job not found'; end if;
 select coalesce(p.work_timezone,operating_timezone) into zone from public.companies where companies.id=company;
 if not public.carez_valid_operating_timezone(zone) then raise exception 'Job operating time zone is unavailable'; end if;
 select * into t from public.crew_employment_terms where company_id=company and crew_member_id=c.id and effective_date<=terms_date order by effective_date desc,administration_revision desc limit 1;
 if t.id is null then raise exception 'Effective Crew terms must be recorded before starting a shift'; end if;
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 if p.site_latitude is not null and p.site_longitude is not null and p_lat is not null then
  distance:=sqrt(power((p_lat-p.site_latitude)*364000,2)+power((p_lng-p.site_longitude)*cos(radians(p.site_latitude))*288200,2));inside:=distance<=coalesce(p.geofence_radius_ft,500);
 end if;
 insert into public.employee_shift_sessions(company_id,project_id,crew_member_id,employee_profile_id,work_date,status,clock_in_at,
  clock_in_latitude,clock_in_longitude,clock_in_accuracy_m,clock_in_inside_geofence,clock_in_distance_ft,
  crew_terms_id,worker_type_snapshot,base_hourly_rate_snapshot,default_risk_class_snapshot,work_timezone_snapshot,company_terms_date,work_date_policy_version,labor_basis_source)
 values(company,p.id,c.id,auth.uid(),public.carez_shift_start_work_date(instant,zone,null),'active',instant,p_lat,p_lng,p_accuracy_m,inside,distance,
  t.id,t.worker_type,case when t.worker_type='owner' then t.internal_field_rate else t.hourly_rate end,t.default_risk_class_code,zone,terms_date,'shift_start_job_or_company_v1','terms_capture') returning employee_shift_sessions.id into v_id;
 return jsonb_build_object('shift_id',v_id);
end $$;
revoke all on function public.carez_employee_clock_in_v2(uuid,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.carez_employee_clock_in_v2(uuid,numeric,numeric,numeric,text) to authenticated;

create function public.carez_guard_frozen_shift() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if current_user not in ('postgres','supabase_admin','service_role') then raise exception 'Use governed clock and shift review actions'; end if;
 if tg_op='DELETE' then
  if old.status='approved' then raise exception 'Approved shift history is immutable'; end if;
  return old;
 end if;
 if tg_op='UPDATE' and old.status='approved' and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'Approved shift history is immutable'; end if;
 if tg_op='UPDATE' and old.labor_basis_source is not null and
  (new.company_id,new.project_id,new.crew_member_id,new.employee_profile_id,new.clock_in_at,new.work_date,new.crew_terms_id,new.worker_type_snapshot,new.base_hourly_rate_snapshot,new.default_risk_class_snapshot,new.work_timezone_snapshot,new.company_terms_date,new.work_date_policy_version,new.labor_basis_source,new.labor_basis_review_id)
   is distinct from
  (old.company_id,old.project_id,old.crew_member_id,old.employee_profile_id,old.clock_in_at,old.work_date,old.crew_terms_id,old.worker_type_snapshot,old.base_hourly_rate_snapshot,old.default_risk_class_snapshot,old.work_timezone_snapshot,old.company_terms_date,old.work_date_policy_version,old.labor_basis_source,old.labor_basis_review_id) then raise exception 'Captured shift identity, work date and labor basis are immutable'; end if;
 if new.labor_basis_source='terms_capture' and not exists(select 1 from public.crew_employment_terms t where t.id=new.crew_terms_id and t.company_id=new.company_id and t.crew_member_id=new.crew_member_id
  and t.worker_type=new.worker_type_snapshot and (case when t.worker_type='owner' then t.internal_field_rate else t.hourly_rate end) is not distinct from new.base_hourly_rate_snapshot
  and t.default_risk_class_code is not distinct from new.default_risk_class_snapshot) then raise exception 'Shift basis does not match its immutable Crew terms'; end if;
 return new;
end $$;
revoke all on function public.carez_guard_frozen_shift() from public,anon,authenticated;
create trigger carez_frozen_shift_guard before insert or update or delete on public.employee_shift_sessions for each row execute function public.carez_guard_frozen_shift();
revoke insert,update,delete on public.employee_shift_sessions from authenticated;
revoke insert,update,delete on public.timecards from authenticated;

create function public.carez_guard_approved_timecard() returns trigger language plpgsql set search_path=pg_catalog,public as $$
declare mutable_basis text[]:=array['crew_terms_id','worker_type_snapshot','work_timezone_snapshot','work_date_policy_version','labor_basis_source','labor_basis_review_id','updated_at'];
begin
 if tg_op='DELETE' then
  if old.approval_status='approved' then raise exception 'Approved labor cost history is immutable'; end if;
  return old;
 end if;
 if old.approval_status='approved' and (to_jsonb(new)-mutable_basis) is distinct from (to_jsonb(old)-mutable_basis) then
  raise exception 'Approved labor quantity and financial snapshots are immutable';
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_approved_timecard() from public,anon,authenticated;
create trigger carez_approved_timecard_guard before update or delete on public.timecards for each row execute function public.carez_guard_approved_timecard();

-- Finish bound shifts even after access is deactivated; only new work requires current access.
create or replace function public.carez_employee_clock_out_v2(p_lat numeric,p_lng numeric,p_accuracy_m numeric,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift public.employee_shift_sessions%rowtype;v_project public.projects%rowtype;v_distance numeric;v_inside boolean;
v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin
 select * into v_clock_shift from public.carez_employee_active_shift(false);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();
 perform public.carez_validate_clock_coordinates(p_lat,p_lng,p_accuracy_m);
 select * into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 if v_shift.id is null then raise exception 'No active shift.'; end if;
 if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift.id and ended_at is null) then raise exception 'End your break before clocking out.'; end if;
 select * into v_project from public.projects where company_id=v_company and id=v_shift.project_id;
 if v_project.site_latitude is not null and v_project.site_longitude is not null then v_distance:=sqrt(power((p_lat-v_project.site_latitude)*364000,2)+power((p_lng-v_project.site_longitude)*cos(radians(v_project.site_latitude))*288200,2));v_inside:=v_distance<=coalesce(v_project.geofence_radius_ft,500);end if;
 update public.employee_task_segments set ended_at=v_clock_instant,end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=v_clock_instant where company_id=v_company and shift_id=v_shift.id and ended_at is null;
 update public.employee_shift_sessions set status='submitted',clock_out_at=v_clock_instant,clock_out_latitude=p_lat,clock_out_longitude=p_lng,clock_out_accuracy_m=p_accuracy_m,clock_out_inside_geofence=v_inside,clock_out_distance_ft=v_distance,employee_note=p_note,updated_at=v_clock_instant where id=v_shift.id;
 return jsonb_build_object('shift_id',v_shift.id,'status','submitted');
end; $$;

create or replace function public.carez_employee_start_task_v2(p_task_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
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
 insert into public.employee_task_segments(company_id,shift_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,p_task_id,v_clock_instant,p_lat,p_lng,p_accuracy_m) returning id into v_id;
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.carez_employee_start_work_v2(p_work_package_operation_id uuid,p_lat numeric,p_lng numeric,p_accuracy_m numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;v_id uuid;
v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin
 select * into v_clock_shift from public.carez_employee_active_shift(true);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();
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
 update public.employee_task_segments set ended_at=v_clock_instant,end_latitude=p_lat,end_longitude=p_lng,end_accuracy_m=p_accuracy_m,updated_at=v_clock_instant where company_id=v_company and shift_id=v_shift and ended_at is null;
 insert into public.employee_task_segments(company_id,shift_id,production_task_id,work_package_operation_id,started_at,start_latitude,start_longitude,start_accuracy_m) values(v_company,v_shift,v_op.production_task_id,v_op.id,v_clock_instant,p_lat,p_lng,p_accuracy_m) returning id into v_id;
 update public.work_package_operations set status='in_progress',updated_at=v_clock_instant where company_id=v_company and id=v_op.id and status='planned';
 return jsonb_build_object('segment_id',v_id);
end; $$;

create or replace function public.carez_employee_start_break_v2() returns void language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$ declare v_company uuid;v_crew uuid;v_shift uuid;v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin select * into v_clock_shift from public.carez_employee_active_shift(false);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;if v_shift is null then raise exception 'No active shift.';end if;if exists(select 1 from public.employee_break_periods where company_id=v_company and shift_id=v_shift and ended_at is null) then raise exception 'Break already active.';end if;update public.employee_task_segments set ended_at=v_clock_instant,updated_at=v_clock_instant where company_id=v_company and shift_id=v_shift and ended_at is null;insert into public.employee_break_periods(company_id,shift_id) values(v_company,v_shift);end; $$;

create or replace function public.carez_employee_end_break_v2() returns void language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$ declare v_company uuid;v_crew uuid;v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin select * into v_clock_shift from public.carez_employee_active_shift(false);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();perform 1 from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') for update;update public.employee_break_periods b set ended_at=v_clock_instant from public.employee_shift_sessions s where b.company_id=v_company and b.shift_id=s.id and s.crew_member_id=v_crew and s.status in ('active','open') and b.ended_at is null;end; $$;

create or replace function public.carez_employee_complete_work_package_operation_v2(p_work_package_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_company uuid;v_crew uuid;v_shift uuid;v_op public.work_package_operations%rowtype;
v_clock_shift public.employee_shift_sessions%rowtype;v_clock_instant timestamptz;begin
 select * into v_clock_shift from public.carez_employee_active_shift(false);v_company:=v_clock_shift.company_id;v_crew:=v_clock_shift.crew_member_id;v_clock_instant:=clock_timestamp();
 select id into v_shift from public.employee_shift_sessions where company_id=v_company and crew_member_id=v_crew and status in ('active','open') order by clock_in_at desc limit 1 for update;
 select * into v_op from public.work_package_operations where company_id=v_company and id=p_work_package_operation_id for update;
 if v_op.id is not null and v_op.status='completed' and v_op.completed_by_crew_member_id=v_crew and v_op.completion_source='employee_confirmation' then return jsonb_build_object('operation_id',v_op.id,'quantity_completed',v_op.actual_quantity);end if;
 if v_op.id is null or v_shift is null or not exists(select 1 from public.employee_task_segments where company_id=v_company and shift_id=v_shift and work_package_operation_id=v_op.id and ended_at is null) then raise exception 'This operation is not your active work.'; end if;
 if v_op.measurement_method='ticket' then raise exception 'Ticket-tracked production closes from pour evidence.'; end if;
 update public.employee_task_segments set ended_at=v_clock_instant,updated_at=v_clock_instant where company_id=v_company and shift_id=v_shift and work_package_operation_id=v_op.id and ended_at is null;
 update public.work_package_operations set status='completed',completed_at=v_clock_instant,completed_by_crew_member_id=v_crew,completion_source='employee_confirmation',actual_quantity=coalesce(actual_quantity,planned_quantity),actual_quantity_source=coalesce(actual_quantity_source,'completion'),updated_at=v_clock_instant where company_id=v_company and id=v_op.id;
 return jsonb_build_object('operation_id',v_op.id,'quantity_completed',coalesce(v_op.actual_quantity,v_op.planned_quantity));
end $$;

-- No generated/default EXECUTE privilege on any clock transition.
do $$ declare signature text;begin
execute 'revoke all on function public.carez_employee_clock_out_v2(numeric,numeric,numeric,text) from public,anon';execute 'grant execute on function public.carez_employee_clock_out_v2(numeric,numeric,numeric,text) to authenticated';
execute 'revoke all on function public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric) from public,anon';execute 'grant execute on function public.carez_employee_start_task_v2(uuid,numeric,numeric,numeric) to authenticated';
execute 'revoke all on function public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric) from public,anon';execute 'grant execute on function public.carez_employee_start_work_v2(uuid,numeric,numeric,numeric) to authenticated';
execute 'revoke all on function public.carez_employee_start_break_v2() from public,anon';execute 'grant execute on function public.carez_employee_start_break_v2() to authenticated';
execute 'revoke all on function public.carez_employee_end_break_v2() from public,anon';execute 'grant execute on function public.carez_employee_end_break_v2() to authenticated';
execute 'revoke all on function public.carez_employee_complete_work_package_operation_v2(uuid) from public,anon';execute 'grant execute on function public.carez_employee_complete_work_package_operation_v2(uuid) to authenticated';
end $$;

-- Compatibility owner posting uses captured facts, never current Crew rates.
create or replace function public.carez_approve_owner_shift(p_shift_id uuid,p_regular_hours numeric,p_overtime_hours numeric,p_note text default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid:=public.get_my_company_id();v_shift public.employee_shift_sessions%rowtype;
 v_crew public.crew_members%rowtype;v_oh record;v_rate numeric;v_hours numeric;v_gross numeric;v_id uuid;v_existing public.timecards%rowtype;
 v_task uuid;v_task_names text;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 perform 1 from public.companies where id=v_company for update;
 perform 1 from public.crew_members c join public.employee_shift_sessions s on s.crew_member_id=c.id and s.company_id=c.company_id where s.id=p_shift_id and s.company_id=v_company for update of c;
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
 if v_shift.labor_basis_source is distinct from 'terms_capture' or v_shift.worker_type_snapshot is distinct from 'owner' then raise exception 'A verified frozen owner labor basis is required; review the recorded shift basis.'; end if;
 v_rate:=v_shift.base_hourly_rate_snapshot;
 if v_rate is null or v_rate<0 or v_rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Recorded internal field rate is required.'; end if;
 select * into v_oh from public.capture_overhead_rate_snapshot(v_shift.work_date);
 if v_oh.id is null or v_oh.overhead_rate_per_productive_hour is null then raise exception 'Overhead snapshot unavailable.'; end if;
 v_hours:=p_regular_hours+p_overtime_hours;v_gross:=round(p_regular_hours*v_rate+p_overtime_hours*v_rate*1.5,2);
 select case when count(distinct e.production_task_id)=1 then (array_agg(distinct e.production_task_id))[1] else null end,
   string_agg(distinct t.name,', ' order by t.name) into v_task,v_task_names
 from public.employee_task_segments e join public.production_tasks t on t.id=e.production_task_id and t.company_id=e.company_id
 where e.company_id=v_company and e.shift_id=v_shift.id;
 insert into public.timecards(company_id,project_id,crew_member_id,worker_name,work_date,task,production_task_id,hours,regular_hours,overtime_hours,hourly_rate,base_hourly_rate,
 gross_wage_cost,direct_labor_cost,overhead_snapshot_id,overhead_rate_snapshot,overhead_recovery_cost,overhead_cost_method,labor_cost_method,notes,source_shift_id,approval_status,crew_terms_id,worker_type_snapshot,work_timezone_snapshot,work_date_policy_version,labor_basis_source)
 values(v_company,v_shift.project_id,v_crew.id,v_crew.name,v_shift.work_date,coalesce(v_task_names,'General'),v_task,v_hours,p_regular_hours,p_overtime_hours,v_rate,v_rate,
 v_gross,v_gross,v_oh.id,v_oh.overhead_rate_per_productive_hour,round(v_hours*v_oh.overhead_rate_per_productive_hour,2),
 case when v_oh.source_type='unconfigured_zero' then 'unconfigured_zero' else 'productive_hour_v1' end,'owner_internal_v1',coalesce(nullif(btrim(p_note),''),v_shift.employee_note),v_shift.id,'approved',v_shift.crew_terms_id,v_shift.worker_type_snapshot,v_shift.work_timezone_snapshot,v_shift.work_date_policy_version,v_shift.labor_basis_source) returning id into v_id;
 update public.employee_shift_sessions set status='approved',approved_by=auth.uid(),approved_at=now(),approved_timecard_id=v_id,owner_note=nullif(btrim(p_note),''),updated_at=now() where company_id=v_company and id=v_shift.id;
 if not found then raise exception 'Shift approval did not persist.'; end if;
 return v_id;
end $$;

create or replace function public.employee_portal_state()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions as $$
declare v_user uuid:=auth.uid();v_company uuid;v_crew uuid;v_shift jsonb;v_task jsonb;v_break jsonb;v_projects jsonb;v_tasks jsonb;v_schedule jsonb;v_recent jsonb;v_company_zone text;
begin
  select p.company_id,coalesce((select s.crew_member_id from public.employee_shift_sessions s where s.company_id=p.company_id and s.employee_profile_id=p.id and s.status in ('active','open') order by s.clock_in_at desc limit 1),(select c.id from public.crew_members c where c.company_id=p.company_id and c.profile_id=p.id)) into v_company,v_crew from public.profiles p where p.id=v_user and p.role='employee';
  if v_company is null or v_crew is null then raise exception 'Employee profile is not linked to a recorded crew member.'; end if;
  select operating_timezone into v_company_zone from public.companies where id=v_company;
  select to_jsonb(s) into v_shift from public.employee_shift_sessions s where s.company_id=v_company and s.crew_member_id=v_crew and s.status in ('active','open') order by s.clock_in_at desc limit 1;
  select to_jsonb(x) into v_task from (select e.id,e.production_task_id,e.work_package_operation_id,e.started_at,t.name task_name,w.name work_package_name,w.location work_package_location,o.planned_quantity,o.unit operation_unit,o.measurement_method
    from public.employee_task_segments e join public.employee_shift_sessions s on s.company_id=e.company_id and s.id=e.shift_id and s.status in ('active','open') join public.production_tasks t on t.company_id=e.company_id and t.id=e.production_task_id left join public.work_package_operations o on o.company_id=e.company_id and o.id=e.work_package_operation_id left join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id where e.company_id=v_company and s.crew_member_id=v_crew and e.ended_at is null order by e.started_at desc limit 1) x;
  select to_jsonb(b) into v_break from public.employee_break_periods b join public.employee_shift_sessions s on s.company_id=b.company_id and s.id=b.shift_id where b.company_id=v_company and s.crew_member_id=v_crew and b.ended_at is null limit 1;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_projects from (select p.id,p.job_number,p.name,p.address,p.city from public.projects p where p.company_id=v_company and p.status in ('active','on_hold')) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]'::jsonb) into v_tasks from (select t.id,t.name,t.production_unit,t.category,t.sort_order from public.production_tasks t where t.company_id=v_company and t.active) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.schedule_date,x.start_time),'[]'::jsonb) into v_schedule from (select s.id,s.project_id,s.schedule_date,case when public.carez_valid_operating_timezone(coalesce(p.work_timezone,v_company_zone)) then s.schedule_date=(clock_timestamp() at time zone coalesce(p.work_timezone,v_company_zone))::date else null end is_today,s.start_time,s.title,s.status,p.job_number,p.name project_name,o.id work_package_operation_id,w.name work_package_name,w.location work_package_location,t.name task_name,o.planned_quantity,o.unit operation_unit,o.measurement_method,r.ready_to_start,r.next_action readiness_action from public.work_schedule_items s join public.projects p on p.company_id=s.company_id and p.id=s.project_id left join public.work_package_operations o on o.company_id=s.company_id and o.id=s.work_package_operation_id left join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id left join public.production_tasks t on t.company_id=s.company_id and t.id=coalesce(o.production_task_id,s.production_task_id) left join public.work_package_operation_readiness r on r.company_id=s.company_id and r.operation_id=o.id join public.work_schedule_assignments a on a.company_id=s.company_id and a.schedule_item_id=s.id and a.crew_member_id=v_crew where s.company_id=v_company and s.status<>'cancelled') x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.work_date desc),'[]'::jsonb) into v_recent from (select s.id,s.work_date,s.work_timezone_snapshot,s.clock_in_at,s.clock_out_at,s.status,p.name project,s.task_coverage_percent requires_review from public.employee_shift_sessions s join public.projects p on p.company_id=s.company_id and p.id=s.project_id where s.company_id=v_company and s.crew_member_id=v_crew and s.status in ('submitted','approved') order by s.work_date desc limit 20) x;
  return jsonb_build_object('business_timezone',v_company_zone,'business_date',public.carez_company_calendar_date(v_company,clock_timestamp()),'clocking_available',public.carez_company_calendar_date(v_company,clock_timestamp()) is not null and exists(select 1 from public.crew_members where id=v_crew and company_id=v_company and profile_id=v_user and active),'employee',jsonb_build_object('id',v_crew,'name',(select name from public.crew_members where id=v_crew),'role','employee','can_report_production',true),'projects',v_projects,'tasks',v_tasks,'assigned_schedule',v_schedule,'suggested_tasks',v_schedule,'active_shift',v_shift,'active_task',v_task,'active_break',v_break,'work_tracking',jsonb_build_object(),'today_reports','[]'::jsonb,'recent',v_recent);
end; $$;
revoke all on function public.employee_portal_state() from public,anon;grant execute on function public.employee_portal_state() to authenticated;
