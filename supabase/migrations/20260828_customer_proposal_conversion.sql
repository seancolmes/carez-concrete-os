-- Carez OS: customer-facing proposal conversion, immutable sent revisions, engagement tracking, and safe public payloads.

create table if not exists public.proposal_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null unique references public.estimates(id) on delete cascade,
  audience_type text not null default 'general_contractor' check (audience_type in ('homeowner','general_contractor','commercial_owner')),
  executive_summary text,
  customer_message text,
  schedule_summary text,
  payment_summary text,
  warranty_summary text,
  why_carez text,
  pricing_note text,
  terms_text text,
  show_quantities boolean not null default true,
  validity_days integer not null default 30 check (validity_days between 1 and 90),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposal_settings_company_idx on public.proposal_settings(company_id,updated_at desc);

create table if not exists public.proposal_clarifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  category text not null check (category in ('inclusion','exclusion','assumption','allowance','qualification')),
  clarification_text text not null,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposal_clarifications_estimate_idx on public.proposal_clarifications(estimate_id,published,sort_order,created_at);

create table if not exists public.proposal_presentations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  proposal_access_token_id uuid not null unique references public.proposal_access_tokens(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  proposal_number text not null,
  audience_type text not null default 'general_contractor' check (audience_type in ('homeowner','general_contractor','commercial_owner')),
  base_sell_price numeric not null default 0 check (base_sell_price >= 0),
  source_estimate_updated_at timestamptz not null,
  snapshot jsonb not null,
  status text not null default 'sent' check (status in ('sent','viewed','needs_reply','accepted','declined','superseded','revoked')),
  response_state text not null default 'none' check (response_state in ('none','question','change_requested','option_interest','declined','accepted')),
  sent_at timestamptz not null default now(),
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  last_response_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proposal_presentations_estimate_idx on public.proposal_presentations(estimate_id,sent_at desc);
create index if not exists proposal_presentations_lead_idx on public.proposal_presentations(lead_id,status,sent_at desc);
create index if not exists proposal_presentations_company_status_idx on public.proposal_presentations(company_id,status,sent_at desc);

create table if not exists public.proposal_engagement_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  presentation_id uuid not null references public.proposal_presentations(id) on delete cascade,
  event_type text not null check (event_type in ('view','question','change_request','option_interest','decline','accept')),
  customer_name text,
  customer_email text,
  customer_message text,
  decline_reason text,
  option_id uuid references public.bid_value_options(id) on delete set null,
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists proposal_engagement_presentation_idx on public.proposal_engagement_events(presentation_id,created_at desc);
create index if not exists proposal_engagement_unhandled_idx on public.proposal_engagement_events(company_id,handled_at,event_type,created_at desc);

alter table public.proposal_settings enable row level security;
alter table public.proposal_clarifications enable row level security;
alter table public.proposal_presentations enable row level security;
alter table public.proposal_engagement_events enable row level security;

drop policy if exists "office access proposal settings" on public.proposal_settings;
create policy "office access proposal settings" on public.proposal_settings for all to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

drop policy if exists "office access proposal clarifications" on public.proposal_clarifications;
create policy "office access proposal clarifications" on public.proposal_clarifications for all to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

drop policy if exists "office access proposal presentations" on public.proposal_presentations;
create policy "office access proposal presentations" on public.proposal_presentations for all to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

drop policy if exists "office access proposal engagement" on public.proposal_engagement_events;
create policy "office access proposal engagement" on public.proposal_engagement_events for all to authenticated
using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

grant select,insert,update,delete on public.proposal_settings,public.proposal_clarifications,public.proposal_presentations,public.proposal_engagement_events to authenticated;

-- Once a proposal is sent, the customer-safe snapshot is evidence of exactly what was offered.
create or replace function public.protect_proposal_presentation_snapshot()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.estimate_id is distinct from old.estimate_id
     or new.proposal_access_token_id is distinct from old.proposal_access_token_id
     or new.lead_id is distinct from old.lead_id
     or new.proposal_number is distinct from old.proposal_number
     or new.audience_type is distinct from old.audience_type
     or new.base_sell_price is distinct from old.base_sell_price
     or new.source_estimate_updated_at is distinct from old.source_estimate_updated_at
     or new.snapshot is distinct from old.snapshot
     or new.sent_at is distinct from old.sent_at
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Sent proposal snapshot cannot be rewritten. Create a proposal revision instead.';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists protect_proposal_presentation_snapshot on public.proposal_presentations;
create trigger protect_proposal_presentation_snapshot before update on public.proposal_presentations
for each row execute function public.protect_proposal_presentation_snapshot();

create or replace function public.sync_proposal_token_revocation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    update public.proposal_presentations
    set status=case when status in ('accepted','superseded') then status else 'revoked' end,
        updated_at=now()
    where proposal_access_token_id=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_proposal_token_revocation on public.proposal_access_tokens;
create trigger sync_proposal_token_revocation after update of revoked_at on public.proposal_access_tokens
for each row execute function public.sync_proposal_token_revocation();

-- Safe public proposal read. New proposals return their immutable customer snapshot.
-- Legacy links are still readable, but internal cost/margin/rate fields are no longer returned.
create or replace function public.get_public_proposal(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  p public.proposal_presentations%rowtype;
  result jsonb;
begin
  select * into t
  from public.proposal_access_tokens
  where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return null; end if;

  select * into p from public.proposal_presentations where proposal_access_token_id=t.id;
  if found then
    return p.snapshot || jsonb_build_object(
      'presentation',jsonb_build_object(
        'id',p.id,
        'status',p.status,
        'response_state',p.response_state,
        'sent_at',p.sent_at,
        'first_viewed_at',p.first_viewed_at,
        'last_viewed_at',p.last_viewed_at,
        'view_count',p.view_count,
        'last_response_at',p.last_response_at
      ),
      'acceptance',(select jsonb_build_object(
        'accepted_name',a.accepted_name,
        'accepted_email',a.accepted_email,
        'accepted_at',a.accepted_at,
        'acceptance_note',a.acceptance_note
      ) from public.proposal_acceptances a where a.estimate_id=t.estimate_id order by a.accepted_at desc limit 1)
    );
  end if;

  -- Customer-safe legacy fallback.
  select jsonb_build_object(
    'proposal_number',coalesce(t.proposal_number,'P-'||coalesce(e.opportunity_number,regexp_replace(e.estimate_number,'^E-',''))||'-R'||coalesce(e.version,0)::text),
    'valid_through',t.expires_at,
    'audience_type','general_contractor',
    'estimate',jsonb_build_object(
      'id',e.id,'estimate_number',e.estimate_number,'version',e.version,'name',e.name,'expected_start_date',e.expected_start_date
    ),
    'pricing',jsonb_build_object('base_sell_price',coalesce(s.selected_sell_price,0)),
    'company',jsonb_build_object(
      'name',c.name,
      'display_name',bp.display_name,
      'legal_name',bp.legal_name,
      'address_line1',bp.address_line1,
      'address_line2',bp.address_line2,
      'city',bp.city,
      'state',bp.state,
      'postal_code',bp.postal_code,
      'phone',bp.phone,
      'email',bp.email,
      'website',bp.website,
      'ubi_number',bp.ubi_number,
      'contractor_license_number',bp.contractor_license_number,
      'logo_path',bp.logo_path
    ),
    'lead',case when l.id is null then '{}'::jsonb else jsonb_build_object(
      'customer_name',l.customer_name,'contact_name',l.contact_name,'email',l.email,'phone',l.phone,
      'project_name',l.project_name,'address',l.address,'city',l.city,'state',l.state,'postal_code',l.postal_code
    ) end,
    'project',case when pr.id is null then '{}'::jsonb else jsonb_build_object(
      'job_number',pr.job_number,'name',pr.name,'address',pr.address,'city',pr.city,'state',pr.state
    ) end,
    'content',jsonb_build_object(
      'executive_summary',null,
      'customer_message',null,
      'schedule_summary',null,
      'payment_summary',null,
      'warranty_summary',null,
      'why_carez',null,
      'pricing_note',null,
      'terms_text',bp.default_terms_text,
      'show_quantities',true
    ),
    'sections',coalesce((select jsonb_agg(jsonb_build_object(
      'id',es.id,'name',es.name,'scope_type',es.scope_type,'sort_order',es.sort_order
    ) order by es.sort_order) from public.estimate_sections es where es.estimate_id=e.id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',ei.id,'section_id',ei.section_id,'description',ei.description,'quantity',ei.quantity,'unit',ei.unit,'item_type',ei.item_type,'sort_order',ei.sort_order
    ) order by ei.sort_order) from public.estimate_items ei where ei.estimate_id=e.id),'[]'::jsonb),
    'clarifications','[]'::jsonb,
    'options','[]'::jsonb,
    'acceptance',(select jsonb_build_object(
      'accepted_name',a.accepted_name,'accepted_email',a.accepted_email,'accepted_at',a.accepted_at,'acceptance_note',a.acceptance_note
    ) from public.proposal_acceptances a where a.estimate_id=e.id order by a.accepted_at desc limit 1)
  ) into result
  from public.estimates e
  join public.companies c on c.id=e.company_id
  left join public.company_billing_profiles bp on bp.company_id=e.company_id
  left join public.leads l on l.id=e.lead_id
  left join public.projects pr on pr.id=e.project_id
  left join public.estimate_financial_summary s on s.estimate_id=e.id
  where e.id=t.estimate_id;
  return result;
end;
$$;

revoke all on function public.get_public_proposal(uuid) from public;
grant execute on function public.get_public_proposal(uuid) to anon,authenticated;

-- Count meaningful proposal views without inflating the count on every browser refresh.
create or replace function public.track_public_proposal_view(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  p public.proposal_presentations%rowtype;
  v_recent boolean:=false;
begin
  select * into t from public.proposal_access_tokens
  where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;

  select * into p from public.proposal_presentations where proposal_access_token_id=t.id for update;
  if not found then return true; end if;

  select exists(
    select 1 from public.proposal_engagement_events ev
    where ev.presentation_id=p.id and ev.event_type='view' and ev.created_at>now()-interval '15 minutes'
  ) into v_recent;

  update public.proposal_presentations
  set first_viewed_at=coalesce(first_viewed_at,now()),
      last_viewed_at=now(),
      view_count=view_count+case when v_recent then 0 else 1 end,
      status=case when status='sent' then 'viewed' else status end,
      updated_at=now()
  where id=p.id;

  if not v_recent then
    insert into public.proposal_engagement_events(company_id,presentation_id,event_type)
    values(p.company_id,p.id,'view');
  end if;
  return true;
end;
$$;
revoke all on function public.track_public_proposal_view(uuid) from public;
grant execute on function public.track_public_proposal_view(uuid) to anon,authenticated;

-- Customer questions, requested changes, option interest and decline reasons feed the CRM immediately.
create or replace function public.submit_public_proposal_response(
  p_token uuid,
  p_response_type text,
  p_name text default null,
  p_email text default null,
  p_message text default null,
  p_decline_reason text default null,
  p_option_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  p public.proposal_presentations%rowtype;
  e public.estimates%rowtype;
  v_event text;
  v_state text;
  v_reason text;
  v_option_ok boolean:=false;
begin
  if p_response_type not in ('question','change_request','option_interest','decline') then
    raise exception 'Unsupported proposal response';
  end if;

  select * into t from public.proposal_access_tokens
  where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;
  select * into p from public.proposal_presentations where proposal_access_token_id=t.id for update;
  if not found then raise exception 'This proposal link must be reissued before sending a response.'; end if;
  select * into e from public.estimates where id=t.estimate_id;

  if p_response_type='option_interest' then
    if p_option_id is null then raise exception 'Choose an option'; end if;
    select exists(
      select 1 from jsonb_array_elements(coalesce(p.snapshot->'options','[]'::jsonb)) x
      where x->>'id'=p_option_id::text
    ) into v_option_ok;
    if not v_option_ok then raise exception 'This option is not part of the sent proposal'; end if;
  end if;

  v_event:=case p_response_type when 'change_request' then 'change_request' else p_response_type end;
  v_state:=case p_response_type
    when 'question' then 'question'
    when 'change_request' then 'change_requested'
    when 'option_interest' then 'option_interest'
    else 'declined'
  end;
  v_reason:=nullif(trim(coalesce(p_decline_reason,'')),'');

  insert into public.proposal_engagement_events(
    company_id,presentation_id,event_type,customer_name,customer_email,customer_message,decline_reason,option_id
  ) values(
    p.company_id,p.id,v_event,nullif(trim(coalesce(p_name,'')),''),nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_message,'')),''),v_reason,p_option_id
  );

  update public.proposal_presentations
  set response_state=v_state,
      status=case when p_response_type='decline' then 'declined' else 'needs_reply' end,
      last_response_at=now(),updated_at=now()
  where id=p.id;

  if e.lead_id is not null then
    if p_response_type='decline' then
      update public.leads set status='lost',follow_up=null,updated_at=now()
      where id=e.lead_id and company_id=e.company_id;
      insert into public.lead_bid_intelligence(company_id,lead_id,outcome,lost_reason,outcome_note,updated_at)
      values(e.company_id,e.lead_id,'lost',coalesce(v_reason,'customer_declined'),nullif(trim(coalesce(p_message,'')),''),now())
      on conflict(lead_id) do update set
        outcome='lost',lost_reason=excluded.lost_reason,outcome_note=coalesce(excluded.outcome_note,public.lead_bid_intelligence.outcome_note),updated_at=now();
    else
      update public.leads set status='follow_up',follow_up=current_date,updated_at=now()
      where id=e.lead_id and company_id=e.company_id and status not in ('won','lost');
    end if;

    insert into public.lead_activities(company_id,lead_id,activity_type,note,next_follow_up)
    values(
      e.company_id,e.lead_id,'proposal_response',
      case p_response_type
        when 'question' then 'Customer asked a question on '||p.proposal_number
        when 'change_request' then 'Customer requested a proposal change on '||p.proposal_number
        when 'option_interest' then 'Customer is interested in a proposal option on '||p.proposal_number
        else 'Customer declined '||p.proposal_number||case when v_reason is not null then ': '||v_reason else '' end
      end,
      case when p_response_type='decline' then null else current_date end
    );
  end if;
  return true;
end;
$$;
revoke all on function public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid) from public;
grant execute on function public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid) to anon,authenticated;

-- Acceptance is bound to the exact sent estimate revision. If internal estimate data changed, require a revision.
create or replace function public.accept_public_proposal(p_token uuid,p_name text,p_email text default null,p_note text default null)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  p public.proposal_presentations%rowtype;
  e public.estimates%rowtype;
  v_estimate uuid;
begin
  if nullif(trim(p_name),'') is null then raise exception 'Name is required'; end if;
  select * into t from public.proposal_access_tokens
  where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;
  v_estimate:=t.estimate_id;
  select * into e from public.estimates where id=v_estimate for update;
  select * into p from public.proposal_presentations where proposal_access_token_id=t.id for update;

  if found and e.updated_at is distinct from p.source_estimate_updated_at and e.status not in ('accepted','approved') then
    raise exception 'This proposal revision has changed. Please request the current proposal before accepting.';
  end if;

  insert into public.proposal_acceptances(company_id,estimate_id,accepted_name,accepted_email,acceptance_note)
  select t.company_id,v_estimate,trim(p_name),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_note,'')),'')
  where not exists(select 1 from public.proposal_acceptances where estimate_id=v_estimate);

  if p.id is not null then
    update public.proposal_presentations
    set status='accepted',response_state='accepted',last_response_at=coalesce(last_response_at,now()),updated_at=now()
    where id=p.id;
    if not exists(select 1 from public.proposal_engagement_events ev where ev.presentation_id=p.id and ev.event_type='accept') then
      insert into public.proposal_engagement_events(company_id,presentation_id,event_type,customer_name,customer_email,customer_message)
      values(p.company_id,p.id,'accept',trim(p_name),nullif(trim(coalesce(p_email,'')),''),nullif(trim(coalesce(p_note,'')),''));
    end if;
  end if;

  if e.lead_id is not null then
    insert into public.lead_bid_intelligence(company_id,lead_id,outcome,updated_at)
    values(e.company_id,e.lead_id,'won',now())
    on conflict(lead_id) do update set outcome='won',lost_reason=null,updated_at=now();
  end if;

  perform public.award_accepted_estimate(v_estimate);
  return true;
end;
$$;
revoke all on function public.accept_public_proposal(uuid,text,text,text) from public;
grant execute on function public.accept_public_proposal(uuid,text,text,text) to anon,authenticated;

-- A revised price or scope is a new revision, never a silent rewrite of what the customer saw.
create or replace function public.create_estimate_revision(p_estimate_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.estimates%rowtype;
  s public.estimate_sections%rowtype;
  v_company uuid;
  v_new_estimate uuid;
  v_new_section uuid;
  v_new_version integer;
begin
  v_company:=public.get_my_company_id();
  if auth.uid() is null or v_company is null or public.get_my_role()='employee' then
    raise exception 'Owner access required';
  end if;

  select * into e from public.estimates
  where id=p_estimate_id and company_id=v_company for update;
  if not found then raise exception 'Estimate not found'; end if;
  if e.status in ('accepted','approved','superseded') then
    raise exception 'This estimate revision cannot be revised';
  end if;

  select coalesce(max(version),0)+1 into v_new_version
  from public.estimates where company_id=e.company_id and estimate_number=e.estimate_number;

  insert into public.estimates(
    company_id,project_id,estimate_number,name,status,version,expected_start_date,target_margin_percent,
    bo_classification,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,
    proposed_sell_price,notes,created_by,lead_id,opportunity_number
  ) values(
    e.company_id,e.project_id,e.estimate_number,e.name,'draft',v_new_version,e.expected_start_date,e.target_margin_percent,
    e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,e.overhead_snapshot_id,e.overhead_rate_snapshot,
    e.proposed_sell_price,e.notes,auth.uid(),e.lead_id,e.opportunity_number
  ) returning id into v_new_estimate;

  for s in select * from public.estimate_sections where estimate_id=e.id order by sort_order,created_at loop
    insert into public.estimate_sections(company_id,estimate_id,name,scope_type,sort_order,notes)
    values(s.company_id,v_new_estimate,s.name,s.scope_type,s.sort_order,s.notes)
    returning id into v_new_section;

    insert into public.estimate_items(
      company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,
      description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,
      social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,
      li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order
    )
    select company_id,v_new_estimate,v_new_section,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,
      description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,
      social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,
      li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order
    from public.estimate_items where estimate_id=e.id and section_id=s.id order by sort_order,created_at;
  end loop;

  insert into public.estimate_items(
    company_id,estimate_id,section_id,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,
    description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,
    social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,
    li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order
  )
  select company_id,v_new_estimate,null,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,
    description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,base_hourly_rate_snapshot,
    social_security_rate_snapshot,medicare_rate_snapshot,futa_rate_snapshot,wa_sui_rate_snapshot,
    li_employer_rate_snapshot,sick_leave_accrual_rate_snapshot,notes,sort_order
  from public.estimate_items where estimate_id=e.id and section_id is null order by sort_order,created_at;

  insert into public.proposal_settings(
    company_id,estimate_id,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,
    warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,created_by
  )
  select company_id,v_new_estimate,audience_type,executive_summary,customer_message,schedule_summary,payment_summary,
    warranty_summary,why_carez,pricing_note,terms_text,show_quantities,validity_days,auth.uid()
  from public.proposal_settings where estimate_id=e.id;

  insert into public.proposal_clarifications(
    company_id,estimate_id,category,clarification_text,published,sort_order,created_by
  )
  select company_id,v_new_estimate,category,clarification_text,published,sort_order,auth.uid()
  from public.proposal_clarifications where estimate_id=e.id order by sort_order,created_at;

  if e.lead_id is not null then
    insert into public.bid_value_options(
      company_id,lead_id,estimate_id,name,customer_description,sell_price_change,company_cost_change,
      schedule_days_change,function_quality_note,approval_required,status,created_by
    )
    select company_id,lead_id,v_new_estimate,name,customer_description,sell_price_change,company_cost_change,
      schedule_days_change,function_quality_note,approval_required,'suggested',auth.uid()
    from public.bid_value_options
    where estimate_id=e.id and status<>'withdrawn'
    order by created_at;
  end if;

  update public.proposal_access_tokens
  set revoked_at=coalesce(revoked_at,now())
  where estimate_id=e.id and revoked_at is null;

  update public.proposal_presentations
  set status=case when status='accepted' then status else 'superseded' end,updated_at=now()
  where estimate_id=e.id;

  update public.estimates set status='superseded',updated_at=now() where id=e.id;
  return v_new_estimate;
end;
$$;
revoke all on function public.create_estimate_revision(uuid) from public,anon;
grant execute on function public.create_estimate_revision(uuid) to authenticated;

create or replace view public.proposal_conversion_queue
with (security_invoker=true)
as
with base as (
  select
    pp.company_id,
    pp.id as presentation_id,
    pp.estimate_id,
    pp.proposal_access_token_id,
    pp.lead_id,
    pp.proposal_number,
    pp.audience_type,
    pp.base_sell_price,
    pp.status as presentation_status,
    pp.response_state,
    pp.sent_at,
    pp.first_viewed_at,
    pp.last_viewed_at,
    pp.view_count,
    pp.last_response_at,
    t.token,
    t.expires_at,
    t.revoked_at,
    e.estimate_number,
    e.version as estimate_version,
    e.name as estimate_name,
    l.customer_name,
    l.contact_name,
    l.project_name,
    l.email as customer_email,
    l.phone as customer_phone,
    l.follow_up as lead_follow_up,
    a.accepted_at,
    coalesce((select count(*) from public.proposal_engagement_events ev
      where ev.presentation_id=pp.id and ev.event_type<>'view' and ev.handled_at is null),0)::integer as unhandled_response_count
  from public.proposal_presentations pp
  join public.proposal_access_tokens t on t.id=pp.proposal_access_token_id
  join public.estimates e on e.id=pp.estimate_id
  left join public.leads l on l.id=pp.lead_id
  left join lateral (
    select accepted_at from public.proposal_acceptances pa where pa.estimate_id=pp.estimate_id order by accepted_at desc limit 1
  ) a on true
), staged as (
  select b.*,
    case
      when b.accepted_at is not null or b.presentation_status='accepted' then 'accepted'
      when b.presentation_status='superseded' then 'superseded'
      when b.revoked_at is not null or b.presentation_status='revoked' then 'revoked'
      when b.expires_at is not null and b.expires_at<=now() then 'expired'
      when b.presentation_status='declined' or b.response_state='declined' then 'declined'
      when b.unhandled_response_count>0 or b.presentation_status='needs_reply' then 'needs_reply'
      when b.first_viewed_at is not null then 'viewed'
      else 'sent'
    end as conversion_stage
  from base b
), due as (
  select s.*,
    case
      when s.conversion_stage in ('accepted','declined','superseded','revoked','expired') then null::date
      when s.conversion_stage='needs_reply' then current_date
      when s.lead_follow_up is not null then s.lead_follow_up
      when s.first_viewed_at is null then (s.sent_at+interval '2 days')::date
      else (coalesce(s.last_viewed_at,s.first_viewed_at)+interval '2 days')::date
    end as follow_up_due
  from staged s
)
select d.*,
  (d.follow_up_due is not null and d.follow_up_due<=current_date) as follow_up_due_now,
  case d.conversion_stage
    when 'accepted' then 'Awarded — start job setup'
    when 'declined' then 'Closed — review loss reason'
    when 'superseded' then 'Newer proposal revision issued'
    when 'revoked' then 'Proposal link turned off'
    when 'expired' then 'Issue a current proposal revision'
    when 'needs_reply' then 'Reply to customer'
    when 'viewed' then 'Follow up after customer review'
    else 'Confirm receipt / follow up'
  end as next_action
from due d;

grant select on public.proposal_conversion_queue to authenticated;
