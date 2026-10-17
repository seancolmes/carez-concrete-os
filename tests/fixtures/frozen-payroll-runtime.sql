-- Disposable local records only; this does not qualify payroll-provider execution.
begin;
set local search_path=pg_catalog,public,extensions;
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
select extensions.lives_ok($$select public.carez_employee_resubmit_shift_v1('f1900000-0000-4000-8000-000000000001','f1600000-0000-4000-8000-000000000003','Synthetic corrected evidence')$$,'bound employee can return an unposted rejected shift for review');
select extensions.lives_ok($$select public.carez_employee_resubmit_shift_v1('f1900000-0000-4000-8000-000000000001','f1600000-0000-4000-8000-000000000003','Synthetic corrected evidence')$$,'correction retry records one response');
select extensions.is((select count(*)::integer from public.employee_shift_corrections),1,'employee sees own correction response once');
select extensions.is((select x->>'status' from jsonb_array_elements(public.employee_portal_state()->'recent')x where x->>'id'='f1600000-0000-4000-8000-000000000003'),'submitted','returned shift is waiting for a fresh office decision');
select extensions.ok((select jsonb_array_length(public.employee_portal_state()->'recent')>0),'employee recent-time contract renders after correction enhancement');

select extensions.is((select count(*)::integer from public.labor_tax_year_accounts),0,'employee cannot read financial YTD opening records');
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000003',1,0,'SYN',current_date,null)$$,'%Owner or office%','employee cannot approve own costs');
select extensions.throws_like($$select public.carez_configure_labor_tax_v1('f1700000-0000-4000-8000-000000000004','tax',extract(year from current_date)::integer,(select tax from labor_config_input))$$,'%Owner or office%','employee cannot configure employer costs');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000003',1,0,'SYN',current_date,null)$$,'%Shift unavailable%','foreign-company approval denied');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),0,'foreign-company financial allocations are not visible');
reset role;
select extensions.throws_like($$update public.timecards set direct_labor_cost=0 where source_shift_id='f1600000-0000-4000-8000-000000000001'$$,'%immutable%','approved financial snapshot immutable even through privileged SQL');
select extensions.throws_like($$delete from public.labor_tax_allocations where company_id='f1200000-0000-4000-8000-000000000001'$$,'%immutable%','statutory allocation history cannot be deleted');
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($$select public.carez_administer_crew('update','f1700000-0000-4000-8000-000000000007','f1300000-0000-4000-8000-000000000001',0,jsonb_build_object('effective_date',current_date,'reason','Synthetic worker rename','name','Synthetic renamed worker','role','finisher','worker_type','employee','availability_type','regular','hourly_rate',40,'active',true,'skills','[]'::jsonb))$$,'governed Crew rename preserves prior cost names');
select extensions.lives_ok($$select public.carez_approve_shift_v3('f1600000-0000-4000-8000-000000000004',1,0,'SYN',current_date+7,'Synthetic later pay-date cohort')$$,'same work day can have another verified pay-date cohort');
select extensions.is((select count(*)::integer from public.payroll_unprocessed_worker_summary),1,'multiple recorded names remain one worker identity');
select extensions.is((select count(*)::integer from public.payroll_timecard_readiness where eligible),3,'only approved frozen W2 costs are eligible');
select extensions.is((select count(*)::integer from public.payroll_timecard_readiness where worker_type_snapshot='owner' and eligible),0,'owner cost remains outside W2 funding');
create temp table payroll_preview as select public.carez_preview_payroll_run_v2(current_date,current_date,current_date) payload;
select extensions.is((select (payload->>'timecard_count')::integer from payroll_preview),2,'period preview contains the complete selected pay-date cohort');
select extensions.is((select jsonb_array_length(payload->'other_pay_dates') from payroll_preview),1,'other frozen pay dates remain visible and waiting');
select extensions.is((select (payload->>'funding_requirement')::numeric from payroll_preview),207.1::numeric,'cash requirement excludes separate sick reserve');
select extensions.throws_like($$select public.carez_create_payroll_run_v2('f1800000-0000-4000-8000-000000000001',current_date,current_date,current_date,(select array_agg(x::uuid order by x::uuid) from payroll_preview,jsonb_array_elements_text(payload->'timecard_ids')x),'stale',null)$$,'%preview changed%','stale preview cannot create a partially selected period');
select extensions.is((select count(*)::integer from public.payroll_runs),0,'failed preview leaves no run');
select extensions.lives_ok($$select public.carez_create_payroll_run_v2('f1800000-0000-4000-8000-000000000001',current_date,current_date,current_date,(select array_agg(x::uuid order by x::uuid) from payroll_preview,jsonb_array_elements_text(payload->'timecard_ids')x),(select payload->>'fingerprint' from payroll_preview),'Synthetic period')$$,'exact preview creates one governed pay period');
select extensions.lives_ok($$select public.carez_create_payroll_run_v2('f1800000-0000-4000-8000-000000000001',current_date,current_date,current_date,(select array_agg(x::uuid order by x::uuid) from payroll_preview,jsonb_array_elements_text(payload->'timecard_ids')x),(select payload->>'fingerprint' from payroll_preview),'Synthetic period')$$,'create retry returns the prior run before reselecting occupied time');
select extensions.is((select count(*)::integer from public.payroll_runs),1,'retry creates one period');
select extensions.is((select count(*)::integer from public.payroll_run_lines where active),2,'cohort is copied once');
select extensions.lives_ok($$select public.carez_transition_payroll_run_v2('f1800000-0000-4000-8000-000000000002',(select id from public.payroll_runs),'void',null,null)$$,'void releases active funding while retaining cost history');
select extensions.is((select timecard_count from public.payroll_run_financial_summary),2,'void period retains original worker details');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),3,'void does not deallocate approved tax-year cost');
select extensions.is((select count(*)::integer from public.payroll_timecard_readiness where eligible),3,'voided inclusion can be recreated without recosting');
select extensions.lives_ok($$select public.carez_create_payroll_run_v2('f1800000-0000-4000-8000-000000000003',current_date,current_date,current_date,(select array_agg(x::uuid order by x::uuid) from payroll_preview,jsonb_array_elements_text(payload->'timecard_ids')x),(select payload->>'fingerprint' from payroll_preview),'Recreated synthetic period')$$,'recreate after void reuses the same frozen costs');
select extensions.lives_ok($$select public.carez_transition_payroll_run_v2('f1800000-0000-4000-8000-000000000004',(select id from public.payroll_runs where status='draft'),'approve',null,null)$$,'funding approval validates its source fingerprint');
select extensions.throws_like($$select public.carez_transition_payroll_run_v2('f1800000-0000-4000-8000-000000000005',(select id from public.payroll_runs where status='approved'),'process',null,'Synthetic processing')$$,'%explicitly recorded%','blank cash cannot mark unknown funding paid');
select extensions.throws_like($$select public.carez_transition_payroll_run_v2('f1800000-0000-4000-8000-000000000005',(select id from public.payroll_runs where status='approved'),'process','NaN','Synthetic processing')$$,'%explicitly recorded%','nonfinite cash rejected');
select extensions.lives_ok($$select public.carez_transition_payroll_run_v2('f1800000-0000-4000-8000-000000000005',(select id from public.payroll_runs where status='approved'),'process',0,'Synthetic verified zero disbursement')$$,'explicit recorded zero cash remains distinguishable from blank');
select extensions.is((select actual_cash_paid from public.payroll_runs where status='processed'),0::numeric,'recorded zero cash persists');
select extensions.throws_like($$update public.payroll_runs set actual_cash_paid=900 where status='processed'$$,'%permission denied%','raw payroll cash edits denied');
select extensions.throws_like($$select public.create_payroll_run(current_date,current_date,current_date,null)$$,'%permission denied%','legacy create entry cannot bypass governed review');
select extensions.throws_like($$select public.process_payroll_run((select id from public.payroll_runs where status='processed'),null,null)$$,'%permission denied%','legacy processing cannot bypass explicit cash confirmation');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),3,'payroll processing does not allocate YTD a second time');
reset role;
reset role;
insert into public.plaid_connections(id,company_id,item_id,access_token_ciphertext,token_iv,token_auth_tag) values('f2000000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','synthetic-no-provider-item','NOT-A-TOKEN','synthetic','synthetic');
insert into public.plaid_accounts(id,company_id,connection_id,plaid_account_id,name) values('f2100000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','synthetic-account','Synthetic payroll bank');
insert into public.plaid_transactions(id,company_id,connection_id,account_id,plaid_transaction_id,plaid_account_id,transaction_date,name,plaid_amount,cash_amount) values('f2200000-0000-4000-8000-000000000001','f1200000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f2100000-0000-4000-8000-000000000001','synthetic-payroll-debit','synthetic-account',current_date+7,'Synthetic provider funding',42.8,-42.8);
set local role authenticated;
create temp table future_payroll_preview as select public.carez_preview_payroll_run_v2(current_date,current_date,current_date+7) payload;
select extensions.lives_ok($$select public.carez_create_payroll_run_v2('f1800000-0000-4000-8000-000000000006',current_date,current_date,current_date+7,(select array_agg(x::uuid order by x::uuid) from future_payroll_preview,jsonb_array_elements_text(payload->'timecard_ids')x),(select payload->>'fingerprint' from future_payroll_preview),'Synthetic second pay date')$$,'second pay date remains fundable separately');
select extensions.lives_ok($$select public.carez_transition_payroll_run_v2('f1800000-0000-4000-8000-000000000007',(select id from public.payroll_runs where status='draft'),'approve',null,null)$$,'second cohort is approved against frozen evidence');
select extensions.lives_ok($$select public.carez_reconcile_bank_to_payroll_run_v2('f1800000-0000-4000-8000-000000000008','f2200000-0000-4000-8000-000000000001',(select id from public.payroll_runs where status='approved'))$$,'governed bank funding reaches the same strict processing core');
select extensions.lives_ok($$select public.carez_reconcile_bank_to_payroll_run_v2('f1800000-0000-4000-8000-000000000008','f2200000-0000-4000-8000-000000000001',(select id from public.payroll_runs where bank_transaction_id='f2200000-0000-4000-8000-000000000001'))$$,'uncertain bank retry returns its confirmed result');
select extensions.is((select actual_cash_paid from public.payroll_runs where bank_transaction_id='f2200000-0000-4000-8000-000000000001'),42.8::numeric,'bank processing records actual withdrawal once');
select extensions.is((select count(*)::integer from public.labor_tax_allocations),3,'bank funding never allocates statutory costs again');
reset role;
select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000001',true);
set local role authenticated;
create temp table manual_labor_input as select jsonb_build_object('source_reference','SYN-TIMESHEET-1:LINE-1','reason','Verified synthetic missing-time record','task','Synthetic manual finish','confirmed',true,'worker_type','owner','base_hourly_rate',0,'work_date',current_date,'work_timezone','UTC','regular_hours',1,'overtime_hours',0) payload;
select extensions.lives_ok($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload from manual_labor_input))$$,'verified manual time records a genuine zero historical rate');
select extensions.lives_ok($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload from manual_labor_input))$$,'manual-time retry returns one financial posting');
grant select on manual_labor_input to authenticated;
select extensions.is((select count(*)::integer from public.manual_labor_entries),1,'one manual source record exists');
select extensions.is((select direct_labor_cost from public.timecards where manual_labor_entry_id is not null),0::numeric,'explicit manual zero is preserved');
select extensions.is((select task from public.timecards where manual_labor_entry_id is not null),'Synthetic manual finish','manual work type survives posting');
select extensions.ok((select source_shift_id is null from public.timecards where manual_labor_entry_id is not null),'manual source does not fabricate a clock shift');
select extensions.throws_like($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000002','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload from manual_labor_input))$$,'%already recorded%','new nonce cannot duplicate the same worker source line');
select extensions.throws_like($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000001','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload||'{"base_hourly_rate":99}'::jsonb from manual_labor_input))$$,'%different values%','changed manual retry cannot rewrite confirmed cost');
reset role;
set local role authenticated;
select extensions.lives_ok($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000003','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload||jsonb_build_object('source_reference','SYN-TIMESHEET-1:LINE-2','worker_type','employee','base_hourly_rate',40,'payroll_tax_date',current_date+7,'risk_class_code','SYN') from manual_labor_input))$$,'manual W2 time uses the shared verified cap calculation');
select extensions.is((select count(*)::integer from public.payroll_timecard_readiness where eligible),1,'verified manual W2 cost is eligible for its frozen payroll cohort');
select extensions.is((select direct_labor_cost from public.timecards t join public.manual_labor_entries m on m.company_id=t.company_id and m.timecard_id=t.id where m.source_reference='SYN-TIMESHEET-1:LINE-2'),43.8::numeric,'manual W2 rate does not lose remaining noncapped burden');
select extensions.throws_like($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000004','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload-'reason' from manual_labor_input))$$,'%reason%','manual missing-evidence submission is rejected');
select extensions.is((select count(*)::integer from public.manual_labor_entries),2,'failed manual submission leaves no orphan source');
select extensions.throws_like($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000005','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload||'{"source_reference":"SYN-INFINITE","work_date":"infinity"}'::jsonb from manual_labor_input))$$,'%Finite reviewed job work date%','direct RPC cannot post infinity as a work date');
select extensions.throws_like($$select public.carez_preview_payroll_run_v2('-infinity'::date,current_date,current_date+7)$$,'%Finite period dates%','direct payroll preview rejects non-calendar range bounds');
select extensions.throws_like($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000006','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload||'{"source_reference":"SYN-INFINITE-TAX","worker_type":"employee","base_hourly_rate":40,"payroll_tax_date":"infinity","risk_class_code":"SYN"}'::jsonb from manual_labor_input))$$,'%Finite work and reviewed payroll%','direct manual employee RPC rejects infinite payroll date');

select set_config('request.jwt.claim.sub','f1100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select public.carez_record_manual_labor_v1('f2300000-0000-4000-8000-000000000004','f1500000-0000-4000-8000-000000000001','f1300000-0000-4000-8000-000000000001',(select payload from manual_labor_input))$$,'%Owner or office%','employee cannot self-post approved manual costs');
reset role;
select extensions.ok(not has_table_privilege('authenticated','public.payroll_runs','TRUNCATE'),'authenticated cannot truncate financial history outside RLS');
select extensions.ok(not has_table_privilege('anon','public.vendor_bill_lines','SELECT'),'anonymous cannot read retained production bill lines');
select * from extensions.finish();
rollback;
