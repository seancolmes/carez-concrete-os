-- Isolated synthetic fixture. No provider or real business submissions.
-- Persistence/security/read-model qualification, not Proposal release acceptance.
begin;set local search_path=pg_catalog,public,extensions;
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('e1100000-0000-4000-8000-000000000001','intelligence-owner@local.invalid'),
 ('e1100000-0000-4000-8000-000000000002','intelligence-office@local.invalid'),
 ('e1100000-0000-4000-8000-000000000003','intelligence-employee@local.invalid'),
 ('e1100000-0000-4000-8000-000000000004','intelligence-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone,target_margin_percent,
 planned_productive_hours_annual,owner_compensation_target_annual,owner_planned_field_hours_annual,owner_field_rate)
 values('e1200000-0000-4000-8000-000000000001','Synthetic Intelligence contractor','UTC',0,2000,0,0,0),
 ('e1200000-0000-4000-8000-000000000002','Other Intelligence contractor','UTC',0,2000,0,0,0);
insert into public.profiles(id,company_id,role) values
 ('e1100000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','owner'),
 ('e1100000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','office'),
 ('e1100000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000001','employee'),
 ('e1100000-0000-4000-8000-000000000004','e1200000-0000-4000-8000-000000000002','owner');
insert into public.leads(id,company_id,customer_name,project_name,state) values
 ('e1300000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','Synthetic A','Synthetic opportunity A','WA'),
 ('e1300000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','Synthetic B','Synthetic opportunity B','WA'),
 ('e1300000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000002','Foreign customer','Foreign opportunity','WA');
insert into public.estimates(id,company_id,lead_id,estimate_number,name,status,version,proposed_sell_price,created_by) values
 ('e1400000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000001','SYN-INT-A','Synthetic A estimate','draft',1,1000,'e1100000-0000-4000-8000-000000000001'),
 ('e1400000-0000-4000-8000-000000000002','e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000002','SYN-INT-B','Synthetic B estimate','draft',1,1000,'e1100000-0000-4000-8000-000000000001'),
 ('e1400000-0000-4000-8000-000000000003','e1200000-0000-4000-8000-000000000001',null,'SYN-INT-STANDALONE','Unlinked estimate','draft',1,1000,'e1100000-0000-4000-8000-000000000001');
create temp table intelligence_results(key text primary key,value jsonb);
grant all on intelligence_results to authenticated;
create temp table profile_input as select '{"lead_id":"e1300000-0000-4000-8000-000000000001",
 "bid_type":"private_competitive","relationship_strength":"new","estimated_competitor_count":0,
 "customer_budget":0,"customer_budget_source":"Explicit zero fixture","estimator_effort_hours":0,
 "project_fit_score":3,"relationship_score":3,"scope_clarity_score":3,"capacity_score":3,
 "margin_potential_score":3,"payment_confidence_score":3,"competition_score":3,"risk_score":3,
 "pursuit_decision":"review","pass_reason":null}'::jsonb payload;
grant select on profile_input to authenticated;
create function pg_temp.intelligence(n integer,c text,p jsonb) returns jsonb language sql as $$
 select public.carez_intelligence_command_v1(('e1900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)$$;
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000001',true);set local role authenticated;

select extensions.lives_ok($t$insert into intelligence_results values('profile',pg_temp.intelligence(1,'save_profile',(select payload from profile_input)))$t$,'explicit profile saves through governed command');
select extensions.lives_ok($t$select pg_temp.intelligence(1,'save_profile',(select payload from profile_input))$t$,'same profile request replays');
select extensions.is((select count(*)::int from public.lead_bid_intelligence where company_id=public.get_my_company_id()),1,'profile retry does not duplicate');
select extensions.is((select carez_pursuit_score from public.bid_pursuit_score where lead_id='e1300000-0000-4000-8000-000000000001'),60.0::numeric,'existing weighted score formula is unchanged');
select extensions.ok((select customer_budget=0 and estimator_effort_hours=0 and estimated_competitor_count=0 from public.lead_bid_intelligence where lead_id='e1300000-0000-4000-8000-000000000001'),'recorded zeros remain zeros');
select extensions.throws_like($t$select pg_temp.intelligence(1,'save_profile',(select payload||'{"customer_budget":1}' from profile_input))$t$,'%reused with different values%','changed uncertain retry conflicts');
select extensions.throws_like($t$select pg_temp.intelligence(2,'save_profile',(select payload-'project_fit_score' from profile_input))$t$,'%project_fit_score is required%','missing score cannot create default-filled profile');
select extensions.throws_like($t$select pg_temp.intelligence(2,'save_profile',(select payload||'{"project_fit_score":6}' from profile_input))$t$,'%between 1 and 5%','score range is enforced without clamping');
select extensions.throws_like($t$select pg_temp.intelligence(2,'save_profile',(select payload||'{"customer_budget":"NaN"}' from profile_input))$t$,'%finite%','invalid number is not coerced to zero');
select extensions.throws_like($t$select pg_temp.intelligence(2,'save_profile',(select payload||'{"bid_type":"invalid"}' from profile_input))$t$,'%bid_type is invalid%','published bid-type enum is enforced');
select extensions.lives_ok($t$select pg_temp.intelligence(2,'save_profile',(select payload||'{"customer_budget":null,"estimator_effort_hours":null}' from profile_input))$t$,'optional missing values remain null');
select extensions.ok((select customer_budget is null and estimator_effort_hours is null from public.lead_bid_intelligence where lead_id='e1300000-0000-4000-8000-000000000001'),'missing budget/hours do not become zero');

select extensions.lives_ok($t$insert into intelligence_results values('claim',pg_temp.intelligence(10,'record_feedback',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","estimate_id":null,"feedback_source":"customer_claim","competitor_price":0,"scope_comparable":"yes","note":"Explicit zero unverified claim"}'))$t$,'lead-level zero feedback remains available without estimate link');
select extensions.ok((select competitor_price=0 and estimate_id is null and not safe_for_price_comparison and evidence_strength='unverified' from public.bid_price_feedback_intelligence where id=(select (value->>'id')::uuid from intelligence_results where key='claim')),'server evidence classifier preserves zero and distinguishes unverified claim');
select extensions.throws_like($t$select pg_temp.intelligence(11,'record_feedback',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","estimate_id":"e1400000-0000-4000-8000-000000000002","feedback_source":"gc_feedback","scope_comparable":"yes"}')$t$,'%not linked to the selected opportunity%','other lead Estimate is rejected');
select extensions.throws_like($t$select pg_temp.intelligence(11,'record_feedback',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","estimate_id":"e1400000-0000-4000-8000-000000000003","feedback_source":"gc_feedback","scope_comparable":"yes"}')$t$,'%not linked to the selected opportunity%','standalone Estimate is not silently assigned to selected lead');
select extensions.lives_ok($t$insert into intelligence_results values('feedback',pg_temp.intelligence(11,'record_feedback',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","estimate_id":"e1400000-0000-4000-8000-000000000001","feedback_source":"public_bid_tab","competitor_price":500,"scope_comparable":"yes"}'))$t$,'feedback records exact matching Estimate revision');
select extensions.lives_ok($t$insert into intelligence_results values('scope',pg_temp.intelligence(12,'add_scope',
 jsonb_build_object('lead_id','e1300000-0000-4000-8000-000000000001','estimate_id','e1400000-0000-4000-8000-000000000001',
 'bid_price_feedback_id',(select value->>'id' from intelligence_results where key='feedback'),
 'description','Synthetic rebar scope','carez_status','included','competitor_status','excluded','equalization_amount',100)))$t$,'scope comparison derives feedback lineage');
select extensions.ok((select leveled_competitor_price=600 and comparison_ready from public.bid_scope_leveling_summary where bid_price_feedback_id=(select (value->>'id')::uuid from intelligence_results where key='feedback')),'existing leveling formula remains 500 plus 100');
select extensions.throws_like($t$select pg_temp.intelligence(13,'add_scope',jsonb_build_object(
 'lead_id','e1300000-0000-4000-8000-000000000002','estimate_id','e1400000-0000-4000-8000-000000000002',
 'bid_price_feedback_id',(select value->>'id' from intelligence_results where key='feedback'),
 'description','Contradictory hidden IDs','carez_status','included','competitor_status','unknown','equalization_amount',0))$t$,
 '%context contradicts%','scope hidden context cannot change feedback ownership');

select extensions.lives_ok($t$insert into intelligence_results values('option',pg_temp.intelligence(20,'add_value_option',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","estimate_id":"e1400000-0000-4000-8000-000000000001","name":"Synthetic alternate","customer_description":"Explicit alternate fixture","sell_price_change":-100,"company_cost_change":-20,"schedule_days_change":-1}'))$t$,'governed RPC supplies previously blocked option creation');
select extensions.ok((select sell_price_change=-100 and company_cost_change=-20 and schedule_days_change=-1 and status='suggested' from public.bid_value_options where id=(select (value->>'id')::uuid from intelligence_results where key='option')),'signed option changes are preserved');
select extensions.lives_ok($t$select pg_temp.intelligence(21,'update_value_option_status',jsonb_build_object('option_id',(select value->>'id' from intelligence_results where key='option'),'status','presented'))$t$,'existing option status update remains available');
select extensions.throws_like($t$select pg_temp.intelligence(22,'add_value_option',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","name":"Bad","customer_description":"Invalid price text","sell_price_change":"NaN","company_cost_change":0,"schedule_days_change":0}')$t$,'%finite%','invalid option delta is not defaulted to zero');
select extensions.throws_like($t$select pg_temp.intelligence(22,'update_value_option_status','{"option_id":"e1900000-0000-4000-8000-999999999999","status":"accepted"}')$t$,'%Value option unavailable%','zero-row option update is not reported as success');

select extensions.throws_like($t$select pg_temp.intelligence(23,'update_value_option_status',jsonb_build_object('option_id',(select value->>'id' from intelligence_results where key='option'),'status','suggested','estimate_id','e1400000-0000-4000-8000-000000000002'))$t$,'%revision changed%','Proposal action cannot toggle an option reassigned to a different revision');
select extensions.lives_ok($t$select pg_temp.intelligence(23,'update_value_option_status',jsonb_build_object('option_id',(select value->>'id' from intelligence_results where key='option'),'status','presented','estimate_id','e1400000-0000-4000-8000-000000000001'))$t$,'Proposal action supplies the exact expected estimate revision');

select extensions.lives_ok($t$select pg_temp.intelligence(30,'mark_proposal_sent','{"lead_id":"e1300000-0000-4000-8000-000000000001"}')$t$,'proposal-sent tracking updates existing lead/profile');
select extensions.lives_ok($t$select pg_temp.intelligence(31,'record_follow_up','{"lead_id":"e1300000-0000-4000-8000-000000000001","note":"Synthetic follow-up","next_follow_up":"2026-11-01"}')$t$,'follow-up activity, lead and profile update atomically');
select extensions.lives_ok($t$select pg_temp.intelligence(31,'record_follow_up','{"lead_id":"e1300000-0000-4000-8000-000000000001","note":"Synthetic follow-up","next_follow_up":"2026-11-01"}')$t$,'follow-up retry reuses its activity');
reset role;
select extensions.is((select count(*)::int from public.lead_activities where lead_id='e1300000-0000-4000-8000-000000000001'),1,'retry creates one follow-up activity');
set local role authenticated;
select extensions.lives_ok($t$select pg_temp.intelligence(32,'record_follow_up','{"lead_id":"e1300000-0000-4000-8000-000000000002","note":"No profile exists","next_follow_up":null}')$t$,'follow-up can record activity without inventing a profile');
select extensions.ok(not exists(select 1 from public.lead_bid_intelligence where lead_id='e1300000-0000-4000-8000-000000000002'),'optional profile metadata is not fabricated');

-- Late profile update fails AFTER activity and lead writes.
reset role;
create function pg_temp.fail_intelligence_profile() returns trigger language plpgsql as $$
begin if new.last_follow_up_at is distinct from old.last_follow_up_at then raise exception 'Synthetic late profile failure';end if;return new;end $$;
create trigger synthetic_intelligence_profile_failure before update on public.lead_bid_intelligence
 for each row execute function pg_temp.fail_intelligence_profile();
set local role authenticated;
select extensions.throws_like($t$select pg_temp.intelligence(33,'record_follow_up','{"lead_id":"e1300000-0000-4000-8000-000000000001","note":"Must roll back","next_follow_up":"2026-12-01"}')$t$,'%Synthetic late profile failure%','late follow-up failure is surfaced');
reset role;
select extensions.ok(not exists(select 1 from public.lead_activities where note='Must roll back')
 and (select follow_up='2026-11-01' from public.leads where id='e1300000-0000-4000-8000-000000000001')
 and not exists(select 1 from public.financial_command_requests where request_id='e1900000-0000-4000-8000-000000000033'),
 'failed follow-up rolls back activity, lead date and request');
drop trigger synthetic_intelligence_profile_failure on public.lead_bid_intelligence;
create function pg_temp.fail_intelligence_lead() returns trigger language plpgsql as $$
begin if new.status='lost' and old.status<>'lost' then raise exception 'Synthetic late outcome failure';end if;return new;end $$;
create trigger synthetic_intelligence_lead_failure before update on public.leads
 for each row execute function pg_temp.fail_intelligence_lead();
set local role authenticated;
select extensions.throws_like($t$select pg_temp.intelligence(40,'record_outcome','{"lead_id":"e1300000-0000-4000-8000-000000000001","outcome":"lost","lost_reason":"price","outcome_note":"Synthetic outcome"}')$t$,'%Synthetic late outcome failure%','late lead failure is surfaced');
select extensions.is((select outcome from public.lead_bid_intelligence where lead_id='e1300000-0000-4000-8000-000000000001'),'pending','failed outcome rolls back profile change');
reset role;drop trigger synthetic_intelligence_lead_failure on public.leads;
set local role authenticated;
select extensions.lives_ok($t$select pg_temp.intelligence(40,'record_outcome','{"lead_id":"e1300000-0000-4000-8000-000000000001","outcome":"lost","lost_reason":"price","outcome_note":"Synthetic outcome"}')$t$,'same request recovers after failed transaction');
select extensions.throws_like($t$select pg_temp.intelligence(41,'mark_proposal_sent','{"lead_id":"e1300000-0000-4000-8000-000000000001"}')$t$,'%closed bid%','mark sent cannot reopen a lost bid');
select extensions.lives_ok($t$select pg_temp.intelligence(42,'save_profile',(select payload||'{"lead_id":"e1300000-0000-4000-8000-000000000002"}' from profile_input))$t$,'second lead receives explicit profile');
select extensions.lives_ok($t$select pg_temp.intelligence(43,'record_outcome','{"lead_id":"e1300000-0000-4000-8000-000000000002","outcome":"won"}')$t$,'won outcome remains separately recorded');
select extensions.throws_like($t$select pg_temp.intelligence(44,'mark_proposal_sent','{"lead_id":"e1300000-0000-4000-8000-000000000002"}')$t$,'%closed bid%','mark sent cannot reopen a won bid');
select extensions.lives_ok($t$select pg_temp.intelligence(45,'record_follow_up','{"lead_id":"e1300000-0000-4000-8000-000000000002","note":"Closed-bid discussion","next_follow_up":"2027-01-01"}')$t$,'closed-bid discussion can be recorded without reopening');
select extensions.is((select status from public.leads where id='e1300000-0000-4000-8000-000000000002'),'won','follow-up preserves terminal lead state');

-- Historical fixture tests the EXISTING issued-option guard only.
-- Release guard is disabled narrowly; actual frozen snapshot still captures.
reset role;
update public.estimates set overhead_snapshot_id=(public.carez_capture_company_overhead(company_id,
 public.carez_company_calendar_date(company_id,clock_timestamp()))).id,overhead_rate_snapshot=0
 where id='e1400000-0000-4000-8000-000000000001';
insert into public.proposal_access_tokens(id,company_id,estimate_id,token) values
 ('e1500000-0000-4000-8000-000000000001','e1200000-0000-4000-8000-000000000001',
 'e1400000-0000-4000-8000-000000000001','e1500000-0000-4000-8000-000000000002');
alter table public.proposal_presentations disable trigger guard_proposal_release;
insert into public.proposal_presentations(id,company_id,estimate_id,proposal_access_token_id,
 proposal_number,base_sell_price,source_estimate_updated_at,snapshot,status,response_state,created_by,
 release_commercial_fingerprint,release_warning_fingerprint)
 select 'e1600000-0000-4000-8000-000000000001',e.company_id,e.id,
 'e1500000-0000-4000-8000-000000000001','SYN-INT-ISSUED',s.selected_sell_price,e.updated_at,
 jsonb_build_object('pricing',jsonb_build_object('base_sell_price',s.selected_sell_price),'options','[]'::jsonb),
 'sent','none','e1100000-0000-4000-8000-000000000001','fixture-not-a-release','fixture-not-a-release'
 from public.estimates e join public.estimate_financial_summary s on s.estimate_id=e.id
 where e.id='e1400000-0000-4000-8000-000000000001';
alter table public.proposal_presentations enable trigger guard_proposal_release;
set local role authenticated;
select extensions.throws_like($t$select pg_temp.intelligence(50,'update_value_option_status',jsonb_build_object('option_id',(select value->>'id' from intelligence_results where key='option'),'status','accepted'))$t$,'%immutable%','existing issued-option update guard remains active');
select extensions.throws_like($t$select pg_temp.intelligence(51,'add_value_option',
 '{"lead_id":"e1300000-0000-4000-8000-000000000001","estimate_id":"e1400000-0000-4000-8000-000000000001","name":"Forbidden issued edit","customer_description":"Must not save","sell_price_change":0,"company_cost_change":0,"schedule_days_change":0}')$t$,'%immutable%','existing issued-option insert guard remains active');
select extensions.lives_ok($t$select pg_temp.intelligence(52,'remove_scope',jsonb_build_object('item_id',(select value->>'id' from intelligence_results where key='scope')))$t$,'market comparison removal is independent from frozen Proposal terms');
select extensions.lives_ok($t$select pg_temp.intelligence(52,'remove_scope',jsonb_build_object('item_id',(select value->>'id' from intelligence_results where key='scope')))$t$,'remove retry is confirmed without duplicate effects');
select extensions.throws_like($t$select pg_temp.intelligence(53,'remove_scope',jsonb_build_object('item_id',(select value->>'id' from intelligence_results where key='scope')))$t$,'%Scope item unavailable%','new request for absent item is not false success');
select extensions.throws_like($t$insert into public.bid_price_feedback(company_id,lead_id,feedback_source)
 values('e1200000-0000-4000-8000-000000000001','e1300000-0000-4000-8000-000000000003','other')$t$,'%Opportunity unavailable in the recorded company%','remaining direct grant cannot forge cross-company relationship');
select extensions.throws_like($t$select public.carez_intelligence_number('{}','x',true,null,false)$t$,'%permission denied%','private numeric helper cannot be called directly');
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000002',true);
select extensions.lives_ok($t$select pg_temp.intelligence(60,'record_feedback','{"lead_id":"e1300000-0000-4000-8000-000000000002","feedback_source":"gc_feedback","scope_comparable":"unknown","competitor_price":null}')$t$,'office authority can record feedback');
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($t$select pg_temp.intelligence(61,'save_profile',(select payload from profile_input))$t$,'%Owner or office authority required%','employee cannot submit Intelligence commands');
select set_config('request.jwt.claim.sub','e1100000-0000-4000-8000-000000000004',true);
select extensions.throws_like($t$select pg_temp.intelligence(61,'record_feedback','{"lead_id":"e1300000-0000-4000-8000-000000000001","feedback_source":"other","scope_comparable":"unknown"}')$t$,'%Opportunity unavailable%','foreign owner cannot use another company opportunity');
reset role;set local role anon;
select extensions.throws_like($t$select pg_temp.intelligence(61,'record_feedback','{}')$t$,'%permission denied%','anonymous cannot submit Intelligence commands');
reset role;select * from extensions.finish();rollback;
