'use client';

import {useEffect,useState,type ReactNode} from 'react';

type WorkspaceTab='scope'|'pricing'|'labor'|'lines';

const hashForTab:Record<WorkspaceTab,string>={scope:'#scope-cost',pricing:'#pricing-coverage',labor:'#labor-review',lines:'#estimate-lines'};

function tabForHash(hash:string):WorkspaceTab{
  if(hash==='#pricing-coverage')return 'pricing';
  if(hash==='#labor-review')return 'labor';
  if(hash==='#estimate-lines')return 'lines';
  return 'scope';
}

export function EstimateWorkspaceTabs({scope,pricing,labor,lines}:{scope:ReactNode;pricing:ReactNode;labor:ReactNode;lines:ReactNode}){
  const [active,setActive]=useState<WorkspaceTab>('scope');

  useEffect(()=>{
    const sync=()=>{
      const next=tabForHash(window.location.hash);
      setActive(next);
      if(window.location.hash==='#price-margin'||Object.values(hashForTab).includes(window.location.hash))requestAnimationFrame(()=>document.getElementById(`estimate-tab-${next}`)?.scrollIntoView({block:'start'}));
    };
    sync();
    window.addEventListener('hashchange',sync);
    return ()=>window.removeEventListener('hashchange',sync);
  },[]);

  const select=(value:string)=>{
    const next=value as WorkspaceTab;
    setActive(next);
    window.history.replaceState(null,'',hashForTab[next]);
  };

  const tabs:[WorkspaceTab,string][]=[['scope','Scope & price'],['pricing','Pricing coverage'],['labor','Labor'],['lines','Estimate lines']];
  const content={scope,pricing,labor,lines};

  const onTabKeyDown=(event:React.KeyboardEvent<HTMLAnchorElement>,value:WorkspaceTab)=>{
    const index=tabs.findIndex(([key])=>key===value);
    const next=event.key==='ArrowRight'?tabs[(index+1)%tabs.length][0]:event.key==='ArrowLeft'?tabs[(index+tabs.length-1)%tabs.length][0]:event.key==='Home'?tabs[0][0]:event.key==='End'?tabs[tabs.length-1][0]:null;
    if(!next)return;
    event.preventDefault();
    select(next);
    document.getElementById(`estimate-tab-${next}`)?.focus();
  };

  return <div className="min-w-0 space-y-4" aria-label="Estimate workspace">
    <div className="border-b border-border bg-card/70">
      <div role="tablist" aria-label="Estimate workspace" className="grid grid-cols-2 gap-1 sm:flex sm:h-11 sm:items-end">
        {tabs.map(([value,label])=><a key={value} href={hashForTab[value]} role="tab" id={`estimate-tab-${value}`} aria-controls={`estimate-panel-${value}`} aria-selected={active===value} tabIndex={active===value?0:-1} onClick={()=>select(value)} onKeyDown={event=>onTabKeyDown(event,value)} className={`flex h-10 shrink-0 items-center border-b-2 px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:text-sm ${active===value?'border-primary bg-muted/30 font-medium text-foreground':'border-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground'}`}>{label}</a>)}
      </div>
    </div>
    {tabs.map(([value])=><section key={value} role="tabpanel" id={`estimate-panel-${value}`} aria-labelledby={`estimate-tab-${value}`} hidden={active!==value} className="min-w-0">{content[value]}</section>)}
  </div>;
}
