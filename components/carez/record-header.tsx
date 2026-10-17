import * as React from 'react';
import {cn} from '@/lib/utils';

export function CarezRecordHeader({eyebrow,title,description,status,actions,className,compact=false}:{eyebrow?:React.ReactNode;title:React.ReactNode;description?:React.ReactNode;status?:React.ReactNode;actions?:React.ReactNode;className?:string;compact?:boolean}){
  return <header data-slot="carez-record-header" className={cn('carez-page-heading flex flex-col lg:flex-row lg:items-start lg:justify-between',compact?'gap-2':'gap-3',className)}>
    <div className="min-w-0">
      {eyebrow?<div data-slot="carez-record-header-eyebrow" className={cn('flex flex-wrap items-center gap-2',compact?'mb-0.5':'mb-2')}>{eyebrow}</div>:null}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 data-slot="carez-record-header-title" className={cn('min-w-0 font-semibold tracking-tight text-foreground',compact?'text-lg':'text-xl sm:text-2xl')}>{title}</h1>
        {status?<div data-slot="carez-record-header-status" className="shrink-0">{status}</div>:null}
      </div>
      {description?<div data-slot="carez-record-header-description" className={cn('text-muted-foreground',compact?'mt-0.5 text-xs':'mt-1 text-sm')}>{description}</div>:null}
    </div>
    {actions?<div data-slot="carez-record-header-actions" className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>:null}
  </header>;
}
