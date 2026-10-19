-- The captured deployment's immutable accepted-snapshot guard predates governed
-- external verify/revoke events. Permit only the event-derived authorization
-- description to advance; original commercial facts remain immutable.
create or replace function public.protect_project_award_snapshot()
returns trigger language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$
declare event_transition boolean:=false;
begin
 if new.authorization_text is distinct from old.authorization_text then
  select exists(
   select 1 from public.external_agreement_verifications e
   join public.project_external_intakes i on i.company_id=e.company_id and i.project_id=e.project_id and i.id=e.intake_id
   where e.company_id=old.company_id and e.project_id=old.project_id
    and e.id=new.external_verification_id and e.id is distinct from old.external_verification_id
    and e.previous_event_id=old.external_verification_id
    and old.external_verification_id is not null
    and e.actor_id=auth.uid() and e.actor_role='owner'
    and old.company_id=public.get_my_company_id() and public.get_my_role()='owner'
    and old.award_decision_id is null and new.award_decision_id is null
    and old.estimate_id is null and new.estimate_id is null
    and old.proposal_acceptance_id is null and new.proposal_acceptance_id is null
    and e.agreement_reference=old.agreement_number and e.agreement_reference=new.agreement_number
    and e.agreement_reference=i.agreement_reference
    and e.agreement_amount=old.original_contract_value and e.agreement_amount=new.original_contract_value
    and e.agreement_amount=i.supplied_agreement_amount
    and e.id=(select latest.id from public.external_agreement_verifications latest
     where latest.company_id=e.company_id and latest.project_id=e.project_id order by latest.sequence_no desc limit 1)
    and new.status=case e.action when 'verify' then 'accepted' when 'revoke' then 'void' end
    and new.authorization_text=case when e.action='revoke' then 'Owner verification revoked.'
     when e.evidence_basis='owner_attestation_copy_pending' then 'Owner verified externally signed agreement. Executed copy remains pending.'
     when e.evidence_basis='executed_copy_reviewed' then 'Owner reviewed retained executed agreement.' end
  ) into event_transition;
 end if;
 -- Keep every original immutable-snapshot comparison. Only a proven external
 -- event transition can replace its operational authorization description.
 if new.company_id is distinct from old.company_id
  or new.project_id is distinct from old.project_id
  or new.estimate_id is distinct from old.estimate_id
  or new.proposal_acceptance_id is distinct from old.proposal_acceptance_id
  or new.agreement_number is distinct from old.agreement_number
  or new.proposal_number is distinct from old.proposal_number
  or new.accepted_name is distinct from old.accepted_name
  or new.accepted_email is distinct from old.accepted_email
  or new.accepted_at is distinct from old.accepted_at
  or new.acceptance_note is distinct from old.acceptance_note
  or new.original_contract_value is distinct from old.original_contract_value
  or (new.authorization_text is distinct from old.authorization_text and not event_transition)
 then raise exception 'Accepted agreement snapshot cannot be rewritten';end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function public.protect_project_award_snapshot() from public,anon,authenticated;
-- Existing captured trigger is preserved; clean replay gets the same guard.
do $$begin
 if not exists(select 1 from pg_trigger where tgrelid='public.project_award_records'::regclass
  and tgname='protect_project_award_snapshot' and not tgisinternal) then
  create trigger protect_project_award_snapshot before update on public.project_award_records
   for each row execute function public.protect_project_award_snapshot();
 end if;
end $$;
