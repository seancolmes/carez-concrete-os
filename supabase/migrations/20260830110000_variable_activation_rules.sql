alter table public.concrete_assembly_variables add column if not exists activation_rule jsonb;

create or replace function public.carez_variable_activation_rule_is_valid(p_rule jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
begin
  if p_rule is null then return true; end if;
  return public.carez_activation_rule_is_valid(p_rule);
exception when others then return false;
end $$;
revoke all on function public.carez_variable_activation_rule_is_valid(jsonb) from public,anon;
grant execute on function public.carez_variable_activation_rule_is_valid(jsonb) to authenticated,service_role;
