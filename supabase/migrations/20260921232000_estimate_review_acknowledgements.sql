-- P1.4 append-only acknowledgement evidence for Estimate Review / Recap.
-- Current readiness remains derived; only explicit human review evidence is persisted.

create table public.estimate_review_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  commercial_fingerprint text not null,
  warning_fingerprint text not null,
  warning_count integer not null check (warning_count > 0),
  warning_snapshot jsonb not null,
  acknowledged_by uuid not null references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  constraint estimate_review_ack_company_id_id_key unique(company_id,id),
  constraint estimate_review_ack_estimate_company_fk
    foreign key(company_id,estimate_id)
    references public.estimates(company_id,id)
    on delete cascade
);

create index estimate_review_ack_estimate_idx
  on public.estimate_review_acknowledgements(company_id,estimate_id,acknowledged_at desc);

create index estimate_review_ack_actor_idx
  on public.estimate_review_acknowledgements(acknowledged_by);

alter table public.estimate_review_acknowledgements enable row level security;
create policy "office read estimate review acknowledgements"
on public.estimate_review_acknowledgements
for select to authenticated
using (
  company_id=(select public.get_my_company_id())
  and (select public.get_my_role())<>'employee'
);

grant select on public.estimate_review_acknowledgements to authenticated;
grant all on public.estimate_review_acknowledgements to service_role;
revoke all on public.estimate_review_acknowledgements from anon;

create or replace function public.carez_reject_estimate_review_ack_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  raise exception 'Estimate review acknowledgements are immutable.';
end;
$$;

create trigger reject_estimate_review_ack_update
before update or delete on public.estimate_review_acknowledgements
for each row execute function public.carez_reject_estimate_review_ack_mutation();

revoke all on function public.carez_reject_estimate_review_ack_mutation()
from public,anon,authenticated;
