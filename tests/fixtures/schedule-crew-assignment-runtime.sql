-- Isolated contract-coherence fixture; no application/schema weakening.
-- Existing fixture bypasses, if any, are preserved historical test seams; no new
-- trigger bypass, permission grant, production defaults or business records added.
-- Isolated local records only. Every mutation rolls back.
begin;
set local search_path=pg_catalog,public,extensions;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values ('e1100000-0000-4000-8000-000000000001','schedule-owner@local.invalid'),('e1100000-0000-4000-8000-000000000002','schedule-employee@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone) values ('e1200000-0000-4000-8000-000000000001','Synthetic schedule contractor','Pacific/Auckland'),('e1200000-0000-4000-8000-000000000002','Synthetic other contractor','UTC');
insert into public.profiles(id,company_id,role,full_name) values ('e1100000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','owner','Synthetic owner'),('e1100000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','employee','Synthetic employee');
insert into public.projects(id,company_id,job_number,name,status,sales_tax_exempt) values
 ('e1300000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','SYN-READY','Synthetic ready job','active',true),
 ('e1300000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','SYN-HELD','Synthetic held job','on_hold',true),
 ('e1300000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000002','SYN-FOREIGN','Synthetic foreign job','active',true);
-- Explicit synthetic historical agreement input; not hosted acceptance proof.
insert into public.project_award_records(company_id,project_id,agreement_number,original_contract_value,status,authorization_text) values('e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000001','SYN-AG',0,'accepted','Synthetic historical fixture agreement evidence; no real customer authorization');
insert into public.production_tasks(id,company_id,name,production_unit,active) values('e1500000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','Synthetic finish','SF',true);
insert into public.crew_members(id,company_id,name,role,active) values ('e1400000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','Synthetic active worker','finisher',true),('e1400000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','Synthetic inactive worker','finisher',false);
insert into public.work_packages(id,company_id,project_id,name) values('e1600000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000001','Synthetic package');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,requires_prior_operations) values ('e1700000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1600000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Synthetic ready finish',100,'SF',false);
insert into public.pour_plans(id,company_id,project_id,name) values('e1800000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000001','Synthetic linked pour');
insert into public.pour_plans(id,company_id,project_id,name) values('e1800000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000001','Synthetic other pour');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,requires_prior_operations,pour_plan_id) values('e1700000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','e1600000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000001','Synthetic pour operation',100,'SF',false,'e1800000-0000-4000-8000-000000000001');
-- Explicit privileged synthetic draft-source setup: unlike a manual legacy job,
-- this project requires agreement evidence. No accepted agreement is invented.
insert into public.estimates(id,company_id,project_id,estimate_number,version,name,status)
 values('e1860000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000002','SYN-MISSING-AG',1,'Synthetic source requires agreement','draft');
update public.projects set source_estimate_id='e1860000-0000-4000-8000-000000000001' where id='e1300000-0000-4000-8000-000000000002';

-- Dedicated crew edit fixture; all records and synthetic fault injection roll back.
insert into public.crew_members(id,company_id,name,role,active) values
 ('e1400000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000001','Synthetic second worker','finisher',true),
 ('e1400000-0000-4000-8000-000000000005','e1200000-0000-4000-8000-000000000001','Synthetic replacement worker','finisher',true),
 ('e1400000-0000-4000-8000-000000000004','e1200000-0000-4000-8000-000000000002','Synthetic foreign worker','finisher',true);
create temp table crew_results(key text primary key,value jsonb);grant all on crew_results to authenticated;
create temp table crew_input as select jsonb_build_object('id','e1a00000-0000-4000-8000-000000000001','expected_revision',0,'crew_needed',2,'crew_member_ids',jsonb_build_array('e1400000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000003','e1400000-0000-4000-8000-000000000001')) payload;
grant select on crew_input to authenticated;
insert into public.work_schedule_items(id,company_id,project_id,schedule_date,item_type,title,production_task_id,start_time,end_time,crew_needed,status,notes)
 values('e1a00000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000002','2026-10-20','work','Synthetic cutting and demolition','e1500000-0000-4000-8000-000000000001','07:00','15:30',2,'planned','Existing delivery note');
create temp table crew_before as select to_jsonb(s)-array['command_revision','updated_at','crew_needed'] snapshot from public.work_schedule_items s where id='e1a00000-0000-4000-8000-000000000001';grant select on crew_before to authenticated;
create function pg_temp.crew_request(n integer,p jsonb) returns jsonb language sql as $$select public.carez_assign_schedule_crew_v1(('e1b00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,p)$$;
select extensions.ok(not has_function_privilege('anon','public.carez_assign_schedule_crew_v1(uuid,jsonb)','execute'),'anonymous cannot execute crew edits');
set local role authenticated;
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000001',true);
insert into crew_results values('first',pg_temp.crew_request(1,(select payload from crew_input)));
select extensions.is((select (value->>'assigned_count')::integer from crew_results where key='first'),2,'two unique selected workers confirmed');
select extensions.is((select count(*)::integer from public.work_schedule_assignments where schedule_item_id='e1a00000-0000-4000-8000-000000000001'),2,'two named links persisted on the same item');
select extensions.is((select count(*)::integer from public.work_schedule_items where id='e1a00000-0000-4000-8000-000000000001'),1,'same schedule block retained');
select extensions.is((select to_jsonb(s)-array['command_revision','updated_at','crew_needed'] from public.work_schedule_items s where id='e1a00000-0000-4000-8000-000000000001'),(select snapshot from crew_before),'date, task, times, status, source and notes unchanged');
select extensions.is((select command_revision::integer from public.work_schedule_items where id='e1a00000-0000-4000-8000-000000000001'),1,'crew edit increments revision');
select extensions.is((select value->'previous_crew_member_ids' from crew_results where key='first'),'[]'::jsonb,'audit result retains previous empty assignment');
select extensions.is(pg_temp.crew_request(1,(select payload from crew_input)),(select value from crew_results where key='first'),'exact retry returns persisted result');
select extensions.is((select command_revision::integer from public.work_schedule_items where id='e1a00000-0000-4000-8000-000000000001'),1,'replay does not increment twice');
select extensions.throws_like($$select pg_temp.crew_request(1,(select payload||jsonb_build_object('crew_needed',3) from crew_input))$$,'%reused with different values%','request reuse rejects changed demand');
select extensions.throws_like($$select pg_temp.crew_request(2,(select payload from crew_input))$$,'%Schedule changed%','stale revision rejects edit');
select extensions.throws_like($$select pg_temp.crew_request(3,(select payload||jsonb_build_object('expected_revision',1,'crew_member_ids',jsonb_build_array('e1400000-0000-4000-8000-000000000004')) from crew_input))$$,'%assigned crew member is unavailable%','foreign-company worker rejected');
select extensions.throws_like($$select pg_temp.crew_request(4,(select payload||jsonb_build_object('expected_revision',1,'crew_member_ids',jsonb_build_array('e1400000-0000-4000-8000-000000000002')) from crew_input))$$,'%assigned crew member is unavailable%','inactive worker rejected');
select extensions.throws_like($$select pg_temp.crew_request(5,(select payload||jsonb_build_object('expected_revision',1,'schedule_date','2026-10-21') from crew_input))$$,'%Unsupported crew assignment field%','crew edit cannot change date');
select extensions.throws_like($$select pg_temp.crew_request(6,(select payload||jsonb_build_object('expected_revision',1,'crew_needed','') from crew_input))$$,'%Workers needed%','blank target rejected');
select extensions.throws_like($$select pg_temp.crew_request(7,(select payload||jsonb_build_object('expected_revision',1,'crew_needed',-1) from crew_input))$$,'%Workers needed%','negative target rejected');
select extensions.is((select count(*)::integer from public.work_schedule_assignments where schedule_item_id='e1a00000-0000-4000-8000-000000000001'),2,'rejected edits preserve known assignments');
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.crew_request(8,(select payload||jsonb_build_object('expected_revision',1) from crew_input))$$,'%Owner or office authority%','employee cannot edit planning crew');
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000001',true);
reset role;
-- Isolated failure injection proves transaction atomicity after assignment deletion.
create function public.synthetic_crew_insert_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic assignment write failure';end$$;
create trigger synthetic_crew_insert_failure before insert on public.work_schedule_assignments for each row execute function public.synthetic_crew_insert_failure();
set local role authenticated;
select extensions.throws_like($$select pg_temp.crew_request(9,(select payload||jsonb_build_object('expected_revision',1,'crew_member_ids',jsonb_build_array('e1400000-0000-4000-8000-000000000005')) from crew_input))$$,'%Synthetic assignment write failure%','assignment insertion failure surfaces');
select extensions.is((select count(*)::integer from public.work_schedule_assignments where schedule_item_id='e1a00000-0000-4000-8000-000000000001'),2,'failed insert rolls back prior deletion');
select extensions.is((select command_revision::integer from public.work_schedule_items where id='e1a00000-0000-4000-8000-000000000001'),1,'failed save preserves revision');
select extensions.is((select count(*)::integer from public.financial_command_requests where request_id='e1b00000-0000-4000-8000-000000000009'),0,'failed request does not become a recorded success');
reset role;
drop trigger synthetic_crew_insert_failure on public.work_schedule_assignments;drop function public.synthetic_crew_insert_failure();
set local role authenticated;
insert into crew_results values('empty',pg_temp.crew_request(10,(select payload||jsonb_build_object('expected_revision',1,'crew_needed',0,'crew_member_ids','[]'::jsonb) from crew_input)));
select extensions.is((select (value->>'assigned_count')::integer from crew_results where key='empty'),0,'explicit empty selection and zero target accepted');
select extensions.is((select crew_needed from public.work_schedule_items where id='e1a00000-0000-4000-8000-000000000001'),0,'genuine zero target preserved');
select extensions.is((select jsonb_array_length(value->'previous_crew_member_ids') from crew_results where key='empty'),2,'audit retains previous workers on removal');
insert into crew_results values('restore',pg_temp.crew_request(11,(select payload||jsonb_build_object('expected_revision',2) from crew_input)));
reset role;
create temp table retained_assignment as select id,created_at from public.work_schedule_assignments where schedule_item_id='e1a00000-0000-4000-8000-000000000001' and crew_member_id='e1400000-0000-4000-8000-000000000001';grant select on retained_assignment to authenticated;
set local role authenticated;
insert into crew_results values('replace',pg_temp.crew_request(12,(select payload||jsonb_build_object('expected_revision',3,'crew_member_ids',jsonb_build_array('e1400000-0000-4000-8000-000000000001','e1400000-0000-4000-8000-000000000005')) from crew_input)));
select extensions.ok(exists(select 1 from public.work_schedule_assignments a join retained_assignment r on a.id=r.id and a.created_at=r.created_at),'retained worker assignment identity and metadata survive edits');
select extensions.is((select count(*)::integer from public.work_schedule_assignments where schedule_item_id='e1a00000-0000-4000-8000-000000000001' and crew_member_id='e1400000-0000-4000-8000-000000000003'),0,'deselected worker removed');
select extensions.is((select count(*)::integer from public.work_schedule_assignments where schedule_item_id='e1a00000-0000-4000-8000-000000000001' and crew_member_id='e1400000-0000-4000-8000-000000000005'),1,'new worker assigned once');
select * from extensions.finish();rollback;
