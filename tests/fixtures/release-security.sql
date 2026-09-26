begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(4);
select extensions.is_empty($q$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity
    and (has_table_privilege('authenticated',c.oid,'SELECT') or has_table_privilege('anon',c.oid,'SELECT'))
$q$, 'all exposed public tables enforce RLS');
select extensions.is_empty($q$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='v'
    and not coalesce(c.reloptions @> array['security_invoker=true'],false)
    and (has_table_privilege('authenticated',c.oid,'SELECT') or has_table_privilege('anon',c.oid,'SELECT'))
$q$, 'all exposed views execute with caller RLS');
select extensions.is_empty($q$
  select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and not exists(select 1 from unnest(p.proconfig) setting where
      setting ~ '^search_path=pg_catalog, *(public|auth|extensions)(, *(public|auth|extensions|pg_temp))*$'
      or setting='search_path=""')
$q$, 'definer functions have explicit safe search paths');
select extensions.is_empty($q$
  select c.relname::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='company_id' and not a.attisdropped)
    and (has_table_privilege('authenticated',c.oid,'SELECT') or has_table_privilege('anon',c.oid,'SELECT'))
    and not exists(select 1 from pg_policy p where p.polrelid=c.oid)
$q$, 'tenant tables have explicit policies');
select * from extensions.finish();
rollback;
