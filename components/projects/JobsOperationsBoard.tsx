'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {
  AlertTriangle,CalendarDays,ChevronRight,CircleDollarSign,FilterX,List,MoreHorizontal,
  Search,SlidersHorizontal,Wallet
} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Empty,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {Progress} from '@/components/ui/progress';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {cn} from '@/lib/utils';

export type JobsBoardRow={
  id:string;
  jobNumber:string|null;
  name:string;
  customer:string;
  location:string;
  projectStatus:string;
  state:'ready'|'hold'|'planning'|'setup'|'completed';
  nextStep:string;
  scheduleDate:string|null;
  contractValue:number;
  budgetUsed:number;
  laborRemaining:number;
  customerOwed:number;
  overdue:number;
  readyOperations:number;
  blockedOperations:number;
  openOperations:number;
  activeShifts:number;
  pendingTimecards:number;
  gpsExceptions:number;
  reasons:string[];
  attention:boolean;
  setupHold:boolean;
};

export type JobsBoardMetrics={ready:number;holds:number;attention:number;fieldJobs:number;activeShifts:number;customersOwe:number;overdue:number;};

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const shortDate=(v:string|null)=>v?new Date(`${v.slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const titleCase=(v:string)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());

const stateMeta={
  ready:{label:'Ready',tone:'success'},hold:{label:'Hold',tone:'danger'},planning:{label:'In progress',tone:'active'},setup:{label:'Waiting',tone:'warning'},completed:{label:'Complete',tone:'success'},
} as const;

function priorityFor(row:JobsBoardRow){
  if(row.state==='hold')return{label:'Critical',tone:'danger' as const};
  if(row.attention)return{label:'High',tone:'warning' as const};
  return{label:'Normal',tone:'muted' as const};
}

function ToneBadge({tone,label}:{tone:'success'|'danger'|'active'|'warning'|'muted';label:string}){
  return <Badge variant={tone==='danger'?'destructive':tone==='active'?'default':'secondary'} className={cn(
    tone==='success'&&'bg-success/10 text-success',
    tone==='warning'&&'bg-amber-500/10 text-amber-700',
    tone==='muted'&&'text-muted-foreground'
  )}>{label}</Badge>;
}

function Kpi({label,value,help,tone}:{label:string;value:string;help:string;tone:'neutral'|'active'|'success'|'warning'|'danger'}){
  return <Card className={cn('gap-2 py-4 shadow-none',tone==='danger'&&'border-destructive/25',tone==='warning'&&'border-amber-500/30')}>
    <CardHeader className="gap-1 px-4"><CardDescription className="text-xs font-medium">{label}</CardDescription><CardTitle className={cn('font-mono text-2xl font-semibold tracking-tight tabular-nums',tone==='active'&&'text-primary',tone==='success'&&'text-success',tone==='warning'&&'text-amber-700',tone==='danger'&&'text-destructive')}>{value}</CardTitle></CardHeader>
    <CardContent className="px-4 text-xs leading-5 text-muted-foreground">{help}</CardContent>
  </Card>;
}

const filterSelect='h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20';

export function JobsOperationsBoard({rows,metrics}:{rows:JobsBoardRow[];metrics:JobsBoardMetrics}){
  const router=useRouter();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('active');
  const [stage,setStage]=useState('all');
  const [attention,setAttention]=useState('all');
  const [sort,setSort]=useState('priority');
  const [selectedId,setSelectedId]=useState<string|null>(null);

  const stages=useMemo(()=>Array.from(new Set(rows.map(row=>row.projectStatus).filter(Boolean))).sort(),[rows]);
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const rank=(row:JobsBoardRow)=>row.state==='hold'?0:row.attention?1:row.state==='ready'?2:row.state==='planning'?3:row.state==='setup'?4:5;
    const result=rows.filter(row=>{
      if(status==='active'&&row.state==='completed')return false;
      if(status!=='active'&&status!=='all'&&row.state!==status)return false;
      if(stage!=='all'&&row.projectStatus!==stage)return false;
      if(attention==='attention'&&!row.attention)return false;
      if(attention==='clear'&&row.attention)return false;
      if(q&&!`${row.jobNumber||''} ${row.name} ${row.customer} ${row.location} ${row.nextStep}`.toLowerCase().includes(q))return false;
      return true;
    });
    result.sort((a,b)=>{
      if(sort==='schedule')return(a.scheduleDate||'9999').localeCompare(b.scheduleDate||'9999');
      if(sort==='budget')return b.budgetUsed-a.budgetUsed;
      if(sort==='owed')return b.customerOwed-a.customerOwed;
      if(sort==='name')return a.name.localeCompare(b.name);
      return rank(a)-rank(b)||(a.scheduleDate||'9999').localeCompare(b.scheduleDate||'9999');
    });
    return result;
  },[rows,query,status,stage,attention,sort]);

  const selected=selectedId?rows.find(row=>row.id===selectedId)||null:null;
  const clearFilters=()=>{setQuery('');setStatus('active');setStage('all');setAttention('all');setSort('priority');};

  return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Job operations metrics">
      <Kpi label="Ready to move" value={String(metrics.ready)} help="Jobs with a physical operation ready to start." tone={metrics.ready?'success':'neutral'}/>
      <Kpi label="Hard holds" value={String(metrics.holds)} help="Setup, inspection or prerequisites block work." tone={metrics.holds?'danger':'neutral'}/>
      <Kpi label="Needs attention" value={String(metrics.attention)} help="Field, labor, billing or budget exceptions." tone={metrics.attention?'warning':'neutral'}/>
      <Kpi label="Field active" value={String(metrics.fieldJobs)} help={`${metrics.activeShifts} active field shift${metrics.activeShifts===1?'':'s'} right now.`} tone={metrics.fieldJobs?'active':'neutral'}/>
      <Kpi label="Customers owe" value={money(metrics.customersOwe)} help={metrics.overdue?`${money(metrics.overdue)} is past due.`:'No overdue customer balance.'} tone={metrics.overdue?'danger':metrics.customersOwe?'warning':'neutral'}/>
    </section>

    <Card className="gap-0 py-0 shadow-none">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative min-w-56 flex-1 lg:max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search jobs, customers, locations..." className="h-8 pl-8 text-xs"/></div>
        <select className={filterSelect} value={status} onChange={e=>setStatus(e.target.value)} aria-label="Job status"><option value="active">Active jobs</option><option value="ready">Ready</option><option value="hold">Hold</option><option value="planning">In progress</option><option value="setup">Waiting</option><option value="completed">Complete</option><option value="all">All jobs</option></select>
        <select className={filterSelect} value={stage} onChange={e=>setStage(e.target.value)} aria-label="Project stage"><option value="all">All stages</option>{stages.map(item=><option key={item} value={item}>{titleCase(item)}</option>)}</select>
        <select className={filterSelect} value={attention} onChange={e=>setAttention(e.target.value)} aria-label="Attention filter"><option value="all">All attention</option><option value="attention">Needs attention</option><option value="clear">Clear</option></select>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"><SlidersHorizontal className="size-3.5"/>Sort</span>
          <select className={filterSelect} value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort jobs"><option value="priority">Priority</option><option value="schedule">Schedule</option><option value="budget">Budget used</option><option value="owed">Customers owe</option><option value="name">Job name</option></select>
          <Button variant="ghost" size="icon-sm" onClick={clearFilters} title="Reset filters"><FilterX/></Button>
          <Button variant="secondary" size="icon-sm" title="Table view" aria-label="Table view"><List/></Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-b bg-muted/20 px-3 py-2"><div className="flex items-center gap-2"><span className="text-xs font-medium">Jobs</span><Badge variant="secondary">{filtered.length}</Badge></div><span className="hidden text-xs text-muted-foreground sm:block">Select a row for job context. Double-click to open.</span></div>

      {filtered.length===0?<Empty className="min-h-64 border-0"><EmptyHeader><EmptyMedia variant="icon"><FilterX/></EmptyMedia><EmptyTitle>No jobs match this view</EmptyTitle><EmptyDescription>Adjust the filters, or create a direct job if the work is outside the normal accepted-proposal workflow.</EmptyDescription></EmptyHeader></Empty>:
        <Table>
          <TableHeader><TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Job / client</TableHead><TableHead>Status</TableHead><TableHead>Next step</TableHead><TableHead>Schedule</TableHead><TableHead>Field</TableHead><TableHead className="min-w-40">Budget</TableHead><TableHead className="text-right">Customers owe</TableHead><TableHead>Priority</TableHead><TableHead className="w-10"/></TableRow></TableHeader>
          <TableBody>{filtered.map(row=>{
            const sm=stateMeta[row.state],priority=priorityFor(row),selectedRow=selectedId===row.id;
            return <TableRow key={row.id} className={cn('cursor-pointer',selectedRow&&'bg-accent/60 hover:bg-accent/70')} onClick={()=>setSelectedId(row.id)} onDoubleClick={()=>router.push(`/projects/${row.id}`)} tabIndex={0} onKeyDown={event=>{if(event.key==='Enter')router.push(`/projects/${row.id}`)}}>
              <TableCell className="min-w-60"><div className="flex items-start gap-3"><span className="mt-0.5 rounded-md bg-accent px-1.5 py-1 font-mono text-[10px] font-semibold text-primary">{row.jobNumber||'—'}</span><div className="min-w-0"><div className="truncate font-medium">{row.name}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{row.customer}</div><div className="truncate text-[11px] text-muted-foreground">{row.location}</div></div></div></TableCell>
              <TableCell><ToneBadge tone={sm.tone} label={sm.label}/></TableCell>
              <TableCell className="min-w-64"><div className="font-medium">{row.nextStep}</div>{row.reasons[0]&&row.attention?<div className="mt-0.5 max-w-72 whitespace-normal text-xs text-muted-foreground">{row.reasons[0]}</div>:null}</TableCell>
              <TableCell className="carez-data-number"><div className="font-medium">{shortDate(row.scheduleDate)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.scheduleDate?'Next field date':'Not scheduled'}</div></TableCell>
              <TableCell><div className="font-medium">{row.activeShifts?`${row.activeShifts} active`:'—'}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.pendingTimecards?`${row.pendingTimecards} timecard review`:row.gpsExceptions?`${row.gpsExceptions} GPS review`:'No active shift'}</div></TableCell>
              <TableCell><div className="min-w-36"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={cn('font-medium',row.budgetUsed>=100&&'text-destructive')}>{row.budgetUsed?`${row.budgetUsed.toFixed(0)}%`:'—'}</span><span className={cn('text-muted-foreground',row.laborRemaining<0&&'text-destructive')}>{row.laborRemaining?`${row.laborRemaining.toFixed(1)} MH left`:'Budget summary'}</span></div><Progress value={Math.max(0,Math.min(100,row.budgetUsed))}/></div></TableCell>
              <TableCell className="carez-data-number text-right"><div className={cn('font-medium',row.overdue&&'text-destructive')}>{money(row.customerOwed)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.overdue?`${money(row.overdue)} late`:'Outstanding A/R'}</div></TableCell>
              <TableCell><ToneBadge tone={priority.tone} label={priority.label}/></TableCell>
              <TableCell onClick={event=>event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}/> }><MoreHorizontal/></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={()=>router.push(`/projects/${row.id}`)}>Open job</DropdownMenuItem>
                    <DropdownMenuItem onClick={()=>router.push('/schedule')}>Schedule</DropdownMenuItem>
                    {row.state==='hold'?<DropdownMenuItem onClick={()=>router.push('/readiness')}>Clear hold</DropdownMenuItem>:null}
                    {row.pendingTimecards>0?<DropdownMenuItem onClick={()=>router.push('/field/review')}>Review time</DropdownMenuItem>:null}
                    {row.customerOwed>0?<><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>router.push('/billing')}>Billing</DropdownMenuItem></>:null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>}
    </Card>

    <Sheet open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelectedId(null)}}>
      {selected?<JobInspector row={selected}/>:null}
    </Sheet>
  </div>;
}

function JobInspector({row}:{row:JobsBoardRow}){
  const sm=stateMeta[row.state],priority=priorityFor(row);
  return <SheetContent className="w-[92vw] overflow-y-auto sm:max-w-md">
    <SheetHeader className="border-b pr-12"><div className="carez-kicker">Job inspector</div><SheetTitle>{row.name}</SheetTitle><SheetDescription>{row.jobNumber||'No job number'} · {row.customer}</SheetDescription></SheetHeader>
    <div className="space-y-5 px-4 pb-6">
      <section className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Operations</div><dl className="divide-y rounded-lg border">
        <InspectorRow label="Status"><ToneBadge tone={sm.tone} label={sm.label}/></InspectorRow>
        <InspectorRow label="Priority"><ToneBadge tone={priority.tone} label={priority.label}/></InspectorRow>
        <InspectorRow label="Project manager"><span className="text-muted-foreground">Not exposed by current project summary</span></InspectorRow>
        <InspectorRow label="Field"><span>{row.activeShifts?`${row.activeShifts} active field shift${row.activeShifts===1?'':'s'}`:'No active field shift'}</span></InspectorRow>
      </dl></section>

      <section className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Next operation</div><div className="flex gap-3 rounded-lg border bg-muted/20 p-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><ChevronRight className="size-4"/></span><div><div className="font-medium">{row.nextStep}</div><div className="mt-1 text-xs text-muted-foreground">{row.scheduleDate?shortDate(row.scheduleDate):'Not scheduled'}</div></div></div>{row.reasons.length>0?<div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3"><div className="text-xs font-semibold text-destructive">Current constraints</div>{row.reasons.map((reason,index)=><p key={index} className="flex gap-2 text-xs leading-5 text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive"/>{reason}</p>)}</div>:null}</section>

      <section className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Readiness</div><div className="grid grid-cols-2 gap-2">{[['Ready ops',row.readyOperations],['On hold',row.blockedOperations],['Open ops',row.openOperations],['Timecards',row.pendingTimecards]].map(([label,value])=><div key={String(label)} className="rounded-lg border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</div></div>)}</div></section>

      <section className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Financial position</div><dl className="divide-y rounded-lg border">
        <InspectorRow label="Contract amount"><span className="carez-data-number">{money(row.contractValue)}</span></InspectorRow>
        <InspectorRow label="Budget used"><span className="carez-data-number">{row.budgetUsed?`${row.budgetUsed.toFixed(1)}%`:'Not available'}</span></InspectorRow>
        <InspectorRow label="Labor remaining"><span className={cn('carez-data-number',row.laborRemaining<0&&'text-destructive')}>{row.laborRemaining?`${row.laborRemaining.toFixed(1)} MH`:'Not available'}</span></InspectorRow>
        <InspectorRow label="Customer balance"><span className="carez-data-number">{money(row.customerOwed)}</span></InspectorRow>
        <InspectorRow label="Past due"><span className={cn('carez-data-number',row.overdue&&'text-destructive')}>{money(row.overdue)}</span></InspectorRow>
      </dl><div className="flex gap-2 rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground"><CircleDollarSign className="mt-0.5 size-4 shrink-0"/><span>Approved change orders, committed cost and actual cost are not exposed by the current Jobs summary query, so this inspector does not fabricate them.</span></div></section>

      <section className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Quick links</div><div className="grid grid-cols-2 gap-2">
        <Link href={`/projects/${row.id}`} className={buttonVariants({variant:'outline',size:'sm'})}>Open job</Link>
        <Link href="/takeoff" className={buttonVariants({variant:'outline',size:'sm'})}>Takeoff</Link>
        <Link href="/estimates" className={buttonVariants({variant:'outline',size:'sm'})}>Estimate</Link>
        <Link href="/field" className={buttonVariants({variant:'outline',size:'sm'})}>Field</Link>
        <Link href="/schedule" className={buttonVariants({variant:'outline',size:'sm'})}><CalendarDays/>Schedule</Link>
        <Link href="/cashflow" className={buttonVariants({variant:'outline',size:'sm'})}><Wallet/>Money</Link>
      </div></section>
    </div>
  </SheetContent>;
}

function InspectorRow({label,children}:{label:string;children:React.ReactNode}){
  return <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 px-3 py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="min-w-0 text-right text-xs font-medium">{children}</dd></div>;
}
