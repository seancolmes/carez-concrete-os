-- Trigger functions are invoked by PostgreSQL, not by client RPC calls.
-- Keep the intentional external Proposal RPC surface separate from these
-- internal helpers and remove inherited app-role EXECUTE privileges.
revoke execute on function public.snapshot_purchase_order_branding() from public, anon, authenticated;
revoke execute on function public.sync_project_award_record() from public, anon, authenticated;

do $$
declare
  v_function regprocedure;
  v_external_rpc_allowlist text[] := array[
    'public.get_public_proposal(uuid)',
    'public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid)',
    'public.track_public_proposal_view(uuid)'
  ];
begin
  for v_function in
    select distinct p.oid::regprocedure
    from pg_trigger t
    join pg_proc p on p.oid=t.tgfoid
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and not t.tgisinternal
      and p.oid::regprocedure::text <> all(v_external_rpc_allowlist)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',v_function);
  end loop;
end;
$$;
