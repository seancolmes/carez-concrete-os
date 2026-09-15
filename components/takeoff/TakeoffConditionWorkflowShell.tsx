'use client';

import {useEffect,useState,type MouseEvent} from 'react';
import {PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ConditionDeletionManager} from './ConditionDeletionManager';
import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';
import styles from './TakeoffConditionWorkflowShell.module.css';
import themeStyles from './TakeoffShadcnTheme.module.css';

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

  const syncActiveSheet=(event:MouseEvent<HTMLDivElement>)=>{
    const target=event.target instanceof Element?event.target:null;
    const button=target?.closest('button');
    const sheetNavigator=button?.closest('aside');
    if(!button||!sheetNavigator?.querySelector('button[title="Hide sheets"]'))return;
    const pageNumber=Number(button.querySelector('span')?.textContent?.trim());
    if(!Number.isInteger(pageNumber))return;
    const sheet=(workspaceProps.initialSheets||[]).find((entry:any)=>Number(entry.page_number)===pageNumber);
    if(!sheet?.id)return;
    window.dispatchEvent(new CustomEvent('carez:takeoff-sheet-change',{detail:{sheetId:String(sheet.id)}}));
  };

  return <div className={`${styles.shell} ${themeStyles.theme}`} data-navigator-collapsed={navigatorCollapsed?'true':'false'} data-properties-collapsed={propertiesCollapsed?'true':'false'} onClickCapture={syncActiveSheet}>
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
