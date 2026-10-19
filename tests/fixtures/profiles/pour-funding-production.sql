-- Production-profile complement to the canonical legacy-history funding fixture.
-- Run as postgres only in an isolated disposable local production-shaped database
-- AFTER the complete current migration chain (including 133000/133500/133600).
-- All synthetic data and real signup-trigger side effects roll back.
-- 24 assertions cover 23 applicable original scenarios plus the governed cost-change
-- regression. Raw-write denial now asserts the current table ACL. Original ordinals
-- 2,7,8,9,10,13,14,15,16 require legacy NULL payment status and are NOT
-- REPRESENTABLE with the captured status NOT NULL contract; never count them as
-- passed or skipped tests. Qualify them using the original canonical fixture.
-- Privileged synthetic historical financial seeds are not UI submission evidence.
begin;
set local time zone 'UTC';
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
create extension if not exists pgtap with schema extensions;
select extensions.plan(24);
do $profile$ begin
 if not exists(select 1 from pg_attribute where attrelid='public.customer_payments'::regclass and attname='status' and attnum>0 and not attisdropped and attnotnull) then
  raise exception 'This fixture requires the captured production customer_payments.status NOT NULL profile; run the original canonical fixture for legacy nullable history';
 end if;
end $profile$;
-- Real signup trigger, matching the qualified proposal-issue fixture pattern.
-- The privileged assignments establish fixture roles/tenants only; they do not
-- qualify employee onboarding or claim a genuine invite/connected Crew journey.
insert into auth.users(id,email,raw_user_meta_data) values
('f6100000-0000-4000-8000-000000000001','funding-owner@local.invalid','{"company_name":"Synthetic funding owner signup","full_name":"Synthetic Funding Owner","operating_timezone":"UTC"}'),
('f6100000-0000-4000-8000-000000000002','funding-employee@local.invalid','{"company_name":"Synthetic funding employee signup","full_name":"Synthetic Funding Employee","operating_timezone":"UTC"}'),
('f6100000-0000-4000-8000-000000000003','funding-foreign@local.invalid','{"company_name":"Synthetic foreign funding signup","full_name":"Synthetic Foreign Owner","operating_timezone":"UTC"}');
insert into public.companies(id,name,operating_timezone) values('f6200000-0000-4000-8000-000000000001','Synthetic funding contractor','UTC'),('f6200000-0000-4000-8000-000000000002','Other funding contractor','UTC');
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
('f6100000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','Synthetic Funding Owner','owner'),
('f6100000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','Synthetic Funding Employee','employee'),
('f6100000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000002','Synthetic Foreign Owner','owner')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
insert into public.projects(id,company_id,job_number,name,status,contract_value) values
('f6300000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','SYN-KNOWN','Posted funding','active',1000),
('f6300000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001','SYN-EMPTY','Recorded empty funding','active',0);
insert into public.invoices(id,company_id,project_id,invoice_number,invoice_type,status,issue_date,from_name,sales_tax_rate_percent,retainage_percent,created_by)
select ('f6400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6200000-0000-4000-8000-000000000001',('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'INV-SYN-'||n,'progress','sent','2026-10-16','Synthetic sender',10,10,'f6100000-0000-4000-8000-000000000001' from generate_series(1,1)n;
insert into public.invoice_lines(company_id,invoice_id,description,quantity,unit,unit_price,line_amount,taxable)
select 'f6200000-0000-4000-8000-000000000001',id,'Synthetic placed work',1,'LS',100,100,true from public.invoices where company_id='f6200000-0000-4000-8000-000000000001';
-- Synthetic recorded posted/void history; all current constraints and triggers remain active.
insert into public.customer_payments(id,company_id,project_id,received_date,amount,processing_fee,payment_method,status,created_by)
values('f6500000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000001','2026-10-16',100,2,'check','posted','f6100000-0000-4000-8000-000000000001'),
('f6500000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000001','2026-10-16',25,9,'check','void','f6100000-0000-4000-8000-000000000001');
insert into public.payment_allocations(company_id,payment_id,invoice_id,amount)
select 'f6200000-0000-4000-8000-000000000001',id,'f6400000-0000-4000-8000-000000000001'::uuid,amount from public.customer_payments where company_id='f6200000-0000-4000-8000-000000000001';
-- The full installed payment contract remains in force throughout this fixture.
insert into public.pour_plans(id,company_id,project_id,name,contingency_percent,minimum_cash_buffer,company_cash_support)
values('f6600000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000001','Synthetic known pour',10,2,5),
('f6600000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000001','f6300000-0000-4000-8000-000000000003','Synthetic zero exposure',10,0,0);
insert into public.pour_cost_items(id,company_id,pour_plan_id,item_type,description,quantity,unit,unit_cost,expected_cost)
values('f6700000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6600000-0000-4000-8000-000000000001','concrete','Synthetic linked cost',1,'EA',50,50);
insert into public.vendors(id,company_id,name) values('f6800000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','Synthetic supplier');
insert into public.cost_codes(id,company_id,code,name,cost_type) values('f6810000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','SYN-FUND','Synthetic material','material');
create temp table funding_results(key text primary key,value jsonb);grant all on funding_results to authenticated;
create function pg_temp.fund(n integer,c text,p jsonb) returns jsonb language sql as $$select public.carez_procurement_command_v1(('f6900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)$$;
create function pg_temp.decide(n integer,p uuid,d text,r text default null) returns jsonb language sql as $$select public.carez_record_pour_authorization_v1(('f6910000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,p,public.carez_pour_funding_fingerprint('f6200000-0000-4000-8000-000000000001',p),d,r,null)$$;
-- Explicit historical agreement fixtures qualify the independent setup gates.
update public.projects set sales_tax_exempt=true where company_id='f6200000-0000-4000-8000-000000000001';
insert into public.project_award_records(id,company_id,project_id,agreement_number,original_contract_value,status,authorization_text)
select ('f6850000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6200000-0000-4000-8000-000000000001',('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'SYN-PRESTART-'||n,1000,'accepted','Synthetic historical agreement evidence' from generate_series(1,1)n;
insert into public.project_payment_milestones(id,company_id,project_id,award_record_id,label,amount_basis,amount,required_before_start,invoice_id,created_by)
select ('f6860000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6200000-0000-4000-8000-000000000001',('f6300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f6850000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic required deposit','fixed',100,true,('f6400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'f6100000-0000-4000-8000-000000000001' from generate_series(1,1)n;
select set_config('request.jwt.claim.sub','f6100000-0000-4000-8000-000000000001',true);set local role authenticated;
select extensions.ok((select job_ready and required_before_start_open_count=0 and required_before_start_paid_amount=100 from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000001'),'known posted payment clears only the configured pre-start requirement');
-- Original assertion 2: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
reset role;update public.invoices set status='void' where id='f6400000-0000-4000-8000-000000000001';set local role authenticated;
select extensions.ok((select not job_ready and required_before_start_open_count=1 from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000001'),'void invoice never clears a required deposit');
reset role;update public.invoices set status='draft' where id='f6400000-0000-4000-8000-000000000001';set local role authenticated;
select extensions.ok((select not job_ready and required_before_start_open_count=1 from public.project_job_readiness_summary where project_id='f6300000-0000-4000-8000-000000000001'),'draft invoice never clears a required deposit');
reset role;update public.invoices set status='sent' where id='f6400000-0000-4000-8000-000000000001';set local role authenticated;
select extensions.is((select amount_paid from public.invoice_financial_summary where invoice_id='f6400000-0000-4000-8000-000000000001'),100::numeric,'only posted allocations pay the invoice');
select extensions.is((select balance_due from public.invoice_financial_summary where invoice_id='f6400000-0000-4000-8000-000000000001'),0::numeric,'void allocation does not overpay invoice');
-- Original assertion 7: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
-- Original assertion 8: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
-- Original assertion 9: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
-- Original assertion 10: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
select extensions.ok((select gross_customer_cash=100 and sales_tax_cash_reserved=10 and processing_fees_paid=2 and net_customer_funding=88 from public.project_cash_funding_summary where project_id='f6300000-0000-4000-8000-000000000001'),'posted cash reserves installed invoice tax and only posted fees');
select extensions.ok((select gross_customer_cash=0 and incurred_direct_cost=0 and funding_basis_status='known' from public.project_cash_funding_summary where project_id='f6300000-0000-4000-8000-000000000003'),'successful empty sources retain genuine zero');
-- Original assertion 13: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
-- Original assertion 14: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
-- Original assertion 15: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
-- Original assertion 16: NOT REPRESENTABLE under this production status NOT NULL profile; see coverage manifest.
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
select extensions.throws_ok($$update public.pour_plans set status='hold' where id='f6600000-0000-4000-8000-000000000001'$$,'42501',null,'authenticated raw decision transition is denied by the table ACL');
-- A supported add_cost command cannot rewrite the consumed/PO-linked original
-- item. Add 140 of explicit synthetic uncommitted cost: planned 50+140=190;
-- remaining max(50-20 actual,40 open linked PO)+140+15 unlinked PO=195.
-- This preserves the original downstream funding exposure without inventing a
-- PO link or weakening the immutable/ACL boundaries. CAS uses the actual plan.
insert into funding_results values('planned-change',public.carez_pour_planning_command_v1(
 'f6930000-0000-4000-8000-000000000001','add_cost',jsonb_build_object(
 'pour_plan_id','f6600000-0000-4000-8000-000000000001',
 'expected_updated_at',(select updated_at from public.pour_plans where company_id='f6200000-0000-4000-8000-000000000001' and id='f6600000-0000-4000-8000-000000000001'),
 'item_type','concrete','description','Synthetic additional uncommitted concrete cost',
 'quantity',1,'unit','EA','unit_cost',140)));
select extensions.is((select status from public.pour_plans where id='f6600000-0000-4000-8000-000000000001'),'planning','planned cost change invalidates authorization atomically');
select extensions.ok((select planned_exposure=190 and remaining_pour_exposure=195 and contingency_amount=19.50 and required_additional_cash=153.50 and system_recommendation='hold' from public.pour_plan_financial_summary where pour_plan_id='f6600000-0000-4000-8000-000000000001'),'governed additional cost records 190 planned and preserves 195 remaining funding exposure');
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
