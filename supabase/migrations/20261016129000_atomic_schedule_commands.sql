-- Planning remains possible while held. Confirmation uses existing server readiness.
-- Commands, assignments and inspection-derived schedule changes commit together.
set local search_path=pg_catalog,public,extensions;
alter table public.work_schedule_items add column if not exists command_revision bigint not null default 0;
create unique index if not exists work_schedule_items_inspection_unique on public.work_schedule_items(inspection_id);

create function public.carez_schedule_revision() returns trigger language plpgsql set search_path=pg_catalog as $$
begin new.command_revision:=old.command_revision+1; return new; end $$;
revoke all on function public.carez_schedule_revision() from public,anon,authenticated;
create trigger schedule_command_revision before update on public.work_schedule_items for each row execute function public.carez_schedule_revision();

create or replace function public.carez_sync_inspection_schedule() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare inspection public.project_inspections%rowtype; task_id uuid; schedule_status text;
begin
 if tg_op='DELETE' then inspection:=old; else inspection:=new; end if;
 if auth.uid() is not null and not exists(select 1 from public.profiles where id=auth.uid() and company_id=inspection.company_id and role in ('owner','office')) then raise exception 'Inspection authority required'; end if;
 perform 1 from public.companies where id=inspection.company_id for update;
 if tg_op='DELETE' then
  delete from public.work_schedule_items where company_id=inspection.company_id and inspection_id=inspection.id;
  return old;
 end if;
 if not exists(select 1 from public.projects where company_id=inspection.company_id and id=inspection.project_id) then raise exception 'Inspection job unavailable'; end if;
 if inspection.required_for_operation_id is not null then
  select o.production_task_id into task_id from public.work_package_operations o join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id
   where o.company_id=inspection.company_id and o.id=inspection.required_for_operation_id and w.project_id=inspection.project_id;
  if not found then raise exception 'Inspection operation does not belong to this job'; end if;
 end if;
 -- A failed inspection invalidates only its affected confirmed work, atomically.
 if inspection.status='failed' and inspection.required_for_operation_id is not null then
  update public.work_schedule_items set status='planned',updated_at=clock_timestamp()
   where company_id=inspection.company_id and project_id=inspection.project_id and work_package_operation_id=inspection.required_for_operation_id and item_type='work' and status='confirmed';
 end if;
 if exists(select 1 from public.work_schedule_items s join public.pour_plans p on p.company_id=s.company_id and p.id=s.pour_plan_id where s.company_id=inspection.company_id and s.inspection_id=inspection.id and p.project_id<>inspection.project_id) then raise exception 'Linked pour does not belong to the inspection job'; end if;
 if inspection.scheduled_date is null then
  delete from public.work_schedule_items where company_id=inspection.company_id and inspection_id=inspection.id;
  return new;
 end if;
 if not isfinite(inspection.scheduled_date) then raise exception 'Inspection date must be finite'; end if;
 schedule_status:=case when inspection.status in ('passed','waived') then 'completed' when inspection.status='cancelled' then 'cancelled' when inspection.status='scheduled' then 'confirmed' else 'planned' end;
 insert into public.work_schedule_items(company_id,project_id,schedule_date,item_type,title,production_task_id,work_package_operation_id,start_time,crew_needed,status,notes,created_by,inspection_id)
 values(inspection.company_id,inspection.project_id,inspection.scheduled_date,'inspection','Inspection — '||inspection.title,task_id,inspection.required_for_operation_id,inspection.scheduled_time,0,schedule_status,nullif(concat_ws(' · ',inspection.authority,inspection.reference_number),''),inspection.created_by,inspection.id)
 on conflict(inspection_id) do update set project_id=excluded.project_id,schedule_date=excluded.schedule_date,title=excluded.title,production_task_id=excluded.production_task_id,work_package_operation_id=excluded.work_package_operation_id,start_time=excluded.start_time,status=excluded.status,notes=excluded.notes,updated_at=clock_timestamp();
 return new;
end $$;
revoke all on function public.carez_sync_inspection_schedule() from public,anon,authenticated;

create function public.carez_schedule_command_v1(p_request_id uuid,p_command text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
<<command>>
declare request jsonb; company uuid; result jsonb; item public.work_schedule_items%rowtype;
 project_id uuid; task_id uuid; operation_id uuid; pour_id uuid; item_id uuid; inspection_id uuid;
 schedule_date date; start_at time; finish_at time; item_type text; title text; notes text; crew_needed integer; crew_ids uuid[]; worker uuid;
 operation record; readiness record; target_status text; expected bigint; invalid_key text;
begin
 if p_command is null or p_command not in ('create','status','reschedule','delete') then raise exception 'Unknown schedule command'; end if;
 request:=public.carez_financial_request_begin(p_request_id,'schedule_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_payload));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Schedule values required'; end if;
 select k into invalid_key from jsonb_object_keys(p_payload) k where k not in ('id','expected_revision','status','project_id','schedule_date','item_type','title','production_task_id','work_package_operation_id','pour_plan_id','start_time','end_time','crew_needed','crew_member_ids','notes') limit 1;
 if invalid_key is not null then raise exception 'Unsupported schedule field: %',invalid_key; end if;
 if p_command='create' then
  if p_payload ? 'status' and p_payload->>'status' is distinct from 'planned' then raise exception 'New schedule work must be planned; confirm after readiness review'; end if;
  project_id:=nullif(p_payload->>'project_id','')::uuid;
  item_type:=coalesce(nullif(p_payload->>'item_type',''),'work');
  if item_type not in ('work','pour','inspection','delivery','equipment','meeting','other') then raise exception 'Choose a valid work type'; end if;
  perform 1 from public.projects where id=project_id and company_id=company and status in ('active','on_hold') for update;
  if not found then raise exception 'Active or held job unavailable'; end if;
  task_id:=nullif(p_payload->>'production_task_id','')::uuid;
  operation_id:=nullif(p_payload->>'work_package_operation_id','')::uuid;
  pour_id:=nullif(p_payload->>'pour_plan_id','')::uuid;
  title:=nullif(btrim(p_payload->>'title'),''); notes:=nullif(btrim(p_payload->>'notes'),'');
  if operation_id is not null then
   select o.*,w.project_id,w.name package_name,t.name task_name into operation from public.work_package_operations o
    join public.work_packages w on w.id=o.work_package_id and w.company_id=o.company_id
    join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
    where o.id=operation_id and o.company_id=company and w.project_id=command.project_id and o.status not in ('completed','cancelled') for update of o;
   if not found then raise exception 'Open operation does not belong to this job'; end if;
   task_id:=operation.production_task_id; title:=coalesce(title,nullif(operation.field_label,''),operation.task_name||' — '||operation.package_name);
   if operation.pour_plan_id is not null then
    if pour_id is not null and pour_id<>operation.pour_plan_id then raise exception 'Selected pour conflicts with the operation source pour'; end if;
    pour_id:=operation.pour_plan_id;
   end if;
  end if;
  if title is null or length(title)>500 or length(coalesce(notes,''))>10000 then raise exception 'Work description required (maximum 500 characters); notes maximum 10000'; end if;
  if item_type='work' and task_id is null then raise exception 'Choose a work operation or production task'; end if;
  if task_id is not null and not exists(select 1 from public.production_tasks where company_id=company and id=task_id and active) then raise exception 'Active production task unavailable'; end if;
  if pour_id is not null and not exists(select 1 from public.pour_plans where company_id=company and pour_plans.project_id=command.project_id and id=pour_id and status<>'cancelled') then raise exception 'Pour plan does not belong to this job'; end if;
  schedule_date:=nullif(p_payload->>'schedule_date','')::date;
  if schedule_date is null or not isfinite(schedule_date) then raise exception 'Choose a finite schedule date'; end if;
  start_at:=nullif(p_payload->>'start_time','')::time; finish_at:=nullif(p_payload->>'end_time','')::time;
  -- End earlier than start is retained as an overnight wall-time plan, not elapsed attendance.
  if start_at=time '24:00' or finish_at=time '24:00' then raise exception 'Choose a time between 00:00 and 23:59'; end if;
  if coalesce(p_payload->>'crew_needed','') !~ '^\d{1,6}$' then raise exception 'Workers needed must be a nonnegative whole number'; end if;
  crew_needed:=(p_payload->>'crew_needed')::integer;
  if jsonb_typeof(p_payload->'crew_member_ids') is distinct from 'array' then raise exception 'Crew selection required'; end if;
  select coalesce(array_agg(distinct v::uuid order by v::uuid),'{}'::uuid[]) into crew_ids from jsonb_array_elements_text(p_payload->'crew_member_ids') v;
  foreach worker in array crew_ids loop
   perform 1 from public.crew_members where company_id=company and id=worker and active for update;
   if not found then raise exception 'An assigned crew member is unavailable'; end if;
  end loop;
  if item_type='inspection' and operation_id is not null then
   insert into public.project_inspections(company_id,project_id,required_for_operation_id,title,inspection_type,status,requested_at,scheduled_date,scheduled_time,result_notes,created_by,updated_by)
    values(company,project_id,operation_id,title,'general','scheduled',clock_timestamp(),schedule_date,start_at,notes,auth.uid(),auth.uid()) returning id into inspection_id;
   select * into item from public.work_schedule_items where company_id=company and work_schedule_items.inspection_id=command.inspection_id;
   if not found then raise exception 'Inspection schedule was not confirmed'; end if;
   update public.work_schedule_items set crew_needed=command.crew_needed,end_time=finish_at,pour_plan_id=pour_id,notes=command.notes,updated_at=clock_timestamp() where id=item.id returning * into item;
  else
   insert into public.work_schedule_items(company_id,project_id,schedule_date,item_type,title,production_task_id,work_package_operation_id,pour_plan_id,start_time,end_time,crew_needed,status,notes,created_by)
    values(company,project_id,schedule_date,item_type,title,task_id,operation_id,pour_id,start_at,finish_at,crew_needed,'planned',notes,auth.uid()) returning * into item;
  end if;
  insert into public.work_schedule_assignments(company_id,schedule_item_id,crew_member_id) select company,item.id,unnest(crew_ids);
 elsif p_command in ('status','reschedule','delete') then
  item_id:=nullif(p_payload->>'id','')::uuid;
  if coalesce(p_payload->>'expected_revision','') !~ '^\d+$' then raise exception 'Reload the schedule before taking action'; end if;
  expected:=(p_payload->>'expected_revision')::bigint;
  select * into item from public.work_schedule_items where id=item_id and company_id=company for update;
  if not found then raise exception 'Schedule item unavailable'; end if;
  if item.command_revision<>expected then raise exception 'Schedule changed; reload before trying again'; end if;
  if p_command='delete' then
   if item.inspection_id is not null then
    perform 1 from public.project_inspections where id=item.inspection_id and company_id=company and status in ('required','scheduled') and completed_at is null for update;
    if not found then raise exception 'Inspection result history must be managed in Work Readiness'; end if;
    delete from public.project_inspections where id=item.inspection_id and company_id=company;
   else delete from public.work_schedule_items where id=item.id and company_id=company; end if;
   result:=jsonb_build_object('ok',true,'id',item.id,'deleted',true);
  elsif p_command='reschedule' then
   if item.inspection_id is not null or item.pour_plan_id is not null then raise exception 'Move linked inspections or pours from their source record'; end if;
   if item.status in ('in_progress','completed','cancelled') then raise exception 'Active or completed work cannot be moved from this timeline'; end if;
   schedule_date:=nullif(p_payload->>'schedule_date','')::date;
   if schedule_date is null or not isfinite(schedule_date) then raise exception 'Choose a finite schedule date'; end if;
   update public.work_schedule_items set schedule_date=command.schedule_date,updated_at=clock_timestamp() where id=item.id and company_id=company returning * into item;
  else
   target_status:=p_payload->>'status';
   if target_status is null or target_status not in ('planned','confirmed','in_progress','completed','cancelled') then raise exception 'Invalid schedule status'; end if;
   if item.inspection_id is not null then raise exception 'Inspection status is controlled from Work Readiness'; end if;
   if item.item_type in ('work','pour') and target_status in ('confirmed','in_progress') then
    perform 1 from public.projects where id=item.project_id and company_id=company for update;
    select * into readiness from public.project_job_readiness_summary where company_id=company and project_job_readiness_summary.project_id=item.project_id;
    if not found then raise exception 'Job readiness unavailable; planning remains available'; end if;
    if readiness.job_ready is distinct from true then raise exception 'Job setup hold: %',coalesce(readiness.readiness_reason,'Review Job Setup'); end if;
    if item.work_package_operation_id is not null then
     select o.* into operation from public.work_package_operations o join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id where o.id=item.work_package_operation_id and o.company_id=company and w.project_id=item.project_id for update of o;
     if not found or operation.status in ('completed','cancelled') or operation.production_task_id is distinct from item.production_task_id or (operation.pour_plan_id is not null and operation.pour_plan_id is distinct from item.pour_plan_id) then raise exception 'Operation source changed; recreate the plan from the current operation'; end if;
     select * into readiness from public.work_package_start_readiness where company_id=company and work_package_start_readiness.operation_id=item.work_package_operation_id;
     if not found then raise exception 'Operation readiness unavailable; planning remains available'; end if;
     if readiness.ready_to_start_all is distinct from true then raise exception 'Work is on hold: %',coalesce(readiness.start_next_action,'Review Work Readiness'); end if;
    end if;
   end if;
   update public.work_schedule_items set status=target_status,updated_at=clock_timestamp() where id=item.id and company_id=company returning * into item;
  end if;
 end if;
 result:=coalesce(result,jsonb_build_object('ok',true,'id',item.id,'revision',item.command_revision,'status',item.status));
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_schedule_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_schedule_command_v1(uuid,text,jsonb) to authenticated;
revoke insert,update,delete on public.work_schedule_items,public.work_schedule_assignments from authenticated;
