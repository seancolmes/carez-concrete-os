'use client';

import {
  useEffect,useMemo,useRef,useState,useTransition,
  type KeyboardEvent as ReactKeyboardEvent,type PointerEvent as ReactPointerEvent,
} from 'react';
import {useRouter} from 'next/navigation';
import { ArrowDownRegular as ArrowDown, ArrowUpRegular as ArrowUp, CalendarCancelRegular as CalendarOff, ChevronDownRegular as ChevronDown, MoreHorizontalRegular as MoreHorizontal, RowTripleRegular as Rows3, SearchRegular as Search, PeopleRegular as Users } from '@fluentui/react-icons';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Badge,Button,Checkbox,Dropdown,Input,Menu,MenuDivider,MenuItem,MenuList,MenuPopover,MenuTrigger,Option,Tab,TabList,Table,TableBody,TableCell,TableHeader,TableHeaderCell,TableRow} from '@fluentui/react-components';
import {deleteScheduleItem,updateScheduleStatus} from '@/app/schedule/actions';
import {cn} from '@/lib/utils';
import {ScheduleMatrix} from './ScheduleMatrix';

export type ScheduleGridDay={date:string;label:string;shortLabel:string;isToday:boolean};
export type ScheduleCrewMember={id:string;name:string;role:string};
export type AssignedCrew={id:string;name:string};

export type ScheduleGridItem={
  id:string;
  projectId:string;
  scheduleDate:string;
  startTime:string|null;
  endTime:string|null;
  itemType:string;
  title:string;
  jobNumber:string;
  projectName:string;
  packageName:string|null;
  packageLocation:string|null;
  plannedQuantity:number|null;
  unit:string|null;
  employeeTask:string|null;
  pourName:string|null;
  pourPlanId:string|null;
  pourYards:number|null;
  pumpAssetIds:string[];
  unidentifiedPumps:number;
  status:string;
  operationStatus:string|null;
  inspectionId:string|null;
  blocked:boolean;
  readyToStart:boolean|null;
  readinessAction:string|null;
  warningReasons:string[];
  blockingResourceCount:number;
  crewNeeded:number;
  assignedCrew:AssignedCrew[];
  crewShort:number;
  notes:string|null;
  openHref:string;
};

type ViewMode='work'|'crew';
type ReadinessFilter='all'|'blocked'|'at_risk'|'ready'|'crew_short';
type SortKey='date'|'job'|'work'|'type'|'readiness'|'status';
type SortDirection='asc'|'desc';
type ColumnKey='date'|'job'|'work'|'type'|'package'|'readiness'|'crew'|'status'|'notes'|'actions';

const SELECT_WIDTH=36;
const initialWidths:Record<ColumnKey,number>={
  date:138,job:176,work:220,type:104,package:190,readiness:230,crew:190,status:112,notes:220,actions:54,
};

const time=(value:string|null)=>{
  if(!value)return '—';
  const [hours,minutes]=value.split(':').map(Number);
  const date=new Date();date.setHours(hours,minutes||0,0,0);
  return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(date);
};
const quantity=(value:number|null)=>value===null?'—':Number(value).toLocaleString('en-US',{maximumFractionDigits:2});
const titleCase=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,character=>character.toUpperCase());

function interactiveTarget(target:EventTarget|null){
  const element=target as HTMLElement|null;
  return Boolean(element?.closest('a,button,input,select,textarea,[role="menuitem"],[data-slot="checkbox"]'));
}

function readinessBucket(item:ScheduleGridItem):'blocked'|'at_risk'|'ready'|'planned'{
  if(item.blocked)return 'blocked';
  if(item.warningReasons.length>0||item.crewShort>0)return 'at_risk';
  if(item.readyToStart===true)return 'ready';
  return 'planned';
}

function readinessLabel(item:ScheduleGridItem){
  const state=readinessBucket(item);
  if(state==='blocked')return 'Blocked';
  if(state==='at_risk')return 'At risk';
  if(state==='ready')return 'Ready';
  return 'Planned';
}

function statusLabel(item:ScheduleGridItem){
  if(item.status==='in_progress')return 'In progress';
  if(item.status==='confirmed')return 'Confirmed';
  if(item.status==='completed')return 'Completed';
  if(item.status==='cancelled')return 'Cancelled';
  return titleCase(item.status||'planned');
}

function statusRank(item:ScheduleGridItem){
  const state=readinessBucket(item);
  if(state==='blocked')return 0;
  if(state==='at_risk')return 1;
  if(state==='ready')return 2;
  return 3;
}

function ReadinessBadge({item}:{item:ScheduleGridItem}){
  const state=readinessBucket(item);
  return <Badge appearance="outline" color={state==='blocked'?'danger':'informative'} className={cn(
    'h-5 rounded-none px-1.5 font-mono text-[10px] uppercase tracking-[.04em]',
    state==='ready'&&'border-success/30 bg-success/10 text-success',
    state==='at_risk'&&'border-warning/30 bg-warning/10 text-warning',
    state==='planned'&&'text-muted-foreground',
  )}>{readinessLabel(item)}</Badge>;
}
function WorkStatusBadge({item}:{item:ScheduleGridItem}){
  const completed=item.status==='completed';
  const active=['confirmed','in_progress'].includes(item.status);
  return <Badge appearance="outline" className={cn(
    'h-5 rounded-none px-1.5 font-mono text-[10px]',
    completed&&'border-success/25 bg-success/8 text-success',
    active&&'bg-muted text-foreground',
    !completed&&!active&&'text-muted-foreground',
  )}>{statusLabel(item)}</Badge>;
}

function CellStack({primary,secondary,className}:{primary:React.ReactNode;secondary?:React.ReactNode;className?:string}){
  return <div className={cn('min-w-0 leading-tight',className)}><div className="truncate text-xs font-medium text-foreground">{primary}</div>{secondary?<div className="mt-0.5 truncate text-[11px] text-muted-foreground">{secondary}</div>:null}</div>;
}

function ScheduleRegister({days,items,crewMembers}:{days:ScheduleGridDay[];items:ScheduleGridItem[];crewMembers:ScheduleCrewMember[]}){
  const router=useRouter();
  const shellRef=useRef<HTMLDivElement|null>(null);
  const [view,setView]=useState<ViewMode>('work');
  const [query,setQuery]=useState('');
  const [readiness,setReadiness]=useState<ReadinessFilter>('all');
  const [itemType,setItemType]=useState('all');
  const [rangePreset,setRangePreset]=useState<'all'|'today'|'7'|'custom'>('all');
  const [rangeStart,setRangeStart]=useState<string|null>(null);
  const [rangeEnd,setRangeEnd]=useState<string|null>(null);
  const [sortKey,setSortKey]=useState<SortKey>('date');
  const [sortDirection,setSortDirection]=useState<SortDirection>('asc');
  const [activeIndex,setActiveIndex]=useState(0);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set());
  const [widths,setWidths]=useState<Record<ColumnKey,number>>(initialWidths);
  const [pendingId,setPendingId]=useState<string|null>(null);
  const [,startTransition]=useTransition();

  const types=useMemo(()=>Array.from(new Set(items.map(item=>item.itemType))).sort(),[items]);
  const todayDate=days.find(day=>day.isToday)?.date||days[0]?.date||null;

  const filteredItems=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return items.filter(item=>{
      if(readiness==='blocked'&&!item.blocked)return false;
      if(readiness==='at_risk'&&readinessBucket(item)!=='at_risk')return false;
      if(readiness==='ready'&&readinessBucket(item)!=='ready')return false;
      if(readiness==='crew_short'&&item.crewShort<=0)return false;
      if(itemType!=='all'&&item.itemType!==itemType)return false;
      if(rangeStart&&item.scheduleDate<rangeStart)return false;
      if(rangeEnd&&item.scheduleDate>rangeEnd)return false;
      if(!normalized)return true;
      return [item.jobNumber,item.projectName,item.title,item.packageName,item.packageLocation,item.employeeTask,item.notes,...item.assignedCrew.map(crew=>crew.name)]
        .some(value=>String(value||'').toLowerCase().includes(normalized));
    });
  },[items,query,readiness,itemType,rangeStart,rangeEnd]);

  const displayItems=useMemo(()=>[...filteredItems].sort((a,b)=>{
    let comparison=0;
    if(sortKey==='date')comparison=`${a.scheduleDate} ${a.startTime||''}`.localeCompare(`${b.scheduleDate} ${b.startTime||''}`);
    if(sortKey==='job')comparison=`${a.jobNumber} ${a.projectName}`.localeCompare(`${b.jobNumber} ${b.projectName}`);
    if(sortKey==='work')comparison=a.title.localeCompare(b.title);
    if(sortKey==='type')comparison=a.itemType.localeCompare(b.itemType);
    if(sortKey==='readiness')comparison=statusRank(a)-statusRank(b);
    if(sortKey==='status')comparison=statusLabel(a).localeCompare(statusLabel(b));
    return sortDirection==='asc'?comparison:-comparison;
  }),[filteredItems,sortKey,sortDirection]);

  useEffect(()=>{
    setActiveIndex(index=>Math.max(0,Math.min(index,Math.max(displayItems.length-1,0))));
  },[displayItems.length]);

  useEffect(()=>{
    if(view!=='work')return;
    shellRef.current?.querySelector<HTMLTableRowElement>(`tr[data-grid-index="${activeIndex}"]`)?.scrollIntoView({block:'nearest'});
  },[activeIndex,view]);

  const visibleDays=useMemo(()=>days.filter(day=>(!rangeStart||day.date>=rangeStart)&&(!rangeEnd||day.date<=rangeEnd)),[days,rangeStart,rangeEnd]);

  function toggleRow(id:string){
    setSelectedIds(current=>{
      const next=new Set(current);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(){
    setSelectedIds(current=>{
      const next=new Set(current);
      const allVisibleSelected=displayItems.length>0&&displayItems.every(item=>next.has(item.id));
      for(const item of displayItems){if(allVisibleSelected)next.delete(item.id);else next.add(item.id);}
      return next;
    });
  }

  function handleKeyDown(event:ReactKeyboardEvent<HTMLDivElement>){
    if(view!=='work'||interactiveTarget(event.target))return;
    if(event.key==='ArrowDown'){event.preventDefault();setActiveIndex(index=>Math.min(index+1,Math.max(displayItems.length-1,0)));return;}
    if(event.key==='ArrowUp'){event.preventDefault();setActiveIndex(index=>Math.max(index-1,0));return;}
    if(event.key==='Home'){event.preventDefault();setActiveIndex(0);return;}
    if(event.key==='End'){event.preventDefault();setActiveIndex(Math.max(displayItems.length-1,0));return;}
    const activeItem=displayItems[activeIndex];
    if(!activeItem)return;
    if(event.key===' '){event.preventDefault();toggleRow(activeItem.id);return;}
    if(event.key==='Enter'){event.preventDefault();router.push(activeItem.openHref);return;}
    if(event.key==='Escape'){setSelectedIds(new Set());return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();toggleAllVisible();}
  }

  function chooseDate(date:string,extend:boolean){
    if(extend&&rangeStart){
      const start=date<rangeStart?date:rangeStart;
      const end=date<rangeStart?rangeStart:date;
      setRangeStart(start);setRangeEnd(end);setRangePreset('custom');return;
    }
    setRangeStart(date);setRangeEnd(date);setRangePreset('custom');
  }

  function applyRangePreset(value:string){
    if(value==='all'){setRangePreset('all');setRangeStart(null);setRangeEnd(null);return;}
    if(value==='today'&&todayDate){setRangePreset('today');setRangeStart(todayDate);setRangeEnd(todayDate);return;}
    if(value==='7'&&days.length){setRangePreset('7');setRangeStart(days[0].date);setRangeEnd(days[Math.min(6,days.length-1)].date);return;}
    setRangePreset('custom');
  }

  function resetFilters(){
    setQuery('');setReadiness('all');setItemType('all');setRangePreset('all');setRangeStart(null);setRangeEnd(null);
  }

  function updateSort(key:SortKey){
    if(sortKey===key){setSortDirection(direction=>direction==='asc'?'desc':'asc');return;}
    setSortKey(key);setSortDirection('asc');
  }
  function resizeColumn(event:ReactPointerEvent<HTMLSpanElement>,key:ColumnKey,min:number,max:number){
    event.preventDefault();event.stopPropagation();
    const startX=event.clientX;
    const startWidth=widths[key];
    const onMove=(move:PointerEvent)=>setWidths(current=>({...current,[key]:Math.max(min,Math.min(max,startWidth+(move.clientX-startX)))}));
    const onUp=()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);};
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);
  }

  function keyboardResize(key:ColumnKey,delta:number,min:number,max:number){
    setWidths(current=>({...current,[key]:Math.max(min,Math.min(max,current[key]+delta))}));
  }

  function runStatusAction(item:ScheduleGridItem,nextStatus:string){
    setPendingId(item.id);
    startTransition(async()=>{
      try{
        const data=new FormData();data.set('id',item.id);data.set('status',nextStatus);
        await updateScheduleStatus(data);router.refresh();
      }finally{setPendingId(null);}
    });
  }

  function runDelete(item:ScheduleGridItem){
    if(!window.confirm(`Remove ${item.title} from the schedule?`))return;
    setPendingId(item.id);
    startTransition(async()=>{
      try{
        const data=new FormData();data.set('id',item.id);
        await deleteScheduleItem(data);router.refresh();
      }finally{setPendingId(null);}
    });
  }

  const allVisibleSelected=displayItems.length>0&&displayItems.every(item=>selectedIds.has(item.id));
  const partiallySelected=displayItems.some(item=>selectedIds.has(item.id))&&!allVisibleSelected;
  const blockedVisible=displayItems.filter(item=>item.blocked).length;
  const crewDemandVisible=displayItems.reduce((sum,item)=>sum+item.crewNeeded,0);
  const crewShortVisible=displayItems.reduce((sum,item)=>sum+item.crewShort,0);

  const matrixRows=useMemo(()=>[
    ...crewMembers.map(member=>({id:member.id,name:member.name,role:member.role,type:'crew' as const})),
    {id:'__unassigned',name:'Unassigned / crew short',role:'Exception',type:'unassigned' as const},
    {id:'__resources',name:'Pours / inspections / resources',role:'Coordination',type:'resources' as const},
  ],[crewMembers]);

  function matrixItems(row:typeof matrixRows[number],date:string){
    return displayItems.filter(item=>{
      if(item.scheduleDate!==date)return false;
      if(row.type==='crew')return item.assignedCrew.some(crew=>crew.id===row.id);
      if(row.type==='unassigned')return item.itemType==='work'&&(item.assignedCrew.length===0||item.crewShort>0);
      return item.itemType!=='work';
    });
  }

  const totalWidth=SELECT_WIDTH+Object.values(widths).reduce((sum,value)=>sum+value,0);
  const stickyDate=SELECT_WIDTH;
  const stickyJob=stickyDate+widths.date;
  const stickyWork=stickyJob+widths.job;

  const sortIcon=(key:SortKey)=>sortKey===key?(sortDirection==='asc'?<ArrowUp className="size-3"/>:<ArrowDown className="size-3"/>):<ChevronDown className="size-3 opacity-35"/>;

  const resizer=(key:ColumnKey,min:number,max:number)=><span
    role="separator"
    aria-label={`Resize ${key} column`}
    aria-orientation="vertical"
    tabIndex={0}
    onPointerDown={event=>resizeColumn(event,key,min,max)}
    onKeyDown={event=>{if(event.key==='ArrowLeft'){event.preventDefault();keyboardResize(key,-12,min,max)}if(event.key==='ArrowRight'){event.preventDefault();keyboardResize(key,12,min,max)}}}
    className="absolute inset-y-1 right-0 z-40 w-1 cursor-col-resize rounded-full bg-transparent outline-none hover:bg-ring/45 focus-visible:bg-ring"
  />;

  const header=(key:SortKey,column:ColumnKey,label:string,min:number,max:number,stickyLeft?:number)=><TableHeaderCell
    className={cn('relative',stickyLeft!==undefined&&'sticky z-30 bg-muted/95 backdrop-blur-sm')}
    style={{width:widths[column],minWidth:widths[column],left:stickyLeft}}
  >
    <Button type="button" appearance="subtle" size="small" onClick={()=>updateSort(key)} className="flex w-full items-center gap-1 text-left outline-none hover:text-foreground focus-visible:text-foreground">
      <span className="truncate">{label}</span>{sortIcon(key)}
    </Button>
    {resizer(column,min,max)}
  </TableHeaderCell>;

  const actualToolbar=<div className="w-full space-y-3 border-b border-border pb-3 pt-1">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 lg:gap-x-4">
      <TabList selectedValue={view} onTabSelect={(_,data)=>setView(data.value as ViewMode)} size="small" aria-label="Schedule view">
        <Tab value="work" icon={<Rows3 className="size-3.5"/>}>Work plan</Tab>
        <Tab value="crew" icon={<Users className="size-3.5"/>}>Crew loading</Tab>
      </TabList>
      <Input value={query} onChange={event=>setQuery(event.target.value)} contentBefore={<Search className="size-3.5"/>} placeholder="Search work, job, package, or crew" appearance="underline" size="small" className="min-w-[260px] flex-1 lg:ml-auto lg:w-[340px] lg:flex-none" aria-label="Search schedule"/>
      <Dropdown size="small" className="w-40" selectedOptions={[readiness]} value={{all:'Readiness: All',blocked:'Blocked',at_risk:'At risk',ready:'Ready',crew_short:'Crew short'}[readiness]} onOptionSelect={(_,data)=>setReadiness((data.optionValue||'all') as ReadinessFilter)} aria-label="Filter by readiness">
        <Option value="all" text="Readiness: All">Readiness: All</Option>
        <Option value="blocked" text="Blocked">Blocked</Option>
        <Option value="at_risk" text="At risk">At risk</Option>
        <Option value="ready" text="Ready">Ready</Option>
        <Option value="crew_short" text="Crew short">Crew short</Option>
      </Dropdown>
      <Dropdown size="small" className="w-36" selectedOptions={[itemType]} value={itemType==='all'?'Type: All':titleCase(itemType)} onOptionSelect={(_,data)=>setItemType(data.optionValue||'all')} aria-label="Filter by work type">
        <Option value="all" text="Type: All">Type: All</Option>
        {types.map(type=><Option key={type} value={type} text={titleCase(type)}>{titleCase(type)}</Option>)}
      </Dropdown>
      <Dropdown size="small" className="w-40" selectedOptions={[rangePreset]} value={{all:'Range: 90-day horizon',today:'Today','7':'Next 7 days',custom:'Custom range'}[rangePreset]} onOptionSelect={(_,data)=>applyRangePreset(data.optionValue||'all')} aria-label="Date range">
        <Option value="all" text="Range: 90-day horizon">Range: 90-day horizon</Option>
        <Option value="today" text="Today">Today</Option>
        <Option value="7" text="Next 7 days">Next 7 days</Option>
        {rangePreset==='custom'?<Option value="custom" text="Custom range">Custom range</Option>:null}
      </Dropdown>
    </div>
    <div className="overflow-x-auto pb-1 pt-0.5">
      <div className="flex min-w-max gap-2.5" role="group" aria-label="Select schedule day or date range">
        {days.map(day=>{
          const dayItems=items.filter(item=>item.scheduleDate===day.date);
          const blocked=dayItems.some(item=>item.blocked);
          const atRisk=!blocked&&dayItems.some(item=>readinessBucket(item)==='at_risk');
          const selected=Boolean(rangeStart&&rangeEnd&&day.date>=rangeStart&&day.date<=rangeEnd);
          const date=new Date(`${day.date}T12:00:00`);
          const weekday=new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(date);
          const monthDay=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(date);
          return <Button key={day.date} type="button" appearance="subtle" size="small" aria-pressed={selected} title="Click for one day. Shift+click to extend the selected range." onClick={event=>chooseDate(day.date,event.shiftKey)} className={cn(
            'flex h-14 w-[88px] shrink-0 flex-col items-center justify-center border-r border-border bg-transparent text-[11px] text-muted-foreground outline-none transition-all duration-150 hover:border-primary/70 hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary motion-reduce:transition-none',
            day.isToday&&'border-t border-primary/70',
            selected&&'border-y border-primary/70 text-foreground',
          )}>
            <span className="font-medium">{weekday}</span><span>{monthDay}</span>
            <span className="mt-1 flex items-center gap-1 font-mono text-[10px] tabular-nums"><span className={cn('size-1.5 rounded-full bg-muted-foreground/45',blocked&&'bg-destructive',atRisk&&'bg-warning',!blocked&&!atRisk&&dayItems.length>0&&'bg-success')}/>{dayItems.length}</span>
          </Button>;
        })}
      </div>
    </div>
  </div>;

  const footer=<>
    <div className="flex items-center gap-3"><span>{displayItems.length} of {items.length} items</span><span className="text-border">|</span><span>{selectedIds.size} selected</span></div>
    <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums"><span>Blocked <strong className={cn(blockedVisible&&'text-destructive')}>{blockedVisible}</strong></span><span>Crew demand <strong className="text-foreground">{crewDemandVisible}</strong></span><span>Crew short <strong className={cn(crewShortVisible&&'text-destructive')}>{crewShortVisible}</strong></span></div>
  </>;

  return <div
    ref={shellRef}
    tabIndex={0}
    onKeyDown={handleKeyDown}
    aria-label="Crew and readiness schedule"
    className="min-h-[420px] min-w-0 overflow-hidden border-y border-border bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
  >
    <div className="px-3 py-1.5">{actualToolbar}</div>
    <div className="min-h-0 min-w-0 overflow-auto">
    {view==='work'&&displayItems.length===0?<div className="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center">
      <CalendarOff className="size-7 text-muted-foreground" aria-hidden="true"/><h3 className="text-sm font-semibold">Nothing scheduled in this view</h3><p className="max-w-md text-xs text-muted-foreground">Adjust the active filters or open the look-ahead to review upcoming operations.</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2"><Button type="button" appearance="outline" size="small" onClick={resetFilters}>Show full horizon</Button><Button as="a" href="/look-ahead" appearance="outline" size="small">View 21-day look-ahead</Button></div>
    </div>:view==='work'?<Table className="table-fixed text-xs" style={{minWidth:totalWidth,width:totalWidth}}>
      <colgroup>
        <col style={{width:SELECT_WIDTH}}/>
        {(Object.keys(widths) as ColumnKey[]).map(key=><col key={key} style={{width:widths[key]}}/>)}
      </colgroup>
      <TableHeader><TableRow>
        <TableHeaderCell className="sticky left-0 z-30 w-9 bg-muted/95 px-2 text-center"><Checkbox checked={partiallySelected?'mixed':allVisibleSelected} onChange={toggleAllVisible} aria-label={allVisibleSelected?'Clear visible schedule selection':'Select all visible schedule items'}/></TableHeaderCell>
        {header('date','date','Date / time',116,220,stickyDate)}
        {header('job','job','Job',130,300,stickyJob)}
        {header('work','work','Work',150,360,stickyWork)}
        {header('type','type','Type',84,180)}
        <TableHeaderCell className="relative" style={{width:widths.package,minWidth:widths.package}}>Package / quantity{resizer('package',140,320)}</TableHeaderCell>
        {header('readiness','readiness','Readiness',170,360)}
        <TableHeaderCell className="relative" style={{width:widths.crew,minWidth:widths.crew}}>Crew{resizer('crew',140,320)}</TableHeaderCell>
        {header('status','status','Status',90,180)}
        <TableHeaderCell className="relative" style={{width:widths.notes,minWidth:widths.notes}}>Notes{resizer('notes',140,360)}</TableHeaderCell>
        <TableHeaderCell className="relative text-center" style={{width:widths.actions,minWidth:widths.actions}}>Actions{resizer('actions',48,84)}</TableHeaderCell>
      </TableRow></TableHeader>
      <TableBody>{displayItems.map((item,index)=>{
        const selected=selectedIds.has(item.id);
        const assigned=item.assignedCrew.map(crew=>crew.name).join(', ');
        const nextStatus=item.status==='completed'?'planned':item.status==='confirmed'?'completed':'confirmed';
        const pending=pendingId===item.id;
        const stickyClass='sticky z-20 bg-background group-data-[state=selected]:bg-background';
        return <TableRow key={item.id} data-grid-index={index} data-state={selected?'selected':undefined} className={cn('group cursor-default hover:!bg-transparent hover:outline hover:outline-1 hover:outline-primary/45',index===activeIndex&&'outline outline-1 -outline-offset-1 outline-ring/35')} aria-selected={selected} onClick={()=>setActiveIndex(index)} onDoubleClick={event=>{if(!interactiveTarget(event.target))router.push(item.openHref)}}>
          <TableCell className={cn(stickyClass,'left-0 w-9 px-2 text-center')}><Checkbox checked={selected} onChange={()=>toggleRow(item.id)} aria-label={selected?`Clear ${item.title} selection`:`Select ${item.title}`}/></TableCell>
          <TableCell className={stickyClass} style={{left:stickyDate,width:widths.date,minWidth:widths.date}}><CellStack primary={days.find(value=>value.date===item.scheduleDate)?.label||item.scheduleDate} secondary={`${time(item.startTime)}${item.endTime?` – ${time(item.endTime)}`:''}`}/></TableCell>
          <TableCell className={stickyClass} style={{left:stickyJob,width:widths.job,minWidth:widths.job}}><CellStack primary={item.projectName} secondary={item.jobNumber}/></TableCell>
          <TableCell className={stickyClass} style={{left:stickyWork,width:widths.work,minWidth:widths.work}}><CellStack primary={item.title} secondary={item.employeeTask||undefined}/></TableCell>
          <TableCell><span className="text-[11px] text-muted-foreground">{titleCase(item.itemType)}</span></TableCell>
          <TableCell>{item.packageName?<CellStack primary={`${item.packageName}${item.packageLocation?` · ${item.packageLocation}`:''}`} secondary={`${quantity(item.plannedQuantity)} ${item.unit||''}${item.operationStatus?` · ${titleCase(item.operationStatus)}`:''}`}/>:item.pourName?<CellStack primary={item.pourName} secondary={`${quantity(item.pourYards)} CY`}/>:<span className="text-muted-foreground">—</span>}</TableCell>
          <TableCell><div className="flex min-w-0 items-center gap-2"><ReadinessBadge item={item}/><span className="min-w-0 truncate text-[11px] text-muted-foreground">{item.readinessAction||item.warningReasons[0]||''}</span></div></TableCell>
          <TableCell><CellStack primary={assigned||'Unassigned'} secondary={`Need ${item.crewNeeded} · Assigned ${item.assignedCrew.length}${item.crewShort?` · Short ${item.crewShort}`:''}`} className={item.crewShort?'[&>div:last-child]:font-mono [&>div:last-child]:text-destructive':''}/></TableCell>
          <TableCell><WorkStatusBadge item={item}/></TableCell>
          <TableCell className="truncate text-[11px] text-muted-foreground" title={item.notes||item.warningReasons.join(' · ')}>{item.notes||item.warningReasons.join(' · ')||'—'}</TableCell>
          <TableCell className="text-center"><Menu>
            <MenuTrigger disableButtonEnhancement><Button type="button" appearance="subtle" size="small" icon={<MoreHorizontal/>} disabled={pending} aria-label={`Actions for ${item.title}`}/></MenuTrigger>
            <MenuPopover><MenuList>
              {item.inspectionId?<MenuItem onClick={()=>router.push('/readiness')}>Open inspection</MenuItem>:item.blocked?<><MenuItem onClick={()=>router.push('/readiness')}>Clear hold</MenuItem>{item.blockingResourceCount>0?<MenuItem onClick={()=>router.push('/readiness/resources')}>Open resources</MenuItem>:null}</>:<MenuItem onClick={()=>runStatusAction(item,nextStatus)}>{item.status==='completed'?'Reopen':item.status==='confirmed'?'Complete':'Confirm'}</MenuItem>}
              <MenuItem onClick={()=>router.push(item.openHref)}>Open work item</MenuItem>
              <MenuDivider/>
              <MenuItem onClick={()=>runDelete(item)} className="text-destructive">Remove from schedule</MenuItem>
            </MenuList></MenuPopover>
          </Menu></TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>:<Table className="table-fixed text-xs" style={{minWidth:Math.max(520,250+visibleDays.length*150),width:Math.max(520,250+visibleDays.length*150)}}>
      <TableHeader><TableRow><TableHeaderCell className="sticky left-0 z-30 w-[170px] bg-muted/95">Crew / resource</TableHeaderCell><TableHeaderCell className="sticky left-[170px] z-30 w-20 bg-muted/95">Role</TableHeaderCell>{visibleDays.map(day=><TableHeaderCell key={day.date} className="w-[150px]"><CellStack primary={day.isToday?'Today':day.shortLabel} secondary={day.label}/></TableHeaderCell>)}</TableRow></TableHeader>
      <TableBody>{matrixRows.map(row=><TableRow key={row.id} className="group hover:!bg-transparent"><TableCell className="sticky left-0 z-20 w-[170px] bg-background"><CellStack primary={row.name}/></TableCell><TableCell className="sticky left-[170px] z-20 w-20 bg-background text-[11px] text-muted-foreground">{row.role}</TableCell>{visibleDays.map(day=>{const cellItems=matrixItems(row,day.date);return <TableCell key={day.date} className="h-auto min-h-14 border-l border-border/60 align-top"><div className="space-y-1 py-1">{cellItems.length?cellItems.map(item=>{const tone=readinessBucket(item);return <Button appearance="subtle" type="button" key={item.id} onClick={()=>toggleRow(item.id)} onDoubleClick={()=>router.push(item.openHref)} className={cn('block w-full border-l border-border px-2 py-1.5 text-left outline-none transition-all duration-150 hover:border-primary/70 focus-visible:ring-1 focus-visible:ring-primary motion-reduce:transition-none',tone==='blocked'&&'border-destructive text-destructive',tone==='at_risk'&&'border-warning text-warning',tone==='ready'&&'border-success')}><div className="truncate font-mono text-[10px] text-muted-foreground">{time(item.startTime)} · {item.jobNumber}</div><div className="mt-0.5 truncate text-[11px] font-medium text-foreground">{item.title}</div></Button>}):<span className="text-muted-foreground/50">—</span>}</div></TableCell>;})}</TableRow>)}</TableBody>
    </Table>}
    </div>
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">{footer}</div>
  </div>;
}

export function ScheduleGrid({days,items,crewMembers,pumpDataAvailable=true}:{days:ScheduleGridDay[];items:ScheduleGridItem[];crewMembers:ScheduleCrewMember[];pumpDataAvailable?:boolean}){
  const [registerOpen,setRegisterOpen]=useState(false);
  return <div className="min-w-0 space-y-3">
    <ScheduleMatrix days={days} items={items} pumpDataAvailable={pumpDataAvailable}/>
    <Accordion collapsible openItems={registerOpen?['register']:[]} onToggle={(_,data)=>setRegisterOpen(data.openItems.includes('register'))} className="border-t border-border pt-2">
      <AccordionItem value="register"><AccordionHeader size="small">Open schedule register and crew detail</AccordionHeader><AccordionPanel>{registerOpen?<ScheduleRegister days={days} items={items} crewMembers={crewMembers}/>:null}</AccordionPanel></AccordionItem>
    </Accordion>
  </div>;
}
