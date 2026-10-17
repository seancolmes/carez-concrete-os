-- Disposable local records only; this does not qualify payroll-provider execution.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('f1100000-0000-4000-8000-000000000001','labor-owner@local.invalid'),
 ('f1100000-0000-4000-8000-000000000002','labor-employee@local.invalid'),
 ('f1100000-0000-4000-8000-000000000003','labor-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone,target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate) values
 ('f1200000-0000-4000-8000-000000000001','Synthetic verified labor contractor','UTC',0,2000,0,0,0),
 ('f1200000-0000-4000-8000-000000000002','Synthetic foreign contractor','UTC',0,2000,0,0,0);
insert into public.profiles(id,company_id,full_name,role) values
 ('f1100000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','Synthetic owner','owner'),
 ('f1100000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000001','Synthetic employee','employee'),
 ('f1100000-0000-4000-8000-000000000003','f1200000-0000-4000-8000-000000000002','Synthetic foreign owner','owner');
insert into public.crew_members(id,company_id,profile_id,name,role,worker_type,is_owner,hourly_rate,active) values
 ('f1300000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000002','Synthetic W2 worker','finisher','employee',false,999,true);
insert into public.crew_employment_terms(id,company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,hourly_rate,source_type,reason,created_by) values
 ('f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',0,current_date-30,'employee','regular',40,'administration','Synthetic explicit terms','f1100000-0000-4000-8000-000000000001');
insert into public.projects(id,company_id,job_number,name,status,work_timezone) values
 ('f1500000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','SYN-W2','Synthetic verified labor job','active','UTC');
create temp table labor_config_input as select jsonb_build_object('reason','Synthetic tax record; not statutory advice','social_security_rate',0.1,'social_security_wage_base',1000,'medicare_rate',0.02,'futa_rate',0.03,'futa_wage_base',500,'wa_sui_rate',0.04,'wa_sui_wage_base',800,'sick_leave_accrual_rate',0.025) tax,
 jsonb_build_object('reason','Synthetic L&I verified record','code','SYN','name','Synthetic test class','active',true,'composite_rate_per_hour',3,'employee_deduction_per_hour',1,'employer_rate_per_hour',2) risk;
grant select on labor_config_input to authenticated;
insert into public.crew_members(id,company_id,name,role,worker_type,is_owner,hourly_rate,internal_field_rate,active) values
 ('f1300000-0000-4000-8000-000000000002','f1200000-0000-4000-8000-000000000001','Synthetic zero-rate owner','owner','owner',true,0,0,true),
 ('f1300000-0000-4000-8000-000000000003','f1200000-0000-4000-8000-000000000001','Synthetic hourly subcontractor','finisher','subcontractor',false,70,null,true);
insert into public.crew_employment_terms(company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,hourly_rate,internal_field_rate,source_type,reason,created_by)
 select company_id,id,0,current_date-30,worker_type,'regular',hourly_rate,internal_field_rate,'administration','Synthetic recorded forecast terms','f1100000-0000-4000-8000-000000000001'
 from public.crew_members where id in ('f1300000-0000-4000-8000-000000000002','f1300000-0000-4000-8000-000000000003');
create temp table planning_results(key text primary key,value jsonb);grant all on planning_results to authenticated;
create function pg_temp.plan(n integer,c text,p jsonb) returns jsonb language plpgsql as $$begin if c<>'create_plan' and not (p ? 'expected_updated_at') then p:=p||jsonb_build_object('expected_updated_at',(select updated_at from public.pour_plans where id=(p->>'pour_plan_id')::uuid));end if;return public.carez_pour_planning_command_v1(('f9900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p);end$$;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);set local role authenticated;
select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000001','tax',extract(year from current_date)::integer,(select tax from labor_config_input));
select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000002','risk',extract(year from current_date)::integer,(select risk from labor_config_input));
insert into planning_results values('plan-input',jsonb_build_object('project_id','f1500000-0000-4000-8000-000000000001','name','Synthetic reviewed pour','scheduled_date',current_date,'expected_concrete_yards','0','contingency_percent','10','minimum_cash_buffer','0','company_cash_support','0'));
insert into planning_results values('plan',pg_temp.plan(1,'create_plan',(select value from planning_results where key='plan-input')));
select extensions.is(pg_temp.plan(1,'create_plan',(select value from planning_results where key='plan-input')),(select value from planning_results where key='plan'),'uncertain plan retry returns one saved plan');
select extensions.is((select count(*)::integer from public.pour_plans),1,'plan retry does not duplicate dispatch work');
select extensions.throws_like($$select pg_temp.plan(2,'create_plan',(select value-'minimum_cash_buffer' from planning_results where key='plan-input'))$$,'%minimum_cash_buffer is required%','missing buffer is not recorded zero');
select extensions.throws_like($$select pg_temp.plan(2,'create_plan',(select value||'{"company_cash_support":"NaN"}' from planning_results where key='plan-input'))$$,'%finite nonnegative%','nonfinite financial plan input is rejected');
select extensions.ok((select expected_concrete_yards=0 and minimum_cash_buffer=0 and company_cash_support=0 from public.pour_plans where id=(select (value->>'id')::uuid from planning_results where key='plan')),'explicit zero planning inputs survive save and reopen');
insert into planning_results values('labor-input',jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'crew_member_id','f1300000-0000-4000-8000-000000000001','regular_hours','2','overtime_hours','1','payroll_tax_date',current_date,'risk_class_code','SYN','expected_updated_at',(select updated_at from public.pour_plans where id=(select (value->>'id')::uuid from planning_results where key='plan'))));
select extensions.throws_like($$select pg_temp.plan(2,'add_labor',(select value-'payroll_tax_date' from planning_results where key='labor-input'))$$,'%Recorded date is required%','planned payroll date does not fall back to scheduled year or UTC today');
select extensions.throws_like($$select pg_temp.plan(2,'add_labor',(select value from planning_results where key='labor-input'))$$,'%Verified opening taxable wages%','missing opening wages do not become uncapped free/default burden');
select extensions.is((select count(*)::integer from public.pour_cost_items),0,'failed forecast leaves no expected cost');
select public.carez_verify_labor_opening_v1('f1700000-0000-4000-8000-000000000003','f1300000-0000-4000-8000-000000000001',extract(year from current_date)::integer,jsonb_build_object('opening_as_of',make_date(extract(year from current_date)::integer,1,1)-1,'social_security_wages',900,'futa_wages',450,'wa_sui_wages',700,'verification_reference','Synthetic opening wage evidence'));
insert into planning_results values('labor',pg_temp.plan(2,'add_labor',(select value from planning_results where key='labor-input')));
select extensions.is((select expected_cost from public.pour_cost_items where id=(select (value->>'id')::uuid from planning_results where key='labor')),167.3::numeric,'employee forecast reuses verified partial-cap cost formula');
select extensions.ok((select forecast_basis->>'crew_terms_id'='f1400000-0000-4000-8000-000000000001' and forecast_basis->>'tax_configuration_version' is not null and forecast_basis->>'risk_configuration_version' is not null and forecast_basis->>'authority'='planning_estimate_not_payroll'
 from public.pour_cost_items where id=(select (value->>'id')::uuid from planning_results where key='labor')),'forecast pins terms, tax versions and explicit planning authority');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),0,'forecast does not consume annual wage caps');
select extensions.is((select count(*)::integer from public.timecards),0,'forecast does not post actual labor');
select extensions.is(pg_temp.plan(2,'add_labor',(select value from planning_results where key='labor-input')),(select value from planning_results where key='labor'),'forecast retry returns the original saved cost');
insert into planning_results values('second-labor',pg_temp.plan(20,'add_labor',(select (value-'expected_updated_at')||'{"regular_hours":"1","overtime_hours":"0"}'::jsonb from planning_results where key='labor-input')));
select extensions.is((select expected_cost from public.pour_cost_items where id=(select (value->>'id')::uuid from planning_results where key='second-labor')),43.8::numeric,'second employee forecast projects the remaining caps after prior forecasts without consuming actual YTD');
select extensions.throws_like($$select pg_temp.plan(21,'delete_cost',jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'item_id',(select value->>'id' from planning_results where key='labor')))$$,'%Remove later dependent forecasts%','deletion cannot strand a dependent wage-cap forecast');
select extensions.lives_ok($$select pg_temp.plan(21,'delete_cost',jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'item_id',(select value->>'id' from planning_results where key='second-labor')))$$,'later forecast can be removed before revising its source');
select extensions.throws_like($$select pg_temp.plan(22,'update_plan',(select value||jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'expected_updated_at','2000-01-01T00:00:00Z') from planning_results where key='plan-input'))$$,'%Pour plan changed%','stale form cannot restore an older cash buffer or support amount');
select extensions.throws_like($$select pg_temp.plan(3,'add_cost',jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'item_type','labor','description','Forged loaded labor','quantity','1','unit_cost','0'))$$,'%Use verified loaded labor%','generic cost path cannot bypass verified labor');
select extensions.throws_like($$select pg_temp.plan(3,'update_plan',(select value||jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'scheduled_date',current_date+1) from planning_results where key='plan-input'))$$,'%remove saved labor forecasts%','changing date cannot silently retain an old-year rate basis');
insert into planning_results values('owner',pg_temp.plan(3,'add_labor',jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'crew_member_id','f1300000-0000-4000-8000-000000000002','regular_hours','1','overtime_hours','0')));
select extensions.ok((select expected_cost=0 and labor_cost_method='owner_internal_v1' and forecast_basis->>'worker_type'='owner' from public.pour_cost_items where id=(select (value->>'id')::uuid from planning_results where key='owner')),'explicit zero owner rate is genuine zero, without employee tax assumptions');
insert into planning_results values('subcontractor',pg_temp.plan(4,'add_labor',jsonb_build_object('pour_plan_id',(select value->>'id' from planning_results where key='plan'),'crew_member_id','f1300000-0000-4000-8000-000000000003','regular_hours','1','overtime_hours','1')));
select extensions.ok((select expected_cost=175 and labor_cost_method='subcontractor_hourly_v1' and risk_class_code is null from public.pour_cost_items where id=(select (value->>'id')::uuid from planning_results where key='subcontractor')),'recorded hourly subcontractor is not treated as a W2 employee');
select extensions.throws_like($$update public.pour_cost_items set expected_cost=0$$,'%permission denied%','raw cost update cannot fabricate a cheap forecast');
select extensions.throws_like($$update public.pour_plans set company_cash_support=999999$$,'%permission denied%','raw plan writes cannot bypass financial request validation');
select extensions.ok(not exists(select 1 from public.pour_cost_items where item_type='labor' and unit_cost=999),'current Crew rate does not replace effective forecast terms');
reset role;
-- Unverified historical labor remains visible but cannot qualify funding.
insert into public.pour_cost_items(company_id,pour_plan_id,item_type,description,quantity,unit_cost,expected_cost)
 values('f1200000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from planning_results where key='plan'),'labor','Synthetic historical unknown labor',1,0,0);
set local role authenticated;
select extensions.ok((select funding_basis_status='unavailable' and system_recommendation='unavailable' from public.pour_plan_financial_summary where pour_plan_id=(select (value->>'id')::uuid from planning_results where key='plan')),'unverified historical labor is unavailable, not a zero-cost clearance');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.plan(6,'add_labor',(select value from planning_results where key='labor-input'))$$,'%Owner or office authority required%','employee cannot post planning financial decisions');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select pg_temp.plan(6,'add_labor',(select value from planning_results where key='labor-input'))$$,'%Pour plan unavailable%','other company cannot forecast this pour');
reset role;select * from extensions.finish();rollback;
