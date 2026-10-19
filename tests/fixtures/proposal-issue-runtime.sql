-- Run only against an isolated local Supabase database as postgres.
-- All data, the failure-injection trigger, and its function roll back together.
-- This fixture deliberately contains manual material scope and no labor or
-- Takeoff geometry. It qualifies release/Award transactions, not drawing QA.
begin;
set local time zone 'UTC';
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

-- Use the current real signup trigger; the privileged assignments below only
-- establish fixture authorization contexts, not invitation/onboarding evidence.
insert into auth.users(id,email,raw_user_meta_data) values
  ('91500000-0000-4000-8000-000000000001','proposal-owner@local.invalid','{"company_name":"Synthetic proposal signup","full_name":"Local Issue Owner","operating_timezone":"UTC"}'),
  ('91500000-0000-4000-8000-000000000002','proposal-worker@local.invalid','{"company_name":"Synthetic worker signup","full_name":"Local Issue Employee","operating_timezone":"UTC"}'),
  ('91500000-0000-4000-8000-000000000003','proposal-foreign@local.invalid','{"company_name":"Synthetic foreign signup","full_name":"Other Local Owner","operating_timezone":"UTC"}');
insert into public.companies(id,name,operating_timezone) values
  ('91500000-0000-4000-8000-000000000010','Local Proposal Issue Fixture','UTC'),
  ('91500000-0000-4000-8000-000000000011','Other Local Proposal Tenant','UTC');
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('91500000-0000-4000-8000-000000000001','91500000-0000-4000-8000-000000000010','Local Issue Owner','owner'),
  ('91500000-0000-4000-8000-000000000002','91500000-0000-4000-8000-000000000010','Local Issue Employee','employee'),
  ('91500000-0000-4000-8000-000000000003','91500000-0000-4000-8000-000000000011','Other Local Owner','owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;

create function public.carez_test_proposal_issue_failure()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.estimate_id='91500000-0000-4000-8000-000000000040'::uuid
     and current_setting('carez.test_proposal_issue_failure',true)='1' then
    raise exception 'Injected local presentation failure.';
  end if;
  return new;
end;
$$;
-- PostgreSQL runs same-event triggers by name: both production guards run first.
create trigger zz_local_proposal_issue_failure
before insert on public.proposal_presentations
for each row execute function public.carez_test_proposal_issue_failure();

select set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

-- A deliberate synthetic zero-overhead plan is recorded through the supported
-- command, then captured. A bare numeric0 is not a configured release basis.
select public.carez_save_company_plan('91509900-0000-4000-8000-000000000001',0,
 '{"target_margin_percent":0,"planned_productive_hours_annual":2000,"owner_compensation_target_annual":0,"owner_planned_field_hours_annual":0,"owner_field_rate":40}');

insert into public.customers(id,company_id,name,email) values
  ('91500000-0000-4000-8000-000000000020','91500000-0000-4000-8000-000000000010',
   'Local release fixture customer','release-fixture@example.invalid');
insert into public.leads(id,company_id,customer_id,customer_name,project_name,state) values
  ('91500000-0000-4000-8000-000000000030','91500000-0000-4000-8000-000000000010',
   '91500000-0000-4000-8000-000000000020','Local release fixture customer','Local release fixture','WA');
insert into public.estimates(
  id,company_id,lead_id,opportunity_number,estimate_number,name,status,version,
  proposed_sell_price,target_margin_percent,overhead_rate_snapshot,overhead_snapshot_id,
  bo_classification,bo_rate_percent,payment_processing_rate_percent,created_by
) values (
  '91500000-0000-4000-8000-000000000040','91500000-0000-4000-8000-000000000010',
  '91500000-0000-4000-8000-000000000030','LOCAL-ISSUE','E-LOCAL-ISSUE','Local release fixture','draft',1,
  100,0,null,null,
  'retailing',0,0,'91500000-0000-4000-8000-000000000001'
);
select public.carez_attach_estimate_overhead('91509900-0000-4000-8000-000000000002',
 '91500000-0000-4000-8000-000000000040',
 (select updated_at from public.estimates where id='91500000-0000-4000-8000-000000000040'));
update public.estimates set status='ready' where id='91500000-0000-4000-8000-000000000040';
insert into public.estimate_sections(id,company_id,estimate_id,name,scope_type,sort_order) values
  ('91500000-0000-4000-8000-000000000050','91500000-0000-4000-8000-000000000010',
   '91500000-0000-4000-8000-000000000040','Footings','footing',10);
insert into public.estimate_items(
  id,company_id,estimate_id,section_id,item_type,description,quantity,unit,unit_cost,direct_cost,sort_order
) values (
  '91500000-0000-4000-8000-000000000060','91500000-0000-4000-8000-000000000010',
  '91500000-0000-4000-8000-000000000040','91500000-0000-4000-8000-000000000050',
  'material','Local commercial release fixture',2,'EA',25,50,10
);
-- A missing schedule is a real review warning. Terms, customer destination,
-- pricing, and scope are complete; no acknowledgement evidence is fabricated.
insert into public.proposal_settings(
  company_id,estimate_id,audience_type,terms_text,schedule_summary,payment_summary,
  show_quantities,validity_days,created_by
) values (
  '91500000-0000-4000-8000-000000000010','91500000-0000-4000-8000-000000000040',
  'general_contractor','Local fixture terms',null,'Local fixture payment',true,30,
  '91500000-0000-4000-8000-000000000001'
);

do $test$
declare
  v_estimate_id constant uuid:='91500000-0000-4000-8000-000000000040';
  v_company_id constant uuid:='91500000-0000-4000-8000-000000000010';
  v_owner_id constant uuid:='91500000-0000-4000-8000-000000000001';
  v_proposal_number constant text:='P-LOCAL-ISSUE-R1';
  v_expected_updated_at timestamptz;
  v_expected_source_fingerprint text;
  v_expires_at timestamptz:=now()+interval '30 days';
  v_readiness jsonb;
  v_locked_readiness jsonb;
  v_wording_readiness jsonb;
  v_snapshot jsonb;
  v_public_before jsonb;
  v_internal_before jsonb;
  v_issue jsonb;
  v_retry jsonb;
  v_award jsonb;
  v_award_retry jsonb;
  v_presentation_id uuid;
  v_token_id uuid;
  v_token uuid;
  v_project_id uuid;
  v_award_id uuid;
  v_scope_snapshot_id uuid;
  v_baseline_id uuid;
  v_spine_id uuid;
  v_sell numeric;
  v_direct_cost numeric;
begin
  if not exists(
    select 1 from pg_trigger
    where tgrelid='public.proposal_presentations'::regclass
      and tgname='guard_proposal_release' and tgenabled='O' and not tgisinternal
      and tgfoid='public.carez_guard_proposal_release()'::regprocedure
  ) or not exists(
    select 1 from pg_trigger
    where tgrelid='public.proposal_presentations'::regclass
      and tgname='capture_proposal_commercial_snapshot' and tgenabled='O' and not tgisinternal
  ) then raise exception 'Production release and snapshot guards must remain enabled.'; end if;

  -- Capture the source epoch before the reads used to assemble the offer.
  v_expected_source_fingerprint:=public.carez_proposal_source_fingerprint(v_estimate_id);
  if nullif(v_expected_source_fingerprint,'') is null then
    raise exception 'Proposal source fingerprint is unavailable.';
  end if;
  select updated_at,job_spine_id into v_expected_updated_at,v_spine_id
  from public.estimates where id=v_estimate_id and company_id=v_company_id;
  select selected_sell_price,total_direct_cost into v_sell,v_direct_cost
  from public.estimate_financial_summary where estimate_id=v_estimate_id and company_id=v_company_id;
  if v_sell is distinct from 100::numeric or v_direct_cost is distinct from 50::numeric then
    raise exception 'Fixture financial facts changed: Sell %, Direct Cost %.',v_sell,v_direct_cost;
  end if;

  v_readiness:=public.carez_get_estimate_release_readiness(v_estimate_id);
  if v_readiness->>'workflow_state' is distinct from 'review'
     or v_readiness->>'release_state' is distinct from 'review'
     or (v_readiness->>'blocker_count')::integer is distinct from 0
     or (v_readiness->>'warning_count')::integer is distinct from 1
     or not exists(select 1 from jsonb_array_elements(v_readiness->'warnings') finding
                   where finding->>'finding_key'='proposal_schedule_missing') then
    raise exception 'Expected the genuine schedule-review warning only: %.',v_readiness;
  end if;

  -- Mirror the customer-safe shape prepared by createProposalLink. Internal
  -- unit cost and Direct Cost are captured separately by the production trigger.
  v_snapshot:=jsonb_build_object(
    'proposal_number',v_proposal_number,'valid_through',v_expires_at,'audience_type','general_contractor',
    'estimate',jsonb_build_object('id',v_estimate_id,'estimate_number','E-LOCAL-ISSUE','version',1,
                                 'name','Local release fixture','expected_start_date',null),
    'pricing',jsonb_build_object('base_sell_price',v_sell),
    'company',jsonb_build_object('name','Local Proposal Issue Fixture','display_name','Local Proposal Issue Fixture'),
    'lead',jsonb_build_object('customer_name','Local release fixture customer','email','release-fixture@example.invalid',
                             'project_name','Local release fixture','state','WA'),
    'project','{}'::jsonb,
    'content',jsonb_build_object('terms_text','Local fixture terms','schedule_summary',null,
                                'payment_summary','Local fixture payment','show_quantities',true),
    'sections',jsonb_build_array(jsonb_build_object('id','91500000-0000-4000-8000-000000000050',
                                                  'name','Footings','scope_type','footing','sort_order',10)),
    'items',jsonb_build_array(jsonb_build_object('id','91500000-0000-4000-8000-000000000060',
      'section_id','91500000-0000-4000-8000-000000000050','description','Local commercial release fixture',
      'quantity',2,'unit','EA','item_type','material','sort_order',10)),
    'clarifications','[]'::jsonb,'options','[]'::jsonb,'omitted_capabilities','[]'::jsonb
  );

  begin
    perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
      v_expires_at,v_snapshot,v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
      null,v_expected_source_fingerprint);
    raise exception 'Unacknowledged review warnings allowed issuance.';
  exception when raise_exception then
    if sqlerrm<>'Complete Estimate Review before issuing this Proposal.' then raise; end if;
  end;

  v_readiness:=public.carez_acknowledge_estimate_review(v_estimate_id);
  if v_readiness->>'release_state' is distinct from 'release_ready'
     or (v_readiness->>'acknowledgement_valid')::boolean is distinct from true
     or nullif(v_readiness->>'acknowledgement_id','') is null
     or nullif(v_readiness->>'commercial_fingerprint','') is null
     or nullif(v_readiness->>'warning_fingerprint','') is null then
    raise exception 'Real warning acknowledgement did not establish release readiness: %.',v_readiness;
  end if;
  if (select count(*) from public.estimate_review_acknowledgements where estimate_id=v_estimate_id)<>1 then
    raise exception 'Review acknowledgement was not persisted exactly once.';
  end if;

  -- Customer wording is outside the commercial fingerprint. A stale prepared
  -- offer must still fail with 40001, without leaving a usable token behind.
  -- Roll back this probe's wording edit so normal issuance uses the same epoch
  -- captured before its customer-facing reads rather than silently refreshing it.
  begin
    update public.proposal_settings set customer_message='Wording changed after source capture'
    where company_id=v_company_id and estimate_id=v_estimate_id;
    v_wording_readiness:=public.carez_get_estimate_release_readiness(v_estimate_id);
    if v_wording_readiness->>'commercial_fingerprint' is distinct from v_readiness->>'commercial_fingerprint'
       or v_wording_readiness->>'warning_fingerprint' is distinct from v_readiness->>'warning_fingerprint'
       or v_wording_readiness->>'release_state' is distinct from 'release_ready'
       or public.carez_proposal_source_fingerprint(v_estimate_id) is not distinct from v_expected_source_fingerprint
       or (select selected_sell_price from public.estimate_financial_summary where estimate_id=v_estimate_id) is distinct from v_sell
       or (select total_direct_cost from public.estimate_financial_summary where estimate_id=v_estimate_id) is distinct from v_direct_cost then
      raise exception 'Wording-only probe changed commercial facts or failed to change the source epoch.';
    end if;
    begin
      perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
        v_expires_at,v_snapshot,v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
        (v_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
      raise exception 'Stale wording-only source allowed issuance.';
    exception when serialization_failure then
      if sqlerrm<>'Proposal source changed. Reload and review before issuing.' then raise; end if;
    end;
    if exists(select 1 from public.proposal_access_tokens where estimate_id=v_estimate_id)
       or exists(select 1 from public.proposal_presentations where estimate_id=v_estimate_id) then
      raise exception 'Stale wording-only source left a token or presentation behind.';
    end if;
    raise exception using errcode='P9151',message='Roll back the local wording-only probe.';
  exception when sqlstate 'P9151' then null;
  end;
  if public.carez_proposal_source_fingerprint(v_estimate_id) is distinct from v_expected_source_fingerprint then
    raise exception 'Wording-only probe did not restore the originally captured source epoch.';
  end if;

  begin
    perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at-interval '1 microsecond',
      v_proposal_number,'general_contractor',v_expires_at,v_snapshot,
      v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
      (v_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
    raise exception 'Stale Estimate timestamp allowed issuance.';
  exception when serialization_failure then null;
  end;

  perform set_config('carez.test_proposal_issue_failure','1',true);
  begin
    perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
      v_expires_at,v_snapshot,v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
      (v_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
    raise exception 'Injected presentation failure did not abort issuance.';
  exception when raise_exception then
    if sqlerrm<>'Injected local presentation failure.' then raise; end if;
  end;
  perform set_config('carez.test_proposal_issue_failure','0',true);
  if exists(select 1 from public.proposal_access_tokens where estimate_id=v_estimate_id)
     or exists(select 1 from public.proposal_presentations where estimate_id=v_estimate_id) then
    raise exception 'Failed issuance left a token or presentation behind.';
  end if;

  perform set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000003',true);
  begin
    perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
      v_expires_at,v_snapshot,v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
      (v_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
    raise exception 'Another tenant issued this Estimate.';
  exception when raise_exception then
    if sqlerrm<>'Estimate unavailable.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000002',true);
  begin
    perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
      v_expires_at,v_snapshot,v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
      (v_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
    raise exception 'An employee issued this Estimate.';
  exception when raise_exception then
    if sqlerrm<>'Owner or office access required.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',v_owner_id::text,true);

  v_issue:=public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
    v_expires_at,v_snapshot,v_readiness->>'commercial_fingerprint',v_readiness->>'warning_fingerprint',
    (v_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
  v_presentation_id:=(v_issue->>'presentation_id')::uuid;
  v_token_id:=(v_issue->>'token_id')::uuid;
  if v_presentation_id is null or v_token_id is null or v_issue->>'already_issued' is distinct from 'false' then
    raise exception 'Initial issuance was not confirmed: %.',v_issue;
  end if;
  select snapshot,internal_commercial_snapshot into v_public_before,v_internal_before
  from public.proposal_presentations where id=v_presentation_id;
  select token into v_token from public.proposal_access_tokens where id=v_token_id;
  if v_public_before is distinct from v_snapshot
     or v_internal_before->>'schema_version' is distinct from '1'
     or v_internal_before#>>'{financial_summary,total_direct_cost}' is null
     or (v_internal_before#>>'{financial_summary,total_direct_cost}')::numeric is distinct from 50::numeric
     or (v_internal_before#>>'{financial_summary,selected_sell_price}')::numeric is distinct from 100::numeric
     or not exists(select 1 from jsonb_array_elements(v_internal_before->'items') item
                   where item->>'id'='91500000-0000-4000-8000-000000000060'
                     and (item->>'direct_cost')::numeric=50) then
    raise exception 'Release did not capture the exact public and internal commercial facts.';
  end if;
  if not exists(select 1 from public.proposal_presentations
                where id=v_presentation_id and company_id=v_company_id and job_spine_id=v_spine_id
                  and created_by=v_owner_id and release_commercial_fingerprint=v_readiness->>'commercial_fingerprint'
                  and release_warning_fingerprint=v_readiness->>'warning_fingerprint'
                  and release_acknowledgement_id=(v_readiness->>'acknowledgement_id')::uuid) then
    raise exception 'Issued offer lost its actor, Job Spine, or current review evidence.';
  end if;
  if (public.get_public_proposal(v_token)#>>'{pricing,base_sell_price}')::numeric is distinct from 100::numeric then
    raise exception 'Recorded public offer is unavailable through its real token.';
  end if;

  -- Issuance locks workflow but does not change fingerprinted commercial facts.
  -- This is the refreshed readiness evidence used by an ordinary action retry.
  v_locked_readiness:=public.carez_get_estimate_release_readiness(v_estimate_id);
  if v_locked_readiness->>'workflow_state' is distinct from 'locked'
     or v_locked_readiness->>'release_state' is distinct from 'not_ready'
     or v_locked_readiness->>'commercial_fingerprint' is distinct from v_readiness->>'commercial_fingerprint'
     or v_locked_readiness->>'warning_fingerprint' is distinct from v_readiness->>'warning_fingerprint'
     or v_locked_readiness->>'acknowledgement_id' is distinct from v_readiness->>'acknowledgement_id' then
    raise exception 'Issuance changed immutable retry evidence unexpectedly: %.',v_locked_readiness;
  end if;
  v_retry:=public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
    v_expires_at+interval '1 day',jsonb_set(v_snapshot,'{valid_through}',to_jsonb(v_expires_at+interval '1 day')),
    v_locked_readiness->>'commercial_fingerprint',v_locked_readiness->>'warning_fingerprint',
    (v_locked_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
  if v_retry->>'already_issued' is distinct from 'true'
     or (v_retry->>'presentation_id')::uuid is distinct from v_presentation_id
     or (v_retry->>'token_id')::uuid is distinct from v_token_id
     or (select expires_at from public.proposal_access_tokens where id=v_token_id) is distinct from v_expires_at then
    raise exception 'Matching retry did not preserve the original issuance and expiry: %.',v_retry;
  end if;
  begin
    perform public.carez_issue_proposal(v_estimate_id,v_expected_updated_at,v_proposal_number,'general_contractor',
      v_expires_at,jsonb_set(v_snapshot,'{content,customer_message}','"Changed after issue"'::jsonb),
      v_locked_readiness->>'commercial_fingerprint',v_locked_readiness->>'warning_fingerprint',
      (v_locked_readiness->>'acknowledgement_id')::uuid,v_expected_source_fingerprint);
    raise exception 'Changed retry silently reused the frozen offer.';
  exception when raise_exception then
    if sqlerrm<>'This revision was already issued. Reopen its recorded offer or create the next revision.' then raise; end if;
  end;
  if (select count(*) from public.proposal_access_tokens where estimate_id=v_estimate_id)<>1
     or (select count(*) from public.proposal_presentations where estimate_id=v_estimate_id)<>1
     or (select snapshot from public.proposal_presentations where id=v_presentation_id) is distinct from v_public_before
     or (select internal_commercial_snapshot from public.proposal_presentations where id=v_presentation_id) is distinct from v_internal_before then
    raise exception 'Retry duplicated issuance or changed a frozen snapshot.';
  end if;

  begin
    update public.estimate_items set quantity=99 where id='91500000-0000-4000-8000-000000000060';
    raise exception 'Issued Estimate scope remained editable.';
  exception when raise_exception then
    if sqlerrm<>'Issued Estimate scope and Proposal terms are immutable. Create a next revision.' then raise; end if;
  end;
  if public.carez_get_proposal_award_hold(v_presentation_id) is not null then
    raise exception 'The exact reviewed issued offer is unexpectedly held for Award.';
  end if;
  v_award:=public.carez_award_proposal_and_create_project(v_presentation_id,null,'LOCAL-ISSUE-FIXTURE-AWARD');
  v_project_id:=(v_award->>'project_id')::uuid;
  v_award_id:=(v_award->>'award_decision_id')::uuid;
  v_scope_snapshot_id:=(v_award->>'snapshot_id')::uuid;
  v_baseline_id:=(v_award->>'baseline_id')::uuid;
  if v_award->>'already_awarded' is distinct from 'false'
     or not exists(select 1 from public.projects where id=v_project_id and company_id=v_company_id
       and job_spine_id=v_spine_id and source_estimate_id=v_estimate_id and award_decision_id=v_award_id
       and customer_id='91500000-0000-4000-8000-000000000020' and contract_value=100)
     or not exists(select 1 from public.award_decisions where id=v_award_id and company_id=v_company_id
       and job_spine_id=v_spine_id and proposal_revision_id=v_presentation_id and estimate_id=v_estimate_id
       and project_id=v_project_id and authorized_actor_id=v_owner_id and evidence_reference='LOCAL-ISSUE-FIXTURE-AWARD')
     or not exists(select 1 from public.accepted_scope_snapshots where id=v_scope_snapshot_id
       and company_id=v_company_id and job_spine_id=v_spine_id and award_decision_id=v_award_id
       and proposal_revision_id=v_presentation_id and estimate_id=v_estimate_id
       and source_fingerprint=v_readiness->>'commercial_fingerprint'
       and accepted_facts->'items'=v_internal_before->'items')
     or not exists(select 1 from public.commercial_baselines where id=v_baseline_id
       and company_id=v_company_id and job_spine_id=v_spine_id and project_id=v_project_id
       and award_decision_id=v_award_id and accepted_scope_snapshot_id=v_scope_snapshot_id
       and proposal_revision_id=v_presentation_id and estimate_id=v_estimate_id
       and total_direct_cost=50 and total_sell=100) then
    raise exception 'Award did not preserve exact Opportunity/Estimate/Proposal/snapshot/baseline/Project lineage: %.',v_award;
  end if;
  if not exists(select 1 from public.accepted_scope_snapshot_items where company_id=v_company_id
       and snapshot_id=v_scope_snapshot_id and source_estimate_item_id='91500000-0000-4000-8000-000000000060'
       and direct_cost=50 and (item_facts->>'quantity')::numeric=2 and item_facts->>'unit'='EA')
     or not exists(select 1 from public.commercial_baseline_items where company_id=v_company_id
       and baseline_id=v_baseline_id and quantity=2 and unit='EA' and direct_cost=50)
     or not exists(select 1 from public.estimates where id=v_estimate_id and status='accepted'
       and project_id=v_project_id and job_spine_id=v_spine_id)
     or not exists(select 1 from public.leads where id='91500000-0000-4000-8000-000000000030'
       and status='won' and job_spine_id=v_spine_id) then
    raise exception 'Award lost commercial item facts or replaced the retained Opportunity.';
  end if;
  v_award_retry:=public.carez_award_proposal_and_create_project(v_presentation_id,null,'LOCAL-ISSUE-FIXTURE-AWARD');
  if v_award_retry->>'already_awarded' is distinct from 'true'
     or (v_award_retry->>'project_id')::uuid is distinct from v_project_id
     or (v_award_retry->>'award_decision_id')::uuid is distinct from v_award_id
     or (v_award_retry->>'snapshot_id')::uuid is distinct from v_scope_snapshot_id
     or (v_award_retry->>'baseline_id')::uuid is distinct from v_baseline_id
     or (select count(*) from public.award_decisions where proposal_revision_id=v_presentation_id)<>1 then
    raise exception 'Award retry duplicated or replaced the accepted commercial baseline.';
  end if;
  v_locked_readiness:=public.carez_get_estimate_release_readiness(v_estimate_id);
  if v_locked_readiness->>'workflow_state' is distinct from 'locked'
     or v_locked_readiness->>'release_state' is distinct from 'not_ready' then
    raise exception 'Awarded Estimate became available for ordinary release.';
  end if;
  begin
    update public.estimate_items set direct_cost=99 where id='91500000-0000-4000-8000-000000000060';
    raise exception 'Awarded Estimate scope remained editable.';
  exception when raise_exception then
    if sqlerrm<>'Issued Estimate scope and Proposal terms are immutable. Create a next revision.' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000003',true);
  begin
    perform public.carez_award_proposal_and_create_project(v_presentation_id,null,'CROSS-TENANT-PROBE');
    raise exception 'Another tenant could replay Award.';
  exception when raise_exception then
    if sqlerrm<>'Issued Proposal revision not found.' then raise; end if;
  end;
  if exists(select 1 from public.proposal_presentations where id=v_presentation_id)
     or exists(select 1 from public.projects where id=v_project_id) then
    raise exception 'Cross-tenant commercial records escaped RLS.';
  end if;
  perform set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000002',true);
  begin
    perform public.carez_award_proposal_and_create_project(v_presentation_id,null,'EMPLOYEE-PROBE');
    raise exception 'An employee could replay Award.';
  exception when raise_exception then
    if sqlerrm<>'Owner or office access required.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',v_owner_id::text,true);
  if (select snapshot from public.proposal_presentations where id=v_presentation_id) is distinct from v_public_before
     or (select internal_commercial_snapshot from public.proposal_presentations where id=v_presentation_id) is distinct from v_internal_before then
    raise exception 'Award or a denied request changed the frozen issued offer.';
  end if;
end;
$test$;

reset role;
do $$
begin
  if exists(select 1 from pg_trigger where tgrelid='public.proposal_presentations'::regclass
            and tgname in ('guard_proposal_release','capture_proposal_commercial_snapshot') and tgenabled<>'O') then
    raise exception 'A production release trigger was disabled during the fixture.';
  end if;
end;
$$;
select extensions.pass('guarded release, source revision, atomic rollback, retry, tenant, Award and immutable lineage passed');
select * from extensions.finish();
rollback;
