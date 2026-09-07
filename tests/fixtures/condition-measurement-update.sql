-- Disposable PostgreSQL fixture for the geometry/Condition transaction boundary.
-- Run only through condition-measurement-update.test.ts in an empty test database.
create schema auth;
create role anon;
create role authenticated;
create role service_role;
create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
create function public.get_my_company_id() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000010'::uuid $$;
create function public.get_my_role() returns text language sql as $$ select 'owner'::text $$;
create table profiles(id uuid primary key, role text);
insert into profiles values (auth.uid(),'owner');
create table estimates(id uuid primary key, company_id uuid, status text);
create table proposal_presentations(id uuid primary key, company_id uuid, estimate_id uuid);
create table takeoff_measurements(id uuid primary key, company_id uuid, estimate_id uuid, source text, sheet_id uuid, scale_region_id uuid, raw_quantity numeric, raw_unit text, variables jsonb, geometry jsonb, updated_at timestamptz);
create table takeoff_scale_regions(id uuid primary key, company_id uuid, sheet_id uuid, is_default boolean, region_bounds jsonb);
create table project_concrete_condition_versions(id uuid primary key, company_id uuid, condition_id uuid, status text, compatibility_anchor_measurement_id uuid, updated_at timestamptz);
create table project_concrete_conditions(id uuid primary key, company_id uuid, compatibility_projection_version_id uuid, updated_at timestamptz);
create table project_condition_measurement_roles(id uuid primary key, company_id uuid, condition_version_id uuid, measurement_id uuid);
create table estimate_items(id uuid primary key, company_id uuid, source_takeoff_output_id uuid);
create table takeoff_measurement_outputs(id uuid primary key, company_id uuid, measurement_id uuid, formula_trace jsonb, generated_estimate_item_id uuid references estimate_items(id) on delete set null);
create table project_condition_outputs(id uuid primary key, company_id uuid, condition_version_id uuid, legacy_takeoff_output_id uuid references takeoff_measurement_outputs(id) on delete restrict, generated_estimate_item_id uuid references estimate_items(id) on delete restrict);
create table project_condition_holds(id uuid primary key, company_id uuid, condition_version_id uuid);
create table test_sync_calls(measurement_id uuid);
create function public.carez_geometry_within_scale_bounds(jsonb,jsonb) returns boolean language sql as $$ select true $$;
-- Legacy calculator is intentionally a recording stub. Tests exercise whether
-- the actual measurement RPC calls it, not its already-covered quantity math.
create function public.carez_sync_takeoff_measurement_outputs(uuid,jsonb) returns void language sql as $$ insert into test_sync_calls values ($1) $$;
grant usage on schema public,auth to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on all functions in schema public,auth to authenticated;
do $$ declare t text; begin
  foreach t in array array['estimates','proposal_presentations','takeoff_measurements','takeoff_scale_regions','project_concrete_condition_versions','project_concrete_conditions','project_condition_measurement_roles','estimate_items','takeoff_measurement_outputs','project_condition_outputs','project_condition_holds'] loop
    execute format('alter table %I enable row level security',t);
    execute format('create policy company_access on %I to authenticated using (company_id = public.get_my_company_id()) with check (company_id = public.get_my_company_id())',t);
  end loop;
end $$;
