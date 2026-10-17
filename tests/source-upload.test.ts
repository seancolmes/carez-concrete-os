import test from 'node:test';import assert from 'node:assert/strict';import {uploadSourceFile,forgetSourceUpload} from '../lib/documents/uploadSourceFile.ts';import {SOURCE_SINGLE_LIMIT,SOURCE_CHUNK_BYTES,parseSourceManifest} from '../lib/documents/sourceManifest.ts';
const company='f0100000-0000-4000-8000-000000000001';
test('chunked upload resumes an acknowledged-or-unknown transport result without overwriting original parts',async()=>{
 const objects=new Map<string,Blob>(),calls:string[]=[];let fail=true;
 const store={upload:async(path:string,body:Blob,options:any)=>{assert.equal(options.upsert,false);assert.equal(objects.has(path),false);objects.set(path,body);calls.push(path);if(path.endsWith('part-00001')&&fail){fail=false;return{error:{message:'Synthetic lost response'}};}return{error:null};},info:async(path:string)=>objects.has(path)?{data:{size:objects.get(path)!.size},error:null}:{data:null,error:{statusCode:404}},download:async(path:string)=>({data:objects.get(path),error:null})};
 const client:any={storage:{from:()=>store}},file=new File([new Uint8Array(SOURCE_SINGLE_LIMIT+7)],'Synthetic large source.pdf',{type:'application/pdf',lastModified:1});
 await assert.rejects(uploadSourceFile(client,file,company,false),/Synthetic lost response/);
 const result=await uploadSourceFile(client,file,company,false);assert.equal(result.format,'chunked');assert.equal(result.size,file.size);assert.equal(new Set(calls).size,calls.length);
 const manifest=parseSourceManifest(JSON.parse(await objects.get(result.path)!.text()),result.path,company,false);assert.equal(manifest.chunks.length,Math.ceil(file.size/SOURCE_CHUNK_BYTES));assert.ok(manifest.chunks.every(chunk=>chunk.size<=SOURCE_CHUNK_BYTES));assert.equal(manifest.chunks.reduce((sum,chunk)=>sum+chunk.size,0),file.size);forgetSourceUpload(result);
});
test('small private originals keep their actual format and use the office-only namespace',async()=>{
 const paths:string[]=[];const client:any={storage:{from:()=>({upload:async(path:string)=>{paths.push(path);return{error:null};}})}};const file=new File(['{"synthetic":true}'],'review.json',{type:'application/json',lastModified:2});const result=await uploadSourceFile(client,file,company,true);assert.equal(result.format,'single');assert.ok(result.path.startsWith(company+'/office-private/'));assert.equal(paths.length,1);forgetSourceUpload(result);
});
