'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Dialog,DialogActions,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger} from '@fluentui/react-components';
import {assignScheduleCrew} from '@/app/schedule/actions';
import type {ScheduleFormState} from '@/lib/field/scheduleCommand';
import type {ScheduleGridItem,ScheduleCrewMember} from './ScheduleGrid';
import {ScheduleCrewFields} from './ScheduleCrewFields';

export const canAssignScheduleCrew=(item:Pick<ScheduleGridItem,'revision'|'inspectionId'|'status'|'crewAssignmentsAvailable'>)=>item.revision!==null&&!item.inspectionId&&['planned','confirmed'].includes(item.status)&&item.crewAssignmentsAvailable;

function AssignmentForm({item,crewMembers,requestId,onPendingChange}:{item:ScheduleGridItem;crewMembers:ScheduleCrewMember[];requestId:string;onPendingChange:(pending:boolean)=>void}){
 const router=useRouter(),[state,action,pending]=useActionState<ScheduleFormState,FormData>(assignScheduleCrew,{status:'idle',message:''});
 useEffect(()=>onPendingChange(pending),[pending,onPendingChange]);
 useEffect(()=>{if(state.status==='saved')router.refresh();},[state.status,router]);
 const choices=[...crewMembers,...item.assignedCrew.filter(member=>!crewMembers.some(active=>active.id===member.id)).map(member=>({...member,role:'Inactive — remove before saving'}))];
 const formId=`schedule-assign-form-${requestId}`;
 return <><DialogContent className="pt-dialog-content">
  <p className="mb-1 break-words font-semibold">{item.jobNumber} — {item.projectName}</p><p className="mb-1 break-words">{item.title}</p>
  <p className="mb-4 text-sm text-muted-foreground">{item.scheduleDate} · {item.startTime||'Start not set'}{item.endTime?`–${item.endTime}`:''}</p>
  <p className="mb-4 text-sm">Saved: {item.assignedCrew.length} assigned · {item.crewNeeded} needed</p>
  <form id={formId} action={action} onSubmit={()=>onPendingChange(true)} className="pt-form grid gap-4">
   <input type="hidden" name="request_id" value={requestId}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="expected_revision" value={item.revision??''}/>
   <fieldset disabled={pending||state.status==='saved'} className="min-w-0"><ScheduleCrewFields crewMembers={choices} initialSelected={item.assignedCrew.map(member=>member.id)} initialNeeded={item.crewNeeded} idPrefix={`assign-${requestId}`}/></fieldset>
   {state.message?<p role={state.status==='error'?'alert':'status'} className={state.status==='error'?'text-sm text-destructive':'text-sm font-semibold text-foreground'}>{state.message}</p>:null}
  </form>
 </DialogContent><DialogActions className="pt-dialog-actions"><DialogTrigger action="close" disableButtonEnhancement><Button type="button" appearance="outline" disabled={pending}>{state.status==='saved'?'Done':'Cancel'}</Button></DialogTrigger><Button type="submit" form={formId} appearance="primary" disabled={pending||state.status==='saved'}>{pending?'Saving…':'Save assigned workers'}</Button></DialogActions></>;
}

export function ScheduleCrewAssignmentDialog({item,crewMembers,context,choicesAvailable=true}:{item:ScheduleGridItem;crewMembers:ScheduleCrewMember[];context:string;choicesAvailable?:boolean}){
 const [open,setOpen]=useState(false),[requestId,setRequestId]=useState(''),[pending,setPending]=useState(false);
 if(!choicesAvailable)return <span className="text-xs text-muted-foreground">Worker choices unavailable.</span>;
 if(!canAssignScheduleCrew(item))return null;
 const titleId=`schedule-crew-title-${item.id}-${context}`;
 return <Dialog open={open} onOpenChange={(_,data)=>{if(pending)return;if(data.open&&!open)setRequestId(crypto.randomUUID());setOpen(data.open);}}>
  <DialogTrigger disableButtonEnhancement><Button type="button" size="small" appearance="outline" aria-label={`Assign workers to ${item.title}`}>{item.assignedCrew.length?'Edit workers':'Assign workers'}</Button></DialogTrigger>
  <DialogSurface className="pt-dialog pt-dialog-compact" aria-labelledby={titleId}><DialogBody><div className="pt-dialog-heading"><DialogTitle id={titleId}>Assign workers</DialogTitle><DialogTrigger action="close" disableButtonEnhancement><Button type="button" appearance="subtle" aria-label="Close worker assignment" disabled={pending}>Close</Button></DialogTrigger></div>{open&&requestId?<AssignmentForm key={requestId} item={item} crewMembers={crewMembers} requestId={requestId} onPendingChange={setPending}/>:null}</DialogBody></DialogSurface>
 </Dialog>;
}
