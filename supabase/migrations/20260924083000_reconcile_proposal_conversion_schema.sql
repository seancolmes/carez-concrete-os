-- Reconcile the accepted Proposal conversion contract onto the current P1.4 schema.
-- Existing proposal_presentations rows and release evidence are never recreated or backfilled.

create table if not exists public.proposal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.proposal_access_tokens add column if not exists proposal_number text;

create table if not exists public.proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  accepted_name text not null,
  accepted_email text,
  accepted_at timestamptz not null default now(),
  acceptance_ip text,
  acceptance_note text
);
create index if not exists proposal_acceptances_estimate_idx
  on public.proposal_acceptances(estimate_id, accepted_at desc);

create table if not exists public.proposal_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null unique references public.estimates(id) on delete cascade,
  audience_type text not null default 'general_contractor'
    check (audience_type in ('homeowner','general_contractor','commercial_owner')),
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
create index if not exists proposal_settings_company_idx
  on public.proposal_settings(company_id, updated_at desc);

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
create index if not exists proposal_clarifications_estimate_idx
  on public.proposal_clarifications(estimate_id, published, sort_order, created_at);

create table if not exists public.opportunity_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_year integer not null,
  next_number integer not null default 1,
  primary key(company_id, opportunity_year)
);

alter table public.leads add column if not exists opportunity_number text;
alter table public.leads add column if not exists contact_name text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists postal_code text;
create unique index if not exists leads_company_opportunity_number_key
  on public.leads(company_id, opportunity_number) where opportunity_number is not null;
alter table public.estimates add column if not exists opportunity_number text;

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null default 'note',
  activity_date timestamptz not null default now(),
  note text,
  next_follow_up date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx
  on public.lead_activities(lead_id, activity_date desc);

create table if not exists public.lead_bid_intelligence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  bid_type text not null default 'private_competitive'
    check (bid_type in ('residential_direct','private_competitive','gc_invited','negotiated','public_hard_bid','repeat_client','other')),
  relationship_strength text not null default 'new' check (relationship_strength in ('new','known','repeat')),
  estimated_competitor_count integer check (estimated_competitor_count is null or estimated_competitor_count >= 0),
  customer_budget numeric check (customer_budget is null or customer_budget >= 0),
  customer_budget_source text,
  project_fit_score integer not null default 3 check (project_fit_score between 1 and 5),
  relationship_score integer not null default 3 check (relationship_score between 1 and 5),
  scope_clarity_score integer not null default 3 check (scope_clarity_score between 1 and 5),
  capacity_score integer not null default 3 check (capacity_score between 1 and 5),
  margin_potential_score integer not null default 3 check (margin_potential_score between 1 and 5),
  payment_confidence_score integer not null default 3 check (payment_confidence_score between 1 and 5),
  competition_score integer not null default 3 check (competition_score between 1 and 5),
  risk_score integer not null default 3 check (risk_score between 1 and 5),
  estimator_effort_hours numeric check (estimator_effort_hours is null or estimator_effort_hours >= 0),
  pursuit_decision text not null default 'review' check (pursuit_decision in ('review','pursue','pass')),
  pass_reason text,
  proposal_sent_at timestamptz,
  last_follow_up_at timestamptz,
  outcome text not null default 'pending' check (outcome in ('pending','won','lost','no_decision','withdrawn')),
  lost_reason text,
  outcome_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bid_value_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  name text not null,
  customer_description text not null,
  sell_price_change numeric not null default 0,
  company_cost_change numeric not null default 0,
  schedule_days_change integer not null default 0,
  function_quality_note text,
  approval_required text,
  status text not null default 'suggested'
    check (status in ('suggested','presented','accepted','rejected','withdrawn')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bid_value_options_lead_idx
  on public.bid_value_options(lead_id, status, created_at desc);

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
create index if not exists proposal_engagement_presentation_idx
  on public.proposal_engagement_events(presentation_id, created_at desc);
create index if not exists proposal_engagement_unhandled_idx
  on public.proposal_engagement_events(company_id, handled_at, event_type, created_at desc);

-- Refuse unexpected presentation schemas; this migration only reconciles the accepted FK.
do $$
declare
  v_missing text[];
  v_token_attnum smallint;
  v_unique_exists boolean;
  v_fk record;
begin
  select array_agg(required.column_name order by required.column_name)
  into v_missing
  from (values
    ('id'), ('company_id'), ('estimate_id'), ('proposal_access_token_id'), ('lead_id'),
    ('proposal_number'), ('audience_type'), ('base_sell_price'), ('source_estimate_updated_at'),
    ('snapshot'), ('status'), ('response_state'), ('sent_at'), ('first_viewed_at'),
    ('last_viewed_at'), ('view_count'), ('last_response_at'), ('created_by'), ('created_at'), ('updated_at'),
    ('release_commercial_fingerprint'), ('release_warning_fingerprint'), ('release_acknowledgement_id')
  ) as required(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='proposal_presentations'
      and c.column_name=required.column_name
  );
  if v_missing is not null then
    raise exception 'proposal_presentations is incompatible; missing expected columns: %', array_to_string(v_missing, ', ');
  end if;

  if (select data_type from information_schema.columns where table_schema='public' and table_name='proposal_presentations' and column_name='proposal_access_token_id') <> 'uuid' then
    raise exception 'proposal_presentations.proposal_access_token_id must be uuid';
  end if;
  if exists(select 1 from public.proposal_presentations where proposal_access_token_id is null) then
    raise exception 'proposal_presentations contains rows without a token reference; stop for reconciliation';
  end if;
  alter table public.proposal_presentations alter column proposal_access_token_id set not null;

  select a.attnum into v_token_attnum
  from pg_attribute a where a.attrelid='public.proposal_presentations'::regclass
    and a.attname='proposal_access_token_id' and not a.attisdropped;
  select exists (
    select 1 from pg_constraint c
    where c.conrelid='public.proposal_presentations'::regclass
      and c.contype='u'
      and c.conname='proposal_presentations_proposal_access_token_id_key'
      and c.conkey=array[v_token_attnum]::smallint[]
    union all
    select 1 from pg_index i join pg_class idx on idx.oid=i.indexrelid
    where i.indrelid='public.proposal_presentations'::regclass
      and idx.relname='proposal_presentations_proposal_access_token_id_key'
      and i.indisunique and i.indnkeyatts=1 and i.indkey[0]=v_token_attnum
  ) into v_unique_exists;
  if not v_unique_exists then
    raise exception 'proposal_presentations must retain the accepted single-column UNIQUE key proposal_presentations_proposal_access_token_id_key';
  end if;

  select c.contype, c.confrelid, c.confdeltype into v_fk
  from pg_constraint c where c.conrelid='public.proposal_presentations'::regclass
    and c.contype='f' and c.conkey=array[v_token_attnum]::smallint[];
  if found and (v_fk.confrelid <> 'public.proposal_access_tokens'::regclass or v_fk.confdeltype <> 'c') then
    raise exception 'proposal_presentations token column has an incompatible foreign key';
  elsif not found then
    if exists (
      select 1 from public.proposal_presentations pp
      left join public.proposal_access_tokens t on t.id=pp.proposal_access_token_id
      where t.id is null
    ) then
      raise exception 'proposal_presentations contains token references without matching proposal_access_tokens rows';
    end if;
    alter table public.proposal_presentations
      add constraint proposal_presentations_access_token_fk
      foreign key (proposal_access_token_id) references public.proposal_access_tokens(id) on delete cascade;
  end if;

  if not exists(select 1 from pg_trigger where tgrelid='public.proposal_presentations'::regclass
    and tgname='guard_proposal_release' and not tgisinternal) then
    raise exception 'P1.4 guard_proposal_release trigger is missing; stop instead of replacing release authority';
  end if;
end $$;

create index if not exists proposal_presentations_estimate_idx
  on public.proposal_presentations(estimate_id, sent_at desc);
create index if not exists proposal_presentations_lead_idx
  on public.proposal_presentations(lead_id, status, sent_at desc);
create index if not exists proposal_presentations_company_status_idx
  on public.proposal_presentations(company_id, status, sent_at desc);

alter table public.proposal_access_tokens enable row level security;
alter table public.proposal_acceptances enable row level security;
alter table public.opportunity_sequences enable row level security;
alter table public.proposal_settings enable row level security;
alter table public.proposal_clarifications enable row level security;
alter table public.proposal_presentations enable row level security;
alter table public.proposal_engagement_events enable row level security;
alter table public.lead_activities enable row level security;
alter table public.lead_bid_intelligence enable row level security;
alter table public.bid_value_options enable row level security;

drop policy if exists "company access proposal tokens" on public.proposal_access_tokens;
create policy "company access proposal tokens" on public.proposal_access_tokens for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "company access proposal acceptances" on public.proposal_acceptances;
create policy "company access proposal acceptances" on public.proposal_acceptances for select to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "office access proposal settings" on public.proposal_settings;
create policy "office access proposal settings" on public.proposal_settings for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "office access proposal clarifications" on public.proposal_clarifications;
create policy "office access proposal clarifications" on public.proposal_clarifications for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "office access proposal presentations" on public.proposal_presentations;
drop policy if exists "qa company access proposal_presentations" on public.proposal_presentations;
create policy "office access proposal presentations" on public.proposal_presentations for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "office access proposal engagement" on public.proposal_engagement_events;
create policy "office access proposal engagement" on public.proposal_engagement_events for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "company access lead activities" on public.lead_activities;
create policy "company access lead activities" on public.lead_activities for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "office access lead bid intelligence" on public.lead_bid_intelligence;
create policy "office access lead bid intelligence" on public.lead_bid_intelligence for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');
drop policy if exists "office access bid value options" on public.bid_value_options;
create policy "office access bid value options" on public.bid_value_options for all to authenticated
  using (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee')
  with check (company_id=(select public.get_my_company_id()) and (select public.get_my_role())<>'employee');

-- Remove inherited broad grants, then grant only the operations used by the office Proposal workflow.
revoke all on table public.proposal_access_tokens, public.proposal_acceptances, public.opportunity_sequences,
  public.proposal_settings, public.proposal_clarifications, public.proposal_presentations,
  public.proposal_engagement_events, public.lead_activities, public.lead_bid_intelligence, public.bid_value_options
  from public, anon, authenticated;
grant all on table public.proposal_access_tokens, public.proposal_acceptances, public.opportunity_sequences,
  public.proposal_settings, public.proposal_clarifications, public.proposal_presentations,
  public.proposal_engagement_events, public.lead_activities, public.lead_bid_intelligence, public.bid_value_options
  to service_role;
grant select, insert, update on table public.proposal_access_tokens to authenticated;
grant select on table public.proposal_acceptances to authenticated;
grant select, insert, update on table public.proposal_settings to authenticated;
grant select, insert, delete on table public.proposal_clarifications to authenticated;
grant select, insert, update on table public.proposal_presentations to authenticated;
grant select, update on table public.proposal_engagement_events to authenticated;
grant insert on table public.lead_activities to authenticated;
grant select, insert, update on table public.lead_bid_intelligence to authenticated;
grant select, update on table public.bid_value_options to authenticated;

create or replace function public.next_opportunity_number_for_company(p_company uuid)
returns text language plpgsql security definer set search_path=public
as $$
declare
  v_year integer:=extract(year from now())::integer;
  v_next integer;
begin
  if p_company is null then raise exception 'Company required'; end if;
  insert into public.opportunity_sequences(company_id, opportunity_year, next_number)
    values(p_company, v_year, 1) on conflict(company_id, opportunity_year) do nothing;
  select next_number into v_next from public.opportunity_sequences
    where company_id=p_company and opportunity_year=v_year for update;
  update public.opportunity_sequences set next_number=v_next+1
    where company_id=p_company and opportunity_year=v_year;
  return right(v_year::text, 2)||'-'||lpad(v_next::text, 3, '0');
end;
$$;
revoke all on function public.next_opportunity_number_for_company(uuid) from public, anon, authenticated;
grant execute on function public.next_opportunity_number_for_company(uuid) to service_role;

create or replace function public.next_opportunity_number()
returns text language plpgsql security definer set search_path=public
as $$
declare v_company uuid;
begin
  v_company:=public.get_my_company_id();
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  return public.next_opportunity_number_for_company(v_company);
end;
$$;
revoke all on function public.next_opportunity_number() from public, anon;
grant execute on function public.next_opportunity_number() to authenticated, service_role;

-- Preserve the accepted immutable snapshot and make P1.4 release evidence immutable too.
create or replace function public.protect_proposal_presentation_snapshot()
returns trigger language plpgsql set search_path=public
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
     or new.created_at is distinct from old.created_at
     or new.release_commercial_fingerprint is distinct from old.release_commercial_fingerprint
     or new.release_warning_fingerprint is distinct from old.release_warning_fingerprint
     or new.release_acknowledgement_id is distinct from old.release_acknowledgement_id then
    raise exception 'Sent proposal snapshot and release evidence cannot be rewritten. Create a proposal revision instead.';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.proposal_presentations'::regclass
    and tgname='protect_proposal_presentation_snapshot' and not tgisinternal) then
    create trigger protect_proposal_presentation_snapshot before update on public.proposal_presentations
      for each row execute function public.protect_proposal_presentation_snapshot();
  end if;
end $$;

create or replace function public.sync_proposal_token_revocation()
returns trigger language plpgsql set search_path=public
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
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.proposal_access_tokens'::regclass
    and tgname='sync_proposal_token_revocation' and not tgisinternal) then
    create trigger sync_proposal_token_revocation after update of revoked_at on public.proposal_access_tokens
      for each row execute function public.sync_proposal_token_revocation();
  end if;
end $$;

create or replace function public.get_public_proposal(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  t public.proposal_access_tokens%rowtype;
  p public.proposal_presentations%rowtype;
  result jsonb;
begin
  select * into t from public.proposal_access_tokens
    where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return null; end if;
  select * into p from public.proposal_presentations where proposal_access_token_id=t.id;
  if found then
    return p.snapshot || jsonb_build_object(
      'presentation', jsonb_build_object('id',p.id,'status',p.status,'response_state',p.response_state,
        'sent_at',p.sent_at,'first_viewed_at',p.first_viewed_at,'last_viewed_at',p.last_viewed_at,
        'view_count',p.view_count,'last_response_at',p.last_response_at),
      'acceptance',(select jsonb_build_object('accepted_name',a.accepted_name,'accepted_email',a.accepted_email,
        'accepted_at',a.accepted_at,'acceptance_note',a.acceptance_note)
        from public.proposal_acceptances a where a.estimate_id=t.estimate_id order by a.accepted_at desc limit 1)
    );
  end if;
  select jsonb_build_object(
    'proposal_number',coalesce(t.proposal_number,'P-'||coalesce(e.opportunity_number,regexp_replace(e.estimate_number,'^E-',''))||'-R'||coalesce(e.version,0)::text),
    'valid_through',t.expires_at,'audience_type','general_contractor',
    'estimate',jsonb_build_object('id',e.id,'estimate_number',e.estimate_number,'version',e.version,'name',e.name,'expected_start_date',e.expected_start_date),
    'pricing',jsonb_build_object('base_sell_price',coalesce(s.selected_sell_price,0)),
    'company',jsonb_build_object('name',c.name,'display_name',bp.display_name,'legal_name',bp.legal_name,
      'address_line1',bp.address_line1,'address_line2',bp.address_line2,'city',bp.city,'state',bp.state,
      'postal_code',bp.postal_code,'phone',bp.phone,'email',bp.email,'website',bp.website,'ubi_number',bp.ubi_number,
      'contractor_license_number',bp.contractor_license_number,'logo_path',bp.logo_path),
    'lead',case when l.id is null then '{}'::jsonb else jsonb_build_object('customer_name',l.customer_name,
      'contact_name',l.contact_name,'email',l.email,'phone',l.phone,'project_name',l.project_name,'address',l.address,
      'city',l.city,'state',l.state,'postal_code',l.postal_code) end,
    'project',case when pr.id is null then '{}'::jsonb else jsonb_build_object('job_number',pr.job_number,'name',pr.name,
      'address',pr.address,'city',pr.city,'state',pr.state) end,
    'content',jsonb_build_object('executive_summary',null,'customer_message',null,'schedule_summary',null,
      'payment_summary',null,'warranty_summary',null,'why_carez',null,'pricing_note',null,
      'terms_text',bp.default_terms_text,'show_quantities',true),
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',es.id,'name',es.name,'scope_type',es.scope_type,'sort_order',es.sort_order) order by es.sort_order)
      from public.estimate_sections es where es.estimate_id=e.id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',ei.id,'section_id',ei.section_id,'description',ei.description,
      'quantity',ei.quantity,'unit',ei.unit,'item_type',ei.item_type,'sort_order',ei.sort_order) order by ei.sort_order)
      from public.estimate_items ei where ei.estimate_id=e.id),'[]'::jsonb),
    'clarifications','[]'::jsonb,'options','[]'::jsonb,
    'acceptance',(select jsonb_build_object('accepted_name',a.accepted_name,'accepted_email',a.accepted_email,
      'accepted_at',a.accepted_at,'acceptance_note',a.acceptance_note)
      from public.proposal_acceptances a where a.estimate_id=e.id order by a.accepted_at desc limit 1)
  ) into result
  from public.estimates e join public.companies c on c.id=e.company_id
  left join public.company_billing_profiles bp on bp.company_id=e.company_id
  left join public.leads l on l.id=e.lead_id left join public.projects pr on pr.id=e.project_id
  left join public.estimate_financial_summary s on s.estimate_id=e.id where e.id=t.estimate_id;
  return result;
end;
$$;
revoke all on function public.get_public_proposal(uuid) from public;
grant execute on function public.get_public_proposal(uuid) to anon, authenticated, service_role;

create or replace function public.track_public_proposal_view(p_token uuid)
returns boolean language plpgsql security definer set search_path=public
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
  select exists(select 1 from public.proposal_engagement_events ev where ev.presentation_id=p.id
    and ev.event_type='view' and ev.created_at>now()-interval '15 minutes') into v_recent;
  update public.proposal_presentations set first_viewed_at=coalesce(first_viewed_at,now()),last_viewed_at=now(),
    view_count=view_count+case when v_recent then 0 else 1 end,status=case when status='sent' then 'viewed' else status end,
    updated_at=now() where id=p.id;
  if not v_recent then
    insert into public.proposal_engagement_events(company_id,presentation_id,event_type) values(p.company_id,p.id,'view');
  end if;
  return true;
end;
$$;
revoke all on function public.track_public_proposal_view(uuid) from public;
grant execute on function public.track_public_proposal_view(uuid) to anon, authenticated, service_role;

create or replace function public.submit_public_proposal_response(
  p_token uuid, p_response_type text, p_name text default null, p_email text default null,
  p_message text default null, p_decline_reason text default null, p_option_id uuid default null
)
returns boolean language plpgsql security definer set search_path=public
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
  if p_response_type not in ('question','change_request','option_interest','decline') then raise exception 'Unsupported proposal response'; end if;
  select * into t from public.proposal_access_tokens where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
  if not found then return false; end if;
  select * into p from public.proposal_presentations where proposal_access_token_id=t.id for update;
  if not found then raise exception 'This proposal link must be reissued before sending a response.'; end if;
  select * into e from public.estimates where id=t.estimate_id;
  if p_response_type='option_interest' then
    if p_option_id is null then raise exception 'Choose an option'; end if;
    select exists(select 1 from jsonb_array_elements(coalesce(p.snapshot->'options','[]'::jsonb)) x where x->>'id'=p_option_id::text) into v_option_ok;
    if not v_option_ok then raise exception 'This option is not part of the sent proposal'; end if;
  end if;
  v_event:=case p_response_type when 'change_request' then 'change_request' else p_response_type end;
  v_state:=case p_response_type when 'question' then 'question' when 'change_request' then 'change_requested'
    when 'option_interest' then 'option_interest' else 'declined' end;
  v_reason:=nullif(trim(coalesce(p_decline_reason,'')), '');
  insert into public.proposal_engagement_events(company_id,presentation_id,event_type,customer_name,customer_email,customer_message,decline_reason,option_id)
    values(p.company_id,p.id,v_event,nullif(trim(coalesce(p_name,'')),''),nullif(trim(coalesce(p_email,'')),''),
      nullif(trim(coalesce(p_message,'')),''),v_reason,p_option_id);
  update public.proposal_presentations set response_state=v_state,
    status=case when p_response_type='decline' then 'declined' else 'needs_reply' end,last_response_at=now(),updated_at=now()
    where id=p.id;
  if e.lead_id is not null then
    if p_response_type='decline' then
      update public.leads set status='lost',follow_up=null,updated_at=now() where id=e.lead_id and company_id=e.company_id;
      insert into public.lead_bid_intelligence(company_id,lead_id,outcome,lost_reason,outcome_note,updated_at)
        values(e.company_id,e.lead_id,'lost',coalesce(v_reason,'customer_declined'),nullif(trim(coalesce(p_message,'')),''),now())
        on conflict(lead_id) do update set outcome='lost',lost_reason=excluded.lost_reason,
          outcome_note=coalesce(excluded.outcome_note,public.lead_bid_intelligence.outcome_note),updated_at=now();
    else
      update public.leads set status='follow_up',follow_up=current_date,updated_at=now()
        where id=e.lead_id and company_id=e.company_id and status not in ('won','lost');
    end if;
    insert into public.lead_activities(company_id,lead_id,activity_type,note,next_follow_up)
      values(e.company_id,e.lead_id,'proposal_response',case p_response_type
        when 'question' then 'Customer asked a question on '||p.proposal_number
        when 'change_request' then 'Customer requested a proposal change on '||p.proposal_number
        when 'option_interest' then 'Customer is interested in a proposal option on '||p.proposal_number
        else 'Customer declined '||p.proposal_number||case when v_reason is not null then ': '||v_reason else '' end end,
        case when p_response_type='decline' then null else current_date end);
  end if;
  return true;
end;
$$;
revoke all on function public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid) from public;
grant execute on function public.submit_public_proposal_response(uuid,text,text,text,text,text,uuid) to anon, authenticated, service_role;

create or replace view public.proposal_conversion_queue with (security_invoker=true) as
with base as (
  select pp.company_id,pp.id as presentation_id,pp.estimate_id,pp.proposal_access_token_id,pp.lead_id,
    pp.proposal_number,pp.audience_type,pp.base_sell_price,pp.status as presentation_status,pp.response_state,
    pp.sent_at,pp.first_viewed_at,pp.last_viewed_at,pp.view_count,pp.last_response_at,t.token,t.expires_at,t.revoked_at,
    e.estimate_number,e.version as estimate_version,e.name as estimate_name,l.customer_name,l.contact_name,
    l.project_name,l.email as customer_email,l.phone as customer_phone,l.follow_up as lead_follow_up,a.accepted_at,
    coalesce((select count(*) from public.proposal_engagement_events ev where ev.presentation_id=pp.id
      and ev.event_type<>'view' and ev.handled_at is null),0)::integer as unhandled_response_count
  from public.proposal_presentations pp join public.proposal_access_tokens t on t.id=pp.proposal_access_token_id
  join public.estimates e on e.id=pp.estimate_id left join public.leads l on l.id=pp.lead_id
  left join lateral (select accepted_at from public.proposal_acceptances pa where pa.estimate_id=pp.estimate_id order by accepted_at desc limit 1) a on true
), staged as (
  select b.*,case when b.accepted_at is not null or b.presentation_status='accepted' then 'accepted'
    when b.presentation_status='superseded' then 'superseded' when b.revoked_at is not null or b.presentation_status='revoked' then 'revoked'
    when b.expires_at is not null and b.expires_at<=now() then 'expired'
    when b.presentation_status='declined' or b.response_state='declined' then 'declined'
    when b.unhandled_response_count>0 or b.presentation_status='needs_reply' then 'needs_reply'
    when b.first_viewed_at is not null then 'viewed' else 'sent' end as conversion_stage from base b
), due as (
  select s.*,case when s.conversion_stage in ('accepted','declined','superseded','revoked','expired') then null::date
    when s.conversion_stage='needs_reply' then current_date when s.lead_follow_up is not null then s.lead_follow_up
    when s.first_viewed_at is null then (s.sent_at+interval '2 days')::date
    else (coalesce(s.last_viewed_at,s.first_viewed_at)+interval '2 days')::date end as follow_up_due from staged s
)
select d.*,(d.follow_up_due is not null and d.follow_up_due<=current_date) as follow_up_due_now,
  case d.conversion_stage when 'accepted' then 'Awarded — start job setup' when 'declined' then 'Closed — review loss reason'
    when 'superseded' then 'Newer proposal revision issued' when 'revoked' then 'Proposal link turned off'
    when 'expired' then 'Issue a current proposal revision' when 'needs_reply' then 'Reply to customer'
    when 'viewed' then 'Follow up after customer review' else 'Confirm receipt / follow up' end as next_action from due d;
revoke all on table public.proposal_conversion_queue from anon, authenticated;
grant select on table public.proposal_conversion_queue to authenticated, service_role;

-- Acceptance/award is intentionally excluded: its historical implementation requires the full Job Spine contract.
-- create_estimate_revision remains deferred pending a current lineage-safe Estimate revision contract.
