-- Estimator production intelligence is an authenticated office feature.
-- SECURITY INVOKER still preserves underlying RLS; these explicit grants also
-- prevent unsigned API callers from selecting the derived views at all.

revoke all on public.carez_production_guidance_samples from public;
revoke all on public.carez_production_guidance_samples from anon;
grant select on public.carez_production_guidance_samples to authenticated;

revoke all on public.carez_production_rate_guidance from public;
revoke all on public.carez_production_rate_guidance from anon;
grant select on public.carez_production_rate_guidance to authenticated;

revoke all on public.takeoff_output_rate_guidance from public;
revoke all on public.takeoff_output_rate_guidance from anon;
grant select on public.takeoff_output_rate_guidance to authenticated;
