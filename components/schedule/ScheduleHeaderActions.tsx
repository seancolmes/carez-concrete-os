'use client';

import {useActionState,useEffect,useState,type ReactNode} from 'react';
import {createScheduleItem} from '@/app/schedule/actions';
import type {ScheduleFormState} from '@/lib/field/scheduleCommand';
import {Button,Dialog,DialogActions,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Menu,MenuItem,MenuList,MenuPopover,MenuTrigger} from '@fluentui/react-components';
import {ChevronDownRegular,DismissRegular} from '@fluentui/react-icons';
import { CalendarLtrRegular as CalendarRange, TextBulletListCheckmarkRegular as ListChecks, BoxCheckmarkRegular as PackageCheck, ShieldCheckmarkRegular as ShieldCheck } from '@fluentui/react-icons';
import {useRouter} from 'next/navigation';

const tools=[
  {href:'/look-ahead',label:'21-day look-ahead',Icon:CalendarRange},
  {href:'/readiness',label:'Work readiness',Icon:ListChecks},
  {href:'/readiness/resources',label:'Resources',Icon:ShieldCheck},
  {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck},
];
const relatedToolsTriggerId='schedule-related-tools-trigger';

export function ScheduleHeaderActions({children,requestId,disabled=false}:{children:ReactNode;requestId:string;disabled?:boolean}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [state,action,pending]=useActionState<ScheduleFormState,FormData>(createScheduleItem,{status:'idle',message:''});
  useEffect(()=>{if(state.status==='saved'){setOpen(false);router.refresh();}},[state.status,router]);
  return <div className="flex flex-wrap items-center gap-2">
    <Menu><MenuTrigger disableButtonEnhancement><Button id={relatedToolsTriggerId} appearance="outline" size="small" icon={<ChevronDownRegular/>} iconPosition="after">Related tools</Button></MenuTrigger><MenuPopover><MenuList aria-labelledby={relatedToolsTriggerId}>{tools.map(({href,label,Icon})=><MenuItem key={href} icon={<Icon/>} onClick={()=>router.push(href)}>{label}</MenuItem>)}</MenuList></MenuPopover></Menu>
    <Dialog open={open} onOpenChange={(_,data)=>setOpen(data.open)}>
      <DialogTrigger disableButtonEnhancement><Button type="button" appearance="primary" disabled={disabled}>Schedule work</Button></DialogTrigger>
      <DialogSurface className="pt-dialog">
        <DialogBody>
          <div className="pt-dialog-heading"><DialogTitle>Schedule work</DialogTitle><DialogTrigger action="close" disableButtonEnhancement><Button type="button" appearance="subtle" icon={<DismissRegular/>} aria-label="Close schedule work"/></DialogTrigger></div>
          <DialogContent className="pt-dialog-content"><form id="schedule-work-form" action={action} className="pt-form grid gap-4 text-sm"><input type="hidden" name="request_id" value={requestId}/>{children}{state.message?<p role={state.status==='error'?'alert':'status'} className="text-sm text-destructive">{state.message}</p>:null}</form></DialogContent>
          <DialogActions className="pt-dialog-actions"><DialogTrigger action="close" disableButtonEnhancement><Button type="button" appearance="outline" disabled={pending}>Cancel</Button></DialogTrigger><Button type="submit" form="schedule-work-form" appearance="primary" disabled={pending||state.status==='saved'}>{pending?'Saving…':'Add to schedule'}</Button></DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  </div>;
}
