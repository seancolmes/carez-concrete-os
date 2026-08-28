import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './PrintButton';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const line=(parts:(string|null|undefined)[])=>parts.filter(Boolean).join(', ');

export default async function InvoiceDocument({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  const [{data:invoice},{data:summary},{data:lines}]=await Promise.all([
    supabase.from('invoices').select('*').eq('id',id).eq('company_id',profile.company_id).maybeSingle(),
    supabase.from('invoice_financial_summary').select('*').eq('invoice_id',id).maybeSingle(),
    supabase.from('invoice_lines').select('*').eq('invoice_id',id).order('sort_order')
  ]);
  if(!invoice||!summary)notFound();
  const {data:project}=await supabase.from('projects').select('job_number,name,address,city,state').eq('id',invoice.project_id).maybeSingle();
  const companyCity=line([invoice.from_city,invoice.from_state,invoice.from_postal_code]);
  const billCity=line([invoice.bill_to_city,invoice.bill_to_state,invoice.bill_to_postal_code]);
  const projectLocation=line([project?.address,project?.city,project?.state]);
  const isRetainage=invoice.invoice_type==='retainage_release';
  const isVoid=invoice.status==='void';

  return <div className="invoice-screen">
    <div className="invoice-actions"><Link className="button secondary" href="/billing">Back to Billing</Link><PrintButton/></div>
    <article className="invoice-document">
      {isVoid&&<div className="invoice-void">VOID</div>}
      <header className="invoice-doc-header">
        <div className="invoice-brand">
          <img src={invoice.from_logo_path||'/brand/carez-wordmark.png'} alt={invoice.from_name||'Carez Concrete'} />
          <div className="invoice-company-name">{invoice.from_name||'Carez Concrete'}</div>
          {invoice.from_address_line1&&<div>{invoice.from_address_line1}</div>}
          {invoice.from_address_line2&&<div>{invoice.from_address_line2}</div>}
          {companyCity&&<div>{companyCity}</div>}
          <div>{[invoice.from_phone,invoice.from_email].filter(Boolean).join(' · ')}</div>
          {invoice.from_website&&<div>{invoice.from_website}</div>}
          <div className="invoice-credentials">{invoice.from_ubi_number&&<span>WA UBI {invoice.from_ubi_number}</span>}{invoice.from_contractor_license_number&&<span>Contractor Lic. {invoice.from_contractor_license_number}</span>}</div>
        </div>
        <div className="invoice-doc-title">
          <div>{isRetainage?'RETAINAGE RELEASE':'INVOICE'}</div>
          <strong>{invoice.invoice_number}</strong>
          <span className="invoice-status-label">{String(summary.collection_status||invoice.status).replaceAll('_',' ')}</span>
        </div>
      </header>

      <section className="invoice-info-grid">
        <div>
          <div className="invoice-small-label">BILL TO</div>
          <strong>{invoice.bill_to_name||'Customer'}</strong>
          {invoice.bill_to_contact&&<div>{invoice.bill_to_contact}</div>}
          {invoice.bill_to_address_line1&&<div>{invoice.bill_to_address_line1}</div>}
          {invoice.bill_to_address_line2&&<div>{invoice.bill_to_address_line2}</div>}
          {billCity&&<div>{billCity}</div>}
          {invoice.bill_to_email&&<div>{invoice.bill_to_email}</div>}
        </div>
        <div>
          <div className="invoice-small-label">PROJECT</div>
          <strong>{project?.job_number||'Project'} — {project?.name||''}</strong>
          {projectLocation&&<div>{projectLocation}</div>}
          {invoice.po_number&&<div>PO / Ref: {invoice.po_number}</div>}
          {(invoice.billing_period_start||invoice.billing_period_end)&&<div>Billing Period: {invoice.billing_period_start||'—'} to {invoice.billing_period_end||'—'}</div>}
        </div>
        <div className="invoice-date-box">
          <div><span>Invoice Date</span><strong>{invoice.issue_date}</strong></div>
          <div><span>Due Date</span><strong>{invoice.due_date}</strong></div>
          {invoice.terms_text&&<div><span>Terms</span><strong>{invoice.terms_text}</strong></div>}
        </div>
      </section>

      <table className="invoice-table">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>{(lines||[]).map((l:any)=><tr key={l.id}><td><strong>{l.description}</strong>{l.notes&&<div className="invoice-line-note">{l.notes}</div>}</td><td>{num(l.quantity).toFixed(2)}</td><td>{l.unit}</td><td>{money(num(l.unit_price))}</td><td>{money(num(l.line_amount))}</td></tr>)}</tbody>
      </table>

      <section className="invoice-totals-wrap">
        <div className="invoice-notes">
          {isRetainage&&<div className="invoice-note-box"><strong>Retainage Release</strong><br/>This invoice releases retainage previously withheld. Sales tax, if applicable, was billed on the original invoice and is not charged again here.</div>}
          {invoice.notes&&<div><div className="invoice-small-label">NOTES</div><div>{invoice.notes}</div></div>}
          {invoice.payment_instructions&&<div><div className="invoice-small-label">PAYMENT / REMITTANCE</div><div className="invoice-prewrap">{invoice.payment_instructions}</div></div>}
        </div>
        <div className="invoice-totals">
          <div><span>Subtotal</span><strong>{money(num(summary.subtotal))}</strong></div>
          <div><span>Sales Tax{!isRetainage&&!invoice.sales_tax_exempt&&num(invoice.sales_tax_rate_percent)>0?` (${num(invoice.sales_tax_rate_percent).toFixed(3)}%)`:''}</span><strong>{money(num(summary.sales_tax))}</strong></div>
          {num(summary.retainage_held)>0&&<div><span>Retainage Withheld ({num(invoice.retainage_percent).toFixed(1)}%)</span><strong>-{money(num(summary.retainage_held))}</strong></div>}
          <div className="invoice-total-line"><span>Invoice Total</span><strong>{money(num(summary.invoice_total))}</strong></div>
          {num(summary.amount_paid)>0&&<div><span>Payments Applied</span><strong>-{money(num(summary.amount_paid))}</strong></div>}
          <div className="invoice-balance-line"><span>Balance Due</span><strong>{money(num(summary.balance_due))}</strong></div>
        </div>
      </section>

      <footer className="invoice-footer">{invoice.invoice_footer||'Thank you for your business.'}</footer>
    </article>
  </div>;
}
