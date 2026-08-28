import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptAccessToken,plaidPost,syncPlaidConnection } from '@/lib/plaid';
import { analyzeBankTransactions } from '@/lib/bank-reconciliation';

export const runtime='nodejs';
export async function POST(req:NextRequest){
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:profile}=await supabase.from('profiles').select('company_id').eq('id',user.id).single();if(!profile?.company_id)return NextResponse.json({error:'Company profile missing'},{status:400});
    const body=await req.json();if(!body?.public_token)return NextResponse.json({error:'Missing Plaid public token'},{status:400});
    const exchanged:any=await plaidPost('/item/public_token/exchange',{public_token:body.public_token});
    const encrypted=encryptAccessToken(exchanged.access_token),now=new Date().toISOString();
    const row={company_id:profile.company_id,item_id:exchanged.item_id,institution_id:body?.institution?.institution_id||null,institution_name:body?.institution?.name||'Connected Bank',access_token_ciphertext:encrypted.ciphertext,token_iv:encrypted.iv,token_auth_tag:encrypted.authTag,status:'active',created_by:user.id,updated_at:now};
    const {data:connection,error}=await supabase.from('plaid_connections').upsert(row,{onConflict:'company_id,item_id'}).select('*').single();if(error||!connection)throw new Error(error?.message||'Unable to save bank connection');
    await syncPlaidConnection(supabase,profile.company_id,connection,{realtimeBalance:true});
    const reconciliation=await analyzeBankTransactions(supabase,profile.company_id);
    return NextResponse.json({ok:true,reconciliation});
  }catch(e:any){return NextResponse.json({error:e?.message||'Unable to connect bank'},{status:500});}
}
