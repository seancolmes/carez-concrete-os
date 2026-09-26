create or replace view public.project_cash_funding_summary with (security_invoker=true) as
with labor as (
  select t.company_id,t.project_id,coalesce(sum(t.direct_labor_cost),0)::numeric actual_labor_cost
  from public.timecards t where t.approval_status='approved' group by t.company_id,t.project_id
), nonlabor as (
  select c.company_id,c.project_id,coalesce(sum(c.total_cost),0)::numeric actual_nonlabor_cost
  from public.project_costs c group by c.company_id,c.project_id
), tax as (
  select i.company_id,i.project_id,
    coalesce(sum(case when i.invoice_total>0 then i.amount_paid*i.tax_amount/i.invoice_total else 0 end),0)::numeric sales_tax_cash_reserved,
    coalesce(sum(i.retainage_held),0)::numeric retainage_held_not_counted
  from public.invoice_financial_summary i where i.status<>'void' group by i.company_id,i.project_id
), fees as (
  select p.company_id,p.project_id,coalesce(sum(p.processing_fee),0)::numeric processing_fees_paid
  from public.payment_financial_summary p group by p.company_id,p.project_id
)
select p.company_id,p.id project_id,p.job_number,p.name,p.status,
  coalesce(b.collected_amount,0)::numeric gross_customer_cash,
  coalesce(t.sales_tax_cash_reserved,0)::numeric sales_tax_cash_reserved,
  (coalesce(l.actual_labor_cost,0)+coalesce(n.actual_nonlabor_cost,0))::numeric incurred_direct_cost,
  coalesce(l.actual_labor_cost,0)::numeric incurred_labor_cost,
  coalesce(n.actual_nonlabor_cost,0)::numeric incurred_nonlabor_cost,
  coalesce(f.processing_fees_paid,0)::numeric processing_fees_paid,
  (coalesce(b.collected_amount,0)-coalesce(t.sales_tax_cash_reserved,0)-coalesce(f.processing_fees_paid,0)
    -coalesce(l.actual_labor_cost,0)-coalesce(n.actual_nonlabor_cost,0))::numeric project_funding_balance,
  greatest(coalesce(l.actual_labor_cost,0)+coalesce(n.actual_nonlabor_cost,0)
    -(coalesce(b.collected_amount,0)-coalesce(t.sales_tax_cash_reserved,0)-coalesce(f.processing_fees_paid,0)),0)::numeric carez_cash_at_risk_to_date,
  coalesce(b.outstanding_ar,0)::numeric outstanding_ar_not_counted,
  coalesce(b.unbilled_contract,0)::numeric unbilled_contract_not_counted,
  coalesce(t.retainage_held_not_counted,0)::numeric retainage_held_not_counted
from public.projects p
left join public.project_billing_summary b on b.company_id=p.company_id and b.project_id=p.id
left join labor l on l.company_id=p.company_id and l.project_id=p.id
left join nonlabor n on n.company_id=p.company_id and n.project_id=p.id
left join tax t on t.company_id=p.company_id and t.project_id=p.id
left join fees f on f.company_id=p.company_id and f.project_id=p.id;

create or replace view public.project_commitment_summary with (security_invoker=true) as
select p.company_id,p.id project_id,p.job_number,p.name,
  null::numeric open_po_commitments,null::integer open_po_count,
  'unavailable'::text commitment_status
from public.projects p
where false;

revoke all on public.project_cash_funding_summary,public.project_commitment_summary from public,anon;
grant select on public.project_cash_funding_summary,public.project_commitment_summary to authenticated;

comment on view public.project_cash_funding_summary is 'Collected-cash funding read model; customer receivables and unbilled contract value are never treated as spendable cash.';
comment on view public.project_commitment_summary is 'Explicit procurement boundary. No commitment row is emitted until authoritative purchase-order contracts are recovered.';
