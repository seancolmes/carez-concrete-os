'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  Hammer,
  Layers3,
  Pencil,
  Ruler,
  ShieldCheck,
  X,
} from 'lucide-react';
import styles from './build-plan.module.css';

const steps = [
  { key: 'plan', label: 'Plan Facts', caption: 'What must be built', icon: FileText },
  { key: 'method', label: 'Means & Methods', caption: 'How Carez will build it', icon: Hammer },
  { key: 'resources', label: 'Resources', caption: 'What the method requires', icon: Boxes },
  { key: 'production', label: 'Production', caption: 'How long the work takes', icon: Gauge },
  { key: 'review', label: 'Review & Verify', caption: 'Lock the job method', icon: ShieldCheck },
] as const;

type StepKey = typeof steps[number]['key'];

const methodSummary = 'Formed footing · 2x10 DF · 2 sides · stakes 4′ O.C.';

function Field({ label, value, unit, source, quiet = false }: { label: string; value: string; unit?: string; source?: string; quiet?: boolean }) {
  return <label className={`${styles.field} ${quiet ? styles.fieldQuiet : ''}`}>
    <span>{label}</span>
    <div className={styles.inputShell}><input value={value} readOnly />{unit && <b>{unit}</b>}</div>
    {source && <small>{source}</small>}
  </label>;
}

function SelectField({ label, value, source }: { label: string; value: string; source?: string }) {
  return <label className={styles.field}>
    <span>{label}</span>
    <select value={value} onChange={() => undefined}><option>{value}</option></select>
    {source && <small>{source}</small>}
  </label>;
}

function PlanStep() {
  return <>
    <div className={styles.sectionHeading}><div><span>01 · PLAN FACTS</span><h2>Define what the drawings require.</h2><p>Design information belongs here. Carez does not turn estimating allowances into structural requirements.</p></div><div className={styles.sourceBadge}><FileText size={14}/> S2.1 · Detail 3</div></div>
    <div className={styles.fieldSection}>
      <div className={styles.fieldSectionTitle}><strong>Footing geometry</strong><span>Structural / architectural detail</span></div>
      <div className={styles.fieldGrid}><Field label="Footing width" value="24" unit="IN" source="S2.1 · Detail 3"/><Field label="Footing depth" value="10" unit="IN" source="S2.1 · Detail 3"/></div>
    </div>
    <div className={styles.fieldSection}>
      <div className={styles.fieldSectionTitle}><strong>Reinforcing</strong><span>Engineer-defined installed steel</span></div>
      <div className={styles.fieldGrid}><SelectField label="Reinforcement" value="Continuous Rebar" source="S2.1 · Footing schedule"/><SelectField label="Bar size" value="#4" source="S2.1 · Detail 3"/><Field label="Continuous bars" value="2" unit="EA" source="S2.1 · Detail 3"/><Field label="Engineer lap splices" value="2" unit="EA" source="Structural placing requirement"/><Field label="Engineer lap length" value="30" unit="IN" source="Structural detail / lap schedule"/><Field label="Plan reference" value="S2.1 / 3" source="Stored with this job method" quiet/></div>
      <div className={styles.ruleNote}><ShieldCheck size={15}/><div><strong>Lap steel is a plan/design quantity.</strong><span>Estimator waste is intentionally not entered on this step.</span></div></div>
    </div>
  </>;
}

function MethodStep() {
  return <>
    <div className={styles.sectionHeading}><div><span>02 · MEANS & METHODS</span><h2>Confirm how Carez will build it.</h2><p>These choices control the resource recipe. They are job decisions, not facts inferred from footing geometry.</p></div><div className={styles.methodTag}>CAREZ METHOD</div></div>
    <div className={styles.fieldSection}>
      <div className={styles.fieldSectionTitle}><strong>Formwork</strong><span>Verified builder method</span></div>
      <div className={styles.fieldGrid}><SelectField label="Formwork method" value="Formed Footing"/><SelectField label="Form system" value="2x10 Douglas Fir Board Form"/><Field label="Formed sides" value="2" unit="EA"/><Field label="Maximum stake spacing" value="4" unit="FT"/></div>
    </div>
    <div className={styles.fieldSection}>
      <div className={styles.fieldSectionTitle}><strong>Concrete placement</strong><span>Job access / placing method</span></div>
      <div className={styles.fieldGrid}><SelectField label="Placement method" value="Direct Chute"/><SelectField label="Consolidation" value="Typical Footing Placement"/></div>
    </div>
    <div className={styles.engineeringBand}><div><strong>Method envelope</strong><span>Carez OS counts resources for a verified layout; it does not invent engineered wall-form tie, wale, strongback or bracing layouts.</span></div><button>View source basis</button></div>
  </>;
}

const resources = [
  ['Ready-mix concrete', '0.64', 'CY', 'Consumed material'],
  ['2x10 Douglas Fir form board', '21.0', 'LF', 'Consumed material'],
  ['Form stakes', '8', 'EA', 'Reusable inventory'],
  ['#4 reinforcing · installed', '16.70', 'LB', 'Design / installed'],
  ['#4 reinforcing · procurement', '17.54', 'LB', '5% estimator waste'],
];

function ResourcesStep() {
  return <>
    <div className={styles.sectionHeading}><div><span>03 · RESOURCE BUILD-UP</span><h2>Preview what the method actually requires.</h2><p>Before geometry exists, Carez can preview a standard 10 LF sample. The measured takeoff later drives the exact quantities.</p></div><div className={styles.sampleBasis}>SAMPLE BASIS · 10 LF</div></div>
    <div className={styles.resourceTable}><div className={styles.resourceHead}><span>Resource</span><span>Quantity</span><span>Unit</span><span>Behavior</span></div>{resources.map(([name, qty, unit, behavior]) => <div className={styles.resourceRow} key={name}><strong>{name}</strong><b>{qty}</b><span>{unit}</span><small>{behavior}</small></div>)}</div>
    <div className={styles.formulaStrip}><div><span>INSTALLED REBAR</span><strong>Base bar LF + engineer lap LF</strong></div><ChevronRight size={16}/><div><span>PROCUREMENT REBAR</span><strong>Installed steel × estimator waste</strong></div><ChevronRight size={16}/><div><span>INSTALL LABOR</span><strong>Installed steel only</strong></div></div>
  </>;
}

function ProductionStep() {
  return <>
    <div className={styles.sectionHeading}><div><span>04 · PRODUCTION</span><h2>Review the labor assumptions.</h2><p>Production assumptions convert physical work into man-hours. They do not alter physical material quantities.</p></div><div className={styles.historyTag}>CAREZ BASELINE</div></div>
    <div className={styles.productionTable}>
      <div className={styles.productionHead}><span>Operation</span><span>Basis</span><span>Rate</span><span>Source</span></div>
      <div><strong>Set footing board forms</strong><span>SFCA</span><b>0.050 MH / SFCA</b><small>Carez baseline · review</small></div>
      <div><strong>Set & tie reinforcing</strong><span>Installed LB</span><b>0.008 MH / LB</b><small>Carez baseline · review</small></div>
      <div><strong>Place footing concrete</strong><span>CY</span><b>0.552 MH / CY</b><small>Direct chute baseline</small></div>
    </div>
    <div className={styles.ruleNote}><Gauge size={15}/><div><strong>Future production history belongs here.</strong><span>Carez actuals can eventually show company average, crew trend and job-specific adjustment without overwriting the published baseline.</span></div></div>
  </>;
}

function ReviewStep({ verified, onVerify }: { verified: boolean; onVerify: () => void }) {
  return <>
    <div className={styles.sectionHeading}><div><span>05 · REVIEW & VERIFY</span><h2>Lock the job method before drawing.</h2><p>The verified profile becomes immutable lineage for every measurement created with it.</p></div><div className={`${styles.reviewStatus} ${verified ? styles.reviewStatusGood : ''}`}>{verified ? <Check size={14}/> : <Pencil size={14}/>} {verified ? 'VERIFIED' : 'DRAFT'}</div></div>
    <div className={styles.reviewGrid}>
      <div><span>PLAN</span><strong>24″ W × 10″ D</strong><small>#4 · 2 continuous · 2 laps @ 30″</small></div>
      <div><span>FORMWORK</span><strong>2x10 DF · 2 sides</strong><small>Stakes @ 4′ maximum O.C.</small></div>
      <div><span>PLACEMENT</span><strong>Direct Chute</strong><small>Typical footing consolidation</small></div>
      <div><span>WASTE</span><strong>Rebar procurement · 5%</strong><small>Separate from engineer lap steel</small></div>
      <div><span>PRODUCTION</span><strong>3 reviewed operations</strong><small>Published baseline retained</small></div>
      <div><span>SOURCE</span><strong>S2.1 · Detail 3</strong><small>Job method retains source reference</small></div>
    </div>
    <div className={styles.verifyFooter}><div><ShieldCheck size={20}/><span><strong>{verified ? 'Job method R3 verified' : 'Ready to verify'}</strong><small>{verified ? 'Measurements created from this point keep this exact profile.' : 'Verification locks these assumptions and returns the estimator to Takeoff.'}</small></span></div><button onClick={onVerify}>{verified ? <Check size={15}/> : <ShieldCheck size={15}/>} {verified ? 'Verified' : 'Verify & Return to Takeoff'}</button></div>
  </>;
}

function DrawingCanvas({ onOpen }: { onOpen: () => void }) {
  return <div className={styles.canvasMode}>
    <div className={styles.canvasToolbar}><button>Select</button><button>Pan</button><button className={styles.toolActive}><Ruler size={14}/> Linear</button><span/><button>100%</button></div>
    <div className={styles.planCanvas}>
      <div className={styles.planSheet}>
        <div className={styles.planTitle}>FOUNDATION PLAN · A3.1</div>
        <div className={styles.foundationSketch}><i/><i/><i/><i/><i/><i/></div>
        <div className={styles.dimensionLine}>GARAGE STRIP FOOTING · 24″ × 10″</div>
      </div>
      <button className={styles.resumeBuildPlan} onClick={onOpen}><Hammer size={15}/> Review Build Plan</button>
    </div>
    <div className={styles.quantityBar}><strong>QUANTITY WORKSHEET</strong><span>Strip Footing — Garage 1</span><b>7′-7 1/4″</b><span>0.49 CY</span><span>0.63 MH</span><span>$908.69</span></div>
  </div>;
}

export function BuildPlanPrototype() {
  const [active, setActive] = useState<StepKey>('plan');
  const [open, setOpen] = useState(true);
  const [verified, setVerified] = useState(false);
  const activeIndex = steps.findIndex(step => step.key === active);
  const activeStep = steps[activeIndex];
  const StepIcon = activeStep.icon;
  const nextStep = steps[Math.min(steps.length - 1, activeIndex + 1)];
  const priorStep = steps[Math.max(0, activeIndex - 1)];
  const content = useMemo(() => {
    if (active === 'plan') return <PlanStep/>;
    if (active === 'method') return <MethodStep/>;
    if (active === 'resources') return <ResourcesStep/>;
    if (active === 'production') return <ProductionStep/>;
    return <ReviewStep verified={verified} onVerify={() => { setVerified(true); setOpen(false); }}/ >;
  }, [active, verified]);

  return <main className={styles.lab}>
    <aside className={styles.appRail}><div className={styles.mark}>C</div><button><Layers3 size={17}/><span>Home</span></button><button className={styles.railActive}><Ruler size={17}/><span>Estimate</span></button><button><Hammer size={17}/><span>Jobs</span></button><div className={styles.railSpacer}/><small>DESIGN<br/>LAB</small></aside>
    <header className={styles.topbar}><div><span>TAKEOFF</span><strong>QA Browser Structural Takeoff</strong></div><div className={styles.topIdentity}>DESIGN LAB · P1 BUILD METHOD WORKBENCH</div></header>
    <aside className={styles.sheets}><div className={styles.paneTitle}>SHEETS <b>25</b></div>{['A1.0 Cover','A2.1 Floor Plan','A3.1 Foundation','A4.1 Elevations','S2.1 Foundation Details'].map((sheet, index) => <button key={sheet} className={index === 2 ? styles.sheetActive : ''}><b>{index + 1}</b><span>{sheet}<small>{index === 2 ? 'SCALE SET · 1 TAKEOFF' : 'SET SCALE · 0 TAKEOFFS'}</small></span></button>)}</aside>

    <section className={styles.centerWorkspace}>
      {open ? <div className={styles.workbench}>
        <div className={styles.workbenchHeader}><button className={styles.backButton} onClick={() => setOpen(false)}><ChevronLeft size={16}/> Back to Takeoff</button><div><span>BUILD PLAN</span><h1>Strip Footing · Garage 1</h1><p>FTG-STRIP · Job method R3</p></div><div className={styles.headerState}><span>{verified ? 'VERIFIED' : 'DRAFT METHOD'}</span><b>{methodSummary}</b></div></div>
        <div className={styles.workbenchBody}>
          <nav className={styles.stepNav}>{steps.map((step, index) => { const Icon = step.icon; const selected = step.key === active; return <button key={step.key} className={selected ? styles.stepActive : ''} onClick={() => setActive(step.key)}><span className={styles.stepNo}>{String(index + 1).padStart(2,'0')}</span><Icon size={16}/><span><strong>{step.label}</strong><small>{step.caption}</small></span>{index < activeIndex || verified ? <Check size={14}/> : <ChevronRight size={14}/>}</button>; })}<div className={styles.stepRule}><ShieldCheck size={14}/><span><strong>Method lineage</strong><small>Changes after verification create a new revision.</small></span></div></nav>
          <article className={styles.editor}><div className={styles.editorContext}><StepIcon size={16}/><span>{activeStep.label}</span><b>Garage 1</b></div>{content}<div className={styles.editorNav}><button disabled={activeIndex === 0} onClick={() => setActive(priorStep.key)}><ChevronLeft size={14}/> Previous</button>{active !== 'review' && <button className={styles.nextButton} onClick={() => setActive(nextStep.key)}>Continue · {nextStep.label}<ChevronRight size={14}/></button>}</div></article>
        </div>
      </div> : <DrawingCanvas onOpen={() => setOpen(true)}/ >}
    </section>

    <aside className={styles.inspector}>
      <div className={styles.inspectorTitle}><span>TAKEOFF</span><strong>Page 4 · Scale 1/4″ = 1′-0″</strong></div>
      <div className={styles.inspectorSection}><span className={styles.inspectorKicker}>ASSEMBLY</span><strong>Strip Footing</strong><small>FTG-STRIP · Linear</small></div>
      <div className={`${styles.methodSummary} ${verified ? styles.methodVerified : ''}`}><div><span>{verified ? <ShieldCheck size={14}/> : <Pencil size={14}/>} {verified ? 'VERIFIED BUILD METHOD' : 'BUILD METHOD DRAFT'}</span><strong>{methodSummary}</strong><small>#4 · 2 continuous · engineer laps separate · Direct Chute</small></div><button onClick={() => setOpen(true)}>{verified ? 'Review' : 'Complete Build Plan'}<ChevronRight size={14}/></button></div>
      <div className={styles.inspectorSection}><span className={styles.inspectorKicker}>TAKEOFF DETAILS</span><label><span>Name</span><input value="Strip Footing — Garage 1" readOnly/></label><label><span>Location</span><input value="Garage" readOnly/></label></div>
      <div className={styles.inspectorSection}><span className={styles.inspectorKicker}>DRAWING STATE</span><div className={styles.miniStats}><span><b>24″ × 10″</b>Plan detail</span><span><b>2 sides</b>Formed</span><span><b>4′ O.C.</b>Stakes</span><span><b>#4 × 2</b>Rebar</span></div></div>
      <button className={styles.startTakeoff} disabled={!verified}>{verified ? <Ruler size={15}/> : <X size={15}/>} {verified ? 'Start Linear Takeoff' : 'Verify Build Plan to Draw'}</button>
    </aside>
  </main>;
}
