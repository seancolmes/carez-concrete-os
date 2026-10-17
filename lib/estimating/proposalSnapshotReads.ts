type ReadResult<T>={data:T|null;error?:{code?:string;message?:string}|null};
/** Only the deliberately excluded, absent Intelligence option relation is optional. */
export function proposalSnapshotRead<T>(label:string,result:ReadResult<T>,missingSchemaOptional=false):{data:T|null;unavailable:boolean}{
 if(result.error){
  if(missingSchemaOptional&&result.error.code==='PGRST205')return{data:null,unavailable:true};
  throw new Error(`${label} unavailable. Reload before issuing the Proposal.`);
 }
 return{data:result.data,unavailable:false};
}
