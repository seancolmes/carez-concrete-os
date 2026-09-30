'use client';

import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {Layout,Model} from 'flexlayout-react';
import Draggable from 'react-draggable';
import {ResizableBox} from 'react-resizable';
import {Accordion,AccordionHeader,AccordionItem,AccordionPanel,Button,Select} from '@fluentui/react-components';
import {CheckmarkRegular as Check,ChevronLeftRegular as ChevronLeft,ChevronRightRegular as ChevronRight,TargetRegular as Crosshair,HandRightRegular as Hand,PointScanRegular as Magnet,FullScreenMaximizeRegular as Maximize,SubtractRegular as Minus,CursorRegular as MousePointer2,ArrowMoveRegular as MoveHorizontal,PenRegular as PenLine,EditRegular as Pencil,AddRegular as Plus,ArrowRedoRegular as Redo2,ArrowCounterclockwiseRegular as RotateCcw,RulerRegular as Ruler,CutRegular as Scissors,DeleteRegular as Trash2,ArrowUndoRegular as Undo2,DismissRegular as X} from '@fluentui/react-icons';
import {
  createDrawingMeasurement,deleteDrawingMeasurement,deleteTakeoffScaleRegion,initializeTakeoffSheets,
  saveTakeoffScaleRegion,updateDrawingMeasurementGeometry
} from '@/app/takeoff/[setId]/actions';
import {GeometryCommandHistory,type CommandHistorySnapshot,type GeometryCommandKind} from '@/lib/takeoff/commandHistory';
import {measureDrawingGeometry,roundMeasurement,type DrawingGeometry,type DrawingMeasurement,type NormalizedPoint} from '@/lib/takeoff/geometry';
import {linearFootprint,parseRenderConfig,resolveDisplayStyle} from '@/lib/takeoff/physicalGeometry';
import {formatArchitecturalLength,formatTakeoffMeasurement} from '@/lib/takeoff/lengthFormat';
import {sheetDisplayLabel} from '@/lib/takeoff/sheetMetadata';
import {boundsFromPoints,calibrationFromDetectedScale,calibrationFromManual,findScaleRegionForPoint,type ScaleCalibration,type ScaleCandidate,type TakeoffScaleRegion} from '@/lib/takeoff/scaleRegions';
import {TakeoffMeasurementHoverOverlay} from './TakeoffMeasurementHoverOverlay';
import {TakeoffQuantityDock} from './TakeoffQuantityDock';
import {TakeoffScaleOverlay} from './TakeoffScaleOverlay';
import {TakeoffScalePanel} from './TakeoffScalePanel';
import {TakeoffSheetMetadataEditor} from './TakeoffSheetMetadataEditor';
import {TakeoffVertexEditor} from './TakeoffVertexEditor';
import {TakeoffDock,TakeoffDockButton} from './TakeoffDock';
import {useTakeoffWorkspaceUi} from './useTakeoffWorkspaceUi';
import {usePdfScaleDetection} from './usePdfScaleDetection';
import styles from './TakeoffDrawingWorkspace.module.css';

type Props={
  sidebar?:ReactNode;
  verificationPane?:ReactNode;
  takeoffSet:any;
  estimate:any;
  pdfUrl:string;
  sourceTitle:string;
  initialSheets:any[];
  scaleRegions:any[];
  initialMeasurements:any[];
  measurementSummaries:any[];
  assemblies:any[];
  versions:any[];
  variables:any[];
  sections:any[];
  riskClasses:any[];
  methodProfiles:any[];
  locked:boolean;
  mobileReview?:boolean;
  drawingViewHidden?:boolean;
  conditionMeasurementIds?:string[];
  conditionSelectedMeasurementId?:string|null;
  onConditionMeasurementSelect?:(measurementId:string|null)=>void;
  conditionPresentation?:{hiddenMeasurementIds:string[];colors:Record<string,string>};
};
type RenderBox={width:number;height:number;pdfWidth:number;pdfHeight:number};
type ResolvedPoint={point:NormalizedPoint;snapped:boolean};
type ZoomAnchor={x:number;y:number;clientX:number;clientY:number};

const palette=['#426F93','#747E86','#8A610B','#B84558','#6F9FC6','#525C57','#E06B74','#A29678'];
const MIN_ZOOM=.2;
const MAX_ZOOM=20;
const MAX_RENDER_PIXELS=28_000_000;
const MAX_CANVAS_DIMENSION=16_000;
const SNAP_PX=12;
const qty=(n:any,digits=2)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:digits});

function hashColor(value:string){let hash=0;for(let i=0;i<value.length;i++)hash=((hash<<5)-hash+value.charCodeAt(i))|0;return palette[Math.abs(hash)%palette.length];}
function normalizedPoints(points:any):NormalizedPoint[]{if(!Array.isArray(points))return[];return points.filter((p:any)=>Number.isFinite(Number(p?.x))&&Number.isFinite(Number(p?.y))).map((p:any)=>({x:Number(p.x),y:Number(p.y)}));}
function drawingGeometry(raw:any):DrawingGeometry|null{
  if(!raw||!['polyline','polygon','count'].includes(raw.type))return null;
  const points=normalizedPoints(raw.points);if(!points.length)return null;
  const holes=raw.type==='polygon'&&Array.isArray(raw.holes)?raw.holes.map(normalizedPoints).filter((hole:NormalizedPoint[])=>hole.length>=3):undefined;
  return{type:raw.type,points,...(holes?.length?{holes}:{})} as DrawingGeometry;
}
function geometryPath(geometry:DrawingGeometry,width:number,height:number){const ring=(points:NormalizedPoint[])=>points.length?`M ${points.map(point=>`${point.x*width} ${point.y*height}`).join(' L ')} Z`:'';return[ring(geometry.points),...(geometry.holes||[]).map(ring)].filter(Boolean).join(' ');}
function copyGeometry(geometry:DrawingGeometry):DrawingGeometry{return{type:geometry.type,points:geometry.points.map(point=>({...point})),...(geometry.holes?.length?{holes:geometry.holes.map(hole=>hole.map(point=>({...point})))}:{})};}
function shiftGeometry(geometry:DrawingGeometry,dx:number,dy:number):DrawingGeometry{const all=[...geometry.points,...(geometry.holes||[]).flat()];const minX=Math.min(...all.map(point=>point.x)),maxX=Math.max(...all.map(point=>point.x)),minY=Math.min(...all.map(point=>point.y)),maxY=Math.max(...all.map(point=>point.y));const safeDx=Math.max(-minX,Math.min(1-maxX,dx)),safeDy=Math.max(-minY,Math.min(1-maxY,dy));const shift=(point:NormalizedPoint)=>({x:point.x+safeDx,y:point.y+safeDy});return{type:geometry.type,points:geometry.points.map(shift),...(geometry.holes?.length?{holes:geometry.holes.map(hole=>hole.map(shift))}:{})};}
function physicalFootprint(points:NormalizedPoint[],version:any,values:any,calibration:any,box:any,anchor:any='center',offset:any=0){const config=parseRenderConfig(version?.render_config);const scale=Number(calibration?.ft_per_pdf_unit||calibration?.known_distance_ft/calibration?.pdf_distance);const width=Number(values?.[config?.widthVariable||'']);if(!config||config.mode!=='linear_buffer'||!(scale>0&&width>0))return[];return linearFootprint(points,box.pdfWidth,box.pdfHeight,scale,config.widthUnit==='FT'?width*12:width,anchor,Number(offset||0));}
function isTypingTarget(target:EventTarget|null){const el=target as HTMLElement|null;return Boolean(el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName));}
function clampZoom(value:number){return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));}

export function TakeoffDrawingWorkspace(props:Props){
  const {takeoffSet,pdfUrl,initialSheets,scaleRegions,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,methodProfiles,locked}=props;
  const mobileReview=Boolean(props.mobileReview);
  const [dockModel]=useState(()=>Model.fromJson({
    global:{tabEnableClose:false,tabEnableRename:false,tabEnableFloat:false,tabEnablePopout:false,tabEnableRenderOnDemand:false,tabSetEnableDeleteWhenEmpty:false,tabSetMinWidth:180},
    borders:[],
    layout:{type:'row',children:[
      {type:'tabset',id:'takeoff-scope-tabset',weight:24,children:[{type:'tab',id:'scope-tree',name:'Scope tree',component:'scope-tree'}]},
      {type:'tabset',id:'takeoff-canvas-tabset',weight:76,minWidth:420,children:[{type:'tab',id:'takeoff-spreadsheet',name:'Takeoff workspace',component:'takeoff-spreadsheet'}]},
    ]},
  }));
  const conditionMeasurementIdSet=useMemo(()=>new Set(props.conditionMeasurementIds||[]),[props.conditionMeasurementIds]);
  const router=useRouter();
  const openConditions=useCallback(()=>{if(!mobileReview)window.dispatchEvent(new CustomEvent('carez:open-conditions'));},[mobileReview]);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const viewportRef=useRef<HTMLDivElement|null>(null);
  const [viewportElement,setViewportElement]=useState<HTMLDivElement|null>(null);
  const attachViewport=useCallback((node:HTMLDivElement|null)=>{
    viewportRef.current=node;
    setViewportElement(node);
  },[]);
  const paperRef=useRef<HTMLDivElement|null>(null);
  const pdfRef=useRef<any>(null);
  const renderTaskRef=useRef<any>(null);
  const panRef=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const initializingRef=useRef(false);
  const zoomAnchorRef=useRef<ZoomAnchor|null>(null);
  const historyRef=useRef(new GeometryCommandHistory());
  const editOriginalRef=useRef<DrawingGeometry|null>(null);
  const utilityRef=useRef<HTMLDivElement|null>(null);

  const [pdfReady,setPdfReady]=useState(false);
  const [pdfPageCount,setPdfPageCount]=useState(Number(takeoffSet.page_count||initialSheets.length||0));
  const [pageNumber,setPageNumber]=useState(initialSheets[0]?.page_number||1);
  const zoom=useTakeoffWorkspaceUi(state=>state.zoom);
  const setZoom=useTakeoffWorkspaceUi(state=>state.setZoom);
  const [fitWidth,setFitWidth]=useState(900);
  const [renderBox,setRenderBox]=useState<RenderBox|null>(null);
  const [renderQuality,setRenderQuality]=useState(1);
  const tool=useTakeoffWorkspaceUi(state=>state.tool);
  const setTool=useTakeoffWorkspaceUi(state=>state.setTool);
  const [draftPoints,setDraftPoints]=useState<NormalizedPoint[]>([]);
  const [hoverPoint,setHoverPoint]=useState<NormalizedPoint|null>(null);
  const [hoverSnapped,setHoverSnapped]=useState(false);
  const [calibrationPoints,setCalibrationPoints]=useState<NormalizedPoint[]>([]);
  const [knownDistanceFt,setKnownDistanceFt]=useState('10');
  const [draftScaleRegionId,setDraftScaleRegionId]=useState<string|null>(null);
  const [scaleRegionPoints,setScaleRegionPoints]=useState<NormalizedPoint[]>([]);
  const [pendingScaleCandidate,setPendingScaleCandidate]=useState<ScaleCandidate|null>(null);
  const [pendingManualCalibration,setPendingManualCalibration]=useState<ScaleCalibration|null>(null);
  const [localSelectedMeasurementId,setLocalSelectedMeasurementId]=useState<string|null>(null);
  const selectedMeasurementId=props.onConditionMeasurementSelect?props.conditionSelectedMeasurementId??null:localSelectedMeasurementId;
  const setSelectedMeasurementId=useCallback((id:string|null)=>{if(props.onConditionMeasurementSelect)props.onConditionMeasurementSelect(id);else setLocalSelectedMeasurementId(id);},[props.onConditionMeasurementSelect]);
  const [editGeometry,setEditGeometry]=useState<DrawingGeometry|null>(null);
  const [historySnapshot,setHistorySnapshot]=useState<CommandHistorySnapshot>(()=>historyRef.current.snapshot());
  const conditionDrawRef=useRef<{name:string;roleLabel:string}|null>(null);
  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>('');
  const [conditionDrawActive,setConditionDrawActive]=useState(false);
  const [objectName,setObjectName]=useState('');
  const [riskClassCode,setRiskClassCode]=useState('');
  const [selectedMethodProfileId,setSelectedMethodProfileId]=useState<string|null>(null);
  const [variableValues,setVariableValues]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Loading PDF plans…');
  const [pdfLoadError,setPdfLoadError]=useState(false);
  const [pdfLoadAttempt,setPdfLoadAttempt]=useState(0);
  const [panning,setPanning]=useState(false);
  const [spaceHeld,setSpaceHeld]=useState(false);
  const snapEnabled=useTakeoffWorkspaceUi(state=>state.snapEnabled);
  const setSnapEnabled=useTakeoffWorkspaceUi(state=>state.setSnapEnabled);
  const orthoEnabled=useTakeoffWorkspaceUi(state=>state.orthoEnabled);
  const setOrthoEnabled=useTakeoffWorkspaceUi(state=>state.setOrthoEnabled);
  const inspectorOpen=useTakeoffWorkspaceUi(state=>state.inspectorOpen);
  const setInspectorOpen=useTakeoffWorkspaceUi(state=>state.setInspectorOpen);
  const [utilityPosition,setUtilityPosition]=useState({x:0,y:0});
  const [utilitySize,setUtilitySize]=useState({width:340,height:420});
  const [showEmptyToast,setShowEmptyToast]=useState(false);
  const reducedMotion=useReducedMotion();
  useEffect(()=>{
    if(mobileReview){
      setInspectorOpen(false);
      setTool('pan');
      setDraftPoints([]);
      setCalibrationPoints([]);
      setScaleRegionPoints([]);
      setEditGeometry(null);
      setConditionDrawActive(false);
      return;
    }
  },[mobileReview]);

  const latestVersionByAssembly=useMemo(()=>{const map=new Map<string,any>();for(const version of versions)if(!map.has(version.assembly_id))map.set(version.assembly_id,version);return map;},[versions]);
  const assemblyMap=useMemo(()=>new Map<string,any>(assemblies.map((a:any)=>[a.id,a])),[assemblies]);
  const versionMap=useMemo(()=>new Map<string,any>(versions.map((v:any)=>[v.id,v])),[versions]);
  const selectedAssembly:any=assemblyMap.get(selectedAssemblyId);
  const selectedVersion:any=selectedAssembly?latestVersionByAssembly.get(selectedAssembly.id):null;
  const selectedVariables=useMemo(()=>selectedVersion?variables.filter((v:any)=>v.assembly_version_id===selectedVersion.id):[],[selectedVersion,variables]);
  const currentSheet=useMemo(()=>initialSheets.find((s:any)=>Number(s.page_number)===pageNumber)||null,[initialSheets,pageNumber]);
  const currentMeasurements=useMemo(()=>initialMeasurements.filter((m:any)=>m.sheet_id===currentSheet?.id),[initialMeasurements,currentSheet]);
  useEffect(()=>{
    if(!pdfReady||!currentSheet||currentMeasurements.length>0){setShowEmptyToast(false);return;}
    setShowEmptyToast(true);
    const timeout=window.setTimeout(()=>setShowEmptyToast(false),4000);
    return()=>window.clearTimeout(timeout);
  },[pdfReady,currentSheet?.id,currentMeasurements.length]);
  const currentScaleRegions=useMemo(()=>scaleRegions.filter((region:any)=>region.sheet_id===currentSheet?.id) as TakeoffScaleRegion[],[scaleRegions,currentSheet?.id]);
  const scaleRegionMap=useMemo(()=>new Map((scaleRegions as TakeoffScaleRegion[]).map(region=>[region.id,region])),[scaleRegions]);
  const currentScale=currentScaleRegions.length>0||currentSheet?.scale_status==='calibrated';
  const currentScaleLabel=currentScaleRegions.find(region=>region.is_default)?.scale_label||currentScaleRegions[0]?.scale_label||currentSheet?.calibration?.scale_label||'UNSET';
  const {candidates:scaleCandidates,status:scaleDetectionStatus}=usePdfScaleDetection(pdfRef,pdfReady,pageNumber);
  const visibleScaleCandidates=useMemo(()=>scaleCandidates.filter(candidate=>!currentScaleRegions.some(region=>region.is_default&&region.source_type==='pdf_text'&&region.scale_label===candidate.label)),[scaleCandidates,currentScaleRegions]);
  const selectedMeasurement=initialMeasurements.find((m:any)=>m.id===selectedMeasurementId)||null;
  useEffect(()=>{if(!props.onConditionMeasurementSelect||!selectedMeasurement)return;const sheet=initialSheets.find((s:any)=>s.id===selectedMeasurement.sheet_id);if(sheet&&Number(sheet.page_number)!==pageNumber)setPageNumber(Number(sheet.page_number));},[selectedMeasurementId,selectedMeasurement?.sheet_id]);
  const selectedGeometry=useMemo(()=>selectedMeasurement?drawingGeometry(selectedMeasurement.geometry):null,[selectedMeasurement]);
  const selectedScaleRegion=selectedMeasurement?scaleRegionMap.get(selectedMeasurement.scale_region_id):null;
  const selectedCalibration=selectedScaleRegion?.calibration||currentSheet?.calibration||null;
  const draftScaleRegion=draftScaleRegionId?scaleRegionMap.get(draftScaleRegionId):null;
  const draftCalibration=draftScaleRegion?.calibration||null;
  const selectedCutoutCount=selectedGeometry?.holes?.length||0;

  const summaryMap=useMemo(()=>{
    const map=new Map<string,{inputHolds:number}>();
    for(const row of measurementSummaries){
      const prior=map.get(row.measurement_id)||{inputHolds:0};
      if(row.pricing_status==='missing_input')prior.inputHolds+=1;
      map.set(row.measurement_id,prior);
    }
    return map;
  },[measurementSummaries]);
  const selectedSummary=selectedMeasurement?summaryMap.get(selectedMeasurement.id):null;

  useEffect(()=>{
    const startConditionTakeoff=(event:Event)=>{
      if(locked)return;
      const detail=(event as CustomEvent<{assemblyVersionId?:string;name?:string;roleLabel?:string}>).detail||{};
      const version:any=versionMap.get(String(detail.assemblyVersionId||''));
      if(!version){setMessage('The Concrete Condition takeoff recipe is unavailable. Refresh and try again.');return;}
      const request={
        name:String(detail.name||'Concrete Condition'),
        roleLabel:String(detail.roleLabel||'Condition takeoff'),
      };
      conditionDrawRef.current=request;
      setConditionDrawActive(true);
      setShowEmptyToast(false);
      if(version.assembly_id===selectedAssemblyId){
        setSelectedMeasurementId(null);
        setEditGeometry(null);
        editOriginalRef.current=null;
        setObjectName(request.name);
        setDraftPoints([]);
        setDraftScaleRegionId(null);
        setHoverPoint(null);
        setTool('draw');
        setInspectorOpen(false);
        setMessage(`Draw ${request.roleLabel} on the plan. Double-click to finish LF; click the first point to close SF.`);
        conditionDrawRef.current=null;
      }else{
        setSelectedAssemblyId(version.assembly_id);
      }
    };
    window.addEventListener('carez:start-condition-takeoff',startConditionTakeoff as EventListener);
    return()=>window.removeEventListener('carez:start-condition-takeoff',startConditionTakeoff as EventListener);
  },[locked,selectedAssemblyId,versionMap]);

  useEffect(()=>{
    if(selectedMeasurementId&&!selectedMeasurement){setSelectedMeasurementId(null);setEditGeometry(null);editOriginalRef.current=null;if(tool==='edit'||tool==='cutout')setTool('select');}
  },[selectedMeasurementId,selectedMeasurement,tool]);

  useEffect(()=>{
    if(!selectedVersion)return;
    const next:Record<string,string>={};
    for(const variable of selectedVariables){if(variable.variable_key==='perimeter_lf'&&selectedAssembly?.primary_measurement==='SF')continue;next[variable.variable_key]=variable.default_value===null||variable.default_value===undefined?'':String(variable.default_value);}
    const profile=methodProfiles.find((entry:any)=>entry.assembly_version_id===selectedVersion.id&&entry.status==='verified')||null;
    if(profile){for(const [key,value] of Object.entries(profile.method_inputs||{}))next[key]=value===null||value===undefined?'':String(value);}
    const pendingConditionDraw=conditionDrawRef.current;
    setVariableValues(next);
    setSelectedMethodProfileId(profile?.id||null);
    setRiskClassCode(selectedVersion.default_risk_class_code||'');
    setObjectName(pendingConditionDraw?.name||'');
    setDraftPoints([]);
    setDraftScaleRegionId(null);
    setHoverPoint(null);
    if(pendingConditionDraw){
      setSelectedMeasurementId(null);
      setEditGeometry(null);
      editOriginalRef.current=null;
      setTool('draw');
      setInspectorOpen(false);
      setMessage(`Draw ${pendingConditionDraw.roleLabel} on the plan. Double-click to finish LF; click the first point to close SF.`);
      conditionDrawRef.current=null;
    }
  },[selectedVersion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    let cancelled=false;
    async function loadPdf(){
      try{
        setPdfLoadError(false);
        setPdfReady(false);
        setRenderBox(null);
        setMessage('Loading PDF plans…');
        const pdfjs=await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
        const pdf=await pdfjs.getDocument({url:pdfUrl}).promise;
        if(cancelled){await pdf.destroy();return;}
        pdfRef.current=pdf;setPdfPageCount(pdf.numPages);setPdfReady(true);setMessage(`${pdf.numPages} sheet${pdf.numPages===1?'':'s'} loaded`);
        const sheetComplete=initialSheets.length===pdf.numPages&&initialSheets.every((s:any)=>Number(s.page_width||0)>0&&Number(s.page_height||0)>0);
        if(!sheetComplete&&!locked&&!initializingRef.current){
          initializingRef.current=true;
          const pages:{pageNumber:number;width:number;height:number}[]=[];
          for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const viewport=page.getViewport({scale:1});pages.push({pageNumber:i,width:viewport.width,height:viewport.height});page.cleanup();}
          await initializeTakeoffSheets(takeoffSet.id,pages);setMessage('Drawing sheets prepared');router.refresh();
        }
      }catch{
        if(cancelled)return;
        const loadFailed=!pdfRef.current;
        setPdfLoadError(loadFailed);
        setMessage(loadFailed?'Could not load the plan PDF. Check your connection and retry.':'Could not prepare the plan pages. Reopen the takeoff to retry.');
      }
    }
    void loadPdf();
    return()=>{cancelled=true;renderTaskRef.current?.cancel?.();const pdf=pdfRef.current;pdfRef.current=null;if(pdf)void pdf.destroy?.();};
  },[pdfUrl,pdfLoadAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    const el=viewportElement;if(!el)return;
    const update=()=>setFitWidth(Math.max(320,el.clientWidth-34));update();
    const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
  },[inspectorOpen,viewportElement]);

  useEffect(()=>{
    if(!pdfReady||!pdfRef.current||!canvasRef.current)return;
    let cancelled=false;
    async function render(){
      try{
        renderTaskRef.current?.cancel?.();
        const page=await pdfRef.current.getPage(pageNumber);
        const base=page.getViewport({scale:1});
        const fitScale=Math.max(.05,fitWidth/base.width);
        const displayScale=fitScale*zoom;
        const displayViewport=page.getViewport({scale:displayScale});
        const desiredDpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
        const maxPixelScale=Math.sqrt(MAX_RENDER_PIXELS/(base.width*base.height));
        const maxDimensionScale=Math.min(MAX_CANVAS_DIMENSION/base.width,MAX_CANVAS_DIMENSION/base.height);
        const renderScale=Math.min(displayScale*desiredDpr,maxPixelScale,maxDimensionScale);
        const renderViewport=page.getViewport({scale:Math.max(.05,renderScale)});
        if(cancelled)return;
        const canvas=canvasRef.current!;
        canvas.style.width=`${displayViewport.width}px`;canvas.style.height=`${displayViewport.height}px`;
        setRenderBox({width:displayViewport.width,height:displayViewport.height,pdfWidth:base.width,pdfHeight:base.height});
        setRenderQuality(renderScale/displayScale);
        // Render the replacement frame offscreen so wheel zoom never clears the visible PDF bitmap.
        // The current bitmap scales with CSS and remains aligned with the SVG overlay until the sharper frame is ready.
        const staging=document.createElement('canvas');
        staging.width=Math.max(1,Math.floor(renderViewport.width));staging.height=Math.max(1,Math.floor(renderViewport.height));
        const stagingContext=staging.getContext('2d',{alpha:false});if(!stagingContext)throw new Error('Canvas is unavailable.');
        const task=page.render({canvasContext:stagingContext,viewport:renderViewport});renderTaskRef.current=task;await task.promise;
        if(cancelled)return;
        const visible=canvasRef.current;if(!visible)return;
        visible.width=staging.width;visible.height=staging.height;
        const context=visible.getContext('2d',{alpha:false});if(!context)throw new Error('Canvas is unavailable.');
        context.drawImage(staging,0,0);page.cleanup();
      }catch(error:any){if(error?.name!=='RenderingCancelledException')setMessage(error?.message||'Could not render this PDF page.');}
    }
    void render();return()=>{cancelled=true;renderTaskRef.current?.cancel?.();};
  },[pdfReady,pageNumber,zoom,fitWidth,viewportElement]);

  useEffect(()=>{
    const anchor=zoomAnchorRef.current;const viewport=viewportRef.current;const paper=paperRef.current;
    if(!anchor||!viewport||!paper||!renderBox)return;
    const id=requestAnimationFrame(()=>{
      const rect=paper.getBoundingClientRect();
      const targetX=rect.left+rect.width*anchor.x;const targetY=rect.top+rect.height*anchor.y;
      viewport.scrollLeft+=targetX-anchor.clientX;viewport.scrollTop+=targetY-anchor.clientY;zoomAnchorRef.current=null;
    });
    return()=>cancelAnimationFrame(id);
  },[renderBox?.width,renderBox?.height]);

  const setZoomAt=useCallback((next:number,clientX?:number,clientY?:number)=>{
    const viewport=viewportRef.current;const paper=paperRef.current;if(!viewport||!paper){setZoom(clampZoom(next));return;}
    const viewportRect=viewport.getBoundingClientRect();const paperRect=paper.getBoundingClientRect();
    const cx=clientX??(viewportRect.left+viewportRect.width/2);const cy=clientY??(viewportRect.top+viewportRect.height/2);
    zoomAnchorRef.current={x:paperRect.width?Math.max(0,Math.min(1,(cx-paperRect.left)/paperRect.width)):.5,y:paperRect.height?Math.max(0,Math.min(1,(cy-paperRect.top)/paperRect.height)):.5,clientX:cx,clientY:cy};
    setZoom(clampZoom(Number(next.toFixed(3))));
  },[]);

  useEffect(()=>{
    const viewport=viewportElement;if(!viewport)return;
    const handleWheel=(event:WheelEvent)=>{
      event.preventDefault();
      setZoomAt(zoom*(event.deltaY<0?1.16:1/1.16),event.clientX,event.clientY);
    };
    viewport.addEventListener('wheel',handleWheel,{passive:false});
    return()=>viewport.removeEventListener('wheel',handleWheel);
  },[zoom,setZoomAt,viewportElement]);

  const fitPage=useCallback(()=>{
    if(!renderBox||!viewportRef.current)return;
    const viewport=viewportRef.current;const baseWidth=renderBox.width/zoom;const baseHeight=renderBox.height/zoom;
    const next=Math.min((viewport.clientWidth-36)/baseWidth,(viewport.clientHeight-36)/baseHeight);
    setZoomAt(next);
  },[renderBox,zoom,setZoomAt]);

  const overlayPoint=useCallback((event:React.PointerEvent<SVGSVGElement>):NormalizedPoint|null=>{
    const rect=event.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    return{x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
  },[]);

  const resolvePoint=useCallback((raw:NormalizedPoint,last:NormalizedPoint|null):ResolvedPoint=>{
    if(!renderBox)return{point:raw,snapped:false};
    let point={...raw};let snapped=false;
    const candidates:NormalizedPoint[]=[];
    if(snapEnabled){for(const measurement of currentMeasurements){const geometry=drawingGeometry(measurement.geometry);if(geometry)candidates.push(...geometry.points,...(geometry.holes||[]).flat());}candidates.push(...draftPoints,...calibrationPoints);}
    const snap=(source:NormalizedPoint)=>{
      let nearest:NormalizedPoint|null=null;let nearestPx=SNAP_PX;
      for(const candidate of candidates){const px=Math.hypot((candidate.x-source.x)*renderBox.width,(candidate.y-source.y)*renderBox.height);if(px<nearestPx){nearest=candidate;nearestPx=px;}}
      return nearest;
    };
    if(snapEnabled){const candidate=snap(point);if(candidate){point={...candidate};snapped=true;}}
    if(orthoEnabled&&last){const dx=Math.abs((point.x-last.x)*renderBox.width);const dy=Math.abs((point.y-last.y)*renderBox.height);point=dx>=dy?{x:point.x,y:last.y}:{x:last.x,y:point.y};}
    if(snapEnabled){const candidate=snap(point);if(candidate){const aligned=!last||!orthoEnabled||Math.abs(candidate.x-last.x)*renderBox.width<2||Math.abs(candidate.y-last.y)*renderBox.height<2;if(aligned){point={...candidate};snapped=true;}}}
    return{point,snapped};
  },[renderBox,snapEnabled,orthoEnabled,currentMeasurements,draftPoints,calibrationPoints]);

  const preview=useMemo<DrawingMeasurement|null>(()=>{
    if(!renderBox||!currentSheet)return null;
    if(tool==='cutout'&&selectedGeometry?.type==='polygon'&&draftPoints.length>=3){
      try{const measured=measureDrawingGeometry({...selectedGeometry,holes:[...(selectedGeometry.holes||[]),draftPoints]},renderBox.pdfWidth,renderBox.pdfHeight,selectedCalibration);return{...measured,quantity:roundMeasurement(measured.quantity),perimeterLf:roundMeasurement(measured.perimeterLf)};}catch{return null;}
    }
    if(tool!=='draw'||!selectedAssembly||!draftPoints.length)return null;
    const type=selectedAssembly.primary_measurement==='SF'?'polygon':selectedAssembly.primary_measurement==='EA'?'count':'polyline';
    const required=type==='polygon'?3:type==='polyline'?2:1;if(draftPoints.length<required)return null;
    if(type!=='count'&&!draftCalibration)return null;
    try{const measured=measureDrawingGeometry({type,points:draftPoints} as DrawingGeometry,renderBox.pdfWidth,renderBox.pdfHeight,draftCalibration);return{...measured,quantity:roundMeasurement(measured.quantity),perimeterLf:roundMeasurement(measured.perimeterLf)};}catch{return type==='count'?{quantity:draftPoints.length,unit:'EA',perimeterLf:0}:null;}
  },[draftPoints,renderBox,selectedAssembly,currentSheet,tool,selectedGeometry,selectedCalibration,draftCalibration]);

  const finishDraft=useCallback(async()=>{
    if(locked||busy||!selectedAssembly||!selectedVersion||!currentSheet||!renderBox)return;
    if(!conditionDrawActive){setMessage('Start new scope from Concrete Conditions.');openConditions();return;}
    const geometryType:DrawingGeometry['type']=selectedAssembly.primary_measurement==='SF'?'polygon':selectedAssembly.primary_measurement==='EA'?'count':'polyline';
    const minimum=geometryType==='polygon'?3:geometryType==='polyline'?2:1;
    if(draftPoints.length<minimum){setMessage(`${selectedAssembly.primary_measurement} takeoff needs at least ${minimum} point${minimum===1?'':'s'}.`);return;}
    if(geometryType!=='count'&&!draftScaleRegionId){setMessage('Start the takeoff inside an accepted scale region.');return;}
    const sameAssemblyCount=currentMeasurements.filter((m:any)=>m.assembly_version_id===selectedVersion.id).length;
    const autoName=`${selectedAssembly.name} ${sameAssemblyCount+1}`;
    const finalName=objectName.trim()||autoName;
    setBusy(true);
    try{
      const result=await createDrawingMeasurement({takeoffSetId:takeoffSet.id,sheetId:currentSheet.id,estimateSectionId:null,assemblyVersionId:selectedVersion.id,methodProfileId:selectedMethodProfileId,scaleRegionId:draftScaleRegionId,name:finalName,location:null,drawingReference:null,riskClassCode:riskClassCode||null,variables:variableValues,geometry:{type:geometryType,points:draftPoints}});
      const holdText=result.inputHolds?` · ${result.inputHolds} input hold${result.inputHolds===1?'':'s'}`:'';
      setMessage(`Saved ${finalName} · ${formatTakeoffMeasurement(result.quantity,result.unit)}${result.perimeterLf?` · ${formatArchitecturalLength(result.perimeterLf)} perimeter`:''}${holdText}`);
      setDraftPoints([]);setDraftScaleRegionId(null);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);
      setConditionDrawActive(false);setSelectedAssemblyId('');setTool('select');
      router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not save drawing measurement.');}finally{setBusy(false);}
  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,draftScaleRegionId,currentMeasurements,objectName,takeoffSet.id,riskClassCode,variableValues,router,selectedMethodProfileId,conditionDrawActive,openConditions]);

  function beginEditMeasurement(measurement:any){
    if(locked)return;
    const geometry=drawingGeometry(measurement?.geometry);if(!geometry)return;
    const copy=copyGeometry(geometry);setSelectedMeasurementId(measurement.id);editOriginalRef.current=copyGeometry(geometry);setEditGeometry(copy);setDraftPoints([]);setInspectorOpen(true);setTool('edit');setMessage('Drag a vertex, then press Enter or Save Shape.');
  }
  function beginEdit(){if(!selectedMeasurement)return;beginEditMeasurement(selectedMeasurement);}
  function beginCutout(){if(locked||selectedGeometry?.type!=='polygon')return;setEditGeometry(null);editOriginalRef.current=null;setDraftPoints([]);setHoverPoint(null);setTool('cutout');setMessage('Trace the opening inside the selected area, then press Enter.');}

  async function commitGeometry(kind:GeometryCommandKind,measurementId:string,before:DrawingGeometry,after:DrawingGeometry,success:string){
    if(locked||busy)return false;setBusy(true);
    try{
      const result=await updateDrawingMeasurementGeometry({measurementId,takeoffSetId:takeoffSet.id,geometry:after});
      historyRef.current.record({id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,kind,measurementId,before:copyGeometry(before),after:copyGeometry(after),committedAt:new Date().toISOString()});
      setHistorySnapshot(historyRef.current.snapshot());setMessage(`${success} · ${formatTakeoffMeasurement(result.quantity,result.unit)}`);setEditGeometry(null);editOriginalRef.current=null;setDraftPoints([]);setHoverPoint(null);setTool('select');setSelectedMeasurementId(measurementId);router.refresh();return true;
    }catch(error:any){setMessage(error?.message||'Could not update drawing geometry.');return false;}finally{setBusy(false);}
  }

  async function saveEdit(){if(!selectedMeasurementId||!editGeometry||!editOriginalRef.current)return;await commitGeometry('MoveVertexCommand',selectedMeasurementId,editOriginalRef.current,editGeometry,'Shape updated');}
  async function finishCutout(){if(!selectedMeasurementId||selectedGeometry?.type!=='polygon'||draftPoints.length<3){setMessage('A cutout needs at least three points.');return;}const after:DrawingGeometry={...copyGeometry(selectedGeometry),holes:[...(selectedGeometry.holes||[]).map(hole=>hole.map(point=>({...point}))),draftPoints.map(point=>({...point}))]};await commitGeometry('CreateCutoutCommand',selectedMeasurementId,selectedGeometry,after,'Cutout saved');}
  async function removeLastCutout(){if(!selectedMeasurementId||selectedGeometry?.type!=='polygon'||!selectedGeometry.holes?.length)return;const after=copyGeometry(selectedGeometry);after.holes=after.holes?.slice(0,-1);await commitGeometry('RemoveCutoutCommand',selectedMeasurementId,selectedGeometry,after,'Last cutout removed');}
  async function nudgeSelected(dx:number,dy:number){if(!selectedMeasurementId||!selectedGeometry||locked||busy)return;const after=shiftGeometry(selectedGeometry,dx,dy);await commitGeometry('MoveMeasurementCommand',selectedMeasurementId,selectedGeometry,after,'Takeoff nudged');}

  async function undoCommitted(){const command=historyRef.current.undoCandidate();if(!command||locked||busy)return;setBusy(true);try{await updateDrawingMeasurementGeometry({measurementId:command.measurementId,takeoffSetId:takeoffSet.id,geometry:command.before});historyRef.current.confirmUndo(command.id);setHistorySnapshot(historyRef.current.snapshot());setSelectedMeasurementId(command.measurementId);setMessage(`Undid ${command.kind.replace('Command','').replace(/([A-Z])/g,' $1').trim().toLowerCase()}`);router.refresh();}catch(error:any){setMessage(error?.message||'Could not undo the committed change.');}finally{setBusy(false);}}
  async function redoCommitted(){const command=historyRef.current.redoCandidate();if(!command||locked||busy)return;setBusy(true);try{await updateDrawingMeasurementGeometry({measurementId:command.measurementId,takeoffSetId:takeoffSet.id,geometry:command.after});historyRef.current.confirmRedo(command.id);setHistorySnapshot(historyRef.current.snapshot());setSelectedMeasurementId(command.measurementId);setMessage(`Redid ${command.kind.replace('Command','').replace(/([A-Z])/g,' $1').trim().toLowerCase()}`);router.refresh();}catch(error:any){setMessage(error?.message||'Could not redo the committed change.');}finally{setBusy(false);}}

  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(props.drawingViewHidden||isTypingTarget(event.target))return;
      if(mobileReview){
        if(event.key==='+'||event.key==='='){event.preventDefault();setZoomAt(zoom*1.2);return;}
        if(event.key==='-'){event.preventDefault();setZoomAt(zoom/1.2);return;}
        if(event.key==='0'){event.preventDefault();setZoomAt(1);return;}
        if(event.key==='1'){event.preventDefault();fitPage();return;}
        if(event.key==='PageUp'){event.preventDefault();changePage(Math.max(1,pageNumber-1));return;}
        if(event.key==='PageDown'){event.preventDefault();changePage(Math.min(pdfPageCount||pageNumber,pageNumber+1));return;}
        return;
      }
      if(event.code==='Space'){event.preventDefault();setSpaceHeld(true);return;}
      if(event.key==='Escape'){cancelTool();return;}
      const commandKey=event.ctrlKey||event.metaKey;
      if(commandKey&&event.key.toLowerCase()==='z'){
        event.preventDefault();
        if(event.shiftKey){void redoCommitted();return;}
        if(draftPoints.length){setDraftPoints(points=>points.slice(0,-1));return;}
        if(calibrationPoints.length){setCalibrationPoints(points=>points.slice(0,-1));return;}
        if(scaleRegionPoints.length){setScaleRegionPoints(points=>points.slice(0,-1));return;}
        void undoCommitted();return;
      }
      if(event.key==='Backspace'&&(draftPoints.length||calibrationPoints.length||scaleRegionPoints.length)){event.preventDefault();if(draftPoints.length)setDraftPoints(points=>points.slice(0,-1));else if(calibrationPoints.length)setCalibrationPoints(points=>points.slice(0,-1));else setScaleRegionPoints(points=>points.slice(0,-1));return;}
      if((event.key==='Delete'||event.key==='Backspace')&&selectedMeasurementId&&!locked){event.preventDefault();void removeSelected();return;}
      if(event.key==='Enter'&&tool==='draw'){event.preventDefault();void finishDraft();return;}
      if(event.key==='Enter'&&tool==='scaleRegion'){event.preventDefault();void savePendingScaleRegion();return;}
      if(event.key==='Enter'&&tool==='cutout'){event.preventDefault();void finishCutout();return;}
      if(event.key==='Enter'&&tool==='edit'){event.preventDefault();void saveEdit();return;}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&selectedGeometry&&!locked){event.preventDefault();const step=(event.shiftKey?10:1);const dx=(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/Math.max(1,renderBox?.width||1000);const dy=(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/Math.max(1,renderBox?.height||1000);void nudgeSelected(dx,dy);return;}
      if(event.key==='+'||event.key==='='){event.preventDefault();setZoomAt(zoom*1.2);return;}
      if(event.key==='-'){event.preventDefault();setZoomAt(zoom/1.2);return;}
      if(event.key==='0'){event.preventDefault();setZoomAt(1);return;}
      if(event.key==='1'){event.preventDefault();fitPage();return;}
      if(event.key.toLowerCase()==='v')setTool('select');
      if(event.key.toLowerCase()==='h')setTool('pan');
      if(event.key.toLowerCase()==='c'&&!locked){setCalibrationPoints([]);setTool('calibrate');}
      if(event.key.toLowerCase()==='m'){openConditions();return;}
      if(event.key.toLowerCase()==='e'&&!locked&&selectedGeometry)beginEdit();
      if(event.key.toLowerCase()==='k'&&!locked&&selectedGeometry?.type==='polygon')beginCutout();
      if(event.key==='PageUp'){event.preventDefault();changePage(Math.max(1,pageNumber-1));}
      if(event.key==='PageDown'){event.preventDefault();changePage(Math.min(pdfPageCount||pageNumber,pageNumber+1));}
      if(event.key.toLowerCase()==='s'){event.preventDefault();setSnapEnabled(v=>!v);}
      if(event.key.toLowerCase()==='o'){event.preventDefault();setOrthoEnabled(v=>!v);}
    };
    const up=(event:KeyboardEvent)=>{if(event.code==='Space')setSpaceHeld(false);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
  },[draftPoints.length,calibrationPoints.length,scaleRegionPoints.length,tool,locked,finishDraft,selectedMeasurementId,selectedGeometry,renderBox,busy,zoom,setZoomAt,fitPage,pageNumber,pdfPageCount,openConditions,props.drawingViewHidden,mobileReview]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePointerDown(event:React.PointerEvent<SVGSVGElement>){
    if(locked&&tool!=='select')return;
    const raw=overlayPoint(event);if(!raw)return;
    const last=tool==='calibrate'?(calibrationPoints.at(-1)||null):tool==='scaleRegion'?(scaleRegionPoints.at(-1)||null):(draftPoints.at(-1)||null);const resolved=resolvePoint(raw,last);
    if(tool==='calibrate'){setCalibrationPoints(points=>points.length>=2?[resolved.point]:[...points,resolved.point]);return;}
    if(tool==='scaleRegion'){setScaleRegionPoints(points=>points.length>=2?[resolved.point]:[...points,resolved.point]);return;}
    if(tool==='draw'){if(!conditionDrawActive){setMessage('Start new scope from Concrete Conditions.');openConditions();return;}if(!selectedAssembly){setMessage('Concrete Condition geometry is not ready. Reopen Conditions and start the required takeoff.');return;}if(selectedAssembly.primary_measurement!=='EA'){const region=findScaleRegionForPoint(currentScaleRegions,resolved.point);if(!region){setMessage('Confirm or create a scale region covering this point.');return;}if(draftScaleRegionId&&draftScaleRegionId!==region.id){setMessage('One takeoff cannot cross between different scale regions.');return;}setDraftScaleRegionId(region.id);}setDraftPoints(points=>[...points,resolved.point]);return;}
    if(tool==='cutout'){if(selectedGeometry?.type!=='polygon'){setMessage('Select an area takeoff before adding a cutout.');setTool('select');return;}setDraftPoints(points=>[...points,resolved.point]);return;}
    if(tool==='select'){setSelectedMeasurementId(null);setEditGeometry(null);editOriginalRef.current=null;}
  }
  function handlePointerMove(event:React.PointerEvent<SVGSVGElement>){
    if(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout'){const raw=overlayPoint(event);if(!raw)return;const last=tool==='calibrate'?(calibrationPoints.at(-1)||null):tool==='scaleRegion'?(scaleRegionPoints.at(-1)||null):(draftPoints.at(-1)||null);const resolved=resolvePoint(raw,last);setHoverPoint(resolved.point);setHoverSnapped(resolved.snapped);}
  }
  function startViewportPan(event:React.PointerEvent<HTMLDivElement>){
    if(!mobileReview&&tool!=='pan'&&event.button!==1&&!spaceHeld)return;
    event.preventDefault();event.stopPropagation();
    const viewport=event.currentTarget;
    panRef.current={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    setPanning(true);viewport.setPointerCapture(event.pointerId);
  }
  function moveViewportPan(event:React.PointerEvent<HTMLDivElement>){
    const start=panRef.current;if(!start)return;
    event.preventDefault();event.stopPropagation();
    event.currentTarget.scrollLeft=start.left-(event.clientX-start.x);
    event.currentTarget.scrollTop=start.top-(event.clientY-start.y);
  }
  function stopViewportPan(event:React.PointerEvent<HTMLDivElement>){
    if(!panRef.current)return;
    event.preventDefault();event.stopPropagation();panRef.current=null;setPanning(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function persistScaleRegion(candidate:ScaleCandidate|null,calibration:ScaleCalibration,regionBounds:any,isDefault:boolean){
    if(locked||busy||!currentSheet)return;setBusy(true);
    try{const result=await saveTakeoffScaleRegion({takeoffSetId:takeoffSet.id,sheetId:currentSheet.id,name:isDefault?`${currentSheet.sheet_number||`Page ${currentSheet.page_number}`} Scale`:`${currentSheet.sheet_number||`Page ${currentSheet.page_number}`} · ${candidate?.label||calibration.scale_label} Region ${currentScaleRegions.filter(region=>!region.is_default).length+1}`,regionBounds,scaleLabel:candidate?.label||calibration.scale_label,scaleKind:candidate?.scaleKind==='nts'?'manual':candidate?.scaleKind||'manual',sourceType:candidate?'pdf_text':'manual',sourceText:candidate?.sourceText||null,sourceBounds:candidate?.sourceBounds||null,confidence:candidate?.confidence||null,calibration,isDefault});setMessage(`Scale ${candidate?.label||calibration.scale_label} saved${result.recalculated?` · ${result.recalculated} takeoff recalculated`:''}`);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setDraftScaleRegionId(null);setHoverPoint(null);setTool('select');router.refresh();}catch(error:any){setMessage(error?.message||'Could not save drawing scale.');}finally{setBusy(false);}
  }
  async function useDetectedScaleSheet(candidate:ScaleCandidate){try{await persistScaleRegion(candidate,calibrationFromDetectedScale(candidate),null,true);}catch(error:any){setMessage(error?.message||'Detected scale is invalid.');}}
  function beginDetectedScaleRegion(candidate:ScaleCandidate){try{calibrationFromDetectedScale(candidate);setPendingScaleCandidate(candidate);setPendingManualCalibration(null);setScaleRegionPoints([]);setCalibrationPoints([]);setTool('scaleRegion');setMessage(`Pick two corners for ${candidate.label}.`);}catch(error:any){setMessage(error?.message||'Detected scale is invalid.');}}
  function manualCalibration(){if(!currentSheet||!renderBox)throw new Error('Drawing sheet is not ready.');return calibrationFromManual(calibrationPoints,Number(knownDistanceFt),renderBox.pdfWidth,renderBox.pdfHeight);}
  async function useManualScaleSheet(){try{await persistScaleRegion(null,manualCalibration(),null,true);}catch(error:any){setMessage(error?.message||'Manual calibration is invalid.');}}
  function beginManualScaleRegion(){try{const calibration=manualCalibration();setPendingManualCalibration(calibration);setPendingScaleCandidate(null);setScaleRegionPoints([]);setTool('scaleRegion');setMessage('Pick two corners for the manually calibrated scale region.');}catch(error:any){setMessage(error?.message||'Manual calibration is invalid.');}}
  async function savePendingScaleRegion(){const bounds=boundsFromPoints(scaleRegionPoints);if(!bounds){setMessage('Pick two opposite corners for the scale region.');return;}try{if(pendingScaleCandidate)await persistScaleRegion(pendingScaleCandidate,calibrationFromDetectedScale(pendingScaleCandidate),bounds,false);else if(pendingManualCalibration)await persistScaleRegion(null,pendingManualCalibration,bounds,false);else setMessage('Choose a detected or manual scale first.');}catch(error:any){setMessage(error?.message||'Could not save scale region.');}}
  function cancelScaleRegion(){setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setHoverPoint(null);setTool('select');}
  async function removeScaleRegion(region:TakeoffScaleRegion){if(locked||busy)return;setBusy(true);try{await deleteTakeoffScaleRegion(region.id,takeoffSet.id);setMessage(`Removed ${region.name}`);router.refresh();}catch(error:any){setMessage(error?.message||'Could not remove scale region.');}finally{setBusy(false);}}
  async function removeSelected(){
    if(!selectedMeasurementId||locked||busy)return;setBusy(true);try{await deleteDrawingMeasurement(selectedMeasurementId,takeoffSet.id);historyRef.current.clear();setHistorySnapshot(historyRef.current.snapshot());setMessage('Takeoff object and generated estimate lines removed');setSelectedMeasurementId(null);setEditGeometry(null);editOriginalRef.current=null;router.refresh();}catch(error:any){setMessage(error?.message||'Could not delete object.');}finally{setBusy(false);}
  }
  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setSelectedMeasurementId(null);setConditionDrawActive(false);setSelectedAssemblyId('');setTool(mobileReview?'pan':'select');setZoom(1);if(mobileReview)window.dispatchEvent(new Event('carez:mobile-sheet-selected'));}
  function cancelTool(){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setConditionDrawActive(false);setSelectedAssemblyId('');setTool(mobileReview?'pan':'select');}

  const pageEntries=Array.from({length:pdfPageCount||initialSheets.length||1},(_,index)=>{const number=index+1;return initialSheets.find((s:any)=>Number(s.page_number)===number)||{id:`pending-${number}`,page_number:number,scale_status:'uncalibrated'};});
  const overlayClass=(tool==='pan'||spaceHeld)?(panning?styles.overlayPanning:styles.overlayPan):tool==='select'?styles.overlaySelect:'';
  const workingPoints=tool==='draw'||tool==='cutout'?draftPoints:tool==='scaleRegion'?scaleRegionPoints:calibrationPoints;
  const draftRenderPoints=hoverPoint&&(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout')?[...workingPoints,hoverPoint]:workingPoints;
  const zoomPercent=Math.round(zoom*100);
  const qualityLimited=renderQuality<.98;
  const selectedVersionRecord:any=selectedMeasurement?versionMap.get(selectedMeasurement.assembly_version_id):null;
  const selectedAssemblyRecord:any=selectedVersionRecord?assemblyMap.get(selectedVersionRecord.assembly_id):null;
  const selectedColor=hashColor(selectedAssemblyRecord?.code||selectedMeasurement?.id||'selected');

  const canvasPane=<div className="h-full w-full min-w-0 relative overflow-hidden cursor-crosshair">

    <section className={`${styles.center} ${styles.commandCanvas} z-0`} inert={props.drawingViewHidden} aria-hidden={props.drawingViewHidden||undefined}>
      {mobileReview&&<div className={styles.toolbar} onKeyDown={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}>
        <div className={styles.mobileReviewTools}>
          <Button type="button" className={`${styles.toolButton} ${styles.toolButtonActive}`} title="Pan plan"><Hand fontSize={16}/><span>Pan</span></Button>
        </div>
        <div className={styles.toolbarSpacer}/>
        <label className={styles.pageSelect}><span>Select Pages</span><Select aria-label="Select Pages" value={pageNumber} onChange={event=>changePage(Number(event.target.value))}>{pageEntries.map((sheet:any)=><option key={sheet.page_number} value={sheet.page_number}>{sheetDisplayLabel(sheet)}</option>)}</Select></label>
        <div className={styles.zoomGroup}>
          <Button type="button" className={styles.iconTool} title="Zoom out" onClick={()=>setZoomAt(zoom/1.2)}><Minus fontSize={15}/></Button>
          <Button type="button" className={styles.zoomLabel} title="Reset zoom" onClick={()=>setZoomAt(1)}>{zoomPercent}%</Button>
          <Button type="button" className={styles.iconTool} title="Zoom in" onClick={()=>setZoomAt(zoom*1.2)}><Plus fontSize={15}/></Button>
          <Button type="button" className={styles.iconTool} title="Fit page" onClick={fitPage}><Maximize fontSize={15}/></Button>
        </div>
      </div>}
      {!mobileReview&&!props.drawingViewHidden&&<TakeoffDock>
        <label className={`${styles.pageSelect} shrink-0`}><span>Sheet</span><Select aria-label="Select Pages" value={pageNumber} onChange={event=>changePage(Number(event.target.value))}>{pageEntries.map((sheet:any)=><option key={sheet.page_number} value={sheet.page_number}>{sheetDisplayLabel(sheet)}</option>)}</Select></label>
        <TakeoffSheetMetadataEditor takeoffSetId={takeoffSet.id} sheet={currentSheet} locked={locked||takeoffSet.status!=='active'}/>
        <span className="h-8 w-px shrink-0 bg-[#333333]" aria-hidden="true"/>
        <div className="flex shrink-0 items-center gap-1">
          <TakeoffDockButton label="Select · V" icon={<MousePointer2 fontSize={16}/>} active={tool==='select'} pressed={tool==='select'} onClick={()=>setTool('select')}/>
          <TakeoffDockButton label="Pan · H or hold Space" icon={<Hand fontSize={16}/>} active={tool==='pan'} pressed={tool==='pan'} onClick={()=>setTool('pan')}/>
          <TakeoffDockButton label={tool==='draw'?'Drawing Condition':'Draw Condition'} icon={<PenLine fontSize={16}/>} active={tool==='draw'} pressed={tool==='draw'} disabled={locked} onClick={()=>conditionDrawActive?setTool('draw'):openConditions()}/>
          <TakeoffDockButton label="Set drawing scale · C" icon={<Ruler fontSize={16}/>} active={tool==='calibrate'} pressed={tool==='calibrate'} disabled={locked} onClick={()=>{setCalibrationPoints([]);setInspectorOpen(true);setTool('calibrate');}}/>
          <TakeoffDockButton label={locked?'Review Concrete Conditions':'Concrete Conditions · M'} icon={<Crosshair fontSize={16}/>} onClick={openConditions} showLabel/>
          <TakeoffDockButton label="Edit selected shape · E" icon={<Pencil fontSize={15}/>} active={tool==='edit'} pressed={tool==='edit'} disabled={locked||!selectedGeometry} onClick={beginEdit}/>
          <TakeoffDockButton label="Add area cutout · K" icon={<Scissors fontSize={15}/>} active={tool==='cutout'} pressed={tool==='cutout'} disabled={locked||selectedGeometry?.type!=='polygon'} onClick={beginCutout}/>
        </div>
        <span className="h-8 w-px shrink-0 bg-[#333333]" aria-hidden="true"/>
        <div className="flex shrink-0 items-center gap-1">
          <TakeoffDockButton label="Snap to existing vertices · S" icon={<Magnet fontSize={15}/>} active={snapEnabled} pressed={snapEnabled} onClick={()=>setSnapEnabled(value=>!value)}/>
          <TakeoffDockButton label="Constrain horizontal or vertical · O" icon={<MoveHorizontal fontSize={15}/>} active={orthoEnabled} pressed={orthoEnabled} onClick={()=>setOrthoEnabled(value=>!value)}/>
          <TakeoffDockButton label="Undo point or geometry · Ctrl/Cmd+Z" icon={<Undo2 fontSize={15}/>} disabled={busy||(!draftPoints.length&&!calibrationPoints.length&&!scaleRegionPoints.length&&!historySnapshot.canUndo)} onClick={()=>{if(tool==='calibrate'&&calibrationPoints.length)setCalibrationPoints(points=>points.slice(0,-1));else if(tool==='scaleRegion'&&scaleRegionPoints.length)setScaleRegionPoints(points=>points.slice(0,-1));else if(draftPoints.length)setDraftPoints(points=>points.slice(0,-1));else void undoCommitted();}}/>
          <TakeoffDockButton label="Redo geometry · Ctrl/Cmd+Shift+Z" icon={<Redo2 fontSize={15}/>} disabled={busy||!historySnapshot.canRedo} onClick={()=>void redoCommitted()}/>
          {tool==='scaleRegion'&&<TakeoffDockButton label="Save scale region · Enter" icon={<Check fontSize={15}/>} emphasis showLabel disabled={busy||scaleRegionPoints.length!==2} onClick={()=>void savePendingScaleRegion()}/>}
          {tool==='draw'&&<TakeoffDockButton label="Finish measurement · Enter" icon={<Check fontSize={15}/>} emphasis showLabel disabled={busy||!draftPoints.length} onClick={()=>void finishDraft()}/>}
          {tool==='cutout'&&<TakeoffDockButton label="Save cutout · Enter" icon={<Check fontSize={15}/>} emphasis showLabel disabled={busy||draftPoints.length<3} onClick={()=>void finishCutout()}/>}
          {tool==='edit'&&<TakeoffDockButton label="Save shape · Enter" icon={<Check fontSize={15}/>} emphasis showLabel disabled={busy||!editGeometry} onClick={()=>void saveEdit()}/>}
          {(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout'||tool==='edit')&&<TakeoffDockButton label="Cancel active tool · Escape" icon={<X fontSize={15}/>} onClick={cancelTool}/>}
        </div>
        <span className="h-8 w-px shrink-0 bg-[#333333]" aria-hidden="true"/>
        <div className="flex shrink-0 items-center gap-1">
          <TakeoffDockButton label="Zoom out" icon={<Minus fontSize={15}/>} onClick={()=>setZoomAt(zoom/1.2)}/>
          <Button type="button" className="min-w-12 text-xs font-mono tabular-nums text-[#EDEDED]" title={qualityLimited?'Display zoom exceeds full-resolution render budget. Geometry remains exact.':'Reset zoom'} onClick={()=>setZoomAt(1)}>{zoomPercent}%{qualityLimited&&<i> HQ</i>}</Button>
          <TakeoffDockButton label="Zoom in" icon={<Plus fontSize={15}/>} onClick={()=>setZoomAt(zoom*1.2)}/>
          <TakeoffDockButton label="Fit width · 0" icon={<RotateCcw fontSize={15}/>} onClick={()=>setZoomAt(1)}/>
          <TakeoffDockButton label="Fit page · 1" icon={<Maximize fontSize={15}/>} onClick={fitPage}/>
        </div>
      </TakeoffDock>}

      <div ref={attachViewport} className={styles.canvasViewport} onPointerDownCapture={startViewportPan} onPointerMoveCapture={moveViewportPan} onPointerUpCapture={stopViewportPan} onPointerCancelCapture={stopViewportPan} onClickCapture={event=>{if(mobileReview||tool==='pan'||spaceHeld)event.stopPropagation();}}>
        {!renderBox&&<div className={styles.loading}><div className="flex flex-col items-center gap-3 px-6 text-center"><p role={pdfLoadError?'alert':'status'}>{message}</p>{pdfLoadError&&<Button type="button" className="rounded border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={()=>setPdfLoadAttempt(attempt=>attempt+1)}>Retry PDF</Button>}</div></div>}
        <div ref={paperRef} className={styles.paper} style={renderBox?{width:renderBox.width,height:renderBox.height}:{width:1,height:1}}>
          <canvas ref={canvasRef} className={styles.pdfCanvas}/>
          {renderBox&&<svg className={`${styles.overlay} ${overlayClass}`} viewBox={`0 0 ${renderBox.pdfWidth} ${renderBox.pdfHeight}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerLeave={()=>{if(!panning){setHoverPoint(null);setHoverSnapped(false);}}} onContextMenu={event=>{event.preventDefault();if(tool==='draw')void finishDraft();if(tool==='cutout')void finishCutout();}}>
            <TakeoffScaleOverlay regions={currentScaleRegions} pendingCandidate={pendingScaleCandidate} regionPoints={scaleRegionPoints} pageWidth={renderBox.pdfWidth} pageHeight={renderBox.pdfHeight}/>
            {currentMeasurements.map((measurement:any)=>{
              if(props.conditionPresentation?.hiddenMeasurementIds.includes(measurement.id))return null;
              const stored=drawingGeometry(measurement.geometry);if(!stored)return null;const selected=selectedMeasurementId===measurement.id;const geometry=selected&&tool==='edit'&&editGeometry?editGeometry:stored;const points=geometry.points;const version:any=versionMap.get(measurement.assembly_version_id);const assembly:any=version?assemblyMap.get(version.assembly_id):null;const style=resolveDisplayStyle(assembly?.display_style,hashColor(assembly?.code||measurement.assembly_version_id||measurement.id));const color=props.conditionPresentation?.colors[measurement.id]||style.color;const coords=points.map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ');const scaleRegion=scaleRegionMap.get(measurement.scale_region_id);const measurementCalibration=scaleRegion?.calibration||currentSheet?.calibration;const physical=physicalFootprint(points,version,measurement.variables,measurementCalibration,renderBox,measurement.geometry_anchor,measurement.geometry_offset_in);const physicalCoords=physical.map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ');const onSelect=(event:React.MouseEvent)=>{if(tool==='select'){event.stopPropagation();setSelectedMeasurementId(measurement.id);setEditGeometry(null);editOriginalRef.current=null;}};
              return <g key={measurement.id} className={styles.measurementShape} data-selected={selected} onClick={onSelect} style={{cursor:tool==='select'?'pointer':undefined}}>
                {geometry.type==='polygon'&&<path d={geometryPath(geometry,renderBox.pdfWidth,renderBox.pdfHeight)} fill={`${color}24`} fillRule="evenodd" stroke={color} strokeWidth={selected?3.2:2} vectorEffect="non-scaling-stroke"/>}
                {physical.length>=3&&<polygon points={physicalCoords} fill={`${style.color}${Math.round(style.opacity*255).toString(16).padStart(2,'0')}`} stroke={style.borderColor} strokeWidth={selected?style.borderWidth+1:style.borderWidth} strokeDasharray={style.pattern==='dashed'?'6 4':undefined} vectorEffect="non-scaling-stroke"/>}{geometry.type==='polyline'&&<polyline points={coords} fill="none" stroke={color} strokeWidth={selected?4:2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
                {geometry.type==='count'&&points.map((point,index)=><g key={index}><circle cx={point.x*renderBox.pdfWidth} cy={point.y*renderBox.pdfHeight} r={selected?6:5} fill={`${color}45`} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/><line x1={point.x*renderBox.pdfWidth-5} y1={point.y*renderBox.pdfHeight} x2={point.x*renderBox.pdfWidth+5} y2={point.y*renderBox.pdfHeight} stroke={color} vectorEffect="non-scaling-stroke"/><line x1={point.x*renderBox.pdfWidth} y1={point.y*renderBox.pdfHeight-5} x2={point.x*renderBox.pdfWidth} y2={point.y*renderBox.pdfHeight+5} stroke={color} vectorEffect="non-scaling-stroke"/></g>)}
              </g>;
            })}

            <TakeoffMeasurementHoverOverlay
              measurements={currentMeasurements}
              outputs={measurementSummaries}
              assemblies={assemblies}
              versions={versions}
              pageWidth={renderBox.pdfWidth}
              pageHeight={renderBox.pdfHeight}
              tool={tool}
              panning={panning}
              spaceHeld={spaceHeld}
              viewportRef={viewportRef}
              onSelectMeasurement={measurement=>{setSelectedMeasurementId(measurement.id);setEditGeometry(null);editOriginalRef.current=null;setInspectorOpen(true);}}
              onEditMeasurement={beginEditMeasurement}
            />

            {tool==='edit'&&editGeometry&&selectedMeasurement&&<TakeoffVertexEditor geometry={editGeometry} pageWidth={renderBox.pdfWidth} pageHeight={renderBox.pdfHeight} color={selectedColor} onChange={setEditGeometry}/>}

            {tool==='draw'&&draftRenderPoints.length>0&&<g pointerEvents="none">
              {selectedAssembly?.primary_measurement==='SF'&&draftRenderPoints.length>=2&&<polygon points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(66,111,147,.13)" stroke="#426F93" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
              {selectedAssembly?.primary_measurement==='LF'&&draftRenderPoints.length>=2&&<><polygon points={physicalFootprint(draftRenderPoints,selectedVersion,variableValues,draftCalibration,renderBox).map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(66,111,147,.22)" stroke="#426F93" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><polyline points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="none" stroke="#426F93" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/></>}
              {draftPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="4" fill="#426F93" stroke="#171B19" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
            </g>}
            {tool==='cutout'&&draftRenderPoints.length>0&&<g pointerEvents="none">
              {draftRenderPoints.length>=2&&<polygon points={draftRenderPoints.map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(138,97,11,.16)" stroke="#8A610B" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
              {draftPoints.map((point,index)=><circle key={index} cx={point.x*renderBox.pdfWidth} cy={point.y*renderBox.pdfHeight} r="4" fill="#8A610B" stroke="#171B19" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
            </g>}
            {tool==='calibrate'&&draftRenderPoints.length>0&&<g pointerEvents="none">{draftRenderPoints.length>=2&&<line x1={draftRenderPoints[0].x*renderBox.pdfWidth} y1={draftRenderPoints[0].y*renderBox.pdfHeight} x2={draftRenderPoints[1].x*renderBox.pdfWidth} y2={draftRenderPoints[1].y*renderBox.pdfHeight} stroke="#8A610B" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}{calibrationPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="5" fill="#8A610B" stroke="#171B19" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</g>}
            {hoverPoint&&(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout')&&<g pointerEvents="none" transform={`translate(${hoverPoint.x*renderBox.pdfWidth} ${hoverPoint.y*renderBox.pdfHeight})`}><circle r={hoverSnapped?7:4.5} fill="none" stroke={hoverSnapped?'#D4BA88':tool==='cutout'?'#8A610B':'#426F93'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><line x1="-12" x2="12" y1="0" y2="0" stroke={hoverSnapped?'#D4BA88':tool==='cutout'?'#8A610B':'#426F93'} strokeWidth="1" vectorEffect="non-scaling-stroke"/><line y1="-12" y2="12" x1="0" x2="0" stroke={hoverSnapped?'#D4BA88':tool==='cutout'?'#8A610B':'#426F93'} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}
          </svg>}
        </div>
        {preview&&<div className={`${styles.liveReadout} ${tool==='cutout'?styles.cutoutReadout:''}`}><strong>{formatTakeoffMeasurement(preview.quantity,preview.unit)}</strong>{tool==='cutout'&&Number(preview.cutoutQuantity||0)>0?<span>net · {qty(preview.cutoutQuantity)} SF excluded</span>:preview.perimeterLf>0&&<span>{formatArchitecturalLength(preview.perimeterLf)} perimeter</span>}</div>}
      </div>

      <AnimatePresence>
        {!mobileReview&&showEmptyToast&&<motion.div
          key={currentSheet?.id||'empty-sheet'}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-36 right-6 z-[46] max-w-72 rounded border border-[#333333] bg-[#111111]/95 px-4 py-3 text-xs text-[#EDEDED] shadow-[0_16px_36px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          initial={reducedMotion?false:{opacity:0,y:18}}
          animate={{opacity:1,y:0}}
          exit={reducedMotion?{opacity:0}:{opacity:0,y:18}}
          transition={{duration:reducedMotion?0:.22}}
        >No takeoffs on this sheet yet. Select a Condition in the roster to start tracing.</motion.div>}
      </AnimatePresence>

      {mobileReview?<div className={styles.statusbar}><span><strong>Page {pageNumber}</strong> / {pdfPageCount||'…'}</span><span className={currentScale?styles.statusOk:styles.statusHold}>{currentScale?'Scale set':'Scale required'}</span><span className={styles.mobileReviewStatus}>Review only</span></div>:<div className={styles.statusbar}><span><strong>Page {pageNumber}</strong> / {pdfPageCount||'…'}</span><span className={currentScale?styles.statusOk:styles.statusHold}>{currentScale?`${currentScaleRegions.length||1} scale${(currentScaleRegions.length||1)===1?'':'s'} set`:'Scale required'}</span><span>{snapEnabled?'Snap on':'Snap off'} · {orthoEnabled?'Ortho on':'Ortho off'}</span><span className={styles.statusHint}>{tool==='draw'?'Click points · Enter/right-click to finish':tool==='scaleRegion'?'Pick two opposite region corners · Enter to save':tool==='cutout'?'Trace opening · Enter/right-click to subtract':tool==='edit'?'Drag vertices · Enter to save':'Wheel zoom · Space/middle mouse pan · Arrows nudge selection'}</span><span className={styles.statusMessage}>{message}</span></div>}
    </section>
    {props.verificationPane}

    {!mobileReview&&<Draggable nodeRef={utilityRef} handle={`.${styles.utilityHandle}`} cancel="button,input,select,textarea,.react-resizable-handle" bounds="parent" defaultPosition={utilityPosition} onStop={(_,data)=>setUtilityPosition({x:data.x,y:data.y})}><div ref={utilityRef} className={`${styles.canvasHud} ${inspectorOpen?styles.floatingUtility:''} absolute bottom-28 right-6 z-40 border border-border bg-surface-raised px-4 py-2 rounded text-[11px] text-muted-foreground cursor-default`} onKeyDown={event=>{if(event.key==='Escape')setInspectorOpen(false);event.stopPropagation();}} onPointerDown={event=>event.stopPropagation()} onPointerUp={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()}>
      <div className={styles.utilityHandle} aria-label="Move canvas controls">Canvas controls <span aria-hidden="true">⋮⋮</span></div>
      <Button type="button" aria-expanded={inspectorOpen} aria-controls="takeoff-canvas-controls" onClick={()=>setInspectorOpen(value=>!value)} className="flex items-center gap-2 text-left font-mono" title="Scale, calibration and selected takeoff controls">
        <Ruler fontSize={12}/><span className="max-w-32 truncate">{currentScaleRegions.find(region=>region.is_default)?.scale_label||(currentScale?'Regional scale':'Set scale')}</span>
        {selectedMeasurement?<output className="border-l border-border pl-2 text-[12px] font-semibold text-foreground" title={selectedMeasurement.name}>{formatTakeoffMeasurement(selectedMeasurement.raw_quantity,selectedMeasurement.raw_unit)}</output>:null}
      </Button>
      {inspectorOpen&&<ResizableBox width={utilitySize.width} height={utilitySize.height} minConstraints={[260,240]} maxConstraints={[620,640]} resizeHandles={['se']} onResizeStop={(_,data)=>setUtilitySize(data.size)}><div id="takeoff-canvas-controls" className={styles.hudControls}>
          <TakeoffScalePanel
            regions={currentScaleRegions}
            candidates={visibleScaleCandidates}
            detectionStatus={scaleDetectionStatus}
            locked={locked}
            busy={busy}
            knownDistanceFt={knownDistanceFt}
            calibrationPointCount={calibrationPoints.length}
            pendingCandidate={pendingScaleCandidate}
            pendingManualLabel={pendingManualCalibration?.scale_label||null}
            regionPointCount={scaleRegionPoints.length}
            onKnownDistanceChange={setKnownDistanceFt}
            onUseDetectedSheet={candidate=>void useDetectedScaleSheet(candidate)}
            onAssignDetectedRegion={beginDetectedScaleRegion}
            onPickManual={()=>{setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setTool('calibrate');}}
            onUseManualSheet={()=>void useManualScaleSheet()}
            onAssignManualRegion={beginManualScaleRegion}
            onSaveRegion={()=>void savePendingScaleRegion()}
            onCancelRegion={cancelScaleRegion}
            onDeleteRegion={region=>void removeScaleRegion(region)}
          />

          {selectedMeasurement?<div className={`${styles.group} ${styles.selectedGroup}`}>
            <div className={styles.groupTitle}>Selected Takeoff</div><div className={styles.selectedTitle}>{selectedMeasurement.name}</div><div className={styles.selectedQty}>{formatTakeoffMeasurement(selectedMeasurement.raw_quantity,selectedMeasurement.raw_unit)}</div>
            {selectedGeometry?.type==='polygon'&&<div className={styles.cutoutSummary}><span><b>{selectedCutoutCount}</b> cutout{selectedCutoutCount===1?'':'s'}</span><span><b>{qty(selectedMeasurement.geometry?.cutout_quantity||0)}</b> SF excluded</span><span><b>{formatArchitecturalLength(selectedMeasurement.geometry?.perimeter_lf||0)}</b> edge</span></div>}
            {selectedSummary?.inputHolds?<div className={styles.statusWarn}>{selectedSummary.inputHolds} generated line{selectedSummary.inputHolds===1?'':'s'} waiting on required Condition input. Geometry and unaffected quantities are saved.</div>:null}
            <div className={styles.statusWarn}>{conditionMeasurementIdSet.has(selectedMeasurement.id)?'Condition-managed takeoff. Plan facts, methods, production, and modules are edited in Concrete Conditions.':'Historical takeoff preserved for lineage. New scope is authored through Concrete Conditions.'}</div>
            {!locked&&<div className={styles.proActionGrid}>{tool==='edit'?<><Button type="button" className={styles.primary} disabled={busy} onClick={()=>void saveEdit()}><Check fontSize={14}/> Save Shape</Button><Button type="button" className={styles.secondary} onClick={cancelTool}><X fontSize={14}/> Cancel</Button></>:<><Button type="button" className={styles.secondary} onClick={beginEdit}><Pencil fontSize={14}/> Edit Shape</Button>{selectedGeometry?.type==='polygon'&&<Button type="button" className={styles.secondary} onClick={beginCutout}><Scissors fontSize={14}/> Add Cutout</Button>}{selectedCutoutCount>0&&<Button type="button" className={styles.secondary} disabled={busy} onClick={()=>void removeLastCutout()}><Undo2 fontSize={14}/> Remove Last</Button>}</>}</div>}
            {tool==='cutout'&&preview&&<div className={`${styles.previewCard} ${styles.cutoutPreview}`}><span>Net concrete</span><strong>{qty(preview.quantity)} SF</strong><small>{qty(preview.cutoutQuantity||0)} SF total excluded</small><Button type="button" disabled={busy||draftPoints.length<3} onClick={()=>void finishCutout()}><Scissors fontSize={15}/> Save cutout</Button></div>}
            {!locked&&<Button type="button" className={styles.danger} disabled={busy} onClick={()=>void removeSelected()}><Trash2 fontSize={14}/> Delete takeoff</Button>}
          </div>:<div className={styles.group}><div className={styles.groupTitle}>New Takeoff</div><div className={styles.groupHelp}>New measured scope starts from a Concrete Condition so geometry, modules, outputs, and estimate lineage stay together.</div>{!locked&&<Button type="button" className={styles.measurePrimary} onClick={openConditions}><Crosshair fontSize={16}/> Open Concrete Conditions</Button>}</div>}

          <Accordion collapsible className={styles.shortcuts}><AccordionItem value="shortcuts"><AccordionHeader>Keyboard & mouse shortcuts</AccordionHeader><AccordionPanel><div className={styles.shortcutGrid}><kbd>Wheel</kbd><span>Zoom at cursor</span><kbd>Space</kbd><span>Temporary pan</span><kbd>M</kbd><span>Open Conditions</span><kbd>E</kbd><span>Edit selected shape</span><kbd>K</kbd><span>Add area cutout</span><kbd>Arrows</kbd><span>Nudge selected · Shift × 10</span><kbd>Ctrl Z</kbd><span>Undo committed geometry</span><kbd>Ctrl ⇧ Z</kbd><span>Redo committed geometry</span><kbd>PgUp/Dn</kbd><span>Previous / next sheet</span><kbd>S / O</kbd><span>Snap / ortho</span><kbd>Enter</kbd><span>Finish or save</span><kbd>Esc</kbd><span>Cancel tool</span></div></AccordionPanel></AccordionItem></Accordion>
      </div></ResizableBox>}
    </div></Draggable>}
    {!mobileReview&&<TakeoffQuantityDock
      measurements={initialMeasurements}
      outputs={measurementSummaries}
      assemblies={assemblies}
      versions={versions}
      sections={sections}
      sheets={initialSheets}
      currentSheetId={currentSheet?.id || null}
      selectedMeasurementId={selectedMeasurementId}
      onOpenMeasurement={measurement=>{
        const sheet=initialSheets.find((entry:any)=>entry.id===measurement.sheet_id);
        if(sheet&&Number(sheet.page_number)!==pageNumber)changePage(Number(sheet.page_number));
        setSelectedMeasurementId(measurement.id);setTool('select');setInspectorOpen(true);
      }}
    />}
  </div>;

  return <div className={`${styles.workstation} h-full min-h-0 flex-1 w-full flex overflow-hidden`} data-mobile-review={mobileReview?'true':'false'}>
  <div className={styles.commandWorkspace}>
    {mobileReview?canvasPane:<div className={styles.dockingLayout}><Layout model={dockModel} factory={node=>node.getComponent()==='scope-tree'?props.sidebar:canvasPane} supportsPopout={false}/></div>}
    </div>
  </div>;
}
