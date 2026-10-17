export function confirmedChangeOrderApproval(value:unknown,changeOrderId:string){
 const result=value as {change_order_id?:unknown;delta_id?:unknown;source_fingerprint?:unknown;already_approved?:unknown}|null;
 if(!result||result.change_order_id!==changeOrderId||typeof result.delta_id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(result.delta_id)||typeof result.source_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(result.source_fingerprint)||typeof result.already_approved!=='boolean')throw new Error('No immutable commercial approval was confirmed. Reopen the Change Order before retrying.');
 return result;
}
