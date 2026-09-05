'use client';

import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';

type Props={
  setId:string;
  workspaceProps:any;
  conditionData:any;
};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  return <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData}/>;
}
