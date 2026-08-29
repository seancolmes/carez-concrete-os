-- Carez OS: keep utility RPCs available to authenticated application users, not anonymous callers.

revoke all on function public.carez_distance_ft(double precision,double precision,double precision,double precision) from public, anon;
revoke all on function public.normalize_bank_text(text) from public, anon;
grant execute on function public.carez_distance_ft(double precision,double precision,double precision,double precision) to authenticated, service_role;
grant execute on function public.normalize_bank_text(text) to authenticated, service_role;
