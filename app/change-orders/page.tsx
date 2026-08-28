import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createChangeOrder,addChangeOrderItem,updateChangeOrder,approveChangeOrder,rejectChangeOrder,deleteChangeOrderItem } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS'];

export default async function ChangeOrdersPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();
  const [{data:projects},{data:summaries},{data:items},{data:codes},{data:catalog},{data:crew},{data:riskClasses}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status').in('status',['active','on_hold']).order('job_number'),
    supabase.from('change_order_financial_summary').select('*,projects:project_id(job_number,name)').order('requested_date',{ascending:false}),
    supabase.from('change_order_items').select('*').order('sort_order'),
    supabase.from('cost_codes').select('id,code,name,cost_type').eq('active',true).order('sort_order'),
    supabase.from('cost_catalog_items').select('id,name,cost_code_id,default_unit,default_unit_cost').eq('active',true).order('name'),
    supabase.from('crew_members').select('id,name,is_owner,hourly_rate').eq('active',true).order('name'),
    profile?.company_id?supabase.from('li_risk_classes').select('code,name').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'):Promise.resolve({data:[]})
  ]);
  const itemMap=new Map<string,any[]>();for(const i of items||[]){if(!itemMap.has(i.change_order_id))itemMap.set(i.change_order_id,[]);itemMap.get(i.change_order_id)!.push(i);}
  const pendingExposure=(summaries||[]).filter((c:any)=>c.status!=='approved'&&c.status!=='rejected'&&c.status!=='void').reduce((s:number,c:any)=>s+Math.max(0,num(c.actual_company_exposure)),0);
  const approvedValue=(summaries||[]).filter((c:any)=>c.status==='approved').reduce((s:number,c:any)=>s+num(c.selected_sell_price),0);
  const submitted=(summaries||[]).filter((c:any)=>c.status==='submitted').length;
  const activeCOs=(summaries||[]).filter((c:any)=>!['rejected','void'].includes(c.status)).length;

  return <AppShell userName={profile?.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Change Orders</h1><p className="subtitle">Price, approve and track added or deleted scope without rewriting the original project budget.</p></div></div>

    <div className="grid grid4">
      <div className="card"><div className="label">Active Change Orders</div><div className="value">{activeCOs}</div></div>
      <div className="card"><div className="label">Awaiting Approval</div><div className="value">{submitted}</div></div>
      <div className="card"><div className="label">Approved Contract Changes</div><div className="value">{money(approvedValue)}</div></div>
      <div className={`card ${pendingExposure>0?'elevated':''}`}><div className="label">Unapproved Field Exposure</div><div className="value">{money(pendingExposure)}</div></div>
    </div>

    <details className="controls-disclosure create-disclosure section">
      <summary>Create Change Order</summary>
      <div className="controls-body"><form action={createChangeOrder} className="form">
        <div className="grid grid2"><label className="field"><span>Project</span><select name="project_id" required defaultValue=""><option value="" disabled>Select project</option>{(projects||[]).map(p=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></label><label className="field"><span>Change Type</span><select name="change_type" defaultValue="additive"><option value="additive">Additive — increases contract</option><option value="deductive">Deductive — customer credit</option><option value="no_cost">No-cost — Carez absorbs cost</option></select></label></div>
        <div className="grid grid2"><label className="field"><span>Title</span><input name="title" required placeholder="Additional patio extension"/></label><label className="field"><span>Requested Date</span><input type="date" name="requested_date" defaultValue={today()} required/></label></div>
        <div className="grid grid2"><label className="field"><span>Requested By</span><input name="requested_by" placeholder="Owner, GC, architect..."/></label><label className="field"><span>Reason</span><input name="reason" placeholder="Owner request, unforeseen condition..."/></label></div>
        <label className="field"><span>Scope Description</span><textarea name="description" rows={3} placeholder="Describe exactly what is being added, removed or changed."/></label>
        <button className="button">Create Draft Change Order</button>
      </form></div>
    </details>

    <div className="project-list">{(summaries||[]).length===0?<div className="card"><div className="title">No change orders yet</div><div className="meta">Create one when project scope changes after the original estimate is approved.</div></div>:(summaries||[]).map((co:any)=>{
      const coItems=itemMap.get(co.change_order_id)||[];
      const locked=['approved','rejected','void'].includes(co.status);
      const exposure=num(co.actual_company_exposure);
      const selected=num(co.selected_sell_price);
      const recommended=num(co.recommended_sell_price);
      const profitImpact=num(co.projected_profit_impact);
      const typeLabel=co.change_type==='deductive'?'Deductive':co.change_type==='no_cost'?'No Cost':'Additive';
      const statusClass=co.status==='approved'?'completed':co.status==='submitted'?'active':co.status==='rejected'?'on-hold':'';
      return <article className="project-card" key={co.change_order_id}>
        <header className="project-header"><div><div className="project-name">{co.co_number} — {co.title}</div><div className="project-location">{co.projects?.job_number} — {co.projects?.name} · {typeLabel} · requested {co.requested_date}{co.requested_by?` by ${co.requested_by}`:''}</div></div><span className={`status ${statusClass}`}>{co.status}</span></header>

        <section className="project-section tinted">
          <div className="section-heading"><div><div className="section-kicker">Commercial Impact</div><div className="section-title">Change Order Economics</div><div className="section-heading-meta">Original project budget remains frozen. Approved COs become separate authorized budgets.</div></div></div>
          <div className="metric-grid">
            <div className="metric-card"><div className="label">Direct Cost Impact</div><div className="metric-value">{money(num(co.total_direct_cost))}</div><div className="metric-detail">Labor {money(num(co.direct_labor_cost))} · Other {money(num(co.total_direct_cost)-num(co.direct_labor_cost))}</div></div>
            <div className="metric-card"><div className="label">Overhead Impact</div><div className="metric-value">{money(num(co.overhead_cost))}</div><div className="metric-detail">{Math.abs(num(co.labor_hours)).toFixed(1)} labor hr × snapshotted OH rate</div></div>
            <div className="metric-card brand"><div className="label">Recommended Price</div><div className="metric-value">{money(recommended)}</div><div className="metric-detail">Target margin {num(co.target_margin_percent).toFixed(1)}%</div></div>
            <div className={`metric-card ${profitImpact>=0?'positive':'danger-metric'}`}><div className="label">Selected Price / Profit Impact</div><div className="metric-value">{money(selected)}</div><div className="metric-detail">Projected profit impact {money(profitImpact)}</div></div>
          </div>
          {co.status!=='approved'&&exposure>0&&<div className="alert danger"><strong>Unapproved exposure: {money(exposure)}.</strong> Carez has already incurred cost against this change before customer approval.</div>}
          {co.change_type==='no_cost'&&<div className="alert warn"><strong>No-cost change.</strong> Revenue remains $0 while actual/budgeted cost still reduces project profit.</div>}
        </section>

        <section className="project-section">
          <div className="section-heading"><div><div className="section-kicker">Scope</div><div className="section-title">Cost Build-Up</div><div className="section-heading-meta">Each line can be a real cost or a credit / avoided cost.</div></div></div>
          <div className="list">{coItems.length===0?<div className="meta">No scope items entered yet.</div>:coItems.map((i:any)=><div className="row" key={i.id}><div><div className="title">{i.description}</div><div className="meta">{i.item_type} · {i.cost_effect==='credit'?'Credit / avoided cost':'Cost'} · {Math.abs(num(i.quantity)).toFixed(2)} {i.unit}{i.item_type==='labor'&&i.labor_task?` · ${i.labor_task}`:''}</div></div><div style={{textAlign:'right'}}><strong>{money(num(i.direct_cost))}</strong>{co.status==='draft'&&<form action={deleteChangeOrderItem}><input type="hidden" name="item_id" value={i.id}/><input type="hidden" name="change_order_id" value={co.change_order_id}/><button className="button secondary" style={{marginTop:6}}>Delete</button></form>}</div></div>)}</div>

          {!locked&&co.status==='draft'&&<div className="split section">
            <details className="controls-disclosure"><summary>Add Labor</summary><div className="controls-body"><form action={addChangeOrderItem} className="form"><input type="hidden" name="change_order_id" value={co.change_order_id}/><input type="hidden" name="item_type" value="labor"/>
              <label className="field"><span>Description</span><input name="description" required placeholder="Form additional wall"/></label>
              <div className="grid grid2"><label className="field"><span>Worker</span><select name="crew_member_id" required defaultValue=""><option value="" disabled>Select worker</option>{(crew||[]).map(c=><option key={c.id} value={c.id}>{c.name}{c.is_owner?' — Owner':` — $${num(c.hourly_rate).toFixed(2)}/hr`}</option>)}</select></label><label className="field"><span>Cost Effect</span><select name="cost_effect" defaultValue={co.change_type==='deductive'?'credit':'cost'}><option value="cost">Cost — work Carez must perform</option><option value="credit">Credit — work/cost being removed</option></select></label></div>
              <div className="grid grid2"><label className="field"><span>Operation</span><select name="labor_task" defaultValue="Formwork"><option>Formwork</option><option>Rebar</option><option>Placement</option><option>Finishing</option><option>Strip</option><option>Cleanup</option><option>Layout</option><option>General</option></select></label><label className="field"><span>L&I Risk Class</span><select name="risk_class_code" defaultValue="0217-01">{(riskClasses||[]).map(r=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></label></div>
              <div className="grid grid2"><label className="field"><span>Regular Hours</span><input type="number" min="0" step="0.25" name="regular_hours" required defaultValue="8"/></label><label className="field"><span>Overtime Hours</span><input type="number" min="0" step="0.25" name="overtime_hours" defaultValue="0"/></label></div>
              <button className="button">Add Labor</button>
            </form></div></details>

            <details className="controls-disclosure"><summary>Add Material / Equipment / Sub</summary><div className="controls-body"><form action={addChangeOrderItem} className="form"><input type="hidden" name="change_order_id" value={co.change_order_id}/>
              <div className="grid grid2"><label className="field"><span>Type</span><select name="item_type" defaultValue="material"><option value="material">Material</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other Direct</option></select></label><label className="field"><span>Cost Effect</span><select name="cost_effect" defaultValue={co.change_type==='deductive'?'credit':'cost'}><option value="cost">Cost — Carez will incur</option><option value="credit">Credit — avoided cost</option></select></label></div>
              <label className="field"><span>Cost Code</span><select name="cost_code_id" defaultValue=""><option value="">Select if applicable</option>{(codes||[]).map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></label>
              <label className="field"><span>Catalog Item</span><select name="catalog_item_id" defaultValue=""><option value="">Custom / not cataloged</option>{(catalog||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
              <label className="field"><span>Description</span><input name="description" required placeholder="4000 PSI ready-mix, pump, #4 rebar..."/></label>
              <div className="grid grid2"><label className="field"><span>Quantity</span><input type="number" min="0" step="0.01" name="quantity" defaultValue="1" required/></label><label className="field"><span>Unit</span><select name="unit" defaultValue="LS">{units.map(u=><option key={u}>{u}</option>)}</select></label></div>
              <label className="field"><span>Unit Cost</span><input type="number" min="0" step="0.01" name="unit_cost" required/></label>
              <button className="button">Add Cost Item</button>
            </form></div></details>
          </div>}
        </section>

        <section className="project-section tinted">
          {!locked?<><div className="section-heading"><div><div className="section-kicker">Workflow</div><div className="section-title">Commercial Controls</div></div></div><form action={updateChangeOrder} className="form"><input type="hidden" name="change_order_id" value={co.change_order_id}/>
            <div className="grid grid2"><label className="field"><span>Target Margin %</span><input type="number" min="0" max="80" step="0.1" name="target_margin_percent" defaultValue={num(co.target_margin_percent)}/></label><label className="field"><span>Price Override</span><input type="number" min="0" step="0.01" name="proposed_sell_price" defaultValue={Math.abs(num(co.proposed_sell_price))} placeholder={Math.abs(recommended).toFixed(2)}/></label></div>
            <div className="grid grid2"><label className="field"><span>Payment Processing Reserve %</span><input type="number" min="0" step="0.01" name="payment_processing_rate_percent" defaultValue={num(co.payment_processing_rate_percent)}/></label><label className="field"><span>Field Work Status</span><select name="field_work_status" defaultValue={co.field_work_status}><option value="not_started">Not Started</option><option value="directed">Directed / Proceeding Before Approval</option><option value="in_progress">In Progress</option><option value="complete">Complete</option></select></label></div>
            <label className="field"><span>Workflow Status</span><select name="status" defaultValue={co.status}><option value="draft">Draft — editable</option><option value="submitted">Submitted — awaiting approval</option></select></label>
            <button className="button secondary">Save Change Order</button>
          </form>
          {co.status==='submitted'&&<div className="action-row"><form action={approveChangeOrder}><input type="hidden" name="change_order_id" value={co.change_order_id}/><button className="button">Approve & Freeze CO Budget</button></form><form action={rejectChangeOrder}><input type="hidden" name="change_order_id" value={co.change_order_id}/><button className="button secondary">Mark Rejected</button></form></div>}</>:<div className={`alert ${co.status==='approved'?'success':'warn'}`} style={{margin:0}}><strong>{co.status==='approved'?'Approved and frozen.':'Change order closed.'}</strong> {co.status==='approved'?'Contract value and authorized budget now include this change.':'This change no longer affects the authorized project budget.'}</div>}
        </section>
      </article>;
    })}</div>

    <div className="action-row section"><Link className="button secondary" href="/projects">Projects</Link><Link className="button secondary" href="/forecast">Forecast</Link><Link className="button secondary" href="/field">Field</Link></div>
  </AppShell>;
}
