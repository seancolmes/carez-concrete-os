'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {
  Check,Crosshair,Hand,Magnet,Maximize,Minus,MousePointer2,MoveHorizontal,PanelLeftClose,
  PanelLeftOpen,PanelRightClose,PanelRightOpen,Plus,Repeat2,RotateCcw,Ruler,Search,Trash2,
  Undo2,X
} from 'lucide-react';
import {createDrawingMeasurement,deleteDrawingMeasurement,initializeTakeoffSheets,saveSheetCalibration} from '@/app/takeoff/[setId]/actions';
import {measureDrawingGeometry,roundMeasurement,type DrawingGeometry,type NormalizedPoint} from '@/lib/takeoff/geometry';
import styles from './TakeoffDrawingWorkspace.module.css';

type Tool='select'|'pan'|'calibrate'|'draw';
type Props={
  takeoffSet:any;
  estimate:any;
  pdfUrl:string;
  sourceTitle:string;
  initialSheets:any[];
  initialMeasurements:any[];
  measurementSummaries:any[];
  assemblies:any[];
  versions:any[];
  variables:any[];
  sections:any[];
  riskClasses:any[];
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
function geometryPoints(geometry:any):NormalizedPoint[]{if(!geometry||!Array.isArray(geometry.points))return[];return geometry.points.filter((p:any)=>Number.isFinite(Number(p?.x))&&Number.isFinite(Number(p?.y))).map((p:any)=>({x:Number(p.x),y:Number(p.y)}));}
function isTypingTarget(target:EventTarget|null){const el=target as HTMLElement|null;return Boolean(el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName));}
function clampZoom(value:number){return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,value));}

export function TakeoffDrawingWorkspace(props:Props){
  const {takeoffSet,pdfUrl,sourceTitle,initialSheets,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,riskClasses,locked}=props;
  const router=useRouter();
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const viewportRef=useRef<HTMLDivElement|null>(null);
  const paperRef=useRef<HTMLDivElement|null>(null);
  const pdfRef=useRef<any>(null);
  const renderTaskRef=useRef<any>(null);
  const panRef=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const initializingRef=useRef(false);
  const zoomAnchorRef=useRef<ZoomAnchor|null>(null);

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
  const [selectedMeasurementId,setSelectedMeasurementId]=useState<string|null>(null);
  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>(assemblies[0]?.id||'');
  const [assemblySearch,setAssemblySearch]=useState('');
  const [objectName,setObjectName]=useState('');
  const [sectionId,setSectionId]=useState('');
  const [riskClassCode,setRiskClassCode]=useState('');
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

  const latestVersionByAssembly=useMemo(()=>{const map=new Map<string,any>();for(const version of versions)if(!map.has(version.assembly_id))map.set(version.assembly_id,version);return map;},[versions]);
  const assemblyMap=useMemo(()=>new Map<string,any>(assemblies.map((a:any)=>[a.id,a])),[assemblies]);
  const versionMap=useMemo(()=>new Map<string,any>(versions.map((v:any)=>[v.id,v])),[versions]);
  const selectedAssembly:any=assemblyMap.get(selectedAssemblyId);
  const selectedVersion:any=selectedAssembly?latestVersionByAssembly.get(selectedAssembly.id):null;
  const selectedVariables=useMemo(()=>selectedVersion?variables.filter((v:any)=>v.assembly_version_id===selectedVersion.id):[],[selectedVersion,variables]);
  const currentSheet=useMemo(()=>initialSheets.find((s:any)=>Number(s.page_number)===pageNumber)||null,[initialSheets,pageNumber]);
  const currentMeasurements=useMemo(()=>initialMeasurements.filter((m:any)=>m.sheet_id===currentSheet?.id),[initialMeasurements,currentSheet]);
  const currentScale=currentSheet?.scale_status==='calibrated';
  const selectedMeasurement=initialMeasurements.find((m:any)=>m.id===selectedMeasurementId)||null;

  const summaryMap=useMemo(()=>{
    const map=new Map<string,{mh:number;cost:number;missing:number}>();
    for(const row of measurementSummaries){const prior=map.get(row.measurement_id)||{mh:0,cost:0,missing:0};prior.mh+=Number(row.estimated_man_hours||0);prior.cost+=Number(row.direct_cost||0);if(['missing_price','missing_labor_rate'].includes(row.pricing_status))prior.missing+=1;map.set(row.measurement_id,prior);}
    return map;
  },[measurementSummaries]);
  const selectedSummary=selectedMeasurement?summaryMap.get(selectedMeasurement.id):null;

  const filteredAssemblies=useMemo(()=>{
    const q=assemblySearch.trim().toLowerCase();
    if(!q)return assemblies;
    return assemblies.filter((a:any)=>[a.code,a.name,a.category,a.description].some(v=>String(v||'').toLowerCase().includes(q)));
  },[assemblies,assemblySearch]);

  useEffect(()=>{
    if(!selectedVersion)return;
    const next:Record<string,string>={};
    for(const variable of selectedVariables){if(variable.variable_key==='perimeter_lf'&&selectedAssembly?.primary_measurement==='SF')continue;next[variable.variable_key]=variable.default_value===null||variable.default_value===undefined?'':String(variable.default_value);}
    setVariableValues(next);
    setRiskClassCode(selectedVersion.default_risk_class_code||'');
    setObjectName('');
    setDraftPoints([]);
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
    if(snapEnabled){for(const measurement of currentMeasurements)candidates.push(...geometryPoints(measurement.geometry));candidates.push(...draftPoints,...calibrationPoints);}
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

  const preview=useMemo(()=>{
    if(!renderBox||!selectedAssembly||!currentSheet||!draftPoints.length)return null;
    const type=selectedAssembly.primary_measurement==='SF'?'polygon':selectedAssembly.primary_measurement==='EA'?'count':'polyline';
    const required=type==='polygon'?3:type==='polyline'?2:1;if(draftPoints.length<required)return null;
    try{const measured=measureDrawingGeometry({type,points:draftPoints} as DrawingGeometry,renderBox.pdfWidth,renderBox.pdfHeight,currentSheet.calibration);return{...measured,quantity:roundMeasurement(measured.quantity),perimeterLf:roundMeasurement(measured.perimeterLf)};}catch{return type==='count'?{quantity:draftPoints.length,unit:'EA',perimeterLf:0}:null;}
  },[draftPoints,renderBox,selectedAssembly,currentSheet]);

  const finishDraft=useCallback(async()=>{
    if(locked||busy||!selectedAssembly||!selectedVersion||!currentSheet||!renderBox)return;
    const geometryType:DrawingGeometry['type']=selectedAssembly.primary_measurement==='SF'?'polygon':selectedAssembly.primary_measurement==='EA'?'count':'polyline';
    const minimum=geometryType==='polygon'?3:geometryType==='polyline'?2:1;
    if(draftPoints.length<minimum){setMessage(`${selectedAssembly.primary_measurement} takeoff needs at least ${minimum} point${minimum===1?'':'s'}.`);return;}
    if(geometryType!=='count'&&!currentScale){setMessage('Set the sheet scale before measuring length or area.');return;}
    const sameAssemblyCount=currentMeasurements.filter((m:any)=>m.assembly_version_id===selectedVersion.id).length;
    const autoName=`${selectedAssembly.name}${location.trim()?` — ${location.trim()}`:''} ${sameAssemblyCount+1}`;
    const finalName=objectName.trim()||autoName;
    setBusy(true);
    try{
      const result=await createDrawingMeasurement({takeoffSetId:takeoffSet.id,sheetId:currentSheet.id,estimateSectionId:sectionId||null,assemblyVersionId:selectedVersion.id,name:finalName,location:location.trim()||null,drawingReference:drawingReference.trim()||null,riskClassCode:riskClassCode||null,variables:variableValues,geometry:{type:geometryType,points:draftPoints}});
      setMessage(`Saved ${finalName} · ${qty(result.quantity)} ${result.unit}${result.perimeterLf?` · ${qty(result.perimeterLf)} LF perimeter`:''}`);
      setDraftPoints([]);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);setTool(repeatMode?'draw':'select');router.refresh();
    }catch(error:any){setMessage(error?.message||'Could not save drawing measurement.');}finally{setBusy(false);}
  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,currentScale,currentMeasurements,location,objectName,takeoffSet.id,sectionId,drawingReference,riskClassCode,variableValues,repeatMode,router]);

  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(isTypingTarget(event.target))return;
      if(event.code==='Space'){event.preventDefault();setSpaceHeld(true);return;}
      if(event.key==='Escape'){setDraftPoints([]);setCalibrationPoints([]);setHoverPoint(null);setTool('select');return;}
      if(event.key==='Backspace'||(event.ctrlKey&&event.key.toLowerCase()==='z')){if(draftPoints.length){event.preventDefault();setDraftPoints(points=>points.slice(0,-1));}else if(calibrationPoints.length){event.preventDefault();setCalibrationPoints(points=>points.slice(0,-1));}return;}
      if((event.key==='Delete'||event.key==='Backspace')&&selectedMeasurementId&&!locked){event.preventDefault();void removeSelected();return;}
      if(event.key==='Enter'&&tool==='draw'){event.preventDefault();void finishDraft();return;}
      if(event.key==='+'||event.key==='='){event.preventDefault();setZoomAt(zoom*1.2);return;}
      if(event.key==='-'){event.preventDefault();setZoomAt(zoom/1.2);return;}
      if(event.key==='0'){event.preventDefault();setZoomAt(1);return;}
      if(event.key==='1'){event.preventDefault();fitPage();return;}
      if(event.key.toLowerCase()==='v')setTool('select');
      if(event.key.toLowerCase()==='h')setTool('pan');
      if(event.key.toLowerCase()==='c'&&!locked){setCalibrationPoints([]);setTool('calibrate');}
      if(event.key.toLowerCase()==='m'&&!locked)setTool('draw');
      if(event.key.toLowerCase()==='s'){event.preventDefault();setSnapEnabled(v=>!v);}
      if(event.key.toLowerCase()==='o'){event.preventDefault();setOrthoEnabled(v=>!v);}
    };
    const up=(event:KeyboardEvent)=>{if(event.code==='Space')setSpaceHeld(false);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
  },[draftPoints.length,calibrationPoints.length,tool,locked,finishDraft,selectedMeasurementId,zoom,setZoomAt,fitPage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePointerDown(event:React.PointerEvent<SVGSVGElement>){
    if(tool==='pan'||event.button===1||spaceHeld){event.preventDefault();const viewport=viewportRef.current;if(!viewport)return;panRef.current={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};setPanning(true);event.currentTarget.setPointerCapture(event.pointerId);return;}
    if(locked&&tool!=='select')return;
    const raw=overlayPoint(event);if(!raw)return;
    const last=tool==='calibrate'?(calibrationPoints.at(-1)||null):(draftPoints.at(-1)||null);const resolved=resolvePoint(raw,last);
    if(tool==='calibrate'){setCalibrationPoints(points=>points.length>=2?[resolved.point]:[...points,resolved.point]);return;}
    if(tool==='draw'){if(!selectedAssembly){setMessage('Choose a concrete assembly first.');return;}if(selectedAssembly.primary_measurement!=='EA'&&!currentScale){setMessage('Set the sheet scale before measuring LF or SF.');return;}setDraftPoints(points=>[...points,resolved.point]);return;}
    if(tool==='select')setSelectedMeasurementId(null);
  }
  function handlePointerMove(event:React.PointerEvent<SVGSVGElement>){
    if(panRef.current&&panning){const viewport=viewportRef.current;if(!viewport)return;viewport.scrollLeft=panRef.current.left-(event.clientX-panRef.current.x);viewport.scrollTop=panRef.current.top-(event.clientY-panRef.current.y);return;}
    if(tool==='draw'||tool==='calibrate'){const raw=overlayPoint(event);if(!raw)return;const last=tool==='calibrate'?(calibrationPoints.at(-1)||null):(draftPoints.at(-1)||null);const resolved=resolvePoint(raw,last);setHoverPoint(resolved.point);setHoverSnapped(resolved.snapped);}
  }
  function handlePointerUp(event:React.PointerEvent<SVGSVGElement>){if(panRef.current){panRef.current=null;setPanning(false);try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{}}}

  async function saveCalibration(){
    if(locked||busy||!currentSheet||!renderBox)return;if(calibrationPoints.length!==2){setMessage('Pick two endpoints of a known dimension.');return;}const known=Number(knownDistanceFt);if(!(known>0)){setMessage('Enter the known distance in feet.');return;}
    setBusy(true);try{await saveSheetCalibration({sheetId:currentSheet.id,pageWidth:renderBox.pdfWidth,pageHeight:renderBox.pdfHeight,points:calibrationPoints,knownDistanceFt:known});setCalibrationPoints([]);setHoverPoint(null);setTool('select');setMessage(`Scale saved from ${qty(known)} FT known dimension`);router.refresh();}catch(error:any){setMessage(error?.message||'Could not save sheet scale.');}finally{setBusy(false);}
  }
  async function removeSelected(){
    if(!selectedMeasurementId||locked||busy)return;setBusy(true);try{await deleteDrawingMeasurement(selectedMeasurementId,takeoffSet.id);setMessage('Takeoff object and generated estimate lines removed');setSelectedMeasurementId(null);router.refresh();}catch(error:any){setMessage(error?.message||'Could not delete object.');}finally{setBusy(false);}
  }
  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setCalibrationPoints([]);setHoverPoint(null);setSelectedMeasurementId(null);setTool('select');setZoom(1);}
  function cancelTool(){setDraftPoints([]);setCalibrationPoints([]);setHoverPoint(null);setTool('select');}

  const pageEntries=Array.from({length:pdfPageCount||initialSheets.length||1},(_,index)=>{const number=index+1;return initialSheets.find((s:any)=>Number(s.page_number)===number)||{id:`pending-${number}`,page_number:number,scale_status:'uncalibrated'};});
  const drawingTypeLabel=selectedAssembly?.primary_measurement==='SF'?'Area':selectedAssembly?.primary_measurement==='EA'?'Count':'Linear';
  const overlayClass=(tool==='pan'||spaceHeld)?(panning?styles.overlayPanning:styles.overlayPan):tool==='select'?styles.overlaySelect:'';
  const workingPoints=tool==='draw'?draftPoints:calibrationPoints;
  const draftRenderPoints=hoverPoint&&(tool==='draw'||tool==='calibrate')?[...workingPoints,hoverPoint]:workingPoints;
  const zoomPercent=Math.round(zoom*100);
  const qualityLimited=renderQuality<.98;

  return <div className={`${styles.workspace} ${!sheetsOpen?styles.noSheets:''} ${!inspectorOpen?styles.noInspector:''}`}>
    {sheetsOpen&&<aside className={styles.sidebar}>
      <div className={styles.panelHeader}><div><div className={styles.panelTitle}>Sheets</div><div className={styles.panelMeta}>{sourceTitle} · {pdfPageCount||'…'} pages</div></div><button type="button" className={styles.iconButton} title="Hide sheets" onClick={()=>setSheetsOpen(false)}><PanelLeftClose size={16}/></button></div>
      <div className={styles.sheetList}>{pageEntries.map((sheet:any)=>{const objects=initialMeasurements.filter((m:any)=>m.sheet_id===sheet.id).length;return <button key={sheet.page_number} type="button" className={`${styles.sheetButton} ${pageNumber===sheet.page_number?styles.sheetButtonActive:''}`} onClick={()=>changePage(sheet.page_number)}><span className={styles.pageBadge}>{sheet.sheet_number||sheet.page_number}</span><span className={styles.sheetCopy}><span className={styles.sheetName}>{sheet.title||`PDF Page ${sheet.page_number}`}</span><span className={`${styles.sheetStatus} ${sheet.scale_status==='calibrated'?styles.sheetStatusReady:styles.sheetStatusHold}`}>{sheet.scale_status==='calibrated'?'SCALE SET':'SET SCALE'} · {objects} takeoff{objects===1?'':'s'}</span></span></button>;})}</div>
    </aside>}

    <section className={styles.center}>
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          {!sheetsOpen&&<button type="button" className={styles.toolButton} title="Show sheets" onClick={()=>setSheetsOpen(true)}><PanelLeftOpen size={16}/></button>}
          <button type="button" title="Select · V" className={`${styles.toolButton} ${tool==='select'?styles.toolButtonActive:''}`} onClick={()=>setTool('select')}><MousePointer2 size={16}/><span>Select</span></button>
          <button type="button" title="Pan · H or hold Space" className={`${styles.toolButton} ${tool==='pan'?styles.toolButtonActive:''}`} onClick={()=>setTool('pan')}><Hand size={16}/><span>Pan</span></button>
          <button type="button" disabled={locked} title="Set drawing scale · C" className={`${styles.toolButton} ${tool==='calibrate'?styles.toolButtonActive:''}`} onClick={()=>{setCalibrationPoints([]);setTool('calibrate');}}><Ruler size={16}/><span>Scale</span></button>
          <button type="button" disabled={locked||!selectedAssembly} title="Measure · M" className={`${styles.toolButton} ${tool==='draw'?styles.toolButtonActive:styles.measureButton}`} onClick={()=>{setDraftPoints([]);setTool('draw');}}><Crosshair size={16}/><span>{drawingTypeLabel}</span></button>
        </div>

        <div className={styles.toolGroup}>
          <button type="button" className={`${styles.toolButton} ${snapEnabled?styles.toggleActive:''}`} title="Snap to existing takeoff vertices · S" onClick={()=>setSnapEnabled(v=>!v)}><Magnet size={15}/><span>Snap</span></button>
          <button type="button" className={`${styles.toolButton} ${orthoEnabled?styles.toggleActive:''}`} title="Constrain horizontal/vertical · O" onClick={()=>setOrthoEnabled(v=>!v)}><MoveHorizontal size={15}/><span>Ortho</span></button>
          <button type="button" disabled={!draftPoints.length&&!calibrationPoints.length} className={styles.toolButton} title="Undo point · Backspace / Ctrl+Z" onClick={()=>tool==='calibrate'?setCalibrationPoints(p=>p.slice(0,-1)):setDraftPoints(p=>p.slice(0,-1))}><Undo2 size={15}/></button>
          {tool==='draw'&&<button type="button" disabled={busy||!draftPoints.length} className={`${styles.toolButton} ${styles.finishButton}`} title="Finish measurement · Enter or right-click" onClick={()=>void finishDraft()}><Check size={15}/><span>Finish</span></button>}
          {(tool==='draw'||tool==='calibrate')&&<button type="button" className={styles.toolButton} onClick={cancelTool}><X size={15}/></button>}
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
          {renderBox&&<svg className={`${styles.overlay} ${overlayClass}`} viewBox={`0 0 ${renderBox.pdfWidth} ${renderBox.pdfHeight}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={()=>{if(!panning){setHoverPoint(null);setHoverSnapped(false);}}} onContextMenu={event=>{event.preventDefault();if(tool==='draw')void finishDraft();}}>
            {currentMeasurements.map((measurement:any)=>{
              const points=geometryPoints(measurement.geometry);if(!points.length)return null;const version:any=versionMap.get(measurement.assembly_version_id);const assembly:any=version?assemblyMap.get(version.assembly_id):null;const color=hashColor(assembly?.code||measurement.assembly_version_id||measurement.id);const selected=selectedMeasurementId===measurement.id;const coords=points.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ');const first=points[0];const onSelect=(event:React.MouseEvent)=>{if(tool==='select'){event.stopPropagation();setSelectedMeasurementId(measurement.id);}};
              return <g key={measurement.id} onClick={onSelect} style={{cursor:tool==='select'?'pointer':undefined}}>
                {measurement.geometry?.type==='polygon'&&<polygon points={coords} fill={`${color}24`} stroke={color} strokeWidth={selected?3.2:2} vectorEffect="non-scaling-stroke"/>}
                {measurement.geometry?.type==='polyline'&&<polyline points={coords} fill="none" stroke={color} strokeWidth={selected?4:2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
                {measurement.geometry?.type==='count'&&points.map((p,i)=><g key={i}><circle cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r={selected?6:5} fill={`${color}45`} stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke"/><line x1={p.x*renderBox.pdfWidth-5} y1={p.y*renderBox.pdfHeight} x2={p.x*renderBox.pdfWidth+5} y2={p.y*renderBox.pdfHeight} stroke={color} vectorEffect="non-scaling-stroke"/><line x1={p.x*renderBox.pdfWidth} y1={p.y*renderBox.pdfHeight-5} x2={p.x*renderBox.pdfWidth} y2={p.y*renderBox.pdfHeight+5} stroke={color} vectorEffect="non-scaling-stroke"/></g>)}
                {zoom<5&&<g transform={`translate(${first.x*renderBox.pdfWidth} ${first.y*renderBox.pdfHeight})`}><rect x="5" y="-18" width={Math.max(76,Math.min(205,measurement.name.length*6+64))} height="20" rx="4" fill="rgba(7,12,18,.9)" stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke"/><text x="10" y="-4" fill="#f5f7fa" fontSize="9" fontWeight="700">{measurement.name} · {qty(measurement.raw_quantity)} {measurement.raw_unit}</text></g>}
              </g>;
            })}

            {tool==='draw'&&draftRenderPoints.length>0&&<g pointerEvents="none">
              {selectedAssembly?.primary_measurement==='SF'&&draftRenderPoints.length>=2&&<polygon points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="rgba(105,143,237,.13)" stroke="#6f95ee" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
              {selectedAssembly?.primary_measurement==='LF'&&draftRenderPoints.length>=2&&<polyline points={draftRenderPoints.map(p=>`${p.x*renderBox.pdfWidth},${p.y*renderBox.pdfHeight}`).join(' ')} fill="none" stroke="#6f95ee" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}
              {draftPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="4" fill="#7fa0f3" stroke="#07101a" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>)}
            </g>}
            {tool==='calibrate'&&draftRenderPoints.length>0&&<g pointerEvents="none">{draftRenderPoints.length>=2&&<line x1={draftRenderPoints[0].x*renderBox.pdfWidth} y1={draftRenderPoints[0].y*renderBox.pdfHeight} x2={draftRenderPoints[1].x*renderBox.pdfWidth} y2={draftRenderPoints[1].y*renderBox.pdfHeight} stroke="#e5b55e" strokeWidth="2.5" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>}{calibrationPoints.map((p,i)=><circle key={i} cx={p.x*renderBox.pdfWidth} cy={p.y*renderBox.pdfHeight} r="5" fill="#e5b55e" stroke="#07101a" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</g>}
            {hoverPoint&&(tool==='draw'||tool==='calibrate')&&<g pointerEvents="none" transform={`translate(${hoverPoint.x*renderBox.pdfWidth} ${hoverPoint.y*renderBox.pdfHeight})`}><circle r={hoverSnapped?7:4.5} fill="none" stroke={hoverSnapped?'#69d39a':'#91a8e8'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/><line x1="-12" x2="12" y1="0" y2="0" stroke={hoverSnapped?'#69d39a':'#91a8e8'} strokeWidth="1" vectorEffect="non-scaling-stroke"/><line y1="-12" y2="12" x1="0" x2="0" stroke={hoverSnapped?'#69d39a':'#91a8e8'} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>}
          </svg>}
        </div>
        {preview&&<div className={styles.liveReadout}><strong>{qty(preview.quantity)} {preview.unit}</strong>{preview.perimeterLf>0&&<span>{qty(preview.perimeterLf)} LF perimeter</span>}</div>}
      </div>

      <div className={styles.statusbar}><span><strong>Page {pageNumber}</strong> / {pdfPageCount||'…'}</span><span className={currentScale?styles.statusOk:styles.statusHold}>{currentScale?'Scale set':'Scale required'}</span><span>{snapEnabled?'Snap on':'Snap off'} · {orthoEnabled?'Ortho on':'Ortho off'}</span><span className={styles.statusHint}>{tool==='draw'?'Click points · Enter/right-click to finish · Space to pan':'Mouse wheel zooms · Space/middle mouse pans'}</span><span className={styles.statusMessage}>{message}</span></div>
    </section>

    {inspectorOpen&&<aside className={styles.inspector}>
      <div className={styles.panelHeader}><div><div className={styles.panelTitle}>Takeoff</div><div className={styles.panelMeta}>{currentSheet?`${currentSheet.sheet_number||`Page ${currentSheet.page_number}`} · ${currentMeasurements.length} takeoff${currentMeasurements.length===1?'':'s'}`:'Preparing sheet'}</div></div><button type="button" className={styles.iconButton} title="Hide inspector" onClick={()=>setInspectorOpen(false)}><PanelRightClose size={16}/></button></div>
      <div className={styles.inspectorBody}>
        {!currentScale&&<div className={`${styles.group} ${styles.scaleGate}`}><div className={styles.groupHead}><div><div className={styles.groupTitle}>Set Sheet Scale</div><div className={styles.groupHelp}>Required before LF or SF takeoff.</div></div><Ruler size={17}/></div><label className={styles.field}><span>Known dimension</span><div className={styles.inputUnit}><input value={knownDistanceFt} onChange={e=>setKnownDistanceFt(e.target.value)} inputMode="decimal"/><b>FT</b></div></label><div className={styles.buttonRow}><button type="button" className={styles.secondary} disabled={locked} onClick={()=>{setCalibrationPoints([]);setTool('calibrate');}}>Pick 2 points</button><button type="button" className={styles.primary} disabled={locked||calibrationPoints.length!==2||busy} onClick={()=>void saveCalibration()}>Save scale</button></div><div className={styles.groupHelp}>Use a printed dimension line. Carez stores scale independently for every sheet.</div></div>}

        {currentScale&&<div className={styles.scaleReady}><span>Scale</span><strong>{qty(currentSheet?.calibration?.known_distance_ft)} FT calibration</strong><button type="button" disabled={locked} onClick={()=>{setCalibrationPoints([]);setTool('calibrate');}}>Recalibrate</button></div>}

        <div className={styles.group}>
          <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Assembly</div><div className={styles.groupHelp}>One measurement drives material, labor and production quantities.</div></div></div>
          <label className={styles.searchField}><Search size={14}/><input value={assemblySearch} onChange={e=>setAssemblySearch(e.target.value)} placeholder="Find slab, footing, wall, curb…"/></label>
          <div className={styles.assemblyList}>{filteredAssemblies.length?filteredAssemblies.map((assembly:any)=>{const active=assembly.id===selectedAssemblyId;return <button key={assembly.id} type="button" disabled={locked} className={`${styles.assemblyCard} ${active?styles.assemblyCardActive:''}`} onClick={()=>{setSelectedAssemblyId(assembly.id);setTool('select');}}><span className={styles.assemblyUnit}>{assembly.primary_measurement}</span><span><strong>{assembly.name}</strong><small>{assembly.code}{assembly.category?` · ${assembly.category}`:''}</small></span></button>;}):<div className={styles.emptySmall}>No concrete assembly matches that search.</div>}</div>
          {selectedVersion&&<div className={styles.assemblySource}>V{selectedVersion.version_no} · {selectedVersion.source_label||'Carez assembly'}{selectedVersion.source_reference&&<span>{selectedVersion.source_reference}</span>}</div>}
        </div>

        {selectedAssembly&&<div className={styles.group}>
          <div className={styles.groupTitle}>Takeoff Details</div>
          <label className={styles.field}><span>Name <em>optional</em></span><input value={objectName} disabled={locked} onChange={e=>setObjectName(e.target.value)} placeholder={`Auto: ${selectedAssembly.name} 1`}/></label>
          <label className={styles.field}><span>Location / zone <em>optional</em></span><input value={location} disabled={locked} onChange={e=>setLocation(e.target.value)} placeholder="Garage · North wall · Area A"/></label>
          {selectedVariables.length>0&&<div className={styles.variableGrid}>{selectedVariables.filter((variable:any)=>!(variable.variable_key==='perimeter_lf'&&selectedAssembly.primary_measurement==='SF')).map((variable:any)=><label className={styles.field} key={variable.id}><span>{variable.label}{variable.required?' *':''}</span><div className={styles.inputUnit}><input type={variable.value_type==='number'?'number':'text'} step="any" min={variable.min_value??undefined} max={variable.max_value??undefined} value={variableValues[variable.variable_key]??''} disabled={locked} onChange={e=>setVariableValues(values=>({...values,[variable.variable_key]:e.target.value}))}/>{variable.unit&&<b>{variable.unit}</b>}</div>{variable.help_text&&<small>{variable.help_text}</small>}</label>)}</div>}
          <label className={styles.checkRow}><input type="checkbox" checked={repeatMode} onChange={e=>setRepeatMode(e.target.checked)}/><Repeat2 size={14}/><span>Keep this assembly active after saving</span></label>
          <details className={styles.advanced}><summary>Advanced job coding</summary><div className={styles.advancedBody}><label className={styles.field}><span>Estimate scope area</span><select value={sectionId} disabled={locked} onChange={e=>setSectionId(e.target.value)}><option value="">Automatic / unassigned</option>{sections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className={styles.field}><span>L&I phase</span><select value={riskClassCode} disabled={locked} onChange={e=>setRiskClassCode(e.target.value)}><option value="">Assembly default</option>{riskClasses.map((r:any)=><option key={`${r.code}-${r.tax_year}`} value={r.code}>{r.code} — {r.name}</option>)}</select></label><label className={styles.field}><span>Drawing reference</span><input value={drawingReference} disabled={locked} onChange={e=>setDrawingReference(e.target.value)} placeholder="Automatic from current sheet"/></label></div></details>
          {!locked&&<button type="button" className={styles.measurePrimary} disabled={!selectedAssembly} onClick={()=>{setDraftPoints([]);setTool('draw');}}><Crosshair size={16}/> Start {drawingTypeLabel} Takeoff</button>}
          {preview&&<div className={styles.previewCard}><span>Live quantity</span><strong>{qty(preview.quantity)} {preview.unit}</strong>{preview.perimeterLf>0&&<small>{qty(preview.perimeterLf)} LF perimeter</small>}<button type="button" disabled={busy} onClick={()=>void finishDraft()}><Check size={15}/> Save takeoff</button></div>}
        </div>}

        <div className={styles.group}><div className={styles.groupTitle}>This Sheet</div>{currentMeasurements.length?<div className={styles.objectList}>{currentMeasurements.map((measurement:any)=>{const version:any=versionMap.get(measurement.assembly_version_id);const assembly:any=version?assemblyMap.get(version.assembly_id):null;const summary=summaryMap.get(measurement.id);return <button type="button" key={measurement.id} className={`${styles.objectButton} ${selectedMeasurementId===measurement.id?styles.objectSelected:''}`} onClick={()=>{setSelectedMeasurementId(measurement.id);setTool('select');}}><span className={styles.objectColor} style={{background:hashColor(assembly?.code||measurement.id)}}/><span><strong>{measurement.name}</strong><small>{assembly?.name||'Assembly'} · {qty(measurement.raw_quantity)} {measurement.raw_unit}</small></span>{summary?.missing?<b className={styles.objectWarn}>!</b>:null}</button>;})}</div>:<div className={styles.emptySmall}>No takeoff on this sheet yet.</div>}</div>

        {selectedMeasurement&&<div className={`${styles.group} ${styles.selectedGroup}`}><div className={styles.groupTitle}>Selected Takeoff</div><div className={styles.selectedTitle}>{selectedMeasurement.name}</div><div className={styles.selectedQty}>{qty(selectedMeasurement.raw_quantity)} {selectedMeasurement.raw_unit}</div>{selectedSummary&&<div className={styles.selectedStats}><span><b>{qty(selectedSummary.mh)}</b> MH</span><span><b>{money(selectedSummary.cost)}</b> direct</span></div>}{selectedSummary?.missing? <div className={styles.statusWarn}>{selectedSummary.missing} generated line{selectedSummary.missing===1?'':'s'} still need pricing.</div>:null}{!locked&&<button type="button" className={styles.danger} disabled={busy} onClick={()=>void removeSelected()}><Trash2 size={14}/> Delete takeoff</button>}</div>}

        <details className={styles.shortcuts}><summary>Keyboard & mouse shortcuts</summary><div className={styles.shortcutGrid}><kbd>Wheel</kbd><span>Zoom at cursor</span><kbd>Space</kbd><span>Temporary pan</span><kbd>Middle</kbd><span>Pan</span><kbd>M</kbd><span>Measure</span><kbd>C</kbd><span>Scale</span><kbd>S</kbd><span>Snap on/off</span><kbd>O</kbd><span>Ortho on/off</span><kbd>Enter</kbd><span>Finish takeoff</span><kbd>0</kbd><span>Fit width</span><kbd>1</kbd><span>Fit page</span><kbd>Esc</kbd><span>Cancel tool</span></div></details>
      </div>
    </aside>}
  </div>;
}
