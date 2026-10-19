-- Disposable synthetic closeout qualification. No remote or real business records.
-- Disposable local clone with the proposed command + obligation guards installed.
-- Parent CO entry prelocks are a separate required concurrency qualification.
-- All synthetic facts and fault-injection DDL are rolled back. This is not an
-- agreement/Award/Takeoff fixture and does not establish commercial authority.
begin;
set local search_path=pg_catalog,public,extensions;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email) values
 ('c8100000-0000-4000-8000-000000000001','closeout-owner@local.invalid'),
 ('c8100000-0000-4000-8000-000000000002','closeout-office@local.invalid'),
 ('c8100000-0000-4000-8000-000000000003','closeout-worker@local.invalid'),
 ('c8100000-0000-4000-8000-000000000004','closeout-foreign@local.invalid');
alter table auth.users enable trigger on_auth_user_created;
insert into public.companies(id,name,operating_timezone) values
 ('c8200000-0000-4000-8000-000000000001','Synthetic closeout contractor','UTC'),
 ('c8200000-0000-4000-8000-000000000002','Other synthetic closeout contractor','UTC');
insert into public.profiles(id,company_id,role,full_name) values
 ('c8100000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','owner','Synthetic closeout owner'),
 ('c8100000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001','office','Synthetic closeout office'),
 ('c8100000-0000-4000-8000-000000000003','c8200000-0000-4000-8000-000000000001','employee','Synthetic closeout worker'),
 ('c8100000-0000-4000-8000-000000000004','c8200000-0000-4000-8000-000000000002','owner','Other synthetic owner');
insert into public.customers(id,company_id,name) values
 ('c8300000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','Synthetic closeout customer');
insert into public.projects(id,company_id,customer_id,job_number,name,status,contract_value,sales_tax_exempt)
select ('c8400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 case when n=6 then 'c8200000-0000-4000-8000-000000000002'::uuid else 'c8200000-0000-4000-8000-000000000001'::uuid end,
 case when n=6 then null else 'c8300000-0000-4000-8000-000000000001'::uuid end,
 'SYN-CLOSE-'||n,'Synthetic closeout job '||n,'active',case when n in (2,3,4) then 100 else 0 end,true
from generate_series(1,9)n;
insert into public.vendors(id,company_id,name) values
 ('c8600000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','Synthetic closeout supplier');
insert into public.crew_members(id,company_id,profile_id,name,role,is_owner,worker_type,availability_type,internal_field_rate,hourly_rate,active)
 values('c8700000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','c8100000-0000-4000-8000-000000000003',
 'Synthetic bound field worker','finisher',true,'owner','regular',40,0,true);
insert into public.crew_employment_terms(company_id,crew_member_id,administration_revision,effective_date,worker_type,availability_type,internal_field_rate,hourly_rate,source_type,reason,created_by)
 values('c8200000-0000-4000-8000-000000000001','c8700000-0000-4000-8000-000000000001',0,
 (clock_timestamp() at time zone 'UTC')::date-30,'owner','regular',40,0,'administration','Explicit synthetic existing terms','c8100000-0000-4000-8000-000000000001');

-- Real installed view fixtures: project3 has unknown historical payment basis;
-- project4 has known positive AR. No tax/retainage formula is mocked for these.
insert into public.invoices(id,company_id,project_id,customer_id,invoice_number,invoice_type,status,issue_date,due_date,from_name,sales_tax_rate_percent,sales_tax_exempt,retainage_percent,created_by)
select ('c8900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c8200000-0000-4000-8000-000000000001',
 ('c8400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c8300000-0000-4000-8000-000000000001',
 'SYN-CLOSE-INV-'||n,'progress','sent','2026-10-16','2026-11-15','Synthetic historical invoice sender',0,true,0,
 'c8100000-0000-4000-8000-000000000001' from generate_series(3,4)n;
insert into public.invoice_lines(company_id,invoice_id,description,quantity,unit_price,line_amount,taxable)
select 'c8200000-0000-4000-8000-000000000001',id,'Synthetic recorded work',1,100,100,false from public.invoices
 where company_id='c8200000-0000-4000-8000-000000000001';
-- Faithful historical-unknown seed, following the qualified Billing fixture seam.
-- The prospective known-status constraint is restored NOT VALID before commands.
alter table public.customer_payments drop constraint carez_customer_payment_state_known;
alter table public.customer_payments alter column status drop not null;
insert into public.customer_payments(id,company_id,customer_id,project_id,amount,payment_method,status,created_by)
 values('c8910000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','c8300000-0000-4000-8000-000000000001',
 'c8400000-0000-4000-8000-000000000003',1,'check',null,'c8100000-0000-4000-8000-000000000001');
alter table public.customer_payments add constraint carez_customer_payment_state_known check(status is not null and status in ('posted','void')) not valid;
insert into public.payment_allocations(company_id,payment_id,invoice_id,amount) values
 ('c8200000-0000-4000-8000-000000000001','c8910000-0000-4000-8000-000000000001','c8900000-0000-4000-8000-000000000003',1);

create temp table closeout_results(key text primary key,value jsonb);
grant select,insert,update on closeout_results to authenticated;
create function pg_temp.close_id(n integer) returns uuid language sql immutable as
 $$select ('c8400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.close_checked(n integer) returns jsonb language sql immutable as $$
 select jsonb_build_object('project_id',pg_temp.close_id(n)::text,'punch_complete','on','timecards_complete','on',
 'purchase_orders_closed','on','vendor_bills_complete','on','change_orders_complete','on','customer_billed_complete','on',
 'customer_paid_complete','on','documents_complete','on')
$$;
create temp table closeout_inputs(n integer primary key,expected timestamptz);grant all on closeout_inputs to authenticated;
create function pg_temp.close_cmd(n integer,c text,p integer,extra jsonb default '{}'::jsonb) returns jsonb language plpgsql as $$
declare payload jsonb;expected timestamptz;begin
 payload:=jsonb_build_object('project_id',pg_temp.close_id(p)::text)||extra;
 if c in ('save_checklist','complete') and not(payload?'expected_updated_at') then
  select i.expected into expected from pg_temp.closeout_inputs i where i.n=close_cmd.n;
  if not found then
   select updated_at into expected from public.project_closeouts where company_id=public.get_my_company_id() and project_id=pg_temp.close_id(p);
   insert into pg_temp.closeout_inputs values(n,expected);
  end if;
  payload:=payload||jsonb_build_object('expected_updated_at',expected);
 end if;
 return public.carez_project_closeout_command_v1(('c8500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,payload);
end $$;

select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into closeout_results values('ensure',pg_temp.close_cmd(1,'ensure',1));
select extensions.ok((select (value->>'ok')::boolean and value->>'status'='open' from closeout_results where key='ensure'),'owner ensures an open checklist');
select extensions.is(pg_temp.close_cmd(1,'ensure',1),(select value from closeout_results where key='ensure'),'same ensure request replays confirmed result');
select extensions.lives_ok($$select pg_temp.close_cmd(2,'ensure',1)$$,'a second ensure uses the existing composite-key row');
select extensions.is((select count(*)::integer from public.project_closeouts where project_id=pg_temp.close_id(1)),1,'ensure does not duplicate the checklist');
select extensions.throws_like($$select pg_temp.close_cmd(1,'ensure',2)$$,'%different values%','request identity cannot target another project');
select extensions.throws_like($$select pg_temp.close_cmd(3,'ensure',1,'{"actor_id":"forged"}')$$,'%Unsupported closeout field%','client actor injection rejected');
select extensions.throws_like($$select pg_temp.close_cmd(3,'save_checklist',1,'{"punch_complete":"yes"}')$$,'%Unsupported closeout checkbox value%','arbitrary truthy checkbox value rejected');
select extensions.lives_ok($$select pg_temp.close_cmd(3,'save_checklist',1,pg_temp.close_checked(1)||'{"documents_complete":null,"closeout_notes":"  Synthetic note  "}')$$,'checkbox absence is unchecked and text is trimmed');
select extensions.ok((select not documents_complete and not warranty_sent and closeout_notes='Synthetic note' from public.project_closeouts where project_id=pg_temp.close_id(1)),'saved exact current fields persist');
select extensions.throws_like($$select pg_temp.close_cmd(4,'complete',1)$$,'%every required closeout checkbox%','a missing required confirmation gates completion');
select extensions.lives_ok($$select pg_temp.close_cmd(4,'save_checklist',1,pg_temp.close_checked(1))$$,'failed completion request left no durable conflicting receipt');
select extensions.is(pg_temp.close_cmd(1,'ensure',1),(select value from closeout_results where key='ensure'),'old ensure replay never overwrites the later checklist');
select extensions.ok((select documents_complete from public.project_closeouts where project_id=pg_temp.close_id(1)),'confirmed ensure retry preserves edited confirmations');
select extensions.throws_like($$update public.project_closeouts set status='completed' where project_id=pg_temp.close_id(1)$$,'%permission denied%','raw checklist update cannot bypass command');
select extensions.throws_like($$insert into public.project_closeouts(company_id,project_id) values('c8200000-0000-4000-8000-000000000001',pg_temp.close_id(2))$$,'%permission denied%','raw checklist insert cannot bypass command');
select extensions.throws_like($$delete from public.project_closeouts where project_id=pg_temp.close_id(1)$$,'%permission denied%','raw checklist delete cannot erase completion history');
select extensions.throws_like($$update public.projects set status='completed',completed_at=clock_timestamp() where id=pg_temp.close_id(1)$$,'%Use governed Project Closeout%','raw Project completion cannot bypass checklist and facts');
select extensions.throws_like($$select * from public.carez_closeout_write_contexts$$,'%permission denied%','private write capability is unreadable to authenticated SDK');
select extensions.throws_like($$select public.carez_closeout_matches_write('projects','{}')$$,'%permission denied%','private capability helper has no public authenticated execution');
-- Insert immediately BEFORE:
-- insert into closeout_results values('complete',pg_temp.close_cmd(5,'complete',1));
reset role;
create function pg_temp.nw_schedule(n integer,c text,p jsonb) returns jsonb language sql as $$
 select public.carez_schedule_command_v1(('c8a50000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)
$$;
insert into public.production_tasks(id,company_id,name,production_unit) values
 ('c8a10000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','Synthetic existing flatwork','SF'),
 ('c8a10000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001','Synthetic alternate concrete task','CY');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
-- Completed package header plus an existing open child is a permitted stale
-- projection; the typed roll-up must later correct it without Project reopen.
insert into public.work_packages(id,company_id,project_id,name,status,created_by) values
 ('c8a20000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'Synthetic existing work package','completed','c8100000-0000-4000-8000-000000000001'),
 ('c8a20000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'Synthetic empty existing package','completed','c8100000-0000-4000-8000-000000000001'),
 ('c8a20000-0000-4000-8000-000000000003','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(2),'Synthetic other open-job package','planned','c8100000-0000-4000-8000-000000000001');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,measurement_method,status,actual_quantity,actual_quantity_source,completed_at,completed_by_profile_id,completion_source)
 values('c8a30000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001',
 'Existing completed flatwork',100,'SF','completion','completed',90,'completion','2026-10-16T12:00:00Z','c8100000-0000-4000-8000-000000000001','owner_confirmation');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,measurement_method,status) values
 ('c8a30000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001','Existing open child',50,'SF','completion','planned'),
 ('c8a30000-0000-4000-8000-000000000003','c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001','Existing completion cleanup',25,'SF','completion','planned'),
 ('c8a30000-0000-4000-8000-000000000004','c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000003','c8a10000-0000-4000-8000-000000000001','Other job existing operation',5,'SF','completion','planned');
insert into closeout_results values('nw_schedule_open',pg_temp.nw_schedule(1,'create',jsonb_build_object(
 'project_id',pg_temp.close_id(1)::text,'item_type','work','work_package_operation_id','c8a30000-0000-4000-8000-000000000002',
 'schedule_date','2026-10-17','crew_needed','0','crew_member_ids','[]'::jsonb)));
insert into closeout_results values('nw_schedule_terminal',pg_temp.nw_schedule(2,'create',jsonb_build_object(
 'project_id',pg_temp.close_id(1)::text,'item_type','other','title','Existing terminal calendar record',
 'schedule_date','2026-10-17','crew_needed','0','crew_member_ids','[]'::jsonb)));
select pg_temp.nw_schedule(3,'status',jsonb_build_object('id',(select value->>'id' from closeout_results where key='nw_schedule_terminal'),
 'expected_revision',(select command_revision::text from public.work_schedule_items where id=(select (value->>'id')::uuid from closeout_results where key='nw_schedule_terminal')),'status','completed'));
insert into public.project_inspections(id,company_id,project_id,required_for_operation_id,title,inspection_type,status,scheduled_date,scheduled_time,created_by,updated_by)
 values('c8a40000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'c8a30000-0000-4000-8000-000000000002',
 'Existing scheduled inspection','general','scheduled','2026-10-17','08:00','c8100000-0000-4000-8000-000000000001','c8100000-0000-4000-8000-000000000001');
select extensions.ok((select count(*)=3 from public.work_package_operations where work_package_id='c8a20000-0000-4000-8000-000000000001')
 and exists(select 1 from public.work_schedule_items where inspection_id='c8a40000-0000-4000-8000-000000000001'),
 'nonempty existing work/inspection/schedule graph predates Project completion');

-- Insert AFTER core additions A, BEFORE the original close_cmd(5,'complete',1).
reset role;
create function pg_temp.nw_procure(n integer,c text,p jsonb) returns jsonb language sql as $$
 select public.carez_procurement_command_v1(('c8b70000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)
$$;
insert into public.cost_codes(id,company_id,code,name,cost_type) values
 ('c8b10000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','51410','Synthetic existing concrete','material');
-- Same privileged transaction-only metadata evidence setup as the existing
-- procurement fixture. This does not claim an uploaded file/hash exists.
insert into public.company_documents(id,company_id,project_id,title,document_type,storage_path) values
 ('c8b60000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(8),'Synthetic existing ticket evidence','concrete_ticket','synthetic/local-only-closeout-ticket.pdf');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
-- Explicit synthetic planning inputs, not OH/rate/tax defaults or accepted value.
insert into closeout_results values('nw_ticket_pour',public.carez_pour_planning_command_v1('c8b80000-0000-4000-8000-000000000001','create_plan',jsonb_build_object(
 'project_id',pg_temp.close_id(8)::text,'name','Synthetic existing evidence pour','scheduled_date','2026-10-16',
 'expected_concrete_yards','10','contingency_percent','0','minimum_cash_buffer','0','company_cash_support','0')));
insert into public.work_packages(id,company_id,project_id,name,status,created_by) values
 ('c8b20000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(8),'Synthetic existing ticket package','planned','c8100000-0000-4000-8000-000000000001');
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,measurement_method,pour_plan_id,requires_prior_operations)
 values('c8b30000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','c8b20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000002',
 'Existing ticket-derived concrete',10,'CY','ticket',(select (value->>'id')::uuid from closeout_results where key='nw_ticket_pour'),false);
insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,field_label,planned_quantity,unit,measurement_method,status)
 values('c8b30000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001','c8b20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001',
 'Another existing child remains open',5,'SF','completion','planned');
insert into closeout_results values('nw_ticket_quote',pg_temp.nw_procure(1,'create_quote',jsonb_build_object(
 'project_id',pg_temp.close_id(8)::text,'vendor_id','c8600000-0000-4000-8000-000000000001','quote_date','2026-10-16',
 'pour_plan_id',(select value->>'id' from closeout_results where key='nw_ticket_pour'))));
select pg_temp.nw_procure(2,'add_quote_line',jsonb_build_object('vendor_quote_id',(select value->>'id' from closeout_results where key='nw_ticket_quote'),
 'cost_code_id','c8b10000-0000-4000-8000-000000000001','description','Synthetic existing concrete','quantity','10','unit','CY','unit_cost','10','sales_tax','0'));
insert into closeout_results values('nw_ticket_po',pg_temp.nw_procure(3,'convert_quote',jsonb_build_object('vendor_quote_id',(select value->>'id' from closeout_results where key='nw_ticket_quote'))));
select pg_temp.nw_procure(4,'issue_po',jsonb_build_object('purchase_order_id',(select value->>'id' from closeout_results where key='nw_ticket_po'),'issue_date','2026-10-16'));
insert into closeout_results values('nw_ticket_receipt',pg_temp.nw_procure(5,'document_receipt',jsonb_build_object(
 'id','c8b60000-0000-4000-8000-000000000001','purchase_order_line_id',(select l.id::text from public.purchase_order_lines l where l.purchase_order_id=(select (value->>'id')::uuid from closeout_results where key='nw_ticket_po')),
 'quantity_received','10','received_date','2026-10-16','delivery_ticket','SYN-CLOSE-DELIVERY')));
select pg_temp.nw_procure(6,'close_po',jsonb_build_object('purchase_order_id',(select value->>'id' from closeout_results where key='nw_ticket_po'),'status','closed'));
-- Actual current planning RPC, not privileged status DML or invented Award setup.
select public.carez_pour_planning_command_v1('c8b80000-0000-4000-8000-000000000002','close_plan',jsonb_build_object(
 'pour_plan_id',(select value->>'id' from closeout_results where key='nw_ticket_pour'),'status','completed',
 'expected_updated_at',(select p.updated_at::text from public.pour_plans p where p.id=(select (value->>'id')::uuid from closeout_results where key='nw_ticket_pour'))));
select extensions.ok((select o.status='completed' and o.actual_quantity=10 and o.actual_quantity_source='delivery_tickets'
 and o.completion_source='delivery_tickets' and o.completed_by_profile_id is null and o.completed_by_crew_member_id is null
 from public.work_package_operations o where id='c8b30000-0000-4000-8000-000000000001'),
 'real PO/receipt/evidence/closed-pour graph completes existing ticket operation without commercial Award fabrication');

reset role;
insert into public.projects(id,company_id,customer_id,job_number,name,status,contract_value,sales_tax_rate_percent,sales_tax_exempt)
 values(pg_temp.close_id(10),'c8200000-0000-4000-8000-000000000001','c8300000-0000-4000-8000-000000000001',
 'SYN-CLOSE-10','Synthetic existing financial corrections','active',100,0,true);
insert into public.invoices(id,company_id,project_id,customer_id,invoice_number,invoice_type,status,issue_date,due_date,from_name,
 bill_to_name,bill_to_address_line1,bill_to_address_line2,sales_tax_rate_percent,sales_tax_exempt,retainage_percent,created_by)
 values
 ('c8c60000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(10),'c8300000-0000-4000-8000-000000000001',
  'SYN-CLOSE-FIN-PAID','progress','sent','2026-10-16','2026-11-15','Synthetic saved sender','Synthetic saved customer','100 Fixture Lane','Suite 2',0,true,0,'c8100000-0000-4000-8000-000000000001'),
 ('c8c60000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(10),'c8300000-0000-4000-8000-000000000001',
  'SYN-CLOSE-FIN-ZERO','progress','sent','2026-10-16','2026-11-15','Synthetic saved sender','Synthetic saved customer','100 Fixture Lane','Suite 2',0,true,0,'c8100000-0000-4000-8000-000000000001');
insert into public.invoice_lines(id,company_id,invoice_id,description,quantity,unit,unit_price,line_amount,taxable)
 values
 ('c8c61000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','c8c60000-0000-4000-8000-000000000001','Synthetic existing recorded work',1,'LS',100,100,false),
 ('c8c61000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000001','c8c60000-0000-4000-8000-000000000002','Synthetic existing recorded zero',1,'LS',0,0,false);
create function pg_temp.nf_receive(n integer,p jsonb) returns jsonb language sql as $$
 select public.carez_record_invoice_payment_v2(('c8c70000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'c8c60000-0000-4000-8000-000000000001',p)
$$;
create function pg_temp.nf_bill(n integer,c text,p jsonb) returns jsonb language sql as $$
 select public.carez_billing_command_v1(('c8c80000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,c,p)
$$;
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into closeout_results values('nf_payment_input',jsonb_build_object('amount','100','processing_fee','0','received_date','2026-10-16',
 'payment_method','check','reference_number','SYN-CLOSE-FIN-RECEIPT','notes','Existing synthetic receipt before Closeout'));
insert into closeout_results values('nf_payment',pg_temp.nf_receive(1,(select value from closeout_results where key='nf_payment_input')));
select extensions.ok((select (value->>'ok')::boolean and value->>'invoice_id'='c8c60000-0000-4000-8000-000000000001'
 from closeout_results where key='nf_payment'),'existing invoice is settled through the actual governed payment command before close');
select extensions.ok((select payment_basis_status='known' and outstanding_ar=0 and unbilled_contract=0
 from public.project_billing_summary where company_id='c8200000-0000-4000-8000-000000000001' and project_id=pg_temp.close_id(10)),
 'real installed billing view establishes known zero balances without offsetting a positive invoice against invented credit');
select extensions.ok((select p.status='posted' and p.amount=100 and a.amount=100 and a.invoice_id='c8c60000-0000-4000-8000-000000000001'
 from public.customer_payments p join public.payment_allocations a on a.company_id=p.company_id and a.payment_id=p.id
 where p.id=(select (value->>'id')::uuid from closeout_results where key='nf_payment')),
 'payment and allocation retain the exact existing invoice, amount and tenant lineage');
select pg_temp.close_cmd(300,'save_checklist',10,pg_temp.close_checked(10));
insert into closeout_results values('nf_paid_invoice_before',(select to_jsonb(i) from public.invoices i where id='c8c60000-0000-4000-8000-000000000001'));
insert into closeout_results values('nf_zero_invoice_before',(select to_jsonb(i) from public.invoices i where id='c8c60000-0000-4000-8000-000000000002'));

insert into closeout_results values('complete',pg_temp.close_cmd(5,'complete',1));
select extensions.ok((select p.status='completed' and c.status='completed' and p.completed_at=c.completed_at
 and c.completed_by='c8100000-0000-4000-8000-000000000001'::uuid and not c.warranty_sent
 from public.projects p join public.project_closeouts c on c.company_id=p.company_id and c.project_id=p.id where p.id=pg_temp.close_id(1)),
 'one authoritative completion writes both rows with one actor/time; warranty remains optional');
select extensions.is(pg_temp.close_cmd(5,'complete',1),(select value from closeout_results where key='complete'),'completion retry returns the original outcome');
select extensions.throws_like($$select pg_temp.close_cmd(6,'complete',1)$$,'%cannot reopen or restamp%','new request cannot restamp recorded completion');
select extensions.throws_like($$select pg_temp.close_cmd(6,'save_checklist',1,pg_temp.close_checked(1))$$,'%cannot be edited%','completed checklist is not an open replacement form');
select extensions.throws_like($$update public.projects set status='active',completed_at=null where id=pg_temp.close_id(1)$$,'%Use governed Project Closeout%','raw reopen cannot silently discard recorded completion');
select extensions.is(pg_temp.close_cmd(7,'ensure',1)->>'completed_at',(select value->>'completed_at' from closeout_results where key='complete'),'ensure preserves an existing completed timestamp');

-- Other allowed roles, actor identity, denied roles and cross-company targets.
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.close_cmd(1,'ensure',1)$$,'%different values%','another office actor cannot replay the owner request identity');
select extensions.lives_ok($$select pg_temp.close_cmd(100,'save_checklist',8,pg_temp.close_checked(8))$$,'office retains existing checklist authority');
select extensions.lives_ok($$select pg_temp.close_cmd(101,'complete',8)$$,'office retains existing completion authority');
select extensions.is((select completed_by from public.project_closeouts where project_id=pg_temp.close_id(8)),'c8100000-0000-4000-8000-000000000002'::uuid,'office completion records the authenticated office actor');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select pg_temp.close_cmd(102,'ensure',2)$$,'%Owner or office authority required%','employee cannot administer closeout');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000004',true);
select extensions.throws_like($$select pg_temp.close_cmd(102,'ensure',2)$$,'%Project unavailable in this company%','foreign owner cannot target company1');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
select extensions.throws_like($$select pg_temp.close_cmd(102,'ensure',6)$$,'%Project unavailable in this company%','company1 owner cannot target foreign project');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select extensions.throws_like($$select public.carez_project_closeout_command_v1('c8500000-0000-4000-8000-000000000102','ensure','{}')$$,'%permission denied%','anonymous has no command execution');
reset role;
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.close_cmd(10,'save_checklist',2,pg_temp.close_checked(2));
select pg_temp.close_cmd(11,'save_checklist',3,pg_temp.close_checked(3));
select pg_temp.close_cmd(12,'save_checklist',4,pg_temp.close_checked(4));
select extensions.throws_like($$select pg_temp.close_cmd(13,'complete',2)$$,'%still has money%','positive authoritative unbilled contract blocks close');
select extensions.is((select payment_basis_status from public.project_billing_summary where project_id=pg_temp.close_id(3)),'unavailable','real unknown payment fixture remains unavailable');
select extensions.throws_like($$select pg_temp.close_cmd(13,'complete',3)$$,'%billing readiness unavailable%','unknown historical cash never becomes zero permission to close');
select extensions.throws_like($$select pg_temp.close_cmd(13,'complete',4)$$,'%still has money%','known outstanding AR blocks close');

-- One blocker at a time so another record cannot conceal a missing predicate.
select pg_temp.close_cmd(20,'save_checklist',5,pg_temp.close_checked(5));
reset role;
insert into public.purchase_orders(id,company_id,project_id,vendor_id,po_number,status,created_by) values
 ('c8920000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(5),'c8600000-0000-4000-8000-000000000001','SYN-CLOSE-PO','draft','c8100000-0000-4000-8000-000000000001');
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','draft PO blocks closure');
reset role;
update public.purchase_orders set status='issued' where id='c8920000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','issued PO blocks closure');
reset role;
update public.purchase_orders set status='cancelled' where id='c8920000-0000-4000-8000-000000000001';
insert into public.vendor_bills(id,company_id,project_id,vendor_id,vendor_bill_number,status,created_by) values
 ('c8930000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(5),'c8600000-0000-4000-8000-000000000001','SYN-CLOSE-BILL','draft','c8100000-0000-4000-8000-000000000001');
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','draft vendor bill blocks closure');
reset role;
update public.vendor_bills set status='void' where id='c8930000-0000-4000-8000-000000000001';
insert into public.change_orders(id,company_id,project_id,co_number,title,change_type,status,created_by) values
 ('c8940000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(5),'SYN-CLOSE-CO','Synthetic unresolved change','additive','draft','c8100000-0000-4000-8000-000000000001');
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','draft CO blocks closure');
reset role;
-- This privileged synthetic state seed is not an approval and creates no budget.
update public.change_orders set status='submitted',submitted_at=clock_timestamp() where id='c8940000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','submitted CO blocks closure');
reset role;
update public.change_orders set status='void',voided_at=clock_timestamp() where id='c8940000-0000-4000-8000-000000000001';
insert into public.employee_shift_sessions(id,company_id,project_id,crew_member_id,employee_profile_id,work_date,status,clock_in_at)
 values('c8950000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(5),'c8700000-0000-4000-8000-000000000001',
 'c8100000-0000-4000-8000-000000000003','2026-10-16','active','2026-10-16T15:00:00Z');
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','active shift blocks closure');
reset role;
update public.employee_shift_sessions set status='submitted',clock_out_at='2026-10-16T16:00:00Z' where id='c8950000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(21,'complete',5)$$,'%open field or purchasing%','submitted shift blocks closure');
reset role;
update public.employee_shift_sessions set status='rejected' where id='c8950000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.lives_ok($$select pg_temp.close_cmd(21,'complete',5)$$,'same previously failed request succeeds after every real blocker is cleared');
select extensions.throws_like($$select public.carez_procurement_command_v1('c8800000-0000-4000-8000-000000000001','create_po',jsonb_build_object('project_id',pg_temp.close_id(1)::text,'vendor_id','c8600000-0000-4000-8000-000000000001'))$$,
 '%reopen the completed project%','actual procurement caller cannot create a new PO after completion');
select extensions.throws_like($$select public.carez_procurement_command_v1('c8800000-0000-4000-8000-000000000001','create_bill',jsonb_build_object('project_id',pg_temp.close_id(1)::text,'vendor_id','c8600000-0000-4000-8000-000000000001','vendor_bill_number','SYN-LATE','bill_date','2026-10-16'))$$,
 '%reopen the completed project%','actual procurement caller cannot create a new draft bill after completion');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select public.carez_employee_clock_in_v2(pg_temp.close_id(1),null,null,null)$$,'%Active job not found%','employee cannot start a new shift on a completed job');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);

-- Force failure on the SECOND completion write to prove all-or-nothing behavior.
select pg_temp.close_cmd(30,'save_checklist',7,pg_temp.close_checked(7));
reset role;
create function pg_temp.closeout_reject_second_write() returns trigger language plpgsql as $$
begin if new.id=pg_temp.close_id(7) and new.status='completed' then raise exception 'Synthetic second completion write failure';end if;return new;end $$;
create trigger zzz_closeout_fixture_second_write before update of status on public.projects for each row execute function pg_temp.closeout_reject_second_write();
set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(31,'complete',7)$$,'%Synthetic second completion write failure%','second write failure rejects the whole command');
select extensions.ok((select p.status='active' and p.completed_at is null and c.status='open' and c.completed_at is null and c.completed_by is null
 from public.projects p join public.project_closeouts c on c.company_id=p.company_id and c.project_id=p.id where p.id=pg_temp.close_id(7)),
 'failed Project write rolls checklist completion back');
select extensions.is((select count(*)::integer from public.financial_command_requests where request_id='c8500000-0000-4000-8000-000000000031'),0,'failed close retains no successful or pending request receipt');
reset role;
drop trigger zzz_closeout_fixture_second_write on public.projects;
select extensions.is((select count(*)::integer from public.carez_closeout_write_contexts),0,'no private capability survives success or failed completion');
set local role authenticated;
select extensions.lives_ok($$select pg_temp.close_cmd(31,'complete',7)$$,'same failed request can succeed after transactional failure is removed');

-- Fault injection is isolated to project9 and restores the exact installed view.
-- This never replaces tax/retainage formulas in a release migration.
select pg_temp.close_cmd(40,'save_checklist',9,pg_temp.close_checked(9));
reset role;
create temp table closeout_billing_definition(definition text not null);
insert into closeout_billing_definition select regexp_replace(pg_get_viewdef('public.project_billing_summary'::regclass,true),';[[:space:]]*$','');
create function pg_temp.closeout_read_failure() returns numeric language plpgsql volatile as $$begin raise exception 'Synthetic required billing read failure';end $$;
create function pg_temp.closeout_billing_fault(p_mode text) returns void language plpgsql as $$
declare v_definition text;v_projection text:='';v_expression text;v_column record;v_sql text;
begin
 select definition into strict v_definition from pg_temp.closeout_billing_definition;
 if p_mode='restore' then execute 'create or replace view public.project_billing_summary with(security_invoker=true) as '||v_definition;return;end if;
 for v_column in select attname,format_type(atttypid,atttypmod) typ from pg_attribute
  where attrelid='public.project_billing_summary'::regclass and attnum>0 and not attisdropped order by attnum loop
  v_expression:=format('b.%I',v_column.attname);
  if v_column.attname='outstanding_ar' and p_mode in ('null_ar','nan_ar','infinite_ar','read_error','offset') then
   v_expression:=format('case when b.project_id=%L::uuid then %s else b.%I end',pg_temp.close_id(9),
    case p_mode when 'null_ar' then 'null::numeric' when 'nan_ar' then '''NaN''::numeric' when 'infinite_ar' then '''Infinity''::numeric'
     when 'read_error' then 'pg_temp.closeout_read_failure()' when 'offset' then '10::numeric' end,v_column.attname);
  elsif v_column.attname='unbilled_contract' and p_mode in ('null_unbilled','offset') then
   v_expression:=format('case when b.project_id=%L::uuid then %s else b.%I end',pg_temp.close_id(9),
    case p_mode when 'null_unbilled' then 'null::numeric' else '-10::numeric' end,v_column.attname);
  end if;
  v_projection:=v_projection||case when v_projection='' then '' else ',' end||format('(%s)::%s as %I',v_expression,v_column.typ,v_column.attname);
 end loop;
 v_sql:='select '||v_projection||' from ('||v_definition||') b';
 if p_mode='missing' then v_sql:=v_sql||format(' where b.project_id<>%L::uuid',pg_temp.close_id(9));end if;
 if p_mode='duplicate' then v_sql:=v_sql||' union all select '||v_projection||' from ('||v_definition||') b where b.project_id='||quote_literal(pg_temp.close_id(9))||'::uuid';end if;
 execute 'create or replace view public.project_billing_summary with(security_invoker=true) as '||v_sql;
end $$;

select pg_temp.closeout_billing_fault('missing');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%summary row is missing%','missing required billing row fails closed');
reset role;select pg_temp.closeout_billing_fault('duplicate');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%summary identity is not unique%','duplicate billing identity fails closed');
reset role;select pg_temp.closeout_billing_fault('null_ar');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%balances need authoritative review%','NULL AR is unavailable, not zero');
reset role;select pg_temp.closeout_billing_fault('null_unbilled');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%balances need authoritative review%','NULL unbilled amount is unavailable, not zero');
reset role;select pg_temp.closeout_billing_fault('nan_ar');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%balances need authoritative review%','NaN amount is not a known balance');
reset role;select pg_temp.closeout_billing_fault('infinite_ar');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,case when (select atttypmod from pg_attribute where attrelid='public.project_billing_summary'::regclass and attname='outstanding_ar')>-1 then '%numeric field overflow%' else '%balances need authoritative review%' end,'infinite amount fails at the captured precision or explicit guard; neither permits completion');
reset role;select pg_temp.closeout_billing_fault('read_error');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%Synthetic required billing read failure%','required SQL read failure propagates, never converts to empty');
reset role;select pg_temp.closeout_billing_fault('offset');set local role authenticated;
select extensions.throws_like($$select pg_temp.close_cmd(41,'complete',9)$$,'%still has money%','negative unbilled cannot conceal positive AR');
reset role;select pg_temp.closeout_billing_fault('restore');set local role authenticated;
select extensions.lives_ok($$select pg_temp.close_cmd(41,'complete',9)$$,'exact restored installed billing contract permits known zero balances');
reset role;
reset role;
select extensions.is((select count(*)::integer from public.carez_closeout_write_contexts),0,'private capabilities are removed after all outcomes');
set local role authenticated;
select extensions.is((select count(*)::integer from public.financial_command_requests where request_id='c8800000-0000-4000-8000-000000000001'),0,'rejected late procurement creates no receipt or partial record');
select extensions.is((select count(*)::integer from public.purchase_orders where project_id=pg_temp.close_id(1)),0,'late PO has no partial persistence');
select extensions.is((select count(*)::integer from public.vendor_bills where project_id=pg_temp.close_id(1)),0,'late bill has no partial persistence');

-- Deliberate limits: no two-session concurrency is claimed; no fabricated Award
-- is seeded merely to reach carez_create_change_order. Parent must reuse a genuine
-- qualified Award fixture to exercise that RPC plus company-first CO entry locks.
-- Legacy status='open' is included by command/guards; the captured production CHECK
-- only admits active/submitted/approved/rejected, so this portable fixture does not
-- change that CHECK just to invent an open row. Qualify a real permitted legacy row
-- separately where the source union-state contract is installed.

-- Insert immediately BEFORE the original office-owner reopen section beginning:
-- select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000002',true);
-- select extensions.throws_like($$select pg_temp.close_cmd(201,'reopen',1,...)
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.is((select status from public.projects where id=pg_temp.close_id(1)),'completed','new-work cases begin against the actually completed Project');
-- PRIVATE, UNEXECUTED. Insert into core B after its initial completed-Project
-- assertion and before owner reopen; requires root's three corrected guards.
-- Each failing statement runs in pgTAP's rollback subtransaction, leaving the
-- original core B/C records, target identities and expectations unchanged.
select extensions.throws_like($$update public.work_packages set project_id=pg_temp.close_id(2) where id='c8a20000-0000-4000-8000-000000000001'$$,
 '%reopen%','existing package cannot move historical work out of a completed Project into an active Project');
select extensions.throws_like($$update public.work_package_operations set work_package_id='c8a20000-0000-4000-8000-000000000003' where id='c8a30000-0000-4000-8000-000000000001'$$,
 '%reopen%','existing operation cannot escape its completed source Project through an active destination package');
select extensions.throws_like($$update public.work_packages set planned_start_date='2026-10-18' where id='c8a20000-0000-4000-8000-000000000001'$$,
 '%reopen%','changing an existing package start date requires Project reopen');
select extensions.throws_like($$update public.work_packages set planned_end_date='2026-10-19' where id='c8a20000-0000-4000-8000-000000000001'$$,
 '%reopen%','changing an existing package end date requires Project reopen');
select extensions.throws_like($$update public.project_inspections set status='required',scheduled_date='2026-10-18' where id='c8a40000-0000-4000-8000-000000000001'$$,
 '%reopen%','required status cannot disguise a new inspection date and derived planned schedule');
select extensions.throws_like($$update public.project_inspections set status='required',scheduled_time='09:00' where id='c8a40000-0000-4000-8000-000000000001'$$,
 '%reopen%','required status cannot disguise an explicit inspection time change');

select extensions.throws_like($$insert into public.work_packages(id,company_id,project_id,name,status) values('c8a20000-0000-4000-8000-000000000090','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'New work after close','planned')$$,'%reopen%','new package requires owner Project reopen');
select extensions.throws_like($$insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,planned_quantity,unit) values('c8a30000-0000-4000-8000-000000000090','c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001',1,'SF')$$,'%reopen%','new operation requires owner Project reopen');
select extensions.throws_like($$insert into public.work_package_operations(company_id,work_package_id,production_task_id,planned_quantity,unit,status) values('c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001',1,'SF','completed')$$,'%reopen%','inserting already-completed does not disguise a new operation');
select extensions.throws_like($$update public.work_packages set project_id=pg_temp.close_id(1) where id='c8a20000-0000-4000-8000-000000000003'$$,'%reopen%','existing package cannot be reassigned into completed Project');
select extensions.throws_like($$update public.work_package_operations set work_package_id='c8a20000-0000-4000-8000-000000000001' where id='c8a30000-0000-4000-8000-000000000004'$$,'%reopen%','existing operation cannot be reassigned into completed Project');
select extensions.throws_like($$update public.work_package_operations set status='in_progress',completed_at=null,completed_by_profile_id=null,completion_source=null,actual_quantity=null,actual_quantity_source=null where id='c8a30000-0000-4000-8000-000000000001'$$,'%reopen%','operation reopening cannot substitute for Project reopen');
select extensions.throws_like($$update public.work_package_operations set planned_quantity=51 where id='c8a30000-0000-4000-8000-000000000002'$$,'%reopen%','new planned quantity is prospective work');
select extensions.throws_like($$update public.work_package_operations set production_task_id='c8a10000-0000-4000-8000-000000000002',unit='CY' where id='c8a30000-0000-4000-8000-000000000002'$$,'%reopen%','new task/unit cannot relabel existing work on a completed Project');
select extensions.throws_like($$update public.work_packages set status='active' where id='c8a20000-0000-4000-8000-000000000001'$$,'%reopen%','raw package reopening is denied even when a derived roll-up is available');
select extensions.throws_like($$insert into public.project_inspections(id,company_id,project_id,required_for_operation_id,title,status,scheduled_date) values('c8a40000-0000-4000-8000-000000000090','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'c8a30000-0000-4000-8000-000000000002','New inspection after close','scheduled','2026-10-18')$$,'%reopen%','new readiness inspection requires owner Project reopen');
select extensions.throws_like($$update public.project_inspections set scheduled_date='2026-10-18',status='scheduled' where id='c8a40000-0000-4000-8000-000000000001'$$,'%reopen%','existing inspection cannot be prospectively rescheduled while Project remains closed');
select extensions.throws_like($$select pg_temp.nw_schedule(10,'create',jsonb_build_object('project_id',pg_temp.close_id(1)::text,'item_type','other','title','New calendar work','schedule_date','2026-10-18','crew_needed','0','crew_member_ids','[]'::jsonb))$$,'%Active or held job unavailable%','existing schedule create contract excludes completed Project');
select extensions.throws_like($$select pg_temp.nw_schedule(11,'reschedule',jsonb_build_object('id',(select value->>'id' from closeout_results where key='nw_schedule_open'),'expected_revision',(select command_revision::text from public.work_schedule_items where id=(select (value->>'id')::uuid from closeout_results where key='nw_schedule_open')),'schedule_date','2026-10-18'))$$,'%reopen%','schedule reschedule requires owner Project reopen');
select extensions.throws_like($$select pg_temp.nw_schedule(12,'status',jsonb_build_object('id',(select value->>'id' from closeout_results where key='nw_schedule_open'),'expected_revision',(select command_revision::text from public.work_schedule_items where id=(select (value->>'id')::uuid from closeout_results where key='nw_schedule_open')),'status','in_progress'))$$,'%reopen%','new schedule start fails at lifecycle gate before unrelated Job Setup readiness');
select extensions.throws_like($$select pg_temp.nw_schedule(13,'status',jsonb_build_object('id',(select value->>'id' from closeout_results where key='nw_schedule_terminal'),'expected_revision',(select command_revision::text from public.work_schedule_items where id=(select (value->>'id')::uuid from closeout_results where key='nw_schedule_terminal')),'status','planned'))$$,'%reopen%','completed schedule cannot reopen into prospective planning');
select extensions.lives_ok($$select pg_temp.nw_schedule(14,'status',jsonb_build_object('id',(select value->>'id' from closeout_results where key='nw_schedule_terminal'),'expected_revision',(select command_revision::text from public.work_schedule_items where id=(select (value->>'id')::uuid from closeout_results where key='nw_schedule_terminal')),'status','cancelled'))$$,'terminal cleanup of an existing calendar record remains available');
select extensions.throws_like($$select public.carez_record_manual_labor_v1('c8a70000-0000-4000-8000-000000000001',pg_temp.close_id(1),'c8700000-0000-4000-8000-000000000001',jsonb_build_object('source_reference','SYN-CLOSE-NEW-MANUAL','reason','Explicit synthetic new source after close','task','New reviewed time','confirmed','true','worker_type','owner','base_hourly_rate','40','work_date','2026-10-16','work_timezone','UTC','regular_hours','1','overtime_hours','0'))$$,'%reopen%','new manual source is held despite a supplied historical date/reference');
select extensions.is((select count(*)::integer from public.manual_labor_entries where source_reference='SYN-CLOSE-NEW-MANUAL'),0,'rejected manual command posts no new immutable source');
select extensions.is((select count(*)::integer from public.financial_command_requests where request_id='c8a70000-0000-4000-8000-000000000001'),0,'rejected new manual source leaves no reusable confirmed receipt');

-- A client can set arbitrary custom settings; none mint the private capability.
select set_config('carez.work_projection_context_id','c8a90000-0000-4000-8000-000000000001',true);
select set_config('carez.work_projection_expected',(select (to_jsonb(p)||'{"status":"active"}'::jsonb)::text from public.work_packages p where id='c8a20000-0000-4000-8000-000000000001'),true);
select extensions.throws_like($$update public.work_packages set status='active' where id='c8a20000-0000-4000-8000-000000000001'$$,'%reopen%','forged client GUC cannot authorize package reopen');
select extensions.throws_like($$select * from public.carez_work_projection_contexts_v1$$,'%permission denied%','authenticated SDK cannot read transaction capabilities');
select extensions.throws_like($$insert into public.carez_work_projection_contexts_v1(id,company_id,actor_id,backend_pid,transaction_id,relation_name,row_id,expected_values) select 'c8a90000-0000-4000-8000-000000000001','c8200000-0000-4000-8000-000000000001','c8100000-0000-4000-8000-000000000001',pg_backend_pid(),txid_current(),'work_packages',p.id,to_jsonb(p)||'{"status":"active"}'::jsonb from public.work_packages p where p.id='c8a20000-0000-4000-8000-000000000001'$$,'%permission denied%','knowing the full expected row does not grant raw context insertion');
select extensions.throws_like($$select public.carez_work_projection_matches_v1('work_packages','{}')$$,'%permission denied%','private matcher has no client execution');

-- Existing facts can still be corrected; no new planned source or start is made.
select extensions.lives_ok($$update public.work_package_operations set actual_quantity=91,actual_quantity_source='completion',quantity_review_status='approved',notes='Explicit correction of existing measured actual' where id='c8a30000-0000-4000-8000-000000000001'$$,'existing actual quantity/review correction remains available');
select extensions.ok((select status='completed' and planned_quantity=100 and actual_quantity=91 and completed_at='2026-10-16T12:00:00Z'::timestamptz from public.work_package_operations where id='c8a30000-0000-4000-8000-000000000001'),'actual correction preserves planned scope and original completion time');
select extensions.lives_ok($$update public.project_inspections set status='failed',completed_at=clock_timestamp(),result_notes='Explicit existing inspection correction',updated_by='c8100000-0000-4000-8000-000000000001' where id='c8a40000-0000-4000-8000-000000000001'$$,'existing inspection result is a correction, not new scheduling');
select extensions.is((select status from public.work_schedule_items where inspection_id='c8a40000-0000-4000-8000-000000000001'),'planned','failed existing result retains its derived schedule projection');
select extensions.lives_ok($$update public.work_package_operations set status='completed',actual_quantity=25,actual_quantity_source='completion',completed_at=clock_timestamp(),completed_by_profile_id='c8100000-0000-4000-8000-000000000001',completion_source='owner_confirmation' where id='c8a30000-0000-4000-8000-000000000003'$$,'terminal cleanup of existing operation is preserved');
select extensions.lives_ok($$select public.carez_refresh_existing_package_rollup_v1('c8a20000-0000-4000-8000-000000000001')$$,'typed existing-package roll-up can correct stale completed header');
select extensions.ok((select status='active' from public.work_packages where id='c8a20000-0000-4000-8000-000000000001')
 and (select status='planned' from public.work_package_operations where id='c8a30000-0000-4000-8000-000000000002')
 and (select status='completed' from public.projects where id=pg_temp.close_id(1)),
 'derived active package reflects another existing open child without reopening Project or starting it');
select extensions.lives_ok($$select public.carez_refresh_existing_package_rollup_v1('c8a20000-0000-4000-8000-000000000001')$$,'repeated typed roll-up is naturally idempotent');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000003',true);
select extensions.throws_like($$select public.carez_refresh_existing_package_rollup_v1('c8a20000-0000-4000-8000-000000000001')$$,'%Owner or office authority required%','employee cannot mint an office projection through the public adapter');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000004',true);
select extensions.throws_like($$select public.carez_refresh_existing_package_rollup_v1('c8a20000-0000-4000-8000-000000000001')$$,'%Existing work package unavailable%','foreign owner cannot roll up another tenant package');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
reset role;
select extensions.is((select count(*)::integer from public.carez_work_projection_contexts_v1),0,'successful projection leaves no reusable capability');
set local role authenticated;

-- Insert AFTER core additions B, BEFORE original office/owner reopen section.
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.is((select status from public.projects where id=pg_temp.close_id(8)),'completed','ticket correction uses Project8 actually completed by the original office command');
select extensions.lives_ok($$update public.work_package_operations set quantity_review_status='approved',quantity_review_reason='Existing explicit quantity review' where id='c8b30000-0000-4000-8000-000000000001'$$,'existing ticket quantity review remains available after Project completion');
-- Existing terminal cleanup may leave a stale header; the subsequent source
-- correction must restore active from the other existing open child via context.
select extensions.lives_ok($$update public.work_packages set status='completed' where id='c8b20000-0000-4000-8000-000000000001'$$,'existing package terminal cleanup remains available');
insert into closeout_results values('nw_ticket_before',(select to_jsonb(o) from public.work_package_operations o where id='c8b30000-0000-4000-8000-000000000001'));
insert into closeout_results values('nw_ticket_doc_before',(select to_jsonb(d) from public.company_documents d where id='c8b60000-0000-4000-8000-000000000001'));
reset role;
create function pg_temp.nw_reject_ticket_rollup() returns trigger language plpgsql as $$
begin
 if new.id='c8b20000-0000-4000-8000-000000000001'::uuid and new.status='active' then raise exception 'Synthetic derived ticket roll-up failure';end if;
 return new;
end $$;
create trigger zzz_nw_fixture_ticket_rollup before update on public.work_packages for each row execute function pg_temp.nw_reject_ticket_rollup();
set local role authenticated;
select extensions.throws_like($$update public.company_documents set title='Synthetic corrected ticket annotation' where id='c8b60000-0000-4000-8000-000000000001'$$,'%Synthetic derived ticket roll-up failure%','late derived failure rejects outer document correction atomically');
select extensions.ok((select to_jsonb(o)=(select value from closeout_results where key='nw_ticket_before') from public.work_package_operations o where id='c8b30000-0000-4000-8000-000000000001')
 and (select title=(select value->>'title' from closeout_results where key='nw_ticket_doc_before') from public.company_documents where id='c8b60000-0000-4000-8000-000000000001'),
 'failed package roll-up rolls operation synchronization and document edit back');
reset role;
select extensions.is((select count(*)::integer from public.carez_work_projection_contexts_v1),0,'failed real ticket projection leaves no reusable private context');
drop trigger zzz_nw_fixture_ticket_rollup on public.work_packages;
set local role authenticated;
select extensions.lives_ok($$update public.company_documents set title='Synthetic corrected ticket annotation' where id='c8b60000-0000-4000-8000-000000000001'$$,'same existing evidence correction succeeds without Project reopen');
select extensions.ok((select actual_quantity=10 and quantity_review_status='approved' and quantity_review_reason='Existing explicit quantity review'
 and completed_at=(select (value->>'completed_at')::timestamptz from closeout_results where key='nw_ticket_before')
 and completed_by_profile_id is null and completed_by_crew_member_id is null
 from public.work_package_operations where id='c8b30000-0000-4000-8000-000000000001')
 and (select status='active' from public.work_packages where id='c8b20000-0000-4000-8000-000000000001')
 and (select status='planned' from public.work_package_operations where id='c8b30000-0000-4000-8000-000000000002')
 and (select status='completed' from public.projects where id=pg_temp.close_id(8)),
 'exact derived correction preserves quantity/review/time/NULL attribution while rolling package active; Project stays completed');
reset role;
select extensions.is((select count(*)::integer from public.carez_work_projection_contexts_v1),0,'successful real ticket projection removes all private context');
set local role authenticated;

select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
insert into closeout_results values('nf_complete',pg_temp.close_cmd(301,'complete',10));
insert into closeout_results values('nf_project_closed',(select to_jsonb(p) from public.projects p where id=pg_temp.close_id(10)));
insert into closeout_results values('nf_checklist_closed',(select to_jsonb(c) from public.project_closeouts c where project_id=pg_temp.close_id(10)));
insert into closeout_results values('nf_completion_event',(select to_jsonb(e) from public.project_closeout_events e where project_id=pg_temp.close_id(10)));
select extensions.ok((select p.status='completed' and c.status='completed' and p.completed_at=c.completed_at
 from public.projects p join public.project_closeouts c on c.company_id=p.company_id and c.project_id=p.id where p.id=pg_temp.close_id(10)),
 'financial correction tests use real governed Project completion, not a privileged completed-status seed');
select extensions.is(pg_temp.nf_receive(1,(select value from closeout_results where key='nf_payment_input')),
 (select value from closeout_results where key='nf_payment'),'confirmed receipt replays after completion without requiring Project reopen');
select extensions.ok((select count(*)=1 from public.customer_payments where id=(select (value->>'id')::uuid from closeout_results where key='nf_payment'))
 and (select count(*)=1 from public.payment_allocations where payment_id=(select (value->>'id')::uuid from closeout_results where key='nf_payment'))
 and (select count(*)=1 from public.financial_command_requests where request_id='c8c70000-0000-4000-8000-000000000001'),
 'post-close receipt retry cannot duplicate payment, allocation or confirmed audit receipt');
select extensions.throws_like($$select pg_temp.nf_receive(2,(select value from closeout_results where key='nf_payment_input'))$$,
 '%no balance due%','a new receipt on the settled existing invoice is rejected by its actual balance, not by completed lifecycle');
select extensions.is((select count(*)::integer from public.financial_command_requests where request_id='c8c70000-0000-4000-8000-000000000002'),0,
 'rejected extra receipt leaves no reusable command receipt');
select extensions.throws_like($$select pg_temp.nf_bill(1,'void_invoice','{"invoice_id":"c8c60000-0000-4000-8000-000000000001"}')$$,
 '%has a payment%','completed lifecycle does not bypass the existing prohibition on voiding a paid invoice');
insert into closeout_results values('nf_void_zero',pg_temp.nf_bill(1,'void_invoice','{"invoice_id":"c8c60000-0000-4000-8000-000000000002"}'));
select extensions.ok((select (value->>'ok')::boolean and value->>'id'='c8c60000-0000-4000-8000-000000000002'
 from closeout_results where key='nf_void_zero') and exists(select 1 from public.invoices where id='c8c60000-0000-4000-8000-000000000002' and status='void' and voided_at is not null),
 'an existing unpaid zero-value invoice can be voided through the governed correction while the Project stays completed');
select extensions.is(pg_temp.nf_bill(1,'void_invoice','{"invoice_id":"c8c60000-0000-4000-8000-000000000002"}'),
 (select value from closeout_results where key='nf_void_zero'),'post-close invoice correction replays its original confirmed outcome');
select extensions.ok((select to_jsonb(i)=(select value from closeout_results where key='nf_paid_invoice_before') from public.invoices i where id='c8c60000-0000-4000-8000-000000000001')
 and (select to_jsonb(i)-array['status','voided_at','updated_at']=(select value-array['status','voided_at','updated_at'] from closeout_results where key='nf_zero_invoice_before')
 from public.invoices i where id='c8c60000-0000-4000-8000-000000000002')
 and (select count(*)=2 and sum(line_amount)=100 from public.invoice_lines where id in ('c8c61000-0000-4000-8000-000000000001','c8c61000-0000-4000-8000-000000000002')),
 'correction preserves both saved bill-to/sender snapshots and the original invoice-line amounts and identities');
select extensions.ok((select to_jsonb(p)=(select value from closeout_results where key='nf_project_closed') from public.projects p where id=pg_temp.close_id(10))
 and (select to_jsonb(c)=(select value from closeout_results where key='nf_checklist_closed') from public.project_closeouts c where project_id=pg_temp.close_id(10))
 and (select count(*)=1 from public.project_closeout_events where project_id=pg_temp.close_id(10))
 and (select to_jsonb(e)=(select value from closeout_results where key='nf_completion_event') from public.project_closeout_events e where project_id=pg_temp.close_id(10)),
 'existing financial correction never reopens/restamps the Project, clears confirmations or rewrites its completion audit');
select extensions.ok((select r.actor_id='c8100000-0000-4000-8000-000000000001' and r.command='billing_void_invoice'
 and r.payload->>'actor_id'='c8100000-0000-4000-8000-000000000001' and r.payload->'values'->>'invoice_id'='c8c60000-0000-4000-8000-000000000002'
 and (r.result->>'ok')::boolean from public.financial_command_requests r where r.company_id='c8200000-0000-4000-8000-000000000001' and r.request_id='c8c80000-0000-4000-8000-000000000001'),
 'existing invoice correction retains the authenticated actor, exact target and confirmed outcome in the governed receipt');
select extensions.ok((select payment_basis_status='known' and outstanding_ar=0 and unbilled_contract=0
 from public.project_billing_summary where company_id='c8200000-0000-4000-8000-000000000001' and project_id=pg_temp.close_id(10)),
 'unchanged known billing basis remains readable after the permitted correction');

select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000002',true);
select extensions.throws_like($$select pg_temp.close_cmd(201,'reopen',1,jsonb_build_object('expected_project_updated_at',(select updated_at from public.projects where id=pg_temp.close_id(1)),'reopen_reason','Synthetic extension'))$$,'%Only an owner%','office cannot reopen completed jobs');
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
select extensions.throws_like($$select pg_temp.close_cmd(201,'reopen',1,'{"expected_project_updated_at":"2000-01-01","reopen_reason":"stale"}')$$,'%Project changed%','stale reopen is rejected');
insert into closeout_results values('reopen',pg_temp.close_cmd(201,'reopen',1,jsonb_build_object('expected_project_updated_at',(select updated_at from public.projects where id=pg_temp.close_id(1)),'reopen_reason','Synthetic added work')));
select extensions.ok((select p.status='active' and p.completed_at is null and c.status='open' and not c.punch_complete and not c.documents_complete from public.projects p join public.project_closeouts c on c.project_id=p.id where p.id=pg_temp.close_id(1)),'owner reopen starts a fresh confirmation cycle without claiming clearance');
select extensions.ok((select count(*)=2 from public.project_closeout_events where project_id=pg_temp.close_id(1)) and (select before_project->>'status'='completed' and before_closeout->>'completed_at' is not null and reason='Synthetic added work' from public.project_closeout_events where project_id=pg_temp.close_id(1) and event_type='reopen'),'reopen retains original completion facts and explicit reason');
select extensions.is(pg_temp.close_cmd(5,'complete',1),(select value from closeout_results where key='complete'),'confirmed old completion retry cannot close the reopened job again');
select extensions.is((select status from public.projects where id=pg_temp.close_id(1)),'active','old receipt replay leaves current project lifecycle intact');
select extensions.lives_ok($$select public.carez_procurement_command_v1('c8800000-0000-4000-8000-000000000200','create_po',jsonb_build_object('project_id',pg_temp.close_id(1)::text,'vendor_id','c8600000-0000-4000-8000-000000000001'))$$,'new purchasing becomes available after explicit owner reopen');
select extensions.ok((select decision_basis#>>'{billing,payment_basis_status}'='known' and (decision_basis#>>'{billing,outstanding_ar}')::numeric=0 from public.project_closeout_events where project_id=pg_temp.close_id(1) and event_type='complete'),'completion audit retains the exact known financial decision basis');
-- Insert immediately BEFORE: select * from extensions.finish();
-- The parent's close_cmd(201,'reopen',1,...) and audit assertions have already run.
select set_config('request.jwt.claim.sub','c8100000-0000-4000-8000-000000000001',true);
set local role authenticated;
select extensions.is((select status from public.projects where id=pg_temp.close_id(1)),'active','post-reopen work cases use the real owner-reopened Project');
select extensions.lives_ok($$insert into public.work_packages(id,company_id,project_id,name,status) values('c8a20000-0000-4000-8000-000000000090','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'New work after explicit reopen','planned')$$,'same previously rejected new package is allowed after owner reopen');
select extensions.lives_ok($$insert into public.work_package_operations(id,company_id,work_package_id,production_task_id,planned_quantity,unit) values('c8a30000-0000-4000-8000-000000000090','c8200000-0000-4000-8000-000000000001','c8a20000-0000-4000-8000-000000000001','c8a10000-0000-4000-8000-000000000001',1,'SF')$$,'same previously rejected new operation is allowed after owner reopen');
select extensions.lives_ok($$update public.work_package_operations set work_package_id='c8a20000-0000-4000-8000-000000000001' where id='c8a30000-0000-4000-8000-000000000004'$$,'operation reassignment is allowed once target Project is open');
select extensions.lives_ok($$update public.work_package_operations set planned_quantity=51 where id='c8a30000-0000-4000-8000-000000000002'$$,'prospective quantity change is allowed after owner reopen');
select extensions.lives_ok($$update public.work_package_operations set status='in_progress',completed_at=null,completed_by_profile_id=null,completion_source=null,actual_quantity=null,actual_quantity_source=null where id='c8a30000-0000-4000-8000-000000000001'$$,'existing operation may explicitly reopen after Project owner reopen');
select extensions.lives_ok($$update public.project_inspections set status='scheduled',completed_at=null,scheduled_date='2026-10-18',scheduled_time='09:00',updated_by='c8100000-0000-4000-8000-000000000001' where id='c8a40000-0000-4000-8000-000000000001'$$,'existing failed inspection can be scheduled after owner reopen');
select extensions.lives_ok($$insert into public.project_inspections(id,company_id,project_id,required_for_operation_id,title,status,scheduled_date) values('c8a40000-0000-4000-8000-000000000090','c8200000-0000-4000-8000-000000000001',pg_temp.close_id(1),'c8a30000-0000-4000-8000-000000000002','New inspection after explicit reopen','scheduled','2026-10-18')$$,'same previously rejected new inspection is allowed after owner reopen');
select extensions.lives_ok($$select pg_temp.nw_schedule(11,'reschedule',jsonb_build_object('id',(select value->>'id' from closeout_results where key='nw_schedule_open'),'expected_revision',(select command_revision::text from public.work_schedule_items where id=(select (value->>'id')::uuid from closeout_results where key='nw_schedule_open')),'schedule_date','2026-10-18'))$$,'same failed schedule request may reschedule after real owner reopen');
select extensions.lives_ok($$select pg_temp.nw_schedule(10,'create',jsonb_build_object('project_id',pg_temp.close_id(1)::text,'item_type','other','title','New calendar work','schedule_date','2026-10-18','crew_needed','0','crew_member_ids','[]'::jsonb))$$,'same failed create request may plan new work after real owner reopen');
-- No manual posting success is fabricated here: this closeout fixture has no
-- configured OH snapshot. Reuse the qualified manual-labor fixture for successful
-- posting/replay after reopen; do not seed OH=0 or infer missing tax/cost inputs.

select * from extensions.finish();
rollback;
