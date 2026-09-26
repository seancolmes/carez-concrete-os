-- Run only against an isolated local Supabase database as postgres.
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111') on conflict do nothing;
insert into public.companies(id,name) values('22222222-2222-4222-8222-222222222222','Commercial Foundation Test');
insert into public.profiles(id,company_id,full_name,role)
values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Test Owner','owner');
insert into auth.users(id) values('abababab-abab-4bab-8bab-abababababab') on conflict do nothing;
insert into public.profiles(id,company_id,full_name,role)
values('abababab-abab-4bab-8bab-abababababab','22222222-2222-4222-8222-222222222222','Test Employee','employee');
insert into auth.users(id) values('20202020-2020-4020-8020-202020202020') on conflict do nothing;
insert into public.profiles(id,company_id,full_name,role)
values('20202020-2020-4020-8020-202020202020','22222222-2222-4222-8222-222222222222','Test Office','office');
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
  v_co uuid; v_delta jsonb; v_replay jsonb; v_baseline_sell numeric; v_contract_value numeric; v_authorized_value numeric;
  v_deductive uuid; v_additive_new_scope uuid; v_no_cost uuid; v_reversal uuid; v_result_delta uuid;
  v_external_no_cost uuid; v_rejected uuid; v_void_draft uuid; v_void_submitted uuid; v_return_draft uuid;
  v_invalid_reversal uuid; v_office_co uuid; v_probe uuid; v_conflict uuid; v_award_before jsonb; v_snapshot_before jsonb; v_baseline_before jsonb;
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

  select total_sell into v_baseline_sell from public.commercial_baselines where id=v_baseline;
  select contract_value into v_contract_value from public.projects where id=v_project;
  select to_jsonb(a) into v_award_before from public.award_decisions a where id=v_award;
  select to_jsonb(s) into v_snapshot_before from public.accepted_scope_snapshots s where id=v_snapshot;
  select jsonb_build_object('header',to_jsonb(b),'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from public.commercial_baseline_items i where i.company_id=b.company_id and i.baseline_id=b.id))
    into v_baseline_before from public.commercial_baselines b where id=v_baseline;
  v_co:=public.carez_create_change_order(v_project,'Approved additive change','additive',current_date,'Added concrete landing','Customer request','Test Customer',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost,affected_commercial_baseline_item_id)
  values('22222222-2222-4222-8222-222222222222',v_co,'material','cost','Concrete landing',1,'LS',25,25,
    (select id from public.commercial_baseline_items where company_id='22222222-2222-4222-8222-222222222222' and baseline_id=v_baseline order by id limit 1));
  perform public.carez_update_change_order(v_co,'{"proposed_sell_price":150,"field_work_status":"not_started"}'::jsonb);
  perform public.carez_transition_change_order(v_co,'submit',null,'external_customer','AUTH-CO-1','Test Customer',now(),'Signed approval','DOC-1',150);
  v_delta:=public.approve_change_order(v_co);
  v_replay:=public.approve_change_order(v_co);
  if v_delta->>'delta_id' is distinct from v_replay->>'delta_id' or v_replay->>'already_approved'<>'true' then raise exception 'identical approval replay was not idempotent'; end if;
  if (select count(*) from public.approved_commercial_deltas where company_id='22222222-2222-4222-8222-222222222222' and change_order_id=v_co)<>1 then raise exception 'approval created duplicate commercial delta'; end if;
  if (select count(*) from public.approved_commercial_delta_items where company_id='22222222-2222-4222-8222-222222222222' and commercial_delta_id=(v_delta->>'delta_id')::uuid)<>1 then raise exception 'approved delta item lineage missing'; end if;
  if (select total_sell from public.commercial_baselines where id=v_baseline) is distinct from v_baseline_sell then raise exception 'original baseline changed during CO approval'; end if;
  if (select contract_value from public.projects where id=v_project) is distinct from v_contract_value then raise exception 'Project original contract_value changed during CO approval'; end if;
  begin
    update public.projects set contract_value=contract_value+1 where id=v_project;
    raise exception 'Awarded Project original contract_value was editable';
  exception when raise_exception then
    if sqlerrm<>'Original Award contract_value is immutable; approved changes are appended separately.' then raise; end if;
  end;
  select authorized_contract_value into v_authorized_value from public.project_authorized_contract_summary where project_id=v_project;
  if v_authorized_value is distinct from v_baseline_sell+150 then raise exception 'authorized contract does not derive from original baseline plus approved CO delta'; end if;
  if (select count(*) from public.change_order_events where change_order_id=v_co and to_status in ('draft','submitted','approved'))<>3 then raise exception 'append-only Change Order status evidence is incomplete'; end if;

  v_deductive:=public.carez_create_change_order(v_project,'Approved deductive change','deductive',current_date,'Remove an alternate finish','Customer deletion','Test Customer',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_deductive,'material','cost','Remaining corrective work',1,'LS',25,25);
  perform public.carez_update_change_order(v_deductive,'{"proposed_sell_price":-75,"field_work_status":"not_started"}'::jsonb);
  perform public.carez_transition_change_order(v_deductive,'submit',null,'external_gc','GC-CO-2','Test GC',now(),'Signed deductive directive',null,-75);
  v_result_delta:=(public.approve_change_order(v_deductive)->>'delta_id')::uuid;
  if (select sell_delta from public.approved_commercial_deltas where id=v_result_delta)<>-75
    or (select total_direct_cost_delta from public.approved_commercial_deltas where id=v_result_delta)<>25 then raise exception 'deductive Sell direction was conflated with positive Direct Cost'; end if;

  v_additive_new_scope:=public.carez_create_change_order(v_project,'Additive new scope without baseline item','additive',current_date,'New scope reference test','Customer request','Test Customer',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_additive_new_scope,'other','cost','New additive scope',1,'LS',5,5);
  perform public.carez_update_change_order(v_additive_new_scope,'{"proposed_sell_price":0,"field_work_status":"not_started"}'::jsonb);
  perform public.carez_transition_change_order(v_additive_new_scope,'submit',null,'external_customer','AUTH-CO-NEW-SCOPE','Test Customer',now(),'Authorized additive zero-Sell scope',null,0);
  v_result_delta:=(public.approve_change_order(v_additive_new_scope)->>'delta_id')::uuid;
  if (select sell_delta from public.approved_commercial_deltas where id=v_result_delta)<>0
    or (select total_direct_cost_delta from public.approved_commercial_deltas where id=v_result_delta)<>5 then raise exception 'additive new scope did not preserve separate cost and zero Sell'; end if;

  v_no_cost:=public.carez_create_change_order(v_project,'Internal no-cost exposure','no_cost',current_date,'Internal rework exposure','Internal only','Carez',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_no_cost,'other','cost','Internal company exposure',1,'LS',40,40);
  perform public.carez_update_change_order(v_no_cost,'{"proposed_sell_price":0,"field_work_status":"directed"}'::jsonb);
  perform public.carez_transition_change_order(v_no_cost,'submit',null,'internal_no_cost',null,null,null,'Internal exposure only',null,0);
  v_result_delta:=(public.approve_change_order(v_no_cost)->>'delta_id')::uuid;
  if (select sell_delta from public.approved_commercial_deltas where id=v_result_delta)<>0
    or (select total_direct_cost_delta from public.approved_commercial_deltas where id=v_result_delta)<>40 then raise exception 'no-cost internal exposure lost its zero Sell / positive cost split'; end if;
  v_reversal:=public.carez_create_change_order(v_project,'Reverse approved additive change','deductive',current_date,'Reverse the approved Sell value','Commercial reversal','Test Customer',null,0,v_co);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_reversal,'material','credit','Reversal cost credit',1,'LS',25,-25);
  perform public.carez_update_change_order(v_reversal,'{"proposed_sell_price":-150,"field_work_status":"not_started"}'::jsonb);
  perform public.carez_transition_change_order(v_reversal,'submit',null,'external_customer','AUTH-CO-REVERSE','Test Customer',now(),'Signed reversal',null,-150);
  v_result_delta:=(public.approve_change_order(v_reversal)->>'delta_id')::uuid;
  if (select sell_delta from public.approved_commercial_deltas where id=v_result_delta)<>-150
    or (select total_direct_cost_delta from public.approved_commercial_deltas where id=v_result_delta)<>-25
    or (select reversal_of_change_order_id from public.change_orders where id=v_reversal) is distinct from v_co then raise exception 'reversal Change Order did not append exact linked contra Sell'; end if;
  if (select authorized_contract_value from public.project_authorized_contract_summary where project_id=v_project) is distinct from v_baseline_sell-75 then raise exception 'authorized contract included additive, deductive or reversal Sell deltas incorrectly'; end if;

  v_external_no_cost:=public.carez_create_change_order(v_project,'Externally authorized no-cost scope','no_cost',current_date,'Customer-directed scope with no contract change','Customer directive','Test Customer',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_external_no_cost,'other','cost','No-cost scope cost',2,'LS',5,10);
  perform public.carez_update_change_order(v_external_no_cost,'{"proposed_sell_price":0,"field_work_status":"directed"}'::jsonb);
  perform public.carez_transition_change_order(v_external_no_cost,'submit',null,'external_customer','AUTH-CO-NOCOST','Test Customer',now(),'Authorized no-cost scope',null,0);
  v_result_delta:=(public.approve_change_order(v_external_no_cost)->>'delta_id')::uuid;
  if (select sell_delta from public.approved_commercial_deltas where id=v_result_delta)<>0
    or (select total_direct_cost_delta from public.approved_commercial_deltas where id=v_result_delta)<>10 then raise exception 'external no-cost contractual scope did not preserve zero Sell and positive cost'; end if;

  perform set_config('request.jwt.claim.sub','20202020-2020-4020-8020-202020202020',true);
  v_office_co:=public.carez_create_change_order(v_project,'Office authorized no-cost CO','no_cost',current_date,'Office workflow test','Test','Office',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_office_co,'other','cost','Office workflow cost',1,'LS',4,4);
  perform public.carez_update_change_order(v_office_co,'{"proposed_sell_price":0,"field_work_status":"directed"}'::jsonb);
  perform public.carez_transition_change_order(v_office_co,'submit',null,'external_gc','OFFICE-CO-1','Test GC',now(),'Office authorized directive',null,0);
  perform public.approve_change_order(v_office_co);
  if not exists(select 1 from public.change_orders where id=v_office_co and status='approved') then raise exception 'office role could not complete authorized commercial workflow'; end if;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

  v_conflict:=public.carez_create_change_order(v_project,'Conflicting approval replay probe','additive',current_date,'Conflict test','Test','Owner',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_conflict,'other','cost','Conflict replay item',1,'LS',1,1);
  perform public.carez_transition_change_order(v_conflict,'submit',null,'external_customer','AUTH-CONFLICT','Test Customer',now(),'Conflict replay submission',null,1);

  v_rejected:=public.carez_create_change_order(v_project,'Rejected Change Order','additive',current_date,'Rejected test','Test','Owner',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_rejected,'other','cost','Rejected item',1,'LS',3,3);
  perform public.carez_transition_change_order(v_rejected,'submit',null,'external_customer','AUTH-REJECT','Test Customer',now(),'Submitted for rejection',null,5);
  perform public.carez_transition_change_order(v_rejected,'reject','Rejected by owner');
  if not exists(select 1 from public.change_orders where id=v_rejected and status='rejected') then raise exception 'submitted Change Order was not rejected'; end if;
  begin perform public.carez_update_change_order(v_rejected,'{"proposed_sell_price":6}'::jsonb); raise exception 'rejected Change Order was editable';
  exception when raise_exception then if sqlerrm<>'Only draft Change Orders can be edited.' then raise; end if; end;
  begin perform public.carez_transition_change_order(v_rejected,'void'); raise exception 'rejected Change Order accepted a terminal-state transition';
  exception when raise_exception then if sqlerrm<>'Invalid Change Order transition.' then raise; end if; end;

  v_void_draft:=public.carez_create_change_order(v_project,'Void draft Change Order','additive',current_date,'Void draft test','Test','Owner',null,0);
  perform public.carez_transition_change_order(v_void_draft,'void','Void before submit');
  if not exists(select 1 from public.change_orders where id=v_void_draft and status='void') then raise exception 'draft Change Order did not void'; end if;

  v_void_submitted:=public.carez_create_change_order(v_project,'Void submitted Change Order','additive',current_date,'Void submitted test','Test','Owner',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_void_submitted,'other','cost','Void submitted item',1,'LS',3,3);
  perform public.carez_transition_change_order(v_void_submitted,'submit',null,'external_customer','AUTH-VOID','Test Customer',now(),'Submitted then voided',null,5);
  perform public.carez_transition_change_order(v_void_submitted,'void','Void after submit');
  if not exists(select 1 from public.change_orders where id=v_void_submitted and status='void') then raise exception 'submitted Change Order did not void'; end if;

  v_return_draft:=public.carez_create_change_order(v_project,'Return submitted Change Order','deductive',current_date,'Return-to-draft test','Test','Owner',null,0);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_return_draft,'other','cost','Return draft item',1,'LS',3,3);
  perform public.carez_transition_change_order(v_return_draft,'submit',null,'external_gc','AUTH-RETURN','Test GC',now(),'Submit then return',null,-5);
  perform public.carez_transition_change_order(v_return_draft,'return_to_draft','Explicit return to draft');
  if not exists(select 1 from public.change_orders where id=v_return_draft and status='draft') then raise exception 'submitted Change Order did not return to draft'; end if;
  perform public.carez_update_change_order(v_return_draft,'{"proposed_sell_price":-6}'::jsonb);
  perform public.carez_transition_change_order(v_return_draft,'void','Void returned draft');

  v_invalid_reversal:=public.carez_create_change_order(v_project,'Invalid reversal Change Order','additive',current_date,'Invalid contra amount','Test','Owner',null,0,v_deductive);
  insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,unit_cost,direct_cost)
  values('22222222-2222-4222-8222-222222222222',v_invalid_reversal,'other','cost','Invalid reversal item',1,'LS',1,1);
  begin
    perform public.carez_transition_change_order(v_invalid_reversal,'submit',null,'external_customer','AUTH-BAD-REVERSAL','Test Customer',now(),'Incorrect reversal amount',null,74);
    raise exception 'invalid reversal was accepted';
  exception when raise_exception then if sqlerrm<>'Reversal Change Order Sell must exactly offset the original approved Sell delta.' then raise; end if; end;
  perform public.carez_transition_change_order(v_invalid_reversal,'void','Void rejected reversal draft');

  begin perform public.carez_update_change_order(v_co,'{"proposed_sell_price":151}'::jsonb); raise exception 'approved Change Order was editable';
  exception when raise_exception then if sqlerrm<>'Only draft Change Orders can be edited.' then raise; end if; end;
  begin update public.change_order_items set direct_cost=26 where change_order_id=v_co; raise exception 'approved Change Order item was mutable';
  exception when raise_exception then if sqlerrm<>'Only draft Change Orders can change items.' then raise; end if; end;
  begin perform public.carez_transition_change_order(v_co,'void'); raise exception 'approved Change Order accepted a terminal-state transition';
  exception when raise_exception then if sqlerrm<>'Invalid Change Order transition.' then raise; end if; end;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='approved_commercial_delta_items' and column_name like '%sell%') then raise exception 'approved Change Order item fabricated an item-level Sell allocation'; end if;

  v_probe:=public.carez_create_change_order(v_project,'Physical fact constraint probe','additive',current_date,'Physical non-negative test','Test','Owner',null,0);
  begin
    insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,direct_cost)
    values('22222222-2222-4222-8222-222222222222',v_probe,'labor','cost','Negative physical quantity',-1,'HR',0);
    raise exception 'negative physical quantity was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,direct_cost,regular_hours)
    values('22222222-2222-4222-8222-222222222222',v_probe,'labor','cost','Negative physical hours',1,'HR',0,-1);
    raise exception 'negative physical hours were accepted';
  exception when check_violation then null; end;
  begin
    insert into public.change_order_items(company_id,change_order_id,item_type,cost_effect,description,quantity,unit,direct_cost,affected_commercial_baseline_item_id)
    values('22222222-2222-4222-8222-222222222222',v_probe,'other','cost','Cross-baseline item reference',1,'LS',1,'99999999-9999-4999-8999-999999999999');
    raise exception 'unconstrained baseline-item reference was accepted';
  exception when foreign_key_violation then null; end;
  perform public.carez_transition_change_order(v_probe,'void','Finish physical fact constraint probe');
  if (select count(*) from public.approved_commercial_deltas where project_id=v_project)<>(select count(*) from public.change_orders where project_id=v_project and status='approved') then raise exception 'approved Change Order did not have exactly one commercial delta'; end if;
  if not exists(select 1 from public.approved_commercial_deltas where company_id='22222222-2222-4222-8222-222222222222' and change_order_id=v_co and project_id=v_project and commercial_baseline_id=v_baseline) then raise exception 'approved delta lost its Project or original Commercial Baseline lineage'; end if;
  if (select count(*) from public.approved_commercial_delta_items di join public.approved_commercial_deltas d on d.id=di.commercial_delta_id where d.change_order_id=v_co and di.affected_commercial_baseline_item_id is not null)<>1 then raise exception 'affected baseline item lineage was not retained'; end if;
  if (select count(*) from public.approved_commercial_delta_items di join public.approved_commercial_deltas d on d.id=di.commercial_delta_id where d.change_order_id=v_additive_new_scope and di.affected_commercial_baseline_item_id is not null)<>0 then raise exception 'additive scope without a baseline item reference was rejected or fabricated'; end if;
  if (select to_jsonb(a) from public.award_decisions a where id=v_award) is distinct from v_award_before then raise exception 'Award Decision changed during Change Order approval'; end if;
  if (select to_jsonb(s) from public.accepted_scope_snapshots s where id=v_snapshot) is distinct from v_snapshot_before then raise exception 'Accepted Scope Snapshot changed during Change Order approval'; end if;
  if (select jsonb_build_object('header',to_jsonb(b),'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'::jsonb) from public.commercial_baseline_items i where i.company_id=b.company_id and i.baseline_id=b.id)) from public.commercial_baselines b where id=v_baseline) is distinct from v_baseline_before then raise exception 'Commercial Baseline header/items changed during Change Order approval'; end if;
  if (select authorized_contract_value from public.project_authorized_contract_summary where project_id=v_project) is distinct from v_baseline_sell-75 then raise exception 'zero-Sell external or office Change Order changed authorized contract value'; end if;

  perform set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
  begin
    perform public.approve_change_order(v_co);
    raise exception 'cross-company owner approved another tenant Change Order';
  exception when raise_exception then
    if sqlerrm<>'Change Order not found.' then raise; end if;
  end;
  if exists(select 1 from public.change_orders where id=v_co) or exists(select 1 from public.approved_change_order_references where id=v_co)
    or exists(select 1 from public.project_authorized_contract_summary where project_id=v_project)
    or exists(select 1 from public.commercial_baseline_item_references where project_id=v_project)
    or exists(select 1 from public.commercial_baselines where id=v_baseline) then raise exception 'cross-company read/reference escaped tenant scope'; end if;
  begin perform public.carez_create_change_order(v_project,'Cross-company project probe','additive'); raise exception 'cross-company project could create a Change Order';
  exception when raise_exception then if sqlerrm<>'Project not found.' then raise; end if; end;
  begin perform public.carez_update_change_order(v_co,'{"proposed_sell_price":151}'::jsonb); raise exception 'cross-company owner modified another tenant Change Order';
  exception when raise_exception then if sqlerrm<>'Only draft Change Orders can be edited.' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','abababab-abab-4bab-8bab-abababababab',true);
  if exists(select 1 from public.change_orders where id=v_co) then raise exception 'employee can read internal Change Order base row'; end if;
  if not exists(select 1 from public.approved_change_order_references where id=v_co and project_id=v_project) then raise exception 'employee cannot consume narrow approved Change Order reference'; end if;
  if exists(select 1 from public.change_order_financial_summary where change_order_id=v_co) then raise exception 'employee can read internal Change Order pricing evidence'; end if;
  if exists(select 1 from public.project_authorized_contract_summary where project_id=v_project) then raise exception 'employee can read authorized contract pricing summary'; end if;
  if exists(select 1 from public.commercial_baseline_item_references where project_id=v_project) then raise exception 'employee can read baseline commercial pricing evidence'; end if;
  if exists(select 1 from public.approved_commercial_deltas where change_order_id=v_co) then raise exception 'employee can read internal approved commercial delta'; end if;
  begin
    perform public.approve_change_order(v_co);
    raise exception 'employee approved a commercial Change Order';
  exception when raise_exception then
      if sqlerrm<>'Owner or office approval authority required.' then raise; end if;
  end;
  begin perform public.carez_create_change_order(v_project,'Employee mutation probe','additive'); raise exception 'employee created a commercial Change Order';
  exception when raise_exception then if sqlerrm<>'Owner or office authority required.' then raise; end if; end;
  begin perform public.carez_update_change_order(v_co,'{"proposed_sell_price":151}'::jsonb); raise exception 'employee modified a commercial Change Order';
  exception when raise_exception then if sqlerrm<>'Owner or office authority required.' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
end
$test$;

reset role;
insert into public.approved_commercial_deltas(company_id,project_id,change_order_id,commercial_baseline_id,approved_by,approved_at,authorization_kind,authorization_reference,external_authorized_by,external_authorized_at,source_fingerprint,total_direct_cost_delta,sell_delta,source_facts)
select co.company_id,co.project_id,co.id,b.id,'11111111-1111-4111-8111-111111111111',now(),'external_customer','CONFLICT-TEST','Test Owner',now(),'conflicting-test-fingerprint',0,999,'{}'::jsonb
from public.change_orders co join public.commercial_baselines b on b.company_id=co.company_id and b.project_id=co.project_id and b.baseline_kind='original_award'
where co.title='Conflicting approval replay probe';
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $conflict$
declare v_co uuid;
begin
  select id into v_co from public.change_orders where title='Conflicting approval replay probe';
  begin perform public.approve_change_order(v_co); raise exception 'conflicting approval replay was accepted';
  exception when raise_exception then if sqlerrm<>'Conflicting approval evidence exists for this Change Order.' then raise; end if; end;
end
$conflict$;
reset role;
select extensions.plan(14);
select extensions.ok(not has_function_privilege('anon','public.carez_award_proposal_and_create_project(uuid,timestamptz,text)','EXECUTE'),'anonymous role cannot execute award');
select extensions.ok(not has_table_privilege('authenticated','public.award_decisions','INSERT'),'authenticated clients cannot insert Award Decisions directly');
select extensions.ok(not has_table_privilege('authenticated','public.commercial_baselines','UPDATE'),'authenticated clients cannot rewrite a frozen baseline');
select extensions.ok((select relrowsecurity from pg_class where oid='public.accepted_scope_snapshots'::regclass),'accepted scope snapshots enforce RLS');
select extensions.ok((select relrowsecurity from pg_class where oid='public.change_orders'::regclass),'Change Orders enforce tenant RLS');
select extensions.ok(not has_table_privilege('authenticated','public.approved_commercial_deltas','INSERT'),'clients cannot manufacture approved commercial deltas');
select extensions.ok(not has_function_privilege('anon','public.approve_change_order(uuid)','EXECUTE'),'anonymous role cannot approve a Change Order');
select extensions.ok((select bool_and(reloptions @> array['security_invoker=true']) from pg_class where oid in ('public.change_order_financial_summary'::regclass,'public.project_authorized_contract_summary'::regclass,'public.commercial_baseline_item_references'::regclass)),'internal commercial views execute with invoker RLS');
select extensions.ok((select reloptions @> array['security_barrier=true'] from pg_class where oid='public.approved_change_order_references'::regclass),'narrow employee reference view is a security barrier');
select extensions.ok(not has_table_privilege('anon','public.change_order_financial_summary','SELECT') and not has_table_privilege('anon','public.approved_change_order_references','SELECT') and not has_table_privilege('anon','public.project_authorized_contract_summary','SELECT') and not has_table_privilege('anon','public.commercial_baseline_item_references','SELECT'),'anonymous role cannot read commercial views');
select extensions.ok(not has_table_privilege('anon','public.change_orders','SELECT') and not has_table_privilege('anon','public.change_order_items','SELECT') and not has_table_privilege('anon','public.approved_commercial_deltas','SELECT'),'anonymous role cannot read internal Change Order tables');
select extensions.ok((select bool_and(not has_table_privilege('authenticated',format('public.%I',views.view_name),'INSERT') and not has_table_privilege('authenticated',format('public.%I',views.view_name),'UPDATE') and not has_table_privilege('authenticated',format('public.%I',views.view_name),'DELETE')) from unnest(array['change_order_financial_summary','approved_change_order_references','project_authorized_contract_summary','commercial_baseline_item_references']) as views(view_name)),'authenticated view grants are read-only');
select extensions.ok(not has_table_privilege('authenticated','public.approved_commercial_delta_items','INSERT') and not has_table_privilege('authenticated','public.approved_commercial_deltas','UPDATE'),'authenticated clients cannot mutate approved delta evidence');
select extensions.ok(not has_function_privilege('anon','public.carez_create_change_order(uuid,text,text,date,text,text,text,uuid,numeric,uuid)','EXECUTE') and not has_function_privilege('anon','public.carez_transition_change_order(uuid,text,text,text,text,text,timestamptz,text,text,numeric)','EXECUTE') and not has_function_privilege('anon','public.carez_update_change_order(uuid,jsonb)','EXECUTE') and not has_function_privilege('anon','public.approve_change_order(uuid)','EXECUTE'),'anonymous role cannot invoke commercial Change Order mutations');
select * from extensions.finish();
rollback;
