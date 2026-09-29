import type {ReactNode} from 'react';
import {FieldTabNav, type FieldTab} from './FieldTabNav';

const loaders = {
  deliveries:()=>import('./views/deliveries'),
  schedule:()=>import('./views/schedule'),
  'look-ahead':()=>import('./views/look-ahead'),
  readiness:()=>import('./views/readiness'),
  resources:()=>import('./views/resources'),
  production:()=>import('./views/production'),
  'work-packages':()=>import('./views/work-packages'),
  field:()=>import('./views/field'),
  'time-review':()=>import('./views/time-review'),
  crew:()=>import('./views/crew'),
  'employee-access':()=>import('./views/employee-access'),
  equipment:()=>import('./views/equipment'),
};

const tabViews:Record<FieldTab,readonly string[]>={
  dispatch:['deliveries'],
  schedule:['schedule','readiness','resources'],
  'look-ahead':['look-ahead'],
  production:['production','work-packages','field','time-review'],
  crew:['crew','employee-access','equipment'],
};

const defaultView:Record<Exclude<FieldTab,'dispatch'>,keyof typeof loaders>={
  schedule:'schedule',
  'look-ahead':'look-ahead',
  production:'production',
  crew:'crew',
};

export function resolveFieldTab(tab?:string,view?:string):FieldTab{
  if(view){
    const match=(Object.keys(tabViews) as FieldTab[]).find(key=>tabViews[key].includes(view));
    if(match)return match;
  }
  if(tab&&tab in tabViews)return tab as FieldTab;
  return 'dispatch';
}

export async function FieldWorkspace({tab,view,dispatch}:{tab?:string;view?:string;dispatch:ReactNode}){
  const activeTab=resolveFieldTab(tab,view);
  const requestedView=view&&tabViews[activeTab].includes(view)?view:null;
  const activeView=activeTab==='dispatch'?requestedView:requestedView||defaultView[activeTab];
  const View=activeView?(await loaders[activeView as keyof typeof loaders]()).default:null;

  return <div className="min-w-0">
    <FieldTabNav activeTab={activeTab}/>
    <section aria-label={`${activeTab} workspace`} className="surface-card min-w-0 rounded-xl p-6">
      {View?<View/>:dispatch}
    </section>
  </div>;
}
