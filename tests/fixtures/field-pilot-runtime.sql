-- Disposable local database only. Every write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into auth.users(id,email) values
 ('c1000000-0000-4000-8000-000000000001','owner@pilot.invalid'),('c1000000-0000-4000-8000-000000000002','office@pilot.invalid'),('c1000000-0000-4000-8000-000000000003','internal@pilot.invalid'),('c1000000-0000-4000-8000-000000000004','statutory@pilot.invalid'),('c1000000-0000-4000-8000-000000000005','other@pilot.invalid');
insert into public.companies(id,name) values ('c2000000-0000-4000-8000-000000000001','Pilot fixture contractor'),('c2000000-0000-4000-8000-000000000002','Other fixture contractor');
insert into public.profiles(id,company_id,role,full_name) values
 ('c1000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','owner','Local Owner'),
 ('c1000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','office','Local Office'),
 ('c1000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','employee','Internal Field Worker'),
 ('c1000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000001','employee','Statutory Worker'),
 ('c1000000-0000-4000-8000-000000000005','c2000000-0000-4000-8000-000000000002','owner','Other Owner');
insert into public.projects(id,company_id,job_number,name,status,sales_tax_exempt) values
 ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','LOCAL-FIELD-1','Ready fixture','active',true),
 ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','LOCAL-FIELD-2','Setup held fixture','active',true),
 ('c3000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','LOCAL-FIELD-3','Other job fixture','active',true),
 ('c3000000-0000-4000-8000-000000000004','c2000000-0000-4000-8000-000000000002','LOCAL-FIELD-4','Foreign fixture','active',true);
insert into public.project_award_records(company_id,project_id,agreement_number,original_contract_value) values('c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','LOCAL-AG',1000);
insert into public.crew_members(id,company_id,profile_id,name,role,active,is_owner,internal_field_rate,hourly_rate) values
 ('c4000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000003','Internal Field Worker','finisher',true,true,40,99),
 ('c4000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000004','Statutory Worker','finisher',true,false,null,30);
insert into public.production_tasks(id,company_id,name,production_unit,active) values('c5000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Fixture finish','SF',true);
insert into public.work_packages(id,company_id,project_id,name) values
 ('c6000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','Fixture package'),
 ('c6000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000003','Other package');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,sequence,planned_quantity,unit,measurement_method,status) values
 ('c7000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','Ready finish',10,100,'SF','completion','planned'),
 ('c7000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000001','Wrong job',10,100,'SF','completion','planned'),
 ('c7000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','Inspection held',20,100,'SF','completion','planned');
insert into public.project_inspections(company_id,project_id,required_for_operation_id,title,inspection_type,status) values('c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000003','Fixture inspection','forms','required');
insert into public.overhead_rate_snapshots(company_id,effective_date,overhead_rate_per_productive_hour,source_type,source_label) values('c2000000-0000-4000-8000-000000000001',current_date,5,'configured','Fixture configured rate');
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select extensions.throws_ok($$select public.carez_employee_clock_in_v2('c3000000-0000-4000-8000-000000000004',null,null,null)$$,'P0001','Active job not found.','foreign job denied');
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
update public.employee_shift_sessions set clock_in_at=now()-interval '2 hours' where company_id='c2000000-0000-4000-8000-000000000001' and status='active';
update public.employee_task_segments set started_at=now()-interval '2 hours',ended_at=now()-interval '1 hour' where company_id='c2000000-0000-4000-8000-000000000001' and ended_at is not null;
update public.employee_task_segments set started_at=now()-interval '45 minutes' where company_id='c2000000-0000-4000-8000-000000000001' and ended_at is null;
update public.employee_break_periods set started_at=now()-interval '1 hour',ended_at=now()-interval '45 minutes' where company_id='c2000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_complete_work_package_operation_v2('c7000000-0000-4000-8000-000000000001')$$,'complete non-ticket operation');
select extensions.lives_ok($$select public.carez_employee_clock_out_v2(40,-120,10,'Fixture shift')$$,'submit shift');
select extensions.is((public.employee_portal_state()->'recent'->0->>'status'),'submitted','reopen confirms submitted state');
select extensions.is((select count(*) from public.timecards),0::bigint,'employee cannot see/post labor cost before review');
select extensions.throws_ok($$select public.carez_approve_owner_shift((select (public.employee_portal_state()->'recent'->0->>'id')::uuid),1.75,0,null)$$,'P0001','Owner or office access required.','employee approval denied');
reset role;
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.throws_ok($$select public.carez_approve_owner_shift((select id from public.employee_shift_sessions where company_id=public.get_my_company_id() and status='submitted'),-1,0,null)$$,'P0001','Enter finite, nonnegative hours to two decimals with a positive total.','negative hours denied');
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
insert into public.employee_shift_sessions(id,company_id,project_id,crew_member_id,work_date,status,clock_in_at,clock_out_at) values('c8000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001',current_date,'submitted',now()-interval '1 hour',now());
create function pg_temp.fail_approval() returns trigger language plpgsql as $$begin if new.id='c8000000-0000-4000-8000-000000000001' and new.status='approved' then raise exception 'fixture injected approval failure';end if;return new;end$$;
create trigger fixture_fail_approval before update on public.employee_shift_sessions for each row execute function pg_temp.fail_approval();
set local role authenticated;
select extensions.throws_ok($$select public.carez_approve_owner_shift('c8000000-0000-4000-8000-000000000001',1,0,null)$$,'P0001','fixture injected approval failure','partial approval fails atomically');
select extensions.is((select count(*) from public.timecards where source_shift_id='c8000000-0000-4000-8000-000000000001'),0::bigint,'failed approval leaves no cost');
reset role;
drop trigger fixture_fail_approval on public.employee_shift_sessions;
set local role authenticated;
select extensions.lives_ok($$select public.carez_approve_owner_shift('c8000000-0000-4000-8000-000000000001',1,0,null)$$,'failed approval can be retried');
reset role;
insert into public.employee_shift_sessions(id,company_id,project_id,crew_member_id,work_date,status) values('c8000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002',current_date,'submitted');
set local role authenticated;
select extensions.throws_ok($$select public.carez_approve_owner_shift('c8000000-0000-4000-8000-000000000002',1,0,null)$$,'P0001','Statutory employee costing is unavailable in this pilot. Time remains submitted; no cost was posted.','unsupported tax contract remains unavailable');
select * from extensions.finish();
rollback;
