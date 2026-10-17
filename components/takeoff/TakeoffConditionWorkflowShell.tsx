'use client';

import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';
import styles from './TakeoffConditionWorkflowShell.module.css';

type Props={setId:string;workspaceProps:any;conditionData:any};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  return <div className={styles.shell}>
    <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData} mobileReview={false}/>
  </div>;
}
