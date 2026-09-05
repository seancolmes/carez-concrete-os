'use client';

import Link from 'next/link';
import {
  useEffect,useMemo,useRef,useState,useTransition,
  type KeyboardEvent as ReactKeyboardEvent,type PointerEvent as ReactPointerEvent,
} from 'react';
import {useRouter} from 'next/navigation';
import {
  ArrowDown,ArrowUp,CalendarOff,ChevronDown,MoreHorizontal,Rows3,Search,Users,
} from 'lucide-react';
import {deleteScheduleItem,updateScheduleStatus} from '@/app/schedule/actions';
import {
  CarezDataGrid,CarezDataGridBody,CarezDataGridCell,CarezDataGridHead,CarezDataGridHeaderCell,
  CarezDataGridRow,CarezDataGridTable,
} from '@/components/carez/data-grid';
import {Badge} from '@/components/ui/badge';
import {Button,buttonVariants} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyMedia,EmptyTitle} from '@/components/ui/empty';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {ToggleGroup,ToggleGroupItem} from '@/components/ui/toggle-group';
import {cn} from '@/lib/utils';

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
  pourYards:number|null;
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
  return <Badge variant={state==='blocked'?'destructive':'outline'} className={cn(
    'h-5 rounded-md px-1.5 text-[10px] uppercase tracking-[.04em]',
    state==='ready'&&'border-success/30 bg-success/10 text-success',
    state==='at_risk'&&'border-warning/30 bg-warning/10 text-warning',
    state==='planned'&&'text-muted-foreground',
  )}>{readinessLabel(item)}</Badge>;
}

function WorkStatusBadge({item}:{item:ScheduleGridItem}){
  const completed=item.status==='completed';
  const active=['confirmed','in_progress'].includes(item.status);
  return <Badge variant="outline" className={cn(
    'h-5 rounded-md px-1.5 text-[10px]',
    completed&&'border-success/25 bg-success/8 text-success',
    active&&'bg-muted text-foreground',
    !completed&&!active&&'text-muted-foreground',
  )}>{statusLabel(item)}</Badge>;
}

function CellStack({primary,secondary,className}:{primary:React.ReactNode;secondary?:React.ReactNode;className?:string}){
  return <div className={cn('min-w-0 leading-tight',className)}><div className="truncate text-xs font-medium text-foreground">{primary}</div>{secondary?<div className="mt-0.5 truncate text-[11px] text-muted-foreground">{secondary}</div>:null}</div>;
}

export function ScheduleGrid({days,items,crewMembers}:{days:ScheduleGridDay[];items:ScheduleGridItem[];crewMembers:ScheduleCrewMember[]}){
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

  const header=(key:SortKey,column:ColumnKey,label:string,min:number,max:number,stickyLeft?:number)=><CarezDataGridHeaderCell
    className={cn('relative',stickyLeft!==undefined&&'sticky z-30 bg-muted/95 backdrop-blur-sm')}
    style={{width:widths[column],minWidth:widths[column],left:stickyLeft}}
  >
    <button type="button" onClick={()=>updateSort(key)} className="flex w-full items-center gap-1 text-left outline-none hover:text-foreground focus-visible:text-foreground">
      <span className="truncate">{label}</span>{sortIcon(key)}
    </button>
    {resizer(column,min,max)}
  </CarezDataGridHeaderCell>;

  const gridToolbar=<div className="w-full space-y-2 py-0.5">
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup value={[view]} onValueChange={values=>{const next=values[0] as ViewMode|undefined;if(next)setView(next)}} size="sm" aria-label="Schedule view">
        <ToggleGroupItem value="work"><Rows3 className="size-3.5"/> Work plan</ToggleGroupItem>
        <ToggleGroupItem value="crew"><Users className="size-3.5"/> Crew loading</ToggleGroupItem>
      </ToggleGroup>
      <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
        <Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search work, job, package, or crew" className="h-8 pl-8 text-xs" aria-label="Search schedule"/>
      </div>
      <NativeSelect size="sm" className="w-40"><select hidden/></NativeSelect>
      <NativeSelect size="sm" className="w-40" value={undefined as never}/>
    </div>
  </div>;

  const actualToolbar=<div className="w-full space-y-2 py-0.5">
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup value={[view]} onValueChange={values=>{const next=values[0] as ViewMode|undefined;if(next)setView(next)}} size="sm" aria-label="Schedule view">
        <ToggleGroupItem value="work"><Rows3 className="size-3.5"/> Work plan</ToggleGroupItem>
        <ToggleGroupItem value="crew"><Users className="size-3.5"/> Crew loading</ToggleGroupItem>
      </ToggleGroup>
      <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
        <Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search work, job, package, or crew" className="h-8 pl-8 text-xs" aria-label="Search schedule"/>
      </div>
      <NativeSelect size="sm" className="w-40" value={readiness} onChange={event=>setReadiness(event.target.value as ReadinessFilter)} aria-label="Filter by readiness">
        <NativeSelectOption value="all">Readiness: All</NativeSelectOption>
        <NativeSelectOption value="blocked">Blocked</NativeSelectOption>
        <NativeSelectOption value="at_risk">At risk</NativeSelectOption>
        <NativeSelectOption value="ready">Ready</NativeSelectOption>
        <NativeSelectOption value="crew_short">Crew short</NativeSelectOption>
      </NativeSelect>
      <NativeSelect size="sm" className="w-36" value={itemType} onChange={event=>setItemType(event.target.value)} aria-label="Filter by work type">
        <NativeSelectOption value="all">Type: All</NativeSelectOption>
        {types.map(type=><NativeSelectOption key={type} value={type}>{titleCase(type)}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect size="sm" className="w-40" value={rangePreset} onChange={event=>applyRangePreset(event.target.value)} aria-label="Date range">
        <NativeSelectOption value="all">Range: Next 14 days</NativeSelectOption>
        <NativeSelectOption value="today">Today</NativeSelectOption>
        <NativeSelectOption value="7">Next 7 days</NativeSelectOption>
        {rangePreset==='custom'?<NativeSelectOption value="custom">Custom range</NativeSelectOption>:null}
      </NativeSelect>
    </div>
    <div className="overflow-x-auto pb-0.5">
      <div className="flex min-w-max gap-1.5" role="group" aria-label="Select schedule day or date range">
        {days.map(day=>{
          const dayItems=items.filter(item=>item.scheduleDate===day.date);
          const blocked=dayItems.some(item=>item.blocked);
          const atRisk=!blocked&&dayItems.some(item=>readinessBucket(item)==='at_risk');
          const selected=Boolean(rangeStart&&rangeEnd&&day.date>=rangeStart&&day.date<=rangeEnd);
          const date=new Date(`${day.date}T12:00:00`);
          const weekday=new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(date);
          const monthDay=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(date);
          return <button key={day.date} type="button" aria-pressed={selected} title="Click for one day. Shift+click to extend the selected range." onClick={event=>chooseDate(day.date,event.shiftKey)} className={cn(
            'flex h-14 w-[82px] shrink-0 flex-col items-center justify-center rounded-md border border-border bg-background text-[11px] text-muted-foreground outline-none transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none',
            day.isToday&&'border-ring/60',
            selected&&'border-foreground/45 bg-accent/55 text-foreground',
          )}>
            <span className="font-medium">{weekday}</span><span>{monthDay}</span>
            <span className="mt-1 flex items-center gap-1 font-mono text-[10px] tabular-nums"><span className={cn('size-1.5 rounded-full bg-muted-foreground/45',blocked&&'bg-destructive',atRisk&&'bg-warning',!blocked&&!atRisk&&dayItems.length>0&&'bg-success')}/>{dayItems.length}</span>
          </button>;
        })}
      </div>
    </div>
  </div>;

  const footer=<>
    <div className="flex items-center gap-3"><span>{displayItems.length} of {items.length} items</span><span className="text-border">|</span><span>{selectedIds.size} selected</span></div>
    <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums"><span>Blocked <strong className={cn(blockedVisible&&'text-destructive')}>{blockedVisible}</strong></span><span>Crew demand <strong className="text-foreground">{crewDemandVisible}</strong></span><span>Crew short <strong className={cn(crewShortVisible&&'text-destructive')}>{crewShortVisible}</strong></span></div>
  </>;

  return <CarezDataGrid
    ref={shellRef}
    tabIndex={0}
    onKeyDown={handleKeyDown}
    aria-label="Crew and readiness schedule"
    className="min-h-[420px]"
    toolbar={actualToolbar}
    footer={footer}
    isEmpty={view==='work'&&displayItems.length===0}
    empty={<Empty className="min-h-64 rounded-none border-0">
      <EmptyHeader><EmptyMedia variant="icon"><CalendarOff/></EmptyMedia><EmptyTitle>Nothing scheduled in this view</EmptyTitle><EmptyDescription>Adjust the active filters or open the look-ahead to review upcoming operations.</EmptyDescription></EmptyHeader>
      <EmptyContent><div className="flex flex-wrap items-center justify-center gap-2"><Button type="button" variant="outline" size="sm" onClick={resetFilters}>Show all 14 days</Button><Link href="/look-ahead" className={buttonVariants({variant:'outline',size:'sm'})}>View 21-day look-ahead</Link></div></EmptyContent>
    </Empty>}
  >
    {view==='work'?<CarezDataGridTable className="table-fixed" style={{minWidth:totalWidth,width:totalWidth}}>
      <colgroup>
        <col style={{width:SELECT_WIDTH}}/>
        {(Object.keys(widths) as ColumnKey[]).map(key=><col key={key} style={{width:widths[key]}}/>)}
      </colgroup>
      <CarezDataGridHead><tr>
        <CarezDataGridHeaderCell className="sticky left-0 z-30 w-9 bg-muted/95 px-2 text-center"><Checkbox checked={allVisibleSelected} indeterminate={partiallySelected} onCheckedChange={toggleAllVisible} aria-label={allVisibleSelected?'Clear visible schedule selection':'Select all visible schedule items'}/></CarezDataGridHeaderCell>
        {header('date','date','Date / time',116,220,stickyDate)}
        {header('job','job','Job',130,300,stickyJob)}
        {header('work','work','Work',150,360,stickyWork)}
        {header('type','type','Type',84,180)}
        <CarezDataGridHeaderCell className="relative" style={{width:widths.package,minWidth:widths.package}}>Package / quantity{resizer('package',140,320)}</CarezDataGridHeaderCell>
        {header('readiness','readiness','Readiness',170,360)}
        <CarezDataGridHeaderCell className="relative" style={{width:widths.crew,minWidth:widths.crew}}>Crew{resizer('crew',140,320)}</CarezDataGridHeaderCell>
        {header('status','status','Status',90,180)}
        <CarezDataGridHeaderCell className="relative" style={{width:widths.notes,minWidth:widths.notes}}>Notes{resizer('notes',140,360)}</CarezDataGridHeaderCell>
        <CarezDataGridHeaderCell className="relative text-center" style={{width:widths.actions,minWidth:widths.actions}}>Actions{resizer('actions',48,84)}</CarezDataGridHeaderCell>
      </tr></CarezDataGridHead>
      <CarezDataGridBody>{displayItems.map((item,index)=>{
        const selected=selectedIds.has(item.id);
        const assigned=item.assignedCrew.map(crew=>crew.name).join(', ');
        const nextStatus=item.status==='completed'?'planned':item.status==='confirmed'?'completed':'confirmed';
        const pending=pendingId===item.id;
        const stickyClass='sticky z-20 bg-background group-hover:bg-muted/35 group-data-[state=selected]:bg-accent/70';
        return <CarezDataGridRow key={item.id} data-grid-index={index} data-state={selected?'selected':undefined} className={cn('group cursor-default',index===activeIndex&&'outline outline-1 -outline-offset-1 outline-ring/35')} aria-selected={selected} onClick={()=>setActiveIndex(index)} onDoubleClick={event=>{if(!interactiveTarget(event.target))router.push(item.openHref)}}>
          <CarezDataGridCell className={cn(stickyClass,'left-0 w-9 px-2 text-center')}><Checkbox checked={selected} onCheckedChange={()=>toggleRow(item.id)} aria-label={selected?`Clear ${item.title} selection`:`Select ${item.title}`}/></CarezDataGridCell>
          <CarezDataGridCell className={stickyClass} style={{left:stickyDate,width:widths.date,minWidth:widths.date}}><CellStack primary={days.find(value=>value.date===item.scheduleDate)?.label||item.scheduleDate} secondary={`${time(item.startTime)}${item.endTime?` – ${time(item.endTime)}`:''}`}/></CarezDataGridCell>
          <CarezDataGridCell className={stickyClass} style={{left:stickyJob,width:widths.job,minWidth:widths.job}}><CellStack primary={item.projectName} secondary={item.jobNumber}/></CarezDataGridCell>
          <CarezDataGridCell className={stickyClass} style={{left:stickyWork,width:widths.work,minWidth:widths.work}}><CellStack primary={item.title} secondary={item.employeeTask||undefined}/></CarezDataGridCell>
          <CarezDataGridCell><span className="text-[11px] text-muted-foreground">{titleCase(item.itemType)}</span></CarezDataGridCell>
          <CarezDataGridCell>{item.packageName?<CellStack primary={`${item.packageName}${item.packageLocation?` · ${item.packageLocation}`:''}`} secondary={`${quantity(item.plannedQuantity)} ${item.unit||''}${item.operationStatus?` · ${titleCase(item.operationStatus)}`:''}`}/>:item.pourName?<CellStack primary={item.pourName} secondary={`${quantity(item.pourYards)} CY`}/>:<span className="text-muted-foreground">—</span>}</CarezDataGridCell>
          <CarezDataGridCell><div className="flex min-w-0 items-center gap-2"><ReadinessBadge item={item}/><span className="min-w-0 truncate text-[11px] text-muted-foreground">{item.readinessAction||item.warningReasons[0]||''}</span></div></CarezDataGridCell>
          <CarezDataGridCell><CellStack primary={assigned||'Unassigned'} secondary={`Need ${item.crewNeeded} · Assigned ${item.assignedCrew.length}${item.crewShort?` · Short ${item.crewShort}`:''}`} className={item.crewShort?'[&>div:last-child]:text-warning':''}/></CarezDataGridCell>
          <CarezDataGridCell><WorkStatusBadge item={item}/></CarezDataGridCell>
          <CarezDataGridCell className="truncate text-[11px] text-muted-foreground" title={item.notes||item.warningReasons.join(' · ')}>{item.notes||item.warningReasons.join(' · ')||'—'}</CarezDataGridCell>
          <CarezDataGridCell className="text-center"><DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" disabled={pending} aria-label={`Actions for ${item.title}`}/> }><MoreHorizontal/></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {item.inspectionId?<DropdownMenuItem onClick={()=>router.push('/readiness')}>Open inspection</DropdownMenuItem>:item.blocked?<><DropdownMenuItem onClick={()=>router.push('/readiness')}>Clear hold</DropdownMenuItem>{item.blockingResourceCount>0?<DropdownMenuItem onClick={()=>router.push('/readiness/resources')}>Open resources</DropdownMenuItem>:null}</>:<DropdownMenuItem onClick={()=>runStatusAction(item,nextStatus)}>{item.status==='completed'?'Reopen':item.status==='confirmed'?'Complete':'Confirm'}</DropdownMenuItem>}
              <DropdownMenuItem onClick={()=>router.push(item.openHref)}>Open work item</DropdownMenuItem>
              <DropdownMenuSeparator/>
              <DropdownMenuItem variant="destructive" onClick={()=>runDelete(item)}>Remove from schedule</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu></CarezDataGridCell>
        </CarezDataGridRow>;
      })}</CarezDataGridBody>
    </CarezDataGridTable>:<CarezDataGridTable className="table-fixed" style={{minWidth:Math.max(520,250+visibleDays.length*150),width:Math.max(520,250+visibleDays.length*150)}}>
      <CarezDataGridHead><tr><CarezDataGridHeaderCell className="sticky left-0 z-30 w-[170px] bg-muted/95">Crew / resource</CarezDataGridHeaderCell><CarezDataGridHeaderCell className="sticky left-[170px] z-30 w-20 bg-muted/95">Role</CarezDataGridHeaderCell>{visibleDays.map(day=><CarezDataGridHeaderCell key={day.date} className="w-[150px]"><CellStack primary={day.isToday?'Today':day.shortLabel} secondary={day.label}/></CarezDataGridHeaderCell>)}</tr></CarezDataGridHead>
      <CarezDataGridBody>{matrixRows.map(row=><CarezDataGridRow key={row.id} className="group"><CarezDataGridCell className="sticky left-0 z-20 w-[170px] bg-background group-hover:bg-muted/35"><CellStack primary={row.name}/></CarezDataGridCell><CarezDataGridCell className="sticky left-[170px] z-20 w-20 bg-background text-[11px] text-muted-foreground group-hover:bg-muted/35">{row.role}</CarezDataGridCell>{visibleDays.map(day=>{const cellItems=matrixItems(row,day.date);return <CarezDataGridCell key={day.date} className="h-auto min-h-14 align-top"><div className="space-y-1 py-1">{cellItems.length?cellItems.map(item=>{const tone=readinessBucket(item);return <button type="button" key={item.id} onClick={()=>toggleRow(item.id)} onDoubleClick={()=>router.push(item.openHref)} className={cn('block w-full rounded-md border border-border bg-muted/20 px-2 py-1.5 text-left outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/40',tone==='blocked'&&'border-destructive/35 bg-destructive/8',tone==='at_risk'&&'border-warning/30 bg-warning/8',tone==='ready'&&'border-success/25')}><div className="truncate font-mono text-[10px] text-muted-foreground">{time(item.startTime)} · {item.jobNumber}</div><div className="mt-0.5 truncate text-[11px] font-medium">{item.title}</div></button>}):<span className="text-muted-foreground/50">—</span>}</div></CarezDataGridCell>;})}</CarezDataGridRow>)}</CarezDataGridBody>
    </CarezDataGridTable>}
  </CarezDataGrid>;
}
