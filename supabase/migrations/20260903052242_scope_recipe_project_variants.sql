alter table public.takeoff_method_profiles
  add column if not exists profile_kind text not null default 'method',
  add column if not exists variant_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.takeoff_method_profiles'::regclass
      and conname='takeoff_method_profiles_profile_kind_check'
  ) then
    alter table public.takeoff_method_profiles
      add constraint takeoff_method_profiles_profile_kind_check
      check (profile_kind in ('method','scope_variant'));
  end if;
end;
$$;

create index if not exists takeoff_scope_variants_idx
  on public.takeoff_method_profiles(company_id,takeoff_set_id,assembly_version_id,profile_kind,status,variant_code);

create or replace function public.carez_guard_takeoff_method_profile()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if old.status='retired' then raise exception 'Retired method profiles are immutable.'; end if;
  if old.status='verified' then
    if new.status='retired'
       and new.takeoff_set_id=old.takeoff_set_id
       and new.assembly_version_id=old.assembly_version_id
       and new.revision_no=old.revision_no
       and new.name=old.name
       and new.method_inputs=old.method_inputs
       and new.verification_notes is not distinct from old.verification_notes
       and new.profile_kind=old.profile_kind
       and new.variant_code is not distinct from old.variant_code then
      return new;
    end if;
    raise exception 'Verified method profiles and scope variants are immutable. Create a new revision.';
  end if;
  if old.status='draft' and new.status='verified'
     and coalesce(current_setting('carez.method_profile_verify',true),'')<>'1' then
    raise exception 'Use the verification action to verify builder assumptions or a project scope variant.';
  end if;
  return new;
end;
$$;

create or replace function public.carez_create_verified_takeoff_scope_variant(
  p_takeoff_set_id uuid,
  p_assembly_version_id uuid,
  p_name text,
  p_variant_code text,
  p_inputs jsonb,
  p_verification_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_profile_id uuid;
  v_revision integer;
  v_name text:=nullif(trim(coalesce(p_name,'')),'');
  v_code text:=upper(nullif(trim(coalesce(p_variant_code,'')),''));
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required.'; end if;
  if v_name is null then raise exception 'Project scope variant name is required.'; end if;
  if v_code is null then raise exception 'Project scope variant code is required.'; end if;
  if length(v_code)>40 then raise exception 'Project scope variant code is too long.'; end if;
  if p_inputs is null or jsonb_typeof(p_inputs)<>'object' then raise exception 'Project scope variant inputs must be an object.'; end if;

  perform 1 from public.takeoff_sets s
  where s.id=p_takeoff_set_id and s.company_id=v_company and s.status='active' for update;
  if not found then raise exception 'Active takeoff set not found.'; end if;

  if not exists (
    select 1 from public.concrete_assembly_versions v
    where v.id=p_assembly_version_id and v.company_id=v_company and v.status='published'
  ) then raise exception 'Published Scope Recipe version not found.'; end if;

  if exists (
    select 1 from public.concrete_assembly_variables v
    where v.company_id=v_company
      and v.assembly_version_id=p_assembly_version_id
      and v.required
      and v.input_role<>'derived'
      and public.carez_method_activation_matches(v.activation_rule,p_inputs)
      and not (p_inputs ? v.variable_key)
      and v.default_value is null
  ) then raise exception 'Resolve every required active recipe variable before saving the Project Scope Variant.'; end if;

  select coalesce(max(revision_no),0)+1 into v_revision
  from public.takeoff_method_profiles
  where company_id=v_company and takeoff_set_id=p_takeoff_set_id and assembly_version_id=p_assembly_version_id;

  insert into public.takeoff_method_profiles(
    company_id,takeoff_set_id,assembly_version_id,revision_no,name,status,method_inputs,
    verification_notes,verified_by,verified_at,created_by,profile_kind,variant_code
  ) values (
    v_company,p_takeoff_set_id,p_assembly_version_id,v_revision,v_name,'draft',p_inputs,
    nullif(trim(coalesce(p_verification_notes,'')),''),null,null,auth.uid(),'scope_variant',v_code
  ) returning id into v_profile_id;

  perform set_config('carez.method_profile_verify','1',true);
  update public.takeoff_method_profiles
  set status='verified',verified_by=auth.uid(),verified_at=now()
  where id=v_profile_id and company_id=v_company;
  return v_profile_id;
end;
$$;

revoke all on function public.carez_create_verified_takeoff_scope_variant(uuid,uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.carez_create_verified_takeoff_scope_variant(uuid,uuid,text,text,jsonb,text) to authenticated,service_role;

create or replace function public.carez_validate_measurement_method_profile()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_profile public.takeoff_method_profiles%rowtype;
begin
  if new.method_profile_id is null then
    if coalesce(current_setting('carez.allow_unbound_method_profile_insert',true),'')='1' then return new; end if;
    if exists (
      select 1 from public.concrete_assembly_variables v
      where v.company_id=new.company_id
        and v.assembly_version_id=new.assembly_version_id
        and v.requires_verification
        and v.input_role in ('method_decision','production_assumption','commercial_assumption')
        and public.carez_method_activation_matches(v.activation_rule,coalesce(new.variables,'{}'::jsonb))
    ) then raise exception 'Verify the build method or select a Project Scope Variant before creating or recalculating this takeoff.'; end if;
    return new;
  end if;

  select * into v_profile from public.takeoff_method_profiles p
  where p.id=new.method_profile_id
    and p.company_id=new.company_id
    and p.takeoff_set_id=new.takeoff_set_id
    and p.assembly_version_id=new.assembly_version_id
    and p.status='verified';
  if not found then raise exception 'Takeoff profile/variant must be verified and match the same takeoff set and Scope Recipe version.'; end if;

  if v_profile.profile_kind='scope_variant' then
    if not (coalesce(new.variables,'{}'::jsonb) @> v_profile.method_inputs) then
      raise exception 'Takeoff inputs changed from the selected Project Scope Variant. Save or select a new variant revision.';
    end if;
    return new;
  end if;

  if exists (
    select 1 from public.concrete_assembly_variables v
    where v.company_id=new.company_id
      and v.assembly_version_id=new.assembly_version_id
      and v.requires_verification
      and v.input_role in ('method_decision','production_assumption','commercial_assumption')
      and public.carez_method_activation_matches(v.activation_rule,coalesce(new.variables,'{}'::jsonb))
      and (
        not (v_profile.method_inputs ? v.variable_key)
        or v_profile.method_inputs->v.variable_key is distinct from coalesce(new.variables,'{}'::jsonb)->v.variable_key
      )
  ) then raise exception 'Builder or production assumptions changed. Verify a new build-method profile before recalculating this takeoff.'; end if;
  return new;
end;
$$;;
