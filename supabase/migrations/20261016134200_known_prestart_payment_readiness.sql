-- Posted-only cash must also govern pre-start payment clearance. Preserve the
-- installed readiness row shape and independent agreement/tax holds. No payment,
-- waiver, invoice, historical agreement or stored amount is rewritten.
create view public.carez_prestart_payment_state_v2 with(security_invoker=true) as
with facts as (
 select m.*,
  coalesce(i.payment_basis_status='known' and i.collection_status='paid'
   and i.status not in ('draft','void') and i.balance_due is not null
   and i.balance_due::text not in ('NaN','Infinity','-Infinity') and i.balance_due<=0.01,false) paid,
  m.invoice_id is not null and (i.invoice_id is null or i.payment_basis_status is distinct from 'known'
   or i.balance_due is null or i.balance_due::text in ('NaN','Infinity','-Infinity')) unknown
 from public.project_payment_milestones m
 left join public.invoice_financial_summary i on i.company_id=m.company_id and i.invoice_id=m.invoice_id
)
select company_id,project_id,
 count(*) filter(where required_before_start and waived_at is null and not paid)::integer open_count,
 count(*) filter(where required_before_start and waived_at is null and unknown)::integer unavailable_count,
 coalesce(sum(amount) filter(where required_before_start and waived_at is null and paid),0)::numeric posted_paid_amount,
 coalesce(sum(amount) filter(where required_before_start and waived_at is not null),0)::numeric waived_amount
from facts group by company_id,project_id;

do $readiness$
declare definition text;col record;projection text:='';expr text;shape jsonb;include_waived boolean;begin
 select jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) order by attnum) into shape from pg_attribute where attrelid='public.project_job_readiness_summary'::regclass and attnum>0 and not attisdropped;
 if shape=$source$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"name","type":"text"},{"name":"address","type":"text"},{"name":"city","type":"text"},{"name":"state","type":"text"},{"name":"award_setup_applies","type":"boolean"},{"name":"agreement_number","type":"text"},{"name":"proposal_number","type":"text"},{"name":"accepted_name","type":"text"},{"name":"accepted_email","type":"text"},{"name":"accepted_at","type":"timestamp with time zone"},{"name":"agreement_captured","type":"boolean"},{"name":"billing_ready","type":"boolean"},{"name":"required_before_start_count","type":"integer"},{"name":"required_before_start_amount","type":"numeric"},{"name":"required_before_start_paid_amount","type":"numeric"},{"name":"required_before_start_open_count","type":"integer"},{"name":"job_ready","type":"boolean"},{"name":"readiness_reason","type":"text"}]$source$::jsonb then include_waived:=true;
 elsif shape=$deployed$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"source_estimate_id","type":"uuid"},{"name":"award_setup_applies","type":"boolean"},{"name":"award_record_id","type":"uuid"},{"name":"agreement_number","type":"text"},{"name":"proposal_number","type":"text"},{"name":"accepted_name","type":"text"},{"name":"accepted_at","type":"timestamp with time zone"},{"name":"original_contract_value","type":"numeric"},{"name":"agreement_captured","type":"boolean"},{"name":"billing_ready","type":"boolean"},{"name":"milestone_count","type":"integer"},{"name":"required_before_start_count","type":"integer"},{"name":"required_before_start_amount","type":"numeric"},{"name":"required_before_start_open_count","type":"integer"},{"name":"required_before_start_paid_amount","type":"numeric"},{"name":"job_ready","type":"boolean"},{"name":"readiness_reason","type":"text"}]$deployed$::jsonb then include_waived:=false;
 else raise exception 'Unrecognized Job Setup readiness row shape: %',shape;end if;
 definition:=pg_get_viewdef('public.project_job_readiness_summary'::regclass,true);
 if position('project_payment_milestones' in definition)=0 or position('project_award_records' in definition)=0 then
  raise exception 'Unrecognized installed Job Setup readiness contract';
 end if;
 execute 'create view public.carez_job_setup_before_posted_cash_v2 with(security_invoker=true) as '||definition;
 for col in select attname,format_type(atttypid,atttypmod) type from pg_attribute
  where attrelid='public.project_job_readiness_summary'::regclass and attnum>0 and not attisdropped order by attnum loop
  expr:=case col.attname
   when 'required_before_start_open_count' then 'coalesce(pay.open_count,0)'
   when 'required_before_start_paid_amount' then 'coalesce(pay.posted_paid_amount,0)'||case when include_waived then '+coalesce(pay.waived_amount,0)' else '' end
   when 'job_ready' then 'coalesce(v.job_ready,false) and coalesce(pay.open_count,0)=0 and not ext.held and (not ext.applies or coalesce(v.billing_ready,false))'
   when 'readiness_reason' then $reason$case
    when ext.held then 'External agreement owner verification is required.'
    when ext.applies and not coalesce(v.billing_ready,false) then 'Project sales-tax treatment is not complete.'
    when not coalesce(v.billing_ready,false) or (coalesce(v.award_setup_applies,true) and not coalesce(v.agreement_captured,false)) then v.readiness_reason
    when coalesce(pay.unavailable_count,0)>0 then 'Pre-start payment basis unavailable. Review the recorded customer payment status.'
    when coalesce(pay.open_count,0)>0 then format('%s required-before-start payment item(s) remain open.',pay.open_count)
    else v.readiness_reason end$reason$
   else format('v.%I',col.attname) end;
  projection:=projection||case when projection='' then '' else ',' end||format('(%s)::%s as %I',expr,col.type,col.attname);
 end loop;
 execute 'create or replace view public.project_job_readiness_summary with(security_invoker=true) as select '||projection||',coalesce(pay.unavailable_count,0)::integer required_before_start_unavailable_count
 from public.carez_job_setup_before_posted_cash_v2 v
 left join public.carez_prestart_payment_state_v2 pay on pay.company_id=v.company_id and pay.project_id=v.project_id
 cross join lateral (select exists(select 1 from public.project_external_intakes e where e.company_id=v.company_id and e.project_id=v.project_id) applies,
  exists(select 1 from public.project_external_intakes e where e.company_id=v.company_id and e.project_id=v.project_id)
  and not exists(select 1 from public.project_award_records a where a.company_id=v.company_id and a.project_id=v.project_id and a.status=''accepted'' and a.external_verification_id is not null) held) ext';
end $readiness$;
revoke all on public.carez_prestart_payment_state_v2,public.carez_job_setup_before_posted_cash_v2,public.project_job_readiness_summary from public,anon,authenticated;
grant select on public.carez_prestart_payment_state_v2,public.carez_job_setup_before_posted_cash_v2,public.project_job_readiness_summary to authenticated;
