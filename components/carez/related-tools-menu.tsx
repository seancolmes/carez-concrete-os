'use client';

import type {LucideIcon} from 'lucide-react';
import {ChevronDown} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {cn} from '@/lib/utils';

export type CarezRelatedTool={
  href:string;
  label:string;
  Icon?:LucideIcon;
};

export function CarezRelatedToolsMenu({items,label='Related tools',className}:{items:CarezRelatedTool[];label?:string;className?:string}){
  const router=useRouter();
  if(!items.length)return null;

  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className={cn('shrink-0',className)}/> }>
      {label}<ChevronDown className="size-3.5"/>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-52">
      {items.map(({href,label:toolLabel,Icon})=><DropdownMenuItem key={href} onClick={()=>router.push(href)} className="h-8 cursor-pointer gap-2">
        {Icon?<Icon className="size-3.5 text-muted-foreground"/>:null}
        {toolLabel}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
