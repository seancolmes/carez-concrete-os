'use client';

import {useEffect,useState} from 'react';
import {PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen} from 'lucide-react';
import {IntegratedTakeoffConditionWorkspace} from './IntegratedTakeoffConditionWorkspace';
import styles from './TakeoffConditionWorkflowShell.module.css';

const NAV_COLLAPSED_KEY='carez.takeoff.navigator.collapsed.v1';
const PROPERTIES_COLLAPSED_KEY='carez.takeoff.properties.collapsed.v1';

type Props={
  setId:string;
  workspaceProps:any;
  conditionData:any;
};

export function TakeoffConditionWorkflowShell({setId,workspaceProps,conditionData}:Props){
  const [navigatorCollapsed,setNavigatorCollapsed]=useState(false);
  const [propertiesCollapsed,setPropertiesCollapsed]=useState(false);

  useEffect(()=>{
    try{
      setNavigatorCollapsed(window.localStorage.getItem(NAV_COLLAPSED_KEY)==='1');
      setPropertiesCollapsed(window.localStorage.getItem(PROPERTIES_COLLAPSED_KEY)==='1');
    }catch{}
  },[]);
  useEffect(()=>{try{window.localStorage.setItem(NAV_COLLAPSED_KEY,navigatorCollapsed?'1':'0');}catch{}},[navigatorCollapsed]);
  useEffect(()=>{try{window.localStorage.setItem(PROPERTIES_COLLAPSED_KEY,propertiesCollapsed?'1':'0');}catch{}},[propertiesCollapsed]);
  useEffect(()=>{
    const openNavigator=()=>setNavigatorCollapsed(false);
    window.addEventListener('carez:open-conditions',openNavigator);
    return()=>window.removeEventListener('carez:open-conditions',openNavigator);
  },[]);

  return <div className={styles.shell} data-navigator-collapsed={navigatorCollapsed?'true':'false'} data-properties-collapsed={propertiesCollapsed?'true':'false'}>
    <IntegratedTakeoffConditionWorkspace setId={setId} workspaceProps={workspaceProps} conditionData={conditionData}/>
    <button
      type="button"
      className={`${styles.paneToggle} ${navigatorCollapsed?styles.navigatorExpand:styles.navigatorCollapse}`}
      aria-label={navigatorCollapsed?'Expand Takeoff navigator':'Collapse Takeoff navigator'}
      title={navigatorCollapsed?'Expand navigator':'Collapse navigator'}
      onClick={()=>setNavigatorCollapsed(value=>!value)}
    >
      {navigatorCollapsed?<PanelLeftOpen aria-hidden="true"/>:<PanelLeftClose aria-hidden="true"/>}
    </button>
    <button
      type="button"
      className={`${styles.paneToggle} ${propertiesCollapsed?styles.propertiesExpand:styles.propertiesCollapse}`}
      aria-label={propertiesCollapsed?'Expand Condition Properties':'Collapse Condition Properties'}
      title={propertiesCollapsed?'Expand properties':'Collapse properties'}
      onClick={()=>setPropertiesCollapsed(value=>!value)}
    >
      {propertiesCollapsed?<PanelRightOpen aria-hidden="true"/>:<PanelRightClose aria-hidden="true"/>}
    </button>
  </div>;
}
