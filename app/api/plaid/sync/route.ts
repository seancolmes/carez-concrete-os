import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidConfigured,syncPlaidConnection } from '@/lib/plaid';

export const runtime='nodejs';
export async function POST(){
  if(!plaidConfigured())return NextResponse.json({configured:false,changed:0});
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)return NextResponse.json({error:'Company profile missing'},{status:400});
    const {data:connections}=await supabase.from('plaid_connections').select('*').eq('company_id',profile.company_id).eq('status','active');
    let changed=0;
    for(const connection of connections||[]){try{const r=await syncPlaidConnection(supabase,profile.company_id,connection);changed+=r.changed;}catch(e:any){await supabase.from('plaid_connections').update({status:'needs_attention',last_error_code:e?.code||null,last_error_message:e?.message||'Plaid sync failed',updated_at:new Date().toISOString()}).eq('id',connection.id);}}
    return NextResponse.json({configured:true,connections:(connections||[]).length,changed});
  }catch(e:any){return NextResponse.json({error:e?.message||'Bank sync failed'},{status:500});}
}
