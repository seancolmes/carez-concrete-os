export type DatabaseObjectKind = 'relation' | 'function';

export type SourceAuthorityClass =
  | 'A' // Active V1 runtime dependency
  | 'B' // Active V1 test/fixture dependency
  | 'C' // Stale/dead application reference
  | 'D' // Retired legacy contract
  | 'E' // Historical migration-only reference
  | 'F' // PostgreSQL/Supabase/extension builtin
  | 'G' // Scanner false positive
  | 'H' // Post-V1/deferred feature
  | 'I'; // Genuinely missing source-controlled authority

export type SourceAuthorityEntry = {
  kind: DatabaseObjectKind;
  name: string;
  classification: SourceAuthorityClass;
  reason: string;
};

const activeV1Relations = [
  'carez_production_learning_summary', 'customer_payments', 'daily_logs',
  'daily_production_records', 'earned_production_rate_history',
  'employee_break_periods', 'employee_shift_sessions', 'employee_task_segments',
  'invoice_financial_summary', 'invoice_lines', 'invoices',
  'payment_allocations', 'payment_financial_summary', 'pour_authorization_snapshots',
  'pour_cost_items', 'pour_plan_financial_summary', 'pour_plans',
  'pour_work_package_delivery_sync', 'production_operation_risk',
  'production_rate_history', 'production_work_queue',
  'project_award_operations_handoff', 'project_award_records',
  'project_billing_summary', 'project_budget_actual_summary',
  'project_budget_sections', 'project_budgets', 'project_cash_funding_summary',
  'project_closeouts', 'project_commitment_summary',
  'project_cost_to_complete_summary', 'project_costs', 'project_financial_summary',
  'project_inspections', 'project_job_readiness_summary',
  'project_payment_milestones', 'project_scope_forecast_summary',
  'project_scope_progress_updates', 'project_startup_items',
  'project_startup_readiness', 'project_work_readiness_summary',
  'retainage_available_summary', 'scope_drift_events', 'scope_drift_inbox',
  'timecards', 'work_package_financial_summary', 'work_package_lookahead',
  'work_package_operation_progress', 'work_package_operation_readiness',
  'work_package_operations', 'work_package_resource_requirement_status',
  'work_package_resource_requirements', 'work_package_start_readiness',
  'work_packages', 'work_schedule_assignments', 'work_schedule_items',
] as const;

const activeV1Functions = [
  'capture_overhead_rate_snapshot', 'employee_clock_in', 'employee_clock_out',
  'employee_complete_work_package_operation', 'employee_portal_state',
  'employee_start_task', 'employee_start_work', 'next_invoice_number',
] as const;

const deferredRelations = [
  'bank_reconciliation_candidates', 'bank_reconciliation_rules',
  'bank_reconciliation_summary', 'bid_pipeline_intelligence',
  'bid_price_feedback', 'bid_price_feedback_intelligence', 'bid_pursuit_score',
  'bid_scope_comparison_items', 'bid_scope_leveling_summary',
  'bid_value_option_financials', 'bid_win_rate_summary',
  'carez_production_guidance_samples', 'carez_production_rate_guidance',
  'cashflow_calendar', 'company_ap_summary', 'company_cash_accounts',
  'company_cash_balance_snapshots', 'company_cash_position_summary',
  'company_cash_reserves', 'company_expense_summary', 'company_expenses',
  'company_payroll_cash_summary', 'company_tax_remittances', 'crew_rate_history',
  'employee_invites', 'employee_tax_status', 'equipment_assets',
  'equipment_reservations', 'equipment_service_logs', 'estimate_price_guardrail',
  'inventory_items', 'inventory_reservations', 'inventory_transactions',
  'labor_tax_settings', 'lead_inbox_candidates', 'outlook_connections',
  'outlook_messages', 'overhead_items', 'payroll_run_financial_summary',
  'payroll_run_lines', 'payroll_unprocessed_worker_summary', 'plaid_accounts',
  'plaid_bank_account_summary', 'plaid_bank_feed_summary', 'plaid_connections',
  'plaid_transaction_feed', 'plaid_transactions', 'purchase_order_financial_summary',
  'purchase_order_line_financial_summary', 'purchase_order_receipts',
  'purchase_orders', 'takeoff_output_rate_guidance', 'vendor_bill_ap_summary',
  'vendor_bill_financial_summary', 'vendor_bills', 'vendor_payment_financial_summary',
  'vendor_payments', 'vendor_quote_financial_summary', 'vendor_quote_lines',
  'vendor_quotes', 'vendors',
] as const;

const deferredFunctions = [
  'apply_bank_reconciliation_rule', 'approve_payroll_run',
  'consume_work_package_inventory', 'convert_vendor_quote_to_purchase_order',
  'create_payroll_run', 'employee_invite_preview', 'ignore_bank_transaction',
  'issue_purchase_order', 'link_document_to_bank_transaction',
  'link_document_to_po_receipt', 'link_document_to_vendor_bill',
  'next_company_document_number', 'outlook_ingest_message',
  'outlook_webhook_connection', 'outlook_webhook_update_tokens', 'post_vendor_bill',
  'process_payroll_run', 'reconcile_bank_as_transfer', 'reconcile_bank_existing',
  'reconcile_bank_to_company_expense', 'reconcile_bank_to_invoice',
  'reconcile_bank_to_job_cost', 'reconcile_bank_to_payroll_run',
  'reconcile_bank_to_tax', 'reconcile_bank_to_vendor_bill',
  'reconcile_document_receipt_to_company_expense',
  'reconcile_document_receipt_to_job_cost', 'record_vendor_bill_payment',
  'void_payroll_run', 'void_vendor_payment',
] as const;

const activeReason = 'Active V1 execution or commercial runtime contract; source authority is missing.';
const deferredReason = 'Deferred or post-V1 capability; keep visible in the audit but do not block V1 release.';

export const sourceAuthorityManifest: SourceAuthorityEntry[] = [
  ...activeV1Relations.map(name => ({kind: 'relation' as const, name, classification: 'A' as const, reason: activeReason})),
  ...activeV1Functions.map(name => ({kind: 'function' as const, name, classification: 'A' as const, reason: activeReason})),
  ...deferredRelations.map(name => ({kind: 'relation' as const, name, classification: 'H' as const, reason: deferredReason})),
  ...deferredFunctions.map(name => ({kind: 'function' as const, name, classification: 'H' as const, reason: deferredReason})),
];

const manifestByKey = new Map(sourceAuthorityManifest.map(entry => [`${entry.kind}:${entry.name}`, entry]));

export function sourceAuthorityFor(kind: DatabaseObjectKind, name: string): SourceAuthorityEntry | undefined {
  return manifestByKey.get(`${kind}:${name}`);
}

export function assertSourceAuthorityManifest(entries: {kind: DatabaseObjectKind; name: string}[]): void {
  const unknown = [...new Set(entries
    .filter(entry => !sourceAuthorityFor(entry.kind, entry.name))
    .map(entry => `${entry.kind}:${entry.name}`))];
  if (unknown.length) throw new Error(`Unclassified missing source dependencies: ${unknown.join(', ')}`);
}

export function isReleaseBlockingSourceClass(classification: SourceAuthorityClass): boolean {
  return classification === 'A' || classification === 'B' || classification === 'I';
}
