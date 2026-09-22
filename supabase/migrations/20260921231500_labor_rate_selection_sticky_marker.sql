-- P1.3 follow-up: explicit labor-rate selections stay sticky even if the selecting actor is later removed.

CREATE OR REPLACE FUNCTION public.carez_sync_takeoff_measurement_outputs(p_measurement_id uuid, p_outputs jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_measurement public.takeoff_measurements%rowtype;
  v_payload jsonb;
  v_component public.concrete_assembly_components%rowtype;
  v_output public.takeoff_measurement_outputs%rowtype;
  v_item_id uuid;
  v_expected integer;
  v_actual integer;
  v_path text;
  v_active boolean;
  v_visible boolean;
  v_behavior text;
  v_qty numeric;
  v_hours numeric;
  v_baseline_man_hours_per_unit numeric;
  v_job_man_hours_per_unit numeric;
  v_labor_assumption_override_by uuid;
  v_labor_assumption_override_at timestamptz;
  v_labor_rate_override_by uuid;
  v_labor_rate_override_at timestamptz;
  v_unit_cost numeric;
  v_direct numeric;
  v_cost_source text;
  v_status text;
  v_price_source_kind text;
  v_price_source_id uuid;
  v_price_source_label text;
  v_price_source_reference text;
  v_price_effective_date date;
  v_price_override_by uuid;
  v_price_override_at timestamptz;
  v_sort integer:=100;
begin
  if v_company is null or not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role<>'employee') then
    raise exception 'Owner access required.';
  end if;

  select * into v_measurement
  from public.takeoff_measurements
  where id=p_measurement_id and company_id=v_company
  for update;
  if not found then raise exception 'Takeoff measurement not found.'; end if;

  if jsonb_typeof(coalesce(p_outputs,'[]'::jsonb))<>'array' then
    raise exception 'Assembly outputs must be an array.';
  end if;

  select count(*) into v_expected
  from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id);
  select count(distinct value->>'component_key') into v_actual
  from jsonb_array_elements(p_outputs);
  if v_expected=0 or jsonb_array_length(p_outputs)<>v_expected or v_actual<>v_expected then
    raise exception 'Assembly output set is incomplete or contains duplicate component paths.';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_outputs) p(value)
    where not exists(
      select 1
      from public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f
      where f.component_id=nullif(p.value->>'assembly_component_id','')::uuid
        and f.component_path_key=p.value->>'component_key'
    )
  ) then
    raise exception 'Assembly output component path does not belong to the takeoff assembly.';
  end if;

  for v_payload in select value from jsonb_array_elements(p_outputs) loop
    v_path:=v_payload->>'component_key';
    select c.* into v_component
    from public.concrete_assembly_components c
    join public.carez_assembly_component_paths(v_company,v_measurement.assembly_version_id) f on f.component_id=c.id
    where c.company_id=v_company
      and f.component_path_key=v_path
      and c.id=nullif(v_payload->>'assembly_component_id','')::uuid
    limit 1;
    if v_component.id is null then raise exception 'Output component path does not belong to the takeoff assembly.'; end if;

    v_active:=coalesce(nullif(v_payload->>'is_active','')::boolean,true);
    v_visible:=coalesce(nullif(v_payload->>'estimate_visible','')::boolean,v_component.estimate_visible,true);
    v_behavior:=coalesce(
      nullif(v_payload->>'resource_behavior',''),
      nullif(v_component.resource_behavior,''),
      case v_component.estimate_item_type
        when 'labor' then 'labor'
        when 'material' then 'consumed_material'
        when 'equipment' then 'owned_equipment'
        when 'subcontractor' then 'subcontractor'
        else 'legacy_other'
      end
    );
    v_qty:=case when v_active then greatest(coalesce((v_payload->>'production_quantity')::numeric,0),0) else 0 end;
    v_baseline_man_hours_per_unit:=case when v_component.estimate_item_type='labor' then nullif(v_payload->>'baseline_man_hours_per_unit','')::numeric else null end;
    v_hours:=case when v_active then greatest(coalesce((v_payload->>'estimated_man_hours')::numeric,0),0) else 0 end;

    select * into v_output
    from public.takeoff_measurement_outputs o
    where o.company_id=v_company
      and o.measurement_id=v_measurement.id
      and o.assembly_component_id=v_component.id
      and o.component_key=v_path
    for update;

    v_job_man_hours_per_unit:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.job_man_hours_per_unit else null end;
    v_labor_assumption_override_by:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_assumption_override_by else null end;
    v_labor_assumption_override_at:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_assumption_override_at else null end;
    v_labor_rate_override_by:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_rate_override_by else null end;
    v_labor_rate_override_at:=case when v_component.estimate_item_type='labor' and v_output.id is not null then v_output.labor_rate_override_at else null end;

    if v_active and v_component.estimate_item_type='labor' and v_job_man_hours_per_unit is not null then
      v_hours:=round(v_qty*v_job_man_hours_per_unit,4);
    end if;

    if v_active and v_output.id is not null and v_output.pricing_status='manual_override' then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0);
      v_cost_source:=coalesce(v_output.cost_source,'manual_override');
      v_status:='manual_override';
      v_price_source_kind:=coalesce(v_output.price_source_kind,'manual_override');
      v_price_source_id:=v_output.price_source_id;
      v_price_source_label:=coalesce(v_output.price_source_label,'Manual estimate override');
      v_price_source_reference:=v_output.price_source_reference;
      v_price_effective_date:=v_output.price_effective_date;
      v_price_override_by:=v_output.price_override_by;
      v_price_override_at:=v_output.price_override_at;
      v_direct:=round((case when v_component.estimate_item_type='labor' then v_hours else v_qty end)*v_unit_cost,2);
    elsif v_active
       and v_component.estimate_item_type='labor'
       and v_output.id is not null
       and v_output.labor_rate_override_at is not null then
      v_unit_cost:=greatest(coalesce(v_output.unit_cost,0),0);
      v_cost_source:=coalesce(v_output.cost_source,'selected labor profile');
      v_status:=case when v_unit_cost>0 then 'priced' else 'missing_labor_rate' end;
      v_price_source_kind:=v_output.price_source_kind;
      v_price_source_id:=v_output.price_source_id;
      v_price_source_label:=v_output.price_source_label;
      v_price_source_reference:=v_output.price_source_reference;
      v_price_effective_date:=v_output.price_effective_date;
      v_price_override_by:=null;
      v_price_override_at:=null;
      v_direct:=round(v_hours*v_unit_cost,2);
    else
      v_unit_cost:=case when v_active then greatest(coalesce((v_payload->>'unit_cost')::numeric,0),0) else 0 end;
      v_cost_source:=case when v_active then nullif(v_payload->>'cost_source','') else null end;
      v_status:=case
        when coalesce(v_payload->>'pricing_status','')='missing_input' then 'missing_input'
        when v_active then coalesce(v_payload->>'pricing_status','missing_price')
        else 'not_priced'
      end;
      if v_status='priced' then
        v_price_source_kind:=nullif(v_payload->>'price_source_kind','');
        v_price_source_id:=nullif(v_payload->>'price_source_id','')::uuid;
        v_price_source_label:=nullif(v_payload->>'price_source_label','');
        v_price_source_reference:=nullif(v_payload->>'price_source_reference','');
        v_price_effective_date:=nullif(v_payload->>'price_effective_date','')::date;
      else
        v_price_source_kind:=null;
        v_price_source_id:=null;
        v_price_source_label:=null;
        v_price_source_reference:=null;
        v_price_effective_date:=null;
      end if;
      v_price_override_by:=null;
      v_price_override_at:=null;
      v_direct:=case
        when not v_active then 0
        when v_component.estimate_item_type='labor' then round(v_hours*v_unit_cost,2)
        else greatest(coalesce((v_payload->>'direct_cost')::numeric,0),0)
      end;
    end if;

    if v_output.id is null then
      insert into public.takeoff_measurement_outputs(
        company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,
        cost_code_id,catalog_item_id,production_task_id,production_quantity,production_unit,
        estimated_man_hours,baseline_man_hours_per_unit,baseline_source,
        job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,
        labor_rate_override_by,labor_rate_override_at,
        unit_cost,cost_source,
        price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,
        price_override_by,price_override_at,
        direct_cost,pricing_status,is_active,resource_behavior,estimate_visible,formula_trace
      ) values(
        v_company,v_measurement.id,v_component.id,v_path,v_component.label,v_component.estimate_item_type,
        v_component.cost_code_id,v_component.catalog_item_id,v_component.production_task_id,v_qty,v_component.output_unit,
        v_hours,v_baseline_man_hours_per_unit,v_component.baseline_source,
        v_job_man_hours_per_unit,v_labor_assumption_override_by,v_labor_assumption_override_at,
        v_labor_rate_override_by,v_labor_rate_override_at,
        v_unit_cost,v_cost_source,
        v_price_source_kind,v_price_source_id,v_price_source_label,v_price_source_reference,v_price_effective_date,
        v_price_override_by,v_price_override_at,
        v_direct,v_status,v_active,v_behavior,v_visible,coalesce(v_payload->'formula_trace','{}'::jsonb)
      ) returning * into v_output;
    else
      update public.takeoff_measurement_outputs set
        production_quantity=v_qty,
        production_unit=v_component.output_unit,
        estimated_man_hours=v_hours,
        baseline_man_hours_per_unit=v_baseline_man_hours_per_unit,
        baseline_source=v_component.baseline_source,
        job_man_hours_per_unit=v_job_man_hours_per_unit,
        labor_assumption_override_by=v_labor_assumption_override_by,
        labor_assumption_override_at=v_labor_assumption_override_at,
        labor_rate_override_by=v_labor_rate_override_by,
        labor_rate_override_at=v_labor_rate_override_at,
        unit_cost=v_unit_cost,
        cost_source=v_cost_source,
        price_source_kind=v_price_source_kind,
        price_source_id=v_price_source_id,
        price_source_label=v_price_source_label,
        price_source_reference=v_price_source_reference,
        price_effective_date=v_price_effective_date,
        price_override_by=v_price_override_by,
        price_override_at=v_price_override_at,
        direct_cost=v_direct,
        pricing_status=v_status,
        is_active=v_active,
        resource_behavior=v_behavior,
        estimate_visible=v_visible,
        formula_trace=coalesce(v_payload->'formula_trace','{}'::jsonb),
        updated_at=now()
      where id=v_output.id
      returning * into v_output;
    end if;

    if not v_active or not v_visible then
      delete from public.estimate_items where company_id=v_company and source_takeoff_output_id=v_output.id;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=null where id=v_output.id;
    else
      select id into v_item_id
      from public.estimate_items
      where company_id=v_company and source_takeoff_output_id=v_output.id
      for update;
      if v_item_id is null then
        insert into public.estimate_items(
          company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,labor_task,risk_class_code,
          description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order,
          source_takeoff_output_id,source_takeoff_measurement_id,source_assembly_version_id,production_task_id,
          production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source,
          job_man_hours_per_unit,labor_assumption_override_by,labor_assumption_override_at,
          labor_rate_override_by,labor_rate_override_at,
          price_source_kind,price_source_id,price_source_label,price_source_reference,price_effective_date,
          price_override_by,price_override_at
        ) values(
          v_company,v_measurement.estimate_id,v_measurement.estimate_section_id,v_component.estimate_item_type,
          v_component.cost_code_id,v_component.catalog_item_id,v_component.labor_task,
          case when v_component.estimate_item_type='labor' then v_measurement.risk_class_code else null end,
          v_measurement.name||' — '||v_path||' — '||v_component.label,
          case when v_component.estimate_item_type='labor' then v_hours else v_qty end,
          case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
          v_unit_cost,v_direct,case when v_component.estimate_item_type='labor' then v_hours else 0 end,0,
          'Generated by Takeoff / Assembly Engine. Edit the physical takeoff or component price rather than this line.',
          v_sort,v_output.id,v_measurement.id,v_measurement.assembly_version_id,v_component.production_task_id,
          v_qty,v_component.output_unit,v_baseline_man_hours_per_unit,v_component.baseline_source,
          v_job_man_hours_per_unit,v_labor_assumption_override_by,v_labor_assumption_override_at,
          v_labor_rate_override_by,v_labor_rate_override_at,
          v_price_source_kind,v_price_source_id,v_price_source_label,v_price_source_reference,v_price_effective_date,
          v_price_override_by,v_price_override_at
        ) returning id into v_item_id;
      else
        update public.estimate_items set
          quantity=case when v_component.estimate_item_type='labor' then v_hours else v_qty end,
          unit=case when v_component.estimate_item_type='labor' then 'HR' else v_component.output_unit end,
          unit_cost=v_unit_cost,
          direct_cost=v_direct,
          regular_hours=case when v_component.estimate_item_type='labor' then v_hours else 0 end,
          overtime_hours=0,
          production_task_id=v_component.production_task_id,
          production_quantity=v_qty,
          production_unit=v_component.output_unit,
          baseline_man_hours_per_unit=v_baseline_man_hours_per_unit,
          baseline_source=v_component.baseline_source,
          job_man_hours_per_unit=v_job_man_hours_per_unit,
          labor_assumption_override_by=v_labor_assumption_override_by,
          labor_assumption_override_at=v_labor_assumption_override_at,
          labor_rate_override_by=v_labor_rate_override_by,
          labor_rate_override_at=v_labor_rate_override_at,
          price_source_kind=v_price_source_kind,
          price_source_id=v_price_source_id,
          price_source_label=v_price_source_label,
          price_source_reference=v_price_source_reference,
          price_effective_date=v_price_effective_date,
          price_override_by=v_price_override_by,
          price_override_at=v_price_override_at,
          updated_at=now()
        where id=v_item_id and company_id=v_company;
      end if;
      update public.takeoff_measurement_outputs set generated_estimate_item_id=v_item_id where id=v_output.id;
      v_sort:=v_sort+10;
    end if;
  end loop;
end;
$function$

