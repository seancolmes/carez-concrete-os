import {NextRequest,NextResponse} from 'next/server';
import {encryptAccessToken,plaidPost,plaidConfigured} from '@/lib/plaid';
import {assertPlaidSyncWriterConfigured,registerPlaidConnection,syncPlaidConnection} from '@/lib/plaidSync.server';
import {bankAccessStatus,bankProviderContext} from '@/lib/banking/plaidRoute.server';
import {analyzeBankTransactions} from '@/lib/bank-reconciliation';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(req:NextRequest){
 if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
 if(!plaidConfigured())return NextResponse.json({complete:false,error:'Plaid is not configured.'},{status:503});
 let connectionId:string|undefined,exchanged=false;
 try{
  const context=await bankProviderContext();await assertPlaidSyncWriterConfigured(context);
  const body=await req.json();if(typeof body?.public_token!=='string'||!body.public_token.trim())return NextResponse.json({error:'Missing Plaid public token'},{status:400});
  const result:any=await plaidPost('/item/public_token/exchange',{public_token:body.public_token},{signal:AbortSignal.timeout(45_000)});exchanged=true;
  if(typeof result.access_token!=='string'||typeof result.item_id!=='string')throw new Error('Provider connection identity unavailable');
  const encrypted=encryptAccessToken(result.access_token);
  connectionId=await registerPlaidConnection(context,result.item_id,{access_token_ciphertext:encrypted.ciphertext,token_iv:encrypted.iv,token_auth_tag:encrypted.authTag,institution_id:typeof body.institution?.institution_id==='string'?body.institution.institution_id:null,institution_name:typeof body.institution?.name==='string'?body.institution.name:'Connected Bank'});
  const sync=await syncPlaidConnection({...context,connectionId},{realtimeBalance:true});
  const reconciliation=sync.complete?await analyzeBankTransactions(context.supabase,context.companyId):{skipped:true,reason:'Initial sync is incomplete'};
  return NextResponse.json({ok:sync.complete,connected:true,...sync,reconciliation},{status:sync.complete?200:202});
 }catch(error){return NextResponse.json({complete:false,connected:Boolean(connectionId),error:connectionId?'Bank connection saved. Initial sync is incomplete; retry synchronization.':exchanged?'Provider exchange completed, but saving the connection was not confirmed. Review the connection before starting another Link session.':'Bank connection could not be confirmed. Review the connection before retrying.'},{status:connectionId?202:bankAccessStatus(error)});}
}
