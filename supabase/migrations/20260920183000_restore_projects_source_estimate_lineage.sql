-- Restore the Project -> source Estimate lineage column required by the
-- approved Takeoff lineage contract. Production already has this column and
-- foreign key; QA/staging are missing it. Additive and idempotent: existing
-- Project rows remain valid with source_estimate_id = NULL. No backfill, no
-- RLS change, no change to company_id behavior.

alter table public.projects
  add column if not exists source_estimate_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = 'projects'
      and c.conname = 'projects_source_estimate_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_source_estimate_id_fkey
      foreign key (source_estimate_id)
      references public.estimates(id)
      on delete set null;
  end if;
end
$$;
