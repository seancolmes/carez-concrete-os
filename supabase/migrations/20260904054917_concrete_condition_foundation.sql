-- Carez P0.5A/C: additive Concrete Condition domain foundation.
--
-- Legacy assembly/recipe tables and atomic Takeoff RPCs intentionally remain
-- unchanged. New Conditions can bind to immutable legacy assembly/component
-- IDs at the persistence edge while calculation authority moves to governed
-- Condition algorithms.

create table public.platform_condition_archetypes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) > 0),
  family text not null check (family in ('footing','slab')),
  primary_measurement_unit text not null check (primary_measurement_unit in ('EA','LF','SF')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_condition_archetype_versions (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.platform_condition_archetypes(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  archetype_code_snapshot text not null check (length(trim(archetype_code_snapshot)) > 0),
  archetype_name_snapshot text not null check (length(trim(archetype_name_snapshot)) > 0),
  family_snapshot text not null check (family_snapshot in ('footing','slab')),
  primary_measurement_unit_snapshot text not null check (primary_measurement_unit_snapshot in ('EA','LF','SF')),
  engine_key text not null check (length(trim(engine_key)) > 0),
  role_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(role_schema) = 'array'),
  input_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(input_schema) = 'array'),
  module_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(module_schema) = 'array'),
  output_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(output_schema) = 'array'),
  projection_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(projection_schema) = 'object'),
  notes text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(archetype_id,version_no)
);

create unique index platform_condition_archetype_one_draft_uk
  on public.platform_condition_archetype_versions(archetype_id)
  where status = 'draft';

create table public.company_condition_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  archetype_id uuid not null references public.platform_condition_archetypes(id) on delete restrict,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  description text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,code)
);

create table public.company_condition_template_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null,
  archetype_version_id uuid not null references public.platform_condition_archetype_versions(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  template_code_snapshot text not null check (length(trim(template_code_snapshot)) > 0),
  template_name_snapshot text not null check (length(trim(template_name_snapshot)) > 0),
  template_description_snapshot text,
  module_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(module_defaults) = 'object'),
  input_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(input_defaults) = 'object'),
  input_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(input_provenance) = 'object'),
  pricing_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(pricing_defaults) = 'object'),
  legacy_assembly_version_id uuid,
  notes text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(template_id,version_no),
  foreign key(company_id,template_id)
    references public.company_condition_templates(company_id,id)
    on delete cascade,
  foreign key(company_id,legacy_assembly_version_id)
    references public.concrete_assembly_versions(company_id,id)
    on delete restrict
);

create unique index company_condition_template_one_draft_uk
  on public.company_condition_template_versions(template_id)
  where status = 'draft';

create index company_condition_template_versions_lookup_idx
  on public.company_condition_template_versions(company_id,template_id,status,version_no desc);

create table public.condition_legacy_output_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_version_id uuid not null,
  output_key text not null check (length(trim(output_key)) > 0),
  legacy_assembly_component_id uuid not null references public.concrete_assembly_components(id) on delete restrict,
  legacy_component_key_snapshot text not null check (length(trim(legacy_component_key_snapshot)) > 0),
  output_unit_snapshot text not null check (length(trim(output_unit_snapshot)) > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(template_version_id,output_key),
  unique(template_version_id,legacy_assembly_component_id),
  foreign key(company_id,template_version_id)
    references public.company_condition_template_versions(company_id,id)
    on delete cascade
);

create table public.project_concrete_conditions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null,
  template_id uuid not null,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  description text,
  status text not null default 'active' check (status in ('active','excluded','retired')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(takeoff_set_id,code),
  foreign key(company_id,takeoff_set_id)
    references public.takeoff_sets(company_id,id)
    on delete cascade,
  foreign key(company_id,template_id)
    references public.company_condition_templates(company_id,id)
    on delete restrict
);

create index project_concrete_conditions_set_idx
  on public.project_concrete_conditions(company_id,takeoff_set_id,status,code);

create table public.project_concrete_condition_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  condition_id uuid not null,
  template_version_id uuid not null,
  archetype_version_id uuid not null references public.platform_condition_archetype_versions(id) on delete restrict,
  revision_no integer not null check (revision_no > 0),
  status text not null default 'draft' check (status in ('draft','verified')),
  condition_code_snapshot text not null check (length(trim(condition_code_snapshot)) > 0),
  condition_name_snapshot text not null check (length(trim(condition_name_snapshot)) > 0),
  condition_description_snapshot text,
  plan_facts jsonb not null default '{}'::jsonb check (jsonb_typeof(plan_facts) = 'object'),
  method_inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(method_inputs) = 'object'),
  production_inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(production_inputs) = 'object'),
  commercial_inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(commercial_inputs) = 'object'),
  drawing_inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(drawing_inputs) = 'object'),
  input_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(input_provenance) = 'object'),
  output_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(output_overrides) = 'object'),
  legacy_method_profile_id uuid,
  source_version_id uuid,
  verification_notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(condition_id,revision_no),
  foreign key(company_id,condition_id)
    references public.project_concrete_conditions(company_id,id)
    on delete cascade,
  foreign key(company_id,template_version_id)
    references public.company_condition_template_versions(company_id,id)
    on delete restrict,
  foreign key(company_id,legacy_method_profile_id)
    references public.takeoff_method_profiles(company_id,id)
    on delete restrict,
  foreign key(company_id,source_version_id)
    references public.project_concrete_condition_versions(company_id,id)
    on delete restrict
);

create unique index project_condition_one_draft_uk
  on public.project_concrete_condition_versions(condition_id)
  where status = 'draft';

create index project_condition_versions_lookup_idx
  on public.project_concrete_condition_versions(company_id,condition_id,status,revision_no desc);

create table public.project_condition_module_instances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  condition_version_id uuid not null,
  module_key text not null check (module_key in ('concrete','forms','reinforcing','anchors_embeds','slab_systems','excavation_backfill','placement_equipment','finish_cure_protection','labor','miscellaneous')),
  instance_key text not null default 'default' check (length(trim(instance_key)) > 0),
  label text not null check (length(trim(label)) > 0),
  enabled boolean not null default true,
  input_values jsonb not null default '{}'::jsonb check (jsonb_typeof(input_values) = 'object'),
  input_provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(input_provenance) = 'object'),
  legacy_child_key text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(condition_version_id,module_key,instance_key),
  foreign key(company_id,condition_version_id)
    references public.project_concrete_condition_versions(company_id,id)
    on delete cascade
);

create index project_condition_modules_version_idx
  on public.project_condition_module_instances(company_id,condition_version_id,sort_order,module_key);

create table public.project_condition_measurement_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  condition_version_id uuid not null,
  measurement_id uuid not null,
  role_key text not null check (length(trim(role_key)) > 0),
  role_instance_key text not null check (length(trim(role_instance_key)) > 0),
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(condition_version_id,measurement_id),
  unique(condition_version_id,role_key,role_instance_key),
  foreign key(company_id,condition_version_id)
    references public.project_concrete_condition_versions(company_id,id)
    on delete cascade,
  foreign key(company_id,measurement_id)
    references public.takeoff_measurements(company_id,id)
    on delete restrict
);

create index project_condition_roles_version_idx
  on public.project_condition_measurement_roles(company_id,condition_version_id,role_key,sort_order);

create table public.project_condition_outputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  condition_version_id uuid not null,
  module_instance_id uuid,
  driver_measurement_role_id uuid,
  output_key text not null check (length(trim(output_key)) > 0),
  output_instance_key text not null default 'default' check (length(trim(output_instance_key)) > 0),
  label text not null check (length(trim(label)) > 0),
  resource_class text not null check (resource_class in ('material','labor','equipment','other')),
  production_quantity numeric,
  production_unit text not null check (length(trim(production_unit)) > 0),
  quantity_mode text not null default 'derived' check (quantity_mode in ('derived','explicit_override')),
  status text not null check (status in ('ready','held','inactive')),
  estimated_man_hours numeric not null default 0 check (estimated_man_hours >= 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  direct_cost numeric not null default 0 check (direct_cost >= 0),
  pricing_status text not null default 'missing_price' check (pricing_status in ('priced','missing_price','not_priced','manual_override','missing_labor_rate','missing_input')),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  calculation_trace jsonb not null default '{}'::jsonb check (jsonb_typeof(calculation_trace) = 'object'),
  legacy_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete restrict,
  generated_estimate_item_id uuid references public.estimate_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,condition_version_id)
    references public.project_concrete_condition_versions(company_id,id)
    on delete cascade,
  foreign key(company_id,module_instance_id)
    references public.project_condition_module_instances(company_id,id)
    on delete restrict,
  foreign key(company_id,driver_measurement_role_id)
    references public.project_condition_measurement_roles(company_id,id)
    on delete restrict,
  constraint project_condition_outputs_quantity_chk check (
    (status = 'held' and production_quantity is null)
    or (status in ('ready','inactive') and production_quantity is not null and production_quantity >= 0)
  )
);

create unique index project_condition_outputs_identity_uk
  on public.project_condition_outputs(
    condition_version_id,
    coalesce(module_instance_id,'00000000-0000-0000-0000-000000000000'::uuid),
    output_key,
    output_instance_key
  );

create index project_condition_outputs_version_idx
  on public.project_condition_outputs(company_id,condition_version_id,status,output_key);

create table public.project_condition_holds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  condition_version_id uuid not null,
  output_id uuid,
  hold_code text not null check (hold_code in ('input_required','labor_rate_required','method_verification_required','price_required','review_required','3d_input_required')),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  message text not null check (length(trim(message)) > 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,condition_version_id)
    references public.project_concrete_condition_versions(company_id,id)
    on delete cascade,
  foreign key(company_id,output_id)
    references public.project_condition_outputs(company_id,id)
    on delete cascade,
  constraint project_condition_holds_resolution_chk check (
    (status = 'open' and resolved_at is null)
    or (status in ('resolved','dismissed') and resolved_at is not null)
  )
);

create unique index project_condition_holds_open_uk
  on public.project_condition_holds(
    condition_version_id,
    coalesce(output_id,'00000000-0000-0000-0000-000000000000'::uuid),
    hold_code,
    message
  ) where status = 'open';

create index project_condition_holds_version_idx
  on public.project_condition_holds(company_id,condition_version_id,status,hold_code);

create or replace function public.carez_condition_json_value_matches_type(p_value jsonb,p_type text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case p_type
    when 'number' then jsonb_typeof(p_value) = 'number'
    when 'integer' then case
      when jsonb_typeof(p_value) = 'number' then (p_value #>> '{}')::numeric = trunc((p_value #>> '{}')::numeric)
      else false
    end
    when 'boolean' then jsonb_typeof(p_value) = 'boolean'
    when 'text' then jsonb_typeof(p_value) = 'string'
    when 'select' then jsonb_typeof(p_value) = 'string'
    else false
  end;
$$;

create or replace function public.carez_condition_input_group_is_valid(
  p_input_schema jsonb,
  p_group text,
  p_values jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_values) = 'object'
    and not exists (
      select 1
      from jsonb_each(p_values) supplied
      where not exists (
        select 1
        from jsonb_array_elements(p_input_schema) definition
        where definition->>'key' = supplied.key
          and definition->>'group' = p_group
          and public.carez_condition_json_value_matches_type(supplied.value,definition->>'value_type')
          and case
            when definition ? 'minimum' and jsonb_typeof(supplied.value) = 'number'
              then (supplied.value #>> '{}')::numeric >= (definition->>'minimum')::numeric
            else true
          end
          and case
            when definition ? 'maximum' and jsonb_typeof(supplied.value) = 'number'
              then (supplied.value #>> '{}')::numeric <= (definition->>'maximum')::numeric
            else true
          end
      )
    );
$$;

create or replace function public.carez_condition_output_overrides_are_valid(p_overrides jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_overrides) = 'object'
    and not exists (
      select 1
      from jsonb_each(p_overrides) item
      where case
        when jsonb_typeof(item.value) <> 'object' then true
        when jsonb_typeof(item.value->'quantity') is distinct from 'number' then true
        when (item.value->>'quantity')::numeric < 0 then true
        when jsonb_typeof(item.value->'reason') is distinct from 'string' then true
        when length(trim(item.value->>'reason')) = 0 then true
        else false
      end
    );
$$;

create or replace function public.carez_condition_archetype_schema_is_valid(
  p_role_schema jsonb,
  p_input_schema jsonb,
  p_module_schema jsonb,
  p_output_schema jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_role_schema) = 'array'
    and jsonb_array_length(p_role_schema) > 0
    and (
      select count(*)
      from jsonb_array_elements(p_role_schema) role
      where coalesce((role->>'primary')::boolean,false)
    ) = 1
    and not exists (
      select 1 from jsonb_array_elements(p_role_schema) role
      where nullif(trim(role->>'key'),'') is null
        or role->>'unit' not in ('EA','LF','SF')
        or role->>'geometry_type' not in ('count','polyline','polygon')
        or (role->>'unit' = 'EA' and role->>'geometry_type' <> 'count')
        or (role->>'unit' = 'LF' and role->>'geometry_type' <> 'polyline')
        or (role->>'unit' = 'SF' and role->>'geometry_type' <> 'polygon')
    )
    and (
      select count(*) = count(distinct role->>'key')
      from jsonb_array_elements(p_role_schema) role
    )
    and not exists (
      select 1 from jsonb_array_elements(p_input_schema) input
      where nullif(trim(input->>'key'),'') is null
        or input->>'group' not in ('planFacts','methods','production','commercial','drawing')
        or input->>'value_type' not in ('number','integer','boolean','text','select')
    )
    and (
      select count(*) = count(distinct (input->>'group') || ':' || (input->>'key'))
      from jsonb_array_elements(p_input_schema) input
    )
    and not exists (
      select 1 from jsonb_array_elements(p_module_schema) module
      where nullif(trim(module->>'key'),'') is null
    )
    and (
      select count(*) = count(distinct module->>'key')
      from jsonb_array_elements(p_module_schema) module
    )
    and not exists (
      select 1 from jsonb_array_elements(p_output_schema) output
      where nullif(trim(output->>'key'),'') is null
        or nullif(trim(output->>'algorithm'),'') is null
        or output->>'unit' not in ('CY','SF','LB','EA','HR')
        or not exists (
          select 1 from jsonb_array_elements(p_module_schema) module
          where module->>'key' = output->>'module_key'
        )
    )
    and (
      select count(*) = count(distinct output->>'key')
      from jsonb_array_elements(p_output_schema) output
    );
$$;

revoke all on function public.carez_condition_json_value_matches_type(jsonb,text) from public,anon;
revoke all on function public.carez_condition_input_group_is_valid(jsonb,text,jsonb) from public,anon;
revoke all on function public.carez_condition_output_overrides_are_valid(jsonb) from public,anon;
revoke all on function public.carez_condition_archetype_schema_is_valid(jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.carez_condition_json_value_matches_type(jsonb,text) to authenticated,service_role;
grant execute on function public.carez_condition_input_group_is_valid(jsonb,text,jsonb) to authenticated,service_role;
grant execute on function public.carez_condition_output_overrides_are_valid(jsonb) to authenticated,service_role;
grant execute on function public.carez_condition_archetype_schema_is_valid(jsonb,jsonb,jsonb,jsonb) to authenticated,service_role;

create or replace function public.carez_condition_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.carez_condition_touch_updated_at() from public,anon,authenticated;

create or replace function public.carez_guard_platform_condition_archetype_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_archetype public.platform_condition_archetypes%rowtype;
begin
  if tg_op in ('UPDATE','DELETE') and old.status in ('published','retired') then
    raise exception 'Published Platform Condition Archetype versions are immutable. Create a new version.';
  end if;

  if tg_op <> 'DELETE' then
    select * into v_archetype from public.platform_condition_archetypes where id = new.archetype_id;
    if not found then raise exception 'Platform Condition Archetype not found.'; end if;
    new.archetype_code_snapshot := v_archetype.code;
    new.archetype_name_snapshot := v_archetype.name;
    new.family_snapshot := v_archetype.family;
    new.primary_measurement_unit_snapshot := v_archetype.primary_measurement_unit;
  end if;

  if tg_op <> 'DELETE' and new.status = 'published' then
    if not public.carez_condition_archetype_schema_is_valid(new.role_schema,new.input_schema,new.module_schema,new.output_schema) then
      raise exception 'Platform Condition Archetype schema is invalid.';
    end if;
    new.published_at := coalesce(new.published_at,now());
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_platform_condition_archetype_version() from public,anon,authenticated;

create or replace function public.carez_validate_company_condition_template_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template public.company_condition_templates%rowtype;
  v_archetype_version public.platform_condition_archetype_versions%rowtype;
  v_legacy_status text;
begin
  select * into v_template
  from public.company_condition_templates
  where id = new.template_id and company_id = new.company_id;
  if not found then raise exception 'Company Condition Template not found.'; end if;

  new.template_code_snapshot := v_template.code;
  new.template_name_snapshot := v_template.name;
  new.template_description_snapshot := v_template.description;

  select * into v_archetype_version
  from public.platform_condition_archetype_versions
  where id = new.archetype_version_id;
  if not found or v_archetype_version.archetype_id <> v_template.archetype_id then
    raise exception 'Condition Template archetype version does not match its archetype.';
  end if;

  if new.legacy_assembly_version_id is not null then
    select status into v_legacy_status
    from public.concrete_assembly_versions
    where id = new.legacy_assembly_version_id and company_id = new.company_id;
    if v_legacy_status is distinct from 'published' then
      raise exception 'Condition compatibility requires an immutable published legacy assembly version.';
    end if;
  end if;

  if not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'planFacts',coalesce(new.input_defaults->'planFacts','{}'::jsonb))
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'methods',coalesce(new.input_defaults->'methods','{}'::jsonb))
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'production',coalesce(new.input_defaults->'production','{}'::jsonb))
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'commercial',coalesce(new.input_defaults->'commercial','{}'::jsonb))
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'drawing',coalesce(new.input_defaults->'drawing','{}'::jsonb)) then
    raise exception 'Company Condition Template defaults do not match the typed archetype schema.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(new.input_defaults) supplied(key)
    where supplied.key not in ('planFacts','methods','production','commercial','drawing')
  ) then raise exception 'Company Condition Template defaults contain an unknown input group.'; end if;
  if exists (
    select 1 from jsonb_object_keys(new.module_defaults) supplied(key)
    where not exists (
      select 1 from jsonb_array_elements(v_archetype_version.module_schema) module
      where module->>'key' = supplied.key
    )
  ) then raise exception 'Company Condition Template defaults contain an unsupported module.'; end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_company_condition_template_version() from public,anon,authenticated;

create or replace function public.carez_guard_company_condition_template_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.status in ('published','retired') then
    raise exception 'Published Company Condition Template versions are immutable. Create a new version.';
  end if;

  if tg_op <> 'DELETE' and new.status = 'published' then
    if coalesce(current_setting('carez.condition_template_publish',true),'') <> '1' then
      raise exception 'Use the Condition Template publish action.';
    end if;
    new.published_at := coalesce(new.published_at,now());
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_company_condition_template_version() from public,anon,authenticated;

create or replace function public.carez_guard_company_condition_template_child()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then v_version_id := old.template_version_id;
  else v_version_id := new.template_version_id;
  end if;

  select status into v_status from public.company_condition_template_versions where id = v_version_id;
  if v_status in ('published','retired') then
    raise exception 'Published Company Condition Template mappings are immutable. Create a new version.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_company_condition_template_child() from public,anon,authenticated;

create or replace function public.carez_validate_condition_legacy_output_mapping()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template_version public.company_condition_template_versions%rowtype;
  v_component public.concrete_assembly_components%rowtype;
  v_output jsonb;
begin
  select * into v_template_version
  from public.company_condition_template_versions
  where id = new.template_version_id and company_id = new.company_id;
  if not found or v_template_version.legacy_assembly_version_id is null then
    raise exception 'Legacy output mappings require a compatible legacy assembly version.';
  end if;

  select * into v_component
  from public.concrete_assembly_components
  where id = new.legacy_assembly_component_id
    and company_id = new.company_id
    and assembly_version_id = v_template_version.legacy_assembly_version_id;
  if not found then raise exception 'Legacy output component does not belong to the mapped assembly version.'; end if;

  select output into v_output
  from public.platform_condition_archetype_versions version,
       lateral jsonb_array_elements(version.output_schema) output
  where version.id = v_template_version.archetype_version_id
    and output->>'key' = new.output_key;
  if v_output is null then raise exception 'Condition output key is not defined by this archetype version.'; end if;
  if upper(v_output->>'unit') <> upper(v_component.output_unit) then
    raise exception 'Condition and legacy output units do not match.';
  end if;

  new.legacy_component_key_snapshot := v_component.component_key;
  new.output_unit_snapshot := v_component.output_unit;
  return new;
end;
$$;

revoke all on function public.carez_validate_condition_legacy_output_mapping() from public,anon,authenticated;

create or replace function public.carez_validate_project_condition_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_condition public.project_concrete_conditions%rowtype;
  v_template_version public.company_condition_template_versions%rowtype;
  v_archetype_version public.platform_condition_archetype_versions%rowtype;
  v_template_archetype_id uuid;
  v_profile public.takeoff_method_profiles%rowtype;
begin
  select * into v_condition
  from public.project_concrete_conditions
  where id = new.condition_id and company_id = new.company_id;
  if not found then raise exception 'Project Concrete Condition not found.'; end if;

  new.condition_code_snapshot := v_condition.code;
  new.condition_name_snapshot := v_condition.name;
  new.condition_description_snapshot := v_condition.description;

  select * into v_template_version
  from public.company_condition_template_versions
  where id = new.template_version_id and company_id = new.company_id and status = 'published';
  if not found or v_template_version.template_id <> v_condition.template_id then
    raise exception 'Project Condition requires a published version of its selected Company Condition Template.';
  end if;

  select archetype_id into v_template_archetype_id
  from public.company_condition_templates
  where id = v_template_version.template_id and company_id = new.company_id;

  select * into v_archetype_version
  from public.platform_condition_archetype_versions
  where id = new.archetype_version_id and status = 'published';
  if not found
     or v_archetype_version.id <> v_template_version.archetype_version_id
     or v_archetype_version.archetype_id <> v_template_archetype_id then
    raise exception 'Project Condition archetype lineage does not match the published Company Condition Template.';
  end if;

  if not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'planFacts',new.plan_facts)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'methods',new.method_inputs)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'production',new.production_inputs)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'commercial',new.commercial_inputs)
     or not public.carez_condition_input_group_is_valid(v_archetype_version.input_schema,'drawing',new.drawing_inputs) then
    raise exception 'Project Condition inputs do not match the typed archetype schema.';
  end if;

  if not public.carez_condition_output_overrides_are_valid(new.output_overrides) then
    raise exception 'Project Condition output overrides require a nonnegative quantity and reason.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(new.output_overrides) supplied(key)
    where not exists (
      select 1 from jsonb_array_elements(v_archetype_version.output_schema) output
      where output->>'key' = supplied.key
    )
  ) then raise exception 'Project Condition contains an override for an unknown output.'; end if;

  if new.legacy_method_profile_id is not null then
    if v_template_version.legacy_assembly_version_id is null then
      raise exception 'A legacy method profile requires a compatible legacy assembly version.';
    end if;
    select * into v_profile
    from public.takeoff_method_profiles
    where id = new.legacy_method_profile_id
      and company_id = new.company_id
      and takeoff_set_id = v_condition.takeoff_set_id
      and assembly_version_id = v_template_version.legacy_assembly_version_id
      and status = 'verified';
    if not found then
      raise exception 'Legacy method profile must be verified and match the Condition takeoff set and compatibility assembly.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_version() from public,anon,authenticated;

create or replace function public.carez_guard_project_condition_version()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.status = 'verified' then
    raise exception 'Verified Project Concrete Condition versions are immutable. Create a new revision.';
  end if;

  if tg_op <> 'DELETE' and new.status = 'verified' then
    if coalesce(current_setting('carez.project_condition_verify',true),'') <> '1' then
      raise exception 'Use the Project Condition verification action.';
    end if;
    new.verified_at := coalesce(new.verified_at,now());
    new.verified_by := coalesce(new.verified_by,auth.uid());
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_project_condition_version() from public,anon,authenticated;

create or replace function public.carez_guard_project_condition_child()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then v_version_id := old.condition_version_id;
  else v_version_id := new.condition_version_id;
  end if;

  select status into v_status from public.project_concrete_condition_versions where id = v_version_id;
  if v_status = 'verified' then
    raise exception 'Verified Project Concrete Condition details are immutable. Create a new revision.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_project_condition_child() from public,anon,authenticated;

create or replace function public.carez_validate_project_condition_module()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_module jsonb;
begin
  select module into v_module
  from public.project_concrete_condition_versions condition_version
  join public.platform_condition_archetype_versions archetype_version
    on archetype_version.id = condition_version.archetype_version_id,
  lateral jsonb_array_elements(archetype_version.module_schema) module
  where condition_version.id = new.condition_version_id
    and condition_version.company_id = new.company_id
    and module->>'key' = new.module_key;

  if v_module is null then
    raise exception 'Condition module is not supported by the selected archetype version.';
  end if;
  if coalesce((v_module->>'repeatable')::boolean,false) = false and new.instance_key <> 'default' then
    raise exception 'This Condition module is not repeatable.';
  end if;
  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_module() from public,anon,authenticated;

create or replace function public.carez_validate_project_condition_measurement_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_condition public.project_concrete_conditions%rowtype;
  v_condition_version public.project_concrete_condition_versions%rowtype;
  v_template_version public.company_condition_template_versions%rowtype;
  v_measurement public.takeoff_measurements%rowtype;
  v_role jsonb;
begin
  select * into v_condition_version
  from public.project_concrete_condition_versions
  where id = new.condition_version_id and company_id = new.company_id;
  if not found then raise exception 'Project Condition version not found.'; end if;

  select * into v_condition
  from public.project_concrete_conditions
  where id = v_condition_version.condition_id and company_id = new.company_id;

  select * into v_template_version
  from public.company_condition_template_versions
  where id = v_condition_version.template_version_id and company_id = new.company_id;

  select role into v_role
  from public.platform_condition_archetype_versions version,
       lateral jsonb_array_elements(version.role_schema) role
  where version.id = v_condition_version.archetype_version_id
    and role->>'key' = new.role_key;
  if v_role is null then raise exception 'Measurement role is not supported by the selected archetype version.'; end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id = new.measurement_id
    and company_id = new.company_id
    and takeoff_set_id = v_condition.takeoff_set_id;
  if not found then raise exception 'Measurement role must reference geometry from the same company and takeoff set.'; end if;

  if upper(v_measurement.raw_unit) <> upper(v_role->>'unit')
     or v_measurement.measurement_type <> v_role->>'measurement_type' then
    raise exception 'Measurement unit/type does not match the Condition role contract.';
  end if;

  if new.is_primary <> coalesce((v_role->>'primary')::boolean,false) then
    raise exception 'Measurement primary/secondary designation does not match the Condition role contract.';
  end if;

  if v_template_version.legacy_assembly_version_id is not null
     and v_measurement.assembly_version_id <> v_template_version.legacy_assembly_version_id then
    raise exception 'Condition role measurement does not use the selected compatibility assembly version.';
  end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_measurement_role() from public,anon,authenticated;

create or replace function public.carez_validate_project_condition_output()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_condition_version public.project_concrete_condition_versions%rowtype;
  v_output_definition jsonb;
  v_module public.project_condition_module_instances%rowtype;
  v_role public.project_condition_measurement_roles%rowtype;
  v_legacy_output public.takeoff_measurement_outputs%rowtype;
begin
  select * into v_condition_version
  from public.project_concrete_condition_versions
  where id = new.condition_version_id and company_id = new.company_id;
  if not found then raise exception 'Project Condition version not found.'; end if;

  select output into v_output_definition
  from public.platform_condition_archetype_versions version,
       lateral jsonb_array_elements(version.output_schema) output
  where version.id = v_condition_version.archetype_version_id
    and output->>'key' = new.output_key;
  if v_output_definition is null then raise exception 'Condition output is not defined by the selected archetype version.'; end if;
  if upper(new.production_unit) <> upper(v_output_definition->>'unit')
     or new.resource_class <> v_output_definition->>'resource_class' then
    raise exception 'Condition output unit/resource class does not match the archetype contract.';
  end if;

  if new.module_instance_id is not null then
    select * into v_module
    from public.project_condition_module_instances
    where id = new.module_instance_id
      and company_id = new.company_id
      and condition_version_id = new.condition_version_id;
    if not found or v_module.module_key <> v_output_definition->>'module_key' then
      raise exception 'Condition output module does not match the archetype output definition.';
    end if;
  end if;

  if new.driver_measurement_role_id is not null then
    select * into v_role
    from public.project_condition_measurement_roles
    where id = new.driver_measurement_role_id
      and company_id = new.company_id
      and condition_version_id = new.condition_version_id;
    if not found then raise exception 'Condition output driver role does not belong to this Condition version.'; end if;
  end if;

  if new.quantity_mode = 'explicit_override' then
    if jsonb_typeof(new.provenance->'override') <> 'object'
       or nullif(trim(new.provenance->'override'->>'reason'),'') is null then
      raise exception 'Explicit Condition output overrides require provenance and a reason.';
    end if;
  end if;

  if new.legacy_takeoff_output_id is not null then
    select legacy_output.* into v_legacy_output
    from public.takeoff_measurement_outputs legacy_output
    where legacy_output.id = new.legacy_takeoff_output_id
      and legacy_output.company_id = new.company_id;
    if not found then raise exception 'Legacy Takeoff output not found.'; end if;

    if not exists (
      select 1
      from public.project_condition_measurement_roles role
      join public.condition_legacy_output_mappings mapping
        on mapping.company_id = new.company_id
       and mapping.template_version_id = v_condition_version.template_version_id
       and mapping.output_key = new.output_key
       and mapping.legacy_assembly_component_id = v_legacy_output.assembly_component_id
      where role.company_id = new.company_id
        and role.condition_version_id = new.condition_version_id
        and role.measurement_id = v_legacy_output.measurement_id
    ) then
      raise exception 'Legacy Takeoff output is not mapped to this Condition output and measurement role.';
    end if;

    if new.generated_estimate_item_id is distinct from v_legacy_output.generated_estimate_item_id then
      raise exception 'Condition output estimate-item lineage does not match the legacy atomic commit.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_output() from public,anon,authenticated;

create or replace function public.carez_validate_project_condition_hold()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.output_id is not null and not exists (
    select 1
    from public.project_condition_outputs output
    where output.id = new.output_id
      and output.company_id = new.company_id
      and output.condition_version_id = new.condition_version_id
  ) then
    raise exception 'Condition hold output does not belong to this Condition version.';
  end if;
  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_hold() from public,anon,authenticated;

create trigger platform_condition_archetypes_touch
before update on public.platform_condition_archetypes
for each row execute function public.carez_condition_touch_updated_at();

create trigger platform_condition_archetype_versions_touch
before update on public.platform_condition_archetype_versions
for each row execute function public.carez_condition_touch_updated_at();

create trigger platform_condition_archetype_versions_guard
before insert or update or delete on public.platform_condition_archetype_versions
for each row execute function public.carez_guard_platform_condition_archetype_version();

create trigger company_condition_templates_touch
before update on public.company_condition_templates
for each row execute function public.carez_condition_touch_updated_at();

create trigger company_condition_template_versions_touch
before update on public.company_condition_template_versions
for each row execute function public.carez_condition_touch_updated_at();

create trigger company_condition_template_versions_validate
before insert or update on public.company_condition_template_versions
for each row execute function public.carez_validate_company_condition_template_version();

create trigger company_condition_template_versions_guard
before insert or update or delete on public.company_condition_template_versions
for each row execute function public.carez_guard_company_condition_template_version();

create trigger condition_legacy_output_mappings_guard
before insert or update or delete on public.condition_legacy_output_mappings
for each row execute function public.carez_guard_company_condition_template_child();

create trigger condition_legacy_output_mappings_validate
before insert or update on public.condition_legacy_output_mappings
for each row execute function public.carez_validate_condition_legacy_output_mapping();

create trigger project_concrete_conditions_touch
before update on public.project_concrete_conditions
for each row execute function public.carez_condition_touch_updated_at();

create trigger project_concrete_condition_versions_touch
before update on public.project_concrete_condition_versions
for each row execute function public.carez_condition_touch_updated_at();

create trigger project_concrete_condition_versions_validate
before insert or update on public.project_concrete_condition_versions
for each row execute function public.carez_validate_project_condition_version();

create trigger project_concrete_condition_versions_guard
before insert or update or delete on public.project_concrete_condition_versions
for each row execute function public.carez_guard_project_condition_version();

create trigger project_condition_modules_touch
before update on public.project_condition_module_instances
for each row execute function public.carez_condition_touch_updated_at();

create trigger project_condition_modules_guard
before insert or update or delete on public.project_condition_module_instances
for each row execute function public.carez_guard_project_condition_child();

create trigger project_condition_modules_validate
before insert or update on public.project_condition_module_instances
for each row execute function public.carez_validate_project_condition_module();

create trigger project_condition_roles_guard
before insert or update or delete on public.project_condition_measurement_roles
for each row execute function public.carez_guard_project_condition_child();

create trigger project_condition_roles_validate
before insert or update on public.project_condition_measurement_roles
for each row execute function public.carez_validate_project_condition_measurement_role();

create trigger project_condition_outputs_touch
before update on public.project_condition_outputs
for each row execute function public.carez_condition_touch_updated_at();

create trigger project_condition_outputs_guard
before insert or update or delete on public.project_condition_outputs
for each row execute function public.carez_guard_project_condition_child();

create trigger project_condition_outputs_validate
before insert or update on public.project_condition_outputs
for each row execute function public.carez_validate_project_condition_output();

create trigger project_condition_holds_touch
before update on public.project_condition_holds
for each row execute function public.carez_condition_touch_updated_at();

create trigger project_condition_holds_guard
before insert or update or delete on public.project_condition_holds
for each row execute function public.carez_guard_project_condition_child();

create trigger project_condition_holds_validate
before insert or update on public.project_condition_holds
for each row execute function public.carez_validate_project_condition_hold();

-- Carez-owned pilot archetypes contain dimensional math contracts only. They do
-- not choose company methods, project dimensions, production, waste, or price.
insert into public.platform_condition_archetypes(code,name,family,primary_measurement_unit)
values
  ('pad_column_footing','Pad / Column Footing','footing','EA'),
  ('strip_wall_footing','Strip / Wall Footing','footing','LF'),
  ('slab_on_grade','Slab on Grade','slab','SF')
on conflict(code) do nothing;

insert into public.platform_condition_archetype_versions(
  archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
)
select
  archetype.id,
  1,
  'published',
  'concrete_condition_v1',
  $json$[
    {"key":"locations","label":"Footing locations","unit":"EA","geometry_type":"count","measurement_type":"count","primary":true,"required":true},
    {"key":"anchors_embeds","label":"Anchors / embeds","unit":"EA","geometry_type":"count","measurement_type":"count","primary":false,"required":false}
  ]$json$::jsonb,
  $json$[
    {"key":"width_ft","label":"Width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"length_ft","label":"Length","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"depth_ft","label":"Depth","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"anchor_count_per_each","label":"Anchors per footing","group":"planFacts","value_type":"number","unit":"EA/EA","minimum":0},
    {"key":"formed_sides","label":"Formed sides","group":"methods","value_type":"integer","unit":"EA","minimum":0,"maximum":4},
    {"key":"rebar_lf_per_each","label":"Reinforcing length per footing","group":"methods","value_type":"number","unit":"LF/EA","minimum":0.000001},
    {"key":"rebar_unit_weight_lb_per_ft","label":"Rebar unit weight","group":"methods","value_type":"number","unit":"LB/LF","minimum":0.000001},
    {"key":"place_concrete_mh_per_cy","label":"Place concrete production rate","group":"production","value_type":"number","unit":"MH/CY","minimum":0},
    {"key":"form_mh_per_sf","label":"Form production rate","group":"production","value_type":"number","unit":"MH/SF","minimum":0},
    {"key":"rebar_mh_per_lb","label":"Reinforcing production rate","group":"production","value_type":"number","unit":"MH/LB","minimum":0},
    {"key":"anchor_embed_mh_per_ea","label":"Anchor/embed production rate","group":"production","value_type":"number","unit":"MH/EA","minimum":0},
    {"key":"concrete_waste_pct","label":"Concrete waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"rebar_waste_pct","label":"Reinforcing waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"elevation_ft","label":"Elevation","group":"drawing","value_type":"number","unit":"FT"},
    {"key":"elevation_reference","label":"Elevation reference","group":"drawing","value_type":"select","options":["top","bottom","centerline"]}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete","repeatable":false,"default_enabled":true},
    {"key":"forms","repeatable":false,"default_enabled":true},
    {"key":"reinforcing","repeatable":true,"default_enabled":true},
    {"key":"anchors_embeds","repeatable":true,"default_enabled":true},
    {"key":"labor","repeatable":true,"default_enabled":true}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete.installed_cy","module_key":"concrete","label":"Concrete — installed","resource_class":"material","unit":"CY","algorithm":"pad-volume-v1","legacy_component_key":"concrete"},
    {"key":"concrete.procurement_cy","module_key":"concrete","label":"Concrete — procurement","resource_class":"material","unit":"CY","algorithm":"waste-adjustment-v1","legacy_component_key":"concrete_procurement"},
    {"key":"forms.contact_sf","module_key":"forms","label":"Form contact area","resource_class":"material","unit":"SF","algorithm":"pad-form-contact-v1","legacy_component_key":"forms"},
    {"key":"reinforcing.steel_lb","module_key":"reinforcing","label":"Reinforcing steel","resource_class":"material","unit":"LB","algorithm":"pad-rebar-weight-v1","legacy_component_key":"rebar"},
    {"key":"anchors_embeds.anchor_ea","module_key":"anchors_embeds","label":"Anchors / embeds","resource_class":"material","unit":"EA","algorithm":"role-or-each-count-v1","legacy_component_key":"anchors"},
    {"key":"labor.place_concrete_mh","module_key":"labor","label":"Place concrete labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_place"},
    {"key":"labor.forms_mh","module_key":"labor","label":"Form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_forms"},
    {"key":"labor.reinforcing_mh","module_key":"labor","label":"Reinforcing labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_rebar"},
    {"key":"labor.anchors_embeds_mh","module_key":"labor","label":"Anchor / embed labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_anchors"}
  ]$json$::jsonb,
  $json${"shape":"rectangular_prism_instances","required_inputs":["width_ft","length_ft","depth_ft","elevation_ft","elevation_reference"],"quantity_authority":"2d_measurement"}$json$::jsonb,
  'Initial P0.5 pilot. Reinforcing and anchors remain estimator-confirmed inputs/roles; no engineering inference.',
  now()
from public.platform_condition_archetypes archetype
where archetype.code = 'pad_column_footing'
  and not exists (
    select 1 from public.platform_condition_archetype_versions existing
    where existing.archetype_id = archetype.id and existing.version_no = 1
  );

insert into public.platform_condition_archetype_versions(
  archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
)
select
  archetype.id,
  1,
  'published',
  'concrete_condition_v1',
  $json$[
    {"key":"run","label":"Footing run","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":true,"required":true},
    {"key":"end_forms","label":"End forms","unit":"EA","geometry_type":"count","measurement_type":"count","primary":false,"required":false},
    {"key":"anchors_embeds","label":"Anchors / embeds","unit":"EA","geometry_type":"count","measurement_type":"count","primary":false,"required":false}
  ]$json$::jsonb,
  $json$[
    {"key":"width_ft","label":"Width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"depth_ft","label":"Depth","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"anchor_count_per_lf","label":"Anchors per foot","group":"planFacts","value_type":"number","unit":"EA/LF","minimum":0},
    {"key":"formed_sides","label":"Formed sides","group":"methods","value_type":"integer","unit":"EA","minimum":0,"maximum":2},
    {"key":"longitudinal_bar_count","label":"Longitudinal bar count","group":"methods","value_type":"integer","unit":"EA","minimum":1},
    {"key":"rebar_unit_weight_lb_per_ft","label":"Rebar unit weight","group":"methods","value_type":"number","unit":"LB/LF","minimum":0.000001},
    {"key":"place_concrete_mh_per_cy","label":"Place concrete production rate","group":"production","value_type":"number","unit":"MH/CY","minimum":0},
    {"key":"form_mh_per_sf","label":"Form production rate","group":"production","value_type":"number","unit":"MH/SF","minimum":0},
    {"key":"rebar_mh_per_lb","label":"Reinforcing production rate","group":"production","value_type":"number","unit":"MH/LB","minimum":0},
    {"key":"anchor_embed_mh_per_ea","label":"Anchor/embed production rate","group":"production","value_type":"number","unit":"MH/EA","minimum":0},
    {"key":"concrete_waste_pct","label":"Concrete waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"rebar_waste_pct","label":"Reinforcing waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"elevation_ft","label":"Elevation","group":"drawing","value_type":"number","unit":"FT"},
    {"key":"elevation_reference","label":"Elevation reference","group":"drawing","value_type":"select","options":["top","bottom","centerline"]}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete","repeatable":false,"default_enabled":true},
    {"key":"forms","repeatable":false,"default_enabled":true},
    {"key":"reinforcing","repeatable":true,"default_enabled":true},
    {"key":"anchors_embeds","repeatable":true,"default_enabled":true},
    {"key":"labor","repeatable":true,"default_enabled":true}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete.installed_cy","module_key":"concrete","label":"Concrete — installed","resource_class":"material","unit":"CY","algorithm":"strip-volume-v1","legacy_component_key":"concrete"},
    {"key":"concrete.procurement_cy","module_key":"concrete","label":"Concrete — procurement","resource_class":"material","unit":"CY","algorithm":"waste-adjustment-v1","legacy_component_key":"concrete_procurement"},
    {"key":"forms.side_contact_sf","module_key":"forms","label":"Side form contact area","resource_class":"material","unit":"SF","algorithm":"strip-side-form-v1","legacy_component_key":"forms"},
    {"key":"forms.end_contact_sf","module_key":"forms","label":"End form contact area","resource_class":"material","unit":"SF","algorithm":"strip-end-form-v1","legacy_component_key":"end_forms"},
    {"key":"reinforcing.steel_lb","module_key":"reinforcing","label":"Reinforcing steel","resource_class":"material","unit":"LB","algorithm":"strip-longitudinal-rebar-v1","legacy_component_key":"rebar"},
    {"key":"anchors_embeds.anchor_ea","module_key":"anchors_embeds","label":"Anchors / embeds","resource_class":"material","unit":"EA","algorithm":"role-or-linear-count-v1","legacy_component_key":"anchors"},
    {"key":"labor.place_concrete_mh","module_key":"labor","label":"Place concrete labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_place"},
    {"key":"labor.forms_mh","module_key":"labor","label":"Form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_forms"},
    {"key":"labor.reinforcing_mh","module_key":"labor","label":"Reinforcing labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_rebar"},
    {"key":"labor.anchors_embeds_mh","module_key":"labor","label":"Anchor / embed labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_anchors"}
  ]$json$::jsonb,
  $json${"shape":"rectangular_profile_sweep","required_inputs":["width_ft","depth_ft","elevation_ft","elevation_reference"],"quantity_authority":"2d_measurement"}$json$::jsonb,
  'Initial P0.5 pilot. Longitudinal reinforcing and anchor spacing/count remain estimator-confirmed.',
  now()
from public.platform_condition_archetypes archetype
where archetype.code = 'strip_wall_footing'
  and not exists (
    select 1 from public.platform_condition_archetype_versions existing
    where existing.archetype_id = archetype.id and existing.version_no = 1
  );

insert into public.platform_condition_archetype_versions(
  archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
)
select
  archetype.id,
  1,
  'published',
  'concrete_condition_v1',
  $json$[
    {"key":"area","label":"Net slab area","unit":"SF","geometry_type":"polygon","measurement_type":"area","primary":true,"required":true},
    {"key":"edge_forms","label":"Edge forms","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":false,"required":false},
    {"key":"joints","label":"Joints","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":false,"required":false},
    {"key":"anchors_embeds","label":"Anchors / embeds","unit":"EA","geometry_type":"count","measurement_type":"count","primary":false,"required":false}
  ]$json$::jsonb,
  $json$[
    {"key":"thickness_in","label":"Slab thickness","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"base_depth_in","label":"Base depth","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"reinforcing_lb_per_sf","label":"Reinforcing allowance","group":"methods","value_type":"number","unit":"LB/SF","minimum":0.000001},
    {"key":"place_finish_mh_per_sf","label":"Place and finish production rate","group":"production","value_type":"number","unit":"MH/SF","minimum":0},
    {"key":"form_mh_per_sf","label":"Form production rate","group":"production","value_type":"number","unit":"MH/SF","minimum":0},
    {"key":"rebar_mh_per_lb","label":"Reinforcing production rate","group":"production","value_type":"number","unit":"MH/LB","minimum":0},
    {"key":"anchor_embed_mh_per_ea","label":"Anchor/embed production rate","group":"production","value_type":"number","unit":"MH/EA","minimum":0},
    {"key":"concrete_waste_pct","label":"Concrete waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"rebar_waste_pct","label":"Reinforcing waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"vapor_barrier_waste_pct","label":"Vapor barrier waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"elevation_ft","label":"Elevation","group":"drawing","value_type":"number","unit":"FT"},
    {"key":"elevation_reference","label":"Elevation reference","group":"drawing","value_type":"select","options":["top","bottom","centerline"]}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete","repeatable":false,"default_enabled":true},
    {"key":"forms","repeatable":false,"default_enabled":true},
    {"key":"reinforcing","repeatable":true,"default_enabled":true},
    {"key":"anchors_embeds","repeatable":true,"default_enabled":true},
    {"key":"slab_systems","repeatable":true,"default_enabled":true},
    {"key":"labor","repeatable":true,"default_enabled":true}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete.installed_cy","module_key":"concrete","label":"Concrete — installed","resource_class":"material","unit":"CY","algorithm":"slab-volume-v1","legacy_component_key":"concrete"},
    {"key":"concrete.procurement_cy","module_key":"concrete","label":"Concrete — procurement","resource_class":"material","unit":"CY","algorithm":"waste-adjustment-v1","legacy_component_key":"concrete_procurement"},
    {"key":"forms.edge_contact_sf","module_key":"forms","label":"Edge form contact area","resource_class":"material","unit":"SF","algorithm":"slab-edge-form-v1","legacy_component_key":"forms"},
    {"key":"reinforcing.steel_lb","module_key":"reinforcing","label":"Reinforcing steel","resource_class":"material","unit":"LB","algorithm":"slab-rebar-allowance-v1","legacy_component_key":"rebar"},
    {"key":"slab_systems.vapor_barrier_sf","module_key":"slab_systems","label":"Vapor barrier","resource_class":"material","unit":"SF","algorithm":"area-waste-v1","legacy_component_key":"vapor_barrier"},
    {"key":"slab_systems.base_cy","module_key":"slab_systems","label":"Aggregate base","resource_class":"material","unit":"CY","algorithm":"slab-base-volume-v1","legacy_component_key":"base"},
    {"key":"anchors_embeds.anchor_ea","module_key":"anchors_embeds","label":"Anchors / embeds","resource_class":"material","unit":"EA","algorithm":"role-count-v1","legacy_component_key":"anchors"},
    {"key":"labor.place_finish_mh","module_key":"labor","label":"Place and finish labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_place_finish"},
    {"key":"labor.forms_mh","module_key":"labor","label":"Form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_forms"},
    {"key":"labor.reinforcing_mh","module_key":"labor","label":"Reinforcing labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_rebar"},
    {"key":"labor.anchors_embeds_mh","module_key":"labor","label":"Anchor / embed labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_anchors"}
  ]$json$::jsonb,
  $json${"shape":"polygon_extrusion","subtract_cutouts":true,"required_inputs":["thickness_in","elevation_ft","elevation_reference"],"quantity_authority":"2d_measurement"}$json$::jsonb,
  'Initial P0.5 pilot. Net SF is supplied by authoritative polygon geometry after cutouts.',
  now()
from public.platform_condition_archetypes archetype
where archetype.code = 'slab_on_grade'
  and not exists (
    select 1 from public.platform_condition_archetype_versions existing
    where existing.archetype_id = archetype.id and existing.version_no = 1
  );

alter table public.platform_condition_archetypes enable row level security;
alter table public.platform_condition_archetype_versions enable row level security;
alter table public.company_condition_templates enable row level security;
alter table public.company_condition_template_versions enable row level security;
alter table public.condition_legacy_output_mappings enable row level security;
alter table public.project_concrete_conditions enable row level security;
alter table public.project_concrete_condition_versions enable row level security;
alter table public.project_condition_module_instances enable row level security;
alter table public.project_condition_measurement_roles enable row level security;
alter table public.project_condition_outputs enable row level security;
alter table public.project_condition_holds enable row level security;

create policy platform_condition_archetypes_select
on public.platform_condition_archetypes
for select to authenticated
using (true);

create policy platform_condition_archetype_versions_select
on public.platform_condition_archetype_versions
for select to authenticated
using (status in ('published','retired'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'company_condition_templates',
    'company_condition_template_versions',
    'condition_legacy_output_mappings',
    'project_concrete_conditions',
    'project_concrete_condition_versions',
    'project_condition_module_instances',
    'project_condition_measurement_roles',
    'project_condition_outputs',
    'project_condition_holds'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (company_id = (select public.get_my_company_id()) and (select public.get_my_role()) <> ''employee'') with check (company_id = (select public.get_my_company_id()) and (select public.get_my_role()) <> ''employee'')',
      'office access ' || table_name,
      table_name
    );
  end loop;
end;
$$;

revoke all on table public.platform_condition_archetypes,public.platform_condition_archetype_versions from public,anon,authenticated;
grant select on table public.platform_condition_archetypes,public.platform_condition_archetype_versions to authenticated;
grant all on table public.platform_condition_archetypes,public.platform_condition_archetype_versions to service_role;

revoke all on table
  public.company_condition_templates,
  public.company_condition_template_versions,
  public.condition_legacy_output_mappings,
  public.project_concrete_conditions,
  public.project_concrete_condition_versions,
  public.project_condition_module_instances,
  public.project_condition_measurement_roles,
  public.project_condition_outputs,
  public.project_condition_holds
from public,anon,authenticated;

grant select,insert,update,delete on table
  public.company_condition_templates,
  public.company_condition_template_versions,
  public.condition_legacy_output_mappings,
  public.project_concrete_conditions,
  public.project_concrete_condition_versions,
  public.project_condition_module_instances,
  public.project_condition_measurement_roles,
  public.project_condition_outputs,
  public.project_condition_holds
to authenticated;

grant all on table
  public.company_condition_templates,
  public.company_condition_template_versions,
  public.condition_legacy_output_mappings,
  public.project_concrete_conditions,
  public.project_concrete_condition_versions,
  public.project_condition_module_instances,
  public.project_condition_measurement_roles,
  public.project_condition_outputs,
  public.project_condition_holds
to service_role;

create or replace function public.carez_create_company_condition_template(
  p_archetype_code text,
  p_code text,
  p_name text,
  p_description text default null,
  p_module_defaults jsonb default '{}'::jsonb,
  p_input_defaults jsonb default '{}'::jsonb,
  p_input_provenance jsonb default '{}'::jsonb,
  p_pricing_defaults jsonb default '{}'::jsonb,
  p_legacy_assembly_version_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_archetype public.platform_condition_archetypes%rowtype;
  v_archetype_version public.platform_condition_archetype_versions%rowtype;
  v_template_id uuid;
  v_template_version_id uuid;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then
    raise exception 'Condition Template code and name are required.';
  end if;

  select * into v_archetype
  from public.platform_condition_archetypes
  where code = lower(trim(p_archetype_code)) and active;
  if not found then raise exception 'Active Platform Condition Archetype not found.'; end if;

  select * into v_archetype_version
  from public.platform_condition_archetype_versions
  where archetype_id = v_archetype.id and status = 'published'
  order by version_no desc
  limit 1;
  if not found then raise exception 'Published Platform Condition Archetype version not found.'; end if;

  insert into public.company_condition_templates(
    company_id,archetype_id,code,name,description,created_by
  ) values (
    v_company,v_archetype.id,upper(trim(p_code)),trim(p_name),nullif(trim(coalesce(p_description,'')),''),auth.uid()
  ) returning id into v_template_id;

  insert into public.company_condition_template_versions(
    company_id,template_id,archetype_version_id,version_no,status,module_defaults,input_defaults,input_provenance,
    pricing_defaults,legacy_assembly_version_id,created_by
  ) values (
    v_company,v_template_id,v_archetype_version.id,1,'draft',coalesce(p_module_defaults,'{}'::jsonb),
    coalesce(p_input_defaults,'{}'::jsonb),coalesce(p_input_provenance,'{}'::jsonb),
    coalesce(p_pricing_defaults,'{}'::jsonb),p_legacy_assembly_version_id,auth.uid()
  ) returning id into v_template_version_id;

  return v_template_version_id;
end;
$$;

revoke all on function public.carez_create_company_condition_template(text,text,text,text,jsonb,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.carez_create_company_condition_template(text,text,text,text,jsonb,jsonb,jsonb,jsonb,uuid) to authenticated,service_role;

create or replace function public.carez_publish_company_condition_template_version(p_template_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.company_condition_template_versions%rowtype;
  v_component_count integer;
  v_mapping_count integer;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;

  select * into v_version
  from public.company_condition_template_versions
  where id = p_template_version_id and company_id = v_company
  for update;
  if not found or v_version.status <> 'draft' then raise exception 'Draft Condition Template version not found.'; end if;

  if v_version.legacy_assembly_version_id is not null then
    select count(*) into v_component_count
    from public.concrete_assembly_components
    where company_id = v_company and assembly_version_id = v_version.legacy_assembly_version_id;
    select count(*) into v_mapping_count
    from public.condition_legacy_output_mappings
    where company_id = v_company and template_version_id = v_version.id;
    if v_component_count = 0 or v_mapping_count <> v_component_count then
      raise exception 'Map every compatibility assembly component exactly once before publishing the Condition Template.';
    end if;
  end if;

  perform set_config('carez.condition_template_publish','1',true);
  update public.company_condition_template_versions
  set status = 'published',published_at = now()
  where id = v_version.id and company_id = v_company;
end;
$$;

revoke all on function public.carez_publish_company_condition_template_version(uuid) from public,anon;
grant execute on function public.carez_publish_company_condition_template_version(uuid) to authenticated,service_role;

create or replace function public.carez_create_project_concrete_condition(
  p_takeoff_set_id uuid,
  p_template_version_id uuid,
  p_code text,
  p_name text,
  p_description text default null,
  p_plan_facts jsonb default '{}'::jsonb,
  p_method_inputs jsonb default '{}'::jsonb,
  p_production_inputs jsonb default '{}'::jsonb,
  p_commercial_inputs jsonb default '{}'::jsonb,
  p_drawing_inputs jsonb default '{}'::jsonb,
  p_input_provenance jsonb default '{}'::jsonb,
  p_output_overrides jsonb default '{}'::jsonb,
  p_legacy_method_profile_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_template_version public.company_condition_template_versions%rowtype;
  v_condition_id uuid;
  v_condition_version_id uuid;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;
  if nullif(trim(p_code),'') is null or nullif(trim(p_name),'') is null then
    raise exception 'Project Condition code and name are required.';
  end if;
  if not exists (
    select 1 from public.takeoff_sets
    where id = p_takeoff_set_id and company_id = v_company and status = 'active'
  ) then raise exception 'Active takeoff set not found.'; end if;

  select * into v_template_version
  from public.company_condition_template_versions
  where id = p_template_version_id and company_id = v_company and status = 'published';
  if not found then raise exception 'Published Company Condition Template version not found.'; end if;

  insert into public.project_concrete_conditions(
    company_id,takeoff_set_id,template_id,code,name,description,created_by
  ) values (
    v_company,p_takeoff_set_id,v_template_version.template_id,upper(trim(p_code)),trim(p_name),
    nullif(trim(coalesce(p_description,'')),''),auth.uid()
  ) returning id into v_condition_id;

  insert into public.project_concrete_condition_versions(
    company_id,condition_id,template_version_id,archetype_version_id,revision_no,status,
    plan_facts,method_inputs,production_inputs,commercial_inputs,drawing_inputs,input_provenance,
    output_overrides,legacy_method_profile_id,created_by
  ) values (
    v_company,v_condition_id,v_template_version.id,v_template_version.archetype_version_id,1,'draft',
    coalesce(p_plan_facts,'{}'::jsonb),coalesce(p_method_inputs,'{}'::jsonb),
    coalesce(p_production_inputs,'{}'::jsonb),coalesce(p_commercial_inputs,'{}'::jsonb),
    coalesce(p_drawing_inputs,'{}'::jsonb),coalesce(p_input_provenance,'{}'::jsonb),
    coalesce(p_output_overrides,'{}'::jsonb),p_legacy_method_profile_id,auth.uid()
  ) returning id into v_condition_version_id;

  insert into public.project_condition_module_instances(
    company_id,condition_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,sort_order,created_by
  )
  select
    v_company,
    v_condition_version_id,
    module->>'key',
    'default',
    initcap(replace(module->>'key','_',' ')),
    coalesce((v_template_version.module_defaults->(module->>'key')->>'enabled')::boolean,(module->>'default_enabled')::boolean,true),
    coalesce(v_template_version.module_defaults->(module->>'key')->'inputs','{}'::jsonb),
    '{}'::jsonb,
    (ordinality::integer) * 10,
    auth.uid()
  from public.platform_condition_archetype_versions archetype_version,
       lateral jsonb_array_elements(archetype_version.module_schema) with ordinality as modules(module,ordinality)
  where archetype_version.id = v_template_version.archetype_version_id;

  return v_condition_version_id;
end;
$$;

revoke all on function public.carez_create_project_concrete_condition(uuid,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.carez_create_project_concrete_condition(uuid,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,uuid) to authenticated,service_role;

create or replace function public.carez_create_project_condition_revision(p_condition_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_source public.project_concrete_condition_versions%rowtype;
  v_next_revision integer;
  v_new_version_id uuid;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;

  select * into v_source
  from public.project_concrete_condition_versions
  where id = p_condition_version_id and company_id = v_company;
  if not found then raise exception 'Project Condition version not found.'; end if;
  if exists (
    select 1 from public.project_concrete_condition_versions
    where company_id = v_company and condition_id = v_source.condition_id and status = 'draft'
  ) then raise exception 'This Project Condition already has a draft revision.'; end if;

  select coalesce(max(revision_no),0) + 1 into v_next_revision
  from public.project_concrete_condition_versions
  where company_id = v_company and condition_id = v_source.condition_id;

  insert into public.project_concrete_condition_versions(
    company_id,condition_id,template_version_id,archetype_version_id,revision_no,status,
    plan_facts,method_inputs,production_inputs,commercial_inputs,drawing_inputs,input_provenance,
    output_overrides,legacy_method_profile_id,source_version_id,created_by
  ) values (
    v_company,v_source.condition_id,v_source.template_version_id,v_source.archetype_version_id,v_next_revision,'draft',
    v_source.plan_facts,v_source.method_inputs,v_source.production_inputs,v_source.commercial_inputs,
    v_source.drawing_inputs,v_source.input_provenance,v_source.output_overrides,v_source.legacy_method_profile_id,
    v_source.id,auth.uid()
  ) returning id into v_new_version_id;

  insert into public.project_condition_module_instances(
    company_id,condition_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,
    legacy_child_key,sort_order,created_by
  )
  select
    company_id,v_new_version_id,module_key,instance_key,label,enabled,input_values,input_provenance,
    legacy_child_key,sort_order,auth.uid()
  from public.project_condition_module_instances
  where company_id = v_company and condition_version_id = v_source.id;

  insert into public.project_condition_measurement_roles(
    company_id,condition_version_id,measurement_id,role_key,role_instance_key,is_primary,sort_order,created_by
  )
  select
    company_id,v_new_version_id,measurement_id,role_key,role_instance_key,is_primary,sort_order,auth.uid()
  from public.project_condition_measurement_roles
  where company_id = v_company and condition_version_id = v_source.id;

  return v_new_version_id;
end;
$$;

revoke all on function public.carez_create_project_condition_revision(uuid) from public,anon;
grant execute on function public.carez_create_project_condition_revision(uuid) to authenticated,service_role;

create or replace function public.carez_verify_project_condition_version(
  p_condition_version_id uuid,
  p_verification_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_version public.project_concrete_condition_versions%rowtype;
  v_output_count integer;
  v_expected_output_count integer;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;

  select * into v_version
  from public.project_concrete_condition_versions
  where id = p_condition_version_id and company_id = v_company
  for update;
  if not found or v_version.status <> 'draft' then raise exception 'Draft Project Condition version not found.'; end if;

  if exists (
    select 1
    from public.platform_condition_archetype_versions archetype_version,
         lateral jsonb_array_elements(archetype_version.role_schema) role
    where archetype_version.id = v_version.archetype_version_id
      and coalesce((role->>'required')::boolean,false)
      and not exists (
        select 1
        from public.project_condition_measurement_roles assigned
        where assigned.company_id = v_company
          and assigned.condition_version_id = v_version.id
          and assigned.role_key = role->>'key'
      )
  ) then raise exception 'Assign every required measurement role before verifying the Project Condition.'; end if;

  select jsonb_array_length(output_schema) into v_expected_output_count
  from public.platform_condition_archetype_versions
  where id = v_version.archetype_version_id;
  select count(*) into v_output_count
  from public.project_condition_outputs
  where company_id = v_company and condition_version_id = v_version.id;
  if v_output_count < v_expected_output_count then
    raise exception 'Calculate and persist every Condition output before verification.';
  end if;

  if exists (
    select 1
    from public.project_condition_outputs output
    where output.company_id = v_company
      and output.condition_version_id = v_version.id
      and output.status = 'held'
      and not exists (
        select 1 from public.project_condition_holds hold
        where hold.company_id = v_company
          and hold.condition_version_id = v_version.id
          and hold.output_id = output.id
          and hold.status = 'open'
      )
  ) then raise exception 'Every held Condition output requires an explicit open hold.'; end if;

  perform set_config('carez.project_condition_verify','1',true);
  update public.project_concrete_condition_versions
  set status = 'verified',verification_notes = nullif(trim(coalesce(p_verification_notes,'')),''),
      verified_by = auth.uid(),verified_at = now()
  where id = v_version.id and company_id = v_company;
end;
$$;

revoke all on function public.carez_verify_project_condition_version(uuid,text) from public,anon;
grant execute on function public.carez_verify_project_condition_version(uuid,text) to authenticated,service_role;

create or replace view public.project_condition_summary
with (security_invoker = true)
as
select
  project_condition.company_id,
  project_condition.id as condition_id,
  project_condition.takeoff_set_id,
  version.condition_code_snapshot as code,
  version.condition_name_snapshot as name,
  version.id as condition_version_id,
  version.revision_no,
  version.status as version_status,
  template.id as template_id,
  template_version.template_code_snapshot as template_code,
  template_version.template_name_snapshot as template_name,
  template_version.id as template_version_id,
  template_version.version_no as template_version_no,
  archetype_version.archetype_code_snapshot as archetype_code,
  archetype_version.archetype_name_snapshot as archetype_name,
  (select count(*) from public.project_condition_measurement_roles role
    where role.company_id = project_condition.company_id and role.condition_version_id = version.id) as measurement_count,
  (select count(*) from public.project_condition_outputs output
    where output.company_id = project_condition.company_id and output.condition_version_id = version.id) as output_count,
  (select count(*) from public.project_condition_outputs output
    where output.company_id = project_condition.company_id and output.condition_version_id = version.id and output.status = 'held') as held_output_count,
  (select count(*) from public.project_condition_holds hold
    where hold.company_id = project_condition.company_id and hold.condition_version_id = version.id and hold.status = 'open') as open_hold_count,
  (select coalesce(sum(output.direct_cost),0) from public.project_condition_outputs output
    where output.company_id = project_condition.company_id and output.condition_version_id = version.id and output.status = 'ready') as direct_cost
from public.project_concrete_conditions project_condition
join public.project_concrete_condition_versions version
  on version.company_id = project_condition.company_id and version.condition_id = project_condition.id
join public.company_condition_templates template
  on template.company_id = project_condition.company_id and template.id = project_condition.template_id
join public.company_condition_template_versions template_version
  on template_version.company_id = project_condition.company_id and template_version.id = version.template_version_id
join public.platform_condition_archetype_versions archetype_version
  on archetype_version.id = version.archetype_version_id
;

create or replace view public.condition_legacy_reconciliation
with (security_invoker = true)
as
select
  output.company_id,
  output.condition_version_id,
  output.id as condition_output_id,
  output.output_key,
  output.output_instance_key,
  output.status as condition_status,
  output.production_quantity as condition_quantity,
  output.production_unit as condition_unit,
  output.direct_cost as condition_direct_cost,
  output.legacy_takeoff_output_id,
  legacy.production_quantity as legacy_quantity,
  legacy.production_unit as legacy_unit,
  legacy.direct_cost as legacy_direct_cost,
  output.generated_estimate_item_id,
  legacy.generated_estimate_item_id as legacy_estimate_item_id,
  case
    when output.legacy_takeoff_output_id is null then 'unmapped'
    when upper(output.production_unit) <> upper(legacy.production_unit) then 'unit_mismatch'
    when output.status = 'held' and legacy.pricing_status = 'missing_input' then 'held'
    when output.production_quantity is not distinct from legacy.production_quantity
      and output.direct_cost is not distinct from legacy.direct_cost
      and output.generated_estimate_item_id is not distinct from legacy.generated_estimate_item_id then 'exact'
    else 'mismatch'
  end as reconciliation_status
from public.project_condition_outputs output
left join public.takeoff_measurement_outputs legacy
  on legacy.id = output.legacy_takeoff_output_id and legacy.company_id = output.company_id;

revoke all on public.project_condition_summary,public.condition_legacy_reconciliation from public,anon;
grant select on public.project_condition_summary,public.condition_legacy_reconciliation to authenticated,service_role;
