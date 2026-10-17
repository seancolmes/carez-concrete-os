-- Isolated local records. Setup does not qualify hosted Auth, GPS or payroll taxes.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('e9100000-0000-4000-8000-000000000001','clock-owner@local.invalid'),
 ('e9100000-0000-4000-8000-000000000002','clock-worker@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone,target_margin_percent,planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate)
 values('e9200000-0000-4000-8000-000000000001','Synthetic frozen labor contractor','UTC',0,2000,0,0,0);
insert into public.profiles(id,company_id,full_name,role) values
 ('e9100000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','Fixture owner','owner'),
 ('e9100000-0000-4000-8000-000000000002','e9200000-0000-4000-8000-000000000001','Fixture field login','employee');
insert into public.crew_members(id,company_id,profile_id,name,role,is_owner,worker_type,availability_type,internal_field_rate,hourly_rate,active)
 values('e9300000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9100000-0000-4000-8000-000000000002','Fixture internal worker','finisher',true,'owner','regular',40,0,true);
insert into public.crew_employment_terms(company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,internal_field_rate,hourly_rate,source_type,reason,created_by)
 values('e9200000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000001',0,(clock_timestamp() at time zone 'UTC')::date-30,'owner','regular',40,0,'administration','Explicit synthetic established terms','e9100000-0000-4000-8000-000000000001');
insert into public.projects(id,company_id,job_number,name,status,work_timezone) values
 ('e9400000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','SYN-CLOCK','Synthetic calendar job','active','America/Los_Angeles');
select extensions.is(public.carez_shift_start_work_date('2026-10-17T05:00:00Z',null,'America/Los_Angeles'),'2026-10-16'::date,'company fallback derives start day, not UTC day');
select extensions.is(public.carez_shift_start_work_date('2026-10-17T05:00:00Z','America/New_York','America/Los_Angeles'),'2026-10-17'::date,'job override supplies its own start day');
select extensions.is(public.carez_shift_start_work_date('2026-11-01T08:30:00Z','America/Los_Angeles','UTC'),'2026-11-01'::date,'fall-back start day is explicit');
select extensions.is(extract(epoch from ('2026-11-01T09:30:00Z'::timestamptz-'2026-11-01T08:30:00Z'::timestamptz))/3600,1::numeric,'repeated local hour retains actual UTC elapsed hour');
select extensions.throws_like($$select public.carez_shift_start_work_date(now(),null,null)$$,'%Verified operating time zone%','missing calendar never falls back to server or device zone');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_clock_in_v2('e9400000-0000-4000-8000-000000000001',null,null,null)$$,'linked employee login can clock an owner-classified internal-cost shift');
select extensions.lives_ok($$select public.carez_employee_clock_in_v2('e9400000-0000-4000-8000-000000000001',null,null,null)$$,'uncertain clock-in retry returns the same active shift');
reset role;
create temp table frozen_first_shift as select * from public.employee_shift_sessions where company_id='e9200000-0000-4000-8000-000000000001';
grant select on frozen_first_shift to authenticated;
select extensions.is((select count(*)::int from frozen_first_shift),1,'retry captures one shift');
select extensions.is((select base_hourly_rate_snapshot from frozen_first_shift),40::numeric,'shift captures applicable recorded rate');
select extensions.is((select worker_type_snapshot from frozen_first_shift),'owner','financial worker type is independent of employee login role');
select extensions.is((select work_timezone_snapshot from frozen_first_shift),'America/Los_Angeles','shift captures job calendar');
select extensions.is((select work_date from frozen_first_shift),(select (clock_in_at at time zone work_timezone_snapshot)::date from frozen_first_shift),'work date is derived from captured start instant and zone');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($$select public.carez_administer_crew('rate','e9500000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000001',0,jsonb_build_object('amount',95,'effective_date',public.carez_company_calendar_date('e9200000-0000-4000-8000-000000000001',clock_timestamp()),'reason','Synthetic later rate'))$$,'later Crew rate update persists through governed authority');
select extensions.lives_ok($$select public.carez_administer_crew('update','e9500000-0000-4000-8000-000000000002','e9300000-0000-4000-8000-000000000001',1,jsonb_build_object('effective_date',public.carez_company_calendar_date('e9200000-0000-4000-8000-000000000001',clock_timestamp()),'reason','Synthetic deactivate during shift','name','Fixture internal worker','role','finisher','worker_type','owner','availability_type','regular','hourly_rate',0,'internal_field_rate',95,'active',false,'skills','[]'::jsonb))$$,'deactivation during an existing shift is recorded');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000002',true);
select extensions.ok((public.employee_portal_state()->'active_shift'->>'id') is not null,'deactivated worker can still reach the bound active clock');
select extensions.throws_like($$select public.carez_employee_start_task_v2(null,null,null,null)$$,'%Current Crew access%','deactivated access cannot start new work');
select extensions.lives_ok($$select public.carez_employee_start_break_v2()$$,'deactivation does not strand break recording');
select extensions.lives_ok($$select public.carez_employee_end_break_v2()$$,'deactivation does not strand break completion');
select extensions.lives_ok($$select public.carez_employee_clock_out_v2(null,null,null,'Synthetic close')$$,'deactivated worker can finish the bound clock');
select extensions.throws_like($$update public.employee_shift_sessions set work_date=work_date+1 where id=(select id from frozen_first_shift)$$,'%permission denied%','raw employee changes cannot backdate a captured shift');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000001',true);
select extensions.lives_ok($$select public.carez_administer_crew('update','e9500000-0000-4000-8000-000000000003','e9300000-0000-4000-8000-000000000001',2,jsonb_build_object('effective_date',public.carez_company_calendar_date('e9200000-0000-4000-8000-000000000001',clock_timestamp()),'reason','Synthetic restore access','name','Fixture internal worker','role','finisher','worker_type','owner','availability_type','regular','hourly_rate',0,'internal_field_rate',95,'active',true,'skills','[]'::jsonb))$$,'restored active access is governed');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000002',true);
select extensions.lives_ok($$select public.carez_employee_clock_in_v2('e9400000-0000-4000-8000-000000000001',null,null,null)$$,'submitted unapproved attendance does not block a new shift');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000001',true);
select extensions.lives_ok($$select public.carez_approve_owner_shift((select id from frozen_first_shift),1,0,'Synthetic approved duration correction')$$,'owner approval uses the captured basis after a later rate edit');
select extensions.is((select gross_wage_cost from public.timecards where source_shift_id=(select id from frozen_first_shift)),40::numeric,'one approved hour uses frozen40, not current95');
select extensions.is((select base_hourly_rate from public.timecards where source_shift_id=(select id from frozen_first_shift)),40::numeric,'timecard carries frozen rate');
select extensions.is((select worker_type_snapshot from public.timecards where source_shift_id=(select id from frozen_first_shift)),'owner','timecard carries financial classification');
select extensions.lives_ok($$select public.carez_set_operating_calendar('e9500000-0000-4000-8000-000000000004','America/New_York',null)$$,'owner changes prospective company calendar');
select extensions.is((select work_date from public.employee_shift_sessions where id=(select id from frozen_first_shift)),(select work_date from frozen_first_shift),'calendar change does not relabel recorded shift');
select extensions.throws_like($$update public.companies set operating_timezone='UTC' where id='e9200000-0000-4000-8000-000000000001'$$,'%governed operating calendar%','raw calendar update is denied');
select extensions.throws_like($$select public.carez_set_operating_calendar('e9500000-0000-4000-8000-000000000005','not/a-zone',null)$$,'%valid IANA%','invalid operating zone rejected');
reset role;
select * from extensions.finish();
rollback;
