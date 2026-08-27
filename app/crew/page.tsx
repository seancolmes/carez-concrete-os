import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { changeCrewRate, createCrewMember, updateCrewMember } from './actions';

const today=()=>new Date().toISOString().slice(0,10);
const skills=['Formwork','Rebar','Placement','Flatwork','Broom Finish','V-Groove','China Trowel','Hard Trowel','Walls','Foundations','Curb / Gutter','Sawcutting','Layout'];
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

export default async function CrewPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).maybeSingle();
  const [{data:crew},{data:rates},{data:riskClasses}]=await Promise.all([
    supabase.from('crew_members').select('*').order('active',{ascending:false}).order('name'),
    supabase.from('crew_rate_history').select('*').order('effective_date',{ascending:false}),
    profile?.company_id?supabase.from('li_risk_classes').select('code,name').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'):Promise.resolve({data:[]})
  ]);
  const rateMap=new Map<string,any[]>();
  for(const r of rates||[]){const a=rateMap.get(r.crew_member_id)||[];a.push(r);rateMap.set(r.crew_member_id,a);}
  const active=(crew||[]).filter(c=>c.active).length;
  const onCall=(crew||[]).filter(c=>c.active&&c.availability_type==='on_call').length;
  const w2=(crew||[]).filter(c=>c.active&&c.worker_type==='employee').length;

  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <h1 className="page-title">Crew</h1><p className="subtitle">Employees, owner labor and on-call bench connected to job costing.</p>
    <div className="grid grid4"><div className="card"><div className="label">Active Crew</div><div className="value">{active}</div></div><div className="card"><div className="label">W-2 Employees</div><div className="value">{w2}</div></div><div className="card"><div className="label">On-Call Bench</div><div className="value">{onCall}</div></div><div className="card"><div className="label">Risk Classes</div><div className="value">{(riskClasses||[]).length}</div></div></div>

    <div className="card section"><div className="title">Add Crew Member</div><p className="subtitle">Employment classification and availability are separate. A worker can be a W-2 employee and still be on-call.</p>
      <form action={createCrewMember} className="form">
        <div className="grid grid2"><label className="field"><span>Name</span><input name="name" required placeholder="John Smith"/></label><label className="field"><span>Role</span><input name="role" required placeholder="Concrete Finisher"/></label></div>
        <div className="grid grid2"><label className="field"><span>Worker Type</span><select name="worker_type" defaultValue="employee"><option value="employee">W-2 Employee</option><option value="owner">Owner</option><option value="subcontractor">Subcontractor</option></select></label><label className="field"><span>Availability</span><select name="availability_type" defaultValue="regular"><option value="regular">Regular</option><option value="on_call">On-call</option></select></label></div>
        <div className="grid grid2"><label className="field"><span>Base Wage / Hourly Rate</span><input name="hourly_rate" type="number" step="0.01" min="0" placeholder="30.00"/></label><label className="field"><span>Owner Internal Field Rate</span><input name="internal_field_rate" type="number" step="0.01" min="0" placeholder="50.00"/></label></div>
        <div className="grid grid2"><label className="field"><span>Default L&I Class</span><select name="default_risk_class_code" defaultValue="0217-01"><option value="">None / review required</option>{(riskClasses||[]).map(r=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className="field"><span>Start Date</span><input name="start_date" type="date" defaultValue={today()}/></label></div>
        <label className="field"><span>Phone</span><input name="phone" inputMode="tel" placeholder="253-555-0123"/></label>
        <div className="field"><span>Skills</span><div className="grid grid4">{skills.map(s=><label key={s} className="meta"><input type="checkbox" name="skills" value={s}/> {s}</label>)}</div></div>
        <button className="button">Add Crew Member</button>
      </form>
    </div>

    <div className="grid section">{(crew||[]).map(c=>{const history=rateMap.get(c.id)||[];return <div className="card" key={c.id}>
      <div className="row"><div><div className="title">{c.name}</div><div className="meta">{c.role} · {c.worker_type==='employee'?'W-2 employee':c.worker_type} · {c.availability_type.replace('_',' ')}</div></div><span className="status">{c.active?'Active':'Inactive'}</span></div>
      <div className="grid grid4 section"><div><div className="label">Current Rate</div><strong>{money(Number(c.is_owner?c.internal_field_rate:c.hourly_rate||0))}/hr</strong></div><div><div className="label">Default L&I</div><strong>{c.is_owner?'Owner':(c.default_risk_class_code||'Review')}</strong></div><div><div className="label">Phone</div><strong>{c.phone||'—'}</strong></div><div><div className="label">Skills</div><strong>{(c.skills||[]).length}</strong></div></div>
      {(c.skills||[]).length>0&&<div className="meta section">{(c.skills||[]).join(' · ')}</div>}
      <details className="section"><summary className="title" style={{cursor:'pointer'}}>Edit Worker</summary><form action={updateCrewMember} className="form" style={{marginTop:12}}><input type="hidden" name="id" value={c.id}/>
        <div className="grid grid2"><label className="field"><span>Name</span><input name="name" defaultValue={c.name}/></label><label className="field"><span>Role</span><input name="role" defaultValue={c.role}/></label></div>
        <div className="grid grid2"><label className="field"><span>Worker Type</span><select name="worker_type" defaultValue={c.worker_type}><option value="employee">W-2 Employee</option><option value="owner">Owner</option><option value="subcontractor">Subcontractor</option></select></label><label className="field"><span>Availability</span><select name="availability_type" defaultValue={c.availability_type}><option value="regular">Regular</option><option value="on_call">On-call</option></select></label></div>
        <div className="grid grid2"><label className="field"><span>Current Hourly Rate</span><input name="hourly_rate" type="number" step="0.01" defaultValue={Number(c.hourly_rate||0)}/></label><label className="field"><span>Owner Internal Rate</span><input name="internal_field_rate" type="number" step="0.01" defaultValue={Number(c.internal_field_rate||0)}/></label></div>
        <div className="grid grid2"><label className="field"><span>Default L&I</span><select name="default_risk_class_code" defaultValue={c.default_risk_class_code||''}><option value="">None / review required</option>{(riskClasses||[]).map(r=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className="field"><span>Start Date</span><input name="start_date" type="date" defaultValue={c.start_date||''}/></label></div>
        <label className="field"><span>Phone</span><input name="phone" defaultValue={c.phone||''}/></label>
        <div className="field"><span>Skills</span><div className="grid grid4">{skills.map(s=><label key={s} className="meta"><input type="checkbox" name="skills" value={s} defaultChecked={(c.skills||[]).includes(s)}/> {s}</label>)}</div></div>
        <label className="meta"><input type="checkbox" name="active" defaultChecked={c.active}/> Active / available for field entry</label><button className="button secondary">Save Worker</button>
      </form></details>
      <details className="section"><summary className="title" style={{cursor:'pointer'}}>Change Rate / Rate History</summary><form action={changeCrewRate} className="form" style={{marginTop:12}}><input type="hidden" name="id" value={c.id}/><div className="grid grid2"><label className="field"><span>New Rate</span><input name="amount" type="number" min="0" step="0.01" required placeholder="35.00"/></label><label className="field"><span>Effective Date</span><input name="effective_date" type="date" defaultValue={today()} required/></label></div><button className="button secondary">Save New Rate</button></form>
        <div className="list section">{history.length===0?<div className="meta">No history yet.</div>:history.map(r=><div className="row" key={r.id}><div><div className="title">{money(Number(r.amount))}/hr</div><div className="meta">Effective {r.effective_date}{r.end_date?` through ${r.end_date}`:' · current'}</div></div><span className="status">{r.rate_type.replaceAll('_',' ')}</span></div>)}</div>
      </details>
    </div>})}</div>
  </AppShell>;
}
