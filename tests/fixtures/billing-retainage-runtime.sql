-- Isolated signup-compatible authorization fixture.
-- Real signup metadata + explicit UTC fixture calendar + privileged original
-- authorization-context assignment only. No assertion/business-record rewrite,
-- trigger bypass, account/company cleanup, or claim of onboarding qualification.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users(id,email,raw_user_meta_data) values
  ('a1111111-1111-4111-8111-111111111111', 'billing@carez.invalid', jsonb_build_object('company_name','Billing fixture','full_name','Billing Office','operating_timezone','UTC'));
insert into public.companies(id,name,operating_timezone) values
  ('a2222222-2222-4222-8222-222222222222', 'Billing fixture', 'UTC');
-- Privileged setup mirrors proposal-issue-runtime: preserve the original
-- company/role/name contexts after real signup; application ACLs stay unchanged.
update public.profiles p set company_id=v.company_id::uuid,full_name=v.full_name,role=v.role
from (values
  ('a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'Billing Office', 'office')) v(id,company_id,full_name,role)
where p.id=v.id::uuid;
insert into public.customers(id,company_id,name,billing_address_line1,billing_city,billing_state,billing_postal_code,billing_terms) values ('a3333333-3333-4333-8333-333333333333','a2222222-2222-4222-8222-222222222222','Billing Customer','100 Synthetic Way','Fixture town','WA','00000','Explicit synthetic terms');
insert into public.company_billing_profiles(company_id,display_name,address_line1,default_due_days) values('a2222222-2222-4222-8222-222222222222','Synthetic billing sender','200 Sender Way',30);
insert into public.projects(id,company_id,customer_id,job_number,name,contract_value,sales_tax_rate_percent,sales_tax_jurisdiction)
values ('a4444444-4444-4444-8444-444444444444','a2222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333','BILL-01','Billing Fixture Job',1000,10,'Synthetic jurisdiction');
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
create temp table bill_fixture_results(key text primary key,value jsonb);grant all on bill_fixture_results to authenticated;
set local role authenticated;
select extensions.plan(10);
select extensions.ok(to_regclass('public.invoices') is not null,'invoice table is source-controlled');
select extensions.ok((select relrowsecurity from pg_class where oid='public.invoices'::regclass),'invoices enforce RLS');
select extensions.ok(has_function_privilege('authenticated','public.next_invoice_number()','execute'),'office can request invoice numbers');
select extensions.matches(public.next_invoice_number(),'^INV-[0-9]+(-[0-9]+)?$','invoice number preserves the installed tenant invoice series; no new format is imposed');
insert into bill_fixture_results values('invoice',public.carez_billing_command_v1('a9999999-9999-4999-8999-999999999991','create_invoice','{"project_id":"a4444444-4444-4444-8444-444444444444","invoice_type":"progress","issue_date":"2026-09-26","retainage_percent":10}'));
select public.carez_billing_command_v1('a9999999-9999-4999-8999-999999999992','add_invoice_line',(select jsonb_build_object('invoice_id',value->>'id','description','Concrete work','quantity',1,'unit','LS','unit_price',100,'taxable','on') from bill_fixture_results where key='invoice'));
select public.carez_billing_command_v1('a9999999-9999-4999-8999-999999999993','send_invoice',(select jsonb_build_object('invoice_id',value->>'id') from bill_fixture_results where key='invoice'));
select extensions.is((select subtotal from public.invoice_financial_summary where invoice_id=(select (value->>'id')::uuid from bill_fixture_results where key='invoice')),100::numeric,'invoice subtotal is sourced from invoice lines');
select extensions.is((select tax_amount from public.invoice_financial_summary where invoice_id=(select (value->>'id')::uuid from bill_fixture_results where key='invoice')),10::numeric,'tax is deterministic and line-scoped');
select extensions.is((select retainage_held from public.invoice_financial_summary where invoice_id=(select (value->>'id')::uuid from bill_fixture_results where key='invoice')),10::numeric,'retainage is held separately from invoice lines');
select public.carez_record_invoice_payment_v2('a9999999-9999-4999-8999-999999999994',(select (value->>'id')::uuid from bill_fixture_results where key='invoice'),'{"received_date":"2026-09-26","amount":60,"processing_fee":0,"payment_method":"check"}');
select extensions.is((select balance_due from public.invoice_financial_summary where invoice_id=(select (value->>'id')::uuid from bill_fixture_results where key='invoice')),40::numeric,'payment application reduces balance without rewriting invoice facts');
select extensions.is((select outstanding_ar from public.project_billing_summary where project_id='a4444444-4444-4444-8444-444444444444'),40::numeric,'project billing summary reconciles applied payment');
select extensions.is((select available_to_release from public.retainage_available_summary where source_invoice_id=(select (value->>'id')::uuid from bill_fixture_results where key='invoice')),10::numeric,'unreleased retainage remains available');
reset role;
select * from extensions.finish();
rollback;
