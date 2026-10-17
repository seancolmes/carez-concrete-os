-- Employer-cost configuration is supplied and verified by the contractor.
-- No statutory rates, wage bases, opening YTD amounts or historical classifications are seeded.
set local search_path=pg_catalog,public,extensions;
create table public.labor_configuration_versions(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 request_id uuid not null,kind text not null check(kind in ('tax','risk')),tax_year integer not null,
 risk_class_code text,source_record_id uuid not null,recorded_values jsonb not null,reason text not null,
 actor_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(company_id,id),unique(company_id,request_id)
);
alter table public.labor_configuration_versions enable row level security;
create policy labor_configuration_read on public.labor_configuration_versions for select to authenticated using(company_id=public.get_my_company_id());
revoke all on public.labor_configuration_versions from public,anon,authenticated;
grant select on public.labor_configuration_versions to authenticated;
create function public.carez_immutable_labor_configuration() returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'Verified labor configuration history is immutable';end $$;
revoke all on function public.carez_immutable_labor_configuration() from public,anon,authenticated;
create trigger immutable_labor_configuration before update or delete on public.labor_configuration_versions for each row execute function public.carez_immutable_labor_configuration();

create or replace function public.carez_required_labor_number(p_values jsonb,p_key text,p_max numeric,p_scale integer)
returns numeric language plpgsql immutable set search_path=pg_catalog as $$
declare value numeric;raw text:=nullif(btrim(p_values->>p_key),'');
begin
 if raw is null then raise exception 'Recorded % is required',p_key;end if;
 begin value:=raw::numeric;exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid %',p_key;end;
 if value::text in ('NaN','Infinity','-Infinity') or value<0 or value>p_max or value<>round(value,p_scale) then raise exception 'Invalid finite nonnegative % within its recorded precision',p_key;end if;
 return value;
end $$;
revoke all on function public.carez_required_labor_number(jsonb,text,numeric,integer) from public,anon,authenticated;

create or replace function public.carez_configure_labor_tax_v1(p_request_id uuid,p_kind text,p_tax_year integer,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; snapshot jsonb; record_id uuid; version_id uuid; reason text:=nullif(btrim(p_values->>'reason'),'');
 ss numeric;ss_base numeric;medicare numeric;futa numeric;futa_base numeric;sui numeric;sui_base numeric;sick numeric;
composite numeric;employee_rate numeric;employer_rate numeric;v_code text;label text;active_value boolean;
begin
 request:=public.carez_financial_request_begin(p_request_id,'configure_labor_'||coalesce(p_kind,''),jsonb_build_object('tax_year',p_tax_year,'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;
 company:=(request->>'company_id')::uuid;
 if p_tax_year is null or p_tax_year not between 2000 and 2100 or p_kind is null or p_kind not in ('tax','risk') then raise exception 'Select a supported tax year and configuration kind';end if;
 if reason is null or length(reason)>1000 then raise exception 'A verification reference or reason is required';end if;
 if p_kind='tax' then
  ss:=public.carez_required_labor_number(p_values,'social_security_rate',1,6);ss_base:=public.carez_required_labor_number(p_values,'social_security_wage_base',9999999999.99,2);
  medicare:=public.carez_required_labor_number(p_values,'medicare_rate',1,6);futa:=public.carez_required_labor_number(p_values,'futa_rate',1,6);
  futa_base:=public.carez_required_labor_number(p_values,'futa_wage_base',9999999999.99,2);sui:=public.carez_required_labor_number(p_values,'wa_sui_rate',1,6);
  sui_base:=public.carez_required_labor_number(p_values,'wa_sui_wage_base',9999999999.99,2);sick:=public.carez_required_labor_number(p_values,'sick_leave_accrual_rate',1,6);
  insert into public.labor_tax_settings(company_id,tax_year,social_security_rate,social_security_wage_base,medicare_rate,futa_rate,futa_wage_base,wa_sui_rate,wa_sui_wage_base,sick_leave_accrual_rate)
   values(company,p_tax_year,ss,ss_base,medicare,futa,futa_base,sui,sui_base,sick)
   on conflict(company_id,tax_year) do update set social_security_rate=excluded.social_security_rate,social_security_wage_base=excluded.social_security_wage_base,medicare_rate=excluded.medicare_rate,futa_rate=excluded.futa_rate,futa_wage_base=excluded.futa_wage_base,wa_sui_rate=excluded.wa_sui_rate,wa_sui_wage_base=excluded.wa_sui_wage_base,sick_leave_accrual_rate=excluded.sick_leave_accrual_rate,updated_at=clock_timestamp()
   returning id,to_jsonb(labor_tax_settings) into record_id,snapshot;
 else
  v_code:=nullif(btrim(p_values->>'code'),'');label:=nullif(btrim(p_values->>'name'),'');
  if v_code is null or length(v_code)>30 or label is null or length(label)>200 or (p_values->>'active') is null or p_values->>'active' not in ('true','false') then raise exception 'Work class code, name and explicit active status are required';end if;
  composite:=public.carez_required_labor_number(p_values,'composite_rate_per_hour',99999.99999,5);
  employee_rate:=public.carez_required_labor_number(p_values,'employee_deduction_per_hour',99999.99999,5);
  employer_rate:=public.carez_required_labor_number(p_values,'employer_rate_per_hour',99999.99999,5);active_value:=(p_values->>'active')::boolean;
  insert into public.li_risk_classes(company_id,tax_year,code,name,composite_rate_per_hour,employee_deduction_per_hour,employer_rate_per_hour,active)
   values(company,p_tax_year,v_code,label,composite,employee_rate,employer_rate,active_value)
   on conflict(company_id,tax_year,code) do update set name=excluded.name,composite_rate_per_hour=excluded.composite_rate_per_hour,employee_deduction_per_hour=excluded.employee_deduction_per_hour,employer_rate_per_hour=excluded.employer_rate_per_hour,active=excluded.active
   returning id,to_jsonb(li_risk_classes) into record_id,snapshot;
 end if;
 insert into public.labor_configuration_versions(company_id,request_id,kind,tax_year,risk_class_code,source_record_id,recorded_values,reason,actor_id)
 values(company,p_request_id,p_kind,p_tax_year,v_code,record_id,snapshot,reason,auth.uid()) returning id into version_id;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',version_id,'source_record_id',record_id));
end $$;
revoke all on function public.carez_configure_labor_tax_v1(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.carez_configure_labor_tax_v1(uuid,text,integer,jsonb) to authenticated;
revoke insert,update,delete on public.labor_tax_settings,public.li_risk_classes from authenticated;

create table public.labor_tax_year_accounts(
 company_id uuid not null references public.companies(id),crew_member_id uuid not null,tax_year integer not null,
 opening_as_of date not null,opening_social_security_wages numeric(14,2) not null,
 opening_futa_wages numeric(14,2) not null,opening_wa_sui_wages numeric(14,2) not null,
 verification_reference text not null,verified_by uuid not null,verified_at timestamptz not null default clock_timestamp(),
 opening_request_id uuid not null,last_tax_date date,
 primary key(company_id,crew_member_id,tax_year),foreign key(company_id,crew_member_id) references public.crew_members(company_id,id)
);
alter table public.labor_tax_year_accounts enable row level security;
create policy labor_tax_year_read on public.labor_tax_year_accounts for select to authenticated using(company_id=public.get_my_company_id());
revoke all on public.labor_tax_year_accounts from public,anon,authenticated;
grant select on public.labor_tax_year_accounts to authenticated;
create function public.carez_guard_tax_year_opening() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then raise exception 'Verified tax-year opening is immutable';end if;
 if (to_jsonb(new)-'last_tax_date') is distinct from (to_jsonb(old)-'last_tax_date') then raise exception 'Verified tax-year opening is immutable';end if;
 return new;
end $$;
revoke all on function public.carez_guard_tax_year_opening() from public,anon,authenticated;
create trigger immutable_tax_year_opening before update or delete on public.labor_tax_year_accounts for each row execute function public.carez_guard_tax_year_opening();

create or replace function public.carez_verify_labor_opening_v1(p_request_id uuid,p_member_id uuid,p_tax_year integer,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; opening_date date;ss numeric;futa numeric;sui numeric;reference text:=nullif(btrim(p_values->>'verification_reference'),'');
begin
 request:=public.carez_financial_request_begin(p_request_id,'verify_labor_opening',jsonb_build_object('crew_member_id',p_member_id,'tax_year',p_tax_year,'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;
 company:=(request->>'company_id')::uuid;
 if p_tax_year is null or p_tax_year not between 2000 and 2100 or reference is null or length(reference)>1000 then raise exception 'Tax year and verified payroll reference are required';end if;
 perform 1 from public.crew_members where id=p_member_id and company_id=company for update;
 if not found then raise exception 'Worker unavailable in this company';end if;
 opening_date:=nullif(p_values->>'opening_as_of','')::date;
 if opening_date is null or opening_date<make_date(p_tax_year,1,1)-1 or opening_date>make_date(p_tax_year,12,31) then raise exception 'Opening date must identify the payroll already included for this tax year';end if;
 ss:=public.carez_required_labor_number(p_values,'social_security_wages',999999999999.99,2);
 futa:=public.carez_required_labor_number(p_values,'futa_wages',999999999999.99,2);sui:=public.carez_required_labor_number(p_values,'wa_sui_wages',999999999999.99,2);
 if exists(select 1 from public.labor_tax_year_accounts where company_id=company and crew_member_id=p_member_id and tax_year=p_tax_year) then raise exception 'A verified opening already exists; a correction requires an audited adjustment, not overwriting history';end if;
 if exists(select 1 from public.timecards t where t.company_id=company and t.crew_member_id=p_member_id and t.approval_status='approved' and t.worker_type_snapshot is distinct from 'owner' and t.worker_type_snapshot is distinct from 'subcontractor'
   and ((to_jsonb(t)->>'payroll_tax_date') is null or extract(year from (to_jsonb(t)->>'payroll_tax_date')::date)=p_tax_year)) then
  raise exception 'Existing employee cost history must be reconciled before establishing the opening basis';
 end if;
 insert into public.labor_tax_year_accounts(company_id,crew_member_id,tax_year,opening_as_of,opening_social_security_wages,opening_futa_wages,opening_wa_sui_wages,verification_reference,verified_by,opening_request_id)
 values(company,p_member_id,p_tax_year,opening_date,ss,futa,sui,reference,auth.uid(),p_request_id);
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'crew_member_id',p_member_id,'tax_year',p_tax_year));
end $$;
revoke all on function public.carez_verify_labor_opening_v1(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.carez_verify_labor_opening_v1(uuid,uuid,integer,jsonb) to authenticated;
revoke insert,update,delete on public.employee_tax_status from authenticated;
