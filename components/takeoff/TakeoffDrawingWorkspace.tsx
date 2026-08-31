'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {
  Check,Copy,Crosshair,Hand,Magnet,Maximize,Minus,MousePointer2,MoveHorizontal,PanelLeftClose,
  PanelLeftOpen,PanelRightClose,PanelRightOpen,Pencil,Plus,Redo2,Repeat2,RotateCcw,Ruler,Scissors,
  Search,Trash2,Undo2,X
} from 'lucide-react';
import {
  createDrawingMeasurement,deleteDrawingMeasurement,deleteTakeoffScaleRegion,duplicateDrawingMeasurement,initializeTakeoffSheets,
  saveTakeoffScaleRegion,updateDrawingMeasurementGeometry
} from '@/app/takeoff/[setId]/actions';
import {GeometryCommandHistory,type CommandHistorySnapshot,type GeometryCommandKind} from '@/lib/takeoff/commandHistory';
import {measureDrawingGeometry,roundMeasurement,type DrawingGeometry,type DrawingMeasurement,type NormalizedPoint} from '@/lib/takeoff/geometry';
import {linearFootprint,parseRenderConfig,resolveDisplayStyle} from '@/lib/takeoff/physicalGeometry';
import {enumOptions,isAssemblyVariableActive} from '@/lib/takeoff/assemblyContext';
import {formatArchitecturalLength,formatTakeoffMeasurement} from '@/lib/takeoff/lengthFormat';
import {boundsFromPoints,calibrationFromDetectedScale,calibrationFromManual,findScaleRegionForPoint,type ScaleCalibration,type ScaleCandidate,type TakeoffScaleRegion} from '@/lib/takeoff/scaleRegions';
import {TakeoffAssemblyInputEditor} from './TakeoffAssemblyInputEditor';
import {TakeoffBuildPlanPanel} from './TakeoffBuildPlanPanel';
import {TakeoffQuantityDock} from './TakeoffQuantityDock';
import {TakeoffScaleOverlay} from './TakeoffScaleOverlay';
import {TakeoffScalePanel} from './TakeoffScalePanel';
import {TakeoffVertexEditor} from './TakeoffVertexEditor';
import {usePdfScaleDetection} from './usePdfScaleDetection';
import styles from './TakeoffDrawingWorkspace.module.css';

type Tool='select'|'pan'|'calibrate'|'scaleRegion'|'draw'|'cutout'|'edit';
type Props={
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
};
type RenderBox={width:number;height:number;pdfWidth:number;pdfHeight:number};
type ResolvedPoint={point:NormalizedPoint;snapped:boolean};
type ZoomAnchor={x:number;y:number;clientX:number;clientY:number};

const palette=['#6f95ee','#5fc79a','#e4b15d','#dd7f99','#9a87eb','#59c3cf','#e27c68','#9dbd62'];
const MIN_ZOOM=.2;
const MAX_ZOOM=20;
const MAX_RENDER_PIXELS=28_000_000;
const MAX_CANVAS_DIMENSION=16_000;
const SNAP_PX=12;
const qty=(n:any,digits=2)=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:digits});
const money=(n:any)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));

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
  const {takeoffSet,pdfUrl,sourceTitle,initialSheets,scaleRegions,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,riskClasses,methodProfiles,locked}=props;
  const router=useRouter();
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const viewportRef=useRef<HTMLDivElement|null>(null);
  const paperRef=useRef<HTMLDivElement|null>(null);
  const pdfRef=useRef<any>(null);
  const renderTaskRef=useRef<any>(null);
  const panRef=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const initializingRef=useRef(false);
  const zoomAnchorRef=useRef<ZoomAnchor|null>(null);
  const historyRef=useRef(new GeometryCommandHistory());
  const editOriginalRef=useRef<DrawingGeometry|null>(null);

  const [pdfReady,setPdfReady]=useState(false);
  const [pdfPageCount,setPdfPageCount]=useState(Number(takeoffSet.page_count||initialSheets.length||0));
  const [pageNumber,setPageNumber]=useState(initialSheets[0]?.page_number||1);
  const [zoom,setZoom]=useState(1);
  const [fitWidth,setFitWidth]=useState(900);
  const [renderBox,setRenderBox]=useState<RenderBox|null>(null);
  const [renderQuality,setRenderQuality]=useState(1);
  const [tool,setTool]=useState<Tool>('select');
  const [draftPoints,setDraftPoints]=useState<NormalizedPoint[]>([]);
  const [hoverPoint,setHoverPoint]=useState<NormalizedPoint|null>(null);
  const [hoverSnapped,setHoverSnapped]=useState(false);
  const [calibrationPoints,setCalibrationPoints]=useState<NormalizedPoint[]>([]);
  const [knownDistanceFt,setKnownDistanceFt]=useState('10');
  const [draftScaleRegionId,setDraftScaleRegionId]=useState<string|null>(null);
  const [scaleRegionPoints,setScaleRegionPoints]=useState<NormalizedPoint[]>([]);
  const [pendingScaleCandidate,setPendingScaleCandidate]=useState<ScaleCandidate|null>(null);
  const [pendingManualCalibration,setPendingManualCalibration]=useState<ScaleCalibration|null>(null);
  const [selectedMeasurementId,setSelectedMeasurementId]=useState<string|null>(null);
  const [editGeometry,setEditGeometry]=useState<DrawingGeometry|null>(null);
  const [historySnapshot,setHistorySnapshot]=useState<CommandHistorySnapshot>(()=>historyRef.current.snapshot());
  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>(assemblies[0]?.id||'');
  const [assemblySearch,setAssemblySearch]=useState('');
  const [objectName,setObjectName]=useState('');
  const [sectionId,setSectionId]=useState('');
  const [riskClassCode,setRiskClassCode]=useState('');
  const [selectedMethodProfileId,setSelectedMethodProfileId]=useState<string|null>(null);
  const [location,setLocation]=useState('');
  const [drawingReference,setDrawingReference]=useState('');
  const [variableValues,setVariableValues]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Loading PDF plans…');
  const [panning,setPanning]=useState(false);
  const [spaceHeld,setSpaceHeld]=useState(false);
  const [snapEnabled,setSnapEnabled]=useState(true);
  const [orthoEnabled,setOrthoEnabled]=useState(false);
  const [repeatMode,setRepeatMode]=useState(true);
  const [sheetsOpen,setSheetsOpen]=useState(true);
  const [inspectorOpen,setInspectorOpen]=useState(true);
  const [inspectorTab,setInspectorTab]=useState<'takeoffs'|'properties'|'buildPlan'>('takeoffs');
  const [buildPlanWorkbenchOpen,setBuildPlanWorkbenchOpen]=useState(false);

  const latestVersionByAssembly=useMemo(()=>{const map=new Map<string,any>();for(const version of versions)if(!map.has(version.assembly_id))map.set(version.assembly_id,version);return map;},[versions]);
  const assemblyMap=useMemo(()=>new Map<string,any>(assemblies.map((a:any)=>[a.id,a])),[assemblies]);
  const versionMap=useMemo(()=>new Map<string,any>(versions.map((v:any)=>[v.id,v])),[versions]);
  const selectedAssembly:any=assemblyMap.get(selectedAssemblyId);
  const selectedVersion:any=selectedAssembly?latestVersionByAssembly.get(selectedAssembly.id):null;
  const selectedVariables=useMemo(()=>selectedVersion?variables.filter((v:any)=>v.assembly_version_id===selectedVersion.id):[],[selectedVersion,variables]);
  const selectedMethodProfile=useMemo(()=>methodProfiles.find((profile:any)=>profile.id===selectedMethodProfileId&&profile.assembly_version_id===selectedVersion?.id&&profile.status==='verified')||null,[methodProfiles,selectedMethodProfileId,selectedVersion?.id]);
  const requiredMethodVariables=useMemo(()=>selectedVariables.filter((variable:any)=>variable.requires_verification&&['method_decision','production_assumption','commercial_assumption'].includes(variable.input_role)&&isAssemblyVariableActive(variable,variableValues)),[selectedVariables,variableValues]);
  const buildPlanRequired=requiredMethodVariables.length>0;
  const buildPlanReady=!buildPlanRequired||Boolean(selectedMethodProfile&&requiredMethodVariables.every((variable:any)=>String(selectedMethodProfile.method_inputs?.[variable.variable_key]??'')===String(variableValues[variable.variable_key]??'')));
  const hasBuilderModel=selectedVariables.some((variable:any)=>!['legacy','derived'].includes(variable.input_role||'legacy'));
  const currentSheet=useMemo(()=>initialSheets.find((s:any)=>Number(s.page_number)===pageNumber)||null,[initialSheets,pageNumber]);
  const currentMeasurements=useMemo(()=>initialMeasurements.filter((m:any)=>m.sheet_id===currentSheet?.id),[initialMeasurements,currentSheet]);
  const currentScaleRegions=useMemo(()=>scaleRegions.filter((region:any)=>region.sheet_id===currentSheet?.id) as TakeoffScaleRegion[],[scaleRegions,currentSheet?.id]);
  const scaleRegionMap=useMemo(()=>new Map((scaleRegions as TakeoffScaleRegion[]).map(region=>[region.id,region])),[scaleRegions]);
  const currentScale=currentScaleRegions.length>0||currentSheet?.scale_status==='calibrated';
  const {candidates:scaleCandidates,status:scaleDetectionStatus}=usePdfScaleDetection(pdfRef,pdfReady,pageNumber);
  const visibleScaleCandidates=useMemo(()=>scaleCandidates.filter(candidate=>!currentScaleRegions.some(region=>region.is_default&&region.source_type==='pdf_text'&&region.scale_label===candidate.label)),[scaleCandidates,currentScaleRegions]);
  const selectedMeasurement=initialMeasurements.find((m:any)=>m.id===selectedMeasurementId)||null;
  const selectedGeometry=useMemo(()=>selectedMeasurement?drawingGeometry(selectedMeasurement.geometry):null,[selectedMeasurement]);
  const selectedScaleRegion=selectedMeasurement?scaleRegionMap.get(selectedMeasurement.scale_region_id):null;
  const selectedCalibration=selectedScaleRegion?.calibration||currentSheet?.calibration||null;
  const draftScaleRegion=draftScaleRegionId?scaleRegionMap.get(draftScaleRegionId):null;
  const draftCalibration=draftScaleRegion?.calibration||null;
  const selectedCutoutCount=selectedGeometry?.holes?.length||0;

  const summaryMap=useMemo(()=>{
    const map=new Map<string,{mh:number;cost:number;missing:number;inputHolds:number;priceHolds:number}>();
    for(const row of measurementSummaries){
      const prior=map.get(row.measurement_id)||{mh:0,cost:0,missing:0,inputHolds:0,priceHolds:0};
      prior.mh+=Number(row.estimated_man_hours||0);prior.cost+=Number(row.direct_cost||0);
      if(row.pricing_status==='missing_input'){prior.missing+=1;prior.inputHolds+=1;}
      else if(['missing_price','missing_labor_rate'].includes(row.pricing_status)){prior.missing+=1;prior.priceHolds+=1;}
      map.set(row.measurement_id,prior);
    }
    return map;
  },[measurementSummaries]);
  const selectedSummary=selectedMeasurement?summaryMap.get(selectedMeasurement.id):null;

  const filteredAssemblies=useMemo(()=>{
    const q=assemblySearch.trim().toLowerCase();
    if(!q)return assemblies;
    return assemblies.filter((a:any)=>[a.code,a.name,a.category,a.description].some(v=>String(v||'').toLowerCase().includes(q)));
  },[assemblies,assemblySearch]);

  useEffect(()=>{
    if(selectedMeasurementId&&!selectedMeasurement){setSelectedMeasurementId(null);setEditGeometry(null);editOriginalRef.current=null;if(tool==='edit'||tool==='cutout')setTool('select');}
  },[selectedMeasurementId,selectedMeasurement,tool]);

  useEffect(()=>{
    if(!selectedVersion)return;
    const next:Record<string,string>={};
    for(const variable of selectedVariables){if(variable.variable_key==='perimeter_lf'&&selectedAssembly?.primary_measurement==='SF')continue;next[variable.variable_key]=variable.default_value===null||variable.default_value===undefined?'':String(variable.default_value);}
    const profile=methodProfiles.find((entry:any)=>entry.assembly_version_id===selectedVersion.id&&entry.status==='verified')||null;
    if(profile){for(const [key,value] of Object.entries(profile.method_inputs||{}))next[key]=value===null||value===undefined?'':String(value);}
    setVariableValues(next);
    setSelectedMethodProfileId(profile?.id||null);
    setRiskClassCode(selectedVersion.default_risk_class_code||'');
    setObjectName('');
    setDraftPoints([]);
    setDraftScaleRegionId(null);
    setHoverPoint(null);
  },[selectedVersion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    let cancelled=false;
    async function loadPdf(){
      try{
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
      }catch(error:any){setMessage(error?.message||'Could not load PDF plans.');}
    }
    void loadPdf();
    return()=>{cancelled=true;renderTaskRef.current?.cancel?.();const pdf=pdfRef.current;pdfRef.current=null;if(pdf)void pdf.destroy?.();};
  },[pdfUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    const el=viewportRef.current;if(!el)return;
    const update=()=>setFitWidth(Math.max(320,el.clientWidth-34));update();
    const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
  },[sheetsOpen,inspectorOpen]);

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
        const canvas=canvasRef.current!;const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('Canvas is unavailable.');
        canvas.width=Math.max(1,Math.floor(renderViewport.width));canvas.height=Math.max(1,Math.floor(renderViewport.height));
        canvas.style.width=`${displayViewport.width}px`;canvas.style.height=`${displayViewport.height}px`;
        setRenderBox({width:displayViewport.width,height:displayViewport.height,pdfWidth:base.width,pdfHeight:base.height});
        setRenderQuality(renderScale/displayScale);
        const task=page.render({canvasContext:context,viewport:renderViewport});renderTaskRef.current=task;await task.promise;page.cleanup();
      }catch(error:any){if(error?.name!=='RenderingCancelledException')setMessage(error?.message||'Could not render this PDF page.');}
    }
    void render();return()=>{cancelled=true;renderTaskRef.current?.cancel?.();};
  },[pdfReady,pageNumber,zoom,fitWidth]);

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
    if(!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}
    const geometryType:DrawingGeometry['type']=selectedAssembly.primary_measurement==='SF'?'polygon':selectedAssembly.primary_measurement==='EA'?'count':'polyline';
    const minimum=geometryType==='polygon'?3:geometryType==='polyline'?2:1;
    if(draftPoints.length<minimum){setMessage(`${selectedAssembly.primary_measurement} takeoff needs at least ${minimum} point${minimum===1?'':'s'}.`);return;}
    if(geometryType!=='count'&&!draftScaleRegionId){setMessage('Start the takeoff inside an accepted scale region.');return;}
    const sameAssemblyCount=currentMeasurements.filter((m:any)=>m.assembly_version_id===selectedVersion.id).length;
    const autoName=`${selectedAssembly.name}${location.trim()?` — ${location.trim()}`:''} ${sameAssemblyCount+1}`;
    const finalName=objectName.trim()||autoName;
    setBusy(true);
    try{
      const result=await createDrawingMeasurement({takeoffSetId:takeoffSet.id,sheetId:currentSheet.id,estimateSectionId:sectionId||null,assemblyVersionId:selectedVersion.id,methodProfileId:selectedMethodProfileId,scaleRegionId:draftScaleRegionId,name:finalName,location:location.trim()||null,drawingReference:drawingReference.trim()||null,riskClassCode:riskClassCode||null,variables:variableValues,geometry:{type:geometryType,points:draftPoints}});
      const holdText=result.inputHolds?` · ${result.inputHolds} input hold${result.inputHolds===1?'':'s'}`:'';
      setMessage(`Saved ${finalName} · ${formatTakeoffMeasurement(result.quantity,result.unit)}${result.perimeterLf?` · ${formatArchitecturalLength(result.perimeterLf)} perimeter`:''}${holdText}`);
      setDraftPoints([]);setDraftScaleRegionId(null);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);setTool(repeatMode?'draw':'select');router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not save drawing measurement.');}finally{setBusy(false);}
  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,draftScaleRegionId,currentMeasurements,location,objectName,takeoffSet.id,sectionId,drawingReference,riskClassCode,variableValues,repeatMode,router,buildPlanReady,selectedMethodProfileId]);

  function beginEdit(){if(locked||!selectedMeasurement||!selectedGeometry)return;const copy=copyGeometry(selectedGeometry);editOriginalRef.current=copyGeometry(selectedGeometry);setEditGeometry(copy);setDraftPoints([]);setTool('edit');setMessage('Drag a vertex, then press Enter or Save Shape.');}
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
  async function duplicateSelected(){if(!selectedMeasurementId||locked||busy)return;setBusy(true);try{const result=await duplicateDrawingMeasurement(selectedMeasurementId,takeoffSet.id);setMessage(`Duplicated takeoff · ${formatTakeoffMeasurement(result.quantity,result.unit)}`);setSelectedMeasurementId(result.id);router.refresh();}catch(error:any){setMessage(error?.message||'Could not duplicate takeoff.');}finally{setBusy(false);}}
  async function nudgeSelected(dx:number,dy:number){if(!selectedMeasurementId||!selectedGeometry||locked||busy)return;const after=shiftGeometry(selectedGeometry,dx,dy);await commitGeometry('MoveMeasurementCommand',selectedMeasurementId,selectedGeometry,after,'Takeoff nudged');}

  async function undoCommitted(){const command=historyRef.current.undoCandidate();if(!command||locked||busy)return;setBusy(true);try{await updateDrawingMeasurementGeometry({measurementId:command.measurementId,takeoffSetId:takeoffSet.id,geometry:command.before});historyRef.current.confirmUndo(command.id);setHistorySnapshot(historyRef.current.snapshot());setSelectedMeasurementId(command.measurementId);setMessage(`Undid ${command.kind.replace('Command','').replace(/([A-Z])/g,' $1').trim().toLowerCase()}`);router.refresh();}catch(error:any){setMessage(error?.message||'Could not undo the committed change.');}finally{setBusy(false);}}
  async function redoCommitted(){const command=historyRef.current.redoCandidate();if(!command||locked||busy)return;setBusy(true);try{await updateDrawingMeasurementGeometry({measurementId:command.measurementId,takeoffSetId:takeoffSet.id,geometry:command.after});historyRef.current.confirmRedo(command.id);setHistorySnapshot(historyRef.current.snapshot());setSelectedMeasurementId(command.measurementId);setMessage(`Redid ${command.kind.replace('Command','').replace(/([A-Z])/g,' $1').trim().toLowerCase()}`);router.refresh();}catch(error:any){setMessage(error?.message||'Could not redo the committed change.');}finally{setBusy(false);}}

  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(isTypingTarget(event.target))return;
      if(event.code==='Space'){event.preventDefault();setSpaceHeld(true);return;}
      if(event.key==='Escape'){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setTool('select');return;}
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
      if(event.key.toLowerCase()==='m'&&!locked){if(buildPlanReady)setTool('draw');else setMessage('Verify the current build method before starting takeoff.');}
      if(event.key.toLowerCase()==='e'&&!locked&&selectedGeometry)beginEdit();
      if(event.key.toLowerCase()==='d'&&!locked&&selectedGeometry){event.preventDefault();void duplicateSelected();}
      if(event.key.toLowerCase()==='k'&&!locked&&selectedGeometry?.type==='polygon')beginCutout();
      if(event.key==='PageUp'){event.preventDefault();changePage(Math.max(1,pageNumber-1));}
      if(event.key==='PageDown'){event.preventDefault();changePage(Math.min(pdfPageCount||pageNumber,pageNumber+1));}
      if(event.key.toLowerCase()==='s'){event.preventDefault();setSnapEnabled(v=>!v);}
      if(event.key.toLowerCase()==='o'){event.preventDefault();setOrthoEnabled(v=>!v);}
    };
    const up=(event:KeyboardEvent)=>{if(event.code==='Space')setSpaceHeld(false);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
  },[draftPoints.length,calibrationPoints.length,scaleRegionPoints.length,tool,locked,finishDraft,selectedMeasurementId,selectedGeometry,renderBox,busy,zoom,setZoomAt,fitPage,pageNumber,pdfPageCount,buildPlanReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePointerDown(event:React.PointerEvent<SVGSVGElement>){
    if(tool==='pan'||event.button===1||spaceHeld){event.preventDefault();const viewport=viewportRef.current;if(!viewport)return;panRef.current={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};setPanning(true);event.currentTarget.setPointerCapture(event.pointerId);return;}
    if(locked&&tool!=='select')return;
    const raw=overlayPoint(event);if(!raw)return;
    const last=tool==='calibrate'?(calibrationPoints.at(-1)||null):tool==='scaleRegion'?(scaleRegionPoints.at(-1)||null):(draftPoints.at(-1)||null);const resolved=resolvePoint(raw,last);
    if(tool==='calibrate'){setCalibrationPoints(points=>points.length>=2?[resolved.point]:[...points,resolved.point]);return;}
    if(tool==='scaleRegion'){setScaleRegionPoints(points=>points.length>=2?[resolved.point]:[...points,resolved.point]);return;}
    if(tool==='draw'){if(!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}if(!selectedAssembly){setMessage('Choose a concrete assembly first.');return;}if(selectedAssembly.primary_measurement!=='EA'){const region=findScaleRegionForPoint(currentScaleRegions,resolved.point);if(!region){setMessage('Confirm or create a scale region covering this point.');return;}if(draftScaleRegionId&&draftScaleRegionId!==region.id){setMessage('One takeoff cannot cross between different scale regions.');return;}setDraftScaleRegionId(region.id);}setDraftPoints(points=>[...points,resolved.point]);return;}
    if(tool==='cutout'){if(selectedGeometry?.type!=='polygon'){setMessage('Select an area takeoff before adding a cutout.');setTool('select');return;}setDraftPoints(points=>[...points,resolved.point]);return;}
    if(tool==='select'){setSelectedMeasurementId(null);setEditGeometry(null);editOriginalRef.current=null;}
  }
  function handlePointerMove(event:React.PointerEvent<SVGSVGElement>){
    if(panRef.current&&panning){const viewport=viewportRef.current;if(!viewport)return;viewport.scrollLeft=panRef.current.left-(event.clientX-panRef.current.x);viewport.scrollTop=panRef.current.top-(event.clientY-panRef.current.y);return;}
    if(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout'){const raw=overlayPoint(event);if(!raw)return;const last=tool==='calibrate'?(calibrationPoints.at(-1)||null):tool==='scaleRegion'?(scaleRegionPoints.at(-1)||null):(draftPoints.at(-1)||null);const resolved=resolvePoint(raw,last);setHoverPoint(resolved.point);setHoverSnapped(resolved.snapped);}
  }
  function handlePointerUp(event:React.PointerEvent<SVGSVGElement>){if(panRef.current){panRef.current=null;setPanning(false);try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{}}}

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
  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setSelectedMeasurementId(null);setTool('select');setZoom(1);}
  function cancelTool(){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setTool('select');}

  const pageEntries=Array.from({length:pdfPageCount||initialSheets.length||1},(_,index)=>{const number=index+1;return initialSheets.find((s:any)=>Number(s.page_number)===number)||{id:`pending-${number}`,page_number:number,scale_status:'uncalibrated'};});
  const drawingTypeLabel=selectedAssembly?.primary_measurement==='SF'?'Area':selectedAssembly?.primary_measurement==='EA'?'Count':'Linear';
  const overlayClass=(tool==='pan'||spaceHeld)?(panning?styles.overlayPanning:styles.overlayPan):tool==='select'?styles.overlaySelect:'';
  const workingPoints=tool==='draw'||tool==='cutout'?draftPoints:tool==='scaleRegion'?scaleRegionPoints:calibrationPoints;
  const draftRenderPoints=hoverPoint&&(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout')?[...workingPoints,hoverPoint]:workingPoints;
  const zoomPercent=Math.round(zoom*100);
  const qualityLimited=renderQuality<.98;
  const selectedVersionRecord:any=selectedMeasurement?versionMap.get(selectedMeasurement.assembly_version_id):null;
  const selectedAssemblyRecord:any=selectedVersionRecord?assemblyMap.get(selectedVersionRecord.assembly_id):null;
  const selectedOutputs=selectedMeasurement?measurementSummaries.filter((row:any)=>row.measurement_id===selectedMeasurement.id):[];
  const selectedColor=hashColor(selectedAssemblyRecord?.code||selectedMeasurement?.id||'selected');

  return <div className={styles.workstation}>
  <div className={`${styles.workspace} ${!sheetsOpen?styles.noSheets:''} ${!inspectorOpen?styles.noInspector:''}`}>
    {sheetsOpen&&<aside className={styles.sidebar}>
      <div className={styles.panelHeader}><div><div className={styles.panelTitle}>Sheets</div><div className={styles.panelMeta}>{sourceTitle} · {pdfPageCount||'…'} pages</div></div><button type="button" className={styles.iconButton} title="Hide sheets" onClick={()=>setSheetsOpen(false)}><PanelLeftClose size={16}/></button></div>
      <div className={styles.sheetList}>{pageEntries.map((sheet:any)=>{const objects=initialMeasurements.filter((m:any)=>m.sheet_id===sheet.id).length;const regionCount=scaleRegions.filter((region:any)=>region.sheet_id===sheet.id).length;const ready=regionCount>0||sheet.scale_status==='calibrated';return <button key={sheet.page_number} type="button" className={`${styles.sheetButton} ${pageNumber===sheet.page_number?styles.sheetButtonActive:''}`} onClick={()=>changePage(sheet.page_number)}><span className={styles.pageBadge}>{sheet.sheet_number||sheet.page_number}</span><span className={styles.sheetCopy}><span className={styles.sheetName}>{sheet.title||`PDF Page ${sheet.page_number}`}</span><span className={`${styles.sheetStatus} ${ready?styles.sheetStatusReady:styles.sheetStatusHold}`}>{ready?(regionCount>1?`${regionCount} SCALE REGIONS`:'SCALE SET'):'SET SCALE'} · {objects} takeoff{objects===1?'':'s'}</span></span></button>;})}</div>
    </aside>}

    {buildPlanWorkbenchOpen&&selectedAssembly&&selectedVersion?<section className={styles.buildPlanWorkspace}>
      <div className={styles.buildPlanWorkspaceHeader}>
        <div><span>BUILD PLAN WORKBENCH</span><strong>{selectedAssembly.code} · {selectedAssembly.name}</strong><small>Verify how Carez will build this scope before returning to the drawing.</small></div>
        <button type="button" onClick={()=>setBuildPlanWorkbenchOpen(false)}>Return to Drawing</button>
      </div>
      <div className={styles.buildPlanWorkspaceBody}>
        <aside className={styles.buildPlanSteps}>
          <div className={styles.buildPlanStepActive}><b>01</b><span><strong>Plan Facts</strong><small>Requirements from the drawings.</small></span></div>
          <div><b>02</b><span><strong>Means & Methods</strong><small>How Carez will physically build it.</small></span></div>
          <div><b>03</b><span><strong>Resources</strong><small>Materials, reusable gear and equipment.</small></span></div>
          <div><b>04</b><span><strong>Production</strong><small>Estimator-reviewed labor assumptions.</small></span></div>
          <div><b>05</b><span><strong>Review & Verify</strong><small>Lock the method revision to takeoff.</small></span></div>
        </aside>
        <div className={styles.buildPlanMain}>
          <TakeoffBuildPlanPanel
            takeoffSetId={takeoffSet.id}
            assembly={selectedAssembly}
            version={selectedVersion}
            variables={variables}
            profiles={methodProfiles}
            values={variableValues}
            selectedProfileId={selectedMethodProfileId}
            locked={locked}
            onValuesChange={setVariableValues}
            onProfileChange={setSelectedMethodProfileId}
            onMessage={setMessage}
          />
        </div>
      </div>
    </section>:<section className={styles.center}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          {!sheetsOpen&&<button type="button" className={styles.toolButton} title="Show sheets" onClick={()=>setSheetsOpen(true)}><PanelLeftOpen size={16}/></button>}
          <button type="button" title="Select · V" className={`${styles.toolButton} ${tool==='select'?styles.toolButtonActive:''}`} onClick={()=>setTool('select')}><MousePointer2 size={16}/><span>Select</span></button>
          <button type="button" title="Pan · H or hold Space" className={`${styles.toolButton} ${tool==='pan'?styles.toolButtonActive:''}`} onClick={()=>setTool('pan')}><Hand size={16}/><span>Pan</span></button>
          <button type="button" disabled={locked} title="Set drawing scale · C" className={`${styles.toolButton} ${tool==='calibrate'?styles.toolButtonActive:''}`} onClick={()=>{setCalibrationPoints([]);setInspectorTab('properties');setTool('calibrate');}}><Ruler size={16}/><span>Scale</span></button>
          <button type="button" disabled={locked||!selectedAssembly||!buildPlanReady} title={buildPlanReady?'Measure · M':'Verify build method before measuring'} className={`${styles.toolButton} ${tool==='draw'?styles.toolButtonActive:styles.measureButton}`} onClick={()=>{setDraftPoints([]);setDraftScaleRegionId(null);setTool('draw');}}><Crosshair size={16}/><span>{drawingTypeLabel}</span></button>
          <button type="button" disabled={locked||!selectedGeometry} title="Edit selected shape · E" className={`${styles.toolButton} ${tool==='edit'?styles.toolButtonActive:''}`} onClick={beginEdit}><Pencil size={15}/><span>Edit</span></button>
          <button type="button" disabled={locked||selectedGeometry?.type!=='polygon'} title="Add area cutout · K" className={`${styles.toolButton} ${tool==='cutout'?styles.toolButtonActive:''}`} onClick={beginCutout}><Scissors size={15}/><span>Cutout</span></button>
        </div>

        <div className={styles.toolGroup}>
          <button type="button" className={`${styles.toolButton} ${snapEnabled?styles.toggleActive:''}`} title="Snap to existing takeoff vertices · S" onClick={()=>setSnapEnabled(v=>!v)}><Magnet size={15}/><span>Snap</span></button>
          <button type="button" className={`${styles.toolButton} ${orthoEnabled?styles.toggleActive:''}`} title="Constrain horizontal/vertical · O" onClick={()=>setOrthoEnabled(v=>!v)}><MoveHorizontal size={15}/><span>Ortho</span></button>
          <button type="button" disabled={busy||(!draftPoints.length&&!calibrationPoints.length&&!scaleRegionPoints.length&&!historySnapshot.canUndo)} className={styles.toolButton} title="Undo point or committed geometry · Ctrl/Cmd+Z" onClick={()=>{if(tool==='calibrate'&&calibrationPoints.length)setCalibrationPoints(points=>points.slice(0,-1));else if(tool==='scaleRegion'&&scaleRegionPoints.length)setScaleRegionPoints(points=>points.slice(0,-1));else if(draftPoints.length)setDraftPoints(points=>points.slice(0,-1));else void undoCommitted();}}><Undo2 size={15}/></button>
          <button type="button" disabled={busy||!historySnapshot.canRedo} className={styles.toolButton} title="Redo committed geometry · Ctrl/Cmd+Shift+Z" onClick={()=>void redoCommitted()}><Redo2 size={15}/></button>
          {tool==='scaleRegion'&&<button type="button" disabled={busy||scaleRegionPoints.length!==2} className={`${styles.toolButton} ${styles.finishButton}`} title="Save scale region · Enter" onClick={()=>void savePendingScaleRegion()}><Check size={15}/><span>Save Region</span></button>}
          {tool==='draw'&&<button type="button" disabled={busy||!draftPoints.length} className={`${styles.toolButton} ${styles.finishButton}`} title="Finish measurement · Enter or right-click" onClick={()=>void finishDraft()}><Check size={15}/><span>Finish</span></button>}
          {tool==='cutout'&&<button type="button" disabled={busy||draftPoints.length<3} className={`${styles.toolButton} ${styles.finishButton}`} title="Save cutout · Enter or right-click" onClick={()=>void finishCutout()}><Check size={15}/><span>Subtract</span></button>}
          {tool==='edit'&&<button type="button" disabled={busy||!editGeometry} className={`${styles.toolButton} ${styles.finishButton}`} title="Save shape · Enter" onClick={()=>void saveEdit()}><Check size={15}/><span>Save</span></button>}
          {(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout'||tool==='edit')&&<button type="button" className={styles.toolButton} title="Cancel active tool · Escape" onClick={cancelTool}><X size={15}/></button>}
        </div>

        <div className={styles.toolbarSpacer}/>
        {selectedAssembly&&<div className={styles.currentAssembly}><span>{selectedAssembly.code}</span><strong>{selectedAssembly.name}</strong></div>}
        <div className={styles.zoomGroup}>
          <button type="button" className={styles.iconTool} title="Zoom out" onClick={()=>setZoomAt(zoom/1.2)}><Minus size={15}/></button>
          <button type="button" className={styles.zoomLabel} title={qualityLimited?'Display zoom exceeds full-resolution render budget. Geometry remains exact.':'Zoom'} onClick={()=>setZoomAt(1)}>{zoomPercent}%{qualityLimited&&<i>HQ</i>}</button>
          <button type="button" className={styles.iconTool} title="Zoom in" onClick={()=>setZoomAt(zoom*1.2)}><Plus size={15}/></button>
          <button type="button" className={styles.iconTool} title="Fit width · 0" onClick={()=>setZoomAt(1)}><RotateCcw size={15}/></button>
          <button type="button" className={styles.iconTool} title="Fit page · 1" onClick={fitPage}><Maximize size={15}/></button>
          {!inspectorOpen&&<button type="button" className={styles.iconTool} title="Show takeoff inspector" onClick={()=>setInspectorOpen(true)}><PanelRightOpen size={16}/></button>}
        </div>
      </div>

      <div ref={viewportRef} className={styles.canvasViewport} onWheel={event=>{event.preventDefault();setZoomAt(zoom*(event.deltaY<0?1.16:1/1.16),event.clientX,event.clientY);}}>
        {!renderBox&&<div className={styles.loading}>{message}</div>}
        <div ref={paperRef} className={styles.paper} style={renderBox?{width:renderBox.width,height:renderBox.height}:{width:1,height:1}}>
          <canvas ref={canvasRef} className={styles.pdfCanvas}/>
          {renderBox&&<svg className={`${styles.overlay} ${overlayClass}`} viewBox={`0 0 ${renderBox.pdfWidth} ${renderBox.pdfHeight}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={()=>{if(!panning){setHoverPoint(null);setHoverSnapped(false);}}} onContextMenu={event=>{event.preventDefault();if(tool==='draw')void finishDraft();if(tool==='cutout')void finishCutout();}}>
            <TakeoffScaleOverlay regions={currentScaleRegions} pendingCandidate={pendingScaleCandidate} regionPoints={scaleRegionPoints} pageWidth={renderBox.pdfWidth} pageHeight={renderBox.pdfHeight}/>
            {currentMeasurements.map((measurement:any)=>{
              const stored=drawingGeometry(measurement.geometry);if(!stored)return null;const selected=selectedMeasurementId===measurement.id;const geometry=selected&&tool==='edit'&&editGeometry?editGeometry:stored;const points=geometry.points;const version:any=versionMap.get(measurement.assembly_version_id);const assembly:any=version?assemblyMap.get(version.assembly_id):null;const style=resolveDisplayStyle(assembly?.display_style,hashColor(assembly?.code||measurement.assembly_version_id||measurement.id));const color=style.color;const coords=points.map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ');const scaleRegion=scaleRegionMap.get(measurement.scale_region_id);const measurementCalibration=scaleRegion?.calibration||currentSheet?.calibration;const physical=physicalFootprint(points,version,measurement.variables,measurementCalibration,renderBox,measurement.geometry_anchor,measurement.geometry_offset_in);const physicalCoords=physical.map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ');const first=points[0];const onSelect=(event:React.MouseEvent)=>{if(tool==='select'){event.stopPropagation();setSelectedMeasurementId(measurement.id);setEditGeometry(null);editOriginalRef.current=null;setInspectorTab('properties');}};
              return <g key={measurement.id} onClick={onSelect} style={{cursor:tool==='select'?'pointer':undefined}}>
                {geometry.type==='polygon'&&<path d={geometryPath(geometry,renderBox.pdfWidth,renderBox.pdfHeight)} fill={`${color}24`} fillRule="evenodd" stroke={color} strokeWidth={selected?3.2:2} vectorEffect="non-scaling-stroke"/>}
                {physical.length>=3&&<polygon points={physicalCoords} fill={`${style.color}${Math.round(style.opacity*255).toString(16).padStart(2,'0')}`} stroke={style.borderColor} strokeWidth={selected?style.borderWidth+1:style.borderWidth} strokeDasharray={style.pattern==='dashed'?'6 4':undefined} vectorEffect="non-scaling-stroke"/>}{geometry.type==='polyline'&&<polyline points={coords} fill="none" stroke={color} strokeWidth={selected?4:2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
                {geometry.type==='count'&&points.map((point,index)=><g key={index}><circle cx={point.x*renderBox.pdfWidth} cy={point.y*renderBox.pdfHeight} r={selected?6:5} fill={`${color}45`} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/><line x1={point.x*renderBox.pdfWidth-5} y1={point.y*renderBox.pdfHeight} x2={point.x*renderBox.pdfWidth+5} y2={point.y*renderBox.pdfHeight} stroke={color} vectorEffect="non-scaling-stroke"/><line x1={point.x*renderBox.pdfWidth} y1={point.y*renderBox.pdfHeight-5} x2={point.x*renderBox.pdfWidth} y2={point.y*renderBox.pdfHeight+5} stroke={color} vectorEffect="non-scaling-stroke"/></g>)}
                {zoom<5&&<g transform={`translate(${first.x*renderBox.pdfWidth} ${first.y*renderBox.pdfHeight})`}><rect x="5" y="-18" width={Math.max(76,Math.min(205,measurement.name.length*6+64))} height="20" rx="4" fill="rgba(7,12,18,.9)" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke"/><text x="10" y="-4" fill="#f5f7fa" fontSize="9" fontWeight="700">{measurement.name} · {formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}</text></g>}
              </g>;
            })}

            {tool==='edit'&&editGeometry&&selectedMeasurement&&<TakeoffVertexEditor geometry={editGeometry} pageWidth={renderBox.pdfWidth} pageHeight={renderBox.pdfHeight} color={selectedColor} onChange={setEditGeometry}/>}

            {tool==='draw'&&draftRenderPoints.length>0&&<g pointerEvents="none">
              {selectedAssembly?.primary_measurement==='SF'&&draftRenderPoints.length>=2&&<polygon points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(105,143,237,.13)" stroke="#6f95ee" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
              {selectedAssembly?.primary_measurement==='LF'&&draftRenderPoints.length>=2&&<><polygon points={physicalFootprint(draftRenderPoints,selectedVersion,variableValues,draftCalibration,renderBox).map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(111,149,238,.22)" stroke="#6f95ee" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><polyline points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="none" stroke="#6f95ee" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/></>}
              {draftPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="4" fill="#7fa0f3" stroke="#07101a" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
            </g>}
            {tool==='cutout'&&draftRenderPoints.length>0&&<g pointerEvents="none">
              {draftRenderPoints.length>=2&&<polygon points={draftRenderPoints.map(point=>`${point.x*renderBox.pdfWidth},${point.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(228,177,93,.16)" stroke="#e4b15d" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
              {draftPoints.map((point,index)=><circle key={index} cx={point.x*renderBox.pdfWidth} cy={point.y*renderBox.pdfHeight} r="4" fill="#e4b15d" stroke="#07101a" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
            </g>}
            {tool==='calibrate'&&draftRenderPoints.length>0&&<g pointerEvents="none">{draftRenderPoints.length>=2&&<line x1={draftRenderPoints[0].x*renderBox.pdfWidth} y1={draftRenderPoints[0].y*renderBox.pdfHeight} x2={draftRenderPoints[1].x*renderBox.pdfWidth} y2={draftRenderPoints[1].y*renderBox.pdfHeight} stroke="#e5b55e" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}{calibrationPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="5" fill="#e5b55e" stroke="#07101a" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</g>}
            {hoverPoint&&(tool==='draw'||tool==='calibrate'||tool==='scaleRegion'||tool==='cutout')&&<g pointerEvents="none" transform={`translate(${hoverPoint.x*renderBox.pdfWidth} ${hoverPoint.y*renderBox.pdfHeight})`}><circle r={hoverSnapped?7:4.5} fill="none" stroke={hoverSnapped?'#69d39a':tool==='cutout'?'#e4b15d':'#91a8e8'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><line x1="-12" x2="12" y1="0" y2="0" stroke={hoverSnapped?'#69d39a':tool==='cutout'?'#e4b15d':'#91a8e8'} strokeWidth="1" vectorEffect="non-scaling-stroke"/><line y1="-12" y2="12" x1="0" x2="0" stroke={hoverSnapped?'#69d39a':tool==='cutout'?'#e4b15d':'#91a8e8'} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}
          </svg>}
        </div>
        {preview&&<div className={`${styles.liveReadout} ${tool==='cutout'?styles.cutoutReadout:''}`}><strong>{formatTakeoffMeasurement(preview.quantity,preview.unit)}</strong>{tool==='cutout'&&Number(preview.cutoutQuantity||0)>0?<span>net · {qty(preview.cutoutQuantity)} SF excluded</span>:preview.perimeterLf>0&&<span>{formatArchitecturalLength(preview.perimeterLf)} perimeter</span>}</div>}
      </div>

      <div className={styles.statusbar}><span><strong>Page {pageNumber}</strong> / {pdfPageCount||'…'}</span><span className={currentScale?styles.statusOk:styles.statusHold}>{currentScale?`${currentScaleRegions.length||1} scale${(currentScaleRegions.length||1)===1?'':'s'} set`:'Scale required'}</span><span>{snapEnabled?'Snap on':'Snap off'} · {orthoEnabled?'Ortho on':'Ortho off'}</span><span className={styles.statusHint}>{tool==='draw'?'Click points · Enter/right-click to finish':tool==='scaleRegion'?'Pick two opposite region corners · Enter to save':tool==='cutout'?'Trace opening · Enter/right-click to subtract':tool==='edit'?'Drag vertices · Enter to save':'Wheel zoom · Space/middle mouse pan · Arrows nudge selection'}</span><span className={styles.statusMessage}>{message}</span></div>
    </section>}

    {inspectorOpen&&<aside className={styles.inspector}>
      <div className={styles.panelHeader}><div><div className={styles.panelTitle}>Inspector</div><div className={styles.panelMeta}>{currentSheet?`${currentSheet.sheet_number||`Page ${currentSheet.page_number}`} · ${currentMeasurements.length} takeoff${currentMeasurements.length===1?'':'s'}`:'Preparing sheet'}</div></div><button type="button" className={styles.iconButton} title="Hide inspector" onClick={()=>setInspectorOpen(false)}><PanelRightClose size={16}/></button></div>
      <div className={styles.inspectorTabs} role="tablist" aria-label="Takeoff inspector">
        <button type="button" role="tab" aria-selected={inspectorTab==='takeoffs'} className={inspectorTab==='takeoffs'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('takeoffs')}>Takeoffs</button>
        <button type="button" role="tab" aria-selected={inspectorTab==='properties'} className={inspectorTab==='properties'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('properties')}>Properties</button>
        <button type="button" role="tab" aria-selected={inspectorTab==='buildPlan'} className={inspectorTab==='buildPlan'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('buildPlan')}>Build Plan{buildPlanRequired&&!buildPlanReady?<i/>:null}</button>
      </div>
      <div className={styles.inspectorBody}>
        {inspectorTab==='takeoffs'&&<>
          <div className={styles.group}>
            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Assembly</div><div className={styles.groupHelp}>Choose what you are measuring. One takeoff drives its resource recipe.</div></div></div>
            <label className={styles.searchField}><Search size={14}/><input value={assemblySearch} onChange={e=>setAssemblySearch(e.target.value)} placeholder="Find footing, wall, slab, curb…"/></label>
            <div className={styles.assemblyList}>{filteredAssemblies.length?filteredAssemblies.map((assembly:any)=>{const active=assembly.id===selectedAssemblyId;return <button key={assembly.id} type="button" disabled={locked} className={`${styles.assemblyCard} ${active?styles.assemblyCardActive:''}`} onClick={()=>{setSelectedAssemblyId(assembly.id);setSelectedMeasurementId(null);setTool('select');}}><span className={styles.assemblyUnit}>{assembly.primary_measurement}</span><span><strong>{assembly.name}</strong><small>{assembly.code}{assembly.category?` · ${assembly.category}`:''}</small></span></button>;}):<div className={styles.emptySmall}>No concrete assembly matches that search.</div>}</div>
            {selectedVersion&&<div className={styles.assemblySource}>V{selectedVersion.version_no} · {selectedVersion.source_label||'Carez assembly'}{selectedVersion.source_reference&&<span>{selectedVersion.source_reference}</span>}</div>}
          </div>

          <div className={styles.group}><div className={styles.groupTitle}>This Sheet</div>{currentMeasurements.length?<div className={styles.objectList}>{currentMeasurements.map((measurement:any)=>{const version:any=versionMap.get(measurement.assembly_version_id);const assembly:any=version?assemblyMap.get(version.assembly_id):null;const summary=summaryMap.get(measurement.id);const geometry=drawingGeometry(measurement.geometry);return <button type="button" key={measurement.id} className={`${styles.objectButton} ${selectedMeasurementId===measurement.id?styles.objectSelected:''}`} onClick={()=>{setSelectedMeasurementId(measurement.id);setEditGeometry(null);editOriginalRef.current=null;setTool('select');setInspectorTab('properties');}}><span className={styles.objectColor} style={{background:hashColor(assembly?.code||measurement.id)}}/><span><strong>{measurement.name}</strong><small>{assembly?.name||'Assembly'} · {formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}{geometry?.holes?.length?` · ${geometry.holes.length} cutout${geometry.holes.length===1?'':'s'}`:''}</small></span>{summary?.missing?<b className={styles.objectWarn}>!</b>:null}</button>;})}</div>:<div className={styles.emptySmall}>No takeoff on this sheet yet.</div>}</div>

          {selectedAssembly&&<div className={styles.inspectorActionStrip}>
            <div><span>ACTIVE ASSEMBLY</span><strong>{selectedAssembly.code} · {selectedAssembly.name}</strong><small>{buildPlanReady?'Build method ready':'Build Plan verification required'}</small></div>
            <button type="button" onClick={()=>setInspectorTab(buildPlanReady?'properties':'buildPlan')}>{buildPlanReady?'Properties':'Build Plan'}</button>
          </div>}
        </>}

        {inspectorTab==='properties'&&<>
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
            {selectedSummary&&<div className={styles.selectedStats}><span><b>{qty(selectedSummary.mh)}</b> MH</span><span><b>{money(selectedSummary.cost)}</b> direct</span></div>}
            {selectedSummary?.inputHolds?<div className={styles.statusWarn}>{selectedSummary.inputHolds} generated line{selectedSummary.inputHolds===1?'':'s'} waiting on assembly input. Geometry and unaffected quantities are saved.</div>:null}
            {selectedSummary?.priceHolds?<div className={styles.statusWarn}>{selectedSummary.priceHolds} generated line{selectedSummary.priceHolds===1?'':'s'} still need pricing or a labor rate.</div>:null}
            {selectedVersionRecord&&selectedAssemblyRecord&&<TakeoffAssemblyInputEditor measurement={selectedMeasurement} version={selectedVersionRecord} assembly={selectedAssemblyRecord} variables={variables} outputs={selectedOutputs} takeoffSetId={takeoffSet.id} locked={locked} onMessage={setMessage}/>} 
            {!locked&&<div className={styles.proActionGrid}>{tool==='edit'?<><button type="button" className={styles.primary} disabled={busy} onClick={()=>void saveEdit()}><Check size={14}/> Save Shape</button><button type="button" className={styles.secondary} onClick={cancelTool}><X size={14}/> Cancel</button></>:<><button type="button" className={styles.secondary} onClick={beginEdit}><Pencil size={14}/> Edit Shape</button><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void duplicateSelected()}><Copy size={14}/> Duplicate</button>{selectedGeometry?.type==='polygon'&&<button type="button" className={styles.secondary} onClick={beginCutout}><Scissors size={14}/> Add Cutout</button>}{selectedCutoutCount>0&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void removeLastCutout()}><Undo2 size={14}/> Remove Last</button>}</>}</div>}
            {tool==='cutout'&&preview&&<div className={`${styles.previewCard} ${styles.cutoutPreview}`}><span>Net concrete</span><strong>{qty(preview.quantity)} SF</strong><small>{qty(preview.cutoutQuantity||0)} SF total excluded</small><button type="button" disabled={busy||draftPoints.length<3} onClick={()=>void finishCutout()}><Scissors size={15}/> Save cutout</button></div>}
            {!locked&&<button type="button" className={styles.danger} disabled={busy} onClick={()=>void removeSelected()}><Trash2 size={14}/> Delete takeoff</button>}
          </div>:selectedAssembly?<div className={styles.group}>
            <div className={styles.groupTitle}>New Takeoff Properties</div>
            <div className={styles.propertyAssembly}><span>Assembly</span><strong>{selectedAssembly.code}</strong><small>{selectedAssembly.name}</small></div>
            <label className={styles.field}><span>Name <em>optional</em></span><input value={objectName} disabled={locked} onChange={e=>setObjectName(e.target.value)} placeholder={`Auto: ${selectedAssembly.name} 1`}/></label>
            <label className={styles.field}><span>Location / zone <em>optional</em></span><input value={location} disabled={locked} onChange={e=>setLocation(e.target.value)} placeholder="Garage · North wall · Area A"/></label>
            {selectedVariables.length>0&&<div className={styles.variableGrid}>{selectedVariables.filter((variable:any)=>(!hasBuilderModel||(variable.input_role||'legacy')==='legacy')&&!(variable.variable_key==='perimeter_lf'&&selectedAssembly.primary_measurement==='SF')&&isAssemblyVariableActive(variable,variableValues)).map((variable:any)=><label className={styles.field} key={variable.id}><span>{variable.label}{variable.required?' *':''}</span>{variable.value_type==='boolean'?<label className={styles.checkRow}><input type="checkbox" checked={variableValues[variable.variable_key]==='true'} disabled={locked} onChange={e=>setVariableValues(values=>({...values,[variable.variable_key]:e.target.checked?'true':'false'}))}/><span>Enabled</span></label>:variable.value_type==='enum'?<select value={variableValues[variable.variable_key]??''} disabled={locked} onChange={e=>setVariableValues(values=>({...values,[variable.variable_key]:e.target.value}))}><option value="">Select…</option>{enumOptions(variable.options).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<div className={styles.inputUnit}><input type={['number','dimension','percentage'].includes(variable.value_type)?'number':'text'} step="any" min={variable.min_value??undefined} max={variable.max_value??undefined} value={variableValues[variable.variable_key]??''} disabled={locked} onChange={e=>setVariableValues(values=>({...values,[variable.variable_key]:e.target.value}))}/>{variable.unit&&<b>{variable.unit}</b>}</div>}{variable.help_text&&<small>{variable.help_text}</small>}</label>)}</div>}
            <label className={styles.checkRow}><input type="checkbox" checked={repeatMode} onChange={e=>setRepeatMode(e.target.checked)}/><Repeat2 size={14}/><span>Keep assembly active after saving</span></label>
            <details className={styles.advanced}><summary>Advanced job coding</summary><div className={styles.advancedBody}><label className={styles.field}><span>Estimate scope area</span><select value={sectionId} disabled={locked} onChange={e=>setSectionId(e.target.value)}><option value="">Automatic / unassigned</option>{sections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className={styles.field}><span>L&I phase</span><select value={riskClassCode} disabled={locked} onChange={e=>setRiskClassCode(e.target.value)}><option value="">Assembly default</option>{riskClasses.map((r:any)=><option key={`${r.code}-${r.tax_year}`} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className={styles.field}><span>Drawing reference</span><input value={drawingReference} disabled={locked} onChange={e=>setDrawingReference(e.target.value)} placeholder="Automatic from current sheet"/></label></div></details>
            {!locked&&<button type="button" className={styles.measurePrimary} disabled={!selectedAssembly||!buildPlanReady} onClick={()=>{setDraftPoints([]);setDraftScaleRegionId(null);setTool('draw');}}><Crosshair size={16}/> {buildPlanReady?`Start ${drawingTypeLabel} Takeoff`:'Verify Build Plan to Start'}</button>}
          </div>:<div className={styles.emptySmall}>Choose a concrete assembly in Takeoffs.</div>}

          <details className={styles.shortcuts}><summary>Keyboard & mouse shortcuts</summary><div className={styles.shortcutGrid}><kbd>Wheel</kbd><span>Zoom at cursor</span><kbd>Space</kbd><span>Temporary pan</span><kbd>M</kbd><span>Measure</span><kbd>E</kbd><span>Edit selected shape</span><kbd>D</kbd><span>Duplicate selected</span><kbd>K</kbd><span>Add area cutout</span><kbd>Arrows</kbd><span>Nudge selected · Shift × 10</span><kbd>Ctrl Z</kbd><span>Undo committed geometry</span><kbd>Ctrl ⇧ Z</kbd><span>Redo committed geometry</span><kbd>PgUp/Dn</kbd><span>Previous / next sheet</span><kbd>S / O</kbd><span>Snap / ortho</span><kbd>Enter</kbd><span>Finish or save</span><kbd>Esc</kbd><span>Cancel tool</span></div></details>
        </>}

        {inspectorTab==='buildPlan'&&<>
          {selectedAssembly&&selectedVersion?<div className={styles.buildPlanCompact}>
            <div className={styles.buildPlanCompactHead}><div><span>BUILD PLAN</span><strong>{selectedAssembly.code} · {selectedAssembly.name}</strong></div><b className={buildPlanReady?styles.methodVerified:styles.methodPending}>{buildPlanReady?'VERIFIED':'NEEDS VERIFICATION'}</b></div>
            <div className={styles.methodProfileSummary}><span>Job method</span><strong>{selectedMethodProfile?`R${selectedMethodProfile.revision_no} · ${selectedMethodProfile.name}`:'No verified method selected'}</strong></div>
            <div className={styles.methodSummaryGrid}>
              {selectedVariables.filter((variable:any)=>isAssemblyVariableActive(variable,variableValues)&&['plan_fact','method_decision','production_assumption','commercial_assumption'].includes(variable.input_role)).slice(0,8).map((variable:any)=>{const raw=variableValues[variable.variable_key]??'';const display=variable.value_type==='enum'?(enumOptions(variable.options).find(option=>option.value===raw)?.label||raw):`${raw}${raw&&variable.unit?` ${variable.unit}`:''}`;return <span key={variable.id}><small>{variable.label}</small><b>{display||'—'}</b></span>;})}
            </div>
            {buildPlanRequired&&!buildPlanReady&&<div className={styles.buildPlanWarning}>Current means-and-method assumptions must be verified before measurement tools can start.</div>}
            <button type="button" className={styles.reviewBuildPlan} onClick={()=>setBuildPlanWorkbenchOpen(true)}>{buildPlanReady?'Review / Edit Build Plan':'Complete Build Plan'}</button>
          </div>:<div className={styles.emptySmall}>Choose an assembly before configuring its Build Plan.</div>}
        </>}
      </div>
    </aside>}
  </div>
  <TakeoffQuantityDock
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
      setSelectedMeasurementId(measurement.id);setTool('select');setInspectorOpen(true);setInspectorTab('properties');
    }}
  />
  </div>;
}
