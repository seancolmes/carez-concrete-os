begin;
-- Disposable local financial history. The runner installs 133000/133500/133600
-- at the marker so the unknown payment genuinely predates the new contract.
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values('f6100000-0000-4000-8000-000000000001','funding-owner@local.invalid'),('f6100000-0000-4000-8000-000000000002','funding-employee@local.invalid'),('f6100000-0000-4000-8000-000000000003','funding-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone) values('f6200000-0000-4000-8000-000000000001','Synthetic funding contractor','UTC'),('f6200000-0000-4000-8000-000000000002','Other funding contractor','UTC');
insert into public.profiles(id,company_id,role) values('f6100000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','owner'),('f6100000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','employee'),('f6100000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000002','owner');
insert into public.projects(id,company_id,job_number,name,status,contract_value) values
('f6300000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','SYN-KNOWN','Posted funding','active',1000),
('f6300000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','SYN-UNKNOWN','Unknown historical receipt','active',1000),
('f6300000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001','SYN-EMPTY','Recorded empty funding','active',0);
insert into public.invoices(id,company_id,project_id,invoice_number,invoice_type,status,issue_date,from_name,sales_tax_rate_percent,retainage_percent,created_by)
select ('f6400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6200000-0000-4000-8000-000000000001',('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'INV-SYN-'||n,'progress','sent','2026-10-16','Synthetic sender',10,10,'f6100000-0000-4000-8000-000000000001' from generate_series(1,2)n;
insert into public.invoice_lines(company_id,invoice_id,description,quantity,unit,unit_price,line_amount,taxable)
select 'f6200000-0000-4000-8000-000000000001',id,'Synthetic placed work',1,'LS',100,100,true from public.invoices where company_id='f6200000-0000-4000-8000-000000000001';
-- Restore synthetic pre-contract history inside this disposable transaction.
-- Re-enable the exact prospective guard before exercising any command.
alter table public.customer_payments drop constraint if exists carez_customer_payment_state_known;
insert into public.customer_payments(id,company_id,project_id,received_date,amount,processing_fee,payment_method,status,created_by)
values('f6500000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000001','2026-10-16',100,2,'check','posted','f6100000-0000-4000-8000-000000000001'),
('f6500000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000001','2026-10-16',25,9,'check','void','f6100000-0000-4000-8000-000000000001'),
('f6500000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000002','2026-10-16',20,0,'check',null,'f6100000-0000-4000-8000-000000000001'),
('f6500000-0000-4000-8000-000000000004','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000002','2026-10-16',10,0,'check','posted','f6100000-0000-4000-8000-000000000001');
insert into public.payment_allocations(company_id,payment_id,invoice_id,amount)
select 'f6200000-0000-4000-8000-000000000001',id,case when project_id='f6300000-0000-4000-8000-000000000001' then 'f6400000-0000-4000-8000-000000000001'::uuid else 'f6400000-0000-4000-8000-000000000002'::uuid end,amount from public.customer_payments where company_id='f6200000-0000-4000-8000-000000000001';
-- APPLY PAYMENT CONTRACT HERE
do $$begin if not exists(select 1 from pg_constraint where conrelid='public.customer_payments'::regclass and conname='carez_customer_payment_state_known') then alter table public.customer_payments add constraint carez_customer_payment_state_known check(status is not null and status in ('posted','void')) not valid;end if;end $$;
insert into public.pour_plans(id,company_id,project_id,name,contingency_percent,minimum_cash_buffer,company_cash_support)
values('f6600000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000001','Synthetic known pour',10,2,5),
('f6600000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000002','Synthetic unknown pour',10,0,0),
('f6600000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000003','Synthetic zero exposure',10,0,0);
insert into public.pour_cost_items(id,company_id,pour_plan_id,item_type,description,quantity,unit,unit_cost,expected_cost)
values('f6700000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001','concrete','Synthetic linked cost',1,'EA',50,50),
('f6700000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000002','concrete','Synthetic unknown funding cost',1,'EA',50,50);
insert into public.vendors(id,company_id,name) values('f6800000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','Synthetic supplier');
insert into public.cost_codes(id,company_id,code,name,cost_type) values('f6810000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','SYN-FUND','Synthetic material','material');
insert into public.plaid_connections(id,company_id,item_id,access_token_ciphertext,token_iv,token_auth_tag) values('f6820000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','synthetic-funding-item','NOT-A-TOKEN','synthetic','synthetic');
insert into public.plaid_accounts(id,company_id,connection_id,plaid_account_id,name) values('f6830000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6820000-0000-4000-8000-000000000001','synthetic-funding-account','Synthetic bank');
insert into public.plaid_transactions(id,company_id,connection_id,account_id,plaid_transaction_id,plaid_account_id,transaction_date,name,plaid_amount,cash_amount) values('f6840000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6820000-0000-4000-8000-000000000001','f6830000-0000-4000-8000-000000000001','synthetic-funding-receipt','synthetic-funding-account','2026-10-16','Synthetic receipt',-5,5);
create temp table funding_results(key text primary key,value jsonb);grant all on funding_results to authenticated;
create function pg_temp.fund(n integer,c text,p jsonb) returns jsonb language sql as $$select public.carez_procurement_command_v1(('f6900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)$$;
create function pg_temp.decide(n integer,p uuid,d text,r text default null) returns jsonb language sql as $$select public.carez_record_pour_authorization_v1(('f6910000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,p,public.carez_pour_funding_fingerprint('f6200000-0000-4000-8000-000000000001',p),d,r,null)$$;
-- Explicit historical agreement fixtures qualify the independent setup gates.
update public.projects set sales_tax_exempt=true where company_id='f6200000-0000-4000-8000-000000000001';
insert into public.project_award_records(id,company_id,project_id,agreement_number,original_contract_value,status,authorization_text)
select ('f6850000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6200000-0000-4000-8000-000000000001',('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'SYN-PRESTART-'||n,1000,'accepted','Synthetic historical agreement evidence' from generate_series(1,2)n;
insert into public.project_payment_milestones(id,company_id,project_id,award_record_id,label,amount_basis,amount,required_before_start,invoice_id,created_by)
select ('f6860000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6200000-0000-4000-8000-000000000001',('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f6850000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic required deposit','fixed',100,true,('f6400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6100000-0000-4000-8000-000000000001' from generate_series(1,2)n;
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000001',true);set local role authenticated;
select extensions.ok((select job_ready and required_before_start_open_count=0 and required_before_start_paid_amount=100 from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000001'),'known posted payment clears only the configured pre-start requirement');
select extensions.ok((select not job_ready and required_before_start_open_count=1 and required_before_start_unavailable_count=1 and required_before_start_paid_amount=0 and readiness_reason like '%payment basis unavailable%' from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000002'),'unknown payment balance cannot clear pre-start readiness through a fallback zero');
reset role;update public.invoices set status='void' where id='f6400000-0000-4000-8000-000000000001';set local role authenticated;
select extensions.ok((select not job_ready and required_before_start_open_count=1 from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000001'),'void invoice never clears a required deposit');
reset role;update public.invoices set status='draft' where id='f6400000-0000-4000-8000-000000000001';set local role authenticated;
select extensions.ok((select not job_ready and required_before_start_open_count=1 from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000001'),'draft invoice never clears a required deposit');
reset role;update public.invoices set status='sent' where id='f6400000-0000-4000-8000-000000000001';set local role authenticated;
select extensions.is((select amount_paid from public.invoice_financial_summary where invoice_id='f6400000-0000-4000-8000-000000000001'),100::numeric,'only posted allocations pay the invoice');
select extensions.is((select balance_due from public.invoice_financial_summary where invoice_id='f6400000-0000-4000-8000-000000000001'),0::numeric,'void allocation does not overpay invoice');
select extensions.ok((select balance_due is null and collection_status='unavailable' and posted_amount_paid=10 from public.invoice_financial_summary where invoice_id='f6400000-0000-4000-8000-000000000002'),'unknown historical receipt keeps balance unknown and known posted amount visible');
select extensions.ok((select collected_amount is null and outstanding_ar is null and billed_amount=100 and original_contract_value=1000 from public.project_billing_summary where project_id='f6300000-0000-4000-8000-000000000002'),'unknown collections preserve recorded contract and billed amounts');
select extensions.ok((select cash_collected is null and outstanding_ar is null from public.project_financial_summary where project_id='f6300000-0000-4000-8000-000000000002'),'dependent project summary cannot turn unknown receipts into zero');
select extensions.ok((select gross_customer_cash is null and funding_basis_status='unavailable' and known_posted_customer_cash=10 from public.project_cash_funding_summary where project_id='f6300000-0000-4000-8000-000000000002'),'unknown historical receipt cannot fund work');
select extensions.ok((select gross_customer_cash=100 and sales_tax_cash_reserved=10 and processing_fees_paid=2 and net_customer_funding=88 from public.project_cash_funding_summary where project_id='f6300000-0000-4000-8000-000000000001'),'posted cash reserves installed invoice tax and only posted fees');
select extensions.ok((select gross_customer_cash=0 and incurred_direct_cost=0 and funding_basis_status='known' from public.project_cash_funding_summary where project_id='f6300000-0000-4000-8000-000000000003'),'successful empty sources retain genuine zero');
select extensions.ok((select required_additional_cash is null and system_recommendation='unavailable' from public.pour_plan_financial_summary where pour_plan_id='f6600000-0000-4000-8000-000000000002'),'unknown funding cannot become a clear pour');
select extensions.throws_like($$select pg_temp.decide(1,'f6600000-0000-4000-8000-000000000002','authorized','Try override')$$,'%Funding basis unavailable%','human override cannot invent unknown funding');
select extensions.throws_like($$select public.carez_record_invoice_payment_v2('f6920000-0000-4000-8000-000000000001','f6400000-0000-4000-8000-000000000002','{"amount":5,"processing_fee":0,"received_date":"2026-10-16","payment_method":"check"}')$$,'%balance unavailable%','manual receipt rejects an unknown balance');
select extensions.throws_like($$select public.carez_reconcile_bank_to_invoice_v2('f6920000-0000-4000-8000-000000000002','f6840000-0000-4000-8000-000000000001','f6400000-0000-4000-8000-000000000002')$$,'%balance unavailable%','bank receipt also rejects an unknown balance');
insert into funding_results values('po',pg_temp.fund(1,'create_po','{"project_id":"f6300000-0000-4000-8000-000000000001","vendor_id":"f6800000-0000-4000-8000-000000000001","pour_plan_id":"f6600000-0000-4000-8000-000000000001"}'));
insert into funding_results values('po-line',pg_temp.fund(2,'add_po_line',jsonb_build_object('purchase_order_id',(select value->>'id' from funding_results where key='po'),'pour_cost_item_id','f6700000-0000-4000-8000-000000000001','cost_code_id','f6810000-0000-4000-8000-000000000001','description','Synthetic linked material','quantity',3,'unit','EA','unit_cost',20,'sales_tax',0)));
insert into funding_results values('unlinked',pg_temp.fund(3,'add_po_line',jsonb_build_object('purchase_order_id',(select value->>'id' from funding_results where key='po'),'cost_code_id','f6810000-0000-4000-8000-000000000001','description','Synthetic unlinked pour material','quantity',1,'unit','EA','unit_cost',15,'sales_tax',0)));
select pg_temp.fund(4,'issue_po',jsonb_build_object('purchase_order_id',(select value->>'id' from funding_results where key='po'),'issue_date','2026-10-16'));
insert into funding_results values('other-po',pg_temp.fund(5,'create_po','{"project_id":"f6300000-0000-4000-8000-000000000001","vendor_id":"f6800000-0000-4000-8000-000000000001"}'));
select pg_temp.fund(6,'add_po_line',jsonb_build_object('purchase_order_id',(select value->>'id' from funding_results where key='other-po'),'cost_code_id','f6810000-0000-4000-8000-000000000001','description','Synthetic other commitment','quantity',1,'unit','EA','unit_cost',10,'sales_tax',0));
select pg_temp.fund(7,'issue_po',jsonb_build_object('purchase_order_id',(select value->>'id' from funding_results where key='other-po'),'issue_date','2026-10-16'));
insert into funding_results values('bill',pg_temp.fund(8,'create_bill',jsonb_build_object('purchase_order_id',(select value->>'id' from funding_results where key='po'),'vendor_bill_number','SYN-FUNDING-BILL','bill_date','2026-10-16')));
select pg_temp.fund(9,'add_bill_line',jsonb_build_object('vendor_bill_id',(select value->>'id' from funding_results where key='bill'),'purchase_order_line_id',(select value->>'id' from funding_results where key='po-line'),'quantity',1,'unit_cost',20,'sales_tax',0));
select pg_temp.fund(10,'post_bill',jsonb_build_object('vendor_bill_id',(select value->>'id' from funding_results where key='bill')));
select extensions.ok((select incurred_direct_cost=20 and open_po_commitments=65 and project_funding_balance=68 from public.project_cash_funding_summary where project_id='f6300000-0000-4000-8000-000000000001'),'actual cost comes from posted bill and remaining commitments are separate');
select extensions.ok((select linked_actual_cost=20 and linked_open_po_commitment=40 and unlinked_pour_po_commitment=15 and remaining_pour_exposure=55 and other_project_open_commitments=10 and available_funding_for_this_pour=58 and required_additional_cash=0 and system_recommendation='clear' from public.pour_plan_financial_summary where pour_plan_id='f6600000-0000-4000-8000-000000000001'),'linked costs and current/other PO commitments count exactly once');
insert into funding_results values('review',jsonb_build_object('fingerprint',public.carez_pour_funding_fingerprint('f6200000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001')));
select extensions.lives_ok($$select public.carez_record_pour_authorization_v1('f6910000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001',(select value->>'fingerprint' from funding_results where key='review'),'authorized',null,null)$$,'decision and reviewed financial basis persist atomically');
select extensions.lives_ok($$select public.carez_record_pour_authorization_v1('f6910000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001',(select value->>'fingerprint' from funding_results where key='review'),'authorized',null,null)$$,'same decision request replays without another snapshot');
select extensions.is((select count(*)::integer from public.pour_authorization_snapshots),1,'one retained decision after retry');
select extensions.ok(public.carez_pour_authorization_current('f6200000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001'),'status transition itself does not invalidate reviewed financial basis');
select extensions.throws_like($$update public.pour_plans set status='hold' where id='f6600000-0000-4000-8000-000000000001'$$,'%governed pour authorization%','raw decision transition denied');
update public.pour_cost_items set expected_cost=200 where id='f6700000-0000-4000-8000-000000000001';
select extensions.is((select status from public.pour_plans where id='f6600000-0000-4000-8000-000000000001'),'planning','planned cost change invalidates authorization atomically');
select extensions.throws_like($$select public.carez_record_pour_authorization_v1('f6910000-0000-4000-8000-000000000002','f6600000-0000-4000-8000-000000000001',(select value->>'fingerprint' from funding_results where key='review'),'authorized',null,null)$$,'%Funding changed%','stale financial review cannot authorize changed exposure');
select extensions.throws_like($$select pg_temp.decide(2,'f6600000-0000-4000-8000-000000000001','authorized')$$,'%override reason is required%','known cash hold requires an explicit human override reason');
select extensions.lives_ok($$select pg_temp.decide(2,'f6600000-0000-4000-8000-000000000001','authorized','Recorded internal support decision')$$,'known hold can retain explicit human decision');
select extensions.ok((select override_used and override_reason='Recorded internal support decision' from public.pour_authorization_snapshots order by reviewed_at desc,id desc limit 1),'override reason is retained');
select extensions.throws_like($$delete from public.pour_authorization_snapshots$$,'%permission denied%','decision history cannot be deleted');
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.decide(3,'f6600000-0000-4000-8000-000000000001','hold')$$,'%Owner or office authority%','employee cannot make financial decisions');
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select pg_temp.decide(3,'f6600000-0000-4000-8000-000000000001','hold')$$,'%Pour unavailable%','foreign tenant cannot decide another company pour');
select extensions.ok(not public.carez_pour_authorization_current('f6200000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001'),'foreign employee clearance does not leak another company decision');
reset role;select * from extensions.finish();rollback;
