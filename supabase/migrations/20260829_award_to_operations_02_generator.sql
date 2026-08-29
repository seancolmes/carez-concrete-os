-- Carez OS: generate physical field work from an accepted takeoff.
-- One takeoff measurement/location becomes one Work Package.

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
  v_budget_section uuid;
  v_concrete_cy numeric;
  v_inspection_title text;
  v_component_key text;
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
    select x.*
    from (
      select distinct on (tm.id)
        tm.id as measurement_id,
        tm.name as measurement_name,
        tm.location,
        tm.drawing_reference,
        tm.assembly_version_id,
        tm.created_at as measurement_created_at,
        i.section_id as estimate_section_id,
        av.version_no,
        a.code as assembly_code,
        a.name as assembly_name
      from public.takeoff_measurements tm
      join public.estimate_items i
        on i.company_id=tm.company_id
       and i.source_takeoff_measurement_id=tm.id
       and i.estimate_id=e.id
      join public.concrete_assembly_versions av
        on av.id=tm.assembly_version_id and av.company_id=tm.company_id
      join public.concrete_assemblies a
        on a.id=av.assembly_id and a.company_id=av.company_id
      where tm.company_id=e.company_id
      order by tm.id,i.sort_order,i.created_at
    ) x
    order by x.measurement_created_at,x.measurement_id
  loop
    v_wp:=null;
    select id into v_wp
    from public.work_packages
    where company_id=e.company_id
      and source_estimate_id=e.id
      and source_takeoff_measurement_id=m.measurement_id
    order by created_at
    limit 1;

    if v_wp is null then
      insert into public.work_packages(
        company_id,project_id,name,location,description,drawing_reference,
        source_type,source_estimate_id,source_takeoff_measurement_id,
        source_assembly_version_id,status,created_by
      ) values(
        e.company_id,p_project_id,
        coalesce(nullif(m.measurement_name,''),m.assembly_name),
        m.location,
        'Auto-generated from accepted takeoff · '||m.assembly_code||' v'||m.version_no,
        m.drawing_reference,
        'takeoff',e.id,m.measurement_id,m.assembly_version_id,'planned',null
      ) returning id into v_wp;
    end if;

    insert into public.work_package_operations(
      company_id,work_package_id,production_task_id,source_estimate_item_id,
      source_takeoff_output_id,source_assembly_component_id,source_budget_line_id,
      field_label,sequence,planned_quantity,unit,budgeted_man_hours,
      baseline_man_hours_per_unit,baseline_source,measurement_method,status,notes
    )
    select
      i.company_id,
      v_wp,
      i.production_task_id,
      i.id,
      i.source_takeoff_output_id,
      o.assembly_component_id,
      pbl.id,
      i.description,
      coalesce(c.sort_order,i.sort_order,100),
      i.production_quantity,
      i.production_unit,
      case
        when coalesce(i.regular_hours,0)+coalesce(i.overtime_hours,0)>0
          then coalesce(i.regular_hours,0)+coalesce(i.overtime_hours,0)
        when i.baseline_man_hours_per_unit is not null
          then i.production_quantity*i.baseline_man_hours_per_unit
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
      'completion',
      'planned',
      'Accepted estimate lineage · '||coalesce(m.drawing_reference,'no drawing reference')
    from public.estimate_items i
    left join public.takeoff_measurement_outputs o
      on o.id=i.source_takeoff_output_id and o.company_id=i.company_id
    left join public.concrete_assembly_components c
      on c.id=o.assembly_component_id and c.company_id=i.company_id
    left join public.project_budgets pb
      on pb.project_id=p_project_id and pb.estimate_id=e.id
     and pb.budget_type='original' and pb.status='active'
    left join public.project_budget_lines pbl
      on pbl.budget_id=pb.id and pbl.source_estimate_item_id=i.id
    where i.company_id=e.company_id
      and i.estimate_id=e.id
      and i.source_takeoff_measurement_id=m.measurement_id
      and i.item_type='labor'
      and i.production_task_id is not null
      and coalesce(i.production_quantity,0)>0
      and nullif(trim(coalesce(i.production_unit,'')),'') is not null
      and not exists(
        select 1
        from public.work_package_operations x
        where x.company_id=i.company_id
          and x.work_package_id=v_wp
          and x.source_estimate_item_id=i.id
      )
    order by coalesce(c.sort_order,i.sort_order,100),i.created_at;

    select coalesce(sum(i.quantity),0)
    into v_concrete_cy
    from public.estimate_items i
    left join public.takeoff_measurement_outputs o
      on o.id=i.source_takeoff_output_id and o.company_id=i.company_id
    left join public.concrete_assembly_components c
      on c.id=o.assembly_component_id and c.company_id=i.company_id
    where i.company_id=e.company_id
      and i.estimate_id=e.id
      and i.source_takeoff_measurement_id=m.measurement_id
      and i.item_type='material'
      and upper(i.unit)='CY'
      and (
        lower(coalesce(c.component_key,'')) like '%concrete%'
        or lower(i.description) like '%ready-mix%'
      );

    if v_concrete_cy>0 then
      v_pour:=null;
      select id into v_pour
      from public.pour_plans
      where company_id=e.company_id and source_work_package_id=v_wp
      order by created_at
      limit 1;

      if v_pour is null then
        v_budget_section:=null;
        select pbs.id into v_budget_section
        from public.project_budgets pb
        join public.project_budget_sections pbs
          on pbs.budget_id=pb.id and pbs.company_id=pb.company_id
        where pb.project_id=p_project_id
          and pb.estimate_id=e.id
          and pb.budget_type='original'
          and pb.status='active'
          and pbs.source_estimate_section_id=m.estimate_section_id
        order by pbs.sort_order
        limit 1;

        insert into public.pour_plans(
          company_id,project_id,budget_section_id,name,expected_concrete_yards,
          contingency_percent,minimum_cash_buffer,company_cash_support,status,
          notes,created_by,source_estimate_id,source_work_package_id
        ) values(
          e.company_id,p_project_id,v_budget_section,
          coalesce(nullif(m.measurement_name,''),m.assembly_name)||' — Concrete',
          v_concrete_cy,0,0,0,'planning',
          'Auto-generated from accepted takeoff · planned CY comes from the accepted concrete material line.',
          null,e.id,v_wp
        ) returning id into v_pour;
      end if;

      update public.work_package_operations wo
      set pour_plan_id=v_pour,
          measurement_method=case
            when upper(wo.unit)='CY' and pt.name ilike 'Place%' then 'ticket'
            else wo.measurement_method
          end,
          updated_at=now()
      from public.production_tasks pt
      where wo.company_id=e.company_id
        and wo.work_package_id=v_wp
        and pt.id=wo.production_task_id
        and (pt.name ilike 'Place%' or pt.name ilike '%Place / Finish%');
    end if;

    v_place_op:=null;
    select wo.id into v_place_op
    from public.work_package_operations wo
    join public.production_tasks pt
      on pt.id=wo.production_task_id and pt.company_id=wo.company_id
    where wo.company_id=e.company_id
      and wo.work_package_id=v_wp
      and (pt.name ilike 'Place%' or pt.name ilike '%Place / Finish%')
    order by wo.sequence,wo.created_at
    limit 1;

    -- Structural/ROW assemblies get a real pre-pour gate automatically.
    -- Generic private flatwork remains judgment-based and can use the existing Work Readiness controls.
    if v_place_op is not null
       and (
         m.assembly_code like 'FTG-%'
         or m.assembly_code like 'BEAM-%'
         or m.assembly_code like 'WALL-%'
         or m.assembly_code='FLAT-ROW'
         or m.assembly_code='STEP-GRADE'
       )
       and exists(
         select 1
         from public.work_package_operations wo
         join public.production_tasks pt
           on pt.id=wo.production_task_id and pt.company_id=wo.company_id
         where wo.company_id=e.company_id
           and wo.work_package_id=v_wp
           and pt.name ilike '%Rebar%'
       ) then
      v_inspection_title:=case
        when m.assembly_code='FLAT-ROW' then 'ROW / pre-pour inspection'
        when m.assembly_code like 'FTG-%' or m.assembly_code like 'BEAM-%' then 'Footing / grade beam pre-pour inspection'
        when m.assembly_code like 'WALL-%' then 'Wall / rebar pre-pour inspection'
        when m.assembly_code='STEP-GRADE' then 'Steps / reinforcement pre-pour inspection'
        else 'Rebar / pre-pour inspection'
      end;

      if not exists(
        select 1
        from public.project_inspections pi
        where pi.company_id=e.company_id
          and pi.required_for_operation_id=v_place_op
          and pi.source_takeoff_measurement_id=m.measurement_id
          and pi.auto_generated
      ) then
        insert into public.project_inspections(
          company_id,project_id,required_for_operation_id,title,inspection_type,status,
          source_estimate_id,source_takeoff_measurement_id,auto_generated,result_notes
        ) values(
          e.company_id,p_project_id,v_place_op,v_inspection_title,'pre_pour','required',
          e.id,m.measurement_id,true,
          'Generated from the accepted assembly. Waive with a reason if the authority does not require this inspection.'
        );
      end if;
    end if;

    -- Accepted material/equipment/subcontractor facts become operation-level readiness requirements.
    for r in
      select
        i.id as estimate_item_id,
        i.item_type,
        i.description,
        i.quantity,
        i.unit,
        i.source_takeoff_output_id,
        o.assembly_component_id,
        c.component_key,
        c.sort_order,
        pbl.id as budget_line_id
      from public.estimate_items i
      left join public.takeoff_measurement_outputs o
        on o.id=i.source_takeoff_output_id and o.company_id=i.company_id
      left join public.concrete_assembly_components c
        on c.id=o.assembly_component_id and c.company_id=i.company_id
      left join public.project_budgets pb
        on pb.project_id=p_project_id and pb.estimate_id=e.id
       and pb.budget_type='original' and pb.status='active'
      left join public.project_budget_lines pbl
        on pbl.budget_id=pb.id and pbl.source_estimate_item_id=i.id
      where i.company_id=e.company_id
        and i.estimate_id=e.id
        and i.source_takeoff_measurement_id=m.measurement_id
        and i.item_type in ('material','equipment','subcontractor')
        and i.quantity>0
      order by coalesce(c.sort_order,i.sort_order,100),i.created_at
    loop
      v_target_op:=null;
      v_component_key:=lower(coalesce(r.component_key,''));

      if v_component_key like '%form%' then
        select wo.id into v_target_op
        from public.work_package_operations wo
        join public.production_tasks pt
          on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id
          and wo.work_package_id=v_wp
          and pt.name ilike 'Form%'
        order by wo.sequence
        limit 1;
      elsif v_component_key like '%rebar%'
         or v_component_key like '%reinforc%'
         or v_component_key like '%mesh%' then
        select wo.id into v_target_op
        from public.work_package_operations wo
        join public.production_tasks pt
          on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id
          and wo.work_package_id=v_wp
          and (pt.name ilike '%Rebar%' or pt.name ilike '%Mesh%')
        order by wo.sequence
        limit 1;
      elsif v_component_key like '%concrete%' then
        v_target_op:=v_place_op;
      elsif v_component_key like '%cure%' or v_component_key like '%seal%' then
        select wo.id into v_target_op
        from public.work_package_operations wo
        join public.production_tasks pt
          on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id
          and wo.work_package_id=v_wp
          and (pt.name ilike '%Finish%' or pt.name ilike '%Place%')
        order by case when pt.name ilike '%Finish%' then 0 else 1 end,wo.sequence
        limit 1;
      elsif v_component_key like '%nosing%' then
        select wo.id into v_target_op
        from public.work_package_operations wo
        join public.production_tasks pt
          on pt.id=wo.production_task_id and pt.company_id=wo.company_id
        where wo.company_id=e.company_id
          and wo.work_package_id=v_wp
          and pt.name ilike '%Nosing%'
        order by wo.sequence
        limit 1;
      end if;

      if v_target_op is null then
        select wo.id into v_target_op
        from public.work_package_operations wo
        left join public.concrete_assembly_components oc
          on oc.id=wo.source_assembly_component_id
        where wo.company_id=e.company_id
          and wo.work_package_id=v_wp
        order by abs(coalesce(oc.sort_order,wo.sequence)-coalesce(r.sort_order,wo.sequence)),wo.sequence
        limit 1;
      end if;

      if v_target_op is null then
        continue;
      end if;

      -- Ticket-controlled CY placement already has the stronger Pour Plan / ready-mix order gate.
      if r.item_type='material'
         and v_component_key like '%concrete%'
         and exists(
           select 1
           from public.work_package_operations x
           where x.id=v_target_op and x.measurement_method='ticket'
         ) then
        continue;
      end if;

      if not exists(
        select 1
        from public.work_package_resource_requirements rr
        where rr.company_id=e.company_id
          and rr.work_package_operation_id=v_target_op
          and rr.source_estimate_item_id=r.estimate_item_id
      ) then
        insert into public.work_package_resource_requirements(
          company_id,work_package_operation_id,resource_type,label,required_quantity,unit,
          required_before_start,source_estimate_item_id,source_takeoff_output_id,
          source_budget_line_id,auto_generated,notes
        ) values(
          e.company_id,
          v_target_op,
          case r.item_type when 'material' then 'material' when 'equipment' then 'equipment' else 'vendor' end,
          r.description,
          r.quantity,
          r.unit,
          true,
          r.estimate_item_id,
          r.source_takeoff_output_id,
          r.budget_line_id,
          true,
          'Generated from the accepted estimate. Link inventory, equipment, PO, or vendor evidence to clear readiness.'
        );
      end if;
    end loop;
  end loop;

  select
    count(distinct wp.id)::integer,
    count(distinct wo.id)::integer,
    count(distinct rr.id) filter (where rr.auto_generated)::integer,
    count(distinct pi.id) filter (where pi.auto_generated)::integer,
    count(distinct pp.id)::integer
  into v_wp_count,v_op_count,v_resource_count,v_inspection_count,v_pour_count
  from public.work_packages wp
  left join public.work_package_operations wo
    on wo.work_package_id=wp.id and wo.company_id=wp.company_id
  left join public.work_package_resource_requirements rr
    on rr.work_package_operation_id=wo.id and rr.company_id=wo.company_id
  left join public.project_inspections pi
    on pi.required_for_operation_id=wo.id and pi.company_id=wo.company_id
  left join public.pour_plans pp
    on pp.source_work_package_id=wp.id and pp.company_id=wp.company_id
  where wp.company_id=e.company_id
    and wp.project_id=p_project_id
    and wp.source_estimate_id=e.id
    and wp.source_type='takeoff';

  return jsonb_build_object(
    'work_packages',coalesce(v_wp_count,0),
    'operations',coalesce(v_op_count,0),
    'resources',coalesce(v_resource_count,0),
    'inspections',coalesce(v_inspection_count,0),
    'pour_plans',coalesce(v_pour_count,0)
  );
end;
$$;

revoke all on function public.carez_generate_awarded_operations(uuid,uuid) from public,anon,authenticated;
