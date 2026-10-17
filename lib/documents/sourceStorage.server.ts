import {createHash} from 'node:crypto';
import {parseSourceManifest,SOURCE_MAX_BYTES,SOURCE_CHUNK_BYTES,type SourceManifest} from './sourceManifest.ts';
type Client={storage:{from(bucket:string):any}};
type Transport={fetcher?:typeof fetch;origin?:string;signal?:AbortSignal;seal?:(paths:string[])=>Promise<void>};
export async function sourceObjectResponse(client:Client,path:string,options:Transport&{range?:string}={}){
 const signed=await client.storage.from('carez-documents').createSignedUrl(path,60);
 if(signed.error||!signed.data?.signedUrl)throw new Error('Source object access unavailable.');
 const trusted=new URL(options.origin||process.env.NEXT_PUBLIC_SUPABASE_URL||'');
 const url=new URL(signed.data.signedUrl);if(url.origin!==trusted.origin)throw new Error('Unexpected source storage origin.');
 const response=await (options.fetcher||fetch)(url,{cache:'no-store',redirect:'error',signal:options.signal,headers:options.range?{Range:options.range}:undefined});
 if(!response.ok||!response.body)throw new Error('Source object read unavailable.');return response;
}
export async function* boundedSourceBytes(response:Response,maxBytes:number){
 const length=Number(response.headers.get('content-length'));if(Number.isFinite(length)&&length>maxBytes){await response.body?.cancel();throw new Error('Source object exceeds its recorded byte limit.');}
 const reader=response.body!.getReader();let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maxBytes)throw new Error('Source object exceeds its recorded byte limit.');yield next.value;}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function sourceObjectBuffer(client:Client,path:string,maxBytes:number,options:Transport={}){
 const parts:Uint8Array[]=[];for await(const bytes of boundedSourceBytes(await sourceObjectResponse(client,path,options),maxBytes))parts.push(bytes);
 return Buffer.concat(parts);
}
export async function verifyUploadedSource(client:Client,path:string,companyId:string,privateFile:boolean,format:string,requiresPdf:boolean,options:Transport={}){
 const prefix=`${companyId}/${privateFile?'office-private':'sources'}/`;
 if(!path.startsWith(prefix)||path.includes('..'))throw new Error('Source path does not match its access scope.');
 if(format!=='single'&&format!=='chunked')throw new Error('Unsupported source storage format.');
 await options.seal?.([path]);
 let manifest:SourceManifest|null=null;
 if(format==='chunked'){
  const data=await sourceObjectBuffer(client,path,65536,options);try{manifest=parseSourceManifest(JSON.parse(data.toString('utf8')),path,companyId,privateFile);}catch{throw new Error('Source manifest is incomplete or outside its access scope.');}
 }
 const hash=createHash('sha256');let size=0,first=Buffer.alloc(0);
 const sources=manifest?manifest.chunks.map(chunk=>({path:chunk.path,size:chunk.size,hash:chunk.sha256})):[{path,size:SOURCE_MAX_BYTES,hash:null}];
 if(manifest)await options.seal?.(sources.map(source=>source.path));
 for(const source of sources){const partHash=createHash('sha256');let partSize=0;
  for await(const bytes of boundedSourceBytes(await sourceObjectResponse(client,source.path,options),source.size)){
   if(first.length<5)first=Buffer.concat([first,bytes.subarray(0,5-first.length)]);size+=bytes.byteLength;partSize+=bytes.byteLength;hash.update(bytes);partHash.update(bytes);
  }
  if(source.hash&&(partSize!==source.size||partHash.digest('hex')!==source.hash))throw new Error('Source chunk bytes do not match their recorded fingerprint. Retry the original upload.');
 }
 if(size<=0||size>SOURCE_MAX_BYTES||(manifest&&size!==manifest.size))throw new Error('Source byte length is incomplete or invalid.');
 if(requiresPdf&&first.toString('ascii')!=='%PDF-')throw new Error('Plan sources must contain original PDF bytes.');
 const sha256=hash.digest('hex');return {sha256,size,format,manifest:manifest?{...manifest,sha256}:null};
}
export async function verifiedSourceChunk(client:Client,path:string,size:number,sha256:string,options:Transport={}){
 if(!Number.isSafeInteger(size)||size<=0||size>SOURCE_CHUNK_BYTES)throw new Error('Source chunk size is invalid.');
 const bytes=await sourceObjectBuffer(client,path,size,options);
 if(bytes.length!==size||createHash('sha256').update(bytes).digest('hex')!==sha256)throw new Error('Source chunk integrity check failed.');return bytes;
}
