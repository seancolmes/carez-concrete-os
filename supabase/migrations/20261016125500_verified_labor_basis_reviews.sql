-- Explicit historical review supplements, and never replaces, captured shift facts.
set local search_path=pg_catalog,public;
create table public.labor_basis_reviews(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),shift_id uuid not null,
 request_id uuid not null,original_record jsonb not null,worker_type text not null check(worker_type in ('owner','employee','subcontractor')),
 base_hourly_rate numeric(10,2) not null check(base_hourly_rate>=0 and base_hourly_rate::text not in ('NaN','Infinity','-Infinity')),
 reviewed_work_date date not null,reviewed_timezone text not null,risk_class_code text,reason text not null,reviewed_by uuid not null,
 reviewed_at timestamptz not null default clock_timestamp(),unique(company_id,id),unique(company_id,shift_id),unique(company_id,request_id),
 foreign key(company_id,shift_id) references public.employee_shift_sessions(company_id,id)
);
alter table public.labor_basis_reviews enable row level security;
create policy labor_basis_review_read on public.labor_basis_reviews for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.labor_basis_reviews from public,anon,authenticated;
grant select on public.labor_basis_reviews to authenticated;
create trigger immutable_labor_basis_review before update or delete on public.labor_basis_reviews for each row execute function public.carez_immutable_labor_configuration();

create function public.carez_review_shift_basis_v1(p_request_id uuid,p_shift_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb;company uuid;s public.employee_shift_sessions%rowtype;review_id uuid;worker text:=p_values->>'worker_type';rate numeric;
 work_day date;zone text:=nullif(btrim(p_values->>'work_timezone'),'');reason text:=nullif(btrim(p_values->>'reason'),'');risk text:=nullif(btrim(p_values->>'risk_class_code'),'');
begin
 request:=public.carez_financial_request_begin(p_request_id,'review_shift_labor_basis',jsonb_build_object('shift_id',p_shift_id,'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 perform 1 from public.crew_members where company_id=company and id=(select crew_member_id from public.employee_shift_sessions where id=p_shift_id and company_id=company) for update;
 select * into s from public.employee_shift_sessions where id=p_shift_id and company_id=company for update;
 if s.id is null or s.status<>'submitted' or s.approved_timecard_id is not null or exists(select 1 from public.timecards where company_id=company and source_shift_id=p_shift_id) then raise exception 'Only unposted submitted shifts can receive a historical basis review';end if;
 if s.labor_basis_source='terms_capture' and s.base_hourly_rate_snapshot is not null and s.worker_type_snapshot in ('owner','employee','subcontractor') then raise exception 'A complete captured basis cannot be replaced through historical review';end if;
 if exists(select 1 from public.labor_basis_reviews where company_id=company and shift_id=p_shift_id) then raise exception 'The historical basis was already reviewed; reopen its recorded decision';end if;
 if worker is null or worker not in ('owner','employee','subcontractor') or reason is null or length(reason)>1000 or not public.carez_valid_operating_timezone(zone) or p_values->>'confirmed' is distinct from 'true' then raise exception 'Explicit classification, IANA time zone, review confirmation and evidence reference are required';end if;
 rate:=public.carez_required_labor_number(p_values,'base_hourly_rate',99999999.99,2);work_day:=nullif(p_values->>'work_date','')::date;
 if work_day is null or not isfinite(work_day) then raise exception 'The historical work date must be a finite calendar date';end if;
 if s.clock_in_at is not null and work_day is distinct from (s.clock_in_at at time zone zone)::date then raise exception 'Reviewed work date must follow the confirmed shift start instant and job time zone';end if;
 if risk is not null and length(risk)>30 then raise exception 'Invalid recorded work class';end if;
 insert into public.labor_basis_reviews(company_id,shift_id,request_id,original_record,worker_type,base_hourly_rate,reviewed_work_date,reviewed_timezone,risk_class_code,reason,reviewed_by)
 values(company,s.id,p_request_id,to_jsonb(s),worker,rate,work_day,zone,risk,reason,auth.uid()) returning id into review_id;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',review_id,'shift_id',s.id));
end $$;
revoke all on function public.carez_review_shift_basis_v1(uuid,uuid,jsonb) from public,anon;
grant execute on function public.carez_review_shift_basis_v1(uuid,uuid,jsonb) to authenticated;
