'use client';

import {create} from 'zustand';

export type TakeoffPhase='assembly'|'tracing'|'recap';
export type TakeoffViewMode='2d'|'3d'|'split';
export type TakeoffDrawingTool='select'|'pan'|'calibrate'|'scaleRegion'|'draw'|'cutout'|'edit';
type NextValue<T>=T|((current:T)=>T);

type TakeoffWorkspaceUi={
  scopeId:string|null;
  phase:TakeoffPhase;
  viewMode:TakeoffViewMode;
  tool:TakeoffDrawingTool;
  zoom:number;
  snapEnabled:boolean;
  orthoEnabled:boolean;
  inspectorOpen:boolean;
  conditionQuery:string;
  collapsedFamilies:string[];
  selectedConditionVersionId:string|null;
  selectedMeasurementId:string|null;
  setScope:(scopeId:string)=>void;
  setPhase:(phase:TakeoffPhase)=>void;
  setViewMode:(viewMode:TakeoffViewMode)=>void;
  setTool:(tool:TakeoffDrawingTool)=>void;
  setZoom:(zoom:number)=>void;
  setSnapEnabled:(enabled:NextValue<boolean>)=>void;
  setOrthoEnabled:(enabled:NextValue<boolean>)=>void;
  setInspectorOpen:(open:NextValue<boolean>)=>void;
  setConditionQuery:(query:string)=>void;
  toggleFamily:(family:string)=>void;
  setSelectedConditionVersionId:(id:string|null)=>void;
  setSelectedMeasurementId:(id:NextValue<string|null>)=>void;
};

// Transient navigation only. Measurements, Condition drafts, and calculated facts
// stay with their existing authoring and server persistence paths.
export const useTakeoffWorkspaceUi=create<TakeoffWorkspaceUi>(set=>({
  scopeId:null,
  phase:'assembly',
  viewMode:'2d',
  tool:'select',
  zoom:1,
  snapEnabled:true,
  orthoEnabled:false,
  inspectorOpen:false,
  conditionQuery:'',
  collapsedFamilies:[],
  selectedConditionVersionId:null,
  selectedMeasurementId:null,
  setScope:scopeId=>set(current=>current.scopeId===scopeId?current:{scopeId,phase:'assembly',viewMode:'2d',tool:'select',zoom:1,snapEnabled:true,orthoEnabled:false,inspectorOpen:false,conditionQuery:'',collapsedFamilies:[],selectedConditionVersionId:null,selectedMeasurementId:null}),
  setPhase:phase=>set({phase}),
  setViewMode:viewMode=>set({viewMode}),
  setTool:tool=>set({tool}),
  setZoom:zoom=>set({zoom}),
  setSnapEnabled:enabled=>set(current=>({snapEnabled:typeof enabled==='function'?enabled(current.snapEnabled):enabled})),
  setOrthoEnabled:enabled=>set(current=>({orthoEnabled:typeof enabled==='function'?enabled(current.orthoEnabled):enabled})),
  setInspectorOpen:open=>set(current=>({inspectorOpen:typeof open==='function'?open(current.inspectorOpen):open})),
  setConditionQuery:conditionQuery=>set({conditionQuery}),
  toggleFamily:family=>set(current=>({collapsedFamilies:current.collapsedFamilies.includes(family)?current.collapsedFamilies.filter(key=>key!==family):[...current.collapsedFamilies,family]})),
  setSelectedConditionVersionId:selectedConditionVersionId=>set({selectedConditionVersionId}),
  setSelectedMeasurementId:id=>set(current=>({selectedMeasurementId:typeof id==='function'?id(current.selectedMeasurementId):id})),
}));
