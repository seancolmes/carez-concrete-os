create or replace view public.estimate_financial_summary
with (security_invoker = true)
as
with x as (
  select
    e.id as estimate_id,
    e.company_id,
    coalesce(sum(i.direct_cost), 0::numeric) as total_direct_cost,
    coalesce(sum(i.direct_cost) filter (where i.item_type = 'labor'), 0::numeric) as direct_labor_cost,
    coalesce(sum(i.direct_cost) filter (where i.item_type = 'material'), 0::numeric) as material_cost,
    coalesce(sum(i.direct_cost) filter (where i.item_type = 'equipment'), 0::numeric) as equipment_cost,
    coalesce(sum(i.direct_cost) filter (where i.item_type = 'subcontractor'), 0::numeric) as subcontractor_cost,
    coalesce(sum(i.direct_cost) filter (where i.item_type = 'other'), 0::numeric) as other_direct_cost,
    coalesce(sum(coalesce(i.regular_hours, 0) + coalesce(i.overtime_hours, 0)) filter (where i.item_type = 'labor'), 0::numeric) as labor_hours
  from public.estimates e
  left join public.estimate_items i
    on i.estimate_id = e.id
   and i.company_id = e.company_id
  group by e.id, e.company_id
)
select
  e.id as estimate_id,
  e.company_id,
  e.estimate_number,
  e.name,
  e.status,
  e.version,
  e.project_id,
  e.target_margin_percent,
  e.bo_classification,
  e.bo_rate_percent,
  e.payment_processing_rate_percent,
  e.overhead_rate_snapshot,
  e.proposed_sell_price,
  x.labor_hours,
  x.direct_labor_cost,
  x.material_cost,
  x.equipment_cost,
  x.subcontractor_cost,
  x.other_direct_cost,
  x.total_direct_cost,
  round(x.labor_hours * e.overhead_rate_snapshot, 2) as overhead_cost,
  round(x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot, 2) as base_company_cost,
  case
    when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
      then round(
        (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
        / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric),
        2
      )
    else 0::numeric
  end as recommended_sell_price,
  case
    when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
    when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
      then round(
        (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
        / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric),
        2
      )
    else 0::numeric
  end as selected_sell_price,
  round(
    (
      case
        when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
        when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
          then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
            / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
        else 0::numeric
      end
    ) * (e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric,
    2
  ) as revenue_cost_reserve,
  round(
    (
      case
        when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
        when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
          then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
            / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
        else 0::numeric
      end
    )
    - (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
    - (
      case
        when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
        when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
          then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
            / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
        else 0::numeric
      end
    ) * (e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric,
    2
  ) as projected_profit,
  case
    when (
      case
        when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
        when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
          then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
            / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
        else 0::numeric
      end
    ) > 0::numeric
      then round(
        100::numeric * (
          (
            case
              when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
              when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
                then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
                  / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
              else 0::numeric
            end
          )
          - (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
          - (
            case
              when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
              when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
                then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
                  / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
              else 0::numeric
            end
          ) * (e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric
        )
        / (
          case
            when e.proposed_sell_price > 0::numeric then e.proposed_sell_price
            when 1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric > 0::numeric
              then (x.total_direct_cost + x.labor_hours * e.overhead_rate_snapshot)
                / (1::numeric - (e.target_margin_percent + e.bo_rate_percent + e.payment_processing_rate_percent) / 100::numeric)
            else 0::numeric
          end
        ),
        2
      )
    else 0::numeric
  end as projected_margin_percent
from public.estimates e
join x on x.estimate_id = e.id and x.company_id = e.company_id;

create or replace view public.estimate_takeoff_summary
with (security_invoker = true)
as
select
  e.company_id,
  e.id as estimate_id,
  count(distinct m.id) filter (where m.status = 'active') as active_measurements,
  count(o.id) filter (where m.status = 'active') as generated_outputs,
  count(o.id) filter (
    where m.status = 'active'
      and o.pricing_status in ('missing_price', 'missing_labor_rate', 'missing_input')
  ) as missing_price_outputs,
  coalesce(sum(o.estimated_man_hours) filter (where m.status = 'active'), 0::numeric) as takeoff_man_hours,
  coalesce(sum(o.direct_cost) filter (where m.status = 'active'), 0::numeric) as takeoff_direct_cost
from public.estimates e
left join public.takeoff_measurements m
  on m.estimate_id = e.id
 and m.company_id = e.company_id
left join public.takeoff_measurement_outputs o
  on o.measurement_id = m.id
 and o.company_id = e.company_id
group by e.company_id, e.id;

grant select on public.estimate_financial_summary to anon, authenticated, service_role;
grant select on public.estimate_takeoff_summary to anon, authenticated, service_role;
