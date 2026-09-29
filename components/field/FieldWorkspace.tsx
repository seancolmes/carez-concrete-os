import Link from 'next/link';
import {WorkspaceSubnav,workspacePillClass} from '@/components/ui/workspace-subnav';
import archetype from '@/components/ui/workspace-archetype.module.css';

const groups = [
  {id:'dispatch',label:'Dispatch & Pour Control',views:[['dispatch','Pour plans'],['deliveries','Delivery tickets']]},
  {id:'schedule',label:'Schedule & Look-Ahead',views:[['schedule','Schedule'],['look-ahead','Look-ahead'],['readiness','Operation readiness'],['resources','Resource readiness']]},
  {id:'production',label:'Production & Daily Logs',views:[['production','Production'],['work-packages','Work packages'],['work-package-financials','Package financials'],['field','Daily logs'],['time-review','Time review']]},
  {id:'crew',label:'Crew & Equipment Allocation',views:[['crew','Crew'],['employee-access','Employee access'],['equipment','Equipment & inventory']]},
] as const;

const loaders = {
  dispatch:()=>import('./views/dispatch'),
  deliveries:()=>import('./views/deliveries'),
  schedule:()=>import('./views/schedule'),
  'look-ahead':()=>import('./views/look-ahead'),
  readiness:()=>import('./views/readiness'),
  resources:()=>import('./views/resources'),
  production:()=>import('./views/production'),
  'work-packages':()=>import('./views/work-packages'),
  'work-package-financials':()=>import('./views/work-package-financials'),
  field:()=>import('./views/field'),
  'time-review':()=>import('./views/time-review'),
  crew:()=>import('./views/crew'),
  'employee-access':()=>import('./views/employee-access'),
  equipment:()=>import('./views/equipment'),
};

export async function FieldWorkspace({tab,view}:{tab?:string;view?:string}){
  const group=groups.find(item=>item.id===tab)||groups[0];
  const selected=group.views.find(item=>item[0]===view)?.[0]||group.views[0][0];
  const View=(await loaders[selected]()).default;

  return <section aria-label="Field operations workspace" className={`${archetype.workspace} min-w-0 overflow-hidden rounded-xl border border-[#D4DBD7] bg-white shadow-md dark:border-[#343A3F] dark:bg-[#181A1B]`}>
    <WorkspaceSubnav label="Field domains">
      {groups.map(item=><Link key={item.id} href={`/field?tab=${item.id}&view=${item.views[0][0]}`} prefetch={false} scroll={false} aria-current={item.id===group.id?'page':undefined} className={workspacePillClass(item.id===group.id)}>{item.label}</Link>)}
    </WorkspaceSubnav>
    <WorkspaceSubnav label={`${group.label} views`}>
      {group.views.map(([id,label])=><Link key={id} href={`/field?tab=${group.id}&view=${id}`} prefetch={false} scroll={false} aria-current={selected===id?'page':undefined} className={workspacePillClass(selected===id)}>{label}</Link>)}
    </WorkspaceSubnav>
    <div className="min-w-0 p-3 sm:p-5"><View/></div>
  </section>;
}
