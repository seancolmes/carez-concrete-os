import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { Plus, Briefcase, Hammer, ShoppingCart, ReceiptText, Wallet, ShieldCheck, Banknote } from 'lucide-react';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);

export default async function Dashboard(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
  const [{data:projects},{data:leads},{data:billing},{data:ap},{data:cash}]=await Promise.all([
    supabase.from('projects').select('*').order('created_at',{ascending:false}),
    supabase.from('leads').select('*').order('created_at',{ascending:false}),
    supabase.from('project_billing_summary').select('*'),
    supabase.from('company_ap_summary').select('*').maybeSingle(),
    profile?.company_id?supabase.from('company_cash_position_summary').select('*').eq('company_id',profile.company_id).maybeSingle():Promise.resolve({data:null})
  ]);
  const active=(projects||[]).filter(p=>p.status==='active');
  const activeIds=new Set(active.map(p=>p.id));
  const open=(leads||[]).filter(l=>!['won','lost'].includes(l.status));
  const activeBilling=(billing||[]).filter((b:any)=>activeIds.has(b.project_id));
  const backlog=activeBilling.reduce((s:number,b:any)=>s+Math.max(0,Number(b.unbilled_contract||0)),0);
  const outstandingAR=(billing||[]).reduce((s:number,b:any)=>s+Math.max(0,Number(b.outstanding_ar||0)),0);
  const overdueAR=(billing||[]).reduce((s:number,b:any)=>s+Math.max(0,Number(b.overdue_ar||0)),0);
  const openAP=Number(ap?.open_ap||0),overdueAP=Number(ap?.overdue_ap||0),dueNext7=Number(ap?.due_next_7_days||0);
  const cashConfigured=Boolean(cash?.balance_as_of)&&Number(cash?.active_cash_accounts||0)>0&&Number(cash?.accounts_with_balance||0)>=Number(cash?.active_cash_accounts||0);
  const safeCash=Number(cash?.safe_cash_after_known_obligations||0),payrollFunding=Number(cash?.payroll_cash_requirement||0);
  const name=profile?.full_name||user.email||'Owner';
  const attention=[
    ...(open.length===0?[{tone:'bad',title:'No work in the pipeline',copy:'There are no open leads or bids. Add every possible job so Carez can track follow-up.',href:'/leads',action:'Add Lead'}]:[]),
    ...(overdueAR>0?[{tone:'bad',title:`Customers owe us ${money(overdueAR)} past due`,copy:'This money is late. Review the invoices and follow up for payment.',href:'/billing',action:'Review Billing'}]:[]),
    ...(overdueAP>0?[{tone:'bad',title:`${money(overdueAP)} in vendor bills is overdue`,copy:'These are bills Carez already owes and should be addressed.',href:'/payables',action:'Review Bills'}]:[]),
    ...(cashConfigured&&safeCash<0?[{tone:'bad',title:`We are short ${money(Math.abs(safeCash))} after known commitments`,copy:'Current cash does not cover payroll, vendor bills, POs, taxes and reserves already spoken for.',href:'/cashflow',action:'Review Cash'}]:[]),
    ...(!cashConfigured?[{tone:'watch',title:'Cash position needs attention',copy:'Not every active cash account has a current balance. Banking/Cashflow cannot give a trustworthy safe-to-spend number yet.',href:'/banking',action:'Check Banking'}]:[]),
    ...(payrollFunding>0?[{tone:'watch',title:`Protect ${money(payrollFunding)} for payroll`,copy:'This is the current W-2 payroll funding requirement from field time already entered.',href:'/payroll',action:'Review Payroll'}]:[]),
  ];

  return <AppShell userName={name}>
    <div className="contractor-page">
      <div className="command-hero"><div><h1>Home</h1><p>Your jobsite-style command center. See what needs attention, then get back to the work.</p></div><div className="command-actions"><Link className="button" href="/leads"><Plus size={15}/> Add Lead</Link><Link className="button secondary" href="/field"><Hammer size={15}/> Enter Field Time</Link></div></div>

      <div className="command-grid">
        <div className="command-card"><div className="command-label">Jobs Running</div><div className="command-value">{active.length}</div><div className="command-help">Active projects Carez is currently tracking.</div></div>
        <div className={`command-card ${open.length===0?'bad':''}`}><div className="command-label">Jobs in the Pipeline</div><div className="command-value">{open.length}</div><div className="command-help">Leads and bids that could turn into work.</div></div>
        <div className={`command-card ${overdueAR>0?'watch':''}`}><div className="command-label">Money Customers Owe Us</div><div className="command-value">{money(outstandingAR)}</div><div className="command-help">{overdueAR>0?`${money(overdueAR)} is past due.`:'Nothing is currently overdue.'}</div></div>
        <div className={`command-card ${overdueAP>0?'watch':''}`}><div className="command-label">Bills We Owe</div><div className="command-value">{money(openAP)}</div><div className="command-help">{dueNext7>0?`${money(dueNext7)} is due in the next 7 days.`:'No vendor bills due this week.'}</div></div>
        <div className={`command-card ${payrollFunding>0?'watch':''}`}><div className="command-label">Money Needed for Payroll</div><div className="command-value">{money(payrollFunding)}</div><div className="command-help">Wages plus Carez payroll taxes and L&I still needing funding.</div></div>
        <div className={`command-card ${cashConfigured?(safeCash<0?'bad':'good'):'watch'}`}><div className="command-label">Safe to Spend</div><div className="command-value">{cashConfigured?money(safeCash):'Check Cash'}</div><div className="command-help">{cashConfigured?'Cash left after known bills, payroll, tax money, POs and reserves.':'Finish the bank/cash setup before trusting this number.'}</div></div>
      </div>

      <div className="attention-panel"><div className="attention-head"><strong>What Needs Your Attention</strong><span className="attention-count">{attention.length} item{attention.length===1?'':'s'}</span></div><div className="attention-list">
        {attention.length===0?<div className="attention-item good"><span className="attention-dot"/><div><div className="attention-title">Nothing urgent right now</div><div className="attention-copy">No overdue customer money, overdue vendor bills or cash warnings are showing.</div></div></div>:attention.map((a:any,i)=><div className={`attention-item ${a.tone}`} key={`${a.title}-${i}`}><span className="attention-dot"/><div><div className="attention-title">{a.title}</div><div className="attention-copy">{a.copy}</div></div><Link className="button secondary" href={a.href}>{a.action}</Link></div>)}
      </div>

      <section className="section"><div className="section-heading"><div><div className="section-kicker">Common Work</div><div className="section-title">Get Where You Need to Go</div><div className="section-heading-meta">The everyday actions you should be able to reach without hunting through office menus.</div></div></div><div className="quick-grid">
        <Link className="quick-tile" href="/projects"><span className="quick-icon"><Briefcase size={17}/></span><span><div className="quick-title">Projects</div><div className="quick-copy">Check job health and next steps</div></span></Link>
        <Link className="quick-tile" href="/field"><span className="quick-icon"><Hammer size={17}/></span><span><div className="quick-title">Field</div><div className="quick-copy">Timecards and daily logs</div></span></Link>
        <Link className="quick-tile" href="/procurement"><span className="quick-icon"><ShoppingCart size={17}/></span><span><div className="quick-title">Buy Materials</div><div className="quick-copy">Quotes, POs and deliveries</div></span></Link>
        <Link className="quick-tile" href="/billing"><span className="quick-icon"><ReceiptText size={17}/></span><span><div className="quick-title">Get Paid</div><div className="quick-copy">Invoices and customer money</div></span></Link>
        <Link className="quick-tile" href="/cashflow"><span className="quick-icon"><Wallet size={17}/></span><span><div className="quick-title">Check Cash</div><div className="quick-copy">What is actually safe to spend</div></span></Link>
        <Link className="quick-tile" href="/pour-control"><span className="quick-icon"><ShieldCheck size={17}/></span><span><div className="quick-title">Plan a Pour</div><div className="quick-copy">Check funding before committing</div></span></Link>
        <Link className="quick-tile" href="/payroll"><span className="quick-icon"><Banknote size={17}/></span><span><div className="quick-title">Payroll</div><div className="quick-copy">See what the crew will cost</div></span></Link>
        <Link className="quick-tile" href="/payables"><span className="quick-icon"><ShoppingCart size={17}/></span><span><div className="quick-title">Vendor Bills</div><div className="quick-copy">See what Carez owes</div></span></Link>
      </div></section>

      <section className="section"><div className="section-heading"><div><div className="section-kicker">Jobs</div><div className="section-title">Active Projects</div><div className="section-heading-meta">A quick look at current work. Open a project for the full budget and production picture.</div></div></div>
        {active.length===0?<div className="empty-state"><div><div className="title">No active jobs</div><div className="meta">When a job is awarded, it will show here.</div></div></div>:<div className="job-list">{active.map(p=>{const b:any=(billing||[]).find((x:any)=>x.project_id===p.id)||{};return <Link href={`/projects/${p.id}`} className="job-strip" key={p.id}><div><div className="job-name">{p.job_number} — {p.name}</div><div className="job-sub">{p.city||'Washington'} · {p.next_action||'No next action entered'}</div></div><div className="job-stat"><div className="job-stat-label">Not Yet Billed</div><div className="job-stat-value">{money(Number(b.unbilled_contract||0))}</div></div><div className="job-stat"><div className="job-stat-label">Customer Owes</div><div className="job-stat-value">{money(Number(b.outstanding_ar||0))}</div></div><div className="job-stat"><div className="job-stat-label">Past Due</div><div className="job-stat-value">{money(Number(b.overdue_ar||0))}</div></div><span className={`status ${Number(b.overdue_ar||0)>0?'on-hold':'active'}`}>{Number(b.overdue_ar||0)>0?'Needs Payment':'On Track'}</span></Link>})}</div>}
      </section>
    </div>
  </AppShell>;
}
