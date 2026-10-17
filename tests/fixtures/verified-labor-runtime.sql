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
 ('f1300000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000002','Synthetic W2 worker','finisher','employee',false,40,true);
insert into public.crew_employment_terms(id,company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,hourly_rate,source_type,reason,created_by) values
 ('f1400000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',0,current_date-30,'employee','regular',40,'administration','Synthetic explicit terms','f1100000-0000-4000-8000-000000000001');
insert into public.projects(id,company_id,job_number,name,status,work_timezone) values
 ('f1500000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','SYN-W2','Synthetic verified labor job','active','UTC');
insert into public.employee_shift_sessions(id,company_id,project_id,crew_member_id,employee_profile_id,work_date,status,clock_in_at,clock_out_at,crew_terms_id,worker_type_snapshot,base_hourly_rate_snapshot,work_timezone_snapshot,company_terms_date,work_date_policy_version,labor_basis_source)
 select ('f1600000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f1200000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000002',current_date,'submitted',now()-interval '4 hours',now()-interval '1 hour','f1400000-0000-4000-8000-000000000001','employee',40,'UTC',current_date,'shift_start_job_or_company_v1','terms_capture' from generate_series(1,4)n;
create temp table labor_config_input as select jsonb_build_object('reason','Synthetic tax record; not statutory advice','social_security_rate',0.1,'social_security_wage_base',1000,'medicare_rate',0.02,'futa_rate',0.03,'futa_wage_base',500,'wa_sui_rate',0.04,'wa_sui_wage_base',800,'sick_leave_accrual_rate',0.025) tax,
 jsonb_build_object('reason','Synthetic L&I verified record','code','SYN','name','Synthetic test class','active',true,'composite_rate_per_hour',3,'employee_deduction_per_hour',1,'employer_rate_per_hour',2) risk;
grant select on labor_config_input to authenticated;
insert into public.employee_shift_sessions(id,company_id,project_id,crew_member_id,employee_profile_id,work_date,status,clock_in_at,clock_out_at)
 values('f1600000-0000-4000-8000-000000000005','f1200000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001','f1100000-0000-4000-8000-000000000002',current_date,'submitted',(current_date+time '12:00') at time zone 'UTC',(current_date+time '13:00') at time zone 'UTC');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.throws_like($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000001','tax',extract(year from current_date)::integer,(select tax-'futa_rate' from labor_config_input))$$,'%futa_rate is required%','missing rate is not zero');
select extensions.throws_like($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000001','tax',extract(year from current_date)::integer,(select tax||'{"futa_rate":"NaN"}'::jsonb from labor_config_input))$$,'%finite nonnegative%','NaN tax input denied');
select extensions.lives_ok($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000001','tax',extract(year from current_date)::integer,(select tax from labor_config_input))$$,'owner records verified year-specific configuration');
select extensions.lives_ok($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000001','tax',extract(year from current_date)::integer,(select tax from labor_config_input))$$,'configuration retry returns one committed version');
select extensions.is((select count(*)::integer from public.labor_configuration_versions),1,'retry does not duplicate history');
select extensions.throws_like($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000001','tax',extract(year from current_date)::integer,(select tax||'{"futa_rate":0}'::jsonb from labor_config_input))$$,'%different%','request identity cannot change submitted values');
select extensions.lives_ok($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000002','risk',extract(year from current_date)::integer,(select risk from labor_config_input))$$,'work class gets an immutable configuration version');
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000001',2,1,'SYN',current_date,'Reviewed synthetic hours')$$,'%Verified opening taxable wages%','missing YTD opening blocks posting');
select extensions.is((select count(*)::integer from public.timecards),0,'failed approval leaves no financial posting');
select extensions.lives_ok($$select public.carez_verify_labor_opening_v1('f1700000-0000-4000-8000-000000000003','f1300000-0000-4000-8000-000000000001',extract(year from current_date)::integer,jsonb_build_object('opening_as_of',make_date(extract(year from current_date)::integer,1,1)-1,'social_security_wages',900,'futa_wages',450,'wa_sui_wages',700,'verification_reference','Synthetic prior payroll report'))$$,'verified opening records explicit prior wages');
select extensions.lives_ok($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000001',2,1,'SYN',current_date,'Reviewed synthetic hours')$$,'W2 shift posts from frozen rate and verified partial caps');
select extensions.is((select gross_wage_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000001'),140::numeric,'frozen40 rate and overtime1.5 produce140');
select extensions.is((select employer_social_security_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000001'),10::numeric,'only100 remaining Social Security wages are taxed');
select extensions.is((select employer_futa_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000001'),1.5::numeric,'only50 remaining FUTA wages are taxed');
select extensions.is((select employer_wa_sui_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000001'),4::numeric,'only100 remaining WA SUI wages are taxed');
select extensions.is((select direct_labor_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000001'),167.3::numeric,'direct labor separates wages, statutory burden and sick reserve');
select extensions.ok((select statutory_basis->>'tax_configuration_version' is not null from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000001'),'approval pins its actual tax configuration');
select extensions.lives_ok($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000001',2,1,'SYN',current_date,'Reviewed synthetic hours')$$,'identical approval retry returns existing timecard');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),1,'approval retry allocates capped wages once');
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000001',3,1,'SYN',current_date,'Reviewed synthetic hours')$$,'%different recorded approval%','changed approval cannot silently rewrite posting');
select extensions.lives_ok($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000002',1,0,'SYN',current_date,'Second synthetic shift')$$,'same payroll date can allocate a later shift');
select extensions.is((select direct_labor_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000002'),43.8::numeric,'exhausted caps stay exhausted while Medicare/L&I/reserve continue');
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000003',1,0,'SYN',current_date-1,null)$$,'%already allocated work%','earlier payroll allocation requires an explicit correction');
select extensions.throws_like($$update public.timecards set direct_labor_cost=0 where source_shift_id='f1600000-0000-4000-8000-000000000001'$$,'%permission denied%','raw financial timecard overwrite denied');
select extensions.throws_like($$update public.labor_tax_settings set futa_rate=0$$,'%permission denied%','raw tax configuration overwrite denied');
select extensions.throws_like($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000005','tax',extract(year from current_date)::integer,(select tax||'{"social_security_wage_base":2000}'::jsonb from labor_config_input))$$,'%audited reconciliation%','annual wage base cannot silently change after capped allocations');
select extensions.lives_ok($$select public.carez_reject_shift_v1('f1600000-0000-4000-8000-000000000003','Synthetic missing evidence')$$,'unposted submitted shift may be returned with explicit reason');
select extensions.lives_ok($$select public.carez_reject_shift_v1('f1600000-0000-4000-8000-000000000003','Synthetic missing evidence')$$,'same correction request is idempotent');
select extensions.throws_like($$select public.carez_reject_shift_v1('f1600000-0000-4000-8000-000000000001','Changed decision')$$,'%Only unposted%','posted approval cannot be rejected as an unposted shift');
select extensions.throws_like($$select public.carez_review_shift_basis_v1('f1700000-0000-4000-8000-000000000006','f1600000-0000-4000-8000-000000000004',jsonb_build_object('worker_type','owner','base_hourly_rate',55,'work_date',current_date,'work_timezone','UTC','reason','Attempt to replace complete frozen terms','confirmed',true))$$,'%complete captured basis%','historical review cannot rewrite complete captured terms');
select extensions.lives_ok($$select public.carez_review_shift_basis_v1('f1700000-0000-4000-8000-000000000006','f1600000-0000-4000-8000-000000000005',jsonb_build_object('worker_type','owner','base_hourly_rate',55,'work_date',current_date,'work_timezone','UTC','reason','Synthetic historical agreement evidence','confirmed',true))$$,'explicit historical review supplements legacy shift');
select extensions.lives_ok($$select public.carez_review_shift_basis_v1('f1700000-0000-4000-8000-000000000006','f1600000-0000-4000-8000-000000000005',jsonb_build_object('worker_type','owner','base_hourly_rate',55,'work_date',current_date,'work_timezone','UTC','reason','Synthetic historical agreement evidence','confirmed',true))$$,'historical review retry preserves one decision');
select extensions.is((select count(*)::integer from public.labor_basis_reviews),1,'one historical review was recorded');
select extensions.lives_ok($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000005',1,0,null,null,'Synthetic reviewed legacy cost')$$,'reviewed legacy shift posts through the same atomic approval');
select extensions.is((select direct_labor_cost from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000005'),55::numeric,'historical cost uses explicitly reviewed55, not current40');
select extensions.ok((select labor_basis_review_id is not null and labor_basis_source='historical_review' from public.timecards where source_shift_id='f1600000-0000-4000-8000-000000000005'),'historical timecard pins immutable review');
select extensions.ok((select base_hourly_rate_snapshot is null and worker_type_snapshot is null from public.employee_shift_sessions where id='f1600000-0000-4000-8000-000000000005'),'original legacy shift facts remain unchanged');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::integer from public.labor_tax_year_accounts),0,'employee cannot read financial YTD opening records');
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000003',1,0,'SYN',current_date,null)$$,'%Owner or office%','employee cannot approve own costs');
select extensions.throws_like($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000004','tax',extract(year from current_date)::integer,(select tax from labor_config_input))$$,'%Owner or office%','employee cannot configure employer costs');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000003',1,0,'SYN',current_date,null)$$,'%Shift unavailable%','foreign-company approval denied');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),0,'foreign-company financial allocations are not visible');
reset role;
select extensions.throws_like($$update public.timecards set direct_labor_cost=0 where source_shift_id='f1600000-0000-4000-8000-000000000001'$$,'%immutable%','approved financial snapshot immutable even through privileged SQL');
select extensions.throws_like($$delete from public.labor_tax_allocations where company_id='f1200000-0000-4000-8000-000000000001'$$,'%immutable%','statutory allocation history cannot be deleted');
select * from extensions.finish();
rollback;
