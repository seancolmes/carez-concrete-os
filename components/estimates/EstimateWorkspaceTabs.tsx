'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {Tab,TabList} from '@fluentui/react-components';

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

  const tabs:[WorkspaceTab,string][]=[['scope','Summary'],['pricing','Coverage'],['labor','Labor'],['lines','Line items']];
  const content={scope,pricing,labor,lines};

  return <div className="min-w-0 space-y-4" aria-label="Estimate workspace">
    <div className="overflow-x-auto border-b border-border bg-card/70">
      <TabList aria-label="Pricing views" selectedValue={active} onTabSelect={(_,data)=>select(data.value as WorkspaceTab)} size="small" className="w-max min-w-full">
        {tabs.map(([value,label])=><Tab key={value} value={value} id={`estimate-tab-${value}`} aria-controls={`estimate-panel-${value}`} className="whitespace-nowrap px-3 py-2 text-xs sm:text-sm">{label}</Tab>)}
      </TabList>
    </div>
    {tabs.map(([value])=><section key={value} role="tabpanel" id={`estimate-panel-${value}`} aria-labelledby={`estimate-tab-${value}`} hidden={active!==value} className="min-w-0">{content[value]}</section>)}
  </div>;
}
