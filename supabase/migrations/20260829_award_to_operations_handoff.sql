-- Carez OS: accepted estimate -> project budget -> physical work packages/readiness.
-- One accepted takeoff measurement becomes one physical Work Package.

alter table public.work_packages
  add column if not exists source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  add column if not exists source_assembly_version_id uuid references public.concrete_assembly_versions(id) on delete set null;

create unique index if not exists work_packages_award_takeoff_unique
  on public.work_packages(company_id,source_estimate_id,source_takeoff_measurement_id)
  where source_estimate_id is not null and source_takeoff_measurement_id is not null;

alter table public.work_package_operations
  add column if not exists source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  add column if not exists source_assembly_component_id uuid references public.concrete_assembly_components(id) on delete set null,
  add column if not exists source_budget_line_id uuid references public.project_budget_lines(id) on delete set null;

create unique index if not exists work_package_operations_source_estimate_item_unique
  on public.work_package_operations(company_id,work_package_id,source_estimate_item_id)
  where source_estimate_item_id is not null;

alter table public.work_package_resource_requirements
  add column if not exists source_estimate_item_id uuid references public.estimate_items(id) on delete set null,
  add column if not exists source_takeoff_output_id uuid references public.takeoff_measurement_outputs(id) on delete set null,
  add column if not exists source_budget_line_id uuid references public.project_budget_lines(id) on delete set null,
  add column if not exists auto_generated boolean not null default false;

create unique index if not exists work_package_resources_source_estimate_item_unique
  on public.work_package_resource_requirements(company_id,work_package_operation_id,source_estimate_item_id)
  where source_estimate_item_id is not null;

alter table public.project_inspections
  add column if not exists source_estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists source_takeoff_measurement_id uuid references public.takeoff_measurements(id) on delete set null,
  add column if not exists auto_generated boolean not null default false;

create unique index if not exists project_inspections_auto_takeoff_unique
  on public.project_inspections(company_id,required_for_operation_id,source_takeoff_measurement_id)
  where auto_generated and required_for_operation_id is not null and source_takeoff_measurement_id is not null;

alter table public.pour_plans
  add column if not exists source_estimate_id uuid references public.estimates(id) on delete set null,
  add column if not exists source_work_package_id uuid references public.work_packages(id) on delete set null;

create unique index if not exists pour_plans_source_work_package_unique
  on public.pour_plans(company_id,source_work_package_id)
  where source_work_package_id is not null;

create or replace function public.carez_generate_awarded_operations(p_estimate_id uuid,p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.estimates%rowtype;
  m record;
  r record;
  v_wp uuid;
  v_pour uuid;
  v_place_op uuid;
  v_target_op uuid;
  v_budget_line uuid;
  v_concrete_cy numeric;
  v_inspection_title text;
  v_component_key text;
  v_baseline_source text;
  v_wp_count integer:=0;
  v_op_count integer:=0;
  v_resource_count integer:=0;
  v_inspection_count integer:=0;
  v_pour_count integer:=0;
begin
  select * into e from public.estimates where id=p_estimate_id;
  if not found then raise exception 'Estimate not found'; end if;
  if p_project_id is null or e.project_id is distinct from p_project_id then
    raise exception 'Accepted estimate and project do not match';
  end if;

  for m in
    select
      tm.id as measurement_id,
      tm.name as measurement_name,
      tm.location,
      tm.drawing_reference,
      tm.assembly_version_id,
      tm.estimate_section_id,
      av.version_no,
      a.code as assembly_code,
      a.name as assembly_name
    from public.takeoff_measurements tm
    join public.concrete_assembly_versions av on av.id=tm.assembly_version_id and av.company_id=tm.company_id
    join public.concrete_assemblies a on a.id=av.assembly_id and a.company_id=av.company_id
    where tm.company_id=e.company_id
      and exists(
        select 1 from public.estimate_items i
        where i.estimate_id=e.id and i.company_id=e.company_id and i.source_takeoff_measurement_id=tm.id
      )
    order by tm.created_at,tm.id
  loop
    select id into v_wp
    from public.work_packages
    where company_id=e.company_id
      and source_estimate_id=e.id
      and source_takeoff_measurement_id=m.measurement_id
    order by created_at limit 1;

    if v_wp is null then
      insert into public.work_packages(
        company_id,project_id,name,location,description,drawing_reference,source_type,source_estimate_id,
        source_takeoff_measurement_id,source_assembly_version_id,status,created_by
      ) values(
        e.company_id,p_project_id,coalesce(nullif(m.measurement_name,''),m.assembly_name),m.location,
        'Auto-generated from accepted takeoff · '||m.assembly_code||' v'||m.version_no,
        m.drawing_reference,'takeoff',e.id,m.measurement_id,m.assembly_version_id,'planned',null
      ) returning id into v_wp;
      v_wp_count:=v_wp_count+1;
    end if;

    insert into public.work_package_operations(
      company_id,work_package_id,production_task_id,source_estimate_item_id,source_takeoff_output_id,
      source_assembly_component_id,source_budget_line_id,field_label,sequence,planned_quantity,unit,
      budgeted_man_hours,baseline_man_hours_per_unit,baseline_source,measurement_method,status,notes
    )
    select
      i.company_id,v_wp,i.production_task_id,i.id,i.source_takeoff_output_id,o.assembly_component_id,pbl.id,
      i.description,
      coalesce(c.sort_order,i.sort_order,100),
      i.production_quantity,i.production_unit,
      case
        when coalesce(i.regular_hours,0)+coalesce(i.overtime_hours,0)>0 then coalesce(i.regular_hours,0)+coalesce(i.overtime_hours,0)
        when i.baseline_man_hours_per_unit is not null then i.production_quantity*i.baseline_man_hours_per_unit
        else null
      end,
      i.baseline_man_hours_per_unit,
      case
        when i.baseline_source in ('manual','national_estimator','carez_blend','carez_actual') then i.baseline_source
        when lower(coalesce(i.baseline_source,'')) like '%actual%' then 'carez_actual'
        when lower(coalesce(i.baseline_source,'')) like '%carez%' then 'carez_blend'
        when i.baseline_source is not null then 'national_estimator'
        else 'manual'
      end,
      'completion','planned',
      'Accepted estimate lineage · '||coalesce(m.drawing_reference,'no drawing reference')
    from public.estimate_items i
    left join public.takeoff_measurement_outputs o on o.id=i.source_takeoff_output_id and o.company_id=i.company_id
    left join public.concrete_assembly_components c on c.id=o.assembly_component_id and c.company_id=i.company_id
    left join public.project_budgets pb on pb.project_id=p_project_id and pb.estimate_id=e.id and pb.budget_type='original' and pb.status='active'
    left join public.project_budget_lines pbl on pbl.budget_id=pb.id and pbl.source_estimate_item_id=i.id
    where i.company_id=e.company_id
      and i.estimate_id=e.id
      and i.source_takeoff_measurement_id=m.measurement_id
      and i.item_type='labor'
      and i.production_task_id is not null
      and coalesce(i.production_quantity,0)>0
      and nullif(trim(coalesce(i.production_unit,'')),'') is not null
      and not exists(
        select 1 from public.work_package_operations x
        where x.company_id=i.company_id and x.work_package_id=v_wp and x.source_estimate_item_id=i.id
      )
    order by coalesce(c.sort_order,i.sort_order,100),i.created_at;
    get diagnostics v_op_count=v_op_count+row_count;

    -- One concrete material quantity from the accepted measurement becomes the planning quantity for the pour.
    select coalesce(sum(i.quantity),0) into v_concrete_cy
    from public.estimate_items i
    left join public.takeoff_measurement_outputs o on o.id=i.source_takeoff_output_id and o.company_id=i.company_id
    left join public.concrete_assembly_components c on c.id=o.assembly_component_id and c.company_id=i.company_id
    where i.company_id=e.company_id
      and i.estimate_id=e.id
      and i.source_takeoff_measurement_id=m.measurement_id
      and i.item_type='material'
      and upper(i.unit)='CY'
      and (lower(coalesce(c.component_key,'')) like '%concrete%' or lower(i.description) like '%ready-mix%');

    if v_concrete_cy>0 then
      select id into v_pour from public.pour_plans
      where company_id=e.company_id and source_work_package_id=v_wp
      order by created_at limit 1;

      if v_pour is null then
        insert into public.pour_plans(
          company_id,project_id,budget_section_id,name,expected_concrete_yards,contingency_percent,
          minimum_cash_buffer,company_cash_support,status,notes,created_by,source_estimate_id,source_work_package_id
        )
        select
          e.company_id,p_project_id,pbs.id,
          coalesce(nullif(m.measurement_name,''),m.assembly_name)||' — Concrete',
          v_concrete_cy,0,0,0,'planning',
          'Auto-generated from accepted takeoff · planned CY comes from the accepted concrete material line.',
          null,e.id,v_wp
        from (select 1) q
        left join public.project_budgets pb on pb.project_id=p_project_id and pb.estimate_id=e.id and pb.budget_type='original' and pb.status='active'
        left join public.project_budget_sections pbs on pbs.budget_id=pb.id and pbs.source_estimate_section_id=m.estimate_section_id
        limit 1
        returning id into v_pour;
        v_pour_count:=v_pour_count+1;
      end if;

      update public.work_package_operations wo
      set pour_plan_id=v_pour,
          measurement_method=case
            when upper(wo.unit)='CY' and pt.name ilike 'Place%' then 'ticket'
            else wo.measurement_method
          end,
          updated_at=now()
      from public.production_tasks pt
      where wo.company_id=e.company_id and wo.work_package_id=v_wp and pt.id=wo.production_task_id
        and (pt.name ilike 'Place%' or pt.name ilike '%Place / Finish%');
    end if;

    select wo.id into v_place_op
    from public.work_package_operations wo
    join public.production_tasks pt on pt.id=wo.production_task_id and pt.company_id=wo.company_id
    where wo.company_id=e.company_id and wo.work_package_id=v_wp
      and (pt.name ilike 'Place%' or pt.name ilike '%Place / Finish%')
    order by wo.sequence,wo.created_at limit 1;

    -- Structural/ROW assemblies get a real pre-pour gate automatically. Private flatwork stays judgment-based.
    if v_place_op is not null
       and (m.assembly_code like 'FTG-%' or m.assembly_code like 'BEAM-%' or m.assembly_code like 'WALL-%' or m.assembly_code='FLAT-ROW' or m.assembly_code='STEP-GRADE')
       and exists(
         select 1 from public.work_package_operations wo
         join public.production_tasks pt on pt.id=wo.production_task_id and pt.company_id=wo.company_id
         where wo.company_id=e.company_id and wo.work_package_id=v_wp and pt.name ilike '%Rebar%'
       ) then
      v_inspection_title:=case
        when m.assembly_code='FLAT-ROW' then 'ROW / pre-pour inspection'
        when m.assembly_code like 'FTG-%' or m.assembly_code like 'BEAM-%' then 'Footing / grade beam pre-pour inspection'
        when m.assembly_code like 'WALL-%' then 'Wall / rebar pre-pour inspection'
        when m.assembly_code='STEP-GRADE' then 'Steps / reinforcement pre-pour inspection'
        else 'Rebar / pre-pour inspection'
      end;

      if not exists(
        select 1 from public.project_inspections pi
        where pi.company_id=e.company_id and pi.required_for_operation_id=v_place_op
          and pi.source_takeoff_measurement_id=m.measurement_id and pi.auto_generated
      ) then
        insert into public.project_inspections(
          company_id,project_id,required_for_operation_id,title,inspection_type,status,
          source_estimate_id,source_takeoff_measurement_id,auto_generated,result_notes
        ) values(
          e.company_id,p_project_id,v_place_op,v_inspection_title,'pre_pour','required',
          e.id,m.measurement_id,true,'Generated from the accepted assembly. Waive with a reason if the authority does not require this inspection.'
        );
        v_inspection_count:=v_inspection_count+1;
      end if;
    end if;

    -- Material/equipment/subcontractor facts become readiness requirements for the operation that needs them.
    for r in
      select
        i.id as estimate_item_id,i.item_type,i.description,i.quantity,i.unit,i.source_takeoff_output_id,
        o.assembly_component_id,c.component_key,c.sort_order,pbl.id as budget_line_id
      from public.estimate_items i
      left join public.takeoff_measurement_outputs o on o.id=i.source_takeoff_output_id and o.company_id=i.company_id
      left join public.concrete_assembly_components c on c.id=o.assembly_component_id and c.company_id=i.company_id
      left join public.project_budgets pb on pb.project_id=p_project_id and pb.estimate_id=e.id and pb.budget_type='original' and pb.status='active'
      left join public.project_budget_lines pbl on pbl.budget_id=pb.id and pbl.source_estimate_item_id=i.id
      where i.company_id=e.company_id and i.estimate_id=e.id
        and i.source_takeoff_measurement_id=m.measurement_id
        and i.item_type in ('material','equipment','subcontractor')
        and i.quantity>0
      order by coalesce(c.sort_order,i.sort_order,100),i.created_at
    loop
      v_target_op:=null;
      v_component_key:=lower(coalesce(r.component_key,''));

      if v_component_key like '%form%' then
        select wo.id into v_target_op from public.work_package_operations wo
        join public.production_tasks pt on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id and wo.work_package_id=v_wp and pt.name ilike 'Form%'
        order by wo.sequence limit 1;
      elsif v_component_key like '%rebar%' or v_component_key like '%reinforc%' or v_component_key like '%mesh%' then
        select wo.id into v_target_op from public.work_package_operations wo
        join public.production_tasks pt on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id and wo.work_package_id=v_wp and (pt.name ilike '%Rebar%' or pt.name ilike '%Mesh%')
        order by wo.sequence limit 1;
      elsif v_component_key like '%concrete%' then
        v_target_op:=v_place_op;
      elsif v_component_key like '%cure%' or v_component_key like '%seal%' then
        select wo.id into v_target_op from public.work_package_operations wo
        join public.production_tasks pt on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id and wo.work_package_id=v_wp and (pt.name ilike '%Finish%' or pt.name ilike '%Place%')
        order by case when pt.name ilike '%Finish%' then 0 else 1 end,wo.sequence limit 1;
      elsif v_component_key like '%nosing%' then
        select wo.id into v_target_op from public.work_package_operations wo
        join public.production_tasks pt on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id and wo.work_package_id=v_wp and pt.name ilike '%Nosing%'
        order by wo.sequence limit 1;
      end if;

      if v_target_op is null then
        select wo.id into v_target_op
        from public.work_package_operations wo
        left join public.concrete_assembly_components oc on oc.id=wo.source_assembly_component_id
        where wo.company_id=e.company_id and wo.work_package_id=v_wp
        order by abs(coalesce(oc.sort_order,wo.sequence)-coalesce(r.sort_order,wo.sequence)),wo.sequence
        limit 1;
      end if;

      if v_target_op is null then continue; end if;

      -- Ticket-controlled CY placements already have the stronger Pour Plan / ready-mix order gate.
      if r.item_type='material' and v_component_key like '%concrete%'
         and exists(select 1 from public.work_package_operations x where x.id=v_target_op and x.measurement_method='ticket') then
        continue;
      end if;

      if not exists(
        select 1 from public.work_package_resource_requirements rr
        where rr.company_id=e.company_id and rr.work_package_operation_id=v_target_op and rr.source_estimate_item_id=r.estimate_item_id
      ) then
        insert into public.work_package_resource_requirements(
          company_id,work_package_operation_id,resource_type,label,required_quantity,unit,required_before_start,
          source_estimate_item_id,source_takeoff_output_id,source_budget_line_id,auto_generated,notes
        ) values(
          e.company_id,v_target_op,
          case r.item_type when 'material' then 'material' when 'equipment' then 'equipment' else 'vendor' end,
          r.description,r.quantity,r.unit,true,
          r.estimate_item_id,r.source_takeoff_output_id,r.budget_line_id,true,
          'Generated from the accepted estimate. Link inventory, equipment, PO, or vendor evidence to clear readiness.'
        );
        v_resource_count:=v_resource_count+1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'work_packages_created',v_wp_count,
    'operations_created',v_op_count,
    'resources_created',v_resource_count,
    'inspections_created',v_inspection_count,
    'pour_plans_created',v_pour_count
  );
end;
$$;

revoke all on function public.carez_generate_awarded_operations(uuid,uuid) from public,anon,authenticated;

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
  else
    select customer_id into v_customer from public.projects where id=v_project and company_id=e.company_id;
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
      labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,
      source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,production_quantity,
      production_unit,baseline_man_hours_per_unit,baseline_source
    )
    select i.company_id,v_budget,bs.id,i.id,i.item_type,i.cost_code_id,i.catalog_item_id,i.crew_member_id,
      i.labor_task,i.risk_class_code,i.description,i.quantity,i.unit,i.unit_cost,i.direct_cost,i.regular_hours,i.overtime_hours,i.notes,i.sort_order,
      i.source_takeoff_output_id,i.source_takeoff_measurement_id,i.source_assembly_version_id,i.production_task_id,i.production_quantity,
      i.production_unit,i.baseline_man_hours_per_unit,i.baseline_source
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

  update public.estimates set status='accepted',approved_at=coalesce(approved_at,v_now),project_id=v_project,opportunity_number=v_job_number where id=e.id;
  if l.id is not null then update public.leads set status='won',customer_id=coalesce(v_customer,l.customer_id),updated_at=v_now where id=l.id; end if;

  perform public.carez_generate_awarded_operations(e.id,v_project);
  return v_project;
end;
$$;

create or replace view public.project_award_operations_handoff
with (security_invoker=true)
as
with expected as (
  select e.company_id,e.id as estimate_id,e.project_id,count(distinct i.source_takeoff_measurement_id)::integer as expected_work_packages
  from public.estimates e
  left join public.estimate_items i on i.estimate_id=e.id and i.company_id=e.company_id and i.source_takeoff_measurement_id is not null
  where e.project_id is not null
  group by e.company_id,e.id,e.project_id
), actual as (
  select wp.company_id,wp.project_id,wp.source_estimate_id,
    count(distinct wp.id)::integer as work_package_count,
    count(distinct wo.id)::integer as operation_count,
    count(distinct rr.id)::integer as resource_requirement_count,
    count(distinct pi.id)::integer as inspection_count,
    count(distinct pp.id)::integer as pour_plan_count
  from public.work_packages wp
  left join public.work_package_operations wo on wo.work_package_id=wp.id and wo.company_id=wp.company_id
  left join public.work_package_resource_requirements rr on rr.work_package_operation_id=wo.id and rr.company_id=wo.company_id and rr.auto_generated
  left join public.project_inspections pi on pi.required_for_operation_id=wo.id and pi.company_id=wo.company_id and pi.auto_generated
  left join public.pour_plans pp on pp.source_work_package_id=wp.id and pp.company_id=wp.company_id
  where wp.source_estimate_id is not null and wp.source_type='takeoff'
  group by wp.company_id,wp.project_id,wp.source_estimate_id
)
select
  x.company_id,x.project_id,x.estimate_id,x.expected_work_packages,
  coalesce(a.work_package_count,0) as work_package_count,
  coalesce(a.operation_count,0) as operation_count,
  coalesce(a.resource_requirement_count,0) as resource_requirement_count,
  coalesce(a.inspection_count,0) as inspection_count,
  coalesce(a.pour_plan_count,0) as pour_plan_count,
  case
    when x.expected_work_packages=0 then 'estimate_only'
    when coalesce(a.work_package_count,0)=x.expected_work_packages and coalesce(a.operation_count,0)>0 then 'generated'
    else 'needs_sync'
  end as handoff_status,
  case
    when x.expected_work_packages=0 then 'No takeoff-linked physical packages exist; plan field work manually.'
    when coalesce(a.work_package_count,0)=x.expected_work_packages and coalesce(a.operation_count,0)>0 then 'Accepted takeoff is connected to field operations.'
    else 'Accepted takeoff has not fully generated its field operations.'
  end as next_action
from expected x
left join actual a on a.company_id=x.company_id and a.project_id=x.project_id and a.source_estimate_id=x.estimate_id;

revoke all on public.project_award_operations_handoff from public,anon;
grant select on public.project_award_operations_handoff to authenticated;
