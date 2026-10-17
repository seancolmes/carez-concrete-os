type Client={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:any;error:any}>};
export async function recordedOverheadSnapshot(client:Client,effectiveDate:string){
 const result=await client.rpc('carez_capture_overhead_v2',{p_effective_date:effectiveDate});
 if(result.error)throw new Error(result.error.message||'Overhead unavailable. Review the business plan in Administration.');
 const value=result.data,rate=value?.overhead_rate_per_productive_hour;
 if(!value||typeof value.id!=='string'||!/^[0-9a-f-]{36}$/i.test(value.id)||value.source_type!=='configured'||rate===null||rate===undefined||rate===''||!Number.isFinite(Number(rate))||Number(rate)<0)throw new Error('Configured overhead basis unavailable. Review the business plan in Administration.');
 return {...value,id:value.id as string,overhead_rate_per_productive_hour:Number(rate)};
}
