'use client';
import {useActionState} from 'react';
import {Button,Field,Input} from '@fluentui/react-components';
import {saveOperatingCalendar,type CalendarState} from '@/app/settings/calendar-actions';

const initial:CalendarState={status:'idle',message:''};
export function OperatingCalendarSettings({requestId,zone,available,canEdit,projectId}:{requestId:string;zone:string|null;available:boolean;canEdit:boolean;projectId?:string}){
 const [state,action,pending]=useActionState(saveOperatingCalendar,initial);
 return <section className="space-y-3 rounded-md border border-border bg-card p-4" aria-label={projectId?'Job operating calendar':'Company operating calendar'}>
  <div><h3 className="text-sm font-semibold">{projectId?'Job':'Company'} operating calendar</h3><p className="mt-1 text-sm text-muted-foreground">Shifts belong to their start date. {projectId?'A blank job time zone uses the company calendar.':'Set the company time zone before recording new shifts.'} Elapsed hours use actual clock times, including daylight-saving changes.</p></div>
  {!available?<p role="status" className="text-sm text-muted-foreground">Operating calendar unavailable. Existing settings have not been loaded; editing is unavailable.</p>:<>
   <p className="text-sm">{zone|| (projectId?'Company calendar fallback':'Time zone not configured')}</p>
   {canEdit?<form action={action} className="grid gap-3 sm:max-w-lg">
    <input type="hidden" name="calendar_request_id" value={requestId}/><input type="hidden" name="project_id" value={projectId||''}/>
    <Field label="IANA time zone" hint={projectId?'Leave blank to use the company time zone.':'For example, America/Los_Angeles or Europe/London.'}><Input name="operating_timezone" defaultValue={zone||''} required={!projectId} placeholder="America/Los_Angeles" autoComplete="off"/></Field>
    {state.status!=='idle'&&<p role={state.status==='error'?'alert':'status'} className={state.status==='error'?'text-sm text-destructive':'text-sm text-muted-foreground'}>{state.message}</p>}
    <Button type="submit" appearance="primary" className="w-fit" disabled={pending||state.status==='saved'}>{pending?'Saving…':'Save calendar'}</Button>
   </form>:<p className="text-sm text-muted-foreground">{projectId?'Owner or office access':'Owner access'} is required to change this calendar.</p>}
  </>}
 </section>;
}
