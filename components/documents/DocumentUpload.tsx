'use client';

import {useMemo,useRef,useState} from 'react';
import { ReceiptRegular as ReceiptText, VehicleTruckRegular as Truck, DocumentTextRegular as FileText, CameraRegular as Camera, FolderOpenRegular as FolderOpen, CheckmarkCircleRegular as CheckCheck, ArrowUploadRegular } from '@fluentui/react-icons';
import {createClient} from '@/lib/supabase/client';
import {saveDocumentMetadata} from '@/app/documents/actions';
import {Button,Input,Select,Spinner} from '@fluentui/react-components';

type Opt={id:string;label:string};
const selectClass='h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50';

export function DocumentUpload({companyId,projects,vendors}:{companyId:string;projects:Opt[];vendors:Opt[]}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const fileInputRef=useRef<HTMLInputElement>(null);
  const [dragging,setDragging]=useState(false);
  const [documentType,setDocumentType]=useState('receipt');
  const supabase=useMemo(()=>createClient(),[]);

  async function submit(fd:FormData){
    const file=files[0];
    if(!file||file.size===0){setMessage('Choose a file or take a photo.');return;}
    setBusy(true);setMessage('');let path='';
    try{
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
      path=`${companyId}/${crypto.randomUUID()}-${safe}`;
      const {error}=await supabase.storage.from('carez-documents').upload(path,file,{contentType:file.type||undefined,upsert:false});
      if(error)throw error;
      fd.set('storage_path',path);
      fd.set('mime_type',file.type||'application/octet-stream');
      await saveDocumentMetadata(fd);
      setMessage('Saved.');
      location.reload();
    }catch(error:any){
      if(path)await supabase.storage.from('carez-documents').remove([path]);
      setMessage(error?.message||'Upload failed.');
    }finally{setBusy(false);}
  }

  return <form action={submit} className="carez-capture-form" aria-busy={busy}>
    <div className="carez-capture-entry">
      <div className="carez-capture-types" role="group" aria-label="Quick document type">
        {[{value:'receipt',label:'Receipt',icon:ReceiptText},{value:'concrete_ticket',label:'Concrete ticket',icon:Truck},{value:'vendor_invoice',label:'Invoice',icon:FileText},{value:'photo',label:'Photo',icon:Camera},{value:'other',label:'Other',icon:FolderOpen}].map(({value,label,icon:Icon})=><Button key={value} type="button" appearance={documentType===value?'primary':'outline'} aria-pressed={documentType===value} disabled={busy} onClick={()=>setDocumentType(value)} icon={<Icon aria-hidden="true"/>}>{label}</Button>)}
      </div>
    <div className="carez-capture-drop space-y-2"><input ref={fileInputRef} type="file" className="sr-only" accept="image/*,.pdf" capture="environment" required={!files.length} disabled={busy} onChange={event=>setFiles(Array.from(event.target.files||[]).slice(0,1))}/><Button type="button" appearance="outline" disabled={busy} className={`min-h-24 w-full border-dashed ${dragging?'border-primary bg-accent':''}`} onClick={()=>fileInputRef.current?.click()} onDragEnter={event=>{event.preventDefault();setDragging(true)}} onDragOver={event=>event.preventDefault()} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);setFiles(Array.from(event.dataTransfer.files||[]).slice(0,1))}} icon={<ArrowUploadRegular/>}>Take a photo or drop a file · Photos and PDFs</Button>{files[0]?<div className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{files[0].name}</span><Button type="button" appearance="subtle" size="small" disabled={busy} onClick={()=>{setFiles([]);if(fileInputRef.current)fileInputRef.current.value=''}}>Remove</Button></div>:null}</div>
      <p className="carez-capture-note"><CheckCheck aria-hidden="true"/>Evidence stays linked to the job and source transaction.</p>
    </div>
    <div className="carez-capture-details space-y-4">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium"><span>Type</span><Select appearance="outline" name="document_type" value={documentType} onChange={event=>setDocumentType(event.target.value)} className={selectClass} disabled={busy}><option value="receipt">Receipt</option><option value="delivery_ticket">Delivery ticket</option><option value="concrete_ticket">Concrete ticket</option><option value="vendor_invoice">Vendor invoice</option><option value="plan">Plan / drawing</option><option value="inspection">Inspection</option><option value="proposal">Proposal / contract</option><option value="photo">Job photo</option><option value="other">Other</option></Select></label>
      <label className="space-y-1.5 text-xs font-medium"><span>Date</span><Input appearance="underline" type="date" name="document_date" defaultValue={new Date().toISOString().slice(0,10)} disabled={busy} className="[color-scheme:light] dark:[color-scheme:dark]"/></label>
    </div>
    <label className="block space-y-1.5 text-xs font-medium"><span>Title</span><Input appearance="underline" name="title" required placeholder="Home Depot receipt / Concrete ticket #..." disabled={busy}/></label>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium"><span>Job</span><Select appearance="outline" name="project_id" defaultValue="" className={selectClass} disabled={busy}><option value="">Company / no job</option>{projects.map(project=><option key={project.id} value={project.id}>{project.label}</option>)}</Select></label>
      <label className="space-y-1.5 text-xs font-medium"><span>Vendor</span><Select appearance="outline" name="vendor_id" defaultValue="" className={selectClass} disabled={busy}><option value="">None</option>{vendors.map(vendor=><option key={vendor.id} value={vendor.id}>{vendor.label}</option>)}</Select></label>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium"><span>Amount <span className="text-muted-foreground">optional</span></span><Input appearance="underline" name="amount" type="number" step="0.01" min="0" contentBefore="$" disabled={busy}/></label>
      <label className="space-y-1.5 text-xs font-medium"><span>Receipt / ticket #</span><Input appearance="underline" name="reference_number" disabled={busy}/></label>
    </div>
    <label className="block space-y-1.5 text-xs font-medium"><span>Note</span><Input appearance="underline" name="notes" placeholder="What is this for?" disabled={busy}/></label>
    {busy?<Spinner size="tiny" label="Saving document"/>:null}
    {message?<div role="status" className="text-xs text-muted-foreground">{message}</div>:null}
    <Button type="submit" appearance="primary" disabled={busy}>{busy?'Saving…':'Save document'}</Button>
    </div>
  </form>;
}

