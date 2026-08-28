import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { addCompanyExpense,markCompanyExpensePaid,voidCompanyExpense,addCashAccount,recordCashBalance,addCashReserve,releaseCashReserve,recordTaxRemittance,deleteTaxRemittance } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const daysOld=(d:string|null)=>d?Math.floor((Date.now()-new Date(`${d}T12:00:00-07:00`).getTime())/86400000):9999;
const reserveTypes=[['payroll','Payroll'],['payroll_tax','Payroll Taxes'],['bo_tax','B&O Tax'],['li','L&I'],['emergency','Emergency Buffer'],['owner','Owner Reserve'],['other','Other']];

export default async function CashflowPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');
  const companyId=profile.company_id;
  const [{data:cash},{data:plan},{data:expenseSummary},{data:categories},{data:expenses},{data:overheadItems},{data:accounts},{data:balances},{data:reserves},{data:remittances}]=await Promise.all([
    supabase.from('company_cash_position_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('company_operating_overhead_plan_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('company_expense_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('company_expense_category_current_month').select('*').eq('company_id',companyId).order('category'),
    supabase.from('company_expenses').select('*').eq('company_id',companyId).order('expense_date',{ascending:false}).order('created_at',{ascending:false}).limit(100),
    supabase.from('overhead_items').select('id,category,name,business_use_percent,frequency,amount,active').eq('company_id',companyId).eq('active',true).order('sort_order'),
    supabase.from('company_cash_accounts').select('*').eq('company_id',companyId).order('active',{ascending:false}).order('name'),
    supabase.from('company_cash_balance_snapshots').select('*').eq('company_id',companyId).order('balance_date',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('company_cash_reserves').select('*').eq('company_id',companyId).order('active',{ascending:false}).order('due_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
    supabase.from('company_tax_remittances').select('*').eq('company_id',companyId).order('payment_date',{ascending:false}).order('created_at',{ascending:false}).limit(50)
  ]);
  const c:any=cash||{},p:any=plan||{},es:any=expenseSummary||{};
  const latestBalance=new Map<string,any>();for(const b of balances||[]){if(!latestBalance.has(b.cash_account_id))latestBalance.set(b.cash_account_id,b);}
  const balanceConfigured=Boolean(c.balance_as_of)&&num(c.accounts_with_balance)>0;
  const stale=balanceConfigured&&daysOld(c.balance_as_of)>3;
  const knownObligations=num(c.sales_tax_reserve)+num(c.open_ap)+num(c.open_po_commitments)+num(c.unpaid_company_expense_obligations)+num(c.manual_reserves);
  const monthlyPlan=num(p.monthly_operating_overhead_plan),monthActual=num(es.current_month_business_expense),monthVariance=monthActual-monthlyPlan;
  const activeReserves=(reserves||[]).filter((r:any)=>r.active);
  const unpaidExpenses=(expenses||[]).filter((e:any)=>e.payment_status==='unpaid');
  const recentExpenses=(expenses||[]).filter((e:any)=>e.payment_status!=='void').slice(0,30);
  const categoryNames=[...new Set((overheadItems||[]).map((i:any)=>i.category))];

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Cashflow</h1><p className="subtitle">Actual company overhead, current cash, restricted money and known obligations. Project cost remains separate.</p></div><div className="action-row"><Link className="button secondary" href="/overhead">Overhead Plan</Link><Link className="button secondary" href="/payables">A/P</Link></div></div>

    <div className="grid grid4">
      <div className={`card ${!balanceConfigured?'elevated':''}`}><div className="label">Bank / Cash Balance</div><div className="value">{balanceConfigured?money(num(c.bank_cash)):'Not entered'}</div><div className="meta">{balanceConfigured?`Balance basis as of ${c.balance_as_of}`:'Enter a balance snapshot before relying on cash availability.'}</div></div>
      <div className="card"><div className="label">Restricted Sales Tax</div><div className="value">{money(num(c.sales_tax_reserve))}</div><div className="meta">Collected sales tax less recorded sales-tax remittances</div></div>
      <div className="card"><div className="label">Known Obligations</div><div className="value">{money(knownObligations)}</div><div className="meta">A/P + issued POs + unpaid overhead + reserves + sales tax</div></div>
      <div className={`card ${balanceConfigured&&num(c.safe_cash_after_known_obligations)<0?'elevated':''}`}><div className="label">Safe Operating Cash</div><div className="value">{balanceConfigured?money(num(c.safe_cash_after_known_obligations)):'Unavailable'}</div><div className="meta">Bank cash after known obligations; not a forecast of uncommitted future work.</div></div>
    </div>

    {!balanceConfigured&&<div className="alert danger"><strong>Cash availability withheld.</strong> Carez OS has no bank/cash balance snapshot yet, so it will not pretend the company has $0—or any other amount—available.</div>}
    {stale&&<div className="alert warn"><strong>Cash balance may be stale.</strong> The oldest account balance supporting this position is from {c.balance_as_of}. Refresh balances before authorizing major spending.</div>}
    {balanceConfigured&&num(c.safe_cash_after_known_obligations)<0&&<div className="alert danger"><strong>Known obligations exceed entered cash by {money(Math.abs(num(c.safe_cash_after_known_obligations)))}.</strong> Review collections, A/P timing, PO commitments and reserves before adding commitments.</div>}

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Cash Position</div><div className="section-title">What Is Protecting / Consuming Cash</div><div className="section-heading-meta">A/R and unbilled contract value are intentionally excluded until cash is actually received.</div></div></div>
      <div className="metric-grid">
        <div className="metric-card"><div className="label">Open Vendor A/P</div><div className="metric-value">{money(num(c.open_ap))}</div><div className="metric-detail">Due next 7 days {money(num(c.ap_due_next_7_days))} · Overdue {money(num(c.overdue_ap))}</div></div>
        <div className="metric-card"><div className="label">Issued PO Commitments</div><div className="metric-value">{money(num(c.open_po_commitments))}</div><div className="metric-detail">Committed purchases not yet converted to actual vendor cost</div></div>
        <div className="metric-card"><div className="label">Unpaid Company Expenses</div><div className="metric-value">{money(num(c.unpaid_company_expense_obligations))}</div><div className="metric-detail">{num(es.unpaid_company_expense_count)} operating bill(s)</div></div>
        <div className="metric-card"><div className="label">Manual Cash Reserves</div><div className="metric-value">{money(num(c.manual_reserves))}</div><div className="metric-detail">Payroll, taxes, emergency and other owner-set reserves</div></div>
      </div>
    </section>

    <div className="split section">
      <details className="controls-disclosure create-disclosure" open={!balanceConfigured}><summary>Update Bank / Cash Balance</summary><div className="controls-body"><form action={recordCashBalance} className="form">
        <div className="grid grid2"><label className="field"><span>Cash Account</span><select name="cash_account_id" required defaultValue=""><option value="" disabled>Select account</option>{(accounts||[]).filter((a:any)=>a.active).map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label className="field"><span>Balance Date</span><input type="date" name="balance_date" defaultValue={today()}/></label></div>
        <label className="field"><span>Current Balance</span><input type="number" name="balance" step="0.01" required/></label><label className="field"><span>Notes</span><input name="notes" placeholder="Optional reconciliation note"/></label><button className="button">Save Balance Snapshot</button>
      </form>
      <div className="list section">{(accounts||[]).filter((a:any)=>a.active).map((a:any)=>{const b=latestBalance.get(a.id);return <div className="row" key={a.id}><div><div className="title">{a.name}</div><div className="meta">{a.account_type}</div></div><strong>{b?`${money(num(b.balance))} · ${b.balance_date}`:'No balance yet'}</strong></div>})}</div>
      </div></details>
      <details className="controls-disclosure"><summary>Add Cash Account</summary><div className="controls-body"><form action={addCashAccount} className="form"><label className="field"><span>Account Name</span><input name="name" required placeholder="Business Savings"/></label><label className="field"><span>Type</span><select name="account_type" defaultValue="checking"><option value="checking">Checking</option><option value="savings">Savings</option><option value="cash">Cash</option><option value="other">Other</option></select></label><label className="field"><span>Notes</span><input name="notes"/></label><button className="button secondary">Add Account</button></form></div></details>
    </div>

    <section className="section"><div className="section-heading"><div><div className="section-kicker">Operating Overhead</div><div className="section-title">Plan vs Actual — Current Month</div><div className="section-heading-meta">This compares actual operating expenses to normalized non-owner overhead plan. Owner management allowance remains a pricing target, not an operating-expense transaction.</div></div></div>
      <div className="metric-grid">
        <div className="metric-card brand"><div className="label">Monthly Operating Plan</div><div className="metric-value">{money(monthlyPlan)}</div><div className="metric-detail">Annual operating plan {money(num(p.annual_operating_overhead_plan))}</div></div>
        <div className="metric-card"><div className="label">Actual This Month</div><div className="metric-value">{money(monthActual)}</div><div className="metric-detail">Business-use expense basis</div></div>
        <div className={`metric-card ${monthVariance>0?'warning':'positive'}`}><div className="label">Monthly Variance</div><div className="metric-value">{money(monthVariance)}</div><div className="metric-detail">Positive = spending above normalized plan</div></div>
        <div className="metric-card"><div className="label">Actual YTD</div><div className="metric-value">{money(num(es.ytd_business_expense))}</div><div className="metric-detail">Company cash paid YTD {money(num(es.ytd_company_cash_paid))}</div></div>
      </div>
      <div className="card section"><div className="list">{(categories||[]).map((x:any)=><div className="row" key={x.category}><div><div className="title">{x.category}</div><div className="meta">Monthly plan {money(num(x.planned_monthly))}</div></div><div style={{textAlign:'right'}}><strong>{money(num(x.actual_monthly))} actual</strong><div className="meta">Variance {money(num(x.variance))}</div></div></div>)}</div></div>
    </section>

    <details className="controls-disclosure create-disclosure section"><summary>Record Company Expense</summary><div className="controls-body"><form action={addCompanyExpense} className="form">
      <div className="grid grid2"><label className="field"><span>Expense Date</span><input type="date" name="expense_date" defaultValue={today()}/></label><label className="field"><span>Planned Overhead Item (optional)</span><select name="overhead_item_id" defaultValue=""><option value="">Unlinked / other expense</option>{(overheadItems||[]).map((i:any)=><option key={i.id} value={i.id}>{i.category} — {i.name}</option>)}</select></label></div>
      <div className="grid grid2"><label className="field"><span>Category</span><select name="category" defaultValue={categoryNames[0]||'Other'}>{categoryNames.map(c=><option key={c} value={c}>{c}</option>)}<option value="Other">Other</option></select></label><label className="field"><span>Payee</span><input name="payee" placeholder="Microsoft, insurance carrier, fuel station..."/></label></div>
      <label className="field"><span>Description</span><input name="description" required/></label>
      <div className="grid grid2"><label className="field"><span>Subtotal</span><input type="number" name="subtotal" min="0" step="0.01" required/></label><label className="field"><span>Sales Tax / Fees</span><input type="number" name="sales_tax" min="0" step="0.01" defaultValue="0"/></label></div>
      <div className="grid grid2"><label className="field"><span>Business Use %</span><input type="number" name="business_use_percent" min="0" max="100" step="0.01" placeholder="Leave blank to use linked plan item"/><span className="meta">If linked above and blank, Carez uses that plan item's business-use percentage.</span></label><label className="field"><span>Cash Source</span><select name="cash_source" defaultValue="company_account"><option value="company_account">Carez company account</option><option value="personal">Paid personally</option><option value="noncash">Non-cash allocation</option><option value="other">Other</option></select></label></div>
      <div className="grid grid2"><label className="field"><span>Payment Status</span><select name="payment_status" defaultValue="paid"><option value="paid">Paid</option><option value="unpaid">Unpaid / owed</option></select></label><label className="field"><span>Due Date (if unpaid)</span><input type="date" name="due_date"/></label></div>
      <div className="grid grid2"><label className="field"><span>Paid Date</span><input type="date" name="paid_date" defaultValue={today()}/></label><label className="field"><span>Payment Method</span><select name="payment_method" defaultValue="card"><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></label></div>
      <div className="grid grid2"><label className="field"><span>Reference</span><input name="reference_number"/></label><label className="field"><span>Receipt / Statement Ref</span><input name="receipt_reference"/></label></div><label className="field"><span>Notes</span><input name="notes"/></label><button className="button">Record Expense</button>
    </form></div></details>

    {unpaidExpenses.length>0&&<section className="section"><div className="section-heading"><div><div className="section-kicker">Operating Bills</div><div className="section-title">Unpaid Company Expenses</div></div></div><div className="project-list">{unpaidExpenses.map((e:any)=><article className="project-card" key={e.id}><header className="project-header"><div><div className="project-name">{e.payee||e.category} — {e.description}</div><div className="project-location">{e.expense_date}{e.due_date?` · Due ${e.due_date}`:''}</div></div><span className="status on-hold">unpaid</span></header><section className="project-section"><div className="metric-grid"><div className="metric-card brand"><div className="label">Amount Owed</div><div className="metric-value">{money(num(e.total_amount))}</div></div><div className="metric-card"><div className="label">Business Expense</div><div className="metric-value">{money(num(e.business_expense_amount))}</div><div className="metric-detail">{num(e.business_use_percent).toFixed(1)}% business use</div></div></div><details className="controls-disclosure section"><summary>Mark Paid</summary><div className="controls-body"><form action={markCompanyExpensePaid} className="form"><input type="hidden" name="expense_id" value={e.id}/><div className="grid grid2"><label className="field"><span>Paid Date</span><input type="date" name="paid_date" defaultValue={today()}/></label><label className="field"><span>Method</span><select name="payment_method" defaultValue="card"><option value="card">Card</option><option value="ach">ACH</option><option value="check">Check</option><option value="cash">Cash</option><option value="wire">Wire</option><option value="other">Other</option></select></label></div><label className="field"><span>Reference</span><input name="reference_number"/></label><button className="button">Mark Paid</button></form></div></details></section></article>)}</div></section>}

    <div className="split section">
      <details className="controls-disclosure create-disclosure"><summary>Add Cash Reserve</summary><div className="controls-body"><form action={addCashReserve} className="form"><label className="field"><span>Reserve</span><select name="reserve_type" defaultValue="payroll">{reserveTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className="field"><span>Name</span><input name="name" required placeholder="Next payroll"/></label><div className="grid grid2"><label className="field"><span>Amount</span><input type="number" name="amount" min="0.01" step="0.01" required/></label><label className="field"><span>Due Date</span><input type="date" name="due_date"/></label></div><label className="field"><span>Notes</span><input name="notes"/></label><button className="button">Protect Cash</button></form></div></details>
      <details className="controls-disclosure"><summary>Active Reserves ({activeReserves.length})</summary><div className="controls-body"><div className="list">{activeReserves.length===0?<div className="meta">No manual reserves.</div>:activeReserves.map((x:any)=><div className="row" key={x.id}><div><div className="title">{x.name}</div><div className="meta">{String(x.reserve_type).replaceAll('_',' ')}{x.due_date?` · Due ${x.due_date}`:''}</div></div><div style={{display:'flex',gap:10,alignItems:'center'}}><strong>{money(num(x.amount))}</strong><form action={releaseCashReserve}><input type="hidden" name="reserve_id" value={x.id}/><button className="button secondary">Release</button></form></div></div>)}</div></div></details>
    </div>

    <div className="split section">
      <details className="controls-disclosure"><summary>Record Tax Remittance</summary><div className="controls-body"><form action={recordTaxRemittance} className="form"><div className="grid grid2"><label className="field"><span>Tax Type</span><select name="tax_type" defaultValue="sales_tax"><option value="sales_tax">Sales Tax</option><option value="bo">B&O</option><option value="payroll">Payroll Tax</option><option value="li">L&I</option><option value="other">Other</option></select></label><label className="field"><span>Payment Date</span><input type="date" name="payment_date" defaultValue={today()}/></label></div><label className="field"><span>Amount Remitted</span><input type="number" name="amount" min="0.01" step="0.01" required/></label><label className="field"><span>Reference</span><input name="reference_number"/></label><label className="field"><span>Notes</span><input name="notes"/></label><button className="button secondary">Record Remittance</button></form></div></details>
      <details className="controls-disclosure"><summary>Tax Remittance History</summary><div className="controls-body"><div className="list">{(remittances||[]).length===0?<div className="meta">No tax remittances recorded.</div>:(remittances||[]).map((x:any)=><div className="row" key={x.id}><div><div className="title">{String(x.tax_type).replaceAll('_',' ')} · {money(num(x.amount))}</div><div className="meta">{x.payment_date}{x.reference_number?` · ${x.reference_number}`:''}</div></div><form action={deleteTaxRemittance}><input type="hidden" name="remittance_id" value={x.id}/><button className="button secondary">Delete</button></form></div>)}</div></div></details>
    </div>

    <details className="controls-disclosure section"><summary>Recent Company Expenses ({recentExpenses.length})</summary><div className="controls-body"><div className="list">{recentExpenses.length===0?<div className="meta">No actual company expenses recorded yet.</div>:recentExpenses.map((e:any)=><div className="row" key={e.id}><div><div className="title">{e.payee?`${e.payee} — `:''}{e.description}</div><div className="meta">{e.expense_date} · {e.category} · Business {money(num(e.business_expense_amount))} · {String(e.cash_source).replaceAll('_',' ')}</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><strong>{money(num(e.total_amount))}</strong><span className={`status ${e.payment_status==='paid'?'completed':'on-hold'}`}>{e.payment_status}</span><form action={voidCompanyExpense}><input type="hidden" name="expense_id" value={e.id}/><button className="button secondary">Void</button></form></div></div>)}</div></div></details>
  </AppShell>;
}
