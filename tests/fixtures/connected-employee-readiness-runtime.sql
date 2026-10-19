-- Isolated contract-coherence fixture; no application/schema weakening.
-- Existing fixture bypasses, if any, are preserved historical test seams; no new
-- trigger bypass, permission grant, production defaults or business records added.
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

update public.projects set sales_tax_exempt=true where id='e9400000-0000-4000-8000-000000000001';
-- Explicit synthetic historical agreement input; not hosted acceptance proof.
insert into public.project_award_records(company_id,project_id,agreement_number,original_contract_value,status,authorization_text) values('e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000001','SYN-AG',1000,'accepted','Synthetic historical fixture agreement evidence; no real customer authorization');
insert into public.production_tasks(id,company_id,name,production_unit,active) values('e9600000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','Synthetic field work','SF',true);
insert into public.work_packages(id,company_id,project_id,name) values('e9610000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000001','Synthetic package');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,measurement_method,requires_prior_operations) values('e9620000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9610000-0000-4000-8000-000000000001','e9600000-0000-4000-8000-000000000001','Synthetic assigned work',100,'SF','completion',false);
insert into public.project_inspections(id,company_id,project_id,required_for_operation_id,title,status) values('e9630000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000001','e9620000-0000-4000-8000-000000000001','Canceled required inspection','cancelled');
insert into public.work_package_resource_requirements(id,company_id,work_package_operation_id,resource_type,label,required_quantity,unit,vendor_status,required_before_start) values('e9640000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9620000-0000-4000-8000-000000000001','vendor','Required agency',1,'EA','confirmed',true);
insert into public.work_schedule_items(id,company_id,project_id,schedule_date,item_type,work_package_operation_id,title,status) values('e9650000-0000-4000-8000-000000000001','e9200000-0000-4000-8000-000000000001','e9400000-0000-4000-8000-000000000001',current_date,'work','e9620000-0000-4000-8000-000000000001','Synthetic assigned work','planned');
insert into public.work_schedule_assignments(company_id,schedule_item_id,crew_member_id) values('e9200000-0000-4000-8000-000000000001','e9650000-0000-4000-8000-000000000001','e9300000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000002',true);set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_clock_in_v2('e9400000-0000-4000-8000-000000000001',null,null,null)$$,'employee can record attendance while assigned physical work is held');
select extensions.ok((public.employee_portal_state()->'assigned_schedule'->0->>'ready_to_start')::boolean=false,'portal does not call canceled inspection ready');
select extensions.ok((public.employee_portal_state()->'assigned_schedule'->0->>'readiness_action') like '%Canceled required inspection%','portal retains exact canceled inspection context');
select extensions.throws_like($$select public.carez_employee_start_work_v2('e9620000-0000-4000-8000-000000000001',null,null,null)$$,'%Work is not ready to start%','canceled required inspection blocks physical start');
reset role;
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000001',true);
update public.project_inspections set status='passed' where id='e9630000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.ok((public.employee_portal_state()->'assigned_schedule'->0->>'ready_to_start')::boolean=false,'resource hold survives inspection clearance in employee portal');
select extensions.ok((public.employee_portal_state()->'assigned_schedule'->0->>'readiness_action') like '%no vendor selected%','portal supplies the connected resource reason');
select extensions.throws_like($$select public.carez_employee_start_work_v2('e9620000-0000-4000-8000-000000000001',null,null,null)$$,'%Work is not ready to start%','employee precheck uses full resource gate');
reset role;
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000001',true);
update public.work_package_resource_requirements set waived_at=clock_timestamp(),waived_by='e9100000-0000-4000-8000-000000000001',waiver_reason='Synthetic explicit owner waiver' where id='e9640000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','e9100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select extensions.ok((public.employee_portal_state()->'assigned_schedule'->0->>'ready_to_start')::boolean=true,'portal becomes ready only after explicit required gate clearance');
select extensions.lives_ok($$select public.carez_employee_start_task_v2('e9600000-0000-4000-8000-000000000001',null,null,null)$$,'generic work starts after the authoritative job gate clears');
-- Raw attendance tables stay private; persistence is inspected by the isolated
-- privileged verifier, not by broadening the employee's application read policy.
reset role;
select extensions.ok((select crew_member_id='e9300000-0000-4000-8000-000000000001' and project_id='e9400000-0000-4000-8000-000000000001' from public.employee_task_segments where work_package_operation_id is null and ended_at is null),'generic task persists Crew and project from the authenticated active shift');
set local role authenticated;
select extensions.lives_ok($$select public.carez_employee_start_work_v2('e9620000-0000-4000-8000-000000000001',null,null,null)$$,'connected ready work can start');
select extensions.lives_ok($$select public.carez_employee_start_work_v2('e9620000-0000-4000-8000-000000000001',null,null,null)$$,'start retry preserves its active segment');
reset role;
select extensions.is((select count(*)::integer from public.employee_task_segments where work_package_operation_id='e9620000-0000-4000-8000-000000000001'),1,'one persisted physical-work segment after retry; attendance segment retained');
select extensions.ok((select crew_member_id='e9300000-0000-4000-8000-000000000001' and project_id='e9400000-0000-4000-8000-000000000001' from public.employee_task_segments where work_package_operation_id='e9620000-0000-4000-8000-000000000001'),'operation task persists Crew and project from the authenticated active shift');
reset role;select * from extensions.finish();rollback;
