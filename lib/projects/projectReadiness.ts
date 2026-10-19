type JobSetupReadiness={
  award_setup_applies?:boolean|null;
  job_ready?:boolean|null;
  readiness_reason?:string|null;
};

type WorkReadiness={
  blocked_operation_count?:number|null;
  ready_operation_count?:number|null;
  blocked_operations?:number|null;
  ready_operations?:number|null;
  failed_inspection_operations?:number|null;
};

const count=(value:number|null|undefined)=>Number(value||0);

export function projectGoverningHold(projectId:string,setup:JobSetupReadiness|null|undefined,work:WorkReadiness|null|undefined){
  // Deployed external intakes can be held without an internal award workflow.
  // job_ready is authoritative; award_setup_applies describes that workflow only.
  const setupHold=setup?.job_ready===false||Boolean(setup?.award_setup_applies&&!setup.job_ready);
  const blocked=count(work?.blocked_operation_count??work?.blocked_operations);
  const ready=count(work?.ready_operation_count??work?.ready_operations);
  const failed=count(work?.failed_inspection_operations);
  const operationHold=Boolean(failed||(blocked>0&&ready===0));
  const blockedReason=blocked>0
    ?`${blocked} active operation${blocked===1?' is':'s are'} blocked by readiness checks${ready>0?`; ${ready} ${ready===1?'is':'are'} ready`:''}.`
    :null;
  const reason=setupHold
    ?setup?.readiness_reason||'Job setup is not cleared.'
    :failed?`${failed} operation${failed===1?' has':'s have'} a failed inspection.`
    :operationHold?blockedReason
    :null;
  return {
    setupHold,
    hardHold:setupHold||operationHold,
    blocked,
    ready,
    activeOperations:blocked+ready,
    blockedAttention:blocked>0,
    blockedReason,
    blockedHref:blockedReason?'/field?view=work-packages':null,
    blockedAction:blockedReason?'Review blocked operations':null,
    reason,
    href:setupHold?`/job-setup/${encodeURIComponent(projectId)}`:operationHold?'/field?view=work-packages':null,
    action:setupHold?'Review job setup':operationHold?'Review work plan':null,
  };
}

export function projectOperationalState(projectStatus:string,readiness:ReturnType<typeof projectGoverningHold>,inProgressOperations:number){
  if(projectStatus==='completed')return 'completed' as const;
  if(readiness.hardHold)return 'hold' as const;
  if(inProgressOperations>0)return 'planning' as const;
  if(readiness.ready>0)return 'ready' as const;
  if(projectStatus==='on_hold')return 'hold' as const;
  return 'setup' as const;
}
