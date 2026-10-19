-- Govern Intelligence writes without changing score, price or revision authority.
-- Requires recovered Intelligence relations/views and financial request helpers.
-- No score, price, leveling, win-rate, or revision-selection formula changes.
-- Existing Proposal actions still write profile/option/activity tables directly;
-- do NOT revoke their DML here without migrating those callers separately.

create function public.carez_intelligence_number(p_values jsonb,p_key text,
 p_required boolean default true,p_min numeric default null,p_integer boolean default false)
returns numeric language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare value numeric;begin
 if nullif(btrim(p_values->>p_key),'') is null then
  if p_required then raise exception '% is required',p_key;end if;return null;
 end if;
 if jsonb_typeof(p_values->p_key) not in ('number','string') then raise exception '% must be numeric',p_key;end if;
 value:=(p_values->>p_key)::numeric;
 if value::text in ('NaN','Infinity','-Infinity') or (p_min is not null and value<p_min)
  or (p_integer and value<>trunc(value)) then raise exception '% must be finite and within its recorded bounds',p_key;end if;
 return value;
end $$;
revoke all on function public.carez_intelligence_number(jsonb,text,boolean,numeric,boolean) from public,anon,authenticated;

create function public.carez_intelligence_enum(p_values jsonb,p_key text,p_allowed text[])
returns text language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare value text:=nullif(btrim(p_values->>p_key),'');begin
 if value is null or not(value=any(p_allowed)) then raise exception '% is invalid',p_key;end if;return value;
end $$;
revoke all on function public.carez_intelligence_enum(jsonb,text,text[]) from public,anon,authenticated;

-- Individual UUID FKs do not prove tenant/lead lineage. Keep these checks on
-- every permitted write, including existing non-Intelligence Proposal callers.
-- Historical nullable feedback association remains supported by the schema.
create function public.carez_guard_intelligence_association() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare row_json jsonb:=to_jsonb(new);estimate uuid;feedback public.bid_price_feedback%rowtype;
begin
 if not exists(select 1 from public.leads where id=new.lead_id and company_id=new.company_id) then
  raise exception 'Opportunity unavailable in the recorded company';end if;
 estimate:=nullif(row_json->>'estimate_id','')::uuid;
 if estimate is not null and not exists(select 1 from public.estimates
  where id=estimate and company_id=new.company_id and lead_id=new.lead_id) then
  raise exception 'Estimate is not linked to the selected opportunity';end if;
 if tg_table_name='bid_scope_comparison_items' and row_json->>'bid_price_feedback_id' is not null then
  select * into feedback from public.bid_price_feedback where company_id=new.company_id
   and id=(row_json->>'bid_price_feedback_id')::uuid;
  if not found or feedback.lead_id is distinct from new.lead_id
   or feedback.estimate_id is distinct from estimate then
   raise exception 'Scope comparison context contradicts its feedback record';end if;
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_intelligence_association() from public,anon,authenticated;
create trigger intelligence_profile_association before insert or update on public.lead_bid_intelligence
 for each row execute function public.carez_guard_intelligence_association();
create trigger intelligence_feedback_association before insert or update on public.bid_price_feedback
 for each row execute function public.carez_guard_intelligence_association();
create trigger intelligence_scope_association before insert or update on public.bid_scope_comparison_items
 for each row execute function public.carez_guard_intelligence_association();
create trigger intelligence_option_association before insert or update on public.bid_value_options
 for each row execute function public.carez_guard_intelligence_association();
create trigger intelligence_activity_association before insert or update on public.lead_activities
 for each row execute function public.carez_guard_intelligence_association();

create function public.carez_intelligence_command_v1(p_request_id uuid,p_command text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare request jsonb;company uuid;actor uuid:=auth.uid();stamp timestamptz:=clock_timestamp();
 chosen_lead uuid;chosen_estimate uuid;target uuid;result jsonb;patch jsonb;key text;number numeric;
 lead_row public.leads%rowtype;feedback public.bid_price_feedback%rowtype;
 item public.bid_scope_comparison_items%rowtype;option_row public.bid_value_options%rowtype;
 profile public.lead_bid_intelligence%rowtype;affected integer;profile_touched boolean;
 text_value text;state_value text;next_day date;
begin
 if p_command not in ('save_profile','record_feedback','add_scope','remove_scope',
  'add_value_option','update_value_option_status','record_follow_up','mark_proposal_sent','record_outcome')
  or p_command is null then raise exception 'Unsupported Intelligence command';end if;
 request:=public.carez_financial_request_begin(p_request_id,'bid_intelligence:'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;
 company:=(request->>'company_id')::uuid;

 if p_command='add_scope' then
  select * into feedback from public.bid_price_feedback where company_id=company
   and id=nullif(p_values->>'bid_price_feedback_id','')::uuid for update;
  if not found then raise exception 'Feedback unavailable';end if;
  if nullif(p_values->>'lead_id','')::uuid is distinct from feedback.lead_id
   or nullif(p_values->>'estimate_id','')::uuid is distinct from feedback.estimate_id then
   raise exception 'Scope comparison context contradicts its feedback record';end if;
  chosen_lead:=feedback.lead_id;chosen_estimate:=feedback.estimate_id;
 elsif p_command='remove_scope' then
  select * into item from public.bid_scope_comparison_items where company_id=company
   and id=nullif(p_values->>'item_id','')::uuid for update;
  if not found then raise exception 'Scope item unavailable';end if;
  target:=item.id;chosen_lead:=item.lead_id;chosen_estimate:=item.estimate_id;
 elsif p_command='update_value_option_status' then
  select * into option_row from public.bid_value_options where company_id=company
   and id=nullif(p_values->>'option_id','')::uuid for update;
  if not found then raise exception 'Value option unavailable';end if;
  target:=option_row.id;chosen_lead:=option_row.lead_id;chosen_estimate:=option_row.estimate_id;
  if nullif(p_values->>'estimate_id','') is not null then
   if chosen_estimate is distinct from (p_values->>'estimate_id')::uuid then raise exception 'Value option revision changed; reload the Proposal';end if;
   if exists(select 1 from public.estimates where company_id=company and id=chosen_estimate and status in ('accepted','approved','superseded')) then raise exception 'This estimate revision is locked';end if;
  end if;
 else
  chosen_lead:=nullif(p_values->>'lead_id','')::uuid;
  if p_command in ('record_feedback','add_value_option') then chosen_estimate:=nullif(p_values->>'estimate_id','')::uuid;end if;
 end if;
 select * into lead_row from public.leads where company_id=company and id=chosen_lead for update;
 if not found then raise exception 'Opportunity unavailable';end if;
 if chosen_estimate is not null then
  perform 1 from public.estimates where company_id=company and id=chosen_estimate and lead_id=lead_row.id for update;
  if not found then raise exception 'Estimate is not linked to the selected opportunity';end if;
 end if;

 case p_command
 when 'save_profile' then
  patch:=p_values||jsonb_build_object('company_id',company,'lead_id',lead_row.id,
   'bid_type',public.carez_intelligence_enum(p_values,'bid_type',array['residential_direct','private_competitive','gc_invited','negotiated','public_hard_bid','repeat_client','other']),
   'relationship_strength',public.carez_intelligence_enum(p_values,'relationship_strength',array['new','known','repeat']),
   'pursuit_decision',public.carez_intelligence_enum(p_values,'pursuit_decision',array['review','pursue','pass']),
   'estimated_competitor_count',public.carez_intelligence_number(p_values,'estimated_competitor_count',false,0,true),
   'customer_budget',public.carez_intelligence_number(p_values,'customer_budget',false,0,false),
   'estimator_effort_hours',public.carez_intelligence_number(p_values,'estimator_effort_hours',false,0,false));
  foreach key in array array['project_fit_score','relationship_score','scope_clarity_score','capacity_score',
   'margin_potential_score','payment_confidence_score','competition_score','risk_score'] loop
   number:=public.carez_intelligence_number(p_values,key,true,1,true);
   if number>5 then raise exception '% must be between 1 and 5',key;end if;
   patch:=patch||jsonb_build_object(key,number);
  end loop;
  insert into public.lead_bid_intelligence(company_id,lead_id,bid_type,relationship_strength,
   estimated_competitor_count,customer_budget,customer_budget_source,project_fit_score,relationship_score,
   scope_clarity_score,capacity_score,margin_potential_score,payment_confidence_score,competition_score,risk_score,
   estimator_effort_hours,pursuit_decision,pass_reason,created_by,updated_at)
  select company,lead_row.id,r.bid_type,r.relationship_strength,r.estimated_competitor_count,r.customer_budget,
   nullif(btrim(r.customer_budget_source),''),r.project_fit_score,r.relationship_score,r.scope_clarity_score,r.capacity_score,
   r.margin_potential_score,r.payment_confidence_score,r.competition_score,r.risk_score,r.estimator_effort_hours,
   r.pursuit_decision,nullif(btrim(r.pass_reason),''),actor,stamp
   from jsonb_populate_record(null::public.lead_bid_intelligence,patch) r
  on conflict (lead_id) do update set bid_type=excluded.bid_type,relationship_strength=excluded.relationship_strength,
   estimated_competitor_count=excluded.estimated_competitor_count,customer_budget=excluded.customer_budget,
   customer_budget_source=excluded.customer_budget_source,project_fit_score=excluded.project_fit_score,
   relationship_score=excluded.relationship_score,scope_clarity_score=excluded.scope_clarity_score,
   capacity_score=excluded.capacity_score,margin_potential_score=excluded.margin_potential_score,
   payment_confidence_score=excluded.payment_confidence_score,competition_score=excluded.competition_score,
   risk_score=excluded.risk_score,estimator_effort_hours=excluded.estimator_effort_hours,
   pursuit_decision=excluded.pursuit_decision,pass_reason=excluded.pass_reason,updated_at=stamp
   where public.lead_bid_intelligence.company_id=company returning id into target;
  if target is null then raise exception 'Pursuit profile was not confirmed';end if;

 when 'record_feedback' then
  insert into public.bid_price_feedback(company_id,lead_id,estimate_id,feedback_source,competitor_name,
   competitor_price,scope_comparable,note,recorded_at,created_by)
  values(company,lead_row.id,chosen_estimate,
   public.carez_intelligence_enum(p_values,'feedback_source',array['customer_claim','gc_feedback','public_bid_tab','direct_competitor_quote','owner_budget','other']),
   nullif(btrim(p_values->>'competitor_name'),''),public.carez_intelligence_number(p_values,'competitor_price',false,0,false),
   public.carez_intelligence_enum(p_values,'scope_comparable',array['yes','no','unknown']),
   nullif(btrim(p_values->>'note'),''),stamp,actor) returning id into target;

 when 'add_scope' then
  text_value:=nullif(btrim(p_values->>'description'),'');if text_value is null then raise exception 'Scope description is required';end if;
  insert into public.bid_scope_comparison_items(company_id,lead_id,estimate_id,bid_price_feedback_id,
   description,carez_status,competitor_status,equalization_amount,note,sort_order,created_by)
  values(company,feedback.lead_id,feedback.estimate_id,feedback.id,text_value,
   public.carez_intelligence_enum(p_values,'carez_status',array['included','excluded','allowance','unknown']),
   public.carez_intelligence_enum(p_values,'competitor_status',array['included','excluded','allowance','unknown']),
   public.carez_intelligence_number(p_values,'equalization_amount',true,0,false),nullif(btrim(p_values->>'note'),''),
   (select coalesce(max(sort_order),0)+10 from public.bid_scope_comparison_items where company_id=company and bid_price_feedback_id=feedback.id),
   actor) returning id into target;

 when 'remove_scope' then
  delete from public.bid_scope_comparison_items where company_id=company and id=target;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Scope removal was not confirmed';end if;

 when 'add_value_option' then
  text_value:=nullif(btrim(p_values->>'name'),'');
  if text_value is null or nullif(btrim(p_values->>'customer_description'),'') is null then raise exception 'Value option name and description are required';end if;
  insert into public.bid_value_options(company_id,lead_id,estimate_id,name,customer_description,
   sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,status,created_by)
  values(company,lead_row.id,chosen_estimate,text_value,btrim(p_values->>'customer_description'),
   public.carez_intelligence_number(p_values,'sell_price_change',true,null,false),
   public.carez_intelligence_number(p_values,'company_cost_change',true,null,false),
   public.carez_intelligence_number(p_values,'schedule_days_change',true,null,true),
   nullif(btrim(p_values->>'function_quality_note'),''),nullif(btrim(p_values->>'approval_required'),''),
   'suggested',actor) returning id into target;

 when 'update_value_option_status' then
  state_value:=public.carez_intelligence_enum(p_values,'status',array['suggested','presented','accepted','rejected','withdrawn']);
  update public.bid_value_options set status=state_value,updated_at=stamp where company_id=company and id=target;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Value option update was not confirmed';end if;
  -- Existing guard_issued_proposal_options remains authoritative and executes.

 when 'record_follow_up' then
  text_value:=nullif(btrim(p_values->>'note'),'');if text_value is null then raise exception 'Follow-up note is required';end if;
  next_day:=public.carez_procurement_date(p_values->>'next_follow_up',false);
  insert into public.lead_activities(company_id,lead_id,activity_type,activity_date,note,next_follow_up,created_by)
   values(company,lead_row.id,'follow_up',stamp,text_value,next_day,actor) returning id into target;
  if lead_row.status not in ('won','lost') then
   update public.leads set follow_up=next_day,status='follow_up',updated_at=stamp where company_id=company and id=lead_row.id;
   get diagnostics affected=row_count;if affected<>1 then raise exception 'Lead follow-up was not confirmed';end if;
  end if;
  update public.lead_bid_intelligence set last_follow_up_at=stamp,updated_at=stamp where company_id=company and lead_id=lead_row.id;
  get diagnostics affected=row_count;profile_touched:=affected=1;
  -- Absent profile is optional metadata, never an implicit score creation.

 when 'mark_proposal_sent' then
  if lead_row.status in ('won','lost') then raise exception 'A closed bid cannot be marked Proposal sent';end if;
  update public.leads set status='proposal_sent',updated_at=stamp where company_id=company and id=lead_row.id;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Proposal-sent tracking was not confirmed';end if;
  update public.lead_bid_intelligence set proposal_sent_at=stamp,updated_at=stamp where company_id=company and lead_id=lead_row.id;
  get diagnostics affected=row_count;profile_touched:=affected=1;target:=lead_row.id;
  -- Tracking only: this command does not issue a Proposal or create acceptance.

 when 'record_outcome' then
  state_value:=public.carez_intelligence_enum(p_values,'outcome',array['won','lost','no_decision','withdrawn']);
  select * into profile from public.lead_bid_intelligence where company_id=company and lead_id=lead_row.id for update;
  if not found then raise exception 'Pursuit profile unavailable; no outcome was saved';end if;
  update public.lead_bid_intelligence set outcome=state_value,
   lost_reason=case when state_value='lost' then coalesce(nullif(btrim(p_values->>'lost_reason'),''),'unknown') end,
   outcome_note=nullif(btrim(p_values->>'outcome_note'),''),updated_at=stamp where company_id=company and id=profile.id;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Bid outcome was not confirmed';end if;
  if state_value in ('won','lost') then
   update public.leads set status=state_value,updated_at=stamp where company_id=company and id=lead_row.id;
   get diagnostics affected=row_count;if affected<>1 then raise exception 'Lead outcome was not confirmed';end if;
  end if;target:=profile.id;
 end case;
 result:=jsonb_build_object('ok',true,'id',target,'lead_id',lead_row.id);
 if profile_touched is not null then result:=result||jsonb_build_object('profile_updated',profile_touched);end if;
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_intelligence_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_intelligence_command_v1(uuid,text,jsonb) to authenticated;
-- Preserve proposal issuance, snapshots and readiness while removing its unchecked post-commit profile upsert.
create or replace function public.carez_issue_proposal(
 p_estimate_id uuid,p_expected_updated_at timestamptz,p_proposal_number text,p_audience text,
 p_expires_at timestamptz,p_snapshot jsonb,p_commercial_fingerprint text,
 p_warning_fingerprint text,p_acknowledgement_id uuid,p_expected_source_fingerprint text
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid:=public.get_my_company_id();v_estimate public.estimates%rowtype;
 v_existing public.proposal_presentations%rowtype;v_token public.proposal_access_tokens%rowtype;
 v_readiness jsonb;v_sell numeric;v_id uuid;v_source_fingerprint text;v_opportunity text;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 select * into v_estimate from public.estimates where id=p_estimate_id and company_id=v_company for update;
 if not found then raise exception 'Estimate unavailable.';end if;
 select * into v_existing from public.proposal_presentations where company_id=v_company and estimate_id=p_estimate_id order by created_at,id limit 1;
 if found then
  select * into v_token from public.proposal_access_tokens where id=v_existing.proposal_access_token_id and company_id=v_company;
  if v_token.id is not null and v_token.revoked_at is null and (v_token.expires_at is null or v_token.expires_at>now())
   and v_existing.source_estimate_updated_at=p_expected_updated_at
   and v_existing.release_commercial_fingerprint=p_commercial_fingerprint
   and v_existing.release_warning_fingerprint=p_warning_fingerprint
   and v_existing.proposal_number=p_proposal_number and v_existing.audience_type=p_audience
   and (v_existing.snapshot-'valid_through')=(p_snapshot-'valid_through') then
   return jsonb_build_object('presentation_id',v_existing.id,'token_id',v_token.id,'already_issued',true);
  end if;
  raise exception 'This revision was already issued. Reopen its recorded offer or create the next revision.';
 end if;
 if exists(select 1 from public.proposal_access_tokens where company_id=v_company and estimate_id=p_estimate_id and revoked_at is null and (expires_at is null or expires_at>now())) then
  raise exception 'An existing customer link has no frozen offer. Review and revoke that link before issuing.';
 end if;
 if p_expected_updated_at is null or v_estimate.updated_at is distinct from p_expected_updated_at then raise exception 'Estimate changed. Reload and review before issuing.' using errcode='40001';end if;
 v_source_fingerprint:=public.carez_proposal_source_fingerprint(p_estimate_id);
 if p_expected_source_fingerprint is null or v_source_fingerprint is distinct from p_expected_source_fingerprint then raise exception 'Proposal source changed. Reload and review before issuing.' using errcode='40001';end if;
 v_opportunity:=coalesce(nullif(v_estimate.opportunity_number,''),nullif(regexp_replace(v_estimate.estimate_number,'^E-',''),''));
 v_readiness:=public.carez_get_estimate_release_readiness(p_estimate_id);
 if v_readiness->>'release_state' is distinct from 'release_ready' then raise exception 'Complete Estimate Review before issuing this Proposal.';end if;
 select selected_sell_price into v_sell from public.estimate_financial_summary where company_id=v_company and estimate_id=p_estimate_id;
 if v_opportunity is null or p_proposal_number is null or p_proposal_number<>('P-'||v_opportunity||'-R'||v_estimate.version)
  or p_audience is null or p_audience not in ('homeowner','general_contractor','commercial_owner')
  or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '90 days' or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'
  or p_snapshot#>>'{estimate,id}' is distinct from p_estimate_id::text
  or p_snapshot->>'proposal_number' is distinct from p_proposal_number
  or p_snapshot->>'audience_type' is distinct from p_audience
  or (p_snapshot#>>'{pricing,base_sell_price}')::numeric is distinct from v_sell
  or v_sell is null or v_sell<=0 then raise exception 'Proposal identity, audience, expiry and recorded price are required.';end if;
 insert into public.proposal_access_tokens(company_id,estimate_id,proposal_number,expires_at)
 values(v_company,p_estimate_id,p_proposal_number,p_expires_at) returning * into v_token;
 insert into public.proposal_presentations(company_id,estimate_id,proposal_access_token_id,lead_id,proposal_number,audience_type,base_sell_price,source_estimate_updated_at,snapshot,status,response_state,created_by,release_commercial_fingerprint,release_warning_fingerprint,release_acknowledgement_id)
 values(v_company,p_estimate_id,v_token.id,v_estimate.lead_id,p_proposal_number,p_audience,v_sell,v_estimate.updated_at,p_snapshot,'sent','none',auth.uid(),p_commercial_fingerprint,p_warning_fingerprint,p_acknowledgement_id) returning id into v_id;
 if public.carez_proposal_source_fingerprint(p_estimate_id) is distinct from v_source_fingerprint then raise exception 'Proposal source changed during issuance. Reload and review.' using errcode='40001';end if;
 if v_estimate.lead_id is not null then
  update public.leads set status='proposal_sent',follow_up=current_date+2,updated_at=now()
   where company_id=v_company and id=v_estimate.lead_id;
  if not found then raise exception 'Proposal Customer lead update was not confirmed.';end if;
  -- Optional pursuit metadata is part of this same issuance transaction. Never create a default-scored profile.
  update public.lead_bid_intelligence set proposal_sent_at=now(),updated_at=now()
   where company_id=v_company and lead_id=v_estimate.lead_id;
  insert into public.lead_activities(company_id,lead_id,activity_type,note,next_follow_up,created_by)
   values(v_company,v_estimate.lead_id,'proposal',p_proposal_number||' sent / ready to share. Follow up if the customer has not responded.',current_date+2,auth.uid());
 end if;
 return jsonb_build_object('presentation_id',v_id,'token_id',v_token.id,'already_issued',false);
end $$;
revoke all on function public.carez_issue_proposal(uuid,timestamptz,text,text,timestamptz,jsonb,text,text,uuid,text) from public,anon;
grant execute on function public.carez_issue_proposal(uuid,timestamptz,text,text,timestamptz,jsonb,text,text,uuid,text) to authenticated;

notify pgrst,'reload schema';
