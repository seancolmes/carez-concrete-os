import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createProject } from './actions';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export default async function ProjectsPage(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const [{data:profile},{data:projects}]=await Promise.all([
    supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
    supabase.from('projects').select('*,customers(name)').order('created_at',{ascending:false})
  ]);
  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <h1 className="page-title">Projects</h1><p className="subtitle">Contract, billing, production and cost status.</p>
    <div className="card"><div className="title">Add Project</div><form action={createProject} className="form" style={{marginTop:12}}>
      <div className="grid grid2"><label className="field"><span>Job Number</span><input name="job_number" required placeholder="D58"/></label><label className="field"><span>Project Name</span><input name="name" required placeholder="307 NW 52nd St"/></label></div>
      <label className="field"><span>Address</span><input name="address" placeholder="307 NW 52nd St"/></label>
      <div className="grid grid2"><label className="field"><span>City</span><input name="city" placeholder="Seattle"/></label><label className="field"><span>Contract Value</span><input name="contract_value" placeholder="$25,000"/></label></div>
      <label className="field"><span>Next Action</span><input name="next_action" placeholder="Schedule footing inspection"/></label><button className="button">Create Project</button>
    </form></div>
    <div className="grid section">{(projects||[]).length===0&&<div className="card meta">No projects loaded yet. Create the first active job above.</div>}{(projects||[]).map(p=>{const adjusted=Number(p.contract_value)+Number(p.approved_changes)-Number(p.backcharges);return <div className="card" key={p.id}><div className="row"><div><div className="title">{p.job_number} — {p.name}</div><div className="meta">{p.customers?.name||'Direct / customer not linked'} · {[p.address,p.city,p.state].filter(Boolean).join(', ')}</div></div><span className="status">{p.status}</span></div><div className="grid grid4 section"><div><div className="label">Adjusted Contract</div><strong>{money(adjusted)}</strong></div><div><div className="label">Billed</div><strong>{money(Number(p.billed))}</strong></div><div><div className="label">Collected</div><strong>{money(Number(p.collected))}</strong></div><div><div className="label">Actual Cost</div><strong>{money(Number(p.actual_cost))}</strong></div></div><div className="alert warn"><strong>Next action:</strong> {p.next_action||'No action assigned'}</div><Link className="button secondary" href="/field">Enter Field Data</Link></div>})}</div>
  </AppShell>;
}
