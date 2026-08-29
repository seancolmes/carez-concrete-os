-- Carez Takeoff/Estimating: valid geometry must survive unresolved downstream assembly assumptions.
-- Keep existing view column names for compatibility while counting missing-input holds alongside price/labor holds.

alter table public.takeoff_measurement_outputs
  drop constraint if exists takeoff_outputs_price_chk;

alter table public.takeoff_measurement_outputs
  add constraint takeoff_outputs_price_chk
  check (pricing_status in ('priced','missing_price','not_priced','manual_override','missing_labor_rate','missing_input'));

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
  count(o.id) filter (where o.pricing_status in ('missing_price','missing_labor_rate','missing_input')) as missing_price_count,
  coalesce(sum(o.estimated_man_hours),0) as estimated_man_hours,
  coalesce(sum(o.direct_cost),0) as direct_cost,
  m.created_at,
  m.updated_at
from public.takeoff_measurements m
join public.concrete_assembly_versions v on v.id=m.assembly_version_id
join public.concrete_assemblies a on a.id=v.assembly_id
left join public.takeoff_measurement_outputs o on o.measurement_id=m.id
group by
  m.company_id,m.id,m.takeoff_set_id,m.estimate_id,m.estimate_section_id,m.assembly_version_id,
  a.code,a.name,v.version_no,m.name,m.location,m.drawing_reference,m.raw_quantity,m.raw_unit,m.status,m.created_at,m.updated_at;

create or replace view public.estimate_takeoff_summary
with (security_invoker = true)
as
select
  e.company_id,
  e.id as estimate_id,
  count(distinct m.id) filter (where m.status='active') as active_measurements,
  count(o.id) filter (where m.status='active') as generated_outputs,
  count(o.id) filter (
    where m.status='active'
      and o.pricing_status in ('missing_price','missing_labor_rate','missing_input')
  ) as missing_price_outputs,
  coalesce(sum(o.estimated_man_hours) filter (where m.status='active'),0) as takeoff_man_hours,
  coalesce(sum(o.direct_cost) filter (where m.status='active'),0) as takeoff_direct_cost
from public.estimates e
left join public.takeoff_measurements m on m.estimate_id=e.id
left join public.takeoff_measurement_outputs o on o.measurement_id=m.id
group by e.company_id,e.id;
