create table public.plan_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  source_document_id uuid not null references public.company_documents(id) on delete restrict,
  status text not null default 'queued',
  processor text not null default 'carez',
  model_name text,
  model_version text,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary text,
  run_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_intelligence_runs_status_chk check (status in ('queued','processing','needs_review','completed','failed','superseded')),
  constraint plan_intelligence_runs_metadata_chk check (jsonb_typeof(run_metadata)='object')
);

create table public.plan_scopes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  parent_scope_id uuid references public.plan_scopes(id) on delete set null,
  sheet_id uuid references public.takeoff_sheets(id) on delete set null,
  measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  scope_type text not null,
  scope_key text not null,
  label text not null,
  source_reference text,
  specificity_rank integer not null default 0,
  boundary jsonb,
  created_at timestamptz not null default now(),
  constraint plan_scopes_type_chk check (scope_type in ('plan_set','sheet','note_group','schedule','detail','type_mark','zone','condition','takeoff_object','other')),
  constraint plan_scopes_key_chk check (btrim(scope_key)<>''),
  constraint plan_scopes_label_chk check (btrim(label)<>''),
  constraint plan_scopes_specificity_chk check (specificity_rank between 0 and 1000),
  constraint plan_scopes_boundary_chk check (boundary is null or jsonb_typeof(boundary)='object'),
  constraint plan_scopes_uk unique(takeoff_set_id,scope_type,scope_key)
);

create table public.plan_source_regions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null references public.plan_intelligence_runs(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete set null,
  page_number integer not null,
  source_kind text not null,
  source_reference text,
  page_region jsonb,
  raw_text text,
  normalized_text text,
  content_hash text,
  confidence numeric not null default 0,
  extraction_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint plan_source_regions_page_chk check (page_number>0),
  constraint plan_source_regions_kind_chk check (source_kind in ('general_note','note','schedule','detail','plan_callout','section','specification','legend','revision','table','other')),
  constraint plan_source_regions_region_chk check (page_region is null or jsonb_typeof(page_region)='object'),
  constraint plan_source_regions_confidence_chk check (confidence between 0 and 1),
  constraint plan_source_regions_metadata_chk check (jsonb_typeof(extraction_metadata)='object')
);

create table public.plan_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null references public.plan_intelligence_runs(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  scope_id uuid references public.plan_scopes(id) on delete set null,
  fact_class text not null,
  property_key text not null,
  value_type text not null,
  value jsonb not null,
  unit text,
  statement text,
  interpretation_note text,
  confidence numeric not null default 0,
  proposal_status text not null default 'proposed',
  superseded_by_fact_id uuid references public.plan_facts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint plan_facts_class_chk check (btrim(fact_class)<>''),
  constraint plan_facts_property_key_chk check (property_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint plan_facts_value_type_chk check (value_type in ('number','text','boolean','json')),
  constraint plan_facts_value_shape_chk check (
    value_type='json'
    or (value_type='number' and jsonb_typeof(value)='number')
    or (value_type='text' and jsonb_typeof(value)='string')
    or (value_type='boolean' and jsonb_typeof(value)='boolean')
  ),
  constraint plan_facts_confidence_chk check (confidence between 0 and 1),
  constraint plan_facts_status_chk check (proposal_status in ('proposed','superseded')),
  constraint plan_facts_supersede_chk check (superseded_by_fact_id is null or superseded_by_fact_id<>id)
);

create table public.plan_fact_sources (
  company_id uuid not null references public.companies(id) on delete cascade,
  fact_id uuid not null references public.plan_facts(id) on delete cascade,
  source_region_id uuid not null references public.plan_source_regions(id) on delete cascade,
  evidence_role text not null default 'supporting',
  created_at timestamptz not null default now(),
  primary key(fact_id,source_region_id),
  constraint plan_fact_sources_role_chk check (evidence_role in ('primary','supporting','contradicting'))
);

create table public.plan_fact_relations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  from_fact_id uuid not null references public.plan_facts(id) on delete cascade,
  to_fact_id uuid not null references public.plan_facts(id) on delete cascade,
  relation_type text not null,
  rationale text,
  confidence numeric not null default 0,
  run_id uuid references public.plan_intelligence_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint plan_fact_relations_type_chk check (relation_type in ('supports','refines','overrides','conflicts_with','references','supersedes')),
  constraint plan_fact_relations_distinct_chk check (from_fact_id<>to_fact_id),
  constraint plan_fact_relations_confidence_chk check (confidence between 0 and 1),
  constraint plan_fact_relations_uk unique(from_fact_id,to_fact_id,relation_type)
);

create table public.plan_fact_decisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fact_id uuid not null references public.plan_facts(id) on delete cascade,
  decision text not null,
  resolved_value_type text,
  resolved_value jsonb,
  resolved_unit text,
  reason text,
  decision_metadata jsonb not null default '{}'::jsonb,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now(),
  constraint plan_fact_decisions_decision_chk check (decision in ('confirmed','overridden','rejected')),
  constraint plan_fact_decisions_value_type_chk check (resolved_value_type is null or resolved_value_type in ('number','text','boolean','json')),
  constraint plan_fact_decisions_value_chk check (
    (decision='rejected' and resolved_value is null and resolved_value_type is null)
    or
    (decision in ('confirmed','overridden') and resolved_value is not null and resolved_value_type is not null and (
      resolved_value_type='json'
      or (resolved_value_type='number' and jsonb_typeof(resolved_value)='number')
      or (resolved_value_type='text' and jsonb_typeof(resolved_value)='string')
      or (resolved_value_type='boolean' and jsonb_typeof(resolved_value)='boolean')
    ))
  ),
  constraint plan_fact_decisions_reason_chk check (decision='confirmed' or nullif(btrim(reason),'') is not null),
  constraint plan_fact_decisions_metadata_chk check (jsonb_typeof(decision_metadata)='object')
);

create table public.takeoff_plan_fact_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  measurement_id uuid not null references public.takeoff_measurements(id) on delete cascade,
  fact_id uuid not null references public.plan_facts(id) on delete restrict,
  decision_id uuid references public.plan_fact_decisions(id) on delete set null,
  target_property_key text,
  applied_value_type text,
  applied_value jsonb,
  applied_unit text,
  application_status text not null default 'proposed',
  application_reason text,
  application_metadata jsonb not null default '{}'::jsonb,
  applied_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_plan_fact_applications_status_chk check (application_status in ('proposed','applied','overridden','detached')),
  constraint takeoff_plan_fact_applications_type_chk check (applied_value_type is null or applied_value_type in ('number','text','boolean','json')),
  constraint takeoff_plan_fact_applications_value_chk check (
    (applied_value is null and applied_value_type is null)
    or
    (applied_value is not null and applied_value_type is not null and (
      applied_value_type='json'
      or (applied_value_type='number' and jsonb_typeof(applied_value)='number')
      or (applied_value_type='text' and jsonb_typeof(applied_value)='string')
      or (applied_value_type='boolean' and jsonb_typeof(applied_value)='boolean')
    ))
  ),
  constraint takeoff_plan_fact_applications_metadata_chk check (jsonb_typeof(application_metadata)='object')
);

create index plan_intelligence_runs_set_idx on public.plan_intelligence_runs(company_id,takeoff_set_id,created_at desc);
create index plan_intelligence_runs_status_idx on public.plan_intelligence_runs(company_id,status,created_at desc);
create index plan_scopes_set_idx on public.plan_scopes(company_id,takeoff_set_id,specificity_rank,scope_type);
create index plan_scopes_parent_idx on public.plan_scopes(parent_scope_id) where parent_scope_id is not null;
create index plan_source_regions_run_sheet_idx on public.plan_source_regions(company_id,run_id,sheet_id,page_number);
create index plan_source_regions_hash_idx on public.plan_source_regions(run_id,content_hash) where content_hash is not null;
create index plan_facts_set_property_idx on public.plan_facts(company_id,takeoff_set_id,property_key,proposal_status);
create index plan_facts_scope_idx on public.plan_facts(scope_id,property_key) where scope_id is not null;
create index plan_fact_sources_region_idx on public.plan_fact_sources(source_region_id);
create index plan_fact_relations_to_idx on public.plan_fact_relations(to_fact_id,relation_type);
create index plan_fact_decisions_fact_idx on public.plan_fact_decisions(fact_id,decided_at desc);
create index takeoff_plan_fact_applications_measurement_idx on public.takeoff_plan_fact_applications(company_id,measurement_id,application_status);
create index takeoff_plan_fact_applications_fact_idx on public.takeoff_plan_fact_applications(fact_id);
create unique index takeoff_plan_fact_applications_active_uk
  on public.takeoff_plan_fact_applications(measurement_id,fact_id,coalesce(target_property_key,''))
  where application_status<>'detached';

alter table public.plan_intelligence_runs enable row level security;
alter table public.plan_scopes enable row level security;
alter table public.plan_source_regions enable row level security;
alter table public.plan_facts enable row level security;
alter table public.plan_fact_sources enable row level security;
alter table public.plan_fact_relations enable row level security;
alter table public.plan_fact_decisions enable row level security;
alter table public.takeoff_plan_fact_applications enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'plan_intelligence_runs','plan_scopes','plan_source_regions','plan_facts',
    'plan_fact_sources','plan_fact_relations','plan_fact_decisions','takeoff_plan_fact_applications'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>''employee'')','office read '||t,t);
  end loop;
end $$;

create policy "office create plan intelligence runs" on public.plan_intelligence_runs
for insert to authenticated
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and exists(select 1 from public.takeoff_sets t where t.id=takeoff_set_id and t.company_id=plan_intelligence_runs.company_id)
  and exists(select 1 from public.company_documents d where d.id=source_document_id and d.company_id=plan_intelligence_runs.company_id)
);

create policy "office update plan intelligence runs" on public.plan_intelligence_runs
for update to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and exists(select 1 from public.takeoff_sets t where t.id=takeoff_set_id and t.company_id=plan_intelligence_runs.company_id)
  and exists(select 1 from public.company_documents d where d.id=source_document_id and d.company_id=plan_intelligence_runs.company_id)
);

create policy "office create plan scopes" on public.plan_scopes
for insert to authenticated
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and exists(select 1 from public.takeoff_sets t where t.id=takeoff_set_id and t.company_id=plan_scopes.company_id)
  and (parent_scope_id is null or exists(select 1 from public.plan_scopes p where p.id=parent_scope_id and p.company_id=plan_scopes.company_id and p.takeoff_set_id=plan_scopes.takeoff_set_id))
  and (sheet_id is null or exists(select 1 from public.takeoff_sheets s where s.id=sheet_id and s.company_id=plan_scopes.company_id and s.takeoff_set_id=plan_scopes.takeoff_set_id))
  and (measurement_id is null or exists(select 1 from public.takeoff_measurements m where m.id=measurement_id and m.company_id=plan_scopes.company_id and m.takeoff_set_id=plan_scopes.takeoff_set_id))
);

create policy "office update plan scopes" on public.plan_scopes
for update to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and exists(select 1 from public.takeoff_sets t where t.id=takeoff_set_id and t.company_id=plan_scopes.company_id)
  and (parent_scope_id is null or exists(select 1 from public.plan_scopes p where p.id=parent_scope_id and p.company_id=plan_scopes.company_id and p.takeoff_set_id=plan_scopes.takeoff_set_id))
  and (sheet_id is null or exists(select 1 from public.takeoff_sheets s where s.id=sheet_id and s.company_id=plan_scopes.company_id and s.takeoff_set_id=plan_scopes.takeoff_set_id))
  and (measurement_id is null or exists(select 1 from public.takeoff_measurements m where m.id=measurement_id and m.company_id=plan_scopes.company_id and m.takeoff_set_id=plan_scopes.takeoff_set_id))
);

create policy "office decide plan facts" on public.plan_fact_decisions
for insert to authenticated
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and decided_by=(select auth.uid())
  and exists(select 1 from public.plan_facts f where f.id=fact_id and f.company_id=plan_fact_decisions.company_id)
);

create policy "office create takeoff plan applications" on public.takeoff_plan_fact_applications
for insert to authenticated
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and exists(select 1 from public.takeoff_measurements m join public.plan_facts f on f.id=fact_id where m.id=measurement_id and m.company_id=takeoff_plan_fact_applications.company_id and f.company_id=takeoff_plan_fact_applications.company_id and f.takeoff_set_id=m.takeoff_set_id)
  and (decision_id is null or exists(select 1 from public.plan_fact_decisions d where d.id=decision_id and d.company_id=takeoff_plan_fact_applications.company_id and d.fact_id=takeoff_plan_fact_applications.fact_id))
  and (applied_by is null or applied_by=(select auth.uid()))
);

create policy "office update takeoff plan applications" on public.takeoff_plan_fact_applications
for update to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (
  company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee'
  and exists(select 1 from public.takeoff_measurements m join public.plan_facts f on f.id=fact_id where m.id=measurement_id and m.company_id=takeoff_plan_fact_applications.company_id and f.company_id=takeoff_plan_fact_applications.company_id and f.takeoff_set_id=m.takeoff_set_id)
  and (decision_id is null or exists(select 1 from public.plan_fact_decisions d where d.id=decision_id and d.company_id=takeoff_plan_fact_applications.company_id and d.fact_id=takeoff_plan_fact_applications.fact_id))
  and (applied_by is null or applied_by=(select auth.uid()))
);

revoke all on table public.plan_intelligence_runs,public.plan_scopes,public.plan_source_regions,public.plan_facts,public.plan_fact_sources,public.plan_fact_relations,public.plan_fact_decisions,public.takeoff_plan_fact_applications from public,anon,authenticated;
grant select on table public.plan_intelligence_runs,public.plan_scopes,public.plan_source_regions,public.plan_facts,public.plan_fact_sources,public.plan_fact_relations,public.plan_fact_decisions,public.takeoff_plan_fact_applications to authenticated;
grant insert,update on table public.plan_intelligence_runs,public.plan_scopes,public.takeoff_plan_fact_applications to authenticated;
grant insert on table public.plan_fact_decisions to authenticated;
grant all on table public.plan_intelligence_runs,public.plan_scopes,public.plan_source_regions,public.plan_facts,public.plan_fact_sources,public.plan_fact_relations,public.plan_fact_decisions,public.takeoff_plan_fact_applications to service_role;

create or replace view public.plan_effective_facts
with (security_invoker=true)
as
select
  f.company_id,
  f.takeoff_set_id,
  f.id as fact_id,
  f.run_id,
  f.scope_id,
  s.scope_type,
  s.scope_key,
  s.label as scope_label,
  s.specificity_rank,
  f.fact_class,
  f.property_key,
  f.value_type as proposed_value_type,
  f.value as proposed_value,
  f.unit as proposed_unit,
  f.statement,
  f.interpretation_note,
  f.confidence,
  case
    when f.proposal_status='superseded' then 'superseded'
    when d.decision is not null then d.decision
    else 'proposed'
  end as effective_state,
  case
    when f.proposal_status='superseded' or d.decision='rejected' then null
    when d.decision in ('confirmed','overridden') then d.resolved_value
    else f.value
  end as effective_value,
  case
    when f.proposal_status='superseded' or d.decision='rejected' then null
    when d.decision in ('confirmed','overridden') then d.resolved_unit
    else f.unit
  end as effective_unit,
  d.id as decision_id,
  d.reason as decision_reason,
  d.decided_by,
  d.decided_at,
  src.source_region_id as primary_source_region_id,
  src.sheet_id as primary_sheet_id,
  src.page_number as primary_page_number,
  src.source_reference as primary_source_reference,
  f.created_at
from public.plan_facts f
left join public.plan_scopes s on s.id=f.scope_id
left join lateral (
  select x.*
  from public.plan_fact_decisions x
  where x.fact_id=f.id
  order by x.decided_at desc,x.id desc
  limit 1
) d on true
left join lateral (
  select r.id as source_region_id,r.sheet_id,r.page_number,r.source_reference
  from public.plan_fact_sources fs
  join public.plan_source_regions r on r.id=fs.source_region_id
  where fs.fact_id=f.id and fs.evidence_role='primary'
  order by r.created_at,r.id
  limit 1
) src on true;

revoke all on table public.plan_effective_facts from public,anon,authenticated;
grant select on table public.plan_effective_facts to authenticated,service_role;
