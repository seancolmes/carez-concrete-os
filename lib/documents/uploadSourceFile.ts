import {SOURCE_CHUNK_BYTES,SOURCE_MAX_BYTES,SOURCE_SINGLE_LIMIT,type SourceManifest,type SourceChunk} from './sourceManifest.ts';
type Client={storage:{from(bucket:string):any}};
type Pending={version:1;root:string;parts:Record<string,{size:number;sha256:string}>;attempted:string[]};
export type SourceUpload={path:string;format:'single'|'chunked';paths:string[];sessionKey:string;size:number};
const memory=new Map<string,Pending>();
const digest=async(blob:Blob)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
function save(key:string,value:Pending){memory.set(key,value);try{sessionStorage.setItem(key,JSON.stringify(value));}catch{/* Current-tab retry remains available if browser storage is disabled. */}}
function pending(key:string,prefix:string):Pending{
 let value=memory.get(key);try{value??=JSON.parse(sessionStorage.getItem(key)||'null');}catch{/* Invalid saved session is replaced without deleting any uploaded objects. */}
 if(!value||value.version!==1||!value.root?.startsWith(prefix)||! /^[a-f0-9-]{36}$/i.test(value.root.slice(prefix.length))||!value.parts||!Array.isArray(value.attempted))value={version:1,root:prefix+crypto.randomUUID(),parts:{},attempted:[]};
 save(key,value);return value;
}
export function forgetSourceUpload(upload:SourceUpload){memory.delete(upload.sessionKey);try{sessionStorage.removeItem(upload.sessionKey);}catch{/* No data objects are removed. */}}
/** Only call after the server confirms this exact upload is unused by the saved record. */
export async function cleanupUnusedSourceUpload(client:Client,upload:SourceUpload,unusedPath:string|null){
 if(unusedPath!==upload.path)return true;
 try{const result=await client.storage.from('carez-documents').remove(upload.paths);return !result.error;}catch{return false;}
}
export async function uploadSourceFile(client:Client,file:File,companyId:string,privateFile:boolean,onProgress?:(uploaded:number,total:number)=>void,mimeOverride?:string):Promise<SourceUpload>{
 if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>SOURCE_MAX_BYTES)throw new Error('Choose an original source between 1 byte and 100 MiB.');
 const mimeType=mimeOverride||file.type||'application/octet-stream';
 const prefix=`${companyId}/${privateFile?'office-private':'sources'}/`,key=`pourtrace.source-upload:${companyId}:${privateFile}:${encodeURIComponent(file.name)}:${file.size}:${file.lastModified}:${mimeType}`;
 const state=pending(key,prefix),store=client.storage.from('carez-documents');
 async function part(path:string,blob:Blob,mimeType:string){
  const sha256=await digest(blob),saved=state.parts[path];
  if(saved&&(saved.sha256!==sha256||saved.size!==blob.size))throw new Error('The selected file differs from the pending original. Choose the original file again.');
  if(saved||state.attempted.includes(path)){
   const existing=await store.info(path);
   if(!existing.error){
    if(Number(existing.data?.size)!==blob.size)throw new Error('Pending upload size changed; the object was not overwritten.');
    const read=await store.download(path);if(read.error||!read.data||await digest(read.data)!==sha256)throw new Error('Pending upload fingerprint could not be verified. No source was overwritten.');
    state.parts[path]={size:blob.size,sha256};save(key,state);return sha256;
   }
   const status=String(existing.error.statusCode??existing.error.status??'');
   if(status!=='404'&&!/not found/i.test(existing.error.message||''))throw new Error('Pending upload status unavailable. Retry without starting another upload.');
   delete state.parts[path];save(key,state);
  }else{state.attempted.push(path);save(key,state);}
  const result=await store.upload(path,blob,{contentType:mimeType,upsert:false});if(result.error)throw new Error(result.error.message||'Source upload unavailable. Retry using the pending original.');
  state.parts[path]={size:blob.size,sha256};save(key,state);return sha256;
 }
 if(file.size<=SOURCE_SINGLE_LIMIT){const path=state.root+'/original';await part(path,file,mimeType);onProgress?.(file.size,file.size);return{path,format:'single',paths:[path],sessionKey:key,size:file.size};}
 const chunks:SourceChunk[]=[];
 for(let index=0,offset=0;offset<file.size;index++,offset+=SOURCE_CHUNK_BYTES){const blob=file.slice(offset,offset+SOURCE_CHUNK_BYTES),path=`${state.root}/part-${String(index).padStart(5,'0')}`;const sha256=await part(path,blob,'application/octet-stream');chunks.push({index,path,size:blob.size,sha256});onProgress?.(offset+blob.size,file.size);}
 const manifest:SourceManifest={version:1,kind:'pourtrace-chunked-source',filename:file.name,mimeType,size:file.size,chunks};
 const path=state.root+'/manifest.json';await part(path,new Blob([JSON.stringify(manifest)],{type:'application/json'}),'application/json');return{path,format:'chunked',paths:[...chunks.map(chunk=>chunk.path),path],sessionKey:key,size:file.size};
}
