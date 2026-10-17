-- Payroll is a funding register for already approved cost, not a tax recalculator.
set local search_path=pg_catalog,public,extensions;
alter table public.payroll_runs add column if not exists contract_version text;
alter table public.payroll_runs add column if not exists source_fingerprint text;
alter table public.payroll_run_lines add column if not exists source_timecard_snapshot jsonb;
create unique index if not exists payroll_run_tenant_identity on public.payroll_runs(company_id,id);
alter table public.payroll_run_lines add constraint payroll_line_run_tenant foreign key(company_id,payroll_run_id) references public.payroll_runs(company_id,id) not valid;
alter table public.payroll_run_lines add constraint payroll_line_timecard_tenant foreign key(company_id,timecard_id) references public.timecards(company_id,id) not valid;
alter table public.payroll_run_lines add constraint payroll_line_worker_tenant foreign key(company_id,crew_member_id) references public.crew_members(company_id,id) not valid;

create function public.carez_payroll_timecard_complete(t public.timecards) returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select coalesce(t.approval_status='approved' and t.worker_type_snapshot='employee'
  and t.labor_basis_source in ('terms_capture','historical_review','manual_review') and t.labor_cost_method='w2_verified_caps_v1'
  and t.crew_member_id is not null and t.payroll_tax_date is not null and t.statutory_basis->>'version'='verified_employer_cost_caps_v1'
  and not exists(select 1 from unnest(array[t.regular_hours,t.overtime_hours,t.base_hourly_rate,t.gross_wage_cost,t.employer_social_security_cost,t.employer_medicare_cost,t.employer_futa_cost,t.employer_wa_sui_cost,t.employer_li_cost,t.sick_leave_reserve_cost,t.direct_labor_cost]) n where n is null or n<0 or n::text in ('NaN','Infinity','-Infinity'))
  and exists(select 1 from public.labor_tax_allocations a where a.company_id=t.company_id and a.crew_member_id=t.crew_member_id and a.timecard_id=t.id and a.tax_date=t.payroll_tax_date and a.verified_basis=t.statutory_basis),false);
$$;
revoke all on function public.carez_payroll_timecard_complete(public.timecards) from public,anon;
grant execute on function public.carez_payroll_timecard_complete(public.timecards) to authenticated;
create view public.payroll_timecard_readiness with(security_invoker=true) as
 select t.*,public.carez_payroll_timecard_complete(t) eligible,
 case when t.worker_type_snapshot in ('owner','subcontractor') then 'Excluded: recorded internal-owner or subcontractor cost'
  when t.approval_status is distinct from 'approved' then 'Time approval required'
  when t.worker_type_snapshot is null then 'Historical financial classification unverified'
  when not public.carez_payroll_timecard_complete(t) then 'Frozen employee cost or payroll-year basis unavailable'
  else null end hold_reason
 from public.timecards t where not exists(select 1 from public.payroll_run_lines l where l.company_id=t.company_id and l.timecard_id=t.id and l.active);
revoke all on public.payroll_timecard_readiness from public,anon,authenticated;
grant select on public.payroll_timecard_readiness to authenticated;

create function public.carez_payroll_preview(p_company uuid,p_start date,p_end date,p_pay_date date) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,extensions as $$
declare result jsonb;
begin
 if p_start is null or p_end is null or p_end<p_start or p_pay_date is null or not isfinite(p_start) or not isfinite(p_end) or not isfinite(p_pay_date) then raise exception 'Finite period dates and reviewed pay date are required';end if;
 if exists(select 1 from public.payroll_timecard_readiness t where t.company_id=p_company and t.work_date between p_start and p_end and (t.payroll_tax_date is null or t.payroll_tax_date=p_pay_date) and t.worker_type_snapshot is distinct from 'owner' and t.worker_type_snapshot is distinct from 'subcontractor' and not t.eligible) then raise exception 'This period contains unverified or unapproved employee time; resolve Time review before creating funding';end if;
 select jsonb_build_object('timecard_ids',jsonb_agg(t.id order by t.id),'fingerprint',encode(extensions.digest(jsonb_agg(to_jsonb(t) order by t.id)::text,'sha256'),'hex'),
  'timecard_count',count(*),'worker_count',count(distinct t.crew_member_id),'gross_wages',sum(t.gross_wage_cost),
  'funding_requirement',sum(t.gross_wage_cost+t.employer_social_security_cost+t.employer_medicare_cost+t.employer_futa_cost+t.employer_wa_sui_cost+t.employer_li_cost),
  'sick_reserve',sum(t.sick_leave_reserve_cost),'pay_date',p_pay_date) into result
 from public.timecards t where t.company_id=p_company and t.work_date between p_start and p_end and t.payroll_tax_date=p_pay_date and public.carez_payroll_timecard_complete(t)
 and not exists(select 1 from public.payroll_run_lines l where l.company_id=p_company and l.timecard_id=t.id and l.active);
 if (result->>'timecard_count')::integer=0 then raise exception 'No approved unprocessed W2 timecards in this period';end if;
 result:=result||jsonb_build_object('other_pay_dates',coalesce((select jsonb_agg(jsonb_build_object('pay_date',x.payroll_tax_date,'timecard_count',x.count) order by x.payroll_tax_date) from (
  select t.payroll_tax_date,count(*)::integer count from public.payroll_timecard_readiness t where t.company_id=p_company and t.work_date between p_start and p_end and t.eligible and t.payroll_tax_date<>p_pay_date group by t.payroll_tax_date)x),'[]'::jsonb));
 return result;
end $$;
revoke all on function public.carez_payroll_preview(uuid,date,date,date) from public,anon,authenticated;
create function public.carez_preview_payroll_run_v2(p_period_start date,p_period_end date,p_pay_date date) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare company uuid;begin
 select company_id into company from public.profiles where id=auth.uid() and role in ('owner','office');if company is null then raise exception 'Owner or office authority required';end if;
 return public.carez_payroll_preview(company,p_period_start,p_period_end,p_pay_date);
end $$;
revoke all on function public.carez_preview_payroll_run_v2(date,date,date) from public,anon;
grant execute on function public.carez_preview_payroll_run_v2(date,date,date) to authenticated;

create function public.carez_create_payroll_run_v2(p_request_id uuid,p_period_start date,p_period_end date,p_pay_date date,p_timecard_ids uuid[],p_fingerprint text,p_notes text default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb;company uuid;preview jsonb;run_id uuid;ids uuid[];
begin
 request:=public.carez_financial_request_begin(p_request_id,'create_payroll_run',jsonb_build_object('start',p_period_start,'end',p_period_end,'pay_date',p_pay_date,'timecards',p_timecard_ids,'fingerprint',p_fingerprint,'notes',p_notes));if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 perform 1 from public.timecards where company_id=company and work_date between p_period_start and p_period_end order by id for update;
 preview:=public.carez_payroll_preview(company,p_period_start,p_period_end,p_pay_date);
 select array_agg(x::uuid order by x::uuid) into ids from jsonb_array_elements_text(preview->'timecard_ids')x;
 if p_timecard_ids is null or cardinality(p_timecard_ids)<>cardinality(ids) or (select array_agg(x order by x) from unnest(p_timecard_ids)x) is distinct from ids or p_fingerprint is distinct from preview->>'fingerprint' then raise exception 'Payroll preview changed; review the complete period again before creating it';end if;
 if length(coalesce(p_notes,''))>1000 then raise exception 'Payroll note must be within 1000 characters';end if;
 insert into public.payroll_runs(company_id,period_start,period_end,pay_date,notes,created_by,contract_version,source_fingerprint)
 values(company,p_period_start,p_period_end,p_pay_date,nullif(btrim(p_notes),''),auth.uid(),'frozen_w2_v2',p_fingerprint) returning id into run_id;
 insert into public.payroll_run_lines(company_id,payroll_run_id,timecard_id,crew_member_id,worker_name,work_date,regular_hours,overtime_hours,gross_wages,employer_social_security,employer_medicare,employer_futa,employer_wa_sui,employer_li,sick_leave_reserve,payroll_funding_requirement,source_timecard_snapshot)
 select company,run_id,t.id,t.crew_member_id,t.worker_name,t.work_date,t.regular_hours,t.overtime_hours,t.gross_wage_cost,t.employer_social_security_cost,t.employer_medicare_cost,t.employer_futa_cost,t.employer_wa_sui_cost,t.employer_li_cost,t.sick_leave_reserve_cost,
  t.gross_wage_cost+t.employer_social_security_cost+t.employer_medicare_cost+t.employer_futa_cost+t.employer_wa_sui_cost+t.employer_li_cost,to_jsonb(t)
 from public.timecards t where t.company_id=company and t.id=any(ids);
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',run_id));
end $$;
revoke all on function public.carez_create_payroll_run_v2(uuid,date,date,date,uuid[],text,text) from public,anon;
grant execute on function public.carez_create_payroll_run_v2(uuid,date,date,date,uuid[],text,text) to authenticated;

create function public.carez_assert_payroll_run(p_company uuid,p_run uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public,extensions as $$
declare run public.payroll_runs%rowtype;fingerprint text;
begin
 select * into run from public.payroll_runs where id=p_run and company_id=p_company;
 if run.id is null or run.contract_version is distinct from 'frozen_w2_v2' then raise exception 'Payroll run lacks a verified frozen basis; historical reconciliation is required';end if;
 if not exists(select 1 from public.payroll_run_lines where company_id=p_company and payroll_run_id=p_run and active) then raise exception 'Active payroll detail required';end if;
 if exists(select 1 from public.payroll_run_lines l left join public.timecards t on t.company_id=l.company_id and t.id=l.timecard_id where l.company_id=p_company and l.payroll_run_id=p_run and l.active and
  (t.id is null or not public.carez_payroll_timecard_complete(t) or l.source_timecard_snapshot is distinct from to_jsonb(t) or t.payroll_tax_date is distinct from run.pay_date or t.work_date not between run.period_start and run.period_end)) then raise exception 'Payroll detail differs from its approved immutable cost';end if;
 select encode(extensions.digest(jsonb_agg(l.source_timecard_snapshot order by l.timecard_id)::text,'sha256'),'hex') into fingerprint from public.payroll_run_lines l where l.company_id=p_company and l.payroll_run_id=p_run and l.active;
 if fingerprint is distinct from run.source_fingerprint then raise exception 'Payroll source fingerprint does not match';end if;
end $$;
revoke all on function public.carez_assert_payroll_run(uuid,uuid) from public,anon,authenticated;

create function public.carez_process_payroll_core(p_run uuid,p_cash numeric,p_reference text) returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare company uuid;run public.payroll_runs%rowtype;reference text:=nullif(btrim(p_reference),'');
begin
 select company_id into company from public.profiles where id=auth.uid() and role in ('owner','office');if company is null then raise exception 'Owner or office authority required';end if;
 perform 1 from public.companies where id=company for update;
 select * into run from public.payroll_runs where id=p_run and company_id=company for update;
 if run.id is null then raise exception 'Payroll run unavailable';end if;
 if p_cash is null or p_cash<0 or p_cash::text in ('NaN','Infinity','-Infinity') or p_cash<>round(p_cash,2) then raise exception 'Actual cash paid must be explicitly recorded to two decimals; missing is not zero';end if;
 if reference is null or length(reference)>120 then raise exception 'A payroll processing reference within 120 characters is required';end if;
 if run.status='processed' and run.actual_cash_paid=p_cash and run.reference_number=reference then return;end if;
 if run.status<>'approved' then raise exception 'Only an approved run may be marked processed';end if;
 perform public.carez_assert_payroll_run(company,p_run);
 update public.payroll_runs set status='processed',processed_at=clock_timestamp(),actual_cash_paid=p_cash,reference_number=reference,updated_at=clock_timestamp() where id=p_run and company_id=company;
end $$;
revoke all on function public.carez_process_payroll_core(uuid,numeric,text) from public,anon,authenticated;
-- Existing bank reconciliation calls this signature inside its governed definer.
create or replace function public.process_payroll_run(p_payroll_run_id uuid,p_actual_cash_paid numeric default null,p_reference_number text default null) returns void language sql security invoker set search_path=pg_catalog,public as $$select public.carez_process_payroll_core(p_payroll_run_id,p_actual_cash_paid,p_reference_number)$$;
revoke all on function public.process_payroll_run(uuid,numeric,text) from public,anon,authenticated;

create function public.carez_transition_payroll_run_v2(p_request_id uuid,p_run_id uuid,p_action text,p_actual_cash_paid numeric default null,p_reference_number text default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb;company uuid;run public.payroll_runs%rowtype;
begin
 request:=public.carez_financial_request_begin(p_request_id,'payroll_'||coalesce(p_action,''),jsonb_build_object('run_id',p_run_id,'action',p_action,'actual_cash',p_actual_cash_paid,'reference',p_reference_number));if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 select * into run from public.payroll_runs where id=p_run_id and company_id=company for update;if run.id is null then raise exception 'Payroll run unavailable';end if;
 if p_action='approve' then
  if run.status<>'draft' then raise exception 'Only a draft run may be approved';end if;perform public.carez_assert_payroll_run(company,p_run_id);
  update public.payroll_runs set status='approved',approved_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_run_id and company_id=company;
 elsif p_action='process' then perform public.carez_process_payroll_core(p_run_id,p_actual_cash_paid,p_reference_number);
 elsif p_action='void' then
  if run.status not in ('draft','approved') then raise exception 'Only an open unprocessed run may be voided';end if;
  update public.payroll_runs set status='void',voided_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_run_id and company_id=company;
  update public.payroll_run_lines set active=false where payroll_run_id=p_run_id and company_id=company and active;
 else raise exception 'Unsupported payroll transition';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',p_run_id));
end $$;
revoke all on function public.carez_transition_payroll_run_v2(uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.carez_transition_payroll_run_v2(uuid,uuid,text,numeric,text) to authenticated;
revoke all on function public.create_payroll_run(date,date,date,text),public.approve_payroll_run(uuid),public.void_payroll_run(uuid) from public,anon,authenticated;
revoke insert,update,delete on public.payroll_runs,public.payroll_run_lines from authenticated;

create function public.carez_guard_payroll_record() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if current_user not in ('postgres','supabase_admin','service_role') then raise exception 'Use governed payroll funding actions';end if;
 if tg_op='DELETE' then raise exception 'Payroll history is retained through void, never deletion';end if;
 if tg_table_name='payroll_runs' then
  if tg_op='UPDATE' then
   if (to_jsonb(new)-array['status','approved_at','processed_at','voided_at','actual_cash_paid','reference_number','bank_transaction_id','updated_at']) is distinct from (to_jsonb(old)-array['status','approved_at','processed_at','voided_at','actual_cash_paid','reference_number','bank_transaction_id','updated_at']) then raise exception 'Payroll period and frozen basis are immutable';end if;
   if not (new.status=old.status or (old.status='draft' and new.status in ('approved','void')) or (old.status='approved' and new.status in ('processed','void'))) then raise exception 'Invalid payroll transition';end if;
   if old.status='processed' and (new.actual_cash_paid,new.reference_number,new.processed_at) is distinct from (old.actual_cash_paid,old.reference_number,old.processed_at) then raise exception 'Processed payroll cash facts are immutable';end if;
   if old.bank_transaction_id is not null and new.bank_transaction_id is distinct from old.bank_transaction_id then raise exception 'Payroll is already linked to a bank transaction';end if;
  end if;
 else
  if tg_op='UPDATE' and ((to_jsonb(new)-'active') is distinct from (to_jsonb(old)-'active') or new.active or not exists(select 1 from public.payroll_runs where company_id=old.company_id and id=old.payroll_run_id and status='void')) then raise exception 'Payroll line snapshots are immutable; only void releases active inclusion';end if;
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_payroll_record() from public,anon,authenticated;
create trigger governed_payroll_run before insert or update or delete on public.payroll_runs for each row execute function public.carez_guard_payroll_record();
create trigger governed_payroll_line before insert or update or delete on public.payroll_run_lines for each row execute function public.carez_guard_payroll_record();

-- Keep void-period history visible. It no longer contributes active funding.
create or replace view public.payroll_run_financial_summary with(security_invoker=true) as
 select r.id payroll_run_id,r.company_id,r.period_start,r.period_end,r.pay_date,r.status,r.actual_cash_paid,r.reference_number,r.notes,r.approved_at,r.processed_at,r.voided_at,r.created_at,
 sum(l.regular_hours) regular_hours,sum(l.overtime_hours) overtime_hours,sum(l.gross_wages) gross_wages,
 sum(l.employer_social_security+l.employer_medicare+l.employer_futa+l.employer_wa_sui) employer_payroll_taxes,
 sum(l.employer_li) employer_li,sum(l.sick_leave_reserve) sick_leave_reserve,sum(l.payroll_funding_requirement) payroll_funding_requirement,
 count(l.id)::integer timecard_count,count(distinct l.crew_member_id)::integer worker_count,
 coalesce(r.contract_version='frozen_w2_v2' and count(l.id)>0 and bool_and(l.source_timecard_snapshot is not null),false) basis_complete,
 r.contract_version,r.source_fingerprint
 from public.payroll_runs r left join public.payroll_run_lines l on l.company_id=r.company_id and l.payroll_run_id=r.id and (l.active or r.status='void') group by r.id;
create or replace view public.payroll_unprocessed_worker_summary with(security_invoker=true) as
 select t.company_id,t.crew_member_id,(array_agg(t.worker_name order by t.work_date desc,t.created_at desc,t.id desc))[1] worker_name,min(t.work_date) first_unprocessed_date,max(t.work_date) last_unprocessed_date,count(*)::integer timecard_count,
 sum(t.regular_hours) regular_hours,sum(t.overtime_hours) overtime_hours,sum(t.gross_wage_cost) gross_wages,
 sum(t.employer_social_security_cost+t.employer_medicare_cost+t.employer_futa_cost+t.employer_wa_sui_cost) employer_payroll_taxes,
 sum(t.employer_li_cost) employer_li,sum(t.sick_leave_reserve_cost) sick_leave_reserve,
 sum(t.gross_wage_cost+t.employer_social_security_cost+t.employer_medicare_cost+t.employer_futa_cost+t.employer_wa_sui_cost+t.employer_li_cost) payroll_funding_requirement
 from public.payroll_timecard_readiness t where t.eligible group by t.company_id,t.crew_member_id;

create or replace view public.company_payroll_cash_summary with(security_invoker=true) as
 with unprocessed as (select company_id,sum(gross_wages) gross,sum(employer_payroll_taxes) taxes,sum(employer_li) li,sum(sick_leave_reserve) sick,
 sum(payroll_funding_requirement) funding,sum(timecard_count)::integer timecards,count(*)::integer workers from public.payroll_unprocessed_worker_summary group by company_id),
 runs as (select company_id,sum(payroll_funding_requirement) funding,count(*)::integer open_count,sum(sick_leave_reserve) sick,count(*) filter(where not basis_complete)::integer held
 from public.payroll_run_financial_summary where status in ('draft','approved') group by company_id),
 held as (select company_id,count(*)::integer count from public.payroll_timecard_readiness where worker_type_snapshot is distinct from 'owner' and worker_type_snapshot is distinct from 'subcontractor' and not eligible group by company_id)
 select c.id company_id,coalesce(u.gross,0::numeric) unprocessed_gross_wages,coalesce(u.taxes,0::numeric) unprocessed_employer_payroll_taxes,
 coalesce(u.li,0::numeric) unprocessed_li,coalesce(u.sick,0::numeric) unprocessed_sick_reserve,coalesce(u.funding,0::numeric) unprocessed_funding_requirement,
 coalesce(u.timecards,0) unprocessed_timecard_count,coalesce(u.workers,0) workers_with_unprocessed_time,
 case when coalesce(r.held,0)=0 then coalesce(r.funding,0::numeric) else null::numeric end open_run_funding_requirement,
 coalesce(r.open_count,0) open_run_count,coalesce(r.sick,0::numeric) open_run_sick_reserve,
 case when coalesce(h.count,0)+coalesce(r.held,0)=0 then round(coalesce(u.funding,0::numeric)+coalesce(r.funding,0::numeric),2) else null::numeric end total_open_payroll_requirement,
 case when coalesce(h.count,0)+coalesce(r.held,0)=0 then round(coalesce(u.sick,0::numeric)+coalesce(r.sick,0::numeric),2) else null::numeric end future_sick_leave_reserve,
 coalesce(h.count,0) held_timecard_count,coalesce(r.held,0) unverified_open_run_count
 from public.companies c left join unprocessed u on u.company_id=c.id left join runs r on r.company_id=c.id left join held h on h.company_id=c.id;

-- Preserve downstream view columns/lineage while allowing unavailable payroll to
-- propagate. Do not drop dependent views or turn an unverified obligation into0.
do $$ declare definition text;replacement text;begin
 definition:=pg_get_viewdef('public.company_cash_position_summary'::regclass,true);
 replacement:=regexp_replace(definition,'COALESCE\(pc\.total_open_payroll_requirement, 0::numeric\)','pc.total_open_payroll_requirement','gi');
 if replacement=definition then raise exception 'Cash-position payroll dependency differs from the verified source contract';end if;
 execute 'create or replace view public.company_cash_position_summary with(security_invoker=true) as '||replacement;
end $$;
