type ReadResult<T>={data:readonly T[]|null;error:unknown|null};
type ScheduleRow={work_package_operation_id:string|null};
type OperationRow={operation_id:string;ready_to_start_all:boolean|null;start_next_action:string|null;inspection_clear_count:number|null;inspection_count:number|null};

export type DashboardOperationReadiness={
  status:'ready'|'hold'|'unlinked'|'missing'|'unavailable';
  inspectionClear:number|null;
  inspectionCount:number|null;
  nextAction:string|null;
};

export function dashboardOperationMessage(readiness?:DashboardOperationReadiness|null){
  if(!readiness||readiness.status==='unlinked')return 'No operation linked to this pour.';
  if(readiness.status==='missing')return 'Linked operation readiness record is missing.';
  if(readiness.status==='unavailable')return 'Readiness unavailable.';
  return `Operation readiness: ${readiness.status}${readiness.nextAction?` · ${readiness.nextAction}`:''}`;
}

export function dashboardOperationBadge(readiness?:DashboardOperationReadiness|null){
  if(readiness?.status==='ready')return 'Ready';
  if(readiness?.status==='hold')return 'Hold';
  return !readiness||readiness.status==='unlinked'?'Not linked':'Unavailable';
}

const unknown=(status:DashboardOperationReadiness['status']):DashboardOperationReadiness=>({status,inspectionClear:null,inspectionCount:null,nextAction:null});
const count=(value:number|null)=>value===null||!Number.isFinite(Number(value))?null:Number(value);

export function dashboardOperationReadModel(
  shifts:ReadResult<unknown>,
  schedule:ReadResult<ScheduleRow>,
  operations:ReadResult<OperationRow>,
){
  const operationsUnavailable=operations.error!==null||operations.data===null;
  const byId=new Map((operations.data||[]).map(row=>[row.operation_id,row]));
  const forOperation=(operationId:string|null|undefined):DashboardOperationReadiness=>{
    if(!operationId)return unknown('unlinked');
    if(operationsUnavailable)return unknown('unavailable');
    const row=byId.get(operationId);
    if(!row)return unknown('missing');
    if(row.ready_to_start_all!==true&&row.ready_to_start_all!==false)return unknown('unavailable');
    return {status:row.ready_to_start_all?'ready':'hold',inspectionClear:count(row.inspection_clear_count),inspectionCount:count(row.inspection_count),nextAction:row.start_next_action||null};
  };
  const attentionIncomplete=shifts.error!==null||shifts.data===null||schedule.error!==null||schedule.data===null||operationsUnavailable
    ||(schedule.data||[]).some(item=>{
      const status=forOperation(item.work_package_operation_id).status;
      return status==='missing'||status==='unavailable';
    });
  return {forOperation,attentionIncomplete};
}
