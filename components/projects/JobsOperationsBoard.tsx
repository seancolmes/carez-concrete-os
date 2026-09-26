'use client';

import Link from 'next/link';
import {useMemo,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {FilterX,MoreHorizontal,Search,SlidersHorizontal,CheckCheck,ShieldAlert,HardHat,Wallet,BriefcaseBusiness,ArrowUpRight,MapPin,Activity,FileText} from 'lucide-react';
import {
  CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,
  CarezDataGridHeaderCell,CarezDataGridRow,CarezDataGridTable,
  CarezInspector,CarezInspectorBody,CarezInspectorFooter,
  CarezInspectorHeader,CarezInspectorSection,CarezStatus,
} from '@/components/carez';
import {CarezSectionHeading,CarezOperationalPulse,CarezExperienceEmpty} from '@/components/carez/experience';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Input} from '@/components/ui/input';
import {Progress} from '@/components/ui/progress';
import {Sheet,SheetContent} from '@/components/ui/sheet';
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

const filterSelect='h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20';

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
  const navigate=(href:string)=>router.push(href);

  const toolbar=<div className="flex w-full flex-wrap items-center gap-2">
    <div className="relative min-w-56 flex-1 lg:max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
      <Input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search jobs, customers, locations" placeholder="Search jobs, customers, locations..." className="h-8 pl-8 text-xs"/>
    </div>
    <select className={filterSelect} value={stage} onChange={e=>setStage(e.target.value)} aria-label="Project stage"><option value="all">All stages</option>{stages.map(item=><option key={item} value={item}>{titleCase(item)}</option>)}</select>
    <select className={filterSelect} value={attention} onChange={e=>setAttention(e.target.value)} aria-label="Attention filter"><option value="all">All attention</option><option value="attention">Needs attention</option><option value="clear">Clear</option></select>
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"><SlidersHorizontal className="size-3.5"/>Sort</span>
      <select className={filterSelect} value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort jobs"><option value="priority">Priority</option><option value="schedule">Schedule</option><option value="budget">Budget used</option><option value="owed">Customers owe</option><option value="name">Job name</option></select>
      <Button variant="ghost" size="icon-sm" onClick={clearFilters} title="Reset filters" aria-label="Reset filters"><FilterX/></Button>
    </div>
  </div>;

  const grid=<CarezDataGrid
    toolbar={toolbar}
    status={<><div className="flex items-center gap-2"><span className="font-medium text-foreground">Jobs</span><Badge variant="secondary">{filtered.length}</Badge></div><span className="hidden sm:block">Select to preview · Enter to open project</span></>}
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
          <CarezDataGridHeaderCell numeric className="min-w-40">Budget</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell numeric>Customers owe</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell>Priority</CarezDataGridHeaderCell>
          <CarezDataGridHeaderCell className="w-10"><span className="sr-only">Actions</span></CarezDataGridHeaderCell>
        </CarezDataGridRow>
      </CarezDataGridHead>
      <CarezDataGridBody>{filtered.map(row=>{
        const state=resolveOperationalState(row.state);
        const priority=resolvePriority(priorityKindFor(row));
        const selectedRow=selectedId===row.id;
        return <CarezDataGridRow
          key={row.id}
          selected={selectedRow}
          className="carez-job-row cursor-pointer"
          data-state={row.state}
          data-field-active={row.activeShifts>0||undefined}
          onClick={()=>setSelectedId(row.id)}
          onDoubleClick={()=>router.push(`/projects/${row.id}`)}
          tabIndex={0}
          onKeyDown={event=>{
            if(event.currentTarget!==event.target)return;
            if(event.key===' '){event.preventDefault();setSelectedId(row.id);return;}
            if(event.key==='Enter')router.push(`/projects/${row.id}`);
          }}
        >
          <CarezDataGridCell className="min-w-60">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-accent px-1.5 py-1 font-mono text-[10px] font-semibold text-primary">{row.jobNumber||'—'}</span>
              <div className="min-w-0"><div className="truncate text-sm font-bold">{row.name}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{row.customer}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin aria-hidden="true" className="size-3 shrink-0"/><span className="truncate">{row.location}</span></div></div>
            </div>
          </CarezDataGridCell>
          <CarezDataGridCell>{state?<CarezStatus tone={state.tone} label={state.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}</CarezDataGridCell>
          <CarezDataGridCell className="min-w-64"><div className="max-w-72 whitespace-normal font-semibold">{row.nextStep}</div>{row.reasons[0]&&row.attention?<div className="mt-0.5 max-w-72 whitespace-normal text-xs text-muted-foreground">{row.reasons[0]}</div>:null}</CarezDataGridCell>
          <CarezDataGridCell numeric><div className="font-medium">{shortDate(row.scheduleDate)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.scheduleDate?'Next field date':'Not scheduled'}</div></CarezDataGridCell>
          <CarezDataGridCell><div className={cn('flex items-center gap-1.5 font-semibold',row.activeShifts>0&&'text-primary')}><HardHat aria-hidden="true" className="size-3.5"/>{row.activeShifts?`${row.activeShifts} active`:'—'}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.pendingTimecards?`${row.pendingTimecards} timecard review`:row.gpsExceptions?`${row.gpsExceptions} GPS review`:row.activeShifts?'In the field':'No active shift'}</div></CarezDataGridCell>
          <CarezDataGridCell numeric>
            {row.budgetAvailable?<div className="min-w-36"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={cn('font-medium',row.budgetUsed>=100&&'text-destructive')}>{row.budgetUsed.toFixed(0)}%</span><span className={cn('text-muted-foreground',row.laborRemaining<0&&'text-destructive')}>{row.laborRemaining.toFixed(1)} MH left</span></div><Progress value={Math.max(0,Math.min(100,row.budgetUsed))}/></div>:<span className="text-xs font-sans text-muted-foreground">No authoritative budget snapshot</span>}
          </CarezDataGridCell>
          <CarezDataGridCell numeric>
            {row.billingAvailable?<><div className={cn('font-medium',row.overdue>0&&'text-destructive')}>{money(row.customerOwed)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.overdue>0?`${money(row.overdue)} late`:'Outstanding A/R'}</div></>:<span className="font-sans text-xs text-muted-foreground">Billing summary unavailable</span>}
          </CarezDataGridCell>
          <CarezDataGridCell>{priority?<CarezStatus tone={priority.tone} label={priority.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}</CarezDataGridCell>
          <CarezDataGridCell onClick={event=>event.stopPropagation()}>
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
          </CarezDataGridCell>
        </CarezDataGridRow>;
      })}</CarezDataGridBody>
    </CarezDataGridTable>
  </CarezDataGrid>;

  return <div className="carez-operations-board space-y-5">
    <CarezOperationalPulse label="Job operations metrics" items={[
      {label:'Current jobs',value:rows.filter(row=>row.state!=='completed').length,detail:'Open jobs across the operation.',icon:<BriefcaseBusiness/>,tone:'primary'},
      {label:'Ready to move',value:metrics.ready,detail:'Physical operations ready to start.',icon:<CheckCheck/>,tone:'success'},
      {label:'Hard holds',value:metrics.holds,detail:metrics.attention+' jobs need attention.',icon:<ShieldAlert/>,tone:metrics.holds?'danger':'neutral'},
      {label:'Field active',value:metrics.fieldJobs,detail:`${metrics.activeShifts} active field shifts right now.`,icon:<HardHat/>,tone:'primary'},
      {label:'Customers owe',value:money(metrics.customersOwe),detail:metrics.overdue?`${money(metrics.overdue)} is past due.`:'No overdue customer balance.',icon:<Wallet/>,tone:metrics.overdue?'warning':'neutral',href:'/billing'},
    ]}/>
    <CarezSectionHeading icon={<Activity/>} title="Current work" description="Find the constraint. Line up the next operation." action={<span className="text-xs text-muted-foreground">{metrics.attention} need attention</span>}/>
    <Tabs value={status} onValueChange={value=>setStatus(String(value))}>
      <div className="carez-tab-viewport">
        <TabsList variant="experience" aria-label="Project operating state">
          <TabsTrigger value="active">Current work</TabsTrigger>
          <TabsTrigger value="ready"><CheckCheck/>Ready</TabsTrigger>
          <TabsTrigger value="hold"><ShieldAlert/>Hold</TabsTrigger>
          <TabsTrigger value="planning">In progress</TabsTrigger>
          <TabsTrigger value="setup">Waiting</TabsTrigger>
          <TabsTrigger value="completed">Complete</TabsTrigger>
          <TabsTrigger value="all">All jobs</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value={status} className="min-w-0">{grid}</TabsContent>
    </Tabs>
    <Sheet open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelectedId(null)}}>
      {selected?<SheetContent aria-label={'Job preview: '+selected.name} className="w-[94vw] overflow-hidden p-0 sm:max-w-lg"><JobInspector row={selected} onNavigate={navigate} sheet/></SheetContent>:null}
    </Sheet>
  </div>;
}

function JobInspector({row,onNavigate,sheet=false}:{row:JobsBoardRow;onNavigate:(href:string)=>void;sheet?:boolean}){
  const state=resolveOperationalState(row.state);
  const priority=resolvePriority(priorityKindFor(row));
  const contextualAction=row.state==='hold'
    ?{label:'Clear hold',href:'/readiness'}
    :row.pendingTimecards>0
      ?{label:'Review time',href:'/field/review'}
      :null;

  return <CarezInspector className={cn('h-full',sheet&&'rounded-none border-0')}>
    <CarezInspectorHeader
      title={row.name}
      description={(row.jobNumber||'No job number')+' · '+row.customer}
      status={<div className="flex flex-wrap gap-2">
        {state?<CarezStatus tone={state.tone} label={state.label}/>:<CarezStatus tone="neutral" label="Unknown"/>}
        {priority?<CarezStatus tone={priority.tone} label={priority.label}/>:null}
      </div>}
    />
    <CarezInspectorBody>
      <CarezInspectorSection title="Next operation">
        <div className="text-sm font-medium">{row.nextStep}</div>
        <div className="mt-1 text-xs text-muted-foreground">{row.scheduleDate?shortDate(row.scheduleDate):'Not scheduled'}</div>
      </CarezInspectorSection>

      {row.reasons.length?<CarezInspectorSection title="Current constraints">
        <div className="space-y-2">{row.reasons.map((reason,index)=><p key={index} className="text-xs leading-5 text-muted-foreground">{reason}</p>)}</div>
      </CarezInspectorSection>:null}

      <CarezInspectorSection title="Readiness">
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <InspectorMetric label="Ready ops" value={row.readyOperations}/>
          <InspectorMetric label="On hold" value={row.blockedOperations}/>
          <InspectorMetric label="Open ops" value={row.openOperations}/>
          <InspectorMetric label="Timecards" value={row.pendingTimecards}/>
        </dl>
      </CarezInspectorSection>

      <CarezInspectorSection title="Field">
        <dl className="divide-y divide-border">
          <InspectorRow label="Active shifts">{String(row.activeShifts)}</InspectorRow>
          <InspectorRow label="GPS exceptions">{String(row.gpsExceptions)}</InspectorRow>
          <InspectorRow label="Time review">{String(row.pendingTimecards)}</InspectorRow>
        </dl>
      </CarezInspectorSection>

      <CarezInspectorSection title="Financial position">
        <dl className="divide-y divide-border">
          <InspectorRow label="Contract amount">{money(row.contractValue)}</InspectorRow>
          <InspectorRow label="Budget used">{row.budgetAvailable?row.budgetUsed.toFixed(1)+'%':'Not available'}</InspectorRow>
          <InspectorRow label="Labor remaining">{row.budgetAvailable?row.laborRemaining.toFixed(1)+' MH':'Not available'}</InspectorRow>
          <InspectorRow label="Customer balance">{row.billingAvailable?money(row.customerOwed):'Not available'}</InspectorRow>
          <InspectorRow label="Past due">{row.billingAvailable?money(row.overdue):'Not available'}</InspectorRow>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Approved change orders, committed cost and actual cost are not exposed by the current Jobs summary query, and are not available in this summary.</p>
      </CarezInspectorSection>
    </CarezInspectorBody>

    <CarezInspectorFooter>
      <Link href={`/projects/${row.id}`} className={buttonVariants({size:'sm'})}>Open Project</Link>
      {contextualAction?<Link href={contextualAction.href} className={buttonVariants({variant:'outline',size:'sm'})}>{contextualAction.label}</Link>:null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm"/>}>More</DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={()=>onNavigate('/schedule')}>Schedule</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>onNavigate('/field')}>Field</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>onNavigate('/billing')}>Billing</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>onNavigate('/cashflow')}>Cashflow</DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onClick={()=>onNavigate('/takeoff')}>Takeoff</DropdownMenuItem>
          <DropdownMenuItem onClick={()=>onNavigate('/estimates')}>Estimates</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </CarezInspectorFooter>
  </CarezInspector>;
}

function InspectorMetric({label,value}:{label:string;value:number}){
  return <div className="rounded-md border border-border bg-muted/15 p-2.5"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</dd></div>;
}

function InspectorRow({label,children}:{label:string;children:ReactNode}){
  return <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="min-w-0 text-right text-xs font-medium">{children}</dd></div>;
}

