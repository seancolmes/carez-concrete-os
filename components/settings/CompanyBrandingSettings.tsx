'use client';

import {useMemo,useState} from 'react';
import {ImageIcon,RotateCcw,Save} from 'lucide-react';
import {CarezFileUpload,CarezLoadingState} from '@/components/carez/fields';
import {Button} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/client';
import {
  COMPANY_BRANDING_BUCKET,
  COMPANY_BRANDING_CHANGED_EVENT,
  COMPANY_LOGO_ACCEPT,
  COMPANY_LOGO_MAX_BYTES,
  FALLBACK_COMPANY_LOGO,
  companyLogoPublicUrl,
} from '@/lib/companyBranding';

const allowedTypes=new Set(['image/png','image/jpeg','image/webp']);

export function CompanyBrandingSettings({companyId,initialLogoPath}:{companyId:string;initialLogoPath:string|null}){
  const supabase=useMemo(()=>createClient(),[]);
  const [logoPath,setLogoPath]=useState<string|null>(initialLogoPath);
  const [files,setFiles]=useState<File[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const preview=companyLogoPublicUrl(supabase,logoPath);

  const publish=(nextPath:string|null)=>{
    setLogoPath(nextPath);
    window.dispatchEvent(new CustomEvent(COMPANY_BRANDING_CHANGED_EVENT,{detail:{logoPath:nextPath}}));
  };

  async function syncCommercialLogo(path:string|null){
    const logo=path?companyLogoPublicUrl(supabase,path):FALLBACK_COMPANY_LOGO;
    await supabase.from('company_billing_profiles').update({logo_path:logo,updated_at:new Date().toISOString()}).eq('company_id',companyId);
  }

  async function save(){
    const file=files[0];
    if(!file){setMessage('Choose a logo first.');return;}
    if(!allowedTypes.has(file.type)){setMessage('Use a PNG, JPEG, or WebP logo.');return;}
    if(file.size>COMPANY_LOGO_MAX_BYTES){setMessage('Logo must be 5 MB or smaller.');return;}
    setBusy(true);setMessage('');
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=`${companyId}/logos/${crypto.randomUUID()}-${safe}`;
    try{
      const {error:uploadError}=await supabase.storage.from(COMPANY_BRANDING_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {data:{user}}=await supabase.auth.getUser();
      const {error:saveError}=await supabase.from('company_branding').upsert({
        company_id:companyId,
        logo_path:path,
        logo_original_name:file.name,
        updated_by:user?.id||null,
        updated_at:new Date().toISOString(),
      },{onConflict:'company_id'});
      if(saveError){await supabase.storage.from(COMPANY_BRANDING_BUCKET).remove([path]);throw saveError;}
      await syncCommercialLogo(path);
      const previous=logoPath;
      publish(path);setFiles([]);setMessage('Company logo updated.');
      if(previous&&previous!==path)await supabase.storage.from(COMPANY_BRANDING_BUCKET).remove([previous]);
    }catch(error:any){setMessage(error?.message||'Could not update company logo.');}
    finally{setBusy(false);}
  }

  async function reset(){
    setBusy(true);setMessage('');
    try{
      const {data:{user}}=await supabase.auth.getUser();
      const {error}=await supabase.from('company_branding').upsert({
        company_id:companyId,
        logo_path:null,
        logo_original_name:null,
        updated_by:user?.id||null,
        updated_at:new Date().toISOString(),
      },{onConflict:'company_id'});
      if(error)throw error;
      await syncCommercialLogo(null);
      const previous=logoPath;
      publish(null);setFiles([]);setMessage('Using the default Carez logo.');
      if(previous)await supabase.storage.from(COMPANY_BRANDING_BUCKET).remove([previous]);
    }catch(error:any){setMessage(error?.message||'Could not reset company logo.');}
    finally{setBusy(false);}
  }

  return <div className="grid gap-4 lg:grid-cols-[minmax(260px,.7fr)_minmax(0,1.3fr)]">
    <div className="flex min-h-36 items-center justify-center rounded-md border border-border bg-black/35 p-5">
      <img src={preview||FALLBACK_COMPANY_LOGO} alt="Current company logo" className="max-h-20 max-w-full object-contain"/>
    </div>
    <div className="space-y-3">
      <CarezFileUpload files={files} onFilesChange={setFiles} accept={COMPANY_LOGO_ACCEPT} maxBytes={COMPANY_LOGO_MAX_BYTES} disabled={busy} label="Choose company logo" hint="PNG, JPEG, or WebP · 5 MB max"/>
      {busy?<CarezLoadingState label="Updating company branding"/>:null}
      {message?<div role="status" className="text-xs text-muted-foreground">{message}</div>:null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={()=>void save()} disabled={busy||!files.length}><Save/>Use this logo</Button>
        <Button type="button" variant="outline" size="sm" onClick={()=>void reset()} disabled={busy||!logoPath}><RotateCcw/>Use default</Button>
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><ImageIcon className="size-3.5"/>Company-wide branding</span>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">The current logo is used in the authenticated Carez shell and on newly created customer-facing commercial documents. Already-issued records keep the branding snapshot they were issued with.</p>
    </div>
  </div>;
}
