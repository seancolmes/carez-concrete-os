-- Carez P1: a takeoff measurement can only reference the verified method profile
-- for the same tenant, takeoff set and immutable assembly version.

create or replace function public.carez_validate_measurement_method_profile()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if new.method_profile_id is null then return new; end if;

  if not exists (
    select 1
    from public.takeoff_method_profiles p
    where p.id=new.method_profile_id
      and p.company_id=new.company_id
      and p.takeoff_set_id=new.takeoff_set_id
      and p.assembly_version_id=new.assembly_version_id
      and p.status='verified'
  ) then
    raise exception 'Takeoff measurement method profile must be verified and match the same takeoff set and assembly version.';
  end if;

  return new;
end;
$$;

drop trigger if exists takeoff_measurements_method_profile_guard on public.takeoff_measurements;
create trigger takeoff_measurements_method_profile_guard
before insert or update of method_profile_id,takeoff_set_id,assembly_version_id
on public.takeoff_measurements
for each row execute function public.carez_validate_measurement_method_profile();

revoke all on function public.carez_validate_measurement_method_profile() from public,anon,authenticated;
