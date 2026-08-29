-- Carez OS: lineage required to carry an accepted takeoff into field operations.

alter table public.work_packages
  add column if not exists source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  add column if not exists source_assembly_version_id uuid references public.concrete_assembly_versions(id) on delete set null;

create unique index if not exists work_packages_award_takeoff_unique
  on public.work_packages(company_id,source_estimate_id,source_takeoff_measurement_id)
  where source_estimate_id is not null and source_takeoff_measurement_id is not null;

alter table public.work_package_operations
  add column if not exists source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  add column if not exists source_assembly_component_id uuid references public.concrete_assembly_components(id) on delete set null,
  add column if not exists source_budget_line_id uuid references public.project_budget_lines(id) on delete set null;

create unique index if not exists work_package_operations_source_estimate_item_unique
  on public.work_package_operations(company_id,work_package_id,source_estimate_item_id)
  where source_estimate_item_id is not null;

alter table public.work_package_resource_requirements
  add column if not exists source_estimate_item_id uuid references public.estimate_items(id) on delete set null,
  add column if not exists source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  add column if not exists source_budget_line_id uuid references public.project_budget_lines(id) on delete set null,
  add column if not exists auto_generated boolean not null default false;

create unique index if not exists work_package_resources_source_estimate_item_unique
  on public.work_package_resource_requirements(company_id,work_package_operation_id,source_estimate_item_id)
  where source_estimate_item_id is not null;

alter table public.project_inspections
  add column if not exists source_estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  add column if not exists auto_generated boolean not null default false;

create unique index if not exists project_inspections_auto_takeoff_unique
  on public.project_inspections(company_id,required_for_operation_id,source_takeoff_measurement_id)
  where auto_generated and required_for_operation_id is not null and source_takeoff_measurement_id is not null;

alter table public.pour_plans
  add column if not exists source_estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists source_work_package_id uuid references public.work_packages(id) on delete set null;

create unique index if not exists pour_plans_source_work_package_unique
  on public.pour_plans(company_id,source_work_package_id)
  where source_work_package_id is not null;
