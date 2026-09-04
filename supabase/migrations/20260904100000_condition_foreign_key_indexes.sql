-- Carez P0.5A/C: cover Concrete Condition foreign-key access paths.
--
-- This is intentionally a follow-up migration because
-- 20260904090000_concrete_condition_foundation.sql has already been applied to
-- the QA project. The indexes are additive and do not change either the new
-- Condition contracts or the legacy Takeoff compatibility boundary.

create index company_condition_template_versions_legacy_assembly_idx
  on public.company_condition_template_versions(company_id,legacy_assembly_version_id);

create index company_condition_template_versions_archetype_version_idx
  on public.company_condition_template_versions(archetype_version_id);

create index company_condition_template_versions_created_by_idx
  on public.company_condition_template_versions(created_by);

create index company_condition_templates_archetype_idx
  on public.company_condition_templates(archetype_id);

create index company_condition_templates_created_by_idx
  on public.company_condition_templates(created_by);

create index condition_legacy_output_mappings_template_idx
  on public.condition_legacy_output_mappings(company_id,template_version_id);

create index condition_legacy_output_mappings_component_idx
  on public.condition_legacy_output_mappings(legacy_assembly_component_id);

create index condition_legacy_output_mappings_created_by_idx
  on public.condition_legacy_output_mappings(created_by);

create index platform_condition_archetype_versions_created_by_idx
  on public.platform_condition_archetype_versions(created_by);

create index project_condition_versions_legacy_method_idx
  on public.project_concrete_condition_versions(company_id,legacy_method_profile_id);

create index project_condition_versions_source_idx
  on public.project_concrete_condition_versions(company_id,source_version_id);

create index project_condition_versions_template_idx
  on public.project_concrete_condition_versions(company_id,template_version_id);

create index project_condition_versions_archetype_idx
  on public.project_concrete_condition_versions(archetype_version_id);

create index project_condition_versions_created_by_idx
  on public.project_concrete_condition_versions(created_by);

create index project_condition_versions_verified_by_idx
  on public.project_concrete_condition_versions(verified_by);

create index project_concrete_conditions_template_idx
  on public.project_concrete_conditions(company_id,template_id);

create index project_concrete_conditions_created_by_idx
  on public.project_concrete_conditions(created_by);

create index project_condition_holds_output_idx
  on public.project_condition_holds(company_id,output_id);

create index project_condition_holds_resolved_by_idx
  on public.project_condition_holds(resolved_by);

create index project_condition_roles_measurement_idx
  on public.project_condition_measurement_roles(company_id,measurement_id);

create index project_condition_roles_created_by_idx
  on public.project_condition_measurement_roles(created_by);

create index project_condition_modules_created_by_idx
  on public.project_condition_module_instances(created_by);

create index project_condition_outputs_driver_role_idx
  on public.project_condition_outputs(company_id,driver_measurement_role_id);

create index project_condition_outputs_module_idx
  on public.project_condition_outputs(company_id,module_instance_id);

create index project_condition_outputs_estimate_item_idx
  on public.project_condition_outputs(generated_estimate_item_id);

create index project_condition_outputs_legacy_output_idx
  on public.project_condition_outputs(legacy_takeoff_output_id);
