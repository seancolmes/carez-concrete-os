import {ManualTimeDialog} from '@/components/field/ManualTimeDialog';
import {randomUUID} from 'node:crypto';
import {Badge,Button,Card,CardHeader,Dialog,DialogTitle,DialogTrigger,Input,Label,Table,TableBody,TableCell,TableHeader,TableRow,Textarea,DialogBody,DialogContent,DialogSurface,TableHeaderCell,Select} from '@fluentui/react-components';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import { ClockRegular as Clock3, DocumentTextClockRegular as FileClock, PersonWrenchRegular as HardHat, LocationRegular as MapPin, AddRegular as Plus } from '@fluentui/react-icons';
import {createClient} from '@/lib/supabase/server';
import {createDailyLog} from '@/app/field/actions';
import {JobsiteLocationSetter} from '@/components/field/JobsiteLocationSetter';

const today=()=>new Date().toISOString().slice(0,10);
const fieldSelect='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <Card className="gap-1 py-3 shadow-none"><CardHeader className="gap-1 px-3" header={<div><p className="text-xs font-medium">{label}</p><h3 className={tone==='success'?'font-mono text-xl font-semibold tracking-tight tabular-nums text-success':tone==='warning'?'font-mono text-xl font-semibold tracking-tight tabular-nums text-warning':'font-mono text-xl font-semibold tracking-tight tabular-nums'}>{value}</h3></div>}/><div className="hidden px-3 text-xs leading-5 text-muted-foreground sm:block">{help}</div></Card>;
}

export default async function FieldPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(profile?.role==='employee')redirect('/employee');
  if(!profile?.company_id)redirect('/login');

  const [{data:projects,error:projectsError},{data:crew,error:crewError},{data:riskClasses,error:riskClassesError},{data:waiting,error:waitingError},{data:logs,error:logsError},{data:recentApproved,error:recentApprovedError},manualProjectsRead,manualCrewRead]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,site_latitude,site_longitude,geofence_radius_ft').eq('status','active').order('job_number'),
    supabase.from('crew_members').select('id,name,hourly_rate,is_owner,default_risk_class_code').eq('active',true).order('name'),
    supabase.from('li_risk_classes').select('code,name,tax_year').eq('company_id',profile.company_id).eq('active',true).order('code'),
    supabase.from('employee_shift_sessions').select('id').eq('status','submitted'),
    supabase.from('daily_logs').select('*,projects(job_number,name)').order('log_date',{ascending:false}).limit(8),
    supabase.from('employee_shift_sessions').select('id,work_date,clock_in_at,clock_out_at,crew_members(name),projects(job_number,name)').eq('status','approved').order('work_date',{ascending:false}).limit(8),
    supabase.from('projects').select('id,job_number,name,status').eq('company_id',profile.company_id).order('job_number'),
    supabase.from('crew_members').select('id,name,active').eq('company_id',profile.company_id).order('name'),
  ]);

  if(projectsError||crewError||waitingError||logsError||recentApprovedError)return <section className="space-y-2 border border-border p-4"><h1 className="font-semibold">Field records unavailable</h1><p className="text-sm text-muted-foreground">Required job or field reads failed. Existing records remain unchanged; no empty or zero state is inferred.</p><Link href="/field" className="text-sm underline">Reload Field</Link></section>;
  return <>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1>Field control</h1></div>
        <div className="flex flex-wrap items-center gap-2"><Link className={primaryLinkClass} href="/field/review"><Clock3/>Review time{(waiting||[]).length?` (${(waiting||[]).length})`:''}</Link><Link className={secondaryLinkClass} href="/crew/access"><HardHat/>Employee access</Link></div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Time waiting for approval" value={String((waiting||[]).length)} help="Clocked-out employee shifts still needing approval." tone={(waiting||[]).length?'warning':'success'}/>
        <Metric label="Active jobs" value={String((projects||[]).length)} help="Jobs employees can choose when they clock in."/>
        <div className="col-span-2 sm:col-span-1"><Metric label="Employees" value={String((crew||[]).filter((c:any)=>!c.is_owner).length)} help="Active crew records available for timekeeping."/></div>
      </section>

      <section>
        <div className="carez-section-heading flex-wrap"><MapPin className="size-4 text-primary"/><div className="min-w-0 flex-1"><h2>Jobsite locations</h2><p>Set the job pin once. Pourtrace compares employee clock events against that location.</p></div><div className="w-full sm:w-auto"><JobsiteLocationSetter projects={(projects||[]) as any}/></div></div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader  header={<div><div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><FileClock className="size-4"/></span><div><h3>Daily log</h3><p className="mt-1">Record completed work and placed concrete.</p></div></div></div>}/>
          <div><Dialog><DialogTrigger><Button appearance="primary"><Plus/>New daily log</Button></DialogTrigger><DialogSurface className="pt-dialog max-h-[88vh] overflow-y-auto"><DialogBody><DialogContent><div><DialogTitle>Daily log</DialogTitle><p>Capture what happened, how much concrete was placed, and what affected production.</p></div>
            <form action={createDailyLog} className="grid gap-4"><input type="hidden" name="request_id" value={randomUUID()}/>
              <div className="grid gap-2"><Label htmlFor="daily-project">Job</Label><Select appearance="outline" id="daily-project" className={fieldSelect} name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</Select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="daily-date">Date</Label><Input appearance="underline" id="daily-date" type="date" name="log_date" defaultValue={today()} required/></div><div className="grid gap-2"><Label htmlFor="daily-crew">Crew count</Label><Input appearance="underline" id="daily-crew" type="number" min="0" name="crew_count" defaultValue="0"/></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="daily-cy">Concrete placed (CY)</Label><Input appearance="underline" id="daily-cy" type="number" step="0.1" min="0" name="concrete_yards" defaultValue="0"/></div><div className="grid gap-2"><Label htmlFor="daily-weather">Weather</Label><Input appearance="underline" id="daily-weather" name="weather" placeholder="Dry, 68°F"/></div></div>
              <div className="grid gap-2"><Label htmlFor="daily-work">What we got done</Label><Textarea appearance="outline" id="daily-work" name="work_completed" rows={4} required/></div>
              <div className="grid gap-2"><Label htmlFor="daily-delays">Problems / delays</Label><Textarea appearance="outline" id="daily-delays" name="delays_issues" rows={3}/></div>
              <div className="grid gap-2"><Label htmlFor="daily-notes">Notes</Label><Input appearance="underline" id="daily-notes" name="notes"/></div>
              <div><Button type="submit" appearance="primary">Save daily log</Button></div>
            </form>
          </DialogContent></DialogBody></DialogSurface></Dialog></div>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-none"><CardHeader header={<h3>Manual time</h3>} description={<p className="text-sm text-muted-foreground">Record missing verified time while preserving clock and approved-cost history.</p>}/>{manualProjectsRead.error||manualCrewRead.error?<p role="status" className="text-sm text-muted-foreground">Manual time unavailable: recorded job or worker choices could not be loaded.</p>:<ManualTimeDialog requestId={randomUUID()} projects={(manualProjectsRead.data||[]).map(row=>({id:row.id,label:`${row.job_number} — ${row.name} · ${row.status}`}))} crew={(manualCrewRead.data||[]).map(row=>({id:row.id,label:`${row.name}${row.active?'':' · inactive'}`}))} risks={riskClasses||[]} risksAvailable={!riskClassesError}/>}</Card>

        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0 shadow-none"><CardHeader className="border-b py-3" header={<div><h3>Approved employee time</h3><p>Most recent approved shift sessions.</p></div>}/>{(recentApproved||[]).length===0?<div className="min-h-40 border-0"><div><div><Clock3/></div><h3>No approved employee time yet</h3><p>Approved shifts will appear here.</p></div></div>:<Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHeaderCell>Worker</TableHeaderCell><TableHeaderCell>Job</TableHeaderCell><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableRow></TableHeader><TableBody>{(recentApproved||[]).map((s:any)=><TableRow key={s.id}><TableCell className="font-medium">{s.crew_members?.name}</TableCell><TableCell>{s.projects?.job_number} — {s.projects?.name}</TableCell><TableCell className="tabular-nums">{s.work_date}</TableCell><TableCell><Badge appearance="tint" className="bg-success/10 text-success">Approved</Badge></TableCell></TableRow>)}</TableBody></Table>}</Card>

        <Card className="gap-0 py-0 shadow-none"><CardHeader className="border-b py-3" header={<div><h3>Daily logs</h3><p>Most recent jobsite records.</p></div>}/>{(logs||[]).length===0?<div className="min-h-40 border-0"><div><div><FileClock/></div><h3>No daily logs yet</h3><p>Saved field logs will appear here.</p></div></div>:<Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Job</TableHeaderCell><TableHeaderCell>Work completed</TableHeaderCell><TableHeaderCell className="text-right">Concrete</TableHeaderCell></TableRow></TableHeader><TableBody>{(logs||[]).map((l:any)=><TableRow key={l.id}><TableCell className="tabular-nums">{l.log_date}</TableCell><TableCell className="font-medium">{l.projects?.job_number||'Job'}</TableCell><TableCell className="max-w-80 truncate text-muted-foreground">{l.work_completed}</TableCell><TableCell className="text-right tabular-nums">{Number(l.concrete_yards||0).toFixed(1)} CY</TableCell></TableRow>)}</TableBody></Table>}</Card>
      </div>
    </div>
  </>;
}

const primaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-primary bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90';
const secondaryLinkClass='inline-flex min-h-8 items-center justify-center gap-1 rounded-sm border border-border bg-background px-3 text-xs font-semibold hover:bg-accent';
