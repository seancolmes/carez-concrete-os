'use client';

import {useEffect,useMemo,useRef,useState,useTransition,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@fluentui/react-components';
import { ChevronLeftRegular as ChevronLeft, ChevronRightRegular as ChevronRight, CloudOffRegular as CloudOff, ReOrderDotsVerticalRegular as GripVertical } from '@fluentui/react-icons';
import {rescheduleScheduleItem} from '@/app/schedule/actions';
import styles from './ScheduleMatrix.module.css';
import type {ScheduleGridDay,ScheduleGridItem} from './ScheduleGrid';
import {scheduleWindow,inScheduleWindow,staffingRisk,type ScheduleScale as Scale,type SchedulePeriod as Period} from '@/lib/ui/schedule-window';

type WeatherRisk={date:string;severity:'amber'|'red';summary:string};

const iso=(date:Date)=>date.toISOString().slice(0,10);
const utc=(date:string)=>new Date(`${date}T12:00:00Z`);
const addDays=(date:string,amount:number)=>{const next=utc(date);next.setUTCDate(next.getUTCDate()+amount);return iso(next);};
const dayDelta=(from:string,to:string)=>Math.round((utc(to).getTime()-utc(from).getTime())/86400000);
const monday=(date:string)=>addDays(date,-((utc(date).getUTCDay()+6)%7));
const monthStart=(date:string)=>`${date.slice(0,7)}-01`;
const monthEnd=(date:string)=>{const next=utc(monthStart(date));next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);return iso(next);};
const titleCase=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

function phase(item:ScheduleGridItem){
  const source=`${item.packageName||''} ${item.employeeTask||''} ${item.title}`.toLowerCase();
  if(/subgrade|excavat|grading/.test(source))return 'Subgrade';
  if(/footing/.test(source))return 'Footings';
  if(/foundation wall|stem wall|wall/.test(source))return 'Foundation Walls';
  if(/slab|sog/.test(source))return 'Slabs on Grade';
  return titleCase(item.itemType);
}

function canMove(item:ScheduleGridItem){
  return !item.inspectionId&&!item.pourPlanId&&!['in_progress','completed','cancelled'].includes(item.status);
}

function overlap(a:ScheduleGridItem,b:ScheduleGridItem){
  if(!a.startTime||!a.endTime||!b.startTime||!b.endTime)return 'possible';
  return a.startTime<b.endTime&&b.startTime<a.endTime?'certain':null;
}

function periodStats(period:Period,items:ScheduleGridItem[]){
  const current=items.filter(item=>item.scheduleDate>=period.start&&item.scheduleDate<=period.end);
  const pours=new Map<string,number>();
  let knownHours=0,unsizedCrew=0,unidentifiedPumps=0;
  const crewByDay=new Map<string,ScheduleGridItem[]>();
  const pumpByDay=new Map<string,ScheduleGridItem[]>();
  const pumpAssets=new Set<string>();
  for(const item of current){
    if(item.pourYards!==null)pours.set(item.pourPlanId||item.id,item.pourYards);
    const start=item.startTime?Number(item.startTime.slice(0,2))*60+Number(item.startTime.slice(3,5)):null;
    const end=item.endTime?Number(item.endTime.slice(0,2))*60+Number(item.endTime.slice(3,5)):null;
    if(start!==null&&end!==null&&end>start)knownHours+=(end-start)/60*item.assignedCrew.length;
    else unsizedCrew+=item.assignedCrew.length;
    unidentifiedPumps+=item.unidentifiedPumps;
    item.pumpAssetIds.forEach(id=>pumpAssets.add(id));
    crewByDay.set(item.scheduleDate,[...(crewByDay.get(item.scheduleDate)||[]),item]);
    pumpByDay.set(item.scheduleDate,[...(pumpByDay.get(item.scheduleDate)||[]),item]);
  }
  let crewConflict:'certain'|'possible'|null=null;
  let pumpConflict:'certain'|'possible'|null=null;
  for(const dayItems of crewByDay.values()){
    for(let i=0;i<dayItems.length;i++)for(let j=i+1;j<dayItems.length;j++){
      if(!dayItems[i].assignedCrew.some(member=>dayItems[j].assignedCrew.some(other=>other.id===member.id)))continue;
      const result=overlap(dayItems[i],dayItems[j]);
      if(result==='certain')crewConflict='certain';
      else if(result==='possible'&&crewConflict===null)crewConflict='possible';
    }
  }
  for(const dayItems of pumpByDay.values()){
    for(let i=0;i<dayItems.length;i++)for(let j=i+1;j<dayItems.length;j++){
      if(!dayItems[i].pumpAssetIds.some(id=>dayItems[j].pumpAssetIds.includes(id)))continue;
      const result=overlap(dayItems[i],dayItems[j]);
      if(result==='certain')pumpConflict='certain';
      else if(result==='possible'&&pumpConflict===null)pumpConflict='possible';
    }
  }
  return {crewAvailable:current.every(item=>item.crewAssignmentsAvailable),cy:[...pours.values()].reduce((sum,value)=>sum+value,0),knownHours,unsizedCrew,unidentifiedPumps,pumpAssets:pumpAssets.size,crewConflict,pumpConflict,count:current.length};
}

function moveDate(item:ScheduleGridItem,period:Period,scale:Scale){
  if(scale==='day')return period.start;
  if(scale==='week')return addDays(period.start,dayDelta(monday(item.scheduleDate),item.scheduleDate));
  const day=Number(item.scheduleDate.slice(8));
  const last=Number(monthEnd(period.start).slice(8));
  return `${period.start.slice(0,7)}-${String(Math.min(day,last)).padStart(2,'0')}`;
}

export function ScheduleMatrix({days,items,weatherRisks=[],pumpDataAvailable=true,headerActions,notices,renderPhoneWork}:{days:ScheduleGridDay[];items:ScheduleGridItem[];weatherRisks?:WeatherRisk[];pumpDataAvailable?:boolean;headerActions?:ReactNode;notices?:ReactNode;renderPhoneWork?:(items:ScheduleGridItem[])=>ReactNode}){
  const router=useRouter();
  const [scale,setScale]=useState<Scale>('day');
  const [page,setPage]=useState(0);
  const [selectedPeriod,setSelectedPeriod]=useState<string|null>(null);
  const [hoveredPeriod,setHoveredPeriod]=useState<string|null>(null);
  const [selectedItem,setSelectedItem]=useState<string|null>(null);
  const [draggedId,setDraggedId]=useState<string|null>(null);
  const [overrides,setOverrides]=useState<Record<string,string>>({});
  const [pendingId,setPendingId]=useState<string|null>(null);
  const requestIds=useRef(new Map<string,string>());
  const [error,setError]=useState<string|null>(null);
  const [,startTransition]=useTransition();
  useEffect(()=>setOverrides({}),[items]);

  const currentItems=useMemo(()=>items.map(item=>overrides[item.id]?{...item,scheduleDate:overrides[item.id]}:item),[items,overrides]);
  const window=useMemo(()=>scheduleWindow(days,scale,page),[days,scale,page]);
  const periods=window.periods;
  const visibleItems=useMemo(()=>inScheduleWindow(currentItems,window),[currentItems,window]);
  const statsByPeriod=useMemo(()=>new Map(periods.map(period=>[period.key,periodStats(period,currentItems)])),[periods,currentItems]);
  const focus=periods.find(period=>period.key===(hoveredPeriod||selectedPeriod))||periods[0];
  const focusStats=focus?statsByPeriod.get(focus.key):null;
  const selected=visibleItems.find(item=>item.id===selectedItem)||null;
  const projects=useMemo(()=>{
    const grouped=new Map<string,{id:string;name:string;job:string;phases:string[]}>();
    for(const item of visibleItems){
      const current=grouped.get(item.projectId)||{id:item.projectId,name:item.projectName,job:item.jobNumber,phases:[]};
      const itemPhase=phase(item);
      if(!current.phases.includes(itemPhase))current.phases.push(itemPhase);
      grouped.set(item.projectId,current);
    }
    return [...grouped.values()].sort((a,b)=>a.job.localeCompare(b.job));
  },[visibleItems]);
  const itemsByLane=useMemo(()=>{
    const lanes=new Map<string,ScheduleGridItem[]>();
    for(const item of currentItems){const key=`${item.projectId}:${phase(item)}`;lanes.set(key,[...(lanes.get(key)||[]),item]);}
    return lanes;
  },[currentItems]);
  const colWidth=scale==='day'?164:scale==='week'?210:260;
  const gridStyle={gridTemplateColumns:`208px repeat(${periods.length}, ${colWidth}px)`,minWidth:208+periods.length*colWidth};

  function move(item:ScheduleGridItem,target:Period,targetScale:Scale=scale){
    if(!canMove(item))return;
    const date=moveDate(item,target,targetScale);
    if(date===item.scheduleDate)return;
    setOverrides(current=>({...current,[item.id]:date}));
    setPendingId(item.id);
    setError(null);
    startTransition(async()=>{
      try{
        const key=`${item.id}:${item.revision}:${date}`;let request=requestIds.current.get(key);if(!request){request=crypto.randomUUID();requestIds.current.set(key,request);}
        const data=new FormData();data.set('request_id',request);data.set('expected_revision',String(item.revision??''));data.set('id',item.id);data.set('schedule_date',date);
        await rescheduleScheduleItem(data);
        router.refresh();
      }catch(cause){
        setOverrides(current=>{const next={...current};delete next[item.id];return next;});
        setError(cause instanceof Error?cause.message:'The schedule move failed.');
      }finally{setPendingId(null);}
    });
  }

  function weather(period:Period){return weatherRisks.filter(risk=>risk.date>=period.start&&risk.date<=period.end);}
  function changePage(next:number){setPage(next);setSelectedPeriod(null);setHoveredPeriod(null);}
  const focusItems=focus?currentItems.filter(item=>item.scheduleDate>=focus.start&&item.scheduleDate<=focus.end):[];
  return <div className={styles.workspace}>
    <header className={styles.toolbar}>
      <h2>Schedule</h2>
      <div className={styles.scales} role="group" aria-label="Timeline scale">{(['day','week','month'] as Scale[]).map(value=><Button key={value} type="button" size="small" appearance={scale===value?'primary':'subtle'} aria-pressed={scale===value} onClick={()=>{setScale(value);changePage(0);}}>{titleCase(value)}</Button>)}</div>
      <div className={styles.range} aria-live="polite"><strong>{window.label}</strong><span>{visibleItems.length} work block{visibleItems.length===1?'':'s'} · {projects.length} project{projects.length===1?'':'s'}</span></div>
      <div className={styles.periodControls} role="group" aria-label="Schedule period"><Button type="button" size="small" appearance="subtle" icon={<ChevronLeft/>} disabled={!window.hasPrevious} aria-label="Previous schedule period" onClick={()=>changePage(window.index-1)}/><Button type="button" size="small" appearance="subtle" icon={<ChevronRight/>} disabled={!window.hasNext} aria-label="Next schedule period" onClick={()=>changePage(window.index+1)}/><Button type="button" size="small" appearance="outline" disabled={!window.hasPrevious} onClick={()=>changePage(0)}>{days.some(day=>day.isToday)?'Today':'First loaded period'}</Button></div>
      {headerActions?<div className={styles.headerActions}>{headerActions}</div>:null}
    </header>
    {notices}
    {error?<p role="alert" className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}
    <p className="sr-only" role="status" aria-live="polite">{focus&&focusStats?`${focus.label}: ${focusStats.cy.toFixed(1)} CY, ${focusStats.crewAvailable?`${focusStats.knownHours.toFixed(1)} crew hours`:'Crew assignments unavailable'}, ${pumpDataAvailable?`${focusStats.pumpAssets} pump assets`:'pumps unavailable'}.`:''}</p>
    {renderPhoneWork?.(visibleItems)}
    <div className={styles.layout}>
      <div className={styles.timeline} aria-label="Schedule timeline" tabIndex={0}>
        <div className={`${styles.grid} ${styles.head}`} style={gridStyle}>
          <div className={styles.lane}>Project / work phase</div>
          {periods.map(period=>{const stats=statsByPeriod.get(period.key)!;const risks=weather(period);return <Button appearance="subtle" key={period.key} type="button" aria-pressed={selectedPeriod===period.key} onMouseEnter={()=>setHoveredPeriod(period.key)} onMouseLeave={()=>setHoveredPeriod(null)} onFocus={()=>setHoveredPeriod(period.key)} onClick={()=>setSelectedPeriod(period.key)} title={`${period.label}: ${stats.cy.toFixed(1)} CY${risks.length?` · Weather: ${risks.map(risk=>risk.summary).join(', ')}`:''}`} className={`${styles.day} ${selectedPeriod===period.key?styles.daySelected:''}`}><span>{period.label}</span><small>{stats.cy.toFixed(0)} CY · {stats.count} blocks</small></Button>;})}
        </div>
        {projects.length===0?<div className={styles.empty}>No scheduled work in this period. Use the period controls to view later loaded dates or Schedule work to place a block.</div>:projects.map(project=><div key={project.id}>
          <div className={styles.project}><strong>{project.job}</strong>{project.name}</div>
          {project.phases.map(projectPhase=><div key={`${project.id}:${projectPhase}`} className={`${styles.grid} ${styles.row}`} style={gridStyle}>
            <div className={styles.lane}>{projectPhase}</div>
            {periods.map(period=>{const risks=weather(period);const cellItems=(itemsByLane.get(`${project.id}:${projectPhase}`)||[]).filter(item=>item.scheduleDate>=period.start&&item.scheduleDate<=period.end);return <div key={period.key} onDragOver={event=>{if(draggedId)event.preventDefault();}} onDrop={event=>{event.preventDefault();const id=draggedId||event.dataTransfer.getData('text/plain');const item=currentItems.find(value=>value.id===id);if(item)move(item,period);setDraggedId(null);}} onMouseEnter={()=>setHoveredPeriod(period.key)} onMouseLeave={()=>setHoveredPeriod(null)} className={`${styles.cell} ${risks.some(risk=>risk.severity==='red')?styles.severeWeather:risks.length?styles.weather:''}`}>
              <div className={styles.events}>{cellItems.map(item=><Button appearance="subtle" key={item.id} type="button" draggable={canMove(item)&&pendingId!==item.id} onDragStart={event=>{setDraggedId(item.id);event.dataTransfer.setData('text/plain',item.id);event.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDraggedId(null)} onClick={()=>{setSelectedItem(item.id);setSelectedPeriod(period.key);}} title={`${item.title} · ${item.scheduleDate}${canMove(item)?' · drag to reschedule':' · source-controlled date'}`} className={`${styles.event} ${item.blocked?styles.blocked:''} ${item.crewShort?styles.shortCrew:''} ${selectedItem===item.id?styles.eventSelected:''} ${pendingId===item.id?styles.pending:''}`}><GripVertical className="size-3 shrink-0"/><span className={styles.eventText}><span>{item.title}</span>{staffingRisk(item.crewShort)?<small className={styles.eventRisk}>Staffing risk: {staffingRisk(item.crewShort)}</small>:null}</span>{item.pourYards!==null?<span className={styles.eventQuantity}>{item.pourYards.toFixed(0)} CY</span>:null}</Button>)}</div>
            </div>;})}
          </div>)}
        </div>)}
        <div className={`${styles.grid} ${styles.footer}`} style={gridStyle}>
          <div className={styles.lane}>Crew & equipment</div>
          {periods.map(period=>{const stats=statsByPeriod.get(period.key)!;const risk=stats.crewConflict==='certain'||stats.pumpConflict==='certain'?'certain':stats.crewConflict||stats.pumpConflict;return <div key={period.key} className={`${styles.allocation} ${risk==='certain'?styles.conflict:risk==='possible'||stats.unidentifiedPumps?styles.possibleConflict:''}`}><div>{stats.crewAvailable?`${stats.knownHours.toFixed(1)} crew h`:'Crew assignments unavailable'}{stats.crewAvailable&&stats.unsizedCrew?` · ${stats.unsizedCrew} without times`:''}</div><div>{pumpDataAvailable?`${stats.pumpAssets} pump assets${stats.unidentifiedPumps?` · ${stats.unidentifiedPumps} unidentified`:''}`:'Pumps unavailable'}</div>{stats.crewAvailable&&stats.crewConflict?<div>Crew {stats.crewConflict==='certain'?'double-booked':'possible overlap'}</div>:null}{stats.pumpConflict?<div>Pump {stats.pumpConflict==='certain'?'requirement overlap':'possible overlap'}</div>:null}</div>;})}
        </div>
      </div>
      <aside className={styles.agenda} aria-label="Selected period agenda">
        <h3>{focus?.label||'Schedule'}</h3>
        <dl className={styles.metrics}><div><dt>Work blocks</dt><dd>{focusStats?.count||0}</dd></div><div><dt>Linked pours</dt><dd>{focusStats?.cy.toFixed(1)||'0.0'} <small>CY</small></dd></div></dl>
        <div className={styles.agendaList}>{focusItems.length?focusItems.map(item=><Button key={item.id} type="button" appearance="subtle" aria-pressed={selectedItem===item.id} className={styles.agendaItem} onClick={()=>setSelectedItem(item.id)}><span>{item.startTime||'Time not set'} · {item.jobNumber}</span><strong>{item.title}</strong><span>Schedule: {titleCase(item.status)}</span>{item.readinessUnavailable&&!item.blocked?<span className={styles.risk}>Readiness unavailable</span>:null}{item.blocked?<span className={styles.risk}>Readiness hold{item.readinessAction?`: ${item.readinessAction}`:''}</span>:null}{staffingRisk(item.crewShort)?<span className={styles.risk}>Staffing risk: {staffingRisk(item.crewShort)}</span>:null}</Button>):<p className="text-sm text-muted-foreground">No work in this period.</p>}</div>
        <p className={styles.guidance}><CloudOff className="inline size-3"/> {weatherRisks.length?'Forecast risk overlay':'Forecast unavailable'}</p>
      </aside>
    </div>
    {selected?<section className={`pt-inline-detail ${styles.detail}`} aria-label="Selected work detail">
      <h3>{selected.title}</h3><p>{selected.jobNumber} — {selected.projectName} · {selected.scheduleDate} · {titleCase(selected.status)}</p>
      <p>{!selected.crewAssignmentsAvailable?'Crew assignments unavailable':selected.assignedCrew.length?selected.assignedCrew.map(member=>member.name).join(', '):'Crew unassigned'}{selected.notes?` · ${selected.notes.replaceAll('\n',' · ')}`:''}</p>{staffingRisk(selected.crewShort)?<p className={styles.risk}>Staffing risk: {staffingRisk(selected.crewShort)}</p>:null}
      {selected.readinessAction?<p><strong>{selected.blocked?'Hold: ':''}</strong>{selected.readinessAction}</p>:null}
      <div className={styles.detailActions}>{canMove(selected)?<><Button appearance="outline" type="button" icon={<ChevronLeft/>} aria-label="Move work one day earlier" onClick={()=>move(selected,{key:'previous',label:'Previous day',start:addDays(selected.scheduleDate,-1),end:addDays(selected.scheduleDate,-1)},'day')}/><Button appearance="outline" type="button" icon={<ChevronRight/>} aria-label="Move work one day later" onClick={()=>move(selected,{key:'next',label:'Next day',start:addDays(selected.scheduleDate,1),end:addDays(selected.scheduleDate,1)},'day')}/></>:<span>Source-controlled date</span>}<Button as="a" href={selected.openHref} appearance="primary">Open work</Button></div>
    </section>:null}
    <details className="pt-help"><summary>Schedule calculations</summary><p>Crew hours use assigned people with known time windows. Pump conflicts use identified equipment requirements. Forecast indicators require connected forecast data.</p></details>
  </div>;
}
