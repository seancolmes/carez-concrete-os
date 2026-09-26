'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

declare global{interface Window{Plaid?:{create:(config:any)=>{open:()=>void;destroy?:()=>void}}}}
let scriptPromise:Promise<void>|null=null;
function loadPlaid(){if(typeof window==='undefined')return Promise.reject(new Error('Browser unavailable'));if(window.Plaid)return Promise.resolve();if(scriptPromise)return scriptPromise;scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(new Error('Unable to load Plaid Link'));document.head.appendChild(s);});return scriptPromise;}

export function PlaidConnectButton({configured,providerEnabled}:{configured:boolean;providerEnabled:boolean}){
  const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const connect=async()=>{setBusy(true);setError('');try{
    const tokenRes=await fetch('/api/plaid/link-token',{method:'POST'});const tokenData=await tokenRes.json();if(!tokenRes.ok)throw new Error(tokenData.error||'Unable to start Plaid');await loadPlaid();
    const handler=window.Plaid!.create({token:tokenData.link_token,onSuccess:async(publicToken:string,metadata:any)=>{const r=await fetch('/api/plaid/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({public_token:publicToken,institution:metadata?.institution||null})});const data=await r.json();if(!r.ok){setError(data.error||'Bank connection failed');setBusy(false);return;}router.refresh();setBusy(false);},onExit:(err:any)=>{if(err)setError(err.display_message||err.error_message||'Plaid Link closed with an error');setBusy(false);}});handler.open();
  }catch(e:any){setError(e?.message||'Unable to connect bank');setBusy(false);}};
  return <div>{configured?<button className="button" onClick={connect} disabled={busy||!providerEnabled} title={!providerEnabled?'Provider connections are disabled in this environment.':undefined}>{busy?'Connecting…':'Connect Bank Account'}</button>:<button className="button" disabled>Plaid Setup Required</button>}{error&&<div className="meta" style={{color:'#ff978f',marginTop:7}}>{error}</div>}</div>;
}

export function RefreshBankButton({providerEnabled}:{providerEnabled:boolean}){const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');return <div><button className="button secondary" disabled={busy||!providerEnabled} title={!providerEnabled?'Provider sync is disabled in this environment.':undefined} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/plaid/refresh-balance',{method:'POST'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Refresh failed');router.refresh();}catch(e:any){setError(e?.message||'Refresh failed');}finally{setBusy(false);}}}>{busy?'Refreshing…':'Refresh Bank Now'}</button>{error&&<div className="meta" style={{color:'#ff978f',marginTop:7}}>{error}</div>}</div>}
