'use client';

import {useState} from 'react';
import {Button} from '@/components/ui/button';

const routes=[['Today','/'],['Projects','/projects'],['Takeoff','/takeoff'],['Estimates','/estimates'],['Proposals','/proposals'],['Billing','/billing'],['Documents','/documents'],['Settings','/settings']];
const sizes=[{name:'Mobile',width:390},{name:'Tablet',width:768},{name:'Desktop',width:1280}];

export function DesignReview(){
  const [route,setRoute]=useState('/');
  const [width,setWidth]=useState(390);
  return <main className="min-h-screen bg-muted p-4">
    <header className="mx-auto mb-4 flex max-w-screen-2xl flex-wrap items-center gap-3">
      <div className="mr-auto"><h1 className="font-semibold">Carez design review</h1><p className="text-xs text-muted-foreground">Explore the live workspace at each screen size. Appearance is available in Settings.</p></div>
      <label className="flex items-center gap-2 text-sm">Workspace<select aria-label="Review workspace" className="h-9 rounded border bg-background px-2" value={route} onChange={event=>setRoute(event.target.value)}>{routes.map(([name,path])=><option key={path} value={path}>{name}</option>)}</select></label>
      <div className="flex gap-1" aria-label="Review screen size">{sizes.map(size=><Button key={size.width} variant={width===size.width?'default':'outline'} aria-pressed={width===size.width} onClick={()=>setWidth(size.width)}>{size.name}</Button>)}</div>
      <a className="text-sm underline underline-offset-4" href={route}>Open full screen</a>
    </header>
    <div className="overflow-x-auto pb-4"><iframe title="Carez responsive preview" src={route} style={{width,height:844}} className="mx-auto block shrink-0 border border-border bg-background shadow-lg"/></div>
  </main>;
}
