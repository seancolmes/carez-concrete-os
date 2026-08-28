-- Integration hardening discovered during live-schema preflight.

-- New OS code consistently uses "completed". Keep legacy "complete" readable during transition.
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
check (status = any(array['active'::text,'scheduled'::text,'on_hold'::text,'complete'::text,'completed'::text]));
update public.projects set status='completed' where status='complete';

-- Customer acceptance is idempotent: create/reuse customer, create job if needed, freeze accepted estimate once.
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
  if s is null then raise exception 'Estimate financial summary is unavailable'; end if;

  if e.lead_id is not null then
    select * into l from public.leads where id=e.lead_id and company_id=e.company_id;
  end if;

  v_job_number:=coalesce(nullif(e.opportunity_number,''),nullif(l.opportunity_number,''));
  if v_job_number is null then
    v_job_number:=public.next_opportunity_number_for_company(e.company_id);
    update public.estimates set opportunity_number=v_job_number,estimate_number='E-'||v_job_number where id=e.id;
    if l.id is not null then update public.leads set opportunity_number=v_job_number where id=l.id; end if;
  end if;

  v_project:=e.project_id;
  if v_project is null then
    v_customer:=l.customer_id;
    v_customer_name:=coalesce(nullif(l.customer_name,''),nullif(l.contact_name,''),nullif(e.name,''),'Customer '||v_job_number);

    if v_customer is null and nullif(l.email,'') is not null then
      select id into v_customer from public.customers
      where company_id=e.company_id and email is not null and lower(email)=lower(l.email)
      order by created_at limit 1;
    end if;
    if v_customer is null then
      select id into v_customer from public.customers
      where company_id=e.company_id and lower(name)=lower(v_customer_name)
      order by created_at limit 1;
    end if;
    if v_customer is null then
      insert into public.customers(company_id,name,contact_name,email,phone,billing_address_line1,billing_city,billing_state,billing_postal_code)
      values(e.company_id,v_customer_name,l.contact_name,l.email,l.phone,l.address,l.city,coalesce(l.state,'WA'),l.postal_code)
      returning id into v_customer;
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
    if l.id is not null then update public.leads set customer_id=v_customer where id=l.id; end if;

    insert into public.projects(
      company_id,customer_id,lead_id,source_estimate_id,job_number,name,address,city,state,status,
      contract_value,target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent,
      estimated_labor_hours,estimated_labor_cost
    ) values(
      e.company_id,v_customer,e.lead_id,e.id,v_job_number,coalesce(nullif(l.project_name,''),e.name),l.address,l.city,coalesce(l.state,'WA'),'active',
      coalesce(s.selected_sell_price,0),e.target_margin_percent,e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,
      coalesce(s.labor_hours,0),coalesce(s.direct_labor_cost,0)
    ) returning id into v_project;
    update public.estimates set project_id=v_project where id=e.id;
  end if;

  select id into v_budget from public.project_budgets
  where estimate_id=e.id and budget_type='original' and status='active'
  order by approved_at desc nulls last limit 1;

  if v_budget is null then
    insert into public.project_budgets(
      company_id,project_id,estimate_id,budget_type,version,status,label,approved_at,sell_price,target_margin_percent,
      bo_rate_percent,payment_processing_rate_percent,labor_hours,direct_labor_cost,material_cost,equipment_cost,
      subcontractor_cost,other_direct_cost,total_direct_cost,overhead_cost,revenue_cost_reserve,total_company_cost,
      budgeted_profit,budgeted_margin_percent
    ) values(
      e.company_id,v_project,e.id,'original',e.version,'active',e.estimate_number||'-R'||e.version||' Accepted Budget',v_now,
      coalesce(s.selected_sell_price,0),e.target_margin_percent,e.bo_rate_percent,e.payment_processing_rate_percent,
      coalesce(s.labor_hours,0),coalesce(s.direct_labor_cost,0),coalesce(s.material_cost,0),coalesce(s.equipment_cost,0),
      coalesce(s.subcontractor_cost,0),coalesce(s.other_direct_cost,0),coalesce(s.total_direct_cost,0),coalesce(s.overhead_cost,0),
      coalesce(s.revenue_cost_reserve,0),coalesce(s.base_company_cost,0)+coalesce(s.revenue_cost_reserve,0),
      coalesce(s.selected_sell_price,0)-(coalesce(s.base_company_cost,0)+coalesce(s.revenue_cost_reserve,0)),coalesce(s.projected_margin_percent,0)
    ) returning id into v_budget;

    insert into public.project_budget_sections(company_id,budget_id,source_estimate_section_id,name,scope_type,sort_order)
    select company_id,v_budget,id,name,scope_type,sort_order
    from public.estimate_sections where estimate_id=e.id order by sort_order;

    insert into public.project_budget_lines(
      company_id,budget_id,budget_section_id,source_estimate_item_id,item_type,cost_code_id,catalog_item_id,crew_member_id,
      labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order
    )
    select i.company_id,v_budget,bs.id,i.id,i.item_type,i.cost_code_id,i.catalog_item_id,i.crew_member_id,
      i.labor_task,i.risk_class_code,i.description,i.quantity,i.unit,i.unit_cost,i.direct_cost,i.regular_hours,i.overtime_hours,i.notes,i.sort_order
    from public.estimate_items i
    left join public.project_budget_sections bs on bs.budget_id=v_budget and bs.source_estimate_section_id=i.section_id
    where i.estimate_id=e.id order by i.sort_order;
  end if;

  update public.projects set
    contract_value=coalesce(s.selected_sell_price,0),target_margin_percent=e.target_margin_percent,
    bo_classification=e.bo_classification,bo_rate_percent=e.bo_rate_percent,
    payment_processing_rate_percent=e.payment_processing_rate_percent,
    estimated_labor_hours=coalesce(s.labor_hours,0),estimated_labor_cost=coalesce(s.direct_labor_cost,0),updated_at=v_now
  where id=v_project and company_id=e.company_id;

  update public.estimates set status='accepted',approved_at=v_now,project_id=v_project,opportunity_number=v_job_number where id=e.id;
  if l.id is not null then update public.leads set status='won',customer_id=v_customer,updated_at=v_now where id=l.id; end if;
  return v_project;
end;
$$;
revoke all on function public.award_accepted_estimate(uuid) from public,anon,authenticated;
