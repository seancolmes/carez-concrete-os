-- Recover missing company-scoped read models; existing canonical views remain intact.
-- No business values are inserted and no accepted baseline or invoice is rewritten.
set local search_path=pg_catalog,public,extensions;

do $recover_view$ begin if to_regclass('public.bank_reconciliation_summary') is null then
create view public."bank_reconciliation_summary" with(security_invoker=true) as  WITH best AS (
         SELECT DISTINCT ON (bank_reconciliation_candidates.bank_transaction_id) bank_reconciliation_candidates.bank_transaction_id,
            bank_reconciliation_candidates.confidence,
            bank_reconciliation_candidates.candidate_type
           FROM bank_reconciliation_candidates
          WHERE bank_reconciliation_candidates.status = 'active'::text
          ORDER BY bank_reconciliation_candidates.bank_transaction_id, bank_reconciliation_candidates.confidence DESC, bank_reconciliation_candidates.created_at DESC
        )
 SELECT t.company_id,
    count(*) FILTER (WHERE NOT t.removed)::integer AS transaction_count,
    count(*) FILTER (WHERE NOT t.removed AND t.review_status = 'matched'::text)::integer AS matched_count,
    count(*) FILTER (WHERE NOT t.removed AND t.review_status = 'ignored'::text)::integer AS ignored_count,
    count(*) FILTER (WHERE NOT t.removed AND t.review_status = 'unreviewed'::text AND NOT t.pending)::integer AS needs_review_count,
    count(*) FILTER (WHERE NOT t.removed AND t.review_status = 'unreviewed'::text AND NOT t.pending AND b.confidence >= 95)::integer AS high_confidence_count,
    count(*) FILTER (WHERE NOT t.removed AND t.review_status = 'unreviewed'::text AND NOT t.pending AND b.confidence >= 80 AND b.confidence <= 94)::integer AS suggested_count,
    count(*) FILTER (WHERE NOT t.removed AND t.pending)::integer AS pending_count
   FROM plaid_transactions t
     LEFT JOIN best b ON b.bank_transaction_id = t.id
  GROUP BY t.company_id;
end if;end $recover_view$;
revoke all on public."bank_reconciliation_summary" from public,anon,authenticated;
grant select on public."bank_reconciliation_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.bid_price_feedback_intelligence') is null then
create view public."bid_price_feedback_intelligence" with(security_invoker=true) as  SELECT id,
    company_id,
    lead_id,
    estimate_id,
    feedback_source,
    competitor_name,
    competitor_price,
    scope_comparable,
    note,
    recorded_at,
    created_by,
    created_at,
        CASE
            WHEN feedback_source = ANY (ARRAY['public_bid_tab'::text, 'direct_competitor_quote'::text]) THEN 'verified'::text
            WHEN feedback_source = ANY (ARRAY['gc_feedback'::text, 'owner_budget'::text]) THEN 'credible'::text
            WHEN feedback_source = 'customer_claim'::text THEN 'unverified'::text
            ELSE 'unknown'::text
        END AS evidence_strength,
        CASE
            WHEN competitor_price IS NULL THEN false
            WHEN scope_comparable = 'yes'::text AND (feedback_source = ANY (ARRAY['public_bid_tab'::text, 'direct_competitor_quote'::text, 'gc_feedback'::text])) THEN true
            ELSE false
        END AS safe_for_price_comparison
   FROM bid_price_feedback f;
end if;end $recover_view$;
revoke all on public."bid_price_feedback_intelligence" from public,anon,authenticated;
grant select on public."bid_price_feedback_intelligence" to authenticated;

do $recover_view$ begin if to_regclass('public.bid_pursuit_score') is null then
create view public."bid_pursuit_score" with(security_invoker=true) as  SELECT id,
    company_id,
    lead_id,
    bid_type,
    relationship_strength,
    estimated_competitor_count,
    customer_budget,
    customer_budget_source,
    project_fit_score,
    relationship_score,
    scope_clarity_score,
    capacity_score,
    margin_potential_score,
    payment_confidence_score,
    competition_score,
    risk_score,
    estimator_effort_hours,
    pursuit_decision,
    pass_reason,
    proposal_sent_at,
    last_follow_up_at,
    outcome,
    lost_reason,
    outcome_note,
    created_by,
    created_at,
    updated_at,
    round((project_fit_score * 15 + relationship_score * 15 + scope_clarity_score * 10 + capacity_score * 10 + margin_potential_score * 20 + payment_confidence_score * 10 + competition_score * 10 + risk_score * 10)::numeric / 5.0, 1) AS carez_pursuit_score,
        CASE
            WHEN ((project_fit_score * 15 + relationship_score * 15 + scope_clarity_score * 10 + capacity_score * 10 + margin_potential_score * 20 + payment_confidence_score * 10 + competition_score * 10 + risk_score * 10)::numeric / 5.0) >= 70::numeric THEN 'pursue'::text
            WHEN ((project_fit_score * 15 + relationship_score * 15 + scope_clarity_score * 10 + capacity_score * 10 + margin_potential_score * 20 + payment_confidence_score * 10 + competition_score * 10 + risk_score * 10)::numeric / 5.0) >= 55::numeric THEN 'review'::text
            ELSE 'pass'::text
        END AS carez_recommendation
   FROM lead_bid_intelligence b;
end if;end $recover_view$;
revoke all on public."bid_pursuit_score" from public,anon,authenticated;
grant select on public."bid_pursuit_score" to authenticated;

do $recover_view$ begin if to_regclass('public.company_expense_summary') is null then
create view public."company_expense_summary" with(security_invoker=true) as  SELECT c.id AS company_id,
    round(COALESCE(sum(e.business_expense_amount) FILTER (WHERE e.payment_status <> 'void'::text AND date_trunc('month'::text, e.expense_date::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)), 0::numeric), 2) AS current_month_business_expense,
    round(COALESCE(sum(e.business_expense_amount) FILTER (WHERE e.payment_status <> 'void'::text AND date_trunc('year'::text, e.expense_date::timestamp with time zone) = date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)), 0::numeric), 2) AS ytd_business_expense,
    round(COALESCE(sum(e.total_amount) FILTER (WHERE e.payment_status = 'paid'::text AND e.cash_source = 'company_account'::text AND date_trunc('month'::text, COALESCE(e.paid_date, e.expense_date)::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)), 0::numeric), 2) AS current_month_company_cash_paid,
    round(COALESCE(sum(e.total_amount) FILTER (WHERE e.payment_status = 'paid'::text AND e.cash_source = 'company_account'::text AND date_trunc('year'::text, COALESCE(e.paid_date, e.expense_date)::timestamp with time zone) = date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)), 0::numeric), 2) AS ytd_company_cash_paid,
    round(COALESCE(sum(e.total_amount) FILTER (WHERE e.payment_status = 'unpaid'::text AND e.cash_source = 'company_account'::text), 0::numeric), 2) AS unpaid_company_expense_obligations,
    count(e.id) FILTER (WHERE e.payment_status = 'unpaid'::text AND e.cash_source = 'company_account'::text)::integer AS unpaid_company_expense_count
   FROM companies c
     LEFT JOIN company_expenses e ON e.company_id = c.id
  GROUP BY c.id;
end if;end $recover_view$;
revoke all on public."company_expense_summary" from public,anon,authenticated;
grant select on public."company_expense_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.payroll_run_financial_summary') is null then
create view public."payroll_run_financial_summary" with(security_invoker=true) as  SELECT r.id AS payroll_run_id,
    r.company_id,
    r.period_start,
    r.period_end,
    r.pay_date,
    r.status,
    r.actual_cash_paid,
    r.reference_number,
    r.notes,
    r.approved_at,
    r.processed_at,
    r.voided_at,
    r.created_at,
    COALESCE(sum(l.regular_hours) FILTER (WHERE l.active), 0::numeric) AS regular_hours,
    COALESCE(sum(l.overtime_hours) FILTER (WHERE l.active), 0::numeric) AS overtime_hours,
    COALESCE(sum(l.gross_wages) FILTER (WHERE l.active), 0::numeric) AS gross_wages,
    COALESCE(sum(l.employer_social_security + l.employer_medicare + l.employer_futa + l.employer_wa_sui) FILTER (WHERE l.active), 0::numeric) AS employer_payroll_taxes,
    COALESCE(sum(l.employer_li) FILTER (WHERE l.active), 0::numeric) AS employer_li,
    COALESCE(sum(l.sick_leave_reserve) FILTER (WHERE l.active), 0::numeric) AS sick_leave_reserve,
    COALESCE(sum(l.payroll_funding_requirement) FILTER (WHERE l.active), 0::numeric) AS payroll_funding_requirement,
    count(l.id) FILTER (WHERE l.active)::integer AS timecard_count,
    count(DISTINCT l.crew_member_id) FILTER (WHERE l.active)::integer AS worker_count
   FROM payroll_runs r
     LEFT JOIN payroll_run_lines l ON l.payroll_run_id = r.id
  GROUP BY r.id;
end if;end $recover_view$;
revoke all on public."payroll_run_financial_summary" from public,anon,authenticated;
grant select on public."payroll_run_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.payroll_unprocessed_worker_summary') is null then
create view public."payroll_unprocessed_worker_summary" with(security_invoker=true) as  SELECT t.company_id,
    t.crew_member_id,
    c.name AS worker_name,
    min(t.work_date) AS first_unprocessed_date,
    max(t.work_date) AS last_unprocessed_date,
    count(*)::integer AS timecard_count,
    COALESCE(sum(t.regular_hours), 0::numeric) AS regular_hours,
    COALESCE(sum(t.overtime_hours), 0::numeric) AS overtime_hours,
    COALESCE(sum(t.gross_wage_cost), 0::numeric) AS gross_wages,
    COALESCE(sum(COALESCE(t.employer_social_security_cost, 0::numeric) + COALESCE(t.employer_medicare_cost, 0::numeric) + COALESCE(t.employer_futa_cost, 0::numeric) + COALESCE(t.employer_wa_sui_cost, 0::numeric)), 0::numeric) AS employer_payroll_taxes,
    COALESCE(sum(t.employer_li_cost), 0::numeric) AS employer_li,
    COALESCE(sum(t.sick_leave_reserve_cost), 0::numeric) AS sick_leave_reserve,
    COALESCE(sum(COALESCE(t.gross_wage_cost, 0::numeric) + COALESCE(t.employer_social_security_cost, 0::numeric) + COALESCE(t.employer_medicare_cost, 0::numeric) + COALESCE(t.employer_futa_cost, 0::numeric) + COALESCE(t.employer_wa_sui_cost, 0::numeric) + COALESCE(t.employer_li_cost, 0::numeric)), 0::numeric) AS payroll_funding_requirement
   FROM timecards t
     JOIN crew_members c ON c.id = t.crew_member_id AND c.company_id = t.company_id
  WHERE COALESCE(c.worker_type, 'employee'::text) = 'employee'::text AND COALESCE(c.is_owner, false) = false AND NOT (EXISTS ( SELECT 1
           FROM payroll_run_lines prl
          WHERE prl.timecard_id = t.id AND prl.active))
  GROUP BY t.company_id, t.crew_member_id, c.name;
end if;end $recover_view$;
revoke all on public."payroll_unprocessed_worker_summary" from public,anon,authenticated;
grant select on public."payroll_unprocessed_worker_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.plaid_bank_account_summary') is null then
create view public."plaid_bank_account_summary" with(security_invoker=true) as  SELECT a.id AS account_id,
    a.company_id,
    a.connection_id,
    c.institution_name,
    c.status AS connection_status,
    a.plaid_account_id,
    a.name,
    a.official_name,
    a.mask,
    a.account_type,
    a.account_subtype,
    a.iso_currency_code,
    a.current_balance,
    a.available_balance,
    COALESCE(a.available_balance, a.current_balance) AS cash_balance,
    a.include_in_cash,
    a.active,
    a.last_balance_at,
    c.last_accounts_sync_at,
    c.last_realtime_balance_at,
    c.last_error_code,
    c.last_error_message
   FROM plaid_accounts a
     JOIN plaid_connections c ON c.id = a.connection_id;
end if;end $recover_view$;
revoke all on public."plaid_bank_account_summary" from public,anon,authenticated;
grant select on public."plaid_bank_account_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.plaid_bank_feed_summary') is null then
create view public."plaid_bank_feed_summary" with(security_invoker=true) as  WITH connections AS (
         SELECT plaid_connections.company_id,
            count(*) FILTER (WHERE plaid_connections.status = 'active'::text)::integer AS active_connections,
            max(plaid_connections.last_transactions_sync_at) AS last_transactions_sync_at
           FROM plaid_connections
          GROUP BY plaid_connections.company_id
        ), accounts AS (
         SELECT plaid_accounts.company_id,
            count(*) FILTER (WHERE plaid_accounts.active)::integer AS linked_accounts,
            count(*) FILTER (WHERE plaid_accounts.active AND plaid_accounts.include_in_cash AND plaid_accounts.account_type = 'depository'::text)::integer AS cash_accounts,
            round(COALESCE(sum(COALESCE(plaid_accounts.available_balance, plaid_accounts.current_balance, 0::numeric)) FILTER (WHERE plaid_accounts.active AND plaid_accounts.include_in_cash AND plaid_accounts.account_type = 'depository'::text), 0::numeric), 2) AS connected_cash_balance,
            max(plaid_accounts.last_balance_at) AS last_balance_at
           FROM plaid_accounts
          GROUP BY plaid_accounts.company_id
        ), tx AS (
         SELECT plaid_transactions.company_id,
            count(*) FILTER (WHERE NOT plaid_transactions.removed AND plaid_transactions.review_status = 'unreviewed'::text)::integer AS unreviewed_transactions
           FROM plaid_transactions
          GROUP BY plaid_transactions.company_id
        )
 SELECT c.id AS company_id,
    COALESCE(cn.active_connections, 0) AS active_connections,
    COALESCE(a.linked_accounts, 0) AS linked_accounts,
    COALESCE(a.cash_accounts, 0) AS cash_accounts,
    COALESCE(a.connected_cash_balance, 0::numeric) AS connected_cash_balance,
    cn.last_transactions_sync_at,
    a.last_balance_at,
    COALESCE(t.unreviewed_transactions, 0) AS unreviewed_transactions
   FROM companies c
     LEFT JOIN connections cn ON cn.company_id = c.id
     LEFT JOIN accounts a ON a.company_id = c.id
     LEFT JOIN tx t ON t.company_id = c.id;
end if;end $recover_view$;
revoke all on public."plaid_bank_feed_summary" from public,anon,authenticated;
grant select on public."plaid_bank_feed_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.plaid_transaction_feed') is null then
create view public."plaid_transaction_feed" with(security_invoker=true) as  SELECT t.id,
    t.company_id,
    t.connection_id,
    t.account_id,
    t.plaid_transaction_id,
    t.transaction_date,
    t.authorized_date,
    t.name,
    t.merchant_name,
    t.plaid_amount,
    t.cash_amount,
    t.pending,
    t.payment_channel,
    t.category_primary,
    t.category_detailed,
    t.website,
    t.logo_url,
    t.removed,
    t.review_status,
    t.matched_entity_type,
    t.matched_entity_id,
    t.match_note,
    a.name AS account_name,
    a.mask AS account_mask,
    c.institution_name
   FROM plaid_transactions t
     LEFT JOIN plaid_accounts a ON a.id = t.account_id
     LEFT JOIN plaid_connections c ON c.id = t.connection_id;
end if;end $recover_view$;
revoke all on public."plaid_transaction_feed" from public,anon,authenticated;
grant select on public."plaid_transaction_feed" to authenticated;

do $recover_view$ begin if to_regclass('public.pour_delivery_actual_summary') is null then
create view public."pour_delivery_actual_summary" with(security_invoker=true) as  WITH concrete_lines AS (
         SELECT pol.company_id,
            pol.pour_plan_id,
            pol.id AS purchase_order_line_id,
            pol.purchase_order_id,
            COALESCE(pol.quantity, 0::numeric) AS ordered_cy
           FROM purchase_order_lines pol
             JOIN purchase_orders po ON po.id = pol.purchase_order_id AND po.company_id = pol.company_id AND (po.status = ANY (ARRAY['issued'::text, 'closed'::text]))
             JOIN cost_codes cc ON cc.id = pol.cost_code_id AND cc.company_id = pol.company_id
          WHERE pol.pour_plan_id IS NOT NULL AND cc.code = '51410'::text AND upper(COALESCE(pol.unit, ''::text)) = 'CY'::text
        ), ordered AS (
         SELECT concrete_lines.company_id,
            concrete_lines.pour_plan_id,
            COALESCE(sum(concrete_lines.ordered_cy), 0::numeric) AS ordered_cy
           FROM concrete_lines
          GROUP BY concrete_lines.company_id, concrete_lines.pour_plan_id
        ), received AS (
         SELECT cl.company_id,
            cl.pour_plan_id,
            COALESCE(sum(r_1.quantity_received), 0::numeric) AS delivered_cy,
            count(r_1.id)::integer AS ticket_count,
            min(r_1.received_date) AS first_delivery_date,
            max(r_1.received_date) AS latest_delivery_date
           FROM concrete_lines cl
             LEFT JOIN purchase_order_receipts r_1 ON r_1.purchase_order_line_id = cl.purchase_order_line_id AND r_1.company_id = cl.company_id
          GROUP BY cl.company_id, cl.pour_plan_id
        ), evidence AS (
         SELECT cl.company_id,
            cl.pour_plan_id,
            count(DISTINCT r_1.id)::integer AS ticket_photo_count
           FROM concrete_lines cl
             JOIN purchase_order_receipts r_1 ON r_1.purchase_order_line_id = cl.purchase_order_line_id AND r_1.company_id = cl.company_id
          WHERE (EXISTS ( SELECT 1
                   FROM company_documents d
                  WHERE d.purchase_order_receipt_id = r_1.id AND d.company_id = cl.company_id AND d.review_status = 'matched'::text))
          GROUP BY cl.company_id, cl.pour_plan_id
        )
 SELECT pp.company_id,
    pp.id AS pour_plan_id,
    pp.project_id,
    p.job_number,
    p.name AS project_name,
    pp.name AS pour_name,
    pp.status AS pour_status,
    pp.scheduled_date,
    COALESCE(pp.expected_concrete_yards, 0::numeric) AS planned_cy,
    COALESCE(o.ordered_cy, 0::numeric) AS ordered_cy,
    COALESCE(r.delivered_cy, 0::numeric) AS delivered_cy,
    COALESCE(r.delivered_cy, 0::numeric) - COALESCE(pp.expected_concrete_yards, 0::numeric) AS variance_to_plan_cy,
    GREATEST(COALESCE(pp.expected_concrete_yards, 0::numeric) - COALESCE(r.delivered_cy, 0::numeric), 0::numeric) AS remaining_to_plan_cy,
        CASE
            WHEN COALESCE(pp.expected_concrete_yards, 0::numeric) > 0::numeric THEN round(100::numeric * COALESCE(r.delivered_cy, 0::numeric) / pp.expected_concrete_yards, 1)
            ELSE NULL::numeric
        END AS percent_of_plan_delivered,
    COALESCE(r.ticket_count, 0) AS concrete_ticket_count,
    COALESCE(e.ticket_photo_count, 0) AS ticket_photo_count,
    GREATEST(COALESCE(r.ticket_count, 0) - COALESCE(e.ticket_photo_count, 0), 0) AS tickets_missing_photo,
    r.first_delivery_date,
    r.latest_delivery_date
   FROM pour_plans pp
     JOIN projects p ON p.id = pp.project_id AND p.company_id = pp.company_id
     LEFT JOIN ordered o ON o.company_id = pp.company_id AND o.pour_plan_id = pp.id
     LEFT JOIN received r ON r.company_id = pp.company_id AND r.pour_plan_id = pp.id
     LEFT JOIN evidence e ON e.company_id = pp.company_id AND e.pour_plan_id = pp.id;
end if;end $recover_view$;
revoke all on public."pour_delivery_actual_summary" from public,anon,authenticated;
grant select on public."pour_delivery_actual_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.purchase_order_line_financial_summary') is null then
create view public."purchase_order_line_financial_summary" with(security_invoker=true) as  WITH actual AS (
         SELECT project_costs.purchase_order_line_id,
            COALESCE(sum(project_costs.total_cost), 0::numeric) AS actual_cost
           FROM project_costs
          WHERE project_costs.purchase_order_line_id IS NOT NULL
          GROUP BY project_costs.purchase_order_line_id
        ), received AS (
         SELECT purchase_order_receipts.purchase_order_line_id,
            COALESCE(sum(purchase_order_receipts.quantity_received), 0::numeric) AS received_quantity
           FROM purchase_order_receipts
          GROUP BY purchase_order_receipts.purchase_order_line_id
        )
 SELECT l.id AS purchase_order_line_id,
    l.company_id,
    l.purchase_order_id,
    po.project_id,
    po.vendor_id,
    po.status AS po_status,
    l.cost_code_id,
    l.catalog_item_id,
    l.pour_plan_id,
    l.pour_cost_item_id,
    l.budget_section_id,
    l.change_order_id,
    l.description,
    l.quantity,
    l.unit,
    l.unit_cost,
    l.subtotal,
    l.sales_tax,
    l.total_cost,
    COALESCE(r.received_quantity, 0::numeric) AS received_quantity,
    COALESCE(a.actual_cost, 0::numeric) AS actual_cost,
        CASE
            WHEN po.status = 'issued'::text THEN GREATEST(l.total_cost - COALESCE(a.actual_cost, 0::numeric), 0::numeric)
            ELSE 0::numeric
        END AS open_commitment,
    round(COALESCE(a.actual_cost, 0::numeric) - l.total_cost, 2) AS actual_vs_po_variance
   FROM purchase_order_lines l
     JOIN purchase_orders po ON po.id = l.purchase_order_id
     LEFT JOIN actual a ON a.purchase_order_line_id = l.id
     LEFT JOIN received r ON r.purchase_order_line_id = l.id;
end if;end $recover_view$;
revoke all on public."purchase_order_line_financial_summary" from public,anon,authenticated;
grant select on public."purchase_order_line_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.vendor_bill_financial_summary') is null then
create view public."vendor_bill_financial_summary" with(security_invoker=true) as  SELECT b.id AS vendor_bill_id,
    b.company_id,
    b.project_id,
    b.vendor_id,
    b.purchase_order_id,
    b.vendor_bill_number,
    b.bill_date,
    b.due_date,
    b.status,
    b.notes,
    b.posted_at,
    v.name AS vendor_name,
    p.job_number,
    p.name AS project_name,
    COALESCE(sum(l.subtotal), 0::numeric) AS subtotal,
    COALESCE(sum(l.sales_tax), 0::numeric) AS sales_tax,
    COALESCE(sum(l.total_cost), 0::numeric) AS total_cost,
    count(l.id)::integer AS line_count
   FROM vendor_bills b
     JOIN vendors v ON v.id = b.vendor_id
     JOIN projects p ON p.id = b.project_id
     LEFT JOIN vendor_bill_lines l ON l.vendor_bill_id = b.id
  GROUP BY b.id, v.name, p.job_number, p.name;
end if;end $recover_view$;
revoke all on public."vendor_bill_financial_summary" from public,anon,authenticated;
grant select on public."vendor_bill_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.vendor_payment_financial_summary') is null then
create view public."vendor_payment_financial_summary" with(security_invoker=true) as  WITH alloc AS (
         SELECT vendor_payment_allocations.vendor_payment_id,
            COALESCE(sum(vendor_payment_allocations.amount), 0::numeric) AS allocated_amount,
            count(*)::integer AS allocation_count
           FROM vendor_payment_allocations
          GROUP BY vendor_payment_allocations.vendor_payment_id
        )
 SELECT p.id AS vendor_payment_id,
    p.company_id,
    p.vendor_id,
    v.name AS vendor_name,
    p.payment_date,
    p.amount,
    p.processing_fee,
    p.payment_method,
    p.reference_number,
    p.notes,
    p.status,
    p.created_at,
    COALESCE(a.allocated_amount, 0::numeric) AS allocated_amount,
    GREATEST(round(p.amount - COALESCE(a.allocated_amount, 0::numeric), 2), 0::numeric) AS unapplied_amount,
    COALESCE(a.allocation_count, 0) AS allocation_count,
    round(p.amount + p.processing_fee, 2) AS total_cash_out
   FROM vendor_payments p
     JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN alloc a ON a.vendor_payment_id = p.id;
end if;end $recover_view$;
revoke all on public."vendor_payment_financial_summary" from public,anon,authenticated;
grant select on public."vendor_payment_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.vendor_quote_financial_summary') is null then
create view public."vendor_quote_financial_summary" with(security_invoker=true) as  SELECT q.id AS vendor_quote_id,
    q.company_id,
    q.project_id,
    q.vendor_id,
    q.internal_quote_number,
    q.vendor_quote_number,
    q.quote_date,
    q.expires_on,
    q.status,
    q.budget_section_id,
    q.change_order_id,
    q.pour_plan_id,
    q.notes,
    v.name AS vendor_name,
    p.job_number,
    p.name AS project_name,
    COALESCE(sum(l.subtotal), 0::numeric) AS subtotal,
    COALESCE(sum(l.sales_tax), 0::numeric) AS sales_tax,
    COALESCE(sum(l.total_cost), 0::numeric) AS total_cost,
    count(l.id)::integer AS line_count
   FROM vendor_quotes q
     JOIN vendors v ON v.id = q.vendor_id
     JOIN projects p ON p.id = q.project_id
     LEFT JOIN vendor_quote_lines l ON l.vendor_quote_id = q.id
  GROUP BY q.id, v.name, p.job_number, p.name;
end if;end $recover_view$;
revoke all on public."vendor_quote_financial_summary" from public,anon,authenticated;
grant select on public."vendor_quote_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.work_package_direct_cost_summary') is null then
create view public."work_package_direct_cost_summary" with(security_invoker=true) as  SELECT company_id,
    work_package_operation_id,
    round(COALESCE(sum(total_cost), 0::numeric), 2) AS direct_posted_cost
   FROM project_costs pc
  WHERE work_package_operation_id IS NOT NULL AND purchase_order_line_id IS NULL AND (COALESCE(source_type, ''::text) <> ALL (ARRAY['timecard'::text, 'payroll'::text, 'employee_time'::text]))
  GROUP BY company_id, work_package_operation_id;
end if;end $recover_view$;
revoke all on public."work_package_direct_cost_summary" from public,anon,authenticated;
grant select on public."work_package_direct_cost_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.work_package_labor_actual_summary') is null then
create view public."work_package_labor_actual_summary" with(security_invoker=true) as  WITH seg AS (
         SELECT s.company_id,
            s.shift_id,
            s.work_package_operation_id,
            sum(EXTRACT(epoch FROM s.ended_at - s.started_at)) / 3600.0 AS operation_hours
           FROM employee_task_segments s
          WHERE s.work_package_operation_id IS NOT NULL AND s.ended_at IS NOT NULL
          GROUP BY s.company_id, s.shift_id, s.work_package_operation_id
        ), allocated AS (
         SELECT tc.company_id,
            seg.work_package_operation_id,
            seg.operation_hours AS approved_operation_hours,
                CASE
                    WHEN COALESCE(tc.hours, 0::numeric) > 0::numeric THEN COALESCE(tc.direct_labor_cost, 0::numeric) * (seg.operation_hours / tc.hours)
                    ELSE 0::numeric
                END AS allocated_direct_labor_cost,
                CASE
                    WHEN COALESCE(tc.hours, 0::numeric) > 0::numeric THEN COALESCE(tc.overhead_recovery_cost, 0::numeric) * (seg.operation_hours / tc.hours)
                    ELSE 0::numeric
                END AS allocated_overhead_cost
           FROM seg
             JOIN timecards tc ON tc.company_id = seg.company_id AND tc.source_shift_id = seg.shift_id
        )
 SELECT company_id,
    work_package_operation_id,
    round(sum(approved_operation_hours), 2) AS approved_operation_hours,
    round(sum(allocated_direct_labor_cost), 2) AS actual_direct_labor_cost,
    round(sum(allocated_overhead_cost), 2) AS actual_overhead_cost,
    round(sum(allocated_direct_labor_cost + allocated_overhead_cost), 2) AS actual_company_labor_cost
   FROM allocated
  GROUP BY company_id, work_package_operation_id;
end if;end $recover_view$;
revoke all on public."work_package_labor_actual_summary" from public,anon,authenticated;
grant select on public."work_package_labor_actual_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.bid_pipeline_intelligence') is null then
create view public."bid_pipeline_intelligence" with(security_invoker=true) as  WITH latest_estimate AS (
         SELECT DISTINCT ON (e.lead_id) e.lead_id,
            e.id AS estimate_id,
            e.estimate_number,
            e.status AS estimate_status,
            e.updated_at AS estimate_updated_at
           FROM estimates e
          WHERE e.lead_id IS NOT NULL
          ORDER BY e.lead_id, e.version DESC, e.updated_at DESC
        ), acceptance AS (
         SELECT e.lead_id,
            max(a_1.accepted_at) AS accepted_at
           FROM proposal_acceptances a_1
             JOIN estimates e ON e.id = a_1.estimate_id
          WHERE e.lead_id IS NOT NULL
          GROUP BY e.lead_id
        ), latest_feedback AS (
         SELECT DISTINCT ON (f.lead_id) f.lead_id,
            f.competitor_price,
            f.scope_comparable,
            f.evidence_strength,
            f.safe_for_price_comparison,
            f.recorded_at
           FROM bid_price_feedback_intelligence f
          ORDER BY f.lead_id, f.recorded_at DESC
        )
 SELECT l.company_id,
    l.id AS lead_id,
    l.opportunity_number,
    l.customer_name,
    l.project_name,
    l.city,
    l.scope,
    l.estimated_value,
    l.bid_due,
    l.follow_up,
    l.status AS lead_status,
    l.source,
    ps.bid_type,
    ps.relationship_strength,
    ps.estimated_competitor_count,
    ps.customer_budget,
    ps.estimator_effort_hours,
    ps.pursuit_decision,
    ps.outcome,
    ps.lost_reason,
    ps.carez_pursuit_score,
    ps.carez_recommendation,
    ps.proposal_sent_at,
    ps.last_follow_up_at,
    le.estimate_id,
    le.estimate_number,
    le.estimate_status,
    a.accepted_at,
    lf.competitor_price,
    lf.scope_comparable,
    lf.evidence_strength,
    lf.safe_for_price_comparison,
    lf.recorded_at AS latest_price_feedback_at,
    l.follow_up IS NOT NULL AND l.follow_up <= (now() AT TIME ZONE 'America/Los_Angeles'::text)::date AND (l.status <> ALL (ARRAY['won'::text, 'lost'::text])) AS needs_follow_up,
        CASE
            WHEN a.accepted_at IS NOT NULL OR l.status = 'won'::text THEN 'won'::text
            WHEN l.status = 'lost'::text OR ps.outcome = 'lost'::text THEN 'lost'::text
            WHEN l.status = ANY (ARRAY['proposal_sent'::text, 'follow_up'::text]) THEN 'proposal_out'::text
            WHEN ps.pursuit_decision = 'pass'::text THEN 'passed'::text
            WHEN le.estimate_id IS NOT NULL THEN 'estimating'::text
            ELSE 'qualifying'::text
        END AS pipeline_stage
   FROM leads l
     LEFT JOIN bid_pursuit_score ps ON ps.lead_id = l.id AND ps.company_id = l.company_id
     LEFT JOIN latest_estimate le ON le.lead_id = l.id
     LEFT JOIN acceptance a ON a.lead_id = l.id
     LEFT JOIN latest_feedback lf ON lf.lead_id = l.id;
end if;end $recover_view$;
revoke all on public."bid_pipeline_intelligence" from public,anon,authenticated;
grant select on public."bid_pipeline_intelligence" to authenticated;

do $recover_view$ begin if to_regclass('public.bid_scope_leveling_summary') is null then
create view public."bid_scope_leveling_summary" with(security_invoker=true) as  WITH item_rollup AS (
         SELECT bid_scope_comparison_items.company_id,
            bid_scope_comparison_items.lead_id,
            bid_scope_comparison_items.bid_price_feedback_id,
            count(*)::integer AS scope_items,
            count(*) FILTER (WHERE bid_scope_comparison_items.competitor_status = 'unknown'::text)::integer AS competitor_unknown_items,
            count(*) FILTER (WHERE bid_scope_comparison_items.carez_status = 'included'::text AND bid_scope_comparison_items.competitor_status = 'excluded'::text)::integer AS known_competitor_exclusions,
            round(COALESCE(sum(bid_scope_comparison_items.equalization_amount) FILTER (WHERE bid_scope_comparison_items.carez_status = 'included'::text AND (bid_scope_comparison_items.competitor_status = ANY (ARRAY['excluded'::text, 'allowance'::text]))), 0::numeric), 2) AS equalization_amount
           FROM bid_scope_comparison_items
          GROUP BY bid_scope_comparison_items.company_id, bid_scope_comparison_items.lead_id, bid_scope_comparison_items.bid_price_feedback_id
        )
 SELECT f.company_id,
    f.lead_id,
    f.id AS bid_price_feedback_id,
    f.competitor_name,
    f.competitor_price,
    f.feedback_source,
    f.scope_comparable,
    f.evidence_strength,
    f.safe_for_price_comparison,
    COALESCE(i.scope_items, 0) AS scope_items,
    COALESCE(i.competitor_unknown_items, 0) AS competitor_unknown_items,
    COALESCE(i.known_competitor_exclusions, 0) AS known_competitor_exclusions,
    COALESCE(i.equalization_amount, 0::numeric) AS equalization_amount,
        CASE
            WHEN f.competitor_price IS NOT NULL THEN round(f.competitor_price + COALESCE(i.equalization_amount, 0::numeric), 2)
            ELSE NULL::numeric
        END AS leveled_competitor_price,
        CASE
            WHEN f.competitor_price IS NULL THEN 'No competitor price recorded'::text
            WHEN f.evidence_strength = 'unverified'::text THEN 'Unverified price claim - do not treat as market evidence yet'::text
            WHEN COALESCE(i.scope_items, 0) = 0 OR COALESCE(i.competitor_unknown_items, 0) > 0 THEN 'Scope is not fully leveled'::text
            WHEN f.scope_comparable <> 'yes'::text THEN 'Bid scopes are not confirmed comparable'::text
            ELSE 'Comparable scope check complete'::text
        END AS leveling_status,
    f.safe_for_price_comparison AND COALESCE(i.scope_items, 0) > 0 AND COALESCE(i.competitor_unknown_items, 0) = 0 AS comparison_ready,
    f.estimate_id,
    f.recorded_at
   FROM bid_price_feedback_intelligence f
     LEFT JOIN item_rollup i ON i.company_id = f.company_id AND i.lead_id = f.lead_id AND i.bid_price_feedback_id = f.id;
end if;end $recover_view$;
revoke all on public."bid_scope_leveling_summary" from public,anon,authenticated;
grant select on public."bid_scope_leveling_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.company_payroll_cash_summary') is null then
create view public."company_payroll_cash_summary" with(security_invoker=true) as  WITH unprocessed AS (
         SELECT payroll_unprocessed_worker_summary.company_id,
            COALESCE(sum(payroll_unprocessed_worker_summary.gross_wages), 0::numeric) AS unprocessed_gross_wages,
            COALESCE(sum(payroll_unprocessed_worker_summary.employer_payroll_taxes), 0::numeric) AS unprocessed_employer_payroll_taxes,
            COALESCE(sum(payroll_unprocessed_worker_summary.employer_li), 0::numeric) AS unprocessed_li,
            COALESCE(sum(payroll_unprocessed_worker_summary.sick_leave_reserve), 0::numeric) AS unprocessed_sick_reserve,
            COALESCE(sum(payroll_unprocessed_worker_summary.payroll_funding_requirement), 0::numeric) AS unprocessed_funding_requirement,
            COALESCE(sum(payroll_unprocessed_worker_summary.timecard_count), 0::bigint)::integer AS unprocessed_timecard_count,
            count(*)::integer AS workers_with_unprocessed_time
           FROM payroll_unprocessed_worker_summary
          GROUP BY payroll_unprocessed_worker_summary.company_id
        ), runs AS (
         SELECT payroll_run_financial_summary.company_id,
            COALESCE(sum(payroll_run_financial_summary.payroll_funding_requirement) FILTER (WHERE payroll_run_financial_summary.status = ANY (ARRAY['draft'::text, 'approved'::text])), 0::numeric) AS open_run_funding_requirement,
            count(*) FILTER (WHERE payroll_run_financial_summary.status = ANY (ARRAY['draft'::text, 'approved'::text]))::integer AS open_run_count,
            COALESCE(sum(payroll_run_financial_summary.sick_leave_reserve) FILTER (WHERE payroll_run_financial_summary.status = ANY (ARRAY['draft'::text, 'approved'::text])), 0::numeric) AS open_run_sick_reserve
           FROM payroll_run_financial_summary
          GROUP BY payroll_run_financial_summary.company_id
        )
 SELECT c.id AS company_id,
    COALESCE(u.unprocessed_gross_wages, 0::numeric) AS unprocessed_gross_wages,
    COALESCE(u.unprocessed_employer_payroll_taxes, 0::numeric) AS unprocessed_employer_payroll_taxes,
    COALESCE(u.unprocessed_li, 0::numeric) AS unprocessed_li,
    COALESCE(u.unprocessed_sick_reserve, 0::numeric) AS unprocessed_sick_reserve,
    COALESCE(u.unprocessed_funding_requirement, 0::numeric) AS unprocessed_funding_requirement,
    COALESCE(u.unprocessed_timecard_count, 0) AS unprocessed_timecard_count,
    COALESCE(u.workers_with_unprocessed_time, 0) AS workers_with_unprocessed_time,
    COALESCE(r.open_run_funding_requirement, 0::numeric) AS open_run_funding_requirement,
    COALESCE(r.open_run_count, 0) AS open_run_count,
    COALESCE(r.open_run_sick_reserve, 0::numeric) AS open_run_sick_reserve,
    round(COALESCE(u.unprocessed_funding_requirement, 0::numeric) + COALESCE(r.open_run_funding_requirement, 0::numeric), 2) AS total_open_payroll_requirement,
    round(COALESCE(u.unprocessed_sick_reserve, 0::numeric) + COALESCE(r.open_run_sick_reserve, 0::numeric), 2) AS future_sick_leave_reserve
   FROM companies c
     LEFT JOIN unprocessed u ON u.company_id = c.id
     LEFT JOIN runs r ON r.company_id = c.id;
end if;end $recover_view$;
revoke all on public."company_payroll_cash_summary" from public,anon,authenticated;
grant select on public."company_payroll_cash_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.estimate_price_guardrail') is null then
create view public."estimate_price_guardrail" with(security_invoker=true) as  WITH latest_feedback AS (
         SELECT DISTINCT ON (f.lead_id) f.lead_id,
            f.id AS feedback_id,
            f.competitor_name,
            f.competitor_price,
            f.scope_comparable,
            f.feedback_source,
            f.evidence_strength,
            f.safe_for_price_comparison,
            f.recorded_at
           FROM bid_price_feedback_intelligence f
          ORDER BY f.lead_id, f.recorded_at DESC
        )
 SELECT efs.estimate_id,
    efs.company_id,
    efs.estimate_number,
    efs.name,
    efs.status,
    efs.version,
    efs.project_id,
    efs.target_margin_percent,
    efs.bo_classification,
    efs.bo_rate_percent,
    efs.payment_processing_rate_percent,
    efs.overhead_rate_snapshot,
    efs.proposed_sell_price,
    efs.labor_hours,
    efs.direct_labor_cost,
    efs.material_cost,
    efs.equipment_cost,
    efs.subcontractor_cost,
    efs.other_direct_cost,
    efs.total_direct_cost,
    efs.overhead_cost,
    efs.base_company_cost,
    efs.recommended_sell_price,
    efs.selected_sell_price,
    efs.revenue_cost_reserve,
    efs.projected_profit,
    efs.projected_margin_percent,
    e.lead_id,
        CASE
            WHEN (1::numeric - (COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0) > 0::numeric THEN round(efs.base_company_cost / (1::numeric - (COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0), 2)
            ELSE NULL::numeric
        END AS protected_break_even_price,
        CASE
            WHEN (1::numeric - (COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0) > 0::numeric THEN round(efs.selected_sell_price - efs.base_company_cost / (1::numeric - (COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0), 2)
            ELSE NULL::numeric
        END AS room_to_break_even,
    lf.feedback_id,
    lf.competitor_name,
    lf.competitor_price,
    lf.scope_comparable,
    lf.feedback_source,
    lf.evidence_strength,
    lf.safe_for_price_comparison,
        CASE
            WHEN lf.competitor_price > 0::numeric THEN round(100.0 * (lf.competitor_price - lf.competitor_price * ((COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0) - efs.base_company_cost) / lf.competitor_price, 2)
            ELSE NULL::numeric
        END AS margin_if_competitor_price_matched,
        CASE
            WHEN lf.competitor_price IS NULL THEN 'No competitor number recorded'::text
            WHEN NOT lf.safe_for_price_comparison THEN 'Do not price-match yet — scope/evidence is not verified comparable'::text
            WHEN lf.competitor_price <
            CASE
                WHEN (1::numeric - (COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0) > 0::numeric THEN efs.base_company_cost / (1::numeric - (COALESCE(efs.bo_rate_percent, 0::numeric) + COALESCE(efs.payment_processing_rate_percent, 0::numeric)) / 100.0)
                ELSE efs.base_company_cost
            END THEN 'Competitor number is below Carez protected break-even'::text
            WHEN lf.competitor_price < efs.selected_sell_price THEN 'Comparable competitor is lower — review scope, production assumptions and value-engineering options'::text
            ELSE 'Carez is at or below the latest comparable competitor feedback'::text
        END AS price_guidance
   FROM estimate_financial_summary efs
     JOIN estimates e ON e.id = efs.estimate_id AND e.company_id = efs.company_id
     LEFT JOIN latest_feedback lf ON lf.lead_id = e.lead_id;
end if;end $recover_view$;
revoke all on public."estimate_price_guardrail" from public,anon,authenticated;
grant select on public."estimate_price_guardrail" to authenticated;

do $recover_view$ begin if to_regclass('public.purchase_order_financial_summary') is null then
create view public."purchase_order_financial_summary" with(security_invoker=true) as  SELECT po.id AS purchase_order_id,
    po.company_id,
    po.project_id,
    po.vendor_id,
    po.source_quote_id,
    po.po_number,
    po.status,
    po.issue_date,
    po.expected_delivery_date,
    po.budget_section_id,
    po.change_order_id,
    po.pour_plan_id,
    po.vendor_name_snapshot,
    po.delivery_instructions,
    po.terms,
    po.notes,
    po.issued_at,
    po.closed_at,
    v.name AS vendor_name,
    p.job_number,
    p.name AS project_name,
    COALESCE(sum(l.subtotal), 0::numeric) AS subtotal,
    COALESCE(sum(l.sales_tax), 0::numeric) AS sales_tax,
    COALESCE(sum(l.total_cost), 0::numeric) AS po_total,
    COALESCE(sum(l.actual_cost), 0::numeric) AS actual_cost,
    COALESCE(sum(l.open_commitment), 0::numeric) AS open_commitment,
    round(COALESCE(sum(l.actual_cost), 0::numeric) - COALESCE(sum(l.total_cost), 0::numeric), 2) AS actual_vs_po_variance,
    COALESCE(sum(l.received_quantity), 0::numeric) AS received_quantity,
    count(l.purchase_order_line_id)::integer AS line_count,
    po.created_at
   FROM purchase_orders po
     JOIN vendors v ON v.id = po.vendor_id
     JOIN projects p ON p.id = po.project_id
     LEFT JOIN purchase_order_line_financial_summary l ON l.purchase_order_id = po.id
  GROUP BY po.id, v.name, p.job_number, p.name;
end if;end $recover_view$;
revoke all on public."purchase_order_financial_summary" from public,anon,authenticated;
grant select on public."purchase_order_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.vendor_bill_ap_summary') is null then
create view public."vendor_bill_ap_summary" with(security_invoker=true) as  WITH paid AS (
         SELECT a.vendor_bill_id,
            COALESCE(sum(a.amount) FILTER (WHERE p_1.status = 'posted'::text), 0::numeric) AS paid_amount
           FROM vendor_payment_allocations a
             JOIN vendor_payments p_1 ON p_1.id = a.vendor_payment_id
          GROUP BY a.vendor_bill_id
        )
 SELECT b.vendor_bill_id,
    b.company_id,
    b.project_id,
    b.vendor_id,
    b.purchase_order_id,
    b.vendor_bill_number,
    b.bill_date,
    b.due_date,
    b.status,
    b.vendor_name,
    b.job_number,
    b.project_name,
    b.subtotal,
    b.sales_tax,
    b.total_cost,
    b.line_count,
    COALESCE(p.paid_amount, 0::numeric) AS paid_amount,
    GREATEST(round(b.total_cost - COALESCE(p.paid_amount, 0::numeric), 2), 0::numeric) AS balance_due,
        CASE
            WHEN b.status = 'posted'::text AND GREATEST(b.total_cost - COALESCE(p.paid_amount, 0::numeric), 0::numeric) = 0::numeric THEN 'paid'::text
            WHEN b.status = 'posted'::text AND COALESCE(p.paid_amount, 0::numeric) > 0::numeric THEN 'partial'::text
            ELSE b.status
        END AS payment_status,
        CASE
            WHEN b.status = 'posted'::text AND GREATEST(b.total_cost - COALESCE(p.paid_amount, 0::numeric), 0::numeric) > 0::numeric AND b.due_date IS NOT NULL THEN GREATEST(CURRENT_DATE - b.due_date, 0)
            ELSE 0
        END AS days_overdue,
        CASE
            WHEN b.status <> 'posted'::text OR GREATEST(b.total_cost - COALESCE(p.paid_amount, 0::numeric), 0::numeric) <= 0::numeric THEN 'closed'::text
            WHEN b.due_date IS NULL OR b.due_date >= CURRENT_DATE THEN 'current'::text
            WHEN (CURRENT_DATE - b.due_date) >= 1 AND (CURRENT_DATE - b.due_date) <= 30 THEN '1-30'::text
            WHEN (CURRENT_DATE - b.due_date) >= 31 AND (CURRENT_DATE - b.due_date) <= 60 THEN '31-60'::text
            WHEN (CURRENT_DATE - b.due_date) >= 61 AND (CURRENT_DATE - b.due_date) <= 90 THEN '61-90'::text
            ELSE '90+'::text
        END AS aging_bucket
   FROM vendor_bill_financial_summary b
     LEFT JOIN paid p ON p.vendor_bill_id = b.vendor_bill_id;
end if;end $recover_view$;
revoke all on public."vendor_bill_ap_summary" from public,anon,authenticated;
grant select on public."vendor_bill_ap_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.work_package_procurement_financial_summary') is null then
create view public."work_package_procurement_financial_summary" with(security_invoker=true) as  SELECT pol.company_id,
    pol.work_package_operation_id,
    round(COALESCE(sum(pfs.total_cost) FILTER (WHERE pfs.po_status = ANY (ARRAY['issued'::text, 'closed'::text])), 0::numeric), 2) AS committed_cost,
    round(COALESCE(sum(pfs.actual_cost), 0::numeric), 2) AS procurement_actual_cost,
    round(COALESCE(sum(pfs.open_commitment), 0::numeric), 2) AS open_commitment,
    round(COALESCE(sum(pfs.actual_vs_po_variance), 0::numeric), 2) AS procurement_variance
   FROM purchase_order_lines pol
     JOIN purchase_order_line_financial_summary pfs ON pfs.purchase_order_line_id = pol.id AND pfs.company_id = pol.company_id
  WHERE pol.work_package_operation_id IS NOT NULL
  GROUP BY pol.company_id, pol.work_package_operation_id;
end if;end $recover_view$;
revoke all on public."work_package_procurement_financial_summary" from public,anon,authenticated;
grant select on public."work_package_procurement_financial_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.work_package_resource_summary') is null then
create view public."work_package_resource_summary" with(security_invoker=true) as  SELECT company_id,
    work_package_operation_id,
    count(*)::integer AS resource_count,
    count(*) FILTER (WHERE required_before_start AND waived_at IS NULL AND (resource_status <> ALL (ARRAY['ready'::text, 'waived'::text])))::integer AS blocking_resource_count,
    count(*) FILTER (WHERE warning_reason IS NOT NULL)::integer AS warning_resource_count,
    count(*) FILTER (WHERE resource_type = 'material'::text)::integer AS material_count,
    count(*) FILTER (WHERE resource_type = 'equipment'::text)::integer AS equipment_count,
    count(*) FILTER (WHERE resource_type = 'vendor'::text)::integer AS vendor_count,
    COALESCE(array_agg(blocking_reason ORDER BY need_by_date, label) FILTER (WHERE required_before_start AND blocking_reason IS NOT NULL), '{}'::text[]) AS blocking_reasons,
    COALESCE(array_agg(warning_reason ORDER BY need_by_date, label) FILTER (WHERE warning_reason IS NOT NULL), '{}'::text[]) AS warning_reasons,
    min(need_by_date) FILTER (WHERE required_before_start AND (resource_status <> ALL (ARRAY['ready'::text, 'waived'::text]))) AS next_blocked_need_by
   FROM work_package_resource_requirement_status r
  GROUP BY company_id, work_package_operation_id;
end if;end $recover_view$;
revoke all on public."work_package_resource_summary" from public,anon,authenticated;
grant select on public."work_package_resource_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.bid_value_option_financials') is null then
create view public."bid_value_option_financials" with(security_invoker=true) as  SELECT o.id,
    o.company_id,
    o.lead_id,
    o.estimate_id,
    o.name,
    o.customer_description,
    o.sell_price_change,
    o.company_cost_change,
    o.schedule_days_change,
    o.function_quality_note,
    o.approval_required,
    o.status,
    o.created_by,
    o.created_at,
    o.updated_at,
    g.selected_sell_price AS base_sell_price,
    g.base_company_cost,
    round(g.selected_sell_price + o.sell_price_change, 2) AS option_sell_price,
    round(g.base_company_cost + o.company_cost_change, 2) AS option_company_cost,
        CASE
            WHEN (g.selected_sell_price + o.sell_price_change) > 0::numeric THEN round(100.0 * (g.selected_sell_price + o.sell_price_change - (g.selected_sell_price + o.sell_price_change) * ((COALESCE(g.bo_rate_percent, 0::numeric) + COALESCE(g.payment_processing_rate_percent, 0::numeric)) / 100.0) - (g.base_company_cost + o.company_cost_change)) / (g.selected_sell_price + o.sell_price_change), 2)
            ELSE NULL::numeric
        END AS option_projected_margin_percent,
    round(o.sell_price_change - o.company_cost_change, 2) AS gross_value_delta_before_revenue_reserves
   FROM bid_value_options o
     LEFT JOIN estimate_price_guardrail g ON g.estimate_id = o.estimate_id AND g.company_id = o.company_id;
end if;end $recover_view$;
revoke all on public."bid_value_option_financials" from public,anon,authenticated;
grant select on public."bid_value_option_financials" to authenticated;

do $recover_view$ begin if to_regclass('public.bid_win_rate_summary') is null then
create view public."bid_win_rate_summary" with(security_invoker=true) as  SELECT company_id,
    COALESCE(bid_type, 'unclassified'::text) AS bid_type,
    count(*) FILTER (WHERE pipeline_stage = ANY (ARRAY['won'::text, 'lost'::text]))::integer AS decided_bids,
    count(*) FILTER (WHERE pipeline_stage = 'won'::text)::integer AS wins,
    count(*) FILTER (WHERE pipeline_stage = 'lost'::text)::integer AS losses,
        CASE
            WHEN count(*) FILTER (WHERE pipeline_stage = ANY (ARRAY['won'::text, 'lost'::text])) > 0 THEN round(100.0 * count(*) FILTER (WHERE pipeline_stage = 'won'::text)::numeric / count(*) FILTER (WHERE pipeline_stage = ANY (ARRAY['won'::text, 'lost'::text]))::numeric, 1)
            ELSE NULL::numeric
        END AS win_rate_percent,
    round(COALESCE(avg(estimator_effort_hours) FILTER (WHERE estimator_effort_hours IS NOT NULL), 0::numeric), 1) AS avg_estimator_hours
   FROM bid_pipeline_intelligence
  GROUP BY company_id, (COALESCE(bid_type, 'unclassified'::text));
end if;end $recover_view$;
revoke all on public."bid_win_rate_summary" from public,anon,authenticated;
grant select on public."bid_win_rate_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.company_ap_summary') is null then
create view public."company_ap_summary" with(security_invoker=true) as  SELECT company_id,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text), 0::numeric) AS open_ap,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND aging_bucket <> 'current'::text), 0::numeric) AS overdue_ap,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND due_date >= CURRENT_DATE AND due_date <= (CURRENT_DATE + 7)), 0::numeric) AS due_next_7_days,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND aging_bucket = 'current'::text), 0::numeric) AS current_ap,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND aging_bucket = '1-30'::text), 0::numeric) AS ap_1_30,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND aging_bucket = '31-60'::text), 0::numeric) AS ap_31_60,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND aging_bucket = '61-90'::text), 0::numeric) AS ap_61_90,
    COALESCE(sum(balance_due) FILTER (WHERE status = 'posted'::text AND aging_bucket = '90+'::text), 0::numeric) AS ap_90_plus,
    count(*) FILTER (WHERE status = 'posted'::text AND balance_due > 0::numeric)::integer AS open_bill_count
   FROM vendor_bill_ap_summary
  GROUP BY company_id;
end if;end $recover_view$;
revoke all on public."company_ap_summary" from public,anon,authenticated;
grant select on public."company_ap_summary" to authenticated;

do $recover_view$ begin if to_regclass('public.scope_drift_auto_signals') is null then
create view public."scope_drift_auto_signals" with(security_invoker=true) as  WITH off_schedule AS (
         SELECT s.company_id,
            sh.project_id,
            NULL::uuid AS work_package_operation_id,
            (('off:'::text || sh.id::text) || ':'::text) || s.production_task_id::text AS signal_key,
            'off_schedule_time'::text AS source_type,
            sh.work_date,
                CASE
                    WHEN sum(EXTRACT(epoch FROM COALESCE(s.ended_at, now()) - s.started_at) / 3600.0) >= 2::numeric THEN 'high'::text
                    ELSE 'watch'::text
                END AS severity,
            'Unplanned crew work — '::text || t.name AS title,
            'Employee time was recorded on work that was not assigned on the day schedule.'::text AS details,
            round(sum(EXTRACT(epoch FROM COALESCE(s.ended_at, now()) - s.started_at) / 3600.0), 2) AS labor_hours,
            NULL::numeric AS quantity_variance,
            NULL::text AS unit
           FROM employee_task_segments s
             JOIN employee_shift_sessions sh ON sh.id = s.shift_id AND sh.company_id = s.company_id
             JOIN production_tasks t ON t.id = s.production_task_id AND t.company_id = s.company_id
          WHERE COALESCE(s.notes, ''::text) ~~* '%not assigned on today%'::text
          GROUP BY s.company_id, sh.project_id, sh.id, s.production_task_id, sh.work_date, t.name
        ), labor_over AS (
         SELECT r.company_id,
            r.project_id,
            r.operation_id AS work_package_operation_id,
            'labor:'::text || r.operation_id::text AS signal_key,
            'labor_overrun'::text AS source_type,
            (now() AT TIME ZONE 'America/Los_Angeles'::text)::date AS work_date,
                CASE
                    WHEN r.labor_risk = 'critical'::text THEN 'critical'::text
                    ELSE 'high'::text
                END AS severity,
            ((r.job_number || ' — '::text) || r.package_name) || ' labor plan exceeded'::text AS title,
            ((COALESCE(r.field_label, r.task_name) || ' has used '::text) || COALESCE(round(r.budget_hours_used_percent, 0)::text, 'more than planned'::text)) || '% of its labor budget and is not complete.'::text AS details,
            GREATEST(COALESCE(r.tracked_man_hours, 0::numeric) - COALESCE(r.budgeted_man_hours, 0::numeric), 0::numeric) AS labor_hours,
            NULL::numeric AS quantity_variance,
            r.unit
           FROM production_operation_risk r
          WHERE (r.operation_status <> ALL (ARRAY['completed'::text, 'cancelled'::text])) AND (r.labor_risk = ANY (ARRAY['over_budget'::text, 'critical'::text]))
        ), quantity_variance AS (
         SELECT o.company_id,
            wp.project_id,
            o.id AS work_package_operation_id,
            'quantity:'::text || o.id::text AS signal_key,
            'quantity_variance'::text AS source_type,
            COALESCE(o.completed_at::date, (now() AT TIME ZONE 'America/Los_Angeles'::text)::date) AS work_date,
            'high'::text AS severity,
            ((pr.job_number || ' — '::text) || wp.name) || ' quantity differs from plan'::text AS title,
            ((((((((COALESCE(o.field_label, t.name) || ' planned '::text) || round(o.planned_quantity, 2)) || ' '::text) || o.unit) || ' but actual evidence shows '::text) || round(COALESCE(o.actual_quantity, 0::numeric), 2)) || ' '::text) || o.unit) || '.'::text AS details,
            NULL::numeric AS labor_hours,
            COALESCE(o.actual_quantity, 0::numeric) - o.planned_quantity AS quantity_variance,
            o.unit
           FROM work_package_operations o
             JOIN work_packages wp ON wp.id = o.work_package_id AND wp.company_id = o.company_id
             JOIN projects pr ON pr.id = wp.project_id AND pr.company_id = wp.company_id
             JOIN production_tasks t ON t.id = o.production_task_id AND t.company_id = o.company_id
          WHERE o.quantity_review_status = 'needs_review'::text AND o.actual_quantity IS NOT NULL
        )
 SELECT off_schedule.company_id,
    off_schedule.project_id,
    off_schedule.work_package_operation_id,
    off_schedule.signal_key,
    off_schedule.source_type,
    off_schedule.work_date,
    off_schedule.severity,
    off_schedule.title,
    off_schedule.details,
    off_schedule.labor_hours,
    off_schedule.quantity_variance,
    off_schedule.unit
   FROM off_schedule
UNION ALL
 SELECT labor_over.company_id,
    labor_over.project_id,
    labor_over.work_package_operation_id,
    labor_over.signal_key,
    labor_over.source_type,
    labor_over.work_date,
    labor_over.severity,
    labor_over.title,
    labor_over.details,
    labor_over.labor_hours,
    labor_over.quantity_variance,
    labor_over.unit
   FROM labor_over
UNION ALL
 SELECT quantity_variance.company_id,
    quantity_variance.project_id,
    quantity_variance.work_package_operation_id,
    quantity_variance.signal_key,
    quantity_variance.source_type,
    quantity_variance.work_date,
    quantity_variance.severity,
    quantity_variance.title,
    quantity_variance.details,
    quantity_variance.labor_hours,
    quantity_variance.quantity_variance,
    quantity_variance.unit
   FROM quantity_variance;
end if;end $recover_view$;
revoke all on public."scope_drift_auto_signals" from public,anon,authenticated;
grant select on public."scope_drift_auto_signals" to authenticated;

do $recover_view$ begin if to_regclass('public.company_cash_position_summary') is null then
create view public."company_cash_position_summary" with(security_invoker=true) as  WITH plaid_presence AS (
         SELECT plaid_accounts.company_id,
            count(*)::integer AS active_plaid_cash_accounts
           FROM plaid_accounts
          WHERE plaid_accounts.active AND plaid_accounts.include_in_cash AND plaid_accounts.account_type = 'depository'::text
          GROUP BY plaid_accounts.company_id
        ), plaid_bank AS (
         SELECT plaid_accounts.company_id,
            COALESCE(sum(COALESCE(plaid_accounts.available_balance, plaid_accounts.current_balance)), 0::numeric) AS bank_cash,
            min(plaid_accounts.last_balance_at::date) AS balance_as_of,
            count(*) FILTER (WHERE COALESCE(plaid_accounts.available_balance, plaid_accounts.current_balance) IS NOT NULL)::integer AS accounts_with_balance,
            count(*)::integer AS active_accounts
           FROM plaid_accounts
          WHERE plaid_accounts.active AND plaid_accounts.include_in_cash AND plaid_accounts.account_type = 'depository'::text
          GROUP BY plaid_accounts.company_id
        ), manual_latest AS (
         SELECT DISTINCT ON (s.cash_account_id) s.cash_account_id,
            s.company_id,
            s.balance_date,
            s.balance
           FROM company_cash_balance_snapshots s
             JOIN company_cash_accounts a ON a.id = s.cash_account_id AND a.active
             LEFT JOIN plaid_presence pp ON pp.company_id = a.company_id
          WHERE COALESCE(pp.active_plaid_cash_accounts, 0) = 0 OR a.include_with_connected_banks
          ORDER BY s.cash_account_id, s.balance_date DESC, s.created_at DESC
        ), manual_bank AS (
         SELECT ml.company_id,
            COALESCE(sum(ml.balance), 0::numeric) AS bank_cash,
            min(ml.balance_date) AS balance_as_of,
            count(*)::integer AS accounts_with_balance
           FROM manual_latest ml
          GROUP BY ml.company_id
        ), manual_active AS (
         SELECT a.company_id,
            count(*)::integer AS active_accounts
           FROM company_cash_accounts a
             LEFT JOIN plaid_presence pp ON pp.company_id = a.company_id
          WHERE a.active AND (COALESCE(pp.active_plaid_cash_accounts, 0) = 0 OR a.include_with_connected_banks)
          GROUP BY a.company_id
        ), bank AS (
         SELECT c_1.id AS company_id,
            round(COALESCE(pb.bank_cash, 0::numeric) + COALESCE(mb.bank_cash, 0::numeric), 2) AS bank_cash,
                CASE
                    WHEN pb.balance_as_of IS NULL THEN mb.balance_as_of
                    WHEN mb.balance_as_of IS NULL THEN pb.balance_as_of
                    ELSE LEAST(pb.balance_as_of, mb.balance_as_of)
                END AS balance_as_of,
            COALESCE(pb.accounts_with_balance, 0) + COALESCE(mb.accounts_with_balance, 0) AS accounts_with_balance,
            COALESCE(pb.active_accounts, 0) + COALESCE(ma.active_accounts, 0) AS active_cash_accounts,
            COALESCE(pb.active_accounts, 0) AS connected_cash_accounts
           FROM companies c_1
             LEFT JOIN plaid_bank pb ON pb.company_id = c_1.id
             LEFT JOIN manual_bank mb ON mb.company_id = c_1.id
             LEFT JOIN manual_active ma ON ma.company_id = c_1.id
        ), sales_tax AS (
         SELECT project_cash_funding_summary.company_id,
            COALESCE(sum(project_cash_funding_summary.sales_tax_cash_reserved), 0::numeric) AS sales_tax_collected
           FROM project_cash_funding_summary
          GROUP BY project_cash_funding_summary.company_id
        ), remitted AS (
         SELECT company_tax_remittances.company_id,
            COALESCE(sum(company_tax_remittances.amount), 0::numeric) AS sales_tax_remitted
           FROM company_tax_remittances
          WHERE company_tax_remittances.tax_type = 'sales_tax'::text
          GROUP BY company_tax_remittances.company_id
        ), po AS (
         SELECT purchase_order_financial_summary.company_id,
            COALESCE(sum(purchase_order_financial_summary.open_commitment), 0::numeric) AS open_po_commitments
           FROM purchase_order_financial_summary
          WHERE purchase_order_financial_summary.status = 'issued'::text
          GROUP BY purchase_order_financial_summary.company_id
        ), reserves AS (
         SELECT company_cash_reserves.company_id,
            COALESCE(sum(company_cash_reserves.amount), 0::numeric) AS manual_reserves
           FROM company_cash_reserves
          WHERE company_cash_reserves.active
          GROUP BY company_cash_reserves.company_id
        )
 SELECT c.id AS company_id,
    COALESCE(b.bank_cash, 0::numeric) AS bank_cash,
    b.balance_as_of,
    COALESCE(b.accounts_with_balance, 0) AS accounts_with_balance,
    COALESCE(b.active_cash_accounts, 0) AS active_cash_accounts,
    COALESCE(b.connected_cash_accounts, 0) AS connected_cash_accounts,
    GREATEST(round(COALESCE(st.sales_tax_collected, 0::numeric) - COALESCE(rm.sales_tax_remitted, 0::numeric), 2), 0::numeric) AS sales_tax_reserve,
    COALESCE(ap.open_ap, 0::numeric) AS open_ap,
    COALESCE(ap.due_next_7_days, 0::numeric) AS ap_due_next_7_days,
    COALESCE(ap.overdue_ap, 0::numeric) AS overdue_ap,
    COALESCE(po.open_po_commitments, 0::numeric) AS open_po_commitments,
    COALESCE(es.unpaid_company_expense_obligations, 0::numeric) AS unpaid_company_expense_obligations,
    COALESCE(rs.manual_reserves, 0::numeric) AS manual_reserves,
    round(COALESCE(b.bank_cash, 0::numeric) - GREATEST(COALESCE(st.sales_tax_collected, 0::numeric) - COALESCE(rm.sales_tax_remitted, 0::numeric), 0::numeric), 2) AS unrestricted_cash_before_obligations,
    round(COALESCE(b.bank_cash, 0::numeric) - GREATEST(COALESCE(st.sales_tax_collected, 0::numeric) - COALESCE(rm.sales_tax_remitted, 0::numeric), 0::numeric) - COALESCE(ap.open_ap, 0::numeric) - COALESCE(po.open_po_commitments, 0::numeric) - COALESCE(es.unpaid_company_expense_obligations, 0::numeric) - COALESCE(rs.manual_reserves, 0::numeric) - COALESCE(pc.total_open_payroll_requirement, 0::numeric), 2) AS safe_cash_after_known_obligations,
    COALESCE(pc.total_open_payroll_requirement, 0::numeric) AS payroll_cash_requirement
   FROM companies c
     LEFT JOIN bank b ON b.company_id = c.id
     LEFT JOIN sales_tax st ON st.company_id = c.id
     LEFT JOIN remitted rm ON rm.company_id = c.id
     LEFT JOIN company_ap_summary ap ON ap.company_id = c.id
     LEFT JOIN po ON po.company_id = c.id
     LEFT JOIN company_expense_summary es ON es.company_id = c.id
     LEFT JOIN reserves rs ON rs.company_id = c.id
     LEFT JOIN company_payroll_cash_summary pc ON pc.company_id = c.id;
end if;end $recover_view$;
revoke all on public."company_cash_position_summary" from public,anon,authenticated;
grant select on public."company_cash_position_summary" to authenticated;
