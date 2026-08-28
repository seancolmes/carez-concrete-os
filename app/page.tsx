import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

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
  const cashConfigured=Boolean(cash?.balance_as_of)&&Number(cash?.accounts_with_balance||0)>0;
  const safeCash=Number(cash?.safe_cash_after_known_obligations||0);
  const knownObligations=Number(cash?.sales_tax_reserve||0)+Number(cash?.open_ap||0)+Number(cash?.open_po_commitments||0)+Number(cash?.unpaid_company_expense_obligations||0)+Number(cash?.manual_reserves||0);
  const name=profile?.full_name||user.email||'Owner';

  return <AppShell userName={name}>
    <h1 className="page-title">Dashboard</h1><p className="subtitle">Field, sales, cash and production control.</p>
    <div className="grid grid4">
      <div className="card"><div className="label">Active Jobs</div><div className="value">{active.length}</div></div>
      <div className="card"><div className="label">Open Bids</div><div className="value">{open.length}</div></div>
      <div className="card"><div className="label">Unbilled Backlog</div><div className="value">{money(backlog)}</div><div className="meta">Authorized active contract not yet invoiced</div></div>
      <div className={`card ${overdueAR>0?'elevated':''}`}><div className="label">Outstanding A/R</div><div className="value">{money(outstandingAR)}</div><div className="meta">Overdue {money(overdueAR)}</div></div>
      <div className={`card ${overdueAP>0?'elevated':''}`}><div className="label">Open A/P</div><div className="value">{money(openAP)}</div><div className="meta">Due next 7 days {money(dueNext7)} · Overdue {money(overdueAP)}</div></div>
      <div className={`card ${cashConfigured&&safeCash<0?'elevated':''}`}><div className="label">Safe Operating Cash</div><div className="value">{cashConfigured?money(safeCash):'Not entered'}</div><div className="meta">{cashConfigured?`Bank basis ${cash?.balance_as_of} · Known obligations ${money(knownObligations)}`:'Enter current bank balance in Cashflow'}</div></div>
    </div>
    {open.length===0&&<div className="alert danger"><strong>Sales pipeline is empty.</strong> Add every possible job immediately.</div>}
    {overdueAR>0&&<div className="alert danger"><strong>Collections attention.</strong> {money(overdueAR)} is currently overdue from customers.</div>}
    {overdueAP>0&&<div className="alert danger"><strong>Vendor payment attention.</strong> {money(overdueAP)} of vendor A/P is currently overdue.</div>}
    {!cashConfigured&&<div className="alert warn"><strong>Cash position not configured.</strong> Enter the current Carez bank/cash balance before relying on operating-cash decisions.</div>}
    {cashConfigured&&safeCash<0&&<div className="alert danger"><strong>Cash protection alert.</strong> Known obligations exceed entered cash by {money(Math.abs(safeCash))}.</div>}
    <div className="alert warn"><strong>Cash protection mode.</strong> Do not commit to a pour or payroll obligation until job cash requirements are confirmed.</div>
    <div className="card section"><div className="title">Quick Actions</div><div className="nav" style={{marginTop:12}}><Link href="/leads">New Lead</Link><Link href="/projects">Projects</Link><Link href="/billing">Billing</Link><Link href="/cashflow">Cashflow</Link><Link href="/payables">Accounts Payable</Link><Link href="/procurement">Procurement</Link><Link href="/pour-control">Pour Control</Link><Link href="/field">Field</Link><Link href="/costs">Job Costs</Link></div></div>
    <div className="card section"><div className="title">Active Projects</div><div className="list">{active.length===0?<div className="meta" style={{paddingTop:12}}>No projects loaded yet.</div>:active.map(p=>{const b:any=(billing||[]).find((x:any)=>x.project_id===p.id)||{};return <div className="row" key={p.id}><div><div className="title">{p.job_number} — {p.name}</div><div className="meta">{p.city||'Washington'} · {p.next_action||'No next action'} · Unbilled {money(Number(b.unbilled_contract||0))}</div></div><span className={`status ${Number(b.overdue_ar||0)>0?'on-hold':'active'}`}>{Number(b.overdue_ar||0)>0?'A/R Due':'Active'}</span></div>})}</div></div>
  </AppShell>;
}
