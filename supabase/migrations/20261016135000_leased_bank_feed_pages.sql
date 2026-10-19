-- Leased, page-atomic provider synchronization. No cash inclusion formula changes.
-- Order after recovered Plaid tables, 123500 financial request wrappers, 128500
-- finance role boundary, and 134600 remittance reversals. Requires qualified134600 cash reversals.
set local search_path=pg_catalog,public,extensions,pg_temp;

-- Existing id PK makes this tenant key valid without filling any record field.
create unique index if not exists carez_plaid_connection_id_company_key on public.plaid_connections(id,company_id);

alter table public.plaid_connections add column sync_contract_version text;
alter table public.plaid_transactions add column matched_source_change jsonb;
do $$declare definition text;begin
 definition:=regexp_replace(pg_get_viewdef('public.plaid_transaction_feed'::regclass,true),';[[:space:]]*$','');
 execute 'create or replace view public.plaid_transaction_feed with(security_invoker=true) as select old.*,t.matched_source_change from ('||definition||') old join public.plaid_transactions t on t.company_id=old.company_id and t.id=old.id';
end $$;

create table public.carez_plaid_sync_runs (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 connection_id uuid not null,
 actor_id uuid not null references auth.users(id),
 state text not null check(state in ('running','incomplete','failed','complete')),
 lease_token uuid not null, lease_expires_at timestamptz not null,
 cycle_start_cursor text, next_cursor text,
 generation bigint not null default 0 check(generation>=0),
 next_page bigint not null default 0 check(next_page>=0),
 last_error_code text,last_error_message text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(connection_id,company_id) references public.plaid_connections(id,company_id) on delete cascade
);
create unique index carez_plaid_one_open_run on public.carez_plaid_sync_runs(connection_id) where state<>'complete';
create table public.carez_plaid_sync_pages (
 run_id uuid not null references public.carez_plaid_sync_runs(id) on delete cascade,
 page_id uuid not null,payload_hash bytea not null,result jsonb not null,
 generation bigint not null,page_index bigint not null,
 actor_id uuid not null references auth.users(id),
 committed_at timestamptz not null default clock_timestamp(),
 primary key(run_id,page_id),unique(run_id,generation,page_index)
);
create table public.carez_plaid_connection_requests (
 company_id uuid not null references public.companies(id) on delete cascade,
 request_id uuid not null,actor_id uuid not null references auth.users(id),
 payload_hash bytea not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,request_id)
);
alter table public.carez_plaid_sync_runs enable row level security;
alter table public.carez_plaid_sync_pages enable row level security;
alter table public.carez_plaid_connection_requests enable row level security;
revoke all on public.carez_plaid_sync_runs,public.carez_plaid_sync_pages,public.carez_plaid_connection_requests from public,anon,authenticated;
grant all on public.carez_plaid_sync_runs,public.carez_plaid_sync_pages,public.carez_plaid_connection_requests to service_role;

-- Required integration hook: call from automatic apply-rule/existing-match/
-- transfer governing wrappers after their financial_request_begin company lock.
-- Its call sites are deliberately not rewritten by dynamic string replacement.
create function public.carez_plaid_require_complete_feed(p_company uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
 perform 1 from public.companies where id=p_company for update;
 if not found then raise exception 'Company unavailable';end if;
 if exists(select 1 from public.carez_plaid_sync_runs where company_id=p_company and state<>'complete')
  or exists(select 1 from public.plaid_connections where company_id=p_company and status<>'disconnected'
   and (sync_contract_version is distinct from 'leased_pages_v1' or last_transactions_sync_at is null or transactions_cursor is null)) then
  raise exception 'Bank synchronization is incomplete. Complete sync before automatic reconciliation';end if;
end $$;
revoke all on function public.carez_plaid_require_complete_feed(uuid) from public,anon,authenticated,service_role;
create function public.carez_plaid_analysis_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare company uuid;unfinished integer;begin
 select company_id into company from public.profiles where id=auth.uid();
 perform 1 from public.companies where id=company for update;
 if not found or not exists(select 1 from public.profiles where id=auth.uid() and company_id=company and role in ('owner','office')) then raise exception 'Owner or office authority required';end if;
 select count(*)::integer into unfinished from public.plaid_connections c where c.company_id=company
  and (exists(select 1 from public.carez_plaid_sync_runs r where r.company_id=company and r.connection_id=c.id and r.state<>'complete')
   or (c.status<>'disconnected' and (c.sync_contract_version is distinct from 'leased_pages_v1' or c.last_transactions_sync_at is null or c.transactions_cursor is null)));
 return jsonb_build_object('ok',true,'ready',unfinished=0,'unfinished_connections',unfinished);
end $$;
revoke all on function public.carez_plaid_analysis_status() from public,anon;
grant execute on function public.carez_plaid_analysis_status() to authenticated;

-- Callers derive actor/company from verified getUser(), never request JSON.
-- This helper locks company before connection/run/transaction locks and repeats
-- current authority after that company lock. Only service entry points call it.
create function public.carez_plaid_service_lock(p_company uuid,p_actor uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server provider writer required';end if;
 perform 1 from public.companies where id=p_company for update;
 if not found then raise exception 'Company unavailable';end if;
 if not exists(select 1 from public.profiles where id=p_actor and company_id=p_company and role in ('owner','office')) then
  raise exception 'Owner or office authority required';end if;
end $$;
revoke all on function public.carez_plaid_service_lock(uuid,uuid) from public,anon,authenticated,service_role;

create function public.carez_plaid_sync_begin(p_company uuid,p_actor uuid,p_connection uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare c public.plaid_connections%rowtype;r public.carez_plaid_sync_runs%rowtype;
begin
 perform public.carez_plaid_service_lock(p_company,p_actor);
 if p_lease is null then raise exception 'Lease identity required';end if;
 select * into c from public.plaid_connections where id=p_connection and company_id=p_company for update;
 if not found or c.status='disconnected' then raise exception 'Connected bank unavailable';end if;
 select * into r from public.carez_plaid_sync_runs where connection_id=c.id and company_id=p_company and state<>'complete' for update;
 if found then
  if r.state='running' and r.lease_expires_at>clock_timestamp() and r.lease_token<>p_lease then
   return jsonb_build_object('ok',true,'busy',true,'connection_id',c.id);end if;
  if c.transactions_cursor is distinct from r.cycle_start_cursor then raise exception 'Completed cursor changed outside its run';end if;
  -- Plaid pagination mutation requires restarting from the cursor before the
  -- affected update, not the cursor of the last partially committed page.
  if r.last_error_code='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' then
   r.next_cursor:=r.cycle_start_cursor;r.generation:=r.generation+1;r.next_page:=0;
  end if;
  update public.carez_plaid_sync_runs set state='running',actor_id=p_actor,lease_token=p_lease,
   lease_expires_at=clock_timestamp()+interval '120 seconds',next_cursor=r.next_cursor,
   generation=r.generation,next_page=r.next_page,last_error_code=null,last_error_message=null,updated_at=clock_timestamp()
   where id=r.id returning * into r;
 else
  insert into public.carez_plaid_sync_runs(company_id,connection_id,actor_id,state,lease_token,lease_expires_at,cycle_start_cursor,next_cursor)
   values(p_company,c.id,p_actor,'running',p_lease,clock_timestamp()+interval '120 seconds',c.transactions_cursor,c.transactions_cursor) returning * into r;
 end if;
 return jsonb_build_object('ok',true,'busy',false,'connection_id',c.id,'run_id',r.id,'lease_token',r.lease_token,
  'generation',r.generation,'page_index',r.next_page,'cursor',r.next_cursor,
  'access_token_ciphertext',c.access_token_ciphertext,'token_iv',c.token_iv,'token_auth_tag',c.token_auth_tag);
end $$;

create function public.carez_plaid_sync_renew(p_company uuid,p_actor uuid,p_connection uuid,p_run uuid,p_lease uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 perform public.carez_plaid_service_lock(p_company,p_actor);
 perform 1 from public.plaid_connections where id=p_connection and company_id=p_company and status<>'disconnected' for update;
 if not found then raise exception 'Connected bank unavailable';end if;
 update public.carez_plaid_sync_runs set lease_expires_at=clock_timestamp()+interval '120 seconds',updated_at=clock_timestamp()
  where id=p_run and company_id=p_company and connection_id=p_connection and actor_id=p_actor
   and state='running' and lease_token=p_lease and lease_expires_at>clock_timestamp();
 if not found then raise exception 'Sync lease expired or superseded';end if;
 return jsonb_build_object('ok',true);
end $$;

-- A null balance is unknown. Missing/invalid numbers are never coerced to zero.
create function public.carez_plaid_number(p_value jsonb,p_key text,p_nullable boolean default false) returns numeric
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare n numeric;begin
 if not(p_value?p_key) then raise exception 'Provider number % missing',p_key;end if;
 if p_value->p_key='null'::jsonb and p_nullable then return null;end if;
 if jsonb_typeof(p_value->p_key) is distinct from 'number' then raise exception 'Provider number % invalid',p_key;end if;
 n:=(p_value->>p_key)::numeric;
 if n::text in ('NaN','Infinity','-Infinity') or n<>round(n,2) then raise exception 'Provider number % invalid',p_key;end if;
 return n;
end $$;
revoke all on function public.carez_plaid_number(jsonb,text,boolean) from public,anon,authenticated,service_role;

create function public.carez_plaid_sync_commit_page(
 p_company uuid,p_actor uuid,p_connection uuid,p_run uuid,p_lease uuid,p_page_id uuid,
 p_generation bigint,p_page_index bigint,p_expected_cursor text,p_page jsonb,
 p_accounts jsonb default null,p_realtime_balance boolean default false
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare c public.plaid_connections%rowtype;r public.carez_plaid_sync_runs%rowtype;
 prior public.carez_plaid_sync_pages%rowtype;fingerprint bytea;v jsonb;rows jsonb;
 v_next_cursor text;more boolean;account_id uuid;amount numeric;cash numeric;
 changed integer:=0;removed_count integer:=0;matched_changed integer:=0;account_count integer:=0;
 prior_tx public.plaid_transactions%rowtype;source_change jsonb;answer jsonb;changed_ids uuid[]:='{}'::uuid[];saved_id uuid;now_at timestamptz:=clock_timestamp();
begin
 perform public.carez_plaid_service_lock(p_company,p_actor);
 if p_page_id is null or p_generation is null or p_page_index is null or p_generation<0 or p_page_index<0 then raise exception 'Page identity required';end if;
 select * into c from public.plaid_connections where id=p_connection and company_id=p_company for update;
 if not found then raise exception 'Connected bank unavailable';end if;
 select * into r from public.carez_plaid_sync_runs where id=p_run and company_id=p_company and connection_id=c.id for update;
 if not found then raise exception 'Sync run unavailable';end if;
 fingerprint:=extensions.digest(convert_to(jsonb_build_object('generation',p_generation,'page_index',p_page_index,
  'cursor',p_expected_cursor,'page',p_page,'accounts',p_accounts,'realtime_balance',p_realtime_balance)::text,'UTF8'),'sha256');
 select * into prior from public.carez_plaid_sync_pages where run_id=r.id and page_id=p_page_id;
 if found then
  if prior.payload_hash is distinct from fingerprint then raise exception 'Page identity reused with different content';end if;
  return prior.result; -- Acknowledges an already committed page; never renews an old lease.
 end if;
 if c.status='disconnected' or r.state<>'running' or r.actor_id<>p_actor or r.lease_token is distinct from p_lease or r.lease_expires_at<=clock_timestamp() then
  raise exception 'Sync lease expired or superseded';end if;
 if r.generation<>p_generation or r.next_page<>p_page_index or r.next_cursor is distinct from p_expected_cursor
  or c.transactions_cursor is distinct from r.cycle_start_cursor then raise exception 'Sync cursor or page changed';end if;
 if jsonb_typeof(p_page) is distinct from 'object' or jsonb_typeof(p_page->'added') is distinct from 'array'
  or jsonb_typeof(p_page->'modified') is distinct from 'array' or jsonb_typeof(p_page->'removed') is distinct from 'array'
  or jsonb_typeof(p_page->'has_more') is distinct from 'boolean' or jsonb_typeof(p_page->'next_cursor') is distinct from 'string'
  or nullif(p_page->>'next_cursor','') is null or p_realtime_balance is null then raise exception 'Complete provider page required';end if;
 v_next_cursor:=p_page->>'next_cursor';more:=(p_page->>'has_more')::boolean;
 if more and v_next_cursor is not distinct from p_expected_cursor then raise exception 'Provider cursor did not progress';end if;
 if v_next_cursor is distinct from p_expected_cursor and
  (v_next_cursor is not distinct from r.cycle_start_cursor or exists(select 1 from public.carez_plaid_sync_pages
   where run_id=r.id and generation=r.generation and result->>'cursor'=v_next_cursor)) then raise exception 'Provider cursor repeated within this update';end if;
 if p_page_index=0 and p_accounts is null then raise exception 'First update page requires its complete account response';end if;
 rows:=(p_page->'added')||(p_page->'modified');
 if exists(select 1 from jsonb_array_elements(rows||(p_page->'removed')) x group by x->>'plaid_transaction_id' having count(*)>1) then
  raise exception 'Provider page has duplicate transaction identities';end if;

 if p_accounts is not null then
  if jsonb_typeof(p_accounts) is distinct from 'array' then raise exception 'Complete account response required';end if;
  if exists(select 1 from jsonb_array_elements(p_accounts) x group by x->>'plaid_account_id' having count(*)>1) then raise exception 'Duplicate provider account';end if;
  for v in select value from jsonb_array_elements(p_accounts) loop
   if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'plaid_account_id') is distinct from 'string'
    or nullif(btrim(v->>'plaid_account_id'),'') is null or nullif(btrim(v->>'name'),'') is null
    or nullif(btrim(v->>'account_type'),'') is null then raise exception 'Provider account identity/type required';end if;
   perform public.carez_plaid_number(v,'current_balance',true);perform public.carez_plaid_number(v,'available_balance',true);
   if exists(select 1 from public.plaid_accounts where company_id=p_company and plaid_account_id=v->>'plaid_account_id' and connection_id<>c.id) then raise exception 'Provider account belongs to another connection';end if;
   insert into public.plaid_accounts(company_id,connection_id,plaid_account_id,name,official_name,mask,account_type,account_subtype,
    iso_currency_code,current_balance,available_balance,include_in_cash,active,last_balance_at,updated_at)
   values(p_company,c.id,v->>'plaid_account_id',v->>'name',v->>'official_name',v->>'mask',v->>'account_type',v->>'account_subtype',
    v->>'iso_currency_code',(v->>'current_balance')::numeric,(v->>'available_balance')::numeric,(v->>'account_type')='depository',true,now_at,now_at)
   on conflict(company_id,plaid_account_id) do update set name=excluded.name,official_name=excluded.official_name,mask=excluded.mask,
    account_type=excluded.account_type,account_subtype=excluded.account_subtype,iso_currency_code=excluded.iso_currency_code,
    current_balance=excluded.current_balance,available_balance=excluded.available_balance,active=true,last_balance_at=now_at,updated_at=now_at;
   -- Deliberately omit include_in_cash AND connection_id from conflict updates.
   account_count:=account_count+1;
  end loop;
  update public.plaid_connections set last_accounts_sync_at=now_at,
   last_realtime_balance_at=case when p_realtime_balance then now_at else last_realtime_balance_at end,updated_at=now_at where id=c.id;
 elsif p_realtime_balance then raise exception 'Realtime balance confirmation needs its account response';end if;

 for v in select value from jsonb_array_elements(rows) loop
  if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'plaid_transaction_id') is distinct from 'string'
   or nullif(btrim(v->>'plaid_transaction_id'),'') is null or nullif(btrim(v->>'plaid_account_id'),'') is null
   or nullif(btrim(v->>'name'),'') is null or jsonb_typeof(v->'pending') is distinct from 'boolean'
   or jsonb_typeof(v->'raw_data') is distinct from 'object' or coalesce(v->>'transaction_date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or not isfinite((v->>'transaction_date')::date) then raise exception 'Complete provider transaction required';end if;
  if v->>'authorized_date' is not null and ((v->>'authorized_date')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not isfinite((v->>'authorized_date')::date)) then raise exception 'Invalid authorized date';end if;
  amount:=public.carez_plaid_number(v,'plaid_amount');cash:=public.carez_plaid_number(v,'cash_amount');
  if cash<>-amount then raise exception 'Provider/cash signs disagree';end if;
  select id into account_id from public.plaid_accounts where company_id=p_company and connection_id=c.id and plaid_account_id=v->>'plaid_account_id';
  if not found then raise exception 'Transaction account is not known in this connection';end if;
  if exists(select 1 from public.plaid_transactions where company_id=p_company and plaid_transaction_id=v->>'plaid_transaction_id' and connection_id<>c.id) then raise exception 'Provider transaction belongs to another connection';end if;
  select * into prior_tx from public.plaid_transactions where company_id=p_company and connection_id=c.id and plaid_transaction_id=v->>'plaid_transaction_id' for update;
  source_change:=prior_tx.matched_source_change;
  if prior_tx.id is not null and prior_tx.review_status='matched' and
   (prior_tx.cash_amount is distinct from cash or prior_tx.transaction_date is distinct from (v->>'transaction_date')::date
    or prior_tx.plaid_account_id is distinct from v->>'plaid_account_id' or prior_tx.pending is distinct from (v->>'pending')::boolean or prior_tx.removed) then
   matched_changed:=matched_changed+1;
   source_change:=jsonb_build_object('requires_review',true,'run_id',r.id,'page_id',p_page_id,'observed_at',now_at,
    'before',coalesce(source_change->'before',jsonb_build_object('cash_amount',prior_tx.cash_amount,'transaction_date',prior_tx.transaction_date,'plaid_account_id',prior_tx.plaid_account_id,'pending',prior_tx.pending,'removed',prior_tx.removed)),
    'after',jsonb_build_object('cash_amount',cash,'transaction_date',v->>'transaction_date','plaid_account_id',v->>'plaid_account_id','pending',(v->>'pending')::boolean,'removed',false));
  end if;
  insert into public.plaid_transactions(company_id,connection_id,account_id,plaid_transaction_id,plaid_account_id,transaction_date,authorized_date,
   name,merchant_name,plaid_amount,cash_amount,pending,payment_channel,category_primary,category_detailed,website,logo_url,removed,raw_data,matched_source_change,updated_at)
  values(p_company,c.id,account_id,v->>'plaid_transaction_id',v->>'plaid_account_id',(v->>'transaction_date')::date,(v->>'authorized_date')::date,
   v->>'name',v->>'merchant_name',amount,cash,(v->>'pending')::boolean,v->>'payment_channel',v->>'category_primary',v->>'category_detailed',v->>'website',v->>'logo_url',false,v->'raw_data',source_change,now_at)
  on conflict(company_id,plaid_transaction_id) do update set account_id=excluded.account_id,plaid_account_id=excluded.plaid_account_id,
   transaction_date=excluded.transaction_date,authorized_date=excluded.authorized_date,name=excluded.name,merchant_name=excluded.merchant_name,
   plaid_amount=excluded.plaid_amount,cash_amount=excluded.cash_amount,pending=excluded.pending,payment_channel=excluded.payment_channel,
   category_primary=excluded.category_primary,category_detailed=excluded.category_detailed,website=excluded.website,logo_url=excluded.logo_url,
   removed=false,raw_data=excluded.raw_data,matched_source_change=excluded.matched_source_change,updated_at=now_at returning id into saved_id;
  changed_ids:=array_append(changed_ids,saved_id);changed:=changed+1;
  -- No review/match field and no posted payment, tax remittance, payroll, expense,
  -- allocation or financial snapshot is ever written by synchronization.
 end loop;
 for v in select value from jsonb_array_elements(p_page->'removed') loop
  if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'plaid_transaction_id') is distinct from 'string'
   or nullif(btrim(v->>'plaid_transaction_id'),'') is null then raise exception 'Removed transaction identity required';end if;
  if exists(select 1 from public.plaid_transactions where company_id=p_company and plaid_transaction_id=v->>'plaid_transaction_id' and connection_id<>c.id) then raise exception 'Removed transaction belongs to another connection';end if;
  if exists(select 1 from public.plaid_transactions where company_id=p_company and connection_id=c.id and plaid_transaction_id=v->>'plaid_transaction_id' and review_status='matched' and not removed) then matched_changed:=matched_changed+1;end if;
  update public.plaid_transactions set removed=true,matched_source_change=case when review_status='matched' and not removed then jsonb_build_object('requires_review',true,'run_id',r.id,'page_id',p_page_id,'observed_at',now_at,'before',coalesce(matched_source_change->'before',jsonb_build_object('cash_amount',cash_amount,'transaction_date',transaction_date,'plaid_account_id',plaid_account_id,'pending',pending,'removed',removed)),'after',jsonb_build_object('removed',true)) else matched_source_change end,updated_at=now_at where company_id=p_company and connection_id=c.id and plaid_transaction_id=v->>'plaid_transaction_id' returning id into saved_id;
  if found then changed_ids:=array_append(changed_ids,saved_id);removed_count:=removed_count+1;end if;
  -- An unknown removal is an explicit idempotent no-op, never a cross-item write.
 end loop;
 update public.bank_reconciliation_candidates set status='stale',updated_at=now_at
  where company_id=p_company and bank_transaction_id=any(changed_ids) and status='active';
 update public.carez_plaid_sync_runs set next_cursor=v_next_cursor, next_page=next_page+1,
  state=case when more then 'running' else 'complete' end,lease_expires_at=case when more then clock_timestamp()+interval '120 seconds' else clock_timestamp() end,
  updated_at=now_at where id=r.id;
 if not more then
  update public.plaid_connections set transactions_cursor=v_next_cursor,last_transactions_sync_at=now_at,
   last_error_code=null,last_error_message=null,status='active',sync_contract_version='leased_pages_v1',updated_at=now_at where id=c.id;
 end if;
 answer:=jsonb_build_object('ok',true,'run_id',r.id,'page_id',p_page_id,'generation',r.generation,'page_index',r.next_page+1,
  'cursor',v_next_cursor,'complete',not more,'changed',changed+removed_count,'accounts',account_count,'matched_source_changes',matched_changed);
 insert into public.carez_plaid_sync_pages(run_id,page_id,payload_hash,result,generation,page_index,actor_id)
  values(r.id,p_page_id,fingerprint,answer,p_generation,p_page_index,p_actor);
 return answer;
end $$;

create function public.carez_plaid_sync_stop(p_company uuid,p_actor uuid,p_connection uuid,p_run uuid,p_lease uuid,p_outcome text,p_code text,p_message text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare r public.carez_plaid_sync_runs%rowtype;begin
 perform public.carez_plaid_service_lock(p_company,p_actor);
 if p_outcome is null or p_outcome not in ('failed','incomplete') then raise exception 'Explicit sync outcome required';end if;
 perform 1 from public.plaid_connections where id=p_connection and company_id=p_company for update;
 if not found then raise exception 'Connection unavailable';end if;
 select * into r from public.carez_plaid_sync_runs where id=p_run and company_id=p_company and connection_id=p_connection for update;
 if not found then raise exception 'Run unavailable';end if;
 if r.state='complete' or r.lease_token is distinct from p_lease or r.actor_id<>p_actor then return jsonb_build_object('ok',true,'superseded',true);end if;
 if r.state='running' and r.lease_expires_at<=clock_timestamp() then return jsonb_build_object('ok',true,'superseded',true);end if;
 update public.carez_plaid_sync_runs set state=p_outcome,lease_expires_at=clock_timestamp(),last_error_code=left(p_code,120),
  last_error_message=left(p_message,1000),updated_at=clock_timestamp() where id=r.id;
 update public.plaid_connections set status='needs_attention',last_error_code=left(p_code,120),last_error_message=left(p_message,1000),updated_at=clock_timestamp() where id=p_connection;
 return jsonb_build_object('ok',true,'complete',false,'outcome',p_outcome,'cursor',r.next_cursor);
end $$;

-- Exchange is moved to the same trusted writer. Credential replacement fences
-- any old lease atomically, without losing a successfully exchanged one-use
-- public token merely because a sync happened to be in flight.
create function public.carez_plaid_register_connection(p_company uuid,p_actor uuid,p_request_id uuid,p_item text,p_values jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare c public.plaid_connections%rowtype;prior public.carez_plaid_connection_requests%rowtype;fingerprint bytea;answer jsonb;begin
 perform public.carez_plaid_service_lock(p_company,p_actor);
 if p_request_id is null or nullif(btrim(p_item),'') is null or jsonb_typeof(p_values) is distinct from 'object'
  or nullif(p_values->>'access_token_ciphertext','') is null or nullif(p_values->>'token_iv','') is null or nullif(p_values->>'token_auth_tag','') is null then raise exception 'Provider connection credentials required';end if;
 fingerprint:=extensions.digest(convert_to(jsonb_build_object('actor_id',p_actor,'item_id',p_item,'values',p_values)::text,'UTF8'),'sha256');
 select * into prior from public.carez_plaid_connection_requests where company_id=p_company and request_id=p_request_id for update;
 if found then
  if prior.payload_hash is distinct from fingerprint then raise exception 'Connection request identity reused with different content';end if;
  return prior.result;
 end if;
 select * into c from public.plaid_connections where company_id=p_company and item_id=p_item for update;
 if found then
  update public.carez_plaid_sync_runs set state='incomplete',lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp(),
   last_error_code=case when last_error_code='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' then last_error_code else 'CONNECTION_CREDENTIALS_CHANGED' end,
   last_error_message='Connection credentials replaced; retry synchronization.',updated_at=clock_timestamp()
   where connection_id=c.id and company_id=p_company and state<>'complete';
  update public.plaid_connections set access_token_ciphertext=p_values->>'access_token_ciphertext',token_iv=p_values->>'token_iv',token_auth_tag=p_values->>'token_auth_tag',
   institution_id=p_values->>'institution_id',institution_name=p_values->>'institution_name',status='active',updated_at=clock_timestamp() where id=c.id;
 else
  insert into public.plaid_connections(company_id,item_id,institution_id,institution_name,access_token_ciphertext,token_iv,token_auth_tag,created_by)
   values(p_company,p_item,p_values->>'institution_id',p_values->>'institution_name',p_values->>'access_token_ciphertext',p_values->>'token_iv',p_values->>'token_auth_tag',p_actor) returning * into c;
 end if;
 answer:=jsonb_build_object('ok',true,'id',c.id);
 insert into public.carez_plaid_connection_requests(company_id,request_id,actor_id,payload_hash,result) values(p_company,p_request_id,p_actor,fingerprint,answer);
 return answer;
end $$;

-- Required narrow companions for existing human actions after raw feed revokes.
-- Absolute target booleans/states are naturally idempotent; matches stay locked.
create function public.carez_plaid_set_cash_use(p_account uuid,p_include boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare company uuid;a public.plaid_accounts%rowtype;begin
 select company_id into company from public.profiles where id=auth.uid();
 perform 1 from public.companies where id=company for update;
 if not found or not exists(select 1 from public.profiles where id=auth.uid() and company_id=company and role in ('owner','office')) then raise exception 'Owner or office authority required';end if;
 select * into a from public.plaid_accounts where id=p_account and company_id=company for update;
 if not found or p_include is null then raise exception 'Account and explicit inclusion required';end if;
 if p_include and a.account_type is distinct from 'depository' then raise exception 'Only depository accounts can be included';end if;
 update public.plaid_accounts set include_in_cash=p_include,updated_at=clock_timestamp() where id=a.id;
 return jsonb_build_object('ok',true,'id',a.id);
end $$;
create function public.carez_plaid_set_review(p_transaction uuid,p_state text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare company uuid;t public.plaid_transactions%rowtype;begin
 select company_id into company from public.profiles where id=auth.uid();
 perform 1 from public.companies where id=company for update;
 if not found or not exists(select 1 from public.profiles where id=auth.uid() and company_id=company and role in ('owner','office')) then raise exception 'Owner or office authority required';end if;
 if p_state is null or p_state not in ('unreviewed','ignored') then raise exception 'Review state invalid';end if;
 select * into t from public.plaid_transactions where id=p_transaction and company_id=company for update;
 if not found or t.review_status='matched' then raise exception 'Matched or unavailable transaction cannot be reset';end if;
 update public.plaid_transactions set review_status=p_state,updated_at=clock_timestamp(),
  reconciled_at=case when p_state='unreviewed' then null else reconciled_at end,
  reconciled_by=case when p_state='unreviewed' then null else reconciled_by end,
  reconciliation_source=case when p_state='unreviewed' then null else reconciliation_source end,
  bank_rule_id=case when p_state='unreviewed' then null else bank_rule_id end,
  match_note=case when p_state='unreviewed' then null else match_note end where id=t.id;
 return jsonb_build_object('ok',true,'id',t.id);
end $$;
revoke all on function public.carez_plaid_set_cash_use(uuid,boolean),public.carez_plaid_set_review(uuid,text) from public,anon;
grant execute on function public.carez_plaid_set_cash_use(uuid,boolean),public.carez_plaid_set_review(uuid,text) to authenticated;

revoke insert,update,delete on public.plaid_connections,public.plaid_accounts,public.plaid_transactions from public,anon,authenticated;
-- Existing SECURITY DEFINER financial wrappers remain table owners and can call
-- the captured invoker cores. No original reconciliation core is re-granted.
do $$ declare p regprocedure;begin
 for p in select x.oid::regprocedure from pg_proc x join pg_namespace n on n.oid=x.pronamespace
  where n.nspname='public' and x.proname in ('carez_plaid_sync_begin','carez_plaid_sync_renew','carez_plaid_sync_commit_page','carez_plaid_sync_stop','carez_plaid_register_connection') loop
  execute format('revoke all on function %s from public,anon,authenticated',p);
  execute format('grant execute on function %s to service_role',p);
 end loop;
end $$;
create function public.carez_plaid_writer_capability(p_company uuid,p_actor uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin perform public.carez_plaid_service_lock(p_company,p_actor);return jsonb_build_object('ok',true,'version','leased_pages_v1');end $$;
revoke all on function public.carez_plaid_writer_capability(uuid,uuid) from public,anon,authenticated;
grant execute on function public.carez_plaid_writer_capability(uuid,uuid) to service_role;

-- Existing source-owned financial wrappers; gate only new automatic matches while a feed is incomplete.
create or replace function public.carez_apply_bank_reconciliation_rule_v2(p_request_id uuid,p_bank_transaction_id uuid, p_rule_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'apply_bank_reconciliation_rule',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_rule_id',p_rule_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform public.carez_plaid_require_complete_feed(company);
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 target:=public.apply_bank_reconciliation_rule(p_bank_transaction_id,p_rule_id);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
create or replace function public.carez_reconcile_bank_existing_v2(p_request_id uuid,p_bank_transaction_id uuid, p_entity_type text, p_entity_id uuid, p_note text, p_confidence integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_existing',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_entity_type',p_entity_type,'p_entity_id',p_entity_id,'p_note',p_note,'p_confidence',p_confidence));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform public.carez_plaid_require_complete_feed(company);
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 case p_entity_type
 when 'customer_payment' then perform 1 from public.customer_payments where id=p_entity_id and company_id=company and bank_transaction_id is null for update;
 when 'vendor_payment' then perform 1 from public.vendor_payments where id=p_entity_id and company_id=company and bank_transaction_id is null for update;
 when 'company_expense' then perform 1 from public.company_expenses where id=p_entity_id and company_id=company and bank_transaction_id is null for update;
 when 'payroll_run' then perform 1 from public.payroll_runs where id=p_entity_id and company_id=company and bank_transaction_id is null for update;
 when 'tax_remittance' then perform 1 from public.company_tax_remittances where id=p_entity_id and company_id=company and bank_transaction_id is null for update;
 else raise exception 'Unsupported existing bank match'; end case;
 if not found then raise exception 'Existing record unavailable or already linked'; end if;
 target:=public.reconcile_bank_existing(p_bank_transaction_id,p_entity_type,p_entity_id,p_note,p_confidence);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
create or replace function public.carez_reconcile_bank_as_transfer_v2(p_request_id uuid,p_bank_transaction_id uuid, p_other_bank_transaction_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_as_transfer',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_other_bank_transaction_id',p_other_bank_transaction_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform public.carez_plaid_require_complete_feed(company);
 perform 1 from public.plaid_transactions where company_id=company and id in(p_bank_transaction_id,p_other_bank_transaction_id) order by id for update;
 if not exists(select 1 from public.plaid_transactions where id=p_other_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Other bank amount unavailable or invalid'; end if;
 if p_bank_transaction_id=p_other_bank_transaction_id then raise exception 'Choose two different bank transactions'; end if;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 perform public.reconcile_bank_as_transfer(p_bank_transaction_id,p_other_bank_transaction_id);
 result:=jsonb_build_object('ok',true);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
notify pgrst,'reload schema';
