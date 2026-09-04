'use client';

import {useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {attachPlanToTakeoffSet} from '@/app/takeoff/[setId]/actions';
import {Button} from '@/components/ui/button';
import {CarezFileUpload,CarezLoadingState} from '@/components/carez';

export function TakeoffPlanUpload({companyId,takeoffSetId}:{companyId:string;takeoffSetId:string}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const supabase=useMemo(()=>createClient(),[]);

  async function submit(){
    const file=files[0];
    if(!file||file.size===0){setMessage('Choose a PDF plan set.');return;}
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setMessage('The drawing workspace currently requires PDF plans.');return;}
    setBusy(true);setMessage('');let path='';
    try{
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      path=`${companyId}/plans/${crypto.randomUUID()}-${safe}`;
      const {error}=await supabase.storage.from('carez-documents').upload(path,file,{contentType:'application/pdf',upsert:false});
      if(error)throw error;
      const meta=new FormData();
      meta.set('takeoff_set_id',takeoffSetId);
      meta.set('storage_path',path);
      meta.set('source_filename',file.name);
      meta.set('mime_type','application/pdf');
      await attachPlanToTakeoffSet(meta);
      setMessage('Plan set attached. Opening drawing workspace…');
      location.reload();
    }catch(error:any){
      if(path)await supabase.storage.from('carez-documents').remove([path]);
      setMessage(error?.message||'Plan upload failed.');
    }finally{setBusy(false);}
  }

  return <div className="space-y-4">
    <CarezFileUpload files={files} onFilesChange={setFiles} accept="application/pdf,.pdf" required disabled={busy} label="Choose or drop PDF plans" hint="PDF plan sets only"/>
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Revision rule:</strong> after drawing measurements exist, this source PDF cannot be silently replaced. Revised plans should create the next takeoff/estimate revision so quantity deltas remain auditable.</div>
    {busy?<CarezLoadingState label="Uploading plan set"/>:null}
    {message?<div role="status" className="text-xs text-muted-foreground">{message}</div>:null}
    <Button type="button" onClick={()=>void submit()} disabled={busy||!files.length}>{busy?'Uploading…':'Attach PDF + open drawings'}</Button>
  </div>;
}
