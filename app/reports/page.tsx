import {redirect} from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,BriefcaseBusiness,CircleDollarSign,ClipboardCheck,Percent,ReceiptText,Wallet,
} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {Badge} from '@/components/ui/badge';
import {buttonVariants} from '@/components/ui/button';
import {
  Card,CardContent,CardDescription,CardHeader,CardTitle,
} from '@/components/ui/card';
import {
  Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,TableBody,TableCell,TableHead,TableHeader,TableRow,
} from '@/components/ui/table';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const titleCase=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase());

function MetricCard({label,value,help,Icon,tone='default'}:{label:string;value:string;help:string;Icon:any;tone?:'default'|'success'|'warning'}){
  return <Card className="gap-3 py-4 shadow-none">
    <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-3 px-4">
      <div className="min-w-0">
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <CardTitle className={cn('mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</CardTitle>
      </div>
      <span className={cn('flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground',tone==='success'&&'bg-success/10 text-success',tone==='warning'&&'bg-warning/10 text-warning')}><Icon className="size-4"/></span>
    </CardHeader>
    <CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>
  </Card>;
}

function ReportsEmpty({Icon,title,description,href,action}:{Icon:any;title:string;description:string;href:string;action:string}){
  return <Empty className="min-h-48 border bg-muted/20">
    <EmptyHeader>
      <EmptyMedia variant="icon"><Icon/></EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent><Link href={href} className={buttonVariants({variant:'outline',size:'sm'})}>{action}</Link></EmptyContent>
  </Empty>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description?:string}){
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2>{description?<p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p>:null}</div>;
}

export default async function ReportsPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,company_id,role').eq('id',user.id).single();
  if(!profile?.company_id)redirect('/login');
  if(profile.role==='employee')redirect('/employee');

  const [{data:projects},{data:financial},{data:budgets},{data:billing},{data:production}]=await Promise.all([
    supabase.from('projects').select('id,job_number,name,status,contract_value,target_margin_percent,completed_at').eq('company_id',profile.company_id).order('completed_at',{ascending:false,nullsFirst:false}),
    supabase.from('project_financial_summary').select('*'),
    supabase.from('project_budget_actual_summary').select('*'),
    supabase.from('project_billing_summary').select('*'),
    supabase.from('production_rate_history').select('*').eq('company_id',profile.company_id).order('work_date',{ascending:false}).limit(1000),
  ]);

  const fMap=new Map((financial||[]).map((x:any)=>[x.project_id,x]));
  const bMap=new Map((budgets||[]).map((x:any)=>[x.project_id,x]));
  const billMap=new Map((billing||[]).map((x:any)=>[x.project_id,x]));
  const completed=(projects||[]).filter((p:any)=>p.status==='completed');
  const active=(projects||[]).filter((p:any)=>p.status==='active');

  const taskMap=new Map<string,{task:string,unit:string,qty:number,mh:number,samples:number}>();
  for(const r of production||[]){
    const key=`${r.task_name}|${r.unit}`;
    const x=taskMap.get(key)||{task:r.task_name,unit:r.unit,qty:0,mh:0,samples:0};
    x.qty+=num(r.quantity_completed);x.mh+=num(r.man_hours);x.samples++;
    taskMap.set(key,x);
  }
  const taskRates=[...taskMap.values()].filter(x=>x.qty>0&&x.mh>0).sort((a,b)=>b.samples-a.samples);
  const revenue=completed.reduce((s:number,p:any)=>s+num(fMap.get(p.id)?.adjusted_contract||p.contract_value),0);
  const cost=completed.reduce((s:number,p:any)=>s+num(bMap.get(p.id)?.actual_total_company_cost),0);
  const margin=revenue>0?(revenue-cost)/revenue*100:0;
  const ar=(billing||[]).reduce((s:number,x:any)=>s+num(x.outstanding_ar),0);

  return <AppShell userName={profile.full_name||user.email||'Owner'}>
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="carez-page-heading">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company performance</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Owner reports</h1>
        <p className="mt-1 max-w-5xl text-sm text-muted-foreground">Job profitability, labor performance, production history, and receivables from the authoritative Carez records already in the system.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Completed job revenue" value={money(revenue)} help="Authorized value of jobs marked complete." Icon={CircleDollarSign} tone="success"/>
        <MetricCard label="Completed job cost" value={money(cost)} help="Actual company cost captured against completed work." Icon={ReceiptText}/>
        <MetricCard label="Actual completed margin" value={`${margin.toFixed(1)}%`} help="Revenue left after captured job costs." Icon={Percent} tone={margin>=30?'success':margin>0?'warning':'default'}/>
        <MetricCard label="Customers still owe us" value={money(ar)} help="Outstanding invoices across all jobs." Icon={Wallet} tone={ar>0?'warning':'success'}/>
      </section>

      <section className="space-y-4">
        <SectionHeading kicker="Jobs" title="Job scorecards" description="Estimate and budget against actual performance."/>
        {(projects||[]).length===0?
          <ReportsEmpty Icon={ClipboardCheck} title="No project history yet" description="Completed and active jobs will appear here with budget versus actual performance." href="/projects" action="Open projects"/>:
          <Card className="py-0 shadow-none">
            <Table>
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Contract</TableHead><TableHead className="text-right">Actual cost</TableHead><TableHead className="text-right">Budget used</TableHead><TableHead className="text-right">Labor</TableHead><TableHead className="text-right">Customer owes</TableHead></TableRow></TableHeader>
              <TableBody>{(projects||[]).map((p:any)=>{
                const f:any=fMap.get(p.id)||{},b:any=bMap.get(p.id)||{},bill:any=billMap.get(p.id)||{};
                const budgetUsed=num(b.budget_cost_used_percent);
                return <TableRow key={p.id}>
                  <TableCell><Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">{p.job_number} — {p.name}</Link></TableCell>
                  <TableCell><Badge variant={p.status==='active'?'default':'secondary'} className={p.status==='completed'?'bg-success/10 text-success':''}>{titleCase(p.status)}</Badge></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(f.adjusted_contract||p.contract_value)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(b.actual_total_company_cost)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums',budgetUsed>=100&&'text-destructive')}>{b.project_id?`${budgetUsed.toFixed(1)}%`:'No baseline'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{num(b.actual_labor_hours).toFixed(1)} hr</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(bill.outstanding_ar)}</TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </Card>}
      </section>

      <section className="space-y-4">
        <SectionHeading kicker="Production" title="Carez production database" description="Weighted actual production from approved employee task time and verified quantities."/>
        {taskRates.length===0?
          <ReportsEmpty Icon={BarChart3} title="No measured production yet" description="Task clocking and verified quantities will build this automatically." href="/field" action="Open field control"/>:
          <Card className="py-0 shadow-none">
            <Table>
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHead>Task</TableHead><TableHead className="text-right">Samples</TableHead><TableHead className="text-right">Total built</TableHead><TableHead className="text-right">Total MH</TableHead><TableHead className="text-right">Units / MH</TableHead><TableHead className="text-right">MH / unit</TableHead></TableRow></TableHeader>
              <TableBody>{taskRates.map(r=><TableRow key={`${r.task}-${r.unit}`}>
                <TableCell className="font-medium">{r.task}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.samples}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.qty.toFixed(1)} {r.unit}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.mh.toFixed(1)} MH</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{(r.qty/r.mh).toFixed(2)} {r.unit}/MH</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{(r.mh/r.qty).toFixed(3)} MH/{r.unit}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </Card>}
      </section>

      <section className="space-y-4">
        <SectionHeading kicker="Current work" title="Jobs still running"/>
        {active.length===0?
          <ReportsEmpty Icon={BriefcaseBusiness} title="No active jobs" description="Jobs in progress will appear here with current labor, budget, and customer balance information." href="/projects" action="View projects"/>:
          <div className="grid gap-3 lg:grid-cols-2">{active.map((p:any)=>{
            const b:any=bMap.get(p.id)||{},bill:any=billMap.get(p.id)||{};
            const used=num(b.budget_cost_used_percent);
            return <Card key={p.id} size="sm" className="shadow-none">
              <CardHeader className="grid grid-cols-[1fr_auto] gap-3">
                <div><CardTitle><Link href={`/projects/${p.id}`} className="hover:text-primary">{p.job_number} — {p.name}</Link></CardTitle><CardDescription className="mt-1">{num(b.actual_labor_hours).toFixed(1)} labor hr used · {money(bill.outstanding_ar)} customer balance</CardDescription></div>
                <Badge variant={used>=100?'destructive':'secondary'}>{b.project_id?`${used.toFixed(0)}% budget used`:'No budget'}</Badge>
              </CardHeader>
            </Card>;
          })}</div>}
      </section>
    </div>
  </AppShell>;
}
