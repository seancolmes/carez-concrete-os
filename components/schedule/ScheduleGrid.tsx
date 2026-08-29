'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CheckSquare,Grid3X3,Rows3,Search,Square} from 'lucide-react';
import {deleteScheduleItem,updateScheduleStatus} from '@/app/schedule/actions';

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
type StatusFilter='all'|'blocked'|'unassigned'|'ready'|'confirmed'|'completed'|'planned';

const time=(value:string|null)=>{
  if(!value)return '—';
  const [hours,minutes]=value.split(':').map(Number);
  const date=new Date();date.setHours(hours,minutes||0,0,0);
  return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(date);
};
const quantity=(value:number|null)=>value===null?'—':Number(value).toLocaleString('en-US',{maximumFractionDigits:2});

function interactiveTarget(target:EventTarget|null){
  const element=target as HTMLElement|null;
  return Boolean(element?.closest('a,button,input,select,textarea,summary'));
}

function statusBucket(item:ScheduleGridItem):Exclude<StatusFilter,'all'>{
  if(item.blocked)return 'blocked';
  if(item.crewShort>0)return 'unassigned';
  if(item.status==='completed')return 'completed';
  if(item.status==='confirmed'||item.status==='in_progress')return 'confirmed';
  if(item.readyToStart===true)return 'ready';
  return 'planned';
}

function statusLabel(item:ScheduleGridItem){
  const bucket=statusBucket(item);
  if(bucket==='blocked')return 'Hold';
  if(bucket==='unassigned')return `Short ${item.crewShort}`;
  if(bucket==='ready')return 'Ready';
  if(bucket==='confirmed')return item.status==='in_progress'?'In Progress':'Confirmed';
  if(bucket==='completed')return 'Completed';
  return 'Planned';
}

function eventTone(item:ScheduleGridItem){
  const bucket=statusBucket(item);
  if(bucket==='blocked')return 'blocked';
  if(bucket==='unassigned')return 'warning';
  if(['ready','confirmed','completed'].includes(bucket))return 'ready';
  return '';
}

export function ScheduleGrid({days,items,crewMembers}:{days:ScheduleGridDay[];items:ScheduleGridItem[];crewMembers:ScheduleCrewMember[]}){
  const router=useRouter();
  const shellRef=useRef<HTMLDivElement|null>(null);
  const [view,setView]=useState<ViewMode>('work');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<StatusFilter>('all');
  const [itemType,setItemType]=useState('all');
  const [day,setDay]=useState('all');
  const [activeIndex,setActiveIndex]=useState(0);
  const [selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set());

  const types=useMemo(()=>Array.from(new Set(items.map(item=>item.itemType))).sort(),[items]);
  const filteredItems=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return items.filter(item=>{
      if(status!=='all'&&statusBucket(item)!==status)return false;
      if(itemType!=='all'&&item.itemType!==itemType)return false;
      if(day!=='all'&&item.scheduleDate!==day)return false;
      if(!normalized)return true;
      return [item.jobNumber,item.projectName,item.title,item.packageName,item.packageLocation,item.employeeTask,item.notes,...item.assignedCrew.map(crew=>crew.name)]
        .some(value=>String(value||'').toLowerCase().includes(normalized));
    });
  },[items,query,status,itemType,day]);

  useEffect(()=>{
    setActiveIndex(index=>Math.max(0,Math.min(index,Math.max(filteredItems.length-1,0))));
  },[filteredItems.length]);

  useEffect(()=>{
    if(view!=='work')return;
    shellRef.current?.querySelector<HTMLTableRowElement>(`tr[data-grid-index="${activeIndex}"]`)?.scrollIntoView({block:'nearest'});
  },[activeIndex,view]);

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
      const allVisibleSelected=filteredItems.length>0&&filteredItems.every(item=>next.has(item.id));
      for(const item of filteredItems){if(allVisibleSelected)next.delete(item.id);else next.add(item.id);}
      return next;
    });
  }

  function handleKeyDown(event:React.KeyboardEvent<HTMLDivElement>){
    if(view!=='work'||interactiveTarget(event.target))return;
    if(event.key==='ArrowDown'){event.preventDefault();setActiveIndex(index=>Math.min(index+1,Math.max(filteredItems.length-1,0)));return;}
    if(event.key==='ArrowUp'){event.preventDefault();setActiveIndex(index=>Math.max(index-1,0));return;}
    if(event.key==='Home'){event.preventDefault();setActiveIndex(0);return;}
    if(event.key==='End'){event.preventDefault();setActiveIndex(Math.max(filteredItems.length-1,0));return;}
    const activeItem=filteredItems[activeIndex];
    if(!activeItem)return;
    if(event.key===' '){event.preventDefault();toggleRow(activeItem.id);return;}
    if(event.key==='Enter'){event.preventDefault();router.push(activeItem.openHref);return;}
    if(event.key==='Escape'){setSelectedIds(new Set());return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();toggleAllVisible();}
  }

  const allVisibleSelected=filteredItems.length>0&&filteredItems.every(item=>selectedIds.has(item.id));
  const matrixRows=useMemo(()=>[
    ...crewMembers.map(member=>({id:member.id,name:member.name,role:member.role,type:'crew' as const})),
    {id:'__unassigned',name:'Unassigned / Crew Short',role:'Exception',type:'unassigned' as const},
    {id:'__resources',name:'Pours / Inspections / Resources',role:'Coordination',type:'resources' as const},
  ],[crewMembers]);

  function matrixItems(row:typeof matrixRows[number],date:string){
    return filteredItems.filter(item=>{
      if(item.scheduleDate!==date)return false;
      if(row.type==='crew')return item.assignedCrew.some(crew=>crew.id===row.id);
      if(row.type==='unassigned')return item.itemType==='work'&&(item.assignedCrew.length===0||item.crewShort>0);
      return item.itemType!=='work';
    });
  }

  return <div ref={shellRef} className="industrial-grid-shell schedule-grid-shell" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Crew and readiness schedule">
    <div className="industrial-grid-toolbar">
      <div className="industrial-filter-group" aria-label="Schedule view">
        <button type="button" className={`industrial-view-button ${view==='work'?'active safety-orange':''}`} onClick={()=>setView('work')}><Rows3 size={13}/> Work Grid</button>
        <button type="button" className={`industrial-view-button ${view==='crew'?'active safety-orange':''}`} onClick={()=>setView('crew')}><Grid3X3 size={13}/> Crew Matrix</button>
      </div>
      <label className="industrial-grid-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search job, work, package, or crew" aria-label="Search schedule"/></label>
      <select className="industrial-grid-select" value={status} onChange={event=>setStatus(event.target.value as StatusFilter)} aria-label="Filter by readiness status">
        <option value="all">All readiness states</option><option value="blocked">Hold / blocked</option><option value="unassigned">Crew short</option><option value="ready">Ready</option><option value="confirmed">Confirmed / working</option><option value="completed">Completed</option><option value="planned">Planned</option>
      </select>
      <select className="industrial-grid-select" value={itemType} onChange={event=>setItemType(event.target.value)} aria-label="Filter by schedule type"><option value="all">All types</option>{types.map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select>
      <select className="industrial-grid-select" value={day} onChange={event=>setDay(event.target.value)} aria-label="Filter by day"><option value="all">All 14 days</option>{days.map(value=><option key={value.date} value={value.date}>{value.label}</option>)}</select>
      <div className="industrial-grid-toolbar-spacer"/>
      <span className="industrial-grid-selection">{selectedIds.size} selected{view==='work'?' · ↑↓ move · Space select · Enter open':''}</span>
    </div>

    {view==='work'?<div className="industrial-grid-scroll">
      <table className="industrial-grid-table schedule-work-table">
        <thead><tr>
          <th className="freeze-select center"><button type="button" className={`industrial-row-check ${allVisibleSelected?'selected':''}`} onClick={toggleAllVisible} aria-label={allVisibleSelected?'Clear visible schedule selection':'Select all visible schedule items'}>{allVisibleSelected?<CheckSquare size={14}/>:<Square size={14}/>}</button></th>
          <th className="freeze-primary">Date / Time</th>
          <th className="freeze-secondary">Job</th>
          <th className="freeze-tertiary">Work</th>
          <th style={{width:92}}>Type</th>
          <th style={{width:220}}>Package / Quantity</th>
          <th style={{width:245}}>Readiness / Constraint</th>
          <th style={{width:210}}>Crew</th>
          <th style={{width:96}}>Status</th>
          <th style={{width:220}}>Notes</th>
          <th style={{width:214}}>Actions</th>
        </tr></thead>
        <tbody>{filteredItems.length===0?<tr><td colSpan={11} style={{height:72,textAlign:'center',color:'var(--muted)'}}>No schedule items match the current filters.</td></tr>:filteredItems.map((item,index)=>{
          const selected=selectedIds.has(item.id),active=index===activeIndex,bucket=statusBucket(item),assigned=item.assignedCrew.map(crew=>crew.name).join(', '),nextStatus=item.status==='completed'?'planned':item.status==='confirmed'?'completed':'confirmed';
          return <tr key={item.id} data-grid-index={index} className={`${active?'is-active':''} ${selected?'is-selected':''}`} aria-selected={selected} onClick={()=>setActiveIndex(index)} onDoubleClick={()=>router.push(item.openHref)}>
            <td className="freeze-select center"><button type="button" className={`industrial-row-check ${selected?'selected':''}`} onClick={event=>{event.stopPropagation();toggleRow(item.id);}} aria-label={selected?`Clear ${item.title} selection`:`Select ${item.title}`}>{selected?<CheckSquare size={14}/>:<Square size={14}/>}</button></td>
            <td className="freeze-primary"><span className="industrial-grid-primary">{days.find(value=>value.date===item.scheduleDate)?.shortLabel||item.scheduleDate}</span><span className="industrial-grid-secondary">{time(item.startTime)}{item.endTime?` – ${time(item.endTime)}`:''}</span></td>
            <td className="freeze-secondary"><span className="industrial-grid-primary">{item.jobNumber}</span><span className="industrial-grid-secondary">{item.projectName}</span></td>
            <td className="freeze-tertiary"><span className="industrial-grid-primary">{item.title}</span><span className="industrial-grid-secondary">{item.employeeTask||'Coordination / non-production item'}</span></td>
            <td><span className="grid-status">{item.itemType.replaceAll('_',' ')}</span></td>
            <td>{item.packageName?<><span className="industrial-grid-primary">{item.packageName}{item.packageLocation?` · ${item.packageLocation}`:''}</span><span className="industrial-grid-secondary">{quantity(item.plannedQuantity)} {item.unit||''} · {item.operationStatus||'planned'}</span></>:item.pourName?<><span className="industrial-grid-primary">{item.pourName}</span><span className="industrial-grid-secondary">{quantity(item.pourYards)} CY</span></>:<span className="muted">—</span>}</td>
            <td className={item.blocked?'danger-text':item.warningReasons.length?'warning-text':''}><span className="industrial-grid-primary">{item.blocked?'DO NOT START':item.readyToStart===true?'Ready to start':'Planned / no gate'}</span><span className="industrial-grid-secondary">{item.readinessAction||item.warningReasons.join(' · ')||'No open automatic constraint'}</span></td>
            <td><span className="industrial-grid-primary">{assigned||'Nobody assigned'}</span><span className={`industrial-grid-secondary ${item.crewShort?'warning-text':''}`}>Need {item.crewNeeded} · Assigned {item.assignedCrew.length}{item.crewShort?` · Short ${item.crewShort}`:''}</span></td>
            <td><span className={`grid-status ${bucket}`}>{statusLabel(item)}</span></td>
            <td title={item.notes||''}>{item.notes||item.warningReasons.join(' · ')||'—'}</td>
            <td><div className="industrial-grid-actions">
              {item.inspectionId?<Link className="industrial-grid-action" href="/readiness">Inspection</Link>:item.blocked?<><Link className="industrial-grid-action danger" href="/readiness">Clear Hold</Link>{item.blockingResourceCount>0&&<Link className="industrial-grid-action" href="/readiness/resources">Resources</Link>}</>:<form action={updateScheduleStatus}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value={nextStatus}/><button className="industrial-grid-action primary">{item.status==='completed'?'Reopen':item.status==='confirmed'?'Complete':'Confirm'}</button></form>}
              <Link className="industrial-grid-action" href={item.openHref}>Open</Link>
              <form action={deleteScheduleItem}><input type="hidden" name="id" value={item.id}/><button className="industrial-grid-action danger">Remove</button></form>
            </div></td>
          </tr>;
        })}</tbody>
      </table>
    </div>:<div className="industrial-grid-scroll">
      <table className="industrial-grid-table crew-matrix-table">
        <thead><tr><th className="crew-freeze-name">Crew / Resource</th><th className="crew-freeze-role">Role</th>{days.map(value=><th key={value.date} className="crew-matrix-day"><span className="industrial-grid-primary">{value.isToday?'TODAY':value.shortLabel}</span><span className="industrial-grid-secondary">{value.label}</span></th>)}</tr></thead>
        <tbody>{matrixRows.map(row=><tr key={row.id}><td className="crew-freeze-name"><span className="industrial-grid-primary">{row.name}</span></td><td className="crew-freeze-role muted">{row.role}</td>{days.map(value=>{const cellItems=matrixItems(row,value.date);return <td key={value.date} className="crew-matrix-cell">{cellItems.length?cellItems.map(item=><button type="button" key={item.id} className={`crew-matrix-event ${eventTone(item)} ${selectedIds.has(item.id)?'selected':''}`} onClick={()=>toggleRow(item.id)} onDoubleClick={()=>router.push(item.openHref)} title={`${item.jobNumber} — ${item.title}`}><strong>{time(item.startTime)} · {item.jobNumber}</strong><span>{item.title}</span></button>):<span className="matrix-empty">—</span>}</td>;})}</tr>)}</tbody>
      </table>
    </div>}

    <div className="industrial-grid-statusbar"><span>{filteredItems.length} visible of {items.length}</span><span>{items.filter(item=>item.blocked).length} blocked · {items.filter(item=>item.crewShort>0).length} crew-short</span><span>{view==='work'?'Frozen date, job, and work columns remain visible while scrolling.':'Crew names and roles remain frozen across the 14-day matrix.'}</span></div>
  </div>;
}
