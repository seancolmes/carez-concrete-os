-- Documents become an evidence/review layer across procurement, bills and banking.

alter table public.company_documents add column if not exists review_status text not null default 'needs_review';
alter table public.company_documents drop constraint if exists company_documents_review_status_check;
alter table public.company_documents add constraint company_documents_review_status_check
check(review_status in ('needs_review','filed','matched','ignored'));
alter table public.company_documents add column if not exists reference_number text;
alter table public.company_documents add column if not exists purchase_order_receipt_id uuid references public.purchase_order_receipts(id) on delete set null;
alter table public.company_documents add column if not exists reviewed_at timestamptz;
alter table public.company_documents add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.company_documents add column if not exists updated_at timestamptz not null default now();

create index if not exists company_documents_review_queue_idx on public.company_documents(company_id,review_status,created_at desc);
create index if not exists company_documents_po_receipt_idx on public.company_documents(purchase_order_receipt_id) where purchase_order_receipt_id is not null;

update public.company_documents
set review_status=case
  when document_type in ('receipt','delivery_ticket','concrete_ticket','vendor_invoice') then 'needs_review'
  when project_id is not null then 'filed'
  else 'needs_review'
end
where review_status='needs_review';

create or replace function public.link_document_to_po_receipt(
  p_document_id uuid,
  p_purchase_order_line_id uuid,
  p_quantity_received numeric,
  p_received_date date,
  p_delivery_ticket text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  v_role text:=public.get_my_role();
  d public.company_documents%rowtype;
  l public.purchase_order_lines%rowtype;
  po public.purchase_orders%rowtype;
  v_receipt uuid;
begin
  if v_company is null or v_role='employee' then raise exception 'Owner access required'; end if;
  if coalesce(p_quantity_received,0)<=0 then raise exception 'Delivered quantity must be greater than zero'; end if;

  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Document not found'; end if;
  if d.document_type not in ('concrete_ticket','delivery_ticket') then raise exception 'Only concrete or delivery tickets can create a PO receipt'; end if;
  if d.purchase_order_receipt_id is not null then return d.purchase_order_receipt_id; end if;

  select * into l from public.purchase_order_lines where id=p_purchase_order_line_id and company_id=v_company;
  if not found then raise exception 'PO line not found'; end if;
  select * into po from public.purchase_orders where id=l.purchase_order_id and company_id=v_company;
  if not found or po.status<>'issued' then raise exception 'Only an issued PO can receive a delivery'; end if;
  if d.project_id is not null and d.project_id<>po.project_id then raise exception 'Document job does not match the PO job'; end if;
  if d.vendor_id is not null and d.vendor_id<>po.vendor_id then raise exception 'Document vendor does not match the PO vendor'; end if;

  insert into public.purchase_order_receipts(
    company_id,purchase_order_id,purchase_order_line_id,received_date,quantity_received,delivery_ticket,notes,received_by
  ) values(
    v_company,po.id,l.id,coalesce(p_received_date,current_date),p_quantity_received,
    nullif(trim(coalesce(p_delivery_ticket,'')),''),nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  ) returning id into v_receipt;

  update public.company_documents set
    project_id=po.project_id,
    vendor_id=po.vendor_id,
    purchase_order_id=po.id,
    purchase_order_receipt_id=v_receipt,
    reference_number=coalesce(nullif(trim(coalesce(p_delivery_ticket,'')),''),reference_number),
    document_date=coalesce(p_received_date,document_date,current_date),
    review_status='matched',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return v_receipt;
end;
$$;
revoke all on function public.link_document_to_po_receipt(uuid,uuid,numeric,date,text,text) from public,anon;
grant execute on function public.link_document_to_po_receipt(uuid,uuid,numeric,date,text,text) to authenticated;

create or replace function public.link_document_to_vendor_bill(p_document_id uuid,p_vendor_bill_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  d public.company_documents%rowtype;
  b public.vendor_bills%rowtype;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Document not found'; end if;
  select * into b from public.vendor_bills where id=p_vendor_bill_id and company_id=v_company;
  if not found then raise exception 'Vendor bill not found'; end if;
  if d.project_id is not null and d.project_id<>b.project_id then raise exception 'Document job does not match the vendor bill'; end if;
  if d.vendor_id is not null and d.vendor_id<>b.vendor_id then raise exception 'Document vendor does not match the vendor bill'; end if;
  update public.company_documents set
    project_id=b.project_id,vendor_id=b.vendor_id,purchase_order_id=coalesce(b.purchase_order_id,purchase_order_id),
    vendor_bill_id=b.id,reference_number=coalesce(reference_number,b.vendor_bill_number),review_status='matched',
    reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return true;
end;
$$;
revoke all on function public.link_document_to_vendor_bill(uuid,uuid) from public,anon;
grant execute on function public.link_document_to_vendor_bill(uuid,uuid) to authenticated;

create or replace function public.link_document_to_bank_transaction(p_document_id uuid,p_bank_transaction_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company uuid:=public.get_my_company_id();
  d public.company_documents%rowtype;
  t public.plaid_transactions%rowtype;
begin
  if v_company is null or public.get_my_role()='employee' then raise exception 'Owner access required'; end if;
  select * into d from public.company_documents where id=p_document_id and company_id=v_company for update;
  if not found then raise exception 'Document not found'; end if;
  select * into t from public.plaid_transactions where id=p_bank_transaction_id and company_id=v_company and coalesce(removed,false)=false;
  if not found then raise exception 'Bank transaction not found'; end if;
  update public.company_documents set bank_transaction_id=t.id,review_status='matched',reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now()
  where id=d.id;
  return true;
end;
$$;
revoke all on function public.link_document_to_bank_transaction(uuid,uuid) from public,anon;
grant execute on function public.link_document_to_bank_transaction(uuid,uuid) to authenticated;
