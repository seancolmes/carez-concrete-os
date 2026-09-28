'use client';

import Link from 'next/link';
import {Fragment,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ChevronDown,FilterX,MoreHorizontal,Search,SlidersHorizontal,CheckCheck,ShieldAlert,HardHat,Wallet,BriefcaseBusiness,ArrowUpRight,MapPin,FileText} from 'lucide-react';
import {
  CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,
  CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable,
  CarezStatus,
} from '@/components/carez';
import {CarezExperienceEmpty} from '@/components/carez/experience';
import {MetricBentoTile} from './MetricBentoTile';
import {Button,buttonVariants} from '@/components/ui/button';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Input} from '@/components/ui/input';
import {Progress} from '@/components/ui/progress';
import {CSICostCodeStrip} from '@/components/ui/CSICostCodeStrip';
import {PourWeatherBadge} from '@/components/ui/PourWeatherBadge';
import {TakeoffThumbnail} from '@/components/ui/TakeoffThumbnail';
import {resolveOperationalState,resolvePriority} from '@/lib/ui/operations';
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
  billedAmount:number;
  budgetUsed:number;
  laborRemaining:number;
  budgetAvailable:boolean;
  customerOwed:number;
  overdue:number;
  billingAvailable:boolean;
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

function priorityKindFor(row:JobsBoardRow){
  if(row.state==='hold')return 'critical' as const;
  if(row.attention)return 'high' as const;
  return 'normal' as const;
}

const filterSelect='h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:ring-0 focus:ring-offset-0 focus:border-[#007A52] dark:focus:border-[#009966]';

export function JobsOperationsBoard({rows,metrics}:{rows:JobsBoardRow[];metrics:JobsBoardMetrics}){
  const router=useRouter();
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('active');
  const [stage,setStage]=useState('all');
  const [attention,setAttention]=useState('all');
  const [sort,setSort]=useState('priority');
  const [expandedRowId,setExpandedRowId]=useState<string|null>(null);
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

  const clearFilters=()=>{setQuery('');setStatus('active');setStage('all');setAttention('all');setSort('priority');};
  const toggleRow=(id:string)=>setExpandedRowId(current=>current===id?null:id);

  const toolbar=<div className="w-full overflow-x-auto">
    <div className="flex min-w-max items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <div className="relative w-56 shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
          <Input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search jobs, customers, locations" placeholder="Search jobs, customers, locations..." className="h-8 pl-8 text-xs"/>
        </div>
        <div role="tablist" aria-label="Project operating state" className="flex h-8 w-max items-center gap-0.5 border border-border bg-muted p-0.5">
        {([['active','Current work'],['ready','Ready'],['hold','Hold'],['planning','In progress'],['setup','Waiting'],['completed','Complete'],['all','All jobs']] as const).map(([value,label])=><button key={value} type="button" role="tab" aria-selected={status===value} tabIndex={status===value?0:-1} onClick={()=>setStatus(value)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')||[]),index=tabs.indexOf(event.currentTarget),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next]?.focus();tabs[next]?.click();}} className={cn('flex h-7 shrink-0 items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',status===value&&'border-b-2 border-primary bg-card text-foreground')}>{value==='ready'?<CheckCheck className="size-3"/>:value==='hold'?<ShieldAlert className="size-3"/>:null}{label}</button>)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <select className={filterSelect} value={stage} onChange={e=>setStage(e.target.value)} aria-label="Project stage"><option value="all">All stages</option>{stages.map(item=><option key={item} value={item}>{titleCase(item)}</option>)}</select>
        <select className={filterSelect} value={attention} onChange={e=>setAttention(e.target.value)} aria-label="Attention filter"><option value="all">All attention</option><option value="attention">Needs attention</option><option value="clear">Clear</option></select>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5"/>Sort</span>
        <select className={filterSelect} value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort jobs"><option value="priority">Priority</option><option value="schedule">Schedule</option><option value="budget">Budget used</option><option value="owed">Customers owe</option><option value="name">Job name</option></select>
        <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={clearFilters} title="Reset filters" aria-label="Reset filters"><FilterX/></Button>
      </div>
    </div>
  </div>;

  const grid=<CarezDataGrid
    className="carez-projects-grid"
    toolbar={toolbar}
    isEmpty={filtered.length===0}
    empty={rows.length===0?<CarezExperienceEmpty icon={<BriefcaseBusiness/>} title="Your next job starts here." description="An eligible issued Proposal can be Awarded internally to create or link its Project on the same Job Spine. Customer acceptance alone does not create a Project." actions={<Link href="/proposals" className={buttonVariants({variant:'outline',size:'sm'})}><FileText/>View proposals<ArrowUpRight/></Link>}/>:<CarezExperienceEmpty icon={<Search/>} title="No jobs match this view" description="Try another state, search, or stage to find the work you need." actions={<Button type="button" variant="outline" size="sm" onClick={clearFilters}>Reset filters</Button>}/> }
  >
    <CarezDataGridTable>
      <CarezDataGridHead>
        <CarezDataGridRow>
          <CarezDataGridHeaderCell>Job / client</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>State</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>Next step</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>Next date</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>Field</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric className="min-w-40 text-right">Budget</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric className="text-right">Customers owe</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>Priority</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell className="w-20"><span className="sr-only">Actions</span></CarezDataGridHeaderCell>
        </CarezDataGridRow>
      </CarezDataGridHead>
      <CarezDataGridBody>{filtered.map(row=>{
        const state=resolveOperationalState(row.state);
        const priority=resolvePriority(priorityKindFor(row));
        const selectedRow=expandedRowId===row.id;
        return <Fragment key={row.id}><CarezDataGridRow
          selected={selectedRow}
          aria-expanded={selectedRow}
          className="carez-job-row cursor-pointer hover:bg-[#EFF2F0] dark:hover:bg-[#1E2123]"
          data-state={row.state}
          data-field-active={row.activeShifts>0||undefined}
          onClick={()=>toggleRow(row.id)}
          onDoubleClick={()=>router.push(`/projects/${row.id}`)}
          tabIndex={0}
          onKeyDown={event=>{
            if(event.currentTarget!==event.target)return;
            if(event.key===' '){event.preventDefault();toggleRow(row.id);return;}
            if(event.key==='Enter')router.push(`/projects/${row.id}`);
          }}
        >
          <CarezDataGridCell className="min-w-60">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">{row.jobNumber||'—'}</span>
              <div className="min-w-0"><div className="truncate text-xs font-bold">{row.name}</div><div className="truncate text-xs text-muted-foreground">{row.customer}</div><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin aria-hidden="true" className="size-3 shrink-0"/><span className="truncate">{row.location}</span></div></div>
            </div>
          </CarezDataGridCell>
          <CarezDataGridCell>{state?<CarezStatus tone={state.tone} label={state.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}</CarezDataGridCell>
          <CarezDataGridCell className="min-w-64"><div className="max-w-72 whitespace-normal font-semibold">{row.nextStep}</div>{row.reasons[0]&&row.attention&&row.reasons[0].trim()!==row.nextStep.trim()?<div className="mt-0.5 max-w-72 whitespace-normal text-xs text-muted-foreground">{row.reasons[0]}</div>:null}</CarezDataGridCell>
          <CarezDataGridCell numeric><div className="font-medium">{shortDate(row.scheduleDate)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.scheduleDate?'Next field date':'Not scheduled'}</div></CarezDataGridCell>
          <CarezDataGridCell><div className="inline-flex items-center gap-1 font-semibold"><HardHat aria-hidden="true" className="size-3.5 shrink-0"/><span>{row.activeShifts?`${row.activeShifts} active`:'—'}</span></div><div className="text-xs text-muted-foreground">{row.pendingTimecards?`${row.pendingTimecards} timecard review`:row.gpsExceptions?`${row.gpsExceptions} GPS review`:row.activeShifts?'In the field':'No active shift'}</div></CarezDataGridCell>
          <CarezDataGridCell numeric className="text-right">
            {row.budgetAvailable?<div className="min-w-36"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={cn('font-medium',row.budgetUsed>=100&&'text-destructive')}>{row.budgetUsed.toFixed(0)}%</span><span className={cn('text-muted-foreground',row.laborRemaining<0&&'text-destructive')}>{row.laborRemaining.toFixed(1)} MH left</span></div><Progress value={Math.max(0,Math.min(100,row.budgetUsed))}/></div>:<span className="text-xs font-sans text-muted-foreground">No authoritative budget snapshot</span>}
          </CarezDataGridCell>
          <CarezDataGridCell numeric className="text-right">
            {row.billingAvailable?<><div className={cn('font-medium',row.overdue>0&&'text-destructive')}>{money(row.customerOwed)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.overdue>0?`${money(row.overdue)} late`:'Outstanding A/R'}</div></>:<span className="font-sans text-xs text-muted-foreground">Billing summary unavailable</span>}
          </CarezDataGridCell>
          <CarezDataGridCell>{priority?<CarezStatus tone={priority.tone} label={priority.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}</CarezDataGridCell>
          <CarezDataGridCell className="whitespace-nowrap">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`${selectedRow?'Collapse':'Expand'} ${row.name}`} aria-expanded={selectedRow} className="mr-1 size-7" onClick={event=>{event.stopPropagation();toggleRow(row.id);}}><ChevronDown aria-hidden="true" className={cn('size-3.5 transition-transform duration-150',selectedRow&&'rotate-180')}/></Button>
            <span onClick={event=>event.stopPropagation()} className="inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}/> }><MoreHorizontal/></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={()=>router.push(`/projects/${row.id}`)}>Open job</DropdownMenuItem>
                <DropdownMenuItem onClick={()=>router.push('/schedule')}>Schedule</DropdownMenuItem>
                {row.state==='hold'?<DropdownMenuItem onClick={()=>router.push('/readiness')}>Clear hold</DropdownMenuItem>:null}
                {row.pendingTimecards>0?<DropdownMenuItem onClick={()=>router.push('/field/review')}>Review time</DropdownMenuItem>:null}
                {row.billingAvailable&&row.customerOwed>0?<><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>router.push('/billing')}>Billing</DropdownMenuItem></>:null}
              </DropdownMenuContent>
            </DropdownMenu>
            </span>
          </CarezDataGridCell>
        </CarezDataGridRow>{selectedRow?<tr><td colSpan={9} className="p-0"><InlineProjectWorkspace row={row}/></td></tr>:null}</Fragment>;
      })}</CarezDataGridBody>
    </CarezDataGridTable>
  </CarezDataGrid>;

  return <div className="carez-operations-board">
    <div aria-label="Job operations metrics" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <MetricBentoTile title="Current jobs" value={rows.filter(row=>row.state!=='completed').length} icon={<BriefcaseBusiness/>} description="Open jobs across the operation."/>
      <MetricBentoTile title="Ready to move" value={metrics.ready} icon={<CheckCheck/>} tone={metrics.ready>0?'success':'neutral'} description="Physical operations ready to start."/>
      <MetricBentoTile title="Hard holds" value={metrics.holds} icon={<ShieldAlert/>} tone={metrics.holds>0?'danger':'neutral'} description={`${metrics.attention} need attention`}/>
      <MetricBentoTile title="Field active" value={metrics.fieldJobs} icon={<HardHat/>} description={`${metrics.activeShifts} shifts`}/>
      <Link href="/billing" className="block min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <MetricBentoTile title="Customers owe" value={metrics.customersOwe} prefix="$" icon={<Wallet/>} tone={metrics.customersOwe>0?'warning':'neutral'} description={metrics.overdue?`${money(metrics.overdue)} overdue`:'No overdue customer balance.'}/>
      </Link>
    </div>
    {grid}
  </div>;
}

function InlineProjectWorkspace({row}:{row:JobsBoardRow}){
  const router=useRouter();
  const state=resolveOperationalState(row.state);
  const priority=resolvePriority(priorityKindFor(row));
  const budgetProgress=row.budgetAvailable?Math.max(0,Math.min(100,row.budgetUsed)):null;

  return <section aria-label={`${row.name} project workspace`} className="w-[calc(100vw-2rem)] border-y border-[#D4DBD7] bg-[#F5F7F6] p-6 text-[#171B19] shadow-inner dark:border-[#343A3F] dark:bg-[#121212] dark:text-[#F4F6F5] lg:w-auto">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D4DBD7] pb-4 dark:border-[#343A3F]">
      <div className="min-w-0">
        <div className="font-mono text-[10px] text-[#7B8580] dark:text-[#7C8580]">{row.jobNumber||'No job number'}</div>
        <h2 className="mt-1 text-lg font-bold">{row.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {state?<CarezStatus tone={state.tone} label={state.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}
          {priority?<CarezStatus tone={priority.tone} label={priority.label}/>:null}
          <span className="text-xs text-[#525C57] dark:text-[#B6BEBA]">{row.customer}</span>
        </div>
      </div>
      <PourWeatherBadge/>
    </div>

    <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#525C57] dark:text-[#B6BEBA]">Plans</h3>
        <TakeoffThumbnail/>
        <p className="text-xs text-[#525C57] dark:text-[#B6BEBA]">Next operation: {row.nextStep}</p>
      </div>

      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#525C57] dark:text-[#B6BEBA]">Financial pulse</h3>
        <div>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span>Budget consumed</span><span className="font-mono tabular-nums">{row.budgetAvailable?`${row.budgetUsed.toFixed(1)}%`:'Not available'}</span></div>
          <Progress aria-label="Budget consumed" value={budgetProgress}/>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span>Labor remaining</span><span className="font-mono tabular-nums">{row.budgetAvailable?`${row.laborRemaining.toFixed(1)} MH`:'Not available'}</span></div>
          <Progress aria-label="Labor remaining; percentage unavailable" value={null}/>
          <p className="mt-1 text-[10px] text-[#7B8580] dark:text-[#7C8580]">No percentage without a labor baseline.</p>
        </div>
        <dl className="divide-y divide-[#D4DBD7] border-t border-[#D4DBD7] text-xs dark:divide-[#343A3F] dark:border-[#343A3F]">
          <FinancialLine label="Contract amount" value={money(row.contractValue)}/>
          <FinancialLine label="Billed" value={row.billingAvailable?money(row.billedAmount):'Not available'}/>
          <FinancialLine label="Customer balance" value={row.billingAvailable?money(row.customerOwed):'Not available'} tone={row.overdue>0?'warning':undefined}/>
          {row.overdue>0?<FinancialLine label="Past due" value={money(row.overdue)} tone="warning"/>:null}
        </dl>
      </div>

      <div className="min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#525C57] dark:text-[#B6BEBA]">Cost codes <span className="font-normal normal-case tracking-normal">· sample layout</span></h3>
        <p className="mt-1 text-[10px] text-[#7B8580] dark:text-[#7C8580]">Illustrative quantities and variances; no cost-code records are loaded here.</p>
        <div className="max-h-64 overflow-y-auto">
          <CSICostCodeStrip/>
          <CSICostCodeStrip code="03 20 00" name="Reinforcing" completed={260} total={400} unit="LF" variance={-120}/>
          <CSICostCodeStrip code="03 10 00" name="Concrete Forming" completed={175} total={220} unit="SF" variance={180}/>
          <CSICostCodeStrip code="03 35 00" name="Concrete Finishing" completed={85} total={140} unit="SF" variance={-75}/>
        </div>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D4DBD7] pt-3 dark:border-[#343A3F]">
      <Link href={`/projects/${row.id}`} className={buttonVariants({size:'sm'})}>Open Project Workspace</Link>
      {row.state==='hold'?<Link href="/readiness" className={buttonVariants({variant:'outline',size:'sm'})}>Clear hold</Link>:null}
      {row.pendingTimecards>0?<Link href="/field/review" className={buttonVariants({variant:'outline',size:'sm'})}>Review time</Link>:null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm"/>}>More</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={()=>router.push('/schedule')}>Schedule</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/field')}>Field</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/billing')}>Billing</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/cashflow')}>Cashflow</DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onClick={()=>router.push('/takeoff')}>Takeoff</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>router.push('/estimates')}>Estimates</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </section>;
}

function FinancialLine({label,value,tone}:{label:string;value:string;tone?:'warning'}){
  return <div className="flex items-center justify-between gap-3 py-2"><dt className="text-[#525C57] dark:text-[#B6BEBA]">{label}</dt><dd className={cn('font-mono tabular-nums',tone==='warning'&&'text-[#8A610B] dark:text-[#D5A94A]')}>{value}</dd></div>;
}

