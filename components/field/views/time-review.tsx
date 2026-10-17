import {randomUUID} from 'node:crypto';
import {ShiftReviewControls} from '@/components/field/ShiftReviewControls';
import {shiftLocationEvidence} from '@/lib/field/gpsEvidence';
import {workCoverage} from '@/lib/field/workCoverage';
import {Badge,Button,Dialog,DialogTitle,DialogTrigger,Input,Label,Table,TableBody,TableCell,TableHeader,TableRow,DialogBody,DialogContent,DialogSurface,TableHeaderCell,Select} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/server';
import {saveDailyProduction} from '@/app/field/employee-actions';

const hoursBetween=(a:string,b:string)=>Math.max(0,(new Date(b).getTime()-new Date(a).getTime())/3600000);
const h=(n:number)=>`${n.toFixed(2)} hr`;
const fmt=(v:string,zone='UTC')=>new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v));
const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export default async function FieldReviewPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
 if(!profile?.company_id||profile.role==='employee')redirect('/employee');
 const [{data:shifts,error:shiftsError},{data:breaks,error:breaksError},{data:segments,error:segmentsError},{data:tasks,error:tasksError},{data:projects,error:projectsError},{data:riskClasses,error:riskClassesError},{data:rates,error:ratesError},basisRead,correctionRead]=await Promise.all([
  supabase.from('employee_shift_sessions').select('*,crew_members(name),projects(job_number,name,address,city,geofence_radius_ft)').eq('status','submitted').order('work_date',{ascending:false}).order('clock_in_at'),
  supabase.from('employee_break_periods').select('*'),
  supabase.from('employee_task_segments').select('*,production_tasks(name,production_unit,category),work_package_operations(field_label,planned_quantity,unit,work_packages(name,location))').order('started_at'),
  supabase.from('production_tasks').select('*').eq('active',true).order('sort_order'),
  supabase.from('projects').select('id,job_number,name').eq('status','active').order('job_number'),
  supabase.from('li_risk_classes').select('code,name,tax_year').eq('company_id',profile.company_id).eq('active',true).order('code'),
  supabase.from('earned_production_rate_history').select('*').eq('company_id',profile.company_id).order('completed_at',{ascending:false}).limit(30),
  supabase.from('labor_basis_reviews').select('*').eq('company_id',profile.company_id),
  supabase.from('employee_shift_corrections').select('id,shift_id,employee_note,created_at,prior_review').eq('company_id',profile.company_id).order('created_at')
 ]);
 if(shiftsError||breaksError||segmentsError)return <section className="space-y-2 border border-border bg-card p-4"><h1 className="font-semibold text-foreground">Time review unavailable</h1><p className="text-sm text-muted-foreground">Required shift, break or task evidence could not be read. Existing time remains recorded; no approval decision can be made from incomplete evidence.</p><Link href="/field?view=time-review" className="text-sm underline">Reload Time review</Link></section>;
 const breakMap=new Map<string,any[]>();for(const b of breaks||[]){const a=breakMap.get(b.shift_id)||[];a.push(b);breakMap.set(b.shift_id,a);}
 const segMap=new Map<string,any[]>();for(const s of segments||[]){const a=segMap.get(s.shift_id)||[];a.push(s);segMap.set(s.shift_id,a);}
 const all=shifts||[];
 const needsAttention=all.filter((s:any)=>Boolean(s.requires_review)||shiftLocationEvidence(s).needsReview||workCoverage(s.task_coverage_percent).needsReview||(segMap.get(s.id)||[]).length===0);
 const attentionIds=new Set(needsAttention.map((s:any)=>s.id));
 const clean=all.filter((s:any)=>!attentionIds.has(s.id));

 const shiftCard=(s:any)=>{
  const reviewed=basisRead.error?null:(basisRead.data||[]).find(row=>row.shift_id===s.id);
  const workerType=reviewed?.worker_type??s.worker_type_snapshot;
  const frozenRate=reviewed?.base_hourly_rate??s.base_hourly_rate_snapshot;
  const bs=breakMap.get(s.id)||[];
  const breakHours=bs.reduce((sum:number,b:any)=>sum+(b.ended_at?hoursBetween(b.started_at,b.ended_at):0),0);
  const raw=hoursBetween(s.clock_in_at,s.clock_out_at);
  const payable=Math.max(0,raw-breakHours);
  const segs=segMap.get(s.id)||[];
  const gps=shiftLocationEvidence(s);const gpsBad=gps.needsReview;
  const reasons:string[]=Array.isArray(s.review_reasons)?s.review_reasons:[];
  const coverage=workCoverage(s.task_coverage_percent);
  const flagged=attentionIds.has(s.id);
  return <Dialog key={s.id}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2"><div className="min-w-0"><strong className="block truncate text-sm">{s.crew_members?.name} · {s.projects?.job_number} — {s.projects?.name}</strong><span className="block truncate text-xs text-muted-foreground">{s.work_date} · {h(payable)} payable · {fmt(s.clock_in_at,s.work_timezone_snapshot||'UTC')} to {fmt(s.clock_out_at,s.work_timezone_snapshot||'UTC')}</span></div><div className="flex items-center gap-2"><Badge appearance="outline" className={flagged?'border-warning/30 bg-warning/10 text-warning':'border-success/30 bg-success/10 text-success'}>{flagged?'Review':'Clean'}</Badge><DialogTrigger><Button appearance="outline" size="small">View / Review</Button></DialogTrigger></div></div><DialogSurface className="pt-dialog "><DialogBody><DialogContent><div className="flex justify-end"><DialogTrigger action="close"><Button type="button" appearance="subtle" size="small">Close</Button></DialogTrigger></div><div><DialogTitle>{s.crew_members?.name} · {s.projects?.job_number}</DialogTitle><p>{s.work_date} · {fmt(s.clock_in_at,s.work_timezone_snapshot||'UTC')} to {fmt(s.clock_out_at,s.work_timezone_snapshot||'UTC')}</p></div><div className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-6">
   {flagged&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-sm"><div className="font-medium text-warning">PourTrace flagged this shift.</div><div className="mt-1 text-muted-foreground">{reasons.length?reasons.join(' · '):segs.length===0?'No work was identified during the shift.':gpsBad?'GPS needs review.':'Work tracking needs review.'}</div></div>}

   <div className="grid gap-3 sm:grid-cols-3">
    <div className="rounded-lg border border-border bg-muted/20 p-3"><div className="text-xs font-medium text-muted-foreground">Calculated Work Time</div><div className="mt-1 text-lg font-semibold tabular-nums">{h(payable)}</div><div className="mt-1 text-xs text-muted-foreground">{h(raw)} elapsed − {h(breakHours)} breaks</div></div>
    <div className={`rounded-lg border bg-muted/20 p-3 ${coverage.percentage===null?'border-border':coverage.needsReview?'border-destructive/30':'border-success/30'}`}><div className="text-xs font-medium text-muted-foreground">Work Identified</div><div className={`mt-1 text-lg font-semibold ${coverage.percentage===null?'text-muted-foreground':coverage.needsReview?'text-destructive':'text-success'}`}>{coverage.label}</div><div className="mt-1 text-xs text-muted-foreground">{coverage.detail}</div></div>
    <div className={`rounded-lg border bg-muted/20 p-3 ${gpsBad?'border-destructive/30':'border-success/30'}`}><div className="text-xs font-medium text-muted-foreground">GPS</div><div className={`mt-1 text-lg font-semibold ${gpsBad?'text-destructive':'text-success'}`}>{gps.label}</div><div className="mt-1 text-xs text-muted-foreground">{gps.clockIn.label} · {gps.clockOut.label}<br/>In {s.clock_in_distance_ft==null?'—':`${Math.round(Number(s.clock_in_distance_ft))} ft`} · Out {s.clock_out_distance_ft==null?'—':`${Math.round(Number(s.clock_out_distance_ft))} ft`}</div></div>
   </div>

   <div className="rounded-lg border border-border"><div className="border-b border-border px-3 py-3"><div className="font-medium">Physical Work Identified</div><div className="mt-1 text-xs text-muted-foreground">Package-linked hours become estimating intelligence when the package is finished and this time is approved.</div></div><div className="divide-y">{segs.length===0?<div className="px-3 py-4 text-sm text-muted-foreground">No work selected.</div>:segs.map((x:any)=>{const op:any=x.work_package_operations;const pkg:any=op?.work_packages;return <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={x.id}><div><div className="font-medium">{pkg?.name||op?.field_label||x.production_tasks?.name}</div><div className="mt-1 text-xs text-muted-foreground">{pkg?`${op?.field_label||x.production_tasks?.name}${pkg.location?` · ${pkg.location}`:''} · ${Number(op.planned_quantity||0).toLocaleString(undefined,{maximumFractionDigits:2})} ${op.unit} known scope · `:''}{fmt(x.started_at,s.work_timezone_snapshot||'UTC')} – {x.ended_at?fmt(x.ended_at,s.work_timezone_snapshot||'UTC'):'open'}{x.notes?` · ${x.notes}`:''}</div></div><strong className="tabular-nums">{x.ended_at?h(hoursBetween(x.started_at,x.ended_at)):'—'}</strong></div>})}</div></div>

   {s.employee_note&&<div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-sm"><strong>Employee note:</strong> <span className="text-muted-foreground">{s.employee_note}</span></div>}

   {correctionRead.error?<p role="status" className="text-sm text-muted-foreground">Correction history unavailable.</p>:(correctionRead.data||[]).filter(row=>row.shift_id===s.id).map(row=><div key={row.id} className="rounded-md border border-border p-3 text-sm"><strong>Employee correction response</strong><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{row.employee_note}</p></div>)}
   <ShiftReviewControls shiftId={s.id} payable={payable} workerType={workerType??null} rate={frozenRate==null?null:Number(frozenRate)} basisSource={reviewed?'historical_review':s.labor_basis_source??null} defaultRisk={reviewed?.risk_class_code??s.default_risk_class_snapshot??null} risks={riskClasses||[]} risksAvailable={!riskClassesError} flagged={flagged} basisReadAvailable={!basisRead.error} reviewRequestId={randomUUID()} correctionsAvailable={!correctionRead.error}/>
  </div></DialogContent></DialogBody></DialogSurface></Dialog>;
 };

 return <><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
  <header className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><h1>Time review</h1><div className="flex flex-wrap gap-2"><Link className={secondaryLinkClass} href="/production/work-packages">Work packages</Link><Link className={secondaryLinkClass} href="/production">Production</Link><Link className={secondaryLinkClass} href="/field">Field</Link></div></header>

  <div className="grid grid-cols-3 divide-x border border-border bg-card/70" aria-label="Time review summary"><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Exceptions</span><strong className="block font-mono text-lg tabular-nums">{needsAttention.length}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Clean shifts</span><strong className="block font-mono text-lg tabular-nums">{clean.length}</strong></div><div className="px-3 py-2"><span className="text-xs text-muted-foreground">Waiting</span><strong className="block font-mono text-lg tabular-nums">{all.length}</strong></div></div>

  {needsAttention.length>0&&<section className="space-y-2"><div className="carez-page-heading"><h2>Exceptions</h2></div><div className="divide-y border border-border">{needsAttention.map(shiftCard)}</div></section>}

  <section className="space-y-2"><div className="carez-page-heading"><h2>Clean shifts</h2></div>{clean.length===0?<div className="border border-border bg-card/70 px-4 py-5"><h3 className="text-sm font-semibold text-foreground">No clean shifts waiting</h3><p className="mt-1 text-sm text-muted-foreground">When employees submit clean time it will appear here.</p></div>:<div className="divide-y border border-border">{clean.map(shiftCard)}</div>}</section>

  <section className="carez-page-heading flex flex-wrap items-center justify-between gap-3"><div><h2>Unplanned production</h2><p className="text-xs text-muted-foreground">For work outside a predefined package.</p></div><Dialog><DialogTrigger><Button appearance="outline" size="small" disabled={Boolean(tasksError||projectsError)}>Record exception quantity</Button></DialogTrigger><DialogSurface className="pt-dialog max-h-[90vh] overflow-y-auto"><DialogBody><DialogContent><div><DialogTitle>Record exception production</DialogTitle><p>Use only for work without a predefined package. Give a reason for the exception.</p></div><form action={saveDailyProduction} className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="production-project">Job</Label><Select appearance="outline" id="production-project" className={selectClass} name="project_id" defaultValue="" required><option value="" disabled>Choose job</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</Select></div><div className="grid gap-2"><Label htmlFor="production-date">Date</Label><Input appearance="underline" id="production-date" type="date" name="work_date" defaultValue={new Date().toISOString().slice(0,10)} required/></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="production-task">Unplanned Work</Label><Select appearance="outline" id="production-task" className={selectClass} name="production_task_id" defaultValue="" required><option value="" disabled>Choose work</option>{(tasks||[]).map((t:any)=><option key={t.id} value={t.id}>{t.name} · {t.production_unit}</option>)}</Select></div><div className="grid gap-2"><Label htmlFor="production-quantity">Quantity Completed</Label><Input appearance="underline" id="production-quantity" type="number" name="quantity_completed" step="0.01" min="0" required/></div></div><div className="grid gap-2"><Label htmlFor="production-unit">Unit</Label><Select appearance="outline" id="production-unit" className={selectClass} name="unit" defaultValue="LF"><option>LF</option><option>SF</option><option>CY</option><option>EA</option><option>LB</option><option>TON</option><option>HR</option></Select></div><div className="grid gap-2"><Label htmlFor="production-notes">Why was this outside a work package?</Label><Input appearance="underline" id="production-notes" name="notes" required placeholder="Change order, unexpected repair, field-directed extra work..."/></div><Button type="submit" appearance="outline" className="w-fit">Save Exception Production</Button></form></DialogContent></DialogBody></DialogSurface></Dialog></section>

  <section className="space-y-4"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rate history</div><h2 className="mt-1 text-lg font-semibold">Earned Production Rates</h2><p className="mt-1 text-sm text-muted-foreground">Completed physical scopes with approved employee man-hours—not daily estimates from a foreman.</p></div>{ratesError?<p role="status" className="text-sm text-muted-foreground">Earned rates unavailable.</p>:(rates||[]).length===0?<div className="border border-border bg-card/70 px-4 py-5"><h3 className="text-sm font-semibold text-foreground">No earned rates yet</h3><p className="mt-1 text-sm text-muted-foreground">Finish a work package operation and approve its employee time to create the first trusted sample.</p></div>:<div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHeaderCell>Completed</TableHeaderCell><TableHeaderCell>Job / Package</TableHeaderCell><TableHeaderCell>Work</TableHeaderCell><TableHeaderCell>Quantity</TableHeaderCell><TableHeaderCell>Man-Hours</TableHeaderCell><TableHeaderCell>Production</TableHeaderCell><TableHeaderCell>MH / Unit</TableHeaderCell></TableRow></TableHeader><TableBody>{(rates||[]).map((r:any)=><TableRow key={r.operation_id}><TableCell>{r.completed_date}</TableCell><TableCell>{r.job_number} — {r.package_name}</TableCell><TableCell>{r.task_name}</TableCell><TableCell className="tabular-nums">{Number(r.quantity_completed).toFixed(2)} {r.unit}</TableCell><TableCell className="tabular-nums">{Number(r.man_hours).toFixed(2)} MH</TableCell><TableCell className="tabular-nums">{Number(r.units_per_man_hour).toFixed(2)} {r.unit}/MH</TableCell><TableCell className="tabular-nums">{Number(r.man_hours_per_unit).toFixed(4)} MH/{r.unit}</TableCell></TableRow>)}</TableBody></Table></div>}</section>
 </div></>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
