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

alter table public.concrete_assembly_components
  add constraint concrete_assembly_components_resource_behavior_chk
  check(resource_behavior is null or resource_behavior in ('consumed_material','reusable_inventory','labor','owned_equipment','rental','subcontractor','readiness_resource','legacy_other')) not valid;
alter table public.concrete_assembly_components validate constraint concrete_assembly_components_resource_behavior_chk;

alter table public.takeoff_measurements
  add column if not exists geometry_anchor text not null default 'center',
  add column if not exists geometry_offset_in numeric;

alter table public.takeoff_measurements
  add constraint takeoff_measurements_geometry_anchor_chk
  check(geometry_anchor in ('center','left','right','custom')) not valid;
alter table public.takeoff_measurements validate constraint takeoff_measurements_geometry_anchor_chk;

-- Published variables remain untouched. Replace the original restrictive type check with the canonical supported set.
alter table public.concrete_assembly_variables
  drop constraint if exists concrete_assembly_variables_type_chk;
alter table public.concrete_assembly_variables
  add constraint concrete_assembly_variables_type_chk
  check(value_type in ('number','dimension','percentage','boolean','enum','text')) not valid;
alter table public.concrete_assembly_variables validate constraint concrete_assembly_variables_type_chk;
