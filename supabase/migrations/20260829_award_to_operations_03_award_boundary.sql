-- Carez OS: preserve accepted estimate lineage in the project budget and invoke the field handoff.

create or replace function public.award_accepted_estimate(p_estimate_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.estimates%rowtype;
  l public.leads%rowtype;
  s record;
  v_project uuid;
  v_customer uuid;
  v_budget uuid;
  v_job_number text;
  v_customer_name text;
  v_now timestamptz:=now();
begin
  select * into e from public.estimates where id=p_estimate_id for update;
  if not found then raise exception 'Estimate not found'; end if;

  select * into s from public.estimate_financial_summary where estimate_id=e.id;
  if not found then raise exception 'Estimate financial summary is unavailable'; end if;

  if e.lead_id is not null then
    select * into l from public.leads where id=e.lead_id and company_id=e.company_id;
  end if;

  v_job_number:=coalesce(nullif(e.opportunity_number,''),nullif(l.opportunity_number,''));
  if v_job_number is null then
    v_job_number:=public.next_opportunity_number_for_company(e.company_id);
    update public.estimates
      set opportunity_number=v_job_number,estimate_number='E-'||v_job_number
      where id=e.id;
    if l.id is not null then
      update public.leads set opportunity_number=v_job_number where id=l.id;
    end if;
  end if;

  v_project:=e.project_id;
  if v_project is null then
    v_customer:=l.customer_id;
    v_customer_name:=coalesce(
      nullif(l.customer_name,''),
      nullif(l.contact_name,''),
      nullif(e.name,''),
      'Customer '||v_job_number
    );

    if v_customer is null and nullif(l.email,'') is not null then
      select id into v_customer
      from public.customers
      where company_id=e.company_id
        and email is not null
        and lower(email)=lower(l.email)
      order by created_at
      limit 1;
    end if;

    if v_customer is null then
      select id into v_customer
      from public.customers
      where company_id=e.company_id and lower(name)=lower(v_customer_name)
      order by created_at
      limit 1;
    end if;

    if v_customer is null then
      insert into public.customers(
        company_id,name,contact_name,email,phone,billing_address_line1,
        billing_city,billing_state,billing_postal_code
      ) values(
        e.company_id,v_customer_name,l.contact_name,l.email,l.phone,l.address,
        l.city,coalesce(l.state,'WA'),l.postal_code
      ) returning id into v_customer;
    else
      update public.customers set
        contact_name=coalesce(contact_name,l.contact_name),
        email=coalesce(email,l.email),
        phone=coalesce(phone,l.phone),
        billing_address_line1=coalesce(billing_address_line1,l.address),
        billing_city=coalesce(billing_city,l.city),
        billing_state=coalesce(billing_state,l.state),
        billing_postal_code=coalesce(billing_postal_code,l.postal_code)
      where id=v_customer and company_id=e.company_id;
    end if;

    if l.id is not null then
      update public.leads set customer_id=v_customer where id=l.id;
    end if;

    insert into public.projects(
      company_id,customer_id,lead_id,source_estimate_id,job_number,name,address,city,state,status,
      contract_value,target_margin_percent,bo_classification,bo_rate_percent,
      payment_processing_rate_percent,estimated_labor_hours,estimated_labor_cost
    ) values(
      e.company_id,v_customer,e.lead_id,e.id,v_job_number,
      coalesce(nullif(l.project_name,''),e.name),l.address,l.city,coalesce(l.state,'WA'),'active',
      coalesce(s.selected_sell_price,0),e.target_margin_percent,e.bo_classification,
      e.bo_rate_percent,e.payment_processing_rate_percent,
      coalesce(s.labor_hours,0),coalesce(s.direct_labor_cost,0)
    ) returning id into v_project;

    update public.estimates set project_id=v_project where id=e.id;
  else
    select customer_id into v_customer
    from public.projects
    where id=v_project and company_id=e.company_id;
  end if;

  select id into v_budget
  from public.project_budgets
  where estimate_id=e.id and budget_type='original' and status='active'
  order by approved_at desc nulls last
  limit 1;

  if v_budget is null then
    insert into public.project_budgets(
      company_id,project_id,estimate_id,budget_type,version,status,label,approved_at,
      sell_price,target_margin_percent,bo_rate_percent,payment_processing_rate_percent,
      labor_hours,direct_labor_cost,material_cost,equipment_cost,subcontractor_cost,
      other_direct_cost,total_direct_cost,overhead_cost,revenue_cost_reserve,total_company_cost,
      budgeted_profit,budgeted_margin_percent
    ) values(
      e.company_id,v_project,e.id,'original',e.version,'active',
      e.estimate_number||'-R'||e.version||' Accepted Budget',v_now,
      coalesce(s.selected_sell_price,0),e.target_margin_percent,e.bo_rate_percent,
      e.payment_processing_rate_percent,coalesce(s.labor_hours,0),
      coalesce(s.direct_labor_cost,0),coalesce(s.material_cost,0),coalesce(s.equipment_cost,0),
      coalesce(s.subcontractor_cost,0),coalesce(s.other_direct_cost,0),
      coalesce(s.total_direct_cost,0),coalesce(s.overhead_cost,0),
      coalesce(s.revenue_cost_reserve,0),
      coalesce(s.base_company_cost,0)+coalesce(s.revenue_cost_reserve,0),
      coalesce(s.selected_sell_price,0)-(
        coalesce(s.base_company_cost,0)+coalesce(s.revenue_cost_reserve,0)
      ),
      coalesce(s.projected_margin_percent,0)
    ) returning id into v_budget;

    insert into public.project_budget_sections(
      company_id,budget_id,source_estimate_section_id,name,scope_type,sort_order
    )
    select company_id,v_budget,id,name,scope_type,sort_order
    from public.estimate_sections
    where estimate_id=e.id
    order by sort_order;

    insert into public.project_budget_lines(
      company_id,budget_id,budget_section_id,source_estimate_item_id,item_type,
      cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,
      description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,
      notes,sort_order,source_takeoff_output_id,source_takeoff_measurement_id,
      source_assembly_version_id,production_task_id,production_quantity,production_unit,
      baseline_man_hours_per_unit,baseline_source
    )
    select
      i.company_id,v_budget,bs.id,i.id,i.item_type,
      i.cost_code_id,i.catalog_item_id,i.crew_member_id,i.labor_task,i.risk_class_code,
      i.description,i.quantity,i.unit,i.unit_cost,i.direct_cost,i.regular_hours,i.overtime_hours,
      i.notes,i.sort_order,i.source_takeoff_output_id,i.source_takeoff_measurement_id,
      i.source_assembly_version_id,i.production_task_id,i.production_quantity,i.production_unit,
      i.baseline_man_hours_per_unit,i.baseline_source
    from public.estimate_items i
    left join public.project_budget_sections bs
      on bs.budget_id=v_budget and bs.source_estimate_section_id=i.section_id
    where i.estimate_id=e.id
    order by i.sort_order,i.created_at;
  end if;

  update public.projects set
    contract_value=coalesce(s.selected_sell_price,0),
    target_margin_percent=e.target_margin_percent,
    bo_classification=e.bo_classification,
    bo_rate_percent=e.bo_rate_percent,
    payment_processing_rate_percent=e.payment_processing_rate_percent,
    estimated_labor_hours=coalesce(s.labor_hours,0),
    estimated_labor_cost=coalesce(s.direct_labor_cost,0),
    updated_at=v_now
  where id=v_project and company_id=e.company_id;

  update public.estimates set
    status='accepted',
    approved_at=coalesce(approved_at,v_now),
    project_id=v_project,
    opportunity_number=v_job_number
  where id=e.id;

  if l.id is not null then
    update public.leads set
      status='won',
      customer_id=coalesce(v_customer,l.customer_id),
      updated_at=v_now
    where id=l.id;
  end if;

  perform public.carez_generate_awarded_operations(e.id,v_project);
  return v_project;
end;
$$;

create or replace view public.project_award_operations_handoff
with (security_invoker=true)
as
with expected as (
  select
    e.company_id,
    e.id as estimate_id,
    e.project_id,
    count(distinct i.source_takeoff_measurement_id)::integer as expected_work_packages
  from public.estimates e
  left join public.estimate_items i
    on i.estimate_id=e.id
   and i.company_id=e.company_id
   and i.source_takeoff_measurement_id is not null
  where e.project_id is not null
  group by e.company_id,e.id,e.project_id
), actual as (
  select
    wp.company_id,
    wp.project_id,
    wp.source_estimate_id,
    count(distinct wp.id)::integer as work_package_count,
    count(distinct wo.id)::integer as operation_count,
    count(distinct rr.id) filter (where rr.auto_generated)::integer as resource_requirement_count,
    count(distinct pi.id) filter (where pi.auto_generated)::integer as inspection_count,
    count(distinct pp.id)::integer as pour_plan_count
  from public.work_packages wp
  left join public.work_package_operations wo
    on wo.work_package_id=wp.id and wo.company_id=wp.company_id
  left join public.work_package_resource_requirements rr
    on rr.work_package_operation_id=wo.id and rr.company_id=wo.company_id
  left join public.project_inspections pi
    on pi.required_for_operation_id=wo.id and pi.company_id=wo.company_id
  left join public.pour_plans pp
    on pp.source_work_package_id=wp.id and pp.company_id=wp.company_id
  where wp.source_estimate_id is not null and wp.source_type='takeoff'
  group by wp.company_id,wp.project_id,wp.source_estimate_id
)
select
  x.company_id,
  x.project_id,
  x.estimate_id,
  x.expected_work_packages,
  coalesce(a.work_package_count,0) as work_package_count,
  coalesce(a.operation_count,0) as operation_count,
  coalesce(a.resource_requirement_count,0) as resource_requirement_count,
  coalesce(a.inspection_count,0) as inspection_count,
  coalesce(a.pour_plan_count,0) as pour_plan_count,
  case
    when x.expected_work_packages=0 then 'estimate_only'
    when coalesce(a.work_package_count,0)=x.expected_work_packages
         and coalesce(a.operation_count,0)>0 then 'generated'
    else 'needs_sync'
  end as handoff_status,
  case
    when x.expected_work_packages=0 then 'No takeoff-linked physical packages exist; plan field work manually.'
    when coalesce(a.work_package_count,0)=x.expected_work_packages
         and coalesce(a.operation_count,0)>0 then 'Accepted takeoff is connected to field operations.'
    else 'Accepted takeoff has not fully generated its field operations.'
  end as next_action
from expected x
left join actual a
  on a.company_id=x.company_id
 and a.project_id=x.project_id
 and a.source_estimate_id=x.estimate_id;

revoke all on public.project_award_operations_handoff from public,anon;
grant select on public.project_award_operations_handoff to authenticated;
