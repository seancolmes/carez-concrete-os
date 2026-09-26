-- Restore the current V1 receivables contract. The original Award and approved
-- Change Order records remain immutable; invoices and payments are append-only
-- financial evidence linked to the tenant and project.

alter table public.projects
  add column if not exists sales_tax_rate_percent numeric(8,5) not null default 0,
  add column if not exists sales_tax_exempt boolean not null default false,
  add column if not exists sales_tax_jurisdiction text,
  add column if not exists completed_at timestamptz;

create unique index if not exists customers_company_id_id_uk on public.customers(company_id,id);

create table public.company_invoice_number_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_number integer not null default 0 check(last_number>=0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid,
  customer_id uuid,
  invoice_number text not null,
  invoice_type text not null default 'progress' check(invoice_type in ('deposit','progress','final','change_order','credit_memo','retainage_release')),
  status text not null default 'draft' check(status in ('draft','sent','void')),
  issue_date date not null default current_date,
  due_date date,
  billing_period_start date,
  billing_period_end date,
  po_number text,
  from_name text not null,
  from_legal_name text,
  from_address_line1 text,
  from_address_line2 text,
  from_city text,
  from_state text,
  from_postal_code text,
  from_phone text,
  from_email text,
  from_website text,
  from_ubi_number text,
  from_contractor_license_number text,
  from_logo_path text,
  payment_instructions text,
  invoice_footer text,
  bill_to_name text,
  bill_to_contact text,
  bill_to_email text,
  bill_to_address_line1 text,
  bill_to_address_line2 text,
  bill_to_city text,
  bill_to_state text,
  bill_to_postal_code text,
  sales_tax_rate_percent numeric(8,5) not null default 0 check(sales_tax_rate_percent>=0),
  sales_tax_exempt boolean not null default false,
  sales_tax_jurisdiction text,
  retainage_percent numeric(6,3) not null default 0 check(retainage_percent>=0 and retainage_percent<=100),
  terms_text text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,invoice_number),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,customer_id) references public.customers(company_id,id) on delete restrict
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  invoice_id uuid not null,
  source_type text not null default 'manual' check(source_type in ('manual','original_contract','change_order','retainage_release')),
  source_invoice_id uuid,
  change_order_id uuid,
  description text not null check(length(btrim(description))>0),
  quantity numeric(14,4) not null default 0,
  unit text not null default 'LS',
  unit_price numeric(14,4) not null default 0,
  line_amount numeric(14,2) not null default 0,
  taxable boolean not null default true,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,invoice_id) references public.invoices(company_id,id) on delete restrict,
  foreign key(company_id,source_invoice_id) references public.invoices(company_id,id) on delete restrict,
  foreign key(company_id,change_order_id) references public.change_orders(company_id,id) on delete restrict,
  check(abs(line_amount-round(quantity*unit_price,2))<=0.01)
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid,
  project_id uuid,
  received_date date not null default current_date,
  amount numeric(14,2) not null check(amount>0),
  processing_fee numeric(14,2) not null default 0 check(processing_fee>=0 and processing_fee<=amount),
  payment_method text not null default 'check' check(payment_method in ('check','ach','card','cash','wire','other')),
  reference_number text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,customer_id) references public.customers(company_id,id) on delete restrict,
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14,2) not null check(amount>0),
  created_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,payment_id,invoice_id),
  foreign key(company_id,payment_id) references public.customer_payments(company_id,id) on delete restrict,
  foreign key(company_id,invoice_id) references public.invoices(company_id,id) on delete restrict
);

create table public.project_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid not null,
  award_decision_id uuid,
  label text not null check(length(btrim(label))>0),
  milestone_type text not null default 'progress' check(milestone_type in ('deposit','progress','final','retainage','other')),
  amount_basis text not null default 'percent' check(amount_basis in ('percent','fixed')),
  percent_of_contract numeric(8,3),
  amount numeric(14,2) not null check(amount>0),
  due_trigger text not null default 'manual' check(due_trigger in ('before_start','manual','pour','completion')),
  required_before_start boolean not null default false,
  notes text,
  invoice_id uuid,
  waived_at timestamptz,
  waived_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete restrict,
  foreign key(company_id,award_decision_id) references public.award_decisions(company_id,id) on delete restrict,
  foreign key(company_id,invoice_id) references public.invoices(company_id,id) on delete restrict,
  check((amount_basis='percent' and percent_of_contract is not null and percent_of_contract>=0 and percent_of_contract<=100)
     or (amount_basis='fixed' and percent_of_contract is null)),
  check((waived_at is null and waived_reason is null) or (waived_at is not null and length(btrim(coalesce(waived_reason,'')))>0))
);

create index invoices_project_status_idx on public.invoices(company_id,project_id,status,issue_date desc);
create index invoice_lines_invoice_idx on public.invoice_lines(company_id,invoice_id,sort_order,id);
create index customer_payments_project_date_idx on public.customer_payments(company_id,project_id,received_date desc);
create index payment_allocations_invoice_idx on public.payment_allocations(company_id,invoice_id);
create index project_payment_milestones_project_idx on public.project_payment_milestones(company_id,project_id,created_at desc);

create or replace function public.next_invoice_number()
returns text language plpgsql security definer set search_path=pg_catalog,public,auth,extensions
as $$
declare v_company uuid; v_actor uuid; v_number integer;
begin
  v_actor:=auth.uid(); v_company:=public.get_my_company_id();
  if v_actor is null or v_company is null or public.get_my_role() not in ('owner','office') then
    raise exception 'Owner or office billing authority required.';
  end if;
  insert into public.company_invoice_number_sequences(company_id,last_number) values(v_company,1)
  on conflict(company_id) do update set last_number=public.company_invoice_number_sequences.last_number+1
  returning last_number into v_number;
  return 'INV-'||extract(year from current_date)::integer::text||'-'||lpad(v_number::text,5,'0');
end
$$;

create or replace trigger invoices_updated_at before update on public.invoices
for each row execute function public.set_updated_at();
create or replace trigger project_payment_milestones_updated_at before update on public.project_payment_milestones
for each row execute function public.set_updated_at();

create or replace view public.invoice_financial_summary with (security_invoker=true) as
with line_totals as (
  select company_id,invoice_id,sum(line_amount)::numeric(14,2) subtotal,
    sum(line_amount) filter(where taxable)::numeric(14,2) taxable_subtotal
  from public.invoice_lines group by company_id,invoice_id
), payments as (
  select company_id,invoice_id,sum(amount)::numeric(14,2) amount_paid
  from public.payment_allocations group by company_id,invoice_id
), base as (
  select i.*,coalesce(l.subtotal,0)::numeric(14,2) subtotal,
    coalesce(l.taxable_subtotal,0)::numeric(14,2) taxable_subtotal,
    coalesce(p.amount_paid,0)::numeric(14,2) amount_paid
  from public.invoices i left join line_totals l on l.company_id=i.company_id and l.invoice_id=i.id
  left join payments p on p.company_id=i.company_id and p.invoice_id=i.id
)
select b.id invoice_id,b.company_id,b.project_id,b.customer_id,b.invoice_number,b.invoice_type,
  case when b.status='void' then 'void' when b.status='sent' and round(b.subtotal+case when b.sales_tax_exempt then 0 else b.taxable_subtotal*b.sales_tax_rate_percent/100 end-greatest(0,b.subtotal*b.retainage_percent/100)-b.amount_paid,2)<=0 then 'paid' else b.status end status,
  b.issue_date,b.due_date,b.billing_period_start,b.billing_period_end,b.po_number,b.bill_to_name,b.bill_to_contact,b.bill_to_email,
  b.sales_tax_rate_percent,b.sales_tax_exempt,b.sales_tax_jurisdiction,b.retainage_percent,b.terms_text,b.notes,
  b.subtotal,b.taxable_subtotal,
  case when b.sales_tax_exempt then 0 else round(b.taxable_subtotal*b.sales_tax_rate_percent/100,2) end::numeric(14,2) tax_amount,
  greatest(0,round(b.subtotal*b.retainage_percent/100,2))::numeric(14,2) retainage_held,
  round(b.subtotal+case when b.sales_tax_exempt then 0 else b.taxable_subtotal*b.sales_tax_rate_percent/100 end-greatest(0,b.subtotal*b.retainage_percent/100),2)::numeric(14,2) invoice_total,
  b.amount_paid,
  round(b.subtotal+case when b.sales_tax_exempt then 0 else b.taxable_subtotal*b.sales_tax_rate_percent/100 end-greatest(0,b.subtotal*b.retainage_percent/100)-b.amount_paid,2)::numeric(14,2) balance_due,
  case when b.status='void' then 'void' when b.status='draft' then 'draft' when round(b.subtotal+case when b.sales_tax_exempt then 0 else b.taxable_subtotal*b.sales_tax_rate_percent/100 end-greatest(0,b.subtotal*b.retainage_percent/100)-b.amount_paid,2)<=0 then 'paid' when b.due_date is not null and b.due_date<current_date then 'overdue' else 'open' end collection_status,
  greatest(0,current_date-coalesce(b.due_date,current_date))::integer days_overdue,
  b.created_at,b.updated_at
from base b;

create or replace view public.payment_financial_summary with (security_invoker=true) as
select p.id payment_id,p.company_id,p.customer_id,p.project_id,p.received_date,p.amount,p.processing_fee,p.payment_method,p.reference_number,p.notes,
  coalesce(sum(a.amount),0)::numeric(14,2) allocated_amount,
  (p.amount-coalesce(sum(a.amount),0))::numeric(14,2) unallocated_amount,p.created_at
from public.customer_payments p left join public.payment_allocations a on a.company_id=p.company_id and a.payment_id=p.id
group by p.id,p.company_id,p.customer_id,p.project_id,p.received_date,p.amount,p.processing_fee,p.payment_method,p.reference_number,p.notes,p.created_at;

create or replace view public.project_billing_summary with (security_invoker=true) as
select p.company_id,p.id project_id,p.job_number,p.name,p.contract_value original_contract_value,
  coalesce(sum(i.invoice_total) filter(where i.status<>'void'),0)::numeric(14,2) billed_amount,
  coalesce(sum(i.amount_paid) filter(where i.status<>'void'),0)::numeric(14,2) collected_amount,
  coalesce(sum(i.balance_due) filter(where i.status not in ('void','paid')),0)::numeric(14,2) outstanding_ar,
  greatest(0,p.contract_value-coalesce(sum(i.invoice_total) filter(where i.status<>'void'),0))::numeric(14,2) unbilled_contract,
  coalesce(sum(i.retainage_held) filter(where i.status<>'void'),0)::numeric(14,2) retainage_held
from public.projects p left join public.invoice_financial_summary i on i.company_id=p.company_id and i.project_id=p.id
group by p.company_id,p.id,p.job_number,p.name,p.contract_value;

create or replace view public.retainage_available_summary with (security_invoker=true) as
with released as (
  select l.company_id,l.source_invoice_id,sum(abs(l.line_amount))::numeric(14,2) retainage_released
  from public.invoice_lines l join public.invoices i on i.company_id=l.company_id and i.id=l.invoice_id
  where l.source_type='retainage_release' and l.source_invoice_id is not null and i.status<>'void'
  group by l.company_id,l.source_invoice_id
)
select i.id source_invoice_id,i.company_id,i.project_id,i.invoice_number,i.issue_date,
  s.retainage_held,coalesce(r.retainage_released,0)::numeric(14,2) retainage_released,
  greatest(0,s.retainage_held-coalesce(r.retainage_released,0))::numeric(14,2) available_to_release
from public.invoices i join public.invoice_financial_summary s on s.invoice_id=i.id and s.company_id=i.company_id
left join released r on r.company_id=i.company_id and r.source_invoice_id=i.id
where i.invoice_type<>'retainage_release' and i.status<>'void' and s.retainage_held>0;

alter table public.company_invoice_number_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.customer_payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.project_payment_milestones enable row level security;

create policy invoice_owner_office on public.invoices for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy invoice_line_owner_office on public.invoice_lines for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy payment_owner_office on public.customer_payments for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy allocation_owner_office on public.payment_allocations for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy milestone_owner_office on public.project_payment_milestones for all to authenticated
  using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'))
  with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));

revoke all on public.company_invoice_number_sequences from public,anon,authenticated;
revoke all on public.invoices,public.invoice_lines,public.customer_payments,public.payment_allocations,public.project_payment_milestones from public,anon;
grant select,insert,update,delete on public.invoices,public.invoice_lines,public.customer_payments,public.payment_allocations,public.project_payment_milestones to authenticated;
grant select on public.invoice_financial_summary,public.payment_financial_summary,public.project_billing_summary,public.retainage_available_summary to authenticated;
revoke all on function public.next_invoice_number() from public,anon;
grant execute on function public.next_invoice_number() to authenticated;

comment on table public.invoices is 'Tenant-scoped receivable evidence; original Award and approved Change Order facts remain immutable.';
comment on view public.invoice_financial_summary is 'Deterministic invoice totals, tax, retainage, payment application, and balance read model.';
comment on view public.project_billing_summary is 'Project billing read model; it never mutates original Award or Commercial Baseline facts.';
