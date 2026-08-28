-- Awarded Job Setup: accepted authorization snapshot + payment milestones + schedule readiness.

create table if not exists public.project_award_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  proposal_acceptance_id uuid references public.proposal_acceptances(id) on delete set null,
  agreement_number text not null,
  proposal_number text,
  accepted_name text,
  accepted_email text,
  accepted_at timestamptz,
  acceptance_note text,
  original_contract_value numeric not null default 0 check(original_contract_value >= 0),
  authorization_text text not null,
  billing_plan_notes text,
  status text not null default 'accepted' check(status in ('accepted','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,agreement_number)
);

alter table public.project_award_records enable row level security;
drop policy if exists "owner access project award records" on public.project_award_records;
create policy "owner access project award records" on public.project_award_records for all to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');
grant select,insert,update,delete on public.project_award_records to authenticated;

create table if not exists public.project_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  award_record_id uuid not null references public.project_award_records(id) on delete cascade,
  sequence_no integer not null default 10,
  milestone_type text not null default 'progress' check(milestone_type in ('deposit','progress','final','retainage','other')),
  label text not null,
  amount_basis text not null default 'percent' check(amount_basis in ('percent','fixed')),
  percent_of_contract numeric check(percent_of_contract is null or (percent_of_contract >= 0 and percent_of_contract <= 100)),
  amount numeric not null default 0 check(amount >= 0),
  due_trigger text not null default 'manual' check(due_trigger in ('before_start','manual','pour','completion')),
  required_before_start boolean not null default false,
  invoice_id uuid references public.invoices(id) on delete set null,
  waived_at timestamptz,
  waived_reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_payment_milestones_invoice_key
on public.project_payment_milestones(invoice_id) where invoice_id is not null;
create index if not exists project_payment_milestones_project_idx
on public.project_payment_milestones(project_id,sequence_no,created_at);

alter table public.project_payment_milestones enable row level security;
drop policy if exists "owner access project payment milestones" on public.project_payment_milestones;
create policy "owner access project payment milestones" on public.project_payment_milestones for all to authenticated
using (company_id=public.get_my_company_id() and public.get_my_role()<>'employee')
with check (company_id=public.get_my_company_id() and public.get_my_role()<>'employee');
grant select,insert,update,delete on public.project_payment_milestones to authenticated;

-- Accepted customer authorization is evidence. Keep its snapshot immutable after capture.
create or replace function public.protect_project_award_snapshot()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.company_id is distinct from old.company_id
     or new.project_id is distinct from old.project_id
     or new.estimate_id is distinct from old.estimate_id
     or new.proposal_acceptance_id is distinct from old.proposal_acceptance_id
     or new.agreement_number is distinct from old.agreement_number
     or new.proposal_number is distinct from old.proposal_number
     or new.accepted_name is distinct from old.accepted_name
     or new.accepted_email is distinct from old.accepted_email
     or new.accepted_at is distinct from old.accepted_at
     or new.acceptance_note is distinct from old.acceptance_note
     or new.original_contract_value is distinct from old.original_contract_value
     or new.authorization_text is distinct from old.authorization_text then
    raise exception 'Accepted agreement snapshot cannot be rewritten';
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists protect_project_award_snapshot on public.project_award_records;
create trigger protect_project_award_snapshot before update on public.project_award_records
for each row execute function public.protect_project_award_snapshot();

-- Capture one immutable award record when an estimate is accepted and converted to a project.
create or replace function public.capture_project_award_record()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_accept public.proposal_acceptances%rowtype;
  v_proposal text;
  v_agreement text;
  v_value numeric:=0;
begin
  if new.status<>'accepted' or new.project_id is null then return new; end if;
  if exists(select 1 from public.project_award_records where project_id=new.project_id) then return new; end if;

  select * into v_accept from public.proposal_acceptances
  where estimate_id=new.id order by accepted_at desc limit 1;
  if not found then return new; end if;

  select proposal_number into v_proposal from public.proposal_access_tokens
  where estimate_id=new.id and proposal_number is not null
  order by created_at desc limit 1;
  v_proposal:=coalesce(v_proposal,'P-'||coalesce(new.opportunity_number,regexp_replace(new.estimate_number,'^E-',''))||'-R'||coalesce(new.version,0)::text);

  select coalesce(selected_sell_price,0) into v_value
  from public.estimate_financial_summary where estimate_id=new.id;

  v_agreement:=public.allocate_project_document_number(new.company_id,new.project_id,'agreement','AGR');
  insert into public.project_award_records(
    company_id,project_id,estimate_id,proposal_acceptance_id,agreement_number,proposal_number,
    accepted_name,accepted_email,accepted_at,acceptance_note,original_contract_value,authorization_text,status
  ) values(
    new.company_id,new.project_id,new.id,v_accept.id,v_agreement,v_proposal,
    v_accept.accepted_name,v_accept.accepted_email,v_accept.accepted_at,v_accept.acceptance_note,v_value,
    'Customer accepted the proposal and authorized Carez Concrete to proceed subject to the stated scope and terms.','accepted'
  ) on conflict(project_id) do nothing;
  return new;
end;
$$;
revoke all on function public.capture_project_award_record() from public,anon,authenticated;

drop trigger if exists capture_project_award_record on public.estimates;
create trigger capture_project_award_record after insert or update on public.estimates
for each row execute function public.capture_project_award_record();

-- Current readiness is derived from accepted authorization, project tax setup, and any required pre-start payment.
create or replace view public.project_job_readiness_summary
with (security_invoker=true)
as
with milestone_rollup as (
  select
    m.project_id,
    count(*)::integer as milestone_count,
    count(*) filter(where m.required_before_start and m.waived_at is null)::integer as required_before_start_count,
    coalesce(sum(m.amount) filter(where m.required_before_start and m.waived_at is null),0)::numeric as required_before_start_amount,
    count(*) filter(
      where m.required_before_start and m.waived_at is null
        and (m.invoice_id is null or i.status='void' or coalesce(i.balance_due,m.amount)>0.01)
    )::integer as required_before_start_open_count,
    coalesce(sum(m.amount) filter(
      where m.required_before_start and m.waived_at is null
        and m.invoice_id is not null and i.status<>'void' and coalesce(i.balance_due,m.amount)<=0.01
    ),0)::numeric as required_before_start_paid_amount
  from public.project_payment_milestones m
  left join public.invoice_financial_summary i on i.invoice_id=m.invoice_id
  group by m.project_id
)
select
  p.company_id,
  p.id as project_id,
  p.job_number,
  p.name as project_name,
  p.source_estimate_id,
  (p.source_estimate_id is not null) as award_setup_applies,
  a.id as award_record_id,
  a.agreement_number,
  a.proposal_number,
  a.accepted_name,
  a.accepted_at,
  a.original_contract_value,
  (a.id is not null and a.status='accepted') as agreement_captured,
  (coalesce(p.sales_tax_exempt,false) or (coalesce(p.sales_tax_rate_percent,0)>0 and nullif(trim(coalesce(p.sales_tax_jurisdiction,'')),'') is not null)) as billing_ready,
  coalesce(m.milestone_count,0) as milestone_count,
  coalesce(m.required_before_start_count,0) as required_before_start_count,
  coalesce(m.required_before_start_amount,0) as required_before_start_amount,
  coalesce(m.required_before_start_open_count,0) as required_before_start_open_count,
  coalesce(m.required_before_start_paid_amount,0) as required_before_start_paid_amount,
  case
    when p.source_estimate_id is null then true
    else (a.id is not null and a.status='accepted')
      and (coalesce(p.sales_tax_exempt,false) or (coalesce(p.sales_tax_rate_percent,0)>0 and nullif(trim(coalesce(p.sales_tax_jurisdiction,'')),'') is not null))
      and coalesce(m.required_before_start_open_count,0)=0
  end as job_ready,
  case
    when p.source_estimate_id is null then 'Manual / existing job'
    when a.id is null or a.status<>'accepted' then 'Accepted agreement missing'
    when not (coalesce(p.sales_tax_exempt,false) or (coalesce(p.sales_tax_rate_percent,0)>0 and nullif(trim(coalesce(p.sales_tax_jurisdiction,'')),'') is not null)) then 'Set sales tax / billing'
    when coalesce(m.required_before_start_open_count,0)>0 then 'Collect pre-start payment'
    else 'Ready to schedule'
  end as readiness_reason
from public.projects p
left join public.project_award_records a on a.project_id=p.id
left join milestone_rollup m on m.project_id=p.id;

grant select on public.project_job_readiness_summary to authenticated;
