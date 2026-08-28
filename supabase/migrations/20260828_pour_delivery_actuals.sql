create or replace view public.pour_delivery_actual_summary
with (security_invoker=true)
as
with concrete_lines as (
  select
    pol.company_id,
    pol.pour_plan_id,
    pol.id as purchase_order_line_id,
    pol.purchase_order_id,
    coalesce(pol.quantity,0)::numeric as ordered_cy
  from public.purchase_order_lines pol
  join public.purchase_orders po
    on po.id=pol.purchase_order_id
   and po.company_id=pol.company_id
   and po.status in ('issued','closed')
  join public.cost_codes cc
    on cc.id=pol.cost_code_id
   and cc.company_id=pol.company_id
  where pol.pour_plan_id is not null
    and cc.code='51410'
    and upper(coalesce(pol.unit,''))='CY'
),
ordered as (
  select company_id,pour_plan_id,coalesce(sum(ordered_cy),0)::numeric as ordered_cy
  from concrete_lines
  group by company_id,pour_plan_id
),
received as (
  select
    cl.company_id,
    cl.pour_plan_id,
    coalesce(sum(r.quantity_received),0)::numeric as delivered_cy,
    count(r.id)::integer as ticket_count,
    min(r.received_date) as first_delivery_date,
    max(r.received_date) as latest_delivery_date
  from concrete_lines cl
  left join public.purchase_order_receipts r
    on r.purchase_order_line_id=cl.purchase_order_line_id
   and r.company_id=cl.company_id
  group by cl.company_id,cl.pour_plan_id
),
evidence as (
  select
    cl.company_id,
    cl.pour_plan_id,
    count(distinct r.id)::integer as ticket_photo_count
  from concrete_lines cl
  join public.purchase_order_receipts r
    on r.purchase_order_line_id=cl.purchase_order_line_id
   and r.company_id=cl.company_id
  where exists(
    select 1
    from public.company_documents d
    where d.purchase_order_receipt_id=r.id
      and d.company_id=cl.company_id
      and d.review_status='matched'
  )
  group by cl.company_id,cl.pour_plan_id
)
select
  pp.company_id,
  pp.id as pour_plan_id,
  pp.project_id,
  p.job_number,
  p.name as project_name,
  pp.name as pour_name,
  pp.status as pour_status,
  pp.scheduled_date,
  coalesce(pp.expected_concrete_yards,0)::numeric as planned_cy,
  coalesce(o.ordered_cy,0)::numeric as ordered_cy,
  coalesce(r.delivered_cy,0)::numeric as delivered_cy,
  (coalesce(r.delivered_cy,0)-coalesce(pp.expected_concrete_yards,0))::numeric as variance_to_plan_cy,
  greatest(coalesce(pp.expected_concrete_yards,0)-coalesce(r.delivered_cy,0),0)::numeric as remaining_to_plan_cy,
  case when coalesce(pp.expected_concrete_yards,0)>0
    then round(100*coalesce(r.delivered_cy,0)/pp.expected_concrete_yards,1)
    else null end as percent_of_plan_delivered,
  coalesce(r.ticket_count,0)::integer as concrete_ticket_count,
  coalesce(e.ticket_photo_count,0)::integer as ticket_photo_count,
  greatest(coalesce(r.ticket_count,0)-coalesce(e.ticket_photo_count,0),0)::integer as tickets_missing_photo,
  r.first_delivery_date,
  r.latest_delivery_date
from public.pour_plans pp
join public.projects p
  on p.id=pp.project_id
 and p.company_id=pp.company_id
left join ordered o
  on o.company_id=pp.company_id
 and o.pour_plan_id=pp.id
left join received r
  on r.company_id=pp.company_id
 and r.pour_plan_id=pp.id
left join evidence e
  on e.company_id=pp.company_id
 and e.pour_plan_id=pp.id;

grant select on public.pour_delivery_actual_summary to authenticated;
