-- Carez P0.5E: tenant-scoped audit ledger for legacy recipe -> Condition migration.
--
-- This migration is additive. It does not mutate or delete legacy assembly,
-- measurement, output, estimate, proposal, or published/verified Condition
-- history. Migration execution is introduced separately after dry-run proof.

create table public.condition_legacy_migration_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid,
  mode text not null check (mode in ('dry_run','apply')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  source_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(source_snapshot) = 'object'),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  error_text text,
  created_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(company_id,id),
  foreign key(company_id,takeoff_set_id)
    references public.takeoff_sets(company_id,id)
    on delete restrict
);

create index condition_legacy_migration_runs_company_idx
  on public.condition_legacy_migration_runs(company_id,started_at desc);

create index condition_legacy_migration_runs_set_idx
  on public.condition_legacy_migration_runs(company_id,takeoff_set_id,started_at desc)
  where takeoff_set_id is not null;

create table public.condition_legacy_migration_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null,
  object_type text not null check (object_type in (
    'assembly_version',
    'method_profile',
    'measurement',
    'output',
    'estimate_item',
    'proposal_snapshot'
  )),
  legacy_id uuid not null,
  classification text not null check (classification in (
    'mapped',
    'historical_only',
    'unsupported_review',
    'unreferenced'
  )),
  target_kind text,
  target_id uuid,
  result_status text not null default 'pending' check (result_status in (
    'pending',
    'exact',
    'held',
    'mismatch',
    'skipped',
    'error'
  )),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(run_id,object_type,legacy_id),
  foreign key(company_id,run_id)
    references public.condition_legacy_migration_runs(company_id,id)
    on delete cascade
);

create index condition_legacy_migration_items_run_idx
  on public.condition_legacy_migration_items(company_id,run_id,classification,result_status);

alter table public.condition_legacy_migration_runs enable row level security;
alter table public.condition_legacy_migration_items enable row level security;

create policy condition_legacy_migration_runs_select
on public.condition_legacy_migration_runs
for select to authenticated
using (company_id = public.get_my_company_id());

create policy condition_legacy_migration_runs_insert
on public.condition_legacy_migration_runs
for insert to authenticated
with check (
  company_id = public.get_my_company_id()
  and public.get_my_role() <> 'employee'
);

create policy condition_legacy_migration_runs_update
on public.condition_legacy_migration_runs
for update to authenticated
using (
  company_id = public.get_my_company_id()
  and public.get_my_role() <> 'employee'
)
with check (
  company_id = public.get_my_company_id()
  and public.get_my_role() <> 'employee'
);

create policy condition_legacy_migration_items_select
on public.condition_legacy_migration_items
for select to authenticated
using (company_id = public.get_my_company_id());

create policy condition_legacy_migration_items_insert
on public.condition_legacy_migration_items
for insert to authenticated
with check (
  company_id = public.get_my_company_id()
  and public.get_my_role() <> 'employee'
);

create policy condition_legacy_migration_items_update
on public.condition_legacy_migration_items
for update to authenticated
using (
  company_id = public.get_my_company_id()
  and public.get_my_role() <> 'employee'
)
with check (
  company_id = public.get_my_company_id()
  and public.get_my_role() <> 'employee'
);

revoke all on table public.condition_legacy_migration_runs from anon,authenticated;
revoke all on table public.condition_legacy_migration_items from anon,authenticated;
grant select,insert,update on table public.condition_legacy_migration_runs to authenticated;
grant select,insert,update on table public.condition_legacy_migration_items to authenticated;
grant all on table public.condition_legacy_migration_runs to service_role;
grant all on table public.condition_legacy_migration_items to service_role;

comment on table public.condition_legacy_migration_runs is
  'P0.5E dry-run/apply audit runs. Does not itself authorize legacy mutation.';
comment on table public.condition_legacy_migration_items is
  'P0.5E per-object classification/reconciliation ledger; referenced history is preserved.';
