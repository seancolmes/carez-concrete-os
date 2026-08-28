import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createPayrollRun,approvePayrollRun,processPayrollRun,voidPayrollRun } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const statusClass=(s:string)=>s==='processed'?'completed':s==='approved'?'active':s==='void'?'on-hold':'';

export default async function PayrollPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  const companyId=profile.company_id;
  const [{data:summary},{data:workers},{data:runs},{data:lines},{data:cash}]=await Promise.all([
    supabase.from('company_payroll_cash_summary').select('*').eq('company_id',companyId).maybeSingle(),
    supabase.from('payroll_unprocessed_worker_summary').select('*').eq('company_id',companyId).order('worker_name'),
    supabase.from('payroll_run_financial_summary').select('*').eq('company_id',companyId).order('period_end',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('payroll_run_lines').select('*').eq('company_id',companyId).order('work_date'),
    supabase.from('company_cash_position_summary').select('bank_cash,balance_as_of,accounts_with_balance,active_cash_accounts,safe_cash_after_known_obligations,payroll_cash_requirement').eq('company_id',companyId).maybeSingle()
  ]);
  const s:any=summary||{},c:any=cash||{};
  const linesByRun=new Map<string,any[]>();for(const l of lines||[]){if(!linesByRun.has(l.payroll_run_id))linesByRun.set(l.payroll_run_id,[]);linesByRun.get(l.payroll_run_id)!.push(l);}
  const cashReady=Boolean(c.balance_as_of)&&num(c.active_cash_accounts)>0&&num(c.accounts_with_balance)>=num(c.active_cash_accounts);
  const today=localDate();

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading">
      <div><h1 className="page-title">Payroll</h1><p className="subtitle">Turn W-2 field time into a visible payroll funding requirement before cash leaves the company.</p></div>
      <div className="action-row"><Link href="/field" className="button secondary">Field Time</Link><Link href="/cashflow" className="button secondary">Cashflow</Link></div>
    </div>

    <div className="grid grid4">
      <div className="card"><div className="label">Open Payroll Funding</div><div className="value">{money(num(s.total_open_payroll_requirement))}</div><div className="meta">Automatically protected in Safe Operating Cash.</div></div>
      <div className="card"><div className="label">Gross Wages Pending</div><div className="value">{money(num(s.unprocessed_gross_wages))}</div><div className="meta">Unprocessed W-2 timecards only.</div></div>
      <div className="card"><div className="label">Employer Tax + L&I</div><div className="value">{money(num(s.unprocessed_employer_payroll_taxes)+num(s.unprocessed_li))}</div><div className="meta">Employer-side burden currently accrued.</div></div>
      <div className="card"><div className="label">Future Sick Reserve</div><div className="value">{money(num(s.future_sick_leave_reserve))}</div><div className="meta">Tracked separately; not treated as current payroll cash due.</div></div>
    </div>

    <div className={`alert ${cashReady&&num(c.safe_cash_after_known_obligations)<0?'danger':'info'}`}><strong>Funding basis:</strong> Carez protects gross W-2 wages plus employer Social Security, Medicare, FUTA, WA unemployment and L&I. Employee withholding/net-pay details are not estimated here. Owner internal labor and subcontractors are excluded from W-2 payroll.</div>

    <div className="toolbar">
      <div><div className="section-kicker">Current Liability</div><div className="section-title">Unprocessed Field Time</div><div className="section-heading-meta">Time entered in Field stays here until it is captured by a payroll run.</div></div>
      <details className="controls-disclosure create-disclosure"><summary>Create Payroll Run</summary><div className="controls-body"><form action={createPayrollRun} className="form">
        <div className="grid grid2"><label className="field"><span>Period Start</span><input type="date" name="period_start" required/></label><label className="field"><span>Period End</span><input type="date" name="period_end" required/></label></div>
        <label className="field"><span>Expected Pay Date</span><input type="date" name="pay_date" defaultValue={today}/></label>
        <label className="field"><span>Notes</span><textarea name="notes" rows={3} placeholder="Optional payroll-period note"/></label>
        <button className="button">Create Payroll Run</button>
      </form></div></details>
    </div>

    {(workers||[]).length===0?<div className="empty-state"><div><div className="title">No unprocessed W-2 field time</div><div className="meta">New employee timecards will appear here automatically.</div></div></div>:
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Worker</th><th>Timecards</th><th>Hours</th><th>Gross Wages</th><th>Employer Taxes</th><th>L&I</th><th>Funding Required</th></tr></thead><tbody>{(workers||[]).map((w:any)=><tr key={w.crew_member_id}><td><strong>{w.worker_name}</strong><div className="meta">{w.first_unprocessed_date} – {w.last_unprocessed_date}</div></td><td>{w.timecard_count}</td><td>{(num(w.regular_hours)+num(w.overtime_hours)).toFixed(2)}<div className="meta">OT {num(w.overtime_hours).toFixed(2)}</div></td><td>{money(num(w.gross_wages))}</td><td>{money(num(w.employer_payroll_taxes))}</td><td>{money(num(w.employer_li))}</td><td><strong>{money(num(w.payroll_funding_requirement))}</strong></td></tr>)}</tbody></table></div>}

    <section className="section">
      <div className="section-heading"><div><div className="section-kicker">Payroll History</div><div className="section-title">Payroll Runs</div><div className="section-heading-meta">Create → Review/Approve → Process. Processed runs stop reserving payroll cash.</div></div></div>
      <div className="project-list">{(runs||[]).length===0?<div className="empty-state"><div><div className="title">No payroll runs yet</div><div className="meta">Create a run when you are ready to group field time into a pay period.</div></div></div>:(runs||[]).map((r:any)=>{
        const runLines=(linesByRun.get(r.payroll_run_id)||[]).filter((x:any)=>x.active);
        const workerTotals=new Map<string,{name:string,hours:number,gross:number,funding:number}>();
        for(const l of runLines){const key=l.crew_member_id||l.worker_name;const x=workerTotals.get(key)||{name:l.worker_name,hours:0,gross:0,funding:0};x.hours+=num(l.regular_hours)+num(l.overtime_hours);x.gross+=num(l.gross_wages);x.funding+=num(l.payroll_funding_requirement);workerTotals.set(key,x);}
        return <article className="project-card" key={r.payroll_run_id}>
          <header className="project-header"><div><div className="project-name">{r.period_start} – {r.period_end}</div><div className="project-location">Pay date {r.pay_date||'not set'} · {r.worker_count} worker(s) · {r.timecard_count} timecard(s)</div></div><span className={`status ${statusClass(r.status)}`}>{r.status}</span></header>
          <section className="project-section"><div className="metric-grid">
            <div className="metric-card"><div className="label">Gross Wages</div><div className="metric-value">{money(num(r.gross_wages))}</div></div>
            <div className="metric-card"><div className="label">Employer Taxes</div><div className="metric-value">{money(num(r.employer_payroll_taxes))}</div></div>
            <div className="metric-card"><div className="label">L&I</div><div className="metric-value">{money(num(r.employer_li))}</div></div>
            <div className={`metric-card ${r.status==='processed'?'positive':'brand'}`}><div className="label">Funding Requirement</div><div className="metric-value">{money(num(r.payroll_funding_requirement))}</div><div className="metric-detail">Sick reserve {money(num(r.sick_leave_reserve))} shown separately</div></div>
          </div>
          {workerTotals.size>0&&<div className="data-table-wrap section"><table className="data-table" style={{minWidth:520}}><thead><tr><th>Worker</th><th>Hours</th><th>Gross</th><th>Funding</th></tr></thead><tbody>{[...workerTotals.values()].map(x=><tr key={x.name}><td>{x.name}</td><td>{x.hours.toFixed(2)}</td><td>{money(x.gross)}</td><td>{money(x.funding)}</td></tr>)}</tbody></table></div>}
          <div className="action-row">
            {r.status==='draft'&&<form action={approvePayrollRun}><input type="hidden" name="payroll_run_id" value={r.payroll_run_id}/><button className="button">Approve Funding</button></form>}
            {r.status==='approved'&&<details className="controls-disclosure create-disclosure"><summary>Mark Payroll Processed</summary><div className="controls-body"><form action={processPayrollRun} className="form"><input type="hidden" name="payroll_run_id" value={r.payroll_run_id}/><div className="alert warn"><strong>Use this after payroll is actually processed.</strong> This removes the run from Safe Operating Cash obligations. Refresh the bank balance in Cashflow after the money clears.</div><label className="field"><span>Actual Cash Paid (optional)</span><input type="number" min="0" step="0.01" name="actual_cash_paid" placeholder={num(r.payroll_funding_requirement).toFixed(2)}/></label><label className="field"><span>Payroll / Check Reference</span><input name="reference_number"/></label><button className="button">Mark Processed</button></form></div></details>}
            {(r.status==='draft'||r.status==='approved')&&<form action={voidPayrollRun}><input type="hidden" name="payroll_run_id" value={r.payroll_run_id}/><button className="button secondary">Void Run</button></form>}
            {r.status==='processed'&&<div className="meta">Processed {r.processed_at?new Date(r.processed_at).toLocaleDateString('en-US'):''}{r.actual_cash_paid!==null?` · Actual cash ${money(num(r.actual_cash_paid))}`:''}{r.reference_number?` · Ref ${r.reference_number}`:''}</div>}
          </div>
          </section>
        </article>;
      })}</div>
    </section>
  </AppShell>;
}
