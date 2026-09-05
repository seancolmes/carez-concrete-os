-- Create each governed pilot template and its legacy projection edge on first use.
-- The Concrete Condition remains calculation authority. The generated assembly is
-- deliberately formula-neutral and exists only so the current estimate runtime can
-- receive server-calculated, atomically reconciled outputs during migration.

create or replace function public.carez_ensure_pilot_condition_template(
  p_archetype_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid := public.get_my_company_id();
  v_key text := lower(trim(coalesce(p_archetype_code,'')));
  v_archetype public.platform_condition_archetypes%rowtype;
  v_archetype_version public.platform_condition_archetype_versions%rowtype;
  v_template_id uuid;
  v_template_version_id uuid;
  v_assembly_id uuid;
  v_assembly_version_id uuid;
  v_template_code text;
  v_assembly_code text;
  v_name text;
  v_description text;
  v_component_count integer;
  v_output_count integer;
begin
  if v_company is null or public.get_my_role() = 'employee' then
    raise exception 'Office access required.';
  end if;
  if v_key not in ('pad_column_footing','strip_wall_footing','slab_on_grade') then
    raise exception 'Unsupported pilot Concrete Condition archetype.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':' || v_key,0));

  select template_version.id,template_version.legacy_assembly_version_id
    into v_template_version_id,v_assembly_version_id
  from public.company_condition_templates template
  join public.platform_condition_archetypes archetype on archetype.id = template.archetype_id
  join public.company_condition_template_versions template_version
    on template_version.company_id = template.company_id
   and template_version.template_id = template.id
  where template.company_id = v_company
    and template.active
    and archetype.code = v_key
    and template_version.status = 'published'
    and template_version.legacy_assembly_version_id is not null
  order by template_version.version_no desc
  limit 1;

  if v_template_version_id is not null then
    return jsonb_build_object(
      'template_version_id',v_template_version_id,
      'legacy_assembly_version_id',v_assembly_version_id,
      'created',false
    );
  end if;

  select * into v_archetype
  from public.platform_condition_archetypes
  where code = v_key and active;
  if not found then raise exception 'Active Platform Condition Archetype not found.'; end if;

  select * into v_archetype_version
  from public.platform_condition_archetype_versions
  where archetype_id = v_archetype.id and status = 'published'
  order by version_no desc
  limit 1;
  if not found or v_archetype_version.engine_key <> 'concrete_condition_v1' then
    raise exception 'Published Concrete Condition contract not found.';
  end if;

  select case v_key
    when 'pad_column_footing' then 'COND-PAD-FOOTING'
    when 'strip_wall_footing' then 'COND-STRIP-FOOTING'
    else 'COND-SLAB-ON-GRADE'
  end,
  case v_key
    when 'pad_column_footing' then 'Pad / Column Footing'
    when 'strip_wall_footing' then 'Strip / Wall Footing'
    else 'Slab on Grade'
  end
  into v_template_code,v_name;
  v_assembly_code := v_template_code || '-RUNTIME';
  v_description := 'Carez Concrete Condition compatibility projection. Author through Condition Properties.';

  select assembly.id into v_assembly_id
  from public.concrete_assemblies assembly
  where assembly.company_id = v_company and assembly.code = v_assembly_code
  limit 1;

  if v_assembly_id is null then
    insert into public.concrete_assemblies(
      company_id,code,name,category,primary_measurement,description,
      active,direct_takeoff_enabled,created_by
    ) values (
      v_company,v_assembly_code,v_name,'Concrete Conditions',
      v_archetype.primary_measurement_unit,v_description,true,true,auth.uid()
    ) returning id into v_assembly_id;
  end if;

  select version.id into v_assembly_version_id
  from public.concrete_assembly_versions version
  where version.company_id = v_company
    and version.assembly_id = v_assembly_id
    and version.status = 'published'
  order by version.version_no desc
  limit 1;

  if v_assembly_version_id is null then
    select version.id into v_assembly_version_id
    from public.concrete_assembly_versions version
    where version.company_id = v_company
      and version.assembly_id = v_assembly_id
      and version.status = 'draft'
    order by version.version_no desc
    limit 1;

    if v_assembly_version_id is null then
      insert into public.concrete_assembly_versions(
        company_id,assembly_id,version_no,status,source_type,source_label,notes,
        assembly_code_snapshot,assembly_name_snapshot,category_snapshot,
        primary_measurement_snapshot,description_snapshot,created_by
      ) values (
        v_company,v_assembly_id,
        coalesce((select max(version_no) + 1 from public.concrete_assembly_versions where assembly_id = v_assembly_id),1),
        'draft','carez','Concrete Condition compatibility projection',
        'Generated and governed by carez_ensure_pilot_condition_template.',
        v_assembly_code,v_name,'Concrete Conditions',v_archetype.primary_measurement_unit,
        v_description,auth.uid()
      ) returning id into v_assembly_version_id;
    end if;

    delete from public.concrete_assembly_components
    where company_id = v_company and assembly_version_id = v_assembly_version_id;

    insert into public.concrete_assembly_components(
      company_id,assembly_version_id,component_key,label,estimate_item_type,
      output_unit,quantity_formula,baseline_source,pricing_strategy,
      resource_behavior,estimate_visible,authoring_config,sort_order
    )
    select
      v_company,
      v_assembly_version_id,
      output->>'legacy_component_key',
      output->>'label',
      case output->>'resource_class'
        when 'labor' then 'labor'
        when 'equipment' then 'equipment'
        else 'material'
      end,
      upper(output->>'unit'),
      jsonb_build_object('var','quantity'),
      'Server-authoritative Concrete Condition output',
      case when output->>'resource_class' = 'labor' then 'current_cost' else 'none' end,
      case output->>'resource_class'
        when 'labor' then 'labor'
        when 'equipment' then 'owned_equipment'
        else 'consumed_material'
      end,
      true,
      jsonb_build_object('mode','condition_compatibility','condition_output_key',output->>'key'),
      ordinality::integer * 10
    from jsonb_array_elements(v_archetype_version.output_schema) with ordinality outputs(output,ordinality);

    update public.concrete_assembly_versions
    set status = 'published',published_at = now()
    where id = v_assembly_version_id and company_id = v_company;
  end if;

  select count(*) into v_component_count
  from public.concrete_assembly_components component
  where component.company_id = v_company
    and component.assembly_version_id = v_assembly_version_id;
  v_output_count := jsonb_array_length(v_archetype_version.output_schema);
  if v_component_count <> v_output_count or exists (
    select 1
    from jsonb_array_elements(v_archetype_version.output_schema) output
    where not exists (
      select 1 from public.concrete_assembly_components component
      where component.company_id = v_company
        and component.assembly_version_id = v_assembly_version_id
        and component.component_key = output->>'legacy_component_key'
        and upper(component.output_unit) = upper(output->>'unit')
    )
  ) then
    raise exception 'Concrete Condition compatibility projection is incomplete.';
  end if;

  select template.id into v_template_id
  from public.company_condition_templates template
  where template.company_id = v_company and template.archetype_id = v_archetype.id
  order by template.active desc,template.created_at
  limit 1;

  if v_template_id is null then
    insert into public.company_condition_templates(
      company_id,archetype_id,code,name,description,active,created_by
    ) values (
      v_company,v_archetype.id,v_template_code,v_name,v_description,true,auth.uid()
    ) returning id into v_template_id;
  else
    update public.company_condition_templates
    set active = true,
        updated_at = now()
    where id = v_template_id and company_id = v_company and not active;
  end if;

  select version.id into v_template_version_id
  from public.company_condition_template_versions version
  where version.company_id = v_company
    and version.template_id = v_template_id
    and version.status = 'draft'
  order by version.version_no desc
  limit 1;

  if v_template_version_id is null then
    insert into public.company_condition_template_versions(
      company_id,template_id,archetype_version_id,version_no,status,
      template_code_snapshot,template_name_snapshot,template_description_snapshot,
      module_defaults,input_defaults,input_provenance,pricing_defaults,
      legacy_assembly_version_id,notes,created_by
    ) values (
      v_company,v_template_id,v_archetype_version.id,
      coalesce((select max(version_no) + 1 from public.company_condition_template_versions where template_id = v_template_id),1),
      'draft',v_template_code,v_name,v_description,'{}'::jsonb,'{}'::jsonb,
      '{}'::jsonb,'{}'::jsonb,v_assembly_version_id,
      'Generated pilot template. Condition algorithms remain authoritative.',auth.uid()
    ) returning id into v_template_version_id;
  else
    update public.company_condition_template_versions
    set archetype_version_id = v_archetype_version.id,
        legacy_assembly_version_id = v_assembly_version_id,
        template_code_snapshot = v_template_code,
        template_name_snapshot = v_name,
        template_description_snapshot = v_description
    where id = v_template_version_id and company_id = v_company;
  end if;

  delete from public.condition_legacy_output_mappings
  where company_id = v_company and template_version_id = v_template_version_id;

  insert into public.condition_legacy_output_mappings(
    company_id,template_version_id,output_key,legacy_assembly_component_id,
    legacy_component_key_snapshot,output_unit_snapshot,created_by
  )
  select
    v_company,v_template_version_id,output->>'key',component.id,
    output->>'legacy_component_key',upper(output->>'unit'),auth.uid()
  from jsonb_array_elements(v_archetype_version.output_schema) output
  join public.concrete_assembly_components component
    on component.company_id = v_company
   and component.assembly_version_id = v_assembly_version_id
   and component.component_key = output->>'legacy_component_key';

  perform public.carez_publish_company_condition_template_version(v_template_version_id);

  return jsonb_build_object(
    'template_version_id',v_template_version_id,
    'legacy_assembly_version_id',v_assembly_version_id,
    'created',true
  );
end;
$$;

revoke all on function public.carez_ensure_pilot_condition_template(text) from public,anon;
grant execute on function public.carez_ensure_pilot_condition_template(text) to authenticated,service_role;

comment on function public.carez_ensure_pilot_condition_template(text) is
  'Idempotently creates one governed pilot template and its legacy estimate-runtime projection for the caller company.';
