import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { createPourPlan,updatePourPlan,addPourCostItem,addPourLaborItem,deletePourCostItem,recordPourAuthorization,closePourPlan } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const today=()=>new Date().toISOString().slice(0,10);
const year=new Date().getFullYear();
const units=['LS','EA','CY','LF','SF','HR','DAY','TON','GAL'];

export default async function PourControlPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  const companyId=profile.company_id;

  const [{data:projects},{data:funding},{data:plans},{data:items},{data:reviews},{data:sections},{data:budgets},{data:changeOrders},{data:crew},{data:risks},{data:costCodes},{data:catalog}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status').in('status',['active','on_hold']).order('job_number'),
    supabase.from('project_cash_funding_summary').select('*').in('status',['active','on_hold']).order('job_number'),
    supabase.from('pour_plan_financial_summary').select('*').order('scheduled_date',{ascending:true,nullsFirst:false}).order('name'),
    supabase.from('pour_cost_items').select('*').order('sort_order'),
    supabase.from('pour_authorization_snapshots').select('*').order('reviewed_at',{ascending:false}),
    supabase.from('project_budget_sections').select('id,budget_id,name,scope_type').order('sort_order'),
    supabase.from('project_budgets').select('id,project_id,status,budget_type,label').eq('status','active'),
    supabase.from('change_orders').select('id,project_id,co_number,title,status').eq('status','approved').order('requested_date'),
    supabase.from('crew_members').select('id,name,hourly_rate,internal_field_rate,is_owner,active').eq('active',true).order('name'),
    supabase.from('li_risk_classes').select('code,name').eq('company_id',companyId).eq('tax_year',year).eq('active',true).order('code'),
    supabase.from('cost_codes').select('id,code,name,cost_type,default_unit').eq('company_id',companyId).eq('active',true).order('sort_order'),
    supabase.from('cost_catalog_items').select('id,cost_code_id,name,default_unit,default_unit_cost,vendor_name').eq('company_id',companyId).eq('active',true).order('name')
  ]);

  const projectMap=new Map((projects||[]).map((p:any)=>[p.id,p]));
  const budgetProject=new Map((budgets||[]).map((b:any)=>[b.id,b.project_id]));
  const sectionOptions=(sections||[]).filter((s:any)=>budgetProject.has(s.budget_id)).map((s:any)=>({...s,project_id:budgetProject.get(s.budget_id)}));
  const itemsByPlan=new Map<string,any[]>();for(const i of items||[]){if(!itemsByPlan.has(i.pour_plan_id))itemsByPlan.set(i.pour_plan_id,[]);itemsByPlan.get(i.pour_plan_id)!.push(i);}
  const reviewsByPlan=new Map<string,any[]>();for(const r of reviews||[]){if(!reviewsByPlan.has(r.pour_plan_id))reviewsByPlan.set(r.pour_plan_id,[]);reviewsByPlan.get(r.pour_plan_id)!.push(r);}
  const latestReview=new Map<string,any>();for(const r of reviews||[]){if(!latestReview.has(r.pour_plan_id))latestReview.set(r.pour_plan_id,r);}
  const coByProject=new Map<string,any[]>();for(const co of changeOrders||[]){if(!coByProject.has(co.project_id))coByProject.set(co.project_id,[]);coByProject.get(co.project_id)!.push(co);}
  const totalRisk=(funding||[]).reduce((s:number,f:any)=>s+num(f.carez_cash_at_risk_to_date),0);
  const totalProtected=(funding||[]).reduce((s:number,f:any)=>s+Math.max(0,num(f.project_funding_balance)),0);
  const holdPlans=(plans||[]).filter((p:any)=>p.status!=='completed'&&p.status!=='cancelled'&&p.system_recommendation==='hold').length;
  const openExposure=(plans||[]).filter((p:any)=>p.status!=='completed'&&p.status!=='cancelled').reduce((s:number,p:any)=>s+num(p.total_exposure_with_contingency),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Pour Control</h1><p className="subtitle">Cash exposure, protected project funding and authorization before Carez commits to concrete, pumps, payroll and other pour costs.</p></div></div>

    <div className="grid grid4">
      <div className="card"><div className="label">Protected Project Funding</div><div className="value">{money(totalProtected)}</div><div className="meta">Collected customer cash after sales-tax reserve, fees and incurred direct cost.</div></div>
      <div className={`card ${totalRisk>0?'elevated':''}`}><div className="label">Carez Cash at Risk To Date</div><div className="value">{money(totalRisk)}</div><div className="meta">Direct job cost not yet covered by usable customer cash.</div></div>
      <div className="card"><div className="label">Open Pour Exposure</div><div className="value">{money(openExposure)}</div><div className="meta">Current planned pour costs including contingency.</div></div>
      <div className={`card ${holdPlans>0?'elevated':''}`}><div className="label">Cash Holds</div><div className="value">{holdPlans}</div><div className="meta">Pour plans that currently need additional funding.</div></div>
    </div>

    <div className="alert info"><strong>Cash safety rule:</strong> unpaid A/R, unbilled contract value and retainage still held by the customer are visible but do not count as funding available to authorize a pour.</div>

    <div className="section"><div className="section-heading"><div><div className="section-kicker">Funding</div><div className="section-title">Project Cash Position</div><div className="section-heading-meta">This is a project-funding control, not a live bank-account balance.</div></div></div>
      <div className="project-list">{(funding||[]).map((f:any)=>{
        const balance=num(f.project_funding_balance),risk=num(f.carez_cash_at_risk_to_date);
        return <article className="project-card" key={f.project_id}><header className="project-header"><div><div className="project-name">{f.job_number} — {f.name}</div><div className="project-location">Only collected customer cash is counted.</div></div><span className={`status ${balance>=0?'completed':'on-hold'}`}>{balance>=0?'funded to date':'Carez funded'}</span></header>
          <section className="project-section"><div className="metric-grid">
            <div className="metric-card positive"><div className="label">Gross Customer Cash</div><div className="metric-value">{money(num(f.gross_customer_cash))}</div></div>
            <div className="metric-card"><div className="label">Sales Tax Reserved</div><div className="metric-value">{money(num(f.sales_tax_cash_reserved))}</div><div className="metric-detail">Not treated as spendable project funding</div></div>
            <div className="metric-card"><div className="label">Incurred Direct Cost</div><div className="metric-value">{money(num(f.incurred_direct_cost))}</div><div className="metric-detail">Labor {money(num(f.incurred_labor_cost))} · Other {money(num(f.incurred_nonlabor_cost))}</div></div>
            <div className={`metric-card ${balance>=0?'brand':'danger-metric'}`}><div className="label">Protected Funding Balance</div><div className="metric-value">{money(balance)}</div><div className="metric-detail">Carez cash at risk {money(risk)}</div></div>
          </div>
          <div className="metric-grid section">
            <div className="metric-card"><div className="label">Processing Fees Paid</div><div className="metric-value">{money(num(f.processing_fees_paid))}</div></div>
            <div className="metric-card"><div className="label">Outstanding A/R — Not Counted</div><div className="metric-value">{money(num(f.outstanding_ar_not_counted))}</div></div>
            <div className="metric-card"><div className="label">Unbilled Contract — Not Counted</div><div className="metric-value">{money(num(f.unbilled_contract_not_counted))}</div></div>
            <div className="metric-card"><div className="label">Retainage Held — Not Counted</div><div className="metric-value">{money(num(f.retainage_held_not_counted))}</div></div>
          </div>
        </section></article>;
      })}</div>
    </div>

    <details className="controls-disclosure create-disclosure section"><summary>Create Pour Plan</summary><div className="controls-body"><form action={createPourPlan} className="form">
      <div className="grid grid2"><label className="field"><span>Project</span><select name="project_id" required defaultValue=""><option value="" disabled>Select project</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></label><label className="field"><span>Pour Name / Location</span><input name="name" required placeholder="Basement stem walls — Pour 2"/></label></div>
      <div className="grid grid2"><label className="field"><span>Scheduled Pour Date</span><input type="date" name="scheduled_date" defaultValue={today()}/></label><label className="field"><span>Expected Concrete (CY)</span><input type="number" min="0" step="0.01" name="expected_concrete_yards" defaultValue="0"/></label></div>
      <div className="grid grid2"><label className="field"><span>Budget Scope (optional)</span><select name="budget_section_id" defaultValue=""><option value="">Unassigned</option>{sectionOptions.map((s:any)=>{const p:any=projectMap.get(s.project_id)||{};return <option key={s.id} value={s.id}>{p.job_number||'Job'} — {s.name}</option>;})}</select></label><label className="field"><span>Approved Change Order (optional)</span><select name="change_order_id" defaultValue=""><option value="">Original contract work</option>{(changeOrders||[]).map((co:any)=>{const p:any=projectMap.get(co.project_id)||{};return <option key={co.id} value={co.id}>{p.job_number||'Job'} — {co.co_number} · {co.title}</option>;})}</select></label></div>
      <div className="grid grid2"><label className="field"><span>Contingency %</span><input type="number" min="0" max="100" step="0.1" name="contingency_percent" defaultValue="10"/><span className="meta">Planning safeguard; editable per pour.</span></label><label className="field"><span>Minimum Cash Buffer After Pour</span><input type="number" min="0" step="0.01" name="minimum_cash_buffer" defaultValue="0"/></label></div>
      <label className="field"><span>Company Cash Support Committed</span><input type="number" min="0" step="0.01" name="company_cash_support" defaultValue="0"/><span className="meta">Only enter money Carez is actually willing/able to contribute beyond protected project cash.</span></label>
      <label className="field"><span>Notes</span><textarea rows={2} name="notes"/></label><button className="button">Create Pour Plan</button>
    </form></div></details>

    <div className="section"><div className="section-heading"><div><div className="section-kicker">Authorization</div><div className="section-title">Pour Plans</div><div className="section-heading-meta">Any change to planned cost or funding resets the plan to Planning and requires a fresh authorization review.</div></div></div>
      <div className="project-list">{(plans||[]).length===0?<div className="card"><div className="title">No pour plans yet</div><div className="meta">Create the next planned pour above.</div></div>:(plans||[]).map((p:any)=>{
        const planItems=itemsByPlan.get(p.pour_plan_id)||[];const planReviews=reviewsByPlan.get(p.pour_plan_id)||[];const last=latestReview.get(p.pour_plan_id);const gap=num(p.required_additional_cash),clear=p.system_recommendation==='clear';const liveChanged=p.status==='authorized'&&!clear;const project:any=projectMap.get(p.project_id)||{};const planCOs=coByProject.get(p.project_id)||[];
        const statusClass=p.status==='authorized'?'completed':p.status==='hold'?'on-hold':p.status==='completed'?'completed':'';
        return <article className="project-card" key={p.pour_plan_id}>
          <header className="project-header"><div><div className="project-name">{p.job_number} — {p.name}</div><div className="project-location">{p.scheduled_date?`Scheduled ${p.scheduled_date}`:'Date not set'} · {num(p.expected_concrete_yards).toFixed(2)} CY planned</div></div><span className={`status ${statusClass}`}>{String(p.status).replace('_',' ')}</span></header>

          <section className="project-section tinted"><div className="section-heading"><div><div className="section-kicker">Live Cash Test</div><div className="section-title">{clear?'CLEAR TO COMMIT':'HOLD — FUNDING REQUIRED'}</div><div className="section-heading-meta">Recalculates from current collections, direct costs and this pour plan.</div></div><div className="section-stat">{clear?'Covered':`${money(gap)} gap`}</div></div>
            <div className="metric-grid">
              <div className="metric-card"><div className="label">Planned Exposure</div><div className="metric-value">{money(num(p.planned_exposure))}</div><div className="metric-detail">Before contingency</div></div>
              <div className="metric-card"><div className="label">Contingency</div><div className="metric-value">{money(num(p.contingency_amount))}</div><div className="metric-detail">{num(p.contingency_percent).toFixed(1)}%</div></div>
              <div className={`metric-card ${num(p.project_funding_balance)>=0?'positive':'danger-metric'}`}><div className="label">Protected Project Cash</div><div className="metric-value">{money(num(p.project_funding_balance))}</div><div className="metric-detail">After incurred direct cost</div></div>
              <div className={`metric-card ${clear?'positive':'danger-metric'}`}><div className="label">Required Additional Cash</div><div className="metric-value">{money(gap)}</div><div className="metric-detail">Includes {money(num(p.minimum_cash_buffer))} post-pour buffer</div></div>
            </div>
            <div className="metric-grid section">
              <div className="metric-card"><div className="label">Concrete</div><div className="metric-value">{money(num(p.concrete_cost))}</div></div>
              <div className="metric-card"><div className="label">Labor</div><div className="metric-value">{money(num(p.labor_cost))}</div></div>
              <div className="metric-card"><div className="label">Pump</div><div className="metric-value">{money(num(p.pump_cost))}</div></div>
              <div className="metric-card"><div className="label">Material / Equipment / Subs / Other</div><div className="metric-value">{money(num(p.material_equipment_cost)+num(p.subcontractor_cost)+num(p.other_cost))}</div></div>
            </div>
            {!clear&&<div className="alert danger"><strong>Do not rely on receivables to fund this commitment.</strong> Collect at least {money(gap)} more, reduce planned exposure, or explicitly commit company cash support before authorizing.</div>}
            {liveChanged&&<div className="alert danger"><strong>Authorization is no longer cash-cleared.</strong> Funding/cost conditions changed after the last authorization. Re-review this pour before committing additional money.</div>}
          </section>

          <section className="project-section"><div className="section-heading"><div><div className="section-kicker">Exposure Build-Up</div><div className="section-title">Planned Cash Requirements</div></div><div className="section-stat">Total + contingency {money(num(p.total_exposure_with_contingency))}</div></div>
            <div className="list">{planItems.length===0?<div className="meta">No costs entered yet. A pour with $0 exposure cannot be cash-cleared.</div>:planItems.map((i:any)=><div className="row" key={i.id}><div><div className="title">{i.description}</div><div className="meta">{i.item_type.replace('_',' ')} · {num(i.quantity).toFixed(2)} {i.unit} × {money(num(i.unit_cost))}{i.vendor_name?` · ${i.vendor_name}`:''}{i.committed?' · COMMITTED':''}</div></div><div style={{textAlign:'right'}}><strong>{money(num(i.expected_cost))}</strong>{!['completed','cancelled'].includes(p.status)&&<form action={deletePourCostItem}><input type="hidden" name="item_id" value={i.id}/><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/><button className="button secondary" style={{marginTop:6}}>Delete</button></form>}</div></div>)}</div>

            {!['completed','cancelled'].includes(p.status)&&<div className="split section">
              <details className="controls-disclosure"><summary>Add Concrete / Pump / Material / Equipment / Sub</summary><div className="controls-body"><form action={addPourCostItem} className="form"><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/>
                <div className="grid grid2"><label className="field"><span>Cost Type</span><select name="item_type" defaultValue="concrete"><option value="concrete">Ready-Mix Concrete</option><option value="pump">Concrete Pump</option><option value="material">Material</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other</option></select></label><label className="field"><span>Cost Code</span><select name="cost_code_id" defaultValue=""><option value="">Optional</option>{(costCodes||[]).map((c:any)=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></label></div>
                <label className="field"><span>Catalog Item</span><select name="catalog_item_id" defaultValue=""><option value="">Optional</option>{(catalog||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}{c.vendor_name?` — ${c.vendor_name}`:''}</option>)}</select></label>
                <label className="field"><span>Description</span><input name="description" required placeholder="4000 PSI ready-mix"/></label><div className="grid grid2"><label className="field"><span>Vendor</span><input name="vendor_name"/></label><label className="field"><span>Unit</span><select name="unit" defaultValue="LS">{units.map(u=><option key={u}>{u}</option>)}</select></label></div>
                <div className="grid grid2"><label className="field"><span>Quantity</span><input type="number" min="0" step="0.01" name="quantity" defaultValue="1" required/></label><label className="field"><span>Unit Cost</span><input type="number" min="0" step="0.01" name="unit_cost" required/></label></div>
                <label className="field" style={{display:'flex',gridTemplateColumns:'auto 1fr',alignItems:'center'}}><input type="checkbox" name="committed"/><span>Already ordered / financially committed</span></label><label className="field"><span>Notes</span><input name="notes"/></label><button className="button">Add Planned Cost</button>
              </form></div></details>

              <details className="controls-disclosure"><summary>Add Loaded Labor</summary><div className="controls-body"><form action={addPourLaborItem} className="form"><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/>
                <label className="field"><span>Worker</span><select name="crew_member_id" required defaultValue=""><option value="" disabled>Select worker</option>{(crew||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}{c.is_owner?' — Owner':` — $${num(c.hourly_rate).toFixed(2)}/hr`}</option>)}</select></label>
                <label className="field"><span>Operation / Description</span><input name="description" placeholder="Place and finish concrete"/></label><label className="field"><span>L&I Risk Class</span><select name="risk_class_code" defaultValue="0217-01"><option value="">Owner / not applicable</option>{(risks||[]).map((x:any)=><option key={x.code} value={x.code}>{x.code} — {x.name}</option>)}</select></label>
                <div className="grid grid2"><label className="field"><span>Regular Hours</span><input type="number" min="0" step="0.25" name="regular_hours" defaultValue="8"/></label><label className="field"><span>OT Hours</span><input type="number" min="0" step="0.25" name="overtime_hours" defaultValue="0"/></label></div>
                <label className="field" style={{display:'flex',gridTemplateColumns:'auto 1fr',alignItems:'center'}}><input type="checkbox" name="committed"/><span>Labor commitment already made</span></label><label className="field"><span>Notes</span><input name="notes"/></label><button className="button">Add Loaded Labor</button>
              </form></div></details>
            </div>}
          </section>

          {!['completed','cancelled'].includes(p.status)&&<section className="project-section tinted"><div className="control-grid">
            <div className="subcard"><div className="subcard-title">Plan & Funding Settings</div><form action={updatePourPlan} className="form"><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/><label className="field"><span>Pour Name</span><input name="name" defaultValue={p.name} required/></label><div className="grid grid2"><label className="field"><span>Date</span><input type="date" name="scheduled_date" defaultValue={p.scheduled_date||''}/></label><label className="field"><span>Expected CY</span><input type="number" min="0" step="0.01" name="expected_concrete_yards" defaultValue={num(p.expected_concrete_yards)}/></label></div><div className="grid grid2"><label className="field"><span>Contingency %</span><input type="number" min="0" max="100" step="0.1" name="contingency_percent" defaultValue={num(p.contingency_percent)}/></label><label className="field"><span>Cash Buffer</span><input type="number" min="0" step="0.01" name="minimum_cash_buffer" defaultValue={num(p.minimum_cash_buffer)}/></label></div><label className="field"><span>Company Cash Support</span><input type="number" min="0" step="0.01" name="company_cash_support" defaultValue={num(p.company_cash_support)}/></label><label className="field"><span>Notes</span><input name="notes" defaultValue={p.notes||''}/></label><button className="button secondary">Save & Require Re-Review</button></form></div>

            <div className="subcard"><div className="subcard-title">Authorization Decision</div><div className={`alert ${clear?'success':'danger'}`} style={{marginTop:0}}>{clear?<><strong>System recommendation: CLEAR.</strong> Current protected funding plus committed company support covers the modeled pour exposure and cash buffer.</>:<><strong>System recommendation: HOLD.</strong> Additional required cash: {money(gap)}.</>}</div><form action={recordPourAuthorization} className="form"><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/><label className="field"><span>Decision</span><select name="decision" defaultValue={clear?'authorized':'hold'}><option value="authorized">Authorize Pour</option><option value="hold">Place / Keep on Hold</option></select></label><label className="field"><span>Override Reason</span><textarea rows={2} name="override_reason" placeholder={clear?'Optional':'Required if authorizing despite a funding gap'}/></label><label className="field"><span>Review Notes</span><input name="notes"/></label><button className="button">Record Authorization Snapshot</button></form>{last&&<div className="meta section">Last decision: <strong>{String(last.decision).toUpperCase()}</strong> · system {String(last.system_recommendation).toUpperCase()} · gap {money(num(last.funding_gap))}{last.override_used?' · OVERRIDE USED':''}</div>}</div>
          </div><div className="action-row"><form action={closePourPlan}><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/><input type="hidden" name="status" value="completed"/><button className="button secondary">Mark Pour Completed</button></form><form action={closePourPlan}><input type="hidden" name="pour_plan_id" value={p.pour_plan_id}/><input type="hidden" name="status" value="cancelled"/><button className="button secondary">Cancel Plan</button></form></div></section>}

          {planReviews.length>0&&<section className="project-section"><details className="controls-disclosure"><summary>Authorization History ({planReviews.length})</summary><div className="controls-body"><div className="list">{planReviews.map((x:any)=><div className="row" key={x.id}><div><div className="title">{new Date(x.reviewed_at).toLocaleString()} · {String(x.decision).toUpperCase()}</div><div className="meta">System {String(x.system_recommendation).toUpperCase()} · Exposure {money(num(x.planned_exposure)+num(x.contingency_amount))} · Protected {money(num(x.project_funding_balance))} · Gap {money(num(x.funding_gap))}{x.override_used?` · Override: ${x.override_reason||'No reason recorded'}`:''}</div></div></div>)}</div></div></details></section>}
        </article>;
      })}</div>
    </div>
  </AppShell>;
}
