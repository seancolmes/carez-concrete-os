-- Govern manual cash facts without changing captured expense/cash inclusion.
set local search_path=pg_catalog,public,extensions,pg_temp;
alter table public.company_cash_balance_snapshots add column revision bigint not null default 0;
alter table public.company_tax_remittances add column reversed_at timestamptz,
 add column reversed_by uuid references auth.users(id),add column reversal_reason text;
alter table public.company_tax_remittances add constraint carez_remittance_reversal_complete check
 ((reversed_at is null and reversed_by is null and reversal_reason is null) or
  (reversed_at is not null and reversed_by is not null and nullif(btrim(reversal_reason),'') is not null));
alter table public.company_tax_remittances add constraint carez_reversed_remittance_unlinked
 check(reversed_at is null or bank_transaction_id is null);

create view public.carez_active_tax_remittances_v1 with(security_invoker=true) as
 select * from public.company_tax_remittances where reversed_at is null;
revoke all on public.carez_active_tax_remittances_v1 from public,anon,authenticated;
grant select on public.carez_active_tax_remittances_v1 to authenticated;
-- Retain installed formulas and columns; remove only reversed entries from
-- their existing source set, including compatibility views beneath wrappers.
do $views$ declare v record;definition text;affected integer:=0;begin
 for v in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='v' and c.relname<>'carez_active_tax_remittances_v1' loop
  definition:=pg_get_viewdef(v.oid,true);
  if definition~'\mcompany_tax_remittances\M' then
   execute format('create or replace view public.%I with(security_invoker=true) as %s',v.relname,
    regexp_replace(definition,'\mcompany_tax_remittances\M','carez_active_tax_remittances_v1','g'));
   affected:=affected+1;
  end if;
 end loop;
 if affected=0 then raise exception 'Existing remittance summary contract was not found';end if;
end $views$;

create function public.carez_cash_command_v1(p_request_id uuid,p_command text,p_values jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare request jsonb;company uuid;target uuid;before_value jsonb;after_value jsonb;
 expense public.company_expenses%rowtype;account public.company_cash_accounts%rowtype;
 snapshot public.company_cash_balance_snapshots%rowtype;reserve public.company_cash_reserves%rowtype;
 remittance public.company_tax_remittances%rowtype;overhead public.overhead_items%rowtype;
 label text;kind text;status text;source text;day date;paid_day date;due_day date;
 subtotal numeric;tax numeric;total numeric;business_use numeric;amount numeric;affected integer;
begin
 if p_command is null or p_command not in ('add_expense','pay_expense','void_expense','add_account','record_balance','add_reserve','release_reserve','record_remittance','reverse_remittance') then raise exception 'Unknown cash command';end if;
 request:=public.carez_financial_request_begin(p_request_id,'cash_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Cash values are required';end if;
 if p_command='add_expense' then
  label:=nullif(btrim(p_values->>'description'),'');if label is null then raise exception 'Expense description is required';end if;
  day:=public.carez_procurement_date(p_values->>'expense_date');due_day:=public.carez_procurement_date(p_values->>'due_date',false);
  subtotal:=public.carez_billing_number(p_values,'subtotal',2);tax:=public.carez_billing_number(p_values,'sales_tax',2);total:=subtotal+tax;
  status:=p_values->>'payment_status';source:=p_values->>'cash_source';
  if status is null or status not in ('paid','unpaid') or source is null or source not in ('company_account','personal','noncash','other') then raise exception 'Explicit expense state and cash source are required';end if;
  paid_day:=case when status='paid' then public.carez_procurement_date(p_values->>'paid_date') end;
  kind:=nullif(btrim(p_values->>'category'),'');
  if nullif(p_values->>'overhead_item_id','') is not null then
   select * into overhead from public.overhead_items where company_id=company and id=(p_values->>'overhead_item_id')::uuid and active for update;
   if not found then raise exception 'Active overhead item unavailable';end if;kind:=overhead.category;
  end if;
  if kind is null then raise exception 'Expense category is required';end if;
  business_use:=case when nullif(btrim(p_values->>'business_use_percent'),'') is null and overhead.id is not null then overhead.business_use_percent
   else public.carez_billing_number(p_values,'business_use_percent',2) end;
  if business_use is null or business_use::text in ('NaN','Infinity','-Infinity') or business_use<0 or business_use>100 then raise exception 'Recorded business use between 0 and 100 percent is required';end if;
  if nullif(p_values->>'payment_method','') is not null and p_values->>'payment_method' not in ('check','ach','card','cash','wire','other') then raise exception 'Invalid payment method';end if;
  insert into public.company_expenses(company_id,overhead_item_id,expense_date,due_date,category,payee,description,subtotal,sales_tax,total_amount,
   business_use_percent,business_expense_amount,cash_source,payment_status,paid_date,payment_method,reference_number,receipt_reference,notes,created_by)
  values(company,overhead.id,day,due_day,kind,nullif(btrim(p_values->>'payee'),''),label,subtotal,tax,total,business_use,round(total*business_use/100,2),source,status,paid_day,
   nullif(p_values->>'payment_method',''),nullif(btrim(p_values->>'reference_number'),''),nullif(btrim(p_values->>'receipt_reference'),''),nullif(btrim(p_values->>'notes'),''),auth.uid())
  returning id,to_jsonb(company_expenses.*) into target,after_value;
 elsif p_command in ('pay_expense','void_expense') then
  select * into expense from public.company_expenses where company_id=company and id=(p_values->>'expense_id')::uuid for update;
  if not found then raise exception 'Expense unavailable';end if;target:=expense.id;before_value:=to_jsonb(expense);
  if nullif(p_values->>'expected_updated_at','') is null or (p_values->>'expected_updated_at')::timestamptz is distinct from expense.updated_at then raise exception 'Expense changed. Reload before saving';end if;
  if expense.payment_status is null or expense.payment_status not in ('paid','unpaid') then raise exception 'Expense state is unavailable or already void';end if;
  if expense.bank_transaction_id is not null or expense.source_type='vendor_payment_fee' then raise exception 'Use the originating bank or vendor-payment workflow for this linked expense';end if;
  if p_command='pay_expense' then
   if expense.payment_status<>'unpaid' then raise exception 'Only unpaid expenses can be marked paid';end if;
   day:=public.carez_procurement_date(p_values->>'paid_date');kind:=p_values->>'payment_method';
   if kind is null or kind not in ('check','ach','card','cash','wire','other') then raise exception 'Payment method is required';end if;
   update public.company_expenses set payment_status='paid',paid_date=day,payment_method=kind,reference_number=nullif(btrim(p_values->>'reference_number'),''),updated_at=clock_timestamp()
    where company_id=company and id=target returning to_jsonb(company_expenses.*) into after_value;
  else
   update public.company_expenses set payment_status='void',updated_at=clock_timestamp() where company_id=company and id=target returning to_jsonb(company_expenses.*) into after_value;
  end if;
 elsif p_command='add_account' then
  label:=nullif(btrim(p_values->>'name'),'');kind:=p_values->>'account_type';
  if label is null or kind is null or kind not in ('checking','savings','cash','other') then raise exception 'Account name and valid type are required';end if;
  insert into public.company_cash_accounts(company_id,name,account_type,include_with_connected_banks,notes)
   values(company,label,kind,false,nullif(btrim(p_values->>'notes'),'')) returning id,to_jsonb(company_cash_accounts.*) into target,after_value;
 elsif p_command='record_balance' then
  select * into account from public.company_cash_accounts where company_id=company and id=(p_values->>'cash_account_id')::uuid and active for update;
  if not found then raise exception 'Active cash account unavailable';end if;
  day:=public.carez_procurement_date(p_values->>'balance_date');amount:=public.carez_billing_number(p_values,'balance',2,true);
  select * into snapshot from public.company_cash_balance_snapshots where company_id=company and cash_account_id=account.id and balance_date=day for update;
  if found then
   if nullif(p_values->>'expected_snapshot_id','')::uuid is distinct from snapshot.id or nullif(p_values->>'expected_revision','')::bigint is distinct from snapshot.revision then
    raise exception 'A balance is already recorded or changed for this date. Reload and use its correction form';end if;
   if nullif(btrim(p_values->>'notes'),'') is null then raise exception 'A balance correction note is required';end if;
   target:=snapshot.id;before_value:=to_jsonb(snapshot);
   update public.company_cash_balance_snapshots set balance=amount,notes=btrim(p_values->>'notes'),revision=revision+1
    where company_id=company and id=target returning to_jsonb(company_cash_balance_snapshots.*) into after_value;
  else
   if nullif(p_values->>'expected_snapshot_id','') is not null then raise exception 'The expected balance is unavailable';end if;
   insert into public.company_cash_balance_snapshots(company_id,cash_account_id,balance_date,balance,notes,created_by)
    values(company,account.id,day,amount,nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id,to_jsonb(company_cash_balance_snapshots.*) into target,after_value;
  end if;
 elsif p_command='add_reserve' then
  label:=nullif(btrim(p_values->>'name'),'');kind:=p_values->>'reserve_type';amount:=public.carez_billing_number(p_values,'amount',2);
  if label is null or amount<=0 or kind is null or kind not in ('payroll','payroll_tax','bo_tax','li','emergency','owner','other') then raise exception 'Reserve name, positive amount and valid type are required';end if;
  day:=public.carez_procurement_date(p_values->>'due_date',false);
  insert into public.company_cash_reserves(company_id,reserve_type,name,amount,due_date,notes,created_by)
   values(company,kind,label,amount,day,nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id,to_jsonb(company_cash_reserves.*) into target,after_value;
 elsif p_command='release_reserve' then
  select * into reserve from public.company_cash_reserves where company_id=company and id=(p_values->>'reserve_id')::uuid for update;
  if not found then raise exception 'Reserve unavailable';end if;target:=reserve.id;before_value:=to_jsonb(reserve);
  if nullif(p_values->>'expected_updated_at','') is null or (p_values->>'expected_updated_at')::timestamptz is distinct from reserve.updated_at or not reserve.active then raise exception 'Reserve changed or already released. Reload before saving';end if;
  update public.company_cash_reserves set active=false,updated_at=clock_timestamp() where company_id=company and id=target returning to_jsonb(company_cash_reserves.*) into after_value;
 elsif p_command='record_remittance' then
  kind:=p_values->>'tax_type';amount:=public.carez_billing_number(p_values,'amount',2);day:=public.carez_procurement_date(p_values->>'payment_date');
  if amount<=0 or kind is null or kind not in ('sales_tax','bo','payroll','li','other') then raise exception 'Positive remittance and valid tax type are required';end if;
  insert into public.company_tax_remittances(company_id,tax_type,payment_date,amount,reference_number,notes,created_by)
   values(company,kind,day,amount,nullif(btrim(p_values->>'reference_number'),''),nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id,to_jsonb(company_tax_remittances.*) into target,after_value;
 elsif p_command='reverse_remittance' then
  select * into remittance from public.company_tax_remittances where company_id=company and id=(p_values->>'remittance_id')::uuid for update;
  if not found then raise exception 'Remittance unavailable';end if;target:=remittance.id;before_value:=to_jsonb(remittance);
  if remittance.reversed_at is not null then raise exception 'Remittance already reversed';end if;
  if remittance.bank_transaction_id is not null then raise exception 'Bank-linked remittances require a supported reconciliation reversal';end if;
  if nullif(p_values->>'expected_created_at','') is null or (p_values->>'expected_created_at')::timestamptz is distinct from remittance.created_at then raise exception 'Remittance changed. Reload before reversing';end if;
  label:=nullif(btrim(p_values->>'reversal_reason'),'');if label is null then raise exception 'A reversal reason is required';end if;
  update public.company_tax_remittances set reversed_at=clock_timestamp(),reversed_by=auth.uid(),reversal_reason=label where company_id=company and id=target returning to_jsonb(company_tax_remittances.*) into after_value;
 end if;
 if target is null or after_value is null then raise exception 'Cash save was not confirmed';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',target,'before',before_value,'after',after_value));
end $$;
revoke all on function public.carez_cash_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_cash_command_v1(uuid,text,jsonb) to authenticated;
revoke insert,update,delete on public.company_cash_accounts,public.company_cash_balance_snapshots,public.company_cash_reserves,public.company_tax_remittances,public.company_expenses from authenticated;
notify pgrst,'reload schema';
