-- Prevent the employee unplanned-work fallback from bypassing a blocked or assigned work package.

create or replace function public.employee_start_task(p_task_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy_m numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_shift public.employee_shift_sessions%rowtype;
  v_task public.production_tasks%rowtype;
  v_id uuid;
  v_scheduled boolean;
  v_package_operation_id uuid;
  v_package_ready boolean;
  v_package_reason text;
  v_package_name text;
begin
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;
  if not found then raise exception 'Clock in first'; end if;
  if exists(select 1 from public.employee_break_periods where shift_id=v_shift.id and ended_at is null) then raise exception 'End break before starting a task'; end if;

  select * into v_task from public.production_tasks where id=p_task_id and company_id=v_shift.company_id and active=true;
  if not found then raise exception 'Task not available'; end if;

  select w.work_package_operation_id,r.ready_to_start,r.next_action,r.package_name
    into v_package_operation_id,v_package_ready,v_package_reason,v_package_name
  from public.work_schedule_assignments a
  join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
  join public.work_package_operation_readiness r on r.operation_id=w.work_package_operation_id and r.company_id=w.company_id
  where a.company_id=v_shift.company_id
    and a.crew_member_id=v_shift.crew_member_id
    and w.project_id=v_shift.project_id
    and w.schedule_date=v_shift.work_date
    and w.status<>'cancelled'
    and w.item_type='work'
    and w.work_package_operation_id is not null
    and w.production_task_id=p_task_id
  order by w.start_time nulls last
  limit 1;

  if v_package_operation_id is not null then
    if not coalesce(v_package_ready,false) then
      raise exception 'This work is on hold: %',coalesce(v_package_reason,'Office must clear readiness first');
    end if;
    raise exception 'Use TODAY''S WORK for % so your time stays with the correct work package',coalesce(v_package_name,v_task.name);
  end if;

  select exists(
    select 1 from public.work_schedule_assignments a
    join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
    where a.company_id=v_shift.company_id and a.crew_member_id=v_shift.crew_member_id
      and w.project_id=v_shift.project_id and w.schedule_date=v_shift.work_date and w.status<>'cancelled'
      and w.item_type='work' and w.work_package_operation_id is null and w.production_task_id=p_task_id
  ) into v_scheduled;

  update public.employee_task_segments set ended_at=now() where shift_id=v_shift.id and ended_at is null;
  insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,started_at,start_latitude,start_longitude,start_accuracy_m,notes)
  values(v_shift.company_id,v_shift.id,v_shift.crew_member_id,v_shift.project_id,v_task.id,now(),p_lat,p_lng,p_accuracy_m,case when v_scheduled then null else 'Employee selected work not assigned on today''s schedule' end)
  returning id into v_id;
  return v_id;
end$$;

grant execute on function public.employee_start_task(uuid,double precision,double precision,numeric) to authenticated;

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
    and w.item_type='work' and w.work_package_operation_id is not null;

  select count(distinct w.production_task_id),(array_agg(distinct w.production_task_id))[1]
  into v_task_count,v_task_id
  from public.work_schedule_assignments a
  join public.work_schedule_items w on w.id=a.schedule_item_id and w.company_id=a.company_id
  where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id
    and w.project_id=v_project.id and w.schedule_date=v_work_date and w.status<>'cancelled'
    and w.item_type='work' and w.work_package_operation_id is null and w.production_task_id is not null
    and not exists(
      select 1
      from public.work_schedule_assignments a2
      join public.work_schedule_items w2 on w2.id=a2.schedule_item_id and w2.company_id=a2.company_id
      join public.work_package_operation_readiness r2 on r2.operation_id=w2.work_package_operation_id and r2.company_id=w2.company_id
      where a2.company_id=v_profile.company_id and a2.crew_member_id=v_crew.id
        and w2.project_id=v_project.id and w2.schedule_date=v_work_date and w2.status<>'cancelled'
        and w2.item_type='work' and w2.work_package_operation_id is not null
        and w2.production_task_id=w.production_task_id and not r2.ready_to_start
    );

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

grant execute on function public.employee_clock_in(uuid,double precision,double precision,numeric,text) to authenticated;
