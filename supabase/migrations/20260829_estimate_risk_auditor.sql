-- Carez Estimate Risk / Scope Auditor
-- Derived from facts already present in estimating, takeoff, proposal, burden and
-- production systems. Objective blockers can stop customer issue; judgment items
-- remain warnings so Carez does not replace estimator judgment with arbitrary rules.

create or replace view public.estimate_audit_findings
with (security_invoker = true)
as
with
item_stats as (
  select
    e.company_id,
    e.id as estimate_id,
    count(i.id)::integer as item_count,
    count(i.id) filter (where i.section_id is null)::integer as unsectioned_items
  from public.estimates e
  left join public.estimate_items i
    on i.estimate_id = e.id and i.company_id = e.company_id
  group by e.company_id, e.id
),
concrete_stats as (
  select
    m.company_id,
    m.estimate_id,
    round(sum(o.production_quantity), 2) as concrete_cy
  from public.takeoff_measurements m
  join public.takeoff_measurement_outputs o
    on o.measurement_id = m.id and o.company_id = m.company_id
  where m.status = 'active'
    and o.production_unit = 'CY'
    and o.production_quantity > 0
    and o.estimate_item_type = 'material'
    and (o.component_key ilike '%concrete%material%' or o.label ilike '%ready-mix%')
  group by m.company_id, m.estimate_id
),
pump_lines as (
  select distinct company_id, estimate_id
  from public.estimate_items
  where lower(description) like '%pump%'
),
clarification_stats as (
  select
    company_id,
    estimate_id,
    count(*) filter (where published and category in ('exclusion','assumption','qualification','allowance'))::integer as risk_clarifications
  from public.proposal_clarifications
  group by company_id, estimate_id
),
proposal_context as (
  select
    e.company_id,
    e.id as estimate_id,
    ps.payment_summary,
    ps.schedule_summary,
    ps.terms_text,
    bp.default_terms_text,
    bp.ubi_number,
    bp.contractor_license_number,
    coalesce(cs.risk_clarifications, 0) as risk_clarifications
  from public.estimates e
  left join public.proposal_settings ps
    on ps.estimate_id = e.id and ps.company_id = e.company_id
  left join public.company_billing_profiles bp
    on bp.company_id = e.company_id
  left join clarification_stats cs
    on cs.estimate_id = e.id and cs.company_id = e.company_id
),
financials as (
  select * from public.estimate_financial_summary
)

-- No customer scope at all.
select
  e.company_id,
  e.id as estimate_id,
  'no_scope_items'::text as finding_key,
  'blocker'::text as severity,
  'scope'::text as category,
  'Estimate has no scope items'::text as title,
  'There is nothing to price or present to the customer.'::text as detail,
  'Add the physical scope before issuing a proposal.'::text as next_action,
  'estimate'::text as source_type,
  e.id as source_id,
  10::integer as sort_order
from public.estimates e
join item_stats s on s.company_id=e.company_id and s.estimate_id=e.id
where s.item_count=0

union all

-- Proposal price must exist.
select
  e.company_id,e.id,
  'no_customer_price','blocker','pricing',
  'Customer price is not established',
  'The selected/recommended sell price is zero or missing.',
  'Set the customer sell price before issuing the proposal.',
  'estimate',e.id,20
from public.estimates e
left join financials f on f.company_id=e.company_id and f.estimate_id=e.id
where coalesce(f.selected_sell_price,f.recommended_sell_price,e.proposed_sell_price,0) <= 0

union all

-- Takeoff outputs that explicitly say pricing is incomplete.
select
  m.company_id,m.estimate_id,
  'unpriced_takeoff_'||o.id::text,'blocker','pricing',
  'Takeoff output is not priced',
  o.label||' — '||round(o.production_quantity,2)::text||' '||o.production_unit||' is marked '||coalesce(o.pricing_status,'unpriced')||'.',
  'Price this assembly output or intentionally remove it before sending.',
  'takeoff_output',o.id,30
from public.takeoff_measurements m
join public.takeoff_measurement_outputs o
  on o.measurement_id=m.id and o.company_id=m.company_id
where m.status='active'
  and o.production_quantity > 0
  and coalesce(o.pricing_status,'') <> 'priced'

union all

-- Manual material/equipment/subcontract lines with quantity but no cost.
select
  i.company_id,i.estimate_id,
  'zero_cost_manual_'||i.id::text,'blocker','pricing',
  'Manual cost line has no cost',
  i.description||' has '||round(i.quantity,2)::text||' '||i.unit||' but $0 direct cost.',
  'Enter the vendor/current cost or remove the placeholder line.',
  'estimate_item',i.id,40
from public.estimate_items i
where i.source_takeoff_output_id is null
  and i.item_type in ('material','equipment','subcontractor')
  and i.quantity > 0
  and i.direct_cost <= 0

union all

-- Manual labor hours with no direct cost.
select
  i.company_id,i.estimate_id,
  'zero_cost_labor_'||i.id::text,'blocker','labor',
  'Labor hours have no payroll cost',
  i.description||' carries '||round(i.regular_hours+i.overtime_hours,2)::text||' hours but $0 direct labor cost.',
  'Correct the labor/payroll setup before sending.',
  'estimate_item',i.id,45
from public.estimate_items i
where i.item_type='labor'
  and (i.regular_hours+i.overtime_hours) > 0
  and i.direct_cost <= 0

union all

-- Every labor line with hours must resolve to an active L&I class.
select
  i.company_id,i.estimate_id,
  'invalid_li_class_'||i.id::text,'blocker','labor',
  'L&I phase is missing or invalid',
  i.description||' uses '||coalesce(nullif(i.risk_class_code,''),'no L&I class')||'.',
  'Assign an active Washington L&I class before issuing the proposal.',
  'estimate_item',i.id,50
from public.estimate_items i
where i.item_type='labor'
  and (i.regular_hours+i.overtime_hours) > 0
  and (
    nullif(i.risk_class_code,'') is null
    or not exists (
      select 1 from public.li_risk_classes r
      where r.company_id=i.company_id and r.code=i.risk_class_code and r.active
    )
  )

union all

-- An override from the published assembly default is legal, but should be visible.
select
  i.company_id,i.estimate_id,
  'li_override_'||i.id::text,'warning','labor',
  'L&I phase differs from assembly default',
  i.description||' is priced as '||coalesce(i.risk_class_code,'none')||' while the published assembly defaults to '||coalesce(v.default_risk_class_code,'none')||'.',
  'Confirm the phase is intentional for this project location/scope.',
  'estimate_item',i.id,60
from public.estimate_items i
join public.concrete_assembly_versions v
  on v.id=i.source_assembly_version_id and v.company_id=i.company_id
where i.item_type='labor'
  and nullif(i.risk_class_code,'') is not null
  and nullif(v.default_risk_class_code,'') is not null
  and i.risk_class_code <> v.default_risk_class_code

union all

-- Margin below the estimate's own target is a business decision, not a hard stop.
select
  e.company_id,e.id,
  'margin_below_target','warning','pricing',
  'Projected margin is below target',
  'Projected margin is '||round(f.projected_margin_percent,1)::text||'% versus a '||round(e.target_margin_percent,1)::text||'% target.',
  'Review price, scope and production assumptions before intentionally accepting the lower margin.',
  'estimate',e.id,70
from public.estimates e
join financials f on f.company_id=e.company_id and f.estimate_id=e.id
where coalesce(f.selected_sell_price,0) > 0
  and f.projected_margin_percent < e.target_margin_percent - 1

union all

-- Company actuals can reveal an optimistic labor baseline.
select
  m.company_id,m.estimate_id,
  'production_guidance_'||g.takeoff_output_id::text,'warning','production',
  'Carez field history supports more labor',
  g.label||': published '||round(g.published_baseline_man_hours_per_unit,4)::text||' MH/'||g.production_unit||', guided '||round(g.recommended_man_hours_per_unit,4)::text||' from '||coalesce(g.sample_packages,0)::text||' clean package(s) / '||coalesce(g.sample_projects,0)::text||' job(s).',
  'Review the labor assumption before deciding to hold the published baseline.',
  'takeoff_output',g.takeoff_output_id,80
from public.takeoff_output_rate_guidance g
join public.takeoff_measurements m
  on m.id=g.measurement_id and m.company_id=g.company_id
where g.guidance_direction='increase'
  and g.evidence_weight >= 0.18
  and g.guidance_delta_man_hours > greatest(1::numeric, g.published_estimated_man_hours * 0.05)

union all

-- A meaningful concrete quantity with no pump line deserves an explicit placement-method review.
select
  e.company_id,e.id,
  'concrete_placement_method','warning','scope',
  'Concrete placement method needs confirmation',
  'Takeoff carries '||cs.concrete_cy::text||' CY of ready-mix and no pump line is present in the estimate.',
  'Confirm chute, buggy, line pump or boom pump. Add the cost or clearly state the intended method/exclusion.',
  'estimate',e.id,90
from public.estimates e
join concrete_stats cs on cs.company_id=e.company_id and cs.estimate_id=e.id
left join pump_lines p on p.company_id=e.company_id and p.estimate_id=e.id
where cs.concrete_cy >= 10
  and p.estimate_id is null

union all

-- Flatwork without a sawcut quantity may be intentionally tooled, but must be reviewed.
select
  m.company_id,m.estimate_id,
  'jointing_review_'||m.id::text,'warning','scope',
  'Flatwork jointing is not quantified',
  m.name||' carries '||round(m.raw_quantity,1)::text||' SF and zero sawcut/control-joint LF in the assembly.',
  'Confirm tooled joints, v-grooves, sawcuts or required scoring and carry the labor/clarification that applies.',
  'takeoff_measurement',m.id,100
from public.takeoff_measurements m
join public.concrete_assembly_versions v on v.id=m.assembly_version_id and v.company_id=m.company_id
join public.concrete_assemblies a on a.id=v.assembly_id and a.company_id=m.company_id
where m.status='active'
  and a.code in ('FLAT-BROOM','FLAT-ROW')
  and m.raw_quantity >= 100
  and coalesce(nullif(m.variables->>'sawcut_lf','')::numeric,0) <= 0

union all

-- Contract terms are objective protection and block issue when completely absent.
select
  e.company_id,e.id,
  'proposal_terms_missing','blocker','proposal',
  'Proposal terms are missing',
  'Neither this estimate nor the company billing profile supplies contract terms.',
  'Add proposal terms/payment conditions before issuing a customer link.',
  'estimate',e.id,110
from public.estimates e
join proposal_context pc on pc.company_id=e.company_id and pc.estimate_id=e.id
where coalesce(nullif(btrim(pc.terms_text),''),nullif(btrim(pc.default_terms_text),'')) is null

union all

-- Payment summary is customer-facing; terms may exist elsewhere so this is a warning.
select
  e.company_id,e.id,
  'payment_summary_missing','warning','proposal',
  'Customer payment summary is blank',
  'The proposal does not currently summarize deposit/progress/final-payment expectations.',
  'Add a concise payment summary or confirm the contract terms communicate it clearly.',
  'estimate',e.id,120
from public.estimates e
join proposal_context pc on pc.company_id=e.company_id and pc.estimate_id=e.id
where nullif(btrim(pc.payment_summary),'') is null

union all

-- Scope risk belongs in explicit customer clarifications.
select
  e.company_id,e.id,
  'clarifications_missing','warning','proposal',
  'No published exclusions / assumptions',
  'No exclusions, assumptions, allowances or qualifications are currently published for this estimate.',
  'Review scope boundaries and publish the clarifications that protect the bid.',
  'estimate',e.id,130
from public.estimates e
join proposal_context pc on pc.company_id=e.company_id and pc.estimate_id=e.id
where pc.risk_clarifications=0

union all

-- Schedule can be date-driven or explained in the proposal; neither is currently supplied.
select
  e.company_id,e.id,
  'schedule_missing','warning','proposal',
  'Proposal schedule is not stated',
  'There is no expected start date and no customer-facing schedule summary.',
  'Add the expected timing or a schedule qualification before sending.',
  'estimate',e.id,140
from public.estimates e
join proposal_context pc on pc.company_id=e.company_id and pc.estimate_id=e.id
where e.expected_start_date is null and nullif(btrim(pc.schedule_summary),'') is null

union all

-- A proposal should identify the contracting business cleanly.
select
  e.company_id,e.id,
  'company_identity_incomplete','warning','proposal',
  'Company license / UBI information is incomplete',
  'The proposal billing profile is missing the UBI number or contractor license number.',
  'Complete the company billing profile so the customer proposal carries full contractor identity.',
  'estimate',e.id,150
from public.estimates e
join proposal_context pc on pc.company_id=e.company_id and pc.estimate_id=e.id
where nullif(btrim(pc.ubi_number),'') is null or nullif(btrim(pc.contractor_license_number),'') is null

union all

-- Items without sections make customer scope less clear.
select
  e.company_id,e.id,
  'unsectioned_scope','warning','scope',
  'Some estimate items are not assigned to a scope area',
  s.unsectioned_items::text||' estimate item(s) are outside an estimate section.',
  'Organize the items into customer-readable scope sections before issuing.',
  'estimate',e.id,160
from public.estimates e
join item_stats s on s.company_id=e.company_id and s.estimate_id=e.id
where s.unsectioned_items>0

union all

-- Overhead can intentionally be zero, but the owner should see it before bid issue.
select
  e.company_id,e.id,
  'overhead_zero','warning','pricing',
  'No overhead is carried in the estimate',
  'The estimate overhead snapshot is 0%.',
  'Confirm this is intentional rather than a missing company-cost allocation.',
  'estimate',e.id,170
from public.estimates e
where coalesce(e.overhead_rate_snapshot,0)<=0;

create or replace view public.estimate_audit_summary
with (security_invoker = true)
as
select
  e.company_id,
  e.id as estimate_id,
  e.estimate_number,
  e.version,
  e.name,
  e.status,
  count(f.finding_key)::integer as finding_count,
  count(f.finding_key) filter (where f.severity='blocker')::integer as blocker_count,
  count(f.finding_key) filter (where f.severity='warning')::integer as warning_count,
  case
    when count(f.finding_key) filter (where f.severity='blocker')>0 then 'blocked'
    when count(f.finding_key) filter (where f.severity='warning')>0 then 'review'
    else 'clear'
  end as audit_status,
  coalesce(
    (array_agg(f.next_action order by case f.severity when 'blocker' then 0 else 1 end, f.sort_order)
      filter (where f.finding_key is not null))[1],
    'Estimate audit is clear.'
  ) as next_action
from public.estimates e
left join public.estimate_audit_findings f
  on f.company_id=e.company_id and f.estimate_id=e.id
group by e.company_id,e.id,e.estimate_number,e.version,e.name,e.status;

revoke all on public.estimate_audit_findings from public;
revoke all on public.estimate_audit_findings from anon;
grant select on public.estimate_audit_findings to authenticated;

revoke all on public.estimate_audit_summary from public;
revoke all on public.estimate_audit_summary from anon;
grant select on public.estimate_audit_summary to authenticated;
