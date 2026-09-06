create or replace function public.carez_validate_measurement_method_profile()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_profile public.takeoff_method_profiles%rowtype;
begin
  if new.method_profile_id is null then
    if coalesce(current_setting('carez.allow_unbound_method_profile_insert',true),'')='1' then return new; end if;
    if exists (
      select 1 from public.concrete_assembly_variables v
      where v.company_id=new.company_id and v.assembly_version_id=new.assembly_version_id
        and v.requires_verification and v.input_role in ('method_decision','production_assumption','commercial_assumption')
        and public.carez_method_activation_matches(v.activation_rule,coalesce(new.variables,'{}'::jsonb))
    ) then raise exception 'Verify the build method before creating or recalculating this takeoff.'; end if;
    return new;
  end if;
  select * into v_profile from public.takeoff_method_profiles p
  where p.id=new.method_profile_id and p.company_id=new.company_id and p.takeoff_set_id=new.takeoff_set_id
    and p.assembly_version_id=new.assembly_version_id and p.status='verified';
  if not found then raise exception 'Takeoff measurement method profile must be verified and match the same takeoff set and assembly version.'; end if;
  if exists (
    select 1 from public.concrete_assembly_variables v
    where v.company_id=new.company_id and v.assembly_version_id=new.assembly_version_id
      and v.requires_verification and v.input_role in ('method_decision','production_assumption','commercial_assumption')
      and public.carez_method_activation_matches(v.activation_rule,coalesce(new.variables,'{}'::jsonb))
      and (not (v_profile.method_inputs ? v.variable_key) or v_profile.method_inputs->v.variable_key is distinct from coalesce(new.variables,'{}'::jsonb)->v.variable_key)
  ) then raise exception 'Builder or production assumptions changed. Verify a new build-method profile before recalculating this takeoff.'; end if;
  return new;
end;
$$;

create or replace function public.carez_commit_drawing_measurement(
  p_takeoff_set_id uuid,p_sheet_id uuid,p_estimate_section_id uuid,p_assembly_version_id uuid,p_name text,p_location text,p_drawing_reference text,p_measurement_type text,p_raw_quantity numeric,p_raw_unit text,p_variables jsonb,p_risk_class_code text,p_geometry jsonb,p_outputs jsonb,p_scale_region_id uuid default null,p_method_profile_id uuid default null
)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company_id uuid:=public.get_my_company_id(); v_measurement_id uuid; v_scale_region public.takeoff_scale_regions%rowtype; v_profile public.takeoff_method_profiles%rowtype; v_requires_profile boolean:=false;
begin
  if v_company_id is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then raise exception 'Owner access required.'; end if;
  if p_sheet_id is null or not exists(select 1 from public.takeoff_sheets s where s.id=p_sheet_id and s.company_id=v_company_id and s.takeoff_set_id=p_takeoff_set_id) then raise exception 'Drawing sheet does not belong to this takeoff set.'; end if;
  if p_geometry is null or jsonb_typeof(p_geometry)<>'object' then raise exception 'Drawing geometry is required.'; end if;
  select exists(
    select 1 from public.concrete_assembly_variables v
    where v.company_id=v_company_id and v.assembly_version_id=p_assembly_version_id and v.requires_verification
      and v.input_role in ('method_decision','production_assumption','commercial_assumption')
      and public.carez_method_activation_matches(v.activation_rule,coalesce(p_variables,'{}'::jsonb))
  ) into v_requires_profile;
  if v_requires_profile then
    if p_method_profile_id is null then raise exception 'Verify the build method before starting this takeoff.'; end if;
    select * into v_profile from public.takeoff_method_profiles p where p.id=p_method_profile_id and p.company_id=v_company_id and p.takeoff_set_id=p_takeoff_set_id and p.assembly_version_id=p_assembly_version_id and p.status='verified';
    if not found then raise exception 'Verified build-method profile not found for this takeoff.'; end if;
    if exists(
      select 1 from public.concrete_assembly_variables v
      where v.company_id=v_company_id and v.assembly_version_id=p_assembly_version_id and v.requires_verification
        and v.input_role in ('method_decision','production_assumption','commercial_assumption')
        and public.carez_method_activation_matches(v.activation_rule,coalesce(p_variables,'{}'::jsonb))
        and (not (v_profile.method_inputs ? v.variable_key) or v_profile.method_inputs->v.variable_key is distinct from coalesce(p_variables,'{}'::jsonb)->v.variable_key)
    ) then raise exception 'Current builder assumptions do not match the verified build-method profile.'; end if;
  elsif p_method_profile_id is not null then
    select * into v_profile from public.takeoff_method_profiles p where p.id=p_method_profile_id and p.company_id=v_company_id and p.takeoff_set_id=p_takeoff_set_id and p.assembly_version_id=p_assembly_version_id and p.status='verified';
    if not found then raise exception 'Verified build-method profile not found for this takeoff.'; end if;
  end if;
  if p_measurement_type<>'count' then
    if p_scale_region_id is null then select id into p_scale_region_id from public.takeoff_scale_regions where company_id=v_company_id and sheet_id=p_sheet_id and is_default limit 1; end if;
    select * into v_scale_region from public.takeoff_scale_regions where id=p_scale_region_id and company_id=v_company_id and sheet_id=p_sheet_id;
    if v_scale_region.id is null then raise exception 'An accepted scale region is required for LF or SF takeoff.'; end if;
    if not public.carez_geometry_within_scale_bounds(p_geometry,v_scale_region.region_bounds) then raise exception 'Takeoff geometry must stay inside one accepted scale region.'; end if;
  end if;
  if v_requires_profile then perform set_config('carez.allow_unbound_method_profile_insert','1',true); end if;
  v_measurement_id:=public.carez_commit_takeoff_measurement(p_takeoff_set_id,p_estimate_section_id,p_assembly_version_id,p_name,p_location,p_drawing_reference,p_measurement_type,p_raw_quantity,p_raw_unit,p_variables,p_risk_class_code,p_outputs);
  if v_requires_profile then perform set_config('carez.allow_unbound_method_profile_insert','0',true); end if;
  update public.takeoff_measurements set sheet_id=p_sheet_id,geometry=p_geometry,source='drawing',scale_region_id=case when p_measurement_type='count' then null else p_scale_region_id end,method_profile_id=p_method_profile_id where id=v_measurement_id and company_id=v_company_id;
  return v_measurement_id;
end;
$$;
revoke all on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb,uuid,uuid) from public,anon;
grant execute on function public.carez_commit_drawing_measurement(uuid,uuid,uuid,uuid,text,text,text,text,numeric,text,jsonb,text,jsonb,jsonb,uuid,uuid) to authenticated,service_role;;
