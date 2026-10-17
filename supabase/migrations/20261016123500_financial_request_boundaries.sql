-- All financial command requests are tenant-scoped, atomic and replay-safe.
-- Recorded financial history is retained. No provider or statutory values are seeded.
set local search_path=pg_catalog,public,extensions;
create table public.financial_command_requests(
 company_id uuid not null references public.companies(id) on delete cascade,
 request_id uuid not null, actor_id uuid not null, command text not null,
 payload jsonb not null, result jsonb, created_at timestamptz not null default clock_timestamp(),
 primary key(company_id,request_id),check(jsonb_typeof(payload)='object'),
 check(result is null or jsonb_typeof(result)='object')
);
alter table public.financial_command_requests enable row level security;
create policy financial_command_read on public.financial_command_requests for select to authenticated
 using(company_id=public.get_my_company_id());
revoke all on public.financial_command_requests from public,anon,authenticated;
grant select on public.financial_command_requests to authenticated;
create or replace function public.carez_financial_request_begin(p_request uuid,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare company uuid; role_name text; prior public.financial_command_requests%rowtype;
begin
 select company_id,role into company,role_name from public.profiles where id=auth.uid();
 if company is null or role_name not in ('owner','office') then raise exception 'Owner or office authority required'; end if;
 if p_request is null or nullif(p_command,'') is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'A financial request identity and payload are required'; end if;
 -- A shared tenant lock serializes finance decisions before any target balance is read.
 perform 1 from public.companies where id=company for update;
 if not found then raise exception 'Company is unavailable'; end if;
 insert into public.financial_command_requests(company_id,request_id,actor_id,command,payload)
 values(company,p_request,auth.uid(),p_command,p_payload) on conflict(company_id,request_id) do nothing;
 select * into prior from public.financial_command_requests where company_id=company and request_id=p_request for update;
 if prior.command is distinct from p_command or prior.payload is distinct from p_payload then raise exception 'Financial request identity was reused with different values'; end if;
 return jsonb_build_object('company_id',company,'replay',prior.result is not null,'result',prior.result);
end $$;
revoke all on function public.carez_financial_request_begin(uuid,text,jsonb) from public,anon,authenticated;
create or replace function public.carez_financial_request_finish(p_request uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_result is null or jsonb_typeof(p_result)<>'object' then raise exception 'Financial outcome was not confirmed'; end if;
 update public.financial_command_requests set result=p_result where company_id=public.get_my_company_id() and request_id=p_request and result is null;
 if not found then raise exception 'Financial request outcome could not be recorded'; end if;
 return p_result;
end $$;
revoke all on function public.carez_financial_request_finish(uuid,jsonb) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION public.record_vendor_bill_payment(p_vendor_bill_id uuid, p_payment_date date, p_amount numeric, p_payment_method text, p_reference_number text DEFAULT NULL::text, p_processing_fee numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id();
  v_bill public.vendor_bill_ap_summary%rowtype;
  v_payment uuid;
  v_overhead_id uuid;
  v_category text:='Banking';
  v_business_use numeric:=100;
begin
  if v_company is null then raise exception 'Company not found'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_processing_fee is null or p_processing_fee::text in ('NaN','Infinity','-Infinity') or p_processing_fee<0 then raise exception 'Processing fee cannot be negative'; end if;
  if p_payment_method not in ('check','ach','card','cash','wire','other') then raise exception 'Invalid payment method'; end if;
  perform 1 from public.vendor_bills where id=p_vendor_bill_id and company_id=v_company for update;
  if not found then raise exception 'Vendor bill not found'; end if;
  select * into v_bill from public.vendor_bill_ap_summary where vendor_bill_id=p_vendor_bill_id and company_id=v_company;
  if not found then raise exception 'Vendor bill not found'; end if;
  if v_bill.status<>'posted' then raise exception 'Only posted vendor bills can be paid'; end if;
  if v_bill.balance_due<=0 then raise exception 'Vendor bill is already paid'; end if;
  if p_amount>v_bill.balance_due then raise exception 'Payment exceeds vendor bill balance'; end if;

  insert into public.vendor_payments(company_id,vendor_id,payment_date,amount,processing_fee,payment_method,reference_number,notes,status,created_by)
  values(v_company,v_bill.vendor_id,coalesce(p_payment_date,current_date),round(p_amount,2),round(coalesce(p_processing_fee,0),2),p_payment_method,nullif(trim(coalesce(p_reference_number,'')),''),nullif(trim(coalesce(p_notes,'')),''),'posted',auth.uid()) returning id into v_payment;

  insert into public.vendor_payment_allocations(company_id,vendor_payment_id,vendor_bill_id,amount)
  values(v_company,v_payment,p_vendor_bill_id,round(p_amount,2));

  if coalesce(p_processing_fee,0)>0 then
    select id,category,business_use_percent into v_overhead_id,v_category,v_business_use
    from public.overhead_items
    where company_id=v_company and name='Bank account / ACH / wire fees' and active=true
    order by sort_order nulls last,created_at limit 1;

    insert into public.company_expenses(company_id,overhead_item_id,expense_date,category,payee,description,subtotal,sales_tax,total_amount,business_use_percent,business_expense_amount,cash_source,payment_status,paid_date,payment_method,reference_number,notes,source_type,source_id,created_by)
    values(v_company,v_overhead_id,coalesce(p_payment_date,current_date),coalesce(v_category,'Banking'),v_bill.vendor_name,
      'Vendor payment fee' || case when v_bill.vendor_bill_number is not null then ' — '||v_bill.vendor_bill_number else '' end,
      round(p_processing_fee,2),0,round(p_processing_fee,2),coalesce(v_business_use,100),round(p_processing_fee*coalesce(v_business_use,100)/100,2),
      'company_account','paid',coalesce(p_payment_date,current_date),p_payment_method,nullif(trim(coalesce(p_reference_number,'')),''),'Automatically created from vendor payment.','vendor_payment_fee',v_payment,auth.uid());
  end if;
  return v_payment;
end;
$function$;

create or replace function public.carez_apply_bank_reconciliation_rule_v2(p_request_id uuid,p_bank_transaction_id uuid, p_rule_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'apply_bank_reconciliation_rule',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_rule_id',p_rule_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 target:=public.apply_bank_reconciliation_rule(p_bank_transaction_id,p_rule_id);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_apply_bank_reconciliation_rule_v2(uuid,uuid,uuid) from public,anon;
grant execute on function public.carez_apply_bank_reconciliation_rule_v2(uuid,uuid,uuid) to authenticated;
revoke all on function public.apply_bank_reconciliation_rule(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_bank_reconciliation_rule(uuid,uuid) to service_role;

create or replace function public.carez_ignore_bank_transaction_v2(p_request_id uuid,p_bank_transaction_id uuid, p_note text, p_remember_rule boolean, p_rule_auto_apply boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'ignore_bank_transaction',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_note',p_note,'p_remember_rule',p_remember_rule,'p_rule_auto_apply',p_rule_auto_apply));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 perform public.ignore_bank_transaction(p_bank_transaction_id,p_note,p_remember_rule,p_rule_auto_apply);
 result:=jsonb_build_object('ok',true);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_ignore_bank_transaction_v2(uuid,uuid,text,boolean,boolean) from public,anon;
grant execute on function public.carez_ignore_bank_transaction_v2(uuid,uuid,text,boolean,boolean) to authenticated;
revoke all on function public.ignore_bank_transaction(uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.ignore_bank_transaction(uuid,text,boolean,boolean) to service_role;

create or replace function public.carez_reconcile_bank_as_transfer_v2(p_request_id uuid,p_bank_transaction_id uuid, p_other_bank_transaction_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_as_transfer',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_other_bank_transaction_id',p_other_bank_transaction_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where company_id=company and id in(p_bank_transaction_id,p_other_bank_transaction_id) order by id for update;
 if not exists(select 1 from public.plaid_transactions where id=p_other_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Other bank amount unavailable or invalid'; end if;
 if p_bank_transaction_id=p_other_bank_transaction_id then raise exception 'Choose two different bank transactions'; end if;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 perform public.reconcile_bank_as_transfer(p_bank_transaction_id,p_other_bank_transaction_id);
 result:=jsonb_build_object('ok',true);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_as_transfer_v2(uuid,uuid,uuid) from public,anon;
grant execute on function public.carez_reconcile_bank_as_transfer_v2(uuid,uuid,uuid) to authenticated;
revoke all on function public.reconcile_bank_as_transfer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_as_transfer(uuid,uuid) to service_role;

create or replace function public.carez_reconcile_bank_existing_v2(p_request_id uuid,p_bank_transaction_id uuid, p_entity_type text, p_entity_id uuid, p_note text, p_confidence integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_existing',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_entity_type',p_entity_type,'p_entity_id',p_entity_id,'p_note',p_note,'p_confidence',p_confidence));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
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
revoke all on function public.carez_reconcile_bank_existing_v2(uuid,uuid,text,uuid,text,integer) from public,anon;
grant execute on function public.carez_reconcile_bank_existing_v2(uuid,uuid,text,uuid,text,integer) to authenticated;
revoke all on function public.reconcile_bank_existing(uuid,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.reconcile_bank_existing(uuid,text,uuid,text,integer) to service_role;

create or replace function public.carez_reconcile_bank_to_company_expense_v2(p_request_id uuid,p_bank_transaction_id uuid, p_overhead_item_id uuid, p_category text, p_business_use_percent numeric, p_description text, p_remember_rule boolean, p_rule_auto_apply boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_company_expense',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_overhead_item_id',p_overhead_item_id,'p_category',p_category,'p_business_use_percent',p_business_use_percent,'p_description',p_description,'p_remember_rule',p_remember_rule,'p_rule_auto_apply',p_rule_auto_apply));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 if p_business_use_percent is not null and (p_business_use_percent::text in ('NaN','Infinity','-Infinity') or p_business_use_percent<0 or p_business_use_percent>100) then raise exception 'Business use must be between0and100'; end if;
 target:=public.reconcile_bank_to_company_expense(p_bank_transaction_id,p_overhead_item_id,p_category,p_business_use_percent,p_description,p_remember_rule,p_rule_auto_apply);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_company_expense_v2(uuid,uuid,uuid,text,numeric,text,boolean,boolean) from public,anon;
grant execute on function public.carez_reconcile_bank_to_company_expense_v2(uuid,uuid,uuid,text,numeric,text,boolean,boolean) to authenticated;
revoke all on function public.reconcile_bank_to_company_expense(uuid,uuid,text,numeric,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_company_expense(uuid,uuid,text,numeric,text,boolean,boolean) to service_role;

create or replace function public.carez_reconcile_bank_to_invoice_v2(p_request_id uuid,p_bank_transaction_id uuid, p_invoice_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_invoice',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_invoice_id',p_invoice_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 perform 1 from public.invoices where id=p_invoice_id and company_id=company for update;
 if not found then raise exception 'Invoice unavailable'; end if;
 target:=public.reconcile_bank_to_invoice(p_bank_transaction_id,p_invoice_id);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_invoice_v2(uuid,uuid,uuid) from public,anon;
grant execute on function public.carez_reconcile_bank_to_invoice_v2(uuid,uuid,uuid) to authenticated;
revoke all on function public.reconcile_bank_to_invoice(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_invoice(uuid,uuid) to service_role;

create or replace function public.carez_reconcile_bank_to_job_cost_v2(p_request_id uuid,p_bank_transaction_id uuid, p_project_id uuid, p_cost_code_id uuid, p_vendor_id uuid, p_description text, p_remember_cost_code boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_job_cost',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_project_id',p_project_id,'p_cost_code_id',p_cost_code_id,'p_vendor_id',p_vendor_id,'p_description',p_description,'p_remember_cost_code',p_remember_cost_code));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 if p_vendor_id is not null and not exists(select 1 from public.vendors where id=p_vendor_id and company_id=company) then raise exception 'Vendor belongs to another company or is unavailable'; end if;
 target:=public.reconcile_bank_to_job_cost(p_bank_transaction_id,p_project_id,p_cost_code_id,p_vendor_id,p_description,p_remember_cost_code);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_job_cost_v2(uuid,uuid,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.carez_reconcile_bank_to_job_cost_v2(uuid,uuid,uuid,uuid,uuid,text,boolean) to authenticated;
revoke all on function public.reconcile_bank_to_job_cost(uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_job_cost(uuid,uuid,uuid,uuid,text,boolean) to service_role;

create or replace function public.carez_reconcile_bank_to_payroll_run_v2(p_request_id uuid,p_bank_transaction_id uuid, p_payroll_run_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_payroll_run',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_payroll_run_id',p_payroll_run_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 perform 1 from public.payroll_runs where id=p_payroll_run_id and company_id=company and bank_transaction_id is null for update;
 if not found then raise exception 'Payroll run unavailable or already linked'; end if;
 target:=public.reconcile_bank_to_payroll_run(p_bank_transaction_id,p_payroll_run_id);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_payroll_run_v2(uuid,uuid,uuid) from public,anon;
grant execute on function public.carez_reconcile_bank_to_payroll_run_v2(uuid,uuid,uuid) to authenticated;
revoke all on function public.reconcile_bank_to_payroll_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_payroll_run(uuid,uuid) to service_role;

create or replace function public.carez_reconcile_bank_to_tax_v2(p_request_id uuid,p_bank_transaction_id uuid, p_tax_type text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_tax',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_tax_type',p_tax_type));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 target:=public.reconcile_bank_to_tax(p_bank_transaction_id,p_tax_type);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_tax_v2(uuid,uuid,text) from public,anon;
grant execute on function public.carez_reconcile_bank_to_tax_v2(uuid,uuid,text) to authenticated;
revoke all on function public.reconcile_bank_to_tax(uuid,text) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_tax(uuid,text) to service_role;

create or replace function public.carez_reconcile_bank_to_vendor_bill_v2(p_request_id uuid,p_bank_transaction_id uuid, p_vendor_bill_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_vendor_bill',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_vendor_bill_id',p_vendor_bill_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;
 if not found then raise exception 'Bank transaction unavailable'; end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid'; end if;
 perform 1 from public.vendor_bills where id=p_vendor_bill_id and company_id=company for update;
 if not found then raise exception 'Vendor bill unavailable'; end if;
 target:=public.reconcile_bank_to_vendor_bill(p_bank_transaction_id,p_vendor_bill_id);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_vendor_bill_v2(uuid,uuid,uuid) from public,anon;
grant execute on function public.carez_reconcile_bank_to_vendor_bill_v2(uuid,uuid,uuid) to authenticated;
revoke all on function public.reconcile_bank_to_vendor_bill(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_bank_to_vendor_bill(uuid,uuid) to service_role;

create or replace function public.carez_record_vendor_bill_payment_v2(p_request_id uuid,p_vendor_bill_id uuid, p_payment_date date, p_amount numeric, p_payment_method text, p_reference_number text, p_processing_fee numeric, p_notes text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'record_vendor_bill_payment',jsonb_build_object('p_vendor_bill_id',p_vendor_bill_id,'p_payment_date',p_payment_date,'p_amount',p_amount,'p_payment_method',p_payment_method,'p_reference_number',p_reference_number,'p_processing_fee',p_processing_fee,'p_notes',p_notes));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.vendor_bills where id=p_vendor_bill_id and company_id=company for update;
 if not found then raise exception 'Vendor bill unavailable'; end if;
 target:=public.record_vendor_bill_payment(p_vendor_bill_id,p_payment_date,p_amount,p_payment_method,p_reference_number,p_processing_fee,p_notes);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 result:=jsonb_build_object('ok',true,'id',target);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_record_vendor_bill_payment_v2(uuid,uuid,date,numeric,text,text,numeric,text) from public,anon;
grant execute on function public.carez_record_vendor_bill_payment_v2(uuid,uuid,date,numeric,text,text,numeric,text) to authenticated;
revoke all on function public.record_vendor_bill_payment(uuid,date,numeric,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.record_vendor_bill_payment(uuid,date,numeric,text,text,numeric,text) to service_role;

create or replace function public.carez_void_vendor_payment_v2(p_request_id uuid,p_vendor_payment_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; result jsonb; target uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'void_vendor_payment',jsonb_build_object('p_vendor_payment_id',p_vendor_payment_id));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 perform 1 from public.vendor_payments where id=p_vendor_payment_id and company_id=company for update;
 if not found then raise exception 'Vendor payment unavailable'; end if;
 if exists(select 1 from public.vendor_payments where id=p_vendor_payment_id and company_id=company and status='void') then return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true)); end if;
 perform public.void_vendor_payment(p_vendor_payment_id);
 result:=jsonb_build_object('ok',true);
 return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_void_vendor_payment_v2(uuid,uuid) from public,anon;
grant execute on function public.carez_void_vendor_payment_v2(uuid,uuid) to authenticated;
revoke all on function public.void_vendor_payment(uuid) from public,anon,authenticated;
grant execute on function public.void_vendor_payment(uuid) to service_role;

-- Payment/allocation facts can only be written by constrained definer commands.

revoke insert,update,delete on public.vendor_payments,public.vendor_payment_allocations from authenticated;

-- Close document-to-bank definer entrypoints under the same request boundary.
CREATE OR REPLACE FUNCTION public.reconcile_bank_to_job_cost(p_bank_transaction_id uuid, p_project_id uuid, p_cost_code_id uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text, p_remember_cost_code boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_company uuid:=public.get_my_company_id(); v_tx public.plaid_transactions%rowtype; v_cost uuid; v_amount numeric; v_code public.cost_codes%rowtype; v_vendor text; v_rule uuid; v_pattern text;
begin
  if p_vendor_id is not null and not exists(select 1 from public.vendors where id=p_vendor_id and company_id=v_company) then raise exception 'Vendor belongs to another company or is unavailable'; end if;
  select * into v_tx from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company for update;
  if not found then raise exception 'Bank transaction not found'; end if;
  if v_tx.pending or v_tx.removed or v_tx.review_status='matched' or v_tx.cash_amount>=0 then raise exception 'This transaction cannot create a job cost'; end if;
  if not exists(select 1 from public.projects where id=p_project_id and company_id=v_company) then raise exception 'Project not found'; end if;
  select * into v_code from public.cost_codes where id=p_cost_code_id and company_id=v_company and active;
  if not found then raise exception 'Cost code not found'; end if;
  if p_vendor_id is not null then select name into v_vendor from public.vendors where id=p_vendor_id and company_id=v_company; end if;
  v_amount:=round(abs(v_tx.cash_amount),2);
  insert into public.project_costs(company_id,project_id,cost_code_id,cost_date,description,vendor_name,vendor_id,quantity,unit,unit_cost,subtotal,sales_tax,total_cost,source_type,reference_number,notes,created_by,bank_transaction_id)
  values(v_company,p_project_id,p_cost_code_id,v_tx.transaction_date,coalesce(nullif(trim(p_description),''),coalesce(v_tx.merchant_name,v_tx.name)),coalesce(v_vendor,v_tx.merchant_name),p_vendor_id,1,'LS',v_amount,v_amount,0,v_amount,'bank_transaction',left(v_tx.name,120),'Created from bank reconciliation.',auth.uid(),v_tx.id) returning id into v_cost;
  if p_remember_cost_code then
    v_pattern:=public.normalize_bank_text(coalesce(v_tx.merchant_name,v_tx.name));
    if v_pattern<>'' then
      insert into public.bank_reconciliation_rules(company_id,name,merchant_pattern,direction,category_primary,action_type,cost_code_id,vendor_id,business_use_percent,auto_apply,created_by)
      values(v_company,coalesce(v_tx.merchant_name,v_tx.name)||' → '||v_code.name,v_pattern,'outflow',v_tx.category_primary,'job_cost',p_cost_code_id,p_vendor_id,100,false,auth.uid()) returning id into v_rule;
    end if;
  end if;
  update public.plaid_transactions set review_status='matched',matched_entity_type='project_cost',matched_entity_id=v_cost,match_note='Recorded job cost — '||v_code.name,
    reconciled_at=now(),reconciled_by=auth.uid(),reconciliation_source=case when v_rule is null then 'manual_classification' else 'learned_rule' end,reconciliation_confidence=100,bank_rule_id=v_rule,updated_at=now() where id=v_tx.id;
  update public.bank_reconciliation_candidates set status='stale',updated_at=now() where bank_transaction_id=v_tx.id and status='active';
  return v_cost;
end;
$function$;

create or replace function public.carez_reconcile_document_receipt_to_company_expense_v2(p_request_id uuid,p_document_id uuid, p_bank_transaction_id uuid, p_overhead_item_id uuid, p_category text, p_business_use_percent numeric, p_description text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; target uuid; document_vendor uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_document_receipt_to_company_expense',jsonb_build_object('p_document_id',p_document_id,'p_bank_transaction_id',p_bank_transaction_id,'p_overhead_item_id',p_overhead_item_id,'p_category',p_category,'p_business_use_percent',p_business_use_percent,'p_description',p_description));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 select vendor_id into document_vendor from public.company_documents where id=p_document_id and company_id=company and visibility<>'office_private' for update;
 if not found then raise exception 'Receipt unavailable for financial evidence'; end if;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity') for update;
 if not found then raise exception 'Bank amount unavailable or invalid'; end if;
 if p_business_use_percent is not null and (p_business_use_percent::text in ('NaN','Infinity','-Infinity') or p_business_use_percent<0 or p_business_use_percent>100) then raise exception 'Business use must be between0and100'; end if;
 target:=public.reconcile_document_receipt_to_company_expense(p_document_id,p_bank_transaction_id,p_overhead_item_id,p_category,p_business_use_percent,p_description);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',target));
end $$;
revoke all on function public.carez_reconcile_document_receipt_to_company_expense_v2(uuid,uuid,uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.carez_reconcile_document_receipt_to_company_expense_v2(uuid,uuid,uuid,uuid,text,numeric,text) to authenticated;
revoke all on function public.reconcile_document_receipt_to_company_expense(uuid,uuid,uuid,text,numeric,text) from public,anon,authenticated;

create or replace function public.carez_reconcile_document_receipt_to_job_cost_v2(p_request_id uuid,p_document_id uuid, p_bank_transaction_id uuid, p_project_id uuid, p_cost_code_id uuid, p_vendor_id uuid, p_description text, p_remember_cost_code boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb; company uuid; target uuid; document_vendor uuid;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_document_receipt_to_job_cost',jsonb_build_object('p_document_id',p_document_id,'p_bank_transaction_id',p_bank_transaction_id,'p_project_id',p_project_id,'p_cost_code_id',p_cost_code_id,'p_vendor_id',p_vendor_id,'p_description',p_description,'p_remember_cost_code',p_remember_cost_code));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 select vendor_id into document_vendor from public.company_documents where id=p_document_id and company_id=company and visibility<>'office_private' for update;
 if not found then raise exception 'Receipt unavailable for financial evidence'; end if;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity') for update;
 if not found then raise exception 'Bank amount unavailable or invalid'; end if;
 if coalesce(p_vendor_id,document_vendor) is not null and not exists(select 1 from public.vendors where id=coalesce(p_vendor_id,document_vendor) and company_id=company) then raise exception 'Vendor belongs to another company or is unavailable'; end if;
 target:=public.reconcile_document_receipt_to_job_cost(p_document_id,p_bank_transaction_id,p_project_id,p_cost_code_id,p_vendor_id,p_description,p_remember_cost_code);
 if target is null then raise exception 'No financial record was confirmed'; end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',target));
end $$;
revoke all on function public.carez_reconcile_document_receipt_to_job_cost_v2(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.carez_reconcile_document_receipt_to_job_cost_v2(uuid,uuid,uuid,uuid,uuid,uuid,text,boolean) to authenticated;
revoke all on function public.reconcile_document_receipt_to_job_cost(uuid,uuid,uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
