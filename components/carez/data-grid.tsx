'use client';

import * as React from 'react';
import {cn} from '@/lib/utils';
import {CarezLoadingSkeleton} from './fields';
import {CarezEmptyState} from './state';

export const CarezDataGrid=React.forwardRef<HTMLDivElement,React.ComponentProps<'div'>&{
  toolbar?:React.ReactNode;
  status?:React.ReactNode;
  footer?:React.ReactNode;
  loading?:boolean;
  empty?:React.ReactNode;
  isEmpty?:boolean;
  error?:React.ReactNode;
  errorTitle?:string;
}>(({className,toolbar,status,footer,loading=false,empty,isEmpty=false,error,errorTitle='Unable to load data',children,...props},ref)=>{
  return <div ref={ref} data-slot="carez-data-grid" aria-busy={loading||undefined} className={cn('min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring/30',className)} {...props}>
    {toolbar?<div data-slot="carez-data-grid-toolbar" className="flex min-h-[var(--density-control-height)] flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5">{toolbar}</div>:null}
    {status?<div data-slot="carez-data-grid-status" className="flex min-h-8 items-center justify-between gap-3 border-b border-border bg-muted/35 px-3 py-1.5 text-xs text-secondary-foreground">{status}</div>:null}
    <div data-slot="carez-data-grid-viewport" className="min-h-0 min-w-0 overflow-auto">
      {error?<CarezEmptyState tone="error" title={errorTitle} description={error}/>:loading?<CarezLoadingSkeleton rows={6} className="p-3"/>:isEmpty?(empty??<CarezEmptyState title="No rows" description="No records match the current view."/>):children}
    </div>
    {footer?<div data-slot="carez-data-grid-footer" className="flex min-h-9 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">{footer}</div>:null}
  </div>;
});
CarezDataGrid.displayName='CarezDataGrid';

export function CarezDataGridTable({className,...props}:React.ComponentProps<'table'>){
  return <table data-slot="carez-data-grid-table" className={cn('w-full border-collapse text-xs',className)} {...props}/>;
}

export function CarezDataGridHead({className,...props}:React.ComponentProps<'thead'>){
  return <thead data-slot="carez-data-grid-head" className={cn('sticky top-0 z-10 bg-secondary/95 text-secondary-foreground backdrop-blur-sm [&_tr]:border-b',className)} {...props}/>;
}

export function CarezDataGridBody({className,...props}:React.ComponentProps<'tbody'>){
  return <tbody data-slot="carez-data-grid-body" className={cn('[&_tr:last-child]:border-0',className)} {...props}/>;
}

export function CarezDataGridRow({className,selected=false,...props}:React.ComponentProps<'tr'>&{selected?:boolean}){
  return <tr {...props} data-slot="carez-data-grid-row" aria-selected={selected||undefined} className={cn('border-b border-border/80 transition-colors duration-150 hover:bg-accent/35 aria-selected:bg-accent/80 motion-reduce:transition-none',className)}/>;
}

export function CarezDataGridHeaderCell({className,numeric=false,resizable=false,sortable=false,sort,...props}:React.ComponentProps<'th'>&{numeric?:boolean;resizable?:boolean;sortable?:boolean;sort?:React.AriaAttributes['aria-sort']}){
  return <th {...props} data-slot="carez-data-grid-header-cell" aria-sort={sort} data-sortable={sortable||undefined} className={cn('h-[var(--density-row-height)] whitespace-nowrap px-2 text-left align-middle text-[11px] font-semibold',numeric&&'text-right font-mono tabular-nums',resizable&&'resize-x overflow-hidden',sortable&&'select-none',className)}/>;
}

export function CarezDataGridCell({className,numeric=false,...props}:React.ComponentProps<'td'>&{numeric?:boolean}){
  return <td {...props} data-slot="carez-data-grid-cell" className={cn('h-[var(--density-row-height)] whitespace-nowrap px-2 align-middle',numeric&&'text-right font-mono tabular-nums',className)}/>;
}
