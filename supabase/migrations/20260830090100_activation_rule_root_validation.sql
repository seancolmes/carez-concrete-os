-- Keep publication validation exactly aligned with the runtime rule grammar.

create or replace function public.carez_activation_rule_value_is_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path=public
as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then return false; end if;
  if p_value ? 'var' then return jsonb_typeof(p_value->'var')='string' and length(trim(p_value->>'var'))>0; end if;
  if p_value ? 'const' then
    return jsonb_typeof(p_value->'const') in ('string','number','boolean','null')
      or (jsonb_typeof(p_value->'const')='array' and not exists(select 1 from jsonb_array_elements(p_value->'const') x where jsonb_typeof(x) not in ('string','number','boolean','null')));
  end if;
  return false;
end;
$$;
revoke all on function public.carez_activation_rule_value_is_valid(jsonb) from public,anon;
grant execute on function public.carez_activation_rule_value_is_valid(jsonb) to authenticated,service_role;

create or replace function public.carez_activation_rule_is_valid(p_rule jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path=public
as $$
declare v_op text;
begin
  if p_rule is null or jsonb_typeof(p_rule) <> 'object' then return false; end if;
  v_op:=coalesce(p_rule->>'op','');
  if v_op in ('eq','neq','gt','gte','lt','lte') then
    return public.carez_activation_rule_value_is_valid(p_rule->'left') and public.carez_activation_rule_value_is_valid(p_rule->'right');
  elsif v_op in ('and','or') then
    return jsonb_typeof(p_rule->'args')='array' and jsonb_array_length(p_rule->'args')>0
      and not exists(select 1 from jsonb_array_elements(p_rule->'args') x where not public.carez_activation_rule_is_valid(x));
  elsif v_op='not' then
    return public.carez_activation_rule_is_valid(p_rule->'arg');
  elsif v_op='exists' then
    return public.carez_activation_rule_value_is_valid(p_rule->'value');
  elsif v_op='in' then
    return public.carez_activation_rule_value_is_valid(p_rule->'value')
      and jsonb_typeof(p_rule->'values')='array'
      and not exists(select 1 from jsonb_array_elements(p_rule->'values') x where not public.carez_activation_rule_value_is_valid(x));
  end if;
  return false;
end;
$$;
revoke all on function public.carez_activation_rule_is_valid(jsonb) from public,anon;
grant execute on function public.carez_activation_rule_is_valid(jsonb) to authenticated,service_role;
