-- Carez OS: reconcile identity helper RPC execution privileges with the
-- authenticated-only security contract already enforced in QA.

revoke all on function public.get_my_company_id() from public, anon;
revoke all on function public.get_my_role() from public, anon;

grant execute on function public.get_my_company_id() to authenticated, service_role;
grant execute on function public.get_my_role() to authenticated, service_role;
