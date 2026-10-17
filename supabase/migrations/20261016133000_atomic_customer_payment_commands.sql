-- Restore the prospective captured payment-state contract without classifying
-- any historical NULL. Payment and allocation commit as one replay-safe command.
set local search_path=pg_catalog,public,extensions;
alter table public.customer_payments alter column status set default 'posted';
alter table public.customer_payments add constraint carez_customer_payment_state_known check(status is not null and status in ('posted','void')) not valid;

create function public.carez_record_invoice_payment_v2(p_request_id uuid,p_invoice_id uuid,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request jsonb;v_company uuid;v_invoice public.invoices%rowtype;v_balance numeric;v_amount numeric;v_fee numeric;v_date date;v_method text;v_id uuid;v_allocation uuid;
begin
 v_request:=public.carez_financial_request_begin(p_request_id,'record_invoice_payment',jsonb_build_object('actor_id',auth.uid(),'invoice_id',p_invoice_id,'values',p_values));
 if (v_request->>'replay')::boolean then return v_request->'result';end if;
 v_company:=(v_request->>'company_id')::uuid;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Payment values are required';end if;
 select * into v_invoice from public.invoices where company_id=v_company and id=p_invoice_id for update;
 if not found or v_invoice.status<>'sent' then raise exception 'Payments can only be recorded against sent invoices';end if;
 select balance_due into v_balance from public.invoice_financial_summary where company_id=v_company and invoice_id=v_invoice.id;
 if not found or v_balance is null or v_balance::text in ('NaN','Infinity','-Infinity') then raise exception 'Invoice balance unavailable';end if;
 if v_balance<=0.009 then raise exception 'This invoice has no balance due';end if;
 v_amount:=public.carez_procurement_number(p_values,'amount',2,true);
 v_fee:=public.carez_procurement_number(p_values,'processing_fee',2,false);
 if v_amount>v_balance+0.01 then raise exception 'Payment is greater than the current invoice balance';end if;
 if v_fee>v_amount then raise exception 'Processing fee cannot exceed the payment';end if;
 v_date:=public.carez_procurement_date(p_values->>'received_date');
 v_method:=p_values->>'payment_method';
 if v_method is null or v_method not in ('check','ach','card','cash','wire','other') then raise exception 'Invalid customer payment method';end if;
 insert into public.customer_payments(company_id,customer_id,project_id,received_date,amount,processing_fee,payment_method,reference_number,notes,status,created_by)
 values(v_company,v_invoice.customer_id,v_invoice.project_id,v_date,v_amount,v_fee,v_method,nullif(btrim(p_values->>'reference_number'),''),nullif(btrim(p_values->>'notes'),''),'posted',auth.uid()) returning id into v_id;
 insert into public.payment_allocations(company_id,payment_id,invoice_id,amount) values(v_company,v_id,v_invoice.id,v_amount) returning id into v_allocation;
 if v_id is null or v_allocation is null then raise exception 'Customer payment and allocation were not confirmed';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',v_id,'allocation_id',v_allocation,'invoice_id',v_invoice.id));
end $$;
revoke all on function public.carez_record_invoice_payment_v2(uuid,uuid,jsonb) from public,anon;
grant execute on function public.carez_record_invoice_payment_v2(uuid,uuid,jsonb) to authenticated;
revoke insert,update,delete on public.customer_payments,public.payment_allocations from authenticated;
