-- Self-service profile edits must never confer authorization or tenant identity.
-- Preserve existing row policies and display-name editing. Role assignment is
-- an administrative authority, not a field writable by the subject.
revoke update on public.profiles from public,anon,authenticated;
revoke update (id,company_id,role,created_at) on public.profiles from public,anon,authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Pin trusted resolution without replacing applied function bodies or ACLs.
alter function public.get_my_company_id() set search_path=pg_catalog,public,pg_temp;
alter function public.get_my_role() set search_path=pg_catalog,public,pg_temp;
alter function public.next_opportunity_number_for_company(uuid) set search_path=pg_catalog,public,pg_temp;
alter function public.next_opportunity_number() set search_path=pg_catalog,public,pg_temp;
alter function public.snapshot_purchase_order_branding() set search_path=pg_catalog,public,pg_temp;
alter function public.carez_acknowledge_estimate_review(uuid) set search_path=pg_catalog,public,extensions,pg_temp;
alter function public.get_public_proposal(uuid) set search_path=pg_catalog,public,pg_temp;
alter function public.track_public_proposal_view(uuid) set search_path=pg_catalog,public,pg_temp;
alter function public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid) set search_path=pg_catalog,public,pg_temp;
