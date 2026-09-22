'use client';

import type {ReactNode} from 'react';
import {CalendarRange,ListChecks,PackageCheck,Plus,ShieldCheck} from 'lucide-react';
import {CarezRelatedToolsMenu} from '@/components/carez/related-tools-menu';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';

const tools=[
  {href:'/look-ahead',label:'21-day look-ahead',Icon:CalendarRange},
  {href:'/readiness',label:'Work readiness',Icon:ListChecks},
  {href:'/readiness/resources',label:'Resources',Icon:ShieldCheck},
  {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck},
];

export function ScheduleHeaderActions({children}:{children:ReactNode}){
  return <div className="flex shrink-0 items-center gap-2 border-l border-border pl-3">
    <CarezRelatedToolsMenu items={tools}/>
    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm"/>}>
        <Plus className="size-3.5"/> Schedule Work
      </DialogTrigger>
      <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add work to the schedule</DialogTitle>
          <DialogDescription>Schedule work, pours, inspections, deliveries, equipment, or coordination without bypassing readiness controls.</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  </div>;
}
