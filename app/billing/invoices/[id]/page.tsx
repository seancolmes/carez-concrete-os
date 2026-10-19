import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './PrintButton';
import {financialMoney as money,financialNumber as num} from '@/lib/financials/amount';
import {invoiceDocumentState} from '@/lib/billing/invoiceDocument';

const decimal=(value:unknown,digits=2)=>num(value)?.toFixed(digits)??'Unavailable';
const line=(parts:(string|null|undefined)[])=>parts.filter(Boolean).join(', ');

export default async function InvoiceDocument({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if(!profile?.company_id)notFound();
  const companyId=profile.company_id;
  const [invoiceRead,summaryRead,linesRead]=await Promise.all([
    supabase.from('invoices').select('*').eq('id',id).eq('company_id',companyId).maybeSingle(),
    supabase.from('invoice_financial_summary').select('*').eq('company_id',companyId).eq('invoice_id',id).maybeSingle(),
    supabase.from('invoice_lines').select('*',{count:'exact'}).eq('company_id',companyId).eq('invoice_id',id).order('sort_order')
  ]);
  if(invoiceRead.error)return <main className="mx-auto max-w-3xl space-y-3 p-6"><h1 className="text-lg font-semibold">Invoice unavailable</h1><p role="status">The invoice could not be loaded. This is not a confirmed missing record.</p><Link href="/financials?tab=billing&view=invoices" className={secondaryLinkClass}>Back to Invoices</Link></main>;
  if(!invoiceRead.data)notFound();
  const invoice=invoiceRead.data,summary=summaryRead.error?null:summaryRead.data,lines=linesRead.error?null:linesRead.data;
  const state=invoiceDocumentState(summaryRead,linesRead);
  const {data:project,error:projectError}=await supabase.from('projects').select('job_number,name,address,city,state').eq('company_id',companyId).eq('id',invoice.project_id).maybeSingle();
  const companyCity=line([invoice.from_city,invoice.from_state,invoice.from_postal_code]);
  const billCity=line([invoice.bill_to_city,invoice.bill_to_state,invoice.bill_to_postal_code]);
  const projectLocation=line([project?.address,project?.city,project?.state]);
  const isRetainage=invoice.invoice_type==='retainage_release';
  const isVoid=invoice.status==='void';

  return <div className={`invoice-screen${state.canPrint?'':' invoice-incomplete'}`}>
    <style>{`
      .invoice-screen{min-height:100vh;background:var(--background);padding:30px;color:var(--foreground);font-family:inherit}
      .invoice-actions{width:min(900px,100%);margin:0 auto 16px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px}
      .invoice-read-status{width:min(900px,100%);margin:0 auto 16px;padding:12px 16px;border:1px solid var(--border);border-radius:8px;background:var(--muted);color:var(--foreground);font-size:13px}
      .invoice-document{position:relative;width:min(900px,100%);min-height:1100px;margin:0 auto;background:#fff;color:#232F3E;padding:52px 58px 40px;border:1px solid #E0E6EF;box-shadow:0 4px 18px rgba(26,43,85,.07);border-radius:8px;overflow:hidden;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
      .invoice-document:before{content:'';position:absolute;left:0;top:0;right:0;height:5px;background:#222222}
      .invoice-doc-header{display:flex;justify-content:space-between;gap:40px;align-items:flex-start;padding-bottom:28px;border-bottom:2px solid #D4DBD7}
      .invoice-brand{font-size:12px;line-height:1.55;color:#525C57;max-width:55%}
      .invoice-brand img{display:block;width:220px;max-width:100%;height:auto;margin-bottom:8px;filter:none}
      .invoice-company-name{font-size:18px;font-weight:900;color:#171B19;margin-bottom:4px}
      .invoice-credentials{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#7B8580}
      .invoice-doc-title{text-align:right;display:grid;justify-items:end;gap:5px;color:#171B19}
      .invoice-doc-title>div:first-child{font-size:31px;line-height:1;font-weight:900;letter-spacing:.04em}
      .invoice-doc-title strong{font-size:17px;color:#171B19}
      .invoice-status-label{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:999px;background:#F0F0F0;color:#333333}
      .invoice-info-grid{display:grid;grid-template-columns:1.1fr 1.15fr .85fr;gap:24px;padding:26px 0;font-size:12px;line-height:1.55;color:#525C57}
      .invoice-info-grid strong{color:#171B19;font-size:13px}
      .invoice-small-label{font-size:9px;font-weight:900;letter-spacing:.12em;color:#525C57;margin-bottom:5px}
      .invoice-date-box{display:grid;gap:8px}
      .invoice-date-box>div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #E1E6E3;padding-bottom:5px}
      .invoice-date-box span{color:#7B8580}
      .invoice-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      .invoice-table th{background:#171B19;color:#fff;text-align:left;padding:11px 10px;font-size:9px;letter-spacing:.08em;text-transform:uppercase}
      .invoice-table th:nth-child(n+2),.invoice-table td:nth-child(n+2){text-align:right}
      .invoice-table td{padding:13px 10px;border-bottom:1px solid #E1E6E3;vertical-align:top;color:#525C57}
      .invoice-table td:first-child{color:#171B19}
      .invoice-line-note{font-size:10px;color:#7B8580;margin-top:3px}
      .invoice-totals-wrap{display:grid;grid-template-columns:1fr 330px;gap:36px;margin-top:26px;align-items:start}
      .invoice-notes{display:grid;gap:20px;font-size:11px;line-height:1.5;color:#525C57}
      .invoice-note-box{padding:12px 14px;background:#F0F0F0;border-left:4px solid #333333;color:#525C57}
      .invoice-prewrap{white-space:pre-wrap}
      .invoice-totals{display:grid;font-size:12px}
      .invoice-totals>div{display:flex;justify-content:space-between;gap:20px;padding:8px 2px;border-bottom:1px solid #E1E6E3}
      .invoice-totals span{color:#7B8580}
      .invoice-total-line{font-size:14px;margin-top:3px}
      .invoice-total-line strong{color:#171B19}
      .invoice-balance-line{margin-top:7px!important;padding:13px 12px!important;background:#171B19;border-bottom:0!important;color:#fff;border-radius:3px;font-size:16px}
      .invoice-balance-line span,.invoice-balance-line strong{color:#fff}
      .invoice-footer{margin-top:46px;padding-top:16px;border-top:1px solid #D4DBD7;text-align:center;font-size:10px;color:#7B8580;white-space:pre-wrap}
      .invoice-void{position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:120px;font-weight:900;color:rgba(184,69,88,.10);letter-spacing:.08em;pointer-events:none}
      @media(max-width:720px){.invoice-screen{padding:12px}.invoice-document{padding:34px 24px;min-height:0}.invoice-doc-header{display:grid}.invoice-doc-title{justify-items:start;text-align:left}.invoice-info-grid{grid-template-columns:1fr}.invoice-totals-wrap{grid-template-columns:1fr}.invoice-table{font-size:10px}.invoice-table th,.invoice-table td{padding:8px 5px}.invoice-actions{justify-content:stretch}.invoice-actions>*{flex:1}}
      @page{size:letter;margin:.35in}
      @media print{html,body{background:#fff!important;color-scheme:light}.invoice-screen{padding:0;background:#fff}.invoice-actions{display:none!important}.invoice-document{width:100%;min-height:0;padding:20px 24px;box-shadow:none;border-radius:0}.invoice-document:before{height:5px}.invoice-doc-header{padding-bottom:18px}.invoice-info-grid{padding:18px 0}.invoice-brand img{width:185px}.invoice-totals-wrap{margin-top:18px}.invoice-footer{margin-top:28px}}
      @media print{.invoice-incomplete .invoice-document{display:none!important}}
    `}</style>
    <div className="invoice-actions"><Link className={secondaryLinkClass} href="/financials?tab=billing&view=invoices">Back to Invoices</Link>{state.canPrint&&<PrintButton/>}</div>
    {!state.canPrint&&<p role="status" className="invoice-read-status">{summaryRead.error?'Financial summary unavailable. ':!summary?'Financial summary missing. ':!state.summaryComplete?'Financial amounts or posted-payment basis need review. ':''}{!state.linesComplete?'Complete billing lines unavailable. ':''}Print / Save PDF is unavailable until the required records are loaded.</p>}
    <article className="invoice-document">
      {isVoid&&<div className="invoice-void">VOID</div>}
      <header className="invoice-doc-header">
        <div className="invoice-brand">
          {invoice.from_logo_path&&<img src={invoice.from_logo_path} alt={invoice.from_name}/>}
          <div className="invoice-company-name">{invoice.from_name}</div>
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
          <span className="invoice-status-label">{String(summary?.collection_status||invoice.status).replaceAll('_',' ')}</span>
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
          <strong>{project?.job_number||'Project'} — {project?.name||(projectError?'Job unavailable':'Job record missing')}</strong>
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
        <tbody>{(lines||[]).map((l:any)=><tr key={l.id}><td><strong>{l.description}</strong>{l.notes&&<div className="invoice-line-note">{l.notes}</div>}</td><td>{decimal(l.quantity)}</td><td>{l.unit}</td><td>{money(l.unit_price)}</td><td>{money(l.line_amount)}</td></tr>)}</tbody>
      </table>

      <section className="invoice-totals-wrap">
        <div className="invoice-notes">
          {isRetainage&&<div className="invoice-note-box"><strong>Retainage Release</strong><br/>This invoice releases retainage previously withheld. Sales tax, if applicable, was billed on the original invoice and is not charged again here.</div>}
          {invoice.notes&&<div><div className="invoice-small-label">NOTES</div><div>{invoice.notes}</div></div>}
          {invoice.payment_instructions&&<div><div className="invoice-small-label">PAYMENT / REMITTANCE</div><div className="invoice-prewrap">{invoice.payment_instructions}</div></div>}
        </div>
        <div className="invoice-totals">
          <div><span>Subtotal</span><strong>{money(summary?.subtotal)}</strong></div>
          <div><span>Sales Tax{!isRetainage&&!invoice.sales_tax_exempt&&(num(invoice.sales_tax_rate_percent)??0)>0?` (${decimal(invoice.sales_tax_rate_percent,3)}%)`:''}</span><strong>{money(summary?.sales_tax)}</strong></div>
          {(num(summary?.retainage_held)??0)>0&&<div><span>Retainage Withheld ({decimal(invoice.retainage_percent,1)}%)</span><strong>-{money(summary?.retainage_held)}</strong></div>}
          <div className="invoice-total-line"><span>Invoice Total</span><strong>{money(summary?.invoice_total)}</strong></div>
          {(num(summary?.amount_paid)??0)>0&&<div><span>Posted Payments Applied</span><strong>-{money(summary?.amount_paid)}</strong></div>}
          <div className="invoice-balance-line"><span>Balance Due</span><strong>{money(summary?.balance_due)}</strong></div>
        </div>
      </section>

      <footer className="invoice-footer">{invoice.invoice_footer||'Thank you for your business.'}</footer>
    </article>
  </div>;
}

const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
