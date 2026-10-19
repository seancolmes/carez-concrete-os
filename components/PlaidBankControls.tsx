'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {Button} from '@fluentui/react-components';
import {bankSyncOutcome} from '@/lib/banking/syncOutcome';

declare global{interface Window{Plaid?:{create:(config:any)=>{open:()=>void;destroy?:()=>void}}}}
let scriptPromise:Promise<void>|null=null;
function loadPlaid(){if(typeof window==='undefined')return Promise.reject(new Error('Browser unavailable'));if(window.Plaid)return Promise.resolve();if(scriptPromise)return scriptPromise;scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error('Unable to load Plaid Link'));document.head.appendChild(s);});return scriptPromise;}

export function PlaidConnectButton({configured,providerEnabled}:{configured:boolean;providerEnabled:boolean}){
  const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const connect=async()=>{setBusy(true);setError('');setNotice('');try{
    const tokenRes=await fetch('/api/plaid/link-token',{method:'POST'});const tokenData=await tokenRes.json();if(!tokenRes.ok)throw new Error(tokenData.error||'Unable to start Plaid');await loadPlaid();
    const handler=window.Plaid!.create({token:tokenData.link_token,onSuccess:async(publicToken:string,metadata:any)=>{try{const r=await fetch('/api/plaid/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({public_token:publicToken,institution:metadata?.institution||null})});const data=await r.json(),outcome=bankSyncOutcome(data,r.ok);if(outcome.tone==='error')setError(outcome.message);else setNotice(outcome.message);router.refresh();}catch{setError('The connection result was not confirmed. Review Banking before starting another Link session.');}finally{setBusy(false);}},onExit:(err:any)=>{if(err)setError(err.display_message||err.error_message||'Plaid Link closed with an error');setBusy(false);}});handler.open();
  }catch(e:any){setError(e?.message||'Unable to connect bank');setBusy(false);}};
  return <div className="max-w-md">{configured?<Button appearance="primary" onClick={connect} disabled={busy||!providerEnabled} title={!providerEnabled?'Provider connections are disabled in this environment.':undefined}>{busy?'Connecting…':'Connect bank account'}</Button>:<Button appearance="secondary" disabled>Bank connection setup required</Button>}{error&&<p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}{notice&&<p role="status" className="mt-2 text-xs text-muted-foreground">{notice}</p>}</div>;
}

export function RefreshBankButton({providerEnabled}:{providerEnabled:boolean}){const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');return <div className="max-w-md"><Button appearance="secondary" disabled={busy||!providerEnabled} title={!providerEnabled?'Provider sync is disabled in this environment.':undefined} onClick={async()=>{setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/plaid/refresh-balance',{method:'POST'});const data=await r.json(),outcome=bankSyncOutcome(data,r.ok);if(outcome.tone==='error')setError(outcome.message);else setNotice(outcome.message);router.refresh();}catch(e:any){setError(e?.message||'Refresh was not confirmed. Retry synchronization.');}finally{setBusy(false);}}}>{busy?'Refreshing…':'Refresh bank'}</Button>{error&&<p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}{notice&&<p role="status" className="mt-2 text-xs text-muted-foreground">{notice}</p>}</div>}
