'use client';

import type {ReactNode} from 'react';
import {CalendarRange,ListChecks,PackageCheck,ShieldCheck} from 'lucide-react';
import {CarezRelatedToolsMenu} from '@/components/carez/related-tools-menu';
import {Button} from '@/components/ui/button';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';

const tools=[
  {href:'/look-ahead',label:'21-day look-ahead',Icon:CalendarRange},
  {href:'/readiness',label:'Work readiness',Icon:ListChecks},
  {href:'/readiness/resources',label:'Resources',Icon:ShieldCheck},
  {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck},
];

export function ScheduleHeaderActions({children}:{children:ReactNode}){
  return <div className="flex shrink-0 items-center gap-2">
    <CarezRelatedToolsMenu items={tools}/>
    <Sheet>
      <SheetTrigger render={<Button type="button" size="sm"/>}>
        + Schedule Work
      </SheetTrigger>
      <SheetContent className="obsidian-wash w-full max-w-none overflow-y-auto border-[#343A3F] p-0 sm:max-w-[540px]">
        <SheetHeader className="border-b border-[#343A3F] px-5 py-4">
          <SheetTitle>Schedule work</SheetTitle>
          <SheetDescription>Commit a work package, pour, inspection, delivery, or equipment window.</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-5">{children}</div>
      </SheetContent>
    </Sheet>
  </div>;
}
