-- Carez OS: every proposal revision receives its own immutable takeoff snapshot.
-- This preserves one-to-one output -> estimate item lineage without weakening atomic takeoff constraints.

create or replace function public.create_estimate_revision(p_estimate_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.estimates%rowtype;
  s public.estimate_sections%rowtype;
  ts public.takeoff_sets%rowtype;
  sh public.takeoff_sheets%rowtype;
  tm public.takeoff_measurements%rowtype;
  mo public.takeoff_measurement_outputs%rowtype;
  v_company uuid;
  v_new_estimate uuid;
  v_new_section uuid;
  v_new_set uuid;
  v_new_sheet uuid;
  v_new_measurement uuid;
  v_new_output uuid;
  v_new_version integer;
  v_section_map jsonb:='{}'::jsonb;
  v_set_map jsonb:='{}'::jsonb;
  v_sheet_map jsonb:='{}'::jsonb;
  v_measurement_map jsonb:='{}'::jsonb;
  v_output_map jsonb:='{}'::jsonb;
begin
  v_company:=public.get_my_company_id();
  if auth.uid() is null or v_company is null or public.get_my_role()='employee' then
    raise exception 'Owner access required';
  end if;

  select * into e
  from public.estimates
  where id=p_estimate_id and company_id=v_company
  for update;

  if not found then raise exception 'Estimate not found'; end if;
  if e.status in ('accepted','approved','superseded') then
    raise exception 'This estimate revision cannot be revised';
  end if;

  select coalesce(max(version),0)+1 into v_new_version
  from public.estimates
  where company_id=e.company_id and estimate_number=e.estimate_number;

  insert into public.estimates(
    company_id,project_id,estimate_number,name,status,version,expected_start_date,
    target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent,
    overhead_snapshot_id,overhead_rate_snapshot,proposed_sell_price,notes,created_by,
    lead_id,opportunity_number
  ) values(
    e.company_id,e.project_id,e.estimate_number,e.name,'draft',v_new_version,e.expected_start_date,
    e.target_margin_percent,e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,
    e.overhead_snapshot_id,e.overhead_rate_snapshot,e.proposed_sell_price,e.notes,auth.uid(),
    e.lead_id,e.opportunity_number
  ) returning id into v_new_estimate;

  -- Clone estimate sections first so the new takeoff measurements can point at the new revision's sections.
  for s in
    select * from public.estimate_sections
    where estimate_id=e.id
    order by sort_order,created_at
  loop
    insert into public.estimate_sections(
      company_id,estimate_id,name,scope_type,sort_order,notes
    ) values(
      s.company_id,v_new_estimate,s.name,s.scope_type,s.sort_order,s.notes
    ) returning id into v_new_section;

    v_section_map:=v_section_map||jsonb_build_object(s.id::text,v_new_section::text);
  end loop;

  -- Clone every takeoff set owned by this estimate plus any source set referenced by its estimate lines.
  for ts in
    select x.*
    from public.takeoff_sets x
    where x.company_id=e.company_id
      and (
        x.estimate_id=e.id
        or exists(
          select 1
          from public.takeoff_measurements sm
          join public.estimate_items si
            on si.source_takeoff_measurement_id=sm.id
           and si.company_id=sm.company_id
          where sm.takeoff_set_id=x.id
            and si.estimate_id=e.id
            and si.company_id=e.company_id
        )
      )
    order by x.created_at,x.id
  loop
    insert into public.takeoff_sets(
      company_id,estimate_id,name,revision_label,status,source_document_id,
      source_filename,page_count,notes,created_by
    ) values(
      ts.company_id,v_new_estimate,ts.name,ts.revision_label,ts.status,ts.source_document_id,
      ts.source_filename,ts.page_count,ts.notes,auth.uid()
    ) returning id into v_new_set;

    v_set_map:=v_set_map||jsonb_build_object(ts.id::text,v_new_set::text);

    for sh in
      select * from public.takeoff_sheets
      where company_id=e.company_id and takeoff_set_id=ts.id
      order by sort_order,page_number
    loop
      insert into public.takeoff_sheets(
        company_id,takeoff_set_id,page_number,sheet_number,title,page_width,page_height,
        scale_status,calibration,sort_order
      ) values(
        sh.company_id,v_new_set,sh.page_number,sh.sheet_number,sh.title,sh.page_width,sh.page_height,
        sh.scale_status,sh.calibration,sh.sort_order
      ) returning id into v_new_sheet;

      v_sheet_map:=v_sheet_map||jsonb_build_object(sh.id::text,v_new_sheet::text);
    end loop;

    for tm in
      select * from public.takeoff_measurements
      where company_id=e.company_id and takeoff_set_id=ts.id
      order by created_at,id
    loop
      v_new_section:=null;

      -- Prefer the section used by the current estimate revision for this source measurement.
      select (v_section_map->>si.section_id::text)::uuid
      into v_new_section
      from public.estimate_items si
      where si.company_id=e.company_id
        and si.estimate_id=e.id
        and si.source_takeoff_measurement_id=tm.id
        and si.section_id is not null
        and v_section_map ? si.section_id::text
      order by si.sort_order,si.created_at
      limit 1;

      if v_new_section is null
         and tm.estimate_section_id is not null
         and v_section_map ? tm.estimate_section_id::text then
        v_new_section:=(v_section_map->>tm.estimate_section_id::text)::uuid;
      end if;

      insert into public.takeoff_measurements(
        company_id,takeoff_set_id,sheet_id,estimate_id,estimate_section_id,assembly_version_id,
        name,location,drawing_reference,measurement_type,raw_quantity,raw_unit,geometry,variables,
        status,source,created_by,risk_class_code
      ) values(
        tm.company_id,v_new_set,
        case when tm.sheet_id is null then null else (v_sheet_map->>tm.sheet_id::text)::uuid end,
        v_new_estimate,v_new_section,tm.assembly_version_id,
        tm.name,tm.location,tm.drawing_reference,tm.measurement_type,tm.raw_quantity,tm.raw_unit,
        tm.geometry,tm.variables,tm.status,tm.source,auth.uid(),tm.risk_class_code
      ) returning id into v_new_measurement;

      v_measurement_map:=v_measurement_map||jsonb_build_object(tm.id::text,v_new_measurement::text);

      for mo in
        select * from public.takeoff_measurement_outputs
        where company_id=e.company_id and measurement_id=tm.id
        order by created_at,id
      loop
        insert into public.takeoff_measurement_outputs(
          company_id,measurement_id,assembly_component_id,component_key,label,estimate_item_type,
          cost_code_id,catalog_item_id,production_task_id,production_quantity,production_unit,
          estimated_man_hours,baseline_man_hours_per_unit,baseline_source,unit_cost,cost_source,
          direct_cost,pricing_status,formula_trace,generated_estimate_item_id
        ) values(
          mo.company_id,v_new_measurement,mo.assembly_component_id,mo.component_key,mo.label,mo.estimate_item_type,
          mo.cost_code_id,mo.catalog_item_id,mo.production_task_id,mo.production_quantity,mo.production_unit,
          mo.estimated_man_hours,mo.baseline_man_hours_per_unit,mo.baseline_source,mo.unit_cost,mo.cost_source,
          mo.direct_cost,mo.pricing_status,mo.formula_trace,null
        ) returning id into v_new_output;

        v_output_map:=v_output_map||jsonb_build_object(mo.id::text,v_new_output::text);
      end loop;
    end loop;
  end loop;

  -- Copy estimate lines only after the new takeoff snapshot exists, remapping all one-to-one source IDs.
  insert into public.estimate_items(
    company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,crew_member_id,
    labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,
    regular_hours,overtime_hours,base_hourly_rate_snapshot,social_security_rate_snapshot,
    medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,
    sick_leave_accrual_rate_snapshot,notes,sort_order,source_takeoff_output_id,
    source_takeoff_measurement_id,source_assembly_version_id,production_task_id,
    production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source
  )
  select
    i.company_id,
    v_new_estimate,
    case when i.section_id is null then null else (v_section_map->>i.section_id::text)::uuid end,
    i.item_type,i.cost_code_id,i.catalog_item_id,i.crew_member_id,
    i.labor_task,i.risk_class_code,i.description,i.quantity,i.unit,i.unit_cost,i.direct_cost,
    i.regular_hours,i.overtime_hours,i.base_hourly_rate_snapshot,i.social_security_rate_snapshot,
    i.medicare_rate_snapshot,i.futa_rate_snapshot,i.wa_sui_rate_snapshot,i.li_employer_rate_snapshot,
    i.sick_leave_accrual_rate_snapshot,i.notes,i.sort_order,
    case
      when i.source_takeoff_output_id is null then null
      when v_output_map ? i.source_takeoff_output_id::text then (v_output_map->>i.source_takeoff_output_id::text)::uuid
      else null
    end,
    case
      when i.source_takeoff_measurement_id is null then null
      when v_measurement_map ? i.source_takeoff_measurement_id::text then (v_measurement_map->>i.source_takeoff_measurement_id::text)::uuid
      else null
    end,
    i.source_assembly_version_id,i.production_task_id,i.production_quantity,i.production_unit,
    i.baseline_man_hours_per_unit,i.baseline_source
  from public.estimate_items i
  where i.estimate_id=e.id
  order by i.sort_order,i.created_at;

  -- Restore the output -> generated estimate item pointer inside the cloned revision.
  update public.takeoff_measurement_outputs o
  set generated_estimate_item_id=i.id,
      updated_at=now()
  from public.estimate_items i
  where i.estimate_id=v_new_estimate
    and i.source_takeoff_output_id=o.id
    and o.company_id=e.company_id;

  insert into public.proposal_settings(
    company_id,estimate_id,audience_type,executive_summary,customer_message,schedule_summary,
    payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,
    validity_days,created_by
  )
  select
    company_id,v_new_estimate,audience_type,executive_summary,customer_message,schedule_summary,
    payment_summary,warranty_summary,why_carez,pricing_note,terms_text,show_quantities,
    validity_days,auth.uid()
  from public.proposal_settings
  where estimate_id=e.id;

  insert into public.proposal_clarifications(
    company_id,estimate_id,category,clarification_text,published,sort_order,created_by
  )
  select
    company_id,v_new_estimate,category,clarification_text,published,sort_order,auth.uid()
  from public.proposal_clarifications
  where estimate_id=e.id
  order by sort_order,created_at;

  if e.lead_id is not null then
    insert into public.bid_value_options(
      company_id,lead_id,estimate_id,name,customer_description,sell_price_change,
      company_cost_change,schedule_days_change,function_quality_note,approval_required,
      status,created_by
    )
    select
      company_id,lead_id,v_new_estimate,name,customer_description,sell_price_change,
      company_cost_change,schedule_days_change,function_quality_note,approval_required,
      'suggested',auth.uid()
    from public.bid_value_options
    where estimate_id=e.id and status<>'withdrawn'
    order by created_at;
  end if;

  update public.proposal_access_tokens
  set revoked_at=coalesce(revoked_at,now())
  where estimate_id=e.id and revoked_at is null;

  update public.proposal_presentations
  set status=case when status='accepted' then status else 'superseded' end,
      updated_at=now()
  where estimate_id=e.id;

  update public.estimates
  set status='superseded',updated_at=now()
  where id=e.id;

  return v_new_estimate;
end;
$$;

revoke all on function public.create_estimate_revision(uuid) from public,anon;
grant execute on function public.create_estimate_revision(uuid) to authenticated;
