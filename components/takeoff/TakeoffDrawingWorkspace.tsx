'use client';

import {useEffect,useState} from 'react';
import {TakeoffDrawingCanvas,type ConditionRoleMeasurementRequest,type TakeoffDrawingDataProps} from './TakeoffDrawingCanvas';
import styles from './TakeoffDrawingWorkspace.module.css';

type Props=TakeoffDrawingDataProps&{
  conditionAuthoringActive?:boolean;
  conditionMeasurementIds?:string[];
  conditionSelectedMeasurementId?:string|null;
  onConditionMeasurementSelect?:(measurementId:string|null)=>void;
  conditionPresentation?:{hiddenMeasurementIds:string[];colors:Record<string,string>};
};

export function TakeoffDrawingWorkspace(props:Props){
  const [activeSheetId,setActiveSheetId]=useState<string|null>(props.initialSheets[0]?.id||null);
  const [localSelectedMeasurementId,setLocalSelectedMeasurementId]=useState<string|null>(null);
  const [roleMeasurementRequest,setRoleMeasurementRequest]=useState<ConditionRoleMeasurementRequest|null>(null);
  const selectedMeasurementId=props.onConditionMeasurementSelect
    ?props.conditionSelectedMeasurementId??null
    :localSelectedMeasurementId;

  useEffect(()=>{
    if(!props.conditionAuthoringActive)return;
    const startConditionTakeoff=(event:Event)=>{
      if(props.locked)return;
      const detail=(event as CustomEvent<{assemblyVersionId?:string;name?:string;roleLabel?:string}>).detail||{};
      const assemblyVersionId=String(detail.assemblyVersionId||'');
      if(!assemblyVersionId)return;
      setRoleMeasurementRequest({
        requestId:globalThis.crypto?.randomUUID?.()||'compat-'+Date.now(),
        conditionVersionId:'compatibility',
        roleKey:'compatibility',
        roleLabel:String(detail.roleLabel||'Condition takeoff'),
        assemblyVersionId,
        objectName:String(detail.name||'Concrete Condition'),
      });
    };
    window.addEventListener('carez:start-condition-takeoff',startConditionTakeoff as EventListener);
    return()=>window.removeEventListener('carez:start-condition-takeoff',startConditionTakeoff as EventListener);
  },[props.conditionAuthoringActive,props.locked]);

  const selectMeasurement=(measurementId:string|null)=>{
    if(props.onConditionMeasurementSelect)props.onConditionMeasurementSelect(measurementId);
    else setLocalSelectedMeasurementId(measurementId);
  };
  const selectSheet=(sheetId:string|null)=>{
    setActiveSheetId(sheetId);
    if(props.conditionAuthoringActive){
      window.dispatchEvent(new CustomEvent('carez:takeoff-sheet-change',{detail:{sheetId}}));
    }
  };

  return <div className={styles.legacyCanvasHost}>
    <TakeoffDrawingCanvas
      {...props}
      activeSheetId={activeSheetId}
      selectedMeasurementId={selectedMeasurementId}
      roleMeasurementRequest={roleMeasurementRequest}
      conditionPresentation={props.conditionPresentation||{hiddenMeasurementIds:[],colors:{}}}
      onActiveSheetChange={selectSheet}
      onSelectedMeasurementChange={selectMeasurement}
      onMeasurementCommitted={()=>{}}
      onRoleMeasurementRequestConsumed={requestId=>setRoleMeasurementRequest(current=>current?.requestId===requestId?null:current)}
      legacyChrome
      conditionAuthoringActive={Boolean(props.conditionAuthoringActive)}
      conditionMeasurementIds={props.conditionMeasurementIds}
      onOpenConditions={()=>window.dispatchEvent(new CustomEvent('carez:open-conditions'))}
    />
  </div>;
}
