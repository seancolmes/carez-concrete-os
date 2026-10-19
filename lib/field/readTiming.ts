/** Request-local timings only: no data, user IDs, credentials or global cache. */
export async function timedFieldRead<T>(name:string,read:()=>PromiseLike<T>,report?:(name:string,ms:number)=>void):Promise<T>{
 const start=performance.now();
 try{return await read();}
 finally{
  const ms=Math.round((performance.now()-start)*10)/10;
  if(report)report(name,ms);
  else if(process.env.POURTRACE_TRACE_FIELD_READS==='1')console.info(JSON.stringify({event:'field-read',name,ms}));
 }
}
