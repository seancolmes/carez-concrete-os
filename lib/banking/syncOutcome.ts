type Outcome={complete?:unknown;connected?:unknown;busy?:unknown;matchedSourceChanges?:unknown;error?:unknown;connections?:unknown};
/** HTTP202 is a saved or resumable outcome, never a completed bank refresh. */
export function bankSyncOutcome(data:Outcome,accepted:boolean){
 if(!accepted)return{complete:false,tone:'error' as const,message:typeof data.error==='string'?data.error:'Bank synchronization was not confirmed. Review the connection before retrying.'};
 if(data.complete!==true)return{complete:false,tone:'warning' as const,message:typeof data.error==='string'?data.error:data.connected===true?'Bank connection saved. Initial synchronization is incomplete; use Refresh bank to continue.':'Synchronization is incomplete or already running. Use Refresh bank to continue; do not reconnect.'};
 const changed=typeof data.matchedSourceChanges==='number'&&data.matchedSourceChanges>0;
 return{complete:true,tone:changed?'warning' as const:'success' as const,message:changed?'Bank refresh completed. Matched bank evidence changed; review the flagged transactions. Recorded financial entries were preserved.':'Bank refresh completed. Review transactions before treating bank activity as posted job costs.'};
}
