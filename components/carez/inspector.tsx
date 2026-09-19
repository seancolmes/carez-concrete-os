import * as React from 'react';
import {cn} from '@/lib/utils';

export function CarezInspector({className,...props}:React.ComponentProps<'aside'>){
  return <aside data-slot="carez-inspector" className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background',className)} {...props}/>;
}

export function CarezInspectorHeader({title,description,status,saveState,actions,className}:{title:React.ReactNode;description?:React.ReactNode;status?:React.ReactNode;saveState?:React.ReactNode;actions?:React.ReactNode;className?:string}){
  return <header data-slot="carez-inspector-header" className={cn('border-b border-border px-3 py-2.5',className)}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="text-sm font-semibold text-foreground">{title}</div>{description?<div className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</div>:null}</div>
      {actions?<div className="flex shrink-0 items-center gap-1">{actions}</div>:null}
    </div>
    {status||saveState?<div className="mt-2 flex flex-wrap items-center gap-2">{status}{saveState}</div>:null}
  </header>;
}

export function CarezInspectorSection({title,description,children,className}:{title?:React.ReactNode;description?:React.ReactNode;children:React.ReactNode;className?:string}){
  return <section data-slot="carez-inspector-section" className={cn('border-b border-border px-3 py-3 last:border-b-0',className)}>
    {title?<div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</div>:null}
    {description?<div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>:null}
    <div className={cn((title||description)&&'mt-2')}>{children}</div>
  </section>;
}

export function CarezInspectorBody({className,...props}:React.ComponentProps<'div'>){
  return <div data-slot="carez-inspector-body" className={cn('min-h-0 flex-1 overflow-y-auto',className)} {...props}/>;
}

export function CarezInspectorValidation({className,...props}:React.ComponentProps<'div'>){
  return <div data-slot="carez-inspector-validation" role="alert" className={cn('border-t border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive',className)} {...props}/>;
}

export function CarezInspectorFooter({className,...props}:React.ComponentProps<'footer'>){
  return <footer data-slot="carez-inspector-footer" className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/10 px-3 py-2',className)} {...props}/>;
}
