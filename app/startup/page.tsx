import {redirect} from 'next/navigation';
import {AppShell} from '@/components/AppShell';
import {Badge,Button,Card,Input} from '@fluentui/react-components';
import {cn} from '@/lib/utils';
import {createClient} from '@/lib/supabase/server';
import {updateStartupItem} from './actions';

const day=(v?:string|null)=>!v?'Not set':new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${v}T12:00:00`));
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(v:string,n:number)=>{const d=new Date(`${v}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};

export default async function StartupPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');

  const [{data:jobs},{data:items}]=await Promise.all([
    supabase.from('project_startup_readiness').select('*').eq('company_id',profile.company_id).order('job_number'),
    supabase.from('project_startup_items').select('*').eq('company_id',profile.company_id).order('sort_order')
  ]);
  const byProject=new Map<string,any[]>();for(const item of items||[]){const a=byProject.get(item.project_id)||[];a.push(item);byProject.set(item.project_id,a);}
  const rows:any[]=jobs||[];const ready=rows.filter(r=>r.readiness_status==='ready');const needs=rows.filter(r=>r.readiness_status!=='ready');const soonEnd=addDays(today(),7);const startingSoon=rows.filter(r=>r.next_work_date&&r.next_work_date>=today()&&r.next_work_date<=soonEnd);const unscheduled=rows.filter(r=>!r.has_work_scheduled);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
      <header className="carez-page-heading flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Jobs & field</p>
          <h1 className="text-2xl font-semibold tracking-tight">Job Startup</h1>
          <p className="text-sm text-muted-foreground">Before the crew rolls out, Carez checks the job setup and shows exactly what is still missing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" appearance="primary" href="/schedule">Schedule Work</Button>
          <Button as="a" appearance="secondary" href="/projects">Projects</Button>
        </div>
      </header>

      <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="small">
          <div><p>Need Setup</p><h3 className={cn('text-2xl tabular-nums group-data-[size=sm]/card:text-2xl',needs.length?'text-warning':'text-success')}>{needs.length}</h3></div>
          <div className="text-xs text-muted-foreground">Awarded jobs not ready for crew startup yet.</div>
        </Card>
        <Card size="small">
          <div><p>Ready to Work</p><h3 className={cn('text-2xl tabular-nums group-data-[size=sm]/card:text-2xl',ready.length&&'text-success')}>{ready.length}</h3></div>
          <div className="text-xs text-muted-foreground">Required startup checks are clear.</div>
        </Card>
        <Card size="small">
          <div><p>Starting Next 7 Days</p><h3 className="text-2xl tabular-nums group-data-[size=sm]/card:text-2xl">{startingSoon.length}</h3></div>
          <div className="text-xs text-muted-foreground">Jobs with scheduled work coming up.</div>
        </Card>
        <Card size="small">
          <div><p>No Work Date</p><h3 className={cn('text-2xl tabular-nums group-data-[size=sm]/card:text-2xl',unscheduled.length?'text-destructive':'text-success')}>{unscheduled.length}</h3></div>
          <div className="text-xs text-muted-foreground">Active jobs with nothing scheduled.</div>
        </Card>
      </div>

      <section className="min-h-0 flex-1 space-y-4 overflow-auto border border-border bg-card p-3" aria-labelledby="startup-board-title">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Ready to work</p>
          <h2 id="startup-board-title" className="text-lg font-semibold">Startup Board</h2>
          <p className="text-sm text-muted-foreground">System checks update automatically. You only confirm the field decisions Carez cannot know on its own.</p>
        </div>
        {rows.length===0?<div className="border border-border">
          <div><h3>No active jobs need startup</h3><p>When an estimate is awarded, the new job will appear here automatically.</p></div>
        </div>:<div className="space-y-4">{rows.map(r=>{
      const manual=byProject.get(r.project_id)||[];const pct=Math.round((Number(r.ready_steps||0)/Math.max(1,Number(r.total_steps||10)))*100);
      const checks=[
        {ok:Boolean(r.has_awarded_budget),title:'Awarded job budget',detail:r.has_awarded_budget?'Accepted estimate is frozen as the job baseline.':'No frozen original budget yet.'},
        {ok:Boolean(r.has_customer_contact),title:'Customer / GC contact',detail:r.has_customer_contact?[r.customer_name,r.contact_name,r.customer_phone||r.customer_email].filter(Boolean).join(' · '):'Add a working phone number or email.'},
        {ok:Boolean(r.has_jobsite),title:'Jobsite address',detail:r.has_jobsite?[r.address,r.city,r.state].filter(Boolean).join(', '):'Job address or city is missing.'},
        {ok:Boolean(r.has_work_scheduled),title:'First work day',detail:r.has_work_scheduled?day(r.next_work_date):'Nothing is on the schedule yet.'},
        {ok:Number(r.crew_assigned_count||0)>0,title:'Crew assigned',detail:Number(r.crew_assigned_count||0)>0?`${r.crew_assigned_count} worker${Number(r.crew_assigned_count)===1?'':'s'} assigned to upcoming work.`:'No crew is assigned to upcoming work.'}
      ];
      return <article key={r.project_id} aria-labelledby={`startup-project-${r.project_id}`}>
        <Card>
          <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 id={`startup-project-${r.project_id}`} className="text-base font-semibold">{r.job_number} — {r.name}</h3>
              <p>{[r.address,r.city,r.state].filter(Boolean).join(', ')||'Jobsite not complete'}</p>
            </div>
            <Badge appearance="outline" className={r.readiness_status==='ready'?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning'}>{r.readiness_status==='ready'?'Ready to work':'Needs setup'}</Badge>
          </div>
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">
                <dt className="text-xs text-muted-foreground">Startup Ready</dt>
                <dd className={cn('text-xl font-semibold tabular-nums',r.readiness_status==='ready'?'text-success':'text-warning')}>{pct}%</dd>
                <dd className="text-xs text-muted-foreground">{r.ready_steps} of {r.total_steps} checks clear</dd>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">
                <dt className="text-xs text-muted-foreground">First Work Day</dt>
                <dd className={cn('text-xl font-semibold tabular-nums',r.has_work_scheduled?'text-primary':'text-destructive')}>{r.next_work_date?day(r.next_work_date):'Not Set'}</dd>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">
                <dt className="text-xs text-muted-foreground">Crew Assigned</dt>
                <dd className={cn('text-xl font-semibold tabular-nums',Number(r.crew_assigned_count||0)>0?'text-success':'text-warning')}>{Number(r.crew_assigned_count||0)}</dd>
                <dd className="text-xs text-muted-foreground">Across upcoming scheduled work</dd>
              </div>
              <div className="space-y-1 rounded-lg border border-border bg-muted/20 p-3">
                <dt className="text-xs text-muted-foreground">Next Pour</dt>
                <dd className="text-xl font-semibold tabular-nums">{r.next_pour_date?day(r.next_pour_date):'Not Planned'}</dd>
                <dd className="text-xs text-muted-foreground">{r.next_pour_name?`${r.next_pour_name} · ${String(r.next_pour_status||'planning').replaceAll('_',' ')}`:'Pour planning does not block prep work.'}</dd>
              </div>
            </dl>

            <div className="grid items-start gap-4 xl:grid-cols-2">
              <Card size="small">
                <div>
                  <h4 className="text-sm font-semibold">Carez Checks Automatically</h4>
                  <p>These change as the rest of the OS is updated.</p>
                </div>
                <div className="divide-y divide-border">
                  {checks.map((c,i)=><div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0" key={i}>
                    <div className="min-w-0 space-y-1"><p className="text-sm font-medium">{c.title}</p><p className="break-words text-xs text-muted-foreground">{c.detail}</p></div>
                    <Badge appearance="outline" className={c.ok?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning'}>{c.ok?'Ready':'Needed'}</Badge>
                  </div>)}
                </div>
              </Card>

              <Card size="small">
                <div className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1"><h4 className="text-sm font-semibold">Field Confirmations</h4><p>Mark these once you have actually handled them.</p></div>
                  <strong className="shrink-0 text-sm tabular-nums">{Number(r.manual_open||0)} left</strong>
                </div>
                <div className="divide-y divide-border">
                  {manual.map(item=><form action={updateStartupItem} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0" key={item.id}>
                    <input type="hidden" name="id" value={item.id}/>
                    <input type="hidden" name="current_status" value={item.status}/>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="break-words text-xs text-muted-foreground">{item.detail}</p>
                      <Input appearance="underline" name="notes" defaultValue={item.notes||''} placeholder="Optional note" aria-label={`Notes for ${item.title}`} className="mt-2 w-full"/>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge appearance="outline" className={item.status==='done'?'border-success/30 bg-success/10 text-success':item.status==='not_needed'?'text-muted-foreground':'border-warning/30 bg-warning/10 text-warning'}>{item.status==='done'?'Done':item.status==='not_needed'?'Not Needed':'Open'}</Badge>
                      {item.status==='open'?<>
                        <Button type="submit" appearance="secondary" name="status" value="done">Done</Button>
                        <Button type="submit" appearance="secondary" name="status" value="not_needed">Not Needed</Button>
                      </>:<Button type="submit" appearance="secondary" name="status" value="open">Reopen</Button>}
                      <Button type="submit" appearance="secondary">Save Note</Button>
                    </div>
                  </form>)}
                </div>
              </Card>
            </div>

            <Card size="small">
              <div><h4 className="text-sm font-semibold">Production Setup</h4><p>The next operational pieces for this job.</p></div>
              <div className="divide-y divide-border">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                  <div className="space-y-1"><p className="text-sm font-medium">Upcoming work</p><p className="text-xs text-muted-foreground">{r.next_work_date?`First scheduled day: ${day(r.next_work_date)}`:'No work scheduled yet.'}</p></div>
                  <Button as="a" appearance="secondary" href="/schedule">Schedule</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="space-y-1"><p className="text-sm font-medium">Concrete pour</p><p className="text-xs text-muted-foreground">{r.next_pour_name?`${r.next_pour_name} · ${r.next_pour_date?day(r.next_pour_date):'date not set'}`:'No pour plan yet.'}</p></div>
                  <Button as="a" appearance="secondary" href="/pour-control">Pour Control</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                  <div className="space-y-1"><p className="text-sm font-medium">Materials / equipment committed</p><p className="text-xs text-muted-foreground">{Number(r.open_po_count||0)} issued purchase order{Number(r.open_po_count||0)===1?'':'s'} open.</p></div>
                  <Button as="a" appearance="secondary" href="/procurement">Purchasing</Button>
                </div>
              </div>
            </Card>

            {r.readiness_status==='ready'?<div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success"><strong>Ready to work.</strong> Carez has the startup information required to send the crew to this job.</div>:<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><strong>Do not call this job ready yet.</strong> Clear the items marked Needed or Open above first.</div>}
            <div className="flex flex-wrap gap-2">
              <Button as="a" appearance="primary" href={`/projects/${r.project_id}`}>Open Job</Button>
              <Button as="a" appearance="secondary" href="/schedule">Schedule</Button>
              <Button as="a" appearance="secondary" href="/pour-control">Plan Pour</Button>
              <Button as="a" appearance="secondary" href="/procurement">Order Materials</Button>
            </div>
          </div>
        </Card>
      </article>;
    })}</div>}</section>
    </div>
  </AppShell>;
}
