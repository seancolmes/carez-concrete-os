-- One recorded decision, one persisted status, the exact reviewed financial
-- basis. Missing evidence is not an overridable numeric zero.
set local search_path=pg_catalog,public,extensions;
alter table public.pour_authorization_snapshots add column if not exists financial_basis_fingerprint text;
alter table public.pour_authorization_snapshots add column if not exists financial_basis jsonb;
create function public.carez_pour_funding_fingerprint(p_company uuid,p_pour uuid) returns text language sql stable security invoker set search_path=pg_catalog,public,extensions as $$
 select encode(extensions.digest(convert_to((to_jsonb(s)-'status')::text,'UTF8'),'sha256'),'hex') from public.pour_plan_financial_summary s where s.company_id=p_company and s.pour_plan_id=p_pour
$$;
revoke all on function public.carez_pour_funding_fingerprint(uuid,uuid) from public,anon;grant execute on function public.carez_pour_funding_fingerprint(uuid,uuid) to authenticated;

create function public.carez_record_pour_authorization_v1(p_request_id uuid,p_pour_plan_id uuid,p_fingerprint text,p_decision text,p_reason text,p_notes text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_request jsonb;v_company uuid;v_summary record;v_id uuid;v_override boolean;
begin
 v_request:=public.carez_financial_request_begin(p_request_id,'record_pour_authorization',jsonb_build_object('actor_id',auth.uid(),'pour_id',p_pour_plan_id,'fingerprint',p_fingerprint,'decision',p_decision,'reason',p_reason,'notes',p_notes));
 if (v_request->>'replay')::boolean then return v_request->'result';end if;v_company:=(v_request->>'company_id')::uuid;
 perform 1 from public.pour_plans where company_id=v_company and id=p_pour_plan_id for update;if not found then raise exception 'Pour unavailable';end if;
 select * into v_summary from public.pour_plan_financial_summary where company_id=v_company and pour_plan_id=p_pour_plan_id;
 if not found or v_summary.funding_basis_status is distinct from 'known' or v_summary.system_recommendation not in ('clear','hold') then raise exception 'Funding basis unavailable. Review unknown customer payments or missing financial inputs first';end if;
 if v_summary.status in ('completed','cancelled') then raise exception 'Completed or cancelled pour plans are locked';end if;
 if p_decision is null or p_decision not in ('authorized','hold') then raise exception 'Choose Authorize or Hold';end if;
 if p_fingerprint is null or p_fingerprint is distinct from public.carez_pour_funding_fingerprint(v_company,p_pour_plan_id) then raise exception 'Funding changed since this review. Reload the pour before recording a decision';end if;
 if exists(select 1 from jsonb_each(to_jsonb(v_summary)) e where e.key in ('project_funding_balance','gross_customer_cash','sales_tax_cash_reserved','processing_fees_paid','incurred_direct_cost','planned_exposure','contingency_amount','minimum_cash_buffer','company_cash_support','required_additional_cash') and (e.value='null'::jsonb or e.value#>>'{}' in ('NaN','Infinity','-Infinity'))) then raise exception 'Funding values unavailable or invalid';end if;
 v_override:=v_summary.system_recommendation='hold' and p_decision='authorized';
 if v_override and nullif(btrim(p_reason),'') is null then raise exception 'An override reason is required to authorize a pour that is not cash-cleared';end if;
 insert into public.pour_authorization_snapshots(company_id,pour_plan_id,project_funding_balance,gross_customer_cash,sales_tax_cash_reserved,processing_fees_paid,incurred_direct_cost,planned_exposure,contingency_amount,minimum_cash_buffer,company_cash_support,funding_gap,system_recommendation,decision,override_used,override_reason,notes,created_by,financial_basis_fingerprint,financial_basis,reviewed_at)
 values(v_company,p_pour_plan_id,v_summary.project_funding_balance,v_summary.gross_customer_cash,v_summary.sales_tax_cash_reserved,v_summary.processing_fees_paid,v_summary.incurred_direct_cost,v_summary.planned_exposure,v_summary.contingency_amount,v_summary.minimum_cash_buffer,v_summary.company_cash_support,v_summary.required_additional_cash,v_summary.system_recommendation,p_decision,v_override,nullif(btrim(p_reason),''),nullif(btrim(p_notes),''),auth.uid(),p_fingerprint,to_jsonb(v_summary),clock_timestamp()) returning id into v_id;
 update public.pour_plans set status=p_decision,updated_at=clock_timestamp() where company_id=v_company and id=p_pour_plan_id;
 if not found or v_id is null then raise exception 'Pour decision was not confirmed';end if;
 return public.carez_financial_request_finish(p_request_id,jsonb_build_object('ok',true,'id',v_id,'pour_plan_id',p_pour_plan_id,'decision',p_decision));
end $$;
revoke all on function public.carez_record_pour_authorization_v1(uuid,uuid,text,text,text,text) from public,anon;grant execute on function public.carez_record_pour_authorization_v1(uuid,uuid,text,text,text,text) to authenticated;
revoke insert,update,delete on public.pour_authorization_snapshots from authenticated;

create function public.carez_retain_customer_financial_history() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if auth.uid() is not null then raise exception 'Recorded customer payments and funding decisions cannot be deleted; retain their history';end if;
 return old;
end $$;
revoke all on function public.carez_retain_customer_financial_history() from public,anon,authenticated;
create trigger retained_customer_payment_history before delete on public.customer_payments for each row execute function public.carez_retain_customer_financial_history();
create trigger retained_customer_allocation_history before delete on public.payment_allocations for each row execute function public.carez_retain_customer_financial_history();
create trigger retained_pour_decision_history before delete on public.pour_authorization_snapshots for each row execute function public.carez_retain_customer_financial_history();

create function public.carez_guard_pour_decision() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from jsonb_each(to_jsonb(new)) e where e.key in ('expected_concrete_yards','contingency_percent','minimum_cash_buffer','company_cash_support') and (e.value='null'::jsonb or e.value#>>'{}' in ('NaN','Infinity','-Infinity'))) then raise exception 'Pour planning inputs must be finite recorded values';end if;
 if current_user not in ('postgres','supabase_admin','service_role') and new.status in ('authorized','hold') and (tg_op='INSERT' or new.status is distinct from old.status) then raise exception 'Use the governed pour authorization decision';end if;
 if tg_op='UPDATE' and old.status in ('authorized','hold') and (new.project_id,new.budget_section_id,new.change_order_id,new.scheduled_date,new.expected_concrete_yards,new.contingency_percent,new.minimum_cash_buffer,new.company_cash_support) is distinct from (old.project_id,old.budget_section_id,old.change_order_id,old.scheduled_date,old.expected_concrete_yards,old.contingency_percent,old.minimum_cash_buffer,old.company_cash_support) then new.status:='planning';end if;
 return new;
end $$;
revoke all on function public.carez_guard_pour_decision() from public,anon,authenticated;
create trigger governed_pour_decision before insert or update on public.pour_plans for each row execute function public.carez_guard_pour_decision();
-- Serialize all signed-in inputs to that funding decision before target locks.
create trigger pour_plan_company_lock before insert or update or delete on public.pour_plans for each statement execute function public.carez_lock_operation_source_company();
create trigger pour_cost_company_lock before insert or update or delete on public.pour_cost_items for each statement execute function public.carez_lock_operation_source_company();
create trigger project_cost_company_lock before insert or update or delete on public.project_costs for each statement execute function public.carez_lock_operation_source_company();
create trigger funding_timecard_company_lock before insert or update or delete on public.timecards for each statement execute function public.carez_lock_operation_source_company();
create trigger funding_invoice_company_lock before insert or update or delete on public.invoices for each statement execute function public.carez_lock_operation_source_company();
create trigger funding_invoice_line_company_lock before insert or update or delete on public.invoice_lines for each statement execute function public.carez_lock_operation_source_company();

create function public.carez_invalidate_pour_cost_decision() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare c uuid;p uuid;s text;begin
 if tg_op<>'DELETE' and exists(select 1 from jsonb_each(to_jsonb(new)) e where e.key in ('quantity','unit_cost','expected_cost','regular_hours','overtime_hours') and (e.value='null'::jsonb or e.value#>>'{}' in ('NaN','Infinity','-Infinity'))) then raise exception 'Pour cost inputs must be finite recorded values';end if;
 c:=case when tg_op='DELETE' then old.company_id else new.company_id end;p:=case when tg_op='DELETE' then old.pour_plan_id else new.pour_plan_id end;
 if tg_op='UPDATE' and (new.company_id,new.pour_plan_id) is distinct from (old.company_id,old.pour_plan_id) then raise exception 'Move planned costs by creating an explicit replacement';end if;
 select status into s from public.pour_plans where company_id=c and id=p for update;
 if not found then raise exception 'Pour cost parent unavailable';end if;
 if s in ('completed','cancelled') then raise exception 'Completed or cancelled pour plans are locked';end if;
 update public.pour_plans set status='planning',updated_at=clock_timestamp() where company_id=c and id=p and status in ('authorized','hold');
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.carez_invalidate_pour_cost_decision() from public,anon,authenticated;
create trigger pour_cost_decision_invalidation before insert or update or delete on public.pour_cost_items for each row execute function public.carez_invalidate_pour_cost_decision();

-- Boolean-only clearance may be read by the employee's company; financial
-- amounts remain behind their existing office policies.
create function public.carez_pour_authorization_current(p_company uuid,p_pour uuid) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare s public.pour_authorization_snapshots%rowtype;current_fingerprint text;begin
 if auth.uid() is not null and p_company is distinct from public.get_my_company_id() then return false;end if;
 if not exists(select 1 from public.pour_plans where company_id=p_company and id=p_pour and status='authorized') then return false;end if;
 select * into s from public.pour_authorization_snapshots where company_id=p_company and pour_plan_id=p_pour order by reviewed_at desc,id desc limit 1;
 if not found or s.decision<>'authorized' or s.financial_basis_fingerprint is null then return false;end if;
 current_fingerprint:=public.carez_pour_funding_fingerprint(p_company,p_pour);
 return current_fingerprint is not null and current_fingerprint=s.financial_basis_fingerprint;
end $$;
revoke all on function public.carez_pour_authorization_current(uuid,uuid) from public,anon;grant execute on function public.carez_pour_authorization_current(uuid,uuid) to authenticated;
create view public.pour_plan_review_state with(security_invoker=true) as select p.company_id,p.id pour_plan_id,public.carez_pour_funding_fingerprint(p.company_id,p.id) funding_fingerprint,public.carez_pour_authorization_current(p.company_id,p.id) authorization_current from public.pour_plans p;
revoke all on public.pour_plan_review_state from public,anon;grant select on public.pour_plan_review_state to authenticated;

-- The existing start gate already requires pour authorization. Recheck its
-- retained financial basis instead of accepting a stale status string.
do $gate$ declare definition text;begin
 definition:=pg_get_viewdef('public.carez_operation_readiness_v1'::regclass,true);
 if position('pp.status AS pour_status' in definition)=0 then raise exception 'Unknown connected pour readiness binding';end if;
 definition:=replace(definition,'pp.status AS pour_status','CASE WHEN pp.status=''authorized'' AND NOT public.carez_pour_authorization_current(pp.company_id,pp.id) THEN ''planning'' ELSE pp.status END AS pour_status');
 execute 'create or replace view public.carez_operation_readiness_v1 with(security_invoker=true) as '||definition;
end $gate$;

-- Bank receipts use the same unavailable-balance gate as manual receipts.
create or replace function public.carez_reconcile_bank_to_invoice_v2(p_request_id uuid,p_bank_transaction_id uuid,p_invoice_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare request jsonb;company uuid;result jsonb;target uuid;balance numeric;
begin
 request:=public.carez_financial_request_begin(p_request_id,'reconcile_bank_to_invoice',jsonb_build_object('p_bank_transaction_id',p_bank_transaction_id,'p_invoice_id',p_invoice_id));
 if (request->>'replay')::boolean then return request->'result';end if;company:=(request->>'company_id')::uuid;
 perform 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company for update;if not found then raise exception 'Bank transaction unavailable';end if;
 if not exists(select 1 from public.plaid_transactions where id=p_bank_transaction_id and company_id=company and cash_amount is not null and cash_amount::text not in ('NaN','Infinity','-Infinity')) then raise exception 'Bank amount unavailable or invalid';end if;
 perform 1 from public.invoices where id=p_invoice_id and company_id=company for update;if not found then raise exception 'Invoice unavailable';end if;
 select balance_due into balance from public.invoice_financial_summary where company_id=company and invoice_id=p_invoice_id;
 if not found or balance is null or balance::text in ('NaN','Infinity','-Infinity') then raise exception 'Invoice balance unavailable';end if;
 target:=public.reconcile_bank_to_invoice(p_bank_transaction_id,p_invoice_id);if target is null then raise exception 'No financial record was confirmed';end if;
 result:=jsonb_build_object('ok',true,'id',target);return public.carez_financial_request_finish(p_request_id,result);
end $$;
revoke all on function public.carez_reconcile_bank_to_invoice_v2(uuid,uuid,uuid) from public,anon;grant execute on function public.carez_reconcile_bank_to_invoice_v2(uuid,uuid,uuid) to authenticated;
