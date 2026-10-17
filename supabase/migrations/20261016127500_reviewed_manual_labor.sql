-- Missing manual time is recorded as an office-reviewed source. Never fabricate
-- GPS/clock attendance or rewrite an existing approved timecard.
set local search_path=pg_catalog,public;
create table public.manual_labor_entries(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),request_id uuid not null,
 project_id uuid not null,crew_member_id uuid not null,source_reference text not null,reviewed_values jsonb not null,
 timecard_id uuid,reviewed_by uuid not null,reviewed_at timestamptz not null default clock_timestamp(),
 unique(company_id,id),unique(company_id,request_id),unique(company_id,crew_member_id,source_reference),
 foreign key(company_id,project_id) references public.projects(company_id,id),
 foreign key(company_id,crew_member_id) references public.crew_members(company_id,id),
 foreign key(company_id,timecard_id) references public.timecards(company_id,id)
);
alter table public.timecards add constraint manual_labor_source_tenant foreign key(company_id,manual_labor_entry_id) references public.manual_labor_entries(company_id,id);
alter table public.manual_labor_entries enable row level security;
create policy manual_labor_read on public.manual_labor_entries for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.manual_labor_entries from public,anon,authenticated;
grant select on public.manual_labor_entries to authenticated;
create function public.carez_guard_manual_labor() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'timecard_id') is distinct from (to_jsonb(old)-'timecard_id') or old.timecard_id is not null or new.timecard_id is null then raise exception 'Reviewed manual labor source is immutable';end if;
 return new;
end $$;
revoke all on function public.carez_guard_manual_labor() from public,anon,authenticated;
create trigger immutable_manual_labor before update or delete on public.manual_labor_entries for each row execute function public.carez_guard_manual_labor();

create function public.carez_record_manual_labor_v1(p_request_id uuid,p_project_id uuid,p_crew_member_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb;company uuid;c public.crew_members%rowtype;s public.employee_shift_sessions%rowtype;entry_id uuid;v_timecard_id uuid;
 regular numeric;overtime numeric;pay_date date;reference text:=nullif(btrim(p_values->>'source_reference'),'');reason text:=nullif(btrim(p_values->>'reason'),'');task text:=nullif(btrim(p_values->>'task'),'');risk text:=nullif(btrim(p_values->>'risk_class_code'),'');
begin
 request:=public.carez_financial_request_begin(p_request_id,'record_manual_labor',jsonb_build_object('project_id',p_project_id,'crew_member_id',p_crew_member_id,'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 select * into c from public.crew_members where company_id=company and id=p_crew_member_id for update;
 if c.id is null or not exists(select 1 from public.projects where company_id=company and id=p_project_id) then raise exception 'Recorded worker and job must belong to this company';end if;
 if reference is null or length(reference)>200 or reason is null or length(reason)>1000 or task is null or length(task)>200 or p_values->>'confirmed' is distinct from 'true' then raise exception 'Source line reference, work type, reason and explicit office confirmation are required';end if;
 if exists(select 1 from public.manual_labor_entries where company_id=company and crew_member_id=c.id and source_reference=reference) then raise exception 'This worker source reference was already recorded; reopen the existing manual entry';end if;
 s.company_id:=company;s.project_id:=p_project_id;s.crew_member_id:=c.id;s.worker_type_snapshot:=p_values->>'worker_type';
 if s.worker_type_snapshot is null or s.worker_type_snapshot not in ('owner','employee','subcontractor') then raise exception 'Explicit historical financial classification is required';end if;
 s.base_hourly_rate_snapshot:=public.carez_required_labor_number(p_values,'base_hourly_rate',99999999.99,2);
 s.work_date:=nullif(p_values->>'work_date','')::date;s.work_timezone_snapshot:=nullif(btrim(p_values->>'work_timezone'),'');
 if s.work_date is null or not isfinite(s.work_date) or not public.carez_valid_operating_timezone(s.work_timezone_snapshot) then raise exception 'Finite reviewed job work date and IANA time zone are required';end if;
 s.labor_basis_source:='manual_review';s.work_date_policy_version:='manual_reviewed_job_date_v1';
 regular:=public.carez_required_labor_number(p_values,'regular_hours',999999.99,2);overtime:=public.carez_required_labor_number(p_values,'overtime_hours',999999.99,2);
 pay_date:=nullif(p_values->>'payroll_tax_date','')::date;
 if risk is not null and length(risk)>30 then raise exception 'Invalid recorded work class';end if;
 insert into public.manual_labor_entries(company_id,request_id,project_id,crew_member_id,source_reference,reviewed_values,reviewed_by)
 values(company,p_request_id,p_project_id,c.id,reference,p_values,auth.uid()) returning id into entry_id;
 v_timecard_id:=public.carez_post_reviewed_labor(company,c,s,regular,overtime,risk,pay_date,reason,entry_id,task);
 update public.manual_labor_entries set timecard_id=v_timecard_id where id=entry_id and company_id=company;
 -- Work type is part of the immutable posting itself, never an after-save edit.
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',entry_id,'timecard_id',v_timecard_id));
end $$;
revoke all on function public.carez_record_manual_labor_v1(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.carez_record_manual_labor_v1(uuid,uuid,uuid,jsonb) to authenticated;
