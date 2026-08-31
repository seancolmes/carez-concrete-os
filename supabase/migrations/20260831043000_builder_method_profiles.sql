-- Carez P1: separate plan facts from verified builder means/method decisions.

alter table public.concrete_assembly_variables
  add column if not exists input_role text not null default 'legacy',
  add column if not exists requires_verification boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.concrete_assembly_variables'::regclass
      and conname='concrete_assembly_variables_input_role_check'
  ) then
    alter table public.concrete_assembly_variables
      add constraint concrete_assembly_variables_input_role_check
      check (input_role in ('legacy','plan_fact','method_decision','production_assumption','commercial_assumption','derived'));
  end if;
end;
$$;

create table if not exists public.takeoff_method_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  takeoff_set_id uuid not null,
  assembly_version_id uuid not null,
  revision_no integer not null default 1 check (revision_no > 0),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'draft' check (status in ('draft','verified','retired')),
  method_inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(method_inputs)='object'),
  verification_notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(takeoff_set_id,assembly_version_id,revision_no),
  foreign key(company_id) references public.companies(id) on delete cascade,
  foreign key(company_id,takeoff_set_id) references public.takeoff_sets(company_id,id) on delete cascade,
  foreign key(company_id,assembly_version_id) references public.concrete_assembly_versions(company_id,id) on delete restrict
);

create index if not exists takeoff_method_profiles_set_idx
  on public.takeoff_method_profiles(company_id,takeoff_set_id,assembly_version_id,status);

alter table public.takeoff_measurements
  add column if not exists method_profile_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.takeoff_measurements'::regclass
      and conname='takeoff_measurements_method_profile_company_fkey'
  ) then
    alter table public.takeoff_measurements
      add constraint takeoff_measurements_method_profile_company_fkey
      foreign key(company_id,method_profile_id)
      references public.takeoff_method_profiles(company_id,id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists takeoff_measurements_method_profile_idx
  on public.takeoff_measurements(company_id,method_profile_id)
  where method_profile_id is not null;

create or replace function public.carez_touch_takeoff_method_profile()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

create or replace function public.carez_guard_takeoff_method_profile()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if old.status='retired' then
    raise exception 'Retired method profiles are immutable.';
  end if;

  if old.status='verified' then
    if new.status='retired'
       and new.takeoff_set_id=old.takeoff_set_id
       and new.assembly_version_id=old.assembly_version_id
       and new.revision_no=old.revision_no
       and new.name=old.name
       and new.method_inputs=old.method_inputs
       and new.verification_notes is not distinct from old.verification_notes then
      return new;
    end if;
    raise exception 'Verified method profiles are immutable. Create a new profile revision.';
  end if;

  if old.status='draft' and new.status='verified'
     and coalesce(current_setting('carez.method_profile_verify',true),'')<>'1' then
    raise exception 'Use the method-profile verification action to verify builder assumptions.';
  end if;

  return new;
end;
$$;

drop trigger if exists takeoff_method_profiles_guard on public.takeoff_method_profiles;
create trigger takeoff_method_profiles_guard
before update on public.takeoff_method_profiles
for each row execute function public.carez_guard_takeoff_method_profile();

drop trigger if exists takeoff_method_profiles_touch on public.takeoff_method_profiles;
create trigger takeoff_method_profiles_touch
before update on public.takeoff_method_profiles
for each row execute function public.carez_touch_takeoff_method_profile();

alter table public.takeoff_method_profiles enable row level security;

drop policy if exists takeoff_method_profiles_select on public.takeoff_method_profiles;
create policy takeoff_method_profiles_select
on public.takeoff_method_profiles
for select to authenticated
using (company_id=public.get_my_company_id());

drop policy if exists takeoff_method_profiles_insert on public.takeoff_method_profiles;
create policy takeoff_method_profiles_insert
on public.takeoff_method_profiles
for insert to authenticated
with check (
  company_id=public.get_my_company_id()
  and public.get_my_role()<>'employee'
  and status='draft'
);

drop policy if exists takeoff_method_profiles_update on public.takeoff_method_profiles;
create policy takeoff_method_profiles_update
on public.takeoff_method_profiles
for update to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

drop policy if exists takeoff_method_profiles_delete on public.takeoff_method_profiles;
create policy takeoff_method_profiles_delete
on public.takeoff_method_profiles
for delete to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee' and status='draft');

revoke all on table public.takeoff_method_profiles from public,anon;
grant select,insert,update,delete on table public.takeoff_method_profiles to authenticated;

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
      and not (v_profile.method_inputs ? v.variable_key)
  ) then
    raise exception 'Verify every required builder/production assumption before starting takeoff.';
  end if;

  perform set_config('carez.method_profile_verify','1',true);
  update public.takeoff_method_profiles
  set status='verified',verified_by=auth.uid(),verified_at=now()
  where id=v_profile.id and company_id=v_company;
end;
$$;

revoke all on function public.carez_verify_takeoff_method_profile(uuid) from public,anon;
grant execute on function public.carez_verify_takeoff_method_profile(uuid) to authenticated,service_role;

-- Preserve the new variable-role metadata when an immutable published assembly is revised.
create or replace function public.carez_create_assembly_revision(p_assembly_version_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id(); v_source public.concrete_assembly_versions%rowtype; v_assembly public.concrete_assemblies%rowtype; v_new uuid; v_next integer;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required.'; end if;
  select * into v_source from public.concrete_assembly_versions where id=p_assembly_version_id and company_id=v_company; if not found then raise exception 'Assembly version not found.'; end if;
  if v_source.status='draft' then raise exception 'Continue editing the existing draft instead of creating a revision from it.'; end if;
  select * into v_assembly from public.concrete_assemblies where id=v_source.assembly_id and company_id=v_company for update; if not found then raise exception 'Assembly not found.'; end if;
  if exists(select 1 from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id and status='draft') then raise exception 'This assembly already has a draft revision.'; end if;
  select coalesce(max(version_no),0)+1 into v_next from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_source.assembly_id;
  insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes,assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,render_config,created_by) values(v_company,v_source.assembly_id,v_next,'draft',v_source.source_type,v_source.source_label,v_source.source_year,v_source.source_reference,v_source.default_risk_class_code,v_source.notes,v_assembly.code,v_assembly.name,v_assembly.category,v_assembly.primary_measurement,v_assembly.description,v_source.render_config,auth.uid()) returning id into v_new;
  insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override,activation_rule,input_role,requires_verification) select company_id,v_new,variable_key,label,value_type,unit,default_value,options,dimension_family,min_value,max_value,required,help_text,sort_order,property_group,expose_in_takeoff,allow_override,activation_rule,input_role,requires_verification from public.concrete_assembly_variables where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order,activation_rule,resource_behavior,estimate_visible) select company_id,v_new,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,default_unit_cost,labor_task,notes,sort_order,activation_rule,resource_behavior,estimate_visible from public.concrete_assembly_components where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_children(company_id,assembly_version_id,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,activation_rule,sort_order,created_by) select company_id,v_new,child_assembly_version_id,child_key,label,quantity_formula,variable_bindings,activation_rule,sort_order,auth.uid() from public.concrete_assembly_children where company_id=v_company and assembly_version_id=v_source.id;
  insert into public.concrete_assembly_property_bindings(company_id,assembly_version_id,variable_id,source_namespace,source_key,precedence,notes,sort_order,created_by) select b.company_id,v_new,nv.id,b.source_namespace,b.source_key,b.precedence,b.notes,b.sort_order,auth.uid() from public.concrete_assembly_property_bindings b join public.concrete_assembly_variables ov on ov.id=b.variable_id and ov.company_id=b.company_id join public.concrete_assembly_variables nv on nv.company_id=b.company_id and nv.assembly_version_id=v_new and nv.variable_key=ov.variable_key where b.company_id=v_company and b.assembly_version_id=v_source.id;
  return v_new;
end;
$$;
revoke all on function public.carez_create_assembly_revision(uuid) from public,anon;
grant execute on function public.carez_create_assembly_revision(uuid) to authenticated,service_role;
