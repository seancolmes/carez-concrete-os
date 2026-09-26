begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(5);
select extensions.ok(not has_function_privilege('anon', 'public.carez_create_custom_assembly(text,text,text,text,uuid,text)', 'execute'), 'anonymous callers cannot create retired assemblies');
select extensions.ok(not has_function_privilege('authenticated', 'public.carez_create_custom_assembly(text,text,text,text,uuid,text)', 'execute'), 'application callers cannot create retired assemblies');
select extensions.ok(not has_function_privilege('service_role', 'public.carez_create_custom_assembly(text,text,text,text,uuid,text)', 'execute'), 'service callers cannot revive legacy authoring');
select extensions.throws_ok(
  $$select public.carez_create_custom_assembly('TEST','Retired authoring','Footing','LF',null,null)$$,
  '0A000', 'Legacy assembly authoring is retired. Create a Project Concrete Condition instead.',
  'privileged stale callers receive a deliberate retirement error, not a missing relation error'
);
select extensions.ok(to_regclass('public.concrete_assemblies') is not null and to_regclass('public.concrete_assembly_versions') is not null, 'historical assembly relations remain available');
select * from extensions.finish();
rollback;
