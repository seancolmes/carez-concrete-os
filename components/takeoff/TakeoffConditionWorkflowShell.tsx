'use client';

import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';

// TakeoffDrawingWorkspace remains the authoritative drawing engine and is mounted
// inside IntegratedTakeoffConditionWorkspace; this shell only owns composition.
type Props={
  setId:string;
  workspaceProps:any;
  conditionData:any;
};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  return <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData}/>;
}
