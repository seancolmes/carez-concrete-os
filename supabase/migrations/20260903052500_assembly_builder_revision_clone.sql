-- Keep assembly revisions lossless as the interactive Assembly Builder evolves.
-- Published versions remain immutable; this function creates the one editable draft.

create or replace function public.carez_create_assembly_revision(
  p_assembly_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_company uuid;
  v_source public.concrete_assembly_versions%rowtype;
  v_next integer;
  v_new uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select p.company_id into v_company
  from public.profiles p
  where p.id = v_user;

  if v_company is null then raise exception 'No company profile'; end if;

  select * into v_source
  from public.concrete_assembly_versions
  where id = p_assembly_version_id
    and company_id = v_company;

  if v_source.id is null then raise exception 'Assembly version not found'; end if;
  if v_source.status not in ('published', 'retired') then
    raise exception 'Only published or retired assembly versions can be revised';
  end if;

  if exists (
    select 1
    from public.concrete_assembly_versions
    where company_id = v_company
      and assembly_id = v_source.assembly_id
      and status = 'draft'
  ) then
    raise exception 'This assembly already has an active draft revision';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next
  from public.concrete_assembly_versions
  where company_id = v_company
    and assembly_id = v_source.assembly_id;

  insert into public.concrete_assembly_versions (
    company_id,
    assembly_id,
    version_no,
    status,
    source_type,
    source_label,
    source_reference,
    notes,
    default_risk_class_code,
    assembly_code_snapshot,
    assembly_name_snapshot,
    category_snapshot,
    primary_measurement_snapshot,
    description_snapshot,
    render_config,
    created_by,
    updated_by
  ) values (
    v_company,
    v_source.assembly_id,
    v_next,
    'draft',
    'historical',
    'Revision of published company assembly',
    v_source.id::text,
    'Draft revision created from immutable assembly version ' || v_source.version_no,
    v_source.default_risk_class_code,
    v_source.assembly_code_snapshot,
    v_source.assembly_name_snapshot,
    v_source.category_snapshot,
    v_source.primary_measurement_snapshot,
    v_source.description_snapshot,
    v_source.render_config,
    v_user,
    v_user
  )
  returning id into v_new;

  insert into public.concrete_assembly_variables (
    company_id,
    assembly_version_id,
    variable_key,
    label,
    value_type,
    unit,
    default_value,
    options,
    dimension_family,
    min_value,
    max_value,
    required,
    help_text,
    sort_order,
    activation_rule,
    property_group,
    expose_in_takeoff,
    allow_override,
    input_role,
    requires_verification
  )
  select
    v_company,
    v_new,
    variable_key,
    label,
    value_type,
    unit,
    default_value,
    options,
    dimension_family,
    min_value,
    max_value,
    required,
    help_text,
    sort_order,
    activation_rule,
    property_group,
    expose_in_takeoff,
    allow_override,
    input_role,
    requires_verification
  from public.concrete_assembly_variables
  where company_id = v_company
    and assembly_version_id = v_source.id;

  insert into public.concrete_assembly_components (
    company_id,
    assembly_version_id,
    component_key,
    label,
    estimate_item_type,
    cost_code_id,
    catalog_item_id,
    production_task_id,
    output_unit,
    quantity_formula,
    labor_rate_formula,
    baseline_source,
    pricing_strategy,
    default_unit_cost,
    labor_task,
    notes,
    sort_order,
    activation_rule,
    resource_behavior,
    estimate_visible
  )
  select
    v_company,
    v_new,
    component_key,
    label,
    estimate_item_type,
    cost_code_id,
    catalog_item_id,
    production_task_id,
    output_unit,
    quantity_formula,
    labor_rate_formula,
    baseline_source,
    pricing_strategy,
    default_unit_cost,
    labor_task,
    notes,
    sort_order,
    activation_rule,
    resource_behavior,
    estimate_visible
  from public.concrete_assembly_components
  where company_id = v_company
    and assembly_version_id = v_source.id;

  insert into public.concrete_assembly_children (
    company_id,
    assembly_version_id,
    child_assembly_version_id,
    child_key,
    label,
    quantity_formula,
    variable_bindings,
    sort_order
  )
  select
    v_company,
    v_new,
    child_assembly_version_id,
    child_key,
    label,
    quantity_formula,
    variable_bindings,
    sort_order
  from public.concrete_assembly_children
  where company_id = v_company
    and assembly_version_id = v_source.id;

  insert into public.concrete_assembly_property_bindings (
    company_id,
    assembly_version_id,
    variable_id,
    source_namespace,
    source_key,
    precedence,
    notes,
    sort_order
  )
  select
    v_company,
    v_new,
    new_variable.id,
    binding.source_namespace,
    binding.source_key,
    binding.precedence,
    binding.notes,
    binding.sort_order
  from public.concrete_assembly_property_bindings binding
  join public.concrete_assembly_variables old_variable
    on old_variable.id = binding.variable_id
  join public.concrete_assembly_variables new_variable
    on new_variable.company_id = v_company
   and new_variable.assembly_version_id = v_new
   and new_variable.variable_key = old_variable.variable_key
  where binding.company_id = v_company
    and binding.assembly_version_id = v_source.id;

  return v_new;
end;
$$;

grant execute on function public.carez_create_assembly_revision(uuid) to authenticated;
