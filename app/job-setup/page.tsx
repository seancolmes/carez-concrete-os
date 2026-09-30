import {redirect} from 'next/navigation';
import {Badge,Button,Card} from '@fluentui/react-components';
import {AppShell} from '@/components/AppShell';
import {cn} from '@/lib/utils';
import {createClient} from '@/lib/supabase/server';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));

export default async function JobSetupPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();if(!profile?.company_id)redirect('/login');if(profile.role==='employee')redirect('/employee');

  const [{data:rows},{data:handoffRows}]=await Promise.all([
    supabase.from('project_job_readiness_summary').select('*').eq('company_id',profile.company_id).eq('award_setup_applies',true).order('job_number',{ascending:false}),
    supabase.from('project_award_operations_handoff').select('*').eq('company_id',profile.company_id),
  ]);

  const jobs=rows||[],handoffs=handoffRows||[];
  const handoffByProject=new Map(handoffs.map((x:any)=>[x.project_id,x]));
  const ready=jobs.filter((x:any)=>x.job_ready),hold=jobs.filter((x:any)=>!x.job_ready);
  const prestart=jobs.reduce((s:number,x:any)=>s+Number(x.required_before_start_amount||0)-Number(x.required_before_start_paid_amount||0),0);
  const generated=jobs.filter((x:any)=>handoffByProject.get(x.project_id)?.handoff_status==='generated');

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
    <header className="carez-page-heading flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-lg font-semibold">Job Setup</h1><p className="mt-1 text-xs text-muted-foreground">Awarded work, field plans, billing, and start requirements.</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button as="a" appearance="outline" size="small" href="/proposals">Proposals</Button><Button as="a" appearance="outline" size="small" href="/production/work-packages">Work Packages</Button><Button as="a" appearance="outline" size="small" href="/readiness">Work Readiness</Button></div></header>
    <div className="carez-summary-ledger grid shrink-0 grid-cols-2 gap-px lg:grid-cols-5">
      <div className="min-w-0 border-x border-border px-4 py-3"><div className="space-y-1"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Won Jobs</div><div className="break-words font-mono text-2xl font-semibold tabular-nums">{jobs.length}</div><div className="text-xs text-muted-foreground">Jobs created from accepted proposals.</div></div></div>
      <Card size="small" className={cn('h-full space-y-1 rounded-none border-x-0 bg-transparent shadow-none',generated.length?'text-success':'')}><div className="text-xs font-medium text-muted-foreground">Auto Field Plans</div><div className="break-words font-mono text-2xl font-semibold tabular-nums">{generated.length}</div><div className="text-xs text-muted-foreground">Accepted takeoffs already connected to physical field work.</div></Card>
      <Card size="small" className={cn('h-full space-y-1 rounded-none border-x-0 bg-transparent shadow-none',ready.length?'text-success':'')}><div className="text-xs font-medium text-muted-foreground">Setup Clear</div><div className="break-words font-mono text-2xl font-semibold tabular-nums">{ready.length}</div><div className="text-xs text-muted-foreground">Agreement, billing and pre-start money are clear. Operation readiness still controls actual start permission.</div></Card>
      <Card size="small" className={cn('h-full space-y-1 rounded-none border-x-0 bg-transparent shadow-none',hold.length?'text-destructive':'')}><div className="text-xs font-medium text-muted-foreground">Setup Holds</div><div className="break-words font-mono text-2xl font-semibold tabular-nums">{hold.length}</div><div className="text-xs text-muted-foreground">Something must be handled before scheduling crew work.</div></Card>
      <Card size="small" className={cn('h-full space-y-1 rounded-none border-x-0 bg-transparent shadow-none',prestart>0?'text-warning':'')}><div className="text-xs font-medium text-muted-foreground">Pre-Start Money Open</div><div className="break-words font-mono text-2xl font-semibold tabular-nums">{money(Math.max(0,prestart))}</div><div className="text-xs text-muted-foreground">Required payments not yet cleared.</div></Card>
    </div>
    <section className="min-h-0 flex-1 space-y-3 overflow-auto border border-border bg-card p-3" aria-labelledby="handoff-title"><div className="space-y-1"><div><div className="text-xs font-medium text-muted-foreground">Awarded Work</div><h2 id="handoff-title" className="text-lg font-semibold">Award → Field Handoff</h2><div className="text-xs text-muted-foreground">Administrative setup and physical start permission are separate decisions.</div></div></div>
      {jobs.length===0?<Card className="border border-border p-4"><h3 className="text-sm font-semibold">No accepted jobs waiting for setup</h3><p className="text-sm text-muted-foreground">When a customer accepts a Carez proposal, the project, budget and takeoff-linked field plan will be created automatically.</p></Card>:<div className="space-y-4">{jobs.map((j:any)=>{
        const h:any=handoffByProject.get(j.project_id);
        const handoffStatus=h?.handoff_status||'manual';
        const generatedPlan=handoffStatus==='generated';
        const needsSync=handoffStatus==='needs_sync';
        return <article key={j.project_id} aria-labelledby={`job-setup-${j.project_id}`}><Card className="rounded-none border-x-0 bg-transparent shadow-none">
        <header className="carez-page-heading flex flex-col gap-3 border-b border-border px-4 pb-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 id={`job-setup-${j.project_id}`} className="text-base font-semibold">{j.job_number} — {j.project_name}</h3><div className="mt-1 text-sm text-muted-foreground">{j.agreement_number||'Agreement not captured'}{j.proposal_number?` · ${j.proposal_number}`:''}</div></div><Badge appearance="outline" color={j.job_ready?'success':'warning'}>{j.job_ready?'Setup clear':'Hold — setup needed'}</Badge></header>
        <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className={`space-y-1 rounded-lg border border-border bg-muted/20 p-3 ${j.agreement_captured?'text-success':'text-destructive'}`}><div className="text-xs font-medium text-muted-foreground">Customer Authorization</div><div className="break-words text-lg font-semibold tabular-nums">{j.agreement_captured?'Captured':'Missing'}</div><div className="break-words text-xs text-muted-foreground">{j.accepted_name?`Accepted by ${j.accepted_name}`:'No acceptance on file'}</div></div>
          <div className={`space-y-1 rounded-lg border border-border bg-muted/20 p-3 ${generatedPlan?'text-success':needsSync?'text-destructive':'text-warning'}`}><div className="text-xs font-medium text-muted-foreground">Field Plan</div><div className="break-words text-lg font-semibold tabular-nums">{generatedPlan?'Generated':needsSync?'Needs Sync':handoffStatus==='estimate_only'?'Estimate Only':'Manual'}</div><div className="break-words text-xs text-muted-foreground">{generatedPlan?`${Number(h.work_package_count||0)} package(s) · ${Number(h.operation_count||0)} operations · ${Number(h.inspection_count||0)} inspection(s) · ${Number(h.pour_plan_count||0)} pour plan(s) · ${Number(h.resource_requirement_count||0)} resource gate(s)`:h?.next_action||'No automatic takeoff handoff is attached to this job.'}</div></div>
          <div className={`space-y-1 rounded-lg border border-border bg-muted/20 p-3 ${j.billing_ready?'text-success':'text-warning'}`}><div className="text-xs font-medium text-muted-foreground">Billing Setup</div><div className="break-words text-lg font-semibold tabular-nums">{j.billing_ready?'Ready':'Needs Setup'}</div><div className="break-words text-xs text-muted-foreground">Project sales tax / exemption must be known.</div></div>
          <div className={`space-y-1 rounded-lg border border-border bg-muted/20 p-3 ${Number(j.required_before_start_open_count||0)>0?'text-warning':'text-success'}`}><div className="text-xs font-medium text-muted-foreground">Pre-Start Payment</div><div className="break-words text-lg font-semibold tabular-nums">{Number(j.required_before_start_count||0)?money(j.required_before_start_amount):'None Required'}</div><div className="break-words text-xs text-muted-foreground">{Number(j.required_before_start_open_count||0)>0?`${j.required_before_start_open_count} payment item(s) still open`:'No unpaid pre-start requirement'}</div></div>
          <div className={`space-y-1 rounded-lg border border-border bg-muted/20 p-3 ${j.job_ready?'text-success':'text-warning'}`}><div className="text-xs font-medium text-muted-foreground">Administrative Decision</div><div className="break-words text-lg font-semibold tabular-nums">{j.job_ready?'CLEAR':'HOLD'}</div><div className="break-words text-xs text-muted-foreground">{j.readiness_reason}</div></div>
        </div><div className="flex flex-wrap gap-2"><Button as="a" appearance="primary" href={`/job-setup/${j.project_id}`}>Open Job Setup</Button><Button as="a" appearance="outline" href={`/projects/${j.project_id}`}>Open Job</Button>{generatedPlan&&<><Button as="a" appearance="outline" href="/production/work-packages">Field Packages</Button><Button as="a" appearance="outline" href="/readiness/resources">Resource Gates</Button></>}</div></div>
      </Card></article>})}</div>}
    </section>
  </div></AppShell>;
}
