'use client';

import Link from 'next/link';
import {useEffect,useState,type ReactNode} from 'react';
import {PortalMountNodeProvider} from '@fluentui/react-components';

/** A phone never mounts the workstation. A resized desktop retains unsaved state. */
export function TakeoffDesktopBoundary({children,returnHref='/projects',returnLabel='Return to Projects'}:{children:ReactNode;returnHref?:string;returnLabel?:string}){
  const [desktop,setDesktop]=useState<boolean|null>(null);
  const [opened,setOpened]=useState(false);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const host=document.createElement('div');
    host.hidden=true;
    document.body.appendChild(host);
    setPortalHost(host);
    const query=window.matchMedia('(min-width: 1024px)');
    const sync=()=>{host.hidden=!query.matches;setDesktop(query.matches);if(query.matches)setOpened(true);};
    sync();query.addEventListener('change',sync);
    return()=>{query.removeEventListener('change',sync);host.remove();};
  },[]);
  return <>
    {desktop!==true?<section className="flex min-h-64 flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      {desktop===null?<p role="status">Loading Takeoff…</p>:<><h2 className="text-xl font-semibold">Takeoff requires a desktop</h2><p className="max-w-sm text-sm leading-6 text-muted-foreground">Open this workspace on a desktop with a wider browser window. Your saved work is unchanged.</p><Link className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={returnHref}>{returnLabel}</Link></>}
    </section>:null}
    {opened&&portalHost?<PortalMountNodeProvider value={portalHost}><div hidden={desktop!==true} className="min-h-0 min-w-0 flex-1 flex-col" style={desktop===true?{display:'flex'}:undefined}>{children}</div></PortalMountNodeProvider>:null}
  </>;
}
