-- Restore 20260926150000's existing anonymous/private attendance boundary on
-- the recovered deployment. Authenticated grants, employee RPC access, tenant
-- policies and frozen attendance/cost authority remain unchanged.
revoke all on public.employee_shift_sessions,public.employee_break_periods,
 public.employee_task_segments,public.daily_logs,public.daily_production_records
 from public,anon;
