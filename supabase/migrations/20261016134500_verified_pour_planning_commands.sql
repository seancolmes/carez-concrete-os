-- Planning is an estimate, never a posted timecard or tax allocation. Forecasts
-- retain their verified input basis; unknown historical labor is not free work.
set local search_path=pg_catalog,public,extensions,pg_temp;
alter table public.pour_cost_items add column forecast_basis jsonb;

create function public.carez_pour_labor_forecast(p_company uuid,p_plan public.pour_plans,p_worker uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare worker public.crew_members%rowtype;terms public.crew_employment_terms%rowtype;
 tax public.labor_tax_settings%rowtype;risk public.li_risk_classes%rowtype;opening public.labor_tax_year_accounts%rowtype;
 tax_version uuid;risk_version uuid;tax_day date;v_year integer;regular numeric;ot numeric;hours numeric;rate numeric;gross numeric;cost numeric;
 ss_before numeric;futa_before numeric;sui_before numeric;ss_wages numeric;futa_wages numeric;sui_wages numeric;basis jsonb;entry record;
 prior_ss numeric;prior_futa numeric;prior_sui numeric;prior_ids jsonb;
begin
 if p_plan.company_id is distinct from p_company or p_plan.scheduled_date is null then raise exception 'Set an explicit pour date before forecasting labor';end if;
 select * into worker from public.crew_members where company_id=p_company and id=p_worker and active for update;
 if not found then raise exception 'Active worker unavailable';end if;
 select * into terms from public.crew_employment_terms where company_id=p_company and crew_member_id=worker.id and effective_date<=p_plan.scheduled_date order by effective_date desc,administration_revision desc limit 1;
 if not found then raise exception 'Recorded worker terms are unavailable for this pour date';end if;
 rate:=case when terms.worker_type='owner' then coalesce(terms.internal_field_rate,terms.hourly_rate) else terms.hourly_rate end;
 if rate is null or rate<0 or rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Applicable hourly rate unavailable; day rates are not converted to hourly wages';end if;
 regular:=public.carez_procurement_number(p_values,'regular_hours',2);ot:=public.carez_procurement_number(p_values,'overtime_hours',2);hours:=regular+ot;
 if hours<=0 then raise exception 'Planned hours must have a positive total';end if;
 gross:=round(regular*rate+ot*rate*1.5,2);cost:=gross;
 basis:=jsonb_build_object('version','verified_pour_forecast_v1','work_date',p_plan.scheduled_date,'crew_terms_id',terms.id,'worker_type',terms.worker_type,'rate',rate,
  'gross',gross,'regular_hours',regular,'overtime_hours',ot,'captured_at',clock_timestamp(),'authority','planning_estimate_not_payroll');
 if terms.worker_type='employee' then
  tax_day:=public.carez_procurement_date(p_values->>'payroll_tax_date');v_year:=extract(year from tax_day);
  select * into tax from public.labor_tax_settings where company_id=p_company and labor_tax_settings.tax_year=v_year;
  select * into risk from public.li_risk_classes where company_id=p_company and li_risk_classes.tax_year=v_year and code=p_values->>'risk_class_code' and active;
  if tax.id is null or risk.id is null then raise exception 'Verified tax settings and active L&I class are required for the planned payroll year';end if;
  select id into tax_version from public.labor_configuration_versions where company_id=p_company and kind='tax' and labor_configuration_versions.tax_year=v_year and source_record_id=tax.id and recorded_values=to_jsonb(tax) order by recorded_at desc,id desc limit 1;
  select id into risk_version from public.labor_configuration_versions where company_id=p_company and kind='risk' and labor_configuration_versions.tax_year=v_year and source_record_id=risk.id and recorded_values=to_jsonb(risk) order by recorded_at desc,id desc limit 1;
  if tax_version is null or risk_version is null then raise exception 'Confirm the recorded tax and L&I settings through Labor setup before forecasting';end if;
  select * into opening from public.labor_tax_year_accounts where company_id=p_company and crew_member_id=worker.id and labor_tax_year_accounts.tax_year=v_year for update;
  if not found then raise exception 'Verified opening taxable wages are required; missing YTD is not zero';end if;
  if tax_day<=opening.opening_as_of or (opening.last_tax_date is not null and tax_day<opening.last_tax_date) then raise exception 'Planned payroll date precedes verified opening or allocated work';end if;
  for entry in select value from jsonb_each(to_jsonb(tax)) where key in ('social_security_rate','medicare_rate','futa_rate','wa_sui_rate','sick_leave_accrual_rate','social_security_wage_base','futa_wage_base','wa_sui_wage_base') loop
   if entry.value='null'::jsonb or entry.value#>>'{}' in ('NaN','Infinity','-Infinity') or (entry.value#>>'{}')::numeric<0 then raise exception 'Verified statutory rate or wage base unavailable';end if;
  end loop;
  if risk.employer_rate_per_hour is null or risk.employer_rate_per_hour<0 or risk.employer_rate_per_hour::text in ('NaN','Infinity','-Infinity') then raise exception 'Verified employer L&I rate unavailable';end if;
  select opening.opening_social_security_wages+coalesce(sum(a.social_security_taxable_wages),0),opening.opening_futa_wages+coalesce(sum(a.futa_taxable_wages),0),opening.opening_wa_sui_wages+coalesce(sum(a.wa_sui_taxable_wages),0)
   into ss_before,futa_before,sui_before from public.labor_tax_allocations a where a.company_id=p_company and a.crew_member_id=worker.id and a.tax_year=v_year;
  if exists(select 1 from public.pour_cost_items i where i.company_id=p_company and i.pour_plan_id=p_plan.id and i.crew_member_id=worker.id and i.item_type='labor' and
   (i.forecast_basis is null or (extract(year from (i.forecast_basis->>'payroll_tax_date')::date)=v_year and
    (i.forecast_basis->>'tax_configuration_version' is distinct from tax_version::text or i.forecast_basis->>'risk_configuration_version' is distinct from risk_version::text or i.forecast_basis->>'opening_request_id' is distinct from opening.opening_request_id::text)))) then
   raise exception 'Review earlier worker forecasts against the current verified labor basis before adding another';end if;
  select coalesce(sum((i.forecast_basis#>>'{social_security,taxable_wages}')::numeric),0),coalesce(sum((i.forecast_basis#>>'{futa,taxable_wages}')::numeric),0),coalesce(sum((i.forecast_basis#>>'{wa_sui,taxable_wages}')::numeric),0),coalesce(jsonb_agg(i.id order by i.sort_order,i.id),'[]')
   into prior_ss,prior_futa,prior_sui,prior_ids from public.pour_cost_items i where i.company_id=p_company and i.pour_plan_id=p_plan.id and i.crew_member_id=worker.id and i.item_type='labor' and extract(year from (i.forecast_basis->>'payroll_tax_date')::date)=v_year;
  ss_wages:=least(gross,greatest(0,tax.social_security_wage_base-ss_before-prior_ss));futa_wages:=least(gross,greatest(0,tax.futa_wage_base-futa_before-prior_futa));sui_wages:=least(gross,greatest(0,tax.wa_sui_wage_base-sui_before-prior_sui));
  cost:=round(gross+round(ss_wages*tax.social_security_rate,2)+round(gross*tax.medicare_rate,2)+round(futa_wages*tax.futa_rate,2)+round(sui_wages*tax.wa_sui_rate,2)+round(hours*risk.employer_rate_per_hour,2)+round(hours*rate*tax.sick_leave_accrual_rate,2),2);
  basis:=basis||jsonb_build_object('payroll_tax_date',tax_day,'tax_configuration_version',tax_version,'risk_configuration_version',risk_version,'opening_request_id',opening.opening_request_id,'source_forecast_ids',prior_ids,
   'social_security',jsonb_build_object('ytd_before',ss_before,'taxable_wages',ss_wages),'futa',jsonb_build_object('ytd_before',futa_before,'taxable_wages',futa_wages),'wa_sui',jsonb_build_object('ytd_before',sui_before,'taxable_wages',sui_wages));
 end if;
 return jsonb_build_object('rate',rate,'expected_cost',cost,'hours',hours,'regular_hours',regular,'overtime_hours',ot,'worker_name',worker.name,'risk_class_code',case when terms.worker_type='employee' then risk.code end,
  'method',case terms.worker_type when 'employee' then 'w2_verified_forecast_v1' when 'owner' then 'owner_internal_v1' else 'subcontractor_hourly_v1' end,'basis',basis);
end $$;
revoke all on function public.carez_pour_labor_forecast(uuid,public.pour_plans,uuid,jsonb) from public,anon,authenticated;

create function public.carez_pour_planning_command_v1(p_request_id uuid,p_command text,p_values jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare request jsonb;company uuid;target uuid;plan public.pour_plans%rowtype;project uuid;kind text;label text;day date;
 quantity numeric;unit_cost numeric;forecast jsonb;crew uuid;affected integer;cy numeric;contingency numeric;buffer numeric;support numeric;
begin
 if p_command is null or p_command not in ('create_plan','update_plan','add_cost','add_labor','delete_cost','close_plan') then raise exception 'Unknown pour planning command';end if;
 request:=public.carez_financial_request_begin(p_request_id,'pour_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Pour planning values are required';end if;
 if p_command='create_plan' then
  project:=nullif(p_values->>'project_id','')::uuid;perform public.carez_procurement_scope(company,project,p_values);
  if nullif(p_values->>'change_order_id','') is not null and not exists(select 1 from public.change_orders where company_id=company and project_id=project and id=(p_values->>'change_order_id')::uuid and status='approved') then raise exception 'Only an approved change order from this job can be linked';end if;
 else
  select * into plan from public.pour_plans where company_id=company and id=nullif(p_values->>'pour_plan_id','')::uuid for update;
  if not found then raise exception 'Pour plan unavailable';end if;target:=plan.id;project:=plan.project_id;
  if nullif(p_values->>'expected_updated_at','') is null or (p_values->>'expected_updated_at')::timestamptz is distinct from plan.updated_at then raise exception 'Pour plan changed. Reload its current settings before saving';end if;
  if plan.status in ('completed','cancelled') then raise exception 'Completed or cancelled pour plans are locked';end if;
 end if;
 if p_command in ('create_plan','update_plan') then
  label:=nullif(btrim(p_values->>'name'),'');if label is null then raise exception 'Pour name is required';end if;
  day:=public.carez_procurement_date(p_values->>'scheduled_date',false);
  cy:=public.carez_procurement_number(p_values,'expected_concrete_yards',2);contingency:=public.carez_procurement_number(p_values,'contingency_percent',2);
  buffer:=public.carez_procurement_number(p_values,'minimum_cash_buffer',2);support:=public.carez_procurement_number(p_values,'company_cash_support',2);
  if contingency>100 then raise exception 'Contingency cannot exceed100percent';end if;
  if p_command='create_plan' then
   insert into public.pour_plans(company_id,project_id,budget_section_id,change_order_id,name,scheduled_date,expected_concrete_yards,contingency_percent,minimum_cash_buffer,company_cash_support,notes,created_by)
   values(company,project,nullif(p_values->>'budget_section_id','')::uuid,nullif(p_values->>'change_order_id','')::uuid,label,day,cy,contingency,buffer,support,nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into target;
  else
   if day is distinct from plan.scheduled_date and exists(select 1 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id and item_type='labor') then raise exception 'Review and remove saved labor forecasts before changing the pour date, then add the forecasts for the new date';end if;
   update public.pour_plans set name=label,scheduled_date=day,expected_concrete_yards=cy,contingency_percent=contingency,minimum_cash_buffer=buffer,company_cash_support=support,notes=nullif(btrim(p_values->>'notes'),''),status='planning',updated_at=clock_timestamp() where company_id=company and id=plan.id;
  end if;
 elsif p_command='add_cost' then
  kind:=coalesce(nullif(p_values->>'item_type',''),'other');if kind='labor' then raise exception 'Use verified loaded labor for worker forecasts';end if;
  label:=nullif(btrim(p_values->>'description'),'');if label is null then raise exception 'Description is required';end if;
  quantity:=public.carez_procurement_number(p_values,'quantity',4);unit_cost:=public.carez_procurement_number(p_values,'unit_cost',4);
  if nullif(p_values->>'cost_code_id','') is not null and not exists(select 1 from public.cost_codes where company_id=company and id=(p_values->>'cost_code_id')::uuid) then raise exception 'Cost code unavailable in this company';end if;
  if nullif(p_values->>'catalog_item_id','') is not null and not exists(select 1 from public.cost_catalog_items where company_id=company and id=(p_values->>'catalog_item_id')::uuid) then raise exception 'Catalog item unavailable in this company';end if;
  insert into public.pour_cost_items(company_id,pour_plan_id,item_type,cost_code_id,catalog_item_id,description,quantity,unit,unit_cost,expected_cost,committed,vendor_name,notes,sort_order)
  values(company,plan.id,kind,nullif(p_values->>'cost_code_id','')::uuid,nullif(p_values->>'catalog_item_id','')::uuid,label,quantity,coalesce(nullif(p_values->>'unit',''),'LS'),unit_cost,floor(quantity*unit_cost*100+0.5)/100,coalesce(p_values->>'committed'='on',false),nullif(btrim(p_values->>'vendor_name'),''),nullif(btrim(p_values->>'notes'),''),
   (select coalesce(max(sort_order),0)+10 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id)) returning id into target;
 elsif p_command='add_labor' then
  crew:=nullif(p_values->>'crew_member_id','')::uuid;forecast:=public.carez_pour_labor_forecast(company,plan,crew,p_values);
  insert into public.pour_cost_items(company_id,pour_plan_id,item_type,crew_member_id,description,quantity,unit,unit_cost,expected_cost,regular_hours,overtime_hours,risk_class_code,base_hourly_rate_snapshot,labor_cost_method,committed,notes,forecast_basis,sort_order)
  values(company,plan.id,'labor',crew,coalesce(nullif(btrim(p_values->>'description'),''),forecast->>'worker_name'||' — Pour labor'),(forecast->>'hours')::numeric,'HR',(forecast->>'rate')::numeric,(forecast->>'expected_cost')::numeric,(forecast->>'regular_hours')::numeric,(forecast->>'overtime_hours')::numeric,forecast->>'risk_class_code',(forecast->>'rate')::numeric,forecast->>'method',coalesce(p_values->>'committed'='on',false),nullif(btrim(p_values->>'notes'),''),forecast->'basis',
   (select coalesce(max(sort_order),0)+10 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id)) returning id into target;
 elsif p_command='delete_cost' then
  target:=nullif(p_values->>'item_id','')::uuid;
  if exists(select 1 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id and forecast_basis->'source_forecast_ids' ? target::text) then raise exception 'Remove later dependent forecasts for this worker first, then review the earlier forecast';end if;
  delete from public.pour_cost_items where company_id=company and pour_plan_id=plan.id and id=target;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Planned cost unavailable in this pour';end if;
 elsif p_command='close_plan' then
  kind:=p_values->>'status';if kind is null or kind not in ('completed','cancelled') then raise exception 'Invalid closing state';end if;
  update public.pour_plans set status=kind,updated_at=clock_timestamp() where company_id=company and id=plan.id;
 end if;
 if p_command in ('add_cost','add_labor','delete_cost') then update public.pour_plans set status='planning',updated_at=clock_timestamp() where company_id=company and id=plan.id;end if;
 if target is null then raise exception 'Pour planning save was not confirmed';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',target));
end $$;
revoke all on function public.carez_pour_planning_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_pour_planning_command_v1(uuid,text,jsonb) to authenticated;
revoke insert,update,delete on public.pour_plans,public.pour_cost_items from authenticated;
create or replace view public.pour_plan_review_state with(security_invoker=true) as
 select p.company_id,p.id pour_plan_id,public.carez_pour_funding_fingerprint(p.company_id,p.id) funding_fingerprint,public.carez_pour_authorization_current(p.company_id,p.id) authorization_current,p.updated_at plan_updated_at from public.pour_plans p;

-- This view is source-owned by133500 in both compatibility shapes. Preserve its
-- prefix and formula; only add the missing/dated labor-basis availability test.
do $$declare definition text;revised text;begin
 definition:=pg_get_viewdef('public.carez_pour_financial_v1'::regclass,true);
 revised:=replace(definition,'i.expected_cost IS NULL',
  '(i.expected_cost IS NULL OR (i.item_type = ''labor'' AND (i.forecast_basis IS NULL OR i.forecast_basis->>''work_date'' IS DISTINCT FROM v.scheduled_date::text)))');
 if revised=definition then raise exception 'Unknown pour availability contract; no forecast rule was guessed';end if;
 execute 'create or replace view public.carez_pour_financial_v1 with(security_invoker=true) as '||revised;
end $$;
