/** Project the complete server gate; never promote base readiness to clearance. */
export function startReadinessPresentation<T extends Record<string,any>>(row:T){
  return {...row,
    ready_to_start:typeof row.ready_to_start_all==='boolean'?row.ready_to_start_all:null,
    readiness_status:row.start_readiness_status||'unavailable',
    next_action:row.start_next_action||'Readiness unavailable',
    blocking_reasons:row.all_blocking_reasons||[],warning_reasons:row.all_warning_reasons||[],
  };
}

export const inspectionIsCleared=(status:unknown)=>status==='passed'||status==='waived';

export function scheduledWorkReadiness(row:{work_package_operation_id?:unknown;ready_to_start?:unknown;readiness_action?:string|null}){
  if(!row.work_package_operation_id)return{blocked:false,label:'Unlinked work',reason:''};
  if(row.ready_to_start===true)return{blocked:false,label:'Ready',reason:row.readiness_action||'Ready to start'};
  if(row.ready_to_start===false)return{blocked:true,label:'Hold',reason:row.readiness_action||'Office must clear this work first.'};
  return{blocked:true,label:'Readiness unavailable',reason:'Readiness could not be verified. Contact the office before starting this work.'};
}
