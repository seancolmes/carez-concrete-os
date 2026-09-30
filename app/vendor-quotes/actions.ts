'use server';

import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function officeContext(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error('Sign in to manage vendor quotes.');
  const {data:profile,error}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
  if(error||!profile?.company_id||profile.role==='employee')throw new Error('Office access is required.');
  return {supabase,user,companyId:profile.company_id};
}

export async function createVendorAccessLink(fd:FormData){
  const estimateId=String(fd.get('estimate_id')||'');
  const quoteId=String(fd.get('quote_id')||'');
  if(!uuid.test(estimateId)||!uuid.test(quoteId))throw new Error('Select a valid estimate and supplier quote.');
  const outputIds=[...new Set(fd.getAll('output_id').map(value=>String(value)))];
  if(!outputIds.length||outputIds.length>500||outputIds.some(id=>!uuid.test(id)))throw new Error('Choose the resources this supplier may price.');
  const {supabase,user,companyId}=await officeContext();
  const {data:quote,error:quoteError}=await supabase.from('estimate_supplier_quotes')
    .select('id,quote_set_id,status,expires_at').eq('company_id',companyId).eq('id',quoteId).maybeSingle();
  if(quoteError||!quote||['declined','selected'].includes(quote.status))throw new Error('This supplier response cannot receive a link.');
  const {data:set,error:setError}=await supabase.from('estimate_supplier_quote_sets')
    .select('estimate_id,status').eq('company_id',companyId).eq('id',quote.quote_set_id).maybeSingle();
  if(setError||!set||set.estimate_id!==estimateId||set.status==='archived')throw new Error('Supplier quote set is unavailable.');
  const {data:estimate,error:estimateError}=await supabase.from('estimates')
    .select('status').eq('company_id',companyId).eq('id',estimateId).maybeSingle();
  if(estimateError||!estimate||['accepted','approved','superseded'].includes(estimate.status))throw new Error('This estimate revision is locked.');
  const {count,error:proposalError}=await supabase.from('proposal_presentations')
    .select('id',{count:'exact',head:true}).eq('company_id',companyId).eq('estimate_id',estimateId);
  if(proposalError||count)throw new Error('An issued proposal locks this estimate revision.');
  if(quote.expires_at&&quote.expires_at<new Date().toISOString().slice(0,10))throw new Error('The supplier quote has expired.');
  const {data:outputs,error:outputError}=await supabase.from('takeoff_measurement_outputs')
    .select('id,measurement_id,estimate_item_type,generated_estimate_item_id,is_active,estimate_visible,production_unit')
    .eq('company_id',companyId).in('id',outputIds);
  if(outputError||!outputs||outputs.length!==outputIds.length||outputs.some(output=>!output.is_active||!output.estimate_visible||!output.estimate_item_type||output.estimate_item_type==='labor'||!output.generated_estimate_item_id||!output.production_unit?.trim()))
    throw new Error('A selected resource is no longer available for supplier pricing.');
  const measurementIds=[...new Set(outputs.map(output=>output.measurement_id))];
  const {data:measurements,error:measurementError}=await supabase.from('takeoff_measurements')
    .select('id').eq('company_id',companyId).eq('estimate_id',estimateId).eq('status','active').in('id',measurementIds);
  if(measurementError||!measurements||measurements.length!==measurementIds.length)throw new Error('Selected resources must belong to this estimate revision.');
  const {data:created,error:insertError}=await supabase.from('estimate_supplier_quote_access_tokens')
    .insert({company_id:companyId,quote_id:quoteId,created_by:user.id})
    .select('id').single();
  if(insertError||!created)throw new Error(insertError?.message||'Could not create supplier link.');
  const {error:itemError}=await supabase.from('estimate_supplier_quote_access_items')
    .insert(outputIds.map(id=>({company_id:companyId,access_token_id:created.id,source_takeoff_output_id:id})));
  if(itemError){
    await supabase.from('estimate_supplier_quote_access_tokens').update({revoked_at:new Date().toISOString()}).eq('company_id',companyId).eq('id',created.id);
    throw new Error(itemError.message);
  }
  const {error:revokeError}=await supabase.from('estimate_supplier_quote_access_tokens')
    .update({revoked_at:new Date().toISOString()}).eq('company_id',companyId).eq('quote_id',quoteId).neq('id',created.id).is('revoked_at',null);
  if(revokeError){
    await supabase.from('estimate_supplier_quote_access_tokens').update({revoked_at:new Date().toISOString()}).eq('company_id',companyId).eq('id',created.id);
    throw new Error('Prior supplier links could not be revoked.');
  }
  revalidatePath('/vendor-quotes');
}

export async function revokeVendorAccessLink(fd:FormData){
  const tokenId=String(fd.get('token_id')||'');
  if(!uuid.test(tokenId))throw new Error('Select a valid supplier link.');
  const {supabase,companyId}=await officeContext();
  const {error}=await supabase.from('estimate_supplier_quote_access_tokens')
    .update({revoked_at:new Date().toISOString()}).eq('company_id',companyId).eq('id',tokenId);
  if(error)throw new Error(error.message);
  revalidatePath('/vendor-quotes');
}

export type VendorPriceActionState={error:string;success:string};

export async function submitVendorPrice(_previous:VendorPriceActionState,fd:FormData):Promise<VendorPriceActionState>{
  const token=String(fd.get('token')||'');
  const outputId=String(fd.get('output_id')||'');
  const unitCostText=String(fd.get('unit_cost')||'').trim();
  const unitCost=Number(unitCostText);
  const reference=String(fd.get('source_reference')||'').trim();
  if(!uuid.test(token)||!uuid.test(outputId)||!unitCostText||!Number.isFinite(unitCost)||unitCost<0||unitCost>1000000000)
    return {error:'Enter a valid unit price.',success:''};
  if(reference.length>250)return {error:'Reference must be 250 characters or fewer.',success:''};
  try{
    const supabase=await createClient();
    const {data,error}=await supabase.rpc('carez_submit_public_vendor_quote_line',{
      p_token:token,p_output_id:outputId,p_unit_cost:unitCost,p_source_reference:reference||null,
    });
    if(error)throw error;
    if(!data)return {error:'This supplier link is no longer open for pricing.',success:''};
    revalidatePath(`/vendor-quotes/${token}`);
    revalidatePath('/vendor-quotes');
    revalidatePath('/opportunities');
    return {error:'',success:'Unit price saved.'};
  }catch{
    return {error:'The unit price could not be saved. Please try again.',success:''};
  }
}
