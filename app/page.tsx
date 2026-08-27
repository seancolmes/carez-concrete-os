import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);

export default async function Dashboard(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect('/login');
  const [{data:profile},{data:projects},{data:leads}]=await Promise.all([
    supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
    supabase.from('projects').select('*').order('created_at',{ascending:false}),
    supabase.from('leads').select('*').order('created_at',{ascending:false})
  ]);
  const active=(projects||[]).filter(p=>p.status==='active');
  const open=(leads||[]).filter(l=>!['won','lost'].includes(l.status));
  const backlog=active.reduce((s,p)=>s+Math.max(0,Number(p.contract_value||0)+Number(p.approved_changes||0)-Number(p.backcharges||0)-Number(p.billed||0)),0);
  const name=profile?.full_name||user.email||'Owner';

  return <AppShell userName={name}>
    <h1 className="page-title">Dashboard</h1><p className="subtitle">Field, sales, cash and production control.</p>
    <div className="grid grid4">
      <div className="card"><div className="label">Active Jobs</div><div className="value">{active.length}</div></div>
      <div className="card"><div className="label">Open Bids</div><div className="value">{open.length}</div></div>
      <div className="card"><div className="label">Backlog</div><div className="value">{money(backlog)}</div></div>
      <div className="card"><div className="label">Cash Available</div><div className="value">$0</div></div>
    </div>
    {open.length===0&&<div className="alert danger"><strong>Sales pipeline is empty.</strong> Add every possible job immediately.</div>}
    <div className="alert warn"><strong>Cash protection mode.</strong> Do not commit to a pour or payroll obligation until job cash requirements are confirmed.</div>
    <div className="card section"><div className="title">Quick Actions</div><div className="nav" style={{marginTop:12}}><Link href="/leads">New Lead</Link><Link href="/projects">Projects</Link><Link href="/crew">Crew</Link><Link href="/settings">Settings</Link></div></div>
    <div className="card section"><div className="title">Active Projects</div><div className="list">{active.length===0?<div className="meta" style={{paddingTop:12}}>No projects loaded yet.</div>:active.map(p=><div className="row" key={p.id}><div><div className="title">{p.job_number} — {p.name}</div><div className="meta">{p.city||'Washington'} · {p.next_action||'No next action'}</div></div><span className="status">Active</span></div>)}</div></div>
  </AppShell>;
}
