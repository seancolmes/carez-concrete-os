'use client';

import {useEffect,useState} from 'react';
import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';
import styles from './TakeoffConditionWorkflowShell.module.css';

type Props={setId:string;workspaceProps:any;conditionData:any};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  const [mobileReview,setMobileReview]=useState(false);

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 860px)');
    const sync=()=>setMobileReview(query.matches);
    sync();
    query.addEventListener('change',sync);
    return()=>query.removeEventListener('change',sync);
  },[]);

  return <div className={styles.shell}>
    <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData} mobileReview={mobileReview}/>
  </div>;
}
