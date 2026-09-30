'use client';

import {useState,type ReactNode} from 'react';
import {Button,DrawerBody,DrawerHeader,Menu,MenuItem,MenuList,MenuPopover,MenuTrigger,OverlayDrawer} from '@fluentui/react-components';
import {ChevronDownRegular,DismissRegular} from '@fluentui/react-icons';
import { CalendarLtrRegular as CalendarRange, TextBulletListCheckmarkRegular as ListChecks, BoxCheckmarkRegular as PackageCheck, ShieldCheckmarkRegular as ShieldCheck } from '@fluentui/react-icons';
import {useRouter} from 'next/navigation';

const tools=[
  {href:'/look-ahead',label:'21-day look-ahead',Icon:CalendarRange},
  {href:'/readiness',label:'Work readiness',Icon:ListChecks},
  {href:'/readiness/resources',label:'Resources',Icon:ShieldCheck},
  {href:'/production/work-packages',label:'Work packages',Icon:PackageCheck},
];

export function ScheduleHeaderActions({children}:{children:ReactNode}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  return <div className="flex shrink-0 items-center gap-2">
    <Menu><MenuTrigger disableButtonEnhancement><Button appearance="outline" size="small" icon={<ChevronDownRegular/>} iconPosition="after">Related tools</Button></MenuTrigger><MenuPopover><MenuList>{tools.map(({href,label,Icon})=><MenuItem key={href} icon={<Icon/>} onClick={()=>router.push(href)}>{label}</MenuItem>)}</MenuList></MenuPopover></Menu>
    <Button type="button" appearance="primary" size="small" onClick={()=>setOpen(true)}>+ Schedule Work</Button>
    <OverlayDrawer open={open} onOpenChange={(_,data)=>setOpen(data.open)} position="end" size="medium" className="obsidian-wash overflow-y-auto border-win-stroke p-0">
      <DrawerHeader className="border-b border-win-stroke px-5 py-4">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Schedule work</h2><p className="text-sm text-muted-foreground">Commit a work package, pour, inspection, delivery, or equipment window.</p></div><Button appearance="subtle" icon={<DismissRegular/>} aria-label="Close schedule work" onClick={()=>setOpen(false)}/></div>
      </DrawerHeader>
      <DrawerBody className="px-5 pb-5">{children}</DrawerBody>
    </OverlayDrawer>
  </div>;
}
