create table public.cost_codes (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, name text not null, cost_type text not null check (cost_type in ('material','equipment','subcontractor','other')),
  default_unit text not null default 'LS', active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,code)
);
create table public.cost_catalog_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes(id) on delete restrict, name text not null, description text,
  default_unit text not null default 'EA', default_unit_cost numeric(12,4), vendor_name text, sku text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,name)
);
create table public.production_tasks (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, category text not null default 'General', production_unit text not null default 'HR',
  cost_code_id uuid references public.cost_codes(id) on delete set null, active boolean not null default true, sort_order integer not null default 100,
  created_at timestamptz not null default now(), unique(company_id,name,production_unit)
);
create table public.li_risk_classes (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  tax_year integer not null, code text not null, name text not null, composite_rate_per_hour numeric(10,5) not null,
  employee_deduction_per_hour numeric(10,5) not null, employer_rate_per_hour numeric(10,5) not null,
  active boolean not null default true, created_at timestamptz not null default now(), unique(company_id,tax_year,code)
);
create table public.estimating_labor_profiles (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, burdened_hourly_rate numeric not null check (burdened_hourly_rate>=0), base_risk_class_code text,
  source_type text not null default 'manual' check (source_type in ('historical_payroll','payroll_live','manual','blended','national_reference')),
  source_label text, source_hours numeric, source_total_payroll_cost numeric, effective_date date not null default current_date,
  is_default boolean not null default false, active boolean not null default true, notes text,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index estimating_labor_profiles_default_uk on public.estimating_labor_profiles(company_id) where is_default and active;

create table public.vendor_bill_lines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  unit text not null default 'EA', unit_cost numeric(12,4) not null default 0, created_at timestamptz not null default now()
);
create table public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  unit text not null default 'EA', unit_cost numeric(12,4) not null default 0, created_at timestamptz not null default now()
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null, estimate_number text not null, name text not null,
  status text not null default 'draft' check (status in ('draft','ready','accepted','approved','declined','superseded')),
  version integer not null default 1, expected_start_date date, target_margin_percent numeric(6,2) not null default 30,
  bo_classification text not null default 'retailing', bo_rate_percent numeric(8,5) not null default 0.471,
  payment_processing_rate_percent numeric(8,5) not null default 0, overhead_snapshot_id uuid,
  overhead_rate_snapshot numeric(12,4) not null default 0, proposed_sell_price numeric(14,2) not null default 0,
  notes text, approved_at timestamptz, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete set null, opportunity_number text,
  unique(company_id,estimate_number,version)
);
create table public.estimate_sections (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade, name text not null,
  scope_type text not null default 'other', sort_order integer not null default 0, notes text, created_at timestamptz not null default now()
);

create table public.company_documents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null, document_type text not null default 'other', title text not null,
  vendor_id uuid, document_date date, amount numeric, storage_path text, mime_type text, source text not null default 'manual',
  bank_transaction_id uuid, purchase_order_id uuid, vendor_bill_id uuid, notes text,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  review_status text not null default 'needs_review' check (review_status in ('needs_review','filed','matched','ignored')),
  reference_number text, purchase_order_receipt_id uuid, reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);
create table public.proposal_presentations (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade, proposal_access_token_id uuid not null unique,
  lead_id uuid references public.leads(id) on delete set null, proposal_number text not null,
  audience_type text not null default 'general_contractor' check (audience_type in ('homeowner','general_contractor','commercial_owner')),
  base_sell_price numeric not null default 0 check (base_sell_price>=0), source_estimate_updated_at timestamptz not null,
  snapshot jsonb not null, status text not null default 'sent' check (status in ('sent','viewed','needs_reply','accepted','declined','superseded','revoked')),
  response_state text not null default 'none' check (response_state in ('none','question','change_requested','option_interest','declined','accepted')),
  sent_at timestamptz not null default now(), first_viewed_at timestamptz, last_viewed_at timestamptz,
  view_count integer not null default 0 check(view_count>=0), last_response_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.concrete_assemblies (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  code text not null, name text not null, category text not null,
  primary_measurement text not null check(primary_measurement in ('LF','SF','EA','CY')), description text,
  active boolean not null default true, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), folder_id uuid,
  display_style jsonb, direct_takeoff_enabled boolean not null default true,
  unique(company_id,code), unique(company_id,id)
);
create table public.concrete_assembly_versions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  assembly_id uuid not null references public.concrete_assemblies(id) on delete cascade,
  version_no integer not null default 1, status text not null default 'draft' check(status in ('draft','published','retired')),
  source_type text not null default 'carez' check(source_type in ('carez','national_reference','historical','blended','manual')),
  source_label text, source_year integer, source_reference text, default_risk_class_code text, notes text,
  published_at timestamptz, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  assembly_code_snapshot text not null, assembly_name_snapshot text not null, category_snapshot text not null,
  primary_measurement_snapshot text not null check(primary_measurement_snapshot in ('LF','SF','EA','CY')),
  description_snapshot text, render_config jsonb,
  unique(company_id,id), unique(assembly_id,version_no),
  foreign key(company_id,assembly_id) references public.concrete_assemblies(company_id,id) on delete cascade
);
create unique index concrete_assembly_versions_one_draft_uk on public.concrete_assembly_versions(assembly_id) where status='draft';
create table public.concrete_assembly_variables (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null references public.concrete_assembly_versions(id) on delete cascade,
  variable_key text not null, label text not null,
  value_type text not null default 'number' check(value_type in ('number','dimension','percentage','boolean','enum','text')),
  unit text, default_value jsonb, min_value numeric, max_value numeric, required boolean not null default false,
  help_text text, sort_order integer not null default 0, created_at timestamptz not null default now(),
  property_group text, expose_in_takeoff boolean not null default true, allow_override boolean not null default true,
  options jsonb, dimension_family text, activation_rule jsonb,
  unique(assembly_version_id,variable_key), unique(company_id,assembly_version_id,id),
  foreign key(company_id,assembly_version_id) references public.concrete_assembly_versions(company_id,id) on delete cascade
);
create table public.concrete_assembly_property_bindings (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null, variable_id uuid not null,
  source_namespace text not null check(source_namespace in ('takeoff','project','parent','plan_fact','property')),
  source_key text not null check(length(trim(source_key))>0), precedence integer not null default 100 check(precedence between 0 and 10000),
  notes text, sort_order integer not null default 0, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(assembly_version_id,variable_id,source_namespace,source_key),
  foreign key(company_id,assembly_version_id,variable_id) references public.concrete_assembly_variables(company_id,assembly_version_id,id) on delete cascade
);
create table public.concrete_assembly_components (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null references public.concrete_assembly_versions(id) on delete cascade,
  component_key text not null check(position('/' in component_key)=0), label text not null,
  estimate_item_type text not null check(estimate_item_type in ('labor','material','equipment','subcontractor','other')),
  cost_code_id uuid references public.cost_codes(id) on delete set null, catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  production_task_id uuid references public.production_tasks(id) on delete set null, output_unit text not null,
  quantity_formula jsonb not null, labor_rate_formula jsonb, baseline_source text,
  pricing_strategy text not null default 'current_cost' check(pricing_strategy in ('current_cost','catalog','manual','none')),
  default_unit_cost numeric, labor_task text, notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), activation_rule jsonb,
  resource_behavior text check(resource_behavior is null or resource_behavior in ('consumed_material','reusable_inventory','labor','owned_equipment','rental','subcontractor','readiness_resource','legacy_other')),
  estimate_visible boolean not null default true,
  unique(assembly_version_id,component_key),
  foreign key(company_id,assembly_version_id) references public.concrete_assembly_versions(company_id,id) on delete cascade
);
create table public.concrete_assembly_children (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null, child_assembly_version_id uuid not null, child_key text not null,
  label text not null, quantity_formula jsonb not null default '{"const":1}'::jsonb, variable_bindings jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0, created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), activation_rule jsonb,
  check(jsonb_typeof(variable_bindings)='object'), check(jsonb_typeof(quantity_formula) in ('object','number')),
  check(length(trim(child_key))>0), check(length(trim(label))>0), check(position('/' in child_key)=0),
  check(assembly_version_id<>child_assembly_version_id), unique(assembly_version_id,child_key),
  foreign key(company_id,assembly_version_id) references public.concrete_assembly_versions(company_id,id) on delete cascade,
  foreign key(company_id,child_assembly_version_id) references public.concrete_assembly_versions(company_id,id) on delete restrict
);
create table public.concrete_rebar_sizes (
  id uuid primary key default gen_random_uuid(), bar_number integer not null unique check(bar_number>0),
  designation text not null unique check(designation ~ '^#[0-9]+$'), metric_designation integer not null,
  nominal_diameter_in numeric(6,3) not null check(nominal_diameter_in>0), nominal_area_in2 numeric(6,2) not null check(nominal_area_in2>0),
  weight_lb_per_ft numeric(7,3) not null check(weight_lb_per_ft>0), sort_order integer not null,
  active boolean not null default true, source_label text not null, source_reference text not null, created_at timestamptz not null default now()
);

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade, section_id uuid references public.estimate_sections(id) on delete set null,
  item_type text not null check(item_type in ('labor','material','equipment','subcontractor','other')),
  cost_code_id uuid references public.cost_codes(id) on delete restrict, catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  crew_member_id uuid references public.crew_members(id) on delete set null, labor_task text, risk_class_code text, description text not null,
  quantity numeric(12,4) not null default 0, unit text not null default 'LS', unit_cost numeric(12,4) not null default 0,
  direct_cost numeric(14,2) not null default 0, regular_hours numeric(10,2) not null default 0, overtime_hours numeric(10,2) not null default 0,
  base_hourly_rate_snapshot numeric(10,2), social_security_rate_snapshot numeric(8,6), medicare_rate_snapshot numeric(8,6),
  futa_rate_snapshot numeric(8,6), wa_sui_rate_snapshot numeric(8,6), li_employer_rate_snapshot numeric(10,5),
  sick_leave_accrual_rate_snapshot numeric(8,6), notes text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  source_takeoff_output_id uuid, source_takeoff_measurement_id uuid,
  source_assembly_version_id uuid references public.concrete_assembly_versions(id) on delete set null,
  production_task_id uuid references public.production_tasks(id) on delete set null, production_quantity numeric, production_unit text,
  baseline_man_hours_per_unit numeric, baseline_source text
);

create table public.takeoff_sets (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade, name text not null, revision_label text not null default 'Current',
  status text not null default 'active' check(status in ('active','superseded','archived')),
  source_document_id uuid references public.company_documents(id) on delete set null, source_filename text, page_count integer,
  notes text, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id,id)
);
create table public.takeoff_sheets (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade, page_number integer not null,
  sheet_number text, title text, page_width numeric, page_height numeric,
  scale_status text not null default 'uncalibrated' check(scale_status in ('uncalibrated','calibrated','not_required')),
  calibration jsonb, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(takeoff_set_id,page_number), unique(company_id,id), unique(company_id,takeoff_set_id,id)
);
create table public.takeoff_measurements (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete set null,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  estimate_section_id uuid references public.estimate_sections(id) on delete set null,
  assembly_version_id uuid not null references public.concrete_assembly_versions(id) on delete restrict,
  name text not null, location text, drawing_reference text,
  measurement_type text not null check(measurement_type in ('linear','area','count','volume','manual')),
  raw_quantity numeric not null check(raw_quantity>=0), raw_unit text not null, geometry jsonb,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'active' check(status in ('active','excluded','superseded')),
  source text not null default 'manual' check(source in ('manual','drawing','import','ai_suggested','revision_delta')),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  risk_class_code text, geometry_anchor text not null default 'center' check(geometry_anchor in ('center','left','right','custom')), geometry_offset_in numeric,
  unique(company_id,id), unique(company_id,takeoff_set_id,id)
);
create table public.takeoff_measurement_outputs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  measurement_id uuid not null references public.takeoff_measurements(id) on delete cascade,
  assembly_component_id uuid not null references public.concrete_assembly_components(id) on delete restrict,
  component_key text not null, label text not null,
  estimate_item_type text not null check(estimate_item_type in ('labor','material','equipment','subcontractor','other')),
  cost_code_id uuid references public.cost_codes(id) on delete set null, catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  production_task_id uuid references public.production_tasks(id) on delete set null,
  production_quantity numeric not null default 0, production_unit text not null, estimated_man_hours numeric not null default 0,
  baseline_man_hours_per_unit numeric, baseline_source text, unit_cost numeric not null default 0, cost_source text,
  direct_cost numeric not null default 0,
  pricing_status text not null default 'missing_price' check(pricing_status in ('priced','missing_price','not_priced','manual_override','missing_labor_rate','missing_input')),
  formula_trace jsonb not null default '{}'::jsonb, generated_estimate_item_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  is_active boolean not null default true, resource_behavior text, estimate_visible boolean not null default true,
  unique(measurement_id,component_key)
);
alter table public.estimate_items add constraint estimate_items_source_takeoff_measurement_id_fkey foreign key(source_takeoff_measurement_id) references public.takeoff_measurements(id) on delete set null;
alter table public.estimate_items add constraint estimate_items_source_takeoff_output_id_fkey foreign key(source_takeoff_output_id) references public.takeoff_measurement_outputs(id) on delete set null;
alter table public.takeoff_measurement_outputs add constraint takeoff_measurement_outputs_generated_estimate_item_id_fkey foreign key(generated_estimate_item_id) references public.estimate_items(id) on delete set null;
create unique index estimate_items_takeoff_output_uk on public.estimate_items(source_takeoff_output_id) where source_takeoff_output_id is not null;

create index estimate_items_estimate_idx on public.estimate_items(estimate_id,sort_order);
create index estimate_items_takeoff_measurement_idx on public.estimate_items(source_takeoff_measurement_id) where source_takeoff_measurement_id is not null;
create index takeoff_measurements_set_idx on public.takeoff_measurements(takeoff_set_id,created_at);
create index takeoff_measurements_estimate_idx on public.takeoff_measurements(company_id,estimate_id,status);
create index takeoff_outputs_measurement_idx on public.takeoff_measurement_outputs(measurement_id);
create index takeoff_outputs_pricing_idx on public.takeoff_measurement_outputs(company_id,pricing_status);
create index concrete_assembly_versions_company_status_idx on public.concrete_assembly_versions(company_id,status);
create index concrete_assembly_variables_version_idx on public.concrete_assembly_variables(assembly_version_id,sort_order);
create index concrete_assembly_components_version_idx on public.concrete_assembly_components(assembly_version_id,sort_order);
create index concrete_assembly_children_parent_idx on public.concrete_assembly_children(company_id,assembly_version_id,sort_order);
create index concrete_assembly_property_bindings_version_idx on public.concrete_assembly_property_bindings(company_id,assembly_version_id,sort_order,precedence desc);

alter table public.cost_codes enable row level security; alter table public.cost_catalog_items enable row level security;
alter table public.production_tasks enable row level security; alter table public.li_risk_classes enable row level security;
alter table public.estimating_labor_profiles enable row level security; alter table public.vendor_bill_lines enable row level security;
alter table public.purchase_order_lines enable row level security; alter table public.estimates enable row level security;
alter table public.estimate_sections enable row level security; alter table public.estimate_items enable row level security;
alter table public.company_documents enable row level security; alter table public.proposal_presentations enable row level security;
alter table public.concrete_assemblies enable row level security; alter table public.concrete_assembly_versions enable row level security;
alter table public.concrete_assembly_variables enable row level security; alter table public.concrete_assembly_property_bindings enable row level security;
alter table public.concrete_assembly_components enable row level security; alter table public.concrete_assembly_children enable row level security;
alter table public.takeoff_sets enable row level security; alter table public.takeoff_sheets enable row level security;
alter table public.takeoff_measurements enable row level security; alter table public.takeoff_measurement_outputs enable row level security;
alter table public.concrete_rebar_sizes enable row level security;

do $$ declare t text; begin
  foreach t in array array['cost_codes','cost_catalog_items','production_tasks','li_risk_classes','estimating_labor_profiles','vendor_bill_lines','purchase_order_lines','estimates','estimate_sections','estimate_items','company_documents','proposal_presentations','concrete_assemblies','concrete_assembly_versions','concrete_assembly_variables','concrete_assembly_property_bindings','concrete_assembly_components','concrete_assembly_children','takeoff_sets','takeoff_sheets','takeoff_measurements','takeoff_measurement_outputs'] loop
    execute format('create policy %I on public.%I for all to authenticated using (company_id=public.get_my_company_id()) with check (company_id=public.get_my_company_id())','qa company access '||t,t);
  end loop;
end $$;
create policy "qa rebar reference read" on public.concrete_rebar_sizes for select to authenticated using(true);

grant select,insert,update,delete on public.cost_codes,public.cost_catalog_items,public.production_tasks,public.li_risk_classes,public.estimating_labor_profiles,public.vendor_bill_lines,public.purchase_order_lines,public.estimates,public.estimate_sections,public.estimate_items,public.company_documents,public.proposal_presentations,public.concrete_assemblies,public.concrete_assembly_versions,public.concrete_assembly_variables,public.concrete_assembly_property_bindings,public.concrete_assembly_components,public.concrete_assembly_children,public.takeoff_sets,public.takeoff_sheets,public.takeoff_measurements,public.takeoff_measurement_outputs to authenticated;
grant select on public.concrete_rebar_sizes to authenticated;;
