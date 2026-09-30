import {redirect} from 'next/navigation';
import Link from 'next/link';
import { DataBarVerticalRegular as BarChart3, BriefcaseRegular as BriefcaseBusiness, MoneyRegular as CircleDollarSign, ClipboardCheckmarkRegular as ClipboardCheck, TextNumberFormatRegular as Percent, ReceiptRegular as ReceiptText, WalletRegular as Wallet } from '@fluentui/react-icons';
import {AppShell} from '@/components/AppShell';
import {ReportsTabs} from './ReportsTabs';
import {Badge,Button,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {createClient} from '@/lib/supabase/server';
import {cn} from '@/lib/utils';

const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const num=(n:any)=>Number(n||0);
const titleCase=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase());

function MetricCard({label,value,help,Icon,tone='default'}:{label:string;value:string;help:string;Icon:any;tone?:'default'|'success'|'warning'}){
  return <div className="grid min-w-0 grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{label}</div>
        <div className={cn('mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}>{value}</div>
      </div>
      <Icon className={cn('mt-0.5 size-4 text-muted-foreground',tone==='success'&&'text-success',tone==='warning'&&'text-warning')}/>
      <div className="col-span-2 text-xs leading-5 text-muted-foreground">{help}</div>
  </div>;
}

function ReportsEmpty({Icon,title,description,href,action}:{Icon:any;title:string;description:string;href:string;action:string}){
  return <div className="min-h-48 border-y bg-muted/20">
    <div>
      <span ><Icon/></span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
    <div><Button as="a" href={href} appearance="secondary" size="small">{action}</Button></div>
  </div>;
}

function SectionHeading({kicker,title,description}:{kicker:string;title:string;description?:string}){
  return <div className="border-b border-border pb-3"><p className="font-mono text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">{kicker}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2>{description?<p className="mt-1 max-w-4xl text-sm text-muted-foreground">{description}</p>:null}</div>;
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
    <div className="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-3 lg:h-full">
      <header className="carez-page-heading">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Company performance</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Owner reports</h1>
        <p className="mt-1 text-xs text-muted-foreground">Job results, production, and receivables from Carez records.</p>
      </header>

      <section aria-label="Company performance ledger" className="grid shrink-0 divide-y divide-border border border-border bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        <MetricCard label="Completed job revenue" value={money(revenue)} help="Authorized value of jobs marked complete." Icon={CircleDollarSign} tone="success"/>
        <MetricCard label="Completed job cost" value={money(cost)} help="Actual company cost captured against completed work." Icon={ReceiptText}/>
        <MetricCard label="Actual completed margin" value={`${margin.toFixed(1)}%`} help="Revenue left after captured job costs." Icon={Percent} tone={margin>=30?'success':margin>0?'warning':'default'}/>
        <MetricCard label="Customers still owe us" value={money(ar)} help="Outstanding invoices across all jobs." Icon={Wallet} tone={ar>0?'warning':'success'}/>
      </section>

      <ReportsTabs>
      <div data-report-panel="jobs" className="min-h-0 overflow-auto p-3">
      <section className="space-y-4">
        <SectionHeading kicker="Jobs" title="Job scorecards" description="Estimate and budget against actual performance."/>
        {(projects||[]).length===0?
          <ReportsEmpty Icon={ClipboardCheck} title="No project history yet" description="Completed and active jobs will appear here with budget versus actual performance." href="/projects" action="Open projects"/>:
          <div className="overflow-x-auto border-y border-border">
            <Table>
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHeaderCell>Job</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell className="text-right">Contract</TableHeaderCell><TableHeaderCell className="text-right">Actual cost</TableHeaderCell><TableHeaderCell className="text-right">Budget used</TableHeaderCell><TableHeaderCell className="text-right">Labor</TableHeaderCell><TableHeaderCell className="text-right">Customer owes</TableHeaderCell></TableRow></TableHeader>
              <TableBody>{(projects||[]).map((p:any)=>{
                const f:any=fMap.get(p.id)||{},b:any=bMap.get(p.id)||{},bill:any=billMap.get(p.id)||{};
                const budgetUsed=num(b.budget_cost_used_percent);
                return <TableRow key={p.id}>
                  <TableCell><Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">{p.job_number} — {p.name}</Link></TableCell>
                  <TableCell><Badge appearance={p.status==='active'?'filled':'tint'} className={p.status==='completed'?'bg-success/10 text-success':''}>{titleCase(p.status)}</Badge></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(f.adjusted_contract||p.contract_value)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(b.actual_total_company_cost)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums',budgetUsed>=100&&'text-destructive')}>{b.project_id?`${budgetUsed.toFixed(1)}%`:'No baseline'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{num(b.actual_labor_hours).toFixed(1)} hr</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{money(bill.outstanding_ar)}</TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
          </div>}
      </section>
      </div>

      <div data-report-panel="production" className="min-h-0 overflow-auto p-3">
      <section className="space-y-4">
        <SectionHeading kicker="Production" title="Carez production database" description="Weighted actual production from approved employee task time and verified quantities."/>
        {taskRates.length===0?
          <ReportsEmpty Icon={BarChart3} title="No measured production yet" description="Task clocking and verified quantities will build this automatically." href="/field" action="Open field control"/>:
          <div className="overflow-x-auto border-y border-border">
            <Table>
              <TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHeaderCell>Task</TableHeaderCell><TableHeaderCell className="text-right">Samples</TableHeaderCell><TableHeaderCell className="text-right">Total built</TableHeaderCell><TableHeaderCell className="text-right">Total MH</TableHeaderCell><TableHeaderCell className="text-right">Units / MH</TableHeaderCell><TableHeaderCell className="text-right">MH / unit</TableHeaderCell></TableRow></TableHeader>
              <TableBody>{taskRates.map(r=><TableRow key={`${r.task}-${r.unit}`}>
                <TableCell className="font-medium">{r.task}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.samples}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.qty.toFixed(1)} {r.unit}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.mh.toFixed(1)} MH</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{(r.qty/r.mh).toFixed(2)} {r.unit}/MH</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{(r.mh/r.qty).toFixed(3)} MH/{r.unit}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>}
      </section>
      </div>

      <div data-report-panel="current" className="min-h-0 overflow-auto p-3">
      <section className="space-y-4">
        <SectionHeading kicker="Current work" title="Jobs still running"/>
        {active.length===0?
          <ReportsEmpty Icon={BriefcaseBusiness} title="No active jobs" description="Jobs in progress will appear here with current labor, budget, and customer balance information." href="/projects" action="View projects"/>:
          <div className="grid divide-y divide-border border-y border-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">{active.map((p:any)=>{
            const b:any=bMap.get(p.id)||{},bill:any=billMap.get(p.id)||{};
            const used=num(b.budget_cost_used_percent);
            return <article key={p.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4">
                <div><h3 className="font-medium"><Link href={`/projects/${p.id}`} className="hover:text-primary">{p.job_number} — {p.name}</Link></h3><p className="mt-1 text-xs text-muted-foreground">{num(b.actual_labor_hours).toFixed(1)} labor hr used · {money(bill.outstanding_ar)} customer balance</p></div>
                <Badge appearance="tint" color={used>=100?'danger':'informative'}>{b.project_id?`${used.toFixed(0)}% budget used`:'No budget'}</Badge>
            </article>;
          })}</div>}
      </section>
      </div>
      </ReportsTabs>
    </div>
  </AppShell>;
}
