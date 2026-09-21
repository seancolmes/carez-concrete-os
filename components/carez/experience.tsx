import type {ReactNode} from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {cn} from '@/lib/utils';

export function CarezSectionHeading({id,icon,title,description,action,className}:{id?:string;icon?:ReactNode;title:string;description?:string;action?:ReactNode;className?:string}){
  return <div data-slot="carez-section-heading" className={cn('carez-section-heading',className)}>
    {icon?<span className="carez-section-icon" aria-hidden="true">{icon}</span>:null}
    <div className="min-w-0 flex-1"><h2 id={id}>{title}</h2>{description?<p>{description}</p>:null}</div>
    {action?<div className="carez-section-action">{action}</div>:null}
  </div>;
}

export type CarezPulseItem={label:string;value:ReactNode;detail:string;icon:ReactNode;tone?:'primary'|'success'|'warning'|'danger'|'neutral';href?:string};

export function CarezOperationalPulse({items,label}:{items:CarezPulseItem[];label:string}){
  return <div data-slot="carez-operational-pulse" className="carez-operational-pulse" role="region" aria-label={label}>
    {items.map(item=>{
      const content=<><span className="carez-pulse-label"><span aria-hidden="true">{item.icon}</span>{item.label}{item.href?<ArrowUpRight aria-hidden="true" className="carez-pulse-arrow"/>:null}</span><strong className="carez-pulse-value">{item.value}</strong><span className="carez-pulse-detail">{item.detail}</span></>;
      return item.href?<Link key={item.label} href={item.href} className="carez-pulse-item" data-tone={item.tone||'neutral'}>{content}</Link>:<div key={item.label} className="carez-pulse-item" data-tone={item.tone||'neutral'}>{content}</div>;
    })}
  </div>;
}

export function CarezExperienceEmpty({icon,title,description,actions,tone='neutral'}:{icon:ReactNode;title:string;description:string;actions?:ReactNode;tone?:'neutral'|'success'}){
  return <div data-slot="carez-experience-empty" className="carez-experience-empty" data-tone={tone}>
    <span className="carez-empty-icon" aria-hidden="true">{icon}</span>
    <div className="min-w-0"><h3>{title}</h3><p>{description}</p>{actions?<div className="mt-4 flex flex-wrap gap-2">{actions}</div>:null}</div>
  </div>;
}
