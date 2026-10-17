import {financialRequestId} from './commands.ts';
export function pourAuthorizationRequest(form:FormData){
 return{p_request_id:financialRequestId(form),p_pour_plan_id:String(form.get('pour_plan_id')||''),p_fingerprint:String(form.get('financial_basis_fingerprint')||''),p_decision:String(form.get('decision')||''),p_reason:String(form.get('override_reason')||'').trim()||null,p_notes:String(form.get('notes')||'').trim()||null};
}
export async function executePourAuthorization(client:{rpc:(name:string,args:Record<string,unknown>)=>any},form:FormData){
 const {data,error}=await client.rpc('carez_record_pour_authorization_v1',pourAuthorizationRequest(form));if(error||data?.ok!==true||!data.id)throw new Error(error?.message||'Pour decision was not confirmed. Retry the same form.');return data;
}
