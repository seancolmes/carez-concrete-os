import Link from 'next/link';
import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createPlacementPackageFromPour,reviewTicketProduction} from './actions';

const num=(v:any)=>Number(v||0);
const cy=(v:any)=>`${num(v).toFixed(2)} CY`;
const syncLabel=(s:string)=>s==='unlinked'?'NOT CONNECTED':s==='waiting_delivery'?'WAITING FOR TICKETS':s==='missing_evidence'?'MISSING TICKET EVIDENCE':s==='pour_open'?'TRACKING LIVE':s==='closed_no_delivery'?'CHECK DELIVERY':s==='needs_review'?'REVIEW ACTUAL':s==='excluded'?'EXCLUDED FROM LEARNING':s==='synced'?'PRODUCTION SYNCED':'READY TO SYNC';
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

function Metric({label,value,detail,tone='default'}:{label:string;value:string;detail?:string;tone?:'default'|'success'|'warning'|'danger'}){
 return <div className={`rounded-lg border border-border bg-muted/20 p-3 ${tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='danger'?'text-destructive':''}`}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>{detail&&<div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div>;
}

export default async function PourDeliveryActualsPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');const companyId=profile.company_id;
 const [{data:rows,error},{data:cyTasks}]=await Promise.all([
  supabase.from('pour_work_package_delivery_sync').select('*').eq('company_id',companyId).order('scheduled_date',{ascending:true,nullsFirst:false}).order('job_number'),
  supabase.from('production_tasks').select('id,name,category,production_unit').eq('company_id',companyId).eq('active',true).eq('production_unit','CY').order('sort_order')
 ]);
 const active=(rows||[]).filter((r:any)=>!['completed','cancelled'].includes(r.pour_status));
 const missingPhotos=active.reduce((s:number,r:any)=>s+num(r.tickets_missing_photo),0);
 const delivered=active.reduce((s:number,r:any)=>s+num(r.delivered_cy),0);
 const planned=active.reduce((s:number,r:any)=>s+num(r.planned_cy),0);
 const linked=(rows||[]).filter((r:any)=>r.operation_id).length;
 const blocked=(rows||[]).filter((r:any)=>['missing_evidence','closed_no_delivery','needs_review'].includes(r.sync_status)).length;
 const synced=(rows||[]).filter((r:any)=>r.sync_status==='synced').length;

 return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ready-mix actuals</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Concrete Deliveries</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Every matched concrete ticket updates delivered CY. Linked placement work uses those same tickets as production quantity—no duplicate field entry.</p></div><div className="flex shrink-0 flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/pour-control">Pour Control</Link><Link className={buttonVariants({variant:'outline'})} href="/production/work-packages">Work Packages</Link><Link className={buttonVariants()} href="/documents">Review Tickets</Link></div></header>

  {error&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><strong>Delivery actuals could not be loaded.</strong> {error.message}</div>}

  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
   <Metric label="Active Planned" value={cy(planned)} detail="Expected ready-mix across open pours."/>
   <Metric label="Delivered On Site" value={cy(delivered)} detail="Posted from concrete delivery receipts."/>
   <Metric label="Tickets Missing Photo" value={String(missingPhotos)} detail="Production auto-close waits for matched evidence." tone={missingPhotos?'danger':'success'}/>
   <Metric label="Automation Exceptions" value={String(blocked)} detail="Only ticket/pour issues needing office attention." tone={blocked?'danger':'success'}/>
   <Metric label="Production Links" value={String(linked)} detail="Pours connected to ticket-measured CY work." tone="success"/>
   <Metric label="Auto-Synced" value={String(synced)} detail="Completed placement scopes fed by ticket actuals." tone="success"/>
  </div>

  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"><strong className="text-foreground">Automation rule:</strong> tickets update actual CY immediately. Carez marks ticket-measured placement complete only after the pour is closed and every receipt has matched ticket evidence. A large quantity variance is held out of estimating history until reviewed.</div>

  <section className="space-y-4" aria-labelledby="delivery-production-title"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ticket → production</div><h2 id="delivery-production-title" className="mt-1 text-lg font-semibold">Pour Delivery & Earned Production</h2><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Planned CY remains the takeoff baseline. Delivered CY becomes the actual. Employee man-hours stay tied to the physical work package.</p></div>
   {(rows||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No concrete delivery activity yet</EmptyTitle><EmptyDescription>Create a pour plan and ready-mix PO. Delivery tickets will appear here and can feed production automatically.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{(rows||[]).map((r:any)=>{
    const plannedCy=num(r.planned_cy),orderedCy=num(r.ordered_cy),deliveredCy=num(r.delivered_cy),remaining=num(r.remaining_to_plan_cy),variance=num(r.variance_to_plan_cy),missing=num(r.tickets_missing_photo),pct=num(r.percent_of_plan_delivered),over=variance>0.005,planDelivered=plannedCy>0&&remaining<=0.005,isLinked=Boolean(r.operation_id),sync=String(r.sync_status||'unlinked');
    const syncTone=sync==='synced'?'border-success/30 bg-success/10 text-success':['missing_evidence','closed_no_delivery','needs_review'].includes(sync)?'border-destructive/30 bg-destructive/10 text-destructive':isLinked?'border-primary/30 bg-primary/10 text-primary':'text-muted-foreground';
    return <Card key={r.pour_plan_id}>
     <header className="flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{r.job_number} — {r.pour_name||'Pour'}</h3><p className="mt-1 text-sm text-muted-foreground">{r.scheduled_date?`Scheduled ${r.scheduled_date}`:'Date not set'} · {pct.toFixed(0)}% of plan delivered</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className={syncTone}>{syncLabel(sync)}</Badge><Badge variant="outline" className={r.pour_status==='completed'?'border-success/30 bg-success/10 text-success':r.pour_status==='authorized'?'border-primary/30 bg-primary/10 text-primary':'text-muted-foreground'}>{String(r.pour_status||'planning').replace('_',' ')}</Badge></div></header>
     <CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Planned" value={cy(plannedCy)} detail="Estimate / pour plan baseline"/><Metric label="Ordered" value={cy(orderedCy)} detail="Issued ready-mix PO quantity"/><Metric label="Ticket Actual" value={cy(deliveredCy)} detail="Matched PO receipts on site" tone={planDelivered?'success':'default'}/><Metric label="Variance" value={`${variance>0?'+':''}${cy(variance)}`} detail={`Remaining to plan ${cy(remaining)}`} tone={over?'danger':'default'}/></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Delivery Tickets" value={String(num(r.concrete_ticket_count))} detail="Receipt records posted"/><Metric label="Ticket Photos" value={String(num(r.ticket_photo_count))} detail="Matched evidence"/><Metric label="Missing Evidence" value={String(missing)} detail="Must be zero for auto-close" tone={missing?'danger':'success'}/><Metric label="Delivery Window" value={r.first_delivery_date||'—'} detail={`Latest ${r.latest_delivery_date||'—'}`}/></div>

      {!isLinked&&r.pour_status!=='cancelled'&&<section className="rounded-lg border border-border bg-muted/20 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="font-semibold">Connect this pour to production</h4><p className="mt-1 text-sm text-muted-foreground">For walls/footings measured in CY, Carez creates the placement work package from this pour. Planned quantity comes across automatically.</p></div><Badge variant="outline" className="shrink-0">One-Time Setup</Badge></div>{plannedCy>0&&<form action={createPlacementPackageFromPour} className="mt-4 grid gap-3"><input type="hidden" name="pour_plan_id" value={r.pour_plan_id}/><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`task-${r.pour_plan_id}`}>CY Placement Work</Label><select id={`task-${r.pour_plan_id}`} className={selectClass} name="production_task_id" defaultValue="" required><option value="" disabled>Choose placement work</option>{(cyTasks||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="grid gap-2"><Label>Production Quantity</Label><div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">{cy(plannedCy)} planned → ticket actual automatically</div></div></div><Button type="submit" className="w-fit">Create Production Link</Button></form>}<p className="mt-4 text-xs text-muted-foreground">Flatwork exception: when production is measured in SF, keep the work package in SF from the takeoff. Tickets still track concrete material CY here, but do not replace the SF production quantity.</p></section>}

      {isLinked&&<section className="rounded-lg border border-border"><div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="font-semibold">Production Link · {r.package_name}</h4><p className="mt-1 text-sm text-muted-foreground">{r.field_label||r.task_name}{r.package_location?` · ${r.package_location}`:''}</p></div><Badge variant="outline" className={syncTone}>{syncLabel(sync)}</Badge></div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Takeoff / Plan" value={cy(r.operation_planned_quantity)}/><Metric label="Production Actual" value={cy(r.actual_quantity)} detail="Source: delivery tickets"/><Metric label="Work Status" value={String(r.operation_status||'planned').replace('_',' ')}/><Metric label="Learning Quality" value={String(r.quantity_review_status||'auto').replace('_',' ')} tone={r.quantity_review_status==='needs_review'?'danger':'success'}/></div></section>}

      {sync==='pour_open'&&<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground"><strong className="text-foreground">Ticket actual is syncing live.</strong><div className="mt-1">When the pour is marked completed, Carez closes the placement work automatically if all ticket evidence is matched.</div></div>}
      {sync==='missing_evidence'&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><strong>Production automation is waiting on ticket evidence.</strong><div className="mt-1">{missing} receipt {missing===1?'is':'are'} missing a matched photo. Delivered CY remains visible, but Carez will not finalize the production sample yet.</div></div>}
      {sync==='closed_no_delivery'&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><strong>The pour is closed with no delivered CY.</strong><div className="mt-1">Check the ready-mix receipt/ticket links before this can become a production sample.</div></div>}
      {sync==='synced'&&<div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"><strong>{cy(r.actual_quantity)} was written to production automatically.</strong><div className="mt-1 text-muted-foreground">No foreman quantity entry was required. Once employee time is approved, this package can teach the Carez production-rate engine.</div></div>}
      {sync==='needs_review'&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"><strong>Ticket quantity is complete but held out of the learning engine.</strong><div className="mt-1 text-muted-foreground">{r.quantity_review_reason||'Review the planned-versus-delivered quantity before using this production sample.'}</div><div className="mt-3 flex flex-wrap gap-2"><form action={reviewTicketProduction}><input type="hidden" name="operation_id" value={r.operation_id}/><input type="hidden" name="decision" value="verify"/><Button type="submit">Verify Actual</Button></form><form action={reviewTicketProduction}><input type="hidden" name="operation_id" value={r.operation_id}/><input type="hidden" name="decision" value="exclude"/><Button type="submit" variant="outline">Exclude From Learning</Button></form></div></div>}
      {sync==='excluded'&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"><strong>This pour is intentionally excluded from production learning.</strong><div className="mt-1 text-muted-foreground">The ticket actual remains in the audit trail but will not influence future Carez estimating rates.</div><form action={reviewTicketProduction} className="mt-3"><input type="hidden" name="operation_id" value={r.operation_id}/><input type="hidden" name="decision" value="verify"/><Button type="submit" variant="outline">Include / Verify Sample</Button></form></div>}
      {over&&sync!=='needs_review'&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"><strong>Delivered concrete is over plan by {cy(Math.abs(variance))}.</strong><div className="mt-1 text-muted-foreground">Carez preserves both values: takeoff plan and ticket actual. Large differences are automatically quarantined from learning.</div></div>}

      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/documents">Review Tickets</Link><Link className={buttonVariants({variant:'outline'})} href="/procurement">Open Procurement</Link><Link className={buttonVariants({variant:'outline'})} href="/production/work-packages">Production Packages</Link></div>
     </CardContent>
    </Card>;
   })}</div>}
  </section>
 </div></AppShell>;
}
