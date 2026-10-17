-- Operational evidence for an external agreement. This never creates an internal
-- Proposal, Award Decision, commercial baseline, budget or approved change.
create table public.external_agreement_verifications(
 id uuid primary key default gen_random_uuid(),sequence_no bigint generated always as identity unique,
 company_id uuid not null references public.companies(id),project_id uuid not null,intake_id uuid not null references public.project_external_intakes(id),
 request_id uuid not null,request_payload jsonb not null,previous_event_id uuid,
 action text not null check(action in ('verify','revoke')),
 evidence_basis text check(evidence_basis in ('owner_attestation_copy_pending','executed_copy_reviewed')),
 agreement_reference text not null,agreement_amount numeric(12,2) not null,
 document_id uuid references public.company_documents(id),document_sha256 text,document_byte_size bigint,
 note text not null,actor_id uuid not null references public.profiles(id),actor_role text not null check(actor_role='owner'),created_at timestamptz not null default clock_timestamp(),
 unique(company_id,id),unique(company_id,request_id),
 foreign key(company_id,project_id) references public.projects(company_id,id),
 foreign key(company_id,previous_event_id) references public.external_agreement_verifications(company_id,id),
 check((action='revoke' and evidence_basis is null) or (action='verify' and evidence_basis is not null)),
 check(evidence_basis is distinct from 'executed_copy_reviewed' or (document_id is not null and document_sha256 is not null and document_byte_size>0))
);
alter table public.external_agreement_verifications enable row level security;
create policy external_agreement_events_read on public.external_agreement_verifications for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.external_agreement_verifications from public,anon,authenticated;grant select on public.external_agreement_verifications to authenticated;
create function public.carez_immutable_external_agreement() returns trigger language plpgsql set search_path=pg_catalog as $$ begin raise exception 'External agreement verification history is append-only.';end $$;
create trigger immutable_external_agreement_events before update or delete on public.external_agreement_verifications for each row execute function public.carez_immutable_external_agreement();
alter table public.project_award_records add column external_verification_id uuid;
alter table public.project_award_records add constraint award_external_verification_tenant foreign key(company_id,external_verification_id) references public.external_agreement_verifications(company_id,id);
do $$ begin
 if exists(select 1 from public.project_award_records a join public.project_external_intakes i on i.company_id=a.company_id and i.project_id=a.project_id where a.status='accepted' and a.award_decision_id is null) then raise exception 'An external accepted record already exists without governed verification. Review it before applying this contract; no owner verification was invented.';end if;
end $$;

create function public.carez_guard_external_agreement_record() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_company uuid;v_project uuid;v_event public.external_agreement_verifications%rowtype;v_authorization text;
begin
 if tg_op='UPDATE' and exists(select 1 from public.project_external_intakes where company_id=old.company_id and project_id=old.project_id)
  and (new.id,new.company_id,new.project_id) is distinct from (old.id,old.company_id,old.project_id) then raise exception 'External agreement identity cannot be moved to another project.';end if;
 if tg_op='DELETE' then v_company:=old.company_id;v_project:=old.project_id;else v_company:=new.company_id;v_project:=new.project_id;end if;
 if not exists(select 1 from public.project_external_intakes where company_id=v_company and project_id=v_project) then
  if tg_op<>'DELETE' and new.external_verification_id is not null then raise exception 'External verification cannot authorize another project.';end if;
  return coalesce(new,old);
 end if;
 if tg_op='DELETE' then raise exception 'External agreement history must be retained. Revoke the owner verification instead.';end if;
 if new.award_decision_id is not null then raise exception 'External intake cannot manufacture an internal Award Decision.';end if;
 select * into v_event from public.external_agreement_verifications where company_id=v_company and project_id=v_project order by sequence_no desc limit 1;
 if v_event.id is null or new.external_verification_id is distinct from v_event.id or new.original_contract_value is distinct from v_event.agreement_amount or new.agreement_number is distinct from v_event.agreement_reference then raise exception 'Use governed owner verification for this external agreement.';end if;
 if (new.status='accepted' and v_event.action<>'verify') or (new.status<>'accepted' and v_event.action<>'revoke') then raise exception 'External agreement status must match its current verification event.';end if;
 v_authorization:=case when v_event.action='revoke' then 'Owner verification revoked.' when v_event.evidence_basis='owner_attestation_copy_pending' then 'Owner verified externally signed agreement. Executed copy remains pending.' else 'Owner reviewed retained executed agreement.' end;
 if new.accepted_name is not null or new.accepted_email is not null or new.accepted_at is not null or new.proposal_number is not null or new.acceptance_note is not null or new.authorization_text is distinct from v_authorization then raise exception 'External owner verification cannot fabricate customer acceptance or internal Proposal attribution.';end if;
 return new;
end $$;
create trigger guard_external_agreement_record before insert or update or delete on public.project_award_records for each row execute function public.carez_guard_external_agreement_record();

create function public.carez_verify_external_agreement(p_request_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare v_company uuid;v_role text;v_project uuid;v_intake public.project_external_intakes%rowtype;v_previous public.external_agreement_verifications%rowtype;
 v_existing public.external_agreement_verifications%rowtype;v_document public.company_documents%rowtype;v_event uuid;v_action text:=p_payload->>'action';v_basis text:=p_payload->>'evidence_basis';v_note text:=nullif(btrim(p_payload->>'note'),'');v_amount numeric;v_award public.project_award_records%rowtype;
begin
 select company_id,role into v_company,v_role from public.profiles where id=auth.uid();
 if v_company is null or v_role is distinct from 'owner' then raise exception 'Only the company owner can verify or revoke an external agreement.';end if;
 if p_request_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid verification request.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_company::text||p_request_id::text,2));
 select * into v_existing from public.external_agreement_verifications where company_id=v_company and request_id=p_request_id;
 if found then if v_existing.request_payload is distinct from p_payload then raise exception 'This request already recorded different verification evidence.';end if;return v_existing.id;end if;
 v_project:=(p_payload->>'project_id')::uuid;
 perform 1 from public.projects where company_id=v_company and id=v_project for update;
 if not found then raise exception 'Project unavailable in this company.';end if;
 select * into v_intake from public.project_external_intakes where company_id=v_company and project_id=v_project for update;
 if not found then raise exception 'Recorded external intake is required.';end if;
 select * into v_previous from public.external_agreement_verifications where company_id=v_company and project_id=v_project order by sequence_no desc limit 1;
 if v_previous.id is distinct from (p_payload->>'expected_event_id')::uuid then raise exception 'Agreement evidence changed. Reopen Job Setup before continuing.';end if;
 if v_action is null or v_action not in ('verify','revoke') or v_note is null or length(v_note)<10 or length(v_note)>2000 then raise exception 'Record the action and a specific verification or revocation reason.';end if;
 v_amount:=(p_payload->>'agreement_amount')::numeric;
 if v_amount is null or v_amount::text in ('NaN','Infinity','-Infinity') or v_amount is distinct from v_intake.supplied_agreement_amount or p_payload->>'agreement_reference' is distinct from v_intake.agreement_reference then raise exception 'The recorded agreement amount or reference changed. Reopen the source evidence.';end if;
 select * into v_award from public.project_award_records where company_id=v_company and project_id=v_project for update;
 if v_award.award_decision_id is not null then raise exception 'Internal Award authority must remain separate from external verification.';end if;
 if v_action='verify' then
  if v_basis is null or v_basis not in ('owner_attestation_copy_pending','executed_copy_reviewed') or p_payload->>'acknowledged' is distinct from 'true' then raise exception 'Explicit owner verification of the externally signed agreement is required.';end if;
  if v_basis='executed_copy_reviewed' then
   select * into v_document from public.company_documents where company_id=v_company and project_id=v_project and id=(p_payload->>'document_id')::uuid and document_type='agreement';
   if not found or v_document.content_sha256 is null or v_document.byte_size is null or v_document.content_sha256 is distinct from p_payload->>'document_sha256' or v_document.byte_size::text is distinct from p_payload->>'document_byte_size' then raise exception 'Retained agreement evidence changed or is unavailable. Review the actual executed copy.';end if;
  elsif p_payload->>'document_id' is not null then raise exception 'Copy-pending verification cannot claim a reviewed executed document.';end if;
 else
  if v_previous.action is distinct from 'verify' or v_award.status is distinct from 'accepted' then raise exception 'A current owner verification is required before revocation.';end if;
  v_basis:=null;
 end if;
 insert into public.external_agreement_verifications(company_id,project_id,intake_id,request_id,request_payload,previous_event_id,action,evidence_basis,agreement_reference,agreement_amount,document_id,document_sha256,document_byte_size,note,actor_id,actor_role)
 values(v_company,v_project,v_intake.id,p_request_id,p_payload,v_previous.id,v_action,v_basis,v_intake.agreement_reference,v_intake.supplied_agreement_amount,v_document.id,v_document.content_sha256,v_document.byte_size,v_note,auth.uid(),'owner') returning id into v_event;
 if v_action='verify' then
  insert into public.project_award_records(company_id,project_id,agreement_number,original_contract_value,status,authorization_text,external_verification_id)
  values(v_company,v_project,v_intake.agreement_reference,v_intake.supplied_agreement_amount,'accepted',case when v_basis='owner_attestation_copy_pending' then 'Owner verified externally signed agreement. Executed copy remains pending.' else 'Owner reviewed retained executed agreement.' end,v_event)
  on conflict(company_id,project_id) do update set agreement_number=excluded.agreement_number,original_contract_value=excluded.original_contract_value,status='accepted',authorization_text=excluded.authorization_text,external_verification_id=v_event,accepted_name=null,accepted_email=null,accepted_at=null,proposal_number=null,acceptance_note=null;
 else
  update public.project_award_records set status='void',external_verification_id=v_event,authorization_text='Owner verification revoked.' where company_id=v_company and project_id=v_project;
  if not found then raise exception 'No current external agreement was revoked.';end if;
 end if;
 return v_event;
end $$;
revoke all on function public.carez_verify_external_agreement(uuid,jsonb) from public,anon;grant execute on function public.carez_verify_external_agreement(uuid,jsonb) to authenticated;

-- An operational agreement does not establish an internally awarded budget.
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
    exists(select 1 from public.commercial_baselines b where b.company_id=p.company_id and b.project_id=p.id and b.baseline_kind='original_award') has_awarded_budget,
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


revoke all on function public.carez_immutable_external_agreement() from public,anon,authenticated;
revoke all on function public.carez_guard_external_agreement_record() from public,anon,authenticated;
