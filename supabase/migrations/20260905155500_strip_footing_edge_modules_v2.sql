-- Issue #55: expand Strip / Wall Footing into the first full concrete-native
-- Condition module model before additional derived-3D expansion.
-- Existing published v1 archetype/template/Condition versions remain immutable.

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
    and jsonb_typeof(p_input_schema) = 'array'
    and jsonb_typeof(p_module_schema) = 'array'
    and jsonb_typeof(p_output_schema) = 'array'
    and (
      select count(*) from jsonb_array_elements(p_role_schema) role
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
        or (module ? 'input_schema' and jsonb_typeof(module->'input_schema') <> 'array')
    )
    and (
      select count(*) = count(distinct module->>'key')
      from jsonb_array_elements(p_module_schema) module
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_module_schema) module,
           lateral jsonb_array_elements(coalesce(module->'input_schema','[]'::jsonb)) input
      where nullif(trim(input->>'key'),'') is null
        or input->>'value_type' not in ('number','integer','boolean','text','select')
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_module_schema) module
      where (
        select count(*) <> count(distinct input->>'key')
        from jsonb_array_elements(coalesce(module->'input_schema','[]'::jsonb)) input
      )
    )
    and not exists (
      select 1 from jsonb_array_elements(p_output_schema) output
      where nullif(trim(output->>'key'),'') is null
        or nullif(trim(output->>'algorithm'),'') is null
        or output->>'unit' not in ('CY','SF','LF','LB','EA','HR')
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

revoke all on function public.carez_condition_archetype_schema_is_valid(jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.carez_condition_archetype_schema_is_valid(jsonb,jsonb,jsonb,jsonb) to authenticated,service_role;

create or replace function public.carez_validate_project_condition_module()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_module jsonb;
  v_input jsonb;
  v_value jsonb;
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
  if jsonb_typeof(coalesce(new.input_values,'{}'::jsonb)) <> 'object' then
    raise exception 'Condition module inputs must be a JSON object.';
  end if;

  for v_input in select value from jsonb_array_elements(coalesce(v_module->'input_schema','[]'::jsonb)) loop
    if new.input_values ? (v_input->>'key') then
      v_value := new.input_values->(v_input->>'key');
      if not public.carez_condition_json_value_matches_type(v_value,v_input->>'value_type') then
        raise exception 'Condition module input % does not match type %.', v_input->>'key', v_input->>'value_type';
      end if;
      if v_input ? 'minimum' and jsonb_typeof(v_value) = 'number' and (v_value #>> '{}')::numeric < (v_input->>'minimum')::numeric then
        raise exception 'Condition module input % is below its minimum.', v_input->>'key';
      end if;
      if v_input ? 'maximum' and jsonb_typeof(v_value) = 'number' and (v_value #>> '{}')::numeric > (v_input->>'maximum')::numeric then
        raise exception 'Condition module input % exceeds its maximum.', v_input->>'key';
      end if;
      if v_input->>'value_type' = 'select' and v_input ? 'options'
         and not (v_input->'options') ? (v_value #>> '{}') then
        raise exception 'Condition module input % is not an allowed option.', v_input->>'key';
      end if;
    end if;
  end loop;

  if exists (
    select 1 from jsonb_object_keys(coalesce(new.input_values,'{}'::jsonb)) supplied(key)
    where not exists (
      select 1 from jsonb_array_elements(coalesce(v_module->'input_schema','[]'::jsonb)) definition
      where definition->>'key' = supplied.key
    )
  ) then
    raise exception 'Condition module contains an unsupported input.';
  end if;

  return new;
end;
$$;

revoke all on function public.carez_validate_project_condition_module() from public,anon,authenticated;

-- Publish immutable Strip / Wall Footing archetype v2. v1 remains untouched for
-- existing verified/draft Conditions that already reference it.
insert into public.platform_condition_archetype_versions(
  archetype_id,version_no,status,engine_key,role_schema,input_schema,module_schema,output_schema,projection_schema,notes,published_at
)
select
  archetype.id,
  2,
  'published',
  'concrete_condition_v1',
  $json$[
    {"key":"run","label":"Footing run","unit":"LF","geometry_type":"polyline","measurement_type":"linear","primary":true,"required":true},
    {"key":"end_forms","label":"End forms","unit":"EA","geometry_type":"count","measurement_type":"count","primary":false,"required":false},
    {"key":"anchors_embeds","label":"Anchors / embeds","unit":"EA","geometry_type":"count","measurement_type":"count","primary":false,"required":false}
  ]$json$::jsonb,
  $json$[
    {"key":"width_ft","label":"Footing width","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"depth_ft","label":"Footing depth","group":"planFacts","value_type":"number","unit":"FT","minimum":0.000001},
    {"key":"place_concrete_mh_per_cy","label":"Place concrete production","group":"production","value_type":"number","unit":"MH/CY","minimum":0},
    {"key":"form_mh_per_sf","label":"Formwork production","group":"production","value_type":"number","unit":"MH/SF","minimum":0},
    {"key":"rebar_mh_per_lb","label":"Reinforcing production","group":"production","value_type":"number","unit":"MH/LB","minimum":0},
    {"key":"anchor_embed_mh_per_ea","label":"Anchor / embed production","group":"production","value_type":"number","unit":"MH/EA","minimum":0},
    {"key":"excavation_mh_per_cy","label":"Excavation production","group":"production","value_type":"number","unit":"MH/CY","minimum":0},
    {"key":"backfill_mh_per_cy","label":"Backfill production","group":"production","value_type":"number","unit":"MH/CY","minimum":0},
    {"key":"misc_mh_per_ea","label":"Miscellaneous production","group":"production","value_type":"number","unit":"MH/EA","minimum":0},
    {"key":"concrete_waste_pct","label":"Concrete order allowance","group":"commercial","value_type":"number","unit":"%","minimum":0,"maximum":100},
    {"key":"elevation_ft","label":"Elevation","group":"drawing","value_type":"number","unit":"FT"},
    {"key":"elevation_reference","label":"Elevation reference","group":"drawing","value_type":"select","options":["top","bottom","centerline"]}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete","label":"Concrete","repeatable":false,"default_enabled":true,"input_schema":[
      {"key":"profile","label":"Section profile","value_type":"select","options":["rectangular","trapezoid"]},
      {"key":"top_width_ft","label":"Top width","value_type":"number","unit":"FT","minimum":0},
      {"key":"concrete_type","label":"Concrete type","value_type":"select","options":["normal_weight","lightweight","other"]},
      {"key":"compressive_strength_psi","label":"Concrete strength","value_type":"number","unit":"PSI","minimum":0},
      {"key":"placement_method","label":"Placement method","value_type":"select","options":["direct_chute","line_pump","boom_pump","buggy","conveyor","other"]},
      {"key":"top_finish","label":"Top surface","value_type":"select","options":["none","float","trowel","broom","other"]}
    ]},
    {"key":"forms","label":"Forms","repeatable":false,"default_enabled":false,"input_schema":[
      {"key":"form_method","label":"Form method","value_type":"select","options":["earth_formed","one_side","two_sides","custom"]},
      {"key":"formed_sides","label":"Formed sides","value_type":"integer","unit":"EA","minimum":0,"maximum":2},
      {"key":"form_system","label":"Form system","value_type":"select","options":["wood_lumber","panel","other"]},
      {"key":"resource_tracking","label":"Track form material","value_type":"boolean"},
      {"key":"form_material_factor_lf_per_lf","label":"Form material factor","value_type":"number","unit":"LF/LF","minimum":0},
      {"key":"stakes_enabled","label":"Track stakes","value_type":"boolean"},
      {"key":"stake_spacing_ft","label":"Stake spacing","value_type":"number","unit":"FT","minimum":0},
      {"key":"stakes_per_location","label":"Stakes per location","value_type":"integer","unit":"EA","minimum":0}
    ]},
    {"key":"reinforcing","label":"Reinforcing set","repeatable":true,"default_enabled":false,"input_schema":[
      {"key":"kind","label":"Reinforcing pattern","value_type":"select","options":["continuous","transverse","dowel","stirrup","custom"]},
      {"key":"description","label":"Description","value_type":"text"},
      {"key":"bar_size","label":"Bar size","value_type":"select","options":["#3","#4","#5","#6","#7","#8","#9","#10","#11","#14","#18","Custom"]},
      {"key":"custom_unit_weight_lb_per_ft","label":"Custom unit weight","value_type":"number","unit":"LB/LF","minimum":0},
      {"key":"bars_per_run","label":"Bars per run","value_type":"integer","unit":"EA","minimum":0},
      {"key":"spacing_in","label":"Spacing / centers","value_type":"number","unit":"IN","minimum":0},
      {"key":"pieces_per_location","label":"Pieces per location","value_type":"integer","unit":"EA","minimum":0},
      {"key":"piece_length_ft","label":"Piece length","value_type":"number","unit":"FT","minimum":0},
      {"key":"extra_locations","label":"Extra locations","value_type":"integer","unit":"EA","minimum":0},
      {"key":"layers","label":"Layers","value_type":"integer","unit":"EA","minimum":1},
      {"key":"faces","label":"Faces","value_type":"integer","unit":"EA","minimum":1},
      {"key":"cover_in","label":"Cover","value_type":"number","unit":"IN","minimum":0},
      {"key":"splice_policy","label":"Splice policy","value_type":"select","options":["none","stock_lap"]},
      {"key":"stock_length_ft","label":"Stock length","value_type":"number","unit":"FT","minimum":0},
      {"key":"lap_length_in","label":"Lap length","value_type":"number","unit":"IN","minimum":0},
      {"key":"custom_total_length_ft","label":"Custom total length","value_type":"number","unit":"FT","minimum":0},
      {"key":"waste_pct","label":"Procurement allowance","value_type":"number","unit":"%","minimum":0,"maximum":100}
    ]},
    {"key":"anchors_embeds","label":"Anchor / embed set","repeatable":true,"default_enabled":false,"input_schema":[
      {"key":"kind","label":"Item type","value_type":"select","options":["anchor_bolt","dowel","embed","other"]},
      {"key":"description","label":"Description","value_type":"text"},
      {"key":"count_mode","label":"Count from","value_type":"select","options":["measured_role","spacing","fixed_count"]},
      {"key":"spacing_in","label":"Spacing","value_type":"number","unit":"IN","minimum":0},
      {"key":"per_location","label":"Per location","value_type":"integer","unit":"EA","minimum":0},
      {"key":"extra_count","label":"Extra count","value_type":"integer","unit":"EA","minimum":0},
      {"key":"fixed_count","label":"Fixed count","value_type":"integer","unit":"EA","minimum":0}
    ]},
    {"key":"excavation_backfill","label":"Excavation / backfill","repeatable":false,"default_enabled":false,"input_schema":[
      {"key":"excavation_method","label":"Excavation method","value_type":"select","options":["machine_trench","machine_open_cut","hand","other"]},
      {"key":"bottom_width_mode","label":"Bottom width","value_type":"select","options":["footing_plus_working_room","explicit"]},
      {"key":"working_room_each_side_ft","label":"Working room each side","value_type":"number","unit":"FT","minimum":0},
      {"key":"bottom_width_ft","label":"Explicit bottom width","value_type":"number","unit":"FT","minimum":0},
      {"key":"excavation_depth_ft","label":"Excavation depth","value_type":"number","unit":"FT","minimum":0},
      {"key":"side_slope_h_to_v","label":"Side slope H:V","value_type":"number","unit":"H/V","minimum":0},
      {"key":"swell_pct","label":"Swell / expansion","value_type":"number","unit":"%","minimum":0,"maximum":200},
      {"key":"export_pct","label":"Export share","value_type":"number","unit":"%","minimum":0,"maximum":100},
      {"key":"backfill_pct","label":"Backfill share","value_type":"number","unit":"%","minimum":0,"maximum":100},
      {"key":"backfill_type","label":"Backfill type","value_type":"select","options":["native","structural_fill","crushed_rock","other"]},
      {"key":"compaction","label":"Compaction requirement","value_type":"text"}
    ]},
    {"key":"placement_equipment","label":"Placement / equipment","repeatable":false,"default_enabled":false,"input_schema":[
      {"key":"method","label":"Placement method","value_type":"select","options":["line_pump","boom_pump","buggy","conveyor","other"]},
      {"key":"placement_rate_cy_per_hr","label":"Placement rate","value_type":"number","unit":"CY/HR","minimum":0},
      {"key":"setup_hr","label":"Setup / cleanup","value_type":"number","unit":"HR","minimum":0}
    ]},
    {"key":"finish_cure_protection","label":"Finish / cure / protection","repeatable":false,"default_enabled":false,"input_schema":[
      {"key":"finish_enabled","label":"Finish top surface","value_type":"boolean"},
      {"key":"finish_type","label":"Finish type","value_type":"select","options":["float","trowel","broom","other"]},
      {"key":"cure_enabled","label":"Cure / protect top surface","value_type":"boolean"},
      {"key":"protection_type","label":"Cure / protection type","value_type":"select","options":["curing_compound","wet_cure","blanket","poly","other"]}
    ]},
    {"key":"labor","label":"Labor","repeatable":false,"default_enabled":false,"input_schema":[]},
    {"key":"miscellaneous","label":"Miscellaneous item","repeatable":true,"default_enabled":false,"input_schema":[
      {"key":"category","label":"Category","value_type":"select","options":["safety","protection","hardware","cleanup","other"]},
      {"key":"description","label":"Description","value_type":"text"},
      {"key":"quantity_ea","label":"Quantity","value_type":"number","unit":"EA","minimum":0}
    ]}
  ]$json$::jsonb,
  $json$[
    {"key":"concrete.installed_cy","module_key":"concrete","label":"Concrete — installed","resource_class":"material","unit":"CY","algorithm":"strip-profile-volume-v2","legacy_component_key":"concrete"},
    {"key":"concrete.procurement_cy","module_key":"concrete","label":"Concrete — procurement","resource_class":"material","unit":"CY","algorithm":"waste-adjustment-v2","legacy_component_key":"concrete_procurement"},
    {"key":"forms.side_contact_sf","module_key":"forms","label":"Side form contact area","resource_class":"material","unit":"SF","algorithm":"strip-side-form-v2","legacy_component_key":"forms"},
    {"key":"forms.end_contact_sf","module_key":"forms","label":"End form contact area","resource_class":"material","unit":"SF","algorithm":"strip-end-form-v2","legacy_component_key":"end_forms"},
    {"key":"forms.form_material_lf","module_key":"forms","label":"Form material demand","resource_class":"material","unit":"LF","algorithm":"strip-form-material-v2","legacy_component_key":"form_material"},
    {"key":"forms.stakes_ea","module_key":"forms","label":"Form stakes","resource_class":"material","unit":"EA","algorithm":"strip-form-stakes-v2","legacy_component_key":"form_stakes"},
    {"key":"reinforcing.steel_lb","module_key":"reinforcing","label":"Reinforcing steel","resource_class":"material","unit":"LB","algorithm":"strip-repeatable-rebar-v2","legacy_component_key":"rebar"},
    {"key":"anchors_embeds.anchor_ea","module_key":"anchors_embeds","label":"Anchors / embeds","resource_class":"material","unit":"EA","algorithm":"strip-repeatable-anchors-v2","legacy_component_key":"anchors"},
    {"key":"excavation_backfill.excavation_cy","module_key":"excavation_backfill","label":"Excavation — in place","resource_class":"material","unit":"CY","algorithm":"strip-excavation-profile-v2","legacy_component_key":"excavation"},
    {"key":"excavation_backfill.loose_cy","module_key":"excavation_backfill","label":"Excavation — loose","resource_class":"material","unit":"CY","algorithm":"strip-excavation-swell-v2","legacy_component_key":"excavation_loose"},
    {"key":"excavation_backfill.export_cy","module_key":"excavation_backfill","label":"Export / haul-off","resource_class":"material","unit":"CY","algorithm":"strip-excavation-export-v2","legacy_component_key":"export"},
    {"key":"excavation_backfill.backfill_cy","module_key":"excavation_backfill","label":"Backfill — compacted","resource_class":"material","unit":"CY","algorithm":"strip-backfill-v2","legacy_component_key":"backfill"},
    {"key":"placement_equipment.equipment_hr","module_key":"placement_equipment","label":"Placement equipment","resource_class":"equipment","unit":"HR","algorithm":"placement-equipment-time-v2","legacy_component_key":"placement_equipment"},
    {"key":"finish_cure_protection.finish_sf","module_key":"finish_cure_protection","label":"Top finish area","resource_class":"material","unit":"SF","algorithm":"strip-top-surface-v2","legacy_component_key":"finish"},
    {"key":"finish_cure_protection.protection_sf","module_key":"finish_cure_protection","label":"Cure / protection area","resource_class":"material","unit":"SF","algorithm":"strip-top-surface-v2","legacy_component_key":"protection"},
    {"key":"miscellaneous.item_ea","module_key":"miscellaneous","label":"Miscellaneous items","resource_class":"other","unit":"EA","algorithm":"repeatable-count-v2","legacy_component_key":"misc"},
    {"key":"labor.place_concrete_mh","module_key":"labor","label":"Place concrete labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_place"},
    {"key":"labor.forms_mh","module_key":"labor","label":"Form labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_forms"},
    {"key":"labor.reinforcing_mh","module_key":"labor","label":"Reinforcing labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_rebar"},
    {"key":"labor.anchors_embeds_mh","module_key":"labor","label":"Anchor / embed labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_anchors"},
    {"key":"labor.excavation_mh","module_key":"labor","label":"Excavation labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_excavation"},
    {"key":"labor.backfill_mh","module_key":"labor","label":"Backfill labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_backfill"},
    {"key":"labor.misc_mh","module_key":"labor","label":"Miscellaneous labor","resource_class":"labor","unit":"HR","algorithm":"production-rate-v2","legacy_component_key":"labor_misc"}
  ]$json$::jsonb,
  $json${"shape":"rectangular_or_trapezoid_profile_sweep","required_inputs":["width_ft","depth_ft","elevation_ft","elevation_reference"],"quantity_authority":"2d_measurement","derived_3d_status":"deferred_until_issue_55_acceptance"}$json$::jsonb,
  'Issue #55 module-first Strip / Wall Footing contract. Structural reinforcing remains estimator/engineer-confirmed; no design inference.',
  now()
from public.platform_condition_archetypes archetype
where archetype.code = 'strip_wall_footing'
  and not exists (
    select 1 from public.platform_condition_archetype_versions existing
    where existing.archetype_id = archetype.id and existing.version_no = 2
  );

-- Build a new immutable company template + compatibility assembly version for
-- Strip v2. Existing v1 company templates and project Conditions remain untouched.
create or replace function public.carez_ensure_strip_footing_v2_template()
returns jsonb
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
  v_assembly_id uuid;
  v_assembly_version_id uuid;
  v_template_code text := 'COND-STRIP-FOOTING';
  v_assembly_code text := 'COND-STRIP-FOOTING-RUNTIME';
  v_name text := 'Strip / Wall Footing';
  v_description text := 'Carez Concrete Condition compatibility projection. Author through Condition Properties.';
  v_component_count integer;
  v_output_count integer;
begin
  if v_company is null or public.get_my_role() = 'employee' then raise exception 'Office access required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company::text || ':strip_wall_footing:v2',0));

  select * into v_archetype
  from public.platform_condition_archetypes
  where code = 'strip_wall_footing' and active;
  if not found then raise exception 'Active Strip / Wall Footing archetype not found.'; end if;

  select * into v_archetype_version
  from public.platform_condition_archetype_versions
  where archetype_id = v_archetype.id and version_no = 2 and status = 'published'
  limit 1;
  if not found or v_archetype_version.engine_key <> 'concrete_condition_v1' then
    raise exception 'Published Strip / Wall Footing v2 contract not found.';
  end if;

  select template_version.id,template_version.legacy_assembly_version_id
    into v_template_version_id,v_assembly_version_id
  from public.company_condition_templates template
  join public.company_condition_template_versions template_version
    on template_version.company_id = template.company_id and template_version.template_id = template.id
  where template.company_id = v_company
    and template.active
    and template.archetype_id = v_archetype.id
    and template_version.status = 'published'
    and template_version.archetype_version_id = v_archetype_version.id
    and template_version.legacy_assembly_version_id is not null
  order by template_version.version_no desc
  limit 1;
  if v_template_version_id is not null then
    return jsonb_build_object('template_version_id',v_template_version_id,'legacy_assembly_version_id',v_assembly_version_id,'created',false);
  end if;

  select assembly.id into v_assembly_id
  from public.concrete_assemblies assembly
  where assembly.company_id = v_company and assembly.code = v_assembly_code
  limit 1;
  if v_assembly_id is null then
    insert into public.concrete_assemblies(
      company_id,code,name,category,primary_measurement,description,active,direct_takeoff_enabled,created_by
    ) values (
      v_company,v_assembly_code,v_name,'Concrete Conditions','LF',v_description,true,true,auth.uid()
    ) returning id into v_assembly_id;
  end if;

  select version.id into v_assembly_version_id
  from public.concrete_assembly_versions version
  where version.company_id = v_company and version.assembly_id = v_assembly_id and version.status = 'draft'
  order by version.version_no desc limit 1;
  if v_assembly_version_id is null then
    insert into public.concrete_assembly_versions(
      company_id,assembly_id,version_no,status,source_type,source_label,notes,
      assembly_code_snapshot,assembly_name_snapshot,category_snapshot,primary_measurement_snapshot,description_snapshot,created_by
    ) values (
      v_company,v_assembly_id,
      coalesce((select max(version_no) + 1 from public.concrete_assembly_versions where company_id=v_company and assembly_id=v_assembly_id),1),
      'draft','carez','Concrete Condition compatibility projection',
      'Generated by carez_ensure_strip_footing_v2_template for Issue #55.',
      v_assembly_code,v_name,'Concrete Conditions','LF',v_description,auth.uid()
    ) returning id into v_assembly_version_id;
  end if;

  delete from public.concrete_assembly_components where company_id=v_company and assembly_version_id=v_assembly_version_id;
  insert into public.concrete_assembly_components(
    company_id,assembly_version_id,component_key,label,estimate_item_type,output_unit,quantity_formula,
    baseline_source,pricing_strategy,resource_behavior,estimate_visible,authoring_config,sort_order
  )
  select
    v_company,v_assembly_version_id,output->>'legacy_component_key',output->>'label',
    case output->>'resource_class' when 'labor' then 'labor' when 'equipment' then 'equipment' else 'material' end,
    upper(output->>'unit'),jsonb_build_object('var','quantity'),'Server-authoritative Concrete Condition output',
    case when output->>'resource_class'='labor' then 'current_cost' else 'none' end,
    case output->>'resource_class' when 'labor' then 'labor' when 'equipment' then 'owned_equipment' else 'consumed_material' end,
    true,jsonb_build_object('mode','condition_compatibility','condition_output_key',output->>'key'),ordinality::integer*10
  from jsonb_array_elements(v_archetype_version.output_schema) with ordinality outputs(output,ordinality);

  update public.concrete_assembly_versions set status='published',published_at=now()
  where id=v_assembly_version_id and company_id=v_company;

  select count(*) into v_component_count from public.concrete_assembly_components
  where company_id=v_company and assembly_version_id=v_assembly_version_id;
  v_output_count := jsonb_array_length(v_archetype_version.output_schema);
  if v_component_count <> v_output_count then raise exception 'Strip v2 compatibility projection is incomplete.'; end if;

  select template.id into v_template_id
  from public.company_condition_templates template
  where template.company_id=v_company and template.archetype_id=v_archetype.id
  order by template.active desc,template.created_at limit 1;
  if v_template_id is null then
    insert into public.company_condition_templates(company_id,archetype_id,code,name,description,active,created_by)
    values(v_company,v_archetype.id,v_template_code,v_name,v_description,true,auth.uid()) returning id into v_template_id;
  end if;

  select version.id into v_template_version_id
  from public.company_condition_template_versions version
  where version.company_id=v_company and version.template_id=v_template_id and version.status='draft'
  order by version.version_no desc limit 1;
  if v_template_version_id is null then
    insert into public.company_condition_template_versions(
      company_id,template_id,archetype_version_id,version_no,status,template_code_snapshot,template_name_snapshot,
      template_description_snapshot,module_defaults,input_defaults,input_provenance,pricing_defaults,legacy_assembly_version_id,notes,created_by
    ) values (
      v_company,v_template_id,v_archetype_version.id,
      coalesce((select max(version_no)+1 from public.company_condition_template_versions where company_id=v_company and template_id=v_template_id),1),
      'draft',v_template_code,v_name,v_description,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,v_assembly_version_id,
      'Issue #55 Strip / Wall Footing v2 template. Project values remain estimator-confirmed.',auth.uid()
    ) returning id into v_template_version_id;
  else
    update public.company_condition_template_versions
    set archetype_version_id=v_archetype_version.id,legacy_assembly_version_id=v_assembly_version_id,
        template_code_snapshot=v_template_code,template_name_snapshot=v_name,template_description_snapshot=v_description
    where id=v_template_version_id and company_id=v_company;
  end if;

  delete from public.condition_legacy_output_mappings where company_id=v_company and template_version_id=v_template_version_id;
  insert into public.condition_legacy_output_mappings(
    company_id,template_version_id,output_key,legacy_assembly_component_id,legacy_component_key_snapshot,output_unit_snapshot,created_by
  )
  select v_company,v_template_version_id,output->>'key',component.id,output->>'legacy_component_key',upper(output->>'unit'),auth.uid()
  from jsonb_array_elements(v_archetype_version.output_schema) output
  join public.concrete_assembly_components component
    on component.company_id=v_company and component.assembly_version_id=v_assembly_version_id
   and component.component_key=output->>'legacy_component_key';

  perform public.carez_publish_company_condition_template_version(v_template_version_id);
  return jsonb_build_object('template_version_id',v_template_version_id,'legacy_assembly_version_id',v_assembly_version_id,'created',true);
end;
$$;

revoke all on function public.carez_ensure_strip_footing_v2_template() from public,anon;
grant execute on function public.carez_ensure_strip_footing_v2_template() to authenticated,service_role;

comment on function public.carez_ensure_strip_footing_v2_template() is
  'Creates the immutable Strip / Wall Footing v2 company template and compatibility projection while preserving v1 lineage.';
