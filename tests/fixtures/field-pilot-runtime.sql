-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
-- Disposable local database only. Every write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'owner@pilot.invalid', jsonb_build_object('company_name','Pilot fixture contractor','full_name','Local Owner','operating_timezone','UTC')),
  ('c1000000-0000-4000-8000-000000000002', 'office@pilot.invalid', jsonb_build_object('company_name','Pilot fixture contractor','full_name','Local Office','operating_timezone','UTC')),
  ('c1000000-0000-4000-8000-000000000003', 'internal@pilot.invalid', jsonb_build_object('company_name','Pilot fixture contractor','full_name','Internal Field Worker','operating_timezone','UTC')),
  ('c1000000-0000-4000-8000-000000000004', 'statutory@pilot.invalid', jsonb_build_object('company_name','Pilot fixture contractor','full_name','Statutory Worker','operating_timezone','UTC')),
  ('c1000000-0000-4000-8000-000000000005', 'other@pilot.invalid', jsonb_build_object('company_name','Other fixture contractor','full_name','Other Owner','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('c2000000-0000-4000-8000-000000000001', 'Pilot fixture contractor', 'UTC'),
  ('c2000000-0000-4000-8000-000000000002', 'Other fixture contractor', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('c1000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'owner', 'Local Owner'),
  ('c1000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'office', 'Local Office'),
  ('c1000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 'employee', 'Internal Field Worker'),
  ('c1000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000001', 'employee', 'Statutory Worker'),
  ('c1000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000002', 'owner', 'Other Owner')) v(id,company_id,role,full_name)
where p.id=v.id::uuid;
insert into public.projects(id,company_id,job_number,name,status,sales_tax_exempt) values
 ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','LOCAL-FIELD-1','Ready fixture','active',true),
 ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','LOCAL-FIELD-2','Setup held fixture','active',true),
 ('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','LOCAL-FIELD-3','Other job fixture','active',true),
 ('c3000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000002','LOCAL-FIELD-4','Foreign fixture','active',true);
insert into public.project_award_records(company_id,project_id,agreement_number,original_contract_value,status,authorization_text) values('c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','LOCAL-AG',1000,'accepted','Explicit synthetic historical agreement fixture evidence');
insert into public.crew_members(id,company_id,profile_id,name,role,active,is_owner,internal_field_rate,hourly_rate,worker_type) values
 ('c4000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003','Internal Field Worker','finisher',true,true,40,99,'owner'),
 ('c4000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004','Statutory Worker','finisher',true,false,null,30,'employee');
insert into public.production_tasks(id,company_id,name,production_unit,active) values('c5000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Fixture finish','SF',true);
insert into public.work_packages(id,company_id,project_id,name) values
 ('c6000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','Fixture package'),
 ('c6000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000003','Other package');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,sequence,planned_quantity,unit,measurement_method,status) values
 ('c7000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','Ready finish',10,100,'SF','completion','planned'),
 ('c7000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000001','Wrong job',10,100,'SF','completion','planned'),
 ('c7000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','Inspection held',20,100,'SF','completion','planned');
insert into public.project_inspections(company_id,project_id,required_for_operation_id,title,inspection_type,status) values('c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000003','Fixture inspection','forms','required');
-- Explicit original terms are required before plan propagation may version them.
insert into public.crew_employment_terms(company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,hourly_rate,internal_field_rate,source_type,reason,created_by)
 select company_id,id,0,current_date-30,worker_type,'regular',hourly_rate,internal_field_rate,'administration','Explicit synthetic initial terms','c1000000-0000-4000-8000-000000000001' from public.crew_members where company_id='c2000000-0000-4000-8000-000000000001';
-- A genuinely configured synthetic business plan supplies the asserted5/hour.
insert into public.overhead_items(company_id,category,name,amount,frequency,business_use_percent) values('c2000000-0000-4000-8000-000000000001','Facilities','Synthetic annual overhead',10000,'annual',100);
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);set local role authenticated;
select public.carez_save_company_plan('c9900000-0000-4000-8000-000000000001',0,'{"target_margin_percent":0,"planned_productive_hours_annual":2000,"owner_compensation_target_annual":0,"owner_planned_field_hours_annual":0,"owner_field_rate":40}');
select public.carez_capture_overhead_v2(current_date);
reset role;
-- Explicit draftsource makes agreement checks applicable to the heldjob.
insert into public.estimates(id,company_id,project_id,estimate_number,version,name,status) values('c9900000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002','SYN-HELD-SOURCE',1,'Synthetic source without agreement','draft');
update public.projects set source_estimate_id='c9900000-0000-4000-8000-000000000002' where id='c3000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select extensions.throws_ok($$select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000004',null,null,null)$$,'P0001','Active job not found','foreign job denied');
select extensions.throws_ok($$select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000001',100,0,1)$$,'P0001','Invalid supplied clock coordinates.','invalid GPS denied');
select extensions.lives_ok($$select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000002',null,null,null)$$,'clock permits missing GPS evidence and held-job attendance');
select extensions.throws_ok($$select public.carez_employee_start_task_v2('c5000000-0000-4000-8000-000000000001',null,null,null)$$,'P0001','Job setup is not ready for physical work.','setup hold blocks physical task');
reset role;
delete from public.employee_shift_sessions where project_id='c3000000-0000-4000-8000-000000000002';
set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000001',40,-120,10)$$,'clock into ready job');
select extensions.throws_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000002',40,-120,10)$$,'P0001','Operation does not belong to the active job.','same-tenant different-job operation denied');
select extensions.throws_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000003',40,-120,10)$$,'P0001','Work is not ready to start.','inspection hold preserved');
select extensions.lives_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000001',40,-120,10)$$,'start ready physical operation');
select extensions.lives_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000001',40,-120,10)$$,'start retry returns the same segment');
reset role;
select extensions.is((select count(*) from public.employee_task_segments where work_package_operation_id='c7000000-0000-4000-8000-000000000001'),1::bigint,'retry did not duplicate segment');
create temp table field_pilot_active_segment as select to_jsonb(e) snapshot from public.employee_task_segments e where work_package_operation_id='c7000000-0000-4000-8000-000000000001' and ended_at is null;
update public.production_tasks set active=false where id='c5000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select public.carez_employee_start_task_v2('c5000000-0000-4000-8000-000000000001',40,-120,10)$$,'P0001','Active shift or work type not found.','inactive unplanned work type denied');
select extensions.throws_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000001',40,-120,10)$$,'P0001','Active work operation or shift not found.','inactive linked work type denied');
reset role;
select extensions.is((select to_jsonb(e) from public.employee_task_segments e where work_package_operation_id='c7000000-0000-4000-8000-000000000001' and ended_at is null),(select snapshot from field_pilot_active_segment),'inactive work denial preserves the original open segment');
update public.production_tasks set active=true where id='c5000000-0000-4000-8000-000000000001';
update public.projects set status='on_hold' where id='c3000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000001',40,-120,10)$$,'P0001','Active job is required before starting work.','project hold after clock-in blocks start retry');
reset role;
update public.projects set status='active' where id='c3000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_start_break_v2()$$,'break closes active task');
select extensions.throws_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000001',40,-120,10)$$,'P0001','End your break before starting work.','no work during break');
select extensions.lives_ok($$select public.carez_employee_end_break_v2()$$,'end break');
select extensions.lives_ok($$select public.carez_employee_start_work_v2('c7000000-0000-4000-8000-000000000001',40,-120,10)$$,'resume selected operation explicitly');
reset role;
set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_complete_work_package_operation_v2('c7000000-0000-4000-8000-000000000001')$$,'complete non-ticket operation');
select extensions.lives_ok($$select public.carez_employee_clock_out_v2(40,-120,10,'Fixture shift')$$,'submit shift');
select extensions.is((public.employee_portal_state()->'recent'->0->>'status'),'submitted','reopen confirms submitted state');
select extensions.is((select count(*) from public.timecards),0::bigint,'employee cannot see/post labor cost before review');
reset role;
create temp table field_review_shift as select id from public.employee_shift_sessions where company_id='c2000000-0000-4000-8000-000000000001' and crew_member_id='c4000000-0000-4000-8000-000000000001' and status='submitted' order by clock_in_at desc limit 1;
grant select on field_review_shift to authenticated;set local role authenticated;
select extensions.throws_ok($$select public.carez_approve_shift_v3((select id from field_review_shift),1.75,0,null,null,null)$$,'P0001','Owner or office authority required','employee cannot approve the actual submitted shift');
reset role;
select extensions.is((select status from public.employee_shift_sessions where id=(select id from field_review_shift)),'submitted','employee denial retains the actual submitted shift');
select extensions.is((select count(*) from public.timecards where source_shift_id=(select id from field_review_shift)),0::bigint,'employee denial creates no cost');
set local role authenticated;
reset role;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.throws_ok($$select public.carez_approve_owner_shift((select id from public.employee_shift_sessions where company_id=public.get_my_company_id() and status='submitted'),-1,0,null)$$,'P0001','Enter finite nonnegative reviewed hours to two decimal places','negative hours denied');
select extensions.lives_ok($$select public.carez_approve_owner_shift((select id from public.employee_shift_sessions where company_id=public.get_my_company_id() and status='submitted'),1.75,0,'Reviewed fixture')$$,'office approves internal cost atomically');
select extensions.lives_ok($$select public.carez_approve_owner_shift((select id from public.employee_shift_sessions where company_id=public.get_my_company_id() and status='approved'),1.75,0,'Reviewed fixture')$$,'approval retry returns existing posting');
select extensions.is((select count(*) from public.timecards where company_id=public.get_my_company_id()),1::bigint,'one durable timecard');
select extensions.is((select direct_labor_cost from public.timecards where company_id=public.get_my_company_id()),70::numeric,'internal rate is authoritative, not hourly fallback');
select extensions.is((select overhead_recovery_cost from public.timecards where company_id=public.get_my_company_id()),8.75::numeric,'table-returning snapshot rate is applied');
select extensions.is((select sum(direct_labor_cost) from public.timecards where project_id='c3000000-0000-4000-8000-000000000001'),70::numeric,'recorded job labor posts once');
select extensions.is((select count(*) from public.project_budget_actual_summary where project_id='c3000000-0000-4000-8000-000000000001'),0::bigint,'unbudgeted summary is absent, not evidence of zero actual cost');
select extensions.is((select actual_company_cost from public.project_financial_summary where project_id='c3000000-0000-4000-8000-000000000001'),70::numeric,'unbudgeted posted cost remains visible');
select extensions.is((select actual_labor_hours from public.project_financial_summary where project_id='c3000000-0000-4000-8000-000000000001'),1.75::numeric,'unbudgeted posted hours remain visible');
insert into public.project_budgets(company_id,project_id,label,status) values(public.get_my_company_id(),'c3000000-0000-4000-8000-000000000001','Local fixture planning budget','active');
select extensions.is((select actual_direct_labor_cost from public.project_budget_actual_summary where project_id='c3000000-0000-4000-8000-000000000001'),70::numeric,'budgeted downstream labor reflects one posting');
select extensions.is((select actual_company_cost from public.project_financial_summary where project_id='c3000000-0000-4000-8000-000000000001'),70::numeric,'adding a budget does not change posted cost');
select extensions.is((select actual_labor_hours from public.project_financial_summary where project_id='c3000000-0000-4000-8000-000000000001'),1.75::numeric,'adding a budget does not change posted hours');
select extensions.lives_ok($$select public.carez_record_verified_production('c3000000-0000-4000-8000-000000000001',current_date,'c5000000-0000-4000-8000-000000000001',100,'SF','fixture')$$,'verified production saves');
select extensions.lives_ok($$select public.carez_record_verified_production('c3000000-0000-4000-8000-000000000001',current_date,'c5000000-0000-4000-8000-000000000001',100,'SF','fixture')$$,'verified production retry upserts intended tenant key');
select extensions.is((select count(*) from public.daily_production_records where company_id=public.get_my_company_id()),1::bigint,'production retry records once');
select extensions.throws_ok($$select public.carez_record_verified_production('c3000000-0000-4000-8000-000000000001',current_date,'c5000000-0000-4000-8000-000000000001',100,'CY','fixture')$$,'P0001','Production unit must match the recorded work type.','mismatched unit denied');
select extensions.throws_ok($$select public.carez_record_verified_production('c3000000-0000-4000-8000-000000000004',current_date,'c5000000-0000-4000-8000-000000000001',100,'SF','fixture')$$,'P0001','Active job unavailable.','cross-tenant production denied');
reset role;
update public.production_tasks set active=false where id='c5000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select public.carez_record_verified_production('c3000000-0000-4000-8000-000000000001',current_date,'c5000000-0000-4000-8000-000000000001',101,'SF','inactive task attempt')$$,'P0001','Production unit must match the recorded work type.','inactive work type cannot overwrite verified production');
select extensions.is((select quantity_completed from public.daily_production_records where company_id=public.get_my_company_id() and project_id='c3000000-0000-4000-8000-000000000001' and work_date=current_date and production_task_id='c5000000-0000-4000-8000-000000000001'),100::numeric,'inactive work denial preserves the verified quantity');
select extensions.is((select count(*) from public.daily_production_records where company_id=public.get_my_company_id()),1::bigint,'inactive work denial adds no production record');
reset role;
update public.production_tasks set active=true where id='c5000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.is(public.carez_record_daily_log('c9000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',current_date,'Fixture daily work',2,10,null,null,null),public.carez_record_daily_log('c9000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',current_date,'Fixture daily work',2,10,null,null,null),'daily-log retry returns the saved ID');
select extensions.is((select count(*) from public.daily_logs where company_id=public.get_my_company_id() and client_request_id='c9000000-0000-4000-8000-000000000001'),1::bigint,'daily-log retry records once');
select extensions.throws_ok($$select public.carez_record_daily_log('c9000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',current_date,'Fixture daily work',2,11,null,null,null)$$,'P0001','This request already recorded different work. Reopen the saved log.','changed daily-log retry payload is rejected');
select extensions.is((select concrete_yards from public.daily_logs where company_id=public.get_my_company_id() and client_request_id='c9000000-0000-4000-8000-000000000001'),10::numeric,'changed daily-log retry preserves placed quantity');
update public.projects set status='on_hold' where id='c3000000-0000-4000-8000-000000000001' and company_id=public.get_my_company_id();
select extensions.is(public.carez_record_daily_log('c9000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',current_date,'Fixture daily work',2,10,null,null,null),(select id from public.daily_logs where company_id=public.get_my_company_id() and client_request_id='c9000000-0000-4000-8000-000000000001'),'held-project retry returns the saved daily log');
select extensions.throws_ok($$select public.carez_record_daily_log('c9000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001',current_date,'New held-project work',2,10,null,null,null)$$,'P0001','Active job unavailable.','held project rejects a new daily-log request');
select extensions.is((select count(*) from public.daily_logs where company_id=public.get_my_company_id() and client_request_id in ('c9000000-0000-4000-8000-000000000001','c9000000-0000-4000-8000-000000000002')),1::bigint,'held-project retry and denied new request add no log');
update public.projects set status='active' where id='c3000000-0000-4000-8000-000000000001' and company_id=public.get_my_company_id();
reset role;
-- Inject a failure after timecard INSERT but before shift UPDATE: RPC must roll back both.
-- Capture a real second clock submission before fault injection; no missing
-- employee identity, unbound owner session, or invented frozen cost basis.
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);set local role authenticated;
select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000001',40,-120,10);
select public.carez_employee_clock_out_v2(40,-120,10,'Synthetic fault-injection shift');reset role;
create temp table field_failure_shift as select id from public.employee_shift_sessions where company_id='c2000000-0000-4000-8000-000000000001' and crew_member_id='c4000000-0000-4000-8000-000000000001' and status='submitted' order by clock_in_at desc limit 1;
grant select on field_failure_shift to authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
create function pg_temp.fail_approval() returns trigger language plpgsql as $$begin if new.id=(select id from field_failure_shift) and new.status='approved' then raise exception 'fixture injected approval failure';end if;return new;end$$;
create trigger fixture_fail_approval before update on public.employee_shift_sessions for each row execute function pg_temp.fail_approval();
set local role authenticated;
select extensions.throws_ok($$select public.carez_approve_owner_shift((select id from field_failure_shift),1,0,'Explicit reviewed one-hour correction for synthetic fault test')$$,'P0001','fixture injected approval failure','partial approval fails atomically');
select extensions.is((select count(*) from public.timecards where source_shift_id=(select id from field_failure_shift)),0::bigint,'failed approval leaves no cost');
reset role;
drop trigger fixture_fail_approval on public.employee_shift_sessions;
set local role authenticated;
select extensions.lives_ok($$select public.carez_approve_owner_shift((select id from field_failure_shift),1,0,'Explicit reviewed one-hour correction for synthetic fault test')$$,'failed approval can be retried');
reset role;
-- A genuinely submitted employee-class shift remains unavailable for costing
-- when statutory configuration is missing; employee labor is not unsupported.
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000004',true);set local role authenticated;
select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000001',40,-120,10);
select public.carez_employee_clock_out_v2(40,-120,10,'Synthetic missing statutory configuration');reset role;
create temp table field_statutory_shift as select id from public.employee_shift_sessions where company_id='c2000000-0000-4000-8000-000000000001' and crew_member_id='c4000000-0000-4000-8000-000000000002' and status='submitted' order by clock_in_at desc limit 1;
grant select on field_statutory_shift to authenticated;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);set local role authenticated;
select extensions.throws_like($$select public.carez_approve_shift_v3((select id from field_statutory_shift),1,0,'SYN-MISSING',current_date,'Reviewed synthetic missing statutory configuration')$$,'%Verified tax settings and active L&I class are required%','missing statutory configuration fails closed through the supported employee review command');
reset role;
select extensions.is((select status from public.employee_shift_sessions where id=(select id from field_statutory_shift)),'submitted','missing tax configuration retains submitted employee time');
select extensions.is((select count(*) from public.timecards where source_shift_id=(select id from field_statutory_shift)),0::bigint,'missing tax configuration posts no employee cost');
select * from extensions.finish();
rollback;
