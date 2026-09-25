-- Reconcile historical production Proposal authority after the accepted P1.4 guard.
-- This migration changes trigger authority and function ACLs only; it does not
-- invoke historical conversion functions or modify Proposal/Estimate/Project rows.
do $$
begin
  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid=trigger_row.tgrelid
    join pg_namespace table_schema on table_schema.oid=table_row.relnamespace
    join pg_proc trigger_function on trigger_function.oid=trigger_row.tgfoid
    join pg_namespace function_schema on function_schema.oid=trigger_function.pronamespace
    where table_schema.nspname='public'
      and table_row.relname='proposal_presentations'
      and trigger_row.tgname='guard_proposal_release'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled='O'
      and trigger_row.tgtype=7
      and function_schema.nspname='public'
      and trigger_function.proname='carez_guard_proposal_release'
      and pg_get_function_identity_arguments(trigger_function.oid)=''
  ) then
    raise exception 'P1.4 guard_proposal_release trigger invoking public.carez_guard_proposal_release() is required before Proposal authority cutover';
  end if;

  drop trigger if exists carez_proposal_audit_gate on public.proposal_presentations;

  if to_regprocedure('public.accept_public_proposal(uuid,text,text,text)') is not null then
    execute 'revoke execute on function public.accept_public_proposal(uuid,text,text,text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.award_accepted_estimate(uuid)') is not null then
    execute 'revoke execute on function public.award_accepted_estimate(uuid) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.create_estimate_revision(uuid)') is not null then
    execute 'revoke execute on function public.create_estimate_revision(uuid) from public, anon, authenticated';
  end if;
end;
$$;
