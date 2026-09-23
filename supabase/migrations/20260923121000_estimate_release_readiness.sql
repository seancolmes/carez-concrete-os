-- P1.4 server-authoritative Estimate release readiness and deterministic fingerprints.
-- Current findings are derived; only explicit human acknowledgement evidence is persisted.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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
