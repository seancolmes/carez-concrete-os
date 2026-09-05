'use client';

import type {ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarRange,ChevronDown,ListChecks,PackageCheck,Plus,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const tools=[
  {href:'/look-ahead',label:'21-day look-ahead',Icon:CalendarRange},
  {href:'/readiness',label:'Work readiness',Icon:ListChecks},
  {href:'/readiness/resources',label:'Resources',Icon:ShieldCheck},
  {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck},
];

export function ScheduleHeaderActions({children}:{children:ReactNode}){
  const router=useRouter();

  return <div className="flex shrink-0 items-center gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm"/>}>
        Related tools <ChevronDown className="size-3.5"/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {tools.map(({href,label,Icon})=><DropdownMenuItem key={href} onClick={()=>router.push(href)} className="h-8 cursor-pointer gap-2">
          <Icon className="size-3.5 text-muted-foreground"/>
          {label}
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog>
      <DialogTrigger render={<Button type="button" size="sm"/>}>
        <Plus className="size-3.5"/> Add work
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
