begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email) values ('a1111111-1111-4111-8111-111111111111','billing@carez.invalid');
insert into public.companies(id,name) values ('a2222222-2222-4222-8222-222222222222','Billing fixture');
insert into public.profiles(id,company_id,full_name,role)
values ('a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222','Billing Office','office');
insert into public.customers(id,company_id,name) values ('a3333333-3333-4333-8333-333333333333','a2222222-2222-4222-8222-222222222222','Billing Customer');
insert into public.projects(id,company_id,customer_id,job_number,name,contract_value)
values ('a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','BILL-01','Billing Fixture Job',1000);
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select extensions.plan(10);
select extensions.ok(to_regclass('public.invoices') is not null,'invoice table is source-controlled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.invoices'::regclass),'invoices enforce RLS');
select extensions.ok(has_function_privilege('authenticated','public.next_invoice_number()','execute'),'office can request invoice numbers');
select extensions.is(public.next_invoice_number(),'INV-'||extract(year from current_date)::integer::text||'-00001','invoice number is tenant-scoped and deterministic');
insert into public.invoices(company_id,project_id,customer_id,invoice_number,invoice_type,status,issue_date,from_name,sales_tax_rate_percent,retainage_percent,created_by)
values ('a2222222-2222-4222-8222-222222222222','a4444444-4444-4444-8444-444444444444','a3333333-3333-4333-8333-333333333333','INV-FIXTURE-01','progress','sent','2026-09-26','Carez Concrete',10,10,'a1111111-1111-4111-8111-111111111111');
insert into public.invoice_lines(company_id,invoice_id,description,quantity,unit,unit_price,line_amount,taxable)
select 'a2222222-2222-4222-8222-222222222222',id,'Concrete work',1,'LS',100,100,true from public.invoices where invoice_number='INV-FIXTURE-01';
select extensions.is((select subtotal from public.invoice_financial_summary where invoice_number='INV-FIXTURE-01'),100::numeric,'invoice subtotal is sourced from invoice lines');
select extensions.is((select tax_amount from public.invoice_financial_summary where invoice_number='INV-FIXTURE-01'),10::numeric,'tax is deterministic and line-scoped');
select extensions.is((select retainage_held from public.invoice_financial_summary where invoice_number='INV-FIXTURE-01'),10::numeric,'retainage is held separately from invoice lines');
insert into public.customer_payments(company_id,customer_id,project_id,received_date,amount,payment_method,created_by)
values ('a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','a4444444-4444-4444-8444-444444444444','2026-09-26',60,'check','a1111111-1111-4111-8111-111111111111');
insert into public.payment_allocations(company_id,payment_id,invoice_id,amount)
select 'a2222222-2222-4222-8222-222222222222',p.id,i.id,60 from public.customer_payments p,public.invoices i where p.amount=60 and i.invoice_number='INV-FIXTURE-01';
select extensions.is((select balance_due from public.invoice_financial_summary where invoice_number='INV-FIXTURE-01'),40::numeric,'payment application reduces balance without rewriting invoice facts');
select extensions.is((select outstanding_ar from public.project_billing_summary where project_id='a4444444-4444-4444-8444-444444444444'),40::numeric,'project billing summary reconciles applied payment');
select extensions.is((select available_to_release from public.retainage_available_summary where source_invoice_id=(select id from public.invoices where invoice_number='INV-FIXTURE-01')),10::numeric,'unreleased retainage remains available');
reset role;
select * from extensions.finish();
rollback;
