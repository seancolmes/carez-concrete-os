import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createProject,updateLaborBudget } from './actions';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
export default async function ProjectsPage(){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
  const [{data:projects},{data:timecards}]=await Promise.all([
    supabase.from('projects').select('*,customers(name)').order('created_at',{ascending:false}),
    supabase.from('timecards').select('project_id,hours,direct_labor_cost,labor_cost_method')
  ]);
  const laborByProject=new Map<string,{hours:number,cost:number}>();
  for(const t of timecards||[]){const current=laborByProject.get(t.project_id)||{hours:0,cost:0};current.hours+=num(t.hours);current.cost+=num(t.direct_labor_cost);laborByProject.set(t.project_id,current);}
  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <h1 className="page-title">Projects</h1><p className="subtitle">Contract, production and snapshotted direct labor job cost.</p>
    <div className="card"><div className="title">Add Project</div><form action={createProject} className="form" style={{marginTop:12}}>
      <div className="grid grid2"><label className="field"><span>Job Number</span><input name="job_number" required placeholder="D58"/></label><label className="field"><span>Project Name</span><input name="name" required placeholder="307 NW 52nd St"/></label></div>
      <label className="field"><span>Address</span><input name="address" placeholder="307 NW 52nd St"/></label>
      <div className="grid grid2"><label className="field"><span>City</span><input name="city" placeholder="Seattle"/></label><label className="field"><span>Contract Value</span><input name="contract_value" inputMode="decimal" placeholder="$25,000"/></label></div>
      <div className="grid grid2"><label className="field"><span>Estimated Labor Hours</span><input name="estimated_labor_hours" type="number" min="0" step="0.25" placeholder="120"/></label><label className="field"><span>Estimated Labor Cost</span><input name="estimated_labor_cost" inputMode="decimal" placeholder="$5,000"/></label></div>
      <label className="field"><span>Next Action</span><input name="next_action" placeholder="Schedule footing inspection"/></label><button className="button">Create Project</button>
    </form></div>
    <div className="alert success section"><strong>Labor Engine active.</strong> Actual labor now comes from each timecard's snapshotted wage, payroll taxes, L&I classification and sick-leave reserve.</div>
    <div className="grid section">{(projects||[]).length===0&&<div className="card meta">No projects loaded yet.</div>}{(projects||[]).map(p=>{const adjusted=num(p.contract_value)+num(p.approved_changes)-num(p.backcharges);const actual=laborByProject.get(p.id)||{hours:0,cost:0};const estHours=num(p.estimated_labor_hours);const estCost=num(p.estimated_labor_cost);const remainingHours=estHours-actual.hours;const remainingCost=estCost-actual.cost;return <div className="card" key={p.id}>
      <div className="row"><div><div className="title">{p.job_number} — {p.name}</div><div className="meta">{p.customers?.name||'Direct / customer not linked'} · {[p.address,p.city,p.state].filter(Boolean).join(', ')}</div></div><span className="status">{p.status}</span></div>
      <div className="grid grid4 section"><div><div className="label">Adjusted Contract</div><strong>{money(adjusted)}</strong></div><div><div className="label">Est. Labor</div><strong>{money(estCost)}</strong><div className="meta">{estHours.toFixed(1)} hr</div></div><div><div className="label">Actual Direct Labor</div><strong>{money(actual.cost)}</strong><div className="meta">{actual.hours.toFixed(1)} hr</div></div><div><div className="label">Labor Remaining</div><strong>{money(remainingCost)}</strong><div className="meta">{remainingHours.toFixed(1)} hr</div></div></div>
      {(remainingCost<0||remainingHours<0)&&<div className="alert danger"><strong>Labor budget exceeded.</strong> Review production before adding more labor.</div>}
      <form action={updateLaborBudget} className="form section"><input type="hidden" name="project_id" value={p.id}/><div className="grid grid2"><label className="field"><span>Est. Labor Hours</span><input name="estimated_labor_hours" type="number" min="0" step="0.25" defaultValue={estHours}/></label><label className="field"><span>Est. Direct Labor Cost</span><input name="estimated_labor_cost" type="number" min="0" step="0.01" defaultValue={estCost}/></label></div><button className="button secondary">Update Labor Budget</button></form>
      <div className="alert warn"><strong>Next action:</strong> {p.next_action||'No action assigned'}</div><Link className="button secondary" href="/field">Enter Field Data</Link></div>})}</div>
  </AppShell>;
}
