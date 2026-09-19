import * as React from 'react';
import {cn} from '@/lib/utils';

export function CarezRecordHeader({eyebrow,title,description,status,actions,className}:{eyebrow?:React.ReactNode;title:React.ReactNode;description?:React.ReactNode;status?:React.ReactNode;actions?:React.ReactNode;className?:string}){
  return <header data-slot="carez-record-header" className={cn('flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between',className)}>
    <div className="min-w-0">
      {eyebrow?<div data-slot="carez-record-header-eyebrow" className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>:null}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 data-slot="carez-record-header-title" className="min-w-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {status?<div data-slot="carez-record-header-status" className="shrink-0">{status}</div>:null}
      </div>
      {description?<div data-slot="carez-record-header-description" className="mt-1 text-sm text-muted-foreground">{description}</div>:null}
    </div>
    {actions?<div data-slot="carez-record-header-actions" className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>:null}
  </header>;
}
