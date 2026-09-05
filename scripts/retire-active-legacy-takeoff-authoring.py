from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return source.replace(before, after, 1)


workspace_path = Path('components/takeoff/TakeoffDrawingWorkspace.tsx')
workspace = workspace_path.read_text()

workspace = replace_once(workspace, r'''  methodProfiles:any[];
  locked:boolean;
};''', r'''  methodProfiles:any[];
  locked:boolean;
  conditionAuthoringActive?:boolean;
  conditionMeasurementIds?:string[];
};''', 'workspace props')

workspace = replace_once(workspace, r'''  const {takeoffSet,pdfUrl,sourceTitle,initialSheets,scaleRegions,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,riskClasses,methodProfiles,locked}=props;
  const router=useRouter();''', r'''  const {takeoffSet,pdfUrl,sourceTitle,initialSheets,scaleRegions,initialMeasurements,measurementSummaries,assemblies,versions,variables,sections,riskClasses,methodProfiles,locked}=props;
  const conditionAuthoringActive=Boolean(props.conditionAuthoringActive);
  const conditionMeasurementIdSet=useMemo(()=>new Set(props.conditionMeasurementIds||[]),[props.conditionMeasurementIds]);
  const router=useRouter();
  const openConditions=useCallback(()=>{if(!locked)window.dispatchEvent(new CustomEvent('carez:open-conditions'));},[locked]);''', 'workspace condition mode setup')

workspace = replace_once(workspace, r'''  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>(assemblies.find((assembly:any)=>assembly.category!=='Concrete Conditions')?.id||assemblies[0]?.id||'');
  const [assemblySearch,setAssemblySearch]=useState('');''', r'''  const [selectedAssemblyId,setSelectedAssemblyId]=useState<string>(conditionAuthoringActive?'':(assemblies.find((assembly:any)=>assembly.category!=='Concrete Conditions')?.id||assemblies[0]?.id||''));
  const [conditionDrawActive,setConditionDrawActive]=useState(false);
  const [assemblySearch,setAssemblySearch]=useState('');''', 'workspace selected assembly state')

workspace = replace_once(workspace, r'''      conditionDrawRef.current=request;
      if(version.assembly_id===selectedAssemblyId){''', r'''      conditionDrawRef.current=request;
      setConditionDrawActive(true);
      if(version.assembly_id===selectedAssemblyId){''', 'condition draw activation')

workspace = replace_once(workspace, r'''    if(locked||busy||!selectedAssembly||!selectedVersion||!currentSheet||!renderBox)return;
    if(!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}''', r'''    if(locked||busy||!selectedAssembly||!selectedVersion||!currentSheet||!renderBox)return;
    if(conditionAuthoringActive&&!conditionDrawActive){setMessage('Start new scope from Concrete Conditions.');openConditions();return;}
    if(!conditionAuthoringActive&&!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}''', 'finish draft gate')

workspace = replace_once(workspace, r'''      setDraftPoints([]);setDraftScaleRegionId(null);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);setTool(repeatMode?'draw':'select');router.refresh();''', r'''      setDraftPoints([]);setDraftScaleRegionId(null);setHoverPoint(null);setObjectName('');setSelectedMeasurementId(null);
      if(conditionAuthoringActive){setConditionDrawActive(false);setSelectedAssemblyId('');setTool('select');}
      else setTool(repeatMode?'draw':'select');
      router.refresh();''', 'finish draft reset')

workspace = replace_once(workspace, r'''  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,draftScaleRegionId,currentMeasurements,location,objectName,takeoffSet.id,sectionId,drawingReference,riskClassCode,variableValues,repeatMode,router,buildPlanReady,selectedMethodProfileId]);''', r'''  },[locked,busy,selectedAssembly,selectedVersion,currentSheet,renderBox,draftPoints,draftScaleRegionId,currentMeasurements,location,objectName,takeoffSet.id,sectionId,drawingReference,riskClassCode,variableValues,repeatMode,router,buildPlanReady,selectedMethodProfileId,conditionAuthoringActive,conditionDrawActive,openConditions]);''', 'finish draft dependencies')

workspace = replace_once(workspace, r'''      if(event.key.toLowerCase()==='m'&&!locked){if(buildPlanReady)setTool('draw');else setMessage('Verify the current build method before starting takeoff.');}''', r'''      if(event.key.toLowerCase()==='m'&&!locked){if(conditionAuthoringActive){openConditions();return;}if(buildPlanReady)setTool('draw');else setMessage('Verify the current build method before starting takeoff.');}''', 'keyboard measure gate')

workspace = replace_once(workspace, r'''  },[draftPoints.length,calibrationPoints.length,scaleRegionPoints.length,tool,locked,finishDraft,selectedMeasurementId,selectedGeometry,renderBox,busy,zoom,setZoomAt,fitPage,pageNumber,pdfPageCount,buildPlanReady]); // eslint-disable-line react-hooks/exhaustive-deps''', r'''  },[draftPoints.length,calibrationPoints.length,scaleRegionPoints.length,tool,locked,finishDraft,selectedMeasurementId,selectedGeometry,renderBox,busy,zoom,setZoomAt,fitPage,pageNumber,pdfPageCount,buildPlanReady,conditionAuthoringActive,openConditions]); // eslint-disable-line react-hooks/exhaustive-deps''', 'keyboard dependencies')

workspace = replace_once(workspace, r'''    if(tool==='draw'){if(!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}if(!selectedAssembly){setMessage('Choose a concrete assembly first.');return;}if(selectedAssembly.primary_measurement!=='EA'){''', r'''    if(tool==='draw'){if(conditionAuthoringActive&&!conditionDrawActive){setMessage('Start new scope from Concrete Conditions.');openConditions();return;}if(!conditionAuthoringActive&&!buildPlanReady){setMessage('Verify the current build method before starting takeoff.');return;}if(!selectedAssembly){setMessage(conditionAuthoringActive?'Concrete Condition geometry is not ready. Reopen Conditions and start the required takeoff.':'Choose a concrete assembly first.');return;}if(selectedAssembly.primary_measurement!=='EA'){''', 'pointer draw gate')

workspace = replace_once(workspace, r'''  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setSelectedMeasurementId(null);setTool('select');setZoom(1);}
  function cancelTool(){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setTool('select');}''', r'''  function changePage(next:number){setPageNumber(next);setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setSelectedMeasurementId(null);setConditionDrawActive(false);if(conditionAuthoringActive)setSelectedAssemblyId('');setTool('select');setZoom(1);}
  function cancelTool(){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setConditionDrawActive(false);if(conditionAuthoringActive)setSelectedAssemblyId('');setTool('select');}''', 'cancel condition draw')

workspace = replace_once(workspace, r'''    {buildPlanWorkbenchOpen&&selectedAssembly&&selectedVersion?<section className={styles.buildPlanWorkspace}>''', r'''    {!conditionAuthoringActive&&buildPlanWorkbenchOpen&&selectedAssembly&&selectedVersion?<section className={styles.buildPlanWorkspace}>''', 'build plan workbench gate')

workspace = replace_once(workspace, r'''          <button type="button" disabled={locked||!selectedAssembly||!buildPlanReady} title={buildPlanReady?'Measure · M':'Verify build method before measuring'} className={`${styles.toolButton} ${tool==='draw'?styles.toolButtonActive:styles.measureButton}`} onClick={()=>{setDraftPoints([]);setDraftScaleRegionId(null);setTool('draw');}}><Crosshair size={16}/><span>{drawingTypeLabel}</span></button>''', r'''          {conditionAuthoringActive?<button type="button" disabled={locked} title="Concrete Conditions · M" className={`${styles.toolButton} ${styles.measureButton}`} onClick={openConditions}><Crosshair size={16}/><span>Conditions</span></button>:<button type="button" disabled={locked||!selectedAssembly||!buildPlanReady} title={buildPlanReady?'Measure · M':'Verify build method before measuring'} className={`${styles.toolButton} ${tool==='draw'?styles.toolButtonActive:styles.measureButton}`} onClick={()=>{setDraftPoints([]);setDraftScaleRegionId(null);setTool('draw');}}><Crosshair size={16}/><span>{drawingTypeLabel}</span></button>}''', 'toolbar condition launcher')

workspace = replace_once(workspace, r'''        {selectedAssembly&&<div className={styles.currentAssembly}><span>{selectedAssembly.code}</span><strong>{selectedAssembly.name}</strong></div>}''', r'''        {!conditionAuthoringActive&&selectedAssembly&&<div className={styles.currentAssembly}><span>{selectedAssembly.code}</span><strong>{selectedAssembly.name}</strong></div>}''', 'current assembly gate')

workspace = replace_once(workspace, r'''        <button type="button" role="tab" aria-selected={inspectorTab==='buildPlan'} className={inspectorTab==='buildPlan'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('buildPlan')}>Build Plan{buildPlanRequired&&!buildPlanReady?<i/>:null}</button>''', r'''        {!conditionAuthoringActive&&<button type="button" role="tab" aria-selected={inspectorTab==='buildPlan'} className={inspectorTab==='buildPlan'?styles.inspectorTabActive:''} onClick={()=>setInspectorTab('buildPlan')}>Build Plan{buildPlanRequired&&!buildPlanReady?<i/>:null}</button>}''', 'inspector build plan tab gate')

legacy_group = r'''          <div className={styles.group}>
            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Assembly</div><div className={styles.groupHelp}>Choose what you are measuring. One takeoff drives its resource recipe.</div></div></div>
            <label className={styles.searchField}><Search size={14}/><input value={assemblySearch} onChange={e=>setAssemblySearch(e.target.value)} placeholder="Find footing, wall, slab, curb…"/></label>
            <div className={styles.assemblyList}>{filteredAssemblies.length?filteredAssemblies.map((assembly:any)=>{const active=assembly.id===selectedAssemblyId;return <button key={assembly.id} type="button" disabled={locked} className={`${styles.assemblyCard} ${active?styles.assemblyCardActive:''}`} onClick={()=>{setSelectedAssemblyId(assembly.id);setSelectedMeasurementId(null);setTool('select');}}><span className={styles.assemblyUnit}>{assembly.primary_measurement}</span><span><strong>{assembly.name}</strong><small>{assembly.code}{assembly.category?` · ${assembly.category}`:''}</small></span></button>;}):<div className={styles.emptySmall}>No concrete assembly matches that search.</div>}</div>
            {selectedVersion&&<div className={styles.assemblySource}>V{selectedVersion.version_no} · {selectedVersion.source_label||'Carez assembly'}{selectedVersion.source_reference&&<span>{selectedVersion.source_reference}</span>}</div>}
          </div>'''
condition_group = r'''          {conditionAuthoringActive?<div className={styles.group}>
            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Conditions</div><div className={styles.groupHelp}>Create or open a Condition, then draw the geometry it requires. Legacy recipes and Build Methods stay out of the active workflow.</div></div></div>
            {!locked&&<button type="button" className={styles.measurePrimary} onClick={openConditions}><Crosshair size={16}/> Open Concrete Conditions</button>}
          </div>:<div className={styles.group}>
            <div className={styles.groupHead}><div><div className={styles.groupTitle}>Concrete Assembly</div><div className={styles.groupHelp}>Choose what you are measuring. One takeoff drives its resource recipe.</div></div></div>
            <label className={styles.searchField}><Search size={14}/><input value={assemblySearch} onChange={e=>setAssemblySearch(e.target.value)} placeholder="Find footing, wall, slab, curb…"/></label>
            <div className={styles.assemblyList}>{filteredAssemblies.length?filteredAssemblies.map((assembly:any)=>{const active=assembly.id===selectedAssemblyId;return <button key={assembly.id} type="button" disabled={locked} className={`${styles.assemblyCard} ${active?styles.assemblyCardActive:''}`} onClick={()=>{setSelectedAssemblyId(assembly.id);setSelectedMeasurementId(null);setTool('select');}}><span className={styles.assemblyUnit}>{assembly.primary_measurement}</span><span><strong>{assembly.name}</strong><small>{assembly.code}{assembly.category?` · ${assembly.category}`:''}</small></span></button>;}):<div className={styles.emptySmall}>No concrete assembly matches that search.</div>}</div>
            {selectedVersion&&<div className={styles.assemblySource}>V{selectedVersion.version_no} · {selectedVersion.source_label||'Carez assembly'}{selectedVersion.source_reference&&<span>{selectedVersion.source_reference}</span>}</div>}
          </div>}'''
workspace = replace_once(workspace, legacy_group, condition_group, 'condition takeoffs group')

workspace = replace_once(workspace, r'''<small>{assembly?.name||'Assembly'} · {formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}''', r'''<small>{conditionAuthoringActive?(conditionMeasurementIdSet.has(measurement.id)?'Concrete Condition':'Legacy takeoff'):(assembly?.name||'Assembly')} · {formatTakeoffMeasurement(measurement.raw_quantity,measurement.raw_unit)}''', 'object list terminology')

workspace = replace_once(workspace, r'''          {selectedAssembly&&<div className={styles.inspectorActionStrip}>''', r'''          {!conditionAuthoringActive&&selectedAssembly&&<div className={styles.inspectorActionStrip}>''', 'inspector active assembly strip')

workspace = replace_once(workspace, r'''            {selectedSummary?.inputHolds?<div className={styles.statusWarn}>{selectedSummary.inputHolds} generated line{selectedSummary.inputHolds===1?'':'s'} waiting on assembly input. Geometry and unaffected quantities are saved.</div>:null}
            {selectedSummary?.priceHolds?<div className={styles.statusWarn}>{selectedSummary.priceHolds} generated line{selectedSummary.priceHolds===1?'':'s'} still need pricing or a labor rate.</div>:null}
            {selectedVersionRecord&&selectedAssemblyRecord&&<TakeoffAssemblyInputEditor measurement={selectedMeasurement} version={selectedVersionRecord} assembly={selectedAssemblyRecord} variables={variables} outputs={selectedOutputs} takeoffSetId={takeoffSet.id} locked={locked} onMessage={setMessage}/>} ''', r'''            {selectedSummary?.inputHolds?<div className={styles.statusWarn}>{selectedSummary.inputHolds} generated line{selectedSummary.inputHolds===1?'':'s'} waiting on {conditionAuthoringActive?'required Condition input':'assembly input'}. Geometry and unaffected quantities are saved.</div>:null}
            {selectedSummary?.priceHolds?<div className={styles.statusWarn}>{selectedSummary.priceHolds} generated line{selectedSummary.priceHolds===1?'':'s'} still need pricing or a labor rate.</div>:null}
            {conditionAuthoringActive?<div className={styles.statusWarn}>{conditionMeasurementIdSet.has(selectedMeasurement.id)?'Condition-managed takeoff. Plan facts, methods, production, and modules are edited in Concrete Conditions.':'Legacy takeoff preserved for historical lineage. New scope is authored through Concrete Conditions.'}</div>:selectedVersionRecord&&selectedAssemblyRecord?<TakeoffAssemblyInputEditor measurement={selectedMeasurement} version={selectedVersionRecord} assembly={selectedAssemblyRecord} variables={variables} outputs={selectedOutputs} takeoffSetId={takeoffSet.id} locked={locked} onMessage={setMessage}/>:null} ''', 'selected takeoff legacy authoring gate')

workspace = replace_once(workspace, r'''          </div>:selectedAssembly?<div className={styles.group}>''', r'''          </div>:conditionAuthoringActive?<div className={styles.group}><div className={styles.groupTitle}>New Takeoff</div><div className={styles.groupHelp}>New measured scope starts from a Concrete Condition so geometry, modules, outputs, and estimate lineage stay together.</div>{!locked&&<button type="button" className={styles.measurePrimary} onClick={openConditions}><Crosshair size={16}/> Open Concrete Conditions</button>}</div>:selectedAssembly?<div className={styles.group}>''', 'new takeoff condition branch')

workspace = replace_once(workspace, r'''<kbd>M</kbd><span>Measure</span>''', r'''<kbd>M</kbd><span>{conditionAuthoringActive?'Open Conditions':'Measure'}</span>''', 'shortcut terminology')
workspace = replace_once(workspace, r'''        {inspectorTab==='buildPlan'&&<>''', r'''        {!conditionAuthoringActive&&inspectorTab==='buildPlan'&&<>''', 'build plan pane gate')

workspace_path.write_text(workspace)

condition_path = Path('components/takeoff/ConcreteConditionAuthoring.tsx')
condition = condition_path.read_text()
condition = replace_once(condition, r'''  const [open, setOpen] = useState(true);
  const [floating, setFloating] = useState(false);''', r'''  const [open, setOpen] = useState(true);
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    const openConditions = () => setOpen(true);
    window.addEventListener('carez:open-conditions', openConditions);
    return () => window.removeEventListener('carez:open-conditions', openConditions);
  }, []);''', 'condition open event')
condition = condition.replace('matching Concrete Condition recipe', 'required Concrete Condition geometry')
condition_path.write_text(condition)

print('Applied guarded active-Takeoff legacy authoring retirement patch.')
