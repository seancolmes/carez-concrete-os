import * as React from 'react';
import type {CarezVisualTone} from '@/lib/ui/state';
import {cn} from '@/lib/utils';

const toneClass:Record<CarezVisualTone,string>={
  neutral:'text-foreground',
  info:'text-info',
  success:'text-success',
  warning:'text-warning',
  error:'text-destructive',
};

const columnClass={
  4:'sm:grid-cols-2 xl:grid-cols-4',
  5:'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
  6:'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
} as const;

export function CarezOperatingMetric({
  label,value,help,tone='neutral',className,
}:{
  label:string;
  value:React.ReactNode;
  help?:React.ReactNode;
  tone?:CarezVisualTone;
  className?:string;
}){
  return <div
    data-slot="carez-operating-metric"
    className={cn('min-w-0 bg-card px-4 py-4',className)}
  >
    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
    <div className={cn('mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums',toneClass[tone])}>{value}</div>
    {help?<div className="mt-1 text-xs leading-4 text-muted-foreground">{help}</div>:null}
  </div>;
}

export function CarezOperatingMetricStrip({
  columns,children,className,...props
}:React.ComponentProps<'section'>&{
  columns:4|5|6;
}){
  return <section
    {...props}
    data-slot="carez-operating-metric-strip"
    className={cn('carez-metric-ledger grid gap-px overflow-hidden border-y border-border bg-border',columnClass[columns],className)}
  >
    {children}
  </section>;
}
