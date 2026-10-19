-- PRIVATE, UNEXECUTED qualification draft for 20261016135000.
-- Run only against a disposable local database with the canonical chain through
-- 134600-135000 applied. No provider calls, remote state, or persistent fixtures.
-- Uses the real signup trigger, real service/human RPCs and RLS. Fixture role
-- assignments and lease-expiry simulation are privileged historical inputs, not
-- evidence of an invitation/role-management UI or real wall-clock concurrency.
-- A deliberately failing trigger injects a late removal fault; no trigger is
-- disabled. All fixture functions, triggers, records and grants roll back.
begin;
set local time zone 'UTC';
set local search_path=pg_catalog,public,extensions,pg_temp;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users(id,email,raw_user_meta_data) values
 ('ea110000-0000-4000-8000-000000000001','bank-page-owner@local.invalid','{"company_name":"Synthetic bank-page contractor","full_name":"Synthetic bank owner","operating_timezone":"UTC"}'),
 ('ea110000-0000-4000-8000-000000000002','bank-page-office@local.invalid','{"company_name":"Temporary synthetic office signup","full_name":"Synthetic bank office","operating_timezone":"UTC"}'),
 ('ea110000-0000-4000-8000-000000000003','bank-page-worker@local.invalid','{"company_name":"Temporary synthetic worker signup","full_name":"Synthetic bank worker","operating_timezone":"UTC"}'),
 ('ea110000-0000-4000-8000-000000000004','bank-page-foreign@local.invalid','{"company_name":"Foreign synthetic bank-page contractor","full_name":"Foreign bank owner","operating_timezone":"UTC"}');

-- These direct administrative assignments create authorization contexts only.
-- The signup trigger remains enabled and supplies all four actual profiles.
update public.profiles set company_id=(select company_id from public.profiles where id='ea110000-0000-4000-8000-000000000001'),role='office' where id='ea110000-0000-4000-8000-000000000002';
update public.profiles set company_id=(select company_id from public.profiles where id='ea110000-0000-4000-8000-000000000001'),role='employee' where id='ea110000-0000-4000-8000-000000000003';
create temp table bank_page_context as select id actor,company_id,role from public.profiles where id in
 ('ea110000-0000-4000-8000-000000000001','ea110000-0000-4000-8000-000000000002','ea110000-0000-4000-8000-000000000003','ea110000-0000-4000-8000-000000000004');
create temp table bank_page_results(key text primary key,value jsonb not null);
grant select on bank_page_context to authenticated,service_role;
grant select,insert,update on bank_page_results to authenticated,service_role;
create function pg_temp.bank_id(n integer) returns uuid language sql immutable as $$select ('ea550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.bank_actor(n integer default 1) returns uuid language sql immutable as $$select ('ea110000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.bank_company(n integer default 1) returns uuid language sql stable as $$select company_id from bank_page_context where actor=pg_temp.bank_actor(n)$$;
create function pg_temp.bank_value(k text) returns jsonb language sql stable as $$select value from bank_page_results where key=k$$;
create function pg_temp.bank_connection(k text default 'connection') returns uuid language sql stable as $$select (pg_temp.bank_value(k)->>'id')::uuid$$;
create function pg_temp.bank_account(k text,b numeric default 100,t text default 'depository') returns jsonb language sql immutable as $$
 select jsonb_build_object('plaid_account_id',k,'name','Synthetic '||k,'official_name','Synthetic provider account','mask','1234',
 'account_type',t,'account_subtype',case when t='depository' then 'checking' else 'credit card' end,
 'iso_currency_code','USD','current_balance',b,'available_balance',b)$$;
create function pg_temp.bank_tx(k text,a text,cash numeric default -5,d text default '2026-10-16',pending boolean default false) returns jsonb language sql immutable as $$
 select jsonb_build_object('plaid_transaction_id',k,'plaid_account_id',a,'transaction_date',d,'authorized_date',null,
 'name','Synthetic transaction '||k,'merchant_name','Synthetic merchant','plaid_amount',-cash,'cash_amount',cash,'pending',pending,'raw_data','{}'::jsonb)$$;
create function pg_temp.bank_page(cursor_value text,more boolean,added jsonb default '[]',modified jsonb default '[]',removed jsonb default '[]') returns jsonb language sql immutable as $$
 select jsonb_build_object('added',added,'modified',modified,'removed',removed,'next_cursor',cursor_value,'has_more',more)$$;
create function pg_temp.bank_commit(run_key text,lease integer,page_id integer,page_index bigint,expected_cursor text,page_value jsonb,accounts jsonb default null,generation bigint default 0,connection_key text default 'connection',actor_number integer default 1)
 returns jsonb language sql as $$select public.carez_plaid_sync_commit_page(pg_temp.bank_company(actor_number),pg_temp.bank_actor(actor_number),
 pg_temp.bank_connection(connection_key),(pg_temp.bank_value(run_key)->>'run_id')::uuid,pg_temp.bank_id(lease),pg_temp.bank_id(page_id),
 generation,page_index,expected_cursor,page_value,accounts,false)$$;
create function pg_temp.bank_stop(run_key text,lease integer,outcome text,code text,message text default 'Synthetic provider outcome') returns jsonb language sql as $$
 select public.carez_plaid_sync_stop(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),
 (pg_temp.bank_value(run_key)->>'run_id')::uuid,pg_temp.bank_id(lease),outcome,code,message)$$;

select extensions.is((select count(*)::integer from bank_page_context),4,'real signup establishes all isolated authorization identities');
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub',pg_temp.bank_actor()::text,true);
set local role service_role;
select extensions.is(public.carez_plaid_writer_capability(pg_temp.bank_company(),pg_temp.bank_actor())->>'version','leased_pages_v1','service writer confirms the declared capability for current owner');
select extensions.lives_ok($$select public.carez_plaid_writer_capability(pg_temp.bank_company(),pg_temp.bank_actor(2))$$,'service writer accepts current office authority');
select extensions.throws_like($$select public.carez_plaid_writer_capability(pg_temp.bank_company(),pg_temp.bank_actor(3))$$,'%Owner or office authority required%','service writer rejects an employee actor');
select extensions.throws_like($$select public.carez_plaid_writer_capability(pg_temp.bank_company(),pg_temp.bank_actor(4))$$,'%Owner or office authority required%','service writer rejects an actor from another company');
insert into bank_page_results values('connection',public.carez_plaid_register_connection(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_id(1),'synthetic-item-main',
 '{"access_token_ciphertext":"NOT-A-TOKEN","token_iv":"synthetic-iv","token_auth_tag":"synthetic-tag","institution_name":"Synthetic bank"}'));
select extensions.is(public.carez_plaid_register_connection(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_id(1),'synthetic-item-main',
 '{"access_token_ciphertext":"NOT-A-TOKEN","token_iv":"synthetic-iv","token_auth_tag":"synthetic-tag","institution_name":"Synthetic bank"}'),pg_temp.bank_value('connection'),'exact connection registration retry returns its receipt');
select extensions.throws_like($$select public.carez_plaid_register_connection(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_id(1),'synthetic-item-main','{"access_token_ciphertext":"CHANGED-NOT-A-TOKEN","token_iv":"synthetic-iv","token_auth_tag":"synthetic-tag"}')$$,'%Connection request identity reused with different content%','changed connection request payload is rejected');
reset role;
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select extensions.ok(not(public.carez_plaid_analysis_status()->>'ready')::boolean,'new registered connection without any run is not analysis-ready');
select extensions.is((public.carez_plaid_analysis_status()->>'unfinished_connections')::integer,1,'unqualified no-run connection is counted once');
select extensions.throws_like($$select public.carez_reconcile_bank_as_transfer_v2(pg_temp.bank_id(401),pg_temp.bank_id(402),pg_temp.bank_id(403))$$,'%Bank synchronization is incomplete%','new no-run feed cannot enter automatic reconciliation');
select extensions.throws_like($$select public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(10))$$,'%permission denied%','authenticated owner cannot call the service synchronization writer');
select extensions.throws_like($$select public.carez_plaid_writer_capability(pg_temp.bank_company(),pg_temp.bank_actor())$$,'%permission denied%','authenticated owner cannot obtain the service-only writer capability');
select extensions.throws_like($$select * from public.carez_plaid_sync_runs$$,'%permission denied%','private lease/cursor table is not exposed to authenticated reads');
select extensions.throws_like($$insert into public.plaid_connections(company_id,item_id,access_token_ciphertext,token_iv,token_auth_tag) values(pg_temp.bank_company(),'raw-denied','none','none','none')$$,'%permission denied%','raw connection insertion is denied');
reset role;

-- Complete a second home-company connection before the main cycle. It provides
-- actual foreign-connection account/transaction identities for theft assertions.
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('other-connection',public.carez_plaid_register_connection(pg_temp.bank_company(),pg_temp.bank_actor(2),pg_temp.bank_id(2),'synthetic-item-other',
 '{"access_token_ciphertext":"NOT-A-TOKEN-OTHER","token_iv":"iv","token_auth_tag":"tag"}'));
insert into bank_page_results values('other-run',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(2),pg_temp.bank_connection('other-connection'),pg_temp.bank_id(11)));
insert into bank_page_results values('other-page',pg_temp.bank_commit('other-run',11,101,0,null,
 pg_temp.bank_page('other-final',false,jsonb_build_array(pg_temp.bank_tx('synthetic-other-tx','synthetic-other-account',-2))),
 jsonb_build_array(pg_temp.bank_account('synthetic-other-account')),0,'other-connection',2));
insert into bank_page_results values('run-1',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(10)));
select extensions.ok(not(pg_temp.bank_value('run-1')->>'busy')::boolean,'first lease acquires the main connection');
select extensions.ok((public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(2),pg_temp.bank_connection(),pg_temp.bank_id(12))->>'busy')::boolean,'another active lease receives busy without stealing work');
select extensions.is(public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(10))->>'run_id',pg_temp.bank_value('run-1')->>'run_id','same lease resumes the existing run');
select extensions.lives_ok($$select public.carez_plaid_sync_renew(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),(pg_temp.bank_value('run-1')->>'run_id')::uuid,pg_temp.bank_id(10))$$,'current unexpired lease renews');
select extensions.throws_like($$select public.carez_plaid_sync_renew(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),(pg_temp.bank_value('run-1')->>'run_id')::uuid,pg_temp.bank_id(12))$$,'%Sync lease expired or superseded%','different lease cannot renew');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true))$$,'%First update page requires its complete account response%','first page cannot omit the account response');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true),'[]',1)$$,'%Sync cursor or page changed%','generation compare-and-set rejects stale generation');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,1,null,pg_temp.bank_page('main-p1',true),'[]')$$,'%Sync cursor or page changed%','page compare-and-set rejects wrong page');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,'wrong-cursor',pg_temp.bank_page('main-p1',true),'[]')$$,'%Sync cursor or page changed%','cursor compare-and-set rejects wrong cursor');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true),jsonb_build_array(pg_temp.bank_account('synthetic-other-account')))$$,'%Provider account belongs to another connection%','same-company provider account cannot be reassigned to another connection');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true,jsonb_build_array(pg_temp.bank_tx('synthetic-other-tx','synthetic-main-account'))),jsonb_build_array(pg_temp.bank_account('synthetic-main-account')))$$,'%Provider transaction belongs to another connection%','same-company provider transaction cannot be stolen');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true,'[]','[]','[{"plaid_transaction_id":"synthetic-other-tx"}]'),'[]')$$,'%Removed transaction belongs to another connection%','cross-connection removal is rejected');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true,jsonb_build_array(pg_temp.bank_tx('duplicate','synthetic-main-account'),pg_temp.bank_tx('duplicate','synthetic-main-account'))),jsonb_build_array(pg_temp.bank_account('synthetic-main-account')))$$,'%duplicate transaction identities%','duplicate identity within one page is rejected');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true),jsonb_build_array(jsonb_set(pg_temp.bank_account('synthetic-main-account'),'{current_balance}','"NaN"'::jsonb)))$$,'%Provider number current_balance invalid%','invalid provider balance is not normalized to zero');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true,jsonb_build_array(jsonb_set(pg_temp.bank_tx('sign-error','synthetic-main-account'),'{cash_amount}','5'::jsonb))),jsonb_build_array(pg_temp.bank_account('synthetic-main-account')))$$,'%Provider/cash signs disagree%','provider debit and cash signs must agree');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('main-p1',true,jsonb_build_array(pg_temp.bank_tx('unknown-account','unknown-account'))),'[]')$$,'%Transaction account is not known in this connection%','unknown account cannot supply a transaction');
insert into bank_page_results values('page-1',pg_temp.bank_commit('run-1',10,102,0,null,
 pg_temp.bank_page('main-p1',true,jsonb_build_array(pg_temp.bank_tx('synthetic-tax-tx','synthetic-main-account'),pg_temp.bank_tx('synthetic-review-tx','synthetic-main-account',-12))),
 jsonb_build_array(pg_temp.bank_account('synthetic-main-account'),pg_temp.bank_account('synthetic-credit-account',null,'credit'))));
select extensions.ok(not(pg_temp.bank_value('page-1')->>'complete')::boolean,'a committed has-more page remains explicitly incomplete');
select extensions.is(pg_temp.bank_commit('run-1',10,102,0,null,
 pg_temp.bank_page('main-p1',true,jsonb_build_array(pg_temp.bank_tx('synthetic-tax-tx','synthetic-main-account'),pg_temp.bank_tx('synthetic-review-tx','synthetic-main-account',-12))),
 jsonb_build_array(pg_temp.bank_account('synthetic-main-account'),pg_temp.bank_account('synthetic-credit-account',null,'credit'))),pg_temp.bank_value('page-1'),'exact page replay returns the committed receipt');
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,102,0,null,pg_temp.bank_page('changed',true),'[]')$$,'%Page identity reused with different content%','page identity cannot acknowledge a different payload');
reset role;
select extensions.ok((select transactions_cursor is null and last_transactions_sync_at is null and sync_contract_version is null from public.plaid_connections where id=pg_temp.bank_connection()),'partial page does not advance completed cursor, timestamp or compatibility marker');
select extensions.ok((select state='running' and next_cursor='main-p1' and next_page=1 from public.carez_plaid_sync_runs where id=(pg_temp.bank_value('run-1')->>'run_id')::uuid),'partial cursor is retained only in the active run');
select extensions.is((select count(*)::integer from public.carez_plaid_sync_pages where run_id=(pg_temp.bank_value('run-1')->>'run_id')::uuid),1,'exact retry creates no duplicate page evidence');
select extensions.ok((select current_balance is null and available_balance is null from public.plaid_accounts where company_id=pg_temp.bank_company() and plaid_account_id='synthetic-credit-account'),'provider-null balances stay unknown rather than becoming zero');
select set_config('request.jwt.claim.role','authenticated',true);set local role authenticated;
select extensions.ok(not(public.carez_plaid_analysis_status()->>'ready')::boolean,'partial run prevents analysis readiness');
select extensions.throws_like($$select public.carez_apply_bank_reconciliation_rule_v2(pg_temp.bank_id(410),pg_temp.bank_id(411),pg_temp.bank_id(412))$$,'%Bank synchronization is incomplete%','automatic rule wrapper rejects partial data before resolving targets');
select extensions.throws_like($$select public.carez_reconcile_bank_existing_v2(pg_temp.bank_id(413),pg_temp.bank_id(414),'company_expense',pg_temp.bank_id(415),null,100)$$,'%Bank synchronization is incomplete%','existing-match wrapper rejects partial data');
select extensions.throws_like($$select public.carez_reconcile_bank_as_transfer_v2(pg_temp.bank_id(416),pg_temp.bank_id(417),pg_temp.bank_id(418))$$,'%Bank synchronization is incomplete%','transfer wrapper rejects partial data');
select extensions.ok(not exists(select 1 from public.financial_command_requests where request_id in(pg_temp.bank_id(410),pg_temp.bank_id(413),pg_temp.bank_id(416))),'rejected partial-feed commands leave no successful request receipts');
select extensions.lives_ok($$select public.carez_plaid_set_cash_use((select id from public.plaid_accounts where plaid_account_id='synthetic-main-account'),false)$$,'owner can explicitly exclude a depository account from cash');
select extensions.throws_like($$select public.carez_plaid_set_cash_use((select id from public.plaid_accounts where plaid_account_id='synthetic-credit-account'),true)$$,'%Only depository accounts can be included%','credit account cannot be included in cash');
select extensions.lives_ok($$select public.carez_plaid_set_review((select id from public.plaid_transactions where plaid_transaction_id='synthetic-review-tx'),'ignored')$$,'owner can mark an unmatched transaction ignored');
select extensions.lives_ok($$select public.carez_plaid_set_review((select id from public.plaid_transactions where plaid_transaction_id='synthetic-review-tx'),'unreviewed')$$,'owner can restore unmatched transaction to unreviewed');
select extensions.throws_like($$update public.plaid_accounts set include_in_cash=true$$,'%permission denied%','raw account updates cannot bypass the narrow cash-use command');
select extensions.throws_like($$update public.plaid_transactions set review_status='ignored'$$,'%permission denied%','raw transaction updates cannot bypass the narrow review command');
select extensions.throws_like($$delete from public.plaid_transactions$$,'%permission denied%','raw transaction deletion is denied');
select extensions.ok(not has_table_privilege('authenticated','public.plaid_connections','INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.plaid_accounts','INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated','public.plaid_transactions','INSERT,UPDATE,DELETE'),'all three raw feed tables deny authenticated insert, update and delete privileges');
reset role;

-- Fault after both account and added-transaction writes but before page receipt.
create function pg_temp.bank_fail_removed() returns trigger language plpgsql as $$begin
 if new.removed and not old.removed and old.plaid_transaction_id='synthetic-tax-tx' then raise exception 'Synthetic late removal failure';end if;return new;end$$;
create trigger synthetic_bank_removed_failure before update on public.plaid_transactions for each row execute function pg_temp.bank_fail_removed();
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
select extensions.throws_like($$select pg_temp.bank_commit('run-1',10,103,1,'main-p1',pg_temp.bank_page('main-final',false,jsonb_build_array(pg_temp.bank_tx('must-rollback','synthetic-main-account',-17)),'[]','[{"plaid_transaction_id":"synthetic-tax-tx"}]'),jsonb_build_array(pg_temp.bank_account('synthetic-main-account',999)))$$,'%Synthetic late removal failure%','late removal failure reaches the caller');
reset role;
select extensions.ok(not exists(select 1 from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='must-rollback'),'late failure rolls back earlier transaction writes');
select extensions.is((select current_balance from public.plaid_accounts where company_id=pg_temp.bank_company() and plaid_account_id='synthetic-main-account'),100::numeric,'late failure rolls back earlier balance writes');
select extensions.ok((select not removed from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'late failure leaves removal unapplied');
select extensions.ok((select next_cursor='main-p1' and next_page=1 and state='running' from public.carez_plaid_sync_runs where id=(pg_temp.bank_value('run-1')->>'run_id')::uuid),'late failure cannot advance run cursor or page');
select extensions.ok(not exists(select 1 from public.carez_plaid_sync_pages where page_id=pg_temp.bank_id(103)),'late failure leaves no page receipt');
select extensions.ok((select transactions_cursor is null and last_transactions_sync_at is null from public.plaid_connections where id=pg_temp.bank_connection()),'late failure cannot advance completed connection cursor');
drop trigger synthetic_bank_removed_failure on public.plaid_transactions;
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('page-2',pg_temp.bank_commit('run-1',10,103,1,'main-p1',pg_temp.bank_page('main-final',false,'[]','[]','[{"plaid_transaction_id":"unknown-removal"}]')));
select extensions.ok((pg_temp.bank_value('page-2')->>'complete')::boolean,'final provider page confirms completion');
reset role;
select extensions.ok((select transactions_cursor='main-final' and last_transactions_sync_at is not null and sync_contract_version='leased_pages_v1' from public.plaid_connections where id=pg_temp.bank_connection()),'only final page advances completed cursor, timestamp and qualified marker');
select extensions.is((pg_temp.bank_value('page-2')->>'changed')::integer,0,'unknown removal is an explicit idempotent no-op');
-- Existing rule input is fixture data; actual application uses its governed
-- automatic-match wrapper below, after the complete-feed gate is satisfied.
insert into public.bank_reconciliation_rules(id,company_id,name,merchant_pattern,direction,action_type,created_by)
 values(pg_temp.bank_id(430),pg_temp.bank_company(),'Synthetic ignore rule','synthetic merchant','outflow','ignore',pg_temp.bank_actor());
select set_config('request.jwt.claim.role','authenticated',true);set local role authenticated;
select extensions.ok((public.carez_plaid_analysis_status()->>'ready')::boolean,'all current company connections qualified and complete allow analysis');
insert into bank_page_results values('applied-rule',public.carez_apply_bank_reconciliation_rule_v2(pg_temp.bank_id(431),(select id from public.plaid_transactions where plaid_transaction_id='synthetic-review-tx'),pg_temp.bank_id(430)));
select extensions.ok((select review_status='ignored' and bank_rule_id=pg_temp.bank_id(430) from public.plaid_transactions where plaid_transaction_id='synthetic-review-tx'),'qualified complete feed permits the existing automatic rule command');
select extensions.is(public.carez_apply_bank_reconciliation_rule_v2(pg_temp.bank_id(431),(select id from public.plaid_transactions where plaid_transaction_id='synthetic-review-tx'),pg_temp.bank_id(430)),pg_temp.bank_value('applied-rule'),'confirmed rule retry preserves its prior outcome');
insert into bank_page_results values('posted-tax',public.carez_reconcile_bank_to_tax_v2(pg_temp.bank_id(420),(select id from public.plaid_transactions where plaid_transaction_id='synthetic-tax-tx'),'sales_tax'));
select extensions.throws_like($$select public.carez_plaid_set_review((select id from public.plaid_transactions where plaid_transaction_id='synthetic-tax-tx'),'unreviewed')$$,'%Matched or unavailable transaction cannot be reset%','human review command cannot unlink a matched transaction');
reset role;
insert into bank_page_results select 'tax-snapshot',to_jsonb(t) from public.company_tax_remittances t where id=(pg_temp.bank_value('posted-tax')->>'id')::uuid;
insert into public.bank_reconciliation_candidates(company_id,bank_transaction_id,candidate_type,confidence,reason)
 select pg_temp.bank_company(),id,'ignore',80,'Synthetic candidate before provider modification' from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx';

-- Simulate a historical/legacy complete-looking connection without the marker.
update public.plaid_connections set sync_contract_version=null where id=pg_temp.bank_connection();
select set_config('request.jwt.claim.role','authenticated',true);set local role authenticated;
select extensions.ok(not(public.carez_plaid_analysis_status()->>'ready')::boolean,'legacy cursor/timestamp without qualification marker remains unavailable');
select extensions.throws_like($$select public.carez_reconcile_bank_as_transfer_v2(pg_temp.bank_id(421),pg_temp.bank_id(422),pg_temp.bank_id(423))$$,'%Bank synchronization is incomplete%','legacy no-open-run feed cannot enter automatic reconciliation');
reset role;update public.plaid_connections set sync_contract_version='leased_pages_v1' where id=pg_temp.bank_connection();
insert into bank_page_results select 'qualified-connection',jsonb_build_object('completed_at',last_transactions_sync_at,'cursor',transactions_cursor) from public.plaid_connections where id=pg_temp.bank_connection();
update public.plaid_connections set last_transactions_sync_at=null where id=pg_temp.bank_connection();
select set_config('request.jwt.claim.role','authenticated',true);set local role authenticated;
select extensions.ok(not(public.carez_plaid_analysis_status()->>'ready')::boolean,'marker without completed timestamp is not analysis-ready');
reset role;update public.plaid_connections set last_transactions_sync_at=(pg_temp.bank_value('qualified-connection')->>'completed_at')::timestamptz,transactions_cursor=null where id=pg_temp.bank_connection();
set local role authenticated;
select extensions.ok(not(public.carez_plaid_analysis_status()->>'ready')::boolean,'marker and timestamp without completed cursor are not analysis-ready');
reset role;update public.plaid_connections set transactions_cursor=pg_temp.bank_value('qualified-connection')->>'cursor' where id=pg_temp.bank_connection();

-- Preserve immutable financial facts while surfacing provider-source changes.
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('run-2',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(20)));
insert into bank_page_results values('page-3',pg_temp.bank_commit('run-2',20,110,0,'main-final',
 pg_temp.bank_page('changed-p1',true,'[]',jsonb_build_array(pg_temp.bank_tx('synthetic-tax-tx','synthetic-credit-account',-8,'2026-10-17',true))),
 jsonb_build_array(pg_temp.bank_account('synthetic-main-account',0),pg_temp.bank_account('synthetic-credit-account',30,'credit'))));
reset role;
select extensions.ok((select current_balance=0 and not include_in_cash from public.plaid_accounts where company_id=pg_temp.bank_company() and plaid_account_id='synthetic-main-account'),'provider refresh preserves explicit cash exclusion and recorded zero balance');
select extensions.is((pg_temp.bank_value('page-3')->>'matched_source_changes')::integer,1,'matched provider modification is counted as needing review');
select extensions.ok((select (matched_source_change#>>'{before,cash_amount}')::numeric=-5 and (matched_source_change#>>'{after,cash_amount}')::numeric=-8 and matched_source_change#>>'{before,plaid_account_id}'='synthetic-main-account' and matched_source_change#>>'{after,plaid_account_id}'='synthetic-credit-account' and (matched_source_change#>>'{after,pending}')::boolean from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'first modification records prior amount/account and new amount/account/pending state');
select extensions.ok((select review_status='matched' and matched_entity_type='tax_remittance' and matched_entity_id=(pg_temp.bank_value('posted-tax')->>'id')::uuid from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'provider modification preserves original financial match');
select extensions.ok((select status='stale' from public.bank_reconciliation_candidates where company_id=pg_temp.bank_company() and bank_transaction_id=(select id from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx')),'changed source invalidates existing active reconciliation suggestions');
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('page-4',pg_temp.bank_commit('run-2',20,111,1,'changed-p1',pg_temp.bank_page('changed-p2',true,'[]',jsonb_build_array(pg_temp.bank_tx('synthetic-tax-tx','synthetic-main-account',-9,'2026-10-18',false)))));
reset role;
select extensions.ok((select (matched_source_change#>>'{before,cash_amount}')::numeric=-5 and (matched_source_change#>>'{after,cash_amount}')::numeric=-9 and matched_source_change#>>'{before,transaction_date}'='2026-10-16' and matched_source_change#>>'{after,transaction_date}'='2026-10-18' from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'repeated modification retains earliest before and latest after');
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('page-5',pg_temp.bank_commit('run-2',20,112,2,'changed-p2',pg_temp.bank_page('changed-p3',true,'[]','[]','[{"plaid_transaction_id":"synthetic-tax-tx"}]')));
insert into bank_page_results values('page-6',pg_temp.bank_commit('run-2',20,113,3,'changed-p3',pg_temp.bank_page('changed-final',false)));
reset role;
select extensions.ok((select removed and review_status='matched' and (matched_source_change#>>'{before,cash_amount}')::numeric=-5 and (matched_source_change#>>'{after,removed}')::boolean and (matched_source_change->>'requires_review')::boolean from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'matched removal preserves original basis and reports latest removal observation');
select extensions.is((select to_jsonb(t) from public.company_tax_remittances t where id=(pg_temp.bank_value('posted-tax')->>'id')::uuid),pg_temp.bank_value('tax-snapshot'),'sync does not change posted remittance, amount, date or match back-link');
select extensions.ok((select matched_source_change is not null from public.plaid_transaction_feed where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'source-change warning is available through the supported feed view');

-- Existing exact receipts remain acknowledgements after lease completion, while
-- new page IDs cannot write through that completed lease.
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
select extensions.is(pg_temp.bank_commit('run-2',20,113,3,'changed-p3',pg_temp.bank_page('changed-final',false)),pg_temp.bank_value('page-6'),'completed page exact replay remains safe');
select extensions.throws_like($$select pg_temp.bank_commit('run-2',20,114,4,'changed-final',pg_temp.bank_page('unexpected',false))$$,'%Sync lease expired or superseded%','completed lease cannot append another page');

-- Pagination mutation restarts from the last COMPLETE cursor and increments its
-- generation. A page receipt in the old generation is never re-applied.
insert into bank_page_results values('run-3',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(30)));
insert into bank_page_results values('page-7',pg_temp.bank_commit('run-3',30,120,0,'changed-final',pg_temp.bank_page('restart-partial',true),'[]'));
insert into bank_page_results values('mutation-stop',pg_temp.bank_stop('run-3',30,'failed','TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'));
reset role;
select extensions.ok((select status='needs_attention' and transactions_cursor='changed-final' from public.plaid_connections where id=pg_temp.bank_connection()),'failed provider cycle preserves completed cursor and flags attention');
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('restart-run',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(31)));
select extensions.ok(pg_temp.bank_value('restart-run')->>'run_id'=pg_temp.bank_value('run-3')->>'run_id' and (pg_temp.bank_value('restart-run')->>'generation')::integer=1 and (pg_temp.bank_value('restart-run')->>'page_index')::integer=0 and pg_temp.bank_value('restart-run')->>'cursor'='changed-final','pagination mutation reuses run but restarts at completed cursor in a new generation');
select extensions.throws_like($$select pg_temp.bank_commit('restart-run',30,121,0,'changed-final',pg_temp.bank_page('restart-final',false),'[]',1)$$,'%Sync lease expired or superseded%','old lease is fenced by resumed ownership');
select extensions.throws_like($$select pg_temp.bank_commit('restart-run',31,121,0,'changed-final',pg_temp.bank_page('restart-final',false),'[]',0)$$,'%Sync cursor or page changed%','old generation is fenced after mutation restart');
select extensions.is(pg_temp.bank_commit('run-3',30,120,0,'changed-final',pg_temp.bank_page('restart-partial',true),'[]'),pg_temp.bank_value('page-7'),'old generation exact receipt may be acknowledged without applying data');
insert into bank_page_results values('page-8',pg_temp.bank_commit('restart-run',31,121,0,'changed-final',pg_temp.bank_page('restart-final',false),'[]',1));
reset role;
select extensions.ok((select transactions_cursor='restart-final' and status='active' and last_error_code is null from public.plaid_connections where id=pg_temp.bank_connection()),'successful restarted final page clears connection failure');
select extensions.is((select count(distinct generation)::integer from public.carez_plaid_sync_pages where run_id=(pg_temp.bank_value('run-3')->>'run_id')::uuid),2,'both generation receipts remain available as audit evidence');

-- Expiry is simulated by privileged fixture input rather than blocking sleep.
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('expiry-run',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(40)));
reset role;update public.carez_plaid_sync_runs set lease_expires_at=clock_timestamp()-interval '1 second' where id=(pg_temp.bank_value('expiry-run')->>'run_id')::uuid;
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
select extensions.throws_like($$select public.carez_plaid_sync_renew(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),(pg_temp.bank_value('expiry-run')->>'run_id')::uuid,pg_temp.bank_id(40))$$,'%Sync lease expired or superseded%','expired lease cannot renew');
select extensions.throws_like($$select pg_temp.bank_commit('expiry-run',40,130,0,'restart-final',pg_temp.bank_page('expired-cannot-write',false),'[]')$$,'%Sync lease expired or superseded%','expired lease cannot commit');
select extensions.ok((pg_temp.bank_stop('expiry-run',40,'failed','expired-observer')->>'superseded')::boolean,'expired observer cannot downgrade the connection with a late stop');
insert into bank_page_results values('expiry-reclaimed',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(41)));
select extensions.is(pg_temp.bank_value('expiry-reclaimed')->>'run_id',pg_temp.bank_value('expiry-run')->>'run_id','new lease reclaims expired run instead of creating a second open run');
insert into bank_page_results values('page-9',pg_temp.bank_commit('expiry-reclaimed',41,131,0,'restart-final',pg_temp.bank_page('expiry-final',false),'[]'));

-- Intentional page/time budget stop is not completion and resumes the prefix.
insert into bank_page_results values('budget-run',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(50)));
insert into bank_page_results values('page-10',pg_temp.bank_commit('budget-run',50,140,0,'expiry-final',pg_temp.bank_page('budget-partial',true),'[]'));
select extensions.throws_like($$select pg_temp.bank_commit('budget-run',50,141,1,'budget-partial',pg_temp.bank_page('budget-partial',true))$$,'%Provider cursor did not progress%','has-more page cannot repeat its expected cursor');
select extensions.throws_like($$select pg_temp.bank_commit('budget-run',50,141,1,'budget-partial',pg_temp.bank_page('expiry-final',true))$$,'%Provider cursor repeated within this update%','page cannot cycle back to the completed start cursor');
insert into bank_page_results values('budget-stop',pg_temp.bank_stop('budget-run',50,'incomplete','SYNC_PAGE_LIMIT'));
select extensions.ok(not(pg_temp.bank_value('budget-stop')->>'complete')::boolean,'budget-capped sync explicitly reports incomplete');
insert into bank_page_results values('budget-resume',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(51)));
select extensions.ok(pg_temp.bank_value('budget-resume')->>'cursor'='budget-partial' and (pg_temp.bank_value('budget-resume')->>'page_index')::integer=1 and (pg_temp.bank_value('budget-resume')->>'generation')::integer=0,'non-mutation incomplete cycle resumes committed prefix without inventing a restart');
insert into bank_page_results values('page-11',pg_temp.bank_commit('budget-resume',51,141,1,'budget-partial',pg_temp.bank_page('budget-final',false)));

-- Credential replacement fences any old lease while retaining its prefix.
insert into bank_page_results values('credential-run',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(60)));
insert into bank_page_results values('replaced-connection',public.carez_plaid_register_connection(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_id(3),'synthetic-item-main','{"access_token_ciphertext":"REPLACED-NOT-A-TOKEN","token_iv":"changed-iv","token_auth_tag":"changed-tag"}'));
select extensions.is(pg_temp.bank_value('replaced-connection')->>'id',pg_temp.bank_value('connection')->>'id','credential replacement retains connection identity');
select extensions.throws_like($$select pg_temp.bank_commit('credential-run',60,150,0,'budget-final',pg_temp.bank_page('stale-credential-page',false),'[]')$$,'%Sync lease expired or superseded%','replaced credentials fence the old lease');
insert into bank_page_results values('credential-resume',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(61)));
insert into bank_page_results values('page-12',pg_temp.bank_commit('credential-resume',61,151,0,'budget-final',pg_temp.bank_page('credentials-final',false),'[]'));
insert into bank_page_results values('failed-prefix-run',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(62)));
insert into bank_page_results values('page-13',pg_temp.bank_commit('failed-prefix-run',62,152,0,'credentials-final',pg_temp.bank_page('failure-partial',true),'[]'));
insert into bank_page_results values('failed-prefix-stop',pg_temp.bank_stop('failed-prefix-run',62,'failed','SYNTHETIC_PROVIDER_FAILURE'));
insert into bank_page_results values('failed-prefix-resume',public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection(),pg_temp.bank_id(63)));
select extensions.ok(pg_temp.bank_value('failed-prefix-resume')->>'cursor'='failure-partial' and (pg_temp.bank_value('failed-prefix-resume')->>'page_index')::integer=1 and (pg_temp.bank_value('failed-prefix-resume')->>'generation')::integer=0,'ordinary provider failure resumes its committed prefix without mutation restart');
insert into bank_page_results values('page-14',pg_temp.bank_commit('failed-prefix-resume',63,153,1,'failure-partial',pg_temp.bank_page('failure-recovered-final',false)));
reset role;

-- Tenant isolation: equal opaque provider IDs are company-scoped, not globally
-- unique. A different company's page must create its own rows, never mutate the
-- original financial matches or cash-use choice.
select set_config('request.jwt.claim.role','service_role',true);set local role service_role;
insert into bank_page_results values('foreign-connection',public.carez_plaid_register_connection(pg_temp.bank_company(4),pg_temp.bank_actor(4),pg_temp.bank_id(4),'synthetic-item-main','{"access_token_ciphertext":"FOREIGN-NOT-A-TOKEN","token_iv":"iv","token_auth_tag":"tag"}'));
select extensions.throws_like($$select public.carez_plaid_sync_begin(pg_temp.bank_company(),pg_temp.bank_actor(),pg_temp.bank_connection('foreign-connection'),pg_temp.bank_id(70))$$,'%Connected bank unavailable%','home company cannot open another company connection');
insert into bank_page_results values('foreign-run',public.carez_plaid_sync_begin(pg_temp.bank_company(4),pg_temp.bank_actor(4),pg_temp.bank_connection('foreign-connection'),pg_temp.bank_id(71)));
insert into bank_page_results values('foreign-page',pg_temp.bank_commit('foreign-run',71,160,0,null,pg_temp.bank_page('foreign-final',false,jsonb_build_array(pg_temp.bank_tx('synthetic-tax-tx','synthetic-main-account',-77))),jsonb_build_array(pg_temp.bank_account('synthetic-main-account',777)),0,'foreign-connection',4));
reset role;
insert into bank_page_results select 'foreign-account',jsonb_build_object('id',id) from public.plaid_accounts where company_id=pg_temp.bank_company(4) and plaid_account_id='synthetic-main-account';
insert into bank_page_results select 'foreign-transaction',jsonb_build_object('id',id) from public.plaid_transactions where company_id=pg_temp.bank_company(4) and plaid_transaction_id='synthetic-tax-tx';
insert into bank_page_results select 'home-account',jsonb_build_object('id',id) from public.plaid_accounts where company_id=pg_temp.bank_company() and plaid_account_id='synthetic-main-account';
select extensions.is((select count(*)::integer from public.plaid_accounts where plaid_account_id='synthetic-main-account' and company_id in(pg_temp.bank_company(),pg_temp.bank_company(4))),2,'same provider account text creates separate tenant rows');
select extensions.ok((select not include_in_cash and current_balance=0 from public.plaid_accounts where company_id=pg_temp.bank_company() and plaid_account_id='synthetic-main-account'),'foreign provider account cannot overwrite home balance or cash-use choice');
select extensions.ok((select removed and cash_amount=-9 and matched_entity_id=(pg_temp.bank_value('posted-tax')->>'id')::uuid from public.plaid_transactions where company_id=pg_temp.bank_company() and plaid_transaction_id='synthetic-tax-tx'),'foreign provider transaction cannot overwrite home amount, removal or financial match');
select set_config('request.jwt.claim.role','authenticated',true);select set_config('request.jwt.claim.sub',pg_temp.bank_actor()::text,true);set local role authenticated;
select extensions.is((select count(*)::integer from public.plaid_connections where id=pg_temp.bank_connection('foreign-connection')),0,'RLS hides foreign company connection from owner');
select extensions.is((select count(*)::integer from public.plaid_accounts where company_id=pg_temp.bank_company(4)),0,'RLS hides foreign company bank accounts from owner');
select extensions.is((select count(*)::integer from public.plaid_transactions where company_id=pg_temp.bank_company(4)),0,'RLS hides foreign company transactions from owner');
select extensions.throws_like($$select public.carez_plaid_set_cash_use((pg_temp.bank_value('foreign-account')->>'id')::uuid,true)$$,'%Account and explicit inclusion required%','foreign account cannot enter narrow cash-use action');
select extensions.throws_like($$select public.carez_plaid_set_review((pg_temp.bank_value('foreign-transaction')->>'id')::uuid,'ignored')$$,'%Matched or unavailable transaction cannot be reset%','foreign transaction cannot enter narrow review action');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.bank_actor(4)::text,true);set local role authenticated;
select extensions.is((select count(*)::integer from public.plaid_accounts where company_id=pg_temp.bank_company()),0,'foreign owner cannot read home accounts through RLS');
select extensions.throws_like($$select public.carez_plaid_set_cash_use((pg_temp.bank_value('home-account')->>'id')::uuid,true)$$,'%Account and explicit inclusion required%','foreign owner cannot mutate home account through the human RPC');
reset role;

-- Office uses the supported human actions; employee and anonymous callers cannot.
select set_config('request.jwt.claim.sub',pg_temp.bank_actor(2)::text,true);set local role authenticated;
select extensions.lives_ok($$select public.carez_plaid_set_cash_use((select id from public.plaid_accounts where plaid_account_id='synthetic-main-account'),false)$$,'office authority can use the narrow cash-use action');
select extensions.lives_ok($$select public.carez_plaid_set_review((select id from public.plaid_transactions where plaid_transaction_id='synthetic-review-tx'),'ignored')$$,'office authority can use the narrow review action');
select extensions.ok((public.carez_plaid_analysis_status()->>'ready')::boolean,'office can read qualified feed status');
reset role;select set_config('request.jwt.claim.sub',pg_temp.bank_actor(3)::text,true);set local role authenticated;
select extensions.is((select count(*)::integer from public.plaid_accounts),0,'financial role RLS hides account data from employee');
select extensions.is((select count(*)::integer from public.plaid_transactions),0,'financial role RLS hides transaction data from employee');
select extensions.throws_like($$select public.carez_plaid_set_cash_use(pg_temp.bank_id(900),true)$$,'%Owner or office authority required%','employee cannot change cash inclusion');
select extensions.throws_like($$select public.carez_plaid_set_review(pg_temp.bank_id(901),'ignored')$$,'%Owner or office authority required%','employee cannot mark transaction reviewed');
select extensions.throws_like($$select public.carez_plaid_analysis_status()$$,'%Owner or office authority required%','employee cannot inspect analysis eligibility');
reset role;select set_config('request.jwt.claim.role','anon',true);select set_config('request.jwt.claim.sub','',true);set local role anon;
select extensions.throws_like($$select public.carez_plaid_analysis_status()$$,'%permission denied%','anonymous analysis-status call denied');
select extensions.throws_like($$select public.carez_plaid_set_review('ea550000-0000-4000-8000-000000000901','ignored')$$,'%permission denied%','anonymous human review denied');
select extensions.throws_like($$select public.carez_plaid_sync_begin('ea550000-0000-4000-8000-000000000901','ea550000-0000-4000-8000-000000000902','ea550000-0000-4000-8000-000000000903','ea550000-0000-4000-8000-000000000904')$$,'%permission denied%','anonymous service writer denied');
reset role;
select * from extensions.finish();
rollback;
