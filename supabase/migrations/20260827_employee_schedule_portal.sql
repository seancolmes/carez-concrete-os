-- Add assigned work schedule to the restricted employee portal.
create or replace function public.employee_portal_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_crew public.crew_members%rowtype;
  v_shift public.employee_shift_sessions%rowtype;
begin
  select * into v_profile from public.profiles where id=auth.uid() and role='employee';
  if not found then raise exception 'Employee account required'; end if;
  select * into v_crew from public.crew_members where profile_id=auth.uid() and company_id=v_profile.company_id and active=true;
  if not found then raise exception 'Employee record is not linked'; end if;
  select * into v_shift from public.employee_shift_sessions where employee_profile_id=auth.uid() and status='active' order by clock_in_at desc limit 1;

  return jsonb_build_object(
    'employee',jsonb_build_object('id',v_crew.id,'name',v_crew.name,'role',v_crew.role),
    'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'job_number',p.job_number,'name',p.name,'address',p.address,'city',p.city,'site_latitude',p.site_latitude,'site_longitude',p.site_longitude,'geofence_radius_ft',p.geofence_radius_ft) order by p.job_number),'[]'::jsonb) from public.projects p where p.company_id=v_profile.company_id and p.status='active'),
    'tasks',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'category',t.category,'unit',t.production_unit) order by t.sort_order,t.name),'[]'::jsonb) from public.production_tasks t where t.company_id=v_profile.company_id and t.active=true),
    'assigned_schedule',(select coalesce(jsonb_agg(x order by x->>'schedule_date',x->>'start_time'),'[]'::jsonb) from (
      select jsonb_build_object(
        'id',w.id,'schedule_date',w.schedule_date,'start_time',w.start_time,'end_time',w.end_time,'title',w.title,'item_type',w.item_type,'status',w.status,'notes',w.notes,
        'project_id',w.project_id,'job_number',p.job_number,'project_name',p.name,'address',p.address,'city',p.city,
        'task_name',pt.name,'production_unit',pt.production_unit
      ) x
      from public.work_schedule_assignments a
      join public.work_schedule_items w on w.id=a.schedule_item_id
      left join public.projects p on p.id=w.project_id
      left join public.production_tasks pt on pt.id=w.production_task_id
      where a.company_id=v_profile.company_id and a.crew_member_id=v_crew.id and w.status<>'cancelled' and w.schedule_date between current_date and current_date+7
    ) q),
    'active_shift',case when v_shift.id is null then null else jsonb_build_object('id',v_shift.id,'project_id',v_shift.project_id,'clock_in_at',v_shift.clock_in_at,'clock_in_inside_geofence',v_shift.clock_in_inside_geofence,'clock_in_distance_ft',v_shift.clock_in_distance_ft) end,
    'active_task',(select jsonb_build_object('id',s.id,'production_task_id',s.production_task_id,'started_at',s.started_at,'task_name',t.name,'unit',t.production_unit) from public.employee_task_segments s join public.production_tasks t on t.id=s.production_task_id where s.shift_id=v_shift.id and s.ended_at is null limit 1),
    'active_break',(select jsonb_build_object('id',b.id,'started_at',b.started_at) from public.employee_break_periods b where b.shift_id=v_shift.id and b.ended_at is null limit 1),
    'recent',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select jsonb_build_object('id',s.id,'work_date',s.work_date,'clock_in_at',s.clock_in_at,'clock_out_at',s.clock_out_at,'status',s.status,'project',p.job_number||' - '||p.name) x from public.employee_shift_sessions s join public.projects p on p.id=s.project_id where s.employee_profile_id=auth.uid() order by s.work_date desc,s.clock_in_at desc limit 7) q)
  );
end;
$$;
