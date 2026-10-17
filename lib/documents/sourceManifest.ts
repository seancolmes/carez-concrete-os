export const SOURCE_MAX_BYTES=100*1024*1024;
export const SOURCE_CHUNK_BYTES=3*1024*1024;
export const SOURCE_SINGLE_LIMIT=32*1024*1024;
export type SourceChunk={index:number;path:string;size:number;sha256:string};
export type SourceManifest={version:1;kind:'pourtrace-chunked-source';filename:string;mimeType:string;size:number;chunks:SourceChunk[]};
export function parseSourceManifest(input:unknown,manifestPath:string,companyId:string,privateFile:boolean):SourceManifest{
 const value=input as Partial<SourceManifest>|null;
 const prefix=`${companyId}/${privateFile?'office-private':'sources'}/`;
 const root=manifestPath.endsWith('/manifest.json')?manifestPath.slice(0,-14):'';
 if(!root.startsWith(prefix)||! /^[a-f0-9-]{16,80}$/i.test(root.slice(prefix.length)))throw new Error('Chunk manifest path is outside its company and access scope.');
 if(!value||value.version!==1||value.kind!=='pourtrace-chunked-source'||typeof value.filename!=='string'||!value.filename.trim()||value.filename.length>255||/[\u0000-\u001f]/.test(value.filename)||typeof value.mimeType!=='string'||value.mimeType.length>150||!Number.isSafeInteger(value.size)||value.size!<=0||value.size!>SOURCE_MAX_BYTES||!Array.isArray(value.chunks)||value.chunks.length!==Math.ceil(value.size!/SOURCE_CHUNK_BYTES))throw new Error('Invalid or incomplete chunk manifest.');
 const chunks=value.chunks.map((chunk,index)=>{
  const size=Math.min(SOURCE_CHUNK_BYTES,value.size!-index*SOURCE_CHUNK_BYTES);
  if(!chunk||chunk.index!==index||chunk.size!==size||chunk.path!==`${root}/part-${String(index).padStart(5,'0')}`||typeof chunk.sha256!=='string'||!/^[a-f0-9]{64}$/.test(chunk.sha256))throw new Error('Chunk order, length, path or fingerprint is invalid.');
  return {index,path:chunk.path,size,sha256:chunk.sha256};
 });
 return{version:1,kind:'pourtrace-chunked-source',filename:value.filename,mimeType:value.mimeType,size:value.size!,chunks};
}
export type ByteRange={start:number;end:number;partial:boolean};
export function sourceNotModified(header:string|null,etag:string|null){
 if(!header)return false;
 return header.split(',').some(value=>value.trim()==='*'||!!etag&&value.trim().replace(/^W\//,'')===etag);
}
export function sourceByteRange(header:string|null,size:number):ByteRange{
 if(!Number.isSafeInteger(size)||size<=0)throw new Error('Source length unavailable.');
 if(header===null)return{start:0,end:size-1,partial:false};
 const match=/^bytes=(\d*)-(\d*)$/.exec(header.trim());if(!match||(!match[1]&&!match[2]))throw new Error('Unsupported byte range.');
 const first=match[1]?Number(match[1]):null,last=match[2]?Number(match[2]):null;
 if((first!==null&&!Number.isSafeInteger(first))||(last!==null&&!Number.isSafeInteger(last)))throw new Error('Invalid byte range.');
 const start=first===null?Math.max(0,size-last!):first,end=first===null?size-1:Math.min(last??size-1,size-1);
 if(start>=size||end<start||(first===null&&last===0))throw new Error('Unsatisfiable byte range.');
 return{start,end,partial:true};
}
