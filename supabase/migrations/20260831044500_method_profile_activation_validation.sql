-- Carez P1: method-profile verification must honor conditional assembly inputs.

create or replace function public.carez_method_rule_value(
  p_node jsonb,
  p_inputs jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path=public
as $$
declare
  v_key text;
begin
  if p_node is null then return null; end if;
  if p_node ? 'const' then return p_node->'const'; end if;
  if p_node ? 'var' then
    v_key:=coalesce(p_node->>'var','');
    v_key:=regexp_replace(v_key,'^(properties|property|Properties)\.','','i');
    if v_key='' then return null; end if;
    return p_inputs->v_key;
  end if;
  return null;
end;
$$;

create or replace function public.carez_method_activation_matches(
  p_rule jsonb,
  p_inputs jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path=public
as $$
declare
  v_op text;
  v_left jsonb;
  v_right jsonb;
  v_value jsonb;
  v_entry jsonb;
  v_left_num numeric;
  v_right_num numeric;
begin
  if p_rule is null then return true; end if;
  if jsonb_typeof(p_rule)<>'object' then return false; end if;

  if p_rule ? 'var' or p_rule ? 'const' then
    return public.carez_method_rule_value(p_rule,p_inputs) is not null;
  end if;

  v_op:=coalesce(p_rule->>'op','');

  if v_op in ('eq','neq','gt','gte','lt','lte') then
    v_left:=public.carez_method_rule_value(p_rule->'left',p_inputs);
    v_right:=public.carez_method_rule_value(p_rule->'right',p_inputs);
    if v_left is null or v_right is null then return false; end if;
    if v_op='eq' then return v_left=v_right; end if;
    if v_op='neq' then return v_left<>v_right; end if;
    begin
      v_left_num:=(v_left#>>'{}')::numeric;
      v_right_num:=(v_right#>>'{}')::numeric;
    exception when others then
      return false;
    end;
    if v_op='gt' then return v_left_num>v_right_num; end if;
    if v_op='gte' then return v_left_num>=v_right_num; end if;
    if v_op='lt' then return v_left_num<v_right_num; end if;
    if v_op='lte' then return v_left_num<=v_right_num; end if;
  end if;

  if v_op='and' then
    if jsonb_typeof(p_rule->'args')<>'array' then return false; end if;
    for v_entry in select value from jsonb_array_elements(p_rule->'args') loop
      if not public.carez_method_activation_matches(v_entry,p_inputs) then return false; end if;
    end loop;
    return true;
  end if;

  if v_op='or' then
    if jsonb_typeof(p_rule->'args')<>'array' then return false; end if;
    for v_entry in select value from jsonb_array_elements(p_rule->'args') loop
      if public.carez_method_activation_matches(v_entry,p_inputs) then return true; end if;
    end loop;
    return false;
  end if;

  if v_op='not' then
    return not public.carez_method_activation_matches(p_rule->'arg',p_inputs);
  end if;

  if v_op='exists' then
    return public.carez_method_rule_value(p_rule->'value',p_inputs) is not null;
  end if;

  if v_op='in' then
    v_value:=public.carez_method_rule_value(p_rule->'value',p_inputs);
    if v_value is null or jsonb_typeof(p_rule->'values')<>'array' then return false; end if;
    return exists(select 1 from jsonb_array_elements(p_rule->'values') x where x=v_value);
  end if;

  return false;
end;
$$;

revoke all on function public.carez_method_rule_value(jsonb,jsonb) from public,anon;
revoke all on function public.carez_method_activation_matches(jsonb,jsonb) from public,anon;
grant execute on function public.carez_method_rule_value(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.carez_method_activation_matches(jsonb,jsonb) to authenticated,service_role;

create or replace function public.carez_verify_takeoff_method_profile(p_profile_id uuid)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_profile public.takeoff_method_profiles%rowtype;
begin
  if v_company is null or public.get_my_role()='employee' then
    raise exception 'Owner access required.';
  end if;

  select * into v_profile
  from public.takeoff_method_profiles
  where id=p_profile_id and company_id=v_company
  for update;

  if not found then raise exception 'Takeoff method profile not found.'; end if;
  if v_profile.status<>'draft' then raise exception 'Only a draft method profile can be verified.'; end if;

  if not exists (
    select 1 from public.concrete_assembly_versions v
    where v.id=v_profile.assembly_version_id
      and v.company_id=v_company
      and v.status='published'
  ) then
    raise exception 'Method profiles must reference a published assembly version.';
  end if;

  if exists (
    select 1
    from public.concrete_assembly_variables v
    where v.company_id=v_company
      and v.assembly_version_id=v_profile.assembly_version_id
      and v.requires_verification
      and v.input_role in ('method_decision','production_assumption','commercial_assumption')
      and public.carez_method_activation_matches(v.activation_rule,v_profile.method_inputs)
      and not (v_profile.method_inputs ? v.variable_key)
  ) then
    raise exception 'Verify every active builder/production assumption before starting takeoff.';
  end if;

  perform set_config('carez.method_profile_verify','1',true);
  update public.takeoff_method_profiles
  set status='verified',verified_by=auth.uid(),verified_at=now()
  where id=v_profile.id and company_id=v_company;
end;
$$;

revoke all on function public.carez_verify_takeoff_method_profile(uuid) from public,anon;
grant execute on function public.carez_verify_takeoff_method_profile(uuid) to authenticated,service_role;
