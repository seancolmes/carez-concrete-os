-- Carez OS takeoff + concrete assembly foundation
-- Drawing geometry -> deterministic assembly outputs -> estimate lines -> budget/work package lineage.

create table if not exists public.concrete_assemblies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null,
  primary_measurement text not null,
  description text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concrete_assemblies_measurement_chk check (primary_measurement in ('LF','SF','EA','CY')),
  constraint concrete_assemblies_company_code_uk unique(company_id, code)
);

create table if not exists public.concrete_assembly_versions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assembly_id uuid not null references public.concrete_assemblies(id) on delete cascade,
  version_no integer not null default 1,
  status text not null default 'draft',
  source_type text not null default 'carez',
  source_label text,
  source_year integer,
  source_reference text,
  default_risk_class_code text,
  notes text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint concrete_assembly_versions_status_chk check (status in ('draft','published','retired')),
  constraint concrete_assembly_versions_source_chk check (source_type in ('carez','national_reference','historical','blended','manual')),
  constraint concrete_assembly_versions_uk unique(assembly_id, version_no)
);

create table if not exists public.concrete_assembly_variables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null references public.concrete_assembly_versions(id) on delete cascade,
  variable_key text not null,
  label text not null,
  value_type text not null default 'number',
  unit text,
  default_value jsonb,
  min_value numeric,
  max_value numeric,
  required boolean not null default false,
  help_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint concrete_assembly_variables_type_chk check (value_type in ('number','boolean','text')),
  constraint concrete_assembly_variables_uk unique(assembly_version_id, variable_key)
);

create table if not exists public.concrete_assembly_components (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assembly_version_id uuid not null references public.concrete_assembly_versions(id) on delete cascade,
  component_key text not null,
  label text not null,
  estimate_item_type text not null,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  production_task_id uuid references public.production_tasks(id) on delete set null,
  output_unit text not null,
  quantity_formula jsonb not null,
  labor_rate_formula jsonb,
  baseline_source text,
  pricing_strategy text not null default 'current_cost',
  default_unit_cost numeric,
  labor_task text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint concrete_assembly_components_item_type_chk check (estimate_item_type in ('labor','material','equipment','subcontractor','other')),
  constraint concrete_assembly_components_pricing_chk check (pricing_strategy in ('current_cost','catalog','manual','none')),
  constraint concrete_assembly_components_uk unique(assembly_version_id, component_key)
);

create table if not exists public.takeoff_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  name text not null,
  revision_label text not null default 'Current',
  status text not null default 'active',
  source_document_id uuid references public.company_documents(id) on delete set null,
  source_filename text,
  page_count integer,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_sets_status_chk check (status in ('active','superseded','archived'))
);

create table if not exists public.takeoff_sheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  page_number integer not null,
  sheet_number text,
  title text,
  page_width numeric,
  page_height numeric,
  scale_status text not null default 'uncalibrated',
  calibration jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_sheets_scale_chk check (scale_status in ('uncalibrated','calibrated','not_required')),
  constraint takeoff_sheets_uk unique(takeoff_set_id, page_number)
);

create table if not exists public.takeoff_measurements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  takeoff_set_id uuid not null references public.takeoff_sets(id) on delete cascade,
  sheet_id uuid references public.takeoff_sheets(id) on delete set null,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  estimate_section_id uuid references public.estimate_sections(id) on delete set null,
  assembly_version_id uuid not null references public.concrete_assembly_versions(id) on delete restrict,
  name text not null,
  location text,
  drawing_reference text,
  measurement_type text not null,
  raw_quantity numeric not null,
  raw_unit text not null,
  geometry jsonb,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  source text not null default 'manual',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_measurements_type_chk check (measurement_type in ('linear','area','count','volume','manual')),
  constraint takeoff_measurements_status_chk check (status in ('active','excluded','superseded')),
  constraint takeoff_measurements_source_chk check (source in ('manual','drawing','import','ai_suggested','revision_delta')),
  constraint takeoff_measurements_qty_chk check (raw_quantity >= 0)
);

create table if not exists public.takeoff_measurement_outputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  measurement_id uuid not null references public.takeoff_measurements(id) on delete cascade,
  assembly_component_id uuid not null references public.concrete_assembly_components(id) on delete restrict,
  component_key text not null,
  label text not null,
  estimate_item_type text not null,
  cost_code_id uuid references public.cost_codes(id) on delete set null,
  catalog_item_id uuid references public.cost_catalog_items(id) on delete set null,
  production_task_id uuid references public.production_tasks(id) on delete set null,
  production_quantity numeric not null default 0,
  production_unit text not null,
  estimated_man_hours numeric not null default 0,
  baseline_man_hours_per_unit numeric,
  baseline_source text,
  unit_cost numeric not null default 0,
  cost_source text,
  direct_cost numeric not null default 0,
  pricing_status text not null default 'missing_price',
  formula_trace jsonb not null default '{}'::jsonb,
  generated_estimate_item_id uuid references public.estimate_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_outputs_item_type_chk check (estimate_item_type in ('labor','material','equipment','subcontractor','other')),
  constraint takeoff_outputs_price_chk check (pricing_status in ('priced','missing_price','not_priced','manual_override','missing_labor_rate')),
  constraint takeoff_outputs_uk unique(measurement_id, component_key)
);

alter table public.estimate_items
  add column if not exists source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  add column if not exists source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  add column if not exists source_assembly_version_id uuid references public.concrete_assembly_versions(id) on delete set null,
  add column if not exists production_task_id uuid references public.production_tasks(id) on delete set null,
  add column if not exists production_quantity numeric,
  add column if not exists production_unit text,
  add column if not exists baseline_man_hours_per_unit numeric,
  add column if not exists baseline_source text;

alter table public.project_budget_lines
  add column if not exists source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  add column if not exists source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  add column if not exists source_assembly_version_id uuid references public.concrete_assembly_versions(id) on delete set null,
  add column if not exists production_task_id uuid references public.production_tasks(id) on delete set null,
  add column if not exists production_quantity numeric,
  add column if not exists production_unit text,
  add column if not exists baseline_man_hours_per_unit numeric,
  add column if not exists baseline_source text;

create index if not exists concrete_assemblies_company_active_idx on public.concrete_assemblies(company_id, active, category);
create index if not exists concrete_assembly_versions_company_status_idx on public.concrete_assembly_versions(company_id, status);
create index if not exists concrete_assembly_variables_version_idx on public.concrete_assembly_variables(assembly_version_id, sort_order);
create index if not exists concrete_assembly_components_version_idx on public.concrete_assembly_components(assembly_version_id, sort_order);
create index if not exists takeoff_sets_estimate_idx on public.takeoff_sets(company_id, estimate_id, status);
create index if not exists takeoff_measurements_estimate_idx on public.takeoff_measurements(company_id, estimate_id, status);
create index if not exists takeoff_measurements_set_idx on public.takeoff_measurements(takeoff_set_id, created_at);
create index if not exists takeoff_outputs_measurement_idx on public.takeoff_measurement_outputs(measurement_id);
create index if not exists takeoff_outputs_pricing_idx on public.takeoff_measurement_outputs(company_id, pricing_status);
create unique index if not exists estimate_items_takeoff_output_uk on public.estimate_items(source_takeoff_output_id) where source_takeoff_output_id is not null;

alter table public.concrete_assemblies enable row level security;
alter table public.concrete_assembly_versions enable row level security;
alter table public.concrete_assembly_variables enable row level security;
alter table public.concrete_assembly_components enable row level security;
alter table public.takeoff_sets enable row level security;
alter table public.takeoff_sheets enable row level security;
alter table public.takeoff_measurements enable row level security;
alter table public.takeoff_measurement_outputs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['concrete_assemblies','concrete_assembly_versions','concrete_assembly_variables','concrete_assembly_components','takeoff_sets','takeoff_sheets','takeoff_measurements','takeoff_measurement_outputs']
  loop
    execute format('drop policy if exists %I on public.%I', 'office access ' || t, t);
    execute format(
      'create policy %I on public.%I for all using (company_id = get_my_company_id() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> ''employee'')) with check (company_id = get_my_company_id() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> ''employee''))',
      'office access ' || t, t
    );
  end loop;
end $$;

create or replace function public.carez_takeoff_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.carez_takeoff_touch_updated_at() from public, anon, authenticated;

create trigger carez_concrete_assemblies_touch before update on public.concrete_assemblies for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_concrete_assembly_versions_touch before update on public.concrete_assembly_versions for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_sets_touch before update on public.takeoff_sets for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_sheets_touch before update on public.takeoff_sheets for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_measurements_touch before update on public.takeoff_measurements for each row execute function public.carez_takeoff_touch_updated_at();
create trigger carez_takeoff_outputs_touch before update on public.takeoff_measurement_outputs for each row execute function public.carez_takeoff_touch_updated_at();

create or replace function public.carez_guard_published_assembly_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published' then
    raise exception 'Published assembly versions are immutable. Create a new version.';
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

revoke all on function public.carez_guard_published_assembly_version() from public, anon, authenticated;
create trigger carez_guard_published_assembly_version before update or delete on public.concrete_assembly_versions for each row execute function public.carez_guard_published_assembly_version();

create or replace function public.carez_guard_published_assembly_child()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_id uuid;
declare v_status text;
begin
  v_id := coalesce(new.assembly_version_id, old.assembly_version_id);
  select status into v_status from public.concrete_assembly_versions where id = v_id;
  if v_status = 'published' then
    raise exception 'Published assembly components and variables are immutable. Create a new assembly version.';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.carez_guard_published_assembly_child() from public, anon, authenticated;
create trigger carez_guard_published_assembly_variables before insert or update or delete on public.concrete_assembly_variables for each row execute function public.carez_guard_published_assembly_child();
create trigger carez_guard_published_assembly_components before insert or update or delete on public.concrete_assembly_components for each row execute function public.carez_guard_published_assembly_child();

create or replace view public.takeoff_measurement_summary
with (security_invoker = true)
as
select
  m.company_id,
  m.id as measurement_id,
  m.takeoff_set_id,
  m.estimate_id,
  m.estimate_section_id,
  m.assembly_version_id,
  a.code as assembly_code,
  a.name as assembly_name,
  v.version_no as assembly_version,
  m.name,
  m.location,
  m.drawing_reference,
  m.raw_quantity,
  m.raw_unit,
  m.status,
  count(o.id) as output_count,
  count(o.id) filter (where o.pricing_status in ('missing_price','missing_labor_rate')) as missing_price_count,
  coalesce(sum(o.estimated_man_hours),0) as estimated_man_hours,
  coalesce(sum(o.direct_cost),0) as direct_cost,
  m.created_at,
  m.updated_at
from public.takeoff_measurements m
join public.concrete_assembly_versions v on v.id=m.assembly_version_id
join public.concrete_assemblies a on a.id=v.assembly_id
left join public.takeoff_measurement_outputs o on o.measurement_id=m.id
group by m.company_id,m.id,m.takeoff_set_id,m.estimate_id,m.estimate_section_id,m.assembly_version_id,a.code,a.name,v.version_no,m.name,m.location,m.drawing_reference,m.raw_quantity,m.raw_unit,m.status,m.created_at,m.updated_at;

create or replace view public.estimate_takeoff_summary
with (security_invoker = true)
as
select
  e.company_id,
  e.id as estimate_id,
  count(distinct m.id) filter (where m.status='active') as active_measurements,
  count(o.id) filter (where m.status='active') as generated_outputs,
  count(o.id) filter (where m.status='active' and o.pricing_status in ('missing_price','missing_labor_rate')) as missing_price_outputs,
  coalesce(sum(o.estimated_man_hours) filter (where m.status='active'),0) as takeoff_man_hours,
  coalesce(sum(o.direct_cost) filter (where m.status='active'),0) as takeoff_direct_cost
from public.estimates e
left join public.takeoff_measurements m on m.estimate_id=e.id
left join public.takeoff_measurement_outputs o on o.measurement_id=m.id
group by e.company_id,e.id;

-- Internal seeder. Published templates are snapshots: future changes require a new version.
create or replace function public.carez_seed_default_concrete_assemblies(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a_id uuid;
  v_id uuid;
  cc_concrete uuid;
  cc_rebar uuid;
  cc_forms uuid;
  cc_cure uuid;
  cat_concrete uuid;
  cat_rebar4 uuid;
  cat_mesh uuid;
  cat_cure uuid;
  pt_form_foot uuid;
  pt_rebar_foot uuid;
  pt_place_foot uuid;
  pt_form_wall uuid;
  pt_rebar_wall uuid;
  pt_place_wall uuid;
  pt_strip uuid;
  pt_form_edge uuid;
  pt_rebar_slab uuid;
  pt_place_slab uuid;
  pt_finish uuid;
  pt_saw uuid;
begin
  if exists(select 1 from public.concrete_assemblies where company_id=p_company_id and code='FTG-STRIP') then return; end if;

  select id into cc_concrete from public.cost_codes where company_id=p_company_id and code='51410' order by created_at limit 1;
  select id into cc_rebar from public.cost_codes where company_id=p_company_id and code='51430' order by created_at limit 1;
  select id into cc_forms from public.cost_codes where company_id=p_company_id and code='51450' order by created_at limit 1;
  select id into cc_cure from public.cost_codes where company_id=p_company_id and code='51480' order by created_at limit 1;
  select id into cat_concrete from public.cost_catalog_items where company_id=p_company_id and name='Ready-Mix Concrete' order by created_at limit 1;
  select id into cat_rebar4 from public.cost_catalog_items where company_id=p_company_id and name='#4 Rebar' order by created_at limit 1;
  select id into cat_mesh from public.cost_catalog_items where company_id=p_company_id and name='WWR / Wire Mesh' order by created_at limit 1;
  select id into cat_cure from public.cost_catalog_items where company_id=p_company_id and name='Concrete Cure / Sealer' order by created_at limit 1;
  select id into pt_form_foot from public.production_tasks where company_id=p_company_id and name='Form Footings' order by created_at limit 1;
  select id into pt_rebar_foot from public.production_tasks where company_id=p_company_id and name='Set Rebar Footings' order by created_at limit 1;
  select id into pt_place_foot from public.production_tasks where company_id=p_company_id and name='Place Footings' order by created_at limit 1;
  select id into pt_form_wall from public.production_tasks where company_id=p_company_id and name='Form Stem Walls' order by created_at limit 1;
  select id into pt_rebar_wall from public.production_tasks where company_id=p_company_id and name='Set Rebar Walls' order by created_at limit 1;
  select id into pt_place_wall from public.production_tasks where company_id=p_company_id and name='Place Walls' order by created_at limit 1;
  select id into pt_strip from public.production_tasks where company_id=p_company_id and name='Strip Forms' order by created_at limit 1;
  select id into pt_form_edge from public.production_tasks where company_id=p_company_id and name='Form Slab Edge' order by created_at limit 1;
  select id into pt_rebar_slab from public.production_tasks where company_id=p_company_id and name='Set Slab Rebar / Mesh' order by created_at limit 1;
  select id into pt_place_slab from public.production_tasks where company_id=p_company_id and name='Place Slab / Flatwork' order by created_at limit 1;
  select id into pt_finish from public.production_tasks where company_id=p_company_id and name='Finish Flatwork' order by created_at limit 1;
  select id into pt_saw from public.production_tasks where company_id=p_company_id and name='Sawcut / Control Joints' order by created_at limit 1;

  -- Strip footing, measured in LF.
  insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description)
  values(p_company_id,'FTG-STRIP','Strip Footing','Foundation','LF','Linear footing: concrete, forms and reinforcing labor/material quantities remain separately traceable.') returning id into a_id;
  insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
  values(p_company_id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,'Concrete formwork / foundations: footing forms 3-use; reinforcing set/tie; concrete placement. Validate job conditions before bid.','0217-01','Baseline productivity only. Material prices resolve from Carez cost history/catalog or remain visibly unpriced.') returning id into v_id;
  insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
   (p_company_id,v_id,'width_in','Footing width','number','IN','24',0,true,'Plan/detail footing width.',10),
   (p_company_id,v_id,'depth_in','Footing depth','number','IN','10',0,true,'Plan/detail footing depth.',20),
   (p_company_id,v_id,'form_sides','Formed sides','number','EA','2',0,true,'Use 0 where earth-formed, 2 where both sides are formed.',30),
   (p_company_id,v_id,'longitudinal_bars','Continuous #4 bars','number','EA','2',0,true,'Enter bars from structural detail.',40),
   (p_company_id,v_id,'rebar_lb_per_ft','Rebar weight per LF','number','LB/LF','0.668',0,true,'#4 bar default = 0.668 lb/LF; change when bar size changes.',50),
   (p_company_id,v_id,'rebar_waste_pct','Rebar lap/waste','number','%','10',0,false,'Allowance for laps and waste.',60),
   (p_company_id,v_id,'concrete_waste_pct','Concrete waste','number','%','3',0,false,'Ready-mix quantity allowance.',70);
  insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order,notes) values
   (p_company_id,v_id,'footing_form_labor','Form footing sides','labor',null,null,pt_form_foot,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"depth_in"},{"const":12}]},{"var":"form_sides"}]}','{"const":0.05}','National Estimator 2026: wall footing/grade beam/tie beam forms, 3 uses, F5@.050 MH/SFCA','current_cost','Formwork',10,'Labor baseline; material/form-system allowance is separate.'),
   (p_company_id,v_id,'footing_form_material','Form lumber / hardware allowance','material',cc_forms,null,null,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"depth_in"},{"const":12}]},{"var":"form_sides"}]}',null,null,'manual',null,20,'Current form-system material cost must be supplied; no stale national material price is inserted.'),
   (p_company_id,v_id,'footing_rebar_material','#4 reinforcing steel','material',cc_rebar,cat_rebar4,null,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"longitudinal_bars"},{"var":"rebar_lb_per_ft"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}',null,null,'current_cost',null,30,'Physical rebar quantity derived from entered structural detail.'),
   (p_company_id,v_id,'footing_rebar_labor','Set and tie footing rebar','labor',null,null,pt_rebar_foot,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"longitudinal_bars"},{"var":"rebar_lb_per_ft"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}','{"const":0.008}','National Estimator 2026: set/tie Grade A60 reinforcing, RB@.008 MH/LB','current_cost','Rebar',40,null),
   (p_company_id,v_id,'footing_concrete_material','Ready-mix concrete','material',cc_concrete,cat_concrete,null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"width_in"},{"const":12}]},{"op":"div","args":[{"var":"depth_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}',null,null,'current_cost',null,50,null),
   (p_company_id,v_id,'footing_place_labor','Place footing concrete','labor',null,null,pt_place_foot,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"width_in"},{"const":12}]},{"op":"div","args":[{"var":"depth_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}','{"const":0.552}','National Estimator 2026 foundation concrete placed directly from chute, CL@.552 MH/CY','current_cost','Placement',60,'Adjust placement method when pump or restricted access applies.');
  update public.concrete_assembly_versions set status='published',published_at=now() where id=v_id;

  -- Stem/foundation wall, measured in LF. Form productivity automatically follows wall-height bands for 3-use wood forms.
  insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description)
  values(p_company_id,'WALL-STEM','Foundation / Stem Wall','Foundation','LF','Cast-in-place wall measured by length; derives wall face, SFCA and concrete volume while retaining operation-level production quantities.') returning id into a_id;
  insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
  values(p_company_id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,'Concrete wall forms, 3-use wood forms by wall-height band; reinforcing/placement/strip references.','0217-01','Rebar density is intentionally an estimator input because structural details control it.') returning id into v_id;
  insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
   (p_company_id,v_id,'height_ft','Wall height','number','FT','8',0,true,'Finished concrete wall height.',10),
   (p_company_id,v_id,'thickness_in','Wall thickness','number','IN','8',0,true,'Concrete wall thickness.',20),
   (p_company_id,v_id,'rebar_lb_per_sf','Rebar density','number','LB/SF',null,0,true,'Enter engineered reinforcing pounds per one-side wall face SF. Use 0 only when intentionally no reinforcing.',30),
   (p_company_id,v_id,'rebar_waste_pct','Rebar lap/waste','number','%','10',0,false,'Allowance for laps and waste.',40),
   (p_company_id,v_id,'concrete_waste_pct','Concrete waste','number','%','3',0,false,'Ready-mix allowance.',50);
  insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order,notes) values
   (p_company_id,v_id,'wall_form_labor','Form wall — both faces','labor',null,null,pt_form_wall,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"const":2}]}','{"op":"piecewise_lte","value":{"var":"height_ft"},"cases":[{"lte":4,"then":0.08},{"lte":6,"then":0.1},{"lte":12,"then":0.11},{"lte":16,"then":0.13}],"else":0.14}','National Estimator 2026 wall forms, 3 uses: height-banded F5 Craft@Hrs per SFCA','current_cost','Formwork',10,'Assumes conventional wood forms and three uses; rented systems or unusual layouts need a new/adjusted assembly version.'),
   (p_company_id,v_id,'wall_form_material','Wall form material / hardware allowance','material',cc_forms,null,null,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"const":2}]}',null,null,'manual',null,20,'Price from Carez form system/reuse plan rather than national material dollars.'),
   (p_company_id,v_id,'wall_rebar_material','Wall reinforcing steel','material',cc_rebar,cat_rebar4,null,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"var":"rebar_lb_per_sf"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}',null,null,'current_cost',null,30,null),
   (p_company_id,v_id,'wall_rebar_labor','Set and tie wall rebar','labor',null,null,pt_rebar_wall,'LB','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"var":"rebar_lb_per_sf"},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"rebar_waste_pct"},{"const":100}]}]}]}','{"const":0.008}','National Estimator 2026 reinforcing set/tie RB@.008 MH/LB baseline','current_cost','Rebar',40,null),
   (p_company_id,v_id,'wall_concrete_material','Ready-mix wall concrete','material',cc_concrete,cat_concrete,null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}',null,null,'current_cost',null,50,null),
   (p_company_id,v_id,'wall_place_labor','Place wall concrete','labor',null,null,pt_place_wall,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}','{"const":0.552}','National Estimator 2026 foundation placement baseline CL@.552 MH/CY; method must be checked for walls/pump access','current_cost','Placement',60,'Carez should replace this with wall-placement actuals as clean field history accumulates.'),
   (p_company_id,v_id,'wall_strip_labor','Strip / clean wall forms','labor',null,null,pt_strip,'SFCA','{"op":"mul","args":[{"var":"quantity"},{"var":"height_ft"},{"const":2}]}','{"const":0.011}','National Estimator 2026 strip wood forms and dismantle bracing CL@.011 MH/SF','current_cost','Strip',70,null);
  update public.concrete_assembly_versions set status='published',published_at=now() where id=v_id;

  -- Reinforced slab / flatwork, measured in SF. Perimeter and sawcut are explicit takeoff inputs until drawing geometry derives them.
  insert into public.concrete_assemblies(company_id,code,name,category,primary_measurement,description)
  values(p_company_id,'SLAB-REINF','Reinforced Slab / Flatwork','Flatwork','SF','Area takeoff with explicit perimeter and joint LF. Concrete, edge forming, reinforcing, finishing, cure and sawcut stay separately traceable.') returning id into a_id;
  insert into public.concrete_assembly_versions(company_id,assembly_id,version_no,status,source_type,source_label,source_year,source_reference,default_risk_class_code,notes)
  values(p_company_id,a_id,1,'draft','national_reference','2026 National Construction Estimator',2026,'Slab-on-grade formwork and floor slab operations; current material prices intentionally come from Carez.','0217-01','For roadway-connected sidewalks/approaches, estimator must use the correct L&I phase/class rather than blindly accepting 0217-01.') returning id into v_id;
  insert into public.concrete_assembly_variables(company_id,assembly_version_id,variable_key,label,value_type,unit,default_value,min_value,required,help_text,sort_order) values
   (p_company_id,v_id,'thickness_in','Slab thickness','number','IN','4',0,true,'Concrete thickness from plan/detail.',10),
   (p_company_id,v_id,'perimeter_lf','Formed perimeter','number','LF',null,0,true,'Drawing canvas will derive this from geometry; enter it manually for now.',20),
   (p_company_id,v_id,'sawcut_lf','Sawcut / control joints','number','LF','0',0,false,'Enter planned joint LF; drawing layout will derive this later.',30),
   (p_company_id,v_id,'reinforcement_factor','Mesh / rebar coverage','number','SF/SF','1.1',0,false,'1.10 represents 10% overlap/waste for mesh.',40),
   (p_company_id,v_id,'concrete_waste_pct','Concrete waste','number','%','3',0,false,'Ready-mix allowance.',50);
  insert into public.concrete_assembly_components(company_id,assembly_version_id,component_key,label,estimate_item_type,cost_code_id,catalog_item_id,production_task_id,output_unit,quantity_formula,labor_rate_formula,baseline_source,pricing_strategy,labor_task,sort_order,notes) values
   (p_company_id,v_id,'slab_edge_form_labor','Form slab edge','labor',null,null,pt_form_edge,'LF','{"var":"perimeter_lf"}','{"op":"piecewise_lte","value":{"var":"thickness_in"},"cases":[{"lte":6,"then":0.061},{"lte":12,"then":0.086},{"lte":24,"then":0.119},{"lte":36,"then":0.16}],"else":0.16}','National Estimator 2026 slab-on-grade edge forms, 3 uses, height-banded MH/LF','current_cost','Formwork',10,null),
   (p_company_id,v_id,'slab_edge_form_material','Slab edge form material allowance','material',cc_forms,null,null,'LF','{"var":"perimeter_lf"}',null,null,'manual',null,20,'Price from current Carez form lumber/reuse plan.'),
   (p_company_id,v_id,'slab_reinforcement_material','WWR / slab reinforcing coverage','material',cc_rebar,cat_mesh,null,'SF','{"op":"mul","args":[{"var":"quantity"},{"var":"reinforcement_factor"}]}',null,null,'current_cost',null,30,'Default represents mesh-style coverage. Use a different assembly/component version for bar schedules priced by LF/LB.'),
   (p_company_id,v_id,'slab_reinforcement_labor','Set slab reinforcing / mesh','labor',null,null,pt_rebar_slab,'SF','{"op":"mul","args":[{"var":"quantity"},{"var":"reinforcement_factor"}]}','{"const":0.004}','National Estimator 2026 welded wire mesh / typical slab reinforcing RB@.004 MH/SF','current_cost','Rebar',40,null),
   (p_company_id,v_id,'slab_concrete_material','Ready-mix slab concrete','material',cc_concrete,cat_concrete,null,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}',null,null,'current_cost',null,50,null),
   (p_company_id,v_id,'slab_place_labor','Place slab concrete','labor',null,null,pt_place_slab,'CY','{"op":"mul","args":[{"op":"div","args":[{"op":"mul","args":[{"var":"quantity"},{"op":"div","args":[{"var":"thickness_in"},{"const":12}]}]},{"const":27}]},{"op":"add","args":[{"const":1},{"op":"div","args":[{"var":"concrete_waste_pct"},{"const":100}]}]}]}','{"const":0.421}','National Estimator 2026 ready-mix slab placed from chute CL@.421 MH/CY','current_cost','Placement',60,'Pump placement should use a separate method/rate or Carez-calibrated actual.'),
   (p_company_id,v_id,'slab_finish_labor','Finish slab / flatwork','labor',null,null,pt_finish,'SF','{"var":"quantity"}','{"const":0.003}','National Estimator 2026 power-trowel floor slab finish CM@.003 MH/SF','current_cost','Finishing',70,'Finish method is a major productivity driver; use the correct assembly version for broom/decorative/small-job work.'),
   (p_company_id,v_id,'slab_cure_material','Concrete curing material','material',cc_cure,cat_cure,null,'SF','{"var":"quantity"}',null,null,'current_cost',null,80,null),
   (p_company_id,v_id,'slab_cure_labor','Apply curing compound','labor',null,null,null,'SF','{"var":"quantity"}','{"const":0.001}','National Estimator 2026 spray-applied curing compound CL@.001 MH/SF','current_cost','Cleanup',90,null),
   (p_company_id,v_id,'slab_sawcut_labor','Sawcut / control joints','labor',null,null,pt_saw,'LF','{"var":"sawcut_lf"}','{"const":0.01}','National Estimator 2026 green concrete sawcut C8@.010 MH/LF','current_cost','Finishing',100,null);
  update public.concrete_assembly_versions set status='published',published_at=now() where id=v_id;
end;
$$;

revoke all on function public.carez_seed_default_concrete_assemblies(uuid) from public, anon, authenticated;

select public.carez_seed_default_concrete_assemblies(id) from public.companies;

comment on table public.concrete_assemblies is 'Company concrete assembly catalog. Versions snapshot estimating logic so historical bids never change retroactively.';
comment on table public.takeoff_measurements is 'Raw measured concrete objects. Geometry is optional now and becomes the browser drawing-canvas source later.';
comment on table public.takeoff_measurement_outputs is 'Deterministic assembly outputs that sync into estimate lines and preserve physical production lineage.';
