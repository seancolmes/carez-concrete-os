begin;
-- Synthetic local transaction only. Historical seeds are not issued invoices.
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('b9100000-0000-4000-8000-000000000001','billing-command-owner@local.invalid'),
 ('b9100000-0000-4000-8000-000000000002','billing-command-worker@local.invalid'),
 ('b9100000-0000-4000-8000-000000000003','billing-command-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name) values('b9200000-0000-4000-8000-000000000001','Synthetic billing contractor'),('b9200000-0000-4000-8000-000000000002','Other synthetic contractor');
insert into public.profiles(id,company_id,role) values
 ('b9100000-0000-4000-8000-000000000001','b9200000-0000-4000-8000-000000000001','owner'),
 ('b9100000-0000-4000-8000-000000000002','b9200000-0000-4000-8000-000000000001','employee'),
 ('b9100000-0000-4000-8000-000000000003','b9200000-0000-4000-8000-000000000002','owner');
insert into public.customers(id,company_id,name,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_postal_code,billing_terms)
 values('b9300000-0000-4000-8000-000000000001','b9200000-0000-4000-8000-000000000001','Synthetic GC','100 Synthetic Way','Suite2','Fixture town','OR','00000','Reviewed net30');
insert into public.company_billing_profiles(company_id,display_name,address_line1,address_line2,default_due_days)
 values('b9200000-0000-4000-8000-000000000001','Synthetic invoice sender','200 Sender Way','Sender suite',30);
insert into public.projects(id,company_id,customer_id,job_number,name,status,sales_tax_rate_percent,sales_tax_jurisdiction)
 values('b9400000-0000-4000-8000-000000000001','b9200000-0000-4000-8000-000000000001','b9300000-0000-4000-8000-000000000001','SYN-BILL-COMMAND','Synthetic billing job','active',10,'Synthetic jurisdiction');
insert into public.project_award_records(id,company_id,project_id,agreement_number,original_contract_value,status,authorization_text)
 values('b9450000-0000-4000-8000-000000000001','b9200000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001','SYN-HISTORICAL-AG',1000,'accepted','Synthetic historical agreement fixture');
insert into public.invoices(id,company_id,project_id,customer_id,invoice_number,invoice_type,status,issue_date,from_name,sales_tax_rate_percent,retainage_percent,created_by)
 select ('b9600000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b9200000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001','b9300000-0000-4000-8000-000000000001',
 'SYN-HISTORICAL-'||n,'progress','sent','2026-10-16','Synthetic historical sender',10,10,'b9100000-0000-4000-8000-000000000001' from generate_series(1,2)n;
insert into public.invoice_lines(company_id,invoice_id,description,quantity,unit_price,line_amount,taxable)
 select 'b9200000-0000-4000-8000-000000000001',id,'Synthetic recorded work',1,100,100,true from public.invoices where company_id='b9200000-0000-4000-8000-000000000001';
-- Faithful unknown PRE-CONTRACT payment status; restore the prospective guard.
alter table public.customer_payments drop constraint carez_customer_payment_state_known;
-- Some restored environments retain NOT NULL. Only this rolled-back synthetic
-- fixture relaxes it to exercise the explicitly supported unknown-history path;
-- it does not claim such a row exists in production or change the app contract.
alter table public.customer_payments alter column status drop not null;
insert into public.customer_payments(id,company_id,customer_id,project_id,amount,payment_method,status,created_by)
 values('b9700000-0000-4000-8000-000000000001','b9200000-0000-4000-8000-000000000001','b9300000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001',20,'check',null,'b9100000-0000-4000-8000-000000000001');
alter table public.customer_payments add constraint carez_customer_payment_state_known check(status is not null and status in ('posted','void')) not valid;
insert into public.payment_allocations(company_id,payment_id,invoice_id,amount)
 values('b9200000-0000-4000-8000-000000000001','b9700000-0000-4000-8000-000000000001','b9600000-0000-4000-8000-000000000002',20);
create temp table bill_results(key text primary key,value jsonb);grant all on bill_results to authenticated;
create function pg_temp.bill(n integer,c text,p jsonb) returns jsonb language sql as $$select public.carez_billing_command_v1(('b9500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)$$;
select set_config('request.jwt.claim.sub','b9100000-0000-4000-8000-000000000001',true);set local role authenticated;
insert into bill_results values('draft',pg_temp.bill(1,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","invoice_type":"progress","issue_date":"2026-10-16","retainage_percent":"5"}'));
select extensions.ok((select i.bill_to_address_line2='Suite2' and i.from_address_line2='Sender suite' and i.terms_text='Reviewed net30' and i.retainage_percent=5 and i.due_date='2026-11-15'
 from public.invoices i where i.id=(select (value->>'id')::uuid from bill_results where key='draft')),'draft snapshots customer line2 separately from sender and preserves terms/rate/due-day basis');
select extensions.is(pg_temp.bill(1,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","invoice_type":"progress","issue_date":"2026-10-16","retainage_percent":"5"}'),(select value from bill_results where key='draft'),'same create request returns one confirmed invoice');
select extensions.throws_like($$select pg_temp.bill(1,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","retainage_percent":"0"}')$$,'%different values%','changed create retry cannot alter saved facts');
select extensions.throws_like($$select pg_temp.bill(2,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001"}')$$,'%retainage_percent is required%','missing draft retainage never becomes zero');
insert into bill_results values('line',pg_temp.bill(2,'add_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='draft'),'description','Synthetic quantity','quantity','1','unit_price','100','taxable','on')));
select extensions.is((select subtotal from public.invoice_financial_summary where invoice_id=(select (value->>'id')::uuid from bill_results where key='draft')),100::numeric,'line amount uses saved quantity and price');
select extensions.throws_like($$select pg_temp.bill(3,'delete_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='draft'),'line_id',(select id from public.invoice_lines where invoice_id='b9600000-0000-4000-8000-000000000001')))$$,'%unavailable in this draft%','a draft ID cannot delete a different sent invoice line');
select extensions.lives_ok($$select pg_temp.bill(3,'send_invoice',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='draft')))$$,'draft sends atomically after current subtotal checks');
select extensions.is(pg_temp.bill(2,'add_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='draft'),'description','Synthetic quantity','quantity','1','unit_price','100','taxable','on')),(select value from bill_results where key='line'),'uncertain line retry replays even after invoice is sent');
select extensions.throws_like($$select pg_temp.bill(4,'add_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='draft'),'description','late','quantity','1','unit_price','2'))$$,'%Only draft invoices%','sent invoice cannot receive another line');
select extensions.throws_like($$select pg_temp.bill(4,'void_invoice','{"invoice_id":"b9600000-0000-4000-8000-000000000002"}')$$,'%payment basis unavailable%','unknown historical payment cannot be treated as zero to void');
select extensions.throws_like($$update public.invoices set status='void'$$,'%permission denied%','raw invoice writes cannot bypass governed status checks');
select extensions.throws_like($$delete from public.invoice_lines$$,'%permission denied%','raw line writes cannot bypass draft association');
select extensions.throws_like($$delete from public.project_payment_milestones$$,'%permission denied%','raw milestone writes cannot bypass invoice links');
insert into bill_results values('credit',pg_temp.bill(4,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","invoice_type":"credit_memo","retainage_percent":"0"}'));
select pg_temp.bill(5,'add_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='credit'),'description','Synthetic credit tie','quantity','1.5','unit_price','-0.01'));
select extensions.is((select line_amount from public.invoice_lines where invoice_id=(select (value->>'id')::uuid from bill_results where key='credit')),-0.01::numeric,'negative half-cent preserves existing Math.round tie direction');
insert into bill_results values('release',pg_temp.bill(6,'create_retainage_release','{"source_invoice_id":"b9600000-0000-4000-8000-000000000001","amount":"6","issue_date":"2026-10-16"}'));
select extensions.ok((select i.invoice_type='retainage_release' and i.retainage_percent=0 and l.source_invoice_id='b9600000-0000-4000-8000-000000000001' and l.line_amount=6 and not l.taxable
 from public.invoices i join public.invoice_lines l on l.invoice_id=i.id where i.id=(select (value->>'id')::uuid from bill_results where key='release')),'release header and one linked nontaxable line persist together');
select extensions.is(pg_temp.bill(6,'create_retainage_release','{"source_invoice_id":"b9600000-0000-4000-8000-000000000001","amount":"6","issue_date":"2026-10-16"}'),(select value from bill_results where key='release'),'release retry cannot reserve retainage twice');
select extensions.throws_like($$select pg_temp.bill(7,'create_retainage_release','{"source_invoice_id":"b9600000-0000-4000-8000-000000000001","amount":"5"}')$$,'%exceeds retainage currently available%','next serialized release rechecks installed availability');
select extensions.throws_like($$select pg_temp.bill(7,'void_invoice','{"invoice_id":"b9600000-0000-4000-8000-000000000001"}')$$,'%retainage releases require their recorded source%','a source cannot be voided under existing release commitments');
select extensions.lives_ok($$select pg_temp.bill(10,'send_invoice',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='release')))$$,'valid release sends only with retained source lineage');
select extensions.throws_like($$select pg_temp.bill(11,'update_invoice',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='credit'),'issue_date','2026-10-16','due_date',null,'sales_tax_rate_percent','10','retainage_percent','0'))$$,'%Recorded date is required%','blank update due date is rejected consistently on both schema shapes');
insert into bill_results values('milestone',pg_temp.bill(7,'add_payment_milestone','{"project_id":"b9400000-0000-4000-8000-000000000001","award_record_id":"b9450000-0000-4000-8000-000000000001","label":"Synthetic deposit","milestone_type":"deposit","amount_basis":"percent","percent_of_contract":"20","required_before_start":"on"}'));
select extensions.ok((select amount=200 and required_before_start and due_trigger='before_start' from public.project_payment_milestones where id=(select (value->>'id')::uuid from bill_results where key='milestone')),'milestone uses recorded agreement percentage without altering baseline');
reset role;
create function pg_temp.fail_bill_line() returns trigger language plpgsql as $$begin raise exception 'Synthetic invoice-line failure';end$$;
create trigger synthetic_billing_line_failure before insert on public.invoice_lines for each row execute function pg_temp.fail_bill_line();
set local role authenticated;
select extensions.throws_like($$select pg_temp.bill(8,'create_milestone_invoice',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='milestone'),'retainage_percent','0'))$$,'%Synthetic invoice-line failure%','late milestone line failure reaches the caller');
select extensions.ok((select invoice_id is null from public.project_payment_milestones where id=(select (value->>'id')::uuid from bill_results where key='milestone')) and
 not exists(select 1 from public.invoices where invoice_type='deposit') and not exists(select 1 from public.financial_command_requests where request_id='b9500000-0000-4000-8000-000000000008'),'late failure rolls back invoice, link and request together');
reset role;drop trigger synthetic_billing_line_failure on public.invoice_lines;set local role authenticated;
insert into bill_results values('milestone-invoice',pg_temp.bill(8,'create_milestone_invoice',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='milestone'),'retainage_percent','0')));
select extensions.is(pg_temp.bill(8,'create_milestone_invoice',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='milestone'),'retainage_percent','0')),(select value from bill_results where key='milestone-invoice'),'retry returns the same linked milestone invoice');
select extensions.ok((select m.invoice_id=i.id and i.invoice_type='deposit' and l.line_amount=200 from public.project_payment_milestones m join public.invoices i on i.id=m.invoice_id join public.invoice_lines l on l.invoice_id=i.id
 where m.id=(select (value->>'id')::uuid from bill_results where key='milestone')),'reopen shows linked deposit, not progress or fabricated retainage revenue');
select extensions.throws_like($$select pg_temp.bill(9,'create_milestone_invoice',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='milestone'),'retainage_percent','0'))$$,'%already has an invoice%','different request cannot duplicate milestone invoice');
select extensions.throws_like($$select pg_temp.bill(9,'delete_payment_milestone',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='milestone')))$$,'%already has an invoice%','linked prestart requirement cannot be deleted');
select extensions.throws_like($$select pg_temp.bill(9,'waive_payment_milestone',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='milestone'),'reason','Synthetic review'))$$,'%already has an invoice%','linked requirement cannot race into a waiver');
insert into bill_results values('waiver',pg_temp.bill(11,'add_payment_milestone','{"project_id":"b9400000-0000-4000-8000-000000000001","award_record_id":"b9450000-0000-4000-8000-000000000001","label":"Synthetic second draw","milestone_type":"progress","amount_basis":"fixed","fixed_amount":"50"}'));
select extensions.lives_ok($$select pg_temp.bill(12,'waive_payment_milestone',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='waiver'),'reason','Synthetic recorded arrangement'))$$,'an uninvoiced requirement can be waived with its reason');
select extensions.throws_like($$select pg_temp.bill(13,'create_milestone_invoice',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='waiver'),'retainage_percent','0'))$$,'%was waived%','waived requirement cannot create another invoice');
select extensions.lives_ok($$select pg_temp.bill(13,'delete_payment_milestone',jsonb_build_object('project_id','b9400000-0000-4000-8000-000000000001','milestone_id',(select value->>'id' from bill_results where key='waiver')))$$,'uninvoiced milestone deletion confirms its scoped record');
reset role;
update public.projects set sales_tax_rate_percent='NaN'::numeric where id='b9400000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_like($$select pg_temp.bill(14,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","retainage_percent":"0"}')$$,'%tax basis unavailable or nonfinite%','nonfinite copied project tax cannot create a financial document');
reset role;
update public.projects set sales_tax_rate_percent=10 where id='b9400000-0000-4000-8000-000000000001';
insert into public.invoices(id,company_id,project_id,invoice_number,invoice_type,status,issue_date,from_name,sales_tax_rate_percent,created_by)
 values('b9600000-0000-4000-8000-000000000003','b9200000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001','SYN-HISTORICAL-NONFINITE','credit_memo','draft','2026-10-16','Synthetic historical draft','NaN'::numeric,'b9100000-0000-4000-8000-000000000001');
insert into public.invoice_lines(company_id,invoice_id,description,quantity,unit_price,line_amount,taxable)
 values('b9200000-0000-4000-8000-000000000001','b9600000-0000-4000-8000-000000000003','Historical malformed tax fixture',1,-100,-100,true);
set local role authenticated;
select extensions.throws_like($$select pg_temp.bill(14,'send_invoice','{"invoice_id":"b9600000-0000-4000-8000-000000000003"}')$$,'%Invoice amount unavailable%','finite subtotal does not certify a nonfinite final invoice total');
reset role;
update public.projects set sales_tax_rate_percent=0,sales_tax_jurisdiction=null where id='b9400000-0000-4000-8000-000000000001';
set local role authenticated;
insert into bill_results values('pending-tax',pg_temp.bill(14,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","retainage_percent":"0"}'));
select pg_temp.bill(15,'add_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='pending-tax'),'description','Pending treatment draft','quantity','1','unit_price','10','taxable','on'));
select extensions.throws_like($$select pg_temp.bill(16,'send_invoice',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='pending-tax')))$$,'%Finish the job tax setup%','a default-zero unconfigured job may draft but cannot issue');
reset role;
update public.projects set sales_tax_rate_percent=10,sales_tax_jurisdiction='Synthetic jurisdiction' where id='b9400000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_like($$select pg_temp.bill(16,'send_invoice',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='pending-tax')))$$,'%Draft tax snapshot is incomplete%','current setup does not silently replace an older incomplete draft snapshot');
reset role;
update public.projects set sales_tax_exempt=true,sales_tax_rate_percent=0,sales_tax_jurisdiction=null where id='b9400000-0000-4000-8000-000000000001';
set local role authenticated;
insert into bill_results values('exempt',pg_temp.bill(16,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","retainage_percent":"0"}'));
select pg_temp.bill(17,'add_invoice_line',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='exempt'),'description','Explicit exempt treatment','quantity','1','unit_price','10','taxable','on'));
select extensions.lives_ok($$select pg_temp.bill(18,'send_invoice',jsonb_build_object('invoice_id',(select value->>'id' from bill_results where key='exempt')))$$,'recorded exemption preserves a valid zero-tax issuance');
select set_config('request.jwt.claim.sub','b9100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.bill(9,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","retainage_percent":"0"}')$$,'%Owner or office authority required%','employee cannot draft invoices');
select set_config('request.jwt.claim.sub','b9100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select pg_temp.bill(9,'create_invoice','{"project_id":"b9400000-0000-4000-8000-000000000001","retainage_percent":"0"}')$$,'%Job unavailable%','foreign tenant cannot invoice this job');
reset role;set local role anon;
select extensions.throws_like($$select pg_temp.bill(9,'create_invoice','{}')$$,'%permission denied%','anonymous cannot invoke billing commands');
reset role;select * from extensions.finish();rollback;
