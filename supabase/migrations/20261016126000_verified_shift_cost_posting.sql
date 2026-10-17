-- Frozen labor cost accrual from verified contractor inputs. This is not tax filing
-- or a payroll-provider transfer. Payment-year basis is explicitly reviewed.
set local search_path=pg_catalog,public,extensions;
alter table public.timecards add column if not exists payroll_tax_date date;
alter table public.timecards add column if not exists statutory_basis jsonb;
alter table public.timecards add column if not exists manual_labor_entry_id uuid;
create table public.labor_tax_allocations(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 crew_member_id uuid not null,tax_year integer not null,timecard_id uuid not null,tax_date date not null,
 social_security_taxable_wages numeric(14,2) not null,futa_taxable_wages numeric(14,2) not null,wa_sui_taxable_wages numeric(14,2) not null,
 verified_basis jsonb not null,created_at timestamptz not null default clock_timestamp(),
 unique(company_id,timecard_id),foreign key(company_id,timecard_id) references public.timecards(company_id,id),
 foreign key(company_id,crew_member_id,tax_year) references public.labor_tax_year_accounts(company_id,crew_member_id,tax_year)
);
alter table public.labor_tax_allocations enable row level security;
create policy labor_tax_allocation_read on public.labor_tax_allocations for select to authenticated using(company_id=public.get_my_company_id());
revoke all on public.labor_tax_allocations from public,anon,authenticated;
grant select on public.labor_tax_allocations to authenticated;
create function public.carez_immutable_labor_tax_allocation() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Approved statutory cost allocations are immutable';end $$;
revoke all on function public.carez_immutable_labor_tax_allocation() from public,anon,authenticated;
create trigger immutable_labor_tax_allocation before update or delete on public.labor_tax_allocations for each row execute function public.carez_immutable_labor_tax_allocation();

-- A changed annual cap needs an audited reconciliation of earlier allocations.
-- Do not retroactively infer untaxed subject wages from capped taxable wages.
create function public.carez_guard_allocated_wage_bases() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if (new.company_id,new.tax_year) is distinct from (old.company_id,old.tax_year) then raise exception 'Recorded tax configuration identity is immutable';end if;
 if (new.social_security_wage_base,new.futa_wage_base,new.wa_sui_wage_base) is distinct from (old.social_security_wage_base,old.futa_wage_base,old.wa_sui_wage_base)
  and exists(select 1 from public.labor_tax_allocations a where a.company_id=old.company_id and a.tax_year=old.tax_year) then
  raise exception 'Allocated wage bases require an audited reconciliation before changing the annual limits';
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_allocated_wage_bases() from public,anon,authenticated;
create trigger allocated_wage_base_guard before update on public.labor_tax_settings for each row execute function public.carez_guard_allocated_wage_bases();

create function public.carez_post_reviewed_labor(p_company uuid,p_worker public.crew_members,p_basis public.employee_shift_sessions,p_regular_hours numeric,p_overtime_hours numeric,p_risk_class_code text,p_payroll_tax_date date,p_note text,p_manual_entry_id uuid default null,p_task_label text default null)
returns uuid language plpgsql security invoker set search_path=pg_catalog,public,extensions as $$
declare company uuid:=p_company;c public.crew_members%rowtype:=p_worker;s public.employee_shift_sessions%rowtype:=p_basis;
 tax public.labor_tax_settings%rowtype;risk public.li_risk_classes%rowtype;opening public.labor_tax_year_accounts%rowtype;
 tax_version uuid;risk_version uuid;year integer;hours numeric;rate numeric;gross numeric;ss_wages numeric;futa_wages numeric;sui_wages numeric;
 ss_before numeric;futa_before numeric;sui_before numeric;ss_cost numeric:=0;med_cost numeric:=0;futa_cost numeric:=0;sui_cost numeric:=0;li_cost numeric:=0;sick_cost numeric:=0;
 ss_rate numeric:=0;med_rate numeric:=0;futa_rate numeric:=0;sui_rate numeric:=0;li_rate numeric:=0;sick_rate numeric:=0;
 oh record;basis jsonb;v_timecard_id uuid;task_id uuid;task_names text;note text:=nullif(btrim(p_note),'');risk_code text:=nullif(btrim(p_risk_class_code),'');
begin
 if c.company_id is distinct from company or s.company_id is distinct from company or s.crew_member_id is distinct from c.id or s.worker_type_snapshot is null or s.worker_type_snapshot not in ('owner','employee','subcontractor') then raise exception 'Verified same-company labor basis is required';end if;
 if s.work_date is null or not isfinite(s.work_date) or (p_payroll_tax_date is not null and not isfinite(p_payroll_tax_date)) then raise exception 'Finite work and reviewed payroll calendar dates are required';end if;
 if p_regular_hours is null or p_overtime_hours is null or p_regular_hours<0 or p_overtime_hours<0 or p_regular_hours::text in ('NaN','Infinity','-Infinity') or p_overtime_hours::text in ('NaN','Infinity','-Infinity') or p_regular_hours+p_overtime_hours<=0 or p_regular_hours<>round(p_regular_hours,2) or p_overtime_hours<>round(p_overtime_hours,2) then raise exception 'Finite reviewed hours to two decimals are required';end if;
 rate:=s.base_hourly_rate_snapshot;
 if rate is null or rate::text in ('NaN','Infinity','-Infinity') or rate<0 then raise exception 'Frozen rate unavailable; an explicit historical basis review is required';end if;
 hours:=p_regular_hours+p_overtime_hours;gross:=round(p_regular_hours*rate+p_overtime_hours*rate*1.5,2);
 if s.worker_type_snapshot='employee' then
  if p_payroll_tax_date is null or risk_code is null then raise exception 'Reviewed payroll tax date and L&I class are required for employee cost';end if;
  year:=extract(year from p_payroll_tax_date);
  select * into tax from public.labor_tax_settings where company_id=company and tax_year=year;
  select * into risk from public.li_risk_classes where company_id=company and tax_year=year and code=risk_code and active;
  if tax.id is null or risk.id is null then raise exception 'Verified tax settings and active L&I class are required for the payroll tax year';end if;
  select v.id into tax_version from public.labor_configuration_versions v where v.company_id=company and v.kind='tax' and v.tax_year=year and v.source_record_id=tax.id and v.recorded_values=to_jsonb(tax) order by v.recorded_at desc,v.id desc limit 1;
  select v.id into risk_version from public.labor_configuration_versions v where v.company_id=company and v.kind='risk' and v.tax_year=year and v.source_record_id=risk.id and v.recorded_values=to_jsonb(risk) order by v.recorded_at desc,v.id desc limit 1;
  if tax_version is null or risk_version is null then raise exception 'Confirm the recorded tax and L&I settings through Labor setup before posting';end if;
  select * into opening from public.labor_tax_year_accounts where company_id=company and crew_member_id=s.crew_member_id and tax_year=year for update;
  if opening.crew_member_id is null then raise exception 'Verified opening taxable wages are required; missing YTD is not zero';end if;
  if p_payroll_tax_date<=opening.opening_as_of or (opening.last_tax_date is not null and p_payroll_tax_date<opening.last_tax_date) then raise exception 'Payroll tax date precedes verified opening or already allocated work; use an audited correction';end if;
  select opening.opening_social_security_wages+coalesce(sum(a.social_security_taxable_wages),0),opening.opening_futa_wages+coalesce(sum(a.futa_taxable_wages),0),opening.opening_wa_sui_wages+coalesce(sum(a.wa_sui_taxable_wages),0)
   into ss_before,futa_before,sui_before from public.labor_tax_allocations a where a.company_id=company and a.crew_member_id=s.crew_member_id and a.tax_year=year;
  ss_wages:=least(gross,greatest(0,tax.social_security_wage_base-ss_before));futa_wages:=least(gross,greatest(0,tax.futa_wage_base-futa_before));sui_wages:=least(gross,greatest(0,tax.wa_sui_wage_base-sui_before));
  ss_rate:=tax.social_security_rate;med_rate:=tax.medicare_rate;futa_rate:=tax.futa_rate;sui_rate:=tax.wa_sui_rate;li_rate:=risk.employer_rate_per_hour;sick_rate:=tax.sick_leave_accrual_rate;
  ss_cost:=round(ss_wages*ss_rate,2);med_cost:=round(gross*med_rate,2);futa_cost:=round(futa_wages*futa_rate,2);sui_cost:=round(sui_wages*sui_rate,2);li_cost:=round(hours*li_rate,2);sick_cost:=round(hours*rate*sick_rate,2);
  basis:=jsonb_build_object('version','verified_employer_cost_caps_v1','tax_year',year,'tax_date',p_payroll_tax_date,'tax_configuration_version',tax_version,'risk_configuration_version',risk_version,'opening_request_id',opening.opening_request_id,
   'social_security',jsonb_build_object('wage_base',tax.social_security_wage_base,'ytd_before',ss_before,'allocated_taxable_wages',ss_wages),
   'futa',jsonb_build_object('wage_base',tax.futa_wage_base,'ytd_before',futa_before,'allocated_taxable_wages',futa_wages),
   'wa_sui',jsonb_build_object('wage_base',tax.wa_sui_wage_base,'ytd_before',sui_before,'allocated_taxable_wages',sui_wages));
 end if;
 select * into oh from public.capture_overhead_rate_snapshot(s.work_date);
 if oh.id is null or oh.overhead_rate_per_productive_hour is null then raise exception 'Configured overhead snapshot required';end if;
 select case when count(distinct e.production_task_id)=1 then (array_agg(distinct e.production_task_id))[1] else null end,string_agg(distinct t.name,', ' order by t.name)
  into task_id,task_names from public.employee_task_segments e join public.production_tasks t on t.id=e.production_task_id and t.company_id=e.company_id where e.company_id=company and e.shift_id=s.id;
 insert into public.timecards(company_id,project_id,crew_member_id,worker_name,work_date,task,production_task_id,hours,regular_hours,overtime_hours,hourly_rate,base_hourly_rate,
  risk_class_code,social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,
  gross_wage_cost,employer_social_security_cost,employer_medicare_cost,employer_futa_cost,employer_wa_sui_cost,employer_li_cost,sick_leave_reserve_cost,direct_labor_cost,
  overhead_snapshot_id,overhead_rate_snapshot,overhead_recovery_cost,overhead_cost_method,labor_cost_method,notes,source_shift_id,approval_status,
  crew_terms_id,worker_type_snapshot,work_timezone_snapshot,work_date_policy_version,labor_basis_source,labor_basis_review_id,manual_labor_entry_id,payroll_tax_date,statutory_basis)
 values(company,s.project_id,s.crew_member_id,c.name,s.work_date,coalesce(p_task_label,task_names,'General'),task_id,hours,p_regular_hours,p_overtime_hours,rate,rate,
  case when s.worker_type_snapshot='employee' then risk_code else null end,ss_rate,med_rate,futa_rate,sui_rate,li_rate,sick_rate,
  gross,ss_cost,med_cost,futa_cost,sui_cost,li_cost,sick_cost,round(gross+ss_cost+med_cost+futa_cost+sui_cost+li_cost+sick_cost,2),
  oh.id,oh.overhead_rate_per_productive_hour,round(hours*oh.overhead_rate_per_productive_hour,2),'productive_hour_v1',
  case s.worker_type_snapshot when 'employee' then 'w2_verified_caps_v1' when 'owner' then 'owner_internal_v1' else 'subcontractor_hourly_v1' end,
  coalesce(note,s.employee_note),s.id,'approved',s.crew_terms_id,s.worker_type_snapshot,s.work_timezone_snapshot,s.work_date_policy_version,s.labor_basis_source,s.labor_basis_review_id,p_manual_entry_id,
  case when s.worker_type_snapshot='employee' then p_payroll_tax_date else null end,basis) returning timecards.id into v_timecard_id;
 if s.worker_type_snapshot='employee' then
  insert into public.labor_tax_allocations(company_id,crew_member_id,tax_year,timecard_id,tax_date,social_security_taxable_wages,futa_taxable_wages,wa_sui_taxable_wages,verified_basis)
   values(company,s.crew_member_id,year,v_timecard_id,p_payroll_tax_date,ss_wages,futa_wages,sui_wages,basis);
  update public.labor_tax_year_accounts set last_tax_date=p_payroll_tax_date where company_id=company and crew_member_id=s.crew_member_id and tax_year=year;
  insert into public.employee_tax_status(company_id,crew_member_id,tax_year,social_security_cap_reached,futa_cap_reached,wa_sui_cap_reached,notes)
   values(company,s.crew_member_id,year,ss_before+ss_wages>=tax.social_security_wage_base,futa_before+futa_wages>=tax.futa_wage_base,sui_before+sui_wages>=tax.wa_sui_wage_base,'Derived from verified opening and approved employer-cost allocations')
   on conflict(company_id,crew_member_id,tax_year) do update set social_security_cap_reached=excluded.social_security_cap_reached,futa_cap_reached=excluded.futa_cap_reached,wa_sui_cap_reached=excluded.wa_sui_cap_reached,notes=excluded.notes,updated_at=clock_timestamp();
 end if;
 return v_timecard_id;
end $$;
revoke all on function public.carez_post_reviewed_labor(uuid,public.crew_members,public.employee_shift_sessions,numeric,numeric,text,date,text,uuid,text) from public,anon,authenticated;

create or replace function public.carez_approve_shift_v3(p_shift_id uuid,p_regular_hours numeric,p_overtime_hours numeric,p_risk_class_code text,p_payroll_tax_date date,p_note text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare company uuid;role_name text;s public.employee_shift_sessions%rowtype;c public.crew_members%rowtype;prior public.timecards%rowtype;review public.labor_basis_reviews%rowtype;
 tax public.labor_tax_settings%rowtype;risk public.li_risk_classes%rowtype;opening public.labor_tax_year_accounts%rowtype;
 tax_version uuid;risk_version uuid;year integer;hours numeric;rate numeric;gross numeric;ss_wages numeric;futa_wages numeric;sui_wages numeric;
 ss_before numeric;futa_before numeric;sui_before numeric;ss_cost numeric:=0;med_cost numeric:=0;futa_cost numeric:=0;sui_cost numeric:=0;li_cost numeric:=0;sick_cost numeric:=0;
 ss_rate numeric:=0;med_rate numeric:=0;futa_rate numeric:=0;sui_rate numeric:=0;li_rate numeric:=0;sick_rate numeric:=0;
 oh record;basis jsonb;v_timecard_id uuid;task_id uuid;task_names text;note text:=nullif(btrim(p_note),'');risk_code text:=nullif(btrim(p_risk_class_code),'');
begin
 select company_id,role into company,role_name from public.profiles where profiles.id=auth.uid();
 if company is null or role_name not in ('owner','office') then raise exception 'Owner or office authority required';end if;
 if length(coalesce(note,''))>1000 then raise exception 'Review note must be within 1000 characters';end if;
 if p_regular_hours is null or p_overtime_hours is null or p_regular_hours::text in ('NaN','Infinity','-Infinity') or p_overtime_hours::text in ('NaN','Infinity','-Infinity')
  or p_regular_hours<0 or p_overtime_hours<0 or p_regular_hours+p_overtime_hours<=0 or p_regular_hours<>round(p_regular_hours,2) or p_overtime_hours<>round(p_overtime_hours,2) then raise exception 'Enter finite nonnegative reviewed hours to two decimal places';end if;
 perform 1 from public.companies where companies.id=company for update;
 select * into c from public.crew_members where company_id=company and crew_members.id=(select crew_member_id from public.employee_shift_sessions where employee_shift_sessions.id=p_shift_id and company_id=company) for update;
 select * into s from public.employee_shift_sessions where company_id=company and employee_shift_sessions.id=p_shift_id for update;
 if s.id is null then raise exception 'Shift unavailable';end if;
 select * into prior from public.timecards where company_id=company and source_shift_id=s.id;
 if prior.id is not null then
  if s.status='approved' and s.approved_timecard_id=prior.id and prior.regular_hours=p_regular_hours and prior.overtime_hours=p_overtime_hours and s.owner_note is not distinct from note
   and (prior.worker_type_snapshot<>'employee' or (prior.risk_class_code is not distinct from risk_code and prior.payroll_tax_date is not distinct from p_payroll_tax_date)) then return prior.id;end if;
  raise exception 'This shift already has a different recorded approval';
 end if;
 if s.status<>'submitted' then raise exception 'A submitted shift is required';end if;
 if s.labor_basis_source is distinct from 'terms_capture' or s.base_hourly_rate_snapshot is null then
  select * into review from public.labor_basis_reviews where company_id=company and shift_id=s.id;
  if review.id is null then raise exception 'A submitted shift with a verified frozen or explicitly reviewed labor basis is required';end if;
  -- Effective posting facts come from the immutable review; original shift stays untouched.
  s.worker_type_snapshot:=review.worker_type;s.base_hourly_rate_snapshot:=review.base_hourly_rate;s.work_date:=review.reviewed_work_date;
  s.work_timezone_snapshot:=review.reviewed_timezone;s.default_risk_class_snapshot:=review.risk_class_code;s.crew_terms_id:=null;
  s.work_date_policy_version:='reviewed_shift_start_v1';s.labor_basis_source:='historical_review';s.labor_basis_review_id:=review.id;
 end if;
 if s.worker_type_snapshot is null or s.worker_type_snapshot not in ('owner','employee','subcontractor') then raise exception 'Verified financial worker classification is required';end if;
 v_timecard_id:=public.carez_post_reviewed_labor(company,c,s,p_regular_hours,p_overtime_hours,risk_code,p_payroll_tax_date,note,null);
 update public.employee_shift_sessions set status='approved',approved_by=auth.uid(),approved_at=clock_timestamp(),approved_timecard_id=v_timecard_id,owner_note=note,updated_at=clock_timestamp() where employee_shift_sessions.id=s.id and company_id=company;
 return v_timecard_id;
end $$;
revoke all on function public.carez_approve_shift_v3(uuid,numeric,numeric,text,date,text) from public,anon;
grant execute on function public.carez_approve_shift_v3(uuid,numeric,numeric,text,date,text) to authenticated;
create or replace function public.carez_approve_owner_shift(p_shift_id uuid,p_regular_hours numeric,p_overtime_hours numeric,p_note text default null) returns uuid language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.employee_shift_sessions where id=p_shift_id and company_id=public.get_my_company_id() and worker_type_snapshot='owner' and labor_basis_source='terms_capture') then raise exception 'Verified frozen owner shift is required';end if;
 return public.carez_approve_shift_v3(p_shift_id,p_regular_hours,p_overtime_hours,null,null,p_note);
end $$;
revoke all on function public.carez_approve_owner_shift(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.carez_approve_owner_shift(uuid,numeric,numeric,text) to authenticated;

create function public.carez_reject_shift_v1(p_shift_id uuid,p_note text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare company uuid;s public.employee_shift_sessions%rowtype;reason text:=nullif(btrim(p_note),'');
begin
 select company_id into company from public.profiles where profiles.id=auth.uid() and role in ('owner','office');
 if company is null then raise exception 'Owner or office authority required';end if;
 if reason is null or length(reason)>1000 then raise exception 'Enter a correction reason within 1000 characters';end if;
 perform 1 from public.companies where companies.id=company for update;
 perform 1 from public.crew_members c where c.company_id=company and c.id=(select crew_member_id from public.employee_shift_sessions where company_id=company and id=p_shift_id) for update;
 select * into s from public.employee_shift_sessions where company_id=company and id=p_shift_id for update;
 if s.id is null then raise exception 'Shift unavailable';end if;
 if s.status='rejected' and s.owner_note=reason then return s.id;end if;
 if s.status<>'submitted' or s.approved_timecard_id is not null or exists(select 1 from public.timecards where company_id=company and source_shift_id=s.id) then raise exception 'Only unposted submitted time may be returned for correction';end if;
 update public.employee_shift_sessions set status='rejected',owner_note=reason,approved_by=auth.uid(),approved_at=clock_timestamp(),updated_at=clock_timestamp() where id=s.id and company_id=company;
 return s.id;
end $$;
revoke all on function public.carez_reject_shift_v1(uuid,text) from public,anon;
grant execute on function public.carez_reject_shift_v1(uuid,text) to authenticated;

-- Financial setup and wage history are office records, not employee-directory data.
alter policy labor_configuration_read on public.labor_configuration_versions using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
alter policy labor_tax_year_read on public.labor_tax_year_accounts using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
alter policy labor_tax_allocation_read on public.labor_tax_allocations using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
