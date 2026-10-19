set local search_path=pg_catalog,public,extensions;

-- Reconcile the existing ticket writer with the source-owned vocabulary. Keep
-- every legacy value; no historical completion attribution is rewritten.
-- Canonical replay has this CHECK; the verified production-shaped contract has
-- none. Refuse unknown recorded vocabulary rather than relabeling history.
do $$begin
 if exists(select 1 from public.work_package_operations where completion_source is not null
  and completion_source not in ('owner_confirmation','employee_confirmation','ticket_sync','delivery_tickets')) then
  raise exception 'Recorded work completion source needs a compatibility review';
 end if;
end $$;
alter table public.work_package_operations drop constraint if exists work_package_operations_completion_source_check;
alter table public.work_package_operations add constraint work_package_operations_completion_source_check
 check(completion_source is null or completion_source in ('owner_confirmation','employee_confirmation','ticket_sync','delivery_tickets'));

do $preflight$
begin
 if to_regprocedure('public.carez_financial_request_begin(uuid,text,jsonb)') is null
 or to_regprocedure('public.carez_financial_request_finish(uuid,jsonb)') is null
 or to_regclass('public.project_closeouts') is null
 or not exists(select 1 from pg_attribute where attrelid='public.project_billing_summary'::regclass and attname='payment_basis_status' and attnum>0 and not attisdropped)
 then raise exception 'Closeout prerequisites are not installed';end if;
end $preflight$;

-- This is a transient, owner-only write capability, not new accepted authority.
-- No client-writable setting or client-supplied actor can mint it. Rows are removed
-- before successful return; rollback removes them together with an unsuccessful close.
create table public.carez_closeout_write_contexts(
 company_id uuid not null,
 request_id uuid not null,
 actor_id uuid not null,
 project_id uuid not null,
 backend_pid integer not null,
 transaction_id bigint not null,
 expected_project jsonb not null check(jsonb_typeof(expected_project)='object'),
 expected_closeout jsonb not null check(jsonb_typeof(expected_closeout)='object'),
 primary key(company_id,request_id),
 foreign key(company_id,request_id) references public.financial_command_requests(company_id,request_id) on delete cascade
);
alter table public.carez_closeout_write_contexts enable row level security;
revoke all on public.carez_closeout_write_contexts from public,anon,authenticated;

create function public.carez_closeout_matches_write(p_relation text,p_row jsonb)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select exists(
  select 1 from public.carez_closeout_write_contexts c
  join public.financial_command_requests r on r.company_id=c.company_id and r.request_id=c.request_id
  where c.backend_pid=pg_backend_pid() and c.transaction_id=txid_current()
   and c.actor_id=auth.uid() and r.actor_id=c.actor_id
   and r.command in ('project_closeout_complete','project_closeout_reopen') and r.result is null
   and r.payload->>'actor_id'=c.actor_id::text
   and r.payload->'values'->>'project_id'=c.project_id::text
   and p_relation in ('projects','project_closeouts')
   and p_row @> case p_relation when 'projects' then c.expected_project else c.expected_closeout end
 );
$$;
revoke all on function public.carez_closeout_matches_write(text,jsonb) from public,anon,authenticated;

create function public.carez_guard_project_completion()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_changed boolean;
begin
 if tg_op='INSERT' then
  v_changed:=new.status='completed' or new.completed_at is not null;
 else
  v_changed:=(new.status='completed' and old.status is distinct from 'completed')
   or (old.status='completed' and new.status is distinct from old.status)
   or new.completed_at is distinct from old.completed_at;
 end if;
 if v_changed and not public.carez_closeout_matches_write('projects',to_jsonb(new)) then
  raise exception 'Use governed Project Closeout; recorded completion cannot be edited directly';
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_project_completion() from public,anon,authenticated;
create trigger carez_project_completion_authority before insert or update of status,completed_at on public.projects
 for each row execute function public.carez_guard_project_completion();

create function public.carez_guard_closeout_completion()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_changed boolean;
begin
 if tg_op='INSERT' then
  v_changed:=new.status is distinct from 'open' or new.completed_at is not null or new.completed_by is not null;
 else
  -- Preserve the existing completed_by FK's ON DELETE SET NULL behavior. This
  -- exception cannot clear an attribution while its referenced profile exists.
  if new.status is not distinct from old.status and new.completed_at is not distinct from old.completed_at
   and old.completed_by is not null and new.completed_by is null
   and not exists(select 1 from public.profiles where id=old.completed_by) then return new;end if;
  v_changed:=new.status is distinct from old.status or new.completed_at is distinct from old.completed_at
   or new.completed_by is distinct from old.completed_by;
 end if;
 if v_changed and not public.carez_closeout_matches_write('project_closeouts',to_jsonb(new)) then
  raise exception 'Use governed Project Closeout; recorded completion cannot be edited directly';
 end if;
 return new;
end $$;
revoke all on function public.carez_guard_closeout_completion() from public,anon,authenticated;
create trigger carez_closeout_completion_authority before insert or update of status,completed_at,completed_by on public.project_closeouts
 for each row execute function public.carez_guard_closeout_completion();

-- Exact current HTML contract: a checked checkbox submits "on"; omitted/null
-- means unchecked. Do not accept arbitrary truthy values or manufacture new fields.
create function public.carez_closeout_checkbox(p_values jsonb,p_key text)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if p_values->p_key is null or p_values->p_key='null'::jsonb then return false;end if;
 if jsonb_typeof(p_values->p_key)='string' and p_values->>p_key='on' then return true;end if;
 raise exception 'Unsupported closeout checkbox value: %',p_key;
end $$;
revoke all on function public.carez_closeout_checkbox(jsonb,text) from public,anon,authenticated;


create table public.project_closeout_events(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 project_id uuid not null,request_id uuid not null,event_type text not null check(event_type in ('complete','reopen')),
 actor_id uuid not null,recorded_at timestamptz not null default clock_timestamp(),reason text,
 before_project jsonb not null,before_closeout jsonb,after_project jsonb not null,after_closeout jsonb not null,decision_basis jsonb not null,
 unique(company_id,request_id),foreign key(company_id,project_id) references public.projects(company_id,id),
 foreign key(company_id,request_id) references public.financial_command_requests(company_id,request_id),
 check(event_type<>'reopen' or nullif(btrim(reason),'') is not null));
alter table public.project_closeout_events enable row level security;
create policy closeout_event_read on public.project_closeout_events for select to authenticated using(company_id=public.get_my_company_id() and public.get_my_role() in ('owner','office'));
revoke all on public.project_closeout_events from public,anon,authenticated;
grant select on public.project_closeout_events to authenticated;

create function public.carez_project_closeout_command_v1(p_request_id uuid,p_command text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
 v_actor uuid:=auth.uid();v_company uuid;v_request jsonb;v_result jsonb;v_project_id uuid;v_key text;
 v_project public.projects%rowtype;v_closeout public.project_closeouts%rowtype;
 v_billing record;v_now timestamptz;v_notes text;v_before_project jsonb;v_before_closeout jsonb;v_billing_basis jsonb;
begin
 if v_actor is null then raise exception 'Owner or office authority required';end if;
 select company_id into v_company from public.profiles where id=v_actor and role in ('owner','office');
 if v_company is null then raise exception 'Owner or office authority required';end if;
 if p_command is null or p_command not in ('ensure','save_checklist','complete','reopen') then raise exception 'Unknown closeout command';end if;
 if p_values is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Closeout values required';end if;
 for v_key in select k from jsonb_object_keys(p_values) k loop
  if v_key<>'project_id' and not(p_command in ('save_checklist','complete') and v_key='expected_updated_at') and not(p_command='reopen' and v_key in ('expected_project_updated_at','reopen_reason')) and (p_command<>'save_checklist' or v_key not in
   ('punch_complete','timecards_complete','purchase_orders_closed','vendor_bills_complete','change_orders_complete',
    'customer_billed_complete','customer_paid_complete','documents_complete','warranty_sent','closeout_notes')) then
   raise exception 'Unsupported closeout field: %',v_key;
  end if;
 end loop;
 if jsonb_typeof(p_values->'project_id') is distinct from 'string' then raise exception 'Project identity required';end if;
 v_project_id:=nullif(btrim(p_values->>'project_id'),'')::uuid;
 if v_project_id is null then raise exception 'Project identity required';end if;
 -- Normalize the sole UUID field for the exact private write capability below;
 -- the actor remains a server fact. Other payload values retain exact retry meaning.
 p_values:=jsonb_set(p_values,'{project_id}',to_jsonb(v_project_id::text));
 v_request:=public.carez_financial_request_begin(p_request_id,'project_closeout_'||p_command,
  jsonb_build_object('actor_id',v_actor,'values',p_values));
 if (v_request->>'replay')::boolean then return v_request->'result';end if;
 if (v_request->>'company_id')::uuid is distinct from v_company then raise exception 'Closeout company context changed';end if;
 select * into v_project from public.projects where company_id=v_company and id=v_project_id for update;
 if not found then raise exception 'Project unavailable in this company';end if;
 select * into v_closeout from public.project_closeouts where company_id=v_company and project_id=v_project_id for update;


 v_before_project:=to_jsonb(v_project);v_before_closeout:=case when v_closeout.id is null then null else to_jsonb(v_closeout) end;
 if p_command in ('save_checklist','complete') and v_closeout.id is not null and
  (nullif(p_values->>'expected_updated_at','') is null or (p_values->>'expected_updated_at')::timestamptz is distinct from v_closeout.updated_at) then
  raise exception 'Closeout checklist changed. Reload before saving';end if;
 if p_command='reopen' then
  if public.get_my_role() is distinct from 'owner' then raise exception 'Only an owner can reopen a completed job';end if;
  if v_project.status is distinct from 'completed' then raise exception 'Only a completed job can be reopened';end if;
  if nullif(p_values->>'expected_project_updated_at','') is null or (p_values->>'expected_project_updated_at')::timestamptz is distinct from v_project.updated_at then raise exception 'Project changed. Reload before reopening';end if;
  v_notes:=nullif(btrim(p_values->>'reopen_reason'),'');if v_notes is null then raise exception 'A reopen reason is required';end if;
  if v_closeout.id is null then
   insert into public.project_closeouts(company_id,project_id) values(v_company,v_project_id) returning * into v_closeout;
  end if;
  v_now:=clock_timestamp();
  insert into public.carez_closeout_write_contexts(company_id,request_id,actor_id,project_id,backend_pid,transaction_id,expected_project,expected_closeout)
   values(v_company,p_request_id,v_actor,v_project_id,pg_backend_pid(),txid_current(),
    jsonb_build_object('id',v_project_id,'company_id',v_company,'status','active','completed_at',null),
    jsonb_build_object('id',v_closeout.id,'company_id',v_company,'project_id',v_project_id,'status','open','completed_at',null,'completed_by',null));
  update public.project_closeouts set status='open',completed_at=null,completed_by=null,punch_complete=false,timecards_complete=false,
   purchase_orders_closed=false,vendor_bills_complete=false,change_orders_complete=false,customer_billed_complete=false,customer_paid_complete=false,documents_complete=false,warranty_sent=false,updated_at=v_now
   where company_id=v_company and id=v_closeout.id returning * into v_closeout;
  update public.projects set status='active',completed_at=null,updated_at=v_now where company_id=v_company and id=v_project_id returning * into v_project;
  if not found then raise exception 'Project reopening was not confirmed';end if;
  delete from public.carez_closeout_write_contexts where company_id=v_company and request_id=p_request_id;
 elsif p_command='ensure' then
  if v_closeout.id is null then
   if v_project.status='completed' then raise exception 'Historical completed project has no closeout checklist; review its recorded completion';end if;
   insert into public.project_closeouts(company_id,project_id) values(v_company,v_project_id)
    on conflict(company_id,project_id) do nothing;
   select * into v_closeout from public.project_closeouts where company_id=v_company and project_id=v_project_id for update;
   if not found then raise exception 'Closeout checklist was not confirmed';end if;
  end if;
 elsif p_command='save_checklist' then
  if v_project.status='completed' or (v_closeout.id is not null and v_closeout.status is distinct from 'open') then
   raise exception 'Recorded completed closeout cannot be edited through the open checklist';end if;
  if p_values->'closeout_notes' is not null and p_values->'closeout_notes'<>'null'::jsonb
   and jsonb_typeof(p_values->'closeout_notes') is distinct from 'string' then raise exception 'Closeout note must be text';end if;
  v_notes:=nullif(btrim(p_values->>'closeout_notes'),'');
  insert into public.project_closeouts(company_id,project_id,punch_complete,timecards_complete,purchase_orders_closed,
   vendor_bills_complete,change_orders_complete,customer_billed_complete,customer_paid_complete,documents_complete,warranty_sent,closeout_notes)
  values(v_company,v_project_id,public.carez_closeout_checkbox(p_values,'punch_complete'),public.carez_closeout_checkbox(p_values,'timecards_complete'),
   public.carez_closeout_checkbox(p_values,'purchase_orders_closed'),public.carez_closeout_checkbox(p_values,'vendor_bills_complete'),
   public.carez_closeout_checkbox(p_values,'change_orders_complete'),public.carez_closeout_checkbox(p_values,'customer_billed_complete'),
   public.carez_closeout_checkbox(p_values,'customer_paid_complete'),public.carez_closeout_checkbox(p_values,'documents_complete'),
   public.carez_closeout_checkbox(p_values,'warranty_sent'),v_notes)
  on conflict(company_id,project_id) do update set punch_complete=excluded.punch_complete,timecards_complete=excluded.timecards_complete,
   purchase_orders_closed=excluded.purchase_orders_closed,vendor_bills_complete=excluded.vendor_bills_complete,
   change_orders_complete=excluded.change_orders_complete,customer_billed_complete=excluded.customer_billed_complete,
   customer_paid_complete=excluded.customer_paid_complete,documents_complete=excluded.documents_complete,
   warranty_sent=excluded.warranty_sent,closeout_notes=excluded.closeout_notes,updated_at=clock_timestamp()
  returning * into v_closeout;
 else
  if v_closeout.id is null then raise exception 'Start the closeout checklist first';end if;
  if v_project.status='completed' or v_closeout.status is distinct from 'open' then
   raise exception 'Recorded completion requires review; this command cannot reopen or restamp it';end if;
  if not (v_closeout.punch_complete and v_closeout.timecards_complete and v_closeout.purchase_orders_closed
   and v_closeout.vendor_bills_complete and v_closeout.change_orders_complete and v_closeout.customer_billed_complete
   and v_closeout.customer_paid_complete and v_closeout.documents_complete) then
   raise exception 'Finish every required closeout checkbox first';end if;
  -- Preserve the current inclusion/state rules. Existing warranty_sent is optional.
  -- Company-first writer integration prevents new phantoms; target locks below
  -- make current rows stable. Locking counts alone would not prevent new inserts.
  perform id from public.purchase_orders where company_id=v_company and project_id=v_project_id order by id for update;
  perform id from public.vendor_bills where company_id=v_company and project_id=v_project_id order by id for update;
  perform id from public.change_orders where company_id=v_company and project_id=v_project_id order by id for update;
  perform id from public.employee_shift_sessions where company_id=v_company and project_id=v_project_id order by id for update;
  if exists(select 1 from public.purchase_orders where company_id=v_company and project_id=v_project_id and status in ('draft','issued'))
   or exists(select 1 from public.vendor_bills where company_id=v_company and project_id=v_project_id and status='draft')
   or exists(select 1 from public.change_orders where company_id=v_company and project_id=v_project_id and status in ('draft','submitted'))
   or exists(select 1 from public.employee_shift_sessions where company_id=v_company and project_id=v_project_id and status in ('active','open','submitted')) then
   raise exception 'PourTrace still sees open field or purchasing records on this job';end if;
  begin
   select payment_basis_status,outstanding_ar,unbilled_contract into strict v_billing from public.project_billing_summary
    where company_id=v_company and project_id=v_project_id;
  exception
   when no_data_found then raise exception 'Project billing readiness unavailable: required summary row is missing';
   when too_many_rows then raise exception 'Project billing readiness unavailable: summary identity is not unique';
  end;
  if v_billing.payment_basis_status is distinct from 'known' or v_billing.outstanding_ar is null or v_billing.unbilled_contract is null
   or v_billing.outstanding_ar::text in ('NaN','Infinity','-Infinity') or v_billing.unbilled_contract::text in ('NaN','Infinity','-Infinity') then
   raise exception 'Project billing readiness unavailable: balances need authoritative review';end if;
  if v_billing.outstanding_ar>0 or v_billing.unbilled_contract>0 then
   raise exception 'The customer still has money to be billed or collected';end if;
  v_billing_basis:=to_jsonb(v_billing);
  v_now:=clock_timestamp();
  insert into public.carez_closeout_write_contexts(company_id,request_id,actor_id,project_id,backend_pid,transaction_id,expected_project,expected_closeout)
  values(v_company,p_request_id,v_actor,v_project_id,pg_backend_pid(),txid_current(),
   jsonb_build_object('id',v_project_id,'company_id',v_company,'status','completed','completed_at',v_now),
   jsonb_build_object('id',v_closeout.id,'company_id',v_company,'project_id',v_project_id,'status','completed','completed_at',v_now,'completed_by',v_actor));
  update public.project_closeouts set status='completed',completed_at=v_now,completed_by=v_actor,updated_at=v_now
   where company_id=v_company and id=v_closeout.id and status='open' returning * into v_closeout;
  if not found then raise exception 'Closeout completion was not confirmed';end if;
  update public.projects set status='completed',completed_at=v_now,updated_at=v_now
   where company_id=v_company and id=v_project_id and status is distinct from 'completed' returning * into v_project;
  if not found then raise exception 'Project completion was not confirmed';end if;
  delete from public.carez_closeout_write_contexts where company_id=v_company and request_id=p_request_id;
 end if;
 if p_command in ('complete','reopen') then
  insert into public.project_closeout_events(company_id,project_id,request_id,event_type,actor_id,reason,before_project,before_closeout,after_project,after_closeout,decision_basis)
   values(v_company,v_project_id,p_request_id,p_command,v_actor,case when p_command='reopen' then v_notes end,v_before_project,v_before_closeout,to_jsonb(v_project),to_jsonb(v_closeout),case when p_command='complete' then jsonb_build_object('authority','project_closeout_v1','billing',v_billing_basis,'open_operational_records',0) else jsonb_build_object('authority','owner_reopen_v1','reason',v_notes) end);
 end if;
 v_result:=jsonb_build_object('ok',true,'id',v_closeout.id,'project_id',v_project_id,'status',v_closeout.status,
  'completed_at',v_closeout.completed_at,'completed_by',v_closeout.completed_by);
 return public.carez_financial_request_finish(p_request_id,v_result);
end $$;
revoke all on function public.carez_project_closeout_command_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.carez_project_closeout_command_v1(uuid,text,jsonb) to authenticated;

-- Existing owner/office SELECT RLS remains authoritative. Neither raw IUD nor
-- inherited production TRUNCATE privileges can replace the governed commands.
revoke all on public.project_closeouts from public,anon,authenticated;
grant select on public.project_closeouts to authenticated;

-- No existing row, formula, agreement, Award, baseline, hold, timestamp or ledger
-- is backfilled. A forward rollback should retain receipts/completed history and
-- correct the functions, rather than restore raw writes or rewrite recorded facts.

-- Same company-before-target ordering as the closeout command.
create or replace function public.carez_create_change_order(
  p_project_id uuid,p_title text,p_change_type text,p_requested_date date default current_date,
  p_description text default null,p_reason text default null,p_requested_by text default null,
  p_overhead_snapshot_id uuid default null,p_overhead_rate_snapshot numeric default 0,p_reversal_of_change_order_id uuid default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid; v_id uuid; v_number integer; v_project public.projects%rowtype; v_estimate public.estimates%rowtype; v_original public.change_orders%rowtype;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  perform 1 from public.companies where id=v_company for update;
  if not found then raise exception 'Company unavailable';end if;
  select * into v_project from public.projects where id=p_project_id and company_id=v_company for update;
  if not found then raise exception 'Project not found.'; end if;
  select * into v_estimate from public.estimates where id=v_project.source_estimate_id and company_id=v_company;
  if not found then raise exception 'Award source Estimate not found.'; end if;
  if p_reversal_of_change_order_id is not null then
    select * into v_original from public.change_orders where id=p_reversal_of_change_order_id and company_id=v_company
      and project_id=p_project_id and status='approved' and reversal_of_change_order_id is null for share;
    if not found or not exists(select 1 from public.approved_commercial_deltas d where d.company_id=v_company and d.change_order_id=v_original.id) then raise exception 'Only an unreversed approved Change Order from this Project can be reversed.'; end if;
    if exists(select 1 from public.change_orders where company_id=v_company and reversal_of_change_order_id=v_original.id) then raise exception 'This approved Change Order already has a reversal.'; end if;
    if (v_original.change_type='additive' and p_change_type<>'deductive') or (v_original.change_type='deductive' and p_change_type<>'additive') or (v_original.change_type='no_cost' and p_change_type<>'no_cost') then
      raise exception 'Reversal Change Order type must counter the original approved change.';
    end if;
  end if;
  insert into public.change_order_number_sequences(company_id,project_id,last_number) values(v_company,p_project_id,1)
  on conflict(company_id,project_id) do update set last_number=public.change_order_number_sequences.last_number+1
  returning last_number into v_number;
  insert into public.change_orders(company_id,project_id,co_number,title,description,reason,requested_by,requested_date,change_type,
    target_margin_percent,bo_rate_percent,payment_processing_rate_percent,overhead_snapshot_id,overhead_rate_snapshot,created_by,reversal_of_change_order_id)
  values(v_company,p_project_id,'CO-'||lpad(v_number::text,3,'0'),btrim(p_title),nullif(btrim(p_description),''),nullif(btrim(p_reason),''),
    nullif(btrim(p_requested_by),''),coalesce(p_requested_date,current_date),p_change_type,coalesce(v_estimate.target_margin_percent,30),
    coalesce(v_estimate.bo_rate_percent,0.471),coalesce(v_estimate.payment_processing_rate_percent,0),p_overhead_snapshot_id,
    greatest(coalesce(p_overhead_rate_snapshot,0),0),auth.uid(),p_reversal_of_change_order_id) returning id into v_id;
  return v_id;
end
$$;
create or replace function public.carez_transition_change_order(
  p_change_order_id uuid,p_transition text,p_note text default null,
  p_authorization_kind text default null,p_authorization_reference text default null,
  p_external_authorized_by text default null,p_external_authorized_at timestamptz default null,
  p_authorization_note text default null,p_authorization_document_reference text default null,
  p_sell_delta numeric default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid; v_co public.change_orders%rowtype; v_to text; v_sell numeric; v_original_sell numeric;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  perform 1 from public.companies where id=v_company for update;
  if not found then raise exception 'Company unavailable';end if;
  select * into v_co from public.change_orders where id=p_change_order_id and company_id=v_company for update;
  if not found then raise exception 'Change Order not found.'; end if;
  v_to:=case p_transition when 'submit' then 'submitted' when 'return_to_draft' then 'draft' when 'reject' then 'rejected' when 'void' then 'void' else null end;
  if v_to is null or not ((v_co.status='draft' and v_to in ('submitted','void')) or (v_co.status='submitted' and v_to in ('draft','rejected','void'))) then
    raise exception 'Invalid Change Order transition.';
  end if;
  if v_to='submitted' then
    if not exists(select 1 from public.change_order_items i where i.company_id=v_company and i.change_order_id=v_co.id) then raise exception 'Add at least one item before submission.'; end if;
    v_sell:=p_sell_delta;
    if v_sell is null then select recommended_sell_price into v_sell from public.change_order_financial_summary where change_order_id=v_co.id; end if;
    if v_sell is null then raise exception 'Selected Sell delta is required.'; end if;
    if (v_co.change_type='additive' and v_sell<0) or (v_co.change_type='deductive' and v_sell>0) or (v_co.change_type='no_cost' and v_sell<>0) then raise exception 'Sell delta sign does not match Change Order type.'; end if;
    if v_co.reversal_of_change_order_id is not null then
      select d.sell_delta into v_original_sell from public.approved_commercial_deltas d
        where d.company_id=v_company and d.change_order_id=v_co.reversal_of_change_order_id;
      if not found or v_sell<>-v_original_sell then raise exception 'Reversal Change Order Sell must exactly offset the original approved Sell delta.'; end if;
    end if;
    if p_authorization_kind in ('external_customer','external_gc') then
      if nullif(btrim(p_authorization_reference),'') is null or nullif(btrim(p_external_authorized_by),'') is null or p_external_authorized_at is null then raise exception 'External authorization evidence is incomplete.'; end if;
    elsif p_authorization_kind='internal_no_cost' then
      if v_co.change_type<>'no_cost' or v_sell<>0 or nullif(btrim(p_authorization_note),'') is null then raise exception 'Internal no-cost basis requires documented zero-Sell internal exposure.'; end if;
    else raise exception 'Select documented external authorization or the permitted internal no-cost basis.'; end if;
    update public.change_orders set status='submitted',submitted_at=now(),proposed_sell_price=v_sell,
      authorization_kind=p_authorization_kind,authorization_reference=nullif(btrim(p_authorization_reference),''),
      external_authorized_by=nullif(btrim(p_external_authorized_by),''),external_authorized_at=p_external_authorized_at,
      authorization_note=nullif(btrim(p_authorization_note),''),authorization_document_reference=nullif(btrim(p_authorization_document_reference),''),updated_at=now()
    where id=v_co.id and company_id=v_company;
  else
    update public.change_orders set status=v_to,updated_at=now(),
      rejected_at=case when v_to='rejected' then now() else rejected_at end,
      voided_at=case when v_to='void' then now() else voided_at end
    where id=v_co.id and company_id=v_company;
  end if;
  insert into public.change_order_events(company_id,project_id,change_order_id,from_status,to_status,actor_id,note,evidence)
  values(v_company,v_co.project_id,v_co.id,v_co.status,v_to,auth.uid(),nullif(btrim(p_note),''),
    case when v_to='submitted' then jsonb_build_object('authorization_kind',p_authorization_kind,'authorization_reference',p_authorization_reference,
      'external_authorized_by',p_external_authorized_by,'external_authorized_at',p_external_authorized_at,
      'authorization_note',p_authorization_note,'authorization_document_reference',p_authorization_document_reference) else jsonb_build_object('transition',p_transition) end);
  return jsonb_build_object('change_order_id',v_co.id,'status',v_to);
end
$$;
create or replace function public.carez_update_change_order(p_change_order_id uuid,p_values jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid; v_status text; v_change_type text; v_sell numeric;
begin
  v_company:=public.carez_commercial_actor_company();
  if auth.uid() is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office authority required.'; end if;
  perform 1 from public.companies where id=v_company for update;
  if not found then raise exception 'Company unavailable';end if;
  select status,change_type into v_status,v_change_type from public.change_orders
    where id=p_change_order_id and company_id=v_company for update;
  if not found or v_status<>'draft' then raise exception 'Only draft Change Orders can be edited.'; end if;
  v_sell:=nullif(p_values->>'proposed_sell_price','')::numeric;
  if v_sell is not null and ((v_change_type='additive' and v_sell<0) or (v_change_type='deductive' and v_sell>0) or (v_change_type='no_cost' and v_sell<>0)) then
    raise exception 'Sell delta sign does not match Change Order type.';
  end if;
  update public.change_orders set target_margin_percent=coalesce((p_values->>'target_margin_percent')::numeric,target_margin_percent),
    payment_processing_rate_percent=coalesce((p_values->>'payment_processing_rate_percent')::numeric,payment_processing_rate_percent),
    proposed_sell_price=v_sell,
    field_work_status=coalesce(nullif(p_values->>'field_work_status',''),field_work_status),updated_at=now()
  where id=p_change_order_id and company_id=v_company;
end
$$;
create or replace function public.carez_approve_change_order_v2(p_change_order_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid; v_actor uuid; v_co public.change_orders%rowtype; v_baseline public.commercial_baselines%rowtype; v_original_sell numeric(14,2);
  v_cost numeric(14,2); v_exposure numeric(14,2); v_fingerprint text; v_facts jsonb; v_delta uuid; v_item record; v_existing public.approved_commercial_deltas%rowtype;
begin
  v_actor:=auth.uid(); v_company:=public.carez_commercial_actor_company();
  if v_actor is null or v_company is null or not public.carez_can_manage_commercial_changes() then raise exception 'Owner or office approval authority required.'; end if;
  perform 1 from public.companies where id=v_company for update;
  if not found then raise exception 'Company unavailable';end if;
  select * into v_co from public.change_orders where id=p_change_order_id and company_id=v_company for update;
  if not found then raise exception 'Change Order not found.'; end if;
  select * into v_existing from public.approved_commercial_deltas where company_id=v_company and change_order_id=v_co.id;
  if found then
    if v_co.status='approved' then return jsonb_build_object('change_order_id',v_co.id,'delta_id',v_existing.id,'already_approved',true,'source_fingerprint',v_existing.source_fingerprint); end if;
    raise exception 'Conflicting approval evidence exists for this Change Order.';
  end if;
  if v_co.status='approved' then raise exception 'Approved legacy Change Order has no canonical commercial delta. Reconcile its recorded authority before changing it.';end if;
  if v_co.status<>'submitted' then raise exception 'Only submitted Change Orders can be approved.'; end if;
  select * into v_baseline from public.commercial_baselines where company_id=v_company and project_id=v_co.project_id and baseline_kind='original_award' for share;
  if not found then raise exception 'Original Commercial Baseline not found.'; end if;
  if not exists(select 1 from public.change_order_items where company_id=v_company and change_order_id=v_co.id) then raise exception 'Submitted Change Order has no items.'; end if;
  select coalesce(sum(direct_cost),0)::numeric(14,2) into v_cost from public.change_order_items where company_id=v_company and change_order_id=v_co.id;
  select actual_company_exposure into v_exposure from public.change_order_financial_summary where change_order_id=v_co.id;
  if v_co.authorization_kind in ('external_customer','external_gc') then
    if nullif(btrim(v_co.authorization_reference),'') is null or nullif(btrim(v_co.external_authorized_by),'') is null or v_co.external_authorized_at is null then raise exception 'External authorization evidence is incomplete.'; end if;
  elsif v_co.authorization_kind='internal_no_cost' then
    if v_co.change_type<>'no_cost' or coalesce(v_co.proposed_sell_price,0)<>0 or v_co.field_work_status not in ('directed','in_progress','complete')
      or coalesce(v_co.authorization_note,'')='' or coalesce(v_exposure,0)<=0 then raise exception 'Internal no-cost authority requires documented positive internal exposure and zero Sell.'; end if;
  else raise exception 'Documented external authorization is required.'; end if;
  if v_co.change_type='additive' and coalesce(v_co.proposed_sell_price,0)<0 then raise exception 'Additive Sell delta must be non-negative.'; end if;
  if v_co.change_type='deductive' and coalesce(v_co.proposed_sell_price,0)>0 then raise exception 'Deductive Sell delta must be non-positive.'; end if;
  if v_co.change_type='no_cost' and coalesce(v_co.proposed_sell_price,0)<>0 then raise exception 'No-cost Sell delta must be zero.'; end if;
  if v_co.reversal_of_change_order_id is not null then
    select d.sell_delta into v_original_sell from public.approved_commercial_deltas d
      where d.company_id=v_company and d.change_order_id=v_co.reversal_of_change_order_id;
    if not found or coalesce(v_co.proposed_sell_price,0)<>-v_original_sell then raise exception 'Reversal Change Order Sell must exactly offset the original approved Sell delta.'; end if;
  end if;
  select jsonb_build_object('change_order',to_jsonb(v_co)-array['approved_by','approved_at','updated_at'],
    'items',coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order,i.id),'[]'::jsonb)) into v_facts
  from public.change_order_items i where i.company_id=v_company and i.change_order_id=v_co.id;
  v_fingerprint:=encode(extensions.digest(convert_to(v_facts::text,'UTF8'),'sha256'),'hex');
  insert into public.approved_commercial_deltas(company_id,project_id,change_order_id,commercial_baseline_id,approved_by,approved_at,
    authorization_kind,authorization_reference,external_authorized_by,external_authorized_at,authorization_note,authorization_document_reference,
    source_fingerprint,total_direct_cost_delta,sell_delta,source_facts)
  values(v_company,v_co.project_id,v_co.id,v_baseline.id,v_actor,now(),v_co.authorization_kind,v_co.authorization_reference,
    v_co.external_authorized_by,v_co.external_authorized_at,v_co.authorization_note,v_co.authorization_document_reference,
    v_fingerprint,v_cost,coalesce(v_co.proposed_sell_price,0),v_facts) returning id into v_delta;
  for v_item in select * from public.change_order_items where company_id=v_company and change_order_id=v_co.id order by sort_order,id loop
    insert into public.approved_commercial_delta_items(company_id,commercial_delta_id,commercial_baseline_id,source_change_order_item_id,affected_commercial_baseline_item_id,quantity,unit,direct_cost_delta,source_facts)
    values(v_company,v_delta,v_baseline.id,v_item.id,v_item.affected_commercial_baseline_item_id,v_item.quantity,v_item.unit,v_item.direct_cost,to_jsonb(v_item));
  end loop;
  update public.change_orders set status='approved',approved_by=v_actor,approved_at=now(),updated_at=now() where id=v_co.id and company_id=v_company;
  insert into public.change_order_events(company_id,project_id,change_order_id,from_status,to_status,actor_id,evidence)
  values(v_company,v_co.project_id,v_co.id,'submitted','approved',v_actor,jsonb_build_object('commercial_delta_id',v_delta,'source_fingerprint',v_fingerprint));
  return jsonb_build_object('change_order_id',v_co.id,'delta_id',v_delta,'already_approved',false,'source_fingerprint',v_fingerprint);
end
$$;

set local search_path=pg_catalog,public;

do $preflight$
begin
 if to_regprocedure('public.carez_lock_operation_source_company()') is null
 or to_regprocedure('public.carez_project_closeout_command_v1(uuid,text,jsonb)') is null then
  raise exception 'Closeout/tenant mutex prerequisites are missing';end if;
end $preflight$;

-- Includes inserts when no blocker row exists yet. Do not replace these with
-- SELECT ... FOR UPDATE over only existing blockers; that permits phantoms.
create trigger carez_closeout_po_company_lock before insert or update or delete on public.purchase_orders
 for each statement execute function public.carez_lock_operation_source_company();
create trigger carez_closeout_bill_company_lock before insert or update or delete on public.vendor_bills
 for each statement execute function public.carez_lock_operation_source_company();
create trigger carez_closeout_co_company_lock before insert or update or delete on public.change_orders
 for each statement execute function public.carez_lock_operation_source_company();
create trigger carez_closeout_shift_company_lock before insert or update or delete on public.employee_shift_sessions
 for each statement execute function public.carez_lock_operation_source_company();

create function public.carez_guard_new_closeout_obligation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_states text[];v_new_blocking boolean;v_old_blocking boolean:=false;v_actor_company uuid;v_status text;
begin
 v_states:=case tg_table_name
  when 'purchase_orders' then array['draft','issued']
  when 'vendor_bills' then array['draft']
  when 'change_orders' then array['draft','submitted']
  when 'employee_shift_sessions' then array['active','open','submitted']
  else null end;
 if v_states is null then raise exception 'Unexpected closeout obligation relation';end if;
 v_new_blocking:=new.status=any(v_states);
 if tg_op='UPDATE' then
  v_old_blocking:=old.status=any(v_states);
  -- Existing unresolved historical records can still progress toward cleanup:
  -- e.g. active->submitted clock-out. This does not create a newly blocking row.
  if new.company_id is not distinct from old.company_id and new.project_id is not distinct from old.project_id
   and (not v_new_blocking or v_old_blocking) then return new;end if;
 end if;
 if tg_op='UPDATE' and not v_new_blocking then return new;end if;
 -- Employee login roles keep their legitimate clock access. Do not call the
 -- owner/office-only financial request helper from this generic write guard.
 if auth.uid() is not null then
  select company_id into v_actor_company from public.profiles where id=auth.uid();
  if v_actor_company is distinct from new.company_id then raise exception 'Obligation company context unavailable';end if;
 end if;
 perform 1 from public.companies where id=new.company_id for update;
 if not found then raise exception 'Obligation company unavailable';end if;
 select status into v_status from public.projects where company_id=new.company_id and id=new.project_id for key share;
 if not found then raise exception 'Obligation project unavailable in this company';end if;
 if v_status='completed' then raise exception 'An owner must reopen the completed project before adding new work or commitments';end if;
 return new;
end $$;
revoke all on function public.carez_guard_new_closeout_obligation() from public,anon,authenticated;
create trigger carez_closeout_new_po before insert or update on public.purchase_orders
 for each row execute function public.carez_guard_new_closeout_obligation();
create trigger carez_closeout_new_bill before insert or update on public.vendor_bills
 for each row execute function public.carez_guard_new_closeout_obligation();
create trigger carez_closeout_new_co before insert or update on public.change_orders
 for each row execute function public.carez_guard_new_closeout_obligation();
create trigger carez_closeout_new_shift before insert or update on public.employee_shift_sessions
 for each row execute function public.carez_guard_new_closeout_obligation();

-- Existing records, status vocabularies, employee permissions, grants on other
-- relations, terminal records, posting/cost formulas and explicit holds survive.
-- No invoices, payments, Awards or baselines are manufactured or reclassified.

-- Completed-job new-work boundary; existing source corrections remain available.
-- This block never reopens a Project, changes a completion, clears a hold, creates
-- accepted authority, or infers an exemption from a historical date/free-text reason.
set local search_path=pg_catalog,public,extensions;

do $prerequisite$
begin
 if to_regprocedure('public.carez_lock_operation_source_company()') is null
 or to_regprocedure('public.carez_sync_ticket_work_packages_for_pour(uuid)') is null
 or to_regprocedure('public.carez_record_manual_labor_v1(uuid,uuid,uuid,jsonb)') is null
 or to_regprocedure('public.carez_schedule_command_v1(uuid,text,jsonb)') is null then
  raise exception 'Existing governed work entrypoints are required before lifecycle integration';
 end if;
end $prerequisite$;

-- No caller-supplied GUC/token can create this capability. Only the owner executing
-- a fixed private source projection can insert it; all client/service raw access
-- is revoked. Both existing row types are pinned, including NULL historical facts.
create table public.carez_work_projection_contexts_v1(
 id uuid primary key,
 company_id uuid not null references public.companies(id),
 actor_id uuid,
 backend_pid integer not null,
 transaction_id bigint not null,
 relation_name text not null check(relation_name in ('work_packages','work_package_operations')),
 row_id uuid not null,
 expected_values jsonb not null check(jsonb_typeof(expected_values)='object')
);
alter table public.carez_work_projection_contexts_v1 enable row level security;
revoke all on public.carez_work_projection_contexts_v1 from public,anon,authenticated,service_role;

create function public.carez_work_projection_matches_v1(p_relation text,p_row jsonb)
returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select exists(select 1 from public.carez_work_projection_contexts_v1 c
  where c.backend_pid=pg_backend_pid() and c.transaction_id=txid_current()
   and c.actor_id is not distinct from auth.uid() and c.relation_name=p_relation
   and c.company_id::text=p_row->>'company_id' and c.row_id::text=p_row->>'id'
   and c.expected_values=(p_row-'updated_at'))
$$;
revoke all on function public.carez_work_projection_matches_v1(text,jsonb) from public,anon,authenticated,service_role;

-- Private assertion; existing caller/RLS still owns role permissions. The explicit
-- actor-company check prevents raw BEFORE ROW validation from locking another
-- tenant before its eventual RLS rejection. Held jobs retain existing planning.
create function public.carez_assert_project_open_for_new_work_v1(p_company uuid,p_project uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_status text;
begin
 if auth.uid() is not null and not exists(select 1 from public.profiles where id=auth.uid() and company_id=p_company) then
  raise exception 'Work company context unavailable';end if;
 perform 1 from public.companies where id=p_company for update;
 if not found then raise exception 'Work company unavailable';end if;
 select status into v_status from public.projects where company_id=p_company and id=p_project for update;
 if not found then raise exception 'Work project unavailable in this company';end if;
 if v_status='completed' then raise exception 'Owner must explicitly reopen this project before new work';end if;
end $$;
revoke all on function public.carez_assert_project_open_for_new_work_v1(uuid,uuid) from public,anon,authenticated,service_role;

-- EARLY outer participation. The existing helper resolves signed-in actor company
-- from profiles directly, so legitimate employee RPCs do not require office role.
-- Existing employee start/complete RPCs and governed procurement already hold it.
create trigger carez_work_package_company_first_v1 before insert or update or delete on public.work_packages
 for each statement execute function public.carez_lock_operation_source_company();
create trigger carez_work_operation_company_first_v1 before insert or update or delete on public.work_package_operations
 for each statement execute function public.carez_lock_operation_source_company();
create trigger carez_ticket_document_company_first_v1 before insert or update or delete on public.company_documents
 for each statement execute function public.carez_lock_operation_source_company();
create trigger carez_inspection_company_first_v1 before insert or update or delete on public.project_inspections
 for each statement execute function public.carez_lock_operation_source_company();

-- Existing operation_source_company_lock may be retained: its narrower second
-- acquisition is reentrant. Do not remove the matching AFTER source sync trigger.
create function public.carez_guard_completed_project_work_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_project uuid;v_old_project uuid;v_needs_open boolean:=false;
begin
 if tg_op='UPDATE' and public.carez_work_projection_matches_v1(tg_table_name,to_jsonb(new)) then return new;end if;
 if tg_table_name='work_packages' then
  v_project:=new.project_id;
  if tg_op='INSERT' then v_needs_open:=true;
  else
   if (new.company_id,new.project_id) is distinct from (old.company_id,old.project_id) then
    perform public.carez_assert_project_open_for_new_work_v1(old.company_id,old.project_id);
   end if;
   v_needs_open:=(new.company_id,new.project_id) is distinct from (old.company_id,old.project_id)
    or (new.planned_start_date,new.planned_end_date) is distinct from (old.planned_start_date,old.planned_end_date)
    or (new.status is distinct from old.status and new.status in ('planned','active'))
    or (old.status in ('completed','cancelled') and new.status='on_hold');
  end if;
 elsif tg_table_name='work_package_operations' then
  select project_id into v_project from public.work_packages where company_id=new.company_id and id=new.work_package_id;
  if not found then raise exception 'Operation package unavailable in this company';end if;
  if tg_op='INSERT' then v_needs_open:=true;
  else
   if (new.company_id,new.work_package_id) is distinct from (old.company_id,old.work_package_id) then
    select project_id into v_old_project from public.work_packages where company_id=old.company_id and id=old.work_package_id;
    if not found then raise exception 'Existing operation package unavailable in this company';end if;
    perform public.carez_assert_project_open_for_new_work_v1(old.company_id,v_old_project);
   end if;
   -- A new/reassigned task, package, planned quantity or unit changes prospective
   -- work scope. Actual/source/review/sync corrections stay separate and allowed.
   v_needs_open:=(new.company_id,new.work_package_id,new.production_task_id,new.planned_quantity,new.unit)
     is distinct from (old.company_id,old.work_package_id,old.production_task_id,old.planned_quantity,old.unit)
    or (new.status is distinct from old.status and new.status in ('planned','in_progress'))
    or (old.status in ('completed','cancelled') and new.status='on_hold');
  end if;
 else raise exception 'Unexpected work lifecycle relation';end if;
 if v_needs_open then perform public.carez_assert_project_open_for_new_work_v1(new.company_id,v_project);end if;
 return new;
end $$;
revoke all on function public.carez_guard_completed_project_work_v1() from public,anon,authenticated,service_role;
create trigger carez_completed_project_package_v1 before insert or update on public.work_packages
 for each row execute function public.carez_guard_completed_project_work_v1();
create trigger carez_completed_project_operation_v1 before insert or update on public.work_package_operations
 for each row execute function public.carez_guard_completed_project_work_v1();

-- Inspections are the owning source for derived inspection schedule rows. Guard
-- NEW inspection sources/reassignment/prospective scheduling here; existing results
-- and failure-driven confirmed->planned invalidation remain legal. No blanket
-- schedule INSERT trigger may reject that existing-source projection's UPSERT.
create function public.carez_guard_completed_project_inspection_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_needs_open boolean;
begin
 if tg_op='INSERT' then v_needs_open:=true;
 else
  if (new.company_id,new.project_id) is distinct from (old.company_id,old.project_id) then
   perform public.carez_assert_project_open_for_new_work_v1(old.company_id,old.project_id);
  end if;
  v_needs_open:=(new.company_id,new.project_id,new.required_for_operation_id)
    is distinct from (old.company_id,old.project_id,old.required_for_operation_id)
   or (new.scheduled_date,new.scheduled_time) is distinct from (old.scheduled_date,old.scheduled_time)
   or (new.status='scheduled' and new.status is distinct from old.status)
   or (old.status in ('passed','waived','cancelled') and new.status='required');
 end if;
 if v_needs_open then perform public.carez_assert_project_open_for_new_work_v1(new.company_id,new.project_id);end if;
 return new;
end $$;
revoke all on function public.carez_guard_completed_project_inspection_v1() from public,anon,authenticated,service_role;
create trigger carez_completed_project_inspection_v1 before insert or update on public.project_inspections
 for each row execute function public.carez_guard_completed_project_inspection_v1();

-- Typed, idempotent projection refresh for the existing owner completion action's
-- final package roll-up. This does not reopen a Project/operation or accept a
-- caller-supplied status. Parent retargets only its final package UPDATE at
-- app/production/work-packages/actions.ts:44 to this RPC; source action unchanged here.
create function public.carez_refresh_existing_package_rollup_v1(p_work_package_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v_company uuid;v_package public.work_packages%rowtype;v_expected public.work_packages%rowtype;v_context uuid;
begin
 select company_id into v_company from public.profiles where id=auth.uid() and role in ('owner','office');
 if v_company is null then raise exception 'Owner or office authority required';end if;
 perform 1 from public.companies where id=v_company for update;
 if not found then raise exception 'Company unavailable';end if;
 select * into v_package from public.work_packages where company_id=v_company and id=p_work_package_id for update;
 if not found then raise exception 'Existing work package unavailable';end if;
 v_expected:=v_package;
 -- Identical to the owner action's count of planned/in_progress/on_hold children.
 v_expected.status:=case when exists(select 1 from public.work_package_operations
  where company_id=v_company and work_package_id=v_package.id and status in ('planned','in_progress','on_hold')) then 'active' else 'completed' end;
 if v_expected.status is not distinct from v_package.status then
  return jsonb_build_object('ok',true,'id',v_package.id,'status',v_package.status);end if;
 v_context:=gen_random_uuid();
 insert into public.carez_work_projection_contexts_v1(id,company_id,actor_id,backend_pid,transaction_id,relation_name,row_id,expected_values)
 values(v_context,v_company,auth.uid(),pg_backend_pid(),txid_current(),'work_packages',v_package.id,to_jsonb(v_expected)-'updated_at');
 update public.work_packages set status=v_expected.status,updated_at=clock_timestamp()
  where company_id=v_company and id=v_package.id;
 if not found then raise exception 'Existing package roll-up was not confirmed';end if;
 delete from public.carez_work_projection_contexts_v1 where id=v_context;
 return jsonb_build_object('ok',true,'id',v_package.id,'status',v_expected.status);
end $$;
revoke all on function public.carez_refresh_existing_package_rollup_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.carez_refresh_existing_package_rollup_v1(uuid) to authenticated;

-- Exact existing source function copies follow. Existing function identities,
-- return types, execution modes and ACLs are retained by CREATE OR REPLACE.
-- No GRANT/REVOKE is applied to these existing functions in this proposal.

-- SOURCE COPY: 20261016129500:11-107; only company prelock and private typed projection context added.
CREATE OR REPLACE FUNCTION public.carez_sync_ticket_work_packages_for_pour(p_pour_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog,public,pg_temp
AS $function$
declare
  v record;
  v_company uuid;
  o record;
  v_review text;
  v_reason text;
  v_changed boolean;
  v_ready boolean;
  v_expected_operation public.work_package_operations%rowtype;
  v_expected_package public.work_packages%rowtype;
  v_context uuid;
begin
  if p_pour_plan_id is null then return; end if;
  -- Company before Pour, operation, or package. The outer authenticated document
  -- statement also participates before its own row lock.
  select company_id into v_company from public.pour_plans where id=p_pour_plan_id;
  if not found then return; end if;
  perform 1 from public.companies where id=v_company for update;
  if not found then raise exception 'Ticket source company unavailable';end if;
  perform 1 from public.pour_plans where id=p_pour_plan_id and company_id=v_company for update;
  if not found then return;end if;

  select d.*,pp.status as current_pour_status,pp.project_id as current_project_id
  into v
  from public.pour_delivery_actual_summary d
  join public.pour_plans pp on pp.id=d.pour_plan_id and pp.company_id=d.company_id
  where d.pour_plan_id=p_pour_plan_id and d.company_id=v_company;
  if not found then return; end if;

  for o in
    select wo.*,wp.project_id as package_project_id
    from public.work_package_operations wo
    join public.work_packages wp on wp.id=wo.work_package_id and wp.company_id=wo.company_id
    where wo.pour_plan_id=p_pour_plan_id and wo.company_id=v_company
      and wo.measurement_method='ticket'
      and wo.status<>'cancelled'
  loop
    v_changed := o.actual_quantity is distinct from coalesce(v.delivered_cy,0);
    v_review := 'auto';
    v_reason := null;

    if o.package_project_id is distinct from v.current_project_id then
      v_review := 'needs_review';
      v_reason := 'Linked pour belongs to a different project.';
    elsif upper(coalesce(o.unit,''))<>'CY' then
      v_review := 'needs_review';
      v_reason := 'Concrete ticket production requires a CY work-package operation.';
    elsif coalesce(v.delivered_cy,0)<=0 then
      if v.current_pour_status='completed' then
        v_review := 'needs_review';
        v_reason := 'Pour is closed but no concrete delivery quantity is recorded.';
      end if;
    elsif coalesce(v.tickets_missing_photo,0)>0 then
      v_review := 'needs_review';
      v_reason := v.tickets_missing_photo||' concrete delivery ticket photo(s) still need matched evidence.';
    elsif abs(coalesce(v.delivered_cy,0)-o.planned_quantity)>greatest(1::numeric,o.planned_quantity*0.10) then
      if not v_changed and o.quantity_review_status in ('verified','excluded','approved') then
        v_review := o.quantity_review_status;
        v_reason := o.quantity_review_reason;
      else
        v_review := 'needs_review';
        v_reason := 'Ticket actual differs from planned quantity by more than 10% or 1 CY.';
      end if;
    elsif not v_changed and o.quantity_review_status in ('verified','excluded','approved') then
      v_review := o.quantity_review_status;
      v_reason := o.quantity_review_reason;
    end if;

    v_ready := o.package_project_id=v.current_project_id
      and upper(coalesce(o.unit,''))='CY'
      and v.current_pour_status='completed'
      and coalesce(v.delivered_cy,0)>0
      and coalesce(v.tickets_missing_photo,0)=0;

    -- Exact typed expected existing row; only updated_at is ignored by matching.
    select * into v_expected_operation from jsonb_populate_record(null::public.work_package_operations,to_jsonb(o)-'package_project_id');
    v_expected_operation.actual_quantity:=coalesce(v.delivered_cy,0);
    v_expected_operation.actual_quantity_source:='delivery_tickets';
    v_expected_operation.quantity_review_status:=v_review;
    v_expected_operation.quantity_review_reason:=v_reason;
    v_expected_operation.quantity_synced_at:=now();
    if v_ready then
      v_expected_operation.status:='completed';
      v_expected_operation.completed_at:=coalesce(v_expected_operation.completed_at,now());
      v_expected_operation.completed_by_profile_id:=null;
      v_expected_operation.completed_by_crew_member_id:=null;
      v_expected_operation.completion_source:='delivery_tickets';
    end if;
    v_context:=gen_random_uuid();
    insert into public.carez_work_projection_contexts_v1(id,company_id,actor_id,backend_pid,transaction_id,relation_name,row_id,expected_values)
    values(v_context,v_company,auth.uid(),pg_backend_pid(),txid_current(),'work_package_operations',o.id,to_jsonb(v_expected_operation)-'updated_at');

    update public.work_package_operations
    set actual_quantity=coalesce(v.delivered_cy,0),
        actual_quantity_source='delivery_tickets',
        quantity_review_status=v_review,
        quantity_review_reason=v_reason,
        quantity_synced_at=now(),
        status=case when v_ready then 'completed' else status end,
        completed_at=case when v_ready then coalesce(completed_at,now()) else completed_at end,
        completed_by_profile_id=case when v_ready then null else completed_by_profile_id end,
        completed_by_crew_member_id=case when v_ready then null else completed_by_crew_member_id end,
        completion_source=case when v_ready then 'delivery_tickets' else completion_source end,
        updated_at=now()
    where id=o.id and company_id=o.company_id;
    delete from public.carez_work_projection_contexts_v1 where id=v_context;

    if v_ready then
      select * into v_expected_package from public.work_packages p
      where p.id=o.work_package_id and p.company_id=o.company_id and p.status<>'cancelled' for update;
      if found then
        v_expected_package.status:=case when exists(
          select 1 from public.work_package_operations q
          where q.work_package_id=v_expected_package.id and q.status not in ('completed','cancelled')
        ) then 'active' else 'completed' end;
        v_context:=gen_random_uuid();
        insert into public.carez_work_projection_contexts_v1(id,company_id,actor_id,backend_pid,transaction_id,relation_name,row_id,expected_values)
        values(v_context,v_company,auth.uid(),pg_backend_pid(),txid_current(),'work_packages',v_expected_package.id,to_jsonb(v_expected_package)-'updated_at');
        update public.work_packages p
        set status=case when exists(
          select 1 from public.work_package_operations q
          where q.work_package_id=p.id and q.status not in ('completed','cancelled')
        ) then 'active' else 'completed' end,
        updated_at=now()
        where p.id=o.work_package_id and p.company_id=o.company_id and p.status<>'cancelled';
        delete from public.carez_work_projection_contexts_v1 where id=v_context;
      end if;
    end if;
  end loop;
end$function$
;

-- SOURCE COPY: 20261016127500:26-51; only new-source assertion after confirmed replay added.
create or replace function public.carez_record_manual_labor_v1(p_request_id uuid,p_project_id uuid,p_crew_member_id uuid,p_values jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare request jsonb;company uuid;c public.crew_members%rowtype;s public.employee_shift_sessions%rowtype;entry_id uuid;v_timecard_id uuid;
 regular numeric;overtime numeric;pay_date date;reference text:=nullif(btrim(p_values->>'source_reference'),'');reason text:=nullif(btrim(p_values->>'reason'),'');task text:=nullif(btrim(p_values->>'task'),'');risk text:=nullif(btrim(p_values->>'risk_class_code'),'');
begin
 request:=public.carez_financial_request_begin(p_request_id,'record_manual_labor',jsonb_build_object('project_id',p_project_id,'crew_member_id',p_crew_member_id,'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 -- Confirmed replay has already returned. No date/reference exemption is inferred
 -- for creation of a NEW reviewed manual source.
 perform public.carez_assert_project_open_for_new_work_v1(company,p_project_id);
 select * into c from public.crew_members where company_id=company and id=p_crew_member_id for update;
 if c.id is null or not exists(select 1 from public.projects where company_id=company and id=p_project_id) then raise exception 'Recorded worker and job must belong to this company';end if;
 if reference is null or length(reference)>200 or reason is null or length(reason)>1000 or task is null or length(task)>200 or p_values->>'confirmed' is distinct from 'true' then raise exception 'Source line reference, work type, reason and explicit office confirmation are required';end if;
 if exists(select 1 from public.manual_labor_entries where company_id=company and crew_member_id=c.id and source_reference=reference) then raise exception 'This worker source reference was already recorded; reopen the existing manual entry';end if;
 s.company_id:=company;s.project_id:=p_project_id;s.crew_member_id:=c.id;s.worker_type_snapshot:=p_values->>'worker_type';
 if s.worker_type_snapshot is null or s.worker_type_snapshot not in ('owner','employee','subcontractor') then raise exception 'Explicit historical financial classification is required';end if;
 s.base_hourly_rate_snapshot:=public.carez_required_labor_number(p_values,'base_hourly_rate',99999999.99,2);
 s.work_date:=nullif(p_values->>'work_date','')::date;s.work_timezone_snapshot:=nullif(btrim(p_values->>'work_timezone'),'');
 if s.work_date is null or not isfinite(s.work_date) or not public.carez_valid_operating_timezone(s.work_timezone_snapshot) then raise exception 'Finite reviewed job work date and IANA time zone are required';end if;
 s.labor_basis_source:='manual_review';s.work_date_policy_version:='manual_reviewed_job_date_v1';
 regular:=public.carez_required_labor_number(p_values,'regular_hours',999999.99,2);overtime:=public.carez_required_labor_number(p_values,'overtime_hours',999999.99,2);
 pay_date:=nullif(p_values->>'payroll_tax_date','')::date;
 if risk is not null and length(risk)>30 then raise exception 'Invalid recorded work class';end if;
 insert into public.manual_labor_entries(company_id,request_id,project_id,crew_member_id,source_reference,reviewed_values,reviewed_by)
 values(company,p_request_id,p_project_id,c.id,reference,p_values,auth.uid()) returning id into entry_id;
 v_timecard_id:=public.carez_post_reviewed_labor(company,c,s,regular,overtime,risk,pay_date,reason,entry_id,task);
 update public.manual_labor_entries set timecard_id=v_timecard_id where id=entry_id and company_id=company;
 -- Work type is part of the immutable posting itself, never an after-save edit.
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',entry_id,'timecard_id',v_timecard_id));
end $$;

-- SOURCE COPY: 20261016129000:47-154; only prospective reschedule/start/reopen assertions added.
create or replace function public.carez_schedule_command_v1(p_request_id uuid,p_command text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
<<command>>
declare request jsonb; company uuid; result jsonb; item public.work_schedule_items%rowtype;
 project_id uuid; task_id uuid; operation_id uuid; pour_id uuid; item_id uuid; inspection_id uuid;
 schedule_date date; start_at time; finish_at time; item_type text; title text; notes text; crew_needed integer; crew_ids uuid[]; worker uuid;
 operation record; readiness record; target_status text; expected bigint; invalid_key text;
begin
 if p_command is null or p_command not in ('create','status','reschedule','delete') then raise exception 'Unknown schedule command'; end if;
 request:=public.carez_financial_request_begin(p_request_id,'schedule_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_payload));
 if (request->>'replay')::boolean then return request->'result'; end if;
 company:=(request->>'company_id')::uuid;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Schedule values required'; end if;
 select k into invalid_key from jsonb_object_keys(p_payload) k where k not in ('id','expected_revision','status','project_id','schedule_date','item_type','title','production_task_id','work_package_operation_id','pour_plan_id','start_time','end_time','crew_needed','crew_member_ids','notes') limit 1;
 if invalid_key is not null then raise exception 'Unsupported schedule field: %',invalid_key; end if;
 if p_command='create' then
  if p_payload ? 'status' and p_payload->>'status' is distinct from 'planned' then raise exception 'New schedule work must be planned; confirm after readiness review'; end if;
  project_id:=nullif(p_payload->>'project_id','')::uuid;
  item_type:=coalesce(nullif(p_payload->>'item_type',''),'work');
  if item_type not in ('work','pour','inspection','delivery','equipment','meeting','other') then raise exception 'Choose a valid work type'; end if;
  perform 1 from public.projects where id=project_id and company_id=company and status in ('active','on_hold') for update;
  if not found then raise exception 'Active or held job unavailable'; end if;
  task_id:=nullif(p_payload->>'production_task_id','')::uuid;
  operation_id:=nullif(p_payload->>'work_package_operation_id','')::uuid;
  pour_id:=nullif(p_payload->>'pour_plan_id','')::uuid;
  title:=nullif(btrim(p_payload->>'title'),''); notes:=nullif(btrim(p_payload->>'notes'),'');
  if operation_id is not null then
   select o.*,w.project_id,w.name package_name,t.name task_name into operation from public.work_package_operations o
    join public.work_packages w on w.id=o.work_package_id and w.company_id=o.company_id
    join public.production_tasks t on t.id=o.production_task_id and t.company_id=o.company_id
    where o.id=operation_id and o.company_id=company and w.project_id=command.project_id and o.status not in ('completed','cancelled') for update of o;
   if not found then raise exception 'Open operation does not belong to this job'; end if;
   task_id:=operation.production_task_id; title:=coalesce(title,nullif(operation.field_label,''),operation.task_name||' — '||operation.package_name);
   if operation.pour_plan_id is not null then
    if pour_id is not null and pour_id<>operation.pour_plan_id then raise exception 'Selected pour conflicts with the operation source pour'; end if;
    pour_id:=operation.pour_plan_id;
   end if;
  end if;
  if title is null or length(title)>500 or length(coalesce(notes,''))>10000 then raise exception 'Work description required (maximum 500 characters); notes maximum 10000'; end if;
  if item_type='work' and task_id is null then raise exception 'Choose a work operation or production task'; end if;
  if task_id is not null and not exists(select 1 from public.production_tasks where company_id=company and id=task_id and active) then raise exception 'Active production task unavailable'; end if;
  if pour_id is not null and not exists(select 1 from public.pour_plans where company_id=company and pour_plans.project_id=command.project_id and id=pour_id and status<>'cancelled') then raise exception 'Pour plan does not belong to this job'; end if;
  schedule_date:=nullif(p_payload->>'schedule_date','')::date;
  if schedule_date is null or not isfinite(schedule_date) then raise exception 'Choose a finite schedule date'; end if;
  start_at:=nullif(p_payload->>'start_time','')::time; finish_at:=nullif(p_payload->>'end_time','')::time;
  -- End earlier than start is retained as an overnight wall-time plan, not elapsed attendance.
  if start_at=time '24:00' or finish_at=time '24:00' then raise exception 'Choose a time between 00:00 and 23:59'; end if;
  if coalesce(p_payload->>'crew_needed','') !~ '^\d{1,6}$' then raise exception 'Workers needed must be a nonnegative whole number'; end if;
  crew_needed:=(p_payload->>'crew_needed')::integer;
  if jsonb_typeof(p_payload->'crew_member_ids') is distinct from 'array' then raise exception 'Crew selection required'; end if;
  select coalesce(array_agg(distinct v::uuid order by v::uuid),'{}'::uuid[]) into crew_ids from jsonb_array_elements_text(p_payload->'crew_member_ids') v;
  foreach worker in array crew_ids loop
   perform 1 from public.crew_members where company_id=company and id=worker and active for update;
   if not found then raise exception 'An assigned crew member is unavailable'; end if;
  end loop;
  if item_type='inspection' and operation_id is not null then
   insert into public.project_inspections(company_id,project_id,required_for_operation_id,title,inspection_type,status,requested_at,scheduled_date,scheduled_time,result_notes,created_by,updated_by)
    values(company,project_id,operation_id,title,'general','scheduled',clock_timestamp(),schedule_date,start_at,notes,auth.uid(),auth.uid()) returning id into inspection_id;
   select * into item from public.work_schedule_items where company_id=company and work_schedule_items.inspection_id=command.inspection_id;
   if not found then raise exception 'Inspection schedule was not confirmed'; end if;
   update public.work_schedule_items set crew_needed=command.crew_needed,end_time=finish_at,pour_plan_id=pour_id,notes=command.notes,updated_at=clock_timestamp() where id=item.id returning * into item;
  else
   insert into public.work_schedule_items(company_id,project_id,schedule_date,item_type,title,production_task_id,work_package_operation_id,pour_plan_id,start_time,end_time,crew_needed,status,notes,created_by)
    values(company,project_id,schedule_date,item_type,title,task_id,operation_id,pour_id,start_at,finish_at,crew_needed,'planned',notes,auth.uid()) returning * into item;
  end if;
  insert into public.work_schedule_assignments(company_id,schedule_item_id,crew_member_id) select company,item.id,unnest(crew_ids);
 elsif p_command in ('status','reschedule','delete') then
  item_id:=nullif(p_payload->>'id','')::uuid;
  if coalesce(p_payload->>'expected_revision','') !~ '^\d+$' then raise exception 'Reload the schedule before taking action'; end if;
  expected:=(p_payload->>'expected_revision')::bigint;
  select * into item from public.work_schedule_items where id=item_id and company_id=company for update;
  if not found then raise exception 'Schedule item unavailable'; end if;
  if item.command_revision<>expected then raise exception 'Schedule changed; reload before trying again'; end if;
  if p_command='delete' then
   if item.inspection_id is not null then
    perform 1 from public.project_inspections where id=item.inspection_id and company_id=company and status in ('required','scheduled') and completed_at is null for update;
    if not found then raise exception 'Inspection result history must be managed in Work Readiness'; end if;
    delete from public.project_inspections where id=item.inspection_id and company_id=company;
   else delete from public.work_schedule_items where id=item.id and company_id=company; end if;
   result:=jsonb_build_object('ok',true,'id',item.id,'deleted',true);
  elsif p_command='reschedule' then
   perform public.carez_assert_project_open_for_new_work_v1(company,item.project_id);
   if item.inspection_id is not null or item.pour_plan_id is not null then raise exception 'Move linked inspections or pours from their source record'; end if;
   if item.status in ('in_progress','completed','cancelled') then raise exception 'Active or completed work cannot be moved from this timeline'; end if;
   schedule_date:=nullif(p_payload->>'schedule_date','')::date;
   if schedule_date is null or not isfinite(schedule_date) then raise exception 'Choose a finite schedule date'; end if;
   update public.work_schedule_items set schedule_date=command.schedule_date,updated_at=clock_timestamp() where id=item.id and company_id=company returning * into item;
  else
   target_status:=p_payload->>'status';
   if target_status is null or target_status not in ('planned','confirmed','in_progress','completed','cancelled') then raise exception 'Invalid schedule status'; end if;
   if item.inspection_id is not null then raise exception 'Inspection status is controlled from Work Readiness'; end if;
   -- Preserve existing cancellation/completion/deconfirmation. Newly confirming,
   -- starting, or reopening terminal work requires the owner's Project reopen.
   if (target_status in ('confirmed','in_progress') and target_status is distinct from item.status)
     or (target_status='planned' and item.status in ('completed','cancelled')) then
     perform public.carez_assert_project_open_for_new_work_v1(company,item.project_id);
   end if;
   if item.item_type in ('work','pour') and target_status in ('confirmed','in_progress') then
    perform 1 from public.projects where id=item.project_id and company_id=company for update;
    select * into readiness from public.project_job_readiness_summary where company_id=company and project_job_readiness_summary.project_id=item.project_id;
    if not found then raise exception 'Job readiness unavailable; planning remains available'; end if;
    if readiness.job_ready is distinct from true then raise exception 'Job setup hold: %',coalesce(readiness.readiness_reason,'Review Job Setup'); end if;
    if item.work_package_operation_id is not null then
     select o.* into operation from public.work_package_operations o join public.work_packages w on w.company_id=o.company_id and w.id=o.work_package_id where o.id=item.work_package_operation_id and o.company_id=company and w.project_id=item.project_id for update of o;
     if not found or operation.status in ('completed','cancelled') or operation.production_task_id is distinct from item.production_task_id or (operation.pour_plan_id is not null and operation.pour_plan_id is distinct from item.pour_plan_id) then raise exception 'Operation source changed; recreate the plan from the current operation'; end if;
     select * into readiness from public.work_package_start_readiness where company_id=company and work_package_start_readiness.operation_id=item.work_package_operation_id;
     if not found then raise exception 'Operation readiness unavailable; planning remains available'; end if;
     if readiness.ready_to_start_all is distinct from true then raise exception 'Work is on hold: %',coalesce(readiness.start_next_action,'Review Work Readiness'); end if;
    end if;
   end if;
   update public.work_schedule_items set status=target_status,updated_at=clock_timestamp() where id=item.id and company_id=company returning * into item;
  end if;
 end if;
 result:=coalesce(result,jsonb_build_object('ok',true,'id',item.id,'revision',item.command_revision,'status',item.status));
 return public.carez_financial_request_finish(p_request_id,result);
end $$;




-- Source-owned 134500 planning command; only completed-job new-work assertion added.
create or replace function public.carez_pour_planning_command_v1(p_request_id uuid,p_command text,p_values jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions,pg_temp as $$
declare request jsonb;company uuid;target uuid;plan public.pour_plans%rowtype;project uuid;kind text;label text;day date;
 quantity numeric;unit_cost numeric;forecast jsonb;crew uuid;affected integer;cy numeric;contingency numeric;buffer numeric;support numeric;
begin
 if p_command is null or p_command not in ('create_plan','update_plan','add_cost','add_labor','delete_cost','close_plan') then raise exception 'Unknown pour planning command';end if;
 request:=public.carez_financial_request_begin(p_request_id,'pour_'||p_command,jsonb_build_object('actor_id',auth.uid(),'values',p_values));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Pour planning values are required';end if;
 if p_command='create_plan' then
  project:=nullif(p_values->>'project_id','')::uuid;perform public.carez_procurement_scope(company,project,p_values);
  if nullif(p_values->>'change_order_id','') is not null and not exists(select 1 from public.change_orders where company_id=company and project_id=project and id=(p_values->>'change_order_id')::uuid and status='approved') then raise exception 'Only an approved change order from this job can be linked';end if;
 else
  select * into plan from public.pour_plans where company_id=company and id=nullif(p_values->>'pour_plan_id','')::uuid for update;
  if not found then raise exception 'Pour plan unavailable';end if;target:=plan.id;project:=plan.project_id;
  if nullif(p_values->>'expected_updated_at','') is null or (p_values->>'expected_updated_at')::timestamptz is distinct from plan.updated_at then raise exception 'Pour plan changed. Reload its current settings before saving';end if;
  if plan.status in ('completed','cancelled') then raise exception 'Completed or cancelled pour plans are locked';end if;
 end if;
 if p_command in ('create_plan','update_plan','add_cost','add_labor') then perform public.carez_assert_project_open_for_new_work_v1(company,project);end if;
 if p_command in ('create_plan','update_plan') then
  label:=nullif(btrim(p_values->>'name'),'');if label is null then raise exception 'Pour name is required';end if;
  day:=public.carez_procurement_date(p_values->>'scheduled_date',false);
  cy:=public.carez_procurement_number(p_values,'expected_concrete_yards',2);contingency:=public.carez_procurement_number(p_values,'contingency_percent',2);
  buffer:=public.carez_procurement_number(p_values,'minimum_cash_buffer',2);support:=public.carez_procurement_number(p_values,'company_cash_support',2);
  if contingency>100 then raise exception 'Contingency cannot exceed100percent';end if;
  if p_command='create_plan' then
   insert into public.pour_plans(company_id,project_id,budget_section_id,change_order_id,name,scheduled_date,expected_concrete_yards,contingency_percent,minimum_cash_buffer,company_cash_support,notes,created_by)
   values(company,project,nullif(p_values->>'budget_section_id','')::uuid,nullif(p_values->>'change_order_id','')::uuid,label,day,cy,contingency,buffer,support,nullif(btrim(p_values->>'notes'),''),auth.uid()) returning id into target;
  else
   if day is distinct from plan.scheduled_date and exists(select 1 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id and item_type='labor') then raise exception 'Review and remove saved labor forecasts before changing the pour date, then add the forecasts for the new date';end if;
   update public.pour_plans set name=label,scheduled_date=day,expected_concrete_yards=cy,contingency_percent=contingency,minimum_cash_buffer=buffer,company_cash_support=support,notes=nullif(btrim(p_values->>'notes'),''),status='planning',updated_at=clock_timestamp() where company_id=company and id=plan.id;
  end if;
 elsif p_command='add_cost' then
  kind:=coalesce(nullif(p_values->>'item_type',''),'other');if kind='labor' then raise exception 'Use verified loaded labor for worker forecasts';end if;
  label:=nullif(btrim(p_values->>'description'),'');if label is null then raise exception 'Description is required';end if;
  quantity:=public.carez_procurement_number(p_values,'quantity',4);unit_cost:=public.carez_procurement_number(p_values,'unit_cost',4);
  if nullif(p_values->>'cost_code_id','') is not null and not exists(select 1 from public.cost_codes where company_id=company and id=(p_values->>'cost_code_id')::uuid) then raise exception 'Cost code unavailable in this company';end if;
  if nullif(p_values->>'catalog_item_id','') is not null and not exists(select 1 from public.cost_catalog_items where company_id=company and id=(p_values->>'catalog_item_id')::uuid) then raise exception 'Catalog item unavailable in this company';end if;
  insert into public.pour_cost_items(company_id,pour_plan_id,item_type,cost_code_id,catalog_item_id,description,quantity,unit,unit_cost,expected_cost,committed,vendor_name,notes,sort_order)
  values(company,plan.id,kind,nullif(p_values->>'cost_code_id','')::uuid,nullif(p_values->>'catalog_item_id','')::uuid,label,quantity,coalesce(nullif(p_values->>'unit',''),'LS'),unit_cost,floor(quantity*unit_cost*100+0.5)/100,coalesce(p_values->>'committed'='on',false),nullif(btrim(p_values->>'vendor_name'),''),nullif(btrim(p_values->>'notes'),''),
   (select coalesce(max(sort_order),0)+10 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id)) returning id into target;
 elsif p_command='add_labor' then
  crew:=nullif(p_values->>'crew_member_id','')::uuid;forecast:=public.carez_pour_labor_forecast(company,plan,crew,p_values);
  insert into public.pour_cost_items(company_id,pour_plan_id,item_type,crew_member_id,description,quantity,unit,unit_cost,expected_cost,regular_hours,overtime_hours,risk_class_code,base_hourly_rate_snapshot,labor_cost_method,committed,notes,forecast_basis,sort_order)
  values(company,plan.id,'labor',crew,coalesce(nullif(btrim(p_values->>'description'),''),forecast->>'worker_name'||' — Pour labor'),(forecast->>'hours')::numeric,'HR',(forecast->>'rate')::numeric,(forecast->>'expected_cost')::numeric,(forecast->>'regular_hours')::numeric,(forecast->>'overtime_hours')::numeric,forecast->>'risk_class_code',(forecast->>'rate')::numeric,forecast->>'method',coalesce(p_values->>'committed'='on',false),nullif(btrim(p_values->>'notes'),''),forecast->'basis',
   (select coalesce(max(sort_order),0)+10 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id)) returning id into target;
 elsif p_command='delete_cost' then
  target:=nullif(p_values->>'item_id','')::uuid;
  if exists(select 1 from public.pour_cost_items where company_id=company and pour_plan_id=plan.id and forecast_basis->'source_forecast_ids' ? target::text) then raise exception 'Remove later dependent forecasts for this worker first, then review the earlier forecast';end if;
  delete from public.pour_cost_items where company_id=company and pour_plan_id=plan.id and id=target;
  get diagnostics affected=row_count;if affected<>1 then raise exception 'Planned cost unavailable in this pour';end if;
 elsif p_command='close_plan' then
  kind:=p_values->>'status';if kind is null or kind not in ('completed','cancelled') then raise exception 'Invalid closing state';end if;
  update public.pour_plans set status=kind,updated_at=clock_timestamp() where company_id=company and id=plan.id;
 end if;
 if p_command in ('add_cost','add_labor','delete_cost') then update public.pour_plans set status='planning',updated_at=clock_timestamp() where company_id=company and id=plan.id;end if;
 if target is null then raise exception 'Pour planning save was not confirmed';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',target));
end $$;

notify pgrst,'reload schema';
