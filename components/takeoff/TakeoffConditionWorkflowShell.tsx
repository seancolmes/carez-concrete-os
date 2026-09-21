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
  const [mobileReview,setMobileReview]=useState(false);

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 860px)');
    const sync=()=>{
      const mobile=query.matches;
      setMobileReview(mobile);
      if(mobile){
        setNavigatorCollapsed(true);
        setPropertiesCollapsed(true);
      }
    };
    sync();
    query.addEventListener('change',sync);
    return()=>query.removeEventListener('change',sync);
  },[]);

  useEffect(()=>{
    const openConditions=()=>{
      setNavigatorCollapsed(false);
      setPropertiesCollapsed(mobileReview);
    };
    const showProperties=()=>{
      if(mobileReview){
        setPropertiesCollapsed(true);
        return;
      }
      setPropertiesCollapsed(false);
    };
    const startDrawing=()=>{
      if(mobileReview){
        setNavigatorCollapsed(true);
        setPropertiesCollapsed(true);
      }
    };
    const sheetSelected=()=>{if(mobileReview)setNavigatorCollapsed(true);};
    window.addEventListener('carez:start-condition-takeoff',startDrawing);
    window.addEventListener('carez:show-condition-properties',showProperties);
    window.addEventListener('carez:open-conditions',openConditions);
    window.addEventListener('carez:mobile-sheet-selected',sheetSelected);
    return()=>{
      window.removeEventListener('carez:mobile-sheet-selected',sheetSelected);
      window.removeEventListener('carez:open-conditions',openConditions);
      window.removeEventListener('carez:show-condition-properties',showProperties);
      window.removeEventListener('carez:start-condition-takeoff',startDrawing);
    };
  },[mobileReview]);

  return <div className={`${styles.shell}`} data-mobile-review={mobileReview?'true':'false'} data-navigator-collapsed={navigatorCollapsed?'true':'false'} data-properties-collapsed={propertiesCollapsed?'true':'false'}>
    <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData} mobileReview={mobileReview}/>
    {!mobileReview&&<ConditionDeletionManager setId={setId} locked={Boolean(workspaceProps.locked)} conditions={conditionData?.conditions||[]}/>} 
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
    {!mobileReview&&<Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={`${styles.paneToggle} ${propertiesCollapsed?styles.propertiesExpand:styles.propertiesCollapse}`}
      aria-label={propertiesCollapsed?'Expand Condition Properties':'Collapse Condition Properties'}
      aria-expanded={!propertiesCollapsed}
      aria-controls="takeoff-condition-properties"
      title={propertiesCollapsed?'Expand properties':'Collapse properties'}
      onClick={()=>setPropertiesCollapsed(value=>!value)}
    >
      {propertiesCollapsed?<PanelRightOpen aria-hidden="true"/>:<PanelRightClose aria-hidden="true"/>}
    </Button>}
  </div>;
}
