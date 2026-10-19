-- Isolated contract-coherence fixture; no application/schema weakening.
-- Existing fixture bypasses, if any, are preserved historical test seams; no new
-- trigger bypass, permission grant, production defaults or business records added.
-- Disposable local records; all writes roll back.
begin;set local search_path=pg_catalog,public,extensions;
create extension if not exists pgtap with schema extensions;select extensions.no_plan();
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values('d1100000-0000-4000-8000-000000000001','procurement-owner@local.invalid'),('d1100000-0000-4000-8000-000000000002','procurement-employee@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone) values('d1200000-0000-4000-8000-000000000001','Synthetic procurement contractor','UTC'),('d1200000-0000-4000-8000-000000000002','Other synthetic contractor','UTC');
insert into public.profiles(id,company_id,role,full_name) values('d1100000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','owner','Synthetic owner'),('d1100000-0000-4000-8000-000000000002','d1200000-0000-4000-8000-000000000001','employee','Synthetic employee');
insert into public.projects(id,company_id,job_number,name,status) values('d1300000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','SYN-PO','Synthetic purchasing job','active'),('d1300000-0000-4000-8000-000000000002','d1200000-0000-4000-8000-000000000002','SYN-FOREIGN','Foreign purchasing job','active');
insert into public.vendors(id,company_id,name) values('d1400000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','Synthetic supplier');
insert into public.cost_codes(id,company_id,code,name,cost_type) values('d1500000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','51410','Synthetic concrete','material');
insert into public.pour_plans(id,company_id,project_id,name,status) values('d1600000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','Explicit held pour','hold'),('d1600000-0000-4000-8000-000000000002','d1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','Previously authorized pour','authorized');
insert into public.production_tasks(id,company_id,name,production_unit) values('d1700000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','Synthetic concrete placement','CY');
insert into public.work_packages(id,company_id,project_id,name) values('d1800000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','Synthetic pour package');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,planned_quantity,unit,measurement_method,pour_plan_id,requires_prior_operations) values('d1850000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','d1800000-0000-4000-8000-000000000001','d1700000-0000-4000-8000-000000000001',10,'CY','ticket','d1600000-0000-4000-8000-000000000001',false);
insert into public.company_documents(id,company_id,project_id,title,document_type,storage_path) values('d1860000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','Synthetic evidence only','concrete_ticket','synthetic/local-only-ticket.pdf');
create temp table procurement_input as select jsonb_build_object('project_id','d1300000-0000-4000-8000-000000000001','vendor_id','d1400000-0000-4000-8000-000000000001','quote_date','2026-10-16','pour_plan_id','d1600000-0000-4000-8000-000000000001') header,
 jsonb_build_object('cost_code_id','d1500000-0000-4000-8000-000000000001','description','Synthetic concrete','quantity',10,'unit','CY','unit_cost',10,'sales_tax',0) line;
create temp table procurement_results(key text primary key,value jsonb);grant all on procurement_results to authenticated;grant select on procurement_input to authenticated;
create function pg_temp.procure(n integer,c text,p jsonb) returns jsonb language sql as $$select public.carez_procurement_command_v1(('d1900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)$$;
-- Exact history snapshot makes deletion safety independent of which retained
-- guard PostgreSQL reaches first. No financial authority or data is substituted.
create function pg_temp.procurement_fixture_history() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'project',(select to_jsonb(p) from public.projects p where p.company_id=public.get_my_company_id() and p.id='d1300000-0000-4000-8000-000000000001'),
  'quotes',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.vendor_quotes x where x.company_id=public.get_my_company_id() and x.project_id='d1300000-0000-4000-8000-000000000001'),
  'quote_lines',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.vendor_quote_lines x join public.vendor_quotes p on p.company_id=x.company_id and p.id=x.vendor_quote_id where x.company_id=public.get_my_company_id() and p.project_id='d1300000-0000-4000-8000-000000000001'),
  'orders',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.purchase_orders x where x.company_id=public.get_my_company_id() and x.project_id='d1300000-0000-4000-8000-000000000001'),
  'order_lines',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.purchase_order_lines x join public.purchase_orders p on p.company_id=x.company_id and p.id=x.purchase_order_id where x.company_id=public.get_my_company_id() and p.project_id='d1300000-0000-4000-8000-000000000001'),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.purchase_order_receipts x join public.purchase_orders p on p.company_id=x.company_id and p.id=x.purchase_order_id where x.company_id=public.get_my_company_id() and p.project_id='d1300000-0000-4000-8000-000000000001'),
  'bills',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.vendor_bills x where x.company_id=public.get_my_company_id() and x.project_id='d1300000-0000-4000-8000-000000000001'),
  'bill_lines',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.vendor_bill_lines x join public.vendor_bills p on p.company_id=x.company_id and p.id=x.vendor_bill_id where x.company_id=public.get_my_company_id() and p.project_id='d1300000-0000-4000-8000-000000000001'),
  'documents',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.company_documents x where x.company_id=public.get_my_company_id() and x.project_id='d1300000-0000-4000-8000-000000000001'),
  'actual_costs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) from public.project_costs x where x.company_id=public.get_my_company_id() and x.project_id='d1300000-0000-4000-8000-000000000001'))
$$;
select set_config('request.jwt.claim.sub','d1100000-0000-4000-8000-000000000001',true);set local role authenticated;
select extensions.lives_ok($$insert into procurement_results values('quote',pg_temp.procure(1,'create_quote',(select header from procurement_input)))$$,'create quote and document number atomically');
select extensions.lives_ok($$select pg_temp.procure(1,'create_quote',(select header from procurement_input))$$,'quote retry returns one record');
select extensions.is((select count(*)::int from public.vendor_quotes),1,'one quote after retry');
select extensions.throws_like($$select pg_temp.procure(1,'create_quote',(select header||'{"notes":"changed"}' from procurement_input))$$,'%different values%','changed quote request conflicts');
select extensions.lives_ok($$insert into procurement_results values('quote-line',pg_temp.procure(2,'add_quote_line',(select line||jsonb_build_object('vendor_quote_id',(select value->>'id' from procurement_results where key='quote')) from procurement_input)))$$,'quote line calculates on server');
select extensions.is((select total_cost from public.vendor_quote_lines),100::numeric,'server line total uses quantity/unit cost plus tax');
select extensions.throws_like($$select pg_temp.procure(3,'add_quote_line',(select line||jsonb_build_object('vendor_quote_id',(select value->>'id' from procurement_results where key='quote'),'unit_cost','NaN') from procurement_input))$$,'%finite nonnegative%','nonfinite line cost rejected');
select extensions.lives_ok($$insert into procurement_results values('po',pg_temp.procure(3,'convert_quote',(select jsonb_build_object('vendor_quote_id',value->>'id') from procurement_results where key='quote')))$$,'quote conversion retains source lineage');
select extensions.lives_ok($$select pg_temp.procure(4,'convert_quote',(select jsonb_build_object('vendor_quote_id',value->>'id') from procurement_results where key='quote'))$$,'natural converted quote retry finds its existing PO');
select extensions.is((select count(*)::int from public.purchase_orders),1,'conversion does not duplicate PO');
select extensions.lives_ok($$select pg_temp.procure(5,'issue_po',(select jsonb_build_object('purchase_order_id',value->>'id','issue_date','2026-10-16') from procurement_results where key='po'))$$,'issue snapshots supplier and loaded company identity');
select extensions.lives_ok($$select pg_temp.procure(5,'issue_po',(select jsonb_build_object('purchase_order_id',value->>'id','issue_date','2026-10-16') from procurement_results where key='po'))$$,'issued request retry returns confirmed result');
select extensions.is((select from_name_snapshot from public.purchase_orders),'Synthetic procurement contractor','company name is loaded, never hardcoded');
select extensions.is((select status from public.pour_plans where id='d1600000-0000-4000-8000-000000000001'),'hold','issue preserves explicit pour hold');
select extensions.is((select status from public.pour_plans where id='d1600000-0000-4000-8000-000000000002'),'planning','issue invalidates prior funding authorization');
select extensions.throws_like($$update public.purchase_orders set status='draft'$$,'%permission denied%','raw PO reopening denied');
select extensions.lives_ok($$insert into procurement_results values('receipt',pg_temp.procure(6,'receipt',(select jsonb_build_object('purchase_order_id',purchase_order_id,'purchase_order_line_id',id,'quantity_received',4,'received_date','2026-10-16','delivery_ticket','SYN-A') from public.purchase_order_lines)))$$,'receive against issued line');
select extensions.lives_ok($$select pg_temp.procure(6,'receipt',(select jsonb_build_object('purchase_order_id',purchase_order_id,'purchase_order_line_id',id,'quantity_received',4,'received_date','2026-10-16','delivery_ticket','SYN-A') from public.purchase_order_lines))$$,'receipt retry does not duplicate physical quantities');
select extensions.is((select actual_quantity from public.work_package_operations),4::numeric,'receipt reaches ticket-derived operation quantity');
select extensions.is((select quantity_review_status from public.work_package_operations),'needs_review','missing evidence is held with compatible review vocabulary');
select extensions.lives_ok($$insert into procurement_results values('document-receipt',pg_temp.procure(7,'document_receipt',(select jsonb_build_object('id','d1860000-0000-4000-8000-000000000001','purchase_order_line_id',id,'quantity_received',6,'received_date','2026-10-16','delivery_ticket','SYN-B') from public.purchase_order_lines)))$$,'document and receipt linkage commit together');
select extensions.is((select actual_quantity from public.work_package_operations),10::numeric,'separate receipts aggregate against the same pour');
select extensions.throws_like($$select pg_temp.procure(8,'document_receipt',(select jsonb_build_object('id','d1860000-0000-4000-8000-000000000001','purchase_order_line_id',id,'quantity_received',7,'received_date','2026-10-16','delivery_ticket','SYN-B') from public.purchase_order_lines))$$,'%different recorded receipt%','linked evidence cannot silently accept changed quantity');
select extensions.throws_like($$update public.company_documents set purchase_order_receipt_id=null where id='d1860000-0000-4000-8000-000000000001'$$,'%governed delivery evidence%','raw evidence unlink denied');
select extensions.lives_ok($$insert into procurement_results values('bill',pg_temp.procure(8,'create_bill',(select jsonb_build_object('purchase_order_id',value->>'id','vendor_bill_number','SYN-INVOICE','bill_date','2026-10-16') from procurement_results where key='po')))$$,'bill derives vendor and job from its PO');
select extensions.lives_ok($$insert into procurement_results values('bill-line',pg_temp.procure(9,'add_bill_line',(select jsonb_build_object('vendor_bill_id',(select value->>'id' from procurement_results where key='bill'),'purchase_order_line_id',id,'quantity',4,'unit_cost',10,'sales_tax',0) from public.purchase_order_lines)))$$,'bill line retains PO scope and costs server-side');
select extensions.throws_like($$insert into public.project_costs(company_id,project_id,cost_code_id,description,total_cost,vendor_bill_line_id) select 'd1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','d1500000-0000-4000-8000-000000000001','Forged source',1,(value->>'id')::uuid from procurement_results where key='bill-line'$$,'%governed vendor bill posting%','raw cost cannot preseed a bill-derived financial source');
reset role;set local role postgres;
alter table public.project_costs disable trigger bill_cost_source_guard;
insert into public.project_costs(company_id,project_id,cost_code_id,description,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,vendor_bill_id,vendor_bill_line_id)
 select l.company_id,b.project_id,l.cost_code_id,l.description,l.quantity,l.unit,l.unit_cost,l.subtotal,l.sales_tax,l.total_cost+1,b.id,l.id from public.vendor_bill_lines l join public.vendor_bills b on b.company_id=l.company_id and b.id=l.vendor_bill_id;
alter table public.project_costs enable trigger bill_cost_source_guard;
reset role;set local role authenticated;
select extensions.throws_like($$select pg_temp.procure(10,'post_bill',(select jsonb_build_object('vendor_bill_id',value->>'id') from procurement_results where key='bill'))$$,'%does not match its recorded source%','legacy mismatched cost conflict cannot be reported as posted');
select extensions.is((select status from public.vendor_bills where vendor_bill_number='SYN-INVOICE'),'draft','failed posting retains draft source');
reset role;set local role postgres;
alter table public.project_costs disable trigger bill_cost_source_guard;delete from public.project_costs;alter table public.project_costs enable trigger bill_cost_source_guard;
reset role;set local role authenticated;
select extensions.lives_ok($$select pg_temp.procure(10,'post_bill',(select jsonb_build_object('vendor_bill_id',value->>'id') from procurement_results where key='bill'))$$,'bill posting and actual cost commit together');
select extensions.lives_ok($$select pg_temp.procure(10,'post_bill',(select jsonb_build_object('vendor_bill_id',value->>'id') from procurement_results where key='bill'))$$,'posting retry preserves single financial cost');
select extensions.is((select count(*)::int from public.project_costs),1,'one cost source after posting retry');
select extensions.is((select total_cost from public.project_costs),40::numeric,'recorded bill is the actual-cost basis');
select extensions.is((select status from public.pour_plans where id='d1600000-0000-4000-8000-000000000001'),'hold','posting preserves explicit pour hold');
select extensions.throws_like($$update public.project_costs set total_cost=0$$,'%governed vendor bill posting%','posted bill cost cannot be rewritten');
select extensions.throws_like($$delete from public.project_costs$$,'%cannot be deleted%','posted bill cost cannot be erased');
insert into procurement_results values('before-project-delete',pg_temp.procurement_fixture_history());
select extensions.ok(jsonb_typeof((select value->'project' from procurement_results where key='before-project-delete'))='object' and jsonb_array_length((select value->'orders' from procurement_results where key='before-project-delete'))>0 and jsonb_array_length((select value->'receipts' from procurement_results where key='before-project-delete'))>0 and jsonb_array_length((select value->'actual_costs' from procurement_results where key='before-project-delete'))>0,'delete protection is tested against a recorded project, orders, receipts and posted actual costs');
select extensions.throws_ok($$delete from public.projects where id='d1300000-0000-4000-8000-000000000001'$$,'P0001',null,'project deletion cannot erase governed procurement history');
select extensions.is(pg_temp.procurement_fixture_history(),(select value from procurement_results where key='before-project-delete'),'failed project deletion preserves exact project, quote, PO, bill, receipt, document and actual-cost history');
reset role;set local role postgres;
insert into public.purchase_orders(id,company_id,project_id,vendor_id,po_number,status) values('d1880000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','d1400000-0000-4000-8000-000000000001','SYN-OTHER-PO','issued');
insert into public.vendor_bills(id,company_id,project_id,vendor_id,purchase_order_id,vendor_bill_number,bill_date) values('d1870000-0000-4000-8000-000000000001','d1200000-0000-4000-8000-000000000001','d1300000-0000-4000-8000-000000000001','d1400000-0000-4000-8000-000000000001','d1880000-0000-4000-8000-000000000001','SYN-OTHER-BILL','2026-10-16');
reset role;set local role authenticated;
select extensions.throws_like($$select public.link_document_to_vendor_bill('d1860000-0000-4000-8000-000000000001','d1870000-0000-4000-8000-000000000001')$$,'%Recorded receipt evidence does not match%','other definer RPC cannot redirect existing ticket evidence to a different PO');
select extensions.throws_like($$select pg_temp.procure(11,'close_po',(select jsonb_build_object('purchase_order_id',value->>'id','status','cancelled') from procurement_results where key='po'))$$,'%actual vendor costs cannot be cancelled%','actual cost prevents cancellation');
select extensions.throws_like($$select public.post_vendor_bill((select (value->>'id')::uuid from procurement_results where key='bill'))$$,'%permission denied%','legacy posting bypass denied');
select extensions.throws_like($$update public.vendor_bills set status='posted'$$,'%permission denied%','raw bill lifecycle bypass denied');
select extensions.throws_like($$select pg_temp.procure(11,'create_po',(select header||'{"project_id":"d1300000-0000-4000-8000-000000000002"}' from procurement_input))$$,'%Job unavailable%','foreign job creation denied');
select extensions.throws_like($$select pg_temp.procure(11,'create_bill',(select jsonb_build_object('purchase_order_id',value->>'id','vendor_bill_number','SYN-INVOICE','bill_date','2026-10-16') from procurement_results where key='po'))$$,'%already recorded%','same vendor invoice cannot be entered twice');
select set_config('request.jwt.claim.sub','d1100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.procure(11,'create_quote',(select header from procurement_input))$$,'%Owner or office authority%','employee cannot issue financial commitments');
select * from extensions.finish();rollback;
