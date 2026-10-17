-- Drafting, issuance, retainage and milestone writes share the existing tenant
-- finance mutex and durable request receipt. No recorded invoice is rewritten.
set local search_path=pg_catalog,public,extensions,pg_temp;

create function public.carez_billing_number(p_values jsonb,p_key text,p_scale integer,p_signed boolean default false) returns numeric
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare n numeric;begin
 if nullif(btrim(p_values->>p_key),'') is null then raise exception '% is required',p_key;end if;
 n:=(p_values->>p_key)::numeric;
 if n::text in ('NaN','Infinity','-Infinity') or (not p_signed and n<0) or n<>round(n,p_scale) then
  raise exception '% must be finite with at most % decimal places',p_key,p_scale;end if;
 return n;
end $$;
revoke all on function public.carez_billing_number(jsonb,text,integer,boolean) from public,anon,authenticated;

create function public.carez_billing_insert_draft(p_company uuid,p_project uuid,p_type text,p_values jsonb,p_source uuid default null) returns uuid
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare job public.projects%rowtype;profile public.company_billing_profiles%rowtype;
 customer public.customers%rowtype;source public.invoices%rowtype;external_source public.project_external_intakes%rowtype;
 header jsonb;company_name text;invoice_no text;invoice_id uuid;issue_day date;due_day date;rate numeric;key text;entry record;
begin
 select * into job from public.projects where company_id=p_company and id=p_project for update;
 if not found then raise exception 'Job unavailable';end if;
 select name into company_name from public.companies where id=p_company;
 select * into profile from public.company_billing_profiles where company_id=p_company;
 if job.customer_id is not null then
  select * into customer from public.customers where company_id=p_company and id=job.customer_id;
  if not found then raise exception 'The linked customer is unavailable. Review the project customer before creating an invoice';end if;
 end if;
 if p_source is not null then
  select * into source from public.invoices where company_id=p_company and id=p_source and project_id=p_project for update;
  if not found then raise exception 'Source invoice unavailable';end if;
 end if;
 issue_day:=coalesce(public.carez_procurement_date(p_values->>'issue_date',false),current_date);
 due_day:=coalesce(public.carez_procurement_date(p_values->>'due_date',false),issue_day+coalesce(profile.default_due_days,0));
 if p_type='retainage_release' then rate:=0;
 else rate:=public.carez_billing_number(p_values,'retainage_percent',3);if rate>100 then raise exception 'Retainage must be between0 and100';end if;end if;
 header:=jsonb_build_object('company_id',p_company,'project_id',p_project,'customer_id',job.customer_id,
  'invoice_type',p_type,'status','draft','issue_date',issue_day,'due_date',due_day,
  'billing_period_start',public.carez_procurement_date(p_values->>'billing_period_start',false),
  'billing_period_end',public.carez_procurement_date(p_values->>'billing_period_end',false),
  'po_number',nullif(btrim(p_values->>'po_number'),''),'retainage_percent',rate,'created_by',auth.uid(),
  'from_name',coalesce(nullif(profile.display_name,''),source.from_name,company_name),
  'terms_text',case when p_source is not null then coalesce(nullif(source.terms_text,''),profile.default_terms_text)
    else coalesce(nullif(customer.billing_terms,''),profile.default_terms_text) end,
  'notes',nullif(btrim(p_values->>'notes'),''));
 if nullif(header->>'from_name','') is null then raise exception 'Set up your company before creating an invoice';end if;
 foreach key in array array['legal_name','address_line1','address_line2','city','state','postal_code','phone','email','website','ubi_number','contractor_license_number','logo_path'] loop
  header:=header||jsonb_build_object('from_'||key,coalesce(nullif(to_jsonb(profile)->>key,''),to_jsonb(source)->>('from_'||key)));
 end loop;
 foreach key in array array['payment_instructions','invoice_footer'] loop
  header:=header||jsonb_build_object(key,coalesce(nullif(to_jsonb(profile)->>key,''),to_jsonb(source)->>key));
 end loop;
 if p_source is not null then
  foreach key in array array['bill_to_name','bill_to_contact','bill_to_email','bill_to_address_line1','bill_to_address_line2','bill_to_city','bill_to_state','bill_to_postal_code','sales_tax_rate_percent','sales_tax_exempt','sales_tax_jurisdiction'] loop
   header:=header||jsonb_build_object(key,to_jsonb(source)->key);
  end loop;
  header:=header||jsonb_build_object('customer_id',source.customer_id,'retainage_source',jsonb_build_object('basis','source_invoice_release','source_invoice_id',source.id,'rate_percent',0));
 else
  for entry in select * from jsonb_each_text('{"name":"bill_to_name","contact_name":"bill_to_contact","email":"bill_to_email","billing_address_line1":"bill_to_address_line1","billing_address_line2":"bill_to_address_line2","billing_city":"bill_to_city","billing_state":"bill_to_state","billing_postal_code":"bill_to_postal_code"}'::jsonb) loop
   header:=header||jsonb_build_object(entry.value,to_jsonb(customer)->entry.key);
  end loop;
  select * into external_source from public.project_external_intakes where company_id=p_company and project_id=p_project;
  header:=header||jsonb_build_object('sales_tax_rate_percent',coalesce(job.sales_tax_rate_percent,0),
   'sales_tax_exempt',coalesce(job.sales_tax_exempt,false),'sales_tax_jurisdiction',job.sales_tax_jurisdiction,
   'retainage_source',jsonb_build_object('basis',case when external_source.retainage_percent=rate then 'external_agreement_source' else 'explicit_draft_entry' end,
    'rate_percent',rate,'agreement_reference',external_source.agreement_reference,'recorded_rate_percent',external_source.retainage_percent));
 end if;
 if header->>'sales_tax_rate_percent' is null or (header->>'sales_tax_rate_percent')::numeric::text in ('NaN','Infinity','-Infinity') then
  raise exception 'Invoice tax basis unavailable or nonfinite';end if;
 invoice_no:=public.next_invoice_number();
 if nullif(invoice_no,'') is null then raise exception 'Invoice number was not confirmed';end if;
 header:=header||jsonb_build_object('invoice_number',invoice_no);
 insert into public.invoices(company_id,project_id,customer_id,invoice_number,invoice_type,status,issue_date,due_date,billing_period_start,billing_period_end,po_number,
  from_name,from_legal_name,from_address_line1,from_address_line2,from_city,from_state,from_postal_code,from_phone,from_email,from_website,from_ubi_number,from_contractor_license_number,from_logo_path,payment_instructions,invoice_footer,
  bill_to_name,bill_to_contact,bill_to_email,bill_to_address_line1,bill_to_address_line2,bill_to_city,bill_to_state,bill_to_postal_code,
  sales_tax_rate_percent,sales_tax_exempt,sales_tax_jurisdiction,retainage_percent,retainage_source,terms_text,notes,created_by)
 select h.company_id,h.project_id,h.customer_id,h.invoice_number,h.invoice_type,h.status,h.issue_date,h.due_date,h.billing_period_start,h.billing_period_end,h.po_number,
  h.from_name,h.from_legal_name,h.from_address_line1,h.from_address_line2,h.from_city,h.from_state,h.from_postal_code,h.from_phone,h.from_email,h.from_website,h.from_ubi_number,h.from_contractor_license_number,h.from_logo_path,h.payment_instructions,h.invoice_footer,
  h.bill_to_name,h.bill_to_contact,h.bill_to_email,h.bill_to_address_line1,h.bill_to_address_line2,h.bill_to_city,h.bill_to_state,h.bill_to_postal_code,
  h.sales_tax_rate_percent,h.sales_tax_exempt,h.sales_tax_jurisdiction,h.retainage_percent,h.retainage_source,h.terms_text,h.notes,h.created_by
 from jsonb_populate_record(null::public.invoices,header) h returning id into invoice_id;
 if invoice_id is null then raise exception 'Invoice was not confirmed';end if;return invoice_id;
end $$;
revoke all on function public.carez_billing_insert_draft(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;

create function public.carez_billing_validate_release_source(p_company uuid,p_source uuid) returns void
language plpgsql security invoker set search_path=pg_catalog,public,pg_temp as $$
declare held numeric;released numeric;source_status text;shape jsonb;begin
 if not exists(select 1 from public.invoice_lines l join public.invoices i on i.company_id=l.company_id and i.id=l.invoice_id
  where l.company_id=p_company and l.source_invoice_id=p_source and l.source_type='retainage_release' and i.status<>'void') then return;end if;
 select status into source_status from public.invoices where company_id=p_company and id=p_source for update;
 if not found or source_status='void' then raise exception 'Nonvoid retainage releases require their recorded source invoice';end if;
 select retainage_held into held from public.invoice_financial_summary where company_id=p_company and invoice_id=p_source;
 if not found or held is null or held::text in ('NaN','Infinity','-Infinity') then raise exception 'Retainage source basis unavailable';end if;
 select jsonb_agg(attname order by attnum) into shape from pg_attribute where attrelid='public.retainage_available_summary'::regclass and attnum>0 and not attisdropped;
 -- Use the two verified installed release aggregations, not clamped availability
 -- or guessed aliases. The canonical view uses absolute lines; deployed history
 -- uses signed committed_release. Both count draft and sent, excluding void.
 if shape='["source_invoice_id","company_id","project_id","invoice_number","issue_date","retainage_held","retainage_released","available_to_release"]'::jsonb then
  select coalesce(sum(abs(l.line_amount)),0) into released from public.invoice_lines l join public.invoices i on i.company_id=l.company_id and i.id=l.invoice_id
   where l.company_id=p_company and l.source_invoice_id=p_source and l.source_type='retainage_release' and i.status<>'void';
 elsif shape='["source_invoice_id","company_id","project_id","customer_id","invoice_number","issue_date","original_retainage_held","committed_release","draft_release","sent_release","available_to_release"]'::jsonb then
  if source_status<>'sent' then raise exception 'Retainage source must be a sent invoice';end if;
  select coalesce(sum(l.line_amount),0) into released from public.invoice_lines l join public.invoices i on i.company_id=l.company_id and i.id=l.invoice_id
   where l.company_id=p_company and l.source_invoice_id=p_source and l.source_type='retainage_release' and i.status<>'void';
 else raise exception 'Unknown retainage release contract; review its source before changing commitments';end if;
 if released is null or released::text in ('NaN','Infinity','-Infinity') then raise exception 'Retainage source basis unavailable';end if;
 if released>held+0.009 then raise exception 'This change would exceed the source invoice held retainage';end if;
end $$;
revoke all on function public.carez_billing_validate_release_source(uuid,uuid) from public,anon,authenticated;

create function public.carez_billing_command_v1(p_request_id uuid,p_command text,p_values jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare request jsonb;company uuid;target uuid;parent uuid;project uuid;line_id uuid;affected integer;
 invoice public.invoices%rowtype;milestone public.project_payment_milestones%rowtype;agreement public.project_award_records%rowtype;
 subtotal numeric;invoice_total numeric;paid numeric;available numeric;quantity numeric;price numeric;amount numeric;rate numeric;basis text;kind text;v_label text;co_id uuid;values_for_header jsonb;sequence integer;billing_ready boolean;
begin
 if p_command is null or p_command not in ('create_invoice','add_invoice_line','delete_invoice_line','update_invoice','send_invoice','void_invoice','create_retainage_release','add_payment_milestone','create_milestone_invoice','delete_payment_milestone','waive_payment_milestone') then raise exception 'Unknown billing command';end if;
 request:=public.carez_financial_request_begin(p_request_id,'billing_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;
 company:=(request->>'company_id')::uuid;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Billing values are required';end if;
 if p_command='create_invoice' then
  project:=nullif(p_values->>'project_id','')::uuid;kind:=coalesce(nullif(p_values->>'invoice_type',''),'progress');
  if kind not in ('deposit','progress','final','change_order','credit_memo') then raise exception 'Use the source invoice to release retainage';end if;
  target:=public.carez_billing_insert_draft(company,project,kind,p_values);
 elsif p_command in ('add_invoice_line','delete_invoice_line','update_invoice','send_invoice','void_invoice') then
  parent:=nullif(p_values->>'invoice_id','')::uuid;
  select * into invoice from public.invoices where company_id=company and id=parent for update;
  if not found then raise exception 'Invoice unavailable';end if;target:=invoice.id;
  if p_command='void_invoice' then
   if invoice.status<>'void' then
    select amount_paid into paid from public.invoice_financial_summary where company_id=company and invoice_id=invoice.id;
    if not found or paid is null or paid::text in ('NaN','Infinity','-Infinity') then raise exception 'Invoice payment basis unavailable. Review payments before voiding';end if;
    if paid>0.009 then raise exception 'This invoice has a payment. Reverse or reallocate the payment before voiding it';end if;
    update public.invoices set status='void',voided_at=clock_timestamp(),updated_at=clock_timestamp() where company_id=company and id=invoice.id;
   end if;
  else
   if invoice.status<>'draft' then raise exception 'Only draft invoices can be edited or sent';end if;
   if p_command='add_invoice_line' then
    if invoice.invoice_type='retainage_release' then raise exception 'Retainage release lines come from their source invoice';end if;
    v_label:=nullif(btrim(p_values->>'description'),'');if v_label is null then raise exception 'Description is required';end if;
    basis:=coalesce(nullif(p_values->>'source_type',''),'manual');
    if basis not in ('manual','original_contract','change_order') then raise exception 'Invalid invoice line source';end if;
    co_id:=nullif(p_values->>'change_order_id','')::uuid;
    if co_id is not null and not exists(select 1 from public.change_orders where company_id=company and id=co_id and project_id=invoice.project_id and status='approved') then raise exception 'Only an approved change order from this project can be billed';end if;
    quantity:=public.carez_billing_number(p_values,'quantity',4);price:=public.carez_billing_number(p_values,'unit_price',4,true);
    -- Preserve Math.round's toward-positive-infinity half-cent tie, including credits.
    amount:=floor(quantity*price*100+0.5)/100;
    if invoice.invoice_type='credit_memo' and amount>0 then raise exception 'Credit memo lines must use a negative unit price';end if;
    if invoice.invoice_type<>'credit_memo' and amount<0 then raise exception 'Use a Credit Memo invoice for customer credits';end if;
    insert into public.invoice_lines(company_id,invoice_id,source_type,change_order_id,description,quantity,unit,unit_price,line_amount,taxable,notes,sort_order)
    values(company,invoice.id,basis,co_id,v_label,quantity,coalesce(nullif(p_values->>'unit',''),'LS'),price,amount,coalesce(p_values->>'taxable'='on',false),nullif(btrim(p_values->>'notes'),''),
     (select coalesce(max(sort_order),0)+10 from public.invoice_lines where company_id=company and invoice_id=invoice.id)) returning id into line_id;
    target:=line_id;
   elsif p_command='delete_invoice_line' then
    line_id:=nullif(p_values->>'line_id','')::uuid;
    delete from public.invoice_lines where company_id=company and invoice_id=invoice.id and id=line_id;
    get diagnostics affected=row_count;if affected<>1 then raise exception 'Invoice line unavailable in this draft';end if;target:=line_id;
   elsif p_command='update_invoice' then
    if invoice.invoice_type<>'retainage_release' then
     rate:=public.carez_billing_number(p_values,'retainage_percent',3);if rate>100 then raise exception 'Retainage must be between0 and100';end if;
     price:=public.carez_billing_number(p_values,'sales_tax_rate_percent',5);
    end if;
    update public.invoices set issue_date=public.carez_procurement_date(p_values->>'issue_date'),due_date=public.carez_procurement_date(p_values->>'due_date'),
     billing_period_start=public.carez_procurement_date(p_values->>'billing_period_start',false),billing_period_end=public.carez_procurement_date(p_values->>'billing_period_end',false),
     po_number=nullif(btrim(p_values->>'po_number'),''),terms_text=nullif(btrim(p_values->>'terms_text'),''),notes=nullif(btrim(p_values->>'notes'),''),
     sales_tax_rate_percent=case when invoice.invoice_type='retainage_release' then invoice.sales_tax_rate_percent else price end,
     sales_tax_exempt=case when invoice.invoice_type='retainage_release' then invoice.sales_tax_exempt else coalesce(p_values->>'sales_tax_exempt'='on',false) end,
     sales_tax_jurisdiction=case when invoice.invoice_type='retainage_release' then invoice.sales_tax_jurisdiction else nullif(btrim(p_values->>'sales_tax_jurisdiction'),'') end,
     retainage_percent=case when invoice.invoice_type='retainage_release' then invoice.retainage_percent else rate end,
     retainage_source=case when invoice.invoice_type='retainage_release' then invoice.retainage_source else jsonb_build_object('basis','explicit_draft_entry','rate_percent',rate,'agreement_reference',invoice.retainage_source->'agreement_reference','recorded_rate_percent',invoice.retainage_source->'recorded_rate_percent') end,
     updated_at=clock_timestamp() where company_id=company and id=invoice.id;
   elsif p_command='send_invoice' then
    if invoice.invoice_type not in ('credit_memo','retainage_release') then
     select r.billing_ready into billing_ready from public.project_job_readiness_summary r where r.company_id=company and r.project_id=invoice.project_id;
     if not found or billing_ready is not true then raise exception 'Finish the job tax setup before sending this invoice';end if;
     if (invoice.sales_tax_exempt or (invoice.sales_tax_rate_percent>0 and invoice.sales_tax_rate_percent::text not in ('NaN','Infinity','-Infinity') and nullif(btrim(invoice.sales_tax_jurisdiction),'') is not null)) is not true then
      raise exception 'Draft tax snapshot is incomplete. Finish Job Setup and create a new draft with the recorded tax treatment';end if;
    end if;
    if invoice.invoice_type='retainage_release' then
     for co_id in select distinct source_invoice_id from public.invoice_lines where company_id=company and invoice_id=invoice.id and source_type='retainage_release' loop
      if co_id is null then raise exception 'Retainage source invoice unavailable';end if;
      perform public.carez_billing_validate_release_source(company,co_id);
     end loop;
     if not exists(select 1 from public.invoice_lines where company_id=company and invoice_id=invoice.id and source_type='retainage_release' and source_invoice_id is not null) then raise exception 'Retainage source invoice unavailable';end if;
    end if;
    select s.subtotal,s.invoice_total into subtotal,invoice_total from public.invoice_financial_summary s where s.company_id=company and s.invoice_id=invoice.id;
    if not found or subtotal is null or invoice_total is null or subtotal::text in ('NaN','Infinity','-Infinity') or invoice_total::text in ('NaN','Infinity','-Infinity') then raise exception 'Invoice amount unavailable';end if;
    if abs(subtotal)<0.01 then raise exception 'Add at least one invoice line before sending';end if;
    if invoice.invoice_type='credit_memo' and subtotal>0 then raise exception 'Credit memo total must be negative';end if;
    update public.invoices set status='sent',sent_at=clock_timestamp(),updated_at=clock_timestamp() where company_id=company and id=invoice.id;
   end if;
  end if;
  perform public.carez_billing_validate_release_source(company,invoice.id);
 elsif p_command='create_retainage_release' then
  parent:=nullif(p_values->>'source_invoice_id','')::uuid;
  select * into invoice from public.invoices where company_id=company and id=parent for update;
  if not found then raise exception 'Source invoice unavailable';end if;
  select available_to_release into available from public.retainage_available_summary where company_id=company and source_invoice_id=invoice.id;
  if not found or available is null or available::text in ('NaN','Infinity','-Infinity') then raise exception 'Retainage availability unavailable';end if;
  amount:=public.carez_billing_number(p_values,'amount',2);
  if amount<=0 or amount>available+0.009 then raise exception 'Release amount exceeds retainage currently available';end if;
  values_for_header:=p_values||jsonb_build_object('notes','Retainage release from '||invoice.invoice_number||'. Sales tax, if applicable, was billed on the original invoice.');
  target:=public.carez_billing_insert_draft(company,invoice.project_id,'retainage_release',values_for_header,invoice.id);
  insert into public.invoice_lines(company_id,invoice_id,source_type,source_invoice_id,description,quantity,unit,unit_price,line_amount,taxable,sort_order)
  values(company,target,'retainage_release',invoice.id,'Retainage release — '||invoice.invoice_number,1,'LS',amount,amount,false,10) returning id into line_id;
  perform public.carez_billing_validate_release_source(company,invoice.id);
 elsif p_command='add_payment_milestone' then
  project:=nullif(p_values->>'project_id','')::uuid;
  perform 1 from public.projects where company_id=company and id=project for update;if not found then raise exception 'Job unavailable';end if;
  select * into agreement from public.project_award_records where company_id=company and id=nullif(p_values->>'award_record_id','')::uuid and project_id=project for update;
  if not found or agreement.status<>'accepted' then raise exception 'Accepted job agreement not found';end if;
  v_label:=nullif(btrim(p_values->>'label'),'');if v_label is null then raise exception 'Payment label is required';end if;
  basis:=coalesce(nullif(p_values->>'amount_basis',''),'percent');
  if basis='percent' then
   rate:=public.carez_billing_number(p_values,'percent_of_contract',3);if rate>100 then raise exception 'Payment milestone percentage cannot exceed100';end if;
   if agreement.original_contract_value is null or agreement.original_contract_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Recorded agreement amount unavailable';end if;
   amount:=floor(agreement.original_contract_value*rate+0.5)/100;
  elsif basis='fixed' then amount:=public.carez_billing_number(p_values,'fixed_amount',2);
  else raise exception 'Invalid payment amount basis';end if;
  if amount<=0 then raise exception 'Payment milestone amount must be greater than0';end if;
  select coalesce(max(sequence_no),0)+10 into sequence from public.project_payment_milestones where company_id=company and project_id=project;
  insert into public.project_payment_milestones(company_id,project_id,award_record_id,sequence_no,milestone_type,label,amount_basis,percent_of_contract,amount,due_trigger,required_before_start,notes,created_by)
  values(company,project,agreement.id,sequence,coalesce(nullif(p_values->>'milestone_type',''),'progress'),v_label,basis,case when basis='percent' then rate end,amount,
   case when p_values->>'required_before_start'='on' then 'before_start' else coalesce(nullif(p_values->>'due_trigger',''),'manual') end,
   coalesce(p_values->>'required_before_start'='on',false),nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into target;
 else
  project:=nullif(p_values->>'project_id','')::uuid;parent:=nullif(p_values->>'milestone_id','')::uuid;
  select * into milestone from public.project_payment_milestones where company_id=company and id=parent and project_id=project for update;
  if not found then raise exception 'Payment milestone unavailable';end if;target:=milestone.id;
  if milestone.invoice_id is not null then raise exception 'This payment milestone already has an invoice';end if;
  if p_command='delete_payment_milestone' then
   delete from public.project_payment_milestones where company_id=company and id=milestone.id;
  elsif p_command='waive_payment_milestone' then
   v_label:=nullif(btrim(p_values->>'reason'),'');if v_label is null then raise exception 'Enter why the payment requirement is being waived';end if;
   update public.project_payment_milestones set waived_at=clock_timestamp(),waived_reason=v_label,updated_at=clock_timestamp() where company_id=company and id=milestone.id;
  elsif p_command='create_milestone_invoice' then
   if milestone.waived_at is not null then raise exception 'This payment milestone was waived';end if;
   if milestone.milestone_type='retainage' then raise exception 'Release retained amounts from the source invoice in Billing Retainage';end if;
   select * into agreement from public.project_award_records where company_id=company and id=milestone.award_record_id and project_id=project;
   if not found then raise exception 'Recorded agreement unavailable';end if;
   select job_number||' '||name into v_label from public.projects where company_id=company and id=project and
    (sales_tax_exempt or (sales_tax_rate_percent>0 and sales_tax_rate_percent::text not in ('NaN','Infinity','-Infinity') and nullif(btrim(sales_tax_jurisdiction),'') is not null)) for update;
   if not found then raise exception 'Finish the project sales-tax setup before creating the invoice';end if;
   kind:=case when milestone.milestone_type='deposit' then 'deposit' when milestone.milestone_type='final' then 'final' else 'progress' end;
   values_for_header:=p_values||jsonb_build_object('notes',milestone.label||coalesce(' · '||agreement.agreement_number,'')||' · '||v_label);
   target:=public.carez_billing_insert_draft(company,project,kind,values_for_header);
   if milestone.amount is null or milestone.amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Milestone amount unavailable';end if;
   insert into public.invoice_lines(company_id,invoice_id,source_type,description,quantity,unit,unit_price,line_amount,taxable,sort_order)
   values(company,target,'original_contract',milestone.label,1,'LS',milestone.amount,milestone.amount,true,10) returning id into line_id;
   update public.project_payment_milestones set invoice_id=target,updated_at=clock_timestamp() where company_id=company and id=milestone.id and invoice_id is null;
   get diagnostics affected=row_count;if affected<>1 then raise exception 'Milestone invoice link was not confirmed';end if;
  end if;
 end if;
 if target is null then raise exception 'Billing save was not confirmed';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_strip_nulls(jsonb_build_object('ok',true,'id',target,'line_id',line_id)));
end $$;
revoke all on function public.carez_billing_command_v1(uuid,text,jsonb) from public,anon;
grant execute on function public.carez_billing_command_v1(uuid,text,jsonb) to authenticated;
-- Existing definer services retain their own permissions; raw app writes cannot
-- bypass the status, association, finance mutex or replay checks above.
revoke insert,update,delete on public.invoices,public.invoice_lines,public.project_payment_milestones from authenticated;
