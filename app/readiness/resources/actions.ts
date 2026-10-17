'use server';
import {revalidateFieldWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import {createClient} from '@/lib/supabase/server';
import {executeResourceCommand,type ResourceCommand} from '@/lib/field/resourceCommand';
async function execute(form:FormData,command:ResourceCommand){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in before changing resources.');
 await executeResourceCommand(client,form,command);
 for(const path of ['/readiness/resources','/readiness','/look-ahead','/schedule','/production/work-packages','/production/work-packages/financials','/equipment','/employee','/'])revalidatePath(path);
}
export async function createResourceRequirement(form:FormData){await execute(form,'create');}
export async function reserveMaterial(form:FormData){await execute(form,'reserve_material');}
export async function markMaterialConsumed(form:FormData){await execute(form,'consume');}
export async function linkPurchaseOrderLine(form:FormData){await execute(form,'link_po');}
export async function reserveEquipment(form:FormData){await execute(form,'reserve_equipment');}
export async function updateVendorCommitment(form:FormData){await execute(form,'vendor');}
export async function waiveResourceRequirement(form:FormData){await execute(form,'waive');}
export async function restoreResourceRequirement(form:FormData){await execute(form,'restore');}
export async function deleteResourceRequirement(form:FormData){await execute(form,'delete');}
