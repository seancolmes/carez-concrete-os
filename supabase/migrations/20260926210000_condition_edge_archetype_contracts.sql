-- V1 Conditions edge parity: publish the remaining concrete-native family
-- contracts without changing quantity authority or the legacy projection edge.

alter table public.platform_condition_archetypes
  drop constraint if exists platform_condition_archetypes_family_check;
alter table public.platform_condition_archetypes
  add constraint platform_condition_archetypes_family_check
  check (family in ('footing','slab','wall','structural','site'));

alter table public.platform_condition_archetype_versions
  drop constraint if exists platform_condition_archetype_versions_family_snapshot_check;
alter table public.platform_condition_archetype_versions
  add constraint platform_condition_archetype_versions_family_snapshot_check
  check (family_snapshot in ('footing','slab','wall','structural','site'));

insert into public.platform_condition_archetypes(code,name,family,primary_measurement_unit)
values
  ('thickened_edge','Thickened Edge','footing','LF'),
  ('thickened_slab','Thickened Slab','slab','SF'),
  ('grade_beam','Grade Beam','structural','LF'),
  ('foundation_wall','Foundation Wall','wall','LF'),
  ('column_pier','Column / Pier','structural','EA'),
  ('elevated_slab','Elevated Slab','slab','SF'),
  ('stairs','Concrete Stairs','structural','EA'),
  ('curb','Concrete Curb','site','LF'),
  ('opening_boxout','Opening / Boxout','structural','EA')
on conflict (code) do nothing;

do $$
declare
  v_row record;
  v_roles jsonb;
  v_outputs jsonb;
  v_modules jsonb;
  v_inputs jsonb := $inputs$[
    {"key":"width_ft","label":"Width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"length_ft","label":"Length","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"depth_ft","label":"Depth","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"height_ft","label":"Height","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"thickness_ft","label":"Wall thickness","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"thickness_in","label":"Slab thickness","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"slab_thickness_in","label":"Adjacent slab thickness","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"thickened_width_ft","label":"Thickened width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"thickened_depth_in","label":"Thickened depth","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"excavation_width_ft","label":"Excavation width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"excavation_depth_ft","label":"Excavation depth","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"stair_width_ft","label":"Stair width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"tread_depth_ft","label":"Tread depth","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"riser_count","label":"Riser count","group":"planFacts","value_type":"integer","unit":"EA","minimum":1},
    {"key":"riser_height_in","label":"Riser height","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"waist_thickness_in","label":"Waist thickness","group":"planFacts","value_type":"number","unit":"IN","minimum":0.000001},
    {"key":"formed_sides","label":"Formed sides","group":"methods","value_type":"integer","unit":"EA","minimum":0,"maximum":4},
    {"key":"longitudinal_bar_count","label":"Longitudinal bar count","group":"methods","value_type":"integer","unit":"EA","minimum":1},
    {"key":"rebar_lf_per_each","label":"Reinforcing length per each","group":"methods","value_type":"number","unit":"LF/EA","minimum":0.000001},
    {"key":"rebar_unit_weight_lb_per_ft","label":"Rebar unit weight","group":"methods","value_type":"number","unit":"LB/LF","minimum":0.000001},
    {"key":"reinforcing_lb_per_sf","label":"Reinforcing allowance","group":"methods","value_type":"number","unit":"LB/SF","minimum":0.000001},
    {"key":"rebar_lb_per_lf","label":"Reinforcing allowance","group":"methods","value_type":"number","unit":"LB/LF","minimum":0.000001},
    {"key":"place_concrete_mh_per_cy","label":"Place concrete production rate","group":"production","value_type":"number","unit":"MH/CY","minimum":0},
    {"key":"form_mh_per_sf","label":"Form production rate","group":"production","value_type":"number","unit":"MH/SF","minimum":0},
    {"key":"rebar_mh_per_lb","label":"Reinforcing production rate","group":"production","value_type":"number","unit":"MH/LB","minimum":0},
    {"key":"concrete_waste_pct","label":"Concrete waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"rebar_waste_pct","label":"Reinforcing waste","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"elevation_ft","label":"Elevation","group":"drawing","value_type":"number","unit":"FT"},
    {"key":"elevation_reference","label":"Elevation reference","group":"drawing","value_type":"select","options":["top","bottom","centerline"]}
  ]$inputs$::jsonb;
begin
  for v_row in
    select * from (values
      ('thickened_edge','Thickened Edge','footing','LF'),
      ('thickened_slab','Thickened Slab','slab','SF'),
      ('grade_beam','Grade Beam','structural','LF'),
      ('foundation_wall','Foundation Wall','wall','LF'),
      ('column_pier','Column / Pier','structural','EA'),
      ('elevated_slab','Elevated Slab','slab','SF'),
      ('stairs','Concrete Stairs','structural','EA'),
      ('curb','Concrete Curb','site','LF'),
      ('opening_boxout','Opening / Boxout','structural','EA')
    ) as families(code,name,family,unit)
  loop
    v_roles := case v_row.code
      when 'thickened_edge' then '[{"key":"run","label":"Thickened edge run","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":true,"required":true}]'::jsonb
      when 'thickened_slab' then '[{"key":"area","label":"Net slab area","unit":"SF","geometry_type":"polygon","measurement_type":"area","primary":true,"required":true},{"key":"thickened_edge","label":"Thickened edge run","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":false,"required":false}]'::jsonb
      when 'column_pier' then '[{"key":"locations","label":"Column / pier locations","unit":"EA","geometry_type":"count","measurement_type":"count","primary":true,"required":true}]'::jsonb
      when 'elevated_slab' then '[{"key":"area","label":"Net elevated slab area","unit":"SF","geometry_type":"polygon","measurement_type":"area","primary":true,"required":true},{"key":"edge_forms","label":"Elevated slab edge forms","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":false,"required":false}]'::jsonb
      when 'stairs' then '[{"key":"locations","label":"Stair flights","unit":"EA","geometry_type":"count","measurement_type":"count","primary":true,"required":true}]'::jsonb
      when 'opening_boxout' then '[{"key":"locations","label":"Opening / boxout locations","unit":"EA","geometry_type":"count","measurement_type":"count","primary":true,"required":true}]'::jsonb
      else '[{"key":"run","label":"Concrete run","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":true,"required":true}]'::jsonb
    end;
    v_modules := case when v_row.code = 'opening_boxout' then
      '[{"key":"concrete","repeatable":false,"default_enabled":true},{"key":"forms","repeatable":false,"default_enabled":true},{"key":"labor","repeatable":true,"default_enabled":true}]'::jsonb
      else '[{"key":"concrete","repeatable":false,"default_enabled":true},{"key":"forms","repeatable":false,"default_enabled":true},{"key":"reinforcing","repeatable":true,"default_enabled":true},{"key":"excavation_backfill","repeatable":true,"default_enabled":true},{"key":"labor","repeatable":true,"default_enabled":true}]'::jsonb
    end;
    v_outputs := case
      when v_row.code = 'opening_boxout' then '[{"key":"concrete.opening_cy","module_key":"concrete","label":"Concrete opening deduction","resource_class":"material","unit":"CY","algorithm":"opening-volume-v1","legacy_component_key":"opening"},{"key":"forms.contact_sf","module_key":"forms","label":"Opening form contact area","resource_class":"material","unit":"SF","algorithm":"opening-form-contact-v1","legacy_component_key":"forms"},{"key":"labor.forms_mh","module_key":"labor","label":"Opening form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_forms"}]'::jsonb
      when v_row.code in ('grade_beam','foundation_wall') then '[{"key":"concrete.installed_cy","module_key":"concrete","label":"Concrete — installed","resource_class":"material","unit":"CY","algorithm":"edge-volume-v1","legacy_component_key":"concrete"},{"key":"concrete.procurement_cy","module_key":"concrete","label":"Concrete — procurement","resource_class":"material","unit":"CY","algorithm":"waste-adjustment-v1","legacy_component_key":"concrete_procurement"},{"key":"forms.contact_sf","module_key":"forms","label":"Form contact area","resource_class":"material","unit":"SF","algorithm":"edge-form-contact-v1","legacy_component_key":"forms"},{"key":"reinforcing.steel_lb","module_key":"reinforcing","label":"Reinforcing steel","resource_class":"material","unit":"LB","algorithm":"edge-rebar-weight-v1","legacy_component_key":"rebar"},{"key":"excavation_backfill.excavation_cy","module_key":"excavation_backfill","label":"Excavation","resource_class":"material","unit":"CY","algorithm":"linear-excavation-v1","legacy_component_key":"excavation"},{"key":"excavation_backfill.backfill_cy","module_key":"excavation_backfill","label":"Backfill","resource_class":"material","unit":"CY","algorithm":"excavation-less-concrete-v1","legacy_component_key":"backfill"},{"key":"labor.place_concrete_mh","module_key":"labor","label":"Place concrete labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_place"},{"key":"labor.forms_mh","module_key":"labor","label":"Form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_forms"},{"key":"labor.reinforcing_mh","module_key":"labor","label":"Reinforcing labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_rebar"}]'::jsonb
      else '[{"key":"concrete.installed_cy","module_key":"concrete","label":"Concrete — installed","resource_class":"material","unit":"CY","algorithm":"edge-volume-v1","legacy_component_key":"concrete"},{"key":"concrete.procurement_cy","module_key":"concrete","label":"Concrete — procurement","resource_class":"material","unit":"CY","algorithm":"waste-adjustment-v1","legacy_component_key":"concrete_procurement"},{"key":"forms.contact_sf","module_key":"forms","label":"Form contact area","resource_class":"material","unit":"SF","algorithm":"edge-form-contact-v1","legacy_component_key":"forms"},{"key":"reinforcing.steel_lb","module_key":"reinforcing","label":"Reinforcing steel","resource_class":"material","unit":"LB","algorithm":"edge-rebar-weight-v1","legacy_component_key":"rebar"},{"key":"labor.place_concrete_mh","module_key":"labor","label":"Place concrete labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_place"},{"key":"labor.forms_mh","module_key":"labor","label":"Form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_forms"},{"key":"labor.reinforcing_mh","module_key":"labor","label":"Reinforcing labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v1","legacy_component_key":"labor_rebar"}]'::jsonb
    end;
    insert into public.platform_condition_archetype_versions(
      archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
    )
    select archetype.id,1,'published','concrete_condition_v1',v_roles,v_inputs,v_modules,v_outputs,
      jsonb_build_object('quantity_authority','2d_measurement','projection_status','verification_adapter_pending'),
      'V1 edge-parity contract. Geometry remains the quantity authority; derived physical projection is verification-only.',now()
    from public.platform_condition_archetypes archetype
    where archetype.code = v_row.code
      and not exists (select 1 from public.platform_condition_archetype_versions existing where existing.archetype_id = archetype.id and existing.version_no = 1);
  end loop;
end $$;

-- Generalize the existing compatibility bootstrap from the three pilot keys to
-- every active published Condition archetype. The generated assembly remains a
-- compatibility projection; the Condition engine remains quantity authority.
create or replace function public.carez_ensure_pilot_condition_template(p_archetype_code text)
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
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;
  select * into v_archetype from public.platform_condition_archetypes where code = v_key and active;
  if not found then raise exception 'Active Platform Condition Archetype not found.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':' || v_key,0));

  select template_version.id,template_version.legacy_assembly_version_id into v_template_version_id,v_assembly_version_id
  from public.company_condition_templates template
  join public.platform_condition_archetypes archetype on archetype.id = template.archetype_id
  join public.company_condition_template_versions template_version on template_version.company_id = template.company_id and template_version.template_id = template.id
  where template.company_id = v_company and template.active and archetype.code = v_key
    and template_version.status = 'published' and template_version.legacy_assembly_version_id is not null
  order by template_version.version_no desc limit 1;
  if v_template_version_id is not null then
    return jsonb_build_object('template_version_id',v_template_version_id,'legacy_assembly_version_id',v_assembly_version_id,'created',false);
  end if;

  select * into v_archetype_version from public.platform_condition_archetype_versions
  where archetype_id = v_archetype.id and status = 'published' order by version_no desc limit 1;
  if not found or v_archetype_version.engine_key <> 'concrete_condition_v1' then raise exception 'Published Concrete Condition contract not found.'; end if;
  v_template_code := 'COND-' || upper(replace(v_key,'_','-'));
  v_name := v_archetype.name;
  v_assembly_code := v_template_code || '-RUNTIME';
  v_description := 'Carez Concrete Condition compatibility projection. Author through Condition Properties.';

  select assembly.id into v_assembly_id from public.concrete_assemblies assembly where assembly.company_id = v_company and assembly.code = v_assembly_code limit 1;
  if v_assembly_id is null then
    insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description,active,direct_takeoff_enabled,created_by)
    values (v_company,v_assembly_code,v_name,'Concrete Conditions',v_archetype.primary_measurement_unit,v_description,true,true,auth.uid()) returning id into v_assembly_id;
  end if;
  select version.id into v_assembly_version_id from public.concrete_assembly_versions version
  where version.company_id = v_company and version.assembly_id = v_assembly_id and version.status = 'published' order by version.version_no desc limit 1;
  if v_assembly_version_id is null then
    select version.id into v_assembly_version_id from public.concrete_assembly_versions version
    where version.company_id = v_company and version.assembly_id = v_assembly_id and version.status = 'draft' order by version.version_no desc limit 1;
    if v_assembly_version_id is null then
      insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,notes,assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,created_by)
      values (v_company,v_assembly_id,coalesce((select max(version_no) + 1 from public.concrete_assembly_versions where assembly_id = v_assembly_id),1),'draft','carez','Concrete Condition compatibility projection','Generated and governed by carez_ensure_pilot_condition_template.',v_assembly_code,v_name,'Concrete Conditions',v_archetype.primary_measurement_unit,v_description,auth.uid()) returning id into v_assembly_version_id;
    end if;
    delete from public.concrete_assembly_components where company_id = v_company and assembly_version_id = v_assembly_version_id;
    insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,output_unit,quantity_formula,baseline_source,pricing_strategy,resource_behavior,estimate_visible,authoring_config,sort_order)
    select v_company,v_assembly_version_id,output->>'legacy_component_key',output->>'label',case output->>'resource_class' when 'labor' then 'labor' when 'equipment' then 'equipment' else 'material' end,upper(output->>'unit'),jsonb_build_object('var','quantity'),'Server-authoritative Concrete Condition output',case when output->>'resource_class' = 'labor' then 'current_cost' else 'none' end,case output->>'resource_class' when 'labor' then 'labor' when 'equipment' then 'owned_equipment' else 'consumed_material' end,true,jsonb_build_object('mode','condition_compatibility','condition_output_key',output->>'key'),ordinality::integer * 10
    from jsonb_array_elements(v_archetype_version.output_schema) with ordinality outputs(output,ordinality);
    update public.concrete_assembly_versions set status = 'published',published_at = now() where id = v_assembly_version_id and company_id = v_company;
  end if;
  select count(*) into v_component_count from public.concrete_assembly_components component where component.company_id = v_company and component.assembly_version_id = v_assembly_version_id;
  v_output_count := jsonb_array_length(v_archetype_version.output_schema);
  if v_component_count <> v_output_count or exists (select 1 from jsonb_array_elements(v_archetype_version.output_schema) output where not exists (select 1 from public.concrete_assembly_components component where component.company_id = v_company and component.assembly_version_id = v_assembly_version_id and component.component_key = output->>'legacy_component_key' and upper(component.output_unit) = upper(output->>'unit'))) then
    raise exception 'Concrete Condition compatibility projection is incomplete.';
  end if;
  select template.id into v_template_id from public.company_condition_templates template where template.company_id = v_company and template.archetype_id = v_archetype.id order by template.active desc,template.created_at limit 1;
  if v_template_id is null then
    insert into public.company_condition_templates(company_id,archetype_id,code,name,description,active,created_by) values (v_company,v_archetype.id,v_template_code,v_name,v_description,true,auth.uid()) returning id into v_template_id;
  else
    update public.company_condition_templates set active = true,updated_at = now() where id = v_template_id and company_id = v_company and not active;
  end if;
  select version.id into v_template_version_id from public.company_condition_template_versions version where version.company_id = v_company and version.template_id = v_template_id and version.status = 'draft' order by version.version_no desc limit 1;
  if v_template_version_id is null then
    insert into public.company_condition_template_versions(company_id,template_id,archetype_version_id,version_no,status,template_code_snapshot,template_name_snapshot,template_description_snapshot,module_defaults,input_defaults,input_provenance,pricing_defaults,legacy_assembly_version_id,notes,created_by)
    values (v_company,v_template_id,v_archetype_version.id,coalesce((select max(version_no) + 1 from public.company_condition_template_versions where template_id = v_template_id),1),'draft',v_template_code,v_name,v_description,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,v_assembly_version_id,'Generated V1 Condition template. Condition algorithms remain authoritative.',auth.uid()) returning id into v_template_version_id;
  else
    update public.company_condition_template_versions set archetype_version_id = v_archetype_version.id,legacy_assembly_version_id = v_assembly_version_id,template_code_snapshot = v_template_code,template_name_snapshot = v_name,template_description_snapshot = v_description where id = v_template_version_id and company_id = v_company;
  end if;
  delete from public.condition_legacy_output_mappings where company_id = v_company and template_version_id = v_template_version_id;
  insert into public.condition_legacy_output_mappings(company_id,template_version_id,output_key,legacy_assembly_component_id,legacy_component_key_snapshot,output_unit_snapshot,created_by)
  select v_company,v_template_version_id,output->>'key',component.id,output->>'legacy_component_key',upper(output->>'unit'),auth.uid()
  from jsonb_array_elements(v_archetype_version.output_schema) output
  join public.concrete_assembly_components component on component.company_id = v_company and component.assembly_version_id = v_assembly_version_id and component.component_key = output->>'legacy_component_key';
  perform public.carez_publish_company_condition_template_version(v_template_version_id);
  return jsonb_build_object('template_version_id',v_template_version_id,'legacy_assembly_version_id',v_assembly_version_id,'created',true);
end;
$$;

revoke all on function public.carez_ensure_pilot_condition_template(text) from public,anon;
grant execute on function public.carez_ensure_pilot_condition_template(text) to authenticated,service_role;
