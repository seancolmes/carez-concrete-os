import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export default async function ProjectsPage(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const [{data:profile},{data:projects}]=await Promise.all([
    supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
    supabase.from('projects').select('*,customers(name)').order('created_at',{ascending:false})
  ]);
  return <AppShell userName={profile?.full_name||user.email||'Owner'}><h1 className="page-title">Projects</h1><p className="subtitle">Contract, billing, production and cost status.</p><div className="grid">{(projects||[]).length===0&&<div className="card meta">No projects loaded yet. Open Settings and load starter data.</div>}{(projects||[]).map(p=>{const adjusted=Number(p.contract_value)+Number(p.approved_changes)-Number(p.backcharges);return <div className="card" key={p.id}><div className="row"><div><div className="title">{p.job_number} — {p.name}</div><div className="meta">{p.customers?.name||'No customer'} · {[p.address,p.city,p.state].filter(Boolean).join(', ')}</div></div><span className="status">{p.status}</span></div><div className="grid grid4 section"><div><div className="label">Adjusted Contract</div><strong>{money(adjusted)}</strong></div><div><div className="label">Billed</div><strong>{money(Number(p.billed))}</strong></div><div><div className="label">Collected</div><strong>{money(Number(p.collected))}</strong></div><div><div className="label">Actual Cost</div><strong>{money(Number(p.actual_cost))}</strong></div></div><div className="alert warn"><strong>Next action:</strong> {p.next_action||'No action assigned'}</div></div>})}</div></AppShell>;
}
