'use client';
import Link from 'next/link';
import {Button} from '@fluentui/react-components';
import {TakeoffDesktopBoundary} from '@/components/takeoff/TakeoffDesktopBoundary';

export default function TakeoffLoadError(){
  return <TakeoffDesktopBoundary returnHref="/opportunities" returnLabel="Return to bids"><main className="min-h-dvh bg-background p-6 text-foreground"><section className="mx-auto max-w-xl space-y-4 border-y border-border py-6" role="alert">
    <h1 className="text-lg font-semibold">Takeoff data unavailable</h1>
    <p className="text-sm text-muted-foreground">Required drawing, revision, or calculation records could not be loaded. Saved work has not been replaced with an empty workspace. Reload before editing.</p>
    <div className="flex flex-wrap gap-3"><Button appearance="primary" onClick={()=>window.location.reload()}>Retry loading</Button><Link href="/opportunities" className="inline-flex items-center text-sm underline">Return to bids</Link></div>
  </section></main></TakeoffDesktopBoundary>;
}
