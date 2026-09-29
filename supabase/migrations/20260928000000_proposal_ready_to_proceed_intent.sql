-- Record positive customer intent without creating an acceptance or award.
alter table public.proposal_engagement_events
  drop constraint proposal_engagement_events_event_type_check;
alter table public.proposal_engagement_events
  add constraint proposal_engagement_events_event_type_check
  check (event_type in ('view','question','change_request','option_interest','ready_to_proceed','decline','accept'));

alter table public.proposal_presentations
  drop constraint proposal_presentations_response_state_check;
alter table public.proposal_presentations
  add constraint proposal_presentations_response_state_check
  check (response_state in ('none','question','change_requested','option_interest','ready_to_proceed','declined','accepted'));

create function public.submit_public_proposal_ready_intent(
  p_token uuid, p_name text, p_email text
)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp
as $$
declare
  v_token public.proposal_access_tokens%rowtype;
  v_presentation public.proposal_presentations%rowtype;
  v_name text:=nullif(trim(coalesce(p_name,'')), '');
  v_email text:=nullif(trim(coalesce(p_email,'')), '');
begin
  if v_name is null or v_email is null then
    raise exception 'Name and email are required to send your response.';
  end if;

  select * into v_token from public.proposal_access_tokens
    where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;

  select * into v_presentation from public.proposal_presentations
    where proposal_access_token_id=v_token.id for update;
  if not found or v_presentation.status not in ('sent','viewed','needs_reply') then
    raise exception 'This proposal is no longer open for responses.';
  end if;
  if exists(select 1 from public.proposal_acceptances where estimate_id=v_presentation.estimate_id) then
    raise exception 'This proposal has already been accepted.';
  end if;

  if v_presentation.response_state='ready_to_proceed' then
    return true;
  end if;

  insert into public.proposal_engagement_events
    (company_id,presentation_id,event_type,customer_name,customer_email)
    values(v_presentation.company_id,v_presentation.id,'ready_to_proceed',v_name,v_email);
  update public.proposal_presentations set response_state='ready_to_proceed',
    status='needs_reply',last_response_at=now(),updated_at=now()
    where id=v_presentation.id and company_id=v_presentation.company_id;

  if v_presentation.lead_id is not null then
    update public.leads set status='follow_up',follow_up=current_date,updated_at=now()
      where id=v_presentation.lead_id and company_id=v_presentation.company_id
        and status not in ('won','lost');
    insert into public.lead_activities(company_id,lead_id,activity_type,note,next_follow_up)
      values(v_presentation.company_id,v_presentation.lead_id,'proposal_response',
        'Customer is ready to proceed with '||v_presentation.proposal_number,current_date);
  end if;
  return true;
end;
$$;

revoke all on function public.submit_public_proposal_ready_intent(uuid,text,text) from public;
grant execute on function public.submit_public_proposal_ready_intent(uuid,text,text) to anon, authenticated, service_role;
