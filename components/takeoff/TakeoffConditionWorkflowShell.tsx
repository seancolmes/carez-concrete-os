'use client';

import {useEffect,useState} from 'react';
import {PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen} from 'lucide-react';
import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';
import styles from './TakeoffConditionWorkflowShell.module.css';

type Props={
  setId:string;
  workspaceProps:any;
  conditionData:any;
};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  const [navigatorCollapsed,setNavigatorCollapsed]=useState(false);
  const [propertiesCollapsed,setPropertiesCollapsed]=useState(false);

  useEffect(()=>{
    const openConditions=()=>{
      setNavigatorCollapsed(false);
      setPropertiesCollapsed(false);
    };
    window.addEventListener('carez:open-conditions',openConditions);
    return()=>window.removeEventListener('carez:open-conditions',openConditions);
  },[]);

  return <div className={styles.shell} data-navigator-collapsed={navigatorCollapsed?'true':'false'} data-properties-collapsed={propertiesCollapsed?'true':'false'}>
    <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData}/>
    <button
      type="button"
      className={`${styles.paneToggle} ${navigatorCollapsed?styles.navigatorExpand:styles.navigatorCollapse}`}
      aria-label={navigatorCollapsed?'Expand Takeoff navigator':'Collapse Takeoff navigator'}
      aria-expanded={!navigatorCollapsed}
      title={navigatorCollapsed?'Expand navigator':'Collapse navigator'}
      onClick={()=>setNavigatorCollapsed(value=>!value)}
    >
      {navigatorCollapsed?<PanelLeftOpen aria-hidden="true"/>:<PanelLeftClose aria-hidden="true"/>}
    </button>
    <button
      type="button"
      className={`${styles.paneToggle} ${propertiesCollapsed?styles.propertiesExpand:styles.propertiesCollapse}`}
      aria-label={propertiesCollapsed?'Expand Condition Properties':'Collapse Condition Properties'}
      aria-expanded={!propertiesCollapsed}
      title={propertiesCollapsed?'Expand properties':'Collapse properties'}
      onClick={()=>setPropertiesCollapsed(value=>!value)}
    >
      {propertiesCollapsed?<PanelRightOpen aria-hidden="true"/>:<PanelRightClose aria-hidden="true"/>}
    </button>
  </div>;
}
