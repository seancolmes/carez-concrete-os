import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
}

const workspacePath = 'components/takeoff/TakeoffDrawingWorkspace.tsx';
let workspace = fs.readFileSync(workspacePath, 'utf8');

workspace = replaceOnce(workspace,
`  methodProfiles:any[];\n  locked:boolean;\n};`,
`  methodProfiles:any[];\n  locked:boolean;\n  conditionAuthoringActive?:boolean;\n  conditionMeasurementIds?:string[];\n};`,
'workspace props');

workspace = replaceOnce(workspace,
`  const {takeoffSet,pdfUrl,sourceTitle,initialSheets,scaleRegions,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,riskClasses,methodProfiles,locked}=props;`,
`  const {takeoffSet,pdfUrl,sourceTitle,initialSheets,scaleRegions,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,riskClasses,methodProfiles,locked}=props;\n  const conditionAuthoringActive=Boolean(props.conditionAuthoringActive);\n  const conditionMeasurementIdSet=useMemo(()=>new Set(props.conditionMeasurementIds||[]),[props.conditionMeasurementIds]);\n  const openConditions=useCallback(()=>{if(!locked)window.dispatchEvent(new CustomEvent('carez:open-conditions'));},[locked]);`,
'workspace condition mode setup');

workspace = replaceOnce(workspace,
`  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>(assemblies.find((assembly:any)=>assembly.category!=='Concrete Conditions')?.id||assemblies[0]?.id||'');`,
`  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>(conditionAuthoringActive?'':(assemblies.find((assembly:any)=>assembly.category!=='Concrete Conditions')?.id||assemblies[0]?.id||''));\n  const [conditionDrawActive,setConditionDrawActive]=useState(false);`,
'workspace selected assembly state');

workspace = replaceOnce(workspace,
`      conditionDrawRef.current=request;\n      if(version.assembly_id===selectedAssemblyId){`,
`      conditionDrawRef.current=request;\n      setConditionDrawActive(true);\n      if(version.assembly_id===selectedAssemblyId){`,
'condition draw activation');

workspace = replaceOnce(workspace,
`        setMessage(\`Draw \${request.roleLabel} on the plan. Double-click to finish LF; click the first point to close SF.\`);\n        conditionDrawRef.current=null;`,
`        setMessage(\`Draw \${request.roleLabel} on the plan. Double-click to finish LF; click the first point to close SF.\`);\n        conditionDrawRef.current=null;`,
'condition direct start marker');

workspace = replaceOnce(workspace,
`    if(locked||busy||!selectedAssembly||!selectedVersion||!currentSheet||!renderBox)return;\n    if(!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}`,
`    if(locked||busy||!selectedAssembly||!selectedVersion||!currentSheet||!renderBox)return;\n    if(conditionAuthoringActive&&!conditionDrawActive){setMessage('Start new scope from Concrete Conditions.');openConditions();return;}\n    if(!conditionAuthoringActive&&!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}`,
'finish draft gate');

workspace = replaceOnce(workspace,
`      setDraftPoints([]);setDraftScaleRegionId(null);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);setTool(repeatMode?'draw':'select');router.refresh();`,
`      setDraftPoints([]);setDraftScaleRegionId(null);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);\n      if(conditionAuthoringActive){setConditionDrawActive(false);setSelectedAssemblyId('');setTool('select');}\n      else setTool(repeatMode?'draw':'select');\n      router.refresh();`,
'finish draft reset');

workspace = replaceOnce(workspace,
`  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,draftScaleRegionId,currentMeasurements,location,objectName,takeoffSet.id,sectionId,drawingReference,riskClassCode,variableValues,repeatMode,router,buildPlanReady,selectedMethodProfileId]);`,
`  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,draftScaleRegionId,currentMeasurements,location,objectName,takeoffSet.id,sectionId,drawingReference,riskClassCode,variableValues,repeatMode,router,buildPlanReady,selectedMethodProfileId,conditionAuthoringActive,conditionDrawActive,openConditions]);`,
'finish draft dependencies');

workspace = replaceOnce(workspace,
`      if(event.key.toLowerCase()==='m'&&!locked){if(buildPlanReady)setTool('draw');else setMessage('Verify the current build method before starting takeoff.');}`,
`      if(event.key.toLowerCase()==='m'&&!locked){if(conditionAuthoringActive){openConditions();return;}if(buildPlanReady)setTool('draw');else setMessage('Verify the current build method before starting takeoff.');}`,
'keyboard measure gate');

workspace = replaceOnce(workspace,
`  },[draftPoints.length,calibrationPoints.length,scaleRegionPoints.length,tool,locked,finishDraft,selectedMeasurementId,selectedGeometry,renderBox,busy,zoom,setZoomAt,fitPage,pageNumber,pdfPageCount,buildPlanReady]); // eslint-disable-line react-hooks/exhaustive-deps`,
`  },[draftPoints.length,calibrationPoints.length,scaleRegionPoints.length,tool,locked,finishDraft,selectedMeasurementId,selectedGeometry,renderBox,busy,zoom,setZoomAt,fitPage,pageNumber,pdfPageCount,buildPlanReady,conditionAuthoringActive,openConditions]); // eslint-disable-line react-hooks/exhaustive-deps`,
'keyboard dependencies');

workspace = replaceOnce(workspace,
`    if(tool==='draw'){if(!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}if(!selectedAssembly){setMessage('Choose a concrete assembly first.');return;}if(selectedAssembly.primary_measurement!=='EA'){`,
`    if(tool==='draw'){if(conditionAuthoringActive&&!conditionDrawActive){setMessage('Start new scope from Concrete Conditions.');openConditions();return;}if(!conditionAuthoringActive&&!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}if(!selectedAssembly){setMessage(conditionAuthoringActive?'Concrete Condition geometry is not ready. Reopen Conditions and start the required takeoff.':'Choose a concrete assembly first.');return;}if(selectedAssembly.primary_measurement!=='EA'){`,
'pointer draw gate');

workspace = replaceOnce(workspace,
`  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setSelectedMeasurementId(null);setTool('select');setZoom(1);}\n  function cancelTool(){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setTool('select');}`,
`  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setSelectedMeasurementId(null);setConditionDrawActive(false);if(conditionAuthoringActive)setSelectedAssemblyId('');setTool('select');setZoom(1);}\n  function cancelTool(){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setConditionDrawActive(false);if(conditionAuthoringActive)setSelectedAssemblyId('');setTool('select');}`,
'cancel condition draw');

workspace = replaceOnce(workspace,
`    {buildPlanWorkbenchOpen&&selectedAssembly&&selectedVersion?<section className={styles.buildPlanWorkspace}>`,
`    {!conditionAuthoringActive&&buildPlanWorkbenchOpen&&selectedAssembly&&selectedVersion?<section className={styles.buildPlanWorkspace}>`,
'build plan workbench gate');

workspace = replaceOnce(workspace,
`          <button type="button" disabled={locked||!selectedAssembly||!buildPlanReady} title={buildPlanReady?'Measure · M':'Verify build method before measuring'} className={\`${styles.toolButton} \${tool==='draw'?styles.toolButtonActive:styles.measureButton}\`} onClick={()=>{setDraftPoints([]);setDraftScaleRegionId(null);setTool('draw');}}><Crosshair size={16}/><span>{drawingTypeLabel}</span></button>`,
`          {conditionAuthoringActive?<button type="button" disabled={locked} title="Concrete Conditions · M" className={\`${styles.toolButton} \${styles.measureButton}\`} onClick={openConditions}><Crosshair size={16}/><span>Conditions</span></button>:<button type="button" disabled={locked||!selectedAssembly||!buildPlanReady} title={buildPlanReady?'Measure · M':'Verify build method before measuring'} className={\`${styles.toolButton} \${tool==='draw'?styles.toolButtonActive:styles.measureButton}\`} onClick={()=>{setDraftPoints([]);setDraftScaleRegionId(null);setTool('draw');}}><Crosshair size={16}/><span>{drawingTypeLabel}</span></button>}`,
'toolbar condition launcher');

workspace = replaceOnce(workspace,
`        {selectedAssembly&&<div className={styles.currentAssembly}><span>{selectedAssembly.code}</span><strong>{selectedAssembly.name}</strong></div>}`,
`        {!conditionAuthoringActive&&selectedAssembly&&<div className={styles.currentAssembly}><span>{selectedAssembly.code}</span><strong>{selectedAssembly.name}</strong></div>}`,
'current assembly gate');

workspace = replaceOnce(workspace,
`        <button type="button" role="tab" aria-selected={inspectorTab==='buildPlan'} className={inspectorTab==='buildPlan'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('buildPlan')}>Build Plan{buildPlanRequired&&!buildPlanReady?<i/>:null}</button>`,
`        {!conditionAuthoringActive&&<button type="button" role="tab" aria-selected={inspectorTab==='buildPlan'} className={inspectorTab==='buildPlan'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('buildPlan')}>Build Plan{buildPlanRequired&&!buildPlanReady?<i/>:null}</button>}`,
'inspector build plan tab gate');

workspace = replaceOnce(workspace,
`          <div className={styles.group}>\n            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Assembly</div><div className={styles.groupHelp}>Choose what you are measuring. One takeoff drives its resource recipe.</div></div></div>\n            <label className={styles.searchField}><Search size={14}/><input value={assemblySearch} onChange={e=>setAssemblySearch(e.target.value)} placeholder="Find footing, wall, slab, curb…"/></label>\n            <div className={styles.assemblyList}>{filteredAssemblies.length?filteredAssemblies.map((assembly:any)=>{const active=assembly.id===selectedAssemblyId;return <button key={assembly.id} type="button" disabled={locked} className={\`${styles.assemblyCard} \${active?styles.assemblyCardActive:''}\`} onClick={()=>{setSelectedAssemblyId(assembly.id);setSelectedMeasurementId(null);setTool('select');}}><span className={styles.assemblyUnit}>{assembly.primary_measurement}</span><span><strong>{assembly.name}</strong><small>{assembly.code}{assembly.category?\` · \${assembly.category}\`:''}</small></span></button>;}):<div className={styles.emptySmall}>No concrete assembly matches that search.</div>}</div>\n            {selectedVersion&&<div className={styles.assemblySource}>V{selectedVersion.version_no} · {selectedVersion.source_label||'Carez assembly'}{selectedVersion.source_reference&&<span>{selectedVersion.source_reference}</span>}</div>}\n          </div>`,
`          {conditionAuthoringActive?<div className={styles.group}>\n            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Conditions</div><div className={styles.groupHelp}>Create or open a Condition, then draw the geometry it requires. Legacy recipes and Build Methods stay out of the active workflow.</div></div></div>\n            {!locked&&<button type="button" className={styles.measurePrimary} onClick={openConditions}><Crosshair size={16}/> Open Concrete Conditions</button>}\n          </div>:<div className={styles.group}>\n            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Assembly</div><div className={styles.groupHelp}>Choose what you are measuring. One takeoff drives its resource recipe.</div></div></div>\n            <label className={styles.searchField}><Search size={14}/><input value={assemblySearch} onChange={e=>setAssemblySearch(e.target.value)} placeholder="Find footing, wall, slab, curb…"/></label>\n            <div className={styles.assemblyList}>{filteredAssemblies.length?filteredAssemblies.map((assembly:any)=>{const active=assembly.id===selectedAssemblyId;return <button key={assembly.id} type="button" disabled={locked} className={\`${styles.assemblyCard} \${active?styles.assemblyCardActive:''}\`} onClick={()=>{setSelectedAssemblyId(assembly.id);setSelectedMeasurementId(null);setTool('select');}}><span className={styles.assemblyUnit}>{assembly.primary_measurement}</span><span><strong>{assembly.name}</strong><small>{assembly.code}{assembly.category?\` · \${assembly.category}\`:''}</small></span></button>;}):<div className={styles.emptySmall}>No concrete assembly matches that search.</div>}</div>\n            {selectedVersion&&<div className={styles.assemblySource}>V{selectedVersion.version_no} · {selectedVersion.source_label||'Carez assembly'}{selectedVersion.source_reference&&<span>{selectedVersion.source_reference}</span>}</div>}\n          </div>}`,
'condition takeoffs group');

workspace = replaceOnce(workspace,
`<small>{assembly?.name||'Assembly'} · {formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}`,
`<small>{conditionAuthoringActive?(conditionMeasurementIdSet.has(measurement.id)?'Concrete Condition':'Legacy takeoff'):(assembly?.name||'Assembly')} · {formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}`,
'object list terminology');

workspace = replaceOnce(workspace,
`          {selectedAssembly&&<div className={styles.inspectorActionStrip}>`,
`          {!conditionAuthoringActive&&selectedAssembly&&<div className={styles.inspectorActionStrip}>`,
'inspector active assembly strip');

workspace = replaceOnce(workspace,
`            {selectedSummary?.inputHolds?<div className={styles.statusWarn}>{selectedSummary.inputHolds} generated line{selectedSummary.inputHolds===1?'':'s'} waiting on assembly input. Geometry and unaffected quantities are saved.</div>:null}\n            {selectedSummary?.priceHolds?<div className={styles.statusWarn}>{selectedSummary.priceHolds} generated line{selectedSummary.priceHolds===1?'':'s'} still need pricing or a labor rate.</div>:null}\n            {selectedVersionRecord&&selectedAssemblyRecord&&<TakeoffAssemblyInputEditor measurement={selectedMeasurement} version={selectedVersionRecord} assembly={selectedAssemblyRecord} variables={variables} outputs={selectedOutputs} takeoffSetId={takeoffSet.id} locked={locked} onMessage={setMessage}/>} `,
`            {selectedSummary?.inputHolds?<div className={styles.statusWarn}>{selectedSummary.inputHolds} generated line{selectedSummary.inputHolds===1?'':'s'} waiting on {conditionAuthoringActive?'required Condition input':'assembly input'}. Geometry and unaffected quantities are saved.</div>:null}\n            {selectedSummary?.priceHolds?<div className={styles.statusWarn}>{selectedSummary.priceHolds} generated line{selectedSummary.priceHolds===1?'':'s'} still need pricing or a labor rate.</div>:null}\n            {conditionAuthoringActive?<div className={styles.statusWarn}>{conditionMeasurementIdSet.has(selectedMeasurement.id)?'Condition-managed takeoff. Plan facts, methods, production, and modules are edited in Concrete Conditions.':'Legacy takeoff preserved for historical lineage. New scope is authored through Concrete Conditions.'}</div>:selectedVersionRecord&&selectedAssemblyRecord?<TakeoffAssemblyInputEditor measurement={selectedMeasurement} version={selectedVersionRecord} assembly={selectedAssemblyRecord} variables={variables} outputs={selectedOutputs} takeoffSetId={takeoffSet.id} locked={locked} onMessage={setMessage}/>:null} `,
'selected takeoff legacy authoring gate');

workspace = replaceOnce(workspace,
`          </div>:selectedAssembly?<div className={styles.group}>`,
`          </div>:conditionAuthoringActive?<div className={styles.group}><div className={styles.groupTitle}>New Takeoff</div><div className={styles.groupHelp}>New measured scope starts from a Concrete Condition so geometry, modules, outputs, and estimate lineage stay together.</div>{!locked&&<button type="button" className={styles.measurePrimary} onClick={openConditions}><Crosshair size={16}/> Open Concrete Conditions</button>}</div>:selectedAssembly?<div className={styles.group}>`,
'new takeoff condition branch');

workspace = replaceOnce(workspace,
`<kbd>M</kbd><span>Measure</span>`,
`<kbd>M</kbd><span>{conditionAuthoringActive?'Open Conditions':'Measure'}</span>`,
'shortcut terminology');

workspace = replaceOnce(workspace,
`        {inspectorTab==='buildPlan'&&<>`,
`        {!conditionAuthoringActive&&inspectorTab==='buildPlan'&&<>`,
'build plan pane gate');

fs.writeFileSync(workspacePath, workspace);

const conditionPath = 'components/takeoff/ConcreteConditionAuthoring.tsx';
let condition = fs.readFileSync(conditionPath, 'utf8');
const anchor = `  const [open,setOpen]=useState(false);`;
if (!condition.includes(anchor)) throw new Error('condition authoring open state anchor not found');
condition = condition.replace(anchor, `${anchor}\n\n  useEffect(()=>{\n    const openConditions=()=>setOpen(true);\n    window.addEventListener('carez:open-conditions',openConditions);\n    return()=>window.removeEventListener('carez:open-conditions',openConditions);\n  },[]);`);
condition = condition.replaceAll('matching Concrete Condition recipe', 'required Concrete Condition geometry');
fs.writeFileSync(conditionPath, condition);

console.log('Applied guarded active-Takeoff legacy authoring retirement patch.');
