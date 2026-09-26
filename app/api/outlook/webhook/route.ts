import {NextRequest,NextResponse} from 'next/server';
import {createClient as createAnonClient} from '@supabase/supabase-js';
import {classifyOutlookMessage,decryptOutlookToken,encryptOutlookToken,graphRequest,refreshOutlookToken} from '@/lib/outlook';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';

export const runtime='nodejs';

function anon(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!url||!key)throw new Error('Supabase environment variables missing');return createAnonClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}

export async function POST(req:NextRequest){
  const validation=req.nextUrl.searchParams.get('validationToken');if(validation)return new NextResponse(validation,{status:200,headers:{'Content-Type':'text/plain'}});
  if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
  try{
    const body:any=await req.json(),supabase=anon();
    for(const n of body?.value||[]){
      const subscriptionId=String(n.subscriptionId||''),clientState=String(n.clientState||'');if(!subscriptionId||!clientState)continue;
      const {data:rows}=await supabase.rpc('outlook_webhook_connection',{p_subscription_id:subscriptionId,p_client_state:clientState});const c:any=Array.isArray(rows)?rows[0]:null;if(!c)continue;
      let access:string;
      if(new Date(c.token_expires_at||0).getTime()>Date.now()+5*60*1000)access=decryptOutlookToken(c.access_token_ciphertext,c.access_token_iv,c.access_token_auth_tag);
      else{
        const oldRefresh=decryptOutlookToken(c.refresh_token_ciphertext,c.refresh_token_iv,c.refresh_token_auth_tag),tokens:any=await refreshOutlookToken(oldRefresh),a=encryptOutlookToken(tokens.access_token),r=encryptOutlookToken(tokens.refresh_token||oldRefresh),expiresAt=new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString();access=tokens.access_token;
        await supabase.rpc('outlook_webhook_update_tokens',{p_subscription_id:subscriptionId,p_client_state:clientState,p_access_cipher:a.ciphertext,p_access_iv:a.iv,p_access_tag:a.authTag,p_refresh_cipher:r.ciphertext,p_refresh_iv:r.iv,p_refresh_tag:r.authTag,p_expires_at:expiresAt});
      }
      let messageId=String(n?.resourceData?.id||'');if(!messageId){const m=String(n.resource||'').match(/messages\/([^/?]+)/i);if(m)messageId=decodeURIComponent(m[1]);}if(!messageId)continue;
      const message:any=await graphRequest(access,`/me/messages/${encodeURIComponent(messageId)}?$select=id,conversationId,internetMessageId,subject,from,receivedDateTime,bodyPreview,webLink`),candidate=classifyOutlookMessage(message);
      const normalized={id:message.id,conversationId:message.conversationId||null,internetMessageId:message.internetMessageId||null,subject:message.subject||null,senderName:message?.from?.emailAddress?.name||null,senderEmail:message?.from?.emailAddress?.address||null,receivedDateTime:message.receivedDateTime||null,bodyPreview:message.bodyPreview||null,webLink:message.webLink||null};
      await supabase.rpc('outlook_ingest_message',{p_subscription_id:subscriptionId,p_client_state:clientState,p_message:normalized,p_candidate:{classification:candidate.classification,confidence:candidate.confidence,customerName:candidate.customerName,contactName:candidate.contactName,email:candidate.email,phone:candidate.phone,projectName:candidate.projectName,address:candidate.address,city:candidate.city,state:candidate.state,postalCode:candidate.postalCode,scope:candidate.scope,bidDue:candidate.bidDue},p_auto_create:candidate.autoCreate});
    }
    return NextResponse.json({received:true},{status:202});
  }catch{return NextResponse.json({received:true},{status:202});}
}
