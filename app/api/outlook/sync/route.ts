import crypto from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {createOutlookSubscription,ensureOutlookAccessToken,outlookConfigured,renewOutlookSubscription,syncOutlookMailbox} from '@/lib/outlook';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';

export const runtime='nodejs';

export async function POST(req:NextRequest){
  if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
  if(!outlookConfigured())return NextResponse.json({configured:false,connected:false});
  try{
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:p}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();if(!p?.company_id||p.role==='employee')return NextResponse.json({error:'Owner access required'},{status:403});
    const {data:connection}=await supabase.from('outlook_connections').select('*').eq('company_id',p.company_id).eq('status','active').maybeSingle();if(!connection)return NextResponse.json({configured:true,connected:false});
    const access=await ensureOutlookAccessToken(supabase,connection),origin=new URL(req.url).origin,renewBefore=Date.now()+24*60*60*1000;
    let subscriptionId=connection.subscription_id||null,subscriptionExpires=connection.subscription_expires_at||null,clientState=connection.subscription_client_state||null,lastError:string|null=null;
    if(subscriptionId&&new Date(subscriptionExpires||0).getTime()<renewBefore){
      try{const renewed:any=await renewOutlookSubscription(access,subscriptionId);subscriptionExpires=renewed.expirationDateTime||subscriptionExpires;}catch{subscriptionId=null;subscriptionExpires=null;clientState=null;}
    }
    if(!subscriptionId){
      try{clientState=crypto.randomBytes(32).toString('hex');const created:any=await createOutlookSubscription(access,origin,clientState);subscriptionId=created.id;subscriptionExpires=created.expirationDateTime;}catch(e:any){lastError=`Outlook background watch unavailable; inbox scanning still works. ${e?.message||''}`.trim();}
    }
    await supabase.from('outlook_connections').update({subscription_id:subscriptionId,subscription_client_state:subscriptionId?clientState:null,subscription_expires_at:subscriptionExpires,last_error:lastError,updated_at:new Date().toISOString()}).eq('id',connection.id).eq('company_id',p.company_id);
    const result=await syncOutlookMailbox(supabase,p.company_id,{...connection,subscription_id:subscriptionId,subscription_client_state:clientState,subscription_expires_at:subscriptionExpires});
    return NextResponse.json({ok:true,configured:true,connected:true,background_watch:Boolean(subscriptionId),...result});
  }catch(e:any){return NextResponse.json({error:e?.message||'Outlook sync failed'},{status:500});}
}
