'use client';
import { useState } from 'react';
import { seedStarterData } from '@/app/settings/actions';
export function SeedButton(){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function load(){setBusy(true);const r=await seedStarterData();setMessage(r.message);setBusy(false);}
 return <div><button className="button secondary" onClick={load} disabled={busy}>{busy?'Loading...':'Load Carez Starter Data'}</button>{message&&<div className="meta" style={{marginTop:8}}>{message}</div>}</div>;
}
