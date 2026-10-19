import { NextRequest,NextResponse } from 'next/server';
import {bankProviderContext} from '@/lib/banking/plaidRoute.server';
import {assertPlaidSyncWriterConfigured} from '@/lib/plaidSync.server';
import { plaidPost } from '@/lib/plaid';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';

export const runtime='nodejs';
export async function POST(req:NextRequest){
  if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
  try{
    const context=await bankProviderContext();await assertPlaidSyncWriterConfigured(context);
    const origin=new URL(req.url).origin;
    const data:any=await plaidPost('/link/token/create',{user:{client_user_id:context.actorId},client_name:'PourTrace',products:['transactions'],country_codes:['US'],language:'en',webhook:`${origin}/api/plaid/webhook`,transactions:{days_requested:730}});
    return NextResponse.json({link_token:data.link_token,expiration:data.expiration});
  }catch(e:any){return NextResponse.json({error:e?.message||'Unable to create Plaid Link session'},{status:500});}
}
