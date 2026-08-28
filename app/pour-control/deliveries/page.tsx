import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';

const num=(v:any)=>Number(v||0);
const cy=(v:any)=>`${num(v).toFixed(2)} CY`;

export default async function PourDeliveryActualsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const [{data:actuals,error},{data:plans}]=await Promise.all([
    supabase.from('pour_delivery_actual_summary').select('*').order('scheduled_date',{ascending:true,nullsFirst:false}).order('job_number'),
    supabase.from('pour_plan_financial_summary').select('pour_plan_id,status,system_recommendation').order('scheduled_date',{ascending:true,nullsFirst:false})
  ]);

  const statusByPlan=new Map((plans||[]).map((p:any)=>[p.pour_plan_id,p]));
  const rows=(actuals||[]).map((r:any)=>({...r,plan_status:statusByPlan.get(r.pour_plan_id)?.status||'planning',system_recommendation:statusByPlan.get(r.pour_plan_id)?.system_recommendation||null}));
  const active=rows.filter((r:any)=>!['completed','cancelled'].includes(r.plan_status));
  const missingPhotos=active.reduce((s:number,r:any)=>s+num(r.tickets_missing_photo),0);
  const delivered=active.reduce((s:number,r:any)=>s+num(r.delivered_cy),0);
  const planned=active.reduce((s:number,r:any)=>s+num(r.planned_cy),0);
  const overPlan=active.filter((r:any)=>num(r.variance_to_plan_cy)>0.005).length;

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="page-heading"><div><h1 className="page-title">Concrete Delivery Actuals</h1><p className="subtitle">Planned, ordered and delivered ready-mix with ticket-photo coverage by pour.</p></div><div className="action-row"><Link className="button secondary" href="/pour-control">Pour Control</Link><Link className="button" href="/documents">Review Tickets</Link></div></div>

    {error&&<div className="alert danger"><strong>Delivery actuals could not be loaded.</strong> {error.message}</div>}

    <div className="grid grid4">
      <div className="card"><div className="label">Active Planned</div><div className="value">{cy(planned)}</div><div className="meta">Expected concrete across open pours.</div></div>
      <div className="card"><div className="label">Delivered On Site</div><div className="value">{cy(delivered)}</div><div className="meta">Quantity posted from matched concrete delivery tickets.</div></div>
      <div className={`card ${missingPhotos>0?'elevated':''}`}><div className="label">Tickets Missing Photo</div><div className="value">{missingPhotos}</div><div className="meta">Received delivery records that still need supporting ticket images.</div></div>
      <div className={`card ${overPlan>0?'elevated':''}`}><div className="label">Pours Over Plan</div><div className="value">{overPlan}</div><div className="meta">Open pours where delivered CY exceeds planned CY.</div></div>
    </div>

    <div className="alert info"><strong>Field control:</strong> match each concrete ticket photo to its PO delivery record. That updates delivered CY here without creating a duplicate accounting cost.</div>

    <div className="section"><div className="section-heading"><div><div className="section-kicker">Ready-Mix</div><div className="section-title">Pour Delivery Tracking</div><div className="section-heading-meta">Use this during and after a pour to confirm what was planned, ordered, actually delivered and documented.</div></div></div>
      <div className="project-list">{rows.length===0?<div className="card"><div className="title">No concrete delivery activity yet</div><div className="meta">Create a ready-mix PO tied to a pour plan, then match delivery tickets from Documents.</div></div>:rows.map((r:any)=>{
        const plannedCy=num(r.planned_cy),orderedCy=num(r.ordered_cy),deliveredCy=num(r.delivered_cy),remaining=num(r.remaining_to_plan_cy),variance=num(r.variance_to_plan_cy),missing=num(r.tickets_missing_photo),pct=num(r.percent_of_plan_delivered);
        const over=variance>0.005,complete=plannedCy>0&&remaining<=0.005;
        const statusClass=missing>0||over?'on-hold':complete?'completed':'';
        const statusText=missing>0?'MISSING TICKET PHOTO':over?'OVER PLAN':complete?'PLAN DELIVERED':String(r.plan_status||'planning').replace('_',' ').toUpperCase();
        return <article className="project-card" key={r.pour_plan_id}>
          <header className="project-header"><div><div className="project-name">{r.job_number} — {r.pour_name||r.name||'Pour'}</div><div className="project-location">{r.scheduled_date?`Scheduled ${r.scheduled_date}`:'Date not set'} · {pct.toFixed(0)}% of plan delivered</div></div><span className={`status ${statusClass}`}>{statusText}</span></header>
          <section className="project-section"><div className="metric-grid">
            <div className="metric-card"><div className="label">Planned</div><div className="metric-value">{cy(plannedCy)}</div><div className="metric-detail">Pour plan expected CY</div></div>
            <div className="metric-card"><div className="label">Ordered</div><div className="metric-value">{cy(orderedCy)}</div><div className="metric-detail">Ready-mix PO quantity</div></div>
            <div className={`metric-card ${complete?'positive':''}`}><div className="label">On Site</div><div className="metric-value">{cy(deliveredCy)}</div><div className="metric-detail">Matched PO receipts</div></div>
            <div className={`metric-card ${over?'danger-metric':''}`}><div className="label">Variance to Plan</div><div className="metric-value">{variance>0?'+':''}{cy(variance)}</div><div className="metric-detail">Remaining {cy(remaining)}</div></div>
          </div>
          <div className="metric-grid section">
            <div className="metric-card"><div className="label">Delivery Tickets</div><div className="metric-value">{num(r.concrete_ticket_count)}</div><div className="metric-detail">Receipt records posted</div></div>
            <div className="metric-card"><div className="label">Ticket Photos</div><div className="metric-value">{num(r.ticket_photo_count)}</div><div className="metric-detail">Matched document images</div></div>
            <div className={`metric-card ${missing>0?'danger-metric':'positive'}`}><div className="label">Tickets Missing</div><div className="metric-value">{missing}</div><div className="metric-detail">Photos still required</div></div>
            <div className="metric-card"><div className="label">Delivery Window</div><div className="metric-value" style={{fontSize:'1rem'}}>{r.first_delivery_date||'—'}</div><div className="metric-detail">Latest {r.latest_delivery_date||'—'}</div></div>
          </div>
          {missing>0&&<div className="alert danger"><strong>Ticket documentation incomplete.</strong> {missing} delivery {missing===1?'ticket is':'tickets are'} missing a matched photo. <Link href="/documents">Review concrete tickets.</Link></div>}
          {over&&<div className="alert danger"><strong>Delivered concrete is over plan by {cy(Math.abs(variance))}.</strong> Verify added load quantity, waste, field changes and cost exposure before closing the pour.</div>}
          {!over&&plannedCy>0&&orderedCy>0&&orderedCy<plannedCy&&<div className="alert info"><strong>Ordered quantity is below plan.</strong> Planned {cy(plannedCy)} versus ordered {cy(orderedCy)}.</div>}
          <div className="action-row section"><Link className="button secondary" href="/documents">Review Tickets</Link><Link className="button secondary" href="/procurement">Open Procurement</Link><Link className="button secondary" href="/pour-control">Back to Pour Control</Link></div>
        </section></article>;
      })}</div>
    </div>
  </AppShell>;
}
