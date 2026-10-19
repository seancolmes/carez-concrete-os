-- Isolated contract-coherence fixture; no application/schema weakening.
-- Existing fixture bypasses, if any, are preserved historical test seams; no new
-- trigger bypass, permission grant, production defaults or business records added.
-- Isolated local fixture. Privileged setup is not onboarding/authentication evidence.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('e8100000-0000-4000-8000-000000000001','finance-owner@local.invalid'),
 ('e8100000-0000-4000-8000-000000000002','finance-employee@local.invalid'),
 ('e8100000-0000-4000-8000-000000000003','finance-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone) values
 ('e8200000-0000-4000-8000-000000000001','Synthetic finance contractor','America/Los_Angeles'),
 ('e8200000-0000-4000-8000-000000000002','Synthetic other contractor','America/New_York');
insert into public.profiles(id,company_id,role,full_name) values
 ('e8100000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001','owner','Fixture owner'),
 ('e8100000-0000-4000-8000-000000000002','e8200000-0000-4000-8000-000000000001','employee','Fixture employee'),
 ('e8100000-0000-4000-8000-000000000003','e8200000-0000-4000-8000-000000000002','owner','Foreign owner');
insert into public.projects(id,company_id,job_number,name,status) values
 ('e8300000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001','SYN-FIN-1','Synthetic financial job','active'),
 ('e8300000-0000-4000-8000-000000000002','e8200000-0000-4000-8000-000000000002','SYN-FIN-2','Foreign financial job','active');
insert into public.cost_codes(id,company_id,code,name,cost_type) values
 ('e8400000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001','MAT','Fixture material','material');
insert into public.vendors(id,company_id,name) values
 ('e8500000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001','Fixture supplier'),
 ('e8500000-0000-4000-8000-000000000002','e8200000-0000-4000-8000-000000000002','Foreign supplier');
insert into public.vendor_bills(id,company_id,project_id,vendor_id,vendor_bill_number) values
 ('e8600000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000001','e8300000-0000-4000-8000-000000000001','e8500000-0000-4000-8000-000000000001','FIXTURE-BILL'),
 ('e8600000-0000-4000-8000-000000000002','e8200000-0000-4000-8000-000000000002','e8300000-0000-4000-8000-000000000002','e8500000-0000-4000-8000-000000000002','FOREIGN-BILL');
insert into public.vendor_bill_lines(company_id,vendor_bill_id,cost_code_id,description,quantity,unit_cost,subtotal,sales_tax,total_cost)
 values('e8200000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000001','e8400000-0000-4000-8000-000000000001','Synthetic recorded amount',1,100,100,0,100);
update public.vendor_bills set status='posted' where id in('e8600000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000002');
insert into public.vendor_quotes(id,company_id,project_id,vendor_id,internal_quote_number) values
 ('e8700000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000002','e8300000-0000-4000-8000-000000000002','e8500000-0000-4000-8000-000000000002','FOREIGN-QUOTE');
insert into public.purchase_orders(id,company_id,project_id,vendor_id,po_number) values
 ('e8800000-0000-4000-8000-000000000001','e8200000-0000-4000-8000-000000000002','e8300000-0000-4000-8000-000000000002','e8500000-0000-4000-8000-000000000002','FOREIGN-PO');
select set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
-- First establish the current application ACL boundary.
select extensions.throws_ok($$insert into public.vendor_quote_lines(company_id,vendor_quote_id,cost_code_id,description) values('e8200000-0000-4000-8000-000000000001','e8700000-0000-4000-8000-000000000001','e8400000-0000-4000-8000-000000000001','Foreign parent')$$,'42501',null,'authenticated raw procurement source write 1 cannot bypass the governed command');
select extensions.throws_ok($$insert into public.purchase_order_lines(company_id,purchase_order_id,cost_code_id,description) values('e8200000-0000-4000-8000-000000000001','e8800000-0000-4000-8000-000000000001','e8400000-0000-4000-8000-000000000001','Foreign parent')$$,'42501',null,'authenticated raw procurement source write 2 cannot bypass the governed command');
select extensions.throws_ok($$insert into public.vendor_bill_lines(company_id,vendor_bill_id,cost_code_id,description) values('e8200000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000002','e8400000-0000-4000-8000-000000000001','Foreign parent')$$,'42501',null,'authenticated raw procurement source write 3 cannot bypass the governed command');
select extensions.throws_ok($$update public.vendor_bill_lines set description='Changed posted fact' where vendor_bill_id='e8600000-0000-4000-8000-000000000001'$$,'42501',null,'authenticated raw procurement source write 4 cannot bypass the governed command');
-- Preserve the four original business-guard assertions below and reach those
-- guards as the privileged fixture writer; do not grant app callers raw DML.
reset role;set local role postgres;
select extensions.throws_like($$insert into public.vendor_quote_lines(company_id,vendor_quote_id,cost_code_id,description) values('e8200000-0000-4000-8000-000000000001','e8700000-0000-4000-8000-000000000001','e8400000-0000-4000-8000-000000000001','Foreign parent')$$,'%parent belongs to another company%','own-company quote line cannot reference foreign parent with all optional links null');
select extensions.throws_like($$insert into public.purchase_order_lines(company_id,purchase_order_id,cost_code_id,description) values('e8200000-0000-4000-8000-000000000001','e8800000-0000-4000-8000-000000000001','e8400000-0000-4000-8000-000000000001','Foreign parent')$$,'%parent belongs to another company%','own-company PO line cannot reference foreign parent');
select extensions.throws_like($$insert into public.vendor_bill_lines(company_id,vendor_bill_id,cost_code_id,description) values('e8200000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000002','e8400000-0000-4000-8000-000000000001','Foreign parent')$$,'%parent belongs to another company%','own-company bill line cannot reference foreign parent');
select extensions.throws_like($$update public.vendor_bill_lines set description='Changed posted fact' where vendor_bill_id='e8600000-0000-4000-8000-000000000001'$$,'%locked in its current state%','posted bill source lines remain locked');
reset role;set local role authenticated;
select extensions.lives_ok($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000001','2026-10-16',40,'ach','fixture',2,'Synthetic payment')$$,'owner posts a governed vendor payment and fee');
select extensions.lives_ok($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000001','2026-10-16',40,'ach','fixture',2,'Synthetic payment')$$,'identical uncertain retry returns confirmed result');
select extensions.is((select count(*)::int from public.vendor_payments where company_id='e8200000-0000-4000-8000-000000000001'),1,'retry does not create a second payment');
select extensions.is((select count(*)::int from public.company_expenses where company_id='e8200000-0000-4000-8000-000000000001' and source_type='vendor_payment_fee'),1,'retry does not create a second fee');
select extensions.is((select balance_due from public.vendor_bill_ap_summary where vendor_bill_id='e8600000-0000-4000-8000-000000000001'),60::numeric,'authoritative AP balance excludes fee from bill principal');
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000001','e8600000-0000-4000-8000-000000000001','2026-10-16',41,'ach','fixture',2,'Synthetic payment')$$,'%reused with different values%','changed retry payload conflicts');
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000002','e8600000-0000-4000-8000-000000000001','2026-10-16',61,'ach',null,0,null)$$,'%exceeds vendor bill balance%','overpayment rejected against recorded balance');
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000003','e8600000-0000-4000-8000-000000000001','2026-10-16','NaN'::numeric,'ach',null,0,null)$$,'%greater than zero%','nonfinite payment rejected');
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000004','e8600000-0000-4000-8000-000000000001','2026-10-16',1,'ach',null,'NaN'::numeric,null)$$,'%fee cannot be negative%','nonfinite processing fee rejected');
select extensions.throws_like($$select public.record_vendor_bill_payment('e8600000-0000-4000-8000-000000000001','2026-10-16',1,'ach')$$,'%permission denied%','legacy payment RPC cannot bypass request boundary');
select extensions.throws_like($$insert into public.vendor_payments(company_id,vendor_id,amount) values('e8200000-0000-4000-8000-000000000001','e8500000-0000-4000-8000-000000000001',1)$$,'%permission denied%','raw payment insertion cannot bypass governed action');
select extensions.throws_like($$delete from public.vendor_payment_allocations where company_id='e8200000-0000-4000-8000-000000000001'$$,'%permission denied%','raw allocation deletion cannot erase outstanding debt');
select set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000005','e8600000-0000-4000-8000-000000000001','2026-10-16',1,'ach',null,0,null)$$,'%Owner or office authority required%','employee cannot post financial command');
select set_config('request.jwt.claim.sub','e8100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000006','e8600000-0000-4000-8000-000000000001','2026-10-16',1,'ach',null,0,null)$$,'%bill unavailable%','foreign owner cannot pay another tenant bill');
reset role;
select extensions.is((select count(*)::int from public.financial_command_requests where command='record_vendor_bill_payment'),1,'failed commands roll back their request records');
set local role anon;
select extensions.throws_like($$select public.carez_record_vendor_bill_payment_v2('e8900000-0000-4000-8000-000000000007','e8600000-0000-4000-8000-000000000001','2026-10-16',1,'ach',null,0,null)$$,'%permission denied%','anonymous cannot execute financial commands');
reset role;
select * from extensions.finish();
rollback;
