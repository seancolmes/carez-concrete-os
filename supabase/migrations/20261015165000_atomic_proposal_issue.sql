-- Bind customer-facing reads to a complete source revision, including wording,
-- contact and sender fields not included in the commercial fingerprint.
create or replace function public.carez_proposal_source_fingerprint(p_estimate_id uuid)
returns text language plpgsql stable security invoker set search_path=public,extensions as $$
declare v_company uuid:=public.get_my_company_id();v_estimate public.estimates%rowtype;v_source jsonb;v_options jsonb;v_bid jsonb;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.';end if;
 select * into v_estimate from public.estimates where company_id=v_company and id=p_estimate_id;
 if not found then raise exception 'Estimate unavailable.';end if;
 if to_regclass('public.bid_value_options') is not null then
  execute 'select jsonb_agg(to_jsonb(r) order by r.id) from public.bid_value_options r where company_id=$1 and estimate_id=$2 and status=''presented''' into v_options using v_company,p_estimate_id;
 end if;
 if to_regclass('public.lead_bid_intelligence') is not null then
  execute 'select to_jsonb(r) from public.lead_bid_intelligence r where company_id=$1 and lead_id=$2' into v_bid using v_company,v_estimate.lead_id;
 end if;
 v_source:=jsonb_build_object(
  'estimate',to_jsonb(v_estimate),
  'financial',(select to_jsonb(r) from public.estimate_financial_summary r where company_id=v_company and estimate_id=p_estimate_id),
  'sections',(select jsonb_agg(to_jsonb(r) order by r.id) from public.estimate_sections r where company_id=v_company and estimate_id=p_estimate_id),
  'items',(select jsonb_agg(to_jsonb(r) order by r.id) from public.estimate_items r where company_id=v_company and estimate_id=p_estimate_id),
  'settings',(select to_jsonb(r) from public.proposal_settings r where company_id=v_company and estimate_id=p_estimate_id),
  'clarifications',(select jsonb_agg(to_jsonb(r) order by r.id) from public.proposal_clarifications r where company_id=v_company and estimate_id=p_estimate_id and published),
  'options',v_options,'bid_profile',v_bid,
  'company',(select to_jsonb(r) from public.companies r where id=v_company),
  'sender',(select to_jsonb(r) from public.company_billing_profiles r where company_id=v_company),
  'lead',(select to_jsonb(r) from public.leads r where company_id=v_company and id=v_estimate.lead_id),
  'customer',(select to_jsonb(c) from public.customers c join public.leads l on l.customer_id=c.id and l.company_id=c.company_id where l.company_id=v_company and l.id=v_estimate.lead_id),
  'project',(select to_jsonb(r) from public.projects r where company_id=v_company and id=v_estimate.project_id)
 );
 return encode(extensions.digest(convert_to(v_source::text,'UTF8'),'sha256'),'hex');
end $$;
revoke all on function public.carez_proposal_source_fingerprint(uuid) from public,anon;
grant execute on function public.carez_proposal_source_fingerprint(uuid) to authenticated;

-- Child edits and issuance acquire the same estimate lock. Check both owners
-- so moving a child cannot detach frozen scope from an issued offer.
create or replace function public.carez_guard_issued_estimate_child()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_old jsonb;v_new jsonb;
begin
 if tg_op<>'INSERT' then v_old:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then v_new:=to_jsonb(new);end if;
 perform 1 from public.estimates e where
  (e.id=(v_old->>'estimate_id')::uuid and e.company_id=(v_old->>'company_id')::uuid)
  or (e.id=(v_new->>'estimate_id')::uuid and e.company_id=(v_new->>'company_id')::uuid)
 order by e.id for update;
 if exists(select 1 from public.proposal_presentations p where
  (p.estimate_id=(v_old->>'estimate_id')::uuid and p.company_id=(v_old->>'company_id')::uuid)
  or (p.estimate_id=(v_new->>'estimate_id')::uuid and p.company_id=(v_new->>'company_id')::uuid)) then
  raise exception 'Issued Estimate scope and Proposal terms are immutable. Create a next revision.';
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.carez_guard_issued_estimate_child() from public,anon,authenticated;

-- One estimate lock and transaction own the public token plus frozen offer.
-- Existing readiness and commercial snapshot triggers remain enabled.
create or replace function public.carez_issue_proposal(
 p_estimate_id uuid,p_expected_updated_at timestamptz,p_proposal_number text,p_audience text,
 p_expires_at timestamptz,p_snapshot jsonb,p_commercial_fingerprint text,
 p_warning_fingerprint text,p_acknowledgement_id uuid,p_expected_source_fingerprint text
) returns jsonb language plpgsql security invoker set search_path=public as $$
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
  insert into public.lead_activities(company_id,lead_id,activity_type,note,next_follow_up,created_by)
   values(v_company,v_estimate.lead_id,'proposal',p_proposal_number||' sent / ready to share. Follow up if the customer has not responded.',current_date+2,auth.uid());
 end if;
 return jsonb_build_object('presentation_id',v_id,'token_id',v_token.id,'already_issued',false);
end $$;
revoke all on function public.carez_issue_proposal(uuid,timestamptz,text,text,timestamptz,jsonb,text,text,uuid,text) from public,anon;
grant execute on function public.carez_issue_proposal(uuid,timestamptz,text,text,timestamptz,jsonb,text,text,uuid,text) to authenticated;
