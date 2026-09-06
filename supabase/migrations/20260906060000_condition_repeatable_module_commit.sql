-- Issue #55 browser QA hotfix: the original atomic Condition commit RPC was
-- published before repeatable module instances existed. It required the total
-- module payload to equal the archetype module count and rejected every
-- non-default instance, so adding an explicit reinforcing/anchor/misc instance
-- could calculate on the server but could never commit atomically.
--
-- Preserve the existing transaction, RLS/security-invoker behavior, lineage,
-- compatibility reconciliation, and output persistence. Replace only the
-- module-payload validator so the contract is:
--   * exactly one default instance for every published module;
--   * unique (module_key, instance_key) identities;
--   * additional instances only for modules published as repeatable;
--   * every supplied row still has a valid label/enabled/input payload.
--
-- The guarded source replacement intentionally fails migration if the expected
-- predecessor validator is no longer present, preventing a silent overwrite of
-- a later commit-function implementation.

do $migration$
declare
  v_function_oid oid;
  v_definition text;
  v_old_validator text := $old$  if jsonb_array_length(p_modules) <> jsonb_array_length(v_archetype.module_schema)
     or (select count(distinct item->>'module_key') from jsonb_array_elements(p_modules) item) <> jsonb_array_length(v_archetype.module_schema)
     or exists (
       select 1 from jsonb_array_elements(p_modules) item
       where item->>'instance_key' <> 'default'
          or nullif(trim(item->>'label'),'') is null
          or jsonb_typeof(item->'enabled') <> 'boolean'
          or jsonb_typeof(item->'input_values') <> 'object'
          or jsonb_typeof(item->'input_provenance') <> 'object'
          or not exists (
            select 1 from jsonb_array_elements(v_archetype.module_schema) definition
            where definition->>'key' = item->>'module_key'
          )
     ) then
    raise exception 'Pilot calculation requires one valid default instance for every Condition module.';
  end if;$old$;
  v_new_validator text := $new$  if exists (
       select 1
       from jsonb_array_elements(v_archetype.module_schema) definition
       where (
         select count(*)
         from jsonb_array_elements(p_modules) item
         where item->>'module_key' = definition->>'key'
           and item->>'instance_key' = 'default'
       ) <> 1
     )
     or jsonb_array_length(p_modules) <> (
       select count(distinct (item->>'module_key') || ':' || (item->>'instance_key'))
       from jsonb_array_elements(p_modules) item
     )
     or exists (
       select 1
       from jsonb_array_elements(p_modules) item
       where nullif(trim(item->>'instance_key'),'') is null
          or nullif(trim(item->>'label'),'') is null
          or jsonb_typeof(item->'enabled') is distinct from 'boolean'
          or jsonb_typeof(item->'input_values') is distinct from 'object'
          or jsonb_typeof(item->'input_provenance') is distinct from 'object'
          or not exists (
            select 1
            from jsonb_array_elements(v_archetype.module_schema) definition
            where definition->>'key' = item->>'module_key'
          )
          or (
            item->>'instance_key' <> 'default'
            and not exists (
              select 1
              from jsonb_array_elements(v_archetype.module_schema) definition
              where definition->>'key' = item->>'module_key'
                and coalesce((definition->>'repeatable')::boolean,false)
            )
          )
     ) then
    raise exception 'Condition module payload must contain exactly one default per module and only explicit instances for repeatable modules.';
  end if;$new$;
begin
  select p.oid into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'carez_commit_project_condition_calculation';

  if v_function_oid is null then
    raise exception 'carez_commit_project_condition_calculation was not found.';
  end if;

  v_definition := pg_get_functiondef(v_function_oid);
  if strpos(v_definition,v_old_validator) = 0 then
    raise exception 'Expected predecessor Condition module validator was not found; refusing to rewrite the commit RPC.';
  end if;

  execute replace(v_definition,v_old_validator,v_new_validator);
end;
$migration$;

comment on function public.carez_commit_project_condition_calculation(
  uuid,timestamptz,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb
) is
  'Atomically commits a server-authoritative Project Condition calculation. Requires one default instance per module and permits unique explicit instances only for published repeatable modules.';
