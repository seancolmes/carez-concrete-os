import {createClient} from '@/lib/supabase/server';
import {parseSourceManifest,sourceByteRange,sourceNotModified} from '@/lib/documents/sourceManifest';
import {sourceObjectResponse,verifiedSourceChunk} from '@/lib/documents/sourceStorage.server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

async function content(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return new Response('Source not found.',{status:404});
 const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return new Response('Sign in to open this source.',{status:401});
 const profile=await client.from('profiles').select('company_id,role').eq('id',auth.data.user.id).maybeSingle();
 if(profile.error)return new Response('Source authorization unavailable.',{status:503});
 if(!profile.data?.company_id||!['owner','office'].includes(profile.data.role))return new Response('Office access required.',{status:403});
 const companyId=profile.data.company_id,read=await client.from('company_documents').select('id,title,mime_type,storage_path,storage_format,source_manifest,content_sha256,byte_size,visibility').eq('company_id',companyId).eq('id',id).maybeSingle();
 if(read.error)return new Response('Source record unavailable.',{status:503});if(!read.data)return new Response('Source not found.',{status:404});
 const document=read.data;
 if(!document.storage_path?.startsWith(companyId+'/')||document.storage_path.includes('..'))return new Response('Source access unavailable.',{status:403});
 const abort=new AbortController(),signal=AbortSignal.any([request.signal,abort.signal]);
 try{
  const manifest=document.storage_format==='chunked'?parseSourceManifest(document.source_manifest,document.storage_path,companyId,document.visibility==='office_private'):null;
  let size=Number(document.byte_size);
  if(!Number.isSafeInteger(size)||size<=0){const info=await client.storage.from('carez-documents').info(document.storage_path);if(info.error)throw new Error('Source length unavailable.');size=Number(info.data.size);}
  if(!Number.isSafeInteger(size)||size<=0||manifest&&manifest.size!==size)throw new Error('Source length unavailable.');
  const etag=document.content_sha256?`"${document.content_sha256}"`:null;
  if(sourceNotModified(request.headers.get('if-none-match'),etag))return new Response(null,{status:304,headers:{...(etag?{ETag:etag}:{}),'Cache-Control':'private, no-store','Vary':'Cookie','Accept-Ranges':'bytes'}});
  const rangeHeader=request.method==='HEAD'?null:request.headers.get('range');
  const ifRange=request.headers.get('if-range');
  let range;try{range=sourceByteRange(ifRange&&ifRange!==etag?null:rangeHeader,size);}catch{return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`,'Accept-Ranges':'bytes','Cache-Control':'private, no-store'}});}
  const mime=['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/json'].includes(document.mime_type||'')?document.mime_type!:'application/octet-stream';
  const filename=(manifest?.filename||document.title||'source').replace(/[\u0000-\u001f]/g,'').slice(0,200);
  const encoded=encodeURIComponent(filename).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16));
  const headers=new Headers({'Content-Type':mime,'Content-Length':String(range.end-range.start+1),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Security-Policy':'sandbox','Content-Disposition':`${mime==='application/octet-stream'?'attachment':'inline'}; filename*=UTF-8''${encoded}`});
  if(etag)headers.set('ETag',etag);if(range.partial)headers.set('Content-Range',`bytes ${range.start}-${range.end}/${size}`);
  if(request.method==='HEAD')return new Response(null,{status:200,headers});
  let iterator:AsyncGenerator<Uint8Array>;
  if(manifest){
   iterator=(async function*(){let offset=0;for(const chunk of manifest.chunks){const last=offset+chunk.size-1;if(last>=range.start&&offset<=range.end){const bytes=await verifiedSourceChunk(client,chunk.path,chunk.size,chunk.sha256,{signal});yield bytes.subarray(Math.max(0,range.start-offset),Math.min(chunk.size,range.end-offset+1));}offset+=chunk.size;if(offset>range.end)break;}})();
  }else{
   const response=await sourceObjectResponse(client,document.storage_path,{signal,range:range.partial?`bytes=${range.start}-${range.end}`:undefined});
   if(response.status===206&&response.headers.get('content-range')!==`bytes ${range.start}-${range.end}/${size}`){await response.body?.cancel();throw new Error('Source range identity changed.');}
   iterator=(async function*(){const reader=response.body!.getReader();let skip=response.status===206?0:range.start,remaining=range.end-range.start+1;try{while(remaining>0){const item=await reader.read();if(item.done)throw new Error('Source bytes are incomplete.');if(skip>=item.value.length){skip-=item.value.length;continue;}const part=item.value.subarray(skip,skip+remaining);skip=0;remaining-=part.length;yield part;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}})();
  }
  // Pull honors backpressure: at most one bounded source part is queued.
  const stream=new ReadableStream<Uint8Array>({async pull(controller){try{const part=await iterator.next();if(part.done)controller.close();else controller.enqueue(part.value);}catch(error){abort.abort();controller.error(error);}},async cancel(){abort.abort();await iterator.return(undefined);}});
  return new Response(stream,{status:range.partial?206:200,headers});
 }catch{abort.abort();return new Response('Source bytes unavailable. Retry after the source read recovers.',{status:503,headers:{'Cache-Control':'private, no-store'}});}
}
export const GET=content;
export const HEAD=content;
