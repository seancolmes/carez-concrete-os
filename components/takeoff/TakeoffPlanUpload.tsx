'use client';

import {useMemo,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {attachPlanToTakeoffSet} from '@/app/takeoff/[setId]/actions';
import {uploadSourceFile,forgetSourceUpload,cleanupUnusedSourceUpload} from '@/lib/documents/uploadSourceFile';
import {Button,Spinner,Text,ProgressBar} from '@fluentui/react-components';

export function TakeoffPlanUpload({companyId,takeoffSetId}:{companyId:string;takeoffSetId:string}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const [uploadedBytes,setUploadedBytes]=useState(0);
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const supabase=useMemo(()=>createClient(),[]);

  async function submit(){
    const file=files[0];
    if(!file||file.size===0){setMessage('Choose a PDF plan set.');return;}
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setMessage('The drawing workspace currently requires PDF plans.');return;}
    setBusy(true);setMessage('');setUploadedBytes(0);
    try{
      const uploaded=await uploadSourceFile(supabase,file,companyId,false,bytes=>setUploadedBytes(bytes),'application/pdf');
      const meta=new FormData();
      meta.set('takeoff_set_id',takeoffSetId);
      meta.set('storage_path',uploaded.path);
      meta.set('storage_format',uploaded.format);
      meta.set('source_filename',file.name);
      meta.set('mime_type','application/pdf');
      const result=await attachPlanToTakeoffSet(meta);
      forgetSourceUpload(uploaded);
      const cleaned=await cleanupUnusedSourceUpload(supabase,uploaded,result.unusedPath);
      setMessage(cleaned?'Plan set attached. Opening drawing workspace…':'Plan attached; unused upload cleanup is pending. Opening drawings…');
      location.reload();
    }catch(error:any){
      setMessage(`${error?.message||'Plan upload failed.'} Uploaded bytes remain available for retry; no existing source was replaced.`);
    }finally{setBusy(false);}
  }

  return <div className="space-y-4">
    <div className="flex min-h-24 flex-col items-start justify-center gap-2 border border-dashed border-border bg-muted/20 p-4" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!busy)setFiles(Array.from(event.dataTransfer.files).slice(0,1));}}>
      <input ref={fileInputRef} className="sr-only" type="file" accept="application/pdf,.pdf" aria-label="Choose PDF plans" disabled={busy} onChange={event=>setFiles(Array.from(event.target.files||[]).slice(0,1))}/>
      <Button type="button" appearance="outline" onClick={()=>fileInputRef.current?.click()} disabled={busy}>Choose PDF plans</Button>
      <Text size={200}>{files[0]?.name||'Or drop a PDF plan set here'}</Text>
    </div>
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Revision rule:</strong> after drawing measurements exist, this source PDF cannot be silently replaced. Revised plans should create the next takeoff/estimate revision so quantity deltas remain auditable.</div>
    {busy?<div className="space-y-2"><ProgressBar value={files[0]?uploadedBytes/files[0].size:0} aria-label="Original plan upload"/><Spinner size="tiny" label={files[0]&&uploadedBytes===files[0].size?'Verifying original PDF bytes':'Uploading plan set'}/></div>:null}
    {message?<div role="status" className="text-xs text-muted-foreground">{message}</div>:null}
    <Button type="button" onClick={()=>void submit()} disabled={busy||!files.length}>{busy?'Uploading…':'Attach PDF + open drawings'}</Button>
  </div>;
}
