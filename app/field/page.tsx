import {redirect} from 'next/navigation';
import Link from 'next/link';
import {Clock3,FileClock,HardHat,MapPin,Plus} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {Textarea} from '@/components/ui/textarea';
import {createClient} from '@/lib/supabase/server';
import {createDailyLog,createTimecard} from './actions';
import {JobsiteLocationSetter} from '@/components/field/JobsiteLocationSetter';

const today=()=>new Date().toISOString().slice(0,10);
const fieldSelect='h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'|'warning'}){
  return <Card className="gap-2 py-4 shadow-none"><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={tone==='success'?'font-mono text-2xl font-semibold tracking-tight tabular-nums text-success':tone==='warning'?'font-mono text-2xl font-semibold tracking-tight tabular-nums text-warning':'font-mono text-2xl font-semibold tracking-tight tabular-nums'}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

export default async function FieldPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(profile?.role==='employee')redirect('/employee');
  if(!profile?.company_id)redirect('/login');

  const [{data:projects},{data:crew},{data:riskClasses},{data:waiting},{data:logs},{data:recentApproved}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,site_latitude,site_longitude,geofence_radius_ft').eq('status','active').order('job_number'),
    supabase.from('crew_members').select('id,name,hourly_rate,is_owner,default_risk_class_code').eq('active',true).order('name'),
    supabase.from('li_risk_classes').select('code,name').eq('company_id',profile.company_id).eq('tax_year',2026).eq('active',true).order('code'),
    supabase.from('employee_shift_sessions').select('id').eq('status','submitted'),
    supabase.from('daily_logs').select('*,projects(job_number,name)').order('log_date',{ascending:false}).limit(8),
    supabase.from('employee_shift_sessions').select('id,work_date,clock_in_at,clock_out_at,crew_members(name),projects(job_number,name)').eq('status','approved').order('work_date',{ascending:false}).limit(8),
  ]);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Field operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Field control</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Employee time, GPS verification, daily logs, and production records connected to the same jobs used by estimating and project control.</p></div>
        <div className="flex flex-wrap items-center gap-2"><Link className={buttonVariants({size:'sm'})} href="/field/review"><Clock3/>Review time{(waiting||[]).length?` (${(waiting||[]).length})`:''}</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/crew/access"><HardHat/>Employee access</Link></div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Time waiting for approval" value={String((waiting||[]).length)} help="Clocked-out employee shifts still needing approval." tone={(waiting||[]).length?'warning':'success'}/>
        <Metric label="Active jobs" value={String((projects||[]).length)} help="Jobs employees can choose when they clock in."/>
        <Metric label="Employees" value={String((crew||[]).filter((c:any)=>!c.is_owner).length)} help="Active crew records available for timekeeping."/>
      </section>

      <section className="space-y-4">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">GPS</p><h2 className="mt-1 text-lg font-semibold">Jobsite locations</h2><p className="mt-1 text-sm text-muted-foreground">Set the job pin once. Carez then compares employee clock events against that jobsite location.</p></div>
        <Card className="shadow-none"><CardContent><JobsiteLocationSetter projects={(projects||[]) as any}/></CardContent></Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="shadow-none">
          <CardHeader><div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><FileClock className="size-4"/></span><div><CardTitle>Daily log</CardTitle><CardDescription className="mt-1">Capture what happened, how much concrete was placed, and what affected production.</CardDescription></div></div></CardHeader>
          <CardContent>
            <form action={createDailyLog} className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="daily-project">Job</Label><select id="daily-project" className={fieldSelect} name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="daily-date">Date</Label><Input id="daily-date" type="date" name="log_date" defaultValue={today()} required/></div><div className="grid gap-2"><Label htmlFor="daily-crew">Crew count</Label><Input id="daily-crew" type="number" min="0" name="crew_count" defaultValue="0"/></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="daily-cy">Concrete placed (CY)</Label><Input id="daily-cy" type="number" step="0.1" min="0" name="concrete_yards" defaultValue="0"/></div><div className="grid gap-2"><Label htmlFor="daily-weather">Weather</Label><Input id="daily-weather" name="weather" placeholder="Dry, 68°F"/></div></div>
              <div className="grid gap-2"><Label htmlFor="daily-work">What we got done</Label><Textarea id="daily-work" name="work_completed" rows={4} required/></div>
              <div className="grid gap-2"><Label htmlFor="daily-delays">Problems / delays</Label><Textarea id="daily-delays" name="delays_issues" rows={3}/></div>
              <div className="grid gap-2"><Label htmlFor="daily-notes">Notes</Label><Input id="daily-notes" name="notes"/></div>
              <div><Button type="submit">Save daily log</Button></div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-none"><CardHeader><CardTitle>Manual time correction</CardTitle><CardDescription>Use only when an employee could not use the GPS clock or owner/manual time must be entered.</CardDescription></CardHeader><CardContent><Dialog><DialogTrigger render={<Button variant="outline"/>}><Plus/>Enter manual time</DialogTrigger><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Manual timecard / correction</DialogTitle><DialogDescription>Normal employee time should come through the GPS clock and daily approval workflow.</DialogDescription></DialogHeader><form action={createTimecard} className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="manual-project">Job</Label><select id="manual-project" className={fieldSelect} name="project_id" required defaultValue=""><option value="" disabled>Choose job</option>{(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.job_number} — {p.name}</option>)}</select></div>
            <div className="grid gap-2"><Label htmlFor="manual-worker">Worker</Label><select id="manual-worker" className={fieldSelect} name="crew_member_id" required defaultValue=""><option value="" disabled>Choose worker</option>{(crew||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="manual-date">Date</Label><Input id="manual-date" type="date" name="work_date" defaultValue={today()} required/></div><div className="grid gap-2"><Label htmlFor="manual-task">Work type</Label><Input id="manual-task" name="task" defaultValue="General"/></div></div>
            <div className="grid gap-2"><Label htmlFor="manual-risk">L&I class</Label><select id="manual-risk" className={fieldSelect} name="risk_class_code" defaultValue=""><option value="">Choose class</option>{(riskClasses||[]).map((r:any)=><option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}</select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="manual-regular">Regular hours</Label><Input id="manual-regular" type="number" step="0.25" min="0" name="regular_hours" defaultValue="8"/></div><div className="grid gap-2"><Label htmlFor="manual-overtime">Overtime hours</Label><Input id="manual-overtime" type="number" step="0.25" min="0" name="overtime_hours" defaultValue="0"/></div></div>
            <div className="grid gap-2"><Label htmlFor="manual-notes">Reason / notes</Label><Input id="manual-notes" name="notes" placeholder="Phone died, owner time, correction..."/></div>
            <div className="flex justify-end"><Button type="submit">Save manual time</Button></div>
          </form></DialogContent></Dialog></CardContent></Card>

          <Card className="shadow-none"><CardHeader><CardTitle>Field data rules</CardTitle><CardDescription>Daily logs describe field reality. Approved time and verified quantities remain the source for production evidence.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-primary"/><span>GPS proximity is review evidence, not an automatic verdict on whether labor is valid.</span></div><div className="flex gap-2"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary"/><span>Submitted shifts remain pending until approved or corrected.</span></div></CardContent></Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 py-0 shadow-none"><CardHeader className="border-b py-3"><CardTitle>Approved employee time</CardTitle><CardDescription>Most recent approved shift sessions.</CardDescription></CardHeader>{(recentApproved||[]).length===0?<Empty className="min-h-40 border-0"><EmptyHeader><EmptyMedia variant="icon"><Clock3/></EmptyMedia><EmptyTitle>No approved employee time yet</EmptyTitle><EmptyDescription>Approved shifts will appear here.</EmptyDescription></EmptyHeader></Empty>:<Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Worker</TableHead><TableHead>Job</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(recentApproved||[]).map((s:any)=><TableRow key={s.id}><TableCell className="font-medium">{s.crew_members?.name}</TableCell><TableCell>{s.projects?.job_number} — {s.projects?.name}</TableCell><TableCell className="tabular-nums">{s.work_date}</TableCell><TableCell><Badge variant="secondary" className="bg-success/10 text-success">Approved</Badge></TableCell></TableRow>)}</TableBody></Table>}</Card>

        <Card className="gap-0 py-0 shadow-none"><CardHeader className="border-b py-3"><CardTitle>Daily logs</CardTitle><CardDescription>Most recent jobsite records.</CardDescription></CardHeader>{(logs||[]).length===0?<Empty className="min-h-40 border-0"><EmptyHeader><EmptyMedia variant="icon"><FileClock/></EmptyMedia><EmptyTitle>No daily logs yet</EmptyTitle><EmptyDescription>Saved field logs will appear here.</EmptyDescription></EmptyHeader></Empty>:<Table><TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Date</TableHead><TableHead>Job</TableHead><TableHead>Work completed</TableHead><TableHead className="text-right">Concrete</TableHead></TableRow></TableHeader><TableBody>{(logs||[]).map((l:any)=><TableRow key={l.id}><TableCell className="tabular-nums">{l.log_date}</TableCell><TableCell className="font-medium">{l.projects?.job_number||'Job'}</TableCell><TableCell className="max-w-80 truncate text-muted-foreground">{l.work_completed}</TableCell><TableCell className="text-right tabular-nums">{Number(l.concrete_yards||0).toFixed(1)} CY</TableCell></TableRow>)}</TableBody></Table>}</Card>
      </div>
    </div>
  </AppShell>;
}
