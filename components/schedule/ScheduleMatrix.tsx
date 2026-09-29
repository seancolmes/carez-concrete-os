'use client';

import {useEffect,useMemo,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle,ChevronLeft,ChevronRight,CloudOff,GripVertical} from 'lucide-react';
import {rescheduleScheduleItem} from '@/app/schedule/actions';
import type {ScheduleGridDay,ScheduleGridItem} from './ScheduleGrid';

type Scale='day'|'week'|'month';
type Period={key:string;label:string;start:string;end:string};
type WeatherRisk={date:string;severity:'amber'|'red';summary:string};

const iso=(date:Date)=>date.toISOString().slice(0,10);
const utc=(date:string)=>new Date(`${date}T12:00:00Z`);
const addDays=(date:string,amount:number)=>{const next=utc(date);next.setUTCDate(next.getUTCDate()+amount);return iso(next);};
const dayDelta=(from:string,to:string)=>Math.round((utc(to).getTime()-utc(from).getTime())/86400000);
const dayLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(utc(date));
const monthLabel=(date:string)=>new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(utc(date));
const monday=(date:string)=>addDays(date,-((utc(date).getUTCDay()+6)%7));
const monthStart=(date:string)=>`${date.slice(0,7)}-01`;
const monthEnd=(date:string)=>{const next=utc(monthStart(date));next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);return iso(next);};
const titleCase=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

function periodsFor(scale:Scale,days:ScheduleGridDay[]):Period[]{
  if(scale==='day')return days.slice(0,14).map(day=>({key:day.date,label:day.label,start:day.date,end:day.date}));
  const starts=new Set<string>();
  for(const day of days)starts.add(scale==='week'?monday(day.date):monthStart(day.date));
  return [...starts].map(start=>({
    key:start,
    label:scale==='week'?`${dayLabel(start)} – ${dayLabel(addDays(start,6))}`:monthLabel(start),
    start,
    end:scale==='week'?addDays(start,6):monthEnd(start),
  }));
}

function phase(item:ScheduleGridItem){
  const source=`${item.packageName||''} ${item.employeeTask||''} ${item.title}`.toLowerCase();
  if(/subgrade|excavat|grading/.test(source))return 'Subgrade';
  if(/footing/.test(source))return 'Footings';
  if(/foundation wall|stem wall|wall/.test(source))return 'Foundation Walls';
  if(/slab|sog/.test(source))return 'Slabs on Grade';
  return titleCase(item.itemType);
}

function phaseTone(value:string){
  if(value==='Subgrade')return 'border-[#A88D56] bg-[#695931]/75 text-[#F4DEB0]';
  if(value==='Footings')return 'border-[#5E9CC4] bg-[#2B5876]/80 text-[#C7E6FA]';
  if(value==='Foundation Walls')return 'border-[#9D82C7] bg-[#594571]/80 text-[#E6D7FB]';
  if(value==='Slabs on Grade')return 'border-[#48A891] bg-[#205E50]/80 text-[#D2F3E9]';
  return 'border-[#697982] bg-[#364148]/80 text-[#DEE6E9]';
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
  return {cy:[...pours.values()].reduce((sum,value)=>sum+value,0),knownHours,unsizedCrew,unidentifiedPumps,pumpAssets:pumpAssets.size,crewConflict,pumpConflict,count:current.length};
}

function moveDate(item:ScheduleGridItem,period:Period,scale:Scale){
  if(scale==='day')return period.start;
  if(scale==='week')return addDays(period.start,dayDelta(monday(item.scheduleDate),item.scheduleDate));
  const day=Number(item.scheduleDate.slice(8));
  const last=Number(monthEnd(period.start).slice(8));
  return `${period.start.slice(0,7)}-${String(Math.min(day,last)).padStart(2,'0')}`;
}

export function ScheduleMatrix({days,items,weatherRisks=[],pumpDataAvailable=true}:{days:ScheduleGridDay[];items:ScheduleGridItem[];weatherRisks?:WeatherRisk[];pumpDataAvailable?:boolean}){
  const router=useRouter();
  const [scale,setScale]=useState<Scale>('day');
  const [selectedPeriod,setSelectedPeriod]=useState<string|null>(null);
  const [hoveredPeriod,setHoveredPeriod]=useState<string|null>(null);
  const [selectedItem,setSelectedItem]=useState<string|null>(null);
  const [draggedId,setDraggedId]=useState<string|null>(null);
  const [overrides,setOverrides]=useState<Record<string,string>>({});
  const [pendingId,setPendingId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [,startTransition]=useTransition();
  useEffect(()=>setOverrides({}),[items]);

  const currentItems=useMemo(()=>items.map(item=>overrides[item.id]?{...item,scheduleDate:overrides[item.id]}:item),[items,overrides]);
  const periods=useMemo(()=>periodsFor(scale,days),[scale,days]);
  const statsByPeriod=useMemo(()=>new Map(periods.map(period=>[period.key,periodStats(period,currentItems)])),[periods,currentItems]);
  const focus=periods.find(period=>period.key===(hoveredPeriod||selectedPeriod))||periods[0];
  const focusStats=focus?statsByPeriod.get(focus.key):null;
  const selected=currentItems.find(item=>item.id===selectedItem)||null;
  const projects=useMemo(()=>{
    const grouped=new Map<string,{id:string;name:string;job:string;phases:string[]}>();
    for(const item of currentItems){
      const current=grouped.get(item.projectId)||{id:item.projectId,name:item.projectName,job:item.jobNumber,phases:[]};
      const itemPhase=phase(item);
      if(!current.phases.includes(itemPhase))current.phases.push(itemPhase);
      grouped.set(item.projectId,current);
    }
    return [...grouped.values()].sort((a,b)=>a.job.localeCompare(b.job));
  },[currentItems]);
  const itemsByLane=useMemo(()=>{
    const lanes=new Map<string,ScheduleGridItem[]>();
    for(const item of currentItems){const key=`${item.projectId}:${phase(item)}`;lanes.set(key,[...(lanes.get(key)||[]),item]);}
    return lanes;
  },[currentItems]);
  const colWidth=scale==='day'?126:scale==='week'?174:210;
  const gridStyle={gridTemplateColumns:`220px repeat(${periods.length}, ${colWidth}px)`,minWidth:220+periods.length*colWidth};

  function move(item:ScheduleGridItem,target:Period,targetScale:Scale=scale){
    if(!canMove(item))return;
    const date=moveDate(item,target,targetScale);
    if(date===item.scheduleDate)return;
    setOverrides(current=>({...current,[item.id]:date}));
    setPendingId(item.id);
    setError(null);
    startTransition(async()=>{
      try{
        const data=new FormData();data.set('id',item.id);data.set('schedule_date',date);
        await rescheduleScheduleItem(data);
        router.refresh();
      }catch(cause){
        setOverrides(current=>{const next={...current};delete next[item.id];return next;});
        setError(cause instanceof Error?cause.message:'The schedule move failed.');
      }finally{setPendingId(null);}
    });
  }

  function weather(period:Period){return weatherRisks.filter(risk=>risk.date>=period.start&&risk.date<=period.end);}
  const stripe='bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_6px,rgba(245,158,11,0.13)_6px,rgba(245,158,11,0.13)_8px)]';
  const severeStripe='bg-[repeating-linear-gradient(135deg,transparent_0px,transparent_6px,rgba(239,68,68,0.16)_6px,rgba(239,68,68,0.16)_8px)]';

  return <div className="ambient-glow min-w-0 text-[11px] text-[#8B949E]">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="Timeline scale">{(['day','week','month'] as Scale[]).map(value=><button key={value} type="button" aria-pressed={scale===value} onClick={()=>{setScale(value);setHoveredPeriod(null);setSelectedPeriod(null);}} className={`border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${scale===value?'border-[#009966] bg-[#009966]/15 text-[#009966]':'border-[#343A3F] bg-[#181A1B] text-[#8B949E] hover:text-white'}`}>{value}</button>)}</div>
      <div className="flex flex-wrap gap-x-3 font-mono text-[10px] uppercase"><span>{items.length} work blocks</span><span>{projects.length} projects</span><span>{days[0]?.label} – {days[days.length-1]?.label}</span></div>
    </div>
    <div className="mb-2 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1 border-y border-[#343A3F] px-2 font-mono text-[10px] uppercase tabular-nums" aria-live="polite">
      <strong className="text-[#E1E7E3]">{focus?.label||'No period'}</strong>
      <span className="text-[#009966]">{focusStats?.cy.toFixed(1)||'0.0'} CY linked pours</span>
      <span>{focusStats?.knownHours.toFixed(1)||'0.0'} known crew h</span>
      <span>{pumpDataAvailable?`${focusStats?.pumpAssets||0} identified pump assets`:'Pump requirements unavailable'}</span>
      <span className="flex items-center gap-1 text-[#8B949E]"><CloudOff className="size-3"/> {weatherRisks.length?'Forecast risk overlay':'Forecast unavailable'}</span>
    </div>
    {error?<p role="alert" className="mb-2 border border-red-600/60 px-2 py-1 text-[11px] text-red-300">{error}</p>:null}
    <div className="max-h-[61vh] overflow-auto border border-[#343A3F] bg-[#181A1B]" aria-label="Schedule timeline">
      <div className="grid sticky top-0 z-20 border-b border-[#343A3F] bg-[#1D2123]" style={gridStyle}>
        <div className="sticky left-0 z-30 flex h-9 items-center border-r border-[#343A3F] bg-[#1D2123] px-3 font-mono text-[10px] uppercase">Project / concrete phase</div>
        {periods.map(period=>{const stats=statsByPeriod.get(period.key)!;const risks=weather(period);return <button key={period.key} type="button" aria-pressed={selectedPeriod===period.key} onMouseEnter={()=>setHoveredPeriod(period.key)} onMouseLeave={()=>setHoveredPeriod(null)} onFocus={()=>setHoveredPeriod(period.key)} onClick={()=>setSelectedPeriod(period.key)} title={`${period.label}: ${stats.cy.toFixed(1)} CY${risks.length?` · Weather: ${risks.map(risk=>risk.summary).join(', ')}`:''}`} className={`h-9 min-w-0 border-r border-[#343A3F] px-2 text-left font-mono text-[10px] ${selectedPeriod===period.key?'bg-[#009966]/15 text-[#009966]':'text-[#B6BEBA] hover:bg-[#25292C]'}`}><span className="block truncate">{period.label}</span><span className="text-[9px] text-[#6F7A80]">{stats.cy.toFixed(0)} CY · {stats.count} blocks</span></button>;})}
      </div>
      {projects.length===0?<div className="p-6 text-[12px] text-[#8B949E]">No scheduled work in this horizon. Use + Schedule Work to place the first block.</div>:projects.map(project=><div key={project.id}>
        <div className="grid border-b border-[#343A3F] bg-[#202426]" style={gridStyle}><div className="sticky left-0 z-10 col-span-full flex h-7 items-center gap-2 bg-[#202426] px-3 font-mono text-[10px] uppercase"><strong className="text-[#E1E7E3]">{project.job}</strong><span className="truncate">{project.name}</span></div></div>
        {project.phases.map(projectPhase=><div key={`${project.id}:${projectPhase}`} className="grid border-b border-[#25292C]" style={gridStyle}>
          <div className="sticky left-0 z-10 flex min-h-10 items-center border-r border-[#343A3F] bg-[#181A1B] px-3 font-medium text-[#B6BEBA]">{projectPhase}</div>
          {periods.map(period=>{const risks=weather(period);const cellItems=(itemsByLane.get(`${project.id}:${projectPhase}`)||[]).filter(item=>item.scheduleDate>=period.start&&item.scheduleDate<=period.end);return <div key={period.key} onDragOver={event=>{if(draggedId)event.preventDefault();}} onDrop={event=>{event.preventDefault();const id=draggedId||event.dataTransfer.getData('text/plain');const item=currentItems.find(value=>value.id===id);if(item)move(item,period);setDraggedId(null);}} onMouseEnter={()=>setHoveredPeriod(period.key)} onMouseLeave={()=>setHoveredPeriod(null)} className={`min-h-10 min-w-0 border-r border-[#25292C] p-1 ${risks.some(risk=>risk.severity==='red')?severeStripe:risks.length?stripe:''} ${selectedPeriod===period.key?'bg-[#009966]/5':''}`}>
            <div className="flex flex-col gap-1">{cellItems.map(item=><button key={item.id} type="button" draggable={canMove(item)&&pendingId!==item.id} onDragStart={event=>{setDraggedId(item.id);event.dataTransfer.setData('text/plain',item.id);event.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDraggedId(null)} onClick={()=>{setSelectedItem(item.id);setSelectedPeriod(period.key);}} title={`${item.title} · ${item.scheduleDate}${canMove(item)?' · drag to reschedule':' · source-controlled date'}`} className={`flex h-6 min-w-0 items-center gap-1 border-l-2 px-1.5 text-left text-[10px] font-medium shadow-sm transition-colors hover:brightness-125 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white ${phaseTone(projectPhase)} ${item.blocked?'!border-red-500 !bg-red-900/60':item.crewShort?'!border-amber-500':''} ${selectedItem===item.id?'outline outline-1 outline-white/70':''} ${canMove(item)?'cursor-grab active:cursor-grabbing':'cursor-pointer'} ${pendingId===item.id?'opacity-50':''}`}><GripVertical className="size-2.5 shrink-0 opacity-50"/><span className="truncate">{item.title}</span>{item.pourYards!==null?<span className="ml-auto shrink-0 font-mono">{item.pourYards.toFixed(0)} CY</span>:null}</button>)}</div>
          </div>;})}
        </div>)}
      </div>)}
      <div className="grid sticky bottom-0 z-20 border-t border-[#343A3F] bg-[#1D2123]" style={gridStyle}>
        <div className="sticky left-0 z-30 flex min-h-14 items-center border-r border-[#343A3F] bg-[#1D2123] px-3 font-mono text-[10px] uppercase text-[#E1E7E3]">Allocation ticker</div>
        {periods.map(period=>{const stats=statsByPeriod.get(period.key)!;const risk=stats.crewConflict==='certain'||stats.pumpConflict==='certain'?'certain':stats.crewConflict||stats.pumpConflict;return <div key={period.key} onMouseEnter={()=>setHoveredPeriod(period.key)} onMouseLeave={()=>setHoveredPeriod(null)} className={`min-h-14 border-r px-2 py-1 font-mono text-[9px] leading-4 ${risk==='certain'?'border-red-500 bg-red-950/30 text-red-300 animate-pulse motion-reduce:animate-none':risk==='possible'||stats.unidentifiedPumps?'border-amber-500 bg-amber-950/25 text-amber-300 animate-pulse motion-reduce:animate-none':'border-[#343A3F] text-[#8B949E]'}`}><div>{stats.knownHours.toFixed(1)} crew h{stats.unsizedCrew?` · ${stats.unsizedCrew} unsized`:''}</div><div>{pumpDataAvailable?`${stats.pumpAssets} pump assets${stats.unidentifiedPumps?` · ${stats.unidentifiedPumps} unidentified`:''}`:'Pumps unavailable'}</div>{stats.crewConflict?<div className="flex items-center gap-1"><AlertTriangle className="size-2.5"/>Crew {stats.crewConflict==='certain'?'double-booked':'possible overlap'}</div>:null}{stats.pumpConflict?<div className="flex items-center gap-1"><AlertTriangle className="size-2.5"/>Pump {stats.pumpConflict==='certain'?'requirement overlap':'possible overlap'}</div>:null}</div>;})}
      </div>
    </div>
    {selected?<div className="edge-lit-border mt-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]"><div className="min-w-0"><strong className="text-[#E1E7E3]">{selected.title}</strong><span className="ml-2 font-mono">{selected.jobNumber} · {selected.scheduleDate} · {selected.status}</span><div className="truncate text-[#8B949E]">{selected.assignedCrew.length?selected.assignedCrew.map(member=>member.name).join(', '):'Crew unassigned'}{selected.notes?` · ${selected.notes.replaceAll('\n',' · ')}`:''}</div></div><div className="flex items-center gap-2">{canMove(selected)?<><button type="button" aria-label="Move work one day earlier" onClick={()=>move(selected,{key:'previous',label:'Previous day',start:addDays(selected.scheduleDate,-1),end:addDays(selected.scheduleDate,-1)},'day')} className="border border-[#343A3F] p-1 hover:text-white"><ChevronLeft className="size-3.5"/></button><button type="button" aria-label="Move work one day later" onClick={()=>move(selected,{key:'next',label:'Next day',start:addDays(selected.scheduleDate,1),end:addDays(selected.scheduleDate,1)},'day')} className="border border-[#343A3F] p-1 hover:text-white"><ChevronRight className="size-3.5"/></button></>:<span title="Linked or active work must be rescheduled from its source record">Source-controlled date</span>}<a href={selected.openHref} className="font-semibold text-[#009966] hover:underline">Open work</a></div></div>:null}
    <p className="mt-2 font-mono text-[10px] text-[#6F7A80]">Crew hours use assigned people with known time windows. Pump conflicts use identified equipment requirements. Forecast stripes appear only when forecast data is connected.</p>
  </div>;
}
