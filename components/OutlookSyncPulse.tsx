'use client';
import {useEffect} from 'react';

const EVERY_MS=10*60*1000;
const STORAGE_KEY='carez_outlook_last_sync_pulse';

export function OutlookSyncPulse(){
 useEffect(()=>{
  let timer:number|undefined;
  const run=async()=>{
   if(document.visibilityState!=='visible')return;
   const last=Number(window.localStorage.getItem(STORAGE_KEY)||0);if(Date.now()-last<EVERY_MS)return;
   window.localStorage.setItem(STORAGE_KEY,String(Date.now()));
   try{await fetch('/api/outlook/sync',{method:'POST',headers:{'Content-Type':'application/json'}});}catch{}
  };
  const first=window.setTimeout(run,12000);
  timer=window.setInterval(run,EVERY_MS);
  const onVisible=()=>{if(document.visibilityState==='visible')void run();};document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearTimeout(first);if(timer!==undefined)window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
 },[]);
 return null;
}
