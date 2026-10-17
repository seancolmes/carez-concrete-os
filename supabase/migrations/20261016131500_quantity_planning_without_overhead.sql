-- Drawing/quantity planning does not fabricate a financial overhead basis.
-- Existing snapshots and historical estimate values are retained unchanged.
set local search_path=pg_catalog,public,extensions;
alter table public.estimates alter column overhead_rate_snapshot drop not null;
alter table public.estimates alter column overhead_rate_snapshot drop default;

create function public.carez_estimate_overhead_configured(p_company uuid,p_snapshot uuid,p_rate numeric)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select p_rate is not null and p_rate::text not in ('NaN','Infinity','-Infinity') and p_rate>=0
 and exists(select 1 from public.overhead_rate_snapshots s where s.id=p_snapshot and s.company_id=p_company
  and s.source_type='configured' and s.overhead_rate_per_productive_hour=p_rate
  and s.inputs_hash is not null and s.calculation_inputs is not null);
$$;
revoke all on function public.carez_estimate_overhead_configured(uuid,uuid,numeric) from public,anon;
grant execute on function public.carez_estimate_overhead_configured(uuid,uuid,numeric) to authenticated,service_role;

create function public.carez_guard_estimate_overhead_release() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 -- A governed award consumes already-issued immutable facts. Do not rewrite or
 -- retroactively invalidate their legacy basis to satisfy a new capture format.
 if tg_op='UPDATE' and new.status='accepted' and new.id=old.id and new.company_id=old.company_id
  and (new.overhead_snapshot_id,new.overhead_rate_snapshot) is not distinct from (old.overhead_snapshot_id,old.overhead_rate_snapshot)
  and exists(select 1 from public.award_decisions a join public.commercial_baselines b on b.company_id=a.company_id and b.award_decision_id=a.id and b.estimate_id=a.estimate_id and b.proposal_revision_id=a.proposal_revision_id and b.project_id=a.project_id
   join public.proposal_presentations p on p.company_id=a.company_id and p.id=a.proposal_revision_id and p.estimate_id=a.estimate_id
   where a.company_id=new.company_id and a.estimate_id=new.id and a.project_id=new.project_id) then return new;end if;
 if new.status in ('ready','approved','accepted') and not public.carez_estimate_overhead_configured(new.company_id,new.overhead_snapshot_id,new.overhead_rate_snapshot) then
  raise exception 'Configured overhead basis required before estimate approval or release. Quantity planning remains available.';
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_estimate_overhead_release() from public,anon,authenticated;
create trigger estimate_configured_overhead_release before insert or update of status,overhead_snapshot_id,overhead_rate_snapshot on public.estimates for each row execute function public.carez_guard_estimate_overhead_release();
create function public.carez_estimate_modified_at() returns trigger language plpgsql set search_path=pg_catalog as $$begin new.updated_at:=clock_timestamp();return new;end $$;
revoke all on function public.carez_estimate_modified_at() from public,anon,authenticated;
create trigger estimate_modified_at before update on public.estimates for each row execute function public.carez_estimate_modified_at();

create or replace function public.carez_capture_company_overhead(p_company_id uuid,p_effective_date date) returns public.overhead_rate_snapshots language plpgsql security invoker set search_path=pg_catalog,public,extensions as $$
declare v_company public.companies%rowtype;v_inputs jsonb;v_hash text;v_regular numeric;v_management numeric;v_annual numeric;v_today date;v_result public.overhead_rate_snapshots%rowtype;v_invalid boolean;
begin
 if p_company_id is null or p_effective_date is null then raise exception 'Company and effective date are required.';end if;
 select * into v_company from public.companies where id=p_company_id for share;
 if not found then raise exception 'Company plan unavailable.';end if;
 v_today:=public.carez_company_calendar_date(p_company_id,clock_timestamp());
 if v_today is null then raise exception 'Company operating calendar unavailable for overhead capture.';end if;
 if not isfinite(p_effective_date) then raise exception 'Finite overhead effective date required.';end if;
 if p_effective_date<v_today then
  select * into v_result from public.overhead_rate_snapshots where company_id=p_company_id and effective_date<=p_effective_date and source_type='configured' order by effective_date desc,coalesce(captured_at,created_at) desc,id desc limit 1;
  if not found then raise exception 'Historical configured overhead basis unavailable. Current assumptions cannot be backdated automatically.';end if;return v_result;
 end if;
 if v_company.planned_productive_hours_annual is null or v_company.planned_productive_hours_annual<=0 or v_company.owner_compensation_target_annual is null or v_company.owner_planned_field_hours_annual is null or v_company.owner_field_rate is null
  or exists(select 1 from unnest(array[v_company.planned_productive_hours_annual,v_company.owner_compensation_target_annual,v_company.owner_planned_field_hours_annual,v_company.owner_field_rate]) n where n<0 or n::text in ('NaN','Infinity','-Infinity')) then raise exception 'Configure the complete business and owner plan before using overhead recovery.';end if;

 select coalesce(sum(amount*case frequency when 'weekly' then 52 when 'quarterly' then 4 when 'annual' then 1 when 'monthly' then 12 end*business_use_percent/100),0),
  coalesce(jsonb_agg(jsonb_build_object('id',id,'amount',amount,'frequency',frequency,'business_use_percent',business_use_percent) order by id),'[]'::jsonb),coalesce(bool_or(amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') or business_use_percent is null or business_use_percent not between 0 and 100 or frequency is null or frequency not in ('weekly','monthly','quarterly','annual')),false)
 into v_regular,v_inputs,v_invalid from public.overhead_items where company_id=p_company_id and active;
 if v_invalid then raise exception 'An active overhead item has missing or invalid inputs.';end if;
 v_management:=greatest(v_company.owner_compensation_target_annual-v_company.owner_planned_field_hours_annual*v_company.owner_field_rate,0);
 v_annual:=v_regular+v_management;
 v_inputs:=jsonb_build_object('method','productive_hour_v2','plan_revision',v_company.plan_revision,'owner_compensation',v_company.owner_compensation_target_annual,'owner_field_hours',v_company.owner_planned_field_hours_annual,'owner_field_rate',v_company.owner_field_rate,'productive_hours',v_company.planned_productive_hours_annual,'items',v_inputs);
 v_hash:=encode(extensions.digest(v_inputs::text,'sha256'),'hex');
 insert into public.overhead_rate_snapshots(company_id,effective_date,annual_overhead,planned_productive_hours,overhead_rate_per_productive_hour,source,source_type,source_label,notes,created_by,inputs_hash,calculation_inputs)
 values(p_company_id,v_today,round(v_annual,2),v_company.planned_productive_hours_annual,round(v_annual/v_company.planned_productive_hours_annual,4),'company_plan_v2','configured','Recorded business plan and overhead items','Immutable input version; payroll burden remains separate.',auth.uid(),v_hash,v_inputs)
 on conflict(company_id,effective_date,inputs_hash) do nothing returning * into v_result;
 if v_result.id is null then select * into v_result from public.overhead_rate_snapshots where company_id=p_company_id and effective_date=v_today and inputs_hash=v_hash;end if;
 if v_result.id is null then raise exception 'No overhead snapshot was confirmed.';end if;return v_result;
end $$;

create or replace function public.carez_open_external_job_takeoff(p_project_id uuid,p_document_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_company uuid:=public.get_my_company_id();v_project public.projects%rowtype;v_doc public.company_documents%rowtype;v_estimate uuid;v_set uuid;v_number text;v_version integer;v_oh public.overhead_rate_snapshots%rowtype;
begin
 if v_company is null or public.get_my_role() not in ('owner','office') then raise exception 'Owner or office access required.'; end if;
 select * into v_project from public.projects where id=p_project_id and company_id=v_company for update;
 if v_project.id is null or not exists(select 1 from public.project_external_intakes where company_id=v_company and project_id=v_project.id) then raise exception 'Existing external job unavailable.'; end if;
 select * into v_doc from public.company_documents where id=p_document_id and company_id=v_company and project_id=v_project.id;
 if v_doc.id is null or v_doc.document_type<>'plan' or v_doc.mime_type<>'application/pdf' or v_doc.visibility<>'job' or v_doc.revision_state<>'current' or v_doc.content_sha256 is null then raise exception 'Choose a verified current PDF plan source for this job.'; end if;
 select ts.id into v_set from public.takeoff_sets ts join public.estimates e on e.id=ts.estimate_id and e.company_id=ts.company_id where ts.company_id=v_company and e.project_id=v_project.id and ts.source_document_id=v_doc.id order by ts.created_at desc limit 1;
 if v_set is not null then return v_set; end if;
 v_number:='E-'||v_project.job_number;
 select coalesce(max(version),0)+1 into v_version from public.estimates where company_id=v_company and estimate_number=v_number;
 -- Quantity planning starts without a financial basis. This path intentionally
 -- does not read/capture overhead or promote legacy company defaults. The owner
 -- explicitly attaches a strict configured snapshot later; v_oh stays NULL.

 insert into public.estimates(company_id,project_id,estimate_number,opportunity_number,version,name,notes,overhead_snapshot_id,overhead_rate_snapshot,created_by)
 values(v_company,v_project.id,v_number,v_project.job_number,v_version,v_project.name||' · post-award plan quantities','External job planning estimate. Not the source agreement, approved budget, or accepted commercial baseline.',v_oh.id,v_oh.overhead_rate_per_productive_hour,auth.uid()) returning id into v_estimate;
 insert into public.estimate_sections(company_id,estimate_id,name,scope_type,sort_order) values(v_company,v_estimate,'Footings','footing',10),(v_company,v_estimate,'Slabs / Flatwork','flatwork',20);
 insert into public.takeoff_sets(company_id,estimate_id,name,revision_label,source_document_id,source_filename,notes,created_by)
 values(v_company,v_estimate,v_project.name,coalesce(v_doc.revision_label,'Current source'),v_doc.id,v_doc.title,'Pinned retained source. Repeated sheet labels do not establish governing scope.',auth.uid()) returning id into v_set;
 return v_set;
end $$;
revoke all on function public.carez_open_external_job_takeoff(uuid,uuid) from public,anon;
grant execute on function public.carez_open_external_job_takeoff(uuid,uuid) to authenticated;

create or replace function public.carez_get_estimate_release_readiness(p_estimate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,extensions
as $function$
declare
  v_company_id uuid := public.get_my_company_id();
  v_estimate public.estimates%rowtype;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_financial_state jsonb := '{}'::jsonb;
  v_commercial_state jsonb;
  v_warning_state jsonb := '[]'::jsonb;
  v_selected_sell numeric := 0;
  v_projected_margin numeric := 0;
  v_proposal_terms text;
  v_schedule_summary text;
  v_payment_summary text;
  v_default_terms text;
  v_customer_id uuid;
  v_customer_email text;
  v_customer_phone text;
  v_commercial_fingerprint text;
  v_warning_fingerprint text;
  v_ack public.estimate_review_acknowledgements%rowtype;
  v_latest_ack public.estimate_review_acknowledgements%rowtype;
  v_release_state text;
  v_workflow_state text;
begin
  if v_company_id is null then
    raise exception 'Company context is required.';
  end if;

  select *
  into v_estimate
  from public.estimates
  where id=p_estimate_id
    and company_id=v_company_id;

  if not found then
    raise exception 'Estimate not found.';
  end if;

  select
    jsonb_build_object(
      'selected_sell_price',summary.selected_sell_price,
      'recommended_sell_price',summary.recommended_sell_price,
      'total_direct_cost',summary.total_direct_cost,
      'direct_labor_cost',summary.direct_labor_cost,
      'material_cost',summary.material_cost,
      'equipment_cost',summary.equipment_cost,
      'subcontractor_cost',summary.subcontractor_cost,
      'other_direct_cost',summary.other_direct_cost,
      'labor_hours',summary.labor_hours,
      'overhead_cost',summary.overhead_cost,
      'base_company_cost',summary.base_company_cost,
      'revenue_cost_reserve',summary.revenue_cost_reserve,
      'projected_profit',summary.projected_profit,
      'projected_margin_percent',summary.projected_margin_percent
    ),
    coalesce(summary.selected_sell_price,0),
    coalesce(summary.projected_margin_percent,0)
  into v_financial_state,v_selected_sell,v_projected_margin
  from public.estimate_financial_summary summary
  where summary.company_id=v_company_id
    and summary.estimate_id=p_estimate_id;

  if not found then
    v_financial_state:=jsonb_build_object(
      'selected_sell_price',0,
      'recommended_sell_price',0,
      'total_direct_cost',0,
      'projected_margin_percent',0
    );
    v_selected_sell:=0;
    v_projected_margin:=0;
  end if;

  select settings.terms_text,settings.schedule_summary,settings.payment_summary
  into v_proposal_terms,v_schedule_summary,v_payment_summary
  from public.proposal_settings settings
  where settings.company_id=v_company_id
    and settings.estimate_id=p_estimate_id;

  select billing_profile.default_terms_text
  into v_default_terms
  from public.company_billing_profiles billing_profile
  where billing_profile.company_id=v_company_id;

  select customer.id,customer.email,customer.phone
  into v_customer_id,v_customer_email,v_customer_phone
  from public.leads lead
  join public.customers customer
    on customer.company_id=lead.company_id
   and customer.id=lead.customer_id
  where lead.company_id=v_company_id
    and lead.id=v_estimate.lead_id;

  with scoped_outputs as (
    select output.*
    from public.takeoff_measurement_outputs output
    join public.takeoff_measurements measurement
      on measurement.company_id=output.company_id
     and measurement.id=output.measurement_id
    where measurement.company_id=v_company_id
      and measurement.estimate_id=p_estimate_id
      and measurement.status='active'
      and output.company_id=v_company_id
      and output.is_active
      and output.estimate_visible
  ),
  findings as (
    select jsonb_build_object(
      'finding_key','customer_sell_missing',
      'severity','blocker',
      'category','commercial',
      'title','Customer Sell is missing',
      'detail','Set a positive customer Sell before release.',
      'record_id',v_estimate.id,
      'next_action','margin'
    ) as finding
    where coalesce(v_selected_sell,0)<=0

    union all

    select jsonb_build_object(
      'finding_key','scope_missing',
      'severity','blocker',
      'category','scope',
      'title','Estimate scope is missing',
      'detail','Add commercial Estimate items before release.',
      'record_id',v_estimate.id,
      'next_action','scope'
    )
    where not exists (
      select 1
      from public.estimate_items item
      where item.company_id=v_company_id
        and item.estimate_id=p_estimate_id
    )

    union all

    select jsonb_build_object(
      'finding_key','generated_price_missing:'||output.id::text,
      'severity','blocker',
      'category','pricing',
      'title','Generated price is missing',
      'detail','Price this generated non-labor output before release.',
      'record_id',output.id,
      'next_action','pricing'
    )
    from scoped_outputs output
    where output.estimate_item_type<>'labor'
      and output.pricing_status='missing_price'

    union all

    select jsonb_build_object(
      'finding_key','required_input_missing:'||output.id::text,
      'severity','blocker',
      'category','takeoff',
      'title','Required Takeoff input is missing',
      'detail','Complete the required Condition or Takeoff input before release.',
      'record_id',output.id,
      'next_action','takeoff'
    )
    from scoped_outputs output
    where output.pricing_status='missing_input'

    union all

    select jsonb_build_object(
      'finding_key','labor_assumption_missing:'||output.id::text,
      'severity','blocker',
      'category','labor',
      'title','Labor production assumption is missing',
      'detail','Set baseline or Job MH/unit before release.',
      'record_id',output.id,
      'next_action','labor'
    )
    from scoped_outputs output
    where output.estimate_item_type='labor'
      and output.job_man_hours_per_unit is null
      and output.baseline_man_hours_per_unit is null

    union all

    select jsonb_build_object(
      'finding_key','labor_rate_missing:'||output.id::text,
      'severity','blocker',
      'category','labor',
      'title','Labor rate is missing',
      'detail','Select a valid labor rate before release.',
      'record_id',output.id,
      'next_action','labor'
    )
    from scoped_outputs output
    where output.estimate_item_type='labor'
      and output.pricing_status='missing_labor_rate'

    union all

    select jsonb_build_object(
      'finding_key','manual_cost_missing:'||item.id::text,
      'severity','blocker',
      'category','pricing',
      'title','Manual Direct Cost is missing',
      'detail','Enter Direct Cost for this manual commercial line.',
      'record_id',item.id,
      'next_action','pricing'
    )
    from public.estimate_items item
    where item.company_id=v_company_id
      and item.estimate_id=p_estimate_id
      and item.source_takeoff_output_id is null
      and item.item_type<>'labor'
      and coalesce(item.quantity,0)>0
      and coalesce(item.direct_cost,0)<=0

    union all

    select jsonb_build_object(
      'finding_key','labor_classification_missing:'||item.id::text,
      'severity','blocker',
      'category','labor',
      'title','Labor classification is missing',
      'detail','Assign an active company L&I risk class to this cost-bearing labor line.',
      'record_id',item.id,
      'next_action','labor'
    )
    from public.estimate_items item
    where item.company_id=v_company_id
      and item.estimate_id=p_estimate_id
      and item.item_type='labor'
      and coalesce(item.direct_cost,0)>0
      and (
        nullif(trim(coalesce(item.risk_class_code,'')),'') is null
        or not exists (
          select 1
          from public.li_risk_classes risk
          where risk.company_id=v_company_id
            and risk.tax_year=2026
            and risk.code=trim(item.risk_class_code)
            and risk.active
        )
      )

    union all

    select jsonb_build_object(
      'finding_key','generated_lineage_missing:'||output.id::text,
      'severity','blocker',
      'category','takeoff',
      'title','Generated Estimate lineage is broken',
      'detail','Reconcile the generated Estimate item with its exact Takeoff output.',
      'record_id',output.id,
      'next_action','takeoff'
    )
    from scoped_outputs output
    left join public.estimate_items item
      on item.company_id=v_company_id
     and item.estimate_id=p_estimate_id
     and item.id=output.generated_estimate_item_id
     and item.source_takeoff_output_id=output.id
    where output.generated_estimate_item_id is null
       or item.id is null

    union all

    select jsonb_build_object(
      'finding_key','terms_missing',
      'severity','blocker',
      'category','proposal',
      'title','Proposal terms are missing',
      'detail','Add Estimate proposal terms or company default terms before release.',
      'record_id',v_estimate.id,
      'next_action','proposal_setup'
    )
    where nullif(trim(coalesce(v_proposal_terms,'')),'') is null
      and nullif(trim(coalesce(v_default_terms,'')),'') is null

    union all

    select jsonb_build_object(
      'finding_key','customer_destination_missing',
      'severity','blocker',
      'category','proposal',
      'title','Customer destination is missing',
      'detail','Link a customer with an email address or phone number before release.',
      'record_id',coalesce(v_customer_id,v_estimate.lead_id,v_estimate.id),
      'next_action','proposal_setup'
    )
    where nullif(trim(coalesce(v_customer_email,'')),'') is null
      and nullif(trim(coalesce(v_customer_phone,'')),'') is null
  )
  select coalesce(jsonb_agg(finding order by finding->>'finding_key'),'[]'::jsonb)
  into v_blockers
  from findings;

  with scoped_outputs as (
    select output.*
    from public.takeoff_measurement_outputs output
    join public.takeoff_measurements measurement
      on measurement.company_id=output.company_id
     and measurement.id=output.measurement_id
    where measurement.company_id=v_company_id
      and measurement.estimate_id=p_estimate_id
      and measurement.status='active'
      and output.company_id=v_company_id
      and output.is_active
      and output.estimate_visible
  ),
  findings as (
    select jsonb_build_object(
      'finding_key','margin_below_target',
      'severity','warning',
      'category','commercial',
      'title','Projected margin is below target',
      'detail','Review Customer Sell and margin before release.',
      'record_id',v_estimate.id,
      'next_action','margin',
      'facts',jsonb_build_object(
        'projected_margin_percent',v_projected_margin,
        'target_margin_percent',v_estimate.target_margin_percent,
        'selected_sell_price',v_selected_sell
      )
    ) as finding
    where coalesce(v_selected_sell,0)>0
      and coalesce(v_projected_margin,0)<coalesce(v_estimate.target_margin_percent,0)

    union all

    select jsonb_build_object(
      'finding_key','manual_price_override:'||output.id::text,
      'severity','warning',
      'category','pricing',
      'title','Manual price override is active',
      'detail','Review this deliberate generated-output price decision.',
      'record_id',output.id,
      'next_action','pricing',
      'facts',jsonb_build_object(
        'price_source_kind',output.price_source_kind,
        'price_source_id',output.price_source_id,
        'unit_cost',output.unit_cost,
        'direct_cost',output.direct_cost
      )
    )
    from scoped_outputs output
    where output.price_source_kind='manual_override'
       or output.pricing_status='manual_override'

    union all

    select jsonb_build_object(
      'finding_key','labor_job_override:'||output.id::text,
      'severity','warning',
      'category','labor',
      'title','Job MH/unit override is active',
      'detail','Review this Estimate-specific labor production assumption.',
      'record_id',output.id,
      'next_action','labor',
      'facts',jsonb_build_object(
        'job_man_hours_per_unit',output.job_man_hours_per_unit,
        'baseline_man_hours_per_unit',output.baseline_man_hours_per_unit,
        'production_quantity',output.production_quantity
      )
    )
    from scoped_outputs output
    where output.estimate_item_type='labor'
      and output.job_man_hours_per_unit is not null

    union all

    select jsonb_build_object(
      'finding_key','labor_rate_selection:'||output.id::text,
      'severity','warning',
      'category','labor',
      'title','Estimate labor rate selection is active',
      'detail','Review this Estimate-specific labor rate selection.',
      'record_id',output.id,
      'next_action','labor',
      'facts',jsonb_build_object(
        'price_source_kind',output.price_source_kind,
        'price_source_id',output.price_source_id,
        'unit_cost',output.unit_cost,
        'labor_rate_override_at',output.labor_rate_override_at
      )
    )
    from scoped_outputs output
    where output.estimate_item_type='labor'
      and output.labor_rate_override_at is not null

    union all

    select jsonb_build_object(
      'finding_key','supplier_quote_expired:'||expired.quote_id::text,
      'severity','warning',
      'category','pricing',
      'title','Selected supplier quote is expired',
      'detail','Review or replace the expired selected supplier quote.',
      'record_id',expired.quote_id,
      'next_action','pricing',
      'facts',jsonb_build_object(
        'quote_id',expired.quote_id,
        'expires_at',expired.expires_at,
        'source_takeoff_output_ids',expired.output_ids
      )
    )
    from (
      select quote.id as quote_id,quote.expires_at,
        jsonb_agg(output.id order by output.id) as output_ids
      from scoped_outputs output
      join public.estimate_supplier_quote_lines quote_line
        on quote_line.company_id=v_company_id
       and quote_line.id=output.price_source_id
      join public.estimate_supplier_quotes quote
        on quote.company_id=quote_line.company_id
       and quote.id=quote_line.quote_id
      join public.estimate_supplier_quote_sets quote_set
        on quote_set.company_id=quote.company_id
       and quote_set.id=quote.quote_set_id
       and quote_set.estimate_id=p_estimate_id
      where output.price_source_kind='supplier_quote'
        and quote.expires_at is not null
        and quote.expires_at<current_date
      group by quote.id,quote.expires_at
    ) expired

    union all

    select jsonb_build_object(
      'finding_key','supplier_quote_available:'||output.id::text,
      'severity','warning',
      'category','pricing',
      'title','Supplier quote is available',
      'detail','A current supplier quote is available for this output but is not selected.',
      'record_id',output.id,
      'next_action','pricing',
      'facts',jsonb_build_object(
        'available_quote_line_ids',available.line_ids,
        'available_quote_count',available.quote_count
      )
    )
    from scoped_outputs output
    join lateral (
      select
        jsonb_agg(quote_line.id order by quote.expires_at nulls last,quote.id,quote_line.id) as line_ids,
        count(*)::integer as quote_count
      from public.estimate_supplier_quote_lines quote_line
      join public.estimate_supplier_quotes quote
        on quote.company_id=quote_line.company_id
       and quote.id=quote_line.quote_id
      join public.estimate_supplier_quote_sets quote_set
        on quote_set.company_id=quote.company_id
       and quote_set.id=quote.quote_set_id
      where quote_line.company_id=v_company_id
        and quote_line.source_takeoff_output_id=output.id
        and quote_set.estimate_id=p_estimate_id
        and quote.status in ('received','selected')
        and (quote.expires_at is null or quote.expires_at>=current_date)
        and quote_line.id is distinct from output.price_source_id
    ) available on available.quote_count>0
    where coalesce(output.price_source_kind,'')<>'supplier_quote'

    union all

    select jsonb_build_object(
      'finding_key','scope_unassigned:'||item.id::text,
      'severity','warning',
      'category','scope',
      'title','Scope line is unassigned',
      'detail','Assign this commercial line to an Estimate section or deliberately review it as general scope.',
      'record_id',item.id,
      'next_action','scope',
      'facts',jsonb_build_object(
        'item_type',item.item_type,
        'quantity',item.quantity,
        'direct_cost',item.direct_cost,
        'source_takeoff_output_id',item.source_takeoff_output_id
      )
    )
    from public.estimate_items item
    where item.company_id=v_company_id
      and item.estimate_id=p_estimate_id
      and item.section_id is null

    union all

    select jsonb_build_object(
      'finding_key','proposal_schedule_missing',
      'severity','warning',
      'category','proposal',
      'title','Proposal schedule summary is missing',
      'detail','Review the proposal schedule before release.',
      'record_id',v_estimate.id,
      'next_action','proposal_setup'
    )
    where nullif(trim(coalesce(v_schedule_summary,'')),'') is null

    union all
    select jsonb_build_object(
      'finding_key','proposal_payment_missing',
      'severity','warning',
      'category','proposal',
      'title','Proposal payment summary is missing',
      'detail','Review the proposal payment summary before release.',
      'record_id',v_estimate.id,
      'next_action','proposal_setup'
    )
    where nullif(trim(coalesce(v_payment_summary,'')),'') is null
  )
  select coalesce(jsonb_agg(finding order by finding->>'finding_key'),'[]'::jsonb)
  into v_warnings
  from findings;

  if not public.carez_estimate_overhead_configured(v_company_id,v_estimate.overhead_snapshot_id,v_estimate.overhead_rate_snapshot) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'finding_key','overhead_basis_unconfigured','severity','blocker','category','pricing',
      'title','Configured overhead basis is missing',
      'detail','Quantity planning remains available. Configure the company plan, then explicitly attach its immutable overhead basis to this editable estimate. Missing overhead is not a configured zero.',
      'record_id',v_estimate.id,'next_action','overhead'));
  end if;

  -- Canonical release state excludes volatile timestamps and display-only labels.
  v_commercial_state:=jsonb_build_object(
    'estimate',jsonb_build_object(
      'id',v_estimate.id,
      'version',v_estimate.version,
      'status',v_estimate.status,
      'target_margin_percent',v_estimate.target_margin_percent,
      'proposed_sell_price',v_estimate.proposed_sell_price,
      'bo_classification',v_estimate.bo_classification,
      'bo_rate_percent',v_estimate.bo_rate_percent,
      'payment_processing_rate_percent',v_estimate.payment_processing_rate_percent,
      'overhead_rate_snapshot',v_estimate.overhead_rate_snapshot,
      'overhead_snapshot_id',v_estimate.overhead_snapshot_id,
      'overhead_inputs_hash',(select inputs_hash from public.overhead_rate_snapshots where company_id=v_company_id and id=v_estimate.overhead_snapshot_id),
      'lead_id',v_estimate.lead_id
    ),
    'financial_summary',v_financial_state,
    'sections',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',section.id,
          'name',section.name,
          'scope_type',section.scope_type,
          'sort_order',section.sort_order
        )
        order by section.sort_order,section.id
      )
      from public.estimate_sections section
      where section.company_id=v_company_id
        and section.estimate_id=p_estimate_id
    ),'[]'::jsonb),
    'items',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',item.id,
          'section_id',item.section_id,
          'item_type',item.item_type,
          'description',item.description,
          'quantity',item.quantity,
          'unit',item.unit,
          'unit_cost',item.unit_cost,
          'direct_cost',item.direct_cost,
          'risk_class_code',item.risk_class_code,
          'source_takeoff_output_id',item.source_takeoff_output_id,
          'source_takeoff_measurement_id',item.source_takeoff_measurement_id,
          'production_quantity',item.production_quantity,
          'production_unit',item.production_unit,
          'baseline_man_hours_per_unit',item.baseline_man_hours_per_unit,
          'job_man_hours_per_unit',item.job_man_hours_per_unit,
          'price_source_kind',item.price_source_kind,
          'price_source_id',item.price_source_id,
          'price_source_reference',item.price_source_reference,
          'price_effective_date',item.price_effective_date,
          'labor_rate_override_at',item.labor_rate_override_at,
          'sort_order',item.sort_order
        )
        order by item.sort_order,item.id
      )
      from public.estimate_items item
      where item.company_id=v_company_id
        and item.estimate_id=p_estimate_id
    ),'[]'::jsonb),
    'measurements',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',measurement.id,
          'estimate_section_id',measurement.estimate_section_id,
          'assembly_version_id',measurement.assembly_version_id,
          'measurement_type',measurement.measurement_type,
          'raw_quantity',measurement.raw_quantity,
          'raw_unit',measurement.raw_unit,
          'variables',measurement.variables,
          'risk_class_code',measurement.risk_class_code
        )
        order by measurement.created_at,measurement.id
      )
      from public.takeoff_measurements measurement
      where measurement.company_id=v_company_id
        and measurement.estimate_id=p_estimate_id
        and measurement.status='active'
    ),'[]'::jsonb),
    'outputs',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',output.id,
          'measurement_id',output.measurement_id,
          'component_key',output.component_key,
          'estimate_item_type',output.estimate_item_type,
          'production_quantity',output.production_quantity,
          'production_unit',output.production_unit,
          'estimated_man_hours',output.estimated_man_hours,
          'baseline_man_hours_per_unit',output.baseline_man_hours_per_unit,
          'job_man_hours_per_unit',output.job_man_hours_per_unit,
          'unit_cost',output.unit_cost,
          'direct_cost',output.direct_cost,
          'pricing_status',output.pricing_status,
          'generated_estimate_item_id',output.generated_estimate_item_id,
          'price_source_kind',output.price_source_kind,
          'price_source_id',output.price_source_id,
          'price_source_reference',output.price_source_reference,
          'price_effective_date',output.price_effective_date,
          'labor_rate_override_at',output.labor_rate_override_at
        )
        order by output.measurement_id,output.component_key,output.id
      )
      from public.takeoff_measurement_outputs output
      join public.takeoff_measurements measurement
        on measurement.company_id=output.company_id
       and measurement.id=output.measurement_id
      where measurement.company_id=v_company_id
        and measurement.estimate_id=p_estimate_id
        and measurement.status='active'
        and output.company_id=v_company_id
        and output.is_active
        and output.estimate_visible
    ),'[]'::jsonb),
    'proposal_release_facts',jsonb_build_object(
      'terms_text',coalesce(nullif(trim(v_proposal_terms),''),nullif(trim(v_default_terms),'')),
      'schedule_summary',nullif(trim(v_schedule_summary),''),
      'payment_summary',nullif(trim(v_payment_summary),''),
      'customer_id',v_customer_id,
      'customer_email',nullif(trim(v_customer_email),''),
      'customer_phone',nullif(trim(v_customer_phone),'')
    )
  );

  v_commercial_fingerprint:=
    encode(
      extensions.digest(convert_to(v_commercial_state::text,'UTF8'),'sha256'),
      'hex'
    );

  select coalesce(jsonb_agg(warning order by warning->>'finding_key'),'[]'::jsonb)
  into v_warning_state
  from jsonb_array_elements(v_warnings) warning;

  v_warning_fingerprint:=
    encode(
      extensions.digest(convert_to(v_warning_state::text,'UTF8'),'sha256'),
      'hex'
    );

  select *
  into v_latest_ack
  from public.estimate_review_acknowledgements
  where company_id=v_company_id
    and estimate_id=p_estimate_id
  order by acknowledged_at desc,id desc
  limit 1;

  select *
  into v_ack
  from public.estimate_review_acknowledgements
  where company_id=v_company_id
    and estimate_id=p_estimate_id
    and commercial_fingerprint=v_commercial_fingerprint
    and warning_fingerprint=v_warning_fingerprint
  order by acknowledged_at desc,id desc
  limit 1;

  v_workflow_state:=
    case
      when exists (
        select 1
        from public.proposal_presentations presentation
        where presentation.company_id=v_company_id
          and presentation.estimate_id=p_estimate_id
      )
        or v_estimate.status in ('accepted','approved','superseded')
        then 'locked'
      when v_estimate.status='ready' then 'review'
      else 'not_ready'
    end;

  v_release_state:=
    case
      when v_workflow_state='not_ready' then 'not_ready'
      when v_workflow_state='locked' then 'not_ready'
      when jsonb_array_length(v_blockers)>0 then 'blocked'
      when jsonb_array_length(v_warnings)>0 and v_ack.id is null then 'review'
      else 'release_ready'
    end;

  return jsonb_build_object(
    'estimate_id',v_estimate.id,
    'workflow_state',v_workflow_state,
    'release_state',v_release_state,
    'blocker_count',jsonb_array_length(v_blockers),
    'warning_count',jsonb_array_length(v_warnings),
    'blockers',v_blockers,
    'warnings',v_warnings,
    'commercial_fingerprint',v_commercial_fingerprint,
    'warning_fingerprint',v_warning_fingerprint,
    'acknowledgement_valid',v_ack.id is not null,
    'acknowledgement_id',v_ack.id,
    'acknowledged_at',v_ack.acknowledged_at,
    'acknowledged_by',v_ack.acknowledged_by,
    'latest_acknowledgement_id',v_latest_ack.id,
    'latest_acknowledged_at',v_latest_ack.acknowledged_at
  );
end;
$function$;

revoke all on function public.carez_get_estimate_release_readiness(uuid) from public,anon;
grant execute on function public.carez_get_estimate_release_readiness(uuid) to authenticated,service_role;

create function public.carez_attach_estimate_overhead(p_request_id uuid,p_estimate_id uuid,p_expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb;company uuid;e public.estimates%rowtype;s public.overhead_rate_snapshots%rowtype;day date;
begin
 request:=public.carez_financial_request_begin(p_request_id,'estimate_attach_overhead',jsonb_build_object('actor_id',auth.uid(),'estimate_id',p_estimate_id,'expected_updated_at',p_expected_updated_at));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 select * into e from public.estimates where company_id=company and id=p_estimate_id for update;
 if not found then raise exception 'Estimate unavailable.';end if;
 if p_expected_updated_at is null or e.updated_at is distinct from p_expected_updated_at then raise exception 'Estimate changed; reload before attaching overhead.';end if;
 if e.status not in ('draft','ready') or exists(select 1 from public.proposal_presentations where company_id=company and estimate_id=e.id) then raise exception 'Issued or locked estimates cannot change their overhead basis. Create a new revision.';end if;
 day:=public.carez_company_calendar_date(company,clock_timestamp());if day is null then raise exception 'Company operating calendar unavailable.';end if;
 s:=public.carez_capture_company_overhead(company,day);
 if not public.carez_estimate_overhead_configured(company,s.id,s.overhead_rate_per_productive_hour) then raise exception 'Configured overhead basis unavailable.';end if;
 update public.estimates set overhead_snapshot_id=s.id,overhead_rate_snapshot=s.overhead_rate_per_productive_hour,updated_at=clock_timestamp() where company_id=company and id=e.id;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',e.id,'snapshot_id',s.id,'rate',s.overhead_rate_per_productive_hour,'previous_snapshot_id',e.overhead_snapshot_id,'previous_rate',e.overhead_rate_snapshot));
end $$;
revoke all on function public.carez_attach_estimate_overhead(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.carez_attach_estimate_overhead(uuid,uuid,timestamptz) to authenticated;
