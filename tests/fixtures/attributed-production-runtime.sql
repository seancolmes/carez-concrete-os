-- Isolated employee-source regression for 20261016134900.
-- No source schema constraint is relaxed. Captured identities come from the real
-- employee-class Crew -> invitation -> signup -> clock-in/out path. Owner manual
-- cost remains a separate source and never fabricates a clock identity.
-- Disposable local PostgreSQL only: all records and writes roll back.
-- No trigger is disabled. No award/acceptance/commercial readiness is fabricated.
-- Governed signup, company plan, Crew terms, shift approval, manual posting and
-- verified quantity commands are used. Historical submitted attendance and its
-- closed task segments are fixture input, not evidence of clock/GPS capture,
-- physical-work authorization, payroll-provider execution or browser usability.
begin;
set local time zone 'UTC';
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

-- Let the real signup trigger establish owner/company identities. In contrast
-- to older fixtures, this does not disable on_auth_user_created.
insert into auth.users(id,email,raw_user_meta_data) values
 ('e9a10000-0000-4000-8000-000000000001','reports-rate-owner@local.invalid',
  '{"company_name":"Synthetic attributed production contractor","full_name":"Synthetic rate owner","operating_timezone":"UTC"}'::jsonb),
 ('e9a10000-0000-4000-8000-000000000002','reports-rate-foreign@local.invalid',
  '{"company_name":"Synthetic foreign rate contractor","full_name":"Synthetic foreign owner","operating_timezone":"UTC"}'::jsonb);

create temp table reports_rate_context as
 select p.id owner_id,p.company_id,current_date-2 work_day
 from public.profiles p where p.id='e9a10000-0000-4000-8000-000000000001';
create temp table reports_rate_results(name text primary key,result jsonb not null);
grant select on reports_rate_context,reports_rate_results to authenticated;
grant insert on reports_rate_results to authenticated;

select extensions.is((select count(*)::int from reports_rate_context),1,'signup establishes the isolated owner/company context');
select set_config('request.jwt.claim.sub','e9a10000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into reports_rate_results(name,result)
 select 'plan',public.carez_save_company_plan(
  'e9a20000-0000-4000-8000-000000000001',0,
  jsonb_build_object('target_margin_percent',0,'planned_productive_hours_annual',2000,
   'owner_compensation_target_annual',0,'owner_planned_field_hours_annual',0,'owner_field_rate',40));
insert into reports_rate_results(name,result)
 select 'owner-crew',public.carez_administer_crew('create',
  'e9a20000-0000-4000-8000-000000000002',null,null,
  jsonb_build_object('effective_date',(select work_day-30 from reports_rate_context),
   'reason','Explicit synthetic internal-cost terms for the separate reviewed manual source',
   'name','Synthetic owner-class field worker','role','finisher',
   'worker_type','owner','availability_type','regular','hourly_rate',0,
   'internal_field_rate',40,'skills','[]'::jsonb));
select extensions.is((select count(*)::int from public.crew_employment_terms),1,'governed Crew creation records the real immutable owner-class terms');
select extensions.is((select worker_type from public.crew_employment_terms),'owner','financial worker basis is owner class');
select extensions.is((select internal_field_rate from public.crew_employment_terms),40::numeric,'recorded owner manual terms carry the explicit40 rate');

-- Genuine employee-class test worker, not an employee login invented for the
-- owner-class manual source. Every immutable worker/configuration record below
-- is created by the current governed command, with an explicit synthetic basis.
insert into reports_rate_results(name,result)
 select 'crew',public.carez_administer_crew('create',
  'e9a20000-0000-4000-8000-000000000004',null,null,
  jsonb_build_object('effective_date',(select work_day-30 from reports_rate_context),
   'reason','Explicit synthetic employee wage terms for source-identity and task-allocation tests',
   'name','Synthetic attributed W2 employee','role','finisher',
   'worker_type','employee','availability_type','regular','hourly_rate',40,
   'internal_field_rate',null,'default_risk_class_code','SYN-RATE','skills','[]'::jsonb));
insert into reports_rate_results(name,result)
 select 'tax',public.carez_configure_labor_tax_v1(
  'e9a20000-0000-4000-8000-000000000005','tax',extract(year from current_date)::integer,
  jsonb_build_object('reason','SYNTHETIC FIXTURE ONLY: explicit zero burdens are not statutory rates',
   'social_security_rate',0,'social_security_wage_base',100000,
   'medicare_rate',0,'futa_rate',0,'futa_wage_base',100000,
   'wa_sui_rate',0,'wa_sui_wage_base',100000,'sick_leave_accrual_rate',0));
insert into reports_rate_results(name,result)
 select 'risk',public.carez_configure_labor_tax_v1(
  'e9a20000-0000-4000-8000-000000000006','risk',extract(year from current_date)::integer,
  jsonb_build_object('reason','SYNTHETIC FIXTURE ONLY: explicit zero employer-cost class',
   'code','SYN-RATE','name','Synthetic rate-attribution class','active',true,
   'composite_rate_per_hour',0,'employee_deduction_per_hour',0,'employer_rate_per_hour',0));
insert into reports_rate_results(name,result)
 select 'opening',public.carez_verify_labor_opening_v1(
  'e9a20000-0000-4000-8000-000000000007',
  (select (result->>'crew_member_id')::uuid from reports_rate_results where name='crew'),
  extract(year from current_date)::integer,
  jsonb_build_object('opening_as_of',make_date(extract(year from current_date)::integer,1,1)-1,
   'social_security_wages',0,'futa_wages',0,'wa_sui_wages',0,
   'verification_reference','SYNTHETIC FIXTURE ONLY: reviewed zero opening payroll wages'));
select extensions.lives_ok($$select public.carez_issue_employee_invite(
 (select (result->>'crew_member_id')::uuid from reports_rate_results where name='crew'),
 encode(sha256(convert_to(repeat('e',48),'UTF8')),'hex'))$$,'owner issues the real invitation for the employee-class Crew member');
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
 ('e9a10000-0000-4000-8000-000000000003','reports-rate-employee@local.invalid',
  jsonb_build_object('employee_invite_token',repeat('e',48)));
select extensions.ok((select p.role='employee' and p.company_id=c.company_id
 from public.profiles p join public.crew_members c on c.company_id=p.company_id and c.profile_id=p.id
 where p.id='e9a10000-0000-4000-8000-000000000003'
  and c.id=(select (result->>'crew_member_id')::uuid from reports_rate_results where name='crew')),
 'real signup binds this employee identity to the actual employee-class Crew member');
select extensions.is((select worker_type from public.crew_employment_terms where crew_member_id=(select (result->>'crew_member_id')::uuid from reports_rate_results where name='crew')),'employee','captured allocation labor has genuine employee financial classification');
select extensions.is((select count(*)::int from public.labor_configuration_versions),2,'employee cost has independent immutable tax and risk configuration versions');

-- Read-model fixtures need no fabricated accepted agreement or budget.
insert into public.projects(id,company_id,job_number,name,status,work_timezone,contract_value)
 select v.id,c.company_id,v.job_number,v.name,'active','UTC',0
 from reports_rate_context c cross join (values
  ('e9a30000-0000-4000-8000-000000000001'::uuid,'SYN-RATE-A','Synthetic task allocation job'),
  ('e9a30000-0000-4000-8000-000000000002'::uuid,'SYN-RATE-B','Synthetic other job'))v(id,job_number,name);
insert into public.production_tasks(id,company_id,name,production_unit,active)
 select v.id,c.company_id,v.name,'SF',true
 from reports_rate_context c cross join (values
  ('e9a40000-0000-4000-8000-000000000001'::uuid,'Synthetic task A'),
  ('e9a40000-0000-4000-8000-000000000002'::uuid,'Synthetic task B'),
  ('e9a40000-0000-4000-8000-000000000003'::uuid,'Synthetic manually named task'),
  ('e9a40000-0000-4000-8000-000000000004'::uuid,'Synthetic no-attribution task'),
  ('e9a40000-0000-4000-8000-000000000005'::uuid,'Synthetic recorded-zero task'))v(id,name);

-- A real clock round trip demonstrates that the exact current governed
-- command writes a nonnull authenticated profile in the production-shaped table.
-- No task is started: these jobs deliberately have no accepted commercial setup.
-- This is clock/identity contract evidence only, not physical-work/GPS acceptance.
select set_config('request.jwt.claim.sub','e9a10000-0000-4000-8000-000000000003',true);
set local role authenticated;
insert into reports_rate_results(name,result)
 select 'clock-witness',public.carez_employee_clock_in_v2(
  'e9a30000-0000-4000-8000-000000000001',null,null,null,'Synthetic local fixture');
select extensions.lives_ok($$select public.carez_employee_clock_out_v2(null,null,null,'Synthetic identity witness only; no physical task performed')$$,
 'real employee clock-out submits the identity witness without posting cost');
reset role;
select extensions.ok((select employee_profile_id='e9a10000-0000-4000-8000-000000000003'
 and company_id=(select company_id from reports_rate_context)
 and crew_member_id=(select (result->>'crew_member_id')::uuid from reports_rate_results where name='crew')
 and worker_type_snapshot='employee' and labor_basis_source='terms_capture' and status='submitted'
 from public.employee_shift_sessions where id=(select (result->>'shift_id')::uuid from reports_rate_results where name='clock-witness')),
 'governed clock captures the actual employee, tenant, Crew identity and employee financial basis');

-- Explicit privileged historical fixture input, not a backdated capture of
-- today's company plan. This recorded synthetic prior basis is effective on
-- work_day and remains valid for work_day+1. Actual insertion/capture timestamps
-- retain their defaults. No active overhead items and owner management recovery
-- max(0 - 0 * 40, 0) give annual overhead0; /2000 productive hours gives rate0.
-- This seam qualifies consuming known immutable history, not a historical
-- configuration/import workflow, statutory rates, or real company assumptions.
insert into public.overhead_rate_snapshots(
 id,company_id,effective_date,annual_overhead,planned_productive_hours,
 overhead_rate_per_productive_hour,source,source_type,source_label,notes,
 created_by,inputs_hash,calculation_inputs)
select 'e9a60000-0000-4000-8000-000000000001'::uuid,c.company_id,c.work_day,
 0,2000,0,'company_plan_v2','configured','SYNTHETIC FIXTURE ONLY: recorded historical zero overhead',
 'Explicit synthetic prior inputs; not inferred or captured from current assumptions. Annual overhead0 / productive hours2000 = rate0.',
 c.owner_id,encode(extensions.digest(h.inputs::text,'sha256'),'hex'),h.inputs
from reports_rate_context c
cross join (select jsonb_build_object(
 'method','productive_hour_v2','plan_revision',1,'owner_compensation',0,
 'owner_field_hours',0,'owner_field_rate',40,'productive_hours',2000,
 'items','[]'::jsonb) inputs) h;

-- Four historical submitted attendance inputs reuse that actual captured source
-- identity and terms. Dates, durations and closed segments are an explicit local
-- fixture seam, not a claim of observed GPS/clock duration or task authorization.
-- Both working dates are in the past. The live witness remains submitted and
-- unposted; it supplies no approved hours or rates to the financial read model.
insert into public.employee_shift_sessions(
 id,company_id,project_id,crew_member_id,employee_profile_id,work_date,status,clock_in_at,clock_out_at,
 crew_terms_id,worker_type_snapshot,base_hourly_rate_snapshot,default_risk_class_snapshot,
 work_timezone_snapshot,company_terms_date,work_date_policy_version,labor_basis_source)
 select v.id,c.company_id,v.project_id,t.crew_member_id,w.employee_profile_id,c.work_day+v.day_offset,
  'submitted',(c.work_day+v.day_offset+time '08:00') at time zone 'UTC',
  (c.work_day+v.day_offset+time '08:00'+v.elapsed_hours*interval '1 hour') at time zone 'UTC',
  w.crew_terms_id,w.worker_type_snapshot,w.base_hourly_rate_snapshot,w.default_risk_class_snapshot,
  w.work_timezone_snapshot,c.work_day+v.day_offset,w.work_date_policy_version,w.labor_basis_source
 from reports_rate_context c
 join public.crew_employment_terms t on t.company_id=c.company_id
  and t.crew_member_id=(select (result->>'crew_member_id')::uuid from reports_rate_results where name='crew')
 join public.employee_shift_sessions w on w.company_id=c.company_id and w.crew_member_id=t.crew_member_id
  and w.id=(select (result->>'shift_id')::uuid from reports_rate_results where name='clock-witness')
 cross join (values
  ('e9a50000-0000-4000-8000-000000000001'::uuid,'e9a30000-0000-4000-8000-000000000001'::uuid,0,8),
  ('e9a50000-0000-4000-8000-000000000002'::uuid,'e9a30000-0000-4000-8000-000000000002'::uuid,0,4),
  ('e9a50000-0000-4000-8000-000000000003'::uuid,'e9a30000-0000-4000-8000-000000000001'::uuid,1,3),
  ('e9a50000-0000-4000-8000-000000000004'::uuid,'e9a30000-0000-4000-8000-000000000001'::uuid,0,2)
 )v(id,project_id,day_offset,elapsed_hours);

insert into public.employee_task_segments(company_id,shift_id,crew_member_id,project_id,production_task_id,started_at,ended_at)
 select c.company_id,v.shift_id,s.crew_member_id,s.project_id,v.task_id,
  (c.work_day+v.day_offset+time '08:00'+v.start_hour*interval '1 hour') at time zone 'UTC',
  (c.work_day+v.day_offset+time '08:00'+v.end_hour*interval '1 hour') at time zone 'UTC'
 from reports_rate_context c cross join (values
  -- Repeated A/B segments preserve the two/six split, not task-count division.
  ('e9a50000-0000-4000-8000-000000000001'::uuid,'e9a40000-0000-4000-8000-000000000001'::uuid,0,0,1),
  ('e9a50000-0000-4000-8000-000000000001'::uuid,'e9a40000-0000-4000-8000-000000000002'::uuid,0,1,4),
  ('e9a50000-0000-4000-8000-000000000001'::uuid,'e9a40000-0000-4000-8000-000000000001'::uuid,0,4,5),
  ('e9a50000-0000-4000-8000-000000000001'::uuid,'e9a40000-0000-4000-8000-000000000002'::uuid,0,5,8),
  ('e9a50000-0000-4000-8000-000000000002'::uuid,'e9a40000-0000-4000-8000-000000000001'::uuid,0,0,4),
  ('e9a50000-0000-4000-8000-000000000003'::uuid,'e9a40000-0000-4000-8000-000000000001'::uuid,1,0,3)
 )v(shift_id,task_id,day_offset,start_hour,end_hour)
 join public.employee_shift_sessions s on s.company_id=c.company_id and s.id=v.shift_id;

select extensions.is((select count(*)::int from public.employee_task_segments where shift_id='e9a50000-0000-4000-8000-000000000001'),4,'main shift has repeated closed task evidence');
select extensions.is((select count(*)::int from public.timecards where company_id=(select company_id from reports_rate_context)),0,'submitted fixture shifts have no fabricated financial approval');

select set_config('request.jwt.claim.sub','e9a10000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.lives_ok($$select public.carez_approve_shift_v3('e9a50000-0000-4000-8000-000000000001',8,0,'SYN-RATE',current_date,'Synthetic repeated task evidence reviewed')$$,'real approval posts the8-hour multi-task shift');
select extensions.lives_ok($$select public.carez_approve_shift_v3('e9a50000-0000-4000-8000-000000000002',4,0,'SYN-RATE',current_date,'Synthetic other-project evidence reviewed')$$,'real approval posts the separate project');
select extensions.lives_ok($$select public.carez_approve_shift_v3('e9a50000-0000-4000-8000-000000000003',3,0,'SYN-RATE',current_date,'Synthetic other-date evidence reviewed')$$,'real approval posts the separate work date');
select extensions.lives_ok($$select public.carez_approve_shift_v3('e9a50000-0000-4000-8000-000000000004',2,0,'SYN-RATE',current_date,'Synthetic unassigned work remains unassigned')$$,'real approval can preserve reviewed hours without fabricating task identity');
select extensions.lives_ok($$select public.carez_approve_shift_v3('e9a50000-0000-4000-8000-000000000001',8,0,'SYN-RATE',current_date,'Synthetic repeated task evidence reviewed')$$,'identical approval retry preserves one source posting');
select extensions.is((select count(*)::int from public.timecards),4,'four historical reviewed shifts produce four timecards after retry; live clock witness stays unposted');
select extensions.ok(not exists(select 1 from public.timecards where source_shift_id=(select (result->>'shift_id')::uuid from reports_rate_results where name='clock-witness')),'identity witness does not fabricate approved cost');
select extensions.ok((select production_task_id is null from public.timecards where source_shift_id='e9a50000-0000-4000-8000-000000000001'),'multi-task timecard intentionally carries no single-task shortcut');
select extensions.is((select hours from public.timecards where source_shift_id='e9a50000-0000-4000-8000-000000000001'),8::numeric,'approved shift retains eight hours');

-- This deliberately uses the same visible work-type name as a real task, but
-- it has no production_task_id. The read model must never infer an ID by name.
select extensions.lives_ok($$select public.carez_record_manual_labor_v1(
 'e9a20000-0000-4000-8000-000000000003','e9a30000-0000-4000-8000-000000000001',
 (select (result->>'crew_member_id')::uuid from reports_rate_results where name='owner-crew'),
 jsonb_build_object('source_reference','SYN-RATE-MANUAL:LINE-1',
 'reason','Explicit synthetic reviewed time without captured task identity',
 'task','Synthetic manually named task','confirmed',true,'worker_type','owner',
 'base_hourly_rate',40,'work_date',(select work_day from reports_rate_context),
 'work_timezone','UTC','regular_hours',2,'overtime_hours',0))$$,
 'real owner-class manual command posts reviewed cost without an employee clock identity');
select extensions.ok((select source_shift_id is null and production_task_id is null
 from public.timecards where manual_labor_entry_id is not null),'manual cost has no invented shift or task ID');

-- Keep the real verification command, nonnegative quantity validation and task
-- unit contract. One view sample continues to mean one verified daily row.
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000001',(select work_day from reports_rate_context),'e9a40000-0000-4000-8000-000000000001',100,'SF','Synthetic verified task A')$$,'record main task A quantity');
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000001',(select work_day from reports_rate_context),'e9a40000-0000-4000-8000-000000000002',300,'SF','Synthetic verified task B')$$,'record main task B quantity');
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000002',(select work_day from reports_rate_context),'e9a40000-0000-4000-8000-000000000001',80,'SF','Synthetic other project quantity')$$,'record independent other-project task A');
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000001',(select work_day+1 from reports_rate_context),'e9a40000-0000-4000-8000-000000000001',90,'SF','Synthetic other date quantity')$$,'record independent other-date task A');
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000001',(select work_day from reports_rate_context),'e9a40000-0000-4000-8000-000000000003',25,'SF','Synthetic quantity with only a matching manual label')$$,'record quantity whose labor identity is unavailable');
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000001',(select work_day from reports_rate_context),'e9a40000-0000-4000-8000-000000000004',50,'SF','Synthetic unassigned-hours quantity')$$,'record quantity with no attributable task evidence');
select extensions.lives_ok($$select public.carez_record_verified_production('e9a30000-0000-4000-8000-000000000001',(select work_day from reports_rate_context),'e9a40000-0000-4000-8000-000000000005',0,'SF','Synthetic genuine recorded zero')$$,'record a genuine verified zero quantity');

select extensions.is((select count(*)::int from public.production_rate_history),7,'one sample per verified daily task row, not per segment or per timecard');
select extensions.is((select man_hours from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000001' and work_date=(select work_day from reports_rate_context) and production_task_id='e9a40000-0000-4000-8000-000000000001'),2::numeric,'repeated A segments receive two of eight approved hours');
select extensions.is((select man_hours from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000001' and work_date=(select work_day from reports_rate_context) and production_task_id='e9a40000-0000-4000-8000-000000000002'),6::numeric,'repeated B segments receive six of eight approved hours');
select extensions.is((select sum(man_hours) from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000001' and work_date=(select work_day from reports_rate_context) and production_task_id in ('e9a40000-0000-4000-8000-000000000001','e9a40000-0000-4000-8000-000000000002')),8::numeric,'attributed main task hours total eight, not duplicated sixteen');
select extensions.is((select units_per_man_hour from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000001' and work_date=(select work_day from reports_rate_context) and production_task_id='e9a40000-0000-4000-8000-000000000001'),50::numeric,'task A rate uses its own attributed denominator');
select extensions.is((select man_hours_per_unit from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000001' and work_date=(select work_day from reports_rate_context) and production_task_id='e9a40000-0000-4000-8000-000000000002'),0.02::numeric,'task B inverse rate preserves the original formula');
select extensions.is((select man_hours from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000002' and work_date=(select work_day from reports_rate_context) and production_task_id='e9a40000-0000-4000-8000-000000000001'),4::numeric,'other-project hours do not leak into main job');
select extensions.is((select man_hours from public.production_rate_history where project_id='e9a30000-0000-4000-8000-000000000001' and work_date=(select work_day+1 from reports_rate_context) and production_task_id='e9a40000-0000-4000-8000-000000000001'),3::numeric,'other-date hours do not leak into main date');
select extensions.ok((select man_hours is null and units_per_man_hour is null and man_hours_per_unit is null from public.production_rate_history where production_task_id='e9a40000-0000-4000-8000-000000000003'),'matching manual work-type text does not invent task-hour attribution');
select extensions.ok((select man_hours is null and units_per_man_hour is null and man_hours_per_unit is null from public.production_rate_history where production_task_id='e9a40000-0000-4000-8000-000000000004'),'unassigned approved shift hours do not become confirmed zero task hours');
select extensions.is((select quantity_completed from public.production_rate_history where production_task_id='e9a40000-0000-4000-8000-000000000005'),0::numeric,'genuine zero quantity remains a verified daily sample');
select extensions.ok((select man_hours is null and units_per_man_hour is null and man_hours_per_unit is null from public.production_rate_history where production_task_id='e9a40000-0000-4000-8000-000000000005'),'zero quantity does not manufacture labor or a rate');

-- No planning budget: main actuals still include 8 +3 +2 clock-review hours and
--2 manual hours at the explicitly recorded40 rate, with synthetic zero employee
--burden configuration. These are not statutory rates. Unknown rate attribution
--does not mean those approved company costs disappeared.
select extensions.is((select count(*)::int from public.project_budgets),0,'fixture has no planning budget');
select extensions.is((select count(*)::int from public.project_budget_actual_summary),0,'budget-only summary is empty');
select extensions.is((select actual_labor_hours from public.project_financial_summary where project_id='e9a30000-0000-4000-8000-000000000001'),15::numeric,'no-budget financial summary retains all recorded main-job hours');
select extensions.is((select actual_company_cost from public.project_financial_summary where project_id='e9a30000-0000-4000-8000-000000000001'),600::numeric,'no-budget financial summary retains approved and reviewed manual actual cost');
select extensions.is((select actual_company_cost from public.project_financial_summary where project_id='e9a30000-0000-4000-8000-000000000002'),160::numeric,'other-project actuals remain independent');
select extensions.is((select count(*)::int from public.project_award_records),0,'fixture does not invent a commercial acceptance to justify its read-model tests');

-- Check the resulting invoker view through a real second company context.
select set_config('request.jwt.claim.sub','e9a10000-0000-4000-8000-000000000002',true);
select extensions.is((select count(*)::int from public.production_rate_history),0,'foreign owner cannot see first-company quantity/rate samples');
select extensions.is((select count(*)::int from public.timecards),0,'foreign owner cannot see first-company approved labor');
reset role;
select extensions.throws_like($$update public.timecards set hours=99 where source_shift_id='e9a50000-0000-4000-8000-000000000001'$$,'%immutable%','actual approval leaves immutable hours, not a post-test editable fake approval');
select * from extensions.finish();
rollback;
