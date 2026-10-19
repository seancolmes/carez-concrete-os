import type {CrewMutation} from './administration.ts';

export type CrewActionState={status:'idle'|'error'|'saved';message:string;settingsHref?:string};

/** Presentation only. The original atomic mutation still owns authorization and validation. */
export async function crewActionFeedback(operation:CrewMutation,save:()=>Promise<void>):Promise<CrewActionState>{
 try{
  await save();
  return {status:'saved',message:operation==='create'?'Crew member saved.':operation==='rate'?'New rate saved.':'Worker changes saved.'};
 }catch(error){
  const message=error instanceof Error?error.message:'The worker change could not be confirmed. Review Crew before retrying.';
  return {status:'error',message,...(message==='Configure the company operating calendar before changing Crew terms.'?{settingsHref:'/settings?tab=company'}:{})};
 }
}
