-- Return a rejected attendance record for review without changing its clock facts.
set local search_path=pg_catalog,public;
create table public.employee_shift_corrections(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),shift_id uuid not null,request_id uuid not null,
 employee_profile_id uuid not null,employee_note text not null,prior_review jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(company_id,request_id),foreign key(company_id,shift_id) references public.employee_shift_sessions(company_id,id)
);
alter table public.employee_shift_corrections enable row level security;
create policy shift_correction_read on public.employee_shift_corrections for select to authenticated using(
 (company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) or
 (employee_profile_id=auth.uid() and company_id=(select p.company_id from public.profiles p where p.id=auth.uid() and p.role='employee')));
revoke all on public.employee_shift_corrections from public,anon,authenticated;
grant select on public.employee_shift_corrections to authenticated;
create trigger immutable_shift_correction before update or delete on public.employee_shift_corrections for each row execute function public.carez_immutable_labor_configuration();
create function public.carez_employee_resubmit_shift_v1(p_request_id uuid,p_shift_id uuid,p_note text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare company uuid;s public.employee_shift_sessions%rowtype;prior public.employee_shift_corrections%rowtype;note text:=nullif(btrim(p_note),'');result_id uuid;
begin
 select company_id into company from public.profiles where id=auth.uid() and role='employee';if company is null then raise exception 'Employee session required';end if;
 if p_request_id is null or note is null or length(note)>1000 then raise exception 'A request identity and correction explanation within 1000 characters are required';end if;
 perform 1 from public.companies where id=company for update;
 select * into prior from public.employee_shift_corrections where company_id=company and request_id=p_request_id;
 if prior.id is not null then
  if prior.employee_profile_id=auth.uid() and prior.shift_id=p_shift_id and prior.employee_note=note then return jsonb_build_object('ok',true,'id',prior.id);end if;
  raise exception 'This correction request already records different values';
 end if;
 perform 1 from public.crew_members where company_id=company and id=(select crew_member_id from public.employee_shift_sessions where id=p_shift_id and company_id=company) for update;
 select * into s from public.employee_shift_sessions where id=p_shift_id and company_id=company and employee_profile_id=auth.uid() for update;
 if s.id is null or s.status<>'rejected' or s.approved_timecard_id is not null or exists(select 1 from public.timecards where company_id=company and source_shift_id=p_shift_id) then raise exception 'Only your unposted returned shift can be resubmitted';end if;
 insert into public.employee_shift_corrections(company_id,shift_id,request_id,employee_profile_id,employee_note,prior_review)
 values(company,s.id,p_request_id,auth.uid(),note,jsonb_build_object('owner_note',s.owner_note,'reviewed_by',s.approved_by,'reviewed_at',s.approved_at)) returning id into result_id;
 update public.employee_shift_sessions set status='submitted',approved_by=null,approved_at=null,updated_at=clock_timestamp() where id=s.id and company_id=company;
 return jsonb_build_object('ok',true,'id',result_id);
end $$;
revoke all on function public.carez_employee_resubmit_shift_v1(uuid,uuid,text) from public,anon;
grant execute on function public.carez_employee_resubmit_shift_v1(uuid,uuid,text) to authenticated;

-- Keep the accepted portal scope and enrich only its own recent attendance list.
do $$ declare definition text;replacement text;begin
 definition:=pg_get_functiondef('public.employee_portal_state()'::regprocedure);
 replacement:=replace(definition,'s.task_coverage_percent requires_review','s.task_coverage_percent,s.requires_review,s.owner_note,(select coalesce(jsonb_agg(jsonb_build_object(''note'',c.employee_note,''created_at'',c.created_at) order by c.created_at),''[]''::jsonb) from public.employee_shift_corrections c where c.company_id=s.company_id and c.shift_id=s.id) correction_history');
 if replacement=definition then raise exception 'Employee recent-time projection differs from frozen shift contract';end if;
 definition:=replacement;
 replacement:=replace(definition,'s.status in (''submitted'',''approved'')','s.status in (''submitted'',''approved'',''rejected'')');
 if replacement=definition then raise exception 'Employee recent-time status contract differs';end if;
 execute replacement;
end $$;
