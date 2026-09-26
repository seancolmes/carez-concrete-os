-- Canonical V1 handoff. Legacy issued rows without internal evidence remain held.
create table public.job_spines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, review_state text not null default 'clear' check(review_state in ('clear','review_required')),
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,id)
);
create table public.job_spine_migration_reviews (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  job_spine_id uuid not null, phase_type text not null check(phase_type in ('opportunity','estimate','proposal','project')),
  phase_id uuid not null, reason text not null, created_at timestamptz not null default now(), resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null, unique(company_id,phase_type,phase_id),
  foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete cascade
);
alter table public.leads add column job_spine_id uuid;
alter table public.estimates add column job_spine_id uuid;
alter table public.estimates add column parent_proposal_revision_id uuid;
alter table public.proposal_presentations add column job_spine_id uuid;
alter table public.proposal_presentations add column parent_revision_id uuid;
alter table public.proposal_presentations add column internal_commercial_snapshot jsonb;
alter table public.projects add column job_spine_id uuid;
alter table public.projects add column award_decision_id uuid;
create unique index leads_company_id_key on public.leads(company_id,id);
create unique index estimates_company_id_key on public.estimates(company_id,id);
create unique index proposal_presentations_company_id_key on public.proposal_presentations(company_id,id);
create unique index projects_company_id_key on public.projects(company_id,id);
alter table public.leads add constraint leads_job_spine_fk foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict;
alter table public.estimates add constraint estimates_job_spine_fk foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict;
alter table public.proposal_presentations add constraint proposal_presentations_job_spine_fk foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict;
alter table public.projects add constraint projects_job_spine_fk foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict;
alter table public.estimates add constraint estimates_parent_proposal_fk foreign key(parent_proposal_revision_id) references public.proposal_presentations(id) on delete restrict;
alter table public.proposal_presentations add constraint proposals_parent_revision_fk foreign key(parent_revision_id) references public.proposal_presentations(id) on delete restrict;
create unique index estimates_parent_proposal_revision_key on public.estimates(parent_proposal_revision_id) where parent_proposal_revision_id is not null;

-- One spine per known Opportunity. Orphan phases get their own identity and a review record.
do $backfill$
declare r record; v_spine uuid;
begin
  for r in select * from public.leads where job_spine_id is null order by created_at,id loop
    insert into public.job_spines(company_id,name) values(r.company_id,coalesce(nullif(trim(r.project_name),''),r.customer_name)) returning id into v_spine;
    update public.leads set job_spine_id=v_spine where id=r.id;
  end loop;
  for r in select * from public.estimates where job_spine_id is null order by created_at,id loop
    v_spine:=null;
    if r.lead_id is not null then select job_spine_id into v_spine from public.leads where id=r.lead_id and company_id=r.company_id; end if;
    if v_spine is null then
      insert into public.job_spines(company_id,name,review_state,created_by) values(r.company_id,coalesce(nullif(trim(r.name),''),'Estimate'),'review_required',r.created_by) returning id into v_spine;
      insert into public.job_spine_migration_reviews(company_id,job_spine_id,phase_type,phase_id,reason)
      values(r.company_id,v_spine,'estimate',r.id,'No trustworthy Opportunity relationship existed during backfill.');
    end if;
    update public.estimates set job_spine_id=v_spine where id=r.id;
  end loop;
  for r in select * from public.projects where job_spine_id is null order by created_at,id loop
    v_spine:=null;
    if r.source_estimate_id is not null then select job_spine_id into v_spine from public.estimates where id=r.source_estimate_id and company_id=r.company_id; end if;
    if v_spine is null then
      select min(job_spine_id) into v_spine from public.estimates where project_id=r.id and company_id=r.company_id having count(distinct job_spine_id)=1;
    end if;
    if v_spine is null then
      insert into public.job_spines(company_id,name,review_state) values(r.company_id,coalesce(nullif(trim(r.name),''),'Project'),'review_required') returning id into v_spine;
      insert into public.job_spine_migration_reviews(company_id,job_spine_id,phase_type,phase_id,reason)
      values(r.company_id,v_spine,'project',r.id,'No unambiguous source Estimate relationship existed during backfill.');
    end if;
    update public.projects set job_spine_id=v_spine where id=r.id;
  end loop;
  update public.proposal_presentations p set job_spine_id=e.job_spine_id from public.estimates e
  where e.id=p.estimate_id and e.company_id=p.company_id;
end
$backfill$;

-- This separate frozen object captures internal evidence at release time. Historical rows stay NULL.
create or replace function public.carez_capture_proposal_commercial_snapshot()
returns trigger language plpgsql security invoker set search_path=public,extensions
as $function$
declare v_estimate jsonb; v_summary jsonb;
begin
  select to_jsonb(e) into v_estimate from public.estimates e where e.id=new.estimate_id and e.company_id=new.company_id;
  if v_estimate is null then raise exception 'Proposal Estimate source is missing.'; end if;
  select to_jsonb(s) into v_summary from public.estimate_financial_summary s where s.estimate_id=new.estimate_id and s.company_id=new.company_id;
  if v_summary is null then raise exception 'Financial summary is required to freeze internal commercial evidence.'; end if;
  if coalesce((v_summary->>'selected_sell_price')::numeric,0)<>new.base_sell_price
     or coalesce((new.snapshot#>>'{pricing,base_sell_price}')::numeric,new.base_sell_price)<>new.base_sell_price then
    raise exception 'Issued Sell does not match the frozen Estimate commercial summary.';
  end if;
  new.job_spine_id:=(v_estimate->>'job_spine_id')::uuid;
  new.parent_revision_id:=(v_estimate->>'parent_proposal_revision_id')::uuid;
  new.internal_commercial_snapshot:=jsonb_build_object(
    'schema_version',1,'captured_at',clock_timestamp(),'estimate',v_estimate,'financial_summary',v_summary,
    'sections',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.id) from public.estimate_sections s where s.company_id=new.company_id and s.estimate_id=new.estimate_id),'[]'),
    'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order,i.id) from public.estimate_items i where i.company_id=new.company_id and i.estimate_id=new.estimate_id),'[]'),
    'takeoff_sets',coalesce((select jsonb_agg(to_jsonb(ts) order by ts.id) from public.takeoff_sets ts where ts.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'takeoff_sheets',coalesce((select jsonb_agg(to_jsonb(sh) order by sh.takeoff_set_id,sh.sort_order,sh.id) from public.takeoff_sheets sh join public.takeoff_sets ts on ts.id=sh.takeoff_set_id where ts.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'measurements',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.takeoff_measurements m where m.company_id=new.company_id and m.estimate_id=new.estimate_id),'[]'),
    'measurement_outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from public.takeoff_measurement_outputs o join public.takeoff_measurements m on m.id=o.measurement_id where m.company_id=new.company_id and m.estimate_id=new.estimate_id),'[]'),
    'conditions',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.project_concrete_conditions c join public.takeoff_sets ts on ts.id=c.takeoff_set_id where c.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.condition_id,v.revision_no) from public.project_concrete_condition_versions v join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where v.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_modules',coalesce((select jsonb_agg(to_jsonb(m) order by m.condition_version_id,m.sort_order,m.id) from public.project_condition_module_instances m join public.project_concrete_condition_versions v on v.id=m.condition_version_id join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where m.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_roles',coalesce((select jsonb_agg(to_jsonb(r) order by r.condition_version_id,r.sort_order,r.id) from public.project_condition_measurement_roles r join public.project_concrete_condition_versions v on v.id=r.condition_version_id join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where r.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'condition_outputs',coalesce((select jsonb_agg(to_jsonb(o) order by o.condition_version_id,o.output_key,o.output_instance_key) from public.project_condition_outputs o join public.project_concrete_condition_versions v on v.id=o.condition_version_id join public.project_concrete_conditions c on c.id=v.condition_id join public.takeoff_sets ts on ts.id=c.takeoff_set_id where o.company_id=new.company_id and ts.estimate_id=new.estimate_id),'[]'),
    'proposal',new.snapshot);
  return new;
end
$function$;
create trigger capture_proposal_commercial_snapshot before insert on public.proposal_presentations
for each row execute function public.carez_capture_proposal_commercial_snapshot();
create or replace function public.carez_protect_proposal_commercial_snapshot()
returns trigger language plpgsql set search_path=public
as $function$
begin
  if new.internal_commercial_snapshot is distinct from old.internal_commercial_snapshot
     or (old.job_spine_id is not null and new.job_spine_id is distinct from old.job_spine_id)
     or (old.parent_revision_id is not null and new.parent_revision_id is distinct from old.parent_revision_id) then
    raise exception 'Issued Proposal commercial evidence and lineage are immutable.';
  end if;
  return new;
end
$function$;
create trigger protect_proposal_commercial_snapshot before update on public.proposal_presentations
for each row execute function public.carez_protect_proposal_commercial_snapshot();

create table public.award_decisions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  job_spine_id uuid not null, proposal_revision_id uuid not null, estimate_id uuid not null, project_id uuid not null,
  award_type text not null default 'full_exact_revision' check(award_type='full_exact_revision'),
  decision_version integer not null default 1 check(decision_version>0),
  award_status text not null default 'awarded' check(award_status='awarded'),
  authorized_actor_id uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(), effective_at timestamptz not null default now(), evidence_reference text,
  created_at timestamptz not null default now(), unique(company_id,id), unique(company_id,proposal_revision_id),
  foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict,
  foreign key(company_id,proposal_revision_id) references public.proposal_presentations(company_id,id) on delete restrict,
  foreign key(company_id,estimate_id) references public.estimates(company_id,id) on delete restrict,
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict
);
alter table public.projects add constraint projects_award_decision_fk
  foreign key(company_id,award_decision_id) references public.award_decisions(company_id,id) on delete restrict;
create unique index projects_award_decision_key on public.projects(company_id,award_decision_id) where award_decision_id is not null;

create table public.accepted_scope_snapshots (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  job_spine_id uuid not null, award_decision_id uuid not null, proposal_revision_id uuid not null, estimate_id uuid not null,
  source_fingerprint text not null, source_schema_version integer not null check(source_schema_version=1),
  accepted_facts jsonb not null check(jsonb_typeof(accepted_facts)='object'), created_at timestamptz not null default now(),
  unique(company_id,id), unique(company_id,award_decision_id),
  foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict,
  foreign key(company_id,award_decision_id) references public.award_decisions(company_id,id) on delete restrict,
  foreign key(company_id,proposal_revision_id) references public.proposal_presentations(company_id,id) on delete restrict,
  foreign key(company_id,estimate_id) references public.estimates(company_id,id) on delete restrict
);
create table public.accepted_scope_snapshot_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  snapshot_id uuid not null, source_estimate_item_id uuid not null, source_takeoff_output_id uuid,
  source_takeoff_measurement_id uuid, item_facts jsonb not null check(jsonb_typeof(item_facts)='object'),
  production_quantity numeric, production_unit text, direct_cost numeric not null, sell_amount numeric,
  created_at timestamptz not null default now(), unique(company_id,id), unique(company_id,snapshot_id,source_estimate_item_id),
  foreign key(company_id,snapshot_id) references public.accepted_scope_snapshots(company_id,id) on delete restrict,
  foreign key(source_estimate_item_id) references public.estimate_items(id) on delete restrict
);
create table public.commercial_baselines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  job_spine_id uuid not null, project_id uuid not null, award_decision_id uuid not null, accepted_scope_snapshot_id uuid not null,
  proposal_revision_id uuid not null, estimate_id uuid not null,
  baseline_kind text not null default 'original_award' check(baseline_kind='original_award'),
  total_direct_cost numeric not null, total_sell numeric not null,
  financial_facts jsonb not null check(jsonb_typeof(financial_facts)='object'),
  provenance jsonb not null check(jsonb_typeof(provenance)='object'), created_at timestamptz not null default now(),
  unique(company_id,id), unique(company_id,project_id,baseline_kind), unique(company_id,award_decision_id),
  foreign key(company_id,job_spine_id) references public.job_spines(company_id,id) on delete restrict,
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,award_decision_id) references public.award_decisions(company_id,id) on delete restrict,
  foreign key(company_id,accepted_scope_snapshot_id) references public.accepted_scope_snapshots(company_id,id) on delete restrict,
  foreign key(company_id,proposal_revision_id) references public.proposal_presentations(company_id,id) on delete restrict,
  foreign key(company_id,estimate_id) references public.estimates(company_id,id) on delete restrict
);
create table public.commercial_baseline_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  baseline_id uuid not null, snapshot_item_id uuid not null, quantity numeric not null, unit text not null,
  production_quantity numeric, production_unit text, direct_cost numeric not null, sell_amount numeric,
  source_facts jsonb not null check(jsonb_typeof(source_facts)='object'), created_at timestamptz not null default now(),
  unique(company_id,baseline_id,snapshot_item_id),
  foreign key(company_id,baseline_id) references public.commercial_baselines(company_id,id) on delete restrict,
  foreign key(company_id,snapshot_item_id) references public.accepted_scope_snapshot_items(company_id,id) on delete restrict
);
create table public.job_number_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  sequence_year integer not null, next_number integer not null default 1 check(next_number>0), primary key(company_id,sequence_year)
);

-- Application checks are backed by database guards so direct Data API writes cannot
-- change an issued Estimate source or remove its immutable Proposal history.
create or replace function public.carez_guard_issued_estimate()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public
as $function$
declare v_estimate_id uuid; v_company_id uuid; v_proposal_id uuid; v_payload jsonb;
begin
  if tg_op='DELETE' then
    v_estimate_id:=old.id; v_company_id:=old.company_id;
  else
    v_estimate_id:=new.id; v_company_id:=new.company_id;
  end if;
  select p.id into v_proposal_id from public.proposal_presentations p
  where p.company_id=v_company_id and p.estimate_id=v_estimate_id limit 1;
  if v_proposal_id is null then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op='DELETE' then raise exception 'Issued Estimate history cannot be deleted.'; end if;
  if (to_jsonb(new)-'status'-'approved_at'-'project_id'-'updated_at') is distinct from
     (to_jsonb(old)-'status'-'approved_at'-'project_id'-'updated_at') then
    raise exception 'Issued Estimate commercial facts are immutable. Create a next revision.';
  end if;
  if new.status is distinct from old.status and not exists(
    select 1 from public.award_decisions a where a.company_id=v_company_id and a.proposal_revision_id=v_proposal_id
      and a.estimate_id=v_estimate_id and a.project_id=new.project_id
  ) then raise exception 'Issued Estimate stage can change only through its Award Decision.'; end if;
  if new.project_id is distinct from old.project_id and not exists(
    select 1 from public.award_decisions a where a.company_id=v_company_id and a.proposal_revision_id=v_proposal_id
      and a.estimate_id=v_estimate_id and a.project_id=new.project_id
  ) then raise exception 'Issued Estimate Project linkage can change only through its Award Decision.'; end if;
  if new.approved_at is distinct from old.approved_at and not exists(
    select 1 from public.award_decisions a where a.company_id=v_company_id and a.proposal_revision_id=v_proposal_id and a.estimate_id=v_estimate_id
  ) then raise exception 'Issued Estimate approval can change only through its Award Decision.'; end if;
  return new;
end
$function$;
create trigger guard_issued_estimate before update or delete on public.estimates
for each row execute function public.carez_guard_issued_estimate();

create or replace function public.carez_guard_issued_estimate_child()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public
as $function$
declare v_payload jsonb; v_company_id uuid; v_estimate_id uuid;
begin
  v_payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_company_id:=(v_payload->>'company_id')::uuid; v_estimate_id:=(v_payload->>'estimate_id')::uuid;
  if exists(select 1 from public.proposal_presentations p where p.company_id=v_company_id and p.estimate_id=v_estimate_id) then
    raise exception 'Issued Estimate scope and Proposal terms are immutable. Create a next revision.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$function$;
create trigger guard_issued_estimate_sections before insert or update or delete on public.estimate_sections
for each row execute function public.carez_guard_issued_estimate_child();
create trigger guard_issued_estimate_items before insert or update or delete on public.estimate_items
for each row execute function public.carez_guard_issued_estimate_child();
create trigger guard_issued_proposal_settings before insert or update or delete on public.proposal_settings
for each row execute function public.carez_guard_issued_estimate_child();
create trigger guard_issued_proposal_clarifications before insert or update or delete on public.proposal_clarifications
for each row execute function public.carez_guard_issued_estimate_child();
create trigger guard_issued_proposal_options before insert or update or delete on public.bid_value_options
for each row execute function public.carez_guard_issued_estimate_child();

create or replace function public.carez_protect_issued_proposal_delete()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public
as $function$ begin raise exception 'Issued Proposal history cannot be deleted.'; end $function$;
create trigger protect_issued_proposal_delete before delete on public.proposal_presentations
for each row execute function public.carez_protect_issued_proposal_delete();

create or replace function public.carez_assign_phase_job_spine()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,auth
as $function$
declare v_spine uuid; v_lead_spine uuid; v_project_spine uuid; v_name text;
begin
  if new.job_spine_id is not null then
    if not exists(select 1 from public.job_spines s where s.id=new.job_spine_id and s.company_id=new.company_id) then raise exception 'Job Spine must belong to the phase company.'; end if;
    return new;
  end if;
  if tg_table_name='estimates' then
    if new.lead_id is not null then select job_spine_id into v_lead_spine from public.leads where id=new.lead_id and company_id=new.company_id; end if;
    if new.project_id is not null then select job_spine_id into v_project_spine from public.projects where id=new.project_id and company_id=new.company_id; end if;
    if v_lead_spine is not null and v_project_spine is not null and v_lead_spine<>v_project_spine then raise exception 'Estimate Opportunity and Project have conflicting Job Spine identities.'; end if;
    v_spine:=coalesce(v_lead_spine,v_project_spine);
  elsif tg_table_name='projects' then
    if new.source_estimate_id is not null then
      select job_spine_id into v_spine from public.estimates where id=new.source_estimate_id and company_id=new.company_id;
    end if;
  end if;
  if v_spine is null then
    if tg_table_name='leads' then v_name:=new.project_name; else v_name:=new.name; end if;
    insert into public.job_spines(company_id,name,created_by,updated_by)
    values(new.company_id,coalesce(nullif(trim(v_name),''),'Job'),auth.uid(),auth.uid()) returning id into v_spine;
  end if;
  new.job_spine_id:=v_spine;
  return new;
end
$function$;
create trigger leads_assign_job_spine before insert on public.leads for each row execute function public.carez_assign_phase_job_spine();
create trigger estimates_assign_job_spine before insert on public.estimates for each row execute function public.carez_assign_phase_job_spine();
create trigger projects_assign_job_spine before insert on public.projects for each row execute function public.carez_assign_phase_job_spine();
create trigger job_spines_updated_at before update on public.job_spines for each row execute function public.set_updated_at();
alter table public.leads alter column job_spine_id set not null;
alter table public.estimates alter column job_spine_id set not null;
alter table public.proposal_presentations alter column job_spine_id set not null;
alter table public.projects alter column job_spine_id set not null;

alter table public.estimate_items add column revision_source_estimate_item_id uuid references public.estimate_items(id) on delete restrict;
alter table public.estimate_items add column revision_source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete restrict;
alter table public.estimate_items add column revision_source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete restrict;
create unique index estimate_items_company_id_key on public.estimate_items(company_id,id);

create or replace function public.carez_immutable_commercial_record()
returns trigger language plpgsql set search_path=public
as $function$ begin raise exception '% records are immutable.',tg_table_name; end $function$;
create trigger award_decisions_immutable before update or delete on public.award_decisions for each row execute function public.carez_immutable_commercial_record();
create trigger accepted_scope_snapshots_immutable before update or delete on public.accepted_scope_snapshots for each row execute function public.carez_immutable_commercial_record();
create trigger accepted_scope_snapshot_items_immutable before update or delete on public.accepted_scope_snapshot_items for each row execute function public.carez_immutable_commercial_record();
create trigger commercial_baselines_immutable before update or delete on public.commercial_baselines for each row execute function public.carez_immutable_commercial_record();
create trigger commercial_baseline_items_immutable before update or delete on public.commercial_baseline_items for each row execute function public.carez_immutable_commercial_record();

create or replace function public.carez_get_proposal_award_hold(p_proposal_revision_id uuid)
returns text language plpgsql stable security invoker set search_path=public
as $function$
declare v_company uuid; p public.proposal_presentations%rowtype; v_item jsonb;
begin
  v_company:=public.get_my_company_id();
  if v_company is null or public.get_my_role()='employee' then return 'Owner or office access is required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company;
  if not found then return 'Issued Proposal revision not found.'; end if;
  if p.status in ('declined','superseded','revoked') then return 'This Proposal revision is declined, superseded, or revoked.'; end if;
  if p.response_state in ('question','change_requested','option_interest','declined') or p.status='needs_reply' then return 'Resolve the customer response by issuing a clean next revision before award.'; end if;
  if p.internal_commercial_snapshot is null or p.internal_commercial_snapshot->>'schema_version' is distinct from '1' then return 'Award held: this historical Proposal has no trustworthy frozen internal cost and production evidence. Create and issue a reviewed next revision before award.'; end if;
  if jsonb_typeof(p.snapshot->'options')='array' and jsonb_array_length(p.snapshot->'options')>0 then return 'Award held: this Proposal includes alternates. Issue a revision that records the accepted scope without unresolved selections.'; end if;
  if jsonb_typeof(p.internal_commercial_snapshot->'items') is distinct from 'array' or jsonb_array_length(p.internal_commercial_snapshot->'items')=0 then return 'Award held: no frozen Estimate scope items were captured.'; end if;
  if coalesce((p.internal_commercial_snapshot->'financial_summary'->>'selected_sell_price')::numeric,0)<=0 or p.internal_commercial_snapshot->'financial_summary'->>'total_direct_cost' is null then return 'Award held: required Sell or Direct Cost evidence is missing from the frozen Estimate.'; end if;
  for v_item in select value from jsonb_array_elements(p.internal_commercial_snapshot->'items') loop
    if v_item->>'quantity' is null or v_item->>'unit' is null or v_item->>'direct_cost' is null then return 'Award held: an Estimate item is missing quantity, unit, or Direct Cost evidence.'; end if;
    if v_item->>'source_takeoff_output_id' is not null and (v_item->>'production_quantity' is null or v_item->>'production_unit' is null) then return 'Award held: a Takeoff-linked item is missing Production Quantity evidence.'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce(p.internal_commercial_snapshot->'condition_outputs','[]'::jsonb)) x where x->>'status'='held') then return 'Award held: a Concrete Condition output is unresolved.'; end if;
  if exists(select 1 from public.proposal_engagement_events x where x.presentation_id=p.id and x.handled_at is null and x.event_type in ('question','change_request','option_interest','decline')) then return 'Resolve outstanding customer questions or change requests before award.'; end if;
  return null;
end
$function$;

create or replace function public.carez_award_proposal_and_create_project(
  p_proposal_revision_id uuid, p_effective_at timestamptz default null, p_evidence_reference text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions
as $function$
declare
  v_company uuid; v_actor uuid; p public.proposal_presentations%rowtype; e public.estimates%rowtype;
  v_hold text; v_spine uuid; v_project uuid; v_award uuid; v_snapshot uuid; v_baseline uuid;
  v_facts jsonb; v_summary jsonb; v_item jsonb; v_snapshot_item uuid; v_year integer:=extract(year from now())::integer; v_seq integer;
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
  v_hold:=public.carez_get_proposal_award_hold(p.id);
  if v_hold is not null then raise exception using message=v_hold,errcode='P0001'; end if;
  select * into e from public.estimates where id=p.estimate_id and company_id=v_company for update;
  if not found or e.status not in ('ready','accepted','approved') then raise exception 'Award held: source Estimate is not in a released state.'; end if;
  v_spine:=coalesce(p.job_spine_id,e.job_spine_id);
  if v_spine is null then
    insert into public.job_spines(company_id,name,created_by,updated_by) values(v_company,coalesce(nullif(trim(e.name),''),'Job'),v_actor,v_actor) returning id into v_spine;
    if e.lead_id is not null then update public.leads set job_spine_id=v_spine,updated_at=now() where id=e.lead_id and company_id=v_company and job_spine_id is null; end if;
    update public.estimates set job_spine_id=v_spine where id=e.id and company_id=v_company and job_spine_id is null;
    update public.proposal_presentations set job_spine_id=v_spine where id=p.id and company_id=v_company and job_spine_id is null;
  end if;
  v_project:=e.project_id;
  if v_project is not null then
    if not exists(select 1 from public.projects pr where pr.id=v_project and pr.company_id=v_company and pr.job_spine_id=v_spine and (pr.source_estimate_id is null or pr.source_estimate_id=e.id) and pr.award_decision_id is null) then
      raise exception 'Award held: linked Project has conflicting source or Award lineage.';
    end if;
  else
    insert into public.job_number_sequences(company_id,sequence_year,next_number) values(v_company,v_year,2)
    on conflict(company_id,sequence_year) do update set next_number=public.job_number_sequences.next_number+1 returning next_number-1 into v_seq;
    insert into public.projects(company_id,customer_id,job_number,name,address,city,state,status,contract_value,source_estimate_id,job_spine_id)
    values(v_company,(select l.customer_id from public.leads l where l.id=e.lead_id and l.company_id=v_company),
      'JOB-'||v_year::text||'-'||lpad(v_seq::text,4,'0'),coalesce(nullif(p.snapshot#>>'{lead,project_name}',''),e.name),
      p.snapshot#>>'{lead,address}',p.snapshot#>>'{lead,city}',coalesce(nullif(p.snapshot#>>'{lead,state}',''),'WA'),
      'active',p.base_sell_price,e.id,v_spine) returning id into v_project;
  end if;
  update public.projects set job_spine_id=v_spine,source_estimate_id=coalesce(source_estimate_id,e.id),contract_value=p.base_sell_price
    where id=v_project and company_id=v_company;
  insert into public.award_decisions(company_id,job_spine_id,proposal_revision_id,estimate_id,project_id,authorized_actor_id,decided_at,effective_at,evidence_reference)
  values(v_company,v_spine,p.id,e.id,v_project,v_actor,now(),coalesce(p_effective_at,now()),nullif(trim(p_evidence_reference),'')) returning id into v_award;
  v_facts:=p.internal_commercial_snapshot; v_summary:=v_facts->'financial_summary';
  insert into public.accepted_scope_snapshots(company_id,job_spine_id,award_decision_id,proposal_revision_id,estimate_id,source_fingerprint,source_schema_version,accepted_facts)
  values(v_company,v_spine,v_award,p.id,e.id,p.release_commercial_fingerprint,1,
    jsonb_build_object('proposal_revision_id',p.id,'estimate_id',e.id,'proposal',v_facts->'proposal','estimate',v_facts->'estimate',
      'sections',v_facts->'sections','items',v_facts->'items','takeoff_sets',v_facts->'takeoff_sets','takeoff_sheets',v_facts->'takeoff_sheets',
      'measurements',v_facts->'measurements','measurement_outputs',v_facts->'measurement_outputs','conditions',v_facts->'conditions',
      'condition_versions',v_facts->'condition_versions','condition_modules',v_facts->'condition_modules','condition_roles',v_facts->'condition_roles',
      'condition_outputs',v_facts->'condition_outputs','financial_summary',v_summary)) returning id into v_snapshot;
  for v_item in select value from jsonb_array_elements(v_facts->'items') loop
    insert into public.accepted_scope_snapshot_items(company_id,snapshot_id,source_estimate_item_id,source_takeoff_output_id,source_takeoff_measurement_id,item_facts,production_quantity,production_unit,direct_cost)
    values(v_company,v_snapshot,(v_item->>'id')::uuid,nullif(v_item->>'source_takeoff_output_id','')::uuid,
      nullif(v_item->>'source_takeoff_measurement_id','')::uuid,v_item,nullif(v_item->>'production_quantity','')::numeric,
      v_item->>'production_unit',(v_item->>'direct_cost')::numeric) returning id into v_snapshot_item;
  end loop;
  insert into public.commercial_baselines(company_id,job_spine_id,project_id,award_decision_id,accepted_scope_snapshot_id,proposal_revision_id,estimate_id,total_direct_cost,total_sell,financial_facts,provenance)
  values(v_company,v_spine,v_project,v_award,v_snapshot,p.id,e.id,(v_summary->>'total_direct_cost')::numeric,p.base_sell_price,v_summary,
    jsonb_build_object('source','accepted_scope_snapshot','snapshot_id',v_snapshot,'proposal_revision_id',p.id,'estimate_id',e.id,
      'release_fingerprint',p.release_commercial_fingerprint)) returning id into v_baseline;
  insert into public.commercial_baseline_items(company_id,baseline_id,snapshot_item_id,quantity,unit,production_quantity,production_unit,direct_cost,sell_amount,source_facts)
  select v_company,v_baseline,si.id,(si.item_facts->>'quantity')::numeric,si.item_facts->>'unit',si.production_quantity,si.production_unit,si.direct_cost,null,si.item_facts
  from public.accepted_scope_snapshot_items si where si.company_id=v_company and si.snapshot_id=v_snapshot;
  update public.projects set award_decision_id=v_award where id=v_project and company_id=v_company;
  update public.estimates set status='accepted',approved_at=coalesce(approved_at,now()),project_id=v_project,job_spine_id=v_spine,updated_at=now() where id=e.id and company_id=v_company;
  if e.lead_id is not null then update public.leads set status='won',updated_at=now() where id=e.lead_id and company_id=v_company; end if;
  return jsonb_build_object('project_id',v_project,'award_decision_id',v_award,'snapshot_id',v_snapshot,'baseline_id',v_baseline,'already_awarded',false);
end
$function$;

create or replace function public.carez_create_next_proposal_revision(p_proposal_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth,extensions
as $function$
declare
  v_company uuid; v_actor uuid; p public.proposal_presentations%rowtype; e public.estimates%rowtype;
  v_new_estimate uuid; v_version integer; v_section record; v_item record; v_new_section uuid; v_section_map jsonb:='{}'::jsonb;
begin
  v_actor:=auth.uid(); v_company:=public.get_my_company_id();
  if v_actor is null or v_company is null or public.get_my_role()='employee' then raise exception 'Owner or office access required.'; end if;
  select * into p from public.proposal_presentations where id=p_proposal_revision_id and company_id=v_company for update;
  if not found then raise exception 'Issued Proposal revision not found.'; end if;
  select * into e from public.estimates where id=p.estimate_id and company_id=v_company for update;
  if not found then raise exception 'Source Estimate revision not found.'; end if;
  if exists(select 1 from public.award_decisions a where a.company_id=v_company and a.proposal_revision_id=p.id) then raise exception 'An awarded Proposal cannot be revised.'; end if;
  select id into v_new_estimate from public.estimates where company_id=v_company and parent_proposal_revision_id=p.id;
  if v_new_estimate is not null then return jsonb_build_object('estimate_id',v_new_estimate,'already_created',true); end if;
  select coalesce(max(version),e.version)+1 into v_version from public.estimates where company_id=v_company and estimate_number=e.estimate_number;
  insert into public.estimates(company_id,project_id,estimate_number,name,status,version,expected_start_date,target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,proposed_sell_price,notes,approved_at,created_by,lead_id,opportunity_number,job_spine_id,parent_proposal_revision_id)
  values(v_company,null,e.estimate_number,e.name,'draft',v_version,e.expected_start_date,e.target_margin_percent,e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,e.overhead_snapshot_id,e.overhead_rate_snapshot,e.proposed_sell_price,e.notes,null,v_actor,e.lead_id,e.opportunity_number,e.job_spine_id,p.id)
  returning id into v_new_estimate;
  for v_section in select * from public.estimate_sections where estimate_id=e.id and company_id=v_company order by sort_order,id loop
    insert into public.estimate_sections(company_id,estimate_id,name,scope_type,sort_order,notes)
    values(v_company,v_new_estimate,v_section.name,v_section.scope_type,v_section.sort_order,v_section.notes) returning id into v_new_section;
    v_section_map:=jsonb_set(v_section_map,array[v_section.id::text],to_jsonb(v_new_section),true);
  end loop;
  for v_item in select * from public.estimate_items where estimate_id=e.id and company_id=v_company order by sort_order,id loop
    insert into public.estimate_items(company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source,price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,price_override_by,price_override_at,job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,labor_rate_override_by,labor_rate_override_at,revision_source_estimate_item_id,revision_source_takeoff_output_id,revision_source_takeoff_measurement_id)
    values(v_company,v_new_estimate,(v_section_map->>v_item.section_id::text)::uuid,v_item.item_type,v_item.cost_code_id,v_item.catalog_item_id,v_item.crew_member_id,v_item.labor_task,v_item.risk_class_code,v_item.description,v_item.quantity,v_item.unit,v_item.unit_cost,v_item.direct_cost,v_item.regular_hours,v_item.overtime_hours,v_item.base_hourly_rate_snapshot,v_item.social_security_rate_snapshot,v_item.medicare_rate_snapshot,v_item.futa_rate_snapshot,v_item.wa_sui_rate_snapshot,v_item.li_employer_rate_snapshot,v_item.sick_leave_accrual_rate_snapshot,v_item.notes,v_item.sort_order,null,null,v_item.source_assembly_version_id,v_item.production_task_id,v_item.production_quantity,v_item.production_unit,v_item.baseline_man_hours_per_unit,v_item.baseline_source,v_item.price_source_kind,v_item.price_source_id,v_item.price_source_label,v_item.price_source_reference,v_item.price_effective_date,v_item.price_override_by,v_item.price_override_at,v_item.job_man_hours_per_unit,v_item.labor_assumption_override_by,v_item.labor_assumption_override_at,v_item.labor_rate_override_by,v_item.labor_rate_override_at,v_item.id,v_item.source_takeoff_output_id,v_item.source_takeoff_measurement_id);
  end loop;
  insert into public.proposal_settings(company_id,estimate_id,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,created_by)
  select company_id,v_new_estimate,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,v_actor from public.proposal_settings where estimate_id=e.id and company_id=v_company;
  insert into public.proposal_clarifications(company_id,estimate_id,category,clarification_text,published,sort_order,created_by)
  select company_id,v_new_estimate,category,clarification_text,published,sort_order,v_actor from public.proposal_clarifications where estimate_id=e.id and company_id=v_company;
  insert into public.bid_value_options(company_id,lead_id,estimate_id,name,customer_description,sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,status,created_by)
  select company_id,lead_id,v_new_estimate,name,customer_description,sell_price_change,company_cost_change,schedule_days_change,function_quality_note,approval_required,'suggested',v_actor from public.bid_value_options where estimate_id=e.id and company_id=v_company;
  return jsonb_build_object('estimate_id',v_new_estimate,'version',v_version,'parent_proposal_revision_id',p.id,'already_created',false);
end
$function$;

alter table public.job_spines enable row level security;
alter table public.job_spine_migration_reviews enable row level security;
alter table public.award_decisions enable row level security;
alter table public.accepted_scope_snapshots enable row level security;
alter table public.accepted_scope_snapshot_items enable row level security;
alter table public.commercial_baselines enable row level security;
alter table public.commercial_baseline_items enable row level security;
alter table public.job_number_sequences enable row level security;
do $policies$
declare t text;
begin
  foreach t in array array['job_spines','job_spine_migration_reviews','award_decisions','accepted_scope_snapshots','accepted_scope_snapshot_items','commercial_baselines','commercial_baseline_items','job_number_sequences'] loop
    execute format('create policy %I on public.%I for select to authenticated using (company_id=public.get_my_company_id())','carez company read '||t,t);
  end loop;
  create policy "carez company update job spine" on public.job_spines for update to authenticated using(company_id=public.get_my_company_id()) with check(company_id=public.get_my_company_id());
  create policy "carez company resolve migration review" on public.job_spine_migration_reviews for update to authenticated using(company_id=public.get_my_company_id()) with check(company_id=public.get_my_company_id());
end
$policies$;
grant select,insert,update on public.job_spines to authenticated;
grant select,update on public.job_spine_migration_reviews to authenticated;
grant select on public.award_decisions,public.accepted_scope_snapshots,public.accepted_scope_snapshot_items,public.commercial_baselines,public.commercial_baseline_items to authenticated;
revoke all on public.job_number_sequences from public,anon,authenticated;
revoke all on public.award_decisions,public.accepted_scope_snapshots,public.accepted_scope_snapshot_items,public.commercial_baselines,public.commercial_baseline_items from public,anon,authenticated;
revoke all on function public.carez_capture_proposal_commercial_snapshot() from public,anon,authenticated;
revoke all on function public.carez_protect_proposal_commercial_snapshot() from public,anon,authenticated;
revoke all on function public.carez_immutable_commercial_record() from public,anon,authenticated;
revoke all on function public.carez_assign_phase_job_spine() from public,anon,authenticated;
revoke all on function public.carez_get_proposal_award_hold(uuid) from public,anon;
revoke all on function public.carez_award_proposal_and_create_project(uuid,timestamptz,text) from public,anon;
revoke all on function public.carez_create_next_proposal_revision(uuid) from public,anon;
grant execute on function public.carez_get_proposal_award_hold(uuid) to authenticated;
grant execute on function public.carez_award_proposal_and_create_project(uuid,timestamptz,text) to authenticated;
grant execute on function public.carez_create_next_proposal_revision(uuid) to authenticated;
grant select on public.award_decisions,public.accepted_scope_snapshots,public.accepted_scope_snapshot_items,public.commercial_baselines,public.commercial_baseline_items to authenticated;

do $legacy$
declare r record; v_spine uuid;
begin
  for r in select p.id,p.company_id,p.job_spine_id from public.proposal_presentations p where (p.response_state='accepted' or p.status='accepted') and p.internal_commercial_snapshot is null loop
    v_spine:=r.job_spine_id;
    if v_spine is not null then
      insert into public.job_spine_migration_reviews(company_id,job_spine_id,phase_type,phase_id,reason)
      values(r.company_id,v_spine,'proposal',r.id,'Historical customer acceptance has no trustworthy frozen internal cost and production evidence; award is held.')
      on conflict(company_id,phase_type,phase_id) do nothing;
    end if;
  end loop;
end
$legacy$;
comment on table public.job_spines is 'Tenant-owned identity linking Opportunity, Estimate, Proposal, Award, and Project phases.';
comment on table public.award_decisions is 'Immutable internal full-award decision for one exact issued Proposal revision.';
comment on table public.accepted_scope_snapshots is 'Immutable accepted commercial facts from the exact awarded issued Proposal revision.';
comment on table public.commercial_baselines is 'Original frozen commercial baseline derived only from an Accepted Scope Snapshot.';
comment on function public.carez_award_proposal_and_create_project(uuid,timestamptz,text) is 'Authenticated internal-only atomic full award of one exact issued Proposal revision. Company and role are derived from auth context; all mutations are tenant-filtered.';
comment on function public.carez_create_next_proposal_revision(uuid) is 'Creates one editable draft revision from an issued Proposal while retaining source lineage and excluding release/response/award state.';
