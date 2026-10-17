-- Human decision: only posted customer payments fund work. Historical unknown
-- payment states remain unknown; no backfill, invoice rewrite, or expense inference.
set local search_path=pg_catalog,public,extensions;

-- Keep the installed invoice's exact tax/retainage rounding, status and date
-- rules. Change only its allocation source; never reprice issued invoice facts.
create view public.carez_posted_payment_allocations_v1 with(security_invoker=true) as
select a.* from public.payment_allocations a join public.customer_payments p on p.company_id=a.company_id and p.id=a.payment_id
where p.status='posted' and a.amount is not null and a.amount::text not in ('NaN','Infinity','-Infinity');
do $invoice$ declare definition text;prefix_definition text;column_row record;projection text:='';extra text;begin
 definition:=pg_get_viewdef('public.invoice_financial_summary'::regclass,true);
 if position('payment_allocations' in definition)=0 then
  if position('carez_invoice_prefix_bridge' in definition)=0 or to_regclass('public.carez_invoice_prefix_bridge') is null then raise exception 'Unknown installed invoice payment contract';end if;
  prefix_definition:=pg_get_viewdef('public.carez_invoice_prefix_bridge'::regclass,true);
  if position('payment_allocations' in prefix_definition)=0 then raise exception 'Unknown bridged invoice allocation contract';end if;
  execute 'create view public.carez_invoice_posted_prefix_v1 with(security_invoker=true) as '||replace(prefix_definition,'payment_allocations','carez_posted_payment_allocations_v1');
  revoke all on public.carez_invoice_posted_prefix_v1 from public,anon,authenticated;
  grant select on public.carez_invoice_posted_prefix_v1 to authenticated;
  definition:=replace(definition,'carez_invoice_prefix_bridge','carez_invoice_posted_prefix_v1');
 end if;
 execute 'create view public.carez_invoice_contract_v1 with(security_invoker=true) as '||replace(definition,'payment_allocations','carez_posted_payment_allocations_v1');
 for column_row in select attname from pg_attribute where attrelid='public.invoice_financial_summary'::regclass and attnum>0 and not attisdropped order by attnum loop
  projection:=projection||case when projection='' then '' else ',' end||case
   when column_row.attname in ('amount_paid','balance_due','days_overdue') then format('case when coalesce(u.unknown_payment_count,0)>0 then null else v.%I end as %I',column_row.attname,column_row.attname)
   when column_row.attname='collection_status' then 'case when coalesce(u.unknown_payment_count,0)>0 and i.status not in (''void'',''draft'') then ''unavailable'' else v.collection_status end collection_status'
   when column_row.attname='status' then 'case when coalesce(u.unknown_payment_count,0)>0 then i.status else v.status end status'
   when column_row.attname='aging_bucket' then 'case when coalesce(u.unknown_payment_count,0)>0 then ''unavailable'' else v.aging_bucket end aging_bucket'
   else format('v.%I',column_row.attname) end;
 end loop;
 -- The two known installed schemas use different tax aliases and timestamp lists.
 for column_row in select * from (values('tax_amount','coalesce((to_jsonb(v)->>''tax_amount'')::numeric,(to_jsonb(v)->>''sales_tax'')::numeric)'),('sales_tax','coalesce((to_jsonb(v)->>''sales_tax'')::numeric,(to_jsonb(v)->>''tax_amount'')::numeric)'),('sent_at','i.sent_at'),('voided_at','i.voided_at'),('created_by','i.created_by'),('created_at','i.created_at'),('updated_at','i.updated_at'))x(name,expression) loop
  if not exists(select 1 from pg_attribute where attrelid='public.invoice_financial_summary'::regclass and attname=column_row.name and attnum>0 and not attisdropped) then projection:=projection||','||column_row.expression||' as '||quote_ident(column_row.name);end if;
 end loop;
 execute 'create view public.carez_invoice_financial_v1 with(security_invoker=true) as with unknowns as (
 select a.company_id,a.invoice_id,count(*) filter(where p.id is null or p.status is null or p.status not in (''posted'',''void'') or (p.status=''posted'' and (a.amount is null or a.amount::text in (''NaN'',''Infinity'',''-Infinity''))))::integer unknown_payment_count
 from public.payment_allocations a left join public.customer_payments p on p.company_id=a.company_id and p.id=a.payment_id group by a.company_id,a.invoice_id)
 select '||projection||',i.status recorded_status,v.amount_paid posted_amount_paid,coalesce(u.unknown_payment_count,0) unknown_payment_count,case when coalesce(u.unknown_payment_count,0)>0 then ''unavailable'' else ''known'' end payment_basis_status
 from public.carez_invoice_contract_v1 v join public.invoices i on i.company_id=v.company_id and i.id=v.invoice_id left join unknowns u on u.company_id=v.company_id and u.invoice_id=v.invoice_id';
end $invoice$;

create view public.carez_payment_financial_v1 with(security_invoker=true) as
select p.id payment_id,p.company_id,p.customer_id,p.project_id,p.received_date,p.amount,p.processing_fee,p.payment_method,p.reference_number,p.notes,p.status,
 coalesce(sum(a.amount),0) allocated_amount,p.amount-coalesce(sum(a.amount),0) unallocated_amount,p.amount-coalesce(sum(a.amount),0) unapplied_amount,p.created_at,
 case when p.status in ('posted','void') then 'known' else 'unavailable' end payment_basis_status
from public.customer_payments p left join public.payment_allocations a on a.company_id=p.company_id and a.payment_id=p.id group by p.id;

create view public.carez_project_billing_v1 with(security_invoker=true) as
select p.company_id,p.id project_id,p.job_number,p.name,p.customer_id,p.contract_value original_contract_value,p.contract_value+p.approved_changes-p.backcharges authorized_contract,
 coalesce(sum(i.invoice_total) filter(where i.status<>'void'),0) billed_amount,
 case when bool_or(i.payment_basis_status='unavailable' and i.status<>'void') then null else coalesce(sum(i.amount_paid) filter(where i.status<>'void'),0) end collected_amount,
 case when bool_or(i.payment_basis_status='unavailable' and i.status not in ('void','paid')) then null else coalesce(sum(i.balance_due) filter(where i.status not in ('void','paid')),0) end outstanding_ar,
 case when p.contract_value is null then null else greatest(0,p.contract_value-coalesce(sum(i.invoice_total) filter(where i.status<>'void'),0)) end unbilled_contract,
 coalesce(sum(i.retainage_held) filter(where i.status<>'void'),0) retainage_held,
 coalesce(sum(i.tax_amount) filter(where i.status<>'void'),0) sales_tax_billed,
 case when bool_or(i.payment_basis_status='unavailable' and i.status<>'void') then null else coalesce(sum(i.balance_due) filter(where i.collection_status='overdue'),0) end overdue_ar,
 count(*) filter(where i.collection_status='overdue')::integer overdue_invoice_count,count(*) filter(where i.status='draft')::integer draft_invoice_count,
 case when bool_or(i.payment_basis_status='unavailable' and i.status not in ('void','paid')) then null else count(*) filter(where i.status not in ('draft','void','paid') and i.balance_due>0)::integer end open_invoice_count,
 case when bool_or(i.payment_basis_status='unavailable' and i.status<>'void') then 'unavailable' else 'known' end payment_basis_status,
 coalesce(sum(i.posted_amount_paid) filter(where i.status<>'void'),0) known_posted_collections
from public.projects p left join public.carez_invoice_financial_v1 i on i.company_id=p.company_id and i.project_id=p.id group by p.id;

create view public.carez_project_commitment_v1 with(security_invoker=true) as
select p.company_id,p.id project_id,p.job_number,p.name,
 coalesce(sum(s.po_total) filter(where s.status='issued'),0) issued_po_total,
 coalesce(sum(s.actual_cost) filter(where s.status in ('issued','closed')),0) po_actual_cost,
 case when count(*) filter(where s.status='issued' and (s.open_commitment is null or s.open_commitment::text in ('NaN','Infinity','-Infinity')))>0 then null else coalesce(sum(s.open_commitment) filter(where s.status='issued'),0) end open_po_commitments,
 count(s.purchase_order_id) filter(where s.status='issued')::integer open_po_count,
 case when count(*) filter(where s.status='issued' and (s.open_commitment is null or s.open_commitment::text in ('NaN','Infinity','-Infinity')))>0 then 'unavailable' else 'known' end commitment_status
from public.projects p left join public.purchase_order_financial_summary s on s.company_id=p.company_id and s.project_id=p.id group by p.id;

create function pg_temp.carez_connect_view(p_name text,p_canonical text,p_source jsonb,p_deployed jsonb) returns void language plpgsql as $$
declare v_shape jsonb;v_sql text;v_names text[];v_more text;
begin
 select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum),array_agg(a.attname order by a.attnum)
 into v_shape,v_names from pg_attribute a where a.attrelid=('public.'||p_name)::regclass and a.attnum>0 and not a.attisdropped;
 if v_shape is distinct from p_source and v_shape is distinct from p_deployed then
  -- The early forward bridge appends explicit canonical fields to the captured
  -- legacy prefix. Verify BOTH prefix and extension, including exact typmods.
  if v_shape is distinct from (p_deployed || (case p_name
   when 'invoice_financial_summary' then $extension$[{"name":"tax_amount","type":"numeric"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"}]$extension$::jsonb
   when 'payment_financial_summary' then $extension$[{"name":"unallocated_amount","type":"numeric"},{"name":"created_at","type":"timestamp with time zone"}]$extension$::jsonb
   when 'project_billing_summary' then $extension$[{"name":"original_contract_value","type":"numeric(12,2)"},{"name":"billed_amount","type":"numeric(14,2)"},{"name":"collected_amount","type":"numeric(14,2)"}]$extension$::jsonb
   when 'project_commitment_summary' then $extension$[{"name":"commitment_status","type":"text"}]$extension$::jsonb
   else '[]'::jsonb end)) then raise exception 'Unrecognized % read contract: %',p_name,v_shape;end if;
 end if;
 if exists(select 1 from unnest(v_names)n where not exists(select 1 from pg_attribute a where a.attrelid=('public.'||p_canonical)::regclass and a.attname=n and a.attnum>0 and not a.attisdropped)) then raise exception 'Canonical % is missing an existing field',p_name;end if;
 select string_agg(format('v.%I::%s AS %I',a.attname,format_type(a.atttypid,a.atttypmod),a.attname),',' order by a.attnum) into v_sql from pg_attribute a where a.attrelid=('public.'||p_name)::regclass and a.attnum>0 and not a.attisdropped;
 select string_agg(format('v.%I',a.attname),',' order by a.attnum) into v_more from pg_attribute a where a.attrelid=('public.'||p_canonical)::regclass and a.attnum>0 and not a.attisdropped and not(a.attname=any(v_names));
 execute format('create or replace view public.%I with(security_invoker=true) as select %s%s from public.%I v',p_name,v_sql,case when v_more is null then '' else ','||v_more end,p_canonical);
 execute format('revoke all on public.%I from public,anon,authenticated',p_name);execute format('grant select on public.%I to authenticated',p_name);
end $$;

select pg_temp.carez_connect_view('invoice_financial_summary','carez_invoice_financial_v1',$shape$[{"name":"invoice_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"customer_id","type":"uuid"},{"name":"invoice_number","type":"text"},{"name":"invoice_type","type":"text"},{"name":"status","type":"text"},{"name":"issue_date","type":"date"},{"name":"due_date","type":"date"},{"name":"billing_period_start","type":"date"},{"name":"billing_period_end","type":"date"},{"name":"po_number","type":"text"},{"name":"bill_to_name","type":"text"},{"name":"bill_to_contact","type":"text"},{"name":"bill_to_email","type":"text"},{"name":"sales_tax_rate_percent","type":"numeric(8,5)"},{"name":"sales_tax_exempt","type":"boolean"},{"name":"sales_tax_jurisdiction","type":"text"},{"name":"retainage_percent","type":"numeric(6,3)"},{"name":"terms_text","type":"text"},{"name":"notes","type":"text"},{"name":"subtotal","type":"numeric(14,2)"},{"name":"taxable_subtotal","type":"numeric(14,2)"},{"name":"tax_amount","type":"numeric(14,2)"},{"name":"retainage_held","type":"numeric(14,2)"},{"name":"invoice_total","type":"numeric(14,2)"},{"name":"amount_paid","type":"numeric(14,2)"},{"name":"balance_due","type":"numeric(14,2)"},{"name":"collection_status","type":"text"},{"name":"days_overdue","type":"integer"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"}]$shape$::jsonb,$shape$[{"name":"invoice_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"customer_id","type":"uuid"},{"name":"invoice_number","type":"text"},{"name":"invoice_type","type":"text"},{"name":"status","type":"text"},{"name":"issue_date","type":"date"},{"name":"due_date","type":"date"},{"name":"billing_period_start","type":"date"},{"name":"billing_period_end","type":"date"},{"name":"po_number","type":"text"},{"name":"bill_to_name","type":"text"},{"name":"bill_to_contact","type":"text"},{"name":"bill_to_email","type":"text"},{"name":"sales_tax_rate_percent","type":"numeric(8,5)"},{"name":"sales_tax_exempt","type":"boolean"},{"name":"sales_tax_jurisdiction","type":"text"},{"name":"retainage_percent","type":"numeric(6,3)"},{"name":"terms_text","type":"text"},{"name":"notes","type":"text"},{"name":"sent_at","type":"timestamp with time zone"},{"name":"voided_at","type":"timestamp with time zone"},{"name":"subtotal","type":"numeric"},{"name":"taxable_subtotal","type":"numeric"},{"name":"sales_tax","type":"numeric"},{"name":"retainage_held","type":"numeric"},{"name":"invoice_total","type":"numeric"},{"name":"amount_paid","type":"numeric"},{"name":"balance_due","type":"numeric"},{"name":"collection_status","type":"text"},{"name":"days_overdue","type":"integer"},{"name":"aging_bucket","type":"text"}]$shape$::jsonb);
select pg_temp.carez_connect_view('payment_financial_summary','carez_payment_financial_v1',$shape$[{"name":"payment_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"customer_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"received_date","type":"date"},{"name":"amount","type":"numeric(14,2)"},{"name":"processing_fee","type":"numeric(14,2)"},{"name":"payment_method","type":"text"},{"name":"reference_number","type":"text"},{"name":"notes","type":"text"},{"name":"allocated_amount","type":"numeric(14,2)"},{"name":"unallocated_amount","type":"numeric(14,2)"},{"name":"created_at","type":"timestamp with time zone"}]$shape$::jsonb,$shape$[{"name":"payment_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"customer_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"received_date","type":"date"},{"name":"amount","type":"numeric(14,2)"},{"name":"processing_fee","type":"numeric(14,2)"},{"name":"payment_method","type":"text"},{"name":"reference_number","type":"text"},{"name":"notes","type":"text"},{"name":"status","type":"text"},{"name":"allocated_amount","type":"numeric"},{"name":"unapplied_amount","type":"numeric"}]$shape$::jsonb);
do $billing$ declare definition text;column_row record;projection text:='';extras text;begin
 definition:=pg_get_viewdef('public.project_billing_summary'::regclass,true);
 execute 'create view public.carez_project_billing_contract_v1 with(security_invoker=true) as '||definition;
 for column_row in select attname from pg_attribute where attrelid='public.project_billing_summary'::regclass and attnum>0 and not attisdropped order by attnum loop
  projection:=projection||case when projection='' then '' else ',' end||case when column_row.attname in ('collected_amount','cash_collected','net_cash_collected','outstanding_ar','overdue_ar','collection_percent','open_invoice_count','overdue_invoice_count') then format('case when c.payment_basis_status=''unavailable'' then null else v.%I end as %I',column_row.attname,column_row.attname) else format('v.%I',column_row.attname) end;
 end loop;
 select string_agg(format('c.%I',a.attname),',' order by a.attnum) into extras from pg_attribute a where a.attrelid='public.carez_project_billing_v1'::regclass and a.attnum>0 and not a.attisdropped and not exists(select 1 from pg_attribute o where o.attrelid='public.project_billing_summary'::regclass and o.attnum>0 and not o.attisdropped and o.attname=a.attname);
 execute 'create view public.carez_project_billing_full_v1 with(security_invoker=true) as select '||projection||case when extras is null then '' else ','||extras end||' from public.carez_project_billing_contract_v1 v join public.carez_project_billing_v1 c on c.company_id=v.company_id and c.project_id=v.project_id';
end $billing$;
select pg_temp.carez_connect_view('project_billing_summary','carez_project_billing_full_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"original_contract_value","type":"numeric(12,2)"},{"name":"billed_amount","type":"numeric(14,2)"},{"name":"collected_amount","type":"numeric(14,2)"},{"name":"outstanding_ar","type":"numeric(14,2)"},{"name":"unbilled_contract","type":"numeric(14,2)"},{"name":"retainage_held","type":"numeric(14,2)"}]$shape$::jsonb,$shape$[{"name":"project_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"customer_id","type":"uuid"},{"name":"authorized_contract","type":"numeric"},{"name":"billed_contract","type":"numeric"},{"name":"sales_tax_billed","type":"numeric"},{"name":"retainage_held","type":"numeric"},{"name":"retainage_released","type":"numeric"},{"name":"cash_collected","type":"numeric"},{"name":"processing_fees_paid","type":"numeric"},{"name":"net_cash_collected","type":"numeric"},{"name":"outstanding_ar","type":"numeric"},{"name":"overdue_ar","type":"numeric"},{"name":"overdue_invoice_count","type":"integer"},{"name":"draft_invoice_count","type":"integer"},{"name":"open_invoice_count","type":"integer"},{"name":"unbilled_contract","type":"numeric"},{"name":"billing_percent","type":"numeric"},{"name":"collection_percent","type":"numeric"}]$shape$::jsonb);
select pg_temp.carez_connect_view('project_commitment_summary','carez_project_commitment_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"open_po_commitments","type":"numeric"},{"name":"open_po_count","type":"integer"},{"name":"commitment_status","type":"text"}]$shape$::jsonb,$shape$[{"name":"project_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"issued_po_total","type":"numeric"},{"name":"po_actual_cost","type":"numeric"},{"name":"open_po_commitments","type":"numeric"},{"name":"open_po_count","type":"integer"}]$shape$::jsonb);

create view public.carez_project_cash_v1 with(security_invoker=true) as
with labor as (
 select company_id,project_id,sum(direct_labor_cost) actual_labor_cost,count(*) filter(where direct_labor_cost is null or direct_labor_cost::text in ('NaN','Infinity','-Infinity'))::integer unknown_costs from public.timecards where approval_status='approved' group by company_id,project_id
), nonlabor as (
 select company_id,project_id,sum(total_cost) actual_nonlabor_cost,count(*) filter(where total_cost is null or total_cost::text in ('NaN','Infinity','-Infinity'))::integer unknown_costs from public.project_costs group by company_id,project_id
), allocated as (
 select i.company_id,i.project_id,coalesce(sum(a.amount) filter(where cp.status='posted'),0) gross_customer_cash,
 coalesce(sum(case when s.invoice_total>0 then a.amount*s.tax_amount/s.invoice_total else 0 end) filter(where cp.status='posted'),0) sales_tax_cash_reserved,
 count(*) filter(where cp.id is null or cp.status is null or cp.status not in ('posted','void') or (cp.status='posted' and (a.amount is null or a.amount::text in ('NaN','Infinity','-Infinity'))))::integer unknown_allocations
 from public.payment_allocations a join public.invoices i on i.company_id=a.company_id and i.id=a.invoice_id and i.status<>'void'
 join public.carez_invoice_financial_v1 s on s.company_id=i.company_id and s.invoice_id=i.id
 left join public.customer_payments cp on cp.company_id=a.company_id and cp.id=a.payment_id group by i.company_id,i.project_id
), fees as (
 select company_id,project_id,coalesce(sum(processing_fee) filter(where status='posted'),0) processing_fees_paid,
 count(*) filter(where status is null or status not in ('posted','void') or (status='posted' and (processing_fee is null or processing_fee::text in ('NaN','Infinity','-Infinity'))))::integer unknown_payments
 from public.customer_payments group by company_id,project_id
), facts as (
 select p.company_id,p.id project_id,p.job_number,p.name,p.status,
 coalesce(a.gross_customer_cash,0) known_posted_customer_cash,
 coalesce(a.unknown_allocations,0)+coalesce(f.unknown_payments,0)=0 cash_basis_available,
 coalesce(l.unknown_costs,0)+coalesce(n.unknown_costs,0)=0 direct_cost_basis_available,
 coalesce(a.unknown_allocations,0)+coalesce(f.unknown_payments,0)+coalesce(l.unknown_costs,0)+coalesce(n.unknown_costs,0)=0 and c.commitment_status='known' funding_basis_available,
 case when coalesce(a.unknown_allocations,0)+coalesce(f.unknown_payments,0)>0 then null else coalesce(a.gross_customer_cash,0) end gross_customer_cash,
 case when coalesce(a.unknown_allocations,0)+coalesce(f.unknown_payments,0)>0 then null else round(coalesce(a.sales_tax_cash_reserved,0),2) end sales_tax_cash_reserved,
 case when coalesce(f.unknown_payments,0)>0 then null else coalesce(f.processing_fees_paid,0) end processing_fees_paid,
 case when coalesce(l.unknown_costs,0)=0 then coalesce(l.actual_labor_cost,0) end incurred_labor_cost,
 case when coalesce(n.unknown_costs,0)=0 then coalesce(n.actual_nonlabor_cost,0) end incurred_nonlabor_cost,
 case when coalesce(l.unknown_costs,0)+coalesce(n.unknown_costs,0)=0 then coalesce(l.actual_labor_cost,0)+coalesce(n.actual_nonlabor_cost,0) end incurred_direct_cost,
 b.outstanding_ar outstanding_ar_not_counted,b.unbilled_contract unbilled_contract_not_counted,b.retainage_held retainage_held_not_counted,c.open_po_commitments
 from public.projects p left join allocated a on a.company_id=p.company_id and a.project_id=p.id left join fees f on f.company_id=p.company_id and f.project_id=p.id
 left join labor l on l.company_id=p.company_id and l.project_id=p.id left join nonlabor n on n.company_id=p.company_id and n.project_id=p.id
 join public.project_billing_summary b on b.company_id=p.company_id and b.project_id=p.id join public.carez_project_commitment_v1 c on c.company_id=p.company_id and c.project_id=p.id
), net as (select f.*,round(gross_customer_cash-sales_tax_cash_reserved-processing_fees_paid,2) net_customer_funding from facts f)
select n.*,round(net_customer_funding-incurred_direct_cost,2) project_funding_balance,
 case when cash_basis_available and direct_cost_basis_available then greatest(round(incurred_direct_cost-net_customer_funding,2),0) end carez_cash_at_risk_to_date,
 round(net_customer_funding-incurred_direct_cost-open_po_commitments,2) funding_after_open_commitments,
 case when funding_basis_available then greatest(round(incurred_direct_cost+open_po_commitments-net_customer_funding,2),0) end carez_cash_at_risk_including_commitments,
 case when cash_basis_available then 'known' else 'unavailable' end cash_basis_status,
 case when funding_basis_available then 'known' else 'unavailable' end funding_basis_status
from net n;

create view public.carez_pour_calculated_v1 with(security_invoker=true) as
SELECT q.* FROM (
WITH actual_item AS (
         SELECT project_costs.company_id,project_costs.pour_cost_item_id,
            COALESCE(sum(project_costs.total_cost), 0::numeric) AS actual_cost
           FROM project_costs
          WHERE project_costs.pour_cost_item_id IS NOT NULL
          GROUP BY project_costs.company_id,project_costs.pour_cost_item_id
        ), po_item AS (
         SELECT purchase_order_line_financial_summary.company_id,purchase_order_line_financial_summary.pour_cost_item_id,
            COALESCE(sum(purchase_order_line_financial_summary.open_commitment), 0::numeric) AS open_commitment
           FROM purchase_order_line_financial_summary
          WHERE purchase_order_line_financial_summary.pour_cost_item_id IS NOT NULL
          GROUP BY purchase_order_line_financial_summary.company_id,purchase_order_line_financial_summary.pour_cost_item_id
        ), item_cost AS (
         SELECT pci.company_id,pci.pour_plan_id,
            COALESCE(sum(pci.expected_cost), 0::numeric) AS planned_exposure,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.item_type = 'concrete'::text), 0::numeric) AS concrete_cost,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.item_type = 'labor'::text), 0::numeric) AS labor_cost,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.item_type = 'pump'::text), 0::numeric) AS pump_cost,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.item_type = ANY (ARRAY['material'::text, 'equipment'::text])), 0::numeric) AS material_equipment_cost,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.item_type = 'subcontractor'::text), 0::numeric) AS subcontractor_cost,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.item_type = 'other'::text), 0::numeric) AS other_cost,
            COALESCE(sum(pci.expected_cost) FILTER (WHERE pci.committed), 0::numeric) AS manual_committed_cost,
            COALESCE(sum(COALESCE(ai.actual_cost, 0::numeric)), 0::numeric) AS linked_actual_cost,
            COALESCE(sum(COALESCE(pi.open_commitment, 0::numeric)), 0::numeric) AS linked_open_po_commitment,
            COALESCE(sum(GREATEST(pci.expected_cost - COALESCE(ai.actual_cost, 0::numeric), COALESCE(pi.open_commitment, 0::numeric))), 0::numeric) AS remaining_item_exposure
           FROM pour_cost_items pci
             LEFT JOIN actual_item ai ON ai.company_id=pci.company_id AND ai.pour_cost_item_id = pci.id
             LEFT JOIN po_item pi ON pi.company_id=pci.company_id AND pi.pour_cost_item_id = pci.id
          GROUP BY pci.company_id,pci.pour_plan_id
        ), unlinked_po AS (
         SELECT purchase_order_line_financial_summary.company_id,purchase_order_line_financial_summary.pour_plan_id,
            COALESCE(sum(purchase_order_line_financial_summary.open_commitment), 0::numeric) AS open_commitment
           FROM purchase_order_line_financial_summary
          WHERE purchase_order_line_financial_summary.pour_plan_id IS NOT NULL AND purchase_order_line_financial_summary.pour_cost_item_id IS NULL
          GROUP BY purchase_order_line_financial_summary.company_id,purchase_order_line_financial_summary.pour_plan_id
        ), all_pour_po AS (
         SELECT purchase_order_line_financial_summary.company_id,purchase_order_line_financial_summary.pour_plan_id,
            COALESCE(sum(purchase_order_line_financial_summary.open_commitment), 0::numeric) AS open_commitment
           FROM purchase_order_line_financial_summary
          WHERE purchase_order_line_financial_summary.pour_plan_id IS NOT NULL
          GROUP BY purchase_order_line_financial_summary.company_id,purchase_order_line_financial_summary.pour_plan_id
        )
 SELECT pp.id AS pour_plan_id,
    pp.company_id,
    pp.project_id,
    pp.budget_section_id,
    pp.change_order_id,
    pp.name,
    pp.scheduled_date,
    pp.expected_concrete_yards,
    pp.contingency_percent,
    pp.minimum_cash_buffer,
    pp.company_cash_support,
    pp.status,
    pp.notes,
    p.job_number,
    p.name AS project_name,
    COALESCE(ic.planned_exposure, 0::numeric) AS planned_exposure,
    COALESCE(ic.concrete_cost, 0::numeric) AS concrete_cost,
    COALESCE(ic.labor_cost, 0::numeric) AS labor_cost,
    COALESCE(ic.pump_cost, 0::numeric) AS pump_cost,
    COALESCE(ic.material_equipment_cost, 0::numeric) AS material_equipment_cost,
    COALESCE(ic.subcontractor_cost, 0::numeric) AS subcontractor_cost,
    COALESCE(ic.other_cost, 0::numeric) AS other_cost,
    COALESCE(ic.manual_committed_cost, 0::numeric) + COALESCE(ap.open_commitment, 0::numeric) AS already_committed_cost,
    round((COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric)) * pp.contingency_percent / 100::numeric, 2) AS contingency_amount,
    round((COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric)) * (1::numeric + pp.contingency_percent / 100::numeric), 2) AS total_exposure_with_contingency,
    COALESCE(cf.gross_customer_cash, 0::numeric) AS gross_customer_cash,
    COALESCE(cf.sales_tax_cash_reserved, 0::numeric) AS sales_tax_cash_reserved,
    COALESCE(cf.processing_fees_paid, 0::numeric) AS processing_fees_paid,
    COALESCE(cf.net_customer_funding, 0::numeric) AS net_customer_funding,
    COALESCE(cf.incurred_direct_cost, 0::numeric) AS incurred_direct_cost,
    COALESCE(cf.project_funding_balance, 0::numeric) AS project_funding_balance,
    COALESCE(cf.carez_cash_at_risk_to_date, 0::numeric) AS carez_cash_at_risk_to_date,
    COALESCE(cf.outstanding_ar_not_counted, 0::numeric) AS outstanding_ar_not_counted,
    COALESCE(cf.unbilled_contract_not_counted, 0::numeric) AS unbilled_contract_not_counted,
    round((COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric)) * (1::numeric + pp.contingency_percent / 100::numeric) + pp.minimum_cash_buffer - (COALESCE(cf.project_funding_balance, 0::numeric) - GREATEST(COALESCE(cf.open_po_commitments, 0::numeric) - COALESCE(ap.open_commitment, 0::numeric), 0::numeric)) - pp.company_cash_support, 2) AS raw_funding_gap,
    GREATEST(round((COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric)) * (1::numeric + pp.contingency_percent / 100::numeric) + pp.minimum_cash_buffer - (COALESCE(cf.project_funding_balance, 0::numeric) - GREATEST(COALESCE(cf.open_po_commitments, 0::numeric) - COALESCE(ap.open_commitment, 0::numeric), 0::numeric)) - pp.company_cash_support, 2), 0::numeric) AS required_additional_cash,
        CASE
            WHEN (COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric)) <= 0::numeric THEN 'hold'::text
            WHEN round((COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric)) * (1::numeric + pp.contingency_percent / 100::numeric) + pp.minimum_cash_buffer - (COALESCE(cf.project_funding_balance, 0::numeric) - GREATEST(COALESCE(cf.open_po_commitments, 0::numeric) - COALESCE(ap.open_commitment, 0::numeric), 0::numeric)) - pp.company_cash_support, 2) <= 0::numeric THEN 'clear'::text
            ELSE 'hold'::text
        END AS system_recommendation,
    COALESCE(ic.linked_actual_cost, 0::numeric) AS linked_actual_cost,
    COALESCE(ic.linked_open_po_commitment, 0::numeric) AS linked_open_po_commitment,
    COALESCE(up.open_commitment, 0::numeric) AS unlinked_pour_po_commitment,
    COALESCE(ic.remaining_item_exposure, 0::numeric) + COALESCE(up.open_commitment, 0::numeric) AS remaining_pour_exposure,
    COALESCE(cf.open_po_commitments, 0::numeric) AS project_open_po_commitments,
    GREATEST(COALESCE(cf.open_po_commitments, 0::numeric) - COALESCE(ap.open_commitment, 0::numeric), 0::numeric) AS other_project_open_commitments,
    round(COALESCE(cf.project_funding_balance, 0::numeric) - GREATEST(COALESCE(cf.open_po_commitments, 0::numeric) - COALESCE(ap.open_commitment, 0::numeric), 0::numeric), 2) AS available_funding_for_this_pour
   FROM pour_plans pp
     JOIN projects p ON p.company_id=pp.company_id AND p.id = pp.project_id
     LEFT JOIN item_cost ic ON ic.company_id=pp.company_id AND ic.pour_plan_id = pp.id
     LEFT JOIN unlinked_po up ON up.company_id=pp.company_id AND up.pour_plan_id = pp.id
     LEFT JOIN all_pour_po ap ON ap.company_id=pp.company_id AND ap.pour_plan_id = pp.id
     LEFT JOIN public.carez_project_cash_v1 cf ON cf.company_id=pp.company_id AND cf.project_id = pp.project_id
)q;
do $pour$ declare column_row record;projection text:='';begin
 for column_row in select attname from pg_attribute where attrelid='public.carez_pour_calculated_v1'::regclass and attnum>0 and not attisdropped order by attnum loop
  projection:=projection||case when projection='' then '' else ',' end||case
   when column_row.attname='system_recommendation' then 'case when (c.funding_basis_available and b.available) is not true then ''unavailable'' else v.system_recommendation end system_recommendation'
   when column_row.attname in ('gross_customer_cash','sales_tax_cash_reserved','processing_fees_paid','net_customer_funding') then format('case when c.cash_basis_available is true then v.%I end as %I',column_row.attname,column_row.attname)
   when column_row.attname in ('project_funding_balance','carez_cash_at_risk_to_date','raw_funding_gap','required_additional_cash','available_funding_for_this_pour') then format('case when (c.funding_basis_available and b.available) is true then v.%I end as %I',column_row.attname,column_row.attname)
   when column_row.attname='incurred_direct_cost' then 'c.incurred_direct_cost'
   else format('v.%I',column_row.attname) end;
 end loop;
 execute 'create view public.carez_pour_financial_v1 with(security_invoker=true) as select '||projection||',c.cash_basis_status,case when c.funding_basis_available and b.available then ''known'' else ''unavailable'' end funding_basis_status,c.known_posted_customer_cash from public.carez_pour_calculated_v1 v join public.carez_project_cash_v1 c on c.company_id=v.company_id and c.project_id=v.project_id cross join lateral (select not exists(select 1 from public.pour_cost_items i where i.company_id=v.company_id and i.pour_plan_id=v.pour_plan_id and (i.expected_cost is null or i.expected_cost::text in (''NaN'',''Infinity'',''-Infinity''))) and not exists(select 1 from jsonb_each(to_jsonb(v)) e where e.key in (''expected_concrete_yards'',''contingency_percent'',''minimum_cash_buffer'',''company_cash_support'') and (e.value=''null''::jsonb or e.value#>>''{}'' in (''NaN'',''Infinity'',''-Infinity''))) available)b';
end $pour$;
select pg_temp.carez_connect_view('project_cash_funding_summary','carez_project_cash_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"status","type":"text"},{"name":"gross_customer_cash","type":"numeric"},{"name":"sales_tax_cash_reserved","type":"numeric"},{"name":"incurred_direct_cost","type":"numeric"},{"name":"incurred_labor_cost","type":"numeric"},{"name":"incurred_nonlabor_cost","type":"numeric"},{"name":"processing_fees_paid","type":"numeric"},{"name":"project_funding_balance","type":"numeric"},{"name":"carez_cash_at_risk_to_date","type":"numeric"},{"name":"outstanding_ar_not_counted","type":"numeric"},{"name":"unbilled_contract_not_counted","type":"numeric"},{"name":"retainage_held_not_counted","type":"numeric"}]$shape$::jsonb,$shape$[{"name":"project_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"name","type":"text"},{"name":"status","type":"text"},{"name":"gross_customer_cash","type":"numeric"},{"name":"sales_tax_cash_reserved","type":"numeric"},{"name":"processing_fees_paid","type":"numeric"},{"name":"net_customer_funding","type":"numeric"},{"name":"incurred_labor_cost","type":"numeric"},{"name":"incurred_nonlabor_cost","type":"numeric"},{"name":"incurred_direct_cost","type":"numeric"},{"name":"project_funding_balance","type":"numeric"},{"name":"carez_cash_at_risk_to_date","type":"numeric"},{"name":"outstanding_ar_not_counted","type":"numeric"},{"name":"unbilled_contract_not_counted","type":"numeric"},{"name":"retainage_held_not_counted","type":"numeric"},{"name":"open_po_commitments","type":"numeric"},{"name":"funding_after_open_commitments","type":"numeric"},{"name":"carez_cash_at_risk_including_commitments","type":"numeric"}]$shape$::jsonb);
select pg_temp.carez_connect_view('pour_plan_financial_summary','carez_pour_financial_v1',$shape$[{"name":"company_id","type":"uuid"},{"name":"pour_plan_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"name","type":"text"},{"name":"scheduled_date","type":"date"},{"name":"expected_concrete_yards","type":"numeric(14,2)"},{"name":"contingency_percent","type":"numeric(6,2)"},{"name":"minimum_cash_buffer","type":"numeric(14,2)"},{"name":"company_cash_support","type":"numeric(14,2)"},{"name":"status","type":"text"},{"name":"notes","type":"text"},{"name":"planned_exposure","type":"numeric"},{"name":"contingency_amount","type":"numeric"},{"name":"total_exposure_with_contingency","type":"numeric"},{"name":"concrete_cost","type":"numeric"},{"name":"labor_cost","type":"numeric"},{"name":"pump_cost","type":"numeric"},{"name":"material_equipment_cost","type":"numeric"},{"name":"subcontractor_cost","type":"numeric"},{"name":"other_cost","type":"numeric"},{"name":"project_funding_balance","type":"numeric"},{"name":"gross_customer_cash","type":"numeric"},{"name":"sales_tax_cash_reserved","type":"numeric"},{"name":"processing_fees_paid","type":"numeric"},{"name":"incurred_direct_cost","type":"numeric"},{"name":"required_additional_cash","type":"numeric"},{"name":"system_recommendation","type":"text"}]$shape$::jsonb,$shape$[{"name":"pour_plan_id","type":"uuid"},{"name":"company_id","type":"uuid"},{"name":"project_id","type":"uuid"},{"name":"budget_section_id","type":"uuid"},{"name":"change_order_id","type":"uuid"},{"name":"name","type":"text"},{"name":"scheduled_date","type":"date"},{"name":"expected_concrete_yards","type":"numeric(10,2)"},{"name":"contingency_percent","type":"numeric(6,2)"},{"name":"minimum_cash_buffer","type":"numeric(14,2)"},{"name":"company_cash_support","type":"numeric(14,2)"},{"name":"status","type":"text"},{"name":"notes","type":"text"},{"name":"job_number","type":"text"},{"name":"project_name","type":"text"},{"name":"planned_exposure","type":"numeric"},{"name":"concrete_cost","type":"numeric"},{"name":"labor_cost","type":"numeric"},{"name":"pump_cost","type":"numeric"},{"name":"material_equipment_cost","type":"numeric"},{"name":"subcontractor_cost","type":"numeric"},{"name":"other_cost","type":"numeric"},{"name":"already_committed_cost","type":"numeric"},{"name":"contingency_amount","type":"numeric"},{"name":"total_exposure_with_contingency","type":"numeric"},{"name":"gross_customer_cash","type":"numeric"},{"name":"sales_tax_cash_reserved","type":"numeric"},{"name":"processing_fees_paid","type":"numeric"},{"name":"net_customer_funding","type":"numeric"},{"name":"incurred_direct_cost","type":"numeric"},{"name":"project_funding_balance","type":"numeric"},{"name":"carez_cash_at_risk_to_date","type":"numeric"},{"name":"outstanding_ar_not_counted","type":"numeric"},{"name":"unbilled_contract_not_counted","type":"numeric"},{"name":"raw_funding_gap","type":"numeric"},{"name":"required_additional_cash","type":"numeric"},{"name":"system_recommendation","type":"text"},{"name":"linked_actual_cost","type":"numeric"},{"name":"linked_open_po_commitment","type":"numeric"},{"name":"unlinked_pour_po_commitment","type":"numeric"},{"name":"remaining_pour_exposure","type":"numeric"},{"name":"project_open_po_commitments","type":"numeric"},{"name":"other_project_open_commitments","type":"numeric"},{"name":"available_funding_for_this_pour","type":"numeric"}]$shape$::jsonb);
drop function pg_temp.carez_connect_view(text,text,jsonb,jsonb);
-- Dependent project summaries must not turn an unknown customer balance back
-- into zero. Keep every installed cost/budget/forecast formula unchanged.
do $project$ declare definition text;column_row record;projection text:='';begin
 if not exists(select 1 from pg_attribute where attrelid='public.project_financial_summary'::regclass and attname='cash_collected' and atttypid='numeric'::regtype)
 or not exists(select 1 from pg_attribute where attrelid='public.project_financial_summary'::regclass and attname='outstanding_ar' and atttypid='numeric'::regtype) then raise exception 'Unknown project collections contract';end if;
 definition:=pg_get_viewdef('public.project_financial_summary'::regclass,true);
 execute 'create view public.carez_project_financial_contract_v1 with(security_invoker=true) as '||definition;
 for column_row in select attname,format_type(atttypid,atttypmod) typ from pg_attribute where attrelid='public.project_financial_summary'::regclass and attnum>0 and not attisdropped order by attnum loop
  projection:=projection||case when projection='' then '' else ',' end||case when column_row.attname in ('cash_collected','outstanding_ar') then format('(case when b.payment_basis_status=''unavailable'' then null else v.%I end)::%s as %I',column_row.attname,column_row.typ,column_row.attname) else format('v.%I',column_row.attname) end;
 end loop;
 execute 'create or replace view public.project_financial_summary with(security_invoker=true) as select '||projection||' from public.carez_project_financial_contract_v1 v join public.project_billing_summary b on b.company_id=v.company_id and b.project_id=v.project_id';
end $project$;
revoke all on public.carez_project_financial_contract_v1 from public,anon,authenticated;grant select on public.carez_project_financial_contract_v1 to authenticated;
revoke all on public.carez_posted_payment_allocations_v1 from public,anon,authenticated;grant select on public.carez_posted_payment_allocations_v1 to authenticated;
revoke all on public.carez_invoice_contract_v1 from public,anon,authenticated;grant select on public.carez_invoice_contract_v1 to authenticated;
revoke all on public.carez_invoice_financial_v1 from public,anon,authenticated;grant select on public.carez_invoice_financial_v1 to authenticated;
revoke all on public.carez_payment_financial_v1 from public,anon,authenticated;grant select on public.carez_payment_financial_v1 to authenticated;
revoke all on public.carez_project_billing_v1 from public,anon,authenticated;grant select on public.carez_project_billing_v1 to authenticated;
revoke all on public.carez_project_billing_contract_v1 from public,anon,authenticated;grant select on public.carez_project_billing_contract_v1 to authenticated;
revoke all on public.carez_project_billing_full_v1 from public,anon,authenticated;grant select on public.carez_project_billing_full_v1 to authenticated;
revoke all on public.carez_project_commitment_v1 from public,anon,authenticated;grant select on public.carez_project_commitment_v1 to authenticated;
revoke all on public.carez_project_cash_v1 from public,anon,authenticated;grant select on public.carez_project_cash_v1 to authenticated;
revoke all on public.carez_pour_calculated_v1 from public,anon,authenticated;grant select on public.carez_pour_calculated_v1 to authenticated;
revoke all on public.carez_pour_financial_v1 from public,anon,authenticated;grant select on public.carez_pour_financial_v1 to authenticated;
