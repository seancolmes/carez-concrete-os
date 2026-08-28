-- Carez OS: security-hardening for operating-intelligence views introduced in this batch.
-- Run analytical views with the querying user's permissions/RLS rather than the view creator.

alter view public.work_package_resource_requirement_status set (security_invoker = true);
alter view public.work_package_resource_summary set (security_invoker = true);
alter view public.work_package_start_readiness set (security_invoker = true);
alter view public.work_package_lookahead set (security_invoker = true);

alter view public.scope_drift_auto_signals set (security_invoker = true);
alter view public.scope_drift_inbox set (security_invoker = true);
alter view public.work_package_labor_actual_summary set (security_invoker = true);
alter view public.work_package_procurement_financial_summary set (security_invoker = true);
alter view public.work_package_direct_cost_summary set (security_invoker = true);
alter view public.work_package_financial_summary set (security_invoker = true);

alter view public.bid_pursuit_score set (security_invoker = true);
alter view public.bid_price_feedback_intelligence set (security_invoker = true);
alter view public.estimate_price_guardrail set (security_invoker = true);
alter view public.bid_pipeline_intelligence set (security_invoker = true);
alter view public.bid_win_rate_summary set (security_invoker = true);
alter view public.bid_scope_leveling_summary set (security_invoker = true);
alter view public.bid_value_option_financials set (security_invoker = true);

-- Trigger-only function: nobody should be able to call this RPC directly.
revoke execute on function public.carez_enforce_work_package_start_readiness() from public, anon, authenticated;

-- Office inventory consumption is callable only by signed-in users; the function itself
-- also verifies company membership and rejects employee-role accounts.
revoke execute on function public.consume_work_package_inventory(uuid) from public, anon;
grant execute on function public.consume_work_package_inventory(uuid) to authenticated;
