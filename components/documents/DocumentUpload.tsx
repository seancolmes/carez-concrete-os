'use client';

import {useMemo,useState} from 'react';
import {ReceiptText,Truck,FileText,Camera,FolderOpen,CheckCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {saveDocumentMetadata} from '@/app/documents/actions';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {CarezDateTimeField,CarezFileUpload,CarezLoadingState,CarezNumberField} from '@/components/carez';

type Opt={id:string;label:string};
const selectClass='h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50';

export function DocumentUpload({companyId,projects,vendors}:{companyId:string;projects:Opt[];vendors:Opt[]}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [files,setFiles]=useState<File[]>([]);
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
        {[{value:'receipt',label:'Receipt',icon:ReceiptText},{value:'concrete_ticket',label:'Concrete ticket',icon:Truck},{value:'vendor_invoice',label:'Invoice',icon:FileText},{value:'photo',label:'Photo',icon:Camera},{value:'other',label:'Other',icon:FolderOpen}].map(({value,label,icon:Icon})=><button key={value} type="button" aria-pressed={documentType===value} disabled={busy} onClick={()=>setDocumentType(value)}><Icon aria-hidden="true"/>{label}</button>)}
      </div>
    <div className="carez-capture-drop"><CarezFileUpload files={files} onFilesChange={setFiles} accept="image/*,.pdf" capture="environment" required disabled={busy} label="Take a photo or drop a file" hint="Open camera or browse · Photos and PDFs"/></div>
      <p className="carez-capture-note"><CheckCheck aria-hidden="true"/>Evidence stays linked to the job and source transaction.</p>
    </div>
    <div className="carez-capture-details space-y-4">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium"><span>Type</span><select name="document_type" value={documentType} onChange={event=>setDocumentType(event.target.value)} className={selectClass} disabled={busy}><option value="receipt">Receipt</option><option value="delivery_ticket">Delivery ticket</option><option value="concrete_ticket">Concrete ticket</option><option value="vendor_invoice">Vendor invoice</option><option value="plan">Plan / drawing</option><option value="inspection">Inspection</option><option value="proposal">Proposal / contract</option><option value="photo">Job photo</option><option value="other">Other</option></select></label>
      <label className="space-y-1.5 text-xs font-medium"><span>Date</span><CarezDateTimeField name="document_date" defaultValue={new Date().toISOString().slice(0,10)} disabled={busy} className="[color-scheme:light] dark:[color-scheme:dark]"/></label>
    </div>
    <label className="block space-y-1.5 text-xs font-medium"><span>Title</span><Input name="title" required placeholder="Home Depot receipt / Concrete ticket #..." disabled={busy}/></label>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium"><span>Job</span><select name="project_id" defaultValue="" className={selectClass} disabled={busy}><option value="">Company / no job</option>{projects.map(project=><option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
      <label className="space-y-1.5 text-xs font-medium"><span>Vendor</span><select name="vendor_id" defaultValue="" className={selectClass} disabled={busy}><option value="">None</option>{vendors.map(vendor=><option key={vendor.id} value={vendor.id}>{vendor.label}</option>)}</select></label>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1.5 text-xs font-medium"><span>Amount <span className="text-muted-foreground">optional</span></span><CarezNumberField name="amount" step="0.01" min="0" prefix="$" disabled={busy}/></label>
      <label className="space-y-1.5 text-xs font-medium"><span>Receipt / ticket #</span><Input name="reference_number" disabled={busy}/></label>
    </div>
    <label className="block space-y-1.5 text-xs font-medium"><span>Note</span><Input name="notes" placeholder="What is this for?" disabled={busy}/></label>
    {busy?<CarezLoadingState label="Saving document"/>:null}
    {message?<div role="status" className="text-xs text-muted-foreground">{message}</div>:null}
    <Button type="submit" disabled={busy}>{busy?'Saving…':'Save document'}</Button>
    </div>
  </form>;
}

