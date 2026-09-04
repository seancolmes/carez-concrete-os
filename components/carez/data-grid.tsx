'use client';

import * as React from 'react';
import {cn} from '@/lib/utils';
import {CarezLoadingSkeleton} from './fields';

export const CarezDataGrid=React.forwardRef<HTMLDivElement,React.ComponentProps<'div'>&{
  toolbar?:React.ReactNode;
  status?:React.ReactNode;
  loading?:boolean;
  empty?:React.ReactNode;
  isEmpty?:boolean;
}>(({className,toolbar,status,loading=false,empty,isEmpty=false,children,...props},ref)=>{
  return <div ref={ref} data-slot="carez-data-grid" className={cn('min-w-0 overflow-hidden rounded-md border border-border bg-background shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring/30',className)} {...props}>
    {toolbar?<div data-slot="carez-data-grid-toolbar" className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5">{toolbar}</div>:null}
    {status?<div data-slot="carez-data-grid-status" className="flex min-h-8 items-center justify-between gap-3 border-b border-border bg-muted/15 px-3 py-1.5 text-xs text-muted-foreground">{status}</div>:null}
    <div data-slot="carez-data-grid-viewport" className="min-h-0 min-w-0 overflow-auto">
      {loading?<CarezLoadingSkeleton rows={6} className="p-3"/>:isEmpty?empty:children}
    </div>
  </div>;
});
CarezDataGrid.displayName='CarezDataGrid';

export function CarezDataGridTable({className,...props}:React.ComponentProps<'table'>){
  return <table data-slot="carez-data-grid-table" className={cn('w-full border-collapse text-xs',className)} {...props}/>;
}

export function CarezDataGridHead({className,...props}:React.ComponentProps<'thead'>){
  return <thead data-slot="carez-data-grid-head" className={cn('sticky top-0 z-10 bg-muted/80 text-muted-foreground backdrop-blur-sm [&_tr]:border-b',className)} {...props}/>;
}

export function CarezDataGridBody({className,...props}:React.ComponentProps<'tbody'>){
  return <tbody data-slot="carez-data-grid-body" className={cn('[&_tr:last-child]:border-0',className)} {...props}/>;
}

export function CarezDataGridRow({className,...props}:React.ComponentProps<'tr'>){
  return <tr data-slot="carez-data-grid-row" className={cn('border-b border-border/70 transition-colors duration-150 hover:bg-muted/35 data-[state=selected]:bg-accent/70 motion-reduce:transition-none',className)} {...props}/>;
}

export function CarezDataGridHeaderCell({className,numeric=false,resizable=false,...props}:React.ComponentProps<'th'>&{numeric?:boolean;resizable?:boolean}){
  return <th data-slot="carez-data-grid-header-cell" className={cn('h-8 whitespace-nowrap px-2 text-left align-middle text-[11px] font-medium',numeric&&'text-right font-mono tabular-nums',resizable&&'resize-x overflow-hidden',className)} {...props}/>;
}

export function CarezDataGridCell({className,numeric=false,...props}:React.ComponentProps<'td'>&{numeric?:boolean}){
  return <td data-slot="carez-data-grid-cell" className={cn('h-8 whitespace-nowrap px-2 align-middle',numeric&&'text-right font-mono tabular-nums',className)} {...props}/>;
}
