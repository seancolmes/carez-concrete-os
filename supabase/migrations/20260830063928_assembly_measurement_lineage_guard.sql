create or replace function public.carez_guard_assembly_identity_measurement()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.primary_measurement is distinct from old.primary_measurement
     and exists(
       select 1 from public.concrete_assembly_versions v
       where v.company_id=old.company_id and v.assembly_id=old.id and v.status='published'
     ) then
    raise exception 'Primary measurement is part of published assembly lineage. Create a new assembly identity.';
  end if;
  return new;
end;
$$;
revoke all on function public.carez_guard_assembly_identity_measurement() from public,anon,authenticated;

create trigger carez_guard_assembly_identity_measurement
before update of primary_measurement on public.concrete_assemblies
for each row execute function public.carez_guard_assembly_identity_measurement();
