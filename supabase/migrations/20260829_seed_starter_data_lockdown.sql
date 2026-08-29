-- Carez OS: retire the legacy starter-data RPC from normal application use.
-- Keep the function available to trusted administrative/service tooling only.

revoke all on function public.seed_carez_starter_data() from public, anon, authenticated;
grant execute on function public.seed_carez_starter_data() to service_role;
