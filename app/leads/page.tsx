import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createLead, updateLeadStatus } from './actions';

const money=(n:number|null)=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);

export default async function LeadsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user) redirect('/login');
  const [{data:profile},{data:leads}]=await Promise.all([
    supabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle(),
    supabase.from('leads').select('*').order('created_at',{ascending:false})
  ]);
  const open=(leads||[]).filter(l=>!['won','lost'].includes(l.status));
  const pipeline=open.reduce((s,l)=>s+Number(l.estimated_value||0),0);
  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <h1 className="page-title">Leads</h1><p className="subtitle">Every opportunity enters here before estimating.</p>
    <div className="grid grid4"><div className="card"><div className="label">Open Opportunities</div><div className="value">{open.length}</div></div><div className="card"><div className="label">Pipeline Value</div><div className="value">{money(pipeline)}</div></div></div>
    {open.length===0&&<div className="alert danger"><strong>Pipeline empty.</strong> Add the next possible project even if plans are not ready yet.</div>}
    <div className="card section"><div className="title">Add Lead</div><form action={createLead} className="form" style={{marginTop:12}}>
      <label className="field"><span>Customer / GC</span><input name="customer_name" required placeholder="Genesis Excavation"/></label>
      <label className="field"><span>Project</span><input name="project_name" required placeholder="Hadley Residence"/></label>
      <label className="field"><span>City</span><input name="city" placeholder="Seattle"/></label>
      <label className="field"><span>Concrete Scope</span><textarea name="scope" rows={3} placeholder="Footings, walls, slab, sidewalk..."/></label>
      <label className="field"><span>Rough Value</span><input name="estimated_value" placeholder="$25,000"/></label>
      <label className="field"><span>Bid Due</span><input type="date" name="bid_due"/></label>
      <label className="field"><span>Follow Up</span><input type="date" name="follow_up"/></label>
      <button className="button">Save Lead</button>
    </form></div>
    <div className="card section"><div className="title">Bid Pipeline</div><div className="list">{(leads||[]).map(l=><div className="row" key={l.id}><div><div className="title">{l.project_name}</div><div className="meta">{l.customer_name}{l.city?` · ${l.city}, WA`:''} · {money(l.estimated_value?Number(l.estimated_value):null)}</div><div className="meta">{l.scope||'Scope not entered'}</div></div><form action={updateLeadStatus}><input type="hidden" name="id" value={l.id}/><select name="status" defaultValue={l.status}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="estimating">Estimating</option><option value="proposal_sent">Proposal Sent</option><option value="follow_up">Follow-Up</option><option value="won">Won</option><option value="lost">Lost</option></select><button className="button secondary" style={{marginLeft:6}}>Update</button></form></div>)}</div></div>
  </AppShell>;
}
