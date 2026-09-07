import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent} from '@/components/ui/card';
import {Empty,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {approveEmployeeShift,rejectEmployeeShift,saveDailyProduction} from '../employee-actions';

const hoursBetween=(a:string,b:string)=>Math.max(0,(new Date(b).getTime()-new Date(a).getTime())/3600000);
const h=(n:number)=>`${n.toFixed(2)} hr`;
const fmt=(v:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v));
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function FieldReviewPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const [{data:shifts},{data:breaks},{data:segments},{data:tasks},{data:projects},{data:riskClasses},{data:rates}]=await Promise.all([
  supabase.from('employee_shift_sessions').select('*,crew_members(name,default_risk_class_code),projects(job_number,name,address,city,geofence_radius_ft)').eq('status','submitted').order('work_date',{ascending:false}).order('clock_in_at'),
  supabase.from('employee_break_periods').select('*'),
  supabase.from('employee_task_segments').select('*,production_tasks(name,production_unit,category),work_package_operations(field_label,planned_quantity,unit,work_packages(name,location))').order('started_at'),
  supabase.from('production_tasks').select('*').eq('active',true).order('sort_order'),
  supabase.from('projects').select('id,job_number,name').eq('status','active').order('job_number'),
  supabase.from('li_risk_classes').select('code,name').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'),
  supabase.from('earned_production_rate_history').select('*').eq('company_id',profile.company_id).order('completed_at',{ascending:false}).limit(30)
 ]);
 const breakMap=new Map<string,any[]>();for(const b of breaks||[]){const a=breakMap.get(b.shift_id)||[];a.push(b);breakMap.set(b.shift_id,a);}
 const segMap=new Map<string,any[]>();for(const s of segments||[]){const a=segMap.get(s.shift_id)||[];a.push(s);segMap.set(s.shift_id,a);}
 const all=shifts||[];
 const needsAttention=all.filter((s:any)=>Boolean(s.requires_review)||s.clock_in_inside_geofence===false||s.clock_out_inside_geofence===false||(s.task_coverage_percent!=null&&Number(s.task_coverage_percent)<90)||(segMap.get(s.id)||[]).length===0);
 const attentionIds=new Set(needsAttention.map((s:any)=>s.id));
 const clean=all.filter((s:any)=>!attentionIds.has(s.id));

 const shiftCard=(s:any)=>{
  const bs=breakMap.get(s.id)||[];
  const breakHours=bs.reduce((sum:number,b:any)=>sum+(b.ended_at?hoursBetween(b.started_at,b.ended_at):0),0);
  const raw=hoursBetween(s.clock_in_at,s.clock_out_at);
  const payable=Math.max(0,raw-breakHours);
  const segs=segMap.get(s.id)||[];
  const gpsBad=s.clock_in_inside_geofence===false||s.clock_out_inside_geofence===false;
  const reasons:string[]=Array.isArray(s.review_reasons)?s.review_reasons:[];
  const coverage=s.task_coverage_percent==null?null:Number(s.task_coverage_percent);
  const flagged=attentionIds.has(s.id);
  return <Card key={s.id} className={flagged?'border-warning/30':''}><header className="flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold">{s.crew_members?.name} · {s.projects?.job_number} — {s.projects?.name}</h3><p className="mt-1 text-sm text-muted-foreground">{s.work_date} · {fmt(s.clock_in_at)} to {fmt(s.clock_out_at)}</p></div><Badge variant="outline" className={flagged?'border-warning/30 bg-warning/10 text-warning':'border-success/30 bg-success/10 text-success'}>{flagged?'Review':'Clean'}</Badge></header><CardContent className="space-y-5">
   {flagged&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm"><div className="font-medium text-warning">Carez flagged this shift.</div><div className="mt-1 text-muted-foreground">{reasons.length?reasons.join(' · '):segs.length===0?'No work was identified during the shift.':gpsBad?'GPS needs review.':'Work tracking needs review.'}</div></div>}

   <div className="grid gap-3 sm:grid-cols-3">
    <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Calculated Work Time</div><div className="mt-1 text-lg font-semibold tabular-nums">{h(payable)}</div><div className="mt-1 text-xs text-muted-foreground">{h(raw)} elapsed − {h(breakHours)} breaks</div></div>
    <div className={`rounded-lg border bg-muted/20 p-3 ${coverage!=null&&coverage<90?'border-destructive/30':'border-success/30'}`}><div className="text-xs font-medium text-muted-foreground">Work Identified</div><div className={`mt-1 text-lg font-semibold ${coverage!=null&&coverage<90?'text-destructive':'text-success'}`}>{coverage==null?'Legacy':`${Math.round(coverage)}%`}</div><div className="mt-1 text-xs text-muted-foreground">{coverage==null?'Shift predates task coverage tracking':coverage>=90?'Work coverage looks complete':'Some paid time has no work assignment'}</div></div>
    <div className={`rounded-lg border bg-muted/20 p-3 ${gpsBad?'border-destructive/30':'border-success/30'}`}><div className="text-xs font-medium text-muted-foreground">GPS</div><div className={`mt-1 text-lg font-semibold ${gpsBad?'text-destructive':'text-success'}`}>{gpsBad?'Check':'OK'}</div><div className="mt-1 text-xs text-muted-foreground">In {s.clock_in_distance_ft==null?'—':`${Math.round(Number(s.clock_in_distance_ft))} ft`} · Out {s.clock_out_distance_ft==null?'—':`${Math.round(Number(s.clock_out_distance_ft))} ft`}</div></div>
   </div>

   <div className="rounded-lg border border-border"><div className="border-b border-border px-3 py-3"><div className="font-medium">Physical Work Identified</div><div className="mt-1 text-xs text-muted-foreground">Package-linked hours become estimating intelligence when the package is finished and this time is approved.</div></div><div className="divide-y">{segs.length===0?<div className="px-3 py-4 text-sm text-muted-foreground">No work selected.</div>:segs.map((x:any)=>{const op:any=x.work_package_operations;const pkg:any=op?.work_packages;return <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="font-medium">{pkg?.name||op?.field_label||x.production_tasks?.name}</div><div className="mt-1 text-xs text-muted-foreground">{pkg?`${op?.field_label||x.production_tasks?.name}${pkg.location?` · ${pkg.location}`:''} · ${Number(op.planned_quantity||0).toLocaleString(undefined,{maximumFractionDigits:2})} ${op.unit} known scope · `:''}{fmt(x.started_at)} – {x.ended_at?fmt(x.ended_at):'open'}{x.notes?` · ${x.notes}`:''}</div></div><strong className="tabular-nums">{x.ended_at?h(hoursBetween(x.started_at,x.ended_at)):'—'}</strong></div>})}</div></div>

   {s.employee_note&&<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm"><strong>Employee note:</strong> <span className="text-muted-foreground">{s.employee_note}</span></div>}

   <form action={approveEmployeeShift} className="grid gap-4 border-t border-border pt-4"><input type="hidden" name="shift_id" value={s.id}/><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`regular-${s.id}`}>Regular Hours</Label><Input id={`regular-${s.id}`} type="number" name="regular_hours" step="0.01" min="0" defaultValue={payable.toFixed(2)} required/></div><div className="grid gap-2"><Label htmlFor={`overtime-${s.id}`}>Overtime Hours</Label><Input id={`overtime-${s.id}`} type="number" name="overtime_hours" step="0.01" min="0" defaultValue="0"/></div></div><div className="grid gap-2"><Label htmlFor={`risk-${s.id}`}>L&amp;I Work Class</Label><select id={`risk-${s.id}`} className={selectClass} name="risk_class_code" defaultValue={s.crew_members?.default_risk_class_code||''}><option value="">Choose class</option>{(riskClasses||[]).map((r:any)=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor={`owner-note-${s.id}`}>Owner Note (optional)</Label><Input id={`owner-note-${s.id}`} name="owner_note" placeholder="Only add a note if you changed or confirmed something."/></div><Button type="submit" className="w-fit">{flagged?'Approve After Review':'Approve Clean Shift'}</Button></form>
   {flagged&&<form action={rejectEmployeeShift}><input type="hidden" name="shift_id" value={s.id}/><input type="hidden" name="owner_note" value="Rejected for correction"/><Button type="submit" variant="outline">Reject / Needs Correction</Button></form>}
  </CardContent></Card>;
 };

 return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><header><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exception-based time</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Time Review</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Clean time should take one click. Work-package hours are already tied to the physical scope that will produce Carez&apos;s real production rate.</p></header><div className="flex flex-wrap gap-2"><Link className={buttonVariants({variant:'outline'})} href="/production/work-packages">Work Packages</Link><Link className={buttonVariants({variant:'outline'})} href="/production">Production Control</Link><Link className={buttonVariants({variant:'outline'})} href="/field">Back to Field</Link></div></div>

  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   <Card size="sm"><CardContent className={`h-full space-y-1 ${needsAttention.length?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Need Attention</div><div className="text-2xl font-semibold tabular-nums">{needsAttention.length}</div><div className="text-xs text-muted-foreground">GPS, missing work time or other exceptions.</div></CardContent></Card>
   <Card size="sm"><CardContent className={`h-full space-y-1 ${clean.length?'text-success':''}`}><div className="text-xs font-medium text-muted-foreground">Clean Shifts</div><div className="text-2xl font-semibold tabular-nums">{clean.length}</div><div className="text-xs text-muted-foreground">Calculated hours and package tracking look normal.</div></CardContent></Card>
   <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Total Waiting</div><div className="text-2xl font-semibold tabular-nums">{all.length}</div><div className="text-xs text-muted-foreground">Nothing reaches payroll until you approve it.</div></CardContent></Card>
   <Card size="sm"><CardContent className="h-full space-y-1"><div className="text-xs font-medium text-muted-foreground">Earned Rate Samples</div><div className="text-2xl font-semibold tabular-nums">{(rates||[]).length}</div><div className="text-xs text-muted-foreground">Completed packages with fully approved crew man-hours.</div></CardContent></Card>
  </div>

  {needsAttention.length>0&&<section className="space-y-4"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Look here first</div><h2 className="mt-1 text-lg font-semibold">Exceptions</h2><p className="mt-1 text-sm text-muted-foreground">These are the only submitted shifts Carez thinks deserve a closer look.</p></div><div className="space-y-4">{needsAttention.map(shiftCard)}</div></section>}

  <section className="space-y-4"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">One-click review</div><h2 className="mt-1 text-lg font-semibold">Clean Shifts</h2><p className="mt-1 text-sm text-muted-foreground">No GPS or work-coverage exception detected. Confirm regular/overtime split and approve.</p></div>{clean.length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No clean shifts waiting</EmptyTitle><EmptyDescription>When employees submit clean time it will appear here.</EmptyDescription></EmptyHeader></Empty>:<div className="space-y-4">{clean.map(shiftCard)}</div>}</section>

  <section className="space-y-4"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exception only</div><h2 className="mt-1 text-lg font-semibold">Manual Production Quantity</h2><p className="mt-1 text-sm text-muted-foreground">Normal production now comes from Work Packages. Use this only for unexpected work that genuinely has no predefined package.</p></div><Card><CardContent><form action={saveDailyProduction} className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="production-project">Job</Label><select id="production-project" className={selectClass} name="project_id" defaultValue="" required><option value="" disabled>Choose job</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="production-date">Date</Label><Input id="production-date" type="date" name="work_date" defaultValue={new Date().toISOString().slice(0,10)} required/></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="production-task">Unplanned Work</Label><select id="production-task" className={selectClass} name="production_task_id" defaultValue="" required><option value="" disabled>Choose work</option>{(tasks||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name} · {t.production_unit}</option>)}</select></div><div className="grid gap-2"><Label htmlFor="production-quantity">Quantity Completed</Label><Input id="production-quantity" type="number" name="quantity_completed" step="0.01" min="0" required/></div></div><div className="grid gap-2"><Label htmlFor="production-unit">Unit</Label><select id="production-unit" className={selectClass} name="unit" defaultValue="LF"><option>LF</option><option>SF</option><option>CY</option><option>EA</option><option>LB</option><option>TON</option><option>HR</option></select></div><div className="grid gap-2"><Label htmlFor="production-notes">Why was this outside a work package?</Label><Input id="production-notes" name="notes" required placeholder="Change order, unexpected repair, field-directed extra work..."/></div><Button type="submit" variant="outline" className="w-fit">Save Exception Production</Button></form></CardContent></Card></section>

  <section className="space-y-4"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Carez history</div><h2 className="mt-1 text-lg font-semibold">Earned Production Rates</h2><p className="mt-1 text-sm text-muted-foreground">Completed physical scopes with approved employee man-hours—not daily estimates from a foreman.</p></div>{(rates||[]).length===0?<Empty className="border border-border"><EmptyHeader><EmptyTitle>No earned rates yet</EmptyTitle><EmptyDescription>Finish a work package operation and approve its employee time to create the first trusted sample.</EmptyDescription></EmptyHeader></Empty>:<div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Completed</TableHead><TableHead>Job / Package</TableHead><TableHead>Work</TableHead><TableHead>Quantity</TableHead><TableHead>Man-Hours</TableHead><TableHead>Production</TableHead><TableHead>MH / Unit</TableHead></TableRow></TableHeader><TableBody>{(rates||[]).map((r:any)=><TableRow key={r.operation_id}><TableCell>{r.completed_date}</TableCell><TableCell>{r.job_number} — {r.package_name}</TableCell><TableCell>{r.task_name}</TableCell><TableCell className="tabular-nums">{Number(r.quantity_completed).toFixed(2)} {r.unit}</TableCell><TableCell className="tabular-nums">{Number(r.man_hours).toFixed(2)} MH</TableCell><TableCell className="tabular-nums">{Number(r.units_per_man_hour).toFixed(2)} {r.unit}/MH</TableCell><TableCell className="tabular-nums">{Number(r.man_hours_per_unit).toFixed(4)} MH/{r.unit}</TableCell></TableRow>)}</TableBody></Table></div>}</section>
 </div></AppShell>;
}
