'use client';

import Link from 'next/link';
import {Fragment,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import { ChevronDownRegular as ChevronDown, FilterDismissRegular as FilterX, MoreHorizontalRegular as MoreHorizontal, SearchRegular as Search, OptionsRegular as SlidersHorizontal, CheckmarkCircleRegular as CheckCheck, ShieldErrorRegular as ShieldAlert, PersonWrenchRegular as HardHat, WalletRegular as Wallet, BriefcaseRegular as BriefcaseBusiness, ArrowUpRightRegular as ArrowUpRight, LocationRegular as MapPin, DocumentTextRegular as FileText } from '@fluentui/react-icons';
import {Badge,Button,Dropdown,Input,Menu,MenuDivider,MenuItem,MenuList,MenuPopover,MenuTrigger,Option,ProgressBar,Tab,TabList,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {MetricBentoTile} from './MetricBentoTile';
import {PourWeatherBadge} from '@/components/weather/PourWeatherBadge';
import {TakeoffThumbnail} from '@/components/takeoff/TakeoffThumbnail';
import {resolveOperationalState,resolvePriority} from '@/lib/ui/operations';
import {cn} from '@/lib/utils';
import styles from './jobs-operations-board.module.css';

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
  budgetCost:number;
  actualCost:number;
  budgetLaborHours:number;
  actualLaborHours:number;
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

  const toolbar=<div className={styles.toolbar}>
    <Input value={query} onChange={e=>setQuery(e.target.value)} contentBefore={<Search className="size-3.5"/>} appearance="underline" size="small" aria-label="Search jobs, customers, locations" placeholder="Search jobs, customers, locations..." className="h-8 w-full text-xs"/>
    <TabList selectedValue={status} onTabSelect={(_,data)=>setStatus(String(data.value))} size="small" aria-label="Project operating state" className={styles.statusTabs}>
      {([['active','Current work'],['ready','Ready'],['hold','Hold'],['planning','In progress'],['setup','Waiting'],['completed','Complete'],['all','All jobs']] as const).map(([value,label])=><Tab key={value} value={value} icon={value==='ready'?<CheckCheck className="size-3"/>:value==='hold'?<ShieldAlert className="size-3"/>:undefined} className={styles.statusTab}>{label}</Tab>)}
    </TabList>
    <div className={styles.filterControls}>
      <Dropdown size="small" className="min-w-28" selectedOptions={[stage]} value={stage==='all'?'All stages':titleCase(stage)} onOptionSelect={(_,data)=>setStage(data.optionValue||'all')} aria-label="Project stage"><Option value="all" text="All stages">All stages</Option>{stages.map(item=><Option key={item} value={item} text={titleCase(item)}>{titleCase(item)}</Option>)}</Dropdown>
      <Dropdown size="small" className="min-w-28" selectedOptions={[attention]} value={{all:'All attention',attention:'Needs attention',clear:'Clear'}[attention]} onOptionSelect={(_,data)=>setAttention(data.optionValue||'all')} aria-label="Attention filter"><Option value="all" text="All attention">All attention</Option><Option value="attention" text="Needs attention">Needs attention</Option><Option value="clear" text="Clear">Clear</Option></Dropdown>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5"/>Sort</span>
      <Dropdown size="small" className="min-w-28" selectedOptions={[sort]} value={{priority:'Priority',schedule:'Schedule',budget:'Budget used',owed:'Customers owe',name:'Job name'}[sort]} onOptionSelect={(_,data)=>setSort(data.optionValue||'priority')} aria-label="Sort jobs"><Option value="priority" text="Priority">Priority</Option><Option value="schedule" text="Schedule">Schedule</Option><Option value="budget" text="Budget used">Budget used</Option><Option value="owed" text="Customers owe">Customers owe</Option><Option value="name" text="Job name">Job name</Option></Dropdown>
      <Button appearance="subtle" size="small" icon={<FilterX/>} onClick={clearFilters} title="Reset filters" aria-label="Reset filters"/>
    </div>
  </div>;

  const grid=<div className="carez-projects-grid min-w-0 overflow-hidden border-y border-border bg-card">
    <div className="border-b border-border px-3 py-2">{toolbar}</div>
    <div className="min-w-0 overflow-auto">
    {filtered.length===0?<div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      {rows.length===0?<BriefcaseBusiness className="size-6 text-muted-foreground"/>:<Search className="size-6 text-muted-foreground"/>}
      <h3 className="text-sm font-semibold">{rows.length===0?'Your next job starts here.':'No jobs match this view'}</h3>
      <p className="max-w-xl text-xs text-muted-foreground">{rows.length===0?'An eligible issued Proposal can be Awarded internally to create or link its Project on the same Job Spine. Customer acceptance alone does not create a Project.':'Try another state, search, or stage to find the work you need.'}</p>
      {rows.length===0?<Button as="a" href="/proposals" appearance="outline" size="small" icon={<FileText/>}>View proposals <ArrowUpRight/></Button>:<Button type="button" appearance="outline" size="small" onClick={clearFilters}>Reset filters</Button>}
    </div>:<Table size="small" className="min-w-[1120px] text-xs">
      <TableHeader>
        <TableRow>
          <TableHeaderCell>Job / client</TableHeaderCell>
          <TableHeaderCell>State</TableHeaderCell>
          <TableHeaderCell>Next step</TableHeaderCell>
          <TableHeaderCell>Next date</TableHeaderCell>
          <TableHeaderCell>Field</TableHeaderCell>
          <TableHeaderCell className="min-w-40 text-right">Budget</TableHeaderCell>
          <TableHeaderCell className="text-right">Customers owe</TableHeaderCell>
          <TableHeaderCell>Priority</TableHeaderCell>
          <TableHeaderCell className="w-20"><span className="sr-only">Actions</span></TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>{filtered.map(row=>{
        const state=resolveOperationalState(row.state);
        const priority=resolvePriority(priorityKindFor(row));
        const selectedRow=expandedRowId===row.id;
        return <Fragment key={row.id}><TableRow
          aria-selected={selectedRow}
          aria-expanded={selectedRow}
          className="carez-job-row cursor-pointer"
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
          <TableCell className="min-w-60">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">{row.jobNumber||'—'}</span>
              <div className="min-w-0"><div className="truncate text-xs font-bold">{row.name}</div><div className="truncate text-xs text-muted-foreground">{row.customer}</div><div className="flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin aria-hidden="true" className="size-3 shrink-0"/><span className="truncate">{row.location}</span></div></div>
            </div>
          </TableCell>
          <TableCell><Badge appearance="outline" color={state?.tone==='error'?'danger':state?.tone==='warning'?'warning':state?.tone==='success'?'success':'informative'}>{state?.label||'Unknown'}</Badge></TableCell>
          <TableCell className="min-w-64"><div className="max-w-72 whitespace-normal font-semibold">{row.nextStep}</div>{row.reasons[0]&&row.attention&&row.reasons[0].trim()!==row.nextStep.trim()?<div className="mt-0.5 max-w-72 whitespace-normal text-xs text-muted-foreground">{row.reasons[0]}</div>:null}</TableCell>
          <TableCell><div className="font-medium">{shortDate(row.scheduleDate)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.scheduleDate?'Next field date':'Not scheduled'}</div></TableCell>
          <TableCell><div className="inline-flex items-center gap-1 font-semibold"><HardHat aria-hidden="true" className="size-3.5 shrink-0"/><span>{row.activeShifts?`${row.activeShifts} active`:'—'}</span></div><div className="text-xs text-muted-foreground">{row.pendingTimecards?`${row.pendingTimecards} timecard review`:row.gpsExceptions?`${row.gpsExceptions} GPS review`:row.activeShifts?'In the field':'No active shift'}</div></TableCell>
          <TableCell className="text-right">
            {row.budgetAvailable?<div className="min-w-36"><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className={cn('font-medium',row.budgetUsed>=100&&'text-destructive')}>{row.budgetUsed.toFixed(0)}%</span><span className={cn('text-muted-foreground',row.laborRemaining<0&&'text-destructive')}>{row.laborRemaining.toFixed(1)} MH left</span></div><ProgressBar value={Math.max(0,Math.min(100,row.budgetUsed))/100} color={row.budgetUsed>=100?'error':'brand'} aria-label={`Budget ${row.budgetUsed.toFixed(0)} percent used`}/></div>:<span className="text-xs font-sans text-muted-foreground">No authoritative budget snapshot</span>}
          </TableCell>
          <TableCell className="text-right">
            {row.billingAvailable?<><div className={cn('font-medium',row.overdue>0&&'text-destructive')}>{money(row.customerOwed)}</div><div className="mt-0.5 font-sans text-xs text-muted-foreground">{row.overdue>0?`${money(row.overdue)} late`:'Outstanding A/R'}</div></>:<span className="font-sans text-xs text-muted-foreground">Billing summary unavailable</span>}
          </TableCell>
          <TableCell><Badge appearance="outline" color={priority?.tone==='error'?'danger':priority?.tone==='warning'?'warning':priority?.tone==='success'?'success':'informative'}>{priority?.label||'Unknown'}</Badge></TableCell>
          <TableCell className="whitespace-nowrap">
            <Button type="button" appearance="subtle" size="small" aria-label={`${selectedRow?'Collapse':'Expand'} ${row.name}`} aria-expanded={selectedRow} className="mr-1 size-7" icon={<ChevronDown aria-hidden="true" className={cn('size-3.5 transition-transform duration-150',selectedRow&&'rotate-180')}/>} onClick={event=>{event.stopPropagation();toggleRow(row.id);}}/>
            <span onClick={event=>event.stopPropagation()} className="inline-flex">
            <Menu>
              <MenuTrigger disableButtonEnhancement><Button appearance="subtle" size="small" icon={<MoreHorizontal/>} aria-label={`Actions for ${row.name}`}/></MenuTrigger>
              <MenuPopover><MenuList>
                <MenuItem onClick={()=>router.push(`/projects/${row.id}`)}>Open job</MenuItem>
                <MenuItem onClick={()=>router.push('/schedule')}>Schedule</MenuItem>
                {row.state==='hold'?<MenuItem onClick={()=>router.push('/readiness')}>Clear hold</MenuItem>:null}
                {row.pendingTimecards>0?<MenuItem onClick={()=>router.push('/field/review')}>Review time</MenuItem>:null}
                {row.billingAvailable&&row.customerOwed>0?<><MenuDivider/><MenuItem onClick={()=>router.push('/billing')}>Billing</MenuItem></>:null}
              </MenuList></MenuPopover>
            </Menu>
            </span>
          </TableCell>
        </TableRow>{selectedRow?<tr><td colSpan={9} className="p-0"><InlineProjectWorkspace row={row}/></td></tr>:null}</Fragment>;
      })}</TableBody>
    </Table>}
    </div>
  </div>;

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
  const budgetProgress=row.budgetAvailable&&row.budgetCost>0?Math.max(0,Math.min(100,row.actualCost/row.budgetCost*100)):null;
  const laborProgress=row.budgetAvailable&&row.budgetLaborHours>0?Math.max(0,Math.min(100,row.actualLaborHours/row.budgetLaborHours*100)):null;
  const costOverBudget=budgetProgress!==null&&row.actualCost>row.budgetCost;
  const laborOverBudget=laborProgress!==null&&row.actualLaborHours>row.budgetLaborHours;
  const hours=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
  const currency=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);

  return <section aria-label={`${row.name} project workspace`} className="w-[calc(100vw-2rem)] border-y border-border bg-card p-6 text-foreground shadow-inner lg:w-auto">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <div className="font-mono text-[10px] text-muted-foreground">{row.jobNumber||'No job number'}</div>
        <h2 className="mt-1 text-lg font-bold">{row.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge appearance="outline" color={state?.tone==='error'?'danger':state?.tone==='warning'?'warning':state?.tone==='success'?'success':'informative'}>{state?.label||'Unknown'}</Badge>
          {priority?<Badge appearance="outline" color={priority.tone==='error'?'danger':priority.tone==='warning'?'warning':priority.tone==='success'?'success':'informative'}>{priority.label}</Badge>:null}
          <span className="text-xs text-muted-foreground">{row.customer}</span>
        </div>
      </div>
      <PourWeatherBadge/>
    </div>

    <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plans</h3>
        <TakeoffThumbnail/>
        <p className="text-xs text-muted-foreground">Next operation: {row.nextStep}</p>
      </div>

      <div className="min-w-0 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financial pulse</h3>
        <div>
          <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>Budget consumed</span><span className="font-mono tabular-nums">{budgetProgress!==null?`${currency(row.actualCost)} / ${currency(row.budgetCost)}`:'Not available'}</span></div>
          <ProgressBar aria-label="Budget consumed" value={budgetProgress===null?undefined:budgetProgress/100} color={costOverBudget?'error':'brand'}/>
        </div>
        <div>
          <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>Labor consumed</span><span className="font-mono tabular-nums">{laborProgress!==null?`${hours(row.actualLaborHours)} / ${hours(row.budgetLaborHours)} hrs`:'Not available'}</span></div>
          <ProgressBar aria-label="Labor consumed" value={laborProgress===null?undefined:laborProgress/100} color={laborOverBudget?'error':'brand'}/>
          {laborProgress===null?<p className="mt-1 text-[10px] text-muted-foreground">No percentage without a labor baseline.</p>:null}
        </div>
        <dl className="divide-y divide-border border-t border-border text-xs">
          <FinancialLine label="Contract amount" value={money(row.contractValue)}/>
          <FinancialLine label="Billed" value={row.billingAvailable?money(row.billedAmount):'Not available'}/>
          <FinancialLine label="Customer balance" value={row.billingAvailable?money(row.customerOwed):'Not available'} tone={row.overdue>0?'warning':undefined}/>
          {row.overdue>0?<FinancialLine label="Past due" value={money(row.overdue)} tone="warning"/>:null}
        </dl>
      </div>

    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <Button as="a" href={`/projects/${row.id}`} appearance="primary" size="small">Open Project Workspace</Button>
      {row.state==='hold'?<Button as="a" href="/readiness" appearance="outline" size="small">Clear hold</Button>:null}
      {row.pendingTimecards>0?<Button as="a" href="/field/review" appearance="outline" size="small">Review time</Button>:null}
      <Menu>
        <MenuTrigger disableButtonEnhancement><Button appearance="subtle" size="small">More</Button></MenuTrigger>
        <MenuPopover><MenuList>
          <MenuItem onClick={()=>router.push('/schedule')}>Schedule</MenuItem>
          <MenuItem onClick={()=>router.push('/field')}>Field</MenuItem>
          <MenuItem onClick={()=>router.push('/billing')}>Billing</MenuItem>
          <MenuItem onClick={()=>router.push('/cashflow')}>Cashflow</MenuItem>
          <MenuDivider/>
          <MenuItem onClick={()=>router.push('/takeoff')}>Takeoff</MenuItem>
          <MenuItem onClick={()=>router.push('/estimates')}>Estimates</MenuItem>
        </MenuList></MenuPopover>
      </Menu>
    </div>
  </section>;
}

function FinancialLine({label,value,tone}:{label:string;value:string;tone?:'warning'}){
  return <div className="flex items-center justify-between gap-3 py-2"><dt className="text-muted-foreground">{label}</dt><dd className={cn('font-mono tabular-nums',tone==='warning'&&'text-warning')}>{value}</dd></div>;
}

