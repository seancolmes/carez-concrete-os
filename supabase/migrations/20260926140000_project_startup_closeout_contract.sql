create table public.project_award_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  award_decision_id uuid,
  agreement_number text not null,
  proposal_number text,
  original_contract_value numeric(14,2) not null default 0,
  status text not null default 'accepted' check (status in ('accepted','superseded','void')),
  accepted_name text,
  accepted_email text,
  accepted_at timestamptz,
  authorization_text text,
  acceptance_note text,
  billing_plan_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,project_id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade,
  foreign key(company_id,award_decision_id) references public.award_decisions(company_id,id) on delete restrict
);

alter table public.project_payment_milestones add column if not exists sequence_no integer not null default 10;
alter table public.project_payment_milestones add column if not exists award_record_id uuid;
alter table public.project_payment_milestones add constraint project_payment_milestone_award_record_fk
  foreign key(company_id,award_record_id) references public.project_award_records(company_id,id) on delete restrict;

create or replace function public.sync_project_award_record()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.project_award_records(company_id,project_id,award_decision_id,agreement_number,proposal_number,original_contract_value,accepted_at,authorization_text)
  select new.company_id,new.project_id,new.id,
    'AWD-'||upper(substr(new.id::text,1,8)),pp.proposal_number,p.contract_value,new.decided_at,
    coalesce(new.evidence_reference,'Accepted exact Proposal revision')
  from public.projects p left join public.proposal_presentations pp on pp.company_id=new.company_id and pp.id=new.proposal_revision_id
  where p.company_id=new.company_id and p.id=new.project_id
  on conflict(company_id,project_id) do update set award_decision_id=excluded.award_decision_id,
    proposal_number=excluded.proposal_number,original_contract_value=excluded.original_contract_value,
    accepted_at=excluded.accepted_at,authorization_text=excluded.authorization_text,updated_at=now();
  return new;
end;
$$;
create trigger sync_project_award_record_after_insert after insert on public.award_decisions
for each row execute function public.sync_project_award_record();

create table public.project_startup_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open','done','not_needed')),
  sort_order integer not null default 0,
  notes text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade
);

create table public.project_closeouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  status text not null default 'open' check (status in ('open','completed')),
  punch_complete boolean not null default false,
  timecards_complete boolean not null default false,
  purchase_orders_closed boolean not null default false,
  vendor_bills_complete boolean not null default false,
  change_orders_complete boolean not null default false,
  customer_billed_complete boolean not null default false,
  customer_paid_complete boolean not null default false,
  documents_complete boolean not null default false,
  warranty_sent boolean not null default false,
  closeout_notes text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,id),
  unique(company_id,project_id),
  foreign key(company_id,project_id) references public.projects(company_id,id) on delete cascade
);

create or replace view public.project_job_readiness_summary with (security_invoker=true) as
with payment as (
  select m.company_id,m.project_id,count(*) filter(where m.required_before_start)::integer required_before_start_count,
    coalesce(sum(m.amount) filter(where m.required_before_start),0)::numeric required_before_start_amount,
    coalesce(sum(case when m.required_before_start and (m.waived_at is not null or (m.invoice_id is not null and coalesce(i.balance_due,0)<=0.01)) then m.amount else 0 end),0)::numeric required_before_start_paid_amount,
    count(*) filter(where m.required_before_start and m.waived_at is null and (m.invoice_id is null or coalesce(i.balance_due,0)>0.01))::integer required_before_start_open_count
  from public.project_payment_milestones m left join public.invoice_financial_summary i on i.company_id=m.company_id and i.invoice_id=m.invoice_id
  group by m.company_id,m.project_id
)
select p.company_id,p.id project_id,p.job_number,p.name,p.address,p.city,p.state,
  exists(select 1 from public.project_award_records a where a.company_id=p.company_id and a.project_id=p.id and a.status='accepted') agreement_captured,
  (p.sales_tax_exempt or (coalesce(p.sales_tax_rate_percent,0)>0 and nullif(btrim(coalesce(p.sales_tax_jurisdiction,'')),'') is not null)) billing_ready,
  coalesce(pay.required_before_start_count,0)::integer required_before_start_count,
  coalesce(pay.required_before_start_amount,0)::numeric required_before_start_amount,
  coalesce(pay.required_before_start_paid_amount,0)::numeric required_before_start_paid_amount,
  coalesce(pay.required_before_start_open_count,0)::integer required_before_start_open_count,
  (exists(select 1 from public.project_award_records a where a.company_id=p.company_id and a.project_id=p.id and a.status='accepted')
    and (p.sales_tax_exempt or (coalesce(p.sales_tax_rate_percent,0)>0 and nullif(btrim(coalesce(p.sales_tax_jurisdiction,'')),'') is not null))
    and coalesce(pay.required_before_start_open_count,0)=0) job_ready,
  case when not exists(select 1 from public.project_award_records a where a.company_id=p.company_id and a.project_id=p.id and a.status='accepted') then 'Accepted agreement record is missing.'
    when not (p.sales_tax_exempt or (coalesce(p.sales_tax_rate_percent,0)>0 and nullif(btrim(coalesce(p.sales_tax_jurisdiction,'')),'') is not null)) then 'Project sales-tax treatment is not complete.'
    when coalesce(pay.required_before_start_open_count,0)>0 then format('%s required-before-start payment item(s) remain open.',pay.required_before_start_open_count)
    else 'Job setup is complete.' end readiness_reason
from public.projects p left join payment pay on pay.company_id=p.company_id and pay.project_id=p.id;

create or replace view public.project_work_readiness_summary with (security_invoker=true) as
select p.company_id,p.id project_id,p.job_number,p.name,
  count(r.operation_id)::integer operation_count,
  count(r.operation_id) filter(where r.operation_status in ('planned','in_progress','on_hold') and not r.ready_to_start)::integer blocked_operation_count,
  count(r.operation_id) filter(where r.operation_status in ('planned','in_progress','on_hold') and r.ready_to_start)::integer ready_operation_count,
  min(r.scheduled_work_date) filter(where r.scheduled_work_date is not null and r.operation_status in ('planned','in_progress','on_hold')) next_work_date,
  case when count(r.operation_id) filter(where r.operation_status in ('planned','in_progress','on_hold') and not r.ready_to_start)>0 then 'blocked'
    when count(r.operation_id) filter(where r.operation_status in ('planned','in_progress','on_hold'))>0 then 'ready'
    else 'no_work' end readiness_status
from public.projects p left join public.work_package_operation_readiness r on r.company_id=p.company_id and r.project_id=p.id
group by p.company_id,p.id,p.job_number,p.name;

create or replace view public.project_startup_readiness with (security_invoker=true) as
with scheduled as (
  select s.company_id,s.project_id,min(s.schedule_date) next_work_date,
    count(distinct a.crew_member_id)::integer crew_assigned_count
  from public.work_schedule_items s left join public.work_schedule_assignments a on a.company_id=s.company_id and a.schedule_item_id=s.id
  where s.status<>'cancelled' group by s.company_id,s.project_id
), manual as (
  select company_id,project_id,count(*)::integer manual_count,
    count(*) filter(where status='open')::integer manual_open,
    count(*) filter(where status in ('done','not_needed'))::integer manual_clear
  from public.project_startup_items group by company_id,project_id
), facts as (
  select p.company_id,p.id project_id,p.job_number,p.name,p.address,p.city,p.state,c.name customer_name,c.contact_name,c.phone customer_phone,c.email customer_email,
    exists(select 1 from public.project_award_records a where a.company_id=p.company_id and a.project_id=p.id and a.status='accepted') has_awarded_budget,
    (c.phone is not null or c.email is not null) has_customer_contact,
    (nullif(btrim(coalesce(p.address,'')),'') is not null and nullif(btrim(coalesce(p.city,'')),'') is not null) has_jobsite,
    s.next_work_date,s.crew_assigned_count,coalesce(s.next_work_date is not null,false) has_work_scheduled,
    coalesce(m.manual_count,0) manual_count,coalesce(m.manual_open,0) manual_open,coalesce(m.manual_clear,0) manual_clear
  from public.projects p left join public.customers c on c.company_id=p.company_id and c.id=p.customer_id
  left join scheduled s on s.company_id=p.company_id and s.project_id=p.id left join manual m on m.company_id=p.company_id and m.project_id=p.id
  where p.status in ('active','scheduled','on_hold')
)
select f.*,
  5+f.manual_count total_steps,
  (case when f.has_awarded_budget then 1 else 0 end+case when f.has_customer_contact then 1 else 0 end+case when f.has_jobsite then 1 else 0 end+case when f.has_work_scheduled then 1 else 0 end+case when coalesce(f.crew_assigned_count,0)>0 then 1 else 0 end+f.manual_clear)::integer ready_steps,
  case when f.has_awarded_budget and f.has_customer_contact and f.has_jobsite and f.has_work_scheduled and coalesce(f.crew_assigned_count,0)>0 and f.manual_open=0 then 'ready' else 'needs_setup' end readiness_status,
  null::date next_pour_date,null::text next_pour_name,null::text next_pour_status,0::integer open_po_count
from facts f;

alter table public.project_award_records enable row level security;
alter table public.project_startup_items enable row level security;
alter table public.project_closeouts enable row level security;
create policy project_award_record_owner_office on public.project_award_records for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy project_startup_item_owner_office on public.project_startup_items for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
create policy project_closeout_owner_office on public.project_closeouts for all to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office')) with check(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));

revoke all on public.project_award_records,public.project_startup_items,public.project_closeouts from public,anon;
grant select,insert,update,delete on public.project_award_records,public.project_startup_items,public.project_closeouts to authenticated;
revoke all on public.project_job_readiness_summary,public.project_work_readiness_summary,public.project_startup_readiness from public,anon,authenticated;
grant select on public.project_job_readiness_summary,public.project_work_readiness_summary,public.project_startup_readiness to authenticated;

create trigger project_award_records_updated_at before update on public.project_award_records for each row execute function public.set_updated_at();
create trigger project_startup_items_updated_at before update on public.project_startup_items for each row execute function public.set_updated_at();
create trigger project_closeouts_updated_at before update on public.project_closeouts for each row execute function public.set_updated_at();

comment on table public.project_award_records is 'Operational accepted-agreement record linked to the immutable Award Decision; billing notes are administrative only.';
comment on view public.project_job_readiness_summary is 'Fact-derived Job Setup gate for accepted agreement, tax treatment, and required-before-start payments.';
