-- Carez evidence-weighted production guidance
-- Keeps every completed package in the audit trail, identifies statistical outliers,
-- and previews a conservative National/Carez blended estimating rate without mutating estimates.

create or replace view public.carez_production_guidance_samples
with (security_invoker = true)
as
with base as (
  select
    h.company_id,
    h.project_id,
    h.job_number,
    h.project_name,
    h.work_package_id,
    h.package_name,
    h.location,
    h.operation_id,
    h.production_task_id,
    h.task_name,
    h.quantity_completed,
    h.unit,
    h.man_hours,
    h.worker_count,
    h.units_per_man_hour,
    h.man_hours_per_unit,
    h.budgeted_man_hours,
    h.baseline_man_hours_per_unit,
    h.baseline_source,
    h.completed_date,
    h.completed_at,
    h.completion_source,
    h.actual_quantity_source,
    h.quantity_review_status,
    h.pour_plan_id
  from public.earned_production_rate_history h
  where h.production_task_id is not null
    and h.quantity_completed > 0
    and h.man_hours > 0
    and h.man_hours_per_unit > 0
), medians as (
  select
    company_id,
    production_task_id,
    unit,
    count(*)::integer as group_sample_count,
    percentile_cont(0.5) within group (order by man_hours_per_unit)::numeric as median_man_hours_per_unit
  from base
  group by company_id, production_task_id, unit
), deviations as (
  select
    b.*,
    m.group_sample_count,
    m.median_man_hours_per_unit,
    abs(b.man_hours_per_unit - m.median_man_hours_per_unit) as absolute_deviation
  from base b
  join medians m
    on m.company_id = b.company_id
   and m.production_task_id = b.production_task_id
   and m.unit = b.unit
), dispersion as (
  select
    company_id,
    production_task_id,
    unit,
    percentile_cont(0.5) within group (order by absolute_deviation)::numeric as median_absolute_deviation
  from deviations
  group by company_id, production_task_id, unit
), flagged as (
  select
    d.*,
    coalesce(x.median_absolute_deviation, 0) as median_absolute_deviation,
    case
      -- With fewer than five packages there is not enough evidence to label a
      -- completed, approved package as a statistical outlier. Keep it visible.
      when d.group_sample_count < 5 then true
      when d.median_man_hours_per_unit <= 0 then false
      when coalesce(x.median_absolute_deviation, 0) > 0 then
        d.man_hours_per_unit >= greatest(
          d.median_man_hours_per_unit * 0.40,
          d.median_man_hours_per_unit - (3.0 * x.median_absolute_deviation)
        )
        and d.man_hours_per_unit <= least(
          d.median_man_hours_per_unit * 2.50,
          d.median_man_hours_per_unit + (3.0 * x.median_absolute_deviation)
        )
      else
        d.man_hours_per_unit between d.median_man_hours_per_unit * 0.50
                                     and d.median_man_hours_per_unit * 2.00
    end as included_for_guidance
  from deviations d
  left join dispersion x
    on x.company_id = d.company_id
   and x.production_task_id = d.production_task_id
   and x.unit = d.unit
)
select
  f.*,
  case
    when f.included_for_guidance then 'clean_sample'
    when f.median_man_hours_per_unit <= 0 then 'invalid_group_median'
    when f.man_hours_per_unit < f.median_man_hours_per_unit then 'unusually_fast_package'
    else 'unusually_slow_package'
  end as guidance_review_reason
from flagged f;

create or replace view public.carez_production_rate_guidance
with (security_invoker = true)
as
with clean as (
  select *
  from public.carez_production_guidance_samples
  where included_for_guidance
), clean_stats as (
  select
    company_id,
    production_task_id,
    max(task_name) as task_name,
    unit,
    count(*)::integer as sample_packages,
    count(distinct project_id)::integer as sample_projects,
    min(completed_date) as first_sample_date,
    max(completed_date) as latest_sample_date,
    round(sum(quantity_completed), 2) as total_quantity,
    round(sum(man_hours), 2) as total_man_hours,
    case when sum(quantity_completed) > 0
      then round(sum(man_hours) / sum(quantity_completed), 6)
      else null end as carez_man_hours_per_unit,
    case when sum(man_hours) > 0
      then round(sum(quantity_completed) / sum(man_hours), 4)
      else null end as carez_units_per_man_hour,
    percentile_cont(0.5) within group (order by man_hours_per_unit)::numeric as median_man_hours_per_unit
  from clean
  group by company_id, production_task_id, unit
), all_stats as (
  select
    company_id,
    production_task_id,
    unit,
    count(*)::integer as total_candidate_packages,
    count(*) filter (where not included_for_guidance)::integer as excluded_outliers
  from public.carez_production_guidance_samples
  group by company_id, production_task_id, unit
), weighted as (
  select
    s.*,
    a.total_candidate_packages,
    a.excluded_outliers,
    least(
      0.85::numeric,
      round(
        ((s.sample_packages::numeric / (s.sample_packages::numeric + 8.0)) * 0.65)
        + ((s.sample_projects::numeric / (s.sample_projects::numeric + 3.0)) * 0.20),
        4
      )
    ) as evidence_weight
  from clean_stats s
  join all_stats a
    on a.company_id = s.company_id
   and a.production_task_id = s.production_task_id
   and a.unit = s.unit
)
select
  w.*,
  case
    when w.evidence_weight >= 0.60 then 'strong'
    when w.evidence_weight >= 0.35 then 'developing'
    when w.evidence_weight >= 0.18 then 'early'
    else 'seed'
  end as confidence,
  case
    when w.evidence_weight >= 0.60 then 'Carez Standard candidate'
    when w.evidence_weight >= 0.35 then 'Blend with reference baseline'
    when w.evidence_weight >= 0.18 then 'Useful signal — keep collecting packages'
    else 'Observe only — insufficient field history'
  end as recommendation_stage
from weighted w;

create or replace view public.takeoff_output_rate_guidance
with (security_invoker = true)
as
with joined as (
  select
    o.company_id,
    o.id as takeoff_output_id,
    o.measurement_id,
    o.assembly_component_id,
    o.component_key,
    o.label,
    o.production_task_id,
    o.production_quantity,
    o.production_unit,
    o.estimated_man_hours as published_estimated_man_hours,
    o.baseline_man_hours_per_unit as published_baseline_man_hours_per_unit,
    o.baseline_source,
    g.sample_packages,
    g.sample_projects,
    g.total_candidate_packages,
    g.excluded_outliers,
    g.first_sample_date,
    g.latest_sample_date,
    g.total_quantity as carez_sample_quantity,
    g.total_man_hours as carez_sample_man_hours,
    g.carez_man_hours_per_unit,
    g.carez_units_per_man_hour,
    g.median_man_hours_per_unit as carez_median_man_hours_per_unit,
    coalesce(g.evidence_weight, 0)::numeric as evidence_weight,
    coalesce(g.confidence, 'none') as confidence,
    coalesce(g.recommendation_stage, 'National / published baseline only') as recommendation_stage
  from public.takeoff_measurement_outputs o
  left join public.carez_production_rate_guidance g
    on g.company_id = o.company_id
   and g.production_task_id = o.production_task_id
   and upper(g.unit) = upper(o.production_unit)
  where o.estimate_item_type = 'labor'
    and o.production_quantity > 0
    and o.baseline_man_hours_per_unit is not null
    and o.baseline_man_hours_per_unit > 0
), blended as (
  select
    j.*,
    case
      when j.carez_man_hours_per_unit is null or j.evidence_weight <= 0
        then j.published_baseline_man_hours_per_unit
      when j.carez_man_hours_per_unit >= j.published_baseline_man_hours_per_unit
        then (j.published_baseline_man_hours_per_unit * (1 - j.evidence_weight))
           + (j.carez_man_hours_per_unit * j.evidence_weight)
      -- One or two unusually efficient jobs must never make future bids cheaper.
      when j.evidence_weight < 0.25
        then j.published_baseline_man_hours_per_unit
      else greatest(
        (j.published_baseline_man_hours_per_unit * (1 - j.evidence_weight))
          + (j.carez_man_hours_per_unit * j.evidence_weight),
        j.published_baseline_man_hours_per_unit * (1 - (0.30 * j.evidence_weight))
      )
    end as raw_recommended_man_hours_per_unit
  from joined j
), recommended as (
  select
    b.*,
    round(b.raw_recommended_man_hours_per_unit, 6) as recommended_man_hours_per_unit,
    round(b.production_quantity * b.raw_recommended_man_hours_per_unit, 4) as guided_estimated_man_hours
  from blended b
)
select
  r.*,
  round(r.guided_estimated_man_hours - r.published_estimated_man_hours, 4) as guidance_delta_man_hours,
  case
    when r.carez_man_hours_per_unit is null then 'baseline_only'
    when r.recommended_man_hours_per_unit > r.published_baseline_man_hours_per_unit * 1.02 then 'increase'
    when r.recommended_man_hours_per_unit < r.published_baseline_man_hours_per_unit * 0.98 then 'decrease'
    else 'hold'
  end as guidance_direction,
  case
    when r.carez_man_hours_per_unit is null then 'No comparable Carez packages yet.'
    when r.evidence_weight < 0.18 then 'Carez has early field data; do not reprice from it yet.'
    when r.carez_man_hours_per_unit < r.published_baseline_man_hours_per_unit and r.evidence_weight < 0.25 then 'Carez is faster so far, but evidence is too thin to lower the bid.'
    when r.recommended_man_hours_per_unit > r.published_baseline_man_hours_per_unit * 1.02 then 'Carez field history supports carrying more labor than the published baseline.'
    when r.recommended_man_hours_per_unit < r.published_baseline_man_hours_per_unit * 0.98 then 'Carez field history supports a cautious labor reduction.'
    else 'Published baseline remains appropriate for current evidence.'
  end as guidance_reason
from recommended r;

grant select on public.carez_production_guidance_samples to authenticated;
grant select on public.carez_production_rate_guidance to authenticated;
grant select on public.takeoff_output_rate_guidance to authenticated;
