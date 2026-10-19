-- Restore the explicit anonymous privilege boundaries already declared in
-- 20260926180000 and 20260926190000 on the recovered deployment. Tenant/role RLS,
-- authenticated grants and governed command authorities are unchanged.
revoke all on public.work_package_resource_requirements,
 public.work_package_resource_requirement_status from public,anon;
revoke all on public.pour_plans,public.pour_cost_items,
 public.pour_authorization_snapshots,public.pour_plan_financial_summary,
 public.pour_work_package_delivery_sync from public,anon;
