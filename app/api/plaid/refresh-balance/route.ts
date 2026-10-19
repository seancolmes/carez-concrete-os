import {NextResponse} from 'next/server';
import {plaidConfigured} from '@/lib/plaid';
import {bankAccessStatus,bankProviderContext,syncBankConnections} from '@/lib/banking/plaidRoute.server';
import {analyzeBankTransactions} from '@/lib/bank-reconciliation';
import {providerMutationAllowed,PROVIDER_MUTATION_DENIED_MESSAGE} from '@/lib/provider-mutation-policy';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(){
 if(!providerMutationAllowed())return NextResponse.json({error:PROVIDER_MUTATION_DENIED_MESSAGE},{status:403});
 if(!plaidConfigured())return NextResponse.json({configured:false,complete:false,error:'Plaid is not configured.'},{status:503});
 try{
  const context=await bankProviderContext(),result=await syncBankConnections(context,true);
  const reconciliation=result.complete?await analyzeBankTransactions(context.supabase,context.companyId):{skipped:true,reason:'Bank synchronization is incomplete'};
  return NextResponse.json({configured:true,...result,reconciliation},{status:result.failed?502:result.complete?200:202});
 }catch(error){return NextResponse.json({complete:false,error:'Bank access, synchronization or analysis could not be confirmed. Retry without reconnecting.'},{status:bankAccessStatus(error)});}
}
