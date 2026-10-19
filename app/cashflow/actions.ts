'use server';
import {revalidateFinancialsWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import {createClient} from '@/lib/supabase/server';
import {executeCashCommand,type CashCommand} from '@/lib/financials/cashCommands';

async function save(form:FormData,command:CashCommand){
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)throw new Error('Not signed in');
 const {data:profile,error}=await supabase.from('profiles').select('company_id,role').eq('id',user.id).single();
 if(error||!profile?.company_id||!['owner','office'].includes(profile.role))throw new Error('Owner or office access required');
 await executeCashCommand(supabase,form,command);
 revalidatePath('/cashflow');revalidatePath('/overhead');revalidatePath('/pour-control');revalidatePath('/');
}
export async function addCompanyExpense(form:FormData){await save(form,'add_expense');}
export async function markCompanyExpensePaid(form:FormData){await save(form,'pay_expense');}
export async function voidCompanyExpense(form:FormData){await save(form,'void_expense');}
export async function addCashAccount(form:FormData){await save(form,'add_account');}
export async function recordCashBalance(form:FormData){await save(form,'record_balance');}
export async function addCashReserve(form:FormData){await save(form,'add_reserve');}
export async function releaseCashReserve(form:FormData){await save(form,'release_reserve');}
export async function recordTaxRemittance(form:FormData){await save(form,'record_remittance');}
export async function deleteTaxRemittance(form:FormData){await save(form,'reverse_remittance');}
