import {Suspense} from 'react';
import Link from 'next/link';
import {Button,Spinner} from '@fluentui/react-components';
import {AppShell} from '@/components/AppShell';
import {FieldWorkspace,resolveFieldView} from '@/components/field/FieldWorkspace';
import {FieldDispatch} from '@/components/field/FieldDispatch';
import {FieldPourPlanAction} from '@/components/field/FieldPourPlanAction';
import {getFieldContext} from '@/lib/field/workspaceContext.server';

type SearchParams={tab?:string;view?:string};
const workDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export default async function FieldPage({searchParams}:{searchParams:Promise<SearchParams>}){
 const [{tab,view},{user,profile}]=await Promise.all([searchParams,getFieldContext()]);
 const activeView=resolveFieldView(tab,view),isSchedule=activeView==='schedule',isDispatch=activeView===null,today=workDate();
 const fieldContext=<header className="pt-context-band shrink-0"><div className="pt-context-identity"><nav aria-label="Breadcrumb"><Link href="/dashboard">Dashboard</Link><span className="ml-2" aria-hidden="true">/</span></nav><h1>Field</h1></div><div className="pt-context-action"><Suspense fallback={<Button disabled appearance="outline">Loading plan options…</Button>}><FieldPourPlanAction today={today} primary={isDispatch}/></Suspense></div></header>;
 return <AppShell userName={profile.full_name||user.email||'Owner'}>
  <div className="mx-auto flex w-full min-w-0 max-w-screen-2xl flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
   {!isSchedule?fieldContext:null}
   <div className="min-h-0 flex-1 overflow-auto">
    <Suspense key={activeView||'dispatch'} fallback={<div role="status" className="pt-workspace-loading"><Spinner size="small"/>Opening {isSchedule?'Schedule':'Field workspace'}…</div>}>
     <FieldWorkspace tab={tab} view={view} scheduleContext={isSchedule?fieldContext:undefined} dispatch={<FieldDispatch today={today}/>}/>
    </Suspense>
   </div>
  </div>
 </AppShell>;
}
