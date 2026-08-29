-- Customer proposal issue is the release boundary for estimate audit blockers.
-- Warnings remain estimator judgment; only objective blocker findings stop insert.

create or replace function public.carez_guard_proposal_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blockers integer := 0;
  v_next_action text;
begin
  select blocker_count, next_action
    into v_blockers, v_next_action
  from public.estimate_audit_summary
  where company_id = new.company_id
    and estimate_id = new.estimate_id;

  if coalesce(v_blockers,0) > 0 then
    raise exception 'Estimate audit blocked (% blocker%s): %',
      v_blockers,
      case when v_blockers=1 then '' else 's' end,
      coalesce(v_next_action,'Clear the estimate audit before issuing the proposal.');
  end if;

  return new;
end;
$$;

revoke all on function public.carez_guard_proposal_audit() from public;
revoke all on function public.carez_guard_proposal_audit() from anon;
revoke all on function public.carez_guard_proposal_audit() from authenticated;

drop trigger if exists carez_proposal_audit_gate on public.proposal_presentations;
create trigger carez_proposal_audit_gate
before insert on public.proposal_presentations
for each row execute function public.carez_guard_proposal_audit();
