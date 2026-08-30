-- Reconciled intelligent-takeoff foundation. Extends the current immutable/nested assembly model.
-- Construction-method persistence remains deliberately deferred; no parallel output lineage is introduced here.

alter table public.concrete_assemblies
  add column if not exists display_style jsonb;

alter table public.concrete_assembly_versions
  add column if not exists render_config jsonb;

alter table public.concrete_assembly_variables
  add column if not exists options jsonb,
  add column if not exists dimension_family text;

alter table public.concrete_assembly_components
  add column if not exists activation_rule jsonb,
  add column if not exists resource_behavior text,
  add column if not exists estimate_visible boolean not null default true;

update public.concrete_assembly_components
set resource_behavior=case estimate_item_type
  when 'labor' then 'labor'
  when 'material' then 'consumed_material'
  when 'subcontractor' then 'subcontractor'
  when 'equipment' then 'owned_equipment'
  else 'legacy_other'
end
where resource_behavior is null;
alter table public.concrete_assembly_components alter column resource_behavior set not null;

alter table public.concrete_assembly_components
  add constraint concrete_assembly_components_resource_behavior_chk
  check(resource_behavior in ('consumed_material','reusable_inventory','labor','owned_equipment','rental','subcontractor','readiness_resource','legacy_other')) not valid;
alter table public.concrete_assembly_components validate constraint concrete_assembly_components_resource_behavior_chk;

alter table public.takeoff_measurements
  add column if not exists geometry_anchor text not null default 'center',
  add column if not exists geometry_offset_in numeric;

alter table public.takeoff_measurements
  add constraint takeoff_measurements_geometry_anchor_chk
  check(geometry_anchor in ('center','left','right','custom')) not valid;
alter table public.takeoff_measurements validate constraint takeoff_measurements_geometry_anchor_chk;

-- Existing variables remain valid. New authoring values become typed property inputs while numeric formulas retain numeric-only evaluation.
alter table public.concrete_assembly_variables
  add constraint concrete_assembly_variables_value_type_foundation_chk
  check(value_type in ('number','dimension','percentage','boolean','enum','text')) not valid;
alter table public.concrete_assembly_variables validate constraint concrete_assembly_variables_value_type_foundation_chk;
