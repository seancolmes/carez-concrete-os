'use server';
import {revalidateFieldWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import {createClient} from '@/lib/supabase/server';
import {submitCrewMutation,type CrewMutation} from '@/lib/crew/administration';
import {crewActionFeedback,type CrewActionState} from '@/lib/crew/actionFeedback';

async function save(operation:CrewMutation,formData:FormData){
 const supabase=await createClient();
 await submitCrewMutation(supabase,operation,formData);
 revalidatePath('/crew');revalidatePath('/field');revalidatePath('/employee');
}
export async function createCrewMember(formData:FormData){await save('create',formData);}
export async function updateCrewMember(formData:FormData){await save('update',formData);}
export async function changeCrewRate(formData:FormData){await save('rate',formData);}

export async function saveCrewForm(operation:CrewMutation,_prior:CrewActionState,formData:FormData):Promise<CrewActionState>{
 return crewActionFeedback(operation,()=>save(operation,formData));
}
