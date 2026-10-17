'use client';

import {useState,type ReactNode} from 'react';
import {Tab,TabList} from '@fluentui/react-components';

type Section='authorization'|'billing'|'milestones'|'calendar';

export function JobSetupTabs({authorization,billing,milestones,calendar}:{authorization:ReactNode;billing:ReactNode;milestones:ReactNode;calendar?:ReactNode}){
  const [section,setSection]=useState<Section>('authorization');
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card">
    <TabList size="small" selectedValue={section} onTabSelect={(_,data)=>setSection(data.value as Section)} aria-label="Job setup sections" style={{flexWrap:'wrap',minWidth:0}} className="w-full flex-none flex-wrap border-b border-border px-2">
      <Tab value="authorization">Customer authorization</Tab>
      <Tab value="billing">Billing setup</Tab>
      <Tab value="milestones">Payment milestones</Tab>
      {calendar&&<Tab value="calendar">Jobsite &amp; calendar</Tab>}
    </TabList>
    <div role="tabpanel" aria-label="Customer authorization" hidden={section!=='authorization'} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 text-sm">{authorization}</div>
    <div role="tabpanel" aria-label="Billing setup" hidden={section!=='billing'} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 text-sm">{billing}</div>
    <div role="tabpanel" aria-label="Payment milestones" hidden={section!=='milestones'} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 text-sm">{milestones}</div>
    {calendar&&<div role="tabpanel" aria-label="Jobsite and calendar" hidden={section!=='calendar'} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 text-sm">{calendar}</div>}
  </div>;
}
