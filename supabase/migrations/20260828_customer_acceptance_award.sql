-- Accepting a customer proposal awards the job and freezes the accepted estimate.
create or replace function public.accept_public_proposal(p_token uuid,p_name text,p_email text default null,p_note text default null)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  v_estimate uuid;
begin
  if nullif(trim(p_name),'') is null then raise exception 'Name is required'; end if;
  select * into t from public.proposal_access_tokens
  where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;
  v_estimate:=t.estimate_id;

  insert into public.proposal_acceptances(company_id,estimate_id,accepted_name,accepted_email,acceptance_note)
  select t.company_id,v_estimate,trim(p_name),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_note,'')),'')
  where not exists(select 1 from public.proposal_acceptances where estimate_id=v_estimate);

  perform public.award_accepted_estimate(v_estimate);
  return true;
end;
$$;

grant execute on function public.accept_public_proposal(uuid,text,text,text) to anon,authenticated;
