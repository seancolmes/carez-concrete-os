'use client';
import {useState} from 'react';
import {setProjectJobsite} from '@/app/field/employee-actions';
import {Button,Dialog,DialogBody,DialogContent,DialogSurface,DialogTitle,DialogTrigger,Input,Label,Select} from '@fluentui/react-components';

const selectClass='h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50';

export function JobsiteLocationSetter({projects}:{projects:{id:string;job_number:string;name:string;site_latitude?:number|null;site_longitude?:number|null;geofence_radius_ft?:number|null}[]}){
 const [projectId,setProjectId]=useState('');
 const [radius,setRadius]=useState('500');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 async function save(){
  if(!projectId){setMessage('Choose a job first.');return;}
  if(!navigator.geolocation){setMessage('This device does not support GPS.');return;}
  setBusy(true);setMessage('Getting your current location...');
  navigator.geolocation.getCurrentPosition(async p=>{try{const fd=new FormData();fd.set('project_id',projectId);fd.set('latitude',String(p.coords.latitude));fd.set('longitude',String(p.coords.longitude));fd.set('radius_ft',radius);await setProjectJobsite(fd);setMessage(`Jobsite pin saved. GPS accuracy ${Math.round(p.coords.accuracy)} m.`);}catch(e:any){setMessage(e?.message||'Could not save jobsite location.');}finally{setBusy(false);}},e=>{setMessage(e.message||'Location permission is required.');setBusy(false);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 }
 return <Dialog><DialogTrigger><Button appearance="outline">Set jobsite GPS pin</Button></DialogTrigger><DialogSurface className="sm:max-w-lg"><DialogBody><DialogTitle>Set jobsite GPS pin</DialogTitle><DialogContent><p className="mb-4 text-sm text-muted-foreground">Stand at the job, choose it, and save your phone&apos;s location. Employee punches are measured from this pin.</p>
  <div className="grid gap-4">
   <div className="grid gap-1.5"><Label htmlFor="jobsite-project">Job</Label><Select appearance="outline" id="jobsite-project" value={projectId} onChange={e=>setProjectId(e.target.value)} className={selectClass}><option value="">Choose job</option>{projects.map(p=><option key={p.id} value={p.id}>{p.job_number} — {p.name}{p.site_latitude?' · Pin set':''}</option>)}</Select></div>
   <div className="grid gap-1.5"><Label htmlFor="jobsite-radius">Allowed Jobsite Radius (ft)</Label><Input appearance="underline" id="jobsite-radius" type="number" min="50" step="25" value={radius} onChange={e=>setRadius(e.target.value)}/></div>
   <div><Button type="button" appearance="primary" onClick={save} disabled={busy}>{busy?'Getting GPS...':'Use My Current Location'}</Button></div>
   {message&&<div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">{message}</div>}
  </div>
 </DialogContent></DialogBody></DialogSurface></Dialog>;
}
