-- Carez OS: revised proposal estimates must keep the takeoff/production lineage needed for award-to-field automation.

create or replace function public.create_estimate_revision(p_estimate_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.estimates%rowtype;
  s public.estimate_sections%rowtype;
  v_company uuid;
  v_new_estimate uuid;
  v_new_section uuid;
  v_new_version integer;
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

  for s in
    select *
    from public.estimate_sections
    where estimate_id=e.id
    order by sort_order,created_at
  loop
    insert into public.estimate_sections(
      company_id,estimate_id,name,scope_type,sort_order,notes
    ) values(
      s.company_id,v_new_estimate,s.name,s.scope_type,s.sort_order,s.notes
    ) returning id into v_new_section;

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
      company_id,v_new_estimate,v_new_section,item_type,cost_code_id,catalog_item_id,crew_member_id,
      labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,
      regular_hours,overtime_hours,base_hourly_rate_snapshot,social_security_rate_snapshot,
      medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,
      sick_leave_accrual_rate_snapshot,notes,sort_order,source_takeoff_output_id,
      source_takeoff_measurement_id,source_assembly_version_id,production_task_id,
      production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source
    from public.estimate_items
    where estimate_id=e.id and section_id=s.id
    order by sort_order,created_at;
  end loop;

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
    company_id,v_new_estimate,null,item_type,cost_code_id,catalog_item_id,crew_member_id,
    labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,
    regular_hours,overtime_hours,base_hourly_rate_snapshot,social_security_rate_snapshot,
    medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,li_employer_rate_snapshot,
    sick_leave_accrual_rate_snapshot,notes,sort_order,source_takeoff_output_id,
    source_takeoff_measurement_id,source_assembly_version_id,production_task_id,
    production_quantity,production_unit,baseline_man_hours_per_unit,baseline_source
  from public.estimate_items
  where estimate_id=e.id and section_id is null
  order by sort_order,created_at;

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
