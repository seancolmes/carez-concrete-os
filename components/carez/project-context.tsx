'use client';

import {BriefcaseBusiness,ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';

export function CarezProjectSwitcher({label='Carez workspace',detail='Company',onClick,className}:{label?:string;detail?:string;onClick?:()=>void;className?:string}){
  return <Button type="button" variant="ghost" size="sm" className={cn('h-7 min-w-0 max-w-[min(72vw,30rem)] justify-start gap-2 px-2 text-left',className)} onClick={onClick}>
    <BriefcaseBusiness className="size-3.5 shrink-0 text-muted-foreground"/>
    <span className="min-w-0"><span className="block truncate text-xs font-medium">{label}</span><span className="hidden truncate text-[10px] leading-3 text-muted-foreground sm:block">{detail}</span></span>
    <ChevronDown className="ml-1 size-3 shrink-0 text-muted-foreground"/>
  </Button>;
}

export function CarezProjectContextBar({projectName,projectDetail,workspaceLabel,onOpenProjectSwitcher,className}:{projectName:string;projectDetail:string;workspaceLabel:string;onOpenProjectSwitcher:()=>void;className?:string}){
  return <div data-slot="carez-project-context" className={cn('flex min-h-11 items-center gap-3 border-b border-border bg-card px-3 md:px-6',className)}>
    <span className="hidden text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground sm:inline">Project</span>
    <CarezProjectSwitcher label={projectName} detail={projectDetail} onClick={onOpenProjectSwitcher}/>
    <span className="ml-auto shrink-0 rounded-md border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground">{workspaceLabel}</span>
  </div>;
}
