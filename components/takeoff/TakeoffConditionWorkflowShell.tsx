'use client';

import {useEffect,useState} from 'react';
import {PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ConditionDeletionManager} from './ConditionDeletionManager';
import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';
import styles from './TakeoffConditionWorkflowShell.module.css';

type Props={
  setId:string;
  workspaceProps:any;
  conditionData:any;
};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  const [navigatorCollapsed,setNavigatorCollapsed]=useState(false);
  const [propertiesCollapsed,setPropertiesCollapsed]=useState(true);

  useEffect(()=>{
    if(window.matchMedia('(max-width: 860px)').matches)setNavigatorCollapsed(true);
  },[]);

  useEffect(()=>{
    const openConditions=()=>{
      setNavigatorCollapsed(false);
      setPropertiesCollapsed(window.matchMedia('(max-width: 860px)').matches);
    };
    const showProperties=()=>{
      setPropertiesCollapsed(false);
      if(window.matchMedia('(max-width: 860px)').matches)setNavigatorCollapsed(true);
    };
    const startDrawing=()=>{
      if(window.matchMedia('(max-width: 860px)').matches){
        setNavigatorCollapsed(true);
        setPropertiesCollapsed(true);
      }
    };
    window.addEventListener('carez:start-condition-takeoff',startDrawing);
    window.addEventListener('carez:show-condition-properties',showProperties);
    window.addEventListener('carez:open-conditions',openConditions);
    return()=>{window.removeEventListener('carez:open-conditions',openConditions);window.removeEventListener('carez:show-condition-properties',showProperties);window.removeEventListener('carez:start-condition-takeoff',startDrawing);};
  },[]);

  return <div className={`${styles.shell}`} data-navigator-collapsed={navigatorCollapsed?'true':'false'} data-properties-collapsed={propertiesCollapsed?'true':'false'}>
    <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData}/>
    <ConditionDeletionManager setId={setId} locked={Boolean(workspaceProps.locked)} conditions={conditionData?.conditions||[]}/>
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={`${styles.paneToggle} ${navigatorCollapsed?styles.navigatorExpand:styles.navigatorCollapse}`}
      aria-label={navigatorCollapsed?'Expand Takeoff navigator':'Collapse Takeoff navigator'}
      aria-expanded={!navigatorCollapsed}
      title={navigatorCollapsed?'Expand navigator':'Collapse navigator'}
      onClick={()=>setNavigatorCollapsed(value=>!value)}
    >
      {navigatorCollapsed?<PanelLeftOpen aria-hidden="true"/>:<PanelLeftClose aria-hidden="true"/>}
    </Button>
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={`${styles.paneToggle} ${propertiesCollapsed?styles.propertiesExpand:styles.propertiesCollapse}`}
      aria-label={propertiesCollapsed?'Expand Condition Properties':'Collapse Condition Properties'}
      aria-expanded={!propertiesCollapsed}
      title={propertiesCollapsed?'Expand properties':'Collapse properties'}
      onClick={()=>setPropertiesCollapsed(value=>!value)}
    >
      {propertiesCollapsed?<PanelRightOpen aria-hidden="true"/>:<PanelRightClose aria-hidden="true"/>}
    </Button>
  </div>;
}
