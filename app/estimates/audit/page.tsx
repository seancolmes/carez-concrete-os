import {redirect} from 'next/navigation';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {createClient} from '@/lib/supabase/server';

const label=(v:string)=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());

export default async function EstimateAuditPage({searchParams}:{searchParams:Promise<{estimate?:string}>}){
  const {estimate:selectedEstimateId}=await searchParams;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');
  const companyId=profile.company_id;

  const [{data:summaries},{data:findings}]=await Promise.all([
    supabase.from('estimate_audit_summary').select('*').eq('company_id',companyId).order('estimate_number').order('version',{ascending:false}),
    supabase.from('estimate_audit_findings').select('*').eq('company_id',companyId).order('sort_order'),
  ]);

  const allSummaries=summaries||[];
  const allFindings=findings||[];
  const visibleSummaries=selectedEstimateId?allSummaries.filter((x:any)=>x.estimate_id===selectedEstimateId):allSummaries;
  const visibleIds=new Set(visibleSummaries.map((x:any)=>x.estimate_id));
  const visibleFindings=allFindings.filter((x:any)=>visibleIds.has(x.estimate_id));
  const byEstimate=new Map<string,any[]>();
  for(const f of visibleFindings){const arr=byEstimate.get(f.estimate_id)||[];arr.push(f);byEstimate.set(f.estimate_id,arr);}
  const blocked=allSummaries.filter((x:any)=>x.audit_status==='blocked');
  const review=allSummaries.filter((x:any)=>x.audit_status==='review');
  const clear=allSummaries.filter((x:any)=>x.audit_status==='clear');
  const blockerCount=allSummaries.reduce((s:number,x:any)=>s+Number(x.blocker_count||0),0);
  const warningCount=allSummaries.reduce((s:number,x:any)=>s+Number(x.warning_count||0),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}><div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
    <header className="carez-page-heading flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pre-send control</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Estimate Risk / Scope Audit</h1><p className="mt-1 max-w-5xl text-sm text-muted-foreground">Carez checks the estimate, takeoff, L&amp;I phase, pricing, production evidence and proposal setup before customer issue. Objective blockers stop release. Judgment items stay visible as warnings.</p></div>
      <div className="flex flex-wrap gap-2"><Link className={buttonVariants({size:'sm'})} href="/estimates">Estimates</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff">Takeoff</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/takeoff/intelligence">Estimator Intelligence</Link><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/proposals">Proposals</Link></div>
    </header>

    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"><strong>The audit is derived, not another checklist.</strong> <span className="text-muted-foreground">Fix the underlying estimate or proposal fact and the finding disappears automatically. Proposal issue is blocked only while one or more objective <strong className="text-foreground">BLOCK SEND</strong> findings remain.</span></div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Blocked Estimates" value={blocked.length} help="Cannot issue a new customer proposal yet." tone={blocked.length?'destructive':'success'}/>
      <Metric label="Review Needed" value={review.length} help="No hard stop, but estimator judgment is required." tone={review.length?'warning':'success'}/>
      <Metric label="Audit Clear" value={clear.length} help="No current blockers or warnings." tone="success"/>
      <Metric label="Blockers" value={blockerCount} help="Objective conditions that must be corrected." tone={blockerCount?'destructive':'default'}/>
      <Metric label="Warnings" value={warningCount} help="Scope, margin, placement or proposal items to review." tone={warningCount?'warning':'default'}/>
    </section>

    {selectedEstimateId&&<div><Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates/audit">Show All Estimates</Link></div>}

    {visibleSummaries.length===0?<Empty className="min-h-64 border border-border bg-muted/10"><EmptyHeader><EmptyTitle>No estimates to audit yet</EmptyTitle><EmptyDescription>As estimates are created, Carez will continuously evaluate their release risk here.</EmptyDescription></EmptyHeader><EmptyContent className="flex flex-wrap gap-2"><Link className={buttonVariants()} href="/estimates">Open Estimates</Link><Link className={buttonVariants({variant:'outline'})} href="/takeoff">Start From Takeoff</Link></EmptyContent></Empty>:
      <section className="space-y-4">{visibleSummaries.map((s:any)=>{
        const fs=byEstimate.get(s.estimate_id)||[];
        const blockers=fs.filter((f:any)=>f.severity==='blocker');
        const warnings=fs.filter((f:any)=>f.severity==='warning');
        const statusTone=s.audit_status==='blocked'?'border-destructive/30 bg-destructive/10 text-destructive':s.audit_status==='clear'?'border-success/30 bg-success/10 text-success':'border-warning/30 bg-warning/10 text-warning';
        return <Card className="shadow-none" key={s.estimate_id}>
          <CardHeader className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{s.estimate_number}-R{s.version} — {s.name}</CardTitle><CardDescription className="mt-1">Estimate status: {label(s.status)} · {s.finding_count} finding{s.finding_count===1?'':'s'}</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone}>{s.audit_status==='blocked'?'BLOCK SEND':s.audit_status==='clear'?'CLEAR':'REVIEW'}</Badge><Link className={buttonVariants({variant:'outline',size:'sm'})} href={`/estimates/audit?estimate=${s.estimate_id}`}>Focus</Link></div></CardHeader>
          <CardContent className="space-y-4">
            {fs.length===0?<div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success"><strong>Audit clear.</strong> No current pricing, scope, labor or proposal findings.</div>:<>
              {blockers.length>0&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"><strong>{blockers.length} release blocker{blockers.length===1?'':'s'}.</strong> {s.next_action}</div>}
              {blockers.length===0&&warnings.length>0&&<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning"><strong>No hard stops.</strong> Review {warnings.length} warning{warnings.length===1?'':'s'} before intentionally releasing the proposal.</div>}
              <div className="divide-y rounded-lg border border-border">{fs.map((f:any)=><div key={f.finding_key} className="space-y-2 px-3 py-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={f.severity==='blocker'?'border-destructive/30 bg-destructive/10 text-destructive':'border-warning/30 bg-warning/10 text-warning'}>{f.severity==='blocker'?'BLOCK SEND':'WARNING'}</Badge><span className="text-xs text-muted-foreground">{label(f.category)}</span></div><div className="font-medium">{f.title}</div><div className="text-sm text-muted-foreground">{f.detail}</div><div className="text-sm"><strong>Next:</strong> {f.next_action}</div></div>)}</div>
            </>}
          </CardContent>
        </Card>;
      })}</section>}

    <Card className="shadow-none"><CardHeader><CardTitle>What Carez is Watching</CardTitle><CardDescription>The rules are intentionally split between objective release blockers and estimator-review warnings.</CardDescription></CardHeader><CardContent><div className="divide-y rounded-lg border border-border">{[
      ['BLOCK SEND — pricing integrity.','No customer price, unpriced assembly output, $0 manual material/equipment/subcontract scope, or labor hours with no payroll cost.'],
      ['BLOCK SEND — labor classification.','Labor with missing or inactive Washington L&I classification cannot be released.'],
      ['BLOCK SEND — contract terms.','A customer proposal cannot be issued with no estimate terms and no company default terms.'],
      ['WARNING — physical-scope risk.','Pump/placement method, flatwork jointing, L&I overrides and unsectioned scope remain visible for estimator judgment.'],
      ['WARNING — business risk.','Margin below target and clean Carez production evidence that supports more labor are surfaced before the bid leaves the office.'],
      ['WARNING — proposal quality.','Payment summary, exclusions/assumptions, schedule and contractor identity are checked without pretending every job uses identical language.'],
    ].map(([title,detail])=><div key={title} className="px-3 py-3"><div className="font-medium">{title}</div><div className="mt-1 text-sm text-muted-foreground">{detail}</div></div>)}</div></CardContent></Card>
  </div></AppShell>;
}

function Metric({label,value,help,tone='default'}:{label:string;value:number;help:string;tone?:'default'|'success'|'warning'|'destructive'}){
  const toneClass=tone==='success'?'text-success':tone==='warning'?'text-warning':tone==='destructive'?'text-destructive':'';
  return <Card className="gap-2 py-4 shadow-none"><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={`font-mono text-2xl font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}
