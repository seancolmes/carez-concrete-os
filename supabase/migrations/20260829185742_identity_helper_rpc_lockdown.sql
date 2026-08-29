-- Carez OS: restrict identity helper RPCs to authenticated application users and service tooling.

revoke all on function public.get_my_company_id() from public, anon;
revoke all on function public.get_my_employee_company_id() from public, anon;
revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_company_id() to authenticated, service_role;
grant execute on function public.get_my_employee_company_id() to authenticated, service_role;
grant execute on function public.get_my_role() to authenticated, service_role;
