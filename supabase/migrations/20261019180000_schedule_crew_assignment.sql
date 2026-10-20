-- Edit named crew on the existing plan; dates, sources and attendance stay intact.
set local search_path=pg_catalog,public,extensions;
create function public.carez_assign_schedule_crew_v1(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; item public.work_schedule_items%rowtype;
 expected bigint; needed integer; crew_ids uuid[]; previous_crew uuid[]; previous_needed integer;
 worker uuid; invalid_key text; saved integer;
begin
 request:=public.carez_financial_request_begin(p_request_id,'schedule_assign_crew',jsonb_build_object('actor_id',auth.uid(),'values',p_payload));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Crew assignment values required'; end if;
 select k into invalid_key from jsonb_object_keys(p_payload) k where k not in ('id','expected_revision','crew_needed','crew_member_ids') limit 1;
 if invalid_key is not null then raise exception 'Unsupported crew assignment field: %',invalid_key; end if;
 if coalesce(p_payload->>'expected_revision','') !~ '^\d+$' then raise exception 'Reload the schedule before changing crew'; end if;
 expected:=(p_payload->>'expected_revision')::bigint;
 select * into item from public.work_schedule_items where company_id=company and id=nullif(p_payload->>'id','')::uuid for update;
 if not found then raise exception 'Schedule item unavailable'; end if;
 if item.command_revision<>expected then raise exception 'Schedule changed; reload before changing crew'; end if;
 perform public.carez_assert_project_open_for_new_work_v1(company,item.project_id);
 if item.inspection_id is not null then raise exception 'Manage inspection assignments from their source'; end if;
 if item.status not in ('planned','confirmed') then raise exception 'Only planned or confirmed work can change crew'; end if;
 if coalesce(p_payload->>'crew_needed','') !~ '^\d{1,6}$' then raise exception 'Workers needed must be a nonnegative whole number'; end if;
 needed:=(p_payload->>'crew_needed')::integer;
 if jsonb_typeof(p_payload->'crew_member_ids') is distinct from 'array' then raise exception 'Crew selection required'; end if;
 select coalesce(array_agg(distinct v::uuid order by v::uuid),'{}'::uuid[]) into crew_ids from jsonb_array_elements_text(p_payload->'crew_member_ids') v;
 foreach worker in array crew_ids loop
  perform 1 from public.crew_members where company_id=company and id=worker and active for update;
  if not found then raise exception 'An assigned crew member is unavailable'; end if;
 end loop;
 previous_needed:=item.crew_needed;
 select coalesce(array_agg(crew_member_id order by crew_member_id),'{}'::uuid[]) into previous_crew from public.work_schedule_assignments where company_id=company and schedule_item_id=item.id;
 delete from public.work_schedule_assignments where company_id=company and schedule_item_id=item.id and crew_member_id<>all(crew_ids);
 insert into public.work_schedule_assignments(company_id,schedule_item_id,crew_member_id)
  select company,item.id,selected.worker from unnest(crew_ids) selected(worker)
  where not exists(select 1 from public.work_schedule_assignments a where a.company_id=company and a.schedule_item_id=item.id and a.crew_member_id=selected.worker);
 select count(*) into saved from public.work_schedule_assignments where company_id=company and schedule_item_id=item.id;
 if saved<>cardinality(crew_ids) then raise exception 'Crew assignment save was not confirmed'; end if;
 update public.work_schedule_items set crew_needed=needed,updated_at=clock_timestamp() where company_id=company and id=item.id returning * into item;
 if not found then raise exception 'Schedule item save was not confirmed'; end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',item.id,'revision',item.command_revision,'assigned_count',saved,'crew_needed',item.crew_needed,'previous_crew_member_ids',previous_crew,'previous_crew_needed',previous_needed));
end $$;
revoke all on function public.carez_assign_schedule_crew_v1(uuid,jsonb) from public,anon;
grant execute on function public.carez_assign_schedule_crew_v1(uuid,jsonb) to authenticated;
