-- Run only against an isolated local Supabase database as postgres.
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into public.companies(id,name) values('22222222-2222-4222-8222-222222222222','Commercial Foundation Test');
insert into public.profiles(id,company_id,full_name,role)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Test Owner','owner');
insert into public.leads(id,company_id,customer_name,project_name,state)
values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Test Customer','Test Job','WA');
insert into public.estimates(id,company_id,estimate_number,name,status,version,proposed_sell_price,lead_id,created_by)
values('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','E-TEST','Test Job','ready',1,100,'33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
insert into public.estimate_sections(id,company_id,estimate_id,name,scope_type,sort_order)
values('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','Base Scope','base',0);
insert into public.estimate_items(id,company_id,estimate_id,section_id,item_type,description,quantity,unit,unit_cost,direct_cost,sort_order)
values('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','other','Test concrete scope',2,'EA',25,50,0);
insert into public.proposal_access_tokens(id,company_id,estimate_id,token)
values('77777777-7777-4777-8777-777777777777','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','88888888-8888-4888-8888-888888888888');
alter table public.proposal_presentations disable trigger guard_proposal_release;
insert into public.proposal_presentations(id,company_id,estimate_id,proposal_access_token_id,lead_id,proposal_number,base_sell_price,source_estimate_updated_at,snapshot,status,response_state,created_by,release_commercial_fingerprint,release_warning_fingerprint)
select '99999999-9999-4999-8999-999999999999',e.company_id,e.id,'77777777-7777-4777-8777-777777777777',e.lead_id,'P-TEST-R1',s.selected_sell_price,e.updated_at,
  jsonb_build_object('pricing',jsonb_build_object('base_sell_price',s.selected_sell_price),'lead',jsonb_build_object('project_name','Test Job','state','WA'),'options','[]'::jsonb),
  'sent','none','11111111-1111-4111-8111-111111111111','test-release-fingerprint','test-warning-fingerprint'
from public.estimates e join public.estimate_financial_summary s on s.estimate_id=e.id
where e.id='44444444-4444-4444-8444-444444444444';
alter table public.proposal_presentations enable trigger guard_proposal_release;

insert into public.estimates(id,company_id,estimate_number,name,status,version,proposed_sell_price,lead_id,created_by)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','E-OLD','Old Test Job','ready',1,100,'33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
insert into public.proposal_access_tokens(id,company_id,estimate_id,token)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.estimates(id,company_id,estimate_number,name,status,version,proposed_sell_price,lead_id,created_by)
values('17171717-1717-4171-8171-171717171717','22222222-2222-4222-8222-222222222222','E-DRAFT','Pre-issue Draft','draft',1,100,'33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
alter table public.proposal_presentations disable trigger guard_proposal_release;
alter table public.proposal_presentations disable trigger capture_proposal_commercial_snapshot;
insert into public.proposal_presentations(id,company_id,estimate_id,proposal_access_token_id,proposal_number,base_sell_price,source_estimate_updated_at,snapshot,status,response_state,created_by,release_commercial_fingerprint,release_warning_fingerprint,job_spine_id)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','P-OLD-R1',100,now(),'{"pricing":{"base_sell_price":100},"options":[]}'::jsonb,'accepted','accepted','11111111-1111-4111-8111-111111111111','legacy','legacy',(select job_spine_id from public.estimates where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
alter table public.proposal_presentations enable trigger capture_proposal_commercial_snapshot;
alter table public.proposal_presentations enable trigger guard_proposal_release;

insert into auth.users(id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') on conflict do nothing;
insert into public.companies(id,name) values('ffffffff-ffff-4fff-8fff-ffffffffffff','Other Tenant Test');
insert into public.profiles(id,company_id,full_name,role)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','ffffffff-ffff-4fff-8fff-ffffffffffff','Other Owner','owner');
insert into public.leads(id,company_id,customer_name,project_name,state)
values('12121212-1212-4212-8212-121212121212','ffffffff-ffff-4fff-8fff-ffffffffffff','Other Customer','Other Job','WA');
insert into public.estimates(id,company_id,estimate_number,name,status,version,proposed_sell_price,lead_id,created_by)
values('13131313-1313-4313-8313-131313131313','ffffffff-ffff-4fff-8fff-ffffffffffff','E-OTHER','Other Job','ready',1,100,'12121212-1212-4212-8212-121212121212','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into public.proposal_access_tokens(id,company_id,estimate_id,token)
values('14141414-1414-4414-8414-141414141414','ffffffff-ffff-4fff-8fff-ffffffffffff','13131313-1313-4313-8313-131313131313','15151515-1515-4515-8515-151515151515');
alter table public.proposal_presentations disable trigger guard_proposal_release;
insert into public.proposal_presentations(id,company_id,estimate_id,proposal_access_token_id,proposal_number,base_sell_price,source_estimate_updated_at,snapshot,status,response_state,created_by,release_commercial_fingerprint,release_warning_fingerprint)
select '16161616-1616-4616-8616-161616161616',e.company_id,e.id,'14141414-1414-4414-8414-141414141414','P-OTHER-R1',s.selected_sell_price,e.updated_at,
  jsonb_build_object('pricing',jsonb_build_object('base_sell_price',s.selected_sell_price),'options','[]'::jsonb),'sent','none','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','other-release','other-warning'
from public.estimates e join public.estimate_financial_summary s on s.estimate_id=e.id where e.id='13131313-1313-4313-8313-131313131313';
alter table public.proposal_presentations enable trigger guard_proposal_release;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $test$
declare v_result jsonb; v_repeat jsonb; v_draft uuid; v_project uuid; v_award uuid; v_snapshot uuid; v_baseline uuid; v_hold text; v_before timestamptz;
begin
  if public.carez_get_proposal_award_hold('99999999-9999-4999-8999-999999999999') is not null then raise exception 'new exact issued revision unexpectedly held'; end if;
  if public.carez_get_proposal_award_hold('16161616-1616-4616-8616-161616161616')<>'Issued Proposal revision not found.' then raise exception 'cross-company Proposal became visible'; end if;
  v_before:=(select updated_at from public.proposal_presentations where id='99999999-9999-4999-8999-999999999999');
  v_result:=public.carez_create_next_proposal_revision('99999999-9999-4999-8999-999999999999');
  v_draft:=(v_result->>'estimate_id')::uuid;
  if not exists(select 1 from public.estimates where id=v_draft and status='draft' and parent_proposal_revision_id='99999999-9999-4999-8999-999999999999' and version=2) then raise exception 'next revision did not create a linked draft'; end if;
  if not exists(select 1 from public.estimate_items where estimate_id=v_draft and description='Test concrete scope' and direct_cost=50 and revision_source_estimate_item_id='66666666-6666-4666-8666-666666666666') then raise exception 'draft did not copy commercial facts and source lineage'; end if;
  if exists(select 1 from public.proposal_presentations where estimate_id=v_draft) then raise exception 'draft inherited issued presentation state'; end if;
  v_repeat:=public.carez_create_next_proposal_revision('99999999-9999-4999-8999-999999999999');
  if (v_repeat->>'estimate_id')::uuid<>v_draft or v_repeat->>'already_created'<>'true' then raise exception 'revision creation is not idempotent'; end if;
  if (select updated_at from public.proposal_presentations where id='99999999-9999-4999-8999-999999999999') is distinct from v_before then raise exception 'issued parent changed'; end if;
  v_hold:=public.carez_get_proposal_award_hold('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  if v_hold not like 'Award held: this historical Proposal has no trustworthy frozen internal cost and production evidence%' then raise exception 'legacy evidence was not held explicitly: %',v_hold; end if;
  begin
    update public.proposal_presentations set internal_commercial_snapshot='{"schema_version":1,"financial_summary":{"selected_sell_price":100,"total_direct_cost":0},"items":[{"id":"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee","quantity":1,"unit":"EA","direct_cost":0}]}'::jsonb
    where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    raise exception 'legacy issued Proposal accepted caller-supplied internal evidence';
  exception when raise_exception then
    if sqlerrm<>'Issued Proposal commercial evidence and lineage are immutable.' then raise; end if;
  end;
  if public.carez_get_proposal_award_hold('dddddddd-dddd-4ddd-8ddd-dddddddddddd') not like 'Award held: this historical Proposal has no trustworthy frozen internal cost and production evidence%' then raise exception 'legacy Award hold cleared after rejected evidence injection'; end if;
  begin
    update public.proposal_presentations set internal_commercial_snapshot=internal_commercial_snapshot||'{"tampered":true}'::jsonb
    where id='99999999-9999-4999-8999-999999999999';
    raise exception 'issued Proposal commercial snapshot rewrite was allowed';
  exception when raise_exception then
    if sqlerrm<>'Issued Proposal commercial evidence and lineage are immutable.' then raise; end if;
  end;
  begin
    update public.proposal_presentations set internal_commercial_snapshot=null
    where id='99999999-9999-4999-8999-999999999999';
    raise exception 'issued Proposal internal snapshot could be cleared';
  exception when raise_exception then
    if sqlerrm<>'Issued Proposal commercial evidence and lineage are immutable.' then raise; end if;
  end;
  if exists(select 1 from public.proposal_presentations where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' and internal_commercial_snapshot is not null) then raise exception 'legacy issued Proposal internal evidence changed'; end if;
  if not exists(select 1 from public.proposal_presentations where id='99999999-9999-4999-8999-999999999999' and internal_commercial_snapshot is not null and internal_commercial_snapshot->>'tampered' is null) then raise exception 'issued Proposal internal snapshot changed'; end if;
  update public.estimates set notes='Pre-issue draft edits remain available.' where id='17171717-1717-4171-8171-171717171717';
  if not exists(select 1 from public.estimates where id='17171717-1717-4171-8171-171717171717' and notes='Pre-issue draft edits remain available.') then raise exception 'pre-issue estimate authoring was blocked'; end if;
  v_result:=public.carez_award_proposal_and_create_project('99999999-9999-4999-8999-999999999999',null,null);
  v_project:=(v_result->>'project_id')::uuid; v_award:=(v_result->>'award_decision_id')::uuid;
  v_snapshot:=(v_result->>'snapshot_id')::uuid; v_baseline:=(v_result->>'baseline_id')::uuid;
  if not exists(select 1 from public.projects where id=v_project and job_spine_id=(select job_spine_id from public.estimates where id='44444444-4444-4444-8444-444444444444') and source_estimate_id='44444444-4444-4444-8444-444444444444') then raise exception 'Project lineage is not connected to the Estimate Job Spine'; end if;
  if not exists(select 1 from public.accepted_scope_snapshots where id=v_snapshot and proposal_revision_id='99999999-9999-4999-8999-999999999999') then raise exception 'Accepted snapshot lost exact Proposal lineage'; end if;
  if not exists(select 1 from public.commercial_baselines where id=v_baseline and accepted_scope_snapshot_id=v_snapshot and total_direct_cost=50 and total_sell=100) then raise exception 'Baseline failed to preserve separate Direct Cost and Sell facts'; end if;
  begin
    update public.estimate_items set quantity=99 where id='66666666-6666-4666-8666-666666666666';
    raise exception 'issued Estimate scope edit was allowed';
  exception when raise_exception then
    if sqlerrm<>'Issued Estimate scope and Proposal terms are immutable. Create a next revision.' then raise; end if;
  end;
  v_repeat:=public.carez_award_proposal_and_create_project('99999999-9999-4999-8999-999999999999',null,null);
  if (v_repeat->>'project_id')::uuid<>v_project or (v_repeat->>'award_decision_id')::uuid<>v_award or v_repeat->>'already_awarded'<>'true' then raise exception 'repeat award created duplicate lineage'; end if;
  if (select count(*) from public.award_decisions where proposal_revision_id='99999999-9999-4999-8999-999999999999')<>1 then raise exception 'duplicate Award Decision created'; end if;
  if not exists(select 1 from public.leads where id='33333333-3333-4333-8333-333333333333' and status='won') then raise exception 'award converted or removed the Opportunity instead of retaining it'; end if;
end
$test$;

reset role;
select extensions.plan(4);
select extensions.ok(not has_function_privilege('anon','public.carez_award_proposal_and_create_project(uuid,timestamptz,text)','EXECUTE'),'anonymous role cannot execute award');
select extensions.ok(not has_table_privilege('authenticated','public.award_decisions','INSERT'),'authenticated clients cannot insert Award Decisions directly');
select extensions.ok(not has_table_privilege('authenticated','public.commercial_baselines','UPDATE'),'authenticated clients cannot rewrite a frozen baseline');
select extensions.ok((select relrowsecurity from pg_class where oid='public.accepted_scope_snapshots'::regclass),'accepted scope snapshots enforce RLS');
select * from extensions.finish();
rollback;
