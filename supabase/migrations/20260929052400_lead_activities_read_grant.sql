-- Opportunity Activity is read inside the authenticated, company-scoped workspace.
-- The existing RLS policy continues to restrict rows to the caller's company.
grant select on table public.lead_activities to authenticated;
