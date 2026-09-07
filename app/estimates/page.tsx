import {redirect} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,FileText,Plus,Ruler,ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {EstimateGrid,type EstimateGridRow,type EstimateGridStage} from '@/components/estimates/EstimateGrid';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {createClient} from '@/lib/supabase/server';
import {createEstimate} from './actions';

const money=(value:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
const number=(value:any)=>Number(value||0);

function Metric({label,value,help,tone='default'}:{label:string;value:string;help:string;tone?:'default'|'success'}){
  return <Card className="gap-2 py-4 shadow-none"><CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={tone==='success'?'font-mono text-2xl font-semibold tracking-tight tabular-nums text-success':'font-mono text-2xl font-semibold tracking-tight tabular-nums'}>{value}</CardTitle></CardHeader><CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent></Card>;
}

export default async function EstimatesPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');

  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const [{data:projects},{data:estimates},{data:summaries},{data:presentations},{data:takeoffSummaries}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status').eq('company_id',profile.company_id).order('created_at',{ascending:false}),
    supabase.from('estimates').select('*').eq('company_id',profile.company_id).order('updated_at',{ascending:false}),
    supabase.from('estimate_financial_summary').select('*').eq('company_id',profile.company_id),
    supabase.from('proposal_presentations').select('estimate_id,proposal_number,status,sent_at').eq('company_id',profile.company_id).order('sent_at',{ascending:false}),
    supabase.from('estimate_takeoff_summary').select('*').eq('company_id',profile.company_id),
  ]);

  const summaryMap=new Map((summaries||[]).map((row:any)=>[row.estimate_id,row]));
  const projectMap=new Map((projects||[]).map((row:any)=>[row.id,row]));
  const takeoffMap=new Map((takeoffSummaries||[]).map((row:any)=>[row.estimate_id,row]));
  const issuedMap=new Map<string,any>();
  for(const row of presentations||[])if(!issuedMap.has(row.estimate_id))issuedMap.set(row.estimate_id,row);

  const rows=(estimates||[]).map((estimate:any)=>{
    const proposal=issuedMap.get(estimate.id);
    const project:any=projectMap.get(estimate.project_id)||null;
    const summary:any=summaryMap.get(estimate.id)||{};
    const takeoff:any=takeoffMap.get(estimate.id)||{};
    const stage:EstimateGridStage=estimate.status==='accepted'||estimate.status==='approved'
      ?'awarded'
      :proposal
        ?'issued'
        :estimate.status==='ready'
          ?'ready'
          :estimate.status==='superseded'||estimate.status==='declined'
            ?'history'
            :'working';
    return{estimate,proposal,project,summary,takeoff,stage};
  });

  const working=rows.filter(row=>row.stage==='working'||row.stage==='ready');
  const issued=rows.filter(row=>row.stage==='issued');
  const awarded=rows.filter(row=>row.stage==='awarded');
  const ready=rows.filter(row=>row.stage==='ready');
  const pipeline=working.reduce((sum,row)=>sum+number(row.summary.recommended_sell_price),0);

  const gridRows:EstimateGridRow[]=rows.map(row=>{
    const {estimate,proposal,project,summary,takeoff,stage}=row;
    const takeoffObjects=number(takeoff.active_measurements);
    const stageLabel=stage==='working'
      ?'Pricing'
      :stage==='ready'
        ?'Ready for audit'
        :stage==='issued'
          ?proposal?.proposal_number||'Issued'
          :stage==='awarded'
            ?'Awarded'
            :estimate.status==='declined'
              ?'Declined'
              :'Superseded';
    const secondary=stage==='working'&&!takeoffObjects
      ?{href:'/takeoff',label:'Start takeoff'}
      :stage==='ready'
        ?{href:'/estimates/audit',label:'Audit'}
        :stage==='issued'
          ?{href:`/proposals/${estimate.id}`,label:'Proposal'}
          :stage==='awarded'&&project
            ?{href:`/projects/${project.id}`,label:'Job'}
            :null;

    return{
      id:estimate.id,
      displayNumber:`${estimate.estimate_number}-R${Number(estimate.version||0)}`,
      name:estimate.name,
      projectNumber:project?.job_number||null,
      projectName:project?.name||null,
      stage,
      stageLabel,
      takeoffObjects,
      priceHolds:number(takeoff.missing_price_outputs),
      directCost:number(summary.total_direct_cost),
      quote:number(summary.selected_sell_price||summary.recommended_sell_price||estimate.proposed_sell_price),
      projectedMargin:number(summary.projected_margin_percent),
      targetMargin:number(estimate.target_margin_percent),
      updatedAt:estimate.updated_at||null,
      estimateHref:`/estimates/${estimate.id}`,
      secondaryHref:secondary?.href||null,
      secondaryLabel:secondary?.label||null,
    };
  });

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preconstruction</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Estimates</h1><p className="mt-1 max-w-4xl text-sm text-muted-foreground">Price concrete scope from takeoff, resolve exceptions, protect margin, and issue the exact revision the customer will accept.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({size:'sm'})} href="/takeoff"><Ruler/>Takeoff</Link>
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/estimates/audit"><ShieldCheck/>Audit</Link>
          <Link className={buttonVariants({variant:'outline',size:'sm'})} href="/proposals"><FileText/>Proposals</Link>
        </div>
      </header>

      <nav className="flex w-fit max-w-full items-stretch overflow-x-auto rounded-lg border bg-card text-xs" aria-label="Estimate workflow">
        {['Takeoff','Estimate','Audit','Proposal'].map((label,index)=><div key={label} className={index===1?'flex min-h-9 items-center gap-2 border-r bg-accent px-3 font-medium text-primary shadow-[inset_0_-2px_var(--primary)] last:border-r-0':'flex min-h-9 items-center gap-2 border-r px-3 text-muted-foreground last:border-r-0'}><span className="font-mono text-[10px]">{index+1}</span><span>{label}</span>{index<3?<ArrowRight className="size-3 opacity-50"/>:null}</div>)}
      </nav>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pricing now" value={String(working.length)} help="Editable bid revisions."/>
        <Metric label="Ready for audit" value={String(ready.length)} help="Price and scope marked ready." tone={ready.length?'success':'default'}/>
        <Metric label="Issued / awarded" value={`${issued.length} / ${awarded.length}`} help="Customer-facing and won revisions."/>
        <Metric label="Pricing pipeline" value={money(pipeline)} help="Recommended value still being priced."/>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All revisions</p><h2 className="mt-1 text-lg font-semibold">Estimate workbench</h2><p className="mt-1 text-sm text-muted-foreground">Filter, inspect, and open authoritative estimate revisions without leaving the pricing workspace.</p></div>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" size="sm"/>}><Plus/>Standalone estimate</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create standalone estimate</DialogTitle><DialogDescription>The normal workflow starts from a Lead so customer and project information carry forward. Use this only when that lineage does not apply.</DialogDescription></DialogHeader>
              <form action={createEstimate} className="grid gap-4">
                <div className="grid gap-2"><Label htmlFor="estimate-name">Description <span className="font-normal text-muted-foreground">optional</span></Label><Input id="estimate-name" name="name" placeholder="Concrete scope / property name"/></div>
                <div className="grid gap-2"><Label htmlFor="estimate-project">Existing job <span className="font-normal text-muted-foreground">optional</span></Label><select id="estimate-project" name="project_id" defaultValue="" className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20"><option value="">New opportunity</option>{(projects||[]).map((project:any)=><option key={project.id} value={project.id}>{project.job_number} — {project.name}</option>)}</select></div>
                <div className="flex justify-end"><Button type="submit"><Plus/>Create estimate</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {gridRows.length?<EstimateGrid rows={gridRows}/>:<Empty className="min-h-64 border bg-muted/20"><EmptyHeader><EmptyMedia variant="icon"><FileText/></EmptyMedia><EmptyTitle>No estimates yet</EmptyTitle><EmptyDescription>Start from Leads or Takeoff, or create a standalone estimate when the normal lead workflow does not apply.</EmptyDescription></EmptyHeader><EmptyContent><Link className={buttonVariants()} href="/leads">Open leads</Link></EmptyContent></Empty>}
      </section>
    </div>
  </AppShell>;
}
