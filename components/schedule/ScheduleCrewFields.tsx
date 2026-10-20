'use client';
import {useState} from 'react';
import {Checkbox,Input,Label} from '@fluentui/react-components';
import type {ScheduleCrewMember} from './ScheduleGrid';

export function ScheduleCrewFields({crewMembers,initialSelected=[],initialNeeded,idPrefix}:{crewMembers:ScheduleCrewMember[];initialSelected?:string[];initialNeeded?:number;idPrefix:string}){
 const [selected,setSelected]=useState(initialSelected),[demand,setDemand]=useState<string|null>(initialNeeded===undefined?null:String(initialNeeded));
 return <fieldset className="min-w-0 space-y-3">
  <legend className="text-sm font-semibold text-foreground">Assign workers</legend>
  <p role="status" aria-live="polite" className="text-sm font-medium text-foreground">{selected.length} worker{selected.length===1?'':'s'} selected</p>
  <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{crewMembers.map(member=><div key={member.id} className="min-w-0"><Checkbox input={{id:`${idPrefix}-${member.id}`,'aria-label':member.name}} name="crew_member_ids" value={member.id} label={member.name} checked={selected.includes(member.id)} onChange={(_,data)=>setSelected(current=>data.checked?[...current,member.id]:current.filter(id=>id!==member.id))}/><p className="ml-7 break-words text-xs text-muted-foreground">{member.role}</p></div>)}</div>
  {!crewMembers.length?<p className="text-sm text-muted-foreground">No workers are available to select.</p>:null}
  <div className="flex flex-wrap items-end gap-3"><div className="grid gap-1"><Label htmlFor={`${idPrefix}-needed`}>Workers needed</Label><Input id={`${idPrefix}-needed`} name="crew_needed" appearance="outline" type="number" min="0" step="1" required value={demand??String(selected.length)} onChange={(_,data)=>setDemand(data.value)} className="w-24"/></div><p className="max-w-xs text-xs text-muted-foreground">This is the staffing target. Select names above to assign workers.</p></div>
 </fieldset>;
}
