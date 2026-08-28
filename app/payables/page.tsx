import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { recordVendorPayment,voidVendorPayment } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const today=()=>new Date().toISOString().slice(0,10);

export default async function PayablesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  const companyId=profile.company_id;
  const [{data:summary},{data:bills},{data:payments}]=await Promise.all([
    supabase.from('company_ap_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('vendor_bill_ap_summary').select('*').eq('company_id',companyId).order('due_date',{ascending:true,nullsFirst:false}).order('bill_date',{ascending:false}),
    supabase.from('vendor_payment_financial_summary').select('*').eq('company_id',companyId).order('payment_date',{ascending:false}).order('created_at',{ascending:false})
  ]);
  const open=(bills||[]).filter((b:any)=>b.status==='posted'&&num(b.balance_due)>0);
  const paid=(bills||[]).filter((b:any)=>b.payment_status==='paid');
  const s:any=summary||{};
  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Accounts Payable</h1><p className="subtitle">Vendor bills, due dates, aging and actual vendor cash payments. Paying a bill changes cash—not job cost.</p></div><Link className="button secondary" href="/procurement">Procurement</Link></div>

    <div className="grid grid4">
      <div className="card"><div className="label">Open A/P</div><div className="value">{money(num(s.open_ap))}</div><div className="meta">{num(s.open_bill_count)} unpaid posted bill(s)</div></div>
      <div className={`card ${num(s.overdue_ap)>0?'elevated':''}`}><div className="label">Overdue A/P</div><div className="value">{money(num(s.overdue_ap))}</div><div className="meta">Past vendor due date</div></div>
      <div className="card"><div className="label">Due Next 7 Days</div><div className="value">{money(num(s.due_next_7_days))}</div><div className="meta">Upcoming cash requirement</div></div>
      <div className="card"><div className="label">90+ Days</div><div className="value">{money(num(s.ap_90_plus))}</div><div className="meta">Highest-priority aging bucket</div></div>
    </div>

    <div className="alert info"><strong>Accounting rule:</strong> the vendor bill becomes project cost when it is posted from Procurement. A payment reduces A/P and records cash out only; it does not post the expense to the project a second time.</div>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Aging</div><div className="section-title">A/P Aging</div><div className="section-heading-meta">Open posted vendor liabilities by age.</div></div></div>
      <div className="metric-grid">
        <div className="metric-card brand"><div className="label">Current</div><div className="metric-value">{money(num(s.current_ap))}</div></div>
        <div className="metric-card"><div className="label">1–30</div><div className="metric-value">{money(num(s.ap_1_30))}</div></div>
        <div className={`metric-card ${num(s.ap_31_60)>0?'warning':''}`}><div className="label">31–60</div><div className="metric-value">{money(num(s.ap_31_60))}</div></div>
        <div className={`metric-card ${num(s.ap_61_90)+num(s.ap_90_plus)>0?'danger-metric':''}`}><div className="label">61+ Days</div><div className="metric-value">{money(num(s.ap_61_90)+num(s.ap_90_plus))}</div></div>
      </div>
    </section>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Pay</div><div className="section-title">Open Vendor Bills</div><div className="section-heading-meta">Partial payments are supported. The database also supports multiple bill allocations per payment for future batch-pay workflows.</div></div></div>
      <div className="project-list">{open.length===0?<div className="card"><div className="title">No open vendor bills</div><div className="meta">Posted bills from Procurement will appear here automatically.</div></div>:open.map((b:any)=>{
        const overdue=num(b.days_overdue)>0;
        return <article className="project-card" key={b.vendor_bill_id}>
          <header className="project-header"><div><div className="project-name">{b.vendor_name} — {b.vendor_bill_number}</div><div className="project-location">{b.job_number} — {b.project_name} · Bill {b.bill_date}{b.due_date?` · Due ${b.due_date}`:' · No due date'}</div></div><span className={`status ${overdue?'on-hold':'active'}`}>{overdue?`${b.days_overdue} days overdue`:b.payment_status}</span></header>
          <section className="project-section"><div className="metric-grid">
            <div className="metric-card"><div className="label">Bill Total</div><div className="metric-value">{money(num(b.total_cost))}</div><div className="metric-detail">Tax {money(num(b.sales_tax))}</div></div>
            <div className="metric-card positive"><div className="label">Paid</div><div className="metric-value">{money(num(b.paid_amount))}</div></div>
            <div className={`metric-card ${overdue?'danger-metric':'brand'}`}><div className="label">Balance Due</div><div className="metric-value">{money(num(b.balance_due))}</div><div className="metric-detail">Aging {b.aging_bucket}</div></div>
            <div className="metric-card"><div className="label">PO</div><div className="metric-value" style={{fontSize:18}}>{b.purchase_order_id?'Linked':'No PO'}</div><div className="metric-detail">{b.line_count} cost line(s)</div></div>
          </div>
          <details className="controls-disclosure section"><summary>Record Payment</summary><div className="controls-body"><form action={recordVendorPayment} className="form">
            <input type="hidden" name="vendor_bill_id" value={b.vendor_bill_id}/>
            <div className="grid grid2"><label className="field"><span>Payment Date</span><input type="date" name="payment_date" defaultValue={today()}/></label><label className="field"><span>Amount</span><input type="number" name="amount" min="0.01" step="0.01" max={num(b.balance_due)} defaultValue={num(b.balance_due).toFixed(2)} required/></label></div>
            <div className="grid grid2"><label className="field"><span>Method</span><select name="payment_method" defaultValue="check"><option value="check">Check</option><option value="ach">ACH</option><option value="card">Card</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></label><label className="field"><span>Reference / Check #</span><input name="reference_number"/></label></div>
            <label className="field"><span>Payment / Transaction Fee</span><input type="number" name="processing_fee" min="0" step="0.01" defaultValue="0"/><span className="meta">Tracked as additional cash out; not automatically assigned to job cost.</span></label>
            <label className="field"><span>Notes</span><input name="notes"/></label>
            <button className="button">Post Vendor Payment</button>
          </form></div></details>
          </section>
        </article>;
      })}</div>
    </section>

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">History</div><div className="section-title">Vendor Payments</div></div></div>
      <div className="card"><div className="list">{(payments||[]).length===0?<div className="meta">No vendor payments recorded.</div>:(payments||[]).map((p:any)=><div className="row" key={p.vendor_payment_id}><div><div className="title">{p.vendor_name} · {money(num(p.amount))}</div><div className="meta">{p.payment_date} · {String(p.payment_method).toUpperCase()} {p.reference_number?`· ${p.reference_number}`:''} · Allocated {money(num(p.allocated_amount))}{num(p.processing_fee)>0?` · Fee ${money(num(p.processing_fee))}`:''}</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><span className={`status ${p.status==='posted'?'completed':'on-hold'}`}>{p.status}</span>{p.status==='posted'&&<form action={voidVendorPayment}><input type="hidden" name="vendor_payment_id" value={p.vendor_payment_id}/><button className="button secondary">Void</button></form>}</div></div>)}</div></div>
    </section>

    {paid.length>0&&<details className="controls-disclosure section"><summary>Paid Vendor Bills ({paid.length})</summary><div className="controls-body"><div className="list">{paid.map((b:any)=><div className="row" key={b.vendor_bill_id}><div><div className="title">{b.vendor_name} — {b.vendor_bill_number}</div><div className="meta">{b.job_number} · {money(num(b.total_cost))} · Paid in full</div></div><span className="status completed">paid</span></div>)}</div></div></details>}
  </AppShell>;
}
