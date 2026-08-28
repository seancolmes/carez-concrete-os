-- Carez sales pipeline numbering + Outlook lead intake

create extension if not exists pgcrypto;

create table if not exists public.opportunity_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_year integer not null,
  next_number integer not null default 1,
  primary key(company_id, opportunity_year)
);

create or replace function public.next_opportunity_number_for_company(p_company uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_year integer:=extract(year from now())::integer;
  v_next integer;
begin
  if p_company is null then raise exception 'Company required'; end if;
  insert into public.opportunity_sequences(company_id,opportunity_year,next_number)
  values(p_company,v_year,1)
  on conflict(company_id,opportunity_year) do nothing;
  select next_number into v_next from public.opportunity_sequences
  where company_id=p_company and opportunity_year=v_year for update;
  update public.opportunity_sequences set next_number=v_next+1
  where company_id=p_company and opportunity_year=v_year;
  return right(v_year::text,2)||'-'||lpad(v_next::text,3,'0');
end;
$$;
revoke all on function public.next_opportunity_number_for_company(uuid) from public,anon,authenticated;

create or replace function public.next_opportunity_number()
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_company uuid;
begin
  v_company:=public.get_my_company_id();
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  return public.next_opportunity_number_for_company(v_company);
end;
$$;
grant execute on function public.next_opportunity_number() to authenticated;

alter table public.leads add column if not exists opportunity_number text;
alter table public.leads add column if not exists contact_name text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists postal_code text;
alter table public.leads add column if not exists source_message_id text;
alter table public.leads add column if not exists source_conversation_id text;
create unique index if not exists leads_company_opportunity_number_key on public.leads(company_id,opportunity_number) where opportunity_number is not null;

alter table public.estimates add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.estimates add column if not exists opportunity_number text;
create index if not exists estimates_lead_idx on public.estimates(lead_id,created_at desc);

alter table public.projects add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.projects add column if not exists source_estimate_id uuid references public.estimates(id) on delete set null;
create unique index if not exists projects_company_job_number_key on public.projects(company_id,job_number) where job_number is not null;

alter table public.proposal_access_tokens add column if not exists proposal_number text;

create table if not exists public.outlook_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  microsoft_user_id text,
  mailbox_email text,
  mailbox_name text,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_auth_tag text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_auth_tag text not null,
  token_expires_at timestamptz not null,
  subscription_id text,
  subscription_client_state text,
  subscription_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  status text not null default 'active' check(status in ('active','needs_attention','disconnected')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outlook_connections enable row level security;
drop policy if exists "owner access outlook connections" on public.outlook_connections;
create policy "owner access outlook connections" on public.outlook_connections for all to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

create table if not exists public.outlook_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  outlook_message_id text not null,
  conversation_id text,
  internet_message_id text,
  subject text,
  sender_name text,
  sender_email text,
  received_at timestamptz,
  body_preview text,
  web_link text,
  classification text,
  confidence numeric,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(company_id,outlook_message_id)
);
alter table public.outlook_messages enable row level security;
drop policy if exists "owner access outlook messages" on public.outlook_messages;
create policy "owner access outlook messages" on public.outlook_messages for all to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

create table if not exists public.lead_inbox_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  outlook_message_id uuid not null references public.outlook_messages(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','created','merged','ignored')),
  confidence numeric not null default 0,
  customer_name text,
  contact_name text,
  email text,
  phone text,
  project_name text,
  address text,
  city text,
  state text default 'WA',
  postal_code text,
  scope text,
  bid_due date,
  created_lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,outlook_message_id)
);
alter table public.lead_inbox_candidates enable row level security;
drop policy if exists "owner access lead inbox candidates" on public.lead_inbox_candidates;
create policy "owner access lead inbox candidates" on public.lead_inbox_candidates for all to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');

-- Webhook workers may retrieve a connection only when Microsoft returns the matching random client state.
create or replace function public.outlook_webhook_connection(p_subscription_id text,p_client_state text)
returns table(
  id uuid,company_id uuid,access_token_ciphertext text,access_token_iv text,access_token_auth_tag text,
  refresh_token_ciphertext text,refresh_token_iv text,refresh_token_auth_tag text,token_expires_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select c.id,c.company_id,c.access_token_ciphertext,c.access_token_iv,c.access_token_auth_tag,
         c.refresh_token_ciphertext,c.refresh_token_iv,c.refresh_token_auth_tag,c.token_expires_at
  from public.outlook_connections c
  where c.subscription_id=p_subscription_id and c.subscription_client_state=p_client_state and c.status='active'
  limit 1;
$$;
revoke all on function public.outlook_webhook_connection(text,text) from public;
grant execute on function public.outlook_webhook_connection(text,text) to anon,authenticated;

create or replace function public.outlook_webhook_update_tokens(
  p_subscription_id text,p_client_state text,p_access_cipher text,p_access_iv text,p_access_tag text,
  p_refresh_cipher text,p_refresh_iv text,p_refresh_tag text,p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.outlook_connections set
    access_token_ciphertext=p_access_cipher,access_token_iv=p_access_iv,access_token_auth_tag=p_access_tag,
    refresh_token_ciphertext=p_refresh_cipher,refresh_token_iv=p_refresh_iv,refresh_token_auth_tag=p_refresh_tag,
    token_expires_at=p_expires_at,updated_at=now(),last_error=null
  where subscription_id=p_subscription_id and subscription_client_state=p_client_state and status='active';
  return found;
end;
$$;
revoke all on function public.outlook_webhook_update_tokens(text,text,text,text,text,text,text,text,timestamptz) from public;
grant execute on function public.outlook_webhook_update_tokens(text,text,text,text,text,text,text,text,timestamptz) to anon,authenticated;

create or replace function public.outlook_ingest_message(
  p_subscription_id text,p_client_state text,p_message jsonb,p_candidate jsonb,p_auto_create boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_conn public.outlook_connections%rowtype;
  v_msg public.outlook_messages%rowtype;
  v_lead uuid;
  v_opp text;
  v_customer text;
  v_project text;
begin
  select * into v_conn from public.outlook_connections
  where subscription_id=p_subscription_id and subscription_client_state=p_client_state and status='active';
  if not found then raise exception 'Invalid Outlook notification'; end if;

  insert into public.outlook_messages(company_id,outlook_message_id,conversation_id,internet_message_id,subject,sender_name,sender_email,received_at,body_preview,web_link,classification,confidence)
  values(v_conn.company_id,p_message->>'id',p_message->>'conversationId',p_message->>'internetMessageId',p_message->>'subject',p_message->>'senderName',p_message->>'senderEmail',nullif(p_message->>'receivedDateTime','')::timestamptz,p_message->>'bodyPreview',p_message->>'webLink',p_candidate->>'classification',coalesce((p_candidate->>'confidence')::numeric,0))
  on conflict(company_id,outlook_message_id) do update set classification=excluded.classification,confidence=excluded.confidence
  returning * into v_msg;

  if v_msg.lead_id is not null then return jsonb_build_object('status','existing','lead_id',v_msg.lead_id); end if;

  v_customer:=coalesce(nullif(p_candidate->>'customerName',''),nullif(p_message->>'senderName',''),nullif(p_message->>'senderEmail',''),'Unknown Customer');
  v_project:=coalesce(nullif(p_candidate->>'projectName',''),
    v_customer||case when nullif(p_candidate->>'address','') is not null then ' - '||(p_candidate->>'address') when nullif(p_candidate->>'city','') is not null then ' - '||(p_candidate->>'city') else '' end);

  if p_auto_create then
    v_opp:=public.next_opportunity_number_for_company(v_conn.company_id);
    insert into public.leads(company_id,opportunity_number,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,bid_due,status,source,source_message_id,source_conversation_id,notes)
    values(v_conn.company_id,v_opp,v_customer,nullif(p_candidate->>'contactName',''),nullif(p_candidate->>'email',''),nullif(p_candidate->>'phone',''),v_project,nullif(p_candidate->>'address',''),nullif(p_candidate->>'city',''),coalesce(nullif(p_candidate->>'state',''),'WA'),nullif(p_candidate->>'postalCode',''),nullif(p_candidate->>'scope',''),nullif(p_candidate->>'bidDue','')::date,'new','outlook',p_message->>'id',p_message->>'conversationId','Automatically created from Outlook')
    returning id into v_lead;
    update public.outlook_messages set lead_id=v_lead where id=v_msg.id;
    insert into public.lead_activities(company_id,lead_id,activity_type,note)
    values(v_conn.company_id,v_lead,'email','Lead automatically created from Outlook email: '||coalesce(p_message->>'subject','No subject'));
    return jsonb_build_object('status','created','lead_id',v_lead,'opportunity_number',v_opp);
  end if;

  insert into public.lead_inbox_candidates(company_id,outlook_message_id,confidence,customer_name,contact_name,email,phone,project_name,address,city,state,postal_code,scope,bid_due)
  values(v_conn.company_id,v_msg.id,coalesce((p_candidate->>'confidence')::numeric,0),v_customer,nullif(p_candidate->>'contactName',''),nullif(p_candidate->>'email',''),nullif(p_candidate->>'phone',''),v_project,nullif(p_candidate->>'address',''),nullif(p_candidate->>'city',''),coalesce(nullif(p_candidate->>'state',''),'WA'),nullif(p_candidate->>'postalCode',''),nullif(p_candidate->>'scope',''),nullif(p_candidate->>'bidDue','')::date)
  on conflict(company_id,outlook_message_id) do nothing;
  return jsonb_build_object('status','candidate');
end;
$$;
revoke all on function public.outlook_ingest_message(text,text,jsonb,jsonb,boolean) from public;
grant execute on function public.outlook_ingest_message(text,text,jsonb,jsonb,boolean) to anon,authenticated;

-- Awarding an accepted proposal creates the job number and freezes the original budget automatically.
create or replace function public.award_accepted_estimate(p_estimate_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  e public.estimates%rowtype;
  l public.leads%rowtype;
  s record;
  v_project uuid;
  v_customer uuid;
  v_budget uuid;
  v_now timestamptz:=now();
begin
  select * into e from public.estimates where id=p_estimate_id for update;
  if not found then raise exception 'Estimate not found'; end if;
  select * into s from public.estimate_financial_summary where estimate_id=e.id;
  if e.lead_id is not null then select * into l from public.leads where id=e.lead_id; end if;

  v_project:=e.project_id;
  if v_project is null then
    v_customer:=l.customer_id;
    if v_customer is null and nullif(l.email,'') is not null then
      select id into v_customer from public.customers where company_id=e.company_id and lower(email)=lower(l.email) limit 1;
    end if;
    if v_customer is null then
      insert into public.customers(company_id,name,contact_name,email,phone,billing_address_line1,billing_city,billing_state,billing_postal_code)
      values(e.company_id,coalesce(nullif(l.customer_name,''),e.name),l.contact_name,l.email,l.phone,l.address,l.city,l.state,l.postal_code)
      returning id into v_customer;
      if l.id is not null then update public.leads set customer_id=v_customer where id=l.id; end if;
    end if;

    insert into public.projects(company_id,customer_id,lead_id,source_estimate_id,job_number,name,address,city,state,status,contract_value,target_margin_percent,bo_classification,bo_rate_percent,payment_processing_rate_percent,estimated_labor_hours,estimated_labor_cost)
    values(e.company_id,v_customer,e.lead_id,e.id,coalesce(e.opportunity_number,l.opportunity_number),coalesce(nullif(l.project_name,''),e.name),l.address,l.city,coalesce(l.state,'WA'),'active',coalesce(s.selected_sell_price,0),e.target_margin_percent,e.bo_classification,e.bo_rate_percent,e.payment_processing_rate_percent,coalesce(s.labor_hours,0),coalesce(s.direct_labor_cost,0))
    returning id into v_project;
    update public.estimates set project_id=v_project where id=e.id;
  end if;

  select id into v_budget from public.project_budgets where estimate_id=e.id and budget_type='original' and status='active' limit 1;
  if v_budget is null then
    insert into public.project_budgets(company_id,project_id,estimate_id,budget_type,version,status,label,approved_at,sell_price,target_margin_percent,bo_rate_percent,payment_processing_rate_percent,labor_hours,direct_labor_cost,material_cost,equipment_cost,subcontractor_cost,other_direct_cost,total_direct_cost,overhead_cost,revenue_cost_reserve,total_company_cost,budgeted_profit,budgeted_margin_percent)
    values(e.company_id,v_project,e.id,'original',e.version,'active',e.estimate_number||'-R'||e.version||' Accepted Budget',v_now,coalesce(s.selected_sell_price,0),e.target_margin_percent,e.bo_rate_percent,e.payment_processing_rate_percent,coalesce(s.labor_hours,0),coalesce(s.direct_labor_cost,0),coalesce(s.material_cost,0),coalesce(s.equipment_cost,0),coalesce(s.subcontractor_cost,0),coalesce(s.other_direct_cost,0),coalesce(s.total_direct_cost,0),coalesce(s.overhead_cost,0),coalesce(s.revenue_cost_reserve,0),coalesce(s.base_company_cost,0)+coalesce(s.revenue_cost_reserve,0),coalesce(s.selected_sell_price,0)-(coalesce(s.base_company_cost,0)+coalesce(s.revenue_cost_reserve,0)),coalesce(s.projected_margin_percent,0))
    returning id into v_budget;

    insert into public.project_budget_sections(company_id,budget_id,source_estimate_section_id,name,scope_type,sort_order)
    select company_id,v_budget,id,name,scope_type,sort_order from public.estimate_sections where estimate_id=e.id;

    insert into public.project_budget_lines(company_id,budget_id,budget_section_id,source_estimate_item_id,item_type,cost_code_id,catalog_item_id,crew_member_id,labor_task,risk_class_code,description,quantity,unit,unit_cost,direct_cost,regular_hours,overtime_hours,notes,sort_order)
    select i.company_id,v_budget,bs.id,i.id,i.item_type,i.cost_code_id,i.catalog_item_id,i.crew_member_id,i.labor_task,i.risk_class_code,i.description,i.quantity,i.unit,i.unit_cost,i.direct_cost,i.regular_hours,i.overtime_hours,i.notes,i.sort_order
    from public.estimate_items i
    left join public.project_budget_sections bs on bs.budget_id=v_budget and bs.source_estimate_section_id=i.section_id
    where i.estimate_id=e.id;
  end if;

  update public.estimates set status='accepted',approved_at=v_now,project_id=v_project where id=e.id;
  if e.lead_id is not null then update public.leads set status='won',updated_at=v_now where id=e.lead_id; end if;
  return v_project;
end;
$$;
revoke all on function public.award_accepted_estimate(uuid) from public,anon,authenticated;

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
  select * into t from public.proposal_access_tokens where token=p_token and revoked_at is null and (expires_at is null or expires_at>now());
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
