import {revalidatePath} from 'next/cache';

export function revalidateFieldWorkspace(path:string){
  revalidatePath(path);
  if(path!=='/field')revalidatePath('/field');
}

export function revalidateFinancialsWorkspace(path:string){
  revalidatePath(path);
  if(path!=='/financials')revalidatePath('/financials');
}
