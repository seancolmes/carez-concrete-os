-- Recovered functions retain their bodies and ACLs. Trusted builtins must
-- precede the application/extension schemas. Explicit pg_temp LAST prevents
-- PostgreSQL's implicit temporary-schema precedence for relation lookup.
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
 and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
 and not exists(select 1 from unnest(p.proconfig) setting where setting ~ '^search_path=pg_catalog(, *(public|auth|extensions))*, *pg_temp$' or setting='search_path=""')
 loop execute format('alter function %s set search_path=pg_catalog,public,extensions,pg_temp',f.signature);end loop;
end $$;
