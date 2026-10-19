-- Reconcile the captured deployment's permissive table UPDATE grant with the
-- already-declared 20260926103000 self-service profile authority. Row policies
-- remain unchanged; administrative role/company assignment stays privileged.
revoke update on public.profiles from public,anon,authenticated;
revoke update (id,company_id,role,created_at) on public.profiles from public,anon,authenticated;
grant update (full_name) on public.profiles to authenticated;
