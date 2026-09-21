import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/server';
import { createChangeOrder,addChangeOrderItem,updateChangeOrder,approveChangeOrder,rejectChangeOrder,deleteChangeOrderItem } from './actions';

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const num=(v:any)=>Number(v||0);
const today=()=>new Date().toISOString().slice(0,10);
const units=['CY','LF','SF','LB','EA','HR','DAY','TON','GAL','LS'];
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function ChangeOrdersPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id').eq('id',user.id).single();
  const [{data:projects},{data:summaries},{data:items},{data:codes},{data:catalog},{data:crew},{data:riskClasses}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status').order('job_number'),
    supabase.from('change_order_financial_summary').select('*').order('requested_date',{ascending:false}),
    supabase.from('change_order_items').select('*').order('sort_order'),
    supabase.from('cost_codes').select('id,code,name,cost_type').eq('active',true).order('sort_order'),
    supabase.from('cost_catalog_items').select('id,name,cost_code_id,default_unit,default_unit_cost').eq('active',true).order('name'),
    supabase.from('crew_members').select('id,name,is_owner,hourly_rate').eq('active',true).order('name'),
    profile?.company_id?supabase.from('li_risk_classes').select('code,name').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'):Promise.resolve({data:[]})
  ]);
  const projectMap=new Map((projects||[]).map((p:any)=>[p.id,p]));
  const openProjects=(projects||[]).filter((p:any)=>['active','on_hold'].includes(p.status));
  const itemMap=new Map<string,any[]>();for(const i of items||[]){if(!itemMap.has(i.change_order_id))itemMap.set(i.change_order_id,[]);itemMap.get(i.change_order_id)!.push(i);}
  const pendingExposure=(summaries||[]).filter((c:any)=>c.status!=='approved'&&c.status!=='rejected'&&c.status!=='void').reduce((s:number,c:any)=>s+Math.max(0,num(c.actual_company_exposure)),0);
  const approvedValue=(summaries||[]).filter((c:any)=>c.status==='approved').reduce((s:number,c:any)=>s+num(c.selected_sell_price),0);
  const submitted=(summaries||[]).filter((c:any)=>c.status==='submitted').length;
  const activeCOs=(summaries||[]).filter((c:any)=>!['rejected','void'].includes(c.status)).length;

  return <AppShell userName={profile?.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project control</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Change Orders</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Price, approve and track added or deleted scope without rewriting the original project budget.</p></header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card size="sm"><CardContent className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Active Change Orders</div><div className="text-2xl font-semibold tabular-nums">{activeCOs}</div></CardContent></Card>
      <Card size="sm"><CardContent className={submitted?'space-y-1 text-warning':'space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Awaiting Approval</div><div className="text-2xl font-semibold tabular-nums">{submitted}</div></CardContent></Card>
      <Card size="sm"><CardContent className="space-y-1"><div className="text-xs font-medium text-muted-foreground">Approved Contract Changes</div><div className="text-2xl font-semibold tabular-nums">{money(approvedValue)}</div></CardContent></Card>
      <Card size="sm" className={pendingExposure>0?'border-destructive/30':''}><CardContent className={pendingExposure>0?'space-y-1 text-destructive':'space-y-1 text-success'}><div className="text-xs font-medium text-muted-foreground">Unapproved Field Exposure</div><div className="text-2xl font-semibold tabular-nums">{money(pendingExposure)}</div></CardContent></Card>
    </div>

    <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">Create Change Order</summary><div className="border-t border-border p-4"><form action={createChangeOrder} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="co-project">Project</Label><select id="co-project" className={selectClass} name="project_id" required defaultValue=""><option value="" disabled>Select project</option>{openProjects.map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="co-type">Change Type</Label><select id="co-type" className={selectClass} name="change_type" defaultValue="additive"><option value="additive">Additive — increases contract</option><option value="deductive">Deductive — customer credit</option><option value="no_cost">No-cost — Carez absorbs cost</option></select></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="co-title">Title</Label><Input id="co-title" name="title" required placeholder="Additional patio extension"/></div><div className="grid gap-2"><Label htmlFor="co-requested-date">Requested Date</Label><Input id="co-requested-date" type="date" name="requested_date" defaultValue={today()} required/></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="co-requested-by">Requested By</Label><Input id="co-requested-by" name="requested_by" placeholder="Owner, GC, architect..."/></div><div className="grid gap-2"><Label htmlFor="co-reason">Reason</Label><Input id="co-reason" name="reason" placeholder="Owner request, unforeseen condition..."/></div></div>
      <div className="grid gap-2"><Label htmlFor="co-description">Scope Description</Label><Textarea id="co-description" name="description" rows={3} placeholder="Describe exactly what is being added, removed or changed."/></div>
      <Button type="submit" className="w-fit">Create Draft Change Order</Button>
    </form></div></details>

    <section className="space-y-4" aria-labelledby="change-orders-list"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commercial changes</div><h2 id="change-orders-list" className="mt-1 text-lg font-semibold">Change Order Register</h2></div>
    {(summaries||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No change orders yet</EmptyTitle><EmptyDescription>Create one when project scope changes after the original estimate is approved.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(summaries||[]).map((co:any)=>{
      const project:any=projectMap.get(co.project_id)||{};
      const coItems=itemMap.get(co.change_order_id)||[];
      const locked=['approved','rejected','void'].includes(co.status);
      const exposure=num(co.actual_company_exposure);
      const selected=num(co.selected_sell_price);
      const recommended=num(co.recommended_sell_price);
      const profitImpact=num(co.projected_profit_impact);
      const typeLabel=co.change_type==='deductive'?'Deductive':co.change_type==='no_cost'?'No Cost':'Additive';
      const statusClass=co.status==='approved'?'border-success/30 bg-success/10 text-success':co.status==='submitted'?'border-warning/30 bg-warning/10 text-warning':co.status==='rejected'?'border-destructive/30 bg-destructive/10 text-destructive':'text-muted-foreground';
      return <Card key={co.change_order_id}><header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{co.co_number} — {co.title}</h3><p className="mt-1 text-sm text-muted-foreground">{project.job_number||'Job'} — {project.name||'Project'} · {typeLabel} · requested {co.requested_date}{co.requested_by?` by ${co.requested_by}`:''}</p></div><Badge variant="outline" className={statusClass}>{co.status}</Badge></header><CardContent className="space-y-6">

        <section className="space-y-4"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commercial impact</div><h4 className="mt-1 font-semibold">Change Order Economics</h4><p className="mt-1 text-sm text-muted-foreground">Original project budget remains frozen. Approved COs become separate authorized budgets.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Direct Cost Impact</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(num(co.total_direct_cost))}</div><div className="mt-1 text-xs text-muted-foreground">Labor {money(num(co.direct_labor_cost))} · Other {money(num(co.total_direct_cost)-num(co.direct_labor_cost))}</div></div>
          <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Overhead Impact</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(num(co.overhead_cost))}</div><div className="mt-1 text-xs text-muted-foreground">{Math.abs(num(co.labor_hours)).toFixed(1)} labor hr × snapshotted OH rate</div></div>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-3"><div className="text-xs font-medium text-muted-foreground">Recommended Price</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(recommended)}</div><div className="mt-1 text-xs text-muted-foreground">Target margin {num(co.target_margin_percent).toFixed(1)}%</div></div>
          <div className={`rounded-lg border bg-muted/20 p-3 ${profitImpact>=0?'border-success/30 text-success':'border-destructive/30 text-destructive'}`}><div className="text-xs font-medium text-muted-foreground">Selected Price / Profit Impact</div><div className="mt-1 text-lg font-semibold tabular-nums">{money(selected)}</div><div className="mt-1 text-xs text-muted-foreground">Projected profit impact {money(profitImpact)}</div></div>
        </div>
        {co.status!=='approved'&&exposure>0&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"><strong>Unapproved exposure: {money(exposure)}.</strong> Carez has already incurred cost against this change before customer approval.</div>}
        {co.change_type==='no_cost'&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning"><strong>No-cost change.</strong> Revenue remains $0 while actual/budgeted cost still reduces project profit.</div>}</section>

        <section className="space-y-4 border-t border-border pt-5"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope</div><h4 className="mt-1 font-semibold">Cost Build-Up</h4><p className="mt-1 text-sm text-muted-foreground">Each line can be a real cost or a credit / avoided cost.</p></div>
          {coItems.length===0?<div className="text-sm text-muted-foreground">No scope items entered yet.</div>:<div className="divide-y rounded-lg border border-border">{coItems.map((i:any)=><div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={i.id}><div><div className="font-medium">{i.description}</div><div className="mt-1 text-xs text-muted-foreground">{i.item_type} · {i.cost_effect==='credit'?'Credit / avoided cost':'Cost'} · {Math.abs(num(i.quantity)).toFixed(2)} {i.unit}{i.item_type==='labor'&&i.labor_task?` · ${i.labor_task}`:''}</div></div><div className="flex items-center gap-2 sm:flex-col sm:items-end"><strong className="tabular-nums">{money(num(i.direct_cost))}</strong>{co.status==='draft'&&<form action={deleteChangeOrderItem}><input type="hidden" name="item_id" value={i.id}/><input type="hidden" name="change_order_id" value={co.change_order_id}/><Button type="submit" variant="outline" size="sm">Delete</Button></form>}</div></div>)}</div>}

          {!locked&&co.status==='draft'&&<div className="grid gap-3 xl:grid-cols-2">
            <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Labor</summary><div className="border-t border-border p-3"><form action={addChangeOrderItem} className="grid gap-4"><input type="hidden" name="change_order_id" value={co.change_order_id}/><input type="hidden" name="item_type" value="labor"/>
              <div className="grid gap-2"><Label htmlFor={`labor-description-${co.change_order_id}`}>Description</Label><Input id={`labor-description-${co.change_order_id}`} name="description" required placeholder="Form additional wall"/></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`labor-worker-${co.change_order_id}`}>Worker</Label><select id={`labor-worker-${co.change_order_id}`} className={selectClass} name="crew_member_id" required defaultValue=""><option value="" disabled>Select worker</option>{(crew||[]).map(c=><option key={c.id} value={c.id}>{c.name}{c.is_owner?' — Owner':` — $${num(c.hourly_rate).toFixed(2)}/hr`}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`labor-effect-${co.change_order_id}`}>Cost Effect</Label><select id={`labor-effect-${co.change_order_id}`} className={selectClass} name="cost_effect" defaultValue={co.change_type==='deductive'?'credit':'cost'}><option value="cost">Cost — work Carez must perform</option><option value="credit">Credit — work/cost being removed</option></select></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`labor-operation-${co.change_order_id}`}>Operation</Label><select id={`labor-operation-${co.change_order_id}`} className={selectClass} name="labor_task" defaultValue="Formwork"><option>Formwork</option><option>Rebar</option><option>Placement</option><option>Finishing</option><option>Strip</option><option>Cleanup</option><option>Layout</option><option>General</option></select></div><div className="grid gap-2"><Label htmlFor={`labor-risk-${co.change_order_id}`}>L&amp;I Risk Class</Label><select id={`labor-risk-${co.change_order_id}`} className={selectClass} name="risk_class_code" defaultValue="0217-01">{(riskClasses||[]).map(r=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`labor-regular-${co.change_order_id}`}>Regular Hours</Label><Input id={`labor-regular-${co.change_order_id}`} type="number" min="0" step="0.25" name="regular_hours" required defaultValue="8"/></div><div className="grid gap-2"><Label htmlFor={`labor-overtime-${co.change_order_id}`}>Overtime Hours</Label><Input id={`labor-overtime-${co.change_order_id}`} type="number" min="0" step="0.25" name="overtime_hours" defaultValue="0"/></div></div>
              <Button type="submit" className="w-fit">Add Labor</Button>
            </form></div></details>

            <details className="rounded-lg border border-border"><summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium">Add Material / Equipment / Sub</summary><div className="border-t border-border p-3"><form action={addChangeOrderItem} className="grid gap-4"><input type="hidden" name="change_order_id" value={co.change_order_id}/>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`cost-type-${co.change_order_id}`}>Type</Label><select id={`cost-type-${co.change_order_id}`} className={selectClass} name="item_type" defaultValue="material"><option value="material">Material</option><option value="equipment">Equipment</option><option value="subcontractor">Subcontractor</option><option value="other">Other Direct</option></select></div><div className="grid gap-2"><Label htmlFor={`cost-effect-${co.change_order_id}`}>Cost Effect</Label><select id={`cost-effect-${co.change_order_id}`} className={selectClass} name="cost_effect" defaultValue={co.change_type==='deductive'?'credit':'cost'}><option value="cost">Cost — Carez will incur</option><option value="credit">Credit — avoided cost</option></select></div></div>
              <div className="grid gap-2"><Label htmlFor={`cost-code-${co.change_order_id}`}>Cost Code</Label><select id={`cost-code-${co.change_order_id}`} className={selectClass} name="cost_code_id" defaultValue=""><option value="">Select if applicable</option>{(codes||[]).map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}</select></div>
              <div className="grid gap-2"><Label htmlFor={`catalog-item-${co.change_order_id}`}>Catalog Item</Label><select id={`catalog-item-${co.change_order_id}`} className={selectClass} name="catalog_item_id" defaultValue=""><option value="">Custom / not cataloged</option>{(catalog||[]).map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
              <div className="grid gap-2"><Label htmlFor={`cost-description-${co.change_order_id}`}>Description</Label><Input id={`cost-description-${co.change_order_id}`} name="description" required placeholder="4000 PSI ready-mix, pump, #4 rebar..."/></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`cost-quantity-${co.change_order_id}`}>Quantity</Label><Input id={`cost-quantity-${co.change_order_id}`} type="number" min="0" step="0.01" name="quantity" defaultValue="1" required/></div><div className="grid gap-2"><Label htmlFor={`cost-unit-${co.change_order_id}`}>Unit</Label><select id={`cost-unit-${co.change_order_id}`} className={selectClass} name="unit" defaultValue="LS">{units.map(u=><option key={u}>{u}</option>)}</select></div></div>
              <div className="grid gap-2"><Label htmlFor={`cost-unit-cost-${co.change_order_id}`}>Unit Cost</Label><Input id={`cost-unit-cost-${co.change_order_id}`} type="number" min="0" step="0.01" name="unit_cost" required/></div>
              <Button type="submit" className="w-fit">Add Cost Item</Button>
            </form></div></details>
          </div>}
        </section>

        <section className="space-y-4 border-t border-border pt-5">
          {!locked?<><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</div><h4 className="mt-1 font-semibold">Commercial Controls</h4></div><form action={updateChangeOrder} className="grid gap-4"><input type="hidden" name="change_order_id" value={co.change_order_id}/>
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`margin-${co.change_order_id}`}>Target Margin %</Label><Input id={`margin-${co.change_order_id}`} type="number" min="0" max="80" step="0.1" name="target_margin_percent" defaultValue={num(co.target_margin_percent)}/></div><div className="grid gap-2"><Label htmlFor={`price-${co.change_order_id}`}>Price Override</Label><Input id={`price-${co.change_order_id}`} type="number" min="0" step="0.01" name="proposed_sell_price" defaultValue={Math.abs(num(co.proposed_sell_price))} placeholder={Math.abs(recommended).toFixed(2)}/></div></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`processing-${co.change_order_id}`}>Payment Processing Reserve %</Label><Input id={`processing-${co.change_order_id}`} type="number" min="0" step="0.01" name="payment_processing_rate_percent" defaultValue={num(co.payment_processing_rate_percent)}/></div><div className="grid gap-2"><Label htmlFor={`field-status-${co.change_order_id}`}>Field Work Status</Label><select id={`field-status-${co.change_order_id}`} className={selectClass} name="field_work_status" defaultValue={co.field_work_status}><option value="not_started">Not Started</option><option value="directed">Directed / Proceeding Before Approval</option><option value="in_progress">In Progress</option><option value="complete">Complete</option></select></div></div>
            <div className="grid gap-2"><Label htmlFor={`workflow-status-${co.change_order_id}`}>Workflow Status</Label><select id={`workflow-status-${co.change_order_id}`} className={selectClass} name="status" defaultValue={co.status}><option value="draft">Draft — editable</option><option value="submitted">Submitted — awaiting approval</option></select></div>
            <Button type="submit" variant="outline" className="w-fit">Save Change Order</Button>
          </form>
          {co.status==='submitted'&&<div className="flex flex-wrap gap-2"><form action={approveChangeOrder}><input type="hidden" name="change_order_id" value={co.change_order_id}/><Button type="submit">Approve & Freeze CO Budget</Button></form><form action={rejectChangeOrder}><input type="hidden" name="change_order_id" value={co.change_order_id}/><Button type="submit" variant="outline">Mark Rejected</Button></form></div>}</>:<div className={`rounded-lg border px-3 py-3 text-sm ${co.status==='approved'?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning'}`}><strong>{co.status==='approved'?'Approved and frozen.':'Change order closed.'}</strong> {co.status==='approved'?'Contract value and authorized budget now include this change.':'This change no longer affects the authorized project budget.'}</div>}
        </section>
      </CardContent></Card>;
    })}</div>}
    </section>

    <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/projects">Projects</Link><Link className={buttonVariants({variant:'outline'})} href="/forecast">Forecast</Link><Link className={buttonVariants({variant:'outline'})} href="/field">Field</Link></div>
  </div></AppShell>;
}
