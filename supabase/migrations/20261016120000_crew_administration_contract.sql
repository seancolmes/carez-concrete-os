-- Reconcile the recorded production Crew shape before adding atomic administration.
-- No rates, worker classifications or statutory settings are invented for existing rows.
-- Crew shape compatibility is installed in110000 before recovered views.
do $$ begin
 if exists(select 1 from public.crew_members where is_owner is distinct from (worker_type='owner')) then raise exception 'Recorded Crew owner flags and worker classifications conflict. Review those records before installing effective terms; no history was inferred.';end if;
end $$;
create unique index if not exists crew_member_company_identity on public.crew_members(company_id,id);
create table if not exists public.crew_rate_history(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 crew_member_id uuid not null references public.crew_members(id) on delete cascade,
 rate_type text not null check(rate_type in ('hourly_wage','owner_internal','subcontractor_hourly','day_rate')),
 amount numeric(10,2) not null check(amount>=0),effective_date date not null,end_date date,notes text,created_at timestamptz not null default now(),
 unique(crew_member_id,rate_type,effective_date)
);
alter table public.crew_rate_history enable row level security;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.crew_rate_history'::regclass and conname='crew_history_tenant_member') then
  alter table public.crew_rate_history add constraint crew_history_tenant_member foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) not valid;
  alter table public.crew_rate_history validate constraint crew_history_tenant_member;
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='crew_rate_history') then
  create policy crew_history_company_read on public.crew_rate_history for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
 end if;
end $$;
revoke all on public.crew_rate_history from public,anon,authenticated;
grant select on public.crew_rate_history to authenticated;

create table public.crew_employment_terms(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),crew_member_id uuid not null,
 administration_revision integer not null,effective_date date not null,
 worker_type text not null check(worker_type in ('employee','owner','subcontractor')),
 availability_type text not null check(availability_type in ('regular','on_call')),
 hourly_rate numeric(10,2),internal_field_rate numeric(10,2),default_risk_class_code text,
 source_type text not null check(source_type in ('legacy_current_record','administration')),
 reason text not null,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),
 unique(company_id,id),unique(crew_member_id,administration_revision),
 foreign key(company_id,crew_member_id) references public.crew_members(company_id,id),
 check(hourly_rate is null or (hourly_rate>=0 and hourly_rate::text not in ('NaN','Infinity','-Infinity'))),
 check(internal_field_rate is null or (internal_field_rate>=0 and internal_field_rate::text not in ('NaN','Infinity','-Infinity')))
);
-- This is a current-record snapshot, explicitly NOT proof of historical employment terms.
insert into public.crew_employment_terms(company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,hourly_rate,internal_field_rate,default_risk_class_code,source_type,reason)
 select company_id,id,administration_revision,coalesce(public.carez_company_calendar_date(company_id,clock_timestamp()),current_date),worker_type,availability_type,hourly_rate,internal_field_rate,default_risk_class_code,'legacy_current_record','Recorded Crew fields at contract installation; earlier terms are not established. Effective date uses the configured company calendar, or the server capture date while the company calendar is unavailable.' from public.crew_members;
create table public.crew_administration_requests(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),request_id uuid not null,
 crew_member_id uuid not null,payload jsonb not null,before_record jsonb,result jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 unique(company_id,request_id),foreign key(company_id,crew_member_id) references public.crew_members(company_id,id)
);
alter table public.crew_employment_terms enable row level security;
alter table public.crew_administration_requests enable row level security;
create policy crew_terms_company_read on public.crew_employment_terms for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy crew_requests_company_read on public.crew_administration_requests for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.crew_employment_terms,public.crew_administration_requests from public,anon,authenticated;
grant select on public.crew_employment_terms,public.crew_administration_requests to authenticated;
create function public.carez_immutable_crew_history() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'Crew administration history is append-only.'; end $$;
create trigger immutable_crew_terms before update or delete on public.crew_employment_terms for each row execute function public.carez_immutable_crew_history();
create trigger immutable_crew_requests before update or delete on public.crew_administration_requests for each row execute function public.carez_immutable_crew_history();

create or replace function public.carez_crew_administration_contract() returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('version',1,'atomic_mutations',true);
$$;
revoke all on function public.carez_crew_administration_contract() from public,anon;
grant execute on function public.carez_crew_administration_contract() to authenticated;

create or replace function public.carez_administer_crew(p_operation text,p_request_id uuid,p_member_id uuid,p_expected_revision integer,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_member public.crew_members%rowtype;v_terms public.crew_employment_terms%rowtype;
 v_payload jsonb:=jsonb_build_array(p_operation,p_member_id,p_expected_revision,p_values);v_previous public.crew_administration_requests%rowtype;
 v_today date;v_date date;v_hourly numeric;v_internal numeric;v_worker text;v_availability text;v_risk text;v_reason text;v_id uuid;v_revision integer;v_rate numeric;v_rate_type text;v_result jsonb;
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 perform 1 from public.companies where id=v_company for update;
 if not found then raise exception 'Company unavailable.';end if;
 if p_request_id is null or p_operation is null or p_operation not in ('create','update','rate') or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid Crew request.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||p_request_id::text,0));
 select * into v_previous from public.crew_administration_requests where company_id=v_company and request_id=p_request_id;
 if found then
  if v_previous.payload is distinct from v_payload then raise exception 'This request already saved different Crew values. Reopen the saved worker.';end if;
  return v_previous.result;
 end if;
 v_today:=public.carez_company_calendar_date(v_company,clock_timestamp());
 if v_today is null then raise exception 'Configure the company operating calendar before changing Crew terms.';end if;
 if nullif(p_values->>'effective_date','') is null or nullif(btrim(p_values->>'reason'),'') is null or length(btrim(p_values->>'reason'))>1000 then raise exception 'Effective date and reason are required.';end if;
 v_date:=(p_values->>'effective_date')::date;v_reason:=btrim(p_values->>'reason');
 if p_operation='create' then
  if p_member_id is not null or p_expected_revision is not null then raise exception 'Invalid new worker identity.';end if;
  if v_date>v_today then raise exception 'Initial terms must be effective by today. Record a future employment start separately, then schedule later terms from the recorded worker.';end if;
  v_id:=gen_random_uuid();v_revision:=1;
 else
  select * into v_member from public.crew_members where company_id=v_company and id=p_member_id for update;
  if not found then raise exception 'Worker unavailable in this company.';end if;
  if p_expected_revision is null or v_member.administration_revision<>p_expected_revision then raise exception 'Worker changed. Reopen the current record before saving.';end if;
  if p_operation='update' and v_date>v_today and (p_values->>'active')::boolean is distinct from v_member.active then raise exception 'Active status changes require a current effective date. Future employment terms cannot deactivate current access early.';end if;
  v_id:=v_member.id;v_revision:=v_member.administration_revision+1;
 end if;
 if p_operation='rate' then
  select * into v_terms from public.crew_employment_terms where company_id=v_company and crew_member_id=v_id and effective_date<=v_date order by effective_date desc,administration_revision desc limit 1;
  if not found then raise exception 'Recorded worker terms are required for that effective date.';end if;
  v_worker:=v_terms.worker_type;v_availability:=v_terms.availability_type;v_risk:=v_terms.default_risk_class_code;
  v_rate:=(p_values->>'amount')::numeric;
  if v_rate is null then raise exception 'Recorded rate is required.';end if;
  v_hourly:=case when v_worker='owner' then v_terms.hourly_rate else v_rate end;
  v_internal:=case when v_worker='owner' then v_rate else v_terms.internal_field_rate end;
 else
  if nullif(btrim(p_values->>'name'),'') is null or length(btrim(p_values->>'name'))>200 or nullif(btrim(p_values->>'role'),'') is null or length(btrim(p_values->>'role'))>120 then raise exception 'Worker name and role are required.';end if;
  v_worker:=p_values->>'worker_type';v_availability:=p_values->>'availability_type';
  if v_worker is null or v_worker not in ('employee','owner','subcontractor') or v_availability is null or v_availability not in ('regular','on_call') then raise exception 'Invalid worker classification.';end if;
  v_hourly:=(p_values->>'hourly_rate')::numeric;v_internal:=(p_values->>'internal_field_rate')::numeric;v_risk:=nullif(btrim(p_values->>'default_risk_class_code'),'');
  if (v_worker='owner' and coalesce(v_internal,v_hourly) is null) or (v_worker<>'owner' and v_hourly is null) then raise exception 'Applicable recorded rate is required.';end if;
  if v_worker='owner' then v_internal:=coalesce(v_internal,v_hourly);end if;
  if jsonb_typeof(p_values->'skills') is distinct from 'array' or exists(select 1 from jsonb_array_elements_text(p_values->'skills') s where s not in ('Formwork','Rebar','Placement','Flatwork','Broom Finish','V-Groove','China Trowel','Hard Trowel','Walls','Foundations','Curb / Gutter','Sawcutting','Layout')) then raise exception 'Invalid worker skills.';end if;
 end if;
 if exists(select 1 from unnest(array[v_hourly,v_internal,v_rate]) n where n is not null and (n<0 or n>99999999.99 or n::text in ('NaN','Infinity','-Infinity') or n<>round(n,2))) then raise exception 'Rates must be finite, nonnegative amounts to two decimals.';end if;
 if p_operation='create' then
  insert into public.crew_members(id,company_id,name,role,hourly_rate,internal_field_rate,is_owner,worker_type,availability_type,employment_type,start_date,phone,skills,default_risk_class_code,active,administration_revision)
   values(v_id,v_company,btrim(p_values->>'name'),btrim(p_values->>'role'),v_hourly,v_internal,v_worker='owner',v_worker,v_availability,case when v_worker='subcontractor' then 'subcontractor' when v_availability='on_call' then 'on_call' else 'employee' end,(p_values->>'start_date')::date,nullif(btrim(p_values->>'phone'),''),array(select jsonb_array_elements_text(p_values->'skills')),v_risk,true,v_revision);
 else
  update public.crew_members set name=case when p_operation='rate' then name else btrim(p_values->>'name') end,
   role=case when p_operation='rate' then role else btrim(p_values->>'role') end,
   start_date=case when p_operation='rate' then start_date else (p_values->>'start_date')::date end,
   phone=case when p_operation='rate' then phone else nullif(btrim(p_values->>'phone'),'') end,
   skills=case when p_operation='rate' then skills else array(select jsonb_array_elements_text(p_values->'skills')) end,
   active=case when p_operation='rate' then active else (p_values->>'active')::boolean end,administration_revision=v_revision where company_id=v_company and id=v_id;
 end if;
 insert into public.crew_employment_terms(company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,hourly_rate,internal_field_rate,default_risk_class_code,source_type,reason,created_by)
  values(v_company,v_id,v_revision,v_date,v_worker,v_availability,v_hourly,v_internal,v_risk,'administration',v_reason,auth.uid());
 v_rate_type:=case v_worker when 'owner' then 'owner_internal' when 'subcontractor' then 'subcontractor_hourly' else 'hourly_wage' end;
 v_rate:=case when v_worker='owner' then v_internal else v_hourly end;
 insert into public.crew_rate_history(company_id,crew_member_id,rate_type,amount,effective_date,notes) values(v_company,v_id,v_rate_type,v_rate,v_date,v_reason)
  on conflict(crew_member_id,rate_type,effective_date) do update set amount=excluded.amount,notes=excluded.notes;
 -- Compatibility history end dates are inclusive; immutable term versions retain every edit.
 with periods as(select id,lead(effective_date) over(order by effective_date)-1 as end_date from public.crew_rate_history where company_id=v_company and crew_member_id=v_id and rate_type=v_rate_type)
 update public.crew_rate_history h set end_date=p.end_date from periods p where h.id=p.id;
 select * into v_terms from public.crew_employment_terms where company_id=v_company and crew_member_id=v_id and effective_date<=current_date order by effective_date desc,administration_revision desc limit 1;
 if found then update public.crew_members set hourly_rate=v_terms.hourly_rate,internal_field_rate=v_terms.internal_field_rate,worker_type=v_terms.worker_type,is_owner=v_terms.worker_type='owner',availability_type=v_terms.availability_type,default_risk_class_code=v_terms.default_risk_class_code,
  employment_type=case when v_terms.worker_type='subcontractor' then 'subcontractor' when v_terms.availability_type='on_call' then 'on_call' else 'employee' end where company_id=v_company and id=v_id;end if;
 v_result:=jsonb_build_object('crew_member_id',v_id,'administration_revision',v_revision);
 insert into public.crew_administration_requests(company_id,request_id,crew_member_id,payload,before_record,result,created_by) values(v_company,p_request_id,v_id,v_payload,case when p_operation='create' then null else to_jsonb(v_member) end,v_result,auth.uid());
 return v_result;
end $$;
revoke all on function public.carez_administer_crew(text,uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.carez_administer_crew(text,uuid,uuid,integer,jsonb) to authenticated;

create view public.crew_administration_summary with(security_invoker=true) as
 select c.id,c.company_id,c.profile_id,c.name,c.role,c.day_rate,c.rating,c.available,c.phone,c.skills,c.created_at,c.active,c.start_date,c.end_date,c.notes,c.can_report_production,c.administration_revision,
 coalesce(t.worker_type,c.worker_type) worker_type,coalesce(t.availability_type,c.availability_type) availability_type,
 case when t.id is null then c.hourly_rate else t.hourly_rate end hourly_rate,case when t.id is null then c.internal_field_rate else t.internal_field_rate end internal_field_rate,
 case when t.id is null then c.default_risk_class_code else t.default_risk_class_code end default_risk_class_code,
 coalesce(t.worker_type,c.worker_type)='owner' is_owner,
 case when coalesce(t.worker_type,c.worker_type)='subcontractor' then 'subcontractor' when coalesce(t.availability_type,c.availability_type)='on_call' then 'on_call' else 'employee' end employment_type,
 t.id terms_id,t.effective_date terms_effective_date,t.source_type terms_source_type
 from public.crew_members c left join lateral(select * from public.crew_employment_terms t where t.company_id=c.company_id and t.crew_member_id=c.id and t.effective_date<=public.carez_company_calendar_date(c.company_id,now()) order by t.effective_date desc,t.administration_revision desc limit 1)t on true;
revoke all on public.crew_administration_summary from public,anon;grant select on public.crew_administration_summary to authenticated;

revoke all on function public.carez_immutable_crew_history() from public,anon,authenticated;
