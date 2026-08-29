-- Takeoff/assembly performance hardening before production merge.
-- Index FK traversal paths used by cascade deletes, revision lineage and resource/production joins.

create index if not exists concrete_assemblies_created_by_idx on public.concrete_assemblies(created_by) where created_by is not null;
create index if not exists concrete_assembly_versions_created_by_idx on public.concrete_assembly_versions(created_by) where created_by is not null;
create index if not exists concrete_assembly_components_catalog_item_idx on public.concrete_assembly_components(catalog_item_id) where catalog_item_id is not null;
create index if not exists concrete_assembly_components_cost_code_idx on public.concrete_assembly_components(cost_code_id) where cost_code_id is not null;
create index if not exists concrete_assembly_components_production_task_idx on public.concrete_assembly_components(production_task_id) where production_task_id is not null;

create index if not exists takeoff_sets_estimate_fk_idx on public.takeoff_sets(estimate_id);
create index if not exists takeoff_sets_created_by_idx on public.takeoff_sets(created_by) where created_by is not null;
create index if not exists takeoff_sets_source_document_idx on public.takeoff_sets(source_document_id) where source_document_id is not null;

create index if not exists takeoff_measurements_estimate_fk_idx on public.takeoff_measurements(estimate_id);
create index if not exists takeoff_measurements_section_idx on public.takeoff_measurements(estimate_section_id) where estimate_section_id is not null;
create index if not exists takeoff_measurements_sheet_idx on public.takeoff_measurements(sheet_id) where sheet_id is not null;
create index if not exists takeoff_measurements_assembly_version_idx on public.takeoff_measurements(assembly_version_id);
create index if not exists takeoff_measurements_created_by_idx on public.takeoff_measurements(created_by) where created_by is not null;

create index if not exists takeoff_outputs_assembly_component_idx on public.takeoff_measurement_outputs(assembly_component_id);
create index if not exists takeoff_outputs_catalog_item_idx on public.takeoff_measurement_outputs(catalog_item_id) where catalog_item_id is not null;
create index if not exists takeoff_outputs_cost_code_idx on public.takeoff_measurement_outputs(cost_code_id) where cost_code_id is not null;
create index if not exists takeoff_outputs_generated_estimate_item_idx on public.takeoff_measurement_outputs(generated_estimate_item_id) where generated_estimate_item_id is not null;
create index if not exists takeoff_outputs_production_task_idx on public.takeoff_measurement_outputs(production_task_id) where production_task_id is not null;

create index if not exists estimating_labor_profiles_created_by_idx on public.estimating_labor_profiles(created_by) where created_by is not null;

create index if not exists estimate_items_takeoff_measurement_idx on public.estimate_items(source_takeoff_measurement_id) where source_takeoff_measurement_id is not null;
create index if not exists estimate_items_assembly_version_idx on public.estimate_items(source_assembly_version_id) where source_assembly_version_id is not null;
create index if not exists estimate_items_production_task_idx on public.estimate_items(production_task_id) where production_task_id is not null;

create index if not exists project_budget_lines_takeoff_output_idx on public.project_budget_lines(source_takeoff_output_id) where source_takeoff_output_id is not null;
create index if not exists project_budget_lines_takeoff_measurement_idx on public.project_budget_lines(source_takeoff_measurement_id) where source_takeoff_measurement_id is not null;
create index if not exists project_budget_lines_assembly_version_idx on public.project_budget_lines(source_assembly_version_id) where source_assembly_version_id is not null;
create index if not exists project_budget_lines_production_task_idx on public.project_budget_lines(production_task_id) where production_task_id is not null;

-- Supabase/Postgres can cache these scalar auth lookups once per statement.
do $$
declare t text;
begin
  foreach t in array array[
    'concrete_assemblies','concrete_assembly_versions','concrete_assembly_variables','concrete_assembly_components',
    'takeoff_sets','takeoff_sheets','takeoff_measurements','takeoff_measurement_outputs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'office access ' || t, t);
    execute format(
      'create policy %I on public.%I for all using (company_id = (select public.get_my_company_id()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role <> ''employee'')) with check (company_id = (select public.get_my_company_id()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role <> ''employee''))',
      'office access ' || t, t
    );
  end loop;
end $$;

drop policy if exists "office access estimating_labor_profiles" on public.estimating_labor_profiles;
create policy "office access estimating_labor_profiles"
on public.estimating_labor_profiles for all
using (
  company_id = (select public.get_my_company_id())
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role <> 'employee')
)
with check (
  company_id = (select public.get_my_company_id())
  and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role <> 'employee')
);
