-- Issue #28: immutable internal resolution of what the customer accepted.
-- This records human commercial decisions without mutating the issued Proposal.

create table public.proposal_acceptance_resolutions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_revision_id uuid not null,
  decision_mode text not null check (decision_mode in ('full','partial','negotiated')),
  scope_resolution jsonb not null default '[]'::jsonb check (jsonb_typeof(scope_resolution) = 'array'),
  alternate_resolution jsonb not null default '[]'::jsonb check (jsonb_typeof(alternate_resolution) = 'array'),
  allowances jsonb not null default '[]'::jsonb check (jsonb_typeof(allowances) = 'array'),
  unit_prices jsonb not null default '[]'::jsonb check (jsonb_typeof(unit_prices) = 'array'),
  inclusions jsonb not null default '[]'::jsonb check (jsonb_typeof(inclusions) = 'array'),
  exclusions jsonb not null default '[]'::jsonb check (jsonb_typeof(exclusions) = 'array'),
  clarifications jsonb not null default '[]'::jsonb check (jsonb_typeof(clarifications) = 'array'),
  terms jsonb not null default '{}'::jsonb check (jsonb_typeof(terms) = 'object'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  effective_direct_cost numeric not null check (effective_direct_cost >= 0),
  effective_sell numeric not null check (effective_sell >= 0),
  source_fingerprint text not null check (length(trim(source_fingerprint)) > 0),
  resolved_by uuid not null references auth.users(id) on delete restrict,
  resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,proposal_revision_id),
  foreign key(company_id,proposal_revision_id) references public.proposal_presentations(company_id,id) on delete restrict
);

create index proposal_acceptance_resolutions_lookup_idx
  on public.proposal_acceptance_resolutions(company_id,proposal_revision_id,resolved_at desc);

create or replace function public.carez_guard_acceptance_resolution()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog,public
as $$
begin
  if tg_op <> 'INSERT' then raise exception 'Acceptance resolution is immutable. Create a new Proposal revision.'; end if;
  return new;
end;
$$;

create trigger proposal_acceptance_resolutions_immutable
before update or delete on public.proposal_acceptance_resolutions
for each row execute function public.carez_guard_acceptance_resolution();

create or replace function public.carez_resolve_proposal_acceptance(
  p_proposal_revision_id uuid,
  p_decision_mode text,
  p_scope_resolution jsonb,
  p_alternate_resolution jsonb default '[]'::jsonb,
  p_allowances jsonb default '[]'::jsonb,
  p_unit_prices jsonb default '[]'::jsonb,
  p_inclusions jsonb default '[]'::jsonb,
  p_exclusions jsonb default '[]'::jsonb,
  p_clarifications jsonb default '[]'::jsonb,
  p_terms jsonb default '{}'::jsonb,
  p_evidence jsonb default '{}'::jsonb,
  p_effective_direct_cost numeric default null,
  p_effective_sell numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog,public,auth,extensions
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_actor uuid := auth.uid();
  v_proposal public.proposal_presentations%rowtype;
  v_item jsonb;
  v_items jsonb;
  v_existing public.proposal_acceptance_resolutions%rowtype;
  v_resolution_id uuid;
  v_fingerprint text;
begin
  if v_actor is null or v_company is null or public.get_my_role() = 'employee' then raise exception 'Owner or office access required.'; end if;
  if p_decision_mode not in ('full','partial','negotiated') then raise exception 'Acceptance decision mode must be full, partial, or negotiated.'; end if;
  if jsonb_typeof(coalesce(p_scope_resolution,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_alternate_resolution,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_allowances,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_unit_prices,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_inclusions,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_exclusions,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_clarifications,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_terms,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_evidence,'{}'::jsonb)) <> 'object' then
    raise exception 'Acceptance resolution facts must use the governed array/object shapes.';
  end if;
  if nullif(trim(coalesce(p_evidence->>'source_reference','')),'') is null then raise exception 'Acceptance evidence reference is required.'; end if;
  if p_effective_direct_cost is null or p_effective_direct_cost < 0 or p_effective_sell is null or p_effective_sell < 0 then raise exception 'Effective Direct Cost and Sell are required and cannot be negative.'; end if;

  select * into v_proposal from public.proposal_presentations where id = p_proposal_revision_id and company_id = v_company for update;
  if not found then raise exception 'Proposal revision not found.'; end if;
  if v_proposal.status not in ('sent','viewed','needs_reply','accepted') or v_proposal.response_state in ('question','change_requested','option_interest','declined') then raise exception 'Proposal revision is not eligible for acceptance resolution.'; end if;
  if v_proposal.internal_commercial_snapshot is null then raise exception 'Issued Proposal is missing frozen internal commercial evidence.'; end if;

  if p_decision_mode = 'partial' and jsonb_array_length(coalesce(p_scope_resolution,'[]'::jsonb)) = 0 then raise exception 'Partial acceptance requires at least one scope resolution.'; end if;
  v_items := coalesce(v_proposal.internal_commercial_snapshot->'items','[]'::jsonb);
  for v_item in select value from jsonb_array_elements(coalesce(p_scope_resolution,'[]'::jsonb)) loop
    if nullif(trim(v_item->>'estimate_item_id'),'') is null then raise exception 'Each scope resolution requires an Estimate item ID.'; end if;
    if jsonb_typeof(v_item->'included') <> 'boolean' then raise exception 'Each scope resolution requires an explicit included decision.'; end if;
    if not exists (select 1 from jsonb_array_elements(v_items) source where source->>'id' = v_item->>'estimate_item_id') then raise exception 'Acceptance resolution references an item outside the issued Proposal snapshot.'; end if;
    if v_item ? 'accepted_quantity' and (jsonb_typeof(v_item->'accepted_quantity') <> 'number' or (v_item->>'accepted_quantity')::numeric < 0) then raise exception 'Accepted quantity must be a nonnegative number.'; end if;
    if v_item ? 'accepted_unit_price' and (jsonb_typeof(v_item->'accepted_unit_price') <> 'number' or (v_item->>'accepted_unit_price')::numeric < 0) then raise exception 'Accepted unit price must be a nonnegative number.'; end if;
  end loop;

  select * into v_existing from public.proposal_acceptance_resolutions where company_id=v_company and proposal_revision_id=p_proposal_revision_id;
  if found then
    return jsonb_build_object('resolution_id',v_existing.id,'proposal_revision_id',p_proposal_revision_id,'already_resolved',true);
  end if;
  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_object('proposal_revision_id',p_proposal_revision_id,'decision_mode',p_decision_mode,'scope_resolution',coalesce(p_scope_resolution,'[]'::jsonb),'alternate_resolution',coalesce(p_alternate_resolution,'[]'::jsonb),'allowances',coalesce(p_allowances,'[]'::jsonb),'unit_prices',coalesce(p_unit_prices,'[]'::jsonb),'inclusions',coalesce(p_inclusions,'[]'::jsonb),'exclusions',coalesce(p_exclusions,'[]'::jsonb),'clarifications',coalesce(p_clarifications,'[]'::jsonb),'terms',coalesce(p_terms,'{}'::jsonb),'evidence',p_evidence,'effective_direct_cost',p_effective_direct_cost,'effective_sell',p_effective_sell)::text,'utf8'),'sha256'),'hex');
  insert into public.proposal_acceptance_resolutions(company_id,proposal_revision_id,decision_mode,scope_resolution,alternate_resolution,allowances,unit_prices,inclusions,exclusions,clarifications,terms,evidence,effective_direct_cost,effective_sell,source_fingerprint,resolved_by)
  values(v_company,p_proposal_revision_id,p_decision_mode,coalesce(p_scope_resolution,'[]'::jsonb),coalesce(p_alternate_resolution,'[]'::jsonb),coalesce(p_allowances,'[]'::jsonb),coalesce(p_unit_prices,'[]'::jsonb),coalesce(p_inclusions,'[]'::jsonb),coalesce(p_exclusions,'[]'::jsonb),coalesce(p_clarifications,'[]'::jsonb),coalesce(p_terms,'{}'::jsonb),p_evidence,p_effective_direct_cost,p_effective_sell,v_fingerprint,v_actor)
  returning id into v_resolution_id;
  return jsonb_build_object('resolution_id',v_resolution_id,'proposal_revision_id',p_proposal_revision_id,'already_resolved',false,'source_fingerprint',v_fingerprint);
end;
$$;

alter table public.proposal_acceptance_resolutions enable row level security;
create policy proposal_acceptance_resolutions_select on public.proposal_acceptance_resolutions
for select to authenticated using (company_id = public.get_my_company_id() and public.get_my_role() <> 'employee');
revoke all on table public.proposal_acceptance_resolutions from public,anon,authenticated;
grant select on table public.proposal_acceptance_resolutions to authenticated;
revoke all on function public.carez_resolve_proposal_acceptance(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,numeric,numeric) from public,anon;
grant execute on function public.carez_resolve_proposal_acceptance(uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,numeric,numeric) to authenticated,service_role;

comment on table public.proposal_acceptance_resolutions is 'Immutable internal resolution of accepted full, partial, or negotiated Proposal scope and commercial facts.';

create or replace function public.carez_get_proposal_acceptance_facts(p_proposal_revision_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog,public
as $$
declare
  v_proposal public.proposal_presentations%rowtype;
  v_resolution public.proposal_acceptance_resolutions%rowtype;
  v_items jsonb;
  v_summary jsonb;
begin
  select * into v_proposal from public.proposal_presentations where id=p_proposal_revision_id and company_id=public.get_my_company_id();
  if not found or v_proposal.internal_commercial_snapshot is null then raise exception 'Issued Proposal commercial evidence is unavailable.'; end if;
  select * into v_resolution from public.proposal_acceptance_resolutions where company_id=public.get_my_company_id() and proposal_revision_id=p_proposal_revision_id;
  if not found then return v_proposal.internal_commercial_snapshot; end if;
  select coalesce(jsonb_agg(
    case
      when selected.item->>'accepted_quantity' is not null
        then jsonb_set(item,'{quantity}',to_jsonb((selected.item->>'accepted_quantity')::numeric),true)
      else item
    end order by item->>'id'
  ),'[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_proposal.internal_commercial_snapshot->'items','[]'::jsonb)) item
  left join lateral (
    select value as item from jsonb_array_elements(v_resolution.scope_resolution) value where value->>'estimate_item_id'=item->>'id' limit 1
  ) selected on true
  where selected.item is null or coalesce((selected.item->>'included')::boolean,true);
  v_summary := jsonb_set(jsonb_set(coalesce(v_proposal.internal_commercial_snapshot->'financial_summary','{}'::jsonb),'{selected_sell_price}',to_jsonb(v_resolution.effective_sell),true),'{total_direct_cost}',to_jsonb(v_resolution.effective_direct_cost),true);
  return jsonb_set(jsonb_set(v_proposal.internal_commercial_snapshot,'{items}',v_items,true),'{financial_summary}',v_summary,true);
end;
$$;

create or replace function public.carez_get_proposal_award_hold(p_proposal_revision_id uuid)
returns text language plpgsql stable security invoker set search_path=public
as $function$
declare v_company uuid; p public.proposal_presentations%rowtype; v_item jsonb; v_resolution public.proposal_acceptance_resolutions%rowtype;
begin
  v_company:=public.get_my_company_id();
  if v_company is null or public.get_my_role()='employee' then return 'Owner or office access is required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company;
  if not found then return 'Issued Proposal revision not found.'; end if;
  if p.status in ('declined','superseded','revoked') then return 'This Proposal revision is declined, superseded, or revoked.'; end if;
  if p.response_state in ('question','change_requested','option_interest','declined') or p.status='needs_reply' then return 'Resolve the customer response by issuing a clean next revision before award.'; end if;
  if p.internal_commercial_snapshot is null or p.internal_commercial_snapshot->>'schema_version' is distinct from '1' then return 'Award held: this historical Proposal has no trustworthy frozen internal cost and production evidence. Create and issue a reviewed next revision before award.'; end if;
  select * into v_resolution from public.proposal_acceptance_resolutions where company_id=v_company and proposal_revision_id=p.id;
  if jsonb_typeof(p.snapshot->'options')='array' and jsonb_array_length(p.snapshot->'options')>0 and not found then return 'Award held: resolve each alternate before award.'; end if;
  if jsonb_typeof(p.internal_commercial_snapshot->'items') is distinct from 'array' or jsonb_array_length(p.internal_commercial_snapshot->'items')=0 then return 'Award held: no frozen Estimate scope items were captured.'; end if;
  if coalesce((p.internal_commercial_snapshot->'financial_summary'->>'selected_sell_price')::numeric,0)<=0 and not found then return 'Award held: required Sell evidence is missing from the frozen Estimate.'; end if;
  for v_item in select value from jsonb_array_elements(p.internal_commercial_snapshot->'items') loop
    if v_item->>'quantity' is null or v_item->>'unit' is null or v_item->>'direct_cost' is null then return 'Award held: an Estimate item is missing quantity, unit, or Direct Cost evidence.'; end if;
    if v_item->>'source_takeoff_output_id' is not null and (v_item->>'production_quantity' is null or v_item->>'production_unit' is null) then return 'Award held: a Takeoff-linked item is missing Production Quantity evidence.'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce(p.internal_commercial_snapshot->'condition_outputs','[]'::jsonb)) x where x->>'status'='held') then return 'Award held: a Concrete Condition output is unresolved.'; end if;
  if exists(select 1 from public.proposal_engagement_events x where x.presentation_id=p.id and x.handled_at is null and x.event_type in ('question','change_request','option_interest','decline')) then return 'Resolve outstanding customer questions or change requests before award.'; end if;
  return null;
end
$function$;

-- Re-run the award transaction against the resolved immutable facts. The
-- existing full-award behavior is unchanged when no resolution record exists.
create or replace function public.carez_award_proposal_and_create_project(
  p_proposal_revision_id uuid, p_effective_at timestamptz default null, p_evidence_reference text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions
as $function$
declare
  v_company uuid; v_actor uuid; p public.proposal_presentations%rowtype; e public.estimates%rowtype;
  v_hold text; v_spine uuid; v_project uuid; v_award uuid; v_snapshot uuid; v_baseline uuid;
  v_facts jsonb; v_summary jsonb; v_item jsonb; v_snapshot_item uuid; v_year integer:=extract(year from now())::integer; v_seq integer;
  v_effective_sell numeric; v_resolution_fingerprint text;
begin
  v_actor:=auth.uid(); v_company:=public.get_my_company_id();
  if v_actor is null or v_company is null or public.get_my_role()='employee' then raise exception 'Owner or office access required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company for update;
  if not found then raise exception 'Issued Proposal revision not found.'; end if;
  if exists(select 1 from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id) then
    select a.id,a.project_id into v_award,v_project from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id;
    select id into v_snapshot from public.accepted_scope_snapshots where company_id=v_company and award_decision_id=v_award;
    select id into v_baseline from public.commercial_baselines where company_id=v_company and award_decision_id=v_award;
    return jsonb_build_object('project_id',v_project,'award_decision_id',v_award,'snapshot_id',v_snapshot,'baseline_id',v_baseline,'already_awarded',true);
  end if;
  v_hold:=public.carez_get_proposal_award_hold(p.id); if v_hold is not null then raise exception using message=v_hold,errcode='P0001'; end if;
  select * into e from public.estimates where id=p.estimate_id and company_id=v_company for update;
  if not found or e.status not in ('ready','accepted','approved') then raise exception 'Award held: source Estimate is not in a released state.'; end if;
  v_facts:=public.carez_get_proposal_acceptance_facts(p.id); v_summary:=v_facts->'financial_summary'; v_effective_sell:=coalesce((v_summary->>'selected_sell_price')::numeric,p.base_sell_price);
  select source_fingerprint into v_resolution_fingerprint from public.proposal_acceptance_resolutions where company_id=v_company and proposal_revision_id=p.id;
  v_spine:=coalesce(p.job_spine_id,e.job_spine_id);
  if v_spine is null then
    insert into public.job_spines(company_id,name,created_by,updated_by) values(v_company,coalesce(nullif(trim(e.name),''),'Job'),v_actor,v_actor) returning id into v_spine;
    if e.lead_id is not null then update public.leads set job_spine_id=v_spine,updated_at=now() where id=e.lead_id and company_id=v_company and job_spine_id is null; end if;
    update public.estimates set job_spine_id=v_spine where id=e.id and company_id=v_company and job_spine_id is null;
    update public.proposal_presentations set job_spine_id=v_spine where id=p.id and company_id=v_company and job_spine_id is null;
  end if;
  v_project:=e.project_id;
  if v_project is not null then
    if not exists(select 1 from public.projects pr where pr.id=v_project and pr.company_id=v_company and pr.job_spine_id=v_spine and (pr.source_estimate_id is null or pr.source_estimate_id=e.id) and pr.award_decision_id is null) then raise exception 'Award held: linked Project has conflicting source or Award lineage.'; end if;
  else
    insert into public.job_number_sequences(company_id,sequence_year,next_number) values(v_company,v_year,2) on conflict(company_id,sequence_year) do update set next_number=public.job_number_sequences.next_number+1 returning next_number-1 into v_seq;
    insert into public.projects(company_id,customer_id,job_number,name,address,city,state,status,contract_value,source_estimate_id,job_spine_id)
    values(v_company,(select l.customer_id from public.leads l where l.id=e.lead_id and l.company_id=v_company),'JOB-'||v_year::text||'-'||lpad(v_seq::text,4,'0'),coalesce(nullif(p.snapshot#>>'{lead,project_name}',''),e.name),p.snapshot#>>'{lead,address}',p.snapshot#>>'{lead,city}',coalesce(nullif(p.snapshot#>>'{lead,state}',''),'WA'),'active',v_effective_sell,e.id,v_spine) returning id into v_project;
  end if;
  update public.projects set job_spine_id=v_spine,source_estimate_id=coalesce(source_estimate_id,e.id),contract_value=v_effective_sell where id=v_project and company_id=v_company;
  insert into public.award_decisions(company_id,job_spine_id,proposal_revision_id,estimate_id,project_id,authorized_actor_id,decided_at,effective_at,evidence_reference) values(v_company,v_spine,p.id,e.id,v_project,v_actor,now(),coalesce(p_effective_at,now()),nullif(trim(p_evidence_reference),'')) returning id into v_award;
  insert into public.accepted_scope_snapshots(company_id,job_spine_id,award_decision_id,proposal_revision_id,estimate_id,source_fingerprint,source_schema_version,accepted_facts)
  values(v_company,v_spine,v_award,p.id,e.id,coalesce(v_resolution_fingerprint,p.release_commercial_fingerprint),1,jsonb_build_object('proposal_revision_id',p.id,'estimate_id',e.id,'proposal',v_facts->'proposal','estimate',v_facts->'estimate','sections',v_facts->'sections','items',v_facts->'items','takeoff_sets',v_facts->'takeoff_sets','takeoff_sheets',v_facts->'takeoff_sheets','measurements',v_facts->'measurements','measurement_outputs',v_facts->'measurement_outputs','conditions',v_facts->'conditions','condition_versions',v_facts->'condition_versions','condition_modules',v_facts->'condition_modules','condition_roles',v_facts->'condition_roles','condition_outputs',v_facts->'condition_outputs','financial_summary',v_summary)) returning id into v_snapshot;
  for v_item in select value from jsonb_array_elements(v_facts->'items') loop
    insert into public.accepted_scope_snapshot_items(company_id,snapshot_id,source_estimate_item_id,source_takeoff_output_id,source_takeoff_measurement_id,item_facts,production_quantity,production_unit,direct_cost)
    values(v_company,v_snapshot,(v_item->>'id')::uuid,nullif(v_item->>'source_takeoff_output_id','')::uuid,nullif(v_item->>'source_takeoff_measurement_id','')::uuid,v_item,nullif(v_item->>'production_quantity','')::numeric,v_item->>'production_unit',(v_item->>'direct_cost')::numeric) returning id into v_snapshot_item;
  end loop;
  insert into public.commercial_baselines(company_id,job_spine_id,project_id,award_decision_id,accepted_scope_snapshot_id,proposal_revision_id,estimate_id,total_direct_cost,total_sell,financial_facts,provenance)
  values(v_company,v_spine,v_project,v_award,v_snapshot,p.id,e.id,(v_summary->>'total_direct_cost')::numeric,v_effective_sell,v_summary,jsonb_build_object('source','accepted_scope_snapshot','snapshot_id',v_snapshot,'proposal_revision_id',p.id,'estimate_id',e.id,'release_fingerprint',coalesce(v_resolution_fingerprint,p.release_commercial_fingerprint))) returning id into v_baseline;
  insert into public.commercial_baseline_items(company_id,baseline_id,snapshot_item_id,quantity,unit,production_quantity,production_unit,direct_cost,sell_amount,source_facts)
  select v_company,v_baseline,si.id,(si.item_facts->>'quantity')::numeric,si.item_facts->>'unit',si.production_quantity,si.production_unit,si.direct_cost,null,si.item_facts from public.accepted_scope_snapshot_items si where si.company_id=v_company and si.snapshot_id=v_snapshot;
  update public.projects set award_decision_id=v_award where id=v_project and company_id=v_company;
  update public.estimates set status='accepted',approved_at=coalesce(approved_at,now()),project_id=v_project,job_spine_id=v_spine,updated_at=now() where id=e.id and company_id=v_company;
  if e.lead_id is not null then update public.leads set status='won',updated_at=now() where id=e.lead_id and company_id=v_company; end if;
  return jsonb_build_object('project_id',v_project,'award_decision_id',v_award,'snapshot_id',v_snapshot,'baseline_id',v_baseline,'already_awarded',false);
end
$function$;

revoke all on function public.carez_get_proposal_acceptance_facts(uuid) from public,anon;
grant execute on function public.carez_get_proposal_acceptance_facts(uuid) to authenticated,service_role;
revoke all on function public.carez_get_proposal_award_hold(uuid) from public,anon;
grant execute on function public.carez_get_proposal_award_hold(uuid) to authenticated;
revoke all on function public.carez_award_proposal_and_create_project(uuid,timestamptz,text) from public,anon;
grant execute on function public.carez_award_proposal_and_create_project(uuid,timestamptz,text) to authenticated;
