import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidConfigured,syncPlaidConnection } from '@/lib/plaid';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';

export const runtime='nodejs';
export async function POST(){
  if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
  if(!plaidConfigured())return NextResponse.json({error:'Plaid is not configured'},{status:400});
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)return NextResponse.json({error:'Company profile missing'},{status:400});
    const {data:connections}=await supabase.from('plaid_connections').select('*').eq('company_id',profile.company_id).eq('status','active');
    for(const connection of connections||[])await syncPlaidConnection(supabase,profile.company_id,connection,{realtimeBalance:true});
    return NextResponse.json({ok:true,connections:(connections||[]).length});
  }catch(e:any){return NextResponse.json({error:e?.message||'Balance refresh failed'},{status:500});}
}
