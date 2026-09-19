import * as React from 'react';
import {Badge} from '@/components/ui/badge';
import {Empty,EmptyContent,EmptyDescription,EmptyHeader,EmptyTitle} from '@/components/ui/empty';
import {cn} from '@/lib/utils';
import {
  resolveAuthorityState,resolveFeedbackScope,resolveSaveState,resolveStatusTone,
  type CarezAuthorityKind,type CarezFeedbackScope,type CarezSaveStateKind,type CarezStatusTone,type CarezVisualTone,
} from '@/lib/ui/state';

const toneClass:Record<CarezVisualTone,string>={
  neutral:'border-border bg-muted/20 text-foreground',
  info:'border-info/30 bg-info/5 text-info',
  success:'border-success/30 bg-success/5 text-success',
  warning:'border-warning/35 bg-warning/5 text-warning',
  error:'border-destructive/35 bg-destructive/5 text-destructive',
};

export function CarezStatus({tone='neutral',label,className}:{tone?:CarezStatusTone;label?:React.ReactNode;className?:string}){
  const contract=resolveStatusTone(tone);
  if(!contract)return null;
  return <Badge data-slot="carez-status" variant="outline" className={cn('rounded-sm font-medium',toneClass[contract.tone],className)}>{label??contract.label}</Badge>;
}

export function CarezAuthorityState({kind,className}:{kind:CarezAuthorityKind;className?:string}){
  const contract=resolveAuthorityState(kind);
  if(!contract)return null;
  return <span data-slot="carez-authority-state" className={cn('inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium',toneClass[contract.tone],className)}>{contract.label}</span>;
}

export function CarezSaveState({state,className}:{state:CarezSaveStateKind;className?:string}){
  const contract=resolveSaveState(state);
  if(!contract)return null;
  const urgent=contract.tone==='error';
  return <span
    data-slot="carez-save-state"
    role={urgent?'alert':'status'}
    aria-live={urgent?'assertive':'polite'}
    data-server-persisted={contract.serverPersisted?'true':'false'}
    className={cn('inline-flex items-center gap-1.5 text-xs font-medium',toneClass[contract.tone].split(' ').filter(value=>value.startsWith('text-')).join(' '),className)}
  >{contract.label}</span>;
}

export function CarezFeedback({tone='info',scope='inline',title,children,className}:{tone?:CarezStatusTone;scope?:CarezFeedbackScope;title?:React.ReactNode;children?:React.ReactNode;className?:string}){
  const statusContract=resolveStatusTone(tone);
  const scopeContract=resolveFeedbackScope(scope);
  if(!statusContract||!scopeContract)return null;
  const urgent=statusContract.tone==='error';
  return <div
    data-slot="carez-feedback"
    data-scope={scopeContract.kind}
    role={urgent?'alert':scopeContract.role}
    aria-live={urgent?'assertive':'polite'}
    className={cn('border text-sm',scope==='workspace'?'rounded-md px-3 py-2.5':'rounded-sm px-2.5 py-2',toneClass[statusContract.tone],className)}
  >
    {title?<div className="font-medium">{title}</div>:null}
    {children?<div className={cn(title&&'mt-1',statusContract.tone==='neutral'?'text-muted-foreground':'text-current/90')}>{children}</div>:null}
  </div>;
}

export function CarezProvenance({label='Source',summary,children,className}:{label?:string;summary:React.ReactNode;children?:React.ReactNode;className?:string}){
  if(!children)return <div data-slot="carez-provenance" className={cn('text-xs text-muted-foreground',className)}><span className="font-medium text-foreground">{label}:</span> {summary}</div>;
  return <details data-slot="carez-provenance" className={cn('rounded-md border border-border bg-muted/10 text-xs',className)}>
    <summary className="cursor-pointer list-none px-2.5 py-2 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      <span className="font-medium text-foreground">{label}:</span> {summary}
    </summary>
    <div className="border-t border-border px-2.5 py-2 text-muted-foreground">{children}</div>
  </details>;
}

export function CarezEmptyState({title,description,actions,tone='neutral',className}:{title:string;description?:React.ReactNode;actions?:React.ReactNode;tone?:'neutral'|'error';className?:string}){
  return <Empty data-slot="carez-empty-state" className={cn('min-h-32 rounded-md border bg-muted/10',tone==='error'&&'border-destructive/30 bg-destructive/5',className)}>
    <EmptyHeader><EmptyTitle className={cn(tone==='error'&&'text-destructive')}>{title}</EmptyTitle>{description?<EmptyDescription>{description}</EmptyDescription>:null}</EmptyHeader>
    {actions?<EmptyContent>{actions}</EmptyContent>:null}
  </Empty>;
}
