'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {
  AlertTriangle,CalendarDays,ChevronRight,CircleDollarSign,FilterX,HardHat,
  List,MoreHorizontal,Search,SlidersHorizontal,Wallet,X
} from 'lucide-react';

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

export type JobsBoardMetrics={
  ready:number;
  holds:number;
  attention:number;
  fieldJobs:number;
  activeShifts:number;
  customersOwe:number;
  overdue:number;
};

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const shortDate=(v:string|null)=>v?new Date(`${v.slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
const titleCase=(v:string)=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase());

const stateMeta={
  ready:{label:'Ready',tone:'success'},
  hold:{label:'Hold',tone:'danger'},
  planning:{label:'In Progress',tone:'active'},
  setup:{label:'Waiting',tone:'warning'},
  completed:{label:'Complete',tone:'success'},
} as const;

function priorityFor(row:JobsBoardRow){
  if(row.state==='hold')return{label:'Critical',tone:'danger'};
  if(row.attention)return{label:'High',tone:'warning'};
  return{label:'Normal',tone:'muted'};
}

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
      if(sort==='schedule')return (a.scheduleDate||'9999').localeCompare(b.scheduleDate||'9999');
      if(sort==='budget')return b.budgetUsed-a.budgetUsed;
      if(sort==='owed')return b.customerOwed-a.customerOwed;
      if(sort==='name')return a.name.localeCompare(b.name);
      return rank(a)-rank(b)||(a.scheduleDate||'9999').localeCompare(b.scheduleDate||'9999');
    });
    return result;
  },[rows,query,status,stage,attention,sort]);

  const selected=selectedId?rows.find(row=>row.id===selectedId)||null:null;
  const clearFilters=()=>{setQuery('');setStatus('active');setStage('all');setAttention('all');setSort('priority');};

  return <>
    <section className="jobs-b2-kpis" aria-label="Job operations metrics">
      <Kpi label="Ready to Move" value={String(metrics.ready)} help="Jobs with a physical operation ready to start." tone={metrics.ready?'success':'neutral'}/>
      <Kpi label="Hard Holds" value={String(metrics.holds)} help="Setup, inspection or prerequisites block work." tone={metrics.holds?'danger':'neutral'}/>
      <Kpi label="Needs Attention" value={String(metrics.attention)} help="Field, labor, billing or budget exceptions." tone={metrics.attention?'warning':'neutral'}/>
      <Kpi label="Crews Active" value={String(metrics.fieldJobs)} help={`${metrics.activeShifts} active field shift${metrics.activeShifts===1?'':'s'}; crew grouping is not yet modeled.`} tone={metrics.fieldJobs?'active':'neutral'}/>
      <Kpi label="Customers Owe" value={money(metrics.customersOwe)} help={metrics.overdue?`${money(metrics.overdue)} is past due.`:'No overdue customer balance.'} tone={metrics.overdue?'danger':metrics.customersOwe?'warning':'neutral'}/>
    </section>

    <section className="jobs-b2-toolbar" aria-label="Job table controls">
      <label className="jobs-b2-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search jobs..." aria-label="Search jobs"/></label>
      <label><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Active Jobs</option><option value="ready">Ready</option><option value="hold">Hold</option><option value="planning">In Progress</option><option value="setup">Waiting</option><option value="completed">Complete</option><option value="all">All Jobs</option></select></label>
      <label><span>Stage</span><select value={stage} onChange={e=>setStage(e.target.value)}><option value="all">All Stages</option>{stages.map(item=><option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
      <label><span>Attention</span><select value={attention} onChange={e=>setAttention(e.target.value)}><option value="all">All</option><option value="attention">Needs Attention</option><option value="clear">Clear</option></select></label>
      <div className="jobs-b2-toolbar-spacer"/>
      <label className="jobs-b2-sort"><SlidersHorizontal/><select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort jobs"><option value="priority">Priority</option><option value="schedule">Schedule</option><option value="budget">Budget Used</option><option value="owed">Customers Owe</option><option value="name">Job Name</option></select></label>
      <button type="button" className="jobs-b2-icon-button" onClick={clearFilters} title="Reset filters"><FilterX/></button>
      <button type="button" className="jobs-b2-icon-button active" title="Table view" aria-label="Table view"><List/></button>
    </section>

    <section className={`jobs-b2-workspace ${selected?'has-inspector':''}`}>
      <div className="jobs-b2-table-shell">
        <div className="jobs-b2-table-title"><div><span>ACTIVE JOBS</span><strong>{filtered.length}</strong></div><small>Single-click a row for job context. Double-click to open the job.</small></div>
        <div className="jobs-b2-table-scroll">
          <table className="jobs-b2-table">
            <thead><tr><th>Job / Client</th><th>Status</th><th>Next Step</th><th>Schedule</th><th>Crew</th><th>Budget</th><th>Customers Owe</th><th>Priority</th><th aria-label="Actions"/></tr></thead>
            <tbody>
              {filtered.map(row=>{
                const sm=stateMeta[row.state],priority=priorityFor(row),selectedRow=selectedId===row.id;
                return <tr key={row.id} className={selectedRow?'selected':''} onClick={()=>setSelectedId(row.id)} onDoubleClick={()=>router.push(`/projects/${row.id}`)} tabIndex={0} onKeyDown={event=>{if(event.key==='Enter')router.push(`/projects/${row.id}`)}}>
                  <td className="jobs-b2-job"><span className="jobs-b2-job-number">{row.jobNumber||'—'}</span><div><strong>{row.name}</strong><span>{row.customer}</span><small>{row.location}</small></div></td>
                  <td><span className={`jobs-b2-status ${sm.tone}`}><i/>{sm.label}</span></td>
                  <td className="jobs-b2-next"><strong>{row.nextStep}</strong>{row.reasons[0]&&row.attention?<small>{row.reasons[0]}</small>:null}</td>
                  <td className="jobs-b2-numeric"><strong>{shortDate(row.scheduleDate)}</strong><span>{row.scheduleDate?'Next field date':'Not scheduled'}</span></td>
                  <td><strong>{row.activeShifts?`${row.activeShifts} active`:'—'}</strong><span>{row.pendingTimecards?`${row.pendingTimecards} timecard review`:row.gpsExceptions?`${row.gpsExceptions} GPS review`:'No active shift'}</span></td>
                  <td className="jobs-b2-budget"><strong>{row.budgetUsed?`${row.budgetUsed.toFixed(0)}%`:'—'}</strong><div><i style={{width:`${Math.max(0,Math.min(100,row.budgetUsed))}%`}}/></div><span>{row.laborRemaining?`${row.laborRemaining.toFixed(1)} MH left`:'Budget summary only'}</span></td>
                  <td className="jobs-b2-numeric"><strong className={row.overdue?'danger':''}>{money(row.customerOwed)}</strong><span>{row.overdue?`${money(row.overdue)} late`:'Outstanding AR'}</span></td>
                  <td><span className={`jobs-b2-priority ${priority.tone}`}><i/>{priority.label}</span></td>
                  <td className="jobs-b2-row-action"><details onClick={event=>event.stopPropagation()}><summary aria-label={`Actions for ${row.name}`}><MoreHorizontal/></summary><div><Link href={`/projects/${row.id}`}>Open Job</Link><Link href="/schedule">Schedule</Link>{row.state==='hold'&&<Link href="/readiness">Clear Hold</Link>}{row.pendingTimecards>0&&<Link href="/field/review">Review Time</Link>}{row.customerOwed>0&&<Link href="/billing">Billing</Link>}</div></details></td>
                </tr>;
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div className="jobs-b2-empty"><strong>No jobs match this view</strong><span>Adjust the filters, or create a direct job if this work is outside the normal accepted-proposal workflow.</span></div>}
        </div>
      </div>

      {selected&&<JobInspector row={selected} onClose={()=>setSelectedId(null)}/>} 
    </section>
  </>;
}

function Kpi({label,value,help,tone}:{label:string;value:string;help:string;tone:string}){
  return <div className={`jobs-b2-kpi ${tone}`}><span>{label}</span><strong>{value}</strong><small>{help}</small></div>;
}

function JobInspector({row,onClose}:{row:JobsBoardRow;onClose:()=>void}){
  const sm=stateMeta[row.state],priority=priorityFor(row);
  return <aside className="jobs-b2-inspector" aria-label={`Job inspector for ${row.name}`}>
    <header><div><span>JOB INSPECTOR</span><strong>{row.name}</strong><small>{row.jobNumber||'No job number'} · {row.customer}</small></div><button type="button" onClick={onClose} aria-label="Close job inspector"><X/></button></header>
    <div className="jobs-b2-inspector-scroll">
      <section><div className="jobs-b2-inspector-section-title">OPERATIONS</div><dl>
        <div><dt>Status</dt><dd><span className={`jobs-b2-status ${sm.tone}`}><i/>{sm.label}</span></dd></div>
        <div><dt>Priority</dt><dd><span className={`jobs-b2-priority ${priority.tone}`}><i/>{priority.label}</span></dd></div>
        <div><dt>Project manager</dt><dd className="muted">Not exposed by the current project summary</dd></div>
        <div><dt>Foreman / crew</dt><dd>{row.activeShifts?`${row.activeShifts} active field shift${row.activeShifts===1?'':'s'}`:<span className="muted">No active field shift</span>}</dd></div>
      </dl></section>

      <section><div className="jobs-b2-inspector-section-title">NEXT OPERATION</div><div className="jobs-b2-next-card"><ChevronRight/><div><strong>{row.nextStep}</strong><span>{row.scheduleDate?shortDate(row.scheduleDate):'Not scheduled'}</span></div></div>{row.reasons.length>0&&<div className="jobs-b2-constraints"><span>CURRENT CONSTRAINT</span>{row.reasons.map((reason,index)=><p key={index}><AlertTriangle/>{reason}</p>)}</div>}</section>

      <section><div className="jobs-b2-inspector-section-title">READINESS</div><div className="jobs-b2-inspector-grid"><div><span>Ready Ops</span><strong>{row.readyOperations}</strong></div><div><span>On Hold</span><strong>{row.blockedOperations}</strong></div><div><span>Open Ops</span><strong>{row.openOperations}</strong></div><div><span>Timecards</span><strong>{row.pendingTimecards}</strong></div></div></section>

      <section><div className="jobs-b2-inspector-section-title">FINANCIAL POSITION</div><dl>
        <div><dt>Contract amount</dt><dd>{money(row.contractValue)}</dd></div>
        <div><dt>Budget used</dt><dd>{row.budgetUsed?`${row.budgetUsed.toFixed(1)}%`:'Not available'}</dd></div>
        <div><dt>Labor remaining</dt><dd className={row.laborRemaining<0?'danger':''}>{row.laborRemaining?`${row.laborRemaining.toFixed(1)} MH`:'Not available'}</dd></div>
        <div><dt>Customer balance</dt><dd>{money(row.customerOwed)}</dd></div>
        <div><dt>Past due</dt><dd className={row.overdue?'danger':''}>{money(row.overdue)}</dd></div>
      </dl><div className="jobs-b2-model-gap"><CircleDollarSign/><span>Approved change orders, committed cost and actual cost are not exposed by the current Jobs summary query, so this inspector does not fabricate them.</span></div></section>

      <section><div className="jobs-b2-inspector-section-title">QUICK LINKS</div><div className="jobs-b2-quick-links"><Link href={`/projects/${row.id}`}>Open Job</Link><Link href="/takeoff">Takeoff</Link><Link href="/estimates">Estimate</Link><Link href="/field">Field</Link><Link href="/schedule"><CalendarDays/>Schedule</Link><Link href="/cashflow"><Wallet/>Money</Link></div></section>
    </div>
  </aside>;
}
