'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
async function ctx(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Not signed in');const {data:p}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!p?.company_id)throw new Error('Company missing');return {supabase,user,companyId:p.company_id};}
const n=(v:FormDataEntryValue|null)=>{const x=Number(String(v??'0').replace(/[$,% ,]/g,''));return Number.isFinite(x)?x:0;};
const r=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export async function createProjectCost(fd:FormData){
 const project_id=String(fd.get('project_id')||''),cost_code_id=String(fd.get('cost_code_id')||''),description=String(fd.get('description')||'').trim();if(!project_id||!cost_code_id||!description)return;
 const {supabase,user,companyId}=await ctx();const quantity=n(fd.get('quantity')),unitCost=n(fd.get('unit_cost')),tax=n(fd.get('sales_tax'));const subtotal=r(quantity*unitCost),total=r(subtotal+tax);
 const catalog=String(fd.get('catalog_item_id')||'')||null,budget_section_id=String(fd.get('budget_section_id')||'')||null;
 await supabase.from('project_costs').insert({company_id:companyId,project_id,budget_section_id,cost_code_id,catalog_item_id:catalog,cost_date:String(fd.get('cost_date')||new Date().toISOString().slice(0,10)),description,vendor_name:String(fd.get('vendor_name')||'').trim()||null,quantity,unit:String(fd.get('unit')||'LS'),unit_cost:unitCost,subtotal,sales_tax:tax,total_cost:total,source_type:String(fd.get('source_type')||'manual'),reference_number:String(fd.get('reference_number')||'').trim()||null,notes:String(fd.get('notes')||'').trim()||null,created_by:user.id});
 revalidatePath('/costs');revalidatePath('/projects');
}
export async function deleteProjectCost(fd:FormData){const id=String(fd.get('id')||'');if(!id)return;const {supabase,companyId}=await ctx();await supabase.from('project_costs').delete().eq('id',id).eq('company_id',companyId);revalidatePath('/costs');revalidatePath('/projects');}
